// ============================================================
// GET /api/analyses/[id]/trajectory
// ------------------------------------------------------------
// Retourne un TrajectorySummary calcule sur l ensemble des versions
// d un dossier. Permet au client d afficher la trajectoire
// historique d un dossier sans charger N versions completes en
// memoire.
//
// Pipeline :
// 1. listVersions(analysisId) recupere la liste des metadonnees
//    de toutes les versions persistees pour ce dossier.
// 2. Pour chaque version, getVersion(analysisId, versionNum)
//    recupere le snapshotJson complet (le payload de l analyse a
//    cet instant T).
// 3. extractSnapshot reduit chaque payload en un TrajectorySnapshot
//    compact.
// 4. buildTrajectoryFromAnalyses calcule la chaine de comparisons
//    successives plus la comparison globale.
//
// Si aucune version persistee, retourne un summary vide. Si une
// seule version, retourne un summary avec le snapshot mais pas de
// comparison (besoin de minimum 2 pour comparer).
//
// La route est read-only et n exige pas d authentification edit
// car la consultation de la trajectoire ne modifie pas les
// donnees. La policy Supabase RLS controle l acces ligne par
// ligne sur analyses_versions.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { listVersions, getVersion } from '@/lib/collaboration-store';
import { getAnalysis, isPersistenceEnabled } from '@/lib/analysis-store';
import {
  buildTrajectoryFromAnalyses,
  type AnalysisPayloadForSnapshot,
} from '@/lib/engines/trajectory';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }

  const analysisId = params.id;
  if (!analysisId) {
    return NextResponse.json({ error: 'missing-id' }, { status: 400 });
  }

  // 1. Liste des versions existantes
  const versions = await listVersions(analysisId);

  // Cas degenere : pas de version. On essaie au moins de produire
  // un summary avec l analyse courante (le dossier a peut-etre ete
  // analyse une seule fois sans creation explicite de version).
  if (!versions || versions.length === 0) {
    const analysis = await getAnalysis(analysisId);
    if (!analysis) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    // L analyse courante seule. On la passe a buildTrajectory qui
    // produira un summary plat (firstSnapshot = lastSnapshot, pas
    // de comparison).
    const summary = buildTrajectoryFromAnalyses([
      hydrateAnalysisAsPayload(analysis),
    ]);
    return NextResponse.json({ summary });
  }

  // 2. Charge le snapshotJson de chaque version. Parallelise les
  //    appels pour limiter la latence sur les dossiers a beaucoup
  //    de versions. Un timeout global de 30s couvre les cas les
  //    plus extremes.
  const versionFulls = await Promise.all(
    versions.map((v) => getVersion(analysisId, v.versionNum)),
  );

  // 3. Convertit chaque version en payload pour extractSnapshot.
  //    Les versions dont le snapshotJson est null ou malforme sont
  //    silencieusement ignorees.
  const payloads: AnalysisPayloadForSnapshot[] = [];
  for (const v of versionFulls) {
    if (!v || !v.snapshotJson) continue;
    const sj = v.snapshotJson as any;
    payloads.push({
      // L id du payload est l id de la version, pas l analysisId,
      // pour distinguer chaque snapshot dans la chaine.
      analysisId: v.id,
      analyzedAt: v.createdAt,
      // Le snapshotJson contient typiquement le payload complet :
      // mechanicalScore, fragiliteStructurelle, narrativeDrift, etc.
      // On le merge pour qu extractSnapshot trouve les champs
      // attendus.
      mechanicalScore: sj.mechanicalScore,
      fragiliteStructurelle: sj.fragiliteStructurelle,
      narrativeDrift: sj.narrativeDrift,
      finalRecommendation: sj.finalRecommendation,
      globalScore: sj.globalScore,
      verdict: sj.verdict,
    });
  }

  // 4. Construit la chaine
  const summary = buildTrajectoryFromAnalyses(payloads);

  return NextResponse.json({ summary });
}

// ============================================================
// Helper : hydrate une analyse complete chargee via getAnalysis
// en payload exploitable par extractSnapshot. Necessaire pour le
// cas degenere ou aucune version persistee n existe (l analyse
// courante est consultee directement).
// ============================================================
function hydrateAnalysisAsPayload(analysis: any): AnalysisPayloadForSnapshot {
  const result = analysis.resultJson ?? analysis.result ?? {};
  return {
    analysisId: analysis.id ?? 'analysis-current',
    analyzedAt: analysis.createdAt ?? analysis.created_at ?? new Date().toISOString(),
    mechanicalScore: result.mechanicalScore,
    fragiliteStructurelle: result.fragiliteStructurelle,
    narrativeDrift: result.narrativeDrift,
    finalRecommendation: result.finalRecommendation,
    globalScore: result.globalScore ?? analysis.globalScore,
    verdict: result.verdict ?? analysis.verdict,
  };
}
