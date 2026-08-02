// ============================================================
// Tests deterministes de la garde de vraisemblance sur l ecart d ancre
// ------------------------------------------------------------
// Ce que ces tests prouvent : l ecart entre l ancre temporelle du
// dossier et le millesime retenu est mesure et declare dans tous les
// cas ou une ancre existe, une mention de peremption apparait au-dela
// de trois ans, et la base reste retenue.
//
// Le defaut ferme : la branche 2 retenait la derniere annee de la
// serie anterieure a l ancre sans jamais mesurer la distance entre les
// deux. Mesure sur le dossier OOGarden du corpus : ancre au
// 2026-06-08, serie de chiffre d affaires courant de 2009 a 2017, donc
// base 2017 et neuf ans d ecart, declares nulle part. Un multiple de
// marche calibre sur des transactions recentes s appliquait a un
// chiffre d affaires de 2017 comme s il etait d hier.
//
// La doctrine retenue est la retention avec mention et non le refus :
// un dossier ancien n est pas invalide, il est ancien.
// ============================================================

import { computeValuation, BASIS_STALENESS_THRESHOLD_YEARS } from './valuation-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Serie mesuree sur OOGarden, en millions d euros.
const OOGARDEN = [
  { year: '2013', value: 20.8, source: 'bp' },
  { year: '2014', value: 28.2, source: 'bp' },
  { year: '2015', value: 37.584, source: 'bp' },
  { year: '2016', value: 48.024, source: 'bp' },
  { year: '2017', value: 60.552, source: 'bp' },
];

const RECENTE = [
  { year: '2023', value: 1.483, source: 'bp' },
  { year: '2024', value: 2.113, source: 'bp' },
  { year: '2025', value: 3.697, source: 'bp' },
];

function buildInput(opts: {
  asOf?: string | null;
  lastActualYear?: number | null;
  revenueProjection?: any[];
} = {}): any {
  const lay = opts.lastActualYear ?? null;
  return {
    extraction: {
      sector: 'e-commerce',
      fundraise: { stage: 'series-a', amount: '3M EUR' },
      traction: { metrics: [] },
    },
    financial: null,
    financialData: {
      hasBP: true, fileSource: 'bp',
      revenueProjection: opts.revenueProjection ?? RECENTE,
      grossMarginProjection: [], ebitdaProjection: [], fcfProjection: [],
      headcount: [], opexProjection: [],
      lastActualYear: lay,
      lastActualYearEvidence: lay ? `Colonne ${lay} qualifiee realise dans le P&L.` : null,
    },
    team: null, market: null, teamScore: 60, marketScore: 55,
    relevanceMatrix: { assetClass: 'ecommerce-dtc' },
    asOf: opts.asOf ?? null,
  };
}

// ============================================================
console.log('\n[Suite 1] le cas OOGarden, neuf ans d ecart');
// ============================================================

{
  const out = computeValuation(buildInput({ asOf: '2026-06-08', revenueProjection: OOGARDEN }));
  const b = out.basis;

  check(b.branch === 'as-of-anterior', 'la branche 2 tranche');
  check(b.year === 2017, `millesime 2017 (obtenu ${b.year})`);
  check(b.anchorYear === 2026, `ancre 2026 (obtenu ${b.anchorYear})`);
  check(b.anchorGapYears === 9, `ecart de 9 ans (obtenu ${b.anchorGapYears})`);
  check(b.stale === true, 'la base est marquee perimee');
  check(typeof b.stalenessNote === 'string' && b.stalenessNote!.length > 0, 'une mention de peremption est produite');
  check((b.stalenessNote ?? '').includes('2017') && (b.stalenessNote ?? '').includes('2026'), 'la mention nomme les deux annees');

  // Retention, pas refus : c est le point doctrinal.
  check(b.refusalReason === null, 'aucun refus');
  check(out.ranges.length > 0, 'une fourchette est tout de meme calculee');
  check(
    out.warnings.some((w) => /perimee/i.test(w)),
    'la mention remonte dans les warnings de la note',
  );
}

// ============================================================
console.log('\n[Suite 2] l ecart est declare aussi sous le seuil');
// ============================================================

