// ============================================================
// Tests skeleton Infrastructure Hostage Pattern
// ------------------------------------------------------------
// Couvre la structure du module : isApplicable,
// extractStackSnapshot, buildUserPrompt,
// llmOutputToPatternOutput, auto-registration.
//
// Execution : tsx lib/engines/fragility-structurelle/infrastructure-hostage-pattern.test.ts
// ============================================================

import { infrastructureHostagePattern, _internal } from './infrastructure-hostage-pattern';
import { _getRegistryForTests, _setRegistryForTests } from './orchestrator';
import { applyCentralAxisGating } from './pattern-interface';
import type { ExtractionOutput } from '../types';
import type { PatternAnalysisOutput, PatternInput } from './types';

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

// ============================================================
// Test 1 : module structure et registry
// ============================================================

console.log('\n=== Test 1 : module structure ===');
{
  _setRegistryForTests({ 'infrastructure-hostage': infrastructureHostagePattern });
  const registry = _getRegistryForTests();
  checkTrue('present dans registry', !!registry['infrastructure-hostage']);
  check('patternId correct', infrastructureHostagePattern.patternId, 'infrastructure-hostage');
  checkTrue('expose isApplicable', typeof infrastructureHostagePattern.isApplicable === 'function');
  checkTrue('expose analyze', typeof infrastructureHostagePattern.analyze === 'function');
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
    marketPitch: 'Plateforme SaaS B2B avec abonnement mensuel.',
    productDescription: 'Workflow automation pour les equipes RH.',
    businessModel: 'Subscription B2B SaaS pricing per-seat',
    traction: { metrics: [] },
    fundraise: { stage: 'Series A', amount: '8M' },
    competitorsCited: [],
    rawSummary: 'SaaS B2B RH avec abonnement mensuel.',
    boardMembers: [],
    clientsNamed: [],
    ...opts,
  } as ExtractionOutput;
}

// ============================================================
// Test 2 : isApplicable input complet
// ============================================================

console.log('\n=== Test 2 : isApplicable SaaS standard ===');
{
  const result = _internal.isApplicable(mockExtraction(), MINIMAL_FIN);
  check('SaaS Series A -> level full', result.level, 'full');
  checkTrue('shouldRun true', result.shouldRun);
}

// ============================================================
// Test 3 : isApplicable hardware physique pur
// ============================================================

console.log('\n=== Test 3 : isApplicable hardware physique ===');
{
  const hardware = mockExtraction({
    sector: 'Hardware',
    marketPitch: 'Production de drones agricoles industriels avec composants semi-conducteurs et chaine assemblage.',
    productDescription: 'Drone hardware avec capteurs proprietaires, assemblage en usine dediee.',
    businessModel: 'Vente unitaire hardware industriel',
    rawSummary: 'Production hardware industrielle drones agricoles, chaine assemblage France.',
  });
  const result = _internal.isApplicable(hardware, MINIMAL_FIN);
  check('hardware pur -> partial', result.level, 'partial');
  checkTrue('shouldRun true (lecture limitee)', result.shouldRun);
}

// ============================================================
// Test 4 : isApplicable hardware avec couche software
// ============================================================

console.log('\n=== Test 4 : isApplicable hardware avec API/cloud ===');
{
  const hardwareSoft = mockExtraction({
    sector: 'Hardware',
    marketPitch: 'Drones agricoles avec API cloud de gestion de flotte et plateforme SaaS.',
    productDescription: 'Drone hardware plus plateforme cloud SaaS proprietaire pour exploitation des donnees.',
  });
  const result = _internal.isApplicable(hardwareSoft, MINIMAL_FIN);
  check('hardware avec couche software -> full', result.level, 'full');
}

// ============================================================
// Test 5 : isApplicable sans business model
// ============================================================

console.log('\n=== Test 5 : isApplicable sans BM ni produit ===');
{
  const result = _internal.isApplicable(
    mockExtraction({ businessModel: '', productDescription: '' }),
    MINIMAL_FIN,
  );
  check('sans BM ni produit -> not-applicable', result.level, 'not-applicable');
  check('shouldRun false', result.shouldRun, false);
}

console.log('\n=== Test 5b : pre-check sans financialData -> not-applicable ===');
{
  const result = _internal.isApplicable(mockExtraction(), null);
  check('sans financialData -> not-applicable', result.level, 'not-applicable');
  check('shouldRun false', result.shouldRun, false);
}

// ============================================================
// Test 6 : extractStackSnapshot detecte les fournisseurs
// ============================================================

