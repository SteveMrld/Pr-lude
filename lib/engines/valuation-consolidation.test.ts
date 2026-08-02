// ============================================================
// Tests deterministes de la consolidation par nature
// ------------------------------------------------------------
// Ce que ces tests prouvent : le moteur ne pondere jamais ensemble
// deux methodes de natures differentes, il rend une fourchette par
// nature disponible, les poids sont renormalises a l interieur de
// chaque groupe, et aucune fourchette unique n est recommandee quand
// deux natures coexistent.
//
// Le defaut ferme : consolidateRanges ponderait les centraux de toutes
// les methodes applicables, quelle que soit la grandeur mesuree. Sur
// un dossier series-a, la sortie valait 0,65 fois une valeur
// d entreprise plus 0,35 fois une valeur des capitaux propres avant
// tour, et le resultat etait documente comme pre-money. Mesure sur le
// dossier de reference du corpus : 0,65 x 13 882 378 plus 0,35 x
// 11 630 573 egale 13 094 247, exactement la valeur persistee. Les
// deux natures ne different que de la dette nette, grandeur que le
// contrat d extraction financiere ne porte pas.
// ============================================================

import { computeValuation, VALUATION_NATURE_LABELS } from './valuation-engine';

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
  ticket?: string;
  assetClass?: string;
  revenueProjection?: any[];
} = {}): any {
  return {
    extraction: {
      sector: 'e-commerce',
      fundraise: { stage: opts.stage ?? 'series-a', amount: opts.ticket ?? '3M EUR' },
      traction: { metrics: [] },
    },
    financial: null,
    financialData: {
      hasBP: true, fileSource: 'bp',
      revenueProjection: opts.revenueProjection ?? SERIE,
      grossMarginProjection: [], ebitdaProjection: [], fcfProjection: [],
      headcount: [], opexProjection: [],
      lastActualYear: 2024,
      lastActualYearEvidence: 'Tableau P&L slide 10 : colonne 2024 qualifiee realise.',
    },
    team: null, market: null, teamScore: 60, marketScore: 55,
    relevanceMatrix: { assetClass: opts.assetClass ?? 'ecommerce-dtc' },
    asOf: null,
  };
}

const ev = (o: any) => o.ranges.find((r: any) => r.nature === 'enterprise_value');
const pm = (o: any) => o.ranges.find((r: any) => r.nature === 'pre_money');

// ============================================================
console.log('\n[Suite 1] deux natures applicables, deux fourchettes, aucune unique');
// ============================================================

{
  const out = computeValuation(buildInput({ stage: 'series-a' }));

  check(out.ranges.length === 2, `deux fourchettes consolidees (obtenu ${out.ranges.length})`);
  check(out.recommendedRange === null, 'aucune fourchette unique recommandee');
  check(ev(out) !== undefined, 'une fourchette en valeur d entreprise');
  check(pm(out) !== undefined, 'une fourchette en pre-money');

  // Ordre editorial stable : la valeur d entreprise d abord, parce qu
  // elle vient de l ancrage empirique le plus direct.
  check(out.ranges[0].nature === 'enterprise_value', 'la valeur d entreprise est rendue en premier');

  // Le central en valeur d entreprise est celui de la seule methode du
  // groupe, non ampute du poids d une methode d une autre nature.
  const multiples = out.methods.find((m: any) => m.method === 'sector-multiples')!;
  check(
    ev(out).central === multiples.range!.central,
    `le central EV vaut celui des multiples seuls (${ev(out).central} vs ${multiples.range!.central})`,
  );
  const vc = out.methods.find((m: any) => m.method === 'vc-method')!;
  check(
    pm(out).central === vc.range!.central,
    `le central pre-money vaut celui de la VC inverse seule (${pm(out).central} vs ${vc.range!.central})`,
  );

  // Preuve directe que le melange a disparu : l ancienne moyenne
  // ponderee ne figure plus nulle part en sortie.
  const ancienMelange = Math.round(multiples.range!.central * 0.65 + vc.range!.central * 0.35);
  check(
    ev(out).central !== ancienMelange && pm(out).central !== ancienMelange,
    `la moyenne des deux natures (${ancienMelange}) n est plus produite`,
  );
}

// ============================================================
console.log('\n[Suite 2] poids renormalises a l interieur de chaque nature');
// ============================================================

{
  const out = computeValuation(buildInput({ stage: 'series-a' }));
  for (const r of out.ranges) {
    const somme = r.contributions.reduce((a: number, c: any) => a + c.weight, 0);
    check(
      Math.abs(somme - 1) < 0.002,
      `${r.nature} : les poids somment a 1 (obtenu ${somme})`,
    );
    check(r.contributions.length > 0, `${r.nature} : au moins une contribution nommee`);
    check(
      r.contributions.every((c: any) => typeof c.label === 'string' && c.label.length > 0),
      `${r.nature} : chaque contribution porte son libelle`,
    );
  }
}

