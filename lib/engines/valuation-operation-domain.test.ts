// ============================================================
// Tests deterministes de la neutralisation par domaine
// ------------------------------------------------------------
// Ce que ces tests prouvent : la VC inverse se declare hors domaine
// sur cession et LBO, la dilution disparait sur cession totale et
// survit sur cession partielle, les multiples restent applicables sur
// les quatre types, et un type non etabli ne neutralise rien.
//
// Le dernier point est le plus important. Le pipeline qui ne sait pas
// ne doit pas decider : transformer une ignorance en decision serait
// exactement le patron que la grappe 3 a ferme, sous une autre forme.
// ============================================================

import { computeValuation } from './valuation-engine';
import type { OperationType } from './types';

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

function build(operationType: OperationType | null, stage = 'series-a'): any {
  return {
    extraction: {
      sector: 'e-commerce',
      fundraise: { stage, amount: '3M EUR', operationType: operationType ?? 'non-etabli', operationTypeEvidence: null },
      traction: { metrics: [] },
    },
    financial: null,
    financialData: {
      hasBP: true, fileSource: 'bp', revenueProjection: SERIE,
      grossMarginProjection: [], ebitdaProjection: [], fcfProjection: [],
      headcount: [], opexProjection: [],
      lastActualYear: 2024,
      lastActualYearEvidence: 'Colonne 2024 qualifiee realise.',
    },
    team: null, market: null, teamScore: 60, marketScore: 55,
    relevanceMatrix: { assetClass: 'ecommerce-dtc' },
    asOf: null, asOfSource: null,
    operationType,
  };
}
const vc = (o: any) => o.methods.find((m: any) => m.method === 'vc-method');
const mult = (o: any) => o.methods.find((m: any) => m.method === 'sector-multiples');

// ============================================================
console.log('\n[Suite 1] la VC inverse est hors domaine sur cession et LBO');
// ============================================================

for (const op of ['cession-partielle', 'cession-totale', 'lbo'] as OperationType[]) {
  const out = computeValuation(build(op));
  check(vc(out).applicable === false, `${op} : VC inverse non applicable`);
  check(vc(out).notApplicableCause === 'doctrine', `${op} : cause doctrine, ni incident ni absence`);
  check(
    /aucun capital n entre dans la societe/.test(vc(out).notApplicableReason || ''),
    `${op} : le motif dit pourquoi la methode ne s applique pas`,
  );
}

{
  const out = computeValuation(build('levee'));
  check(vc(out).applicable === true, 'levee : la VC inverse tourne');
}

// ============================================================
console.log('\n[Suite 2] les multiples restent applicables sur les quatre types');
// ============================================================

for (const op of ['levee', 'cession-partielle', 'cession-totale', 'lbo'] as OperationType[]) {
  const out = computeValuation(build(op));
  check(mult(out).applicable === true, `${op} : multiples applicables`);
  check(
    out.ranges.some((r: any) => r.nature === 'enterprise_value'),
    `${op} : une fourchette en valeur d entreprise est produite`,
  );
}

// ============================================================
console.log('\n[Suite 3] la dilution disparait sur cession totale seulement');
// ============================================================

{
  const totale = computeValuation(build('cession-totale'));
  check(totale.dilutionAnalysis === null, 'cession totale : aucune dilution');
  check(
    (totale as any).dilutionNotComputableCause === 'doctrine',
    'cession totale : cause doctrine',
  );
  check(
    /sans objet sur une cession totale/.test((totale as any).dilutionNotComputableReason || ''),
    'cession totale : motif explicite, pas un champ vide',
  );
  check(
    /pas d actionnaire existant/.test((totale as any).dilutionNotComputableReason || ''),
    'et le motif dit pourquoi',
  );
}