console.log('\n=== Test 6 : extractStackSnapshot ===');
{
  const wrapperGPT = mockExtraction({
    marketPitch: 'Wrapper IA construit sur OpenAI et Anthropic, deploye sur AWS avec Stripe pour le paiement.',
    productDescription: 'Application chatbot utilisant GPT-4 via API OpenAI, hebergee sur AWS Lambda.',
  });
  const snap = _internal.extractStackSnapshot(wrapperGPT);
  checkTrue('detecte OpenAI', snap.vendorMentions.includes('OpenAI'));
  checkTrue('detecte Anthropic', snap.vendorMentions.includes('Anthropic'));
  checkTrue('detecte AWS', snap.vendorMentions.includes('AWS'));
  checkTrue('detecte Stripe', snap.vendorMentions.includes('Stripe'));
  check('aucun signal portabilite', snap.portabilitySignals.length, 0);
}

// ============================================================
// Test 7 : extractStackSnapshot detecte les signaux portabilite
// ============================================================

console.log('\n=== Test 7 : extractStackSnapshot avec portabilite ===');
{
  const portable = mockExtraction({
    marketPitch: 'Plateforme SaaS multi-cloud deployable on-premise via Kubernetes vanilla.',
    productDescription: 'Architecture portable basee sur des modeles open-weight self-hosted, sans verrouillage cloud.',
  });
  const snap = _internal.extractStackSnapshot(portable);
  checkTrue('detecte multi-cloud', snap.portabilitySignals.includes('multi-cloud'));
  checkTrue('detecte kubernetes', snap.portabilitySignals.includes('kubernetes'));
  checkTrue('detecte on-premise', snap.portabilitySignals.includes('on-premise') || snap.portabilitySignals.includes('on premise'));
  checkTrue('detecte open-weight', snap.portabilitySignals.includes('open-weight') || snap.portabilitySignals.includes('open weight'));
  checkTrue('detecte self-hosted', snap.portabilitySignals.includes('self-hosted'));
}

// ============================================================
// Test 8 : buildUserPrompt structure
// ============================================================

console.log('\n=== Test 8 : buildUserPrompt structure ===');
{
  const input: PatternInput = {
    extraction: mockExtraction({
      marketPitch: 'Wrapper IA construit sur OpenAI deploye sur AWS.',
    }),
  };
  const prompt = _internal.buildUserPrompt(input);
  checkTrue('mentionne le nom de l entreprise', prompt.includes('TestCo'));
  checkTrue('mentionne le stade Series A', prompt.includes('Series A'));
  checkTrue('mentionne OpenAI dans signaux pre-screen', prompt.includes('OpenAI'));
  checkTrue('mentionne AWS dans signaux pre-screen', prompt.includes('AWS'));
  checkTrue('contient SIGNAUX INFRASTRUCTURE', prompt.includes('SIGNAUX INFRASTRUCTURE'));
}

// ============================================================
// Test 9 : llmOutputToPatternOutput conversion
// ============================================================

console.log('\n=== Test 9 : llmOutputToPatternOutput ===');
{
  const mockRaw = {
    applicabilite: 'full' as const,
    applicabiliteRationale: 'SaaS Series A avec stack lisible.',
    axis1: {
      score: 80,
      verdict: 'drapeau-rouge' as const,
      rationale: 'Wrapper GPT pure-play avec 90% du COGS technique sur OpenAI.',
      evidencePro: ['[pitch] dependance OpenAI 90% COGS technique', '[bp] aucun second fournisseur LLM'],
      evidenceContra: [],
      confidence: 80,
    },
    axis2: {
      score: 75,
      verdict: 'alerte' as const,
      rationale: 'OpenAI 200x la taille de la cible et a deja cannibalise des wrappers en 2023.',
      evidencePro: ['[web] OpenAI baisse prix 80% en 2023', '[web] integration ChatGPT cannibalise wrappers'],
      evidenceContra: [],
      confidence: 85,
    },
    axis3: {
      score: 70,
      verdict: 'alerte' as const,
      rationale: 'Aucun plan de portabilite, architecture lock-in OpenAI uniquement.',
      evidencePro: ['[pitch] aucun plan multi-LLM mentionne'],
      evidenceContra: [],
      confidence: 75,
    },
    globalScore: 75,
    verdict: 'drapeau-rouge' as const,
    resumeEditorial: 'Profil wrapper GPT classique avec captivite OpenAI maximale.',
    counterArchetype: {
      closest: 'Jasper',
      direction: 'derive-confirmee' as const,
      rationale: 'Profil identique a Jasper en 2023 avant l effondrement de valorisation.',
    },
    recommandationDD: 'Demander plan de portabilite multi-LLM avec milestones chiffres.',
  };

  const output = _internal.llmOutputToPatternOutput(mockRaw);
  check('patternId correct', output.patternId, 'infrastructure-hostage');
  check('applicabilite preservee', output.applicabilite, 'full');
  check('globalScore preserve', output.globalScore, 75);
  check('verdict preserve', output.verdict, 'drapeau-rouge');
  check('counterArchetype Jasper', output.counterArchetype.closest, 'Jasper');
  checkTrue('claimsChiffres extraits', output.auditTrail.claimsChiffres.length > 0);
}

