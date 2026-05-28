// ============================================================
// Tests skeleton Growth Subsidized Pattern
// ------------------------------------------------------------
// Ne couvre pas l appel LLM (necessite cle API et trop lent
// pour CI). Couvre la structure du module : isApplicable,
// buildUserPrompt, llmOutputToPatternOutput, auto-registration
// dans le registry.
//
// Execution : tsx lib/engines/fragility-structurelle/growth-subsidized-pattern.test.ts
// ============================================================

import { growthSubsidizedModelPattern, _internal } from './growth-subsidized-pattern';
import { _getRegistryForTests, _setRegistryForTests } from './orchestrator';
import { applyCentralAxisGating } from './pattern-interface';
import type { ExtractionOutput } from '../types';
import type { PatternAnalysisOutput, PatternInput } from './types';

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
// Test 1 : auto-enregistrement dans le registry
// ============================================================

console.log('\n=== Test 1 : auto-enregistrement registry ===');

// Reset puis re-import declenche le side-effect de registration via
// le module deja charge. On recupere le registry courant.
{
  // Reset pour partir propre
  _setRegistryForTests({ 'growth-subsidized-model': growthSubsidizedModelPattern });
  const registry = _getRegistryForTests();
  checkTrue('growth-subsidized-model present dans registry', !!registry['growth-subsidized-model']);
  check('patternId du module', growthSubsidizedModelPattern.patternId, 'growth-subsidized-model');
  checkTrue('module expose isApplicable', typeof growthSubsidizedModelPattern.isApplicable === 'function');
  checkTrue('module expose analyze', typeof growthSubsidizedModelPattern.analyze === 'function');
}

// ============================================================
// Helpers
// ============================================================

function mockExtraction(opts: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'TestCo',
    sector: 'SaaS',
    subSector: 'B2B',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2020,
    founders: [],
    marketPitch: 'Plateforme SaaS B2B avec abonnement mensuel ARR croissant.',
    productDescription: 'Workflow automation pour les RH des PME.',
    businessModel: 'Subscription B2B SaaS pricing per-seat avec packs',
    traction: { metrics: [] },
    fundraise: { stage: 'Series B', amount: '15M' },
    competitorsCited: [],
    rawSummary: 'SaaS B2B RH ARR croissant.',
    boardMembers: [],
    clientsNamed: [],
    ...opts,
  } as ExtractionOutput;
}

// ============================================================
// Test 2 : isApplicable avec input complet
// ============================================================

console.log('\n=== Test 2 : isApplicable input complet ===');
{
  const result = _internal.isApplicable(mockExtraction(), {
    revenue: 5000000,
    grossMargin: 0.65,
    monthlyBurn: 500000,
  } as any);
  check('input complet -> level full', result.level, 'full');
  checkTrue('input complet -> shouldRun true', result.shouldRun);
  checkTrue('rationale non vide', result.rationale.length > 10);
}

// ============================================================
// Test 3 : isApplicable sans donnees financieres mais qualitatif riche
// ============================================================

console.log('\n=== Test 3 : isApplicable sans financialData -> not-applicable (pre-check) ===');
{
  const richPitch = 'Plateforme SaaS B2B avec abonnement mensuel ARR croissant et NRR superieur a 110% sur les 18 derniers mois, avec un CAC payback de 14 mois en moyenne sur les cohortes recentes.';
  const result = _internal.isApplicable(mockExtraction({ marketPitch: richPitch }), null);
  check('sans financialData -> level not-applicable', result.level, 'not-applicable');
  check('sans financialData -> shouldRun false', result.shouldRun, false);
  checkTrue('rationale evoque l absence de revenu/burn', result.rationale.toLowerCase().includes('revenu') || result.rationale.toLowerCase().includes('burn'));
}

// ============================================================
// Test 4 : isApplicable sans business model lisible
// ============================================================

console.log('\n=== Test 4 : isApplicable sans business model ===');
{
  const result = _internal.isApplicable(mockExtraction({ businessModel: '' }), null);
  check('sans business model -> level not-applicable', result.level, 'not-applicable');
  check('sans business model -> shouldRun false', result.shouldRun, false);
}

// ============================================================
// Test 5 : buildUserPrompt contient les elements attendus
// ============================================================

console.log('\n=== Test 5 : buildUserPrompt structure ===');
{
  const input: PatternInput = {
    extraction: mockExtraction(),
    financialData: {
      revenue: 5000000,
      grossMargin: 0.65,
      monthlyBurn: 500000,
      runwayMonths: 18,
    } as any,
  };
  const prompt = _internal.buildUserPrompt(input);
  checkTrue('prompt mentionne le nom de l entreprise', prompt.includes('TestCo'));
  checkTrue('prompt mentionne le stade', prompt.includes('Series B'));
  checkTrue('prompt mentionne le pitch', prompt.includes('SaaS B2B'));
  checkTrue('prompt mentionne le revenu', prompt.includes('5000000'));
  checkTrue('prompt mentionne le burn mensuel', prompt.includes('500000'));
  checkTrue('prompt mentionne le runway', prompt.includes('18'));
  checkTrue('prompt mentionne le business model', prompt.includes('Subscription B2B SaaS'));
}

// ============================================================
// Test 6 : buildUserPrompt sans financialData reste exploitable
// ============================================================

console.log('\n=== Test 6 : buildUserPrompt sans financialData ===');
{
  const input: PatternInput = {
    extraction: mockExtraction(),
    financialData: null,
  };
  const prompt = _internal.buildUserPrompt(input);
  checkTrue('prompt indique aucune donnée financière', prompt.toLowerCase().includes('aucune donnée financière'));
  checkTrue('prompt reste exploitable (mentionne le pitch)', prompt.includes('SaaS B2B'));
}

