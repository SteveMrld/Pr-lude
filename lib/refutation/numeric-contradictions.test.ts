// ============================================================
// Tests deterministes numeric-contradictions.ts (V2)
// ------------------------------------------------------------
// - Non-regression V1 / V1.1 : TOLSON reste silencieux, arrondis
//   sous seuils, structures invalides, faux positifs bloques.
// - Metriques V2 : ebitda, revenue, opex, fcf, grossMargin,
//   headcount, chacune avec cas positif et negatif.
// - Sources prose V2 : rawSummary, rawNotes, indicators.synthesis,
//   valuation.synthesis, indicators.indicators[].rationale.
// - Prose-vs-prose : deux champs distincts sur meme (metric,
//   period, qualifier), valeurs divergentes -> signale ;
//   qualifiers differents -> non signale.
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectNumericContradictions,
  TOLERANCES,
  type NumericContradiction,
} from './numeric-contradictions';

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Non-regression TOLSON : silencieux
// ============================================================
console.log('\n[Suite 1] TOLSON reste silencieux (fixture reelle)');
{
  const tolson = JSON.parse(readFileSync(join(__dirname, 'fixtures/tolson.fixture.json'), 'utf-8'));
  const c = detectNumericContradictions(tolson);
  check(c.length === 0, `TOLSON : 0 contradiction (obtenu ${c.length})`);
}

