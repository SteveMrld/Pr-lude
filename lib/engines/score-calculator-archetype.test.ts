// ============================================================
// TESTS DE NON-REGRESSION - SCORE MECANIQUE ARCHETYPAL
// ------------------------------------------------------------
// Verifie les corrections cosmetiques et de transparence du score
// mecanique (gravites 2, 3, 4 de l audit). Les ponderations et la
// logique de scoring sont strictement inchangees : c est l objet
// principal du garde-fou non-regression. Un dossier SaaS canonique
// doit conserver un score mecanique strictement identique a avant.
//
// Couvre :
//   - Garde-fou cas SaaS canonique (archetype A) : score mecanique
//     identique au comportement historique, seuil de divergence 15.
//   - Cas hardware (archetype B) : rationale Financial mentionne
//     "6 tests applicables (T2 neutralise)", seuil de divergence 20.
//   - Cas biotech (archetype D) : rationale Financial mentionne
//     "3 tests applicables", seuil de divergence 25.
//   - Cas unclassified : seuil de divergence 25.
//   - Compatibilite ascendante : matrice / archetype absent du
//     financial output retombe sur seuil 15 (comportement historique).
//
// Execution : npx tsx lib/engines/score-calculator-archetype.test.ts
// ============================================================

import {
  computeMechanicalScore,
  DIVERGENCE_THRESHOLDS_BY_ARCHETYPE,
  DEFAULT_DIVERGENCE_THRESHOLD,
} from './score-calculator';
import type {
  TeamAnalysisOutput,
  MarketAnalysisOutput,
  MacroAnalysisOutput,
  FinancialCoherenceOutput,
  ContrarianAnalysisOutput,
  BlindspotAnalysisOutput,
  FinancialCoherenceArchetype,
} from './types';

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
// HELPERS : fabrication d outputs synthetiques pour les six moteurs
// ============================================================

function makeTeam(score = 70): TeamAnalysisOutput {
  return {
    systemicCoverage: { score, rationale: '', strengths: [], gaps: [] },
    collectiveAntiFragility: { score, rationale: '', strengths: [], gaps: [] },
    experienceTransposition: { score, rationale: '', strengths: [], gaps: [] },
    founderObsession: { score, rationale: '', strengths: [], gaps: [] },
    syntheseGlobale: '',
    redFlags: [],
    questionsToInstruct: [],
  } as any;
}

function makeMarket(score = 65): MarketAnalysisOutput {
  return {
    perceivedSize: 'large',
    realIntensity: 'medium',
    saturation: 'fragmented',
    organicSignals: { score, rationale: '', evidence: [] },
    needIntensity: { score, rationale: '', gap: '' },
    defensibility: { score, moats: [], vulnerabilities: [] } as any,
    contrarianOpportunity: '',
    syntheseGlobale: '',
    questionsToInstruct: [],
  } as any;
}

function makeMacro(score = 55): MacroAnalysisOutput {
  return {
    cyclePosition: 'mature',
    interestRateRegime: 'restrictif',
    geopolitics: '',
    vcCapitalOnSegment: 'balanced',
    demandCycle: '',
    criticalTimingWindow: { exists: false, rationale: '' },
    contraryclicalOpportunity: { score, rationale: '' },
    structuralTrends: [],
    regulatoryEnvironment: '',
  } as any;
}

function makeFinancial(
  globalCoherenceScore: number,
  archetype?: FinancialCoherenceArchetype,
  applicableTests?: string[],
): FinancialCoherenceOutput {
  return {
    hasFinancialData: true,
    dataSource: 'bp',
    archetype,
    applicableTests,
    tests: {} as any,
    globalCoherenceScore,
    alertesCritiques: [],
    incoherenceDeckVsBP: [],
    syntheseCoherence: '',
    recalculsEffectues: [],
  };
}

function makeContrarian(score = 60): ContrarianAnalysisOutput {
  return { globalContrarianScore: score, signals: {} as any } as any;
}

function makeBlindspot(score = 40): BlindspotAnalysisOutput {
  return { globalBlindspotScore: score, patterns: {} as any } as any;
}

