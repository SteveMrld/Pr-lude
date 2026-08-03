// ============================================================
// TESTS DETERMINISTES : moteur DD financier, resolution d annee
// ------------------------------------------------------------
// Execution : npx tsx lib/engines/dd-financial-engine.test.ts
//
// Le moteur n avait aucun test. Ses sept tests sont pourtant purs :
// un financialData, un grand livre, aucun appel au modele. C est cette
// absence de couverture qui a laisse tenir une resolution d annee par
// position, du 3 aout 2026 a sa correction le meme jour.
//
// La fixture reproduit la forme du dossier InHairCare, celle qui avait
// deja fait naitre le module d alignement : une serie de revenu qui
// commence en 2019 et une serie de marge qui commence en 2020. C est
// precisement la forme sur laquelle l ancienne resolution se trompait,
// puisqu elle retombait sur la premiere entree du tableau des qu elle
// ne trouvait pas l annee exacte.
// ============================================================

import { _internal } from './dd-financial-engine';
import type { FinancialDataExtraction } from './types';

let pass = 0;
let fail = 0;

function check<T>(label: string, got: T, expected: T): void {
  if (got === expected) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
}

function checkTrue(label: string, got: boolean): void {
  check(label, got, true);
}

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

const REVENUS = [
  { year: '2019', value: 0.41, source: 'bp' },
  { year: '2020', value: 0.83, source: 'bp' },
  { year: '2021', value: 1.29, source: 'bp' },
  { year: '2022', value: 2.07, source: 'bp' },
  { year: '2023', value: 2.94, source: 'bp' },
  { year: '2024', value: 3.61, source: 'bp' },
  { year: '2025', value: 5.38, source: 'bp' },
  { year: '2026', value: 8.12, source: 'bp' },
];

// Marge brute : commence un an plus tard que le revenu, comme dans le
// dossier d origine. Valeurs en points de pourcentage.
const MARGES = [
  { year: '2020', value: 31.4, source: 'bp' },
  { year: '2021', value: 38.2, source: 'bp' },
  { year: '2022', value: 44.6, source: 'bp' },
  { year: '2023', value: 49.1, source: 'bp' },
  { year: '2024', value: 52.7, source: 'bp' },
];

function financialData(over: Partial<FinancialDataExtraction> = {}): FinancialDataExtraction {
  return {
    hasBP: true,
    fileSource: 'bp',
    revenueProjection: REVENUS,
    grossMarginProjection: MARGES,
    ebitdaProjection: [],
    fcfProjection: [],
    unitEconomics: {
      estimatedCAC: 'non communiqué',
      estimatedLTV: 'non communiqué',
      estimatedLtvCacRatio: 'non communiqué',
      averageContractValue: 'non communiqué',
      grossMarginPerUnit: 'non communiqué',
    },
    headcount: [],
    opexProjection: [],
    currentRound: { amount: 'non précisé', runwayMonths: 'non précisé', monthlyBurn: 'non précisé' },
    marketAssumptions: {
      tamCited: 'non communiqué',
      samCited: 'non communiqué',
      targetMarketShare: 'non communiqué',
      targetCustomersByYearN: 'non communiqué',
    },
    rawNotes: '',
    lastActualYear: 2024,
    lastActualYearEvidence: 'P&L 2024 clos',
    ...over,
  };
}

function ledger(periodEnd: string | null, over: any = {}): any {
  return {
    hasLedger: true,
    source: 'fec',
    parseQuality: 'high',
    parseWarnings: [],
    periodStart: '2024-01-01',
    periodEnd,
    totalEntries: 4200,
    classBalances: { class1: 0, class2: 0, class3: 0, class4: 0, class5: 0, class6: 0, class7: 0 },
    realRevenue: { last12MonthsTotal: 3_610_000, monthlyBreakdown: [], growthRate: 22.4 },
    realGrossMargin: { pctOfRevenue: 52.1, amountEur: 1_880_000 },
    ...over,
  };
}

// ============================================================
// Test 1 : la resolution est par annee, pas par position
// ============================================================

console.log('\n=== Test 1 : resolution par annee ===');
{
  const fd = financialData();
  const ref = new Date('2024-12-31');

  const courant = _internal.getCurrentYearProjection(fd.revenueProjection, ref);
  check('exercice du grand livre resolu', courant?.year, '2024');
  check('valeur de cet exercice', courant?.valueEur, 3_610_000);

  const suivant = _internal.getNextYearProjection(fd.revenueProjection, ref);
  check('exercice suivant resolu en annees', suivant?.year, '2025');
  check('valeur de l exercice suivant', suivant?.valueEur, 5_380_000);

  // Le coeur du defaut corrige. L ancienne resolution rendait
  // projection[1], soit 2020, comme « annee suivante » de 2024. Les
  // deux termes n etaient ni consecutifs ni ordonnes.
  checkTrue('l annee suivante n est pas la deuxieme entree du tableau', suivant?.year !== '2020');
}

