// ============================================================
// PRELUDE - Runner de re-analyse automatique portfolio
// ------------------------------------------------------------
// Orchestre la re-execution du pipeline d analyse pour un dossier
// in-portfolio. Reutilise les modules d analyse existants plutot
// que d en dupliquer la logique : le but est qu une re-analyse
// declenchee par le cron produise un snapshot strictement
// equivalent a une re-analyse manuelle, signe par le flag
// isAutoReanalysis dans le note de la version.
//
// Portee de la re-execution :
//   - Re-run effectif des moteurs doctrine-driven et LLM : fragilite
//     structurelle et narrative drift. Ces deux moteurs sont ceux
//     dont la sortie peut deriver d une analyse a l autre meme avec
//     des entrees identiques (calibration de prompts evolutive,
//     non-determinisme LLM borne, lexique de drift recalibre).
//   - Reuse des autres moteurs depuis le result_json precedent.
//     extraction, team, market, macro, financial, etc. consomment
//     le PDF source que Prelude ne persiste pas (choix architectural,
//     voir CLAUDE.md). En reusant leurs outputs precedents, on
//     garantit que le runner produit un snapshot exploitable sans
//     re-uploader le deck.
//
// Le snapshot produit est ensuite projete par le trigger Postgres
// vers trajectory_snapshots, ce qui declenche les comparaisons et
// le module d alertes downstream.
//
// Cette frontiere de re-execution est honnete : elle reflete ce que
// Prelude peut effectivement re-faire automatiquement avec les
// donnees persistees. Une re-extraction PDF necessiterait de stocker
// les binaires source, ce qui est un chantier upstream distinct.
// ============================================================

import { getAnalysis } from '@/lib/analysis-store';
import { createVersion } from '@/lib/collaboration-store';
import { analyzeFragiliteStructurelle } from '@/lib/engines/fragility-structurelle';
import '@/lib/engines/fragility-structurelle/growth-subsidized-pattern';
import '@/lib/engines/fragility-structurelle/infrastructure-hostage-pattern';
import '@/lib/engines/fragility-structurelle/fixed-cost-trap-pattern';
import '@/lib/engines/fragility-structurelle/regulatory-time-bomb-pattern';
import '@/lib/engines/fragility-structurelle/commoditization-drift-pattern';
import '@/lib/engines/fragility-structurelle/capital-structure-fragility-pattern';
import '@/lib/engines/fragility-structurelle/scale-mirage-risk-pattern';
import { analyzeNarrativeDrift } from '@/lib/engines/narrative-drift-engine';

export interface AutoReanalysisResult {
  analysisId: string;
  status: 'ok' | 'skipped' | 'failed';
  newVersionNum?: number;
  reason?: string;
}

/**
 * Re-execute partiellement le pipeline d analyse pour un dossier
 * portfolio. Persistance du nouveau snapshot via createVersion qui
 * declenche le trigger trajectory_snapshots.
 *
 * Pas d entree autre que l identifiant : tout le contexte (source
 * text, extraction precedente, financialData precedente) est lu
 * depuis la base. Cela rend le runner appelable depuis un cron sans
 * dependances externes au-dela de Supabase et Anthropic.
 *
 * Non-throwing : capture toutes les erreurs et les remonte dans le
 * status. Le cron downstream loggera les failed et continuera ses
 * autres dossiers.
 */
