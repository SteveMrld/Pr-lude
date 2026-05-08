// ============================================================
// Tests verdicts fragiliteStructurelle
// ------------------------------------------------------------
// Couvre les sept verdicts patterns Phase 4 calcules par la
// matrice de pertinence selon stade et profil sectoriel du
// dossier.
//
// Execution : tsx lib/engines/fragility-relevance.test.ts
// ============================================================

import { computeRelevanceMatrix } from './relevance-matrix';
import type { ExtractionOutput } from './types';

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

// ============================================================
// Helpers de mock par profil
// ============================================================

function mockSaasB2B(stage: string): ExtractionOutput {
  return {
    companyName: 'TestSaasCo',
    sector: 'SaaS',
    subSector: 'B2B',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2020,
    founders: [],
    marketPitch: 'Plateforme SaaS B2B avec abonnement mensuel pour les RH des PME, ARR croissant et NRR superieur a 110%.',
    productDescription: 'Workflow automation pour les processus RH, integration avec les SIRH et les outils de paie.',
    businessModel: 'Subscription B2B SaaS avec pricing per-seat',
    traction: { metrics: [] },
    fundraise: { stage, amount: '5M' },
    competitorsCited: [],
    rawSummary: 'SaaS B2B RH avec ARR croissant.',
    boardMembers: [],
    clientsNamed: [],
  } as ExtractionOutput;
}

function mockHardwareDeeptech(stage: string): ExtractionOutput {
  return {
    companyName: 'TestHardwareCo',
    sector: 'Deeptech',
    subSector: 'Hardware',
    geographicHub: 'Grenoble',
    country: 'France',
    yearFounded: 2018,
    founders: [],
    marketPitch: 'Production industrielle de drones autonomes pour la surveillance agricole, avec composants semi-conducteurs propres et chaine d assemblage en France.',
    productDescription: 'Drone hardware avec capteurs proprietaires, assemblage en usine dediee, certification industrielle.',
    businessModel: 'Vente unitaire de hardware industriel',
    traction: { metrics: [] },
    fundraise: { stage, amount: '20M' },
    competitorsCited: [],
    rawSummary: 'Production hardware industrielle drones agricoles.',
    boardMembers: [],
    clientsNamed: [],
  } as ExtractionOutput;
}

function mockFintech(stage: string): ExtractionOutput {
  return {
    companyName: 'TestFintechCo',
    sector: 'Fintech',
    subSector: 'BNPL',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2021,
    founders: [],
    marketPitch: 'Solution de paiement fractionne pour le e-commerce, partenariats banques et institutionnels du credit a la consommation.',
    productDescription: 'API de paiement fractionne integree au checkout marchand, avec risque credit gere.',
    businessModel: 'Commission sur transactions BNPL',
    traction: { metrics: [] },
    fundraise: { stage, amount: '15M' },
    competitorsCited: [],
    rawSummary: 'Fintech BNPL e-commerce avec exposition reglementaire CCD2.',
    boardMembers: [],
    clientsNamed: [],
  } as ExtractionOutput;
}

// ============================================================
// Test 1 : SaaS B2B Series A
// ============================================================

console.log('\n=== Test 1 : SaaS B2B Series A ===');
{
  const m = computeRelevanceMatrix(mockSaasB2B('Series A'), 'SaaS B2B');
  const fs = m.verdicts.fragiliteStructurelle;
  // Growth subsidized actif des Series A
  check('growth-subsidized full en Series A', fs['growth-subsidized-model'].applicable, 'full');
  // Infrastructure hostage actif full pour SaaS
  check('infrastructure-hostage full pour SaaS Series A', fs['infrastructure-hostage'].applicable, 'full');
  // Fixed cost trap : SaaS pure cloud = partial avec scope limite
  check('fixed-cost-trap partial pour SaaS pure cloud', fs['fixed-cost-trap'].applicable, 'partial');
  // Regulatory time bomb : pas de mots-cles regules dans ce mock
  check('regulatory-time-bomb none pour SaaS RH non-regule', fs['regulatory-time-bomb'].applicable, 'none');
  // Commoditization drift actif full pour knowledge work Series A
  check('commoditization-drift full pour SaaS Series A', fs['commoditization-drift'].applicable, 'full');
  // Capital structure fragility partial en Series A
  check('capital-structure-fragility partial en Series A', fs['capital-structure-fragility'].applicable, 'partial');
  // Scale mirage : SaaS pure software = none
  check('scale-mirage none pour SaaS pure software', fs['scale-mirage-risk'].applicable, 'none');
}