{
  // Un an d ecart, cas nominal. La mention de peremption est absente,
  // l ecart est tout de meme mesure et ecrit : un chiffre dont on ne
  // peut pas lire l age n est pas auditable.
  const out = computeValuation(buildInput({ asOf: '2026-03-01', lastActualYear: 2025 }));
  const b = out.basis;
  check(b.anchorGapYears === 1, `ecart de 1 an (obtenu ${b.anchorGapYears})`);
  check(b.stale === false, 'pas de peremption sous le seuil');
  check(b.stalenessNote === null, 'aucune mention de peremption');
  check(/Ecart a l ancre du dossier : 1 an\./.test(b.declaration), 'la declaration porte l ecart');
  check(
    !out.warnings.some((w) => /perimee/i.test(w)),
    'aucun warning de peremption',
  );
}

{
  // Le seuil lui-meme : trois ans passent, quatre ne passent pas.
  const auSeuil = computeValuation(buildInput({ asOf: '2026-01-01', lastActualYear: 2023 }));
  check(auSeuil.basis.anchorGapYears === BASIS_STALENESS_THRESHOLD_YEARS, `ecart egal au seuil (${auSeuil.basis.anchorGapYears})`);
  check(auSeuil.basis.stale === false, 'un ecart egal au seuil ne perime pas');

  const auDela = computeValuation(buildInput({
    asOf: '2026-01-01',
    lastActualYear: 2022,
    revenueProjection: [
      { year: '2022', value: 1.2, source: 'bp' },
      { year: '2023', value: 1.483, source: 'bp' },
      { year: '2024', value: 2.113, source: 'bp' },
    ],
  }));
  check(auDela.basis.anchorGapYears === 4, `ecart de 4 ans (obtenu ${auDela.basis.anchorGapYears})`);
  check(auDela.basis.stale === true, 'un ecart de quatre ans perime');
}

// ============================================================
console.log('\n[Suite 3] la garde vaut pour les deux branches qui retiennent une base');
// ============================================================

{
  // Branche 1 avec ancre : la mention explicite du deck ne dispense
  // pas de mesurer l age. Un deck peut qualifier 2017 de realise et
  // etre instruit en 2026.
  const out = computeValuation(buildInput({
    asOf: '2026-06-08',
    lastActualYear: 2017,
    revenueProjection: OOGARDEN,
  }));
  check(out.basis.branch === 'explicit-actual', 'la branche 1 tranche');
  check(out.basis.anchorGapYears === 9, `ecart mesure aussi en branche 1 (obtenu ${out.basis.anchorGapYears})`);
  check(out.basis.stale === true, 'la peremption s applique aussi en branche 1');
}

{
  // Branche 1 sans ancre : l ecart n est pas mesurable et reste null.
  // Le millesime est sur, puisque le document le qualifie lui-meme,
  // mais son age ne l est pas.
  const out = computeValuation(buildInput({ asOf: null, lastActualYear: 2024 }));
  check(out.basis.branch === 'explicit-actual', 'branche 1 sans ancre');
  check(out.basis.anchorGapYears === null, 'aucun ecart mesure sans ancre');
  check(out.basis.anchorYear === null, 'aucune ancre declaree');
  check(out.basis.stale === false, 'pas de peremption sans mesure');
  check(out.basis.stalenessNote === null, 'aucune mention');
  check(
    !/Ecart a l ancre/.test(out.basis.declaration),
    'la declaration ne parle pas d un ecart qu elle n a pas mesure',
  );
}

{
  // Refus : aucun millesime, donc aucun ecart. Les champs restent
  // neutres et ne pretendent rien.
  const out = computeValuation(buildInput({ asOf: null, lastActualYear: null }));
  check(out.basis.branch === 'refused', 'la base est refusee');
  check(out.basis.anchorGapYears === null, 'aucun ecart sur un refus');
  check(out.basis.stale === false, 'aucune peremption sur un refus');
  check(out.basis.stalenessNote === null, 'aucune mention sur un refus');
}

// ============================================================
console.log('\n[Suite 4] la garde ne modifie ni le millesime ni la fourchette');
// ============================================================

{
  const sansAncre = computeValuation(buildInput({ asOf: null, lastActualYear: 2017, revenueProjection: OOGARDEN }));
  const avecAncre = computeValuation(buildInput({ asOf: '2026-06-08', lastActualYear: 2017, revenueProjection: OOGARDEN }));
  check(sansAncre.basis.year === avecAncre.basis.year, 'le millesime retenu est le meme');
  const evOf = (o: any) => o.ranges.find((r: any) => r.nature === 'enterprise_value')?.central ?? null;
  check(
    evOf(sansAncre) === evOf(avecAncre),
    `la fourchette est la meme, seule la declaration change (${evOf(sansAncre)} vs ${evOf(avecAncre)})`,
  );
  check(avecAncre.basis.stale && !sansAncre.basis.stale, 'seule la version ancree porte la peremption');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
