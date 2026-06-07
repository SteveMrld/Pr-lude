// ============================================================
// Tests deterministes calibration-metrics.ts
// ------------------------------------------------------------
// Pas de framework : fonctions check / checkClose qui incrementent
// pass / fail, plus process.exit final. Cohere avec le pattern
// des autres .test.ts du repo.
// ============================================================

import {
  computeCalibration,
  computeCalibrationFromMixed,
  DEFAULT_MIN_RESOLVED_PER_SEGMENT,
  type CalibrationInput,
  type StampFingerprintKey,
} from './calibration-metrics';

let pass = 0;
let fail = 0;

function check(cond: boolean, label: string) {
  if (cond) {
    pass++;
    console.log(`  OK  ${label}`);
  } else {
    fail++;
    console.error(`  KO  ${label}`);
  }
}

function checkClose(actual: number, expected: number, eps: number, label: string) {
  const ok = Math.abs(actual - expected) <= eps;
  if (ok) {
    pass++;
    console.log(`  OK  ${label} (${actual.toFixed(4)} ~ ${expected})`);
  } else {
    fail++;
    console.error(`  KO  ${label} : attendu ${expected} +/- ${eps}, obtenu ${actual}`);
  }
}

// ============================================================
// HELPERS
// ============================================================

const STAMP_V1: StampFingerprintKey = {
  commitSha: 'aaa',
  configsHash: 'c1',
  enginesHash: 'e1',
  modelsHash: 'm1',
};

const STAMP_V2: StampFingerprintKey = {
  commitSha: 'bbb',
  configsHash: 'c2',
  enginesHash: 'e2',
  modelsHash: 'm2',
};

function makeRow(predicted: number, observed: 0 | 1, stamp: StampFingerprintKey = STAMP_V1): CalibrationInput {
  return { predicted, observed, stampFingerprint: stamp };
}

// ============================================================
// SUITE 1 - Brier score
// ============================================================

console.log('\n[Suite 1] Brier score');

{
  // Predictions parfaites : tous les succes a 1.0, tous les echecs a 0.0
  const rows: CalibrationInput[] = [];
  for (let i = 0; i < DEFAULT_MIN_RESOLVED_PER_SEGMENT; i++) {
    rows.push(makeRow(1.0, 1));
  }
  for (let i = 0; i < DEFAULT_MIN_RESOLVED_PER_SEGMENT; i++) {
    rows.push(makeRow(0.0, 0));
  }
  const r = computeCalibration(rows);
  check(r.segments.length === 1, 'parfait : un segment');
  const seg = r.segments[0];
  check(seg.calibrable === true, 'parfait : calibrable');
  if (seg.calibrable === true) {
    checkClose(seg.brier, 0, 1e-9, 'parfait : Brier = 0');
    checkClose(seg.discrimination, 1.0, 1e-9, 'parfait : discrimination = 1.0');
  }
}

{
  // Predictions toujours 0.5, issues 50/50 : Brier = 0.25
  const rows: CalibrationInput[] = [];
  for (let i = 0; i < 20; i++) rows.push(makeRow(0.5, i % 2 === 0 ? 1 : 0));
  const r = computeCalibration(rows);
  const seg = r.segments[0];
  check(seg.calibrable === true, '0.5/50-50 : calibrable');
  if (seg.calibrable === true) {
    checkClose(seg.brier, 0.25, 1e-9, '0.5/50-50 : Brier = 0.25');
    checkClose(seg.discrimination, 0.5, 1e-9, '0.5/50-50 : discrimination = 0.5');
  }
}

{
  // Predictions inverses : modele dit 0.9 mais l issue est 0.
  // Brier devrait etre eleve.
  const rows: CalibrationInput[] = [];
  for (let i = 0; i < 10; i++) rows.push(makeRow(0.9, 0));
  for (let i = 0; i < 10; i++) rows.push(makeRow(0.1, 1));
  const r = computeCalibration(rows);
  const seg = r.segments[0];
  check(seg.calibrable === true, 'inverse : calibrable');
  if (seg.calibrable === true) {
    checkClose(seg.brier, 0.81, 1e-9, 'inverse : Brier = 0.81');
    // Toutes les preds positives ont rang inferieur aux preds negatives
    // donc l AUC est 0 (anti-discrimination parfaite).
    checkClose(seg.discrimination, 0, 1e-9, 'inverse : discrimination = 0');
  }
}