// ============================================================
// SECTION 1. GARDE-FOU NON-REGRESSION SAAS CANONIQUE
// ------------------------------------------------------------
// CRITIQUE : un dossier SaaS canonique (archetype A) doit conserver
// un score mecanique strictement identique au comportement historique.
// Aucune ponderation ne change, aucun calcul ne change. Seul le
// rationale editorial et le seuil de divergence affiche dans l UI
// peuvent etre enrichis.
// ============================================================

console.log('\n=== Section 1. Garde-fou non-regression SaaS canonique (archetype A) ===');

const saasResult = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75, 'A-saas-pur', ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
});

// Calcul attendu historique : 0.20*70 + 0.22*65 + 0.15*55 + 0.13*75 +
// 0.15*60 + 0.15*60 (vigilance = 100-40 = 60)
// = 14 + 14.3 + 8.25 + 9.75 + 9 + 9 = 64.3 → 64
check('SaaS canonique : score mecanique 64 (identique a avant fix)', saasResult.globalScore, 64);
check('SaaS canonique : verdict "investir avec conditions" (60-74)', saasResult.verdict, 'investir avec conditions');
check('SaaS canonique : seuil de divergence 15 (archetype A)', saasResult.divergenceThreshold, 15);
check('SaaS canonique : archetype propage', saasResult.archetype, 'A-saas-pur');
checkTrue('SaaS canonique : rationale Financial mentionne "sept tests"',
  saasResult.dimensions.financial.rationale.toLowerCase().includes('sept tests'));
checkTrue('SaaS canonique : rationale Financial mentionne "tous les tests applicables"',
  saasResult.dimensions.financial.rationale.toLowerCase().includes('tous les tests applicables'));

// Variante consumer-subscription (toujours archetype A)
const consumerSubResult = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75, 'A-saas-pur', ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
});
check('Consumer subscription A : score identique', consumerSubResult.globalScore, 64);
check('Consumer subscription A : seuil 15', consumerSubResult.divergenceThreshold, 15);

// Comparaison contrefactuelle : on retire archetype + applicableTests
// (simulant un dossier persiste avant le commit 5184213). Le score
// doit etre identique car le calcul ne depend pas de l archetype.
const saasNoArchetypeResult = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75), // pas d archetype, pas d applicableTests
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
});
check('SaaS sans archetype (compat legacy) : score identique', saasNoArchetypeResult.globalScore, 64);
check('SaaS sans archetype : seuil de divergence par defaut 15', saasNoArchetypeResult.divergenceThreshold, DEFAULT_DIVERGENCE_THRESHOLD);
checkTrue('SaaS sans archetype : rationale Financial retombe sur texte historique',
  saasNoArchetypeResult.dimensions.financial.rationale.toLowerCase().includes('sept tests structures (t1-t7)'));

// ============================================================
// SECTION 2. ARCHETYPE B - HARDWARE / DEEPTECH
// ------------------------------------------------------------
// Le score mecanique a la meme formule. Seuls le rationale Financial
// et le seuil de divergence different. Cas Platypus archetypal.
// ============================================================

console.log('\n=== Section 2. Archetype B hardware - rationale et seuil ===');

const hardwareResult = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75, 'B-hardware-deeptech', ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
});

check('Hardware B : score mecanique identique a SaaS (calcul inchange)', hardwareResult.globalScore, 64);
check('Hardware B : verdict identique', hardwareResult.verdict, 'investir avec conditions');
check('Hardware B : seuil de divergence 20', hardwareResult.divergenceThreshold, 20);
check('Hardware B : archetype propage', hardwareResult.archetype, 'B-hardware-deeptech');
checkTrue('Hardware B : rationale Financial mentionne "6 tests applicables"',
  hardwareResult.dimensions.financial.rationale.includes('6 tests applicables'));
checkTrue('Hardware B : rationale Financial mentionne "T2 neutralise"',
  hardwareResult.dimensions.financial.rationale.toLowerCase().includes('t2 neutralise'));