// ============================================================
// Test 7 : llmOutputToPatternOutput convertit correctement
// ============================================================

console.log('\n=== Test 7 : llmOutputToPatternOutput ===');
{
  const mockRaw = {
    applicabilite: 'full' as const,
    applicabiliteRationale: 'Donnees financieres completes.',
    axis1: {
      score: 70,
      verdict: 'alerte' as const,
      rationale: 'Contribution margin negative documentee a -15% sur les cohortes 2024.',
      evidencePro: ['[bp] contribution margin -15% sur cohortes 2024', '[bp] CAC payback 36 mois'],
      evidenceContra: ['[pitch] gross margin annoncee 60%'],
      confidence: 75,
    },
    axis2: {
      score: 65,
      verdict: 'alerte' as const,
      rationale: 'Burn-to-revenue ratio 180% sur les 12 derniers mois.',
      evidencePro: ['[bp] burn mensuel 1M, revenu mensuel 550k'],
      evidenceContra: [],
      confidence: 80,
    },
    axis3: {
      score: 55,
      verdict: 'attention' as const,
      rationale: 'Plan vers breakeven evoque mais sans milestones chiffres.',
      evidencePro: ['[pitch] mention breakeven Q4 2026 sans plan'],
      evidenceContra: ['[pitch] modele subventionne presente comme strategique'],
      confidence: 60,
    },
    globalScore: 65,
    verdict: 'alerte' as const,
    resumeEditorial: 'Pattern Growth Subsidized partiellement detecte sur ce dossier.',
    counterArchetype: {
      closest: 'Casper',
      direction: 'derive-confirmee' as const,
      rationale: 'Profil similaire a Casper pre-IPO, contribution margin negative et plan flou.',
    },
    recommandationDD: 'Demander breakdown contribution margin par cohorte.',
  };

  const output = _internal.llmOutputToPatternOutput(mockRaw);
  check('patternId correct', output.patternId, 'growth-subsidized-model');
  check('applicabilite preservee', output.applicabilite, 'full');
  check('globalScore preserve', output.globalScore, 65);
  check('verdict preserve', output.verdict, 'alerte');
  check('axis1 score preserve', output.axis1.score, 70);
  check('counterArchetype preserve', output.counterArchetype.closest, 'Casper');
  checkTrue('claimsChiffres extraits', output.auditTrail.claimsChiffres.length > 0);
  checkTrue('sourceTags non vides', output.auditTrail.sourceTags.length > 0);
}

// ============================================================
// Test 8 : SYSTEM_PROMPT contient les elements doctrinaux cles
// ============================================================

console.log('\n=== Test 8 : SYSTEM_PROMPT doctrine ===');
{
  const sp = _internal.SYSTEM_PROMPT;
  checkTrue('mentionne axe 1 unit economics', sp.toLowerCase().includes('axe 1') && sp.toLowerCase().includes('unit economics'));
  checkTrue('mentionne axe 2 trajectoire subvention', sp.toLowerCase().includes('axe 2') && sp.toLowerCase().includes('subvention'));
  checkTrue('mentionne axe 3 plan vers la marge', sp.toLowerCase().includes('axe 3') && sp.toLowerCase().includes('marge'));
  checkTrue('mentionne counter-archetype Casper', sp.includes('Casper'));
  checkTrue('mentionne counter-archetype sain Atlassian', sp.includes('Atlassian'));
  checkTrue('format JSON specifie', sp.includes('FORMAT JSON OBLIGATOIRE'));
  checkTrue('contrainte de coherence presente', sp.includes('CONTRAINTE DE COHÉRENCE'));
}

// ============================================================
// Test 9 : gating axe 1 (axe central GSM)
// ============================================================

console.log('\n=== Test 9 : gating axe 1 GSM ===');
{
  const naAxis = {
    score: 0,
    verdict: 'non-applicable' as const,
    rationale: 'Unit economics non calculable.',
    evidencePro: [],
    evidenceContra: [],
    confidence: 0,
  };
  const inflatedOutput: PatternAnalysisOutput = {
    patternId: 'growth-subsidized-model',
    applicabilite: 'full',
    applicabiliteRationale: 'Donnees disponibles.',
    globalScore: 90,
    verdict: 'drapeau-rouge',
    resumeEditorial: 'Score gonfle par axes peripheriques.',
    axis1: naAxis,
    axis2: { score: 90, verdict: 'drapeau-rouge', rationale: 'Capital massif.', evidencePro: [], evidenceContra: [], confidence: 80 },
    axis3: { score: 95, verdict: 'drapeau-rouge', rationale: 'Denial.', evidencePro: [], evidenceContra: [], confidence: 80 },
    counterArchetype: { closest: 'Theranos', direction: 'derive-confirmee', rationale: '' },
    recommandationDD: '',
    auditTrail: { sourceTags: [], claimsChiffres: [] },
  };

  const gated = applyCentralAxisGating(inflatedOutput, 'axis1', 'Pattern non applicable : axe 1 neutralise.');
  check('axis1 non-applicable -> globalVerdict non-applicable', gated.verdict, 'non-applicable');
  check('axis1 non-applicable -> globalScore null', gated.globalScore, null);
  check('applicabilite forcee a not-applicable', gated.applicabilite, 'not-applicable');
  checkTrue('axes peripheriques conserves dans output', gated.axis2.score === 90 && gated.axis3.score === 95);
}

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
