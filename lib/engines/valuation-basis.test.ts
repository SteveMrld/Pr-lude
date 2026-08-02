// ============================================================
// Tests deterministes de la regle de millesime du moteur Valorisation
// ------------------------------------------------------------
// Ce que ces tests prouvent : la base sur laquelle les multiples
// sectoriels s appliquent est celle d un exercice realise, elle est
// declaree dans la sortie, et elle ne depend d aucune horloge.
//
// Le defaut ferme : pickProjectionValue retenait l annee civile
// courante quand elle figurait dans la serie du BP. Sur le dossier de
// reference du corpus (In Haircare, ecommerce-dtc, series-a, serie
// 2019 a 2026), la base valait donc 6,552 M projetes en 2026 la ou le
// dernier exercice realise, 2024, pesait 2,113 M. Les multiples de
// marche s appliquaient sur un chiffre d affaires que l entreprise
// n avait pas fait, et la fourchette sortait gonflee d un facteur
// trois. Le meme dossier rejoue en 2027 aurait change de base sans
// qu une seule donnee du dossier ait bouge.
//
// La regle qui remplace l horloge est ordonnee et exclusive :
//   1. explicit-actual : dernier exercice que le deck qualifie de
//      realise, avec citation, via la primitive reference-year.
//   2. as-of-anterior  : a defaut, derniere annee de la serie
//      strictement anterieure a la date de reception du dossier.
//   3. refused         : a defaut, refus motive, multiples neutralises.
//
// Les series du corpus reproduites ici sont celles mesurees dans
// result_json, pas des valeurs inventees pour la demonstration.
// ============================================================

import { computeValuation } from './valuation-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Serie de chiffre d affaires mesuree sur le dossier In Haircare,
// en millions d euros, telle que le moteur d extraction financiere la
// rend. Les quatre premieres annees sont qualifiees realise par le
// deck, les deux dernieres sont projetees.
const IN_HAIRCARE_REVENUE = [
  { year: '2019', value: 0.2, source: 'bp' },
  { year: '2020', value: 0.48, source: 'bp' },
  { year: '2021', value: 1.56, source: 'bp' },
  { year: '2022', value: 1.752, source: 'bp' },
  { year: '2023', value: 1.483, source: 'bp' },
  { year: '2024', value: 2.113, source: 'bp' },
  { year: '2025', value: 3.697, source: 'bp' },
  { year: '2026', value: 6.552, source: 'bp' },
];

// L EBITDA du meme dossier ne commence qu en 2020 la ou le revenue
// commence en 2019. L ecart de longueur entre series est reel et sert
// a verifier que la lecture au millesime ne se replie pas.
const IN_HAIRCARE_EBITDA = [
  { year: '2020', value: 0.157, source: 'bp' },
  { year: '2021', value: 0.136, source: 'bp' },
  { year: '2022', value: -0.53, source: 'bp' },
  { year: '2023', value: -0.422, source: 'bp' },
  { year: '2024', value: 0.138, source: 'bp' },
  { year: '2025', value: 0.402, source: 'bp' },
  { year: '2026', value: 0.785, source: 'bp' },
];

function buildInput(opts: {
  lastActualYear?: number | null;
  lastActualYearEvidence?: string | null;
  asOf?: string | null;
  revenueProjection?: Array<{ year: string; value: number; source: string }>;
  ebitdaProjection?: Array<{ year: string; value: number; source: string }>;
  stage?: string;
  assetClass?: string;
}): any {
  return {
    extraction: {
      sector: 'e-commerce',
      fundraise: { stage: opts.stage ?? 'series-a', amount: '3M EUR' },
      traction: { metrics: [] },
    },
    financial: null,
    financialData: {
      hasBP: true,
      fileSource: 'bp',
      revenueProjection: opts.revenueProjection ?? IN_HAIRCARE_REVENUE,
      grossMarginProjection: [],
      ebitdaProjection: opts.ebitdaProjection ?? IN_HAIRCARE_EBITDA,
      fcfProjection: [],
      headcount: [],
      opexProjection: [],
      lastActualYear: opts.lastActualYear ?? null,
      // Distinction volontaire entre citation non fournie par le test
      // et citation explicitement nulle. Un ?? confondrait les deux et
      // le fixture rehabiliterait la citation que le cas veut retirer.
      lastActualYearEvidence: 'lastActualYearEvidence' in opts
        ? opts.lastActualYearEvidence
        : (opts.lastActualYear ? `Tableau P&L slide 10 : colonne ${opts.lastActualYear} qualifiee realise.` : null),
    },
    team: null,
    market: null,
    teamScore: 60,
    marketScore: 55,
    relevanceMatrix: { assetClass: opts.assetClass ?? 'ecommerce-dtc' },
    asOf: opts.asOf ?? null,
  };
}

function multiplesOf(out: any) {
  return out.methods.find((m: any) => m.method === 'sector-multiples');
}

// ============================================================
console.log('\n[Suite 1] branche 1, mention explicite de realise dans le deck');
// ============================================================

