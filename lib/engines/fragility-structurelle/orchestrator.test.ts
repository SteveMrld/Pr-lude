// ============================================================
// Tests orchestrateur Fragilite Structurelle
// ------------------------------------------------------------
// Couvre l execution conditionnelle des patterns, la detection
// des combinaisons diagnostiques, l agregation du score global,
// la resilience aux echecs individuels.
//
// Execution : tsx lib/engines/fragility-structurelle/orchestrator.test.ts
// ============================================================

import {
  analyzeFragiliteStructurelle,
  _setRegistryForTests,
} from './orchestrator';
import {
  type PatternModule,
  type PatternApplicabilityCheck,
  buildNotApplicableOutput,
} from './pattern-interface';
import type {
  PatternId,
  PatternInput,
  PatternAnalysisOutput,
  PatternVerdict,
} from './types';

let pass = 0, fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, condition: boolean) {
  check(label, condition, true);
}

// ============================================================
// HELPERS DE MOCK
// ============================================================

function buildMockOutput(
  patternId: PatternId,
  globalScore: number,
  verdict: PatternVerdict = 'attention',
): PatternAnalysisOutput {
  const axis = {
    score: globalScore,
    verdict,
    rationale: `Mock rationale pour ${patternId}.`,
    evidencePro: [`[mock] evidence pro globalScore ${globalScore}`],
    evidenceContra: [],
    confidence: 70,
  };
  return {
    patternId,
    applicabilite: 'full',
    applicabiliteRationale: 'Mock applicable.',
    globalScore,
    verdict,
    resumeEditorial: `Resume mock ${patternId}.`,
    axis1: axis,
    axis2: axis,
    axis3: axis,
    counterArchetype: {
      closest: 'Mock Co',
      direction: globalScore >= 60 ? 'derive-confirmee' : 'trajectoire-saine',
      rationale: 'Mock rationale archetype.',
    },
    recommandationDD: `Investiguer ${patternId} en DD.`,
    auditTrail: { sourceTags: ['mock'], claimsChiffres: [] },
  };
}

function buildMockModule(
  patternId: PatternId,
  globalScore: number,
  verdict: PatternVerdict = 'attention',
  shouldFail = false,
): PatternModule {
  return {
    patternId,
    isApplicable: (): PatternApplicabilityCheck => ({
      level: 'full',
      rationale: 'Mock applicable.',
      shouldRun: true,
    }),
    analyze: async (_input: PatternInput): Promise<PatternAnalysisOutput> => {
      if (shouldFail) throw new Error(`Mock failure ${patternId}`);
      return buildMockOutput(patternId, globalScore, verdict);
    },
  };
}

const mockInput: PatternInput = {
  extraction: {} as any,
  financialData: null,
};

// ============================================================
// Test 1 : aucun pattern enregistre = output minimal
// ============================================================