{
  // Sur cession partielle la dilution garde un sens. Ici elle n est pas
  // calculee faute de fourchette pre-money, la VC inverse etant hors
  // domaine, mais elle n est pas declaree hors domaine pour autant.
  // L assertion porte sur le motif et non sur la cause : depuis que la
  // dilution sans support se declare aussi en doctrine, les deux cas
  // partagent la cause et se distinguent par ce qu ils disent. Sur une
  // cession partielle, la dilution n est pas sans objet, elle est sans
  // support, ce qui appelle une action differente du partner.
  const partielle = computeValuation(build('cession-partielle'));
  check(
    !/sans objet/.test((partielle as any).dilutionNotComputableReason || ''),
    'cession partielle : la dilution n est pas declaree sans objet',
  );
  check(
    /sans support/.test((partielle as any).dilutionNotComputableReason || ''),
    'elle est declaree sans support, ce qui est un fait different',
  );
}

// ============================================================
console.log('\n[Suite 4] un type non etabli ne neutralise rien');
// ============================================================

{
  const inconnu = computeValuation(build('non-etabli'));
  const reference = computeValuation(build(null));
  check(vc(inconnu).applicable === true, 'non-etabli : la VC inverse tourne comme avant');
  check(mult(inconnu).applicable === true, 'non-etabli : les multiples tournent');
  check(
    (inconnu as any).dilutionNotComputableCause !== 'doctrine',
    'non-etabli : aucune neutralisation de la dilution',
  );
  check(
    vc(inconnu).applicable === vc(reference).applicable,
    'non-etabli se comporte comme un type absent : le pipeline ne decide pas',
  );
  check(
    inconnu.ranges.length === reference.ranges.length,
    'et la sortie est identique en nombre de fourchettes',
  );
}

// ============================================================
console.log('\n[Suite 5] une dilution sans support porte sa cause');
// ============================================================

{
  // Le defaut mesure au run Braincube. La neutralisation de la VC
  // inverse sur un LBO supprime la seule methode pre-money du dossier,
  // donc la fourchette pre-money disparait, donc la dilution n a plus
  // de support. Elle se declarait par un champ vide, sans cause ni
  // motif : le patron ferme a la grappe 3, reintroduit par le
  // correctif de la grappe 4.
  for (const op of ['lbo', 'cession-partielle'] as OperationType[]) {
    const out = computeValuation(build(op));
    check(
      out.ranges.every((r: any) => r.nature !== 'pre_money'),
      `${op} : aucune fourchette pre-money ne survit`,
    );
    check(out.dilutionAnalysis === null, `${op} : aucune dilution calculee`);
    check(
      (out as any).dilutionNotComputableCause === 'doctrine',
      `${op} : la cause est declaree et vaut doctrine`,
    );
    check(
      /sans support/.test((out as any).dilutionNotComputableReason || ''),
      `${op} : le motif nomme l absence de support`,
    );
    check(
      /Methode VC inverse/.test((out as any).dilutionNotComputableReason || ''),
      `${op} : et nomme la methode ecartee`,
    );
    check(
      out.warnings.some((w: string) => /Dilution sans support/i.test(w)),
      `${op} : le motif remonte dans les warnings`,
    );
  }
}

{
  // La regle vaut sur les quatre types et pas seulement sur la cession
  // totale, ou elle avait ete enoncee. Une levee dont les methodes
  // pre-money tombent porte aussi sa cause.
  const out = computeValuation(build('levee', 'series-c-plus'));
  const aPreMoney = out.ranges.some((r: any) => r.nature === 'pre_money');
  const ticketAnnonce = true;
  check(
    aPreMoney || (out as any).dilutionNotComputableCause !== null || !ticketAnnonce,
    'levee sans support pre-money : la cause est declaree elle aussi',
  );
}

{
  // Un dossier sans ticket annonce ne porte toujours aucun motif :
  // l absence se distingue du refus, comme etabli au brief 23.
  const sansTicket = build('lbo');
  sansTicket.extraction.fundraise.amount = 'non precise';
  const out = computeValuation(sansTicket);
  check(
    (out as any).dilutionNotComputableCause === null,
    'aucun ticket annonce : aucune cause, l absence se distingue du refus',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