// ============================================================
// Test 10 : SYSTEM_PROMPT doctrinal
// ============================================================

console.log('\n=== Test 10 : SYSTEM_PROMPT doctrinal ===');
{
  const sp = _internal.SYSTEM_PROMPT;
  checkTrue('mentionne axe 1 intensite dependance', sp.toLowerCase().includes('axe 1') && sp.toLowerCase().includes('dépendance'));
  checkTrue('mentionne axe 2 pouvoir de marche', sp.toLowerCase().includes('axe 2') && sp.toLowerCase().includes('pouvoir'));
  checkTrue('mentionne axe 3 deverrouillage', sp.toLowerCase().includes('axe 3') && sp.toLowerCase().includes('déverrouillage'));
  checkTrue('mentionne Jasper et Copy.ai', sp.includes('Jasper') && sp.includes('Copy.ai'));
  checkTrue('mentionne Stripe Salesforce sains', sp.includes('Salesforce') && sp.includes('Stripe'));
  checkTrue('mentionne contrainte coherence', sp.includes('CONTRAINTE DE COHÉRENCE'));
  checkTrue('mentionne specificite wrappers LLM', sp.includes('SPÉCIFICITÉ WRAPPERS LLM'));
  checkTrue('format JSON specifie', sp.includes('FORMAT JSON OBLIGATOIRE'));
}

// ============================================================
// Test 11 : KNOWN_VENDORS et PORTABILITY_KEYWORDS sont calibres
// ============================================================

console.log('\n=== Test 11 : KNOWN_VENDORS et PORTABILITY_KEYWORDS ===');
{
  // Les fournisseurs critiques de l ere IA doivent etre presents
  checkTrue('OpenAI dans KNOWN_VENDORS', _internal.KNOWN_VENDORS.includes('OpenAI'));
  checkTrue('Anthropic dans KNOWN_VENDORS', _internal.KNOWN_VENDORS.includes('Anthropic'));
  checkTrue('AWS dans KNOWN_VENDORS', _internal.KNOWN_VENDORS.includes('AWS'));
  checkTrue('Nvidia dans KNOWN_VENDORS', _internal.KNOWN_VENDORS.includes('Nvidia'));
  checkTrue('Stripe dans KNOWN_VENDORS', _internal.KNOWN_VENDORS.includes('Stripe'));

  // Mots-cles portabilite cles
  checkTrue('multi-cloud dans PORTABILITY_KEYWORDS', _internal.PORTABILITY_KEYWORDS.includes('multi-cloud'));
  checkTrue('kubernetes dans PORTABILITY_KEYWORDS', _internal.PORTABILITY_KEYWORDS.includes('kubernetes'));
  checkTrue('open-source dans PORTABILITY_KEYWORDS', _internal.PORTABILITY_KEYWORDS.includes('open-source'));
}

// ============================================================
// Test 12 : gating axe 1 (axe central Infrastructure Hostage)
// ============================================================

console.log('\n=== Test 12 : gating axe 1 Infrastructure Hostage ===');
{
  const naAxis = {
    score: 0,
    verdict: 'non-applicable' as const,
    rationale: 'Stack technique non identifiable.',
    evidencePro: [],
    evidenceContra: [],
    confidence: 0,
  };
  const inflated: PatternAnalysisOutput = {
    patternId: 'infrastructure-hostage',
    applicabilite: 'full',
    applicabiliteRationale: '',
    globalScore: 75,
    verdict: 'drapeau-rouge',
    resumeEditorial: '',
    axis1: naAxis,
    axis2: { score: 80, verdict: 'drapeau-rouge', rationale: '', evidencePro: [], evidenceContra: [], confidence: 80 },
    axis3: { score: 70, verdict: 'alerte', rationale: '', evidencePro: [], evidenceContra: [], confidence: 75 },
    counterArchetype: { closest: 'Jasper', direction: 'derive-confirmee', rationale: '' },
    recommandationDD: '',
    auditTrail: { sourceTags: [], claimsChiffres: [] },
  };
  const gated = applyCentralAxisGating(inflated, 'axis1', 'Pattern non applicable : axe 1 neutralise.');
  check('axis1 non-applicable -> verdict non-applicable', gated.verdict, 'non-applicable');
  check('axis1 non-applicable -> globalScore null', gated.globalScore, null);
  check('applicabilite forcee', gated.applicabilite, 'not-applicable');
}

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
