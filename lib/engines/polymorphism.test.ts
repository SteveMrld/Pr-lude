// ============================================================
// TESTS D INTEGRATION DU POLYMORPHISME
// ------------------------------------------------------------
// Verifient que :
//   1. applyMacroVerdictPostProcessing ecrase les champs prevus
//      selon les verdicts de la matrice
//   2. applyMarketVerdictPostProcessing construit les blocs IA
//      en non-applicable quand la matrice le dit
//   3. computeIndicators bascule sur le set industriel quand
//      indicatorsIndustrial=full et reste sur le set SaaS sinon
//   4. Les anciennes analyses sans matrice tournent en mode
//      legacy sans regression
//
// Lance : tsx lib/engines/polymorphism.test.ts
// ============================================================

import { applyMacroVerdictPostProcessing } from './macro-engine';
import { applyMarketVerdictPostProcessing } from './market-engine';
import { computeIndicators } from './indicators-engine';
import type { MacroAnalysisOutput, MarketAnalysisOutput, ExtractionOutput, FinancialDataExtraction } from './types';
import type { RelevanceMatrix } from './relevance-matrix';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS  ${message}`);
  } else {
    failed++;
    console.log(`  FAIL  ${message}`);
  }
}

// ============================================================
// HELPERS DE FABRICATION DE DONNEES TEST
// ============================================================

function makeMatrix(overrides: Partial<RelevanceMatrix> = {}): RelevanceMatrix {
  const baseVerdict = (applicable: 'full' | 'partial' | 'none') => ({
    applicable,
    weight: 1,
    scope: [],
    rationale: 'test',
  });
  return {
    // Cle canonique de la table INDICATOR_BENCHMARKS : 'saas-b2b'.
    // Avant le durcissement des classificateurs (mai 2026), le libelle
    // 'b2b-saas' fonctionnait silencieusement via fallback saas-b2b.
    // Desormais ce fallback est supprime : un libelle inconnu retourne
    // null et neutralise les indicateurs. On utilise la cle canonique.
    assetClass: 'saas-b2b',
    businessModel: 'recurrent-saas',
    productionChain: 'pure-software',
    supplyChainExposure: 'low',
    supplyChainExposureFactors: [],
    geopoliticalExposure: 'low',
    geopoliticalExposureFactors: [],
    macroSensitivity: 'low',
    macroSensitivityFactors: [],
    digitalReproducibility: 'high',
    digitalReproducibilityFactors: [],
    acquisitionFunnel: 'present',
    verdicts: {
      macroGeopolitical: baseVerdict('full'),
      macroCyclical: baseVerdict('full'),
      marketAiReplicability: baseVerdict('full'),
      marketAiBusinessModel: baseVerdict('full'),
      indicatorsSaas: baseVerdict('full'),
      indicatorsIndustrial: baseVerdict('none'),
      saasMetricsRetention: baseVerdict('full'),
      saasMetricsUnitEconomics: baseVerdict('full'),
      executionFriction: baseVerdict('full'),
    },
    ...overrides,
  } as RelevanceMatrix;
}

function makeMacroAnalysis(): MacroAnalysisOutput {
  return {
    cyclePosition: 'mature',
    interestRateRegime: 'restrictif',
    geopolitics: 'tensions post-Ukraine generiques',
    vcCapitalOnSegment: 'balanced',
    demandCycle: 'commentaire conjoncturel generique',
    criticalTimingWindow: { exists: false, rationale: '' },
    contraryclicalOpportunity: { score: 0, rationale: '' },
    structuralTrends: [],
    regulatoryEnvironment: '',
  };
}

function makeMarketAnalysis(): MarketAnalysisOutput {
  return {
    perceivedSize: 'large',
    realIntensity: 'medium',
    saturation: 'fragmented',
    organicSignals: { score: 50, rationale: '', evidence: [] },
    needIntensity: { score: 50, rationale: '', gap: '' },
    defensibility: {
      score: 50,
      moats: [],
      vulnerabilities: [],
      aiReplicability: {
        verdict: 'high_risk',
        timeToReplicate: '3 mois',
        reasoning: 'speculation IA generique sur dossier hardware',
        protectingFactors: [],
        replicableComponents: ['interface', 'dashboard', 'logique metier'],
      },
    } as any,
    internationalBenchmarks: [],
    aiBusinessModel: {
      isAiNative: true,
      isLlmWrapper: false,
      classification: 'ai_native_with_moats',
      grossMarginEstimate: '60%',
      grossMarginRationale: 'evaluation generique',
      llmProviderConcentration: 'OpenAI 100%',
      aiTaxSensitivity: 'haute',
      commoditizationRisk: 'medium',
      commoditizationReasoning: '',
      multipleAdjustment: 'x10',
      redFlags: [],
      sustainableSignals: [],
    },
    competitiveDynamic: '',
    competitiveMatrix: { dimensions: [], players: [], differentiationScore: 0 },
  } as MarketAnalysisOutput;
}

function makeExtraction(overrides: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'TestCo',
    sector: 'tech',
    subSector: 'saas',
    yearFounded: 2020,
    geographicHub: 'Paris',
    country: 'France',
    productDescription: 'plateforme test',
    businessModel: 'subscription',
    marketPitch: '',
    rawSummary: '',
    competitorsCited: [],
    fundraise: { stage: 'seed', amount: '2M', valuation: null, leadInvestor: null },
    traction: { metrics: {} as any },
    ...overrides,
  } as ExtractionOutput;
}

function makeFinancialData(): FinancialDataExtraction {
  return {
    revenueProjection: [{ year: new Date().getFullYear(), value: 1000000 }],
    grossMarginProjection: [],
    ebitdaProjection: [],
    cashBurnProjection: [],
    headcount: [{ year: new Date().getFullYear(), value: 10 }],
    smSpend: [],
    rdSpend: [],
    extractionConfidence: 'high',
    rawNotes: '',
    unitEconomics: {} as any,
    currentRound: {} as any,
  } as unknown as FinancialDataExtraction;
}

// ============================================================
// TESTS MACRO POST-PROCESSING
// ============================================================

console.log('\n[macro post-processing]');

{
  const analysis = makeMacroAnalysis();
  const matrix = makeMatrix({
    verdicts: {
      ...makeMatrix().verdicts,
      macroGeopolitical: { applicable: 'none', weight: 0, scope: [], rationale: 'pas d exposition' } as any,
    },
  });
  applyMacroVerdictPostProcessing(analysis, matrix);
  assert(
    analysis.geopolitics.includes('non significative'),
    'macroGeopolitical=none ecrase analysis.geopolitics avec phrase neutre',
  );
  assert(
    analysis.demandCycle === 'commentaire conjoncturel generique',
    'macroGeopolitical=none ne touche pas a demandCycle',
  );
}

{
  const analysis = makeMacroAnalysis();
  const matrix = makeMatrix({
    verdicts: {
      ...makeMatrix().verdicts,
      macroCyclical: { applicable: 'none', weight: 0, scope: [], rationale: 'pas de sensibilite' } as any,
    },
  });
  applyMacroVerdictPostProcessing(analysis, matrix);
  assert(
    analysis.demandCycle.includes('peu sensible a la conjoncture'),
    'macroCyclical=none ecrase analysis.demandCycle avec phrase neutre',
  );
  assert(
    analysis.geopolitics === 'tensions post-Ukraine generiques',
    'macroCyclical=none ne touche pas a geopolitics',
  );
}

{
  const analysis = makeMacroAnalysis();
  const original = analysis.geopolitics;
  applyMacroVerdictPostProcessing(analysis, null);
  assert(
    analysis.geopolitics === original,
    'matrice null = pas de post-processing (compat retro)',
  );
}

{
  const analysis = makeMacroAnalysis();
  const matrix = makeMatrix(); // tous full
  applyMacroVerdictPostProcessing(analysis, matrix);
  assert(
    analysis.geopolitics === 'tensions post-Ukraine generiques',
    'tous verdicts=full = pas de post-processing applique',
  );
}

// ============================================================
// TESTS MARKET POST-PROCESSING
// ============================================================

console.log('\n[market post-processing]');

{
  const analysis = makeMarketAnalysis();
  const matrix = makeMatrix({
    digitalReproducibility: 'low',
    digitalReproducibilityFactors: ['chaine infrastructure-physical non duplicable par logiciel'],
    verdicts: {
      ...makeMatrix().verdicts,
      marketAiReplicability: { applicable: 'none', weight: 0, scope: [], rationale: 'hardware' } as any,
    },
  });
  applyMarketVerdictPostProcessing(analysis, matrix);
  const ai = (analysis.defensibility as any).aiReplicability;
  assert(
    ai.verdict === 'protected',
    'marketAiReplicability=none force verdict=protected',
  );
  assert(
    ai.timeToReplicate === 'non applicable',
    'marketAiReplicability=none force timeToReplicate=non applicable',
  );
  assert(
    Array.isArray(ai.replicableComponents) && ai.replicableComponents.length === 0,
    'marketAiReplicability=none vide replicableComponents',
  );
  assert(
    ai.protectingFactors.includes('chaine infrastructure-physical non duplicable par logiciel'),
    'marketAiReplicability=none reprend les facteurs concrets de la matrice',
  );
}

{
  const analysis = makeMarketAnalysis();
  const matrix = makeMatrix({
    verdicts: {
      ...makeMatrix().verdicts,
      marketAiBusinessModel: { applicable: 'none', weight: 0, scope: [], rationale: 'pas de LLM' } as any,
    },
  });
  applyMarketVerdictPostProcessing(analysis, matrix);
  assert(
    analysis.aiBusinessModel?.isAiNative === false,
    'marketAiBusinessModel=none force isAiNative=false',
  );
  assert(
    analysis.aiBusinessModel?.classification === 'not_applicable',
    'marketAiBusinessModel=none force classification=not_applicable',
  );
  assert(
    analysis.aiBusinessModel?.commoditizationRisk === 'low',
    'marketAiBusinessModel=none force commoditizationRisk=low',
  );
}

{
  const analysis = makeMarketAnalysis();
  const before = (analysis.defensibility as any).aiReplicability.verdict;
  applyMarketVerdictPostProcessing(analysis, null);
  assert(
    (analysis.defensibility as any).aiReplicability.verdict === before,
    'matrice null = pas de post-processing market (compat retro)',
  );
}

{
  const analysis = makeMarketAnalysis();
  const matrix = makeMatrix(); // tous full
  applyMarketVerdictPostProcessing(analysis, matrix);
  assert(
    (analysis.defensibility as any).aiReplicability.verdict === 'high_risk',
    'tous verdicts=full = market post-processing inactif',
  );
}

// ============================================================
// TESTS computeIndicators POLYMORPHIQUE
// ============================================================

console.log('\n[computeIndicators set selection]');

{
  const ext = makeExtraction({ sector: 'industrial', subSector: 'energies marines' });
  const matrix = makeMatrix({
    assetClass: 'industrial-hardware',
    businessModel: 'project-based',
    verdicts: {
      ...makeMatrix().verdicts,
      indicatorsSaas: { applicable: 'none', weight: 0, scope: [], rationale: 'modele non recurrent' } as any,
      indicatorsIndustrial: { applicable: 'full', weight: 1, scope: [], rationale: 'modele industriel' } as any,
    },
  });
  const out = computeIndicators({
    extraction: ext,
    financial: null,
    financialData: makeFinancialData(),
    relevanceMatrix: matrix,
  });
  const keys = out.indicators.map((i) => i.key);
  assert(
    keys.includes('unitMargin'),
    'indicatorsIndustrial=full produit unitMargin dans le set',
  );
  assert(
    keys.includes('commercialCycle'),
    'indicatorsIndustrial=full produit commercialCycle',
  );
  assert(
    keys.includes('orderBacklog'),
    'indicatorsIndustrial=full produit orderBacklog',
  );
  assert(
    keys.includes('tenderWinRate'),
    'indicatorsIndustrial=full produit tenderWinRate',
  );
  assert(
    !keys.includes('burnMultiple'),
    'indicatorsIndustrial=full ne produit PAS burnMultiple SaaS',
  );
  assert(
    !keys.includes('ndr'),
    'indicatorsIndustrial=full ne produit PAS NDR SaaS',
  );
}

{
  const ext = makeExtraction({ sector: 'tech', subSector: 'b2b-saas' });
  const matrix = makeMatrix({
    verdicts: {
      ...makeMatrix().verdicts,
      indicatorsIndustrial: { applicable: 'none', weight: 0, scope: [], rationale: 'modele recurrent' } as any,
    },
  });
  const out = computeIndicators({
    extraction: ext,
    financial: null,
    financialData: makeFinancialData(),
    relevanceMatrix: matrix,
  });
  const keys = out.indicators.map((i) => i.key);
  assert(
    keys.includes('burnMultiple'),
    'indicatorsIndustrial=none preserve le set SaaS canonique (burnMultiple)',
  );
  assert(
    keys.includes('paybackCac'),
    'indicatorsIndustrial=none preserve le set SaaS canonique (paybackCac)',
  );
  assert(
    !keys.includes('orderBacklog'),
    'indicatorsIndustrial=none ne produit PAS le set industriel',
  );
}

{
  const ext = makeExtraction();
  const out = computeIndicators({
    extraction: ext,
    financial: null,
    financialData: makeFinancialData(),
    // pas de relevanceMatrix : compat retro
  });
  const keys = out.indicators.map((i) => i.key);
  assert(
    keys.includes('burnMultiple') && keys.includes('ndr'),
    'sans matrice = comportement legacy SaaS canonique',
  );
}

{
  const ext = makeExtraction();
  const matrix = makeMatrix({
    acquisitionFunnel: 'absent',
  });
  const out = computeIndicators({
    extraction: ext,
    financial: null,
    financialData: makeFinancialData(),
    relevanceMatrix: matrix,
  });
  const payback = out.indicators.find((i) => i.key === 'paybackCac');
  assert(
    payback?.verdict === 'non-applicable',
    'acquisitionFunnel=absent rend paybackCac non-applicable',
  );
  assert(
    payback?.rationale.includes('funnel marketing') || payback?.rationale.includes('acquisition'),
    'acquisitionFunnel=absent donne un rationnel explicite sur le funnel',
  );
}

// ============================================================
// REPORT
// ============================================================

console.log(`\n${passed}/${passed + failed} tests passes`);
if (failed > 0) {
  process.exit(1);
}
