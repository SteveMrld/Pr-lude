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
    /pas d entree au capital/.test(vc(out).notApplicableReason || ''),
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
  const partielle = computeValuation(build('cession-partielle'));
  check(
    (partielle as any).dilutionNotComputableCause !== 'doctrine',
    'cession partielle : la dilution n est pas declaree hors domaine',
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

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
