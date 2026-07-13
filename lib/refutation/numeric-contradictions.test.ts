// ============================================================
// Tests deterministes numeric-contradictions.ts
// ------------------------------------------------------------
// Cas positif TOLSON obligatoire (EBITDA 2024 293 vs 305).
// Cas negatifs : dossiers coherents, arrondis sous seuil,
// periodes ou grandeurs distinctes, result_json invalide.
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectNumericContradictions,
  TOLERANCE_ABS_KEUR,
  TOLERANCE_REL,
} from './numeric-contradictions';

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Cas positif TOLSON (contradiction connue EBITDA 2024)
// ============================================================
console.log('\n[Suite 1] TOLSON : EBITDA 2024 293 k€ prose vs 305 k€ table');
{
  const tolson = JSON.parse(readFileSync(join(__dirname, 'fixtures/tolson.fixture.json'), 'utf-8'));
  const contradictions = detectNumericContradictions(tolson);
  check(contradictions.length === 1, `TOLSON : exactement 1 contradiction (obtenu ${contradictions.length})`);
  if (contradictions.length >= 1) {
    const c = contradictions[0];
    check(c.metric === 'ebitda', `TOLSON : metric = ebitda (obtenu ${c.metric})`);
    check(c.period === '2024', `TOLSON : period = 2024 (obtenu ${c.period})`);
    check(c.table.valueKeur === 305, `TOLSON : table = 305 k€ (obtenu ${c.table.valueKeur})`);
    check(c.prose.valueKeur === 293, `TOLSON : prose = 293 k€ (obtenu ${c.prose.valueKeur})`);
    check(c.absoluteDeltaKeur === 12, `TOLSON : delta absolu = 12 k€ (obtenu ${c.absoluteDeltaKeur})`);
    check(Math.abs(c.relativeDelta - 12 / 305) < 1e-9, `TOLSON : delta relatif ~ 3.93%`);
    check(c.table.location === 'financialData.ebitdaProjection[3]', `TOLSON : location table pointe l index 3`);
    check(c.prose.location === 'extraction.rawSummary', `TOLSON : location prose = extraction.rawSummary`);
    check(/EBITDA/i.test(c.prose.rawSnippet), `TOLSON : snippet prose contient EBITDA`);
  }
}

// ============================================================
// SUITE 2 - Dossier coherent : aucune contradiction
// ============================================================
console.log('\n[Suite 2] Dossier coherent');
{
  const coherent = {
    financialData: {
      ebitdaProjection: [
        { year: '2024', value: 0.305, source: 'bp' },
      ],
      revenueProjection: [
        { year: '2024', value: 1.6, source: 'deck' },
      ],
    },
    extraction: {
      rawSummary: 'EBITDA de 305 k€ en 2024. Chiffre d\'affaires 2024 estime a 1,6 M€.',
    },
  };
  const c = detectNumericContradictions(coherent);
  check(c.length === 0, `coherent : 0 contradiction (obtenu ${c.length})`);
}

// ============================================================
// SUITE 3 - Arrondi sous seuil : pas de signalement
// ------------------------------------------------------------
// Diff = 1 k€ (< TOLERANCE_ABS_KEUR = 2). Rel = 0.33% (< 2%).
// Les DEUX seuils sous limite -> NON signale.
// ============================================================
console.log('\n[Suite 3] Arrondis sous seuil');
{
  const rounding = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    extraction: { rawSummary: 'EBITDA de 306 k€ en 2024.' },
  };
  const c = detectNumericContradictions(rounding);
  check(c.length === 0, `arrondi 305 vs 306 : 0 contradiction (diff=1 k€ < seuil abs=${TOLERANCE_ABS_KEUR})`);
}
{
  // Diff = 5 k€ absolu (> 2) mais relatif = 5/1005 = 0.5% (< 2%) -> NON signale
  const rounding2 = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 1.005, source: 'bp' }] },
    extraction: { rawSummary: 'EBITDA de 1000 k€ en 2024.' },
  };
  const c = detectNumericContradictions(rounding2);
  check(c.length === 0, `arrondi 1000 vs 1005 : 0 contradiction (rel=0.5% < seuil rel=${TOLERANCE_REL})`);
}
{
  // Diff = 50 k€ absolu (> 2) mais relatif 50/50=100% -> signaler ? Non non, valeur trop petite.
  // 50 vs 100 : diff = 50, rel = 50/100 = 50% >> 2%. abs=50>2. -> SIGNALE.
  const smallVals = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.1, source: 'bp' }] },
    extraction: { rawSummary: 'EBITDA de 50 k€ en 2024.' },
  };
  const c = detectNumericContradictions(smallVals);
  check(c.length === 1, `100 vs 50 : 1 contradiction (les deux seuils franchis)`);
}

