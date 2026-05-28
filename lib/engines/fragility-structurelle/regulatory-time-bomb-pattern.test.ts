// ============================================================
// Tests skeleton Regulatory Time Bomb Pattern
// ============================================================

import { regulatoryTimeBombPattern, _internal } from './regulatory-time-bomb-pattern';
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

console.log('\n=== Test 1 : module structure ===');
{
  _setRegistryForTests({ 'regulatory-time-bomb': regulatoryTimeBombPattern });
  const registry = _getRegistryForTests();
  checkTrue('present dans registry', !!registry['regulatory-time-bomb']);
  check('patternId correct', regulatoryTimeBombPattern.patternId, 'regulatory-time-bomb');
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
    productDescription: 'Workflow automation pour les equipes RH.',
    businessModel: 'Subscription B2B SaaS pricing per-seat',
    traction: { metrics: [] },
    fundraise: { stage: 'Series A', amount: '8M' },
    competitorsCited: [],
    rawSummary: 'SaaS B2B RH abonnement mensuel.',
    boardMembers: [],
    clientsNamed: [],
    ...opts,
  } as ExtractionOutput;
}

console.log('\n=== Test 2 : isApplicable SaaS B2B non regule ===');
{
  const result = _internal.isApplicable(mockExtraction(), MINIMAL_FIN);
  check('SaaS B2B RH -> not-applicable', result.level, 'not-applicable');
  check('shouldRun false', result.shouldRun, false);
}

console.log('\n=== Test 3 : isApplicable Fintech BNPL ===');
{
  const fintech = mockExtraction({
    sector: 'Fintech',
    marketPitch: 'Solution de paiement fractionne pour le e-commerce, partenariats banques credit consumer.',
    productDescription: 'API de paiement fractionne BNPL avec gestion risque credit.',
    businessModel: 'Commission sur transactions BNPL',
    rawSummary: 'Fintech BNPL e-commerce avec exposition CCD2.',
  });
  const result = _internal.isApplicable(fintech, MINIMAL_FIN);
  check('fintech BNPL -> full', result.level, 'full');
  checkTrue('rationale mentionne secteur regule', result.rationale.toLowerCase().includes('régulé') || result.rationale.toLowerCase().includes('réglementaire'));
}

console.log('\n=== Test 4 : isApplicable IA generative ===');
{
  const ai = mockExtraction({
    sector: 'AI',
    marketPitch: 'Plateforme AI Act compliant pour la generation de contenu enterprise.',
    productDescription: 'API LLM avec garde-fous compliance pour usages reglementes.',
    businessModel: 'Subscription API AI generative B2B',
    rawSummary: 'Solution IA generative en preparation AI Act europeen.',
  });
  const result = _internal.isApplicable(ai, MINIMAL_FIN);
  check('IA AI Act -> full', result.level, 'full');
}

console.log('\n=== Test 5 : isApplicable sans BM ===');
{
  const result = _internal.isApplicable(mockExtraction({ businessModel: '' }), MINIMAL_FIN);
  check('sans BM -> not-applicable', result.level, 'not-applicable');
  check('shouldRun false', result.shouldRun, false);
}

console.log('\n=== Test 5b : pre-check sans financialData -> not-applicable ===');
{
  const result = _internal.isApplicable(mockExtraction({
    sector: 'Fintech',
    marketPitch: 'BNPL paiement credit consumer.',
  }), null);
  check('sans financialData -> not-applicable', result.level, 'not-applicable');
  check('shouldRun false', result.shouldRun, false);
}

console.log('\n=== Test 6 : extractRegulatorySnapshot detecte secteurs regules ===');
{
  const fintech = mockExtraction({
    marketPitch: 'BNPL paiement credit consumer KYC AML compliance.',
    productDescription: 'API paiement avec lutte blanchiment et CCD2 anticipation.',
  });
  const snap = _internal.extractRegulatorySnapshot(fintech);
  checkTrue('detecte paiement', snap.reguleKeywords.includes('paiement'));
  checkTrue('detecte credit', snap.reguleKeywords.includes('credit'));
  checkTrue('detecte KYC', snap.reguleKeywords.some((k) => k.toLowerCase() === 'kyc'));
  checkTrue('detecte AML', snap.reguleKeywords.some((k) => k.toLowerCase() === 'aml'));
  checkTrue('detecte CCD2', snap.reguleKeywords.includes('CCD2'));
}

console.log('\n=== Test 7 : extractRegulatorySnapshot detecte signaux compliance ===');
{
  const compliant = mockExtraction({
    marketPitch: 'Fintech avec compliance officer dedie et DPO en interne.',
    productDescription: 'Solution paiement avec agrement etablissement paiement obtenu.',
  });
  const snap = _internal.extractRegulatorySnapshot(compliant);
  checkTrue('detecte compliance officer', snap.complianceSignals.includes('compliance officer'));
  checkTrue('detecte DPO', snap.complianceSignals.includes('DPO'));
  checkTrue('detecte agrement', snap.complianceSignals.includes('agrement'));
}

