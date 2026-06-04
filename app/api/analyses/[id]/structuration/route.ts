// ============================================================
// PRELUDE - Bloc 3 : route a la demande pour la structuration a l entree
// ------------------------------------------------------------
// GET   : retourne la structuration deja calculee si elle existe,
//         null sinon. Read-only, aucun appel LLM.
// POST  : declenche le moteur Bloc 3 sur le result_json de l analyse
//         existante, merge le resultat sous la cle structurationEntree
//         et persiste via updateAnalysisLive. Aucune modification du
//         pipeline d analyse principal.
//
// Le module fonctionne sur les analyses deja archivees : on consomme
// uniquement result_json, pas besoin de relancer Bloc 1 ni Bloc 2.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAnalysis,
  updateAnalysisLive,
  extractAnalysisMetadata,
  isPersistenceEnabled,
} from '@/lib/analysis-store';
import {
  analyzeStructurationEntree,
  InsufficientInputError,
} from '@/lib/engines/structuration-entree';
import { logException } from '@/lib/error-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ enabled: false, structuration: null });
  }
  const analysis = await getAnalysis(params.id);
  if (!analysis) {
    return NextResponse.json(
      { error: 'Analyse introuvable ou non accessible' },
      { status: 404 },
    );
  }
  const existing = analysis.resultJson?.structurationEntree || null;
  return NextResponse.json({ enabled: true, structuration: existing });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const analysisId = params.id;
  try {
    if (!isPersistenceEnabled()) {
      return NextResponse.json(
        { error: 'persistence-disabled' },
        { status: 503 },
      );
    }

    const analysis = await getAnalysis(analysisId);
    if (!analysis) {
      return NextResponse.json(
        { error: 'Analyse introuvable ou non accessible' },
        { status: 404 },
      );
    }

    const existingResult = analysis.resultJson || {};
    const verdict = existingResult.finalRecommendation?.verdict || analysis.verdict;

    if (verdict === 'refuser') {
      return NextResponse.json(
        {
          error: 'Le verdict de l instruction est "refuser". La structuration a l entree n est pas applicable a ce dossier.',
        },
        { status: 400 },
      );
    }

    // Appel du moteur Bloc 3. Le moteur peut throw InsufficientInputError
    // si finalRecommendation est absent ou si le verdict invalide la
    // demande. On differencie ces erreurs (400) des erreurs techniques
    // (500) pour que l UI reagisse proprement.
    let structuration;
    try {
      structuration = await analyzeStructurationEntree(existingResult);
    } catch (engineErr: any) {
      if (engineErr instanceof InsufficientInputError) {
        return NextResponse.json(
          { error: engineErr.message },
          { status: 400 },
        );
      }
      throw engineErr;
    }

    // Merge sous la cle structurationEntree. Le filtre de normalisation
    // dans analysis-store s applique a tout le result_json en sortie,
    // donc les em-dashes residuels qui auraient echappe au moteur sont
    // attrapes a la persistance.
    const newResult = {
      ...existingResult,
      structurationEntree: structuration,
      meta: {
        ...(existingResult.meta || {}),
        structurationEntreeAt: new Date().toISOString(),
      },
    };

    const metadata = extractAnalysisMetadata(newResult);
    const persisted = await updateAnalysisLive(analysisId, {
      companyName: metadata.companyName || analysis.companyName,
      sector: metadata.sector ?? analysis.sector,
      subSector: metadata.subSector ?? analysis.subSector,
      country: metadata.country ?? analysis.country,
      geographicHub: metadata.geographicHub ?? analysis.geographicHub,
      yearFounded: metadata.yearFounded ?? analysis.yearFounded,
      roundType: metadata.roundType ?? analysis.roundType,
      roundAmountEur: metadata.roundAmountEur ?? analysis.roundAmountEur,
      verdict: metadata.verdict || analysis.verdict,
      verdictConfidence: metadata.verdictConfidence ?? analysis.verdictConfidence,
      globalScore: metadata.globalScore ?? analysis.globalScore,
      blindspotScore: metadata.blindspotScore ?? analysis.blindspotScore,
      contrarianScore: metadata.contrarianScore ?? analysis.contrarianScore,
      coherenceScore: metadata.coherenceScore ?? analysis.coherenceScore,
      resultJson: newResult,
      sourceText: analysis.sourceText,
      sourceFilename: analysis.sourceFilename,
      sourcePages: analysis.sourcePages,
      pipelineDurationMs: analysis.pipelineDurationMs,
      pipelineEnginesStatus: analysis.pipelineEnginesStatus,
    });

    return NextResponse.json({
      ok: true,
      persisted,
      structuration,
      result: newResult,
    });
  } catch (err: any) {
    await logException('api.structuration.route', err, {
      severity: 'error',
      analysisId,
      context: { phase: 'bloc3-pipeline' },
    });
    return NextResponse.json(
      { error: err?.message || 'Erreur moteur structuration' },
      { status: 500 },
    );
  }
}