checkTrue('Hardware B : rationale Financial mentionne archetype hardware',
  hardwareResult.dimensions.financial.rationale.toLowerCase().includes('hardware'));

// ============================================================
// SECTION 3. ARCHETYPE D - BIOTECH PRE-APPROBATION
// ============================================================

console.log('\n=== Section 3. Archetype D biotech - rationale et seuil ===');

const biotechResult = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75, 'D-biotech-pre-approval', ['T3', 'T4', 'T7']),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
});

check('Biotech D : score mecanique identique (calcul inchange)', biotechResult.globalScore, 64);
check('Biotech D : seuil de divergence 25', biotechResult.divergenceThreshold, 25);
check('Biotech D : archetype propage', biotechResult.archetype, 'D-biotech-pre-approval');
checkTrue('Biotech D : rationale Financial mentionne "3 tests applicables"',
  biotechResult.dimensions.financial.rationale.includes('3 tests applicables'));
checkTrue('Biotech D : rationale Financial liste les tests neutralises (T1, T2, T5, T6)',
  biotechResult.dimensions.financial.rationale.includes('T1, T2, T5, T6 neutralises'));

// ============================================================
// SECTION 4. ARCHETYPES E, C, F
// ============================================================

console.log('\n=== Section 4. Autres archetypes ===');