export async function runAutoReanalysis(
  analysisId: string,
): Promise<AutoReanalysisResult> {
  try {
    const analysis = await getAnalysis(analysisId);
    if (!analysis) {
      return { analysisId, status: 'skipped', reason: 'analysis-not-found' };
    }

    const previousResult = analysis.resultJson;
    if (!previousResult || typeof previousResult !== 'object') {
      return { analysisId, status: 'skipped', reason: 'no-previous-result' };
    }

    const extraction = previousResult.extraction;
    if (!extraction) {
      return { analysisId, status: 'skipped', reason: 'no-extraction-in-previous-result' };
    }

    const sourceText = analysis.sourceText || '';
    if (!sourceText || sourceText.length < 200) {
      // Sans source text exploitable, le narrative-drift ne peut pas
      // tourner. On preserve l atomicite : skip propre sans inserer
      // de version degradee.
      return { analysisId, status: 'skipped', reason: 'source-text-missing' };
    }

    // Resout le contexte sectoriel courant pour que les re-runs
    // beneficient de la derniere fiche sectorielle persistee. Si la
    // resolution echoue (Supabase down, secteur non couvert), on
    // retombe sur l execution sans injection sectorielle.
    let sectoralContext: import('@/lib/engines/sectoral-injection').SectoralContext | null = null;
    try {
      const { resolveSectoralContext } = await import('@/lib/engines/sectoral-injection');
      sectoralContext = await resolveSectoralContext(extraction);
    } catch (err: any) {
      console.warn(
        `[portfolio-reanalysis-runner] sectoral-context resolution echec: ${err?.message || err}`,
      );
    }

    // Re-run fragilite structurelle. L input combine l extraction,
    // les financialData et marketAnalysis precedents (qu on reuse
    // car re-extraction PDF impossible sans binaire source). Les
    // patterns LLM sont reappeles : leur sortie peut deriver si
    // la doctrine a evolue entre les deux runs.
    let fragiliteOutput: any = previousResult.fragiliteStructurelle ?? null;
    try {
      fragiliteOutput = await analyzeFragiliteStructurelle(
        {
          extraction,
          financialData: previousResult.financialExtraction || null,
          marketAnalysis: previousResult.marketAnalysis || null,
          rawPitchText: sourceText,
          sectoralContext,
        },
        previousResult.relevanceMatrix || null,
      );
    } catch (err: any) {
      console.warn(
        `[portfolio-reanalysis-runner] fragilite re-run echec, reuse precedent: ${err?.message || err}`,
      );
    }

    // Re-run narrative-drift. On injecte previousAnalysisMetrics
    // depuis le precedent run pour permettre au moteur de detecter
    // les variations lexicales en glissement.
    let narrativeDriftOutput: any = previousResult.narrativeDrift ?? null;
    try {
      const prevMetrics = previousResult.narrativeDrift?.metricsLexicales || null;
      narrativeDriftOutput = await analyzeNarrativeDrift({
        extraction,
        pitchText: sourceText,
        additionalCommunications: [],
        previousAnalysisMetrics: prevMetrics
          ? {
              densiteConcrete: prevMetrics.densiteConcrete ?? 0,
              ratioAbstraitConcret: prevMetrics.ratioAbstraitConcret ?? 0,
              timestamp: previousResult.meta?.createdAt || analysis.createdAt || new Date().toISOString(),
            }
          : null,
        sectoralContext,
        assetClass: previousResult.relevanceMatrix?.assetClass,
      });
    } catch (err: any) {
      console.warn(
        `[portfolio-reanalysis-runner] narrative-drift re-run echec, reuse precedent: ${err?.message || err}`,
      );
    }

    // Stitch new result_json : on conserve tout le payload precedent
    // et on ecrase seulement les sections re-jouees. Le payload reste
    // structurellement identique a une analyse manuelle, ce qui
    // permet a tout le code downstream (note, dashboard, trajectory
    // extractor) de le consommer sans branche speciale.
    const newResult = {
      ...previousResult,
      fragiliteStructurelle: fragiliteOutput,
      narrativeDrift: narrativeDriftOutput,
      meta: {
        ...(previousResult.meta || {}),
        isAutoReanalysis: true,
        autoReanalyzedAt: new Date().toISOString(),
      },
    };

    const version = await createVersion({
      analysisId,
      snapshotJson: newResult,
      sourceFilename: analysis.sourceFilename || null,
      pipelineDurationMs: null,
      note: 'Re-analyse automatique portfolio (cycle six mois)',
    });

    if (!version) {
      return { analysisId, status: 'failed', reason: 'create-version-failed' };
    }

    return {
      analysisId,
      status: 'ok',
      newVersionNum: version.versionNum,
    };
  } catch (err: any) {
    console.error(`[portfolio-reanalysis-runner] exception ${analysisId}:`, err);
    return {
      analysisId,
      status: 'failed',
      reason: err?.message || 'exception',
    };
  }
}