// ============================================================
// SUITE 4 - Periodes differentes : pas de comparaison
// ============================================================
console.log('\n[Suite 4] Periodes differentes');
{
  const diffPeriods = {
    financialData: { ebitdaProjection: [{ year: '2023', value: 0.191, source: 'bp' }] },
    extraction: { rawSummary: 'EBITDA de 305 k€ en 2024.' },
  };
  const c = detectNumericContradictions(diffPeriods);
  check(c.length === 0, `table 2023 vs prose 2024 : 0 contradiction (periodes distinctes)`);
}

// ============================================================
// SUITE 5 - Grandeur differente : pas de croisement
// ============================================================
console.log('\n[Suite 5] Grandeurs differentes');
{
  const diffMetrics = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    extraction: { rawSummary: 'Chiffre d\'affaires 2024 estime a 1 600 k€.' },
  };
  const c = detectNumericContradictions(diffMetrics);
  check(c.length === 0, `EBITDA table + CA prose : 0 contradiction (grandeurs distinctes)`);
}

// ============================================================
// SUITE 6 - Structures invalides : jamais de crash
// ============================================================
console.log('\n[Suite 6] Structures invalides');
{
  check(detectNumericContradictions(null).length === 0, `null : 0 contradiction, pas de crash`);
  check(detectNumericContradictions(undefined).length === 0, `undefined : 0 contradiction`);
  check(detectNumericContradictions({}).length === 0, `objet vide : 0`);
  check(detectNumericContradictions({ financialData: null }).length === 0, `financialData null : 0`);
  check(detectNumericContradictions({ financialData: { ebitdaProjection: 'not-an-array' } }).length === 0, `champ mal type : 0`);
  check(detectNumericContradictions({ extraction: { rawSummary: 'EBITDA de 100 k€ en 2024' } }).length === 0, `pas de table : 0 (rien a comparer)`);
  check(detectNumericContradictions({ financialData: { ebitdaProjection: [{ year: '2024', value: 0.1 }] } }).length === 0, `pas de prose : 0`);
}

// ============================================================
// SUITE 7 - Faux positifs bloques par le double seuil et la
// discipline de proximite
// ============================================================
console.log('\n[Suite 7] Faux positifs bloques');
{
  // "depuis 2017" ne doit PAS etre capture comme annee car pas precede
  // de "en " ni "(". Le CA 2024 doit etre attrape via pattern A.
  const withDepuis = {
    financialData: { revenueProjection: [{ year: '2024', value: 1.6, source: 'deck' }] },
    extraction: {
      rawSummary: 'Le chiffre d\'affaires 2024 est estime a 1,6 M€ (CAGR ~22 % depuis 2017).',
    },
  };
  const c = detectNumericContradictions(withDepuis);
  check(c.length === 0, `"depuis 2017" ignore, CA 2024 = 1,6 M€ coherent : 0 contradiction`);
}
{
  // Un nombre + unite au milieu du texte sans mot-cle metric proche
  // ne doit rien matcher.
  const noMetricNearby = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305 }] },
    extraction: { rawSummary: 'Le ticket vise est de 5 M€. La societe emploie 10 personnes.' },
  };
  const c = detectNumericContradictions(noMetricNearby);
  check(c.length === 0, `nombre sans metric-mot proche : 0 contradiction`);
}
{
  // Unite non reconnue (dollars) ne doit pas matcher
  const wrongUnit = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305 }] },
    extraction: { rawSummary: 'EBITDA de 500 USD en 2024.' },
  };
  const c = detectNumericContradictions(wrongUnit);
  check(c.length === 0, `unite non normalisee (USD) : 0 contradiction (extraction rejette)`);
}

// ============================================================
// SUITE 8 - Normalisation d unite : M€ dans la prose = k€ x 1000
// ============================================================
console.log('\n[Suite 8] Normalisation d unite');
{
  // Prose en M€ vs table en M€ (converti k€) : coherence 305 k€ = 0,305 M€
  const proseInMillions = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305 }] },
    extraction: { rawSummary: 'EBITDA de 0,305 M€ en 2024.' },
  };
  const c = detectNumericContradictions(proseInMillions);
  check(c.length === 0, `prose 0,305 M€ = table 305 k€ : 0 contradiction (normalisation OK)`);
}
{
  // Prose en M€ contradictoire avec table
  const proseInMillionsBad = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305 }] },
    extraction: { rawSummary: 'EBITDA de 0,4 M€ en 2024.' },
  };
  const c = detectNumericContradictions(proseInMillionsBad);
  check(c.length === 1, `prose 0,4 M€ (400 k€) vs table 305 k€ : 1 contradiction`);
}

// ============================================================
// SUITE 9 - Nombres avec separateur de milliers
// ============================================================
console.log('\n[Suite 9] Separateur de milliers');
{
  const withSpaces = {
    financialData: { revenueProjection: [{ year: '2024', value: 1.6 }] },
    extraction: { rawSummary: 'Chiffre d\'affaires 2024 estime a 1 600 k€.' },
  };
  const c = detectNumericContradictions(withSpaces);
  check(c.length === 0, `"1 600 k€" parse en 1600 k€ = 1,6 M€ table : 0 contradiction`);
}

// ============================================================
console.log(`\nResultats : ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