(async () => {
  console.log('\n=== Test 1 : aucun pattern enregistre ===');
  _setRegistryForTests({});

  const result = await analyzeFragiliteStructurelle(mockInput, null);

  check('globalFragilityScore = 0', result.globalFragilityScore, 0);
  check('verdict = sain (pas de pattern actif)', result.verdict, 'sain');
  check('combinaisons vides', result.combinaisons.length, 0);
  checkTrue('resumeEditorial mentionne aucun pattern applicable', result.resumeEditorial.toLowerCase().includes('aucun pattern applicable'));
  // Tous les patterns doivent etre presents en non-applicable
  check('growth-subsidized non applicable', result.patterns['growth-subsidized-model']?.applicabilite, 'not-applicable');
  check('infrastructure-hostage non applicable', result.patterns['infrastructure-hostage']?.applicabilite, 'not-applicable');
  check('scale-mirage non applicable', result.patterns['scale-mirage-risk']?.applicabilite, 'not-applicable');

  // ============================================================
  // Test 2 : un seul pattern enregistre, score modere
  // ============================================================
  console.log('\n=== Test 2 : un seul pattern, score 40 (sain) ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 40, 'attention'),
  });

  const r2 = await analyzeFragiliteStructurelle(mockInput, null);
  check('un pattern actif', r2.patterns['growth-subsidized-model']?.applicabilite, 'full');
  check('score global = 40', r2.globalFragilityScore, 40);
  check('verdict = attention (35-54)', r2.verdict, 'attention');
  check('zero combinaison', r2.combinaisons.length, 0);

  // ============================================================
  // Test 3 : deux patterns au-dessus du seuil = combinaison
  // ============================================================
  console.log('\n=== Test 3 : Trajectoire WeWork (Growth Subsidized + Fixed Cost Trap a 70) ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 70, 'alerte'),
    'fixed-cost-trap': buildMockModule('fixed-cost-trap', 70, 'alerte'),
  });

  const r3 = await analyzeFragiliteStructurelle(mockInput, null);
  check('combinaison detectee', r3.combinaisons.length, 1);
  check('combinaison = Trajectoire WeWork', r3.combinaisons[0]?.nom, 'Trajectoire WeWork');
  check('combinaison severe', r3.combinaisons[0]?.severite, 'drapeau-rouge');
  check('verdict force a drapeau-rouge', r3.verdict, 'drapeau-rouge');

  // ============================================================
  // Test 4 : trois patterns en triple exposition WeWork
  // ============================================================
  console.log('\n=== Test 4 : Triple exposition WeWork (cap table + growth subsidized + fixed cost trap a 60) ===');
  _setRegistryForTests({
    'capital-structure-fragility': buildMockModule('capital-structure-fragility', 60, 'alerte'),
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 60, 'alerte'),
    'fixed-cost-trap': buildMockModule('fixed-cost-trap', 60, 'alerte'),
  });

  const r4 = await analyzeFragiliteStructurelle(mockInput, null);
  // Trajectoire WeWork (subsidized + fixed-cost) ET exposition triple WeWork (les trois)
  checkTrue('au moins deux combinaisons detectees', r4.combinaisons.length >= 2);
  const noms = r4.combinaisons.map((c) => c.nom);
  checkTrue('Trajectoire WeWork detectee', noms.includes('Trajectoire WeWork'));
  checkTrue('Exposition triple WeWork detectee', noms.includes('Exposition triple WeWork'));

  // ============================================================
  // Test 5 : resilience face a l echec d un pattern
  // ============================================================
  console.log('\n=== Test 5 : resilience face a echec pattern ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 70, 'alerte'),
    'fixed-cost-trap': buildMockModule('fixed-cost-trap', 70, 'alerte', true), // shouldFail
  });

  const r5 = await analyzeFragiliteStructurelle(mockInput, null);
  check('growth-subsidized reste actif', r5.patterns['growth-subsidized-model']?.applicabilite, 'full');
  check('fixed-cost-trap fallback en non-applicable', r5.patterns['fixed-cost-trap']?.applicabilite, 'not-applicable');
  // Combinaison Trajectoire WeWork ne se declenche plus parce qu un pattern est tombe
  const trajWeWork = r5.combinaisons.find((c) => c.nom === 'Trajectoire WeWork');
  check('Trajectoire WeWork non declenchee (un pattern tombe)', trajWeWork, undefined);

  // ============================================================
  // Test 6 : recommandations DD consolidees
  // ============================================================
  console.log('\n=== Test 6 : recommandations DD consolidees ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 50, 'attention'),
    'infrastructure-hostage': buildMockModule('infrastructure-hostage', 50, 'attention'),
    'scale-mirage-risk': buildMockModule('scale-mirage-risk', 50, 'attention'),
  });

  const r6 = await analyzeFragiliteStructurelle(mockInput, null);
  check('trois recommandations distinctes', r6.recommandationsDD.length, 3);
  checkTrue('reco 1 mentionne growth-subsidized', r6.recommandationsDD[0].includes('growth-subsidized-model'));
  checkTrue('reco 2 mentionne infrastructure-hostage', r6.recommandationsDD.some((r) => r.includes('infrastructure-hostage')));

  // ============================================================
  // Test 7 : matrice declare patterns non applicables
  // ============================================================
  console.log('\n=== Test 7 : matrice declare patterns non applicables ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 70, 'alerte'),
  });

  const matriceMock = {
    verdicts: {
      fragiliteStructurelle: {
        'growth-subsidized-model': { applicable: 'none', weight: 0, scope: [], rationale: 'Hors-scope mock' },
      },
    },
  } as any;

  const r7 = await analyzeFragiliteStructurelle(mockInput, matriceMock);
  check('matrice none -> pattern non applicable', r7.patterns['growth-subsidized-model']?.applicabilite, 'not-applicable');
  check('rationale matrice respecte', r7.patterns['growth-subsidized-model']?.applicabiliteRationale, 'Hors-scope mock');

  // ============================================================
  // FIN
  // ============================================================
  console.log(`\n${pass}/${pass + fail} tests passes`);
  process.exit(fail > 0 ? 1 : 0);
})();