{
  // Seed avec revenu : les multiples portent seuls la valeur
  // d entreprise, Berkus et Scorecard se partagent le pre-money. Les
  // poids doctrinaux 0,30 et 0,20 se renormalisent en 0,6 et 0,4.
  const out = computeValuation(buildInput({ stage: 'seed', ticket: '800k EUR' }));
  check(out.ranges.length === 2, `seed avec revenu : deux natures (obtenu ${out.ranges.length})`);
  const groupe = pm(out);
  check(groupe.contributions.length === 2, `pre-money porte deux methodes (obtenu ${groupe?.contributions.length})`);
  const parMethode: Record<string, number> = {};
  for (const c of groupe.contributions) parMethode[c.method] = c.weight;
  check(Math.abs(parMethode['scorecard'] - 0.6) < 0.002, `scorecard renormalise a 0,6 (obtenu ${parMethode['scorecard']})`);
  check(Math.abs(parMethode['berkus'] - 0.4) < 0.002, `berkus renormalise a 0,4 (obtenu ${parMethode['berkus']})`);
  check(ev(out).contributions.length === 1, 'la valeur d entreprise ne porte que les multiples');
  check(Math.abs(ev(out).contributions[0].weight - 1) < 0.002, 'multiples renormalises a 1');
}

// ============================================================
console.log('\n[Suite 3] une seule nature disponible, une seule fourchette');
// ============================================================

{
  // Seed pre-revenue : ni multiples ni VC inverse. Seuls Berkus et
  // Scorecard, tous deux en pre-money. Une nature, donc une fourchette
  // unique, et recommendedRange redevient renseigne.
  const out = computeValuation(buildInput({ stage: 'seed', ticket: '800k EUR', revenueProjection: [] }));
  check(out.ranges.length === 1, `une seule fourchette (obtenu ${out.ranges.length})`);
  check(out.ranges[0].nature === 'pre_money', 'elle est en pre-money');
  check(out.recommendedRange !== null, 'recommendedRange est renseigne sur nature unique');
  check(
    out.recommendedRange!.central === out.ranges[0].central,
    'recommendedRange reprend la fourchette unique sans la modifier',
  );
  check(
    out.recommendedRange!.min === out.ranges[0].min && out.recommendedRange!.max === out.ranges[0].max,
    'bornes identiques',
  );
}

{
  // Aucune methode applicable : aucune fourchette, ni liste ni unique.
  const out = computeValuation(buildInput({ assetClass: 'unclassified' }));
  check(out.ranges.length === 0, 'aucune fourchette sur asset class non reconnue');
  check(out.recommendedRange === null, 'recommendedRange null');
}

// ============================================================
console.log('\n[Suite 4] la sortie dit au lecteur pourquoi il n y a pas un chiffre');
// ============================================================

{
  const out = computeValuation(buildInput({ stage: 'series-a' }));
  check(
    out.warnings.some((w: string) => /dette nette/i.test(w)),
    'un warning nomme la dette nette comme ecart entre les deux natures',
  );
  check(
    out.warnings.some((w: string) => /ne lit ni dette/i.test(w)),
    'le warning dit que le pipeline ne l extrait pas',
  );
  check(
    out.synthesis.includes(VALUATION_NATURE_LABELS.enterprise_value)
      && out.synthesis.includes(VALUATION_NATURE_LABELS.pre_money),
    'la synthese nomme les deux natures',
  );
  check(
    !/fourchette pre-money plausible se situe/.test(out.synthesis),
    'la synthese n affirme plus une pre-money unique',
  );
}

// ============================================================
console.log('\n[Suite 5] la dilution suit la pre-money et elle seule');
// ============================================================

{
  const out = computeValuation(buildInput({ stage: 'series-a', ticket: '2M EUR' }));
  const ticket = out.dilutionAnalysis!.proposedTicket;
  const attendu = Math.round((ticket / (pm(out).central + ticket)) * 1000) / 10;
  check(out.dilutionAnalysis !== null, 'la dilution est calculee');
  check(
    Math.abs(out.dilutionAnalysis!.dilutionAtCentral - attendu) < 0.15,
    `la dilution centrale se calcule sur la pre-money (${out.dilutionAnalysis!.dilutionAtCentral}% vs ${attendu}%)`,
  );
  const surEv = Math.round((ticket / (ev(out).central + ticket)) * 1000) / 10;
  check(
    Math.abs(out.dilutionAnalysis!.dilutionAtCentral - surEv) > 0.15,
    `elle ne se calcule pas sur la valeur d entreprise (${surEv}% aurait ete le resultat)`,
  );
}

{
  // Aucune fourchette pre-money : la dilution n a pas de support et ne
  // doit pas etre calculee sur une valeur d entreprise.
  const out = computeValuation(buildInput({ stage: 'series-a', ticket: '400M EUR' }));
  const aPreMoney = pm(out) !== undefined;
  check(
    aPreMoney || out.dilutionAnalysis === null,
    'sans fourchette pre-money, aucune dilution produite',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
