import { capitalStructureFragilityPattern, _internal } from './capital-structure-fragility-pattern';
import { _getRegistryForTests, _setRegistryForTests } from './orchestrator';
import { applyCentralAxisGating } from './pattern-interface';
import type { ExtractionOutput } from '../types';
import type { PatternAnalysisOutput, PatternInput } from './types';

const MINIMAL_FIN = { revenue: 5000000, monthlyBurn: 200000 } as any;

let pass = 0, fail = 0;
function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); fail++; }
}
function checkTrue(label: string, condition: boolean) { check(label, condition, true); }

console.log('\n=== Test 1 : module structure ===');
{
  _setRegistryForTests({ 'capital-structure-fragility': capitalStructureFragilityPattern });
  checkTrue('present dans registry', !!_getRegistryForTests()['capital-structure-fragility']);
  check('patternId correct', capitalStructureFragilityPattern.patternId, 'capital-structure-fragility');
}

function mockExtraction(opts: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'TestCo', sector: 'SaaS', subSector: 'B2B',
    geographicHub: 'Paris', country: 'France', yearFounded: 2018,
    founders: [],
    marketPitch: 'SaaS B2B avec abonnement.',
    productDescription: 'Workflow automation.',
    businessModel: 'Subscription B2B SaaS',
    traction: { metrics: [] },
    fundraise: { stage: 'Series C', amount: '50M' },
    competitorsCited: [], rawSummary: 'SaaS B2B en growth.',
    boardMembers: [], clientsNamed: [],
    ...opts,
  } as ExtractionOutput;
}

console.log('\n=== Test 2 : isApplicable Series C ===');
{
  const r = _internal.isApplicable(mockExtraction(), MINIMAL_FIN);
  check('Series C -> full', r.level, 'full');
  checkTrue('shouldRun true', r.shouldRun);
}

console.log('\n=== Test 3 : isApplicable Series A ===');
{
  const r = _internal.isApplicable(mockExtraction({ fundraise: { stage: 'Series A', amount: '8M' } }), MINIMAL_FIN);
  check('Series A -> partial', r.level, 'partial');
}

console.log('\n=== Test 4 : isApplicable Seed ===');
{
  const r = _internal.isApplicable(mockExtraction({ fundraise: { stage: 'Seed', amount: '1M' } }), MINIMAL_FIN);
  check('Seed -> weak-signal', r.level, 'weak-signal');
}

console.log('\n=== Test 5 : sans BM ===');
{
  const r = _internal.isApplicable(mockExtraction({ businessModel: '' }), MINIMAL_FIN);
  check('sans BM -> not-applicable', r.level, 'not-applicable');
}

console.log('\n=== Test 5b : pre-check sans financialData -> not-applicable ===');
{
  const r = _internal.isApplicable(mockExtraction(), null);
  check('sans financialData -> not-applicable', r.level, 'not-applicable');
  check('shouldRun false', r.shouldRun, false);
}

console.log('\n=== Test 6 : extractCapTableSnapshot detection ===');
{
  const ws = mockExtraction({
    marketPitch: 'Levee Series D avec liquidation preference participating et anti-dilution full ratchet.',
    rawSummary: 'Tours successifs avec super voting fondateur et ESOP plein.',
  });
  const snap = _internal.extractCapTableSnapshot(ws);
  checkTrue('detecte liquidation preference', snap.capTableSignals.some((k) => k.includes('liquidation preference')));
  checkTrue('detecte full ratchet', snap.capTableSignals.includes('full ratchet'));
  checkTrue('detecte anti-dilution', snap.capTableSignals.includes('anti-dilution'));
  checkTrue('detecte super voting', snap.capTableSignals.includes('super voting'));
  checkTrue('detecte ESOP', snap.capTableSignals.includes('ESOP'));
  checkTrue('detecte participating', snap.preferenceSignals.includes('participating'));
}

console.log('\n=== Test 7 : extractCapTableSnapshot estimate rounds ===');
{
  // Series A = 2 tours estimes (seed + A)
  const seriesA = _internal.extractCapTableSnapshot(mockExtraction({ fundraise: { stage: 'Series A', amount: '5M' } }));
  check('Series A -> 2 tours', seriesA.numberOfRounds, 2);
  // Series C = 4 tours
  const seriesC = _internal.extractCapTableSnapshot(mockExtraction({ fundraise: { stage: 'Series C', amount: '50M' } }));
  check('Series C -> 4 tours', seriesC.numberOfRounds, 4);
  // Seed = 1 tour
  const seed = _internal.extractCapTableSnapshot(mockExtraction({ fundraise: { stage: 'Seed', amount: '500k' } }));
  check('Seed -> 1 tour', seed.numberOfRounds, 1);
}

console.log('\n=== Test 8 : buildUserPrompt structure ===');
{
  const input: PatternInput = {
    extraction: mockExtraction({
      marketPitch: 'Levee Series C avec preferences cumulees.',
      fundraise: { stage: 'Series C', amount: '50M' },
    }),
  };
  const p = _internal.buildUserPrompt(input);
  checkTrue('mentionne TestCo', p.includes('TestCo'));
  checkTrue('mentionne Series C', p.includes('Series C'));
  checkTrue('mentionne nombre tours', p.includes('4'));
  checkTrue('contient SIGNAUX CAP TABLE', p.includes('SIGNAUX CAP TABLE'));
}

