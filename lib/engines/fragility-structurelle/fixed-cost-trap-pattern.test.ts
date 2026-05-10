// ============================================================
// Tests skeleton Fixed Cost Trap Pattern
// ------------------------------------------------------------
// Execution : tsx lib/engines/fragility-structurelle/fixed-cost-trap-pattern.test.ts
// ============================================================

import { fixedCostTrapPattern, _internal } from './fixed-cost-trap-pattern';
import { _getRegistryForTests, _setRegistryForTests } from './orchestrator';
import { applyCentralAxisGating } from './pattern-interface';
import type { ExtractionOutput } from '../types';
import type { PatternAnalysisOutput, PatternInput } from './types';

// Donnees financieres minimales pour passer le pre-check universel
// (revenue ou burn requis depuis la doctrine de gating axe central).
const MINIMAL_FIN = { revenue: 5000000, monthlyBurn: 200000 } as any;

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

console.log('\n=== Test 1 : module structure ===');
{
  _setRegistryForTests({ 'fixed-cost-trap': fixedCostTrapPattern });
  const registry = _getRegistryForTests();
  checkTrue('present dans registry', !!registry['fixed-cost-trap']);
  check('patternId correct', fixedCostTrapPattern.patternId, 'fixed-cost-trap');
}

function mockExtraction(opts: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'TestCo',
    sector: 'SaaS',
    subSector: 'B2B',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2020,
    founders: [],
    marketPitch: 'Plateforme SaaS B2B avec abonnement mensuel.',
    productDescription: 'Workflow automation cloud.',
    businessModel: 'Subscription B2B SaaS pricing per-seat',
    traction: { metrics: [] },
    fundraise: { stage: 'Series B', amount: '20M' },
    competitorsCited: [],
    rawSummary: 'SaaS B2B cloud avec abonnement.',
    boardMembers: [],
    clientsNamed: [],
    ...opts,
  } as ExtractionOutput;
}

console.log('\n=== Test 2 : isApplicable SaaS pure cloud ===');
{
  const result = _internal.isApplicable(mockExtraction(), MINIMAL_FIN);
  check('SaaS pure cloud -> partial', result.level, 'partial');
  checkTrue('shouldRun true', result.shouldRun);
}

console.log('\n=== Test 3 : isApplicable real estate operationnel ===');
{
  const realEstate = mockExtraction({
    sector: 'Real estate',
    marketPitch: 'Plateforme de coworking avec reseau de bureaux operationnels en France.',
    productDescription: 'Espaces de bureaux flexibles loues a la place ou au mois.',
    businessModel: 'Location espaces bureaux',
    rawSummary: 'Operateur immobilier coworking France.',
  });
  const result = _internal.isApplicable(realEstate, MINIMAL_FIN);
  check('real estate -> full', result.level, 'full');
}

console.log('\n=== Test 4 : isApplicable hardware industriel ===');
{
  const hardware = mockExtraction({
    sector: 'Deeptech',
    marketPitch: 'Production industrielle de drones avec usine d assemblage en France.',
    productDescription: 'Drone hardware avec capteurs proprietaires, capex usine 50M.',
    businessModel: 'Vente unitaire hardware',
    rawSummary: 'Production hardware industrielle drones.',
  });
  const result = _internal.isApplicable(hardware, MINIMAL_FIN);
  check('hardware industriel -> full', result.level, 'full');
}

console.log('\n=== Test 5 : isApplicable seed sans signal asset-heavy ===');
{
  const seedSaas = mockExtraction({
    fundraise: { stage: 'Seed', amount: '1M' },
  });
  const result = _internal.isApplicable(seedSaas, MINIMAL_FIN);
  // SaaS pure cloud meme en seed = partial
  check('seed SaaS pure cloud -> partial', result.level, 'partial');
}

console.log('\n=== Test 6 : isApplicable sans business model ===');
{
  const result = _internal.isApplicable(mockExtraction({ businessModel: '' }), MINIMAL_FIN);
  check('sans BM -> not-applicable', result.level, 'not-applicable');
  check('shouldRun false', result.shouldRun, false);
}

console.log('\n=== Test 6b : pre-check sans financialData -> not-applicable ===');
{
  const result = _internal.isApplicable(mockExtraction(), null);
  check('sans financialData -> not-applicable', result.level, 'not-applicable');
  check('shouldRun false', result.shouldRun, false);
}

console.log('\n=== Test 7 : extractBurnSnapshot ===');
{
  const snap = _internal.extractBurnSnapshot({
    monthlyBurn: 1000000,
    runwayMonths: 12,
    totalCommitments: 50000000,
    capex: 20000000,
  } as any);
  check('monthlyBurn extrait', snap.monthlyBurn, 1000000);
  check('runway extrait', snap.runwayMonths, 12);
  check('totalCommitments extrait', snap.totalCommitments, 50000000);
  check('capex extrait', snap.capexCumulated, 20000000);
}

console.log('\n=== Test 8 : buildUserPrompt structure ===');
{
  const input: PatternInput = {
    extraction: mockExtraction({
      sector: 'Real estate',
      marketPitch: 'Coworking avec bureaux operationnels.',
    }),
    financialData: { monthlyBurn: 500000, runwayMonths: 18 } as any,
  };
  const prompt = _internal.buildUserPrompt(input);
  checkTrue('mentionne entreprise', prompt.includes('TestCo'));
  checkTrue('mentionne stade Series B', prompt.includes('Series B'));
  checkTrue('mentionne monthly burn', prompt.includes('500000'));
  checkTrue('mentionne runway', prompt.includes('18'));
  checkTrue('contient DONNEES BURN ET ENGAGEMENTS', prompt.includes('DONNEES BURN ET ENGAGEMENTS'));
}