// ============================================================
// SUITE 2 - Seuil de calibration
// ============================================================

console.log('\n[Suite 2] Seuil donnees insuffisantes');

{
  // Sous le seuil : "insufficient-data"
  const rows = [makeRow(0.7, 1), makeRow(0.3, 0), makeRow(0.6, 1)];
  const r = computeCalibration(rows);
  check(r.segments.length === 1, 'sous seuil : un segment');
  const seg = r.segments[0];
  check(seg.calibrable === false, 'sous seuil : non calibrable');
  if (seg.calibrable === false) {
    check(seg.reason === 'insufficient-data', 'sous seuil : raison insufficient-data');
    check(seg.resolvedCount === 3, 'sous seuil : count 3');
    check(seg.requiredCount === DEFAULT_MIN_RESOLVED_PER_SEGMENT, 'sous seuil : requiredCount');
  }
  check(r.anyCalibrable === false, 'sous seuil : anyCalibrable false');
}

{
  // Seuil personnalise : si on baisse a 3, devient calibrable
  const rows = [makeRow(0.7, 1), makeRow(0.3, 0), makeRow(0.6, 1)];
  const r = computeCalibration(rows, { minResolvedPerSegment: 3 });
  const seg = r.segments[0];
  check(seg.calibrable === true, 'seuil custom : calibrable a partir de 3');
  check(r.anyCalibrable === true, 'seuil custom : anyCalibrable true');
}

// ============================================================
// SUITE 3 - Segmentation par version
// ============================================================

console.log('\n[Suite 3] Segmentation par version stamp');

{
  // Deux versions : V1 (10 rows parfaites) + V2 (5 rows inverses)
  const rows: CalibrationInput[] = [];
  for (let i = 0; i < 10; i++) rows.push(makeRow(1.0, 1, STAMP_V1));
  for (let i = 0; i < 5; i++) rows.push(makeRow(0.9, 0, STAMP_V2));
  const r = computeCalibration(rows);

  check(r.segments.length === 2, 'segments : V1 et V2 separes');

  const segV1 = r.segments.find(s => s.segmentKey.commitSha === 'aaa');
  const segV2 = r.segments.find(s => s.segmentKey.commitSha === 'bbb');
  check(!!segV1, 'segments : V1 present');
  check(!!segV2, 'segments : V2 present');

  if (segV1 && segV1.calibrable === true) {
    checkClose(segV1.brier, 0, 1e-9, 'V1 (10 parfaites) : Brier = 0');
  } else {
    check(false, 'V1 attendu calibrable a 10');
  }
  if (segV2 && segV2.calibrable === false) {
    check(segV2.reason === 'insufficient-data', 'V2 (5) : insufficient-data');
    check(segV2.resolvedCount === 5, 'V2 : count 5');
  } else {
    check(false, 'V2 attendu non calibrable a 5');
  }
}

{
  // Verifie que deux records avec commitSha distinct mais MEMES autres
  // hashes sont bien dans des segments separes : le commitSha seul
  // suffit a separer.
  const stampA: StampFingerprintKey = { commitSha: 'a1', configsHash: 'c', enginesHash: 'e', modelsHash: 'm' };
  const stampB: StampFingerprintKey = { commitSha: 'b1', configsHash: 'c', enginesHash: 'e', modelsHash: 'm' };
  const rows = [makeRow(0.7, 1, stampA), makeRow(0.7, 1, stampB)];
  const r = computeCalibration(rows);
  check(r.segments.length === 2, 'commitSha differe : segments separes');
}

{
  // Et l inverse : meme commitSha, meme tout, deux records -> meme segment.
  const rows = [makeRow(0.7, 1, STAMP_V1), makeRow(0.3, 0, STAMP_V1)];
  const r = computeCalibration(rows);
  check(r.segments.length === 1, 'meme stamp : meme segment');
  check(r.segments[0].resolvedCount === 2, 'meme stamp : count 2');
}

// ============================================================
// SUITE 4 - Courbe de calibration
// ============================================================

console.log('\n[Suite 4] Courbe de calibration');

