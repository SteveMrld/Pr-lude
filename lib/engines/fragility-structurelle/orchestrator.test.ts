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
  check('cause = matrix', r7.patterns['growth-subsidized-model']?.nonApplicabilityCause, 'matrix');

  // ============================================================
  // Test 8 : couverture, verdict et cause quand un detecteur tombe
  // en erreur d execution mais un autre remonte a 33 (cas c50bb153)
  // ============================================================
  console.log('\n=== Test 8 : six patterns en erreur, un actif a 33, attendu non-concluant ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 33, 'attention', true),
    'infrastructure-hostage': buildMockModule('infrastructure-hostage', 33, 'attention'),
    'fixed-cost-trap': buildMockModule('fixed-cost-trap', 33, 'attention', true),
    'regulatory-time-bomb': buildMockModule('regulatory-time-bomb', 33, 'attention', true),
    'commoditization-drift': buildMockModule('commoditization-drift', 33, 'attention', true),
    'capital-structure-fragility': buildMockModule('capital-structure-fragility', 33, 'attention', true),
    'scale-mirage-risk': buildMockModule('scale-mirage-risk', 33, 'attention', true),
  });

  const r8 = await analyzeFragiliteStructurelle(mockInput, null);
  check('coverage.failed = 6', r8.coverage?.failed, 6);
  check('coverage.contributing = 1', r8.coverage?.contributing, 1);
  check('coverage.total = 7', r8.coverage?.total, 7);
  check('globalFragilityScore = 33', r8.globalFragilityScore, 33);
  check('verdict force a non-concluant (etait sain)', r8.verdict, 'non-concluant');
  check('growth-subsidized cause = execution-error', r8.patterns['growth-subsidized-model']?.nonApplicabilityCause, 'execution-error');
  check('infrastructure-hostage actif', r8.patterns['infrastructure-hostage']?.applicabilite, 'full');
  checkTrue('resume mentionne 6 detecteurs tombes', r8.resumeEditorial.includes('6 detecteurs sur 7'));
  checkTrue('resume ne dit jamais aucun pattern ne remonte', !r8.resumeEditorial.includes('Aucun pattern'));

  // ============================================================
  // Test 9 : sept patterns tous en erreur, weightTotal === 0
  // Attendu : verdict non-concluant, PAS sain 0/100
  // ============================================================
  console.log('\n=== Test 9 : sept patterns en erreur, attendu non-concluant et non sain 0/100 ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 0, 'sain', true),
    'infrastructure-hostage': buildMockModule('infrastructure-hostage', 0, 'sain', true),
    'fixed-cost-trap': buildMockModule('fixed-cost-trap', 0, 'sain', true),
    'regulatory-time-bomb': buildMockModule('regulatory-time-bomb', 0, 'sain', true),
    'commoditization-drift': buildMockModule('commoditization-drift', 0, 'sain', true),
    'capital-structure-fragility': buildMockModule('capital-structure-fragility', 0, 'sain', true),
    'scale-mirage-risk': buildMockModule('scale-mirage-risk', 0, 'sain', true),
  });

  const r9 = await analyzeFragiliteStructurelle(mockInput, null);
  check('coverage.failed = 7', r9.coverage?.failed, 7);
  check('coverage.contributing = 0', r9.coverage?.contributing, 0);
  check('globalFragilityScore = 0 (weightTotal 0)', r9.globalFragilityScore, 0);
  check('verdict = non-concluant, jamais sain', r9.verdict, 'non-concluant');
  checkTrue('resume mentionne non-concluant', r9.resumeEditorial.toLowerCase().includes('non-concluant'));

  // ============================================================
  // Test 10 : un pattern actif a 60 (alerte), six en erreur
  // Attendu : alerte maintenu, un detecteur qui crie reste opposable
  // ============================================================
  console.log('\n=== Test 10 : un pattern a 60 avec six en erreur, attendu alerte maintenu ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 60, 'alerte'),
    'infrastructure-hostage': buildMockModule('infrastructure-hostage', 0, 'sain', true),
    'fixed-cost-trap': buildMockModule('fixed-cost-trap', 0, 'sain', true),
    'regulatory-time-bomb': buildMockModule('regulatory-time-bomb', 0, 'sain', true),
    'commoditization-drift': buildMockModule('commoditization-drift', 0, 'sain', true),
    'capital-structure-fragility': buildMockModule('capital-structure-fragility', 0, 'sain', true),
    'scale-mirage-risk': buildMockModule('scale-mirage-risk', 0, 'sain', true),
  });

  const r10 = await analyzeFragiliteStructurelle(mockInput, null);
  check('coverage.failed = 6', r10.coverage?.failed, 6);
  check('globalFragilityScore = 60', r10.globalFragilityScore, 60);
  check('verdict = alerte, non degrade en non-concluant', r10.verdict, 'alerte');
  checkTrue('resume mentionne couverture partielle mais signal opposable', r10.resumeEditorial.includes('Couverture partielle'));

  // ============================================================
  // Test 11 : patterns ecartes par la matrice, aucune erreur
  // Attendu : verdict normal (sain ici puisqu aucun pattern applicable)
  // ============================================================
  console.log('\n=== Test 11 : patterns ecartes doctrinalement, verdict normal ===');
  _setRegistryForTests({
    'growth-subsidized-model': buildMockModule('growth-subsidized-model', 70, 'alerte'),
    'infrastructure-hostage': buildMockModule('infrastructure-hostage', 70, 'alerte'),
  });

  const matriceAllNone = {
    verdicts: {
      fragiliteStructurelle: {
        'growth-subsidized-model': { applicable: 'none', weight: 0, scope: [], rationale: 'Hors-scope' },
        'infrastructure-hostage': { applicable: 'none', weight: 0, scope: [], rationale: 'Hors-scope' },
      },
    },
  } as any;

  const r11 = await analyzeFragiliteStructurelle(mockInput, matriceAllNone);
  check('coverage.failed = 0 (matrix != erreur)', r11.coverage?.failed, 0);
  check('coverage.contributing = 0', r11.coverage?.contributing, 0);
  check('verdict = sain (aucune erreur, aucun pattern actif)', r11.verdict, 'sain');
  check('growth cause = matrix', r11.patterns['growth-subsidized-model']?.nonApplicabilityCause, 'matrix');
  check('scale-mirage-risk cause = not-implemented', r11.patterns['scale-mirage-risk']?.nonApplicabilityCause, 'not-implemented');

  // ============================================================
  // FIN
  // ============================================================
  console.log(`\n${pass}/${pass + fail} tests passes`);
  process.exit(fail > 0 ? 1 : 0);
})();
