import { scaleMirageRiskPattern, _internal } from './scale-mirage-risk-pattern';
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
  _setRegistryForTests({ 'scale-mirage-risk': scaleMirageRiskPattern });
  checkTrue('present dans registry', !!_getRegistryForTests()['scale-mirage-risk']);
  check('patternId correct', scaleMirageRiskPattern.patternId, 'scale-mirage-risk');
}

function mockHardware(opts: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'TestHwCo', sector: 'Deeptech', subSector: 'Hardware',
    geographicHub: 'Grenoble', country: 'France', yearFounded: 2018,
    founders: [],
    marketPitch: 'Production industrielle hardware avec usine assemblage France.',
    productDescription: 'Drone hardware avec capteurs proprietaires capex usine 50M.',
    businessModel: 'Vente unitaire hardware industriel',
    traction: { metrics: [] },
    fundraise: { stage: 'Series B', amount: '20M' },
    competitorsCited: [], rawSummary: 'Production hardware industrielle drones.',
    boardMembers: [], clientsNamed: [],
    ...opts,
  } as ExtractionOutput;
}

function mockSaas(opts: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'TestSaasCo', sector: 'SaaS', subSector: 'B2B',
    geographicHub: 'Paris', country: 'France', yearFounded: 2020,
    founders: [],
    marketPitch: 'SaaS B2B cloud abonnement mensuel.',
    productDescription: 'Workflow automation cloud.',
    businessModel: 'Subscription B2B SaaS',
    traction: { metrics: [] },
    fundraise: { stage: 'Series B', amount: '20M' },
    competitorsCited: [], rawSummary: 'SaaS B2B cloud abonnement.',
    boardMembers: [], clientsNamed: [],
    ...opts,
  } as ExtractionOutput;
}

console.log('\n=== Test 2 : isApplicable hardware deeptech Series B ===');
{
  const r = _internal.isApplicable(mockHardware(), MINIMAL_FIN);
  check('hardware Series B -> full', r.level, 'full');
  checkTrue('shouldRun true', r.shouldRun);
}

console.log('\n=== Test 3 : isApplicable hardware Series A ===');
{
  const r = _internal.isApplicable(mockHardware({ fundraise: { stage: 'Series A', amount: '8M' } }), MINIMAL_FIN);
  check('hardware Series A -> full', r.level, 'full');
}

console.log('\n=== Test 4 : isApplicable hardware Seed ===');
{
  const r = _internal.isApplicable(mockHardware({ fundraise: { stage: 'Seed', amount: '2M' } }), MINIMAL_FIN);
  check('hardware seed -> partial', r.level, 'partial');
}

console.log('\n=== Test 5 : isApplicable SaaS pure cloud ===');
{
  const r = _internal.isApplicable(mockSaas(), MINIMAL_FIN);
  check('SaaS pure -> not-applicable', r.level, 'not-applicable');
  check('shouldRun false', r.shouldRun, false);
}

console.log('\n=== Test 6 : isApplicable sans BM ===');
{
  const r = _internal.isApplicable(mockHardware({ businessModel: '' }), MINIMAL_FIN);
  check('sans BM -> not-applicable', r.level, 'not-applicable');
  check('shouldRun false', r.shouldRun, false);
}

console.log('\n=== Test 6b : pre-check sans financialData -> not-applicable ===');
{
  const r = _internal.isApplicable(mockHardware(), null);
  check('sans financialData -> not-applicable', r.level, 'not-applicable');
  check('shouldRun false', r.shouldRun, false);
}

console.log('\n=== Test 7 : extractIndustrialSnapshot capex ===');
{
  const ynsect = mockHardware({
    marketPitch: 'Production proteine insectes avec usine industrielle Amiens 372M capex.',
    productDescription: 'Bioreacteurs gigafactory et lignes de production specialisees.',
    rawSummary: 'Industrialisation proteine insectes face demande B2B feed.',
  });
  const snap = _internal.extractIndustrialSnapshot(ynsect);
  checkTrue('detecte capex', snap.capexSignals.includes('capex'));
  checkTrue('detecte usine', snap.capexSignals.includes('usine'));
  checkTrue('detecte gigafactory', snap.capexSignals.includes('gigafactory'));
  checkTrue('detecte industrialisation', snap.capexSignals.includes('industrialisation'));
}

console.log('\n=== Test 8 : extractIndustrialSnapshot validation demande ===');
{
  const innovafeed = mockHardware({
    marketPitch: 'Production proteine insectes avec contrats offtake ADM securises.',
    productDescription: 'Backlog client et LOI signees pre-commande forte.',
  });
  const snap = _internal.extractIndustrialSnapshot(innovafeed);
  checkTrue('detecte contrat', snap.demandValidationSignals.includes('contrat'));
  checkTrue('detecte offtake', snap.demandValidationSignals.includes('offtake'));
  checkTrue('detecte LOI', snap.demandValidationSignals.includes('LOI'));
  checkTrue('detecte backlog', snap.demandValidationSignals.includes('backlog'));
}