console.log('\n=== Test 9 : llmOutputToPatternOutput ===');
{
  const mockRaw = {
    applicabilite: 'full' as const,
    applicabiliteRationale: 'Modele asset-heavy real estate.',
    axis1: {
      score: 75,
      verdict: 'alerte' as const,
      rationale: 'Burn locked 70% sur 12 mois, run-rate 18 mois en banque.',
      evidencePro: ['[bp] burn locked 70%', '[bp] runway 18 mois sans revenu'],
      evidenceContra: [],
      confidence: 80,
    },
    axis2: {
      score: 80,
      verdict: 'drapeau-rouge' as const,
      rationale: 'Off-balance ratio 12x revenu, duree moyenne 8 ans.',
      evidencePro: ['[comptes] engagements 240M pour 20M revenu', '[comptes] duree moyenne 8 ans'],
      evidenceContra: [],
      confidence: 85,
    },
    axis3: {
      score: 60,
      verdict: 'alerte' as const,
      rationale: 'Aucun downside scenario chiffre, pas de track record variabilisation.',
      evidencePro: ['[bp] absence downside scenario'],
      evidenceContra: [],
      confidence: 70,
    },
    globalScore: 72,
    verdict: 'alerte' as const,
    resumeEditorial: 'Profil Fixed Cost Trap proche de WeWork preIPO.',
    counterArchetype: {
      closest: 'WeWork',
      direction: 'derive-confirmee' as const,
      rationale: 'Profil similaire a WeWork avant 2019.',
    },
    recommandationDD: 'Demander breakdown engagements long terme et downside scenario.',
  };

  const output = _internal.llmOutputToPatternOutput(mockRaw);
  check('patternId correct', output.patternId, 'fixed-cost-trap');
  check('globalScore preserve', output.globalScore, 72);
  check('counterArchetype WeWork', output.counterArchetype.closest, 'WeWork');
  checkTrue('claimsChiffres extraits', output.auditTrail.claimsChiffres.length > 0);
}

console.log('\n=== Test 10 : SYSTEM_PROMPT doctrinal ===');
{
  const sp = _internal.SYSTEM_PROMPT;
  checkTrue('mentionne axe 1 ratio couts fixes', sp.toLowerCase().includes('axe 1') && sp.toLowerCase().includes('ratio'));
  checkTrue('mentionne axe 2 engagements long terme', sp.toLowerCase().includes('axe 2') && sp.toLowerCase().includes('engagements'));
  checkTrue('mentionne axe 3 elasticite', sp.toLowerCase().includes('axe 3') && sp.toLowerCase().includes('elasticite'));
  checkTrue('mentionne WeWork canonique', sp.includes('WeWork'));
  checkTrue('mentionne Airbnb asset-light', sp.includes('Airbnb'));
  checkTrue('format JSON specifie', sp.includes('FORMAT JSON OBLIGATOIRE'));
  checkTrue('contrainte coherence presente', sp.includes('CONTRAINTE DE COHERENCE'));
}

console.log('\n=== Test 11 : trois regles SYSTEM_PROMPT FCT ===');
{
  const sp = _internal.SYSTEM_PROMPT;
  checkTrue('regle gating axe central presente', sp.includes('GATING AXE CENTRAL'));
  checkTrue('regle plafond axe 2 presente', sp.includes('REGLE DE PLAFOND'));
  checkTrue('regle anti-contamination presente', sp.includes('ANTI-CONTAMINATION'));
  checkTrue('regle detection inversion presente', sp.includes("DETECTION D INVERSION"));
  checkTrue('mentionne MoviePass dans inversion', sp.includes('MoviePass'));
  checkTrue('mentionne seuil 1x ratio', sp.includes('1x'));
}

console.log('\n=== Test 12 : gating axe 2 (axe central FCT) ===');
{
  const naAxis = {
    score: 0,
    verdict: 'non-applicable' as const,
    rationale: 'Pas d engagements long terme contractuels identifiables.',
    evidencePro: [],
    evidenceContra: [],
    confidence: 0,
  };
  const inflatedOutput: PatternAnalysisOutput = {
    patternId: 'fixed-cost-trap',
    applicabilite: 'full',
    applicabiliteRationale: 'Donnees disponibles.',
    globalScore: 90,
    verdict: 'drapeau-rouge',
    resumeEditorial: 'Score gonfle par contamination GSM.',
    axis1: { score: 95, verdict: 'drapeau-rouge', rationale: 'Cout direct > revenu.', evidencePro: [], evidenceContra: [], confidence: 80 },
    axis2: naAxis,
    axis3: { score: 90, verdict: 'drapeau-rouge', rationale: 'Pas de downside plan.', evidencePro: [], evidenceContra: [], confidence: 80 },
    counterArchetype: { closest: 'MoviePass', direction: 'derive-confirmee', rationale: '' },
    recommandationDD: '',
    auditTrail: { sourceTags: [], claimsChiffres: [] },
  };

  const gated = applyCentralAxisGating(inflatedOutput, 'axis2', 'Pattern non applicable : axe 2 neutralise (pas d engagements long terme).');
  check('axis2 non-applicable -> globalVerdict non-applicable', gated.verdict, 'non-applicable');
  check('axis2 non-applicable -> globalScore null', gated.globalScore, null);
  check('applicabilite forcee a not-applicable', gated.applicabilite, 'not-applicable');
  checkTrue('axes peripheriques conserves dans output', gated.axis1.score === 95 && gated.axis3.score === 90);
}

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