{
  const out = computeValuation(buildInput({ lastActualYear: 2024, asOf: '2025-06-30' }));
  const m = multiplesOf(out);

  check(out.basis.branch === 'explicit-actual', 'la branche explicit-actual tranche');
  check(out.basis.year === 2024, `le millesime retenu est 2024 (obtenu ${out.basis.year})`);
  check(m?.applicable === true, 'les multiples sont applicables');
  check(
    m?.inputs?.baseMetric === 2_113_000,
    `la base vaut le realise 2024, soit 2 113 000 EUR (obtenu ${m?.inputs?.baseMetric})`,
  );
  check(m?.inputs?.baseYear === 2024, 'le bloc inputs porte baseYear');
  check(m?.inputs?.baseBranch === 'explicit-actual', 'le bloc inputs porte baseBranch');
  check(
    typeof out.basis.declaration === 'string' && out.basis.declaration.includes('2024'),
    'la declaration nomme le millesime',
  );
  check(out.basis.refusalReason === null, 'aucun motif de refus sur une base retenue');

  // La preuve du defaut ferme : la base n est pas la projection 2026.
  check(
    m?.inputs?.baseMetric !== 6_552_000,
    'la base n est pas la projection 2026 que l horloge retenait',
  );
}

{
  // La branche 1 prime sur asOf, meme quand asOf designerait une autre
  // annee. Une mention explicite du document bat une derivation.
  const out = computeValuation(buildInput({ lastActualYear: 2023, asOf: '2026-01-15' }));
  check(out.basis.branch === 'explicit-actual', 'branche 1 prioritaire sur la branche 2');
  check(out.basis.year === 2023, `millesime 2023 impose par le deck (obtenu ${out.basis.year})`);
  check(
    multiplesOf(out)?.inputs?.baseMetric === 1_483_000,
    'la base suit le millesime declare, pas la date de reception',
  );
}

{
  // La primitive exige une citation. Un lastActualYear sans evidence
  // est refuse par elle, et le moteur redescend sur la branche 2.
  const out = computeValuation(buildInput({
    lastActualYear: 2024,
    lastActualYearEvidence: null,
    asOf: '2025-06-30',
  }));
  check(out.basis.branch === 'as-of-anterior', 'sans citation, la branche 1 ne tranche pas');
  check(out.basis.year === 2024, `la branche 2 retient 2024 (obtenu ${out.basis.year})`);
}

// ============================================================
console.log('\n[Suite 2] branche 2, ancrage sur la date de reception du dossier');
// ============================================================

{
  const out = computeValuation(buildInput({ lastActualYear: null, asOf: '2025-06-30' }));
  const m = multiplesOf(out);

  check(out.basis.branch === 'as-of-anterior', 'la branche as-of-anterior tranche');
  check(out.basis.year === 2024, `derniere annee anterieure a 2025, soit 2024 (obtenu ${out.basis.year})`);
  check(m?.inputs?.baseMetric === 2_113_000, 'la base vaut 2 113 000 EUR');
  check(
    out.basis.declaration.includes('2025-06-30'),
    'la declaration cite la date de reception qui a servi d ancrage',
  );
  check(
    out.warnings.some((w: string) => /recouper avec les liasses/i.test(w)),
    'un warning signale que le deck n a rien qualifie de realise',
  );
}

{
  // Invariance temporelle : c est la propriete que l horloge detruisait.
  // Deux dates de reception distinctes donnent deux bases distinctes,
  // mais une meme date donne toujours la meme base, quel que soit le
  // moment du rejeu.
  const a = computeValuation(buildInput({ asOf: '2025-06-30' }));
  const b = computeValuation(buildInput({ asOf: '2025-12-31' }));
  const c = computeValuation(buildInput({ asOf: '2024-03-01' }));
  check(a.basis.year === 2024 && b.basis.year === 2024, 'deux dates dans la meme annee donnent la meme base');
  check(c.basis.year === 2023, `une reception en 2024 recule la base a 2023 (obtenu ${c.basis.year})`);
  // On compare la fourchette en valeur d entreprise et non
  // recommendedRange : celui-ci est null des que deux natures
  // coexistent, et deux null egaux ne prouveraient rien.
  const evOf = (o: any) => o.ranges.find((r: any) => r.nature === 'enterprise_value')?.central ?? null;
  check(
    evOf(a) !== null && evOf(a) === evOf(b),
    `la fourchette ne bouge pas entre deux receptions de la meme annee (${evOf(a)} vs ${evOf(b)})`,
  );
}

{
  // Toutes les annees de la serie posterieures a la reception : aucune
  // ne peut porter un multiple. Refus, et il est motive par la serie.
  const out = computeValuation(buildInput({
    asOf: '2019-01-01',
    revenueProjection: IN_HAIRCARE_REVENUE,
  }));
  check(out.basis.branch === 'refused', 'reception anterieure a toute la serie, la base est refusee');
  check(
    (out.basis.refusalReason || '').includes('2019'),
    'le motif nomme la premiere annee de la serie',
  );
}