{
  // Predictions a 0.3 (issue 1 trois fois sur 10) et a 0.7 (issue 1
  // sept fois sur 10) : le modele est parfaitement calibre, la courbe
  // doit confirmer.
  const rows: CalibrationInput[] = [];
  for (let i = 0; i < 10; i++) rows.push(makeRow(0.3, i < 3 ? 1 : 0));
  for (let i = 0; i < 10; i++) rows.push(makeRow(0.7, i < 7 ? 1 : 0));
  const r = computeCalibration(rows);
  const seg = r.segments[0];
  check(seg.calibrable === true, 'courbe : calibrable');
  if (seg.calibrable === true) {
    // Avec 10 bins (0.1 de largeur), 0.3 tombe dans [0.3, 0.4) et 0.7 dans
    // [0.7, 0.8). Donc deux bins non vides.
    check(seg.bins.length === 2, 'courbe : 2 bins non vides');
    const bin30 = seg.bins.find(b => b.binLower === 0.3);
    const bin70 = seg.bins.find(b => b.binLower === 0.7);
    check(!!bin30 && !!bin70, 'courbe : bins 0.3 et 0.7 presents');
    if (bin30) {
      checkClose(bin30.meanPredicted, 0.3, 1e-9, 'bin 0.3 : meanPredicted = 0.3');
      checkClose(bin30.observedFrequency, 0.3, 1e-9, 'bin 0.3 : observedFrequency = 0.3');
      check(bin30.count === 10, 'bin 0.3 : count 10');
    }
    if (bin70) {
      checkClose(bin70.observedFrequency, 0.7, 1e-9, 'bin 0.7 : observedFrequency = 0.7');
    }
  }
}

// ============================================================
// SUITE 5 - Variante mixed (avec non-resolus)
// ============================================================

console.log('\n[Suite 5] computeCalibrationFromMixed');

{
  const inputs = [
    { predicted: 0.8, observed: 1 as const, stampFingerprint: STAMP_V1 },
    { predicted: 0.2, observed: 0 as const, stampFingerprint: STAMP_V1 },
    { predicted: 0.5, observed: null, stampFingerprint: STAMP_V1 },
    { predicted: 0.9, observed: null, stampFingerprint: STAMP_V1 },
  ];
  const r = computeCalibrationFromMixed(inputs, { minResolvedPerSegment: 2 });
  check(r.totalResolved === 2, 'mixed : totalResolved = 2');
  check(r.totalUnresolved === 2, 'mixed : totalUnresolved = 2');
  check(r.segments.length === 1, 'mixed : un segment');
  check(r.segments[0].calibrable === true, 'mixed : calibrable a partir de 2');
}

// ============================================================
// SUITE 6 - Edge cases
// ============================================================

console.log('\n[Suite 6] Edge cases');

{
  // Aucun record
  const r = computeCalibration([]);
  check(r.segments.length === 0, 'vide : aucun segment');
  check(r.anyCalibrable === false, 'vide : anyCalibrable false');
  check(r.totalResolved === 0, 'vide : totalResolved 0');
}

{
  // Predictions clippees dans [0, 1] : on accepte des inputs hors borne
  // mais on les ramene avant de bucket. Le score se calcule sur la
  // valeur brute, c est le bucket qui clamp. Verifions juste que ca
  // ne crash pas et que la calibration retourne un bin.
  const rows: CalibrationInput[] = [];
  for (let i = 0; i < 12; i++) rows.push(makeRow(1.2, 1));
  const r = computeCalibration(rows);
  const seg = r.segments[0];
  check(seg.calibrable === true, 'hors borne : calibrable');
  if (seg.calibrable === true) {
    check(seg.bins.length === 1, 'hors borne : un bin (dernier)');
    check(seg.bins[0].binUpper === 1.0, 'hors borne : clampe dans dernier bin');
  }
}

{
  // Toutes les issues identiques : discrimination definie a 0.5
  const rows: CalibrationInput[] = [];
  for (let i = 0; i < 12; i++) rows.push(makeRow(0.7, 1));
  const r = computeCalibration(rows);
  const seg = r.segments[0];
  if (seg.calibrable === true) {
    checkClose(seg.discrimination, 0.5, 1e-9, 'tout succes : discrimination = 0.5');
  } else {
    check(false, 'tout succes : devrait etre calibrable a 12');
  }
}

// ============================================================
// RESUME
// ============================================================

console.log(`\nResultats : ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