// C marketplace : tous tests applicables, seuil 15
const marketplaceResult = computeMechanicalScore({
  team: makeTeam(70), market: makeMarket(65), macro: makeMacro(55),
  financial: makeFinancial(75, 'C-marketplace', ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']),
  contrarian: makeContrarian(60), blindspot: makeBlindspot(40),
});
check('Marketplace C : seuil de divergence 15', marketplaceResult.divergenceThreshold, 15);

// F consumer DTC : tous tests applicables, seuil 15
const dtcResult = computeMechanicalScore({
  team: makeTeam(70), market: makeMarket(65), macro: makeMacro(55),
  financial: makeFinancial(75, 'F-consumer-dtc', ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']),
  contrarian: makeContrarian(60), blindspot: makeBlindspot(40),
});
check('Consumer DTC F : seuil de divergence 15', dtcResult.divergenceThreshold, 15);

// E B2G : T2 neutralise, seuil 20
const b2gResult = computeMechanicalScore({
  team: makeTeam(70), market: makeMarket(65), macro: makeMacro(55),
  financial: makeFinancial(75, 'E-b2g-defense', ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']),
  contrarian: makeContrarian(60), blindspot: makeBlindspot(40),
});
check('B2G E : seuil de divergence 20', b2gResult.divergenceThreshold, 20);
checkTrue('B2G E : rationale Financial mentionne "6 tests applicables"',
  b2gResult.dimensions.financial.rationale.includes('6 tests applicables'));

// unclassified : seuil 25
const unclassifiedResult = computeMechanicalScore({
  team: makeTeam(70), market: makeMarket(65), macro: makeMacro(55),
  financial: makeFinancial(75, 'unclassified', ['T1', 'T3', 'T4', 'T7']),
  contrarian: makeContrarian(60), blindspot: makeBlindspot(40),
});
check('Unclassified : seuil de divergence 25', unclassifiedResult.divergenceThreshold, 25);
checkTrue('Unclassified : rationale Financial mentionne "4 tests applicables"',
  unclassifiedResult.dimensions.financial.rationale.includes('4 tests applicables'));

// ============================================================
// SECTION 5. TABLE DES SEUILS - VERIFICATION COMPLETE
// ============================================================

console.log('\n=== Section 5. Table des seuils de divergence par archetype ===');

check('DIVERGENCE_THRESHOLDS A-saas-pur = 15', DIVERGENCE_THRESHOLDS_BY_ARCHETYPE['A-saas-pur'], 15);
check('DIVERGENCE_THRESHOLDS C-marketplace = 15', DIVERGENCE_THRESHOLDS_BY_ARCHETYPE['C-marketplace'], 15);
check('DIVERGENCE_THRESHOLDS F-consumer-dtc = 15', DIVERGENCE_THRESHOLDS_BY_ARCHETYPE['F-consumer-dtc'], 15);
check('DIVERGENCE_THRESHOLDS B-hardware-deeptech = 20', DIVERGENCE_THRESHOLDS_BY_ARCHETYPE['B-hardware-deeptech'], 20);
check('DIVERGENCE_THRESHOLDS E-b2g-defense = 20', DIVERGENCE_THRESHOLDS_BY_ARCHETYPE['E-b2g-defense'], 20);
check('DIVERGENCE_THRESHOLDS D-biotech-pre-approval = 25', DIVERGENCE_THRESHOLDS_BY_ARCHETYPE['D-biotech-pre-approval'], 25);
check('DIVERGENCE_THRESHOLDS unclassified = 25', DIVERGENCE_THRESHOLDS_BY_ARCHETYPE['unclassified'], 25);
check('DEFAULT_DIVERGENCE_THRESHOLD = 15', DEFAULT_DIVERGENCE_THRESHOLD, 15);

// ============================================================
// SECTION 6. NON-REGRESSION DIMENSIONS NON-FINANCIAL
// ------------------------------------------------------------
// Verifie que les dimensions Team, Market, Macro, Contrarian,
// Vigilance ne sont PAS affectees par l archetype. Leur rationale
// reste identique au comportement historique.
// ============================================================

console.log('\n=== Section 6. Non-regression dimensions non-financial ===');

const allScoresIdentical = computeMechanicalScore({
  team: makeTeam(80),
  market: makeMarket(75),
  macro: makeMacro(60),
  financial: makeFinancial(70, 'B-hardware-deeptech', ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']),
  contrarian: makeContrarian(65),
  blindspot: makeBlindspot(35),
});

check('Dimension Team score 80 (independant de l archetype)', allScoresIdentical.dimensions.team.score, 80);
check('Dimension Market score 75 (independant de l archetype)', allScoresIdentical.dimensions.market.score, 75);
check('Dimension Macro score 60 (independant de l archetype)', allScoresIdentical.dimensions.macro.score, 60);
check('Dimension Contrarian score 65 (independant de l archetype)', allScoresIdentical.dimensions.contrarian.score, 65);
check('Dimension Vigilance score 65 (100-35, independant)', allScoresIdentical.dimensions.vigilance.score, 65);
checkTrue('Rationale Team inchange (pas de mention archetype)',
  !allScoresIdentical.dimensions.team.rationale.toLowerCase().includes('archetype'));
checkTrue('Rationale Market inchange (pas de mention archetype)',
  !allScoresIdentical.dimensions.market.rationale.toLowerCase().includes('archetype'));

// ============================================================
// SECTION 7. PONDERATIONS STRICTEMENT INCHANGEES
// ============================================================

console.log('\n=== Section 7. Ponderations strictement inchangees ===');

// Calcul manuel pour verifier l invariance exacte du score.
// Cas hardware B avec scores 70/65/55/75/60/40-vigilance(60).
// 0.20*70 + 0.22*65 + 0.15*55 + 0.13*75 + 0.15*60 + 0.15*60 = 64.3
const hardwareControlled = computeMechanicalScore({
  team: makeTeam(70), market: makeMarket(65), macro: makeMacro(55),
  financial: makeFinancial(75, 'B-hardware-deeptech', ['T1', 'T3', 'T4', 'T5', 'T6', 'T7']),
  contrarian: makeContrarian(60), blindspot: makeBlindspot(40),
});
// Comparaison stricte cas A vs B avec memes scores : doivent etre identiques.
check('Score hardware B avec memes inputs = score SaaS A (calcul invariant)',
  hardwareControlled.globalScore, saasResult.globalScore);
check('Contribution Team identique cas A et B', hardwareControlled.dimensions.team.contribution, saasResult.dimensions.team.contribution);
check('Contribution Financial identique cas A et B', hardwareControlled.dimensions.financial.contribution, saasResult.dimensions.financial.contribution);

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