console.log('\n=== Test 8 : buildUserPrompt structure ===');
{
  const input: PatternInput = {
    extraction: mockExtraction({
      sector: 'Fintech',
      marketPitch: 'BNPL europeen avec credit consumer.',
      businessModel: 'Commission BNPL',
    }),
  };
  const prompt = _internal.buildUserPrompt(input);
  checkTrue('mentionne entreprise', prompt.includes('TestCo'));
  checkTrue('mentionne SIGNAUX RÉGLEMENTAIRES', prompt.includes('SIGNAUX RÉGLEMENTAIRES'));
  checkTrue('liste les sous-types a identifier', prompt.toLowerCase().includes('sous-type'));
}

console.log('\n=== Test 9 : llmOutputToPatternOutput ===');
{
  const mockRaw = {
    applicabilite: 'full' as const,
    applicabiliteRationale: 'Fintech BNPL en exposition CCD2.',
    axis1: {
      score: 80,
      verdict: 'drapeau-rouge' as const,
      rationale: 'Modele dependant de zone grise BNPL avant CCD2 entree novembre 2026.',
      evidencePro: ['[web] CCD2 entree en vigueur novembre 2026', '[pitch] modele BNPL non encore qualifie credit institution'],
      evidenceContra: [],
      confidence: 85,
    },
    axis2: {
      score: 90,
      verdict: 'drapeau-rouge' as const,
      rationale: 'Texte CCD2 publie 2023 contenu connu et date d entree fixee.',
      evidencePro: ['[eurlex] Directive CCD2 publiee 2023', '[news] application novembre 2026 confirmee'],
      evidenceContra: [],
      confidence: 95,
    },
    axis3: {
      score: 70,
      verdict: 'alerte' as const,
      rationale: 'Aucun compliance officer documente, aucun plan transition.',
      evidencePro: ['[pitch] absence compliance officer', '[bp] aucune ligne budgetaire compliance'],
      evidenceContra: [],
      confidence: 75,
    },
    globalScore: 80,
    verdict: 'drapeau-rouge' as const,
    resumeEditorial: 'Sous-type regulation a venir connue : BNPL face a CCD2 sans preparation.',
    counterArchetype: {
      closest: 'Klarna avant 2022',
      direction: 'derive-confirmee' as const,
      rationale: 'Mais Klarna a obtenu sa licence credit institution avant CCD2.',
    },
    recommandationDD: 'Demander roadmap CCD2 et budget compliance.',
  };

  const output = _internal.llmOutputToPatternOutput(mockRaw);
  check('patternId correct', output.patternId, 'regulatory-time-bomb');
  check('globalScore preserve', output.globalScore, 80);
  check('verdict drapeau-rouge', output.verdict, 'drapeau-rouge');
  checkTrue('claimsChiffres extraits', output.auditTrail.claimsChiffres.length > 0);
}

console.log('\n=== Test 10 : SYSTEM_PROMPT doctrinal ===');
{
  const sp = _internal.SYSTEM_PROMPT;
  checkTrue('mentionne trois sous-types', sp.toLowerCase().includes('regulation_a_venir_connue') && sp.toLowerCase().includes('regulation_existante_mal_appliquee'));
  checkTrue('mentionne CCD2', sp.includes('CCD2'));
  checkTrue('mentionne AI Act', sp.includes('AI Act'));
  checkTrue('mentionne Stripe Plaid Anthropic sains', sp.includes('Stripe') && sp.includes('Plaid') && sp.includes('Anthropic'));
  checkTrue('mentionne Theranos FTX confirmes', sp.includes('Theranos') && sp.includes('FTX'));
  checkTrue('contrainte coherence presente', sp.includes('CONTRAINTE DE COHÉRENCE'));
  checkTrue('format JSON specifie', sp.includes('FORMAT JSON OBLIGATOIRE'));
}

console.log('\n=== Test 11 : KEYWORDS calibres ===');
{
  checkTrue('CCD2 dans REGULE_KEYWORDS', _internal.REGULE_KEYWORDS.includes('CCD2'));
  checkTrue('AI Act dans REGULE_KEYWORDS', _internal.REGULE_KEYWORDS.includes('AI Act'));
  checkTrue('MiCA dans REGULE_KEYWORDS', _internal.REGULE_KEYWORDS.includes('MiCA'));
  checkTrue('GDPR dans REGULE_KEYWORDS', _internal.REGULE_KEYWORDS.includes('GDPR'));
  checkTrue('compliance officer dans COMPLIANCE_SIGNALS', _internal.COMPLIANCE_SIGNALS.includes('compliance officer'));
}

console.log('\n=== Test 12 : gating axe 1 (axe central Regulatory Time Bomb) ===');
{
  const naAxis = {
    score: 0,
    verdict: 'non-applicable' as const,
    rationale: 'Secteur sans exposition reglementaire structurelle.',
    evidencePro: [], evidenceContra: [], confidence: 0,
  };
  const inflated: PatternAnalysisOutput = {
    patternId: 'regulatory-time-bomb',
    applicabilite: 'full',
    applicabiliteRationale: '',
    globalScore: 70,
    verdict: 'alerte',
    resumeEditorial: '',
    axis1: naAxis,
    axis2: { score: 80, verdict: 'drapeau-rouge', rationale: '', evidencePro: [], evidenceContra: [], confidence: 80 },
    axis3: { score: 60, verdict: 'alerte', rationale: '', evidencePro: [], evidenceContra: [], confidence: 70 },
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