// ============================================================
// SUITE 2 - Cas cible EBITDA prose-vs-table (mêmes qualifiers)
// ============================================================
console.log('\n[Suite 2] EBITDA 2024A prose vs source=bp divergent : signale');
{
  const rj = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    extraction: { rawSummary: 'EBITDA de 250 k€ en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].kind === 'table-vs-prose', `1 contradiction table-vs-prose`);
  if (c[0]) {
    check(c[0].metric === 'ebitda' && c[0].qualifier === 'A', `metric=ebitda, qualifier=A`);
    check(c[0].unit === 'keur' && c[0].absoluteDelta === 55, `delta=55 k€`);
  }
}

// ============================================================
// SUITE 3 - Structures invalides et absences
// ============================================================
console.log('\n[Suite 3] Structures invalides');
check(detectNumericContradictions(null).length === 0, `null : 0`);
check(detectNumericContradictions(undefined).length === 0, `undefined : 0`);
check(detectNumericContradictions({}).length === 0, `{} : 0`);
check(detectNumericContradictions({ financialData: null }).length === 0, `financialData null : 0`);

// ============================================================
// SUITE 4 - Metriques monetaires elargies (opex, fcf)
// ============================================================
console.log('\n[Suite 4] OPEX et FCF (metriques monetaires ajoutees)');
{
  // OPEX : cas positif same qualifier
  const rj = {
    financialData: { opexProjection: [{ year: '2024', value: 1.5, source: 'bp' }] },
    extraction: { rawSummary: 'OPEX de 1 200 k€ en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].metric === 'opex', `OPEX 2024A prose 1200 vs table 1500 : 1 contradiction`);
}
{
  // OPEX : cas negatif mismatch qualifier
  const rj = {
    financialData: { opexProjection: [{ year: '2024', value: 1.5, source: 'bp' }] },
    extraction: { rawSummary: 'OPEX de 1 200 k€ en 2024B.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `OPEX prose B + table source=bp (A) : 0 contradiction (mismatch)`);
}
{
  // FCF : cas positif
  const rj = {
    financialData: { fcfProjection: [{ year: '2024', value: 0.5, source: 'deck' }] },
    extraction: { rawSummary: 'FCF de 200 k€ en 2024B.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].metric === 'fcf', `FCF 2024B prose 200 vs table 500 : 1 contradiction`);
}
{
  // FCF avec variante "flux de tresorerie"
  const rj = {
    financialData: { fcfProjection: [{ year: '2024', value: 0.5, source: 'deck' }] },
    extraction: { rawSummary: 'Flux de tresorerie libre de 200 k€ en 2024B.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].metric === 'fcf', `variante "flux de tresorerie" : 1 contradiction`);
}

// ============================================================
// SUITE 5 - Marge brute (comparaison en points de %)
// ============================================================
console.log('\n[Suite 5] Marge brute : comparaison en points de %');
{
  // Table 0.72 (72 points), prose "72 %" : coherent (0 diff)
  const rj = {
    financialData: { grossMarginProjection: [{ year: '2024', value: 0.72, source: 'bp' }] },
    extraction: { rawSummary: 'Marge brute de 72 % en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `72% prose = 0.72 table : 0 contradiction (normalisation OK)`);
}
{
  // Table 0.72 (72 points), prose "72,5 %" : diff 0.5 point -> sous seuil abs=1
  const rj = {
    financialData: { grossMarginProjection: [{ year: '2024', value: 0.72, source: 'bp' }] },
    extraction: { rawSummary: 'Marge brute de 72,5 % en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `72,5% vs 72 : diff 0,5 pt sous seuil abs=1 pt : 0`);
}
{
  // Table 0.72, prose "80 %" : diff 8 points > seuil, rel 10% > 3% -> signale
  const rj = {
    financialData: { grossMarginProjection: [{ year: '2024', value: 0.72, source: 'bp' }] },
    extraction: { rawSummary: 'Marge brute de 80 % en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].unit === 'percentage_points', `80% vs 72% : 1 contradiction (8 pts, 10% rel)`);
}
{
  // Marge sans % explicite en prose : NON matche (pas de faux
  // positif sur "0,72" qui pourrait etre 72% ou 0,72%).
  const rj = {
    financialData: { grossMarginProjection: [{ year: '2024', value: 0.72, source: 'bp' }] },
    extraction: { rawSummary: 'Marge brute de 0,72 en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `marge sans % explicite : 0 contradiction (pas de matching implicite)`);
}
{
  // Marge, mismatch qualifier
  const rj = {
    financialData: { grossMarginProjection: [{ year: '2024', value: 0.72, source: 'bp' }] },
    extraction: { rawSummary: 'Marge brute de 80 % en 2024B.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `marge prose B + table source=bp (A) : 0 contradiction`);
}

// ============================================================
// SUITE 6 - Headcount (comparaison en personnes)
// ============================================================
console.log('\n[Suite 6] Headcount : comparaison en effectif entier');
{
  const rj = {
    financialData: { headcount: [{ year: '2024', value: 14, source: 'bp' }] },
    extraction: { rawSummary: 'Effectif de 14 personnes en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `14 vs 14 : 0 contradiction`);
}
{
  const rj = {
    financialData: { headcount: [{ year: '2024', value: 14, source: 'bp' }] },
    extraction: { rawSummary: 'Effectif de 20 personnes en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].metric === 'headcount', `14 vs 20 : 1 contradiction (diff 6, rel 30%)`);
}
{
  // 14 vs 15 : diff 1 (au seuil), rel 6.7% > 5% -> attention borne
  // seuil abs = 1 strict (>1) : diff 1 NE PASSE PAS. Non signale.
  const rj = {
    financialData: { headcount: [{ year: '2024', value: 14, source: 'bp' }] },
    extraction: { rawSummary: 'Effectif de 15 personnes en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `14 vs 15 : diff 1 non strict > seuil abs 1 : 0 contradiction`);
}
{
  // Variante unite ETP
  const rj = {
    financialData: { headcount: [{ year: '2024', value: 14, source: 'bp' }] },
    extraction: { rawSummary: 'Effectif de 20 ETP en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1, `variante ETP : 1 contradiction`);
}
{
  // Nombre sans unite headcount explicite : NON matche
  // ("300 clients" ne doit pas etre confondu avec effectif).
  const rj = {
    financialData: { headcount: [{ year: '2024', value: 14, source: 'bp' }] },
    extraction: { rawSummary: 'Effectif 2024A de 300 clients.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `"300 clients" pas d unite headcount : 0 contradiction`);
}

// ============================================================
// SUITE 7 - Sources prose etendues (rawNotes, indicators, valuation)
// ============================================================
console.log('\n[Suite 7] Sources prose etendues');
{
  // Contradiction dans indicators.synthesis vs table
  const rj = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    indicators: {
      synthesis: 'Le profil montre un EBITDA de 250 k€ en 2024A.',
      indicators: [],
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].left.location.startsWith('financialData'), `indicators.synthesis lu, contradiction detectee`);
  check(c[0]?.right.location === 'indicators.synthesis', `right location = indicators.synthesis`);
}
{
  // Contradiction dans valuation.synthesis vs table
  const rj = {
    financialData: { revenueProjection: [{ year: '2024', value: 1.6, source: 'bp' }] },
    valuation: {
      synthesis: 'Le chiffre d\'affaires 2024A ressort a 900 k€.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].right.location === 'valuation.synthesis', `valuation.synthesis lu`);
}
{
  // Contradiction dans indicators.indicators[i].rationale vs table
  const rj = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    indicators: {
      indicators: [
        { rationale: 'EBITDA 2024A affiche 250 k€.' },
        { rationale: 'Rien a signaler.' },
      ],
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1 && c[0].right.location === 'indicators.indicators[0].rationale', `indicators[i].rationale lu`);
}
{
  // financialData.rawNotes qui documente A vs B ne re-signale PAS
  // (regle qualifier).
  const rj = {
    financialData: {
      ebitdaProjection: [{ year: '2024', value: 0.305, source: 'deck+bp' }],
      rawNotes: 'L EBITDA 2024A (305 k€) diffère du chiffre 2024B (293 k€).',
    },
    extraction: { rawSummary: 'EBITDA de 293 k€ en 2024B.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `rawNotes documente A vs B : 0 contradiction re-signalee`);
}

// ============================================================
// SUITE 8 - Prose vs prose (nouveau axe)
// ============================================================
console.log('\n[Suite 8] Prose vs prose');
{
  // rawSummary et indicators.synthesis en desaccord, memes
  // qualifiers null -> signale prose-vs-prose (une contradiction,
  // pas de table pour matcher).
  const rj = {
    extraction: { rawSummary: 'EBITDA en 2024 de 293 k€.' },
    indicators: {
      synthesis: 'EBITDA en 2024 de 250 k€.',
      indicators: [],
    },
  };
  const c = detectNumericContradictions(rj);
  const proseVsProse = c.filter(x => x.kind === 'prose-vs-prose');
  check(proseVsProse.length === 1, `2 proses divergents same period same qualifier null : 1 contradiction prose-vs-prose`);
}
{
  // Deux proses avec qualifiers differents : non signale
  const rj = {
    extraction: { rawSummary: 'EBITDA de 293 k€ en 2024B.' },
    indicators: {
      synthesis: 'EBITDA de 305 k€ en 2024A.',
      indicators: [],
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `2 proses A vs B : 0 contradiction (mismatch qualifier)`);
}
{
  // Deux proses same qualifier B, valeurs divergentes : signale
  const rj = {
    extraction: { rawSummary: 'EBITDA de 293 k€ en 2024B.' },
    valuation: { synthesis: 'EBITDA 2024B ressort a 400 k€.' },
  };
  const c = detectNumericContradictions(rj);
  const proseVsProse = c.filter(x => x.kind === 'prose-vs-prose');
  check(proseVsProse.length === 1, `2 proses same qualifier B divergent : 1 contradiction prose-vs-prose`);
}
{
  // Deux proses same qualifier E : signale (pas de mapping table
  // pour E, mais prose-vs-prose ne depend pas de la table).
  const rj = {
    extraction: { rawSummary: 'EBITDA de 250 k€ en 2024E.' },
    indicators: { synthesis: 'EBITDA de 400 k€ en 2024E.', indicators: [] },
  };
  const c = detectNumericContradictions(rj);
  const proseVsProse = c.filter(x => x.kind === 'prose-vs-prose');
  check(proseVsProse.length === 1, `2 proses same qualifier E divergent : 1 contradiction`);
}

// ============================================================
// SUITE 9 - Faux positifs bloques (non-regression V1.1)
// ============================================================
console.log('\n[Suite 9] Faux positifs bloques');
{
  const rj = {
    financialData: { revenueProjection: [{ year: '2024', value: 1.6, source: 'deck' }] },
    extraction: { rawSummary: 'Le chiffre d\'affaires 2024 est estime a 1,6 M€ (CAGR ~22 % depuis 2017).' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `"depuis 2017" ignore : 0 contradiction`);
}
{
  // Unite non reconnue
  const rj = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    extraction: { rawSummary: 'EBITDA de 500 USD en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `unite USD : 0 contradiction`);
}
{
  // Arrondi sous seuil monetaire
  const rj = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    extraction: { rawSummary: 'EBITDA de 306 k€ en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `305 vs 306 : diff 1 sous seuil : 0 contradiction`);
}

// ============================================================
// SUITE 10 - Heuristique de contexte V3 (recadrage)
// ------------------------------------------------------------
// Un cas par classe de faux positifs du repassage V2, tire des
// vrais dossiers. Plus un cas garde essentiel : vraie
// contradiction sans marqueur -> toujours signalee.
// ============================================================
console.log('\n[Suite 10] Heuristique de contexte : recadrage');

{
  // Classe "ajuste / retraite" : HEI EBITDA 2014 ajuste
  const rj = {
    financialData: {
      ebitdaProjection: [{ year: '2014', value: 2.182, source: 'deck' }],
      rawNotes: 'EBITDA ajusté 2014 (retraitement 50% salaires dirigeants + frais direction) : 2,573 M€.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `EBITDA ajusté 2014 (HEI) : 0 contradiction (marqueur "ajusté" exclut)`);
}
{
  // Classe "pro-forma" : Tratel EBITDA pro-forma
  const rj = {
    financialData: {
      ebitdaProjection: [{ year: '2012', value: 5.5, source: 'deck' }],
      rawNotes: 'EBITDA ajusté après retraitements pro-forma (PwC VDD) : 7,6 M€ en 2012.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `EBITDA pro-forma (Tratel) : 0 contradiction (marqueurs "ajusté", "pro-forma", "retraitement")`);
}
{
  // Classe "IFRS" : Bruneau EBITDA IFRS
  const rj = {
    financialData: {
      ebitdaProjection: [{ year: '2013', value: 27.6, source: 'deck' }],
      rawNotes: 'EBITDA IFRS 2013-2016 sont : 25,6 M€ en 2013.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `EBITDA IFRS (Bruneau) : 0 contradiction (marqueur "IFRS")`);
}
{
  // Classe "perimetre geographique" : Bruneau CA France
  const rj = {
    financialData: {
      revenueProjection: [{ year: '2013', value: 296, source: 'deck' }],
      rawNotes: 'Chiffre d\'affaires France (Bruneau+Maxiburo) : 224,8 M€ en 2013.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `CA France sous-composante (Bruneau) : 0 contradiction (marqueur "France")`);
}
{
  // Classe "composant inclus" : Bemersive FCF inclut investissement
  const rj = {
    financialData: {
      fcfProjection: [{ year: '2019', value: 1.419, source: 'deck' }],
      rawNotes: 'FCF 2019 inclut un investissement initial de 1 500 K€.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `FCF inclut investissement (Bemersive) : 0 contradiction (marqueur "inclut")`);
}
{
  // Classe "hors X" : Bruneau FCF hors CIT
  const rj = {
    financialData: {
      fcfProjection: [{ year: '2014', value: 2.2, source: 'deck' }],
      rawNotes: 'FCF 2014 ajusté (hors paiement CIT exceptionnel de 9,8 M€).',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `FCF hors CIT (Bruneau) : 0 contradiction (marqueurs "ajusté", "hors")`);
}
{
  // Classe "consolide vs standalone" : Alliance Marine EBITDA total
  const rj = {
    financialData: {
      ebitdaProjection: [{ year: '2020', value: 10, source: 'deck' }],
      rawNotes: 'EBITDA total incluant les acquisitions BP atteint 17,3 M€ en 2020.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 0, `EBITDA post-acquisitions (Alliance Marine) : 0 contradiction (marqueur "incluant")`);
}

// ============================================================
// SUITE 11 - Garde essentielle : vraie contradiction sans marqueur
// ------------------------------------------------------------
// Le filtre ne doit PAS rendre sourd aux vraies contradictions.
// Meme metrique, meme periode, meme qualifier, aucun marqueur de
// recadrage, valeurs divergentes -> toujours signale.
// ============================================================
console.log('\n[Suite 11] Vraies contradictions preservees');
{
  // Rien qui ressemble a un marqueur, juste deux valeurs qui
  // divergent
  const rj = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    extraction: { rawSummary: 'EBITDA de 250 k€ en 2024A.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1, `vraie contradiction EBITDA 250 vs 305 sans marqueur : 1 (preservee)`);
}
{
  // Cas Bruneau grossMargin table 53 vs prose "53 %" : bug amont
  // pipeline, la table stocke 53 en % entier au lieu du ratio.
  // Aucun marqueur de recadrage dans la prose ("marge brute
  // groupe (gross margin) est de 53,0% en 2011"). Le detecteur
  // doit signaler ce cas.
  const rj = {
    financialData: {
      grossMarginProjection: [{ year: '2011', value: 53, source: 'deck' }],
      rawNotes: 'La marge brute groupe (gross margin) est de 53,0% en 2011.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1, `marge brute Bruneau (bug qualite table) : 1 contradiction (signal legitime bug amont)`);
}
{
  // Chiffre d affaires 2024 sans qualificatif : contradiction
  // preservee.
  const rj = {
    financialData: { revenueProjection: [{ year: '2024', value: 1.6, source: 'bp' }] },
    extraction: { rawSummary: 'Chiffre d\'affaires 2024A de 2 000 k€.' },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1, `revenue 2000 vs 1600 sans marqueur : 1 (preservee)`);
}

// ============================================================
// SUITE 12 - Bornage phrase : marqueur d une AUTRE phrase ne
// filtre pas la mention courante
// ============================================================
console.log('\n[Suite 12] Bornage phrase');
{
  // Marqueur "ajuste" dans une phrase separee : ne doit PAS
  // exclure la mention de la phrase precedente.
  const rj = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    extraction: {
      rawSummary: 'EBITDA de 250 k€ en 2024A. Il existe aussi un EBITDA ajusté pour reference.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1, `marqueur "ajuste" dans phrase suivante : contradiction preservee (borne au point)`);
}
{
  // Meme test avec point-virgule
  const rj = {
    financialData: { ebitdaProjection: [{ year: '2024', value: 0.305, source: 'bp' }] },
    extraction: {
      rawSummary: 'EBITDA de 250 k€ en 2024A ; par ailleurs un EBITDA ajusté existe pour reference.',
    },
  };
  const c = detectNumericContradictions(rj);
  check(c.length === 1, `marqueur "ajuste" apres point-virgule : contradiction preservee`);
}

// ============================================================
console.log(`\nResultats : ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
