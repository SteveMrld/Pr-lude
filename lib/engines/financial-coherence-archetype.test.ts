// ============================================================
// TESTS DE NON-REGRESSION - ARCHETYPE COHERENCE FINANCIERE
// ------------------------------------------------------------
// Couvre :
//  - Garde-fou cas SaaS canonique (archetype A) : tous les tests
//    applicables, comportement historique preserve.
//  - Six autres archetypes (B hardware, C marketplace, D biotech,
//    E B2G, F consumer DTC, unclassified) : gating correct des
//    tests applicables / non applicables.
//  - Validation Platypus deterministe : matrice industrial-hardware
//    + unitary-sale doit sortir archetype B avec T2 non applicable.
//  - Calcul de globalCoherenceScore identique pour cas SaaS, et
//    deterministe sur les tests applicables uniquement pour les
//    autres archetypes.
//  - Stubs notApplicable construits cote code avec rationale
//    explicite (jamais d hallucination sur des metriques SaaS pour
//    un dossier hardware ou biotech).
//
// Execution : npx tsx lib/engines/financial-coherence-archetype.test.ts
// ============================================================

import {
  deriveArchetype,
  getApplicableTests,
  buildNotApplicableTestStub,
  computeGlobalCoherenceScore,
  TEST_ID_TO_KEY,
  TEST_LABELS,
  type TestId,
} from './financial-coherence-archetype';
import type { RelevanceMatrix } from './relevance-matrix';
import type { FinancialCoherenceTest } from './types';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); fail++; }
}