console.log('\n=== Test 9 : llmOutputToPatternOutput ===');
{
  const mockRaw = {
    applicabilite: 'full' as const,
    applicabiliteRationale: 'Series C avec multiples tours preferes.',
    axis1: { score: 85, verdict: 'drapeau-rouge' as const, rationale: 'Preferences cumulees superieures a 90% valuation.', evidencePro: ['[pacte] preferences 95% valuation', '[termsheet] 1x participating dernier tour'], evidenceContra: [], confidence: 90 },
    axis2: { score: 75, verdict: 'alerte' as const, rationale: 'Full ratchet present, drag-along controle preferred.', evidencePro: ['[pacte] full ratchet round D'], evidenceContra: [], confidence: 85 },
    axis3: { score: 80, verdict: 'drapeau-rouge' as const, rationale: 'Plage exit favorable common inexistante.', evidencePro: ['[inference] common payouts a zero sous 8Md'], evidenceContra: [], confidence: 80 },
    globalScore: 80,
    verdict: 'drapeau-rouge' as const,
    resumeEditorial: 'Profil Capital Structure Fragility proche de WeWork avant 2019.',
    counterArchetype: { closest: 'WeWork', direction: 'derive-confirmee' as const, rationale: 'Mecanique mecaniquement incompatible avec une IPO sous 47Md.' },
    recommandationDD: 'Demander pacte complet et opinion legale sur clauses ambigues.',
  };
  const out = _internal.llmOutputToPatternOutput(mockRaw);
  check('patternId correct', out.patternId, 'capital-structure-fragility');
  check('globalScore preserve', out.globalScore, 80);
  check('counterArchetype WeWork', out.counterArchetype.closest, 'WeWork');
  checkTrue('claimsChiffres extraits', out.auditTrail.claimsChiffres.length > 0);
}

console.log('\n=== Test 10 : SYSTEM_PROMPT doctrinal ===');
{
  const sp = _internal.SYSTEM_PROMPT;
  checkTrue('mentionne axe 1 preferences', sp.toLowerCase().includes('axe 1') && sp.toLowerCase().includes('preferences'));
  checkTrue('mentionne axe 2 asymetries', sp.toLowerCase().includes('axe 2') && sp.toLowerCase().includes('asymetries'));
  checkTrue('mentionne axe 3 exit', sp.toLowerCase().includes('axe 3') && sp.toLowerCase().includes('exit'));
  checkTrue('mentionne WeWork', sp.includes('WeWork'));
  checkTrue('mentionne Klarna 2022', sp.includes('Klarna'));
  checkTrue('mentionne Stripe Adyen sains', sp.includes('Stripe') && sp.includes('Adyen'));
  checkTrue('contrainte coherence', sp.includes('CONTRAINTE DE COHERENCE'));
  checkTrue('format JSON', sp.includes('FORMAT JSON OBLIGATOIRE'));
}

console.log('\n=== Test 11 : KEYWORDS calibres ===');
{
  checkTrue('liquidation preference dans CAPTABLE_KEYWORDS', _internal.CAPTABLE_KEYWORDS.includes('liquidation preference'));
  checkTrue('full ratchet dans CAPTABLE_KEYWORDS', _internal.CAPTABLE_KEYWORDS.includes('full ratchet'));
  checkTrue('drag-along dans CAPTABLE_KEYWORDS', _internal.CAPTABLE_KEYWORDS.includes('drag-along'));
  checkTrue('participating dans PREFERENCE_SIGNALS', _internal.PREFERENCE_SIGNALS.includes('participating'));
  checkTrue('down round dans PREFERENCE_SIGNALS', _internal.PREFERENCE_SIGNALS.includes('down round'));
}

console.log('\n=== Test 12 : gating axe 1 (axe central Capital Structure Fragility) ===');
{
  const naAxis = {
    score: 0, verdict: 'non-applicable' as const,
    rationale: 'Pacte d actionnaires non accessible.',
    evidencePro: [], evidenceContra: [], confidence: 0,
  };
  const inflated: PatternAnalysisOutput = {
    patternId: 'capital-structure-fragility',
    applicabilite: 'full',
    applicabiliteRationale: '',
    globalScore: 75,
    verdict: 'drapeau-rouge',
    resumeEditorial: '',
    axis1: naAxis,
    axis2: { score: 80, verdict: 'drapeau-rouge', rationale: '', evidencePro: [], evidenceContra: [], confidence: 80 },
    axis3: { score: 70, verdict: 'alerte', rationale: '', evidencePro: [], evidenceContra: [], confidence: 75 },
    counterArchetype: { closest: 'n/a', direction: 'non determine', rationale: '' },
    recommandationDD: '',
    auditTrail: { sourceTags: [], claimsChiffres: [] },
  };
  const gated = applyCentralAxisGating(inflated, 'axis1', 'Pattern non applicable.');
  check('verdict non-applicable', gated.verdict, 'non-applicable');
  check('globalScore null', gated.globalScore, null);
  check('applicabilite forcee', gated.applicabilite, 'not-applicable');
}

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