// ============================================================
// Test 2 : sans correspondance, rien plutot qu autre chose
// ============================================================

console.log('\n=== Test 2 : aucune correspondance ===');
{
  const fd = financialData();
  const ref = new Date('2031-12-31'); // hors de la serie

  const courant = _internal.getCurrentYearProjection(fd.revenueProjection, ref);
  check('aucune projection pour un exercice hors serie', courant, null);

  // L ancienne resolution rendait ici projection[0], soit 2019 a
  // 0,41 M€, presente comme la projection de 2031. Un ecart calcule
  // contre elle aurait ete qualifie en severite.
  const suivant = _internal.getNextYearProjection(fd.revenueProjection, ref);
  check('idem pour l exercice suivant', suivant, null);
}

// ============================================================
// Test 3 : T6, la pente projetee porte sur deux exercices consecutifs
// ============================================================

console.log('\n=== Test 3 : trajectoire de croissance ===');
{
  const t = _internal.testGrowthTrajectory(financialData(), ledger('2024-12-31'));
  check('T6 evaluable sur un exercice couvert', t.severity !== 'not_assessable', true);

  // Pente attendue : (5.38 - 3.61) / 3.61 = 49,0 %. L ancienne
  // resolution comparait 2024 a 2020 et sortait une pente negative de
  // -77 %, confrontee telle quelle a la croissance reelle du grand
  // livre.
  checkTrue('la pente projetee est celle de 2024 vers 2025', t.bpValue.includes('49'));
  checkTrue('la pente n est pas negative', !t.bpValue.includes('-'));

  const horsSerie = _internal.testGrowthTrajectory(financialData(), ledger('2031-12-31'));
  check('T6 non evaluable hors serie', horsSerie.severity, 'not_assessable');
  check('aucun ecart chiffre rendu', horsSerie.gapPct, null);
}

// ============================================================
// Test 4 : T2, la marge lue est celle de l exercice compare
// ============================================================

console.log('\n=== Test 4 : marge brute ===');
{
  const t = _internal.testGrossMarginGap(financialData(), ledger('2024-12-31'));
  checkTrue('marge projetee de 2024 retenue', t.bpValue.includes('52.7') || t.bpValue.includes('52,7'));
  checkTrue('exercice nomme dans la sortie', t.bpValue.includes('2024'));

  // Ecart reel 52,1 contre projete 52,7 : moins d un point, aligne.
  check('ecart faible juge aligne', t.severity, 'aligned');

  // Exercice couvert par le grand livre mais absent de la serie de
  // marge : l ancienne version retombait sur MARGES[0], soit 31,4 %
  // de 2020, et sortait un ecart de plus de vingt points en alerte.
  // A defaut, elle retombait sur 0 et rendait red_flag.
  const sansMarge = _internal.testGrossMarginGap(financialData(), ledger('2019-12-31'));
  check('exercice sans marge projetee : non evaluable', sansMarge.severity, 'not_assessable');
  checkTrue('la sortie nomme l exercice manquant', sansMarge.bpValue.includes('2019'));
  check('aucun ecart chiffre rendu', sansMarge.gapPct, null);

  // Le dernier repli, sur zero, transformait une lecture impossible en
  // marge projetee nulle. Sur une marge reelle de 52 %, l ecart
  // sortait a 52 points, donc red_flag, sans qu aucune projection ait
  // ete lue.
  checkTrue('aucun red_flag fabrique par une projection nulle', sansMarge.severity !== 'red_flag');
}

// ============================================================
// Test 5 : T1, le revenu compare porte sur le bon exercice
// ============================================================

console.log('\n=== Test 5 : ecart de revenu ===');
{
  const t = _internal.testRevenueGap(financialData(), ledger('2024-12-31'));
  checkTrue('exercice 2024 nomme', t.bpValue.includes('2024'));
  check('reel egal au projete : aligne', t.severity, 'aligned');

  const horsSerie = _internal.testRevenueGap(financialData(), ledger('2031-12-31'));
  check('exercice hors serie : non evaluable', horsSerie.severity, 'not_assessable');
}

console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);
