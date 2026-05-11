// ============================================================
// Tests detectNarrativeMaturity et verdict narrativeDrift
// ------------------------------------------------------------
// Couvre la normalisation du champ libre fundraise.stage en
// dix paliers granulaires (pre-seed, seed, series-a-early,
// series-a-late, series-b, series-c, series-d, growth, pre-ipo,
// unknown), et la decision de verdict qui en decoule.
//
// Le seuil d activation transversal est doctrinal : 200 mots de
// prose minimum dans le corpus, sinon applicable=none. Les
// fixtures fournissent un corpus enrichi pour passer ce seuil.
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
check('"Series A" retourne series-a-early', detectNarrativeMaturity('Series A'), 'series-a-early');
check('"serie a" retourne series-a-early', detectNarrativeMaturity('serie a'), 'series-a-early');
check('"Tour A" retourne series-a-early', detectNarrativeMaturity('Tour A'), 'series-a-early');
check('"Series A late" retourne series-a-late', detectNarrativeMaturity('Series A late'), 'series-a-late');
check('"late Series A" retourne series-a-late', detectNarrativeMaturity('late Series A'), 'series-a-late');
check('"Series A+" retourne series-a-late', detectNarrativeMaturity('Series A+'), 'series-a-late');
check('"pre-B" retourne series-a-late', detectNarrativeMaturity('pre-B'), 'series-a-late');
check('"Series B" retourne series-b', detectNarrativeMaturity('Series B'), 'series-b');
check('"series-b" retourne series-b', detectNarrativeMaturity('series-b'), 'series-b');
check('"Series C" retourne series-c', detectNarrativeMaturity('Series C'), 'series-c');
check('"Series D" retourne series-d', detectNarrativeMaturity('Series D'), 'series-d');
check('"growth" retourne growth', detectNarrativeMaturity('growth'), 'growth');
check('"late stage" retourne growth', detectNarrativeMaturity('late stage'), 'growth');
check('"capital de croissance" retourne growth', detectNarrativeMaturity('capital de croissance'), 'growth');
check('"pre-IPO" retourne pre-ipo', detectNarrativeMaturity('pre-IPO'), 'pre-ipo');
check('"bridge" retourne unknown (cas non couvert volontairement)', detectNarrativeMaturity('bridge'), 'unknown');

// ============================================================
// Test 2 : verdict narrativeDrift selon stade
// ============================================================

console.log('\n=== verdict narrativeDrift selon stade ===');

// Le seuil corpus est doctrinal : 200 mots de prose minimum. Les
// fixtures fournissent quatre champs prose enrichis pour atteindre
// le seuil sans biaiser la detection sectorielle. Le mode noCorpus
// renvoie une extraction vide pour tester la branche none.
function mockExtraction(stage: string, withCorpus = true): ExtractionOutput {
  return {
    companyName: 'TestCo',
    sector: 'SaaS',
    subSector: 'B2B',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2022,
    founders: [],
    marketPitch: withCorpus
      ? 'Pitch de marche bien etoffe qui explique la promesse commerciale faite aux clients cibles. La proposition de valeur s adresse a un segment vertical clair et identifie. Les fondateurs ont travaille trois ans sur le sujet avant de commencer la levee. Le marche est documente, mesurable, accessible en France et en Europe avec une expansion possible vers les Etats-Unis a horizon trois ans.'
      : '',
    productDescription: withCorpus
      ? 'Description produit consequente pour passer le seuil de corpus minimal narratif. La plateforme couvre cinq modules cles : gestion des utilisateurs, dashboard analytique, integration API, facturation automatique et reporting reglementaire. L architecture technique est moderne, hebergee en cloud souverain europeen, conforme aux exigences RGPD et auditable par un commissaire aux comptes designe.'
      : '',
    businessModel: withCorpus
      ? 'Subscription B2B SaaS avec engagement contractuel annuel renouvelable et tarif degressif sur les paliers d utilisateurs. ARPU mediant a 12000 EUR par compte par an. Marge brute structurelle de 78 pourcent confirmee sur les douze derniers mois. Pipeline commercial documente et roadmap produit alignee sur les retours utilisateurs.'
      : '',
    traction: { metrics: [] },
    fundraise: { stage, amount: '5M' },
    competitorsCited: [],
    rawSummary: withCorpus
      ? 'Resume general qui finit de remplir le buffer de corpus textuel pour atteindre le seuil de deux cents mots requis par le moteur de derive narrative. La societe a structure son discours commercial autour de quatre piliers : la rigueur produit, l alignement avec les standards reglementaires, la qualite du support client et la transparence sur les indicateurs operationnels.'
      : '',
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

// Series A early : applicable=full, weight 0.7
{
  const matrix = computeRelevanceMatrix(mockExtraction('Series A'), 'SaaS B2B');
  check('series-a-early -> applicable full', matrix.verdicts.narrativeDrift.applicable, 'full');
  check('series-a-early -> weight 0.7', matrix.verdicts.narrativeDrift.weight, 0.7);
}

// Series A late : applicable=full, weight 0.85
{
  const matrix = computeRelevanceMatrix(mockExtraction('Series A late'), 'SaaS B2B');
  check('series-a-late -> applicable full', matrix.verdicts.narrativeDrift.applicable, 'full');
  check('series-a-late -> weight 0.85', matrix.verdicts.narrativeDrift.weight, 0.85);
}

// Series B : applicable=full, weight 0.95
{
  const matrix = computeRelevanceMatrix(mockExtraction('Series B'), 'SaaS B2B');
  check('series-b -> applicable full', matrix.verdicts.narrativeDrift.applicable, 'full');
  check('series-b -> weight 0.95', matrix.verdicts.narrativeDrift.weight, 0.95);
}

// Series C : applicable=full, weight 1
{
  const matrix = computeRelevanceMatrix(mockExtraction('Series C'), 'SaaS B2B');
  check('series-c -> applicable full', matrix.verdicts.narrativeDrift.applicable, 'full');
  check('series-c -> weight 1', matrix.verdicts.narrativeDrift.weight, 1);
}

// Growth : applicable=full, weight 1
{
  const matrix = computeRelevanceMatrix(mockExtraction('growth'), 'SaaS B2B');
  check('growth -> applicable full', matrix.verdicts.narrativeDrift.applicable, 'full');
  check('growth -> weight 1', matrix.verdicts.narrativeDrift.weight, 1);
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
  check('rationale series-c contient "Series C" ou "ulterieur"', /series\s*c|ulterieur|narration accumulee/i.test(r), true);
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
