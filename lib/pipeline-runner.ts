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
    store.setEngineRunning(jobId, 'extraction');
    const extraction = await extractFromDeck(pitchDeckPayload);
    store.setEngineDone(jobId, 'extraction', extraction);

    // Moteurs 2, 3, 4 + Extraction financière en parallèle
    store.setEngineRunning(jobId, 'team');
    store.setEngineRunning(jobId, 'market');
    store.setEngineRunning(jobId, 'macro');
    store.setEngineRunning(jobId, 'financial-extraction');

    const [team, market, macro, financialData] = await Promise.all([
      analyzeTeam(extraction).then(r => { store.setEngineDone(jobId, 'team', r); return r; }),
      analyzeMarket(extraction).then(r => { store.setEngineDone(jobId, 'market', r); return r; }),
      analyzeMacro(extraction).then(r => { store.setEngineDone(jobId, 'macro', r); return r; }),
      extractFinancialData(pitchDeckPayload, businessPlanPayload, extraction).then(r => { store.setEngineDone(jobId, 'financial-extraction', r); return r; }),
    ]);

    // Moteur 5 : Pattern Matching
    store.setEngineRunning(jobId, 'pattern');
    const patternMatching = await matchPatterns(extraction, team, market, macro);
    store.setEngineDone(jobId, 'pattern', patternMatching);

    // Moteurs 6, 7, 8, 14 en parallèle
    store.setEngineRunning(jobId, 'causal');
    store.setEngineRunning(jobId, 'blindspot');
    store.setEngineRunning(jobId, 'contrarian');
    store.setEngineRunning(jobId, 'financial-coherence');

    const [causalReversal, blindspotAnalysis, contrarianAnalysis, financialCoherence] = await Promise.all([
      performCausalReversal(extraction, team, market, macro, patternMatching).then(r => { store.setEngineDone(jobId, 'causal', r); return r; }),
      analyzeBlindspots(extraction, team, market, macro).then(r => { store.setEngineDone(jobId, 'blindspot', r); return r; }),
      analyzeContrarian(extraction, team, market, macro).then(r => { store.setEngineDone(jobId, 'contrarian', r); return r; }),
      analyzeFinancialCoherence(extraction, financialData, market).then(r => { store.setEngineDone(jobId, 'financial-coherence', r); return r; }),
    ]);

    // Moteur 9 : Orchestration finale
    store.setEngineRunning(jobId, 'orchestrate');
    const finalRecommendation = await orchestrateFinalRecommendation(
      extraction, team, market, macro, patternMatching, causalReversal,
      blindspotAnalysis, contrarianAnalysis
    );
    store.setEngineDone(jobId, 'orchestrate', finalRecommendation);

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

    store.setComplete(jobId, result);
  } catch (error: any) {
    console.error('Pipeline error:', error);
    store.setError(jobId, error.message || 'Erreur pipeline');
  }
}
