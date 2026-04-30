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
      patternMatching,
      causalReversal,
      blindspotAnalysis,
      contrarianAnalysis,
      financialCoherence,
      finalRecommendation,
    };

    await store.setComplete(jobId, result);
  } catch (error: any) {
    console.error('Pipeline error:', error);
    await store.setError(jobId, error.message || 'Erreur pipeline');
  }
}
