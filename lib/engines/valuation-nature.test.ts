// ============================================================
// Tests deterministes de la nature de valeur du moteur Valorisation
// ------------------------------------------------------------
// Ce que ces tests prouvent : chaque methode declare la grandeur
// qu elle produit, la declaration est portee par le resultat persiste
// et non deduite du nom de la methode a la lecture, et elle est
// presente y compris quand la methode est non applicable.
//
// Le defaut ferme : les quatre methodes ne produisent pas la meme
// grandeur et le moteur les additionnait comme si elles le faisaient.
// Un multiple sectoriel s applique a un agregat d exploitation et les
// plages du catalogue sont des multiples EV, donc leur produit est une
// valeur d entreprise. Berkus, Scorecard et la VC inverse produisent
// une valeur des capitaux propres avant tour. L ecart entre les deux
// est la dette nette, que le contrat d extraction financiere ne porte
// pas : ni dette, ni tresorerie, ni BFR.
// ============================================================

import { computeValuation, VALUATION_NATURE_LABELS, type ValuationNature } from './valuation-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const SERIE = [
  { year: '2022', value: 1.752, source: 'bp' },
  { year: '2023', value: 1.483, source: 'bp' },
  { year: '2024', value: 2.113, source: 'bp' },
];

function buildInput(opts: {
  stage?: string;
  assetClass?: string;
  lastActualYear?: number | null;
  asOf?: string | null;
  revenueProjection?: any[];
} = {}): any {
  return {
    extraction: {
      sector: 'e-commerce',
      fundraise: { stage: opts.stage ?? 'series-a', amount: '3M EUR' },
      traction: { metrics: [] },
    },
    financial: null,
    financialData: {
      hasBP: true, fileSource: 'bp',
      revenueProjection: opts.revenueProjection ?? SERIE,
      grossMarginProjection: [], ebitdaProjection: [], fcfProjection: [],
      headcount: [], opexProjection: [],
      lastActualYear: opts.lastActualYear === undefined ? 2024 : opts.lastActualYear,
      lastActualYearEvidence: (opts.lastActualYear === undefined || opts.lastActualYear)
        ? 'Tableau P&L slide 10 : colonne 2024 qualifiee realise.' : null,
    },
    team: null, market: null, teamScore: 60, marketScore: 55,
    relevanceMatrix: { assetClass: opts.assetClass ?? 'ecommerce-dtc' },
    asOf: opts.asOf ?? null,
  };
}

const EXPECTED: Record<string, ValuationNature> = {
  'sector-multiples': 'enterprise_value',
  'vc-method': 'pre_money',
  'berkus': 'pre_money',
  'scorecard': 'pre_money',
};

// ============================================================
console.log('\n[Suite 1] chaque methode porte sa nature, applicable ou non');
// ============================================================

{
  // Series-a : multiples et VC inverse applicables, Berkus et
  // Scorecard non applicables par construction. Les quatre doivent
  // porter leur nature.
  const out = computeValuation(buildInput({ stage: 'series-a' }));
  check(out.methods.length === 4, 'les quatre methodes sont presentes');
  for (const m of out.methods) {
    check(
      (m as any).nature === EXPECTED[m.method],
      `${m.method} declare ${EXPECTED[m.method]} (obtenu ${(m as any).nature}, applicable=${m.applicable})`,
    );
  }
  const berkus = out.methods.find((m) => m.method === 'berkus')!;
  check(berkus.applicable === false, 'Berkus est non applicable en series-a');
  check(
    (berkus as any).nature === 'pre_money',
    'la nature est declaree meme sur une methode non applicable',
  );
}

{
  // Seed pre-revenue : Berkus et Scorecard portent la fourchette, les
  // multiples et la VC inverse tombent. La nature reste declaree
  // partout.
  const out = computeValuation(buildInput({ stage: 'seed', revenueProjection: [] }));
  for (const m of out.methods) {
    check(
      (m as any).nature === EXPECTED[m.method],
      `seed : ${m.method} declare ${EXPECTED[m.method]}`,
    );
  }
}

{
  // Chemin non applicable global : asset class non reconnue. Les
  // quatre methodes sortent neutralisees et doivent tout de meme
  // nommer la grandeur qu elles auraient produite.
  const out = computeValuation(buildInput({ assetClass: 'unclassified' }));
  check(out.recommendedRange === null, 'aucune fourchette sur asset class non reconnue');
  for (const m of out.methods) {
    check(
      (m as any).nature === EXPECTED[m.method],
      `non applicable global : ${m.method} declare ${EXPECTED[m.method]}`,
    );
  }
}

{
  // Base de millesime refusee : les multiples sortent non applicables
  // par la branche 3 de la regle de millesime. La nature survit.
  const out = computeValuation(buildInput({ lastActualYear: null, asOf: null }));
  const mult = out.methods.find((m) => m.method === 'sector-multiples')!;
  check(out.basis.branch === 'refused', 'la base est refusee');
  check(mult.applicable === false, 'les multiples sont neutralises');
  check((mult as any).nature === 'enterprise_value', 'la nature survit au refus de base');
}

// ============================================================
console.log('\n[Suite 2] la nature est persistee, pas deduite du nom');
// ============================================================

{
  const out = computeValuation(buildInput({ stage: 'series-a' }));
  // Serialisation puis relecture : c est ainsi que la note et le
  // dashboard lisent le moteur. La nature doit survivre au passage par
  // result_json, sans qu aucun consommateur n ait a connaitre la table
  // des correspondances methode vers nature.
  const relu = JSON.parse(JSON.stringify(out));
  for (const m of relu.methods) {
    check(
      typeof m.nature === 'string' && m.nature.length > 0,
      `apres serialisation, ${m.method} porte encore sa nature`,
    );
  }
  check(
    relu.methods.every((m: any) => m.nature === 'enterprise_value' || m.nature === 'pre_money'),
    'aucune nature hors des deux valeurs du type',
  );
}

{
  // Les libelles editoriaux sont exportes et couvrent les deux
  // natures : la note ne doit pas les reecrire de son cote.
  check(VALUATION_NATURE_LABELS.enterprise_value === "valeur d'entreprise", 'libelle valeur d entreprise');
  check(VALUATION_NATURE_LABELS.pre_money === 'pre-money', 'libelle pre-money');
  check(Object.keys(VALUATION_NATURE_LABELS).length === 2, 'exactement deux natures');
}

// ============================================================
console.log('\n[Suite 3] la repartition des natures est celle de la doctrine');
// ============================================================

{
  // Une seule methode produit de la valeur d entreprise, trois
  // produisent du pre-money. Le test fige la repartition pour qu un
  // ajout de methode oblige a trancher sa nature explicitement.
  const out = computeValuation(buildInput({ stage: 'seed' }));
  const ev = out.methods.filter((m) => (m as any).nature === 'enterprise_value').map((m) => m.method);
  const pm = out.methods.filter((m) => (m as any).nature === 'pre_money').map((m) => m.method);
  check(ev.length === 1 && ev[0] === 'sector-multiples', `seule la methode des multiples est en valeur d entreprise (${ev.join(',')})`);
  check(pm.length === 3, `trois methodes en pre-money (${pm.join(',')})`);
  check(pm.includes('vc-method') && pm.includes('berkus') && pm.includes('scorecard'), 'VC inverse, Berkus et Scorecard sont les trois');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
