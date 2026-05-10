// Tests skeleton Commoditization Drift Pattern

import { commoditizationDriftPattern, _internal } from './commoditization-drift-pattern';
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
  _setRegistryForTests({ 'commoditization-drift': commoditizationDriftPattern });
  checkTrue('present dans registry', !!_getRegistryForTests()['commoditization-drift']);
  check('patternId correct', commoditizationDriftPattern.patternId, 'commoditization-drift');
}

function mockExtraction(opts: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'TestCo', sector: 'SaaS', subSector: 'B2B',
    geographicHub: 'Paris', country: 'France', yearFounded: 2020,
    founders: [],
    marketPitch: 'SaaS B2B avec abonnement.',
    productDescription: 'Workflow automation cloud.',
    businessModel: 'Subscription B2B SaaS',
    traction: { metrics: [] },
    fundraise: { stage: 'Series B', amount: '20M' },
    competitorsCited: [], rawSummary: 'SaaS B2B abonnement.',
    boardMembers: [], clientsNamed: [],
    ...opts,
  } as ExtractionOutput;
}

console.log('\n=== Test 2 : isApplicable SaaS ===');
{
  const r = _internal.isApplicable(mockExtraction(), MINIMAL_FIN);
  check('SaaS -> full', r.level, 'full');
  checkTrue('shouldRun true', r.shouldRun);
}

console.log('\n=== Test 3 : isApplicable hardware physique pur ===');
{
  const hw = mockExtraction({
    sector: 'Hardware',
    marketPitch: 'Production drones agricoles avec usine assemblage.',
    productDescription: 'Drone hardware avec capteurs proprietaires.',
    businessModel: 'Vente unitaire hardware',
    rawSummary: 'Production hardware drones agricoles.',
  });
  const r = _internal.isApplicable(hw, MINIMAL_FIN);
  check('hardware pur -> not-applicable', r.level, 'not-applicable');
  check('shouldRun false', r.shouldRun, false);
}

console.log('\n=== Test 4 : isApplicable hardware avec couche cloud ===');
{
  const hw = mockExtraction({
    sector: 'Hardware',
    marketPitch: 'Drones agricoles avec plateforme SaaS cloud de gestion.',
    productDescription: 'Hardware plus API cloud SaaS proprietaire.',
  });
  const r = _internal.isApplicable(hw, MINIMAL_FIN);
  check('hardware avec cloud -> full', r.level, 'full');
}

console.log('\n=== Test 5 : sans BM ===');
{
  const r = _internal.isApplicable(mockExtraction({ businessModel: '' }), MINIMAL_FIN);
  check('sans BM -> not-applicable', r.level, 'not-applicable');
  check('shouldRun false', r.shouldRun, false);
}

console.log('\n=== Test 5b : pre-check sans financialData -> not-applicable ===');
{
  const r = _internal.isApplicable(mockExtraction(), null);
  check('sans financialData -> not-applicable', r.level, 'not-applicable');
  check('shouldRun false', r.shouldRun, false);
}

console.log('\n=== Test 6 : extractMoatSnapshot ===');
{
  const wrap = mockExtraction({
    marketPitch: 'Wrapper GPT-4 avec ChatGPT integration.',
    productDescription: 'Solution AI-native basee sur Claude et Gemini.',
  });
  const snap = _internal.extractMoatSnapshot(wrap);
  checkTrue('detecte GPT', snap.aiAttackSignals.includes('GPT'));
  checkTrue('detecte ChatGPT', snap.aiAttackSignals.includes('ChatGPT'));
  checkTrue('detecte Claude', snap.aiAttackSignals.includes('Claude'));
}

console.log('\n=== Test 7 : extractMoatSnapshot avec moats ===');
{
  const moaty = mockExtraction({
    marketPitch: 'Plateforme avec network effect et donnees proprietaires.',
    productDescription: 'Switching costs eleves et brand reconnu.',
  });
  const snap = _internal.extractMoatSnapshot(moaty);
  checkTrue('detecte network effect', snap.moatClaims.includes('network effect'));
  checkTrue('detecte donnees proprietaires', snap.moatClaims.includes('donnees proprietaires'));
  checkTrue('detecte switching cost', snap.moatClaims.some((k) => k.includes('switching cost')));
  checkTrue('detecte brand', snap.moatClaims.includes('brand'));
}