// ============================================================
console.log('\n[Suite 3] branche 3, refus faute d ancrage');
// ============================================================

{
  const out = computeValuation(buildInput({ lastActualYear: null, asOf: null }));
  const m = multiplesOf(out);

  check(out.basis.branch === 'refused', 'la branche refused tranche');
  check(out.basis.year === null, 'aucun millesime retenu');
  check(m?.applicable === false, 'les multiples sectoriels sont non applicables');
  check(m?.range === undefined, 'aucune fourchette de multiples produite');
  check(
    typeof m?.notApplicableReason === 'string' && /asOf/i.test(m.notApplicableReason),
    'le motif ecrit nomme l absence de date de reception',
  );
  check(
    out.warnings.some((w: string) => /multiples sectoriels n ont pas pu/i.test(w)),
    'le refus remonte dans les warnings de la note',
  );
  check(m?.inputs?.baseYear === null, 'le bloc inputs declare baseYear null');
  check(m?.inputs?.baseBranch === 'refused', 'le bloc inputs declare la branche refused');
}

{
  // Le refus ferme aussi le repli sur la traction declaree du deck. Un
  // chiffre dont on ne sait pas dater l exercice ne porte pas un
  // multiple de marche, meme quand il est affiche en couverture.
  const input = buildInput({ lastActualYear: null, asOf: null, revenueProjection: [] });
  input.extraction.traction = { revenue: '2,5M EUR', metrics: [] };
  const out = computeValuation(input);
  check(
    multiplesOf(out)?.applicable === false,
    'la traction declaree ne rouvre pas les multiples quand la base est refusee',
  );
}

// ============================================================
console.log('\n[Suite 4] lecture stricte au millesime, sans repli sur une annee voisine');
// ============================================================

{
  // Le cas reel du run 9201a046 : revenue depuis 2019, ebitda depuis
  // 2020. Une base 2019 se lit sur le revenue et pas sur l ebitda. Le
  // moteur doit rendre null sur la serie absente plutot que glisser sur
  // 2020, ce qui ferait lire deux grandeurs a deux millesimes sous une
  // meme base declaree.
  // La serie revenue porte 2019, la serie ebitda commence en 2020. La
  // lecture au millesime rend donc une valeur sur l une et null sur
  // l autre, sans jamais glisser d une annee.
  const surRevenue = computeValuation(buildInput({
    lastActualYear: 2019,
    asOf: '2025-06-30',
    stage: 'series-a',
    assetClass: 'ecommerce-dtc',
  }));
  check(surRevenue.basis.year === 2019, 'la base retenue est 2019');
  check(
    multiplesOf(surRevenue)?.inputs?.baseMetric === 200_000,
    `la base revenue vaut le realise 2019, soit 200 000 EUR (obtenu ${multiplesOf(surRevenue)?.inputs?.baseMetric})`,
  );
  check(
    multiplesOf(surRevenue)?.inputs?.baseMetric !== 480_000,
    'la lecture n a pas glisse sur 2020, premiere annee de la serie ebitda',
  );
}

{
  // Bascule profitable-mature : elle se decide desormais sur l EBITDA
  // du millesime de reference. En 2023 l EBITDA est negatif (-0,422 M),
  // en 2026 il est positif (0,785 M). Sous l horloge, un dossier
  // deficitaire en realise changeait de classe d actif sur la foi de sa
  // projection.
  const deficitaire = computeValuation(buildInput({
    lastActualYear: 2023,
    stage: 'series-b',
    assetClass: 'ecommerce-dtc',
  }));
  check(
    deficitaire.assetClass === 'ecommerce-dtc',
    `un series-b deficitaire en realise reste dans sa classe (obtenu ${deficitaire.assetClass})`,
  );

  const beneficiaire = computeValuation(buildInput({
    lastActualYear: 2024,
    stage: 'series-b',
    assetClass: 'ecommerce-dtc',
  }));
  check(
    beneficiaire.assetClass === 'profitable-mature',
    `un series-b beneficiaire en realise bascule (obtenu ${beneficiaire.assetClass})`,
  );
}

// ============================================================
console.log('\n[Suite 5] aucune lecture d horloge dans le moteur');
// ============================================================

{
  // Garde structurelle plutot que comportementale : le fichier source
  // ne doit plus contenir d appel a l horloge systeme. Un test de
  // comportement ne peut pas prouver cette absence sans voyager dans le
  // temps, la lecture du source si.
  const fs = require('fs') as typeof import('fs');
  const src = fs.readFileSync(`${__dirname}/valuation-engine.ts`, 'utf8');
  const codeLines = src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
  check(
    !codeLines.some((l) => /new Date\(\)/.test(l)),
    'valuation-engine.ts ne construit aucune Date',
  );
  check(
    !codeLines.some((l) => /getFullYear/.test(l)),
    'valuation-engine.ts n appelle pas getFullYear',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