// ============================================================
// Test 2 : SaaS B2B Series B
// ============================================================

console.log('\n=== Test 2 : SaaS B2B Series B ===');
{
  const m = computeRelevanceMatrix(mockSaasB2B('Series B'), 'SaaS B2B');
  const fs = m.verdicts.fragiliteStructurelle;
  check('growth-subsidized full Series B', fs['growth-subsidized-model'].applicable, 'full');
  check('growth-subsidized weight 1 Series B', fs['growth-subsidized-model'].weight, 1);
  check('capital-structure-fragility full en Series B', fs['capital-structure-fragility'].applicable, 'full');
  check('commoditization-drift full Series B weight 1', fs['commoditization-drift'].weight, 1);
}

// ============================================================
// Test 3 : Hardware deeptech Series B
// ============================================================

console.log('\n=== Test 3 : Hardware deeptech Series B ===');
{
  const m = computeRelevanceMatrix(mockHardwareDeeptech('Series B'), 'Deeptech');
  const fs = m.verdicts.fragiliteStructurelle;
  // Hardware : commoditization-drift hors-scope
  check('commoditization-drift none pour hardware', fs['commoditization-drift'].applicable, 'none');
  // Hardware : scale mirage actif full Series B
  check('scale-mirage full pour hardware Series B', fs['scale-mirage-risk'].applicable, 'full');
  check('scale-mirage weight 1 Series B', fs['scale-mirage-risk'].weight, 1);
  // Hardware : infrastructure hostage en partial (couche logicielle uniquement)
  check('infrastructure-hostage partial pour hardware', fs['infrastructure-hostage'].applicable, 'partial');
  // Hardware : fixed cost trap full Series B (asset heavy)
  check('fixed-cost-trap full pour hardware Series B', fs['fixed-cost-trap'].applicable, 'full');
  // Capital structure fragility full Series B
  check('capital-structure-fragility full Series B', fs['capital-structure-fragility'].applicable, 'full');
}

// ============================================================
// Test 4 : Fintech BNPL Series A (regulatory time bomb actif)
// ============================================================

console.log('\n=== Test 4 : Fintech BNPL Series A ===');
{
  const m = computeRelevanceMatrix(mockFintech('Series A'), 'Fintech');
  const fs = m.verdicts.fragiliteStructurelle;
  // Fintech : regulatory time bomb actif full meme en Series A
  check('regulatory-time-bomb full pour fintech tous stades', fs['regulatory-time-bomb'].applicable, 'full');
  // Fintech mots-cles paiement detectes
  console.log(`     rationale regulatory: ${fs['regulatory-time-bomb'].rationale.slice(0, 80)}...`);
}

// ============================================================
// Test 5 : SaaS B2B Seed
// ============================================================

console.log('\n=== Test 5 : SaaS B2B Seed ===');
{
  const m = computeRelevanceMatrix(mockSaasB2B('Seed'), 'SaaS B2B');
  const fs = m.verdicts.fragiliteStructurelle;
  // Capital structure fragility en lecture preventive seulement
  check('capital-structure-fragility partial en seed', fs['capital-structure-fragility'].applicable, 'partial');
  check('capital-structure weight 0.3 en seed', fs['capital-structure-fragility'].weight, 0.3);
  // Scale mirage : SaaS pure software = none meme en seed
  check('scale-mirage none pour SaaS seed', fs['scale-mirage-risk'].applicable, 'none');
  // Commoditization drift : partial seed pour wrappers IA
  check('commoditization-drift partial en seed knowledge', fs['commoditization-drift'].applicable, 'partial');
}

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
