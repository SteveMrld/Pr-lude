import { extractFromDeck } from './engines/extraction-engine';
import { analyzeTeam } from './engines/team-engine';
import { analyzeMarket } from './engines/market-engine';
import { analyzeMacro } from './engines/macro-engine';
import { matchPatterns } from './engines/pattern-engine';
import { performCausalReversal } from './engines/causal-engine';
import { analyzeBlindspots } from './engines/blindspot-engine';
import { analyzeContrarian } from './engines/contrarian-engine';
import { extractFinancialData } from './engines/financial-extraction-engine';
import { analyzeFinancialCoherence } from './engines/financial-coherence-engine';
import { orchestrateFinalRecommendation } from './engines/orchestrator';
import { generateReferenceChecks } from './engines/reference-checks-engine';
import { analyzeBenchmarks } from './engines/benchmark-engine';
import { getJobStore } from './job-store';

interface RunOpts {
  jobId: string;
  pitchDeckPayload: string; // base64 PDF
  pitchDeckName: string;
  businessPlanPayload: string | null; // texte BP ou null
  businessPlanName: string | null;
  otherFileNames: string[];
}

export async function runPipeline(opts: RunOpts): Promise<void> {
  const store = getJobStore();
  const startTime = Date.now();
  const { jobId, pitchDeckPayload, pitchDeckName, businessPlanPayload, businessPlanName, otherFileNames } = opts;

  try {
    // Moteur 1 : Extraction du pitch deck
    await store.setEngineRunning(jobId, 'extraction');
    const extraction = await extractFromDeck(pitchDeckPayload);
    await store.setEngineDone(jobId, 'extraction', extraction);

    // Moteurs 2, 3, 4 + Extraction financière en parallèle
    await store.setEngineRunning(jobId, 'team');
    await store.setEngineRunning(jobId, 'market');
    await store.setEngineRunning(jobId, 'macro');
    await store.setEngineRunning(jobId, 'financial-extraction');

    const [team, market, macro, financialData] = await Promise.all([
      analyzeTeam(extraction).then(async r => { await store.setEngineDone(jobId, 'team', r); return r; }),
      analyzeMarket(extraction).then(async r => { await store.setEngineDone(jobId, 'market', r); return r; }),
      analyzeMacro(extraction).then(async r => { await store.setEngineDone(jobId, 'macro', r); return r; }),
      extractFinancialData(pitchDeckPayload, businessPlanPayload, extraction).then(async r => { await store.setEngineDone(jobId, 'financial-extraction', r); return r; }),
    ]);

    // Moteur Benchmarks (Session 2/4) : positionnement chiffre du dossier vs marche.
    // 100% deterministe (pas d appel LLM), execution instantanee. Sortie consommee
    // par les moteurs en aval pour enrichir leur raisonnement.
    // Si echec, on continue sans bloquer le pipeline.
    await store.setEngineRunning(jobId, 'benchmarks');
    let benchmarks: any = null;
    try {
      benchmarks = await analyzeBenchmarks(extraction, financialData);
      await store.setEngineDone(jobId, 'benchmarks', benchmarks);
    } catch (err: any) {
      console.warn('[benchmarks] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'benchmarks', null);
    }

    // Moteur 5 : Pattern Matching
    await store.setEngineRunning(jobId, 'pattern');
    const patternMatching = await matchPatterns(extraction, team, market, macro);
    await store.setEngineDone(jobId, 'pattern', patternMatching);

    // Moteurs 6, 7, 8, 14 en parallèle
    await store.setEngineRunning(jobId, 'causal');
    await store.setEngineRunning(jobId, 'blindspot');
    await store.setEngineRunning(jobId, 'contrarian');
    await store.setEngineRunning(jobId, 'financial-coherence');

    const [causalReversal, blindspotAnalysis, contrarianAnalysis, financialCoherence] = await Promise.all([
      performCausalReversal(extraction, team, market, macro, patternMatching).then(async r => { await store.setEngineDone(jobId, 'causal', r); return r; }),
      analyzeBlindspots(extraction, team, market, macro).then(async r => { await store.setEngineDone(jobId, 'blindspot', r); return r; }),
      analyzeContrarian(extraction, team, market, macro).then(async r => { await store.setEngineDone(jobId, 'contrarian', r); return r; }),
      analyzeFinancialCoherence(extraction, financialData, market).then(async r => { await store.setEngineDone(jobId, 'financial-coherence', r); return r; }),
    ]);

    // Moteur 9 : Orchestration finale
    await store.setEngineRunning(jobId, 'orchestrate');
    const finalRecommendation = await orchestrateFinalRecommendation(
      extraction, team, market, macro, patternMatching, causalReversal,
      blindspotAnalysis, contrarianAnalysis
    );
    await store.setEngineDone(jobId, 'orchestrate', finalRecommendation);

    // Moteur 12 : Reference Checks. Genere le plan d'appels de DD terrain
    // (founders, customers, board) avec questions-types et profils a identifier.
    // Ne bloque pas le pipeline : si echec, on continue sans cette section.
    await store.setEngineRunning(jobId, 'reference-checks');
    let referenceChecks: any = null;
    try {
      referenceChecks = await generateReferenceChecks(
        extraction, team, blindspotAnalysis, causalReversal,
      );
      await store.setEngineDone(jobId, 'reference-checks', referenceChecks);
    } catch (err: any) {
      console.warn('[reference-checks] engine failed, continuing without:', err?.message);
      await store.setEngineDone(jobId, 'reference-checks', null);
    }

    const result = {
      meta: {
        filename: pitchDeckName,
        additionalFiles: [...(businessPlanName ? [businessPlanName] : []), ...otherFileNames],
        analyzedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      extraction,
      financialData,
      team,
      market,
      macro,
      benchmarks,
      patternMatching,
      causalReversal,
      blindspotAnalysis,
      contrarianAnalysis,
      financialCoherence,
      finalRecommendation,
      referenceChecks,
    };

    await store.setComplete(jobId, result);
  } catch (error: any) {
    console.error('Pipeline error:', error);
    await store.setError(jobId, error.message || 'Erreur pipeline');
  }
}