console.log('\n=== Test 8 : buildUserPrompt structure ===');
{
  const input: PatternInput = { extraction: mockExtraction({ marketPitch: 'Wrapper GPT-4 sans differenciation.' }) };
  const p = _internal.buildUserPrompt(input);
  checkTrue('mentionne entreprise', p.includes('TestCo'));
  checkTrue('mentionne signaux IA', p.includes('GPT'));
  checkTrue('contient SIGNAUX DEFENSIBILITE', p.includes('SIGNAUX DEFENSIBILITE'));
}

console.log('\n=== Test 9 : llmOutputToPatternOutput ===');
{
  const mockRaw = {
    applicabilite: 'full' as const,
    applicabiliteRationale: 'SaaS knowledge work cognitif.',
    axis1: { score: 75, verdict: 'alerte' as const, rationale: 'Monomoat UI complexe sans cumul.', evidencePro: ['[pitch] un seul moat declare UI'], evidenceContra: [], confidence: 80 },
    axis2: { score: 80, verdict: 'drapeau-rouge' as const, rationale: 'Categorie attaquee par Cursor et v0.', evidencePro: ['[web] Cursor leve 100M', '[web] v0 lance 2024'], evidenceContra: [], confidence: 85 },
    axis3: { score: 65, verdict: 'alerte' as const, rationale: 'Aucun plan reconstruction moats.', evidencePro: ['[pitch] absence plan'], evidenceContra: [], confidence: 70 },
    globalScore: 73,
    verdict: 'alerte' as const,
    resumeEditorial: 'Profil de wrapper sans cumul de moats face a IA-native.',
    counterArchetype: { closest: 'Chegg', direction: 'derive-confirmee' as const, rationale: 'Profil similaire a Chegg pre-effondrement.' },
    recommandationDD: 'Demander analyse comparative avec deux IA-native challengers.',
  };
  const out = _internal.llmOutputToPatternOutput(mockRaw);
  check('patternId correct', out.patternId, 'commoditization-drift');
  check('globalScore preserve', out.globalScore, 73);
  check('counterArchetype Chegg', out.counterArchetype.closest, 'Chegg');
  checkTrue('claimsChiffres extraits', out.auditTrail.claimsChiffres.length > 0);
}

console.log('\n=== Test 10 : SYSTEM_PROMPT doctrinal ===');
{
  const sp = _internal.SYSTEM_PROMPT;
  checkTrue('mentionne axe 1 nature moats', sp.toLowerCase().includes('axe 1') && sp.toLowerCase().includes('moats'));
  checkTrue('mentionne axe 2 dereliction techno', sp.toLowerCase().includes('axe 2') && sp.toLowerCase().includes('dereliction'));
  checkTrue('mentionne axe 3 reconstruire', sp.toLowerCase().includes('axe 3') && sp.toLowerCase().includes('reconstruire'));
  checkTrue('mentionne Chegg confirme', sp.includes('Chegg'));
  checkTrue('mentionne Stripe Salesforce sains', sp.includes('Stripe') && sp.includes('Salesforce'));
  checkTrue('mentionne Bloomberg', sp.includes('Bloomberg'));
  checkTrue('mentionne distinction monomoats', sp.toLowerCase().includes('monomoats'));
  checkTrue('contrainte coherence', sp.includes('CONTRAINTE DE COHERENCE'));
}

console.log('\n=== Test 11 : KEYWORDS calibres ===');
{
  checkTrue('GPT dans AI_ATTACK_KEYWORDS', _internal.AI_ATTACK_KEYWORDS.includes('GPT'));
  checkTrue('Claude dans AI_ATTACK_KEYWORDS', _internal.AI_ATTACK_KEYWORDS.includes('Claude'));
  checkTrue('Cursor dans AI_ATTACK_KEYWORDS', _internal.AI_ATTACK_KEYWORDS.includes('Cursor'));
  checkTrue('network effect dans MOAT_KEYWORDS', _internal.MOAT_KEYWORDS.includes('network effect'));
  checkTrue('donnees proprietaires dans MOAT_KEYWORDS', _internal.MOAT_KEYWORDS.includes('donnees proprietaires'));
}

console.log('\n=== Test 12 : gating axe 1 (axe central Commoditization Drift) ===');
{
  const naAxis = {
    score: 0, verdict: 'non-applicable' as const,
    rationale: 'Aucun moat actuel identifiable.',
    evidencePro: [], evidenceContra: [], confidence: 0,
  };
  const inflated: PatternAnalysisOutput = {
    patternId: 'commoditization-drift',
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
