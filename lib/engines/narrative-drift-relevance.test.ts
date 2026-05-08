// ============================================================
// Tests detectNarrativeMaturity et verdict narrativeDrift
// ------------------------------------------------------------
// Couvre la normalisation du champ libre fundraise.stage en
// cinq paliers exploitables (pre-seed, seed, series-a,
// series-b-plus, unknown), et la decision de verdict qui en
// decoule.
//
// Execution : tsx lib/engines/narrative-drift-relevance.test.ts
// ============================================================

import { computeRelevanceMatrix, detectNarrativeMaturity } from './relevance-matrix';
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
// Test 1 : detectNarrativeMaturity sur variantes lexicales
// ============================================================

console.log('\n=== detectNarrativeMaturity : variantes lexicales ===');

check('null retourne unknown', detectNarrativeMaturity(null), 'unknown');
check('undefined retourne unknown', detectNarrativeMaturity(undefined), 'unknown');
check('chaine vide retourne unknown', detectNarrativeMaturity(''), 'unknown');
check('"seed" retourne seed', detectNarrativeMaturity('seed'), 'seed');
check('"Seed" retourne seed', detectNarrativeMaturity('Seed'), 'seed');
check('"amorcage" retourne seed', detectNarrativeMaturity('amorcage'), 'seed');
check('"amorçage" retourne seed', detectNarrativeMaturity('amorçage'), 'seed');
check('"pre-seed" retourne pre-seed', detectNarrativeMaturity('pre-seed'), 'pre-seed');
check('"preseed" retourne pre-seed', detectNarrativeMaturity('preseed'), 'pre-seed');
check('"pre seed" retourne pre-seed', detectNarrativeMaturity('pre seed'), 'pre-seed');
check('"Series A" retourne series-a', detectNarrativeMaturity('Series A'), 'series-a');
check('"serie a" retourne series-a', detectNarrativeMaturity('serie a'), 'series-a');
check('"Tour A" retourne series-a', detectNarrativeMaturity('Tour A'), 'series-a');
check('"Series B" retourne series-b-plus', detectNarrativeMaturity('Series B'), 'series-b-plus');
check('"series-b" retourne series-b-plus', detectNarrativeMaturity('series-b'), 'series-b-plus');
check('"Series C" retourne series-b-plus', detectNarrativeMaturity('Series C'), 'series-b-plus');
check('"Series D" retourne series-b-plus', detectNarrativeMaturity('Series D'), 'series-b-plus');
check('"growth" retourne series-b-plus', detectNarrativeMaturity('growth'), 'series-b-plus');
check('"late stage" retourne series-b-plus', detectNarrativeMaturity('late stage'), 'series-b-plus');
check('"capital de croissance" retourne series-b-plus', detectNarrativeMaturity('capital de croissance'), 'series-b-plus');
check('"bridge" retourne unknown (cas non couvert volontairement)', detectNarrativeMaturity('bridge'), 'unknown');

// ============================================================
// Test 2 : verdict narrativeDrift selon stade
// ============================================================

console.log('\n=== verdict narrativeDrift selon stade ===');

function mockExtraction(stage: string, withCorpus = true): ExtractionOutput {
  return {
    companyName: 'TestCo',
    sector: 'SaaS',
    subSector: 'B2B',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2022,
    founders: [],
    marketPitch: withCorpus ? 'Pitch de marche bien etoffe avec une description longue et detaillee.' : '',
    productDescription: withCorpus ? 'Description produit consequente pour passer le seuil de corpus minimal.' : '',
    businessModel: withCorpus ? 'Subscription B2B SaaS' : '',
    traction: { metrics: [] },
    fundraise: { stage, amount: '5M' },
    competitorsCited: [],
    rawSummary: withCorpus ? 'Resume general qui finit de remplir le buffer de corpus textuel.' : '',
    boardMembers: [],
    clientsNamed: [],
  } as ExtractionOutput;
}

// Pre-seed : applicable=partial, weight bas
{
  const matrix = computeRelevanceMatrix(mockExtraction('pre-seed'), 'SaaS B2B');
  check('pre-seed -> applicable partial', matrix.verdicts.narrativeDrift.applicable, 'partial');
  check('pre-seed -> weight 0.35', matrix.verdicts.narrativeDrift.weight, 0.35);
}

// Seed : applicable=partial, weight intermediaire
{
  const matrix = computeRelevanceMatrix(mockExtraction('seed'), 'SaaS B2B');
  check('seed -> applicable partial', matrix.verdicts.narrativeDrift.applicable, 'partial');
  check('seed -> weight 0.55', matrix.verdicts.narrativeDrift.weight, 0.55);
}

// Series A : applicable=full
{
  const matrix = computeRelevanceMatrix(mockExtraction('Series A'), 'SaaS B2B');
  check('series-a -> applicable full', matrix.verdicts.narrativeDrift.applicable, 'full');
  check('series-a -> weight 0.85', matrix.verdicts.narrativeDrift.weight, 0.85);
}

// Series B+ : applicable=full, weight max
{
  const matrix = computeRelevanceMatrix(mockExtraction('Series B'), 'SaaS B2B');
  check('series-b -> applicable full', matrix.verdicts.narrativeDrift.applicable, 'full');
  check('series-b -> weight 1', matrix.verdicts.narrativeDrift.weight, 1);
}

// Stade inconnu : applicable=partial par defaut
{
  const matrix = computeRelevanceMatrix(mockExtraction('bridge round'), 'SaaS B2B');
  check('stade inconnu -> applicable partial', matrix.verdicts.narrativeDrift.applicable, 'partial');
  check('stade inconnu -> weight 0.5', matrix.verdicts.narrativeDrift.weight, 0.5);
}

// Pas de corpus : applicable=none
{
  const matrix = computeRelevanceMatrix(mockExtraction('Series A', false), 'SaaS B2B');
  check('pas de corpus -> applicable none', matrix.verdicts.narrativeDrift.applicable, 'none');
  check('pas de corpus -> weight 0', matrix.verdicts.narrativeDrift.weight, 0);
}

// ============================================================
// Test 3 : rationale present et lisible
// ============================================================

console.log('\n=== rationale narrativeDrift lisible ===');

{
  const matrix = computeRelevanceMatrix(mockExtraction('Series C'), 'Fintech');
  const r = matrix.verdicts.narrativeDrift.rationale;
  check('rationale series-c contient "Series B" ou "ulterieur"', /series\s*b|ulterieur|narration accumulee/i.test(r), true);
}
{
  const matrix = computeRelevanceMatrix(mockExtraction('seed'), 'SaaS');
  const r = matrix.verdicts.narrativeDrift.rationale;
  check('rationale seed contient "instantanee" ou "trop jeune"', /instantanee|trop jeune|baseline/i.test(r), true);
}

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