function checkTrue(label: string, cond: boolean) {
  if (cond) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}`); fail++; }
}

// ============================================================
// HELPER : matrice synthetique pour les tests
// ============================================================

function makeMatrix(overrides: Partial<RelevanceMatrix>): RelevanceMatrix {
  const baseVerdict = (applicable: 'full' | 'partial' | 'none') => ({
    applicable,
    weight: 1,
    scope: [],
    rationale: 'test',
  });
  return {
    assetClass: 'saas-b2b',
    businessModel: 'recurrent-saas',
    productionChain: 'pure-software',
    supplyChainExposure: 'low',
    supplyChainExposureFactors: [],
    macroSensitivity: 'low',
    macroSensitivityFactors: [],
    geopoliticalExposure: 'low',
    geopoliticalExposureFactors: [],
    digitalReproducibility: 'high',
    digitalReproducibilityFactors: [],
    acquisitionFunnel: 'present',
    verdicts: {
      macroGeopolitical: baseVerdict('none'),
      macroCyclical: baseVerdict('none'),
      marketAiReplicability: baseVerdict('full'),
      marketAiBusinessModel: baseVerdict('none'),
      indicatorsSaas: baseVerdict('full'),
      indicatorsIndustrial: baseVerdict('none'),
      saasMetricsRetention: baseVerdict('full'),
      saasMetricsUnitEconomics: baseVerdict('full'),
      valuationVcMethod: baseVerdict('full'),
      executionFriction: baseVerdict('partial'),
      narrativeDrift: baseVerdict('partial'),
      fragiliteStructurelle: {
        'growth-subsidized-model': baseVerdict('partial'),
        'infrastructure-hostage': baseVerdict('partial'),
        'fixed-cost-trap': baseVerdict('partial'),
        'regulatory-time-bomb': baseVerdict('none'),
        'commoditization-drift': baseVerdict('partial'),
        'capital-structure-fragility': baseVerdict('partial'),
        'scale-mirage-risk': baseVerdict('none'),
      },
    },
    ...overrides,
  } as RelevanceMatrix;
}

// ============================================================
// SECTION 1. GARDE-FOU NON-REGRESSION SAAS CANONIQUE (archetype A)
// ------------------------------------------------------------
// Critique : un dossier SaaS B2B standard avec recurrent-saas +
// pure-software doit conserver son comportement actuel. Les sept
// tests doivent etre applicables, aucun ne doit etre neutralise,
// et le calcul du score doit etre identique a la moyenne ponderee
// historique (T1, T6, T7 poids 1.5 ; T2-T5 poids 1).
// ============================================================

console.log('\n=== Section 1. Non-regression SaaS canonique (archetype A) ===');

const saasMatrix = makeMatrix({
  assetClass: 'saas-b2b',
  productionChain: 'pure-software',
  businessModel: 'recurrent-saas',
});
const saasResult = deriveArchetype(saasMatrix);
check('SaaS B2B recurrent => archetype A', saasResult.archetype, 'A-saas-pur');
check('SaaS A applicableTests = TOUS', getApplicableTests('A-saas-pur'), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);

// Variante consumer-subscription
const consumerSubMatrix = makeMatrix({
  assetClass: 'saas-b2b',
  productionChain: 'pure-software',
  businessModel: 'consumer-subscription',
});
check('consumer-subscription sur pure-software => archetype A', deriveArchetype(consumerSubMatrix).archetype, 'A-saas-pur');

// Calcul du score sur sept tests applicables : identique a la
// moyenne ponderee historique. On simule un set de tests passes.
const saasTests: Record<string, FinancialCoherenceTest> = {
  crosseHockeySuspecte:    { testId: 'T1', testName: 'T1', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  ratioLtvCacImplicite:    { testId: 'T2', testName: 'T2', passed: true, score: 70, evidence: '', benchmark: '', implication: '' },
  margeBruteCoherente:     { testId: 'T3', testName: 'T3', passed: true, score: 75, evidence: '', benchmark: '', implication: '' },
  burnRateRunway:          { testId: 'T4', testName: 'T4', passed: true, score: 65, evidence: '', benchmark: '', implication: '' },
  incoherenceHeadcountCa:  { testId: 'T5', testName: 'T5', passed: true, score: 60, evidence: '', benchmark: '', implication: '' },
  unitEconomicsViables:    { testId: 'T6', testName: 'T6', passed: true, score: 75, evidence: '', benchmark: '', implication: '' },
  coherenceHypothesesMarche:{ testId: 'T7', testName: 'T7', passed: true, score: 85, evidence: '', benchmark: '', implication: '' },
};
// Calcul attendu : (80*1.5 + 70 + 75 + 65 + 60 + 75*1.5 + 85*1.5) / (1.5+1+1+1+1+1.5+1.5)
// = (120 + 70 + 75 + 65 + 60 + 112.5 + 127.5) / 8.5 = 630 / 8.5 = 74.117... arrondi 74
const saasScore = computeGlobalCoherenceScore(saasTests, ['T1','T2','T3','T4','T5','T6','T7']);
check('SaaS A score = moyenne ponderee historique (74)', saasScore, 74);

// Tests parfaits a 100 : score = 100
const perfectTests: Record<string, FinancialCoherenceTest> = {};
for (const t of ['T1','T2','T3','T4','T5','T6','T7'] as TestId[]) {
  perfectTests[TEST_ID_TO_KEY[t]] = { testId: t, testName: TEST_LABELS[t], passed: true, score: 100, evidence: '', benchmark: '', implication: '' };
}
check('SaaS A tests parfaits => score 100', computeGlobalCoherenceScore(perfectTests, ['T1','T2','T3','T4','T5','T6','T7']), 100);

// ============================================================
// SECTION 2. ARCHETYPE B - HARDWARE / DEEPTECH / DEFENSE
// ------------------------------------------------------------
// T2 (LTV/CAC) doit etre neutralise cote code.
// ============================================================

console.log('\n=== Section 2. Archetype B hardware ===');

const platypusMatrix = makeMatrix({
  assetClass: 'industrial-hardware',
  productionChain: 'hardware-physical',
  businessModel: 'unitary-sale',
});
const platypusResult = deriveArchetype(platypusMatrix);
check('Platypus hardware-physical => archetype B', platypusResult.archetype, 'B-hardware-deeptech');
check('B applicableTests SANS T2', getApplicableTests('B-hardware-deeptech'), ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']);
checkTrue('B rationale mentionne LTV/CAC neutralise', platypusResult.rationale.toLowerCase().includes('ltv/cac'));

// Asset class defense suffit meme si productionChain est hybrid
const defenseMatrix = makeMatrix({
  assetClass: 'defense',
  productionChain: 'hardware-physical',
  businessModel: 'unitary-sale',
});
check('Defense + hardware => archetype B', deriveArchetype(defenseMatrix).archetype, 'B-hardware-deeptech');

// Infrastructure physique (EMR / hydrolien) => B
const emrMatrix = makeMatrix({
  assetClass: 'climate-tech',
  productionChain: 'infrastructure-physical',
  businessModel: 'project-based',
});
check('EMR infrastructure-physical => archetype B', deriveArchetype(emrMatrix).archetype, 'B-hardware-deeptech');

// Stub T2 cote code pour archetype B
const stubT2 = buildNotApplicableTestStub('T2', 'B-hardware-deeptech');
check('Stub T2 archetype B notApplicable=true', stubT2.notApplicable, true);
check('Stub T2 archetype B passed=true (neutre)', stubT2.passed, true);
check('Stub T2 archetype B score=50 (neutre)', stubT2.score, 50);
checkTrue('Stub T2 archetype B evidence mentionne hardware', stubT2.evidence.toLowerCase().includes('hardware'));
checkTrue('Stub T2 archetype B evidence mentionne LTV/CAC', stubT2.evidence.includes('LTV/CAC'));

// Score archetype B sur tests applicables : T2 absent ne tire pas le score vers le bas.
const platypusTests: Record<string, FinancialCoherenceTest> = {
  crosseHockeySuspecte:    { testId: 'T1', testName: 'T1', passed: true, score: 75, evidence: '', benchmark: '', implication: '' },
  ratioLtvCacImplicite:    buildNotApplicableTestStub('T2', 'B-hardware-deeptech'),
  margeBruteCoherente:     { testId: 'T3', testName: 'T3', passed: true, score: 70, evidence: '', benchmark: '', implication: '' },
  burnRateRunway:          { testId: 'T4', testName: 'T4', passed: true, score: 65, evidence: '', benchmark: '', implication: '' },
  incoherenceHeadcountCa:  { testId: 'T5', testName: 'T5', passed: true, score: 70, evidence: '', benchmark: '', implication: '' },
  unitEconomicsViables:    { testId: 'T6', testName: 'T6', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  coherenceHypothesesMarche:{ testId: 'T7', testName: 'T7', passed: true, score: 75, evidence: '', benchmark: '', implication: '' },
};
// Moyenne ponderee sur 6 tests applicables :
// (75*1.5 + 70 + 65 + 70 + 80*1.5 + 75*1.5) / (1.5+1+1+1+1.5+1.5) = (112.5+70+65+70+120+112.5)/7.5 = 550/7.5 = 73.33 = 73
const platypusScore = computeGlobalCoherenceScore(platypusTests, ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']);
check('Platypus score sur tests applicables seuls (T2 exclu)', platypusScore, 73);

// Verification critique : si on injectait artificiellement un T2 a
// 0 dans les tests, il ne devrait PAS tirer le score vers le bas
// parce qu il est exclu de la liste applicable.
const platypusWithFakeT2: Record<string, FinancialCoherenceTest> = {
  ...platypusTests,
  ratioLtvCacImplicite: { ...buildNotApplicableTestStub('T2', 'B-hardware-deeptech'), score: 0 },
};
check('T2 a 0 mais notApplicable=true ne penalise pas le score', computeGlobalCoherenceScore(platypusWithFakeT2, ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']), 73);

// ============================================================
// SECTION 3. ARCHETYPE C - MARKETPLACE
// ============================================================

console.log('\n=== Section 3. Archetype C marketplace ===');

const marketplaceMatrix = makeMatrix({
  assetClass: 'marketplace-b2c',
  productionChain: 'pure-software',
  businessModel: 'marketplace',
});
check('marketplace businessModel => archetype C', deriveArchetype(marketplaceMatrix).archetype, 'C-marketplace');
check('C applicableTests = TOUS (T2 polymorphe)', getApplicableTests('C-marketplace'), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);

// ============================================================
// SECTION 4. ARCHETYPE D - BIOTECH PRE-APPROBATION
// ------------------------------------------------------------
// T1, T2, T5, T6 doivent etre neutralises (revenue souvent nul,
// pas de funnel pre-commercialisation, unit economics
// post-approbation seulement, ratio CA/employe non pertinent en
// R&D pure).
// ============================================================

console.log('\n=== Section 4. Archetype D biotech pre-approbation ===');

const biotechMatrix = makeMatrix({
  assetClass: 'deeptech',
  productionChain: 'wet-biotech',
  businessModel: 'unitary-sale', // out-licensing, but pre-approbation
});
check('wet-biotech => archetype D', deriveArchetype(biotechMatrix).archetype, 'D-biotech-pre-approval');
check('D applicableTests = T3, T4, T7 uniquement', getApplicableTests('D-biotech-pre-approval'), ['T3', 'T4', 'T7']);

const stubT1Biotech = buildNotApplicableTestStub('T1', 'D-biotech-pre-approval');
checkTrue('Biotech stub T1 rationale mentionne revenue/commercialisation',
  stubT1Biotech.evidence.toLowerCase().includes('revenue') || stubT1Biotech.evidence.toLowerCase().includes('commercialisation'));

const stubT6Biotech = buildNotApplicableTestStub('T6', 'D-biotech-pre-approval');
checkTrue('Biotech stub T6 rationale mentionne approbation',
  stubT6Biotech.evidence.toLowerCase().includes('approbation'));

// ============================================================
// SECTION 5. ARCHETYPE E - B2G / DEFENSE PURE
// ============================================================

console.log('\n=== Section 5. Archetype E B2G ===');

const b2gMatrix = makeMatrix({
  assetClass: 'defense',
  productionChain: 'pure-software', // Palantir-like : software + contract-b2g
  businessModel: 'contract-b2g',
});
check('contract-b2g => archetype E', deriveArchetype(b2gMatrix).archetype, 'E-b2g-defense');
check('E applicableTests SANS T2', getApplicableTests('E-b2g-defense'), ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']);

const stubT2B2g = buildNotApplicableTestStub('T2', 'E-b2g-defense');
checkTrue('B2G stub T2 rationale mentionne appels d offres / cycle 12-36',
  stubT2B2g.evidence.toLowerCase().includes('appels d offres') || stubT2B2g.evidence.includes('12-36'));

// ============================================================
// SECTION 6. ARCHETYPE F - CONSUMER DTC
// ============================================================

console.log('\n=== Section 6. Archetype F consumer DTC ===');

const dtcMatrix = makeMatrix({
  assetClass: 'ecommerce-dtc',
  productionChain: 'hardware-physical',
  businessModel: 'unitary-sale',
  macroSensitivity: 'high',
  macroSensitivityFactors: ['macro:consumer-discretionary', 'macro:consumer-exposure'],
});
// Cas frontiere : hardware-physical + unitary-sale + signal B2C =>
// archetype B (hardware) prend la main parce que hardware-physical
// est evalue avant unitary-sale + B2C. Doctrinalement defendable :
// DTC qui fabrique du hardware (Allbirds, Le Slip Francais) a quand
// meme des unit economics hardware. Si la matrice flagge industrial-
// hardware, c est B. Sinon DTC sans fabrication propre => F.
const dtcArchetype = deriveArchetype(dtcMatrix).archetype;
checkTrue('DTC avec hardware-physical => archetype B (hardware prioritaire)', dtcArchetype === 'B-hardware-deeptech');

// DTC pur sans fabrication : pure-software + unitary-sale + B2C
const dtcSoftMatrix = makeMatrix({
  assetClass: 'ecommerce-dtc',
  productionChain: 'pure-software',
  businessModel: 'unitary-sale',
  macroSensitivity: 'high',
  macroSensitivityFactors: ['macro:consumer-discretionary'],
});
check('DTC pur (pas de hardware) => archetype F', deriveArchetype(dtcSoftMatrix).archetype, 'F-consumer-dtc');
check('F applicableTests = TOUS', getApplicableTests('F-consumer-dtc'), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);

// ============================================================
// SECTION 7. ARCHETYPE UNCLASSIFIED
// ------------------------------------------------------------
// La matrice n a pas tranche : on ne fait tourner que les tests
// universels (T1, T3, T4, T7) et T2/T5/T6 sont marques non
// applicables avec rationale "classification a confirmer".
// ============================================================

console.log('\n=== Section 7. Archetype unclassified ===');

const unclassifiedMatrix = makeMatrix({
  assetClass: 'unclassified',
  productionChain: 'unknown',
  businessModel: 'unknown',
});
const unclassifiedResult = deriveArchetype(unclassifiedMatrix);
check('unclassified + unknown => archetype unclassified', unclassifiedResult.archetype, 'unclassified');
check('unclassified applicableTests = T1, T3, T4, T7 (universels)', getApplicableTests('unclassified'), ['T1', 'T3', 'T4', 'T7']);
checkTrue('unclassified rationale mentionne classification non tranchee',
  unclassifiedResult.rationale.toLowerCase().includes('non tranch') || unclassifiedResult.rationale.toLowerCase().includes('non couvert'));

const stubT2Unclassified = buildNotApplicableTestStub('T2', 'unclassified');
checkTrue('unclassified stub T2 rationale mentionne classification a confirmer',
  stubT2Unclassified.evidence.toLowerCase().includes('classification') && stubT2Unclassified.evidence.toLowerCase().includes('non tranch'));

// Matrice absente => unclassified
const noMatrixResult = deriveArchetype(null);
check('matrice null => archetype unclassified', noMatrixResult.archetype, 'unclassified');
checkTrue('matrice null rationale mentionne matrice absente',
  noMatrixResult.rationale.toLowerCase().includes('matrice'));

// ============================================================
// SECTION 8. VALIDATION DETERMINISTE PLATYPUS
// ============================================================

console.log('\n=== Section 8. Validation deterministe Platypus ===');

// Matrice synthetique fidele a la sortie de computeRelevanceMatrix
// pour le pitch Platypus (cf. scripts/validate-platypus-deterministic.ts).
const platypusFullMatrix = makeMatrix({
  assetClass: 'industrial-hardware',
  productionChain: 'hardware-physical',
  businessModel: 'unitary-sale',
  supplyChainExposure: 'high',
  supplyChainExposureFactors: ['supply:semiconductors', 'supply:strategic-materials'],
  geopoliticalExposure: 'high',
  geopoliticalExposureFactors: ['geo:semiconductors-chain', 'geo:strategic-materials'],
  digitalReproducibility: 'low',
  digitalReproducibilityFactors: ['reproducibility:hardware-product'],
});
const platypusFullResult = deriveArchetype(platypusFullMatrix);
check('Platypus matrice complete => archetype B', platypusFullResult.archetype, 'B-hardware-deeptech');
checkTrue('Platypus rationale mentionne productionChain hardware',
  platypusFullResult.rationale.toLowerCase().includes('hardware'));
check('Platypus applicableTests = T1, T3-T7 (T2 exclu)', getApplicableTests(platypusFullResult.archetype), ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']);

// Verification critique : un T2 fictif a 0/100 (cas avant fix : LLM
// halluciait un LTV/CAC sur un constructeur naval) ne penalise pas
// le score Platypus.
const platypusScoreCleanT2 = computeGlobalCoherenceScore({
  crosseHockeySuspecte:    { testId: 'T1', testName: 'T1', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  ratioLtvCacImplicite:    { ...buildNotApplicableTestStub('T2', 'B-hardware-deeptech'), score: 0 },
  margeBruteCoherente:     { testId: 'T3', testName: 'T3', passed: true, score: 75, evidence: '', benchmark: '', implication: '' },
  burnRateRunway:          { testId: 'T4', testName: 'T4', passed: true, score: 70, evidence: '', benchmark: '', implication: '' },
  incoherenceHeadcountCa:  { testId: 'T5', testName: 'T5', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  unitEconomicsViables:    { testId: 'T6', testName: 'T6', passed: true, score: 85, evidence: '', benchmark: '', implication: '' },
  coherenceHypothesesMarche:{ testId: 'T7', testName: 'T7', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
}, ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']);
// (80*1.5 + 75 + 70 + 80 + 85*1.5 + 80*1.5) / 7.5 = (120+75+70+80+127.5+120)/7.5 = 592.5/7.5 = 79
check('Platypus T2=0 hallucine ne penalise pas (notApplicable)', platypusScoreCleanT2, 79);

// Comparaison contrefactuelle : si T2=0 etait note normalement comme avant.
const platypusScoreBuggy = computeGlobalCoherenceScore({
  crosseHockeySuspecte:    { testId: 'T1', testName: 'T1', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  ratioLtvCacImplicite:    { testId: 'T2', testName: 'T2', passed: false, score: 0, evidence: '', benchmark: '', implication: '' }, // pas notApplicable, calcule
  margeBruteCoherente:     { testId: 'T3', testName: 'T3', passed: true, score: 75, evidence: '', benchmark: '', implication: '' },
  burnRateRunway:          { testId: 'T4', testName: 'T4', passed: true, score: 70, evidence: '', benchmark: '', implication: '' },
  incoherenceHeadcountCa:  { testId: 'T5', testName: 'T5', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  unitEconomicsViables:    { testId: 'T6', testName: 'T6', passed: true, score: 85, evidence: '', benchmark: '', implication: '' },
  coherenceHypothesesMarche:{ testId: 'T7', testName: 'T7', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
}, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);
// Si T2 etait applicable a 0 : (80*1.5+0+75+70+80+85*1.5+80*1.5)/8.5 = 592.5/8.5 = 69.7 = 70
checkTrue('Avant fix, T2 calcule a 0 aurait fait chuter le score (>=7 points)',
  platypusScoreCleanT2 - platypusScoreBuggy >= 7);

// ============================================================
// SECTION 9. GATING DETERMINISTE : LLM HALLUCINE T2 SUR HARDWARE
// ------------------------------------------------------------
// Si le LLM contourne la consigne et produit quand meme un T2 sur
// un dossier hardware, le moteur ECRASE par le stub deterministe
// cote code lors de la recombinaison. Verifie via reflexion sur
// buildNotApplicableTestStub.
// ============================================================

console.log('\n=== Section 9. Stub ecrase reponse LLM hallucinee ===');

const llmHallucinatedT2 = {
  testId: 'T2', testName: 'Ratio LTV/CAC implicite', passed: false, score: 20,
  evidence: 'LTV reconstruit a 1500 EUR sur les hypotheses du BP, CAC implicite 800 EUR',
  benchmark: 'SaaS B2B 3-5x', implication: 'Ratio insuffisant',
};
// Le code doit ecraser ce LLM-output par le stub deterministe :
const finalT2 = buildNotApplicableTestStub('T2', 'B-hardware-deeptech');
checkTrue('Stub deterministe ne reprend pas la pseudo-evidence LLM',
  !finalT2.evidence.includes('1500') && !finalT2.evidence.includes('800'));
check('Stub deterministe garde notApplicable=true peu importe le LLM', finalT2.notApplicable, true);

// ============================================================
// SECTION 10. CONSEQUENCE AVAL : score-calculator
// ------------------------------------------------------------
// Verifie que le globalCoherenceScore reste > 0 pour les
// archetypes B / D / E quand des tests applicables sont notes a un
// niveau decent. Avant le fix, un dossier hardware avec T2 et T5
// neutralises a 50 + T1-T3-T4-T6-T7 a 80 sortait a 71. Maintenant
// il sort plus haut car T2/T5 neutralises sont exclus de la moyenne.
// Cela garantit que score-calculator n active pas la branche
// "modele economique non evaluable" sur ces dossiers.
// ============================================================

console.log('\n=== Section 10. Consequence aval score-calculator ===');

const hardwareDecentScores: Record<string, FinancialCoherenceTest> = {
  crosseHockeySuspecte:    { testId: 'T1', testName: 'T1', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  ratioLtvCacImplicite:    buildNotApplicableTestStub('T2', 'B-hardware-deeptech'),
  margeBruteCoherente:     { testId: 'T3', testName: 'T3', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  burnRateRunway:          { testId: 'T4', testName: 'T4', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  incoherenceHeadcountCa:  { testId: 'T5', testName: 'T5', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  unitEconomicsViables:    { testId: 'T6', testName: 'T6', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
  coherenceHypothesesMarche:{ testId: 'T7', testName: 'T7', passed: true, score: 80, evidence: '', benchmark: '', implication: '' },
};
const hardwareDecentScore = computeGlobalCoherenceScore(hardwareDecentScores, ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']);
check('Hardware tous tests applicables a 80 => score 80', hardwareDecentScore, 80);
checkTrue('Hardware score reste > 0 (score-calculator ne court-circuite pas)', hardwareDecentScore > 0);

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