console.log('\n=== Test 9 : buildUserPrompt structure ===');
{
  const input: PatternInput = {
    extraction: mockHardware({
      marketPitch: 'Gigafactory batteries 1Md capex sans contrats fermes OEMs.',
    }),
  };
  const p = _internal.buildUserPrompt(input);
  checkTrue('mentionne TestHwCo', p.includes('TestHwCo'));
  checkTrue('mentionne Series B', p.includes('Series B'));
  checkTrue('contient SIGNAUX INDUSTRIELS', p.includes('SIGNAUX INDUSTRIELS'));
  checkTrue('mentionne Ynsect vs Innovafeed', p.includes('Ynsect') && p.includes('Innovafeed'));
}

console.log('\n=== Test 10 : llmOutputToPatternOutput ===');
{
  const mockRaw = {
    applicabilite: 'full' as const,
    applicabiliteRationale: 'Hardware deeptech Series B avec capex significatif.',
    axis1: { score: 85, verdict: 'drapeau-rouge' as const, rationale: 'Ratio capex 25x revenu, couverture contrats fermes 10%.', evidencePro: ['[bp] capex 372M revenu 15M', '[contracts] 10% capacite couverte LOI'], evidenceContra: [], confidence: 90 },
    axis2: { score: 75, verdict: 'alerte' as const, rationale: 'TRL 7 au moment commitment, cout unitaire 200% au-dessus cible.', evidencePro: ['[tech] TRL 7 demonstration environnement representatif', '[bp] cout actuel 12 euros vs cible 4 euros'], evidenceContra: [], confidence: 80 },
    axis3: { score: 70, verdict: 'alerte' as const, rationale: 'Bioreacteurs ultra-specialises non reversibles.', evidencePro: ['[pitch] equipement dedie protein insectes uniquement'], evidenceContra: [], confidence: 75 },
    globalScore: 78,
    verdict: 'drapeau-rouge' as const,
    resumeEditorial: 'Profil Scale Mirage Risk proche d Ynsect 2024.',
    counterArchetype: { closest: 'Ynsect', direction: 'derive-confirmee' as const, rationale: 'Profil identique Ynsect pre-redressement.' },
    recommandationDD: 'Demander breakdown capex et exiger contrats clients en piece justificative.',
  };
  const out = _internal.llmOutputToPatternOutput(mockRaw);
  check('patternId correct', out.patternId, 'scale-mirage-risk');
  check('globalScore preserve', out.globalScore, 78);
  check('counterArchetype Ynsect', out.counterArchetype.closest, 'Ynsect');
  checkTrue('claimsChiffres extraits', out.auditTrail.claimsChiffres.length > 0);
}

console.log('\n=== Test 11 : SYSTEM_PROMPT doctrinal ===');
{
  const sp = _internal.SYSTEM_PROMPT;
  checkTrue('mentionne axe 1 disproportion capex', sp.toLowerCase().includes('axe 1') && sp.toLowerCase().includes('disproportion'));
  checkTrue('mentionne axe 2 maturite', sp.toLowerCase().includes('axe 2') && sp.toLowerCase().includes('maturité'));
  checkTrue('mentionne axe 3 flexibilite', sp.toLowerCase().includes('axe 3') && sp.toLowerCase().includes('flexibilité'));
  checkTrue('mentionne Ynsect canonique', sp.includes('Ynsect'));
  checkTrue('mentionne Northvolt 2024', sp.includes('Northvolt'));
  checkTrue('mentionne Britishvolt', sp.includes('Britishvolt'));
  checkTrue('mentionne Tesla Innovafeed sains', sp.includes('Tesla') && sp.includes('Innovafeed'));
  checkTrue('contrainte coherence', sp.includes('CONTRAINTE DE COHÉRENCE'));
  checkTrue('format JSON', sp.includes('FORMAT JSON OBLIGATOIRE'));
}

console.log('\n=== Test 12 : KEYWORDS calibres ===');
{
  checkTrue('capex dans CAPEX_KEYWORDS', _internal.CAPEX_KEYWORDS.includes('capex'));
  checkTrue('gigafactory dans CAPEX_KEYWORDS', _internal.CAPEX_KEYWORDS.includes('gigafactory'));
  checkTrue('industrialisation dans CAPEX_KEYWORDS', _internal.CAPEX_KEYWORDS.includes('industrialisation'));
  checkTrue('offtake dans DEMAND_VALIDATION', _internal.DEMAND_VALIDATION_KEYWORDS.includes('offtake'));
  checkTrue('LOI dans DEMAND_VALIDATION', _internal.DEMAND_VALIDATION_KEYWORDS.includes('LOI'));
}

console.log('\n=== Test 13 : gating axe 1 (axe central Scale Mirage Risk) ===');
{
  const naAxis = {
    score: 0, verdict: 'non-applicable' as const,
    rationale: 'Pas de capex industriel chiffre.',
    evidencePro: [], evidenceContra: [], confidence: 0,
  };
  const inflated: PatternAnalysisOutput = {
    patternId: 'scale-mirage-risk',
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
