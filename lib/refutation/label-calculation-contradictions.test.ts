// ============================================================
// Tests deterministes label-calculation-contradictions.ts (V1)
// ------------------------------------------------------------
// Suite 1 : TOLSON, cas positif obligatoire, doit signaler
//           ruleOf40 et revenuePerEmployee.
// Suite 2 : cas negatifs, coherence label-calcul, silencieux.
// Suite 3 : cas de garde, refYear indeductible, silencieux.
// Suite 4 : detection refYear par cascades, priorite verifiee.
// Suite 5 : detection baseYear, cross-check revenueProjection.
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectLabelCalculationContradictions,
  detectDossierRefYear,
  FORWARD_QUALIFIER_REGEX,
} from './label-calculation-contradictions';

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Cas positif obligatoire : TOLSON
// ============================================================

console.log('\n[Suite 1] TOLSON : ruleOf40 + revenuePerEmployee signales');
{
  const tolson = JSON.parse(readFileSync(join(__dirname, 'fixtures/tolson-label-calc.fixture.json'), 'utf-8'));
  const cs = detectLabelCalculationContradictions(tolson, {
    nowYear: 2026,
    sourceFilename: 'TOLSON (codename Project Tagora) - Information Memorandum - 2024.11.25 - vF.pdf',
  });
  check(cs.length === 2, `TOLSON signale 2 contradictions (obtenu ${cs.length})`);
  const keys = cs.map(c => c.indicatorKey).sort();
  check(keys.includes('ruleOf40'), '  ruleOf40 signale');
  check(keys.includes('revenuePerEmployee'), '  revenuePerEmployee signale');
  for (const c of cs) {
    check(c.dossierRefYear === 2024, `  ${c.indicatorKey} : refYear=2024 (via lastActualYear)`);
    check(c.baseYearOfCalculation === 2026, `  ${c.indicatorKey} : baseYear=2026`);
    check(c.yearsForward === 2, `  ${c.indicatorKey} : 2 ans forward`);
  }
}

// ============================================================
// SUITE 2 - Cas negatifs, coherence label-calcul
// ============================================================

console.log('\n[Suite 2] Cas negatifs, silencieux');

{
  // Label deja qualifie forward, silencieux
  const rj = {
    financialData: {
      revenueProjection: [{ year: '2024', value: 1.0 }, { year: '2026', value: 3.0 }],
      rawNotes: 'EBITDA 2024A confirme, projection 2026E ambitieuse.',
    },
    extraction: { rawSummary: 'Deck 2024.' },
    indicators: {
      indicators: [
        {
          key: 'ruleOf40', label: 'Rule of 40 (forward 2026)', value: 100, unit: '%', verdict: 'best-in-class',
          rationale: 'Base projection 2026 : croissance 200% + marge 10% = 210%.',
        },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'label "Rule of 40 (forward 2026)" : silencieux, qualification presente');
}

{
  // Rationale contient "projete" : silencieux
  const rj = {
    financialData: {
      revenueProjection: [{ year: '2024', value: 1.0 }, { year: '2026', value: 3.0 }],
      rawNotes: '2024A vs 2026E documentes.',
    },
    indicators: {
      indicators: [
        {
          key: 'revenuePerEmployee', label: 'Revenue par employé', value: 200000, unit: 'EUR/FTE', verdict: 'sain',
          rationale: 'Revenue projete 3M€ / 15 ETP = 200k€ par employe.',
        },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'rationale contient "projete" : silencieux');
}

{
  // baseYear == refYear, coherent
  const rj = {
    financialData: {
      revenueProjection: [{ year: '2024', value: 1.6 }],
      rawNotes: 'Chiffres 2024A.',
    },
    indicators: {
      indicators: [
        { key: 'ruleOf40', label: 'Rule of 40', value: 50, unit: '%', verdict: 'sain', rationale: 'YoY + Marge = 50%.' },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2024 });
  check(cs.length === 0, 'baseYear==refYear==2024 : silencieux');
}

{
  // Indicateur non applicable, silencieux
  const rj = {
    financialData: {
      revenueProjection: [{ year: '2024', value: 1.0 }, { year: '2026', value: 3.0 }],
      rawNotes: '2024A.',
    },
    indicators: {
      indicators: [
        { key: 'ruleOf40', label: 'Rule of 40', value: null, unit: '%', verdict: 'non-applicable', rationale: 'donnees absentes' },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'indicateur non-applicable : silencieux');
}

{
  // Indicateur pas dans TARGETED_KEYS (grossMargin) : silencieux meme si baseYear > refYear
  const rj = {
    financialData: {
      revenueProjection: [{ year: '2024', value: 1.0 }, { year: '2026', value: 3.0 }],
      rawNotes: '2024A.',
    },
    indicators: {
      indicators: [
        { key: 'grossMargin', label: 'Marge brute', value: 95, unit: '%', verdict: 'best-in-class', rationale: 'Marge 95%.' },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'grossMargin hors TARGETED_KEYS V1 : silencieux');
}

// ============================================================
// SUITE 3 - Cas de garde
// ============================================================

console.log('\n[Suite 3] Cas de garde');

{
  // Aucune reference annee detectable, silencieux meme si projection future
  const rj = {
    financialData: {
      revenueProjection: [{ year: '2026', value: 3.0 }],
      rawNotes: 'Chiffres sans qualifier',
    },
    indicators: {
      indicators: [
        { key: 'ruleOf40', label: 'Rule of 40', value: 50, unit: '%', verdict: 'sain', rationale: 'YoY + Marge = 50%.' },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'refYear indeductible : silencieux (pas d invention)');
}

{
  check(detectLabelCalculationContradictions(null, { nowYear: 2026 }).length === 0, 'null : silencieux');
  check(detectLabelCalculationContradictions(undefined as any, { nowYear: 2026 }).length === 0, 'undefined : silencieux');
  check(detectLabelCalculationContradictions({}, { nowYear: 2026 }).length === 0, 'objet vide : silencieux');
  check(detectLabelCalculationContradictions('string' as any, { nowYear: 2026 }).length === 0, 'type primitif : silencieux');
}

{
  // indicators absent, silencieux
  const rj = { financialData: { revenueProjection: [{ year: '2024', value: 1 }], rawNotes: '2024A' } };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'indicators absent : silencieux');
}

// ============================================================
// SUITE 4 - refYear derive de lastActualYear (brique 11)
// ------------------------------------------------------------
// L ancienne cascade (override, as_of, rawNotes max A/B, filename)
// est supprimee. Seule source : financialData.lastActualYear avec
// evidence textuelle. Le wrapper detectDossierRefYear delegue et
// ignore les meta legacy.
// ============================================================

console.log('\n[Suite 4] refYear depuis lastActualYear + evidence');

{
  const rj = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'P&L 2024A audit Deloitte',
    },
  };
  const y = detectDossierRefYear(rj);
  check(y === 2024, 'lastActualYear + evidence => 2024');
}

{
  const rj = { financialData: { lastActualYear: 2024, lastActualYearEvidence: null } };
  const y = detectDossierRefYear(rj);
  check(y === null, 'lastActualYear sans evidence => null');
}

{
  // meta legacy ignore : old options ne changent rien
  const rj = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'clos 31/12/2024',
      rawNotes: '2020A 2021A 2022A',
    },
  };
  const y = detectDossierRefYear(rj, { asOf: '2019-01-01', sourceFilename: '2015.pdf', refYearOverride: 2010 });
  check(y === 2024, 'meta legacy ignoree, seul lastActualYear compte');
}

{
  const rj = { extraction: { rawSummary: 'aucun signal narratif utile' } };
  const y = detectDossierRefYear(rj);
  check(y === null, 'aucun lastActualYear : null');
}

// ============================================================
// SUITE 5 - Detection baseYear via revenueProjection
// ============================================================

console.log('\n[Suite 5] Detection baseYear cross-check revenueProjection');

{
  // Rationale contient revenu 2,75M€, match projection 2026 (2.75)
  const rj = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'exercice clos 2024',
      revenueProjection: [
        { year: '2024', value: 1.6, basis: 'actual' },
        { year: '2026', value: 2.75, basis: 'projected' },
      ],
      rawNotes: '2024A confirme.',
    },
    indicators: {
      indicators: [
        {
          key: 'revenuePerEmployee', label: 'Revenue par employé', value: 152778, unit: 'EUR/FTE',
          verdict: 'rouge', rationale: 'Revenue 2,75M€ / 18 ETP = 153k€ par employé.',
        },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 1, 'revenue 2,75M€ dans rationale => baseYear 2026 via cross-check');
  check(cs[0]?.baseYearOfCalculation === 2026, '  baseYear correct');
}

{
  // Rationale sans grandeur mesurable et sans computedForYear : la
  // brique se tait. C est le cas qui retombait sur min(annee courante,
  // derniere annee de la serie) et annoncait une base 2026 sans qu une
  // seule donnee du dossier ne la designe.
  const rj = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'clos 2024',
      revenueProjection: [
        { year: '2024', value: 1.6, basis: 'actual' },
        { year: '2028', value: 5.0, basis: 'projected' },
      ],
      rawNotes: '2024A.',
    },
    indicators: {
      indicators: [
        { key: 'ruleOf40', label: 'Rule of 40', value: 60, unit: '%', verdict: 'best-in-class', rationale: 'YoY + Marge = 60%.' },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'aucune grandeur mesurable dans le rationale : silencieux');
}

// ============================================================
// SUITE 5 bis - computedForYear prime sur toute reconstruction
// ------------------------------------------------------------
// Le defaut ferme par la brique 22. Le moteur d indicateurs declare
// desormais l annee de calcul dans computedForYear, avec un baseState
// tri-etat a cote. La brique lisait toujours sa prose de sortie et
// retombait sur l horloge, ce qui fabriquait une contradiction sur des
// indicateurs calcules au realise.
// ============================================================

console.log('\n[Suite 5 bis] computedForYear declare par le moteur');

{
  // Cas mesure sur le dossier de reference du corpus : Rule of 40
  // calcule sur 2023, annee de reference du dossier 2023, baseState
  // actual. Aucune contradiction. La reconstruction par horloge
  // annoncait 2026 et signalait trois ans de projection non qualifiee.
  const rj = {
    financialData: {
      lastActualYear: 2023,
      lastActualYearEvidence: "Tableau P&L slide 10 : colonnes 2020 a 2023 qualifiees reel",
      revenueProjection: [
        { year: '2020', value: 0.48, basis: 'actual' },
        { year: '2021', value: 1.56, basis: 'actual' },
        { year: '2022', value: 1.752, basis: 'actual' },
        { year: '2023', value: 1.483, basis: 'actual' },
        { year: '2024', value: 2.113, basis: 'budget' },
        { year: '2025', value: 3.697, basis: 'projected' },
        { year: '2026', value: 6.552, basis: 'projected' },
      ],
    },
    indicators: {
      indicators: [
        {
          key: 'ruleOf40', label: 'Rule of 40', value: -43.8, unit: '%', verdict: 'rouge',
          rationale: 'Croissance YoY -15.4% + Marge EBITDA -28.5% = -43.8%.',
          computedForYear: 2023,
          baseState: 'actual',
        },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'computedForYear=2023 sur refYear=2023 : aucune contradiction fabriquee');
}

{
  // Symetrie : la brique reste capable de signaler quand la base
  // declaree est bien posterieure a l annee de reference.
  const rj = {
    financialData: {
      lastActualYear: 2023,
      lastActualYearEvidence: 'colonne 2023 qualifiee reel',
      revenueProjection: [
        { year: '2023', value: 1.483, basis: 'actual' },
        { year: '2026', value: 6.552, basis: 'projected' },
      ],
    },
    indicators: {
      indicators: [
        {
          key: 'ruleOf40', label: 'Rule of 40', value: 120, unit: '%', verdict: 'best-in-class',
          rationale: 'Croissance YoY 90% + Marge EBITDA 30% = 120%.',
          computedForYear: 2026,
          baseState: 'forward',
        },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 1, 'computedForYear=2026 sur refYear=2023 : contradiction signalee');
  check(cs[0]?.baseYearOfCalculation === 2026, '  baseYear lu dans computedForYear');
  check(cs[0]?.yearsForward === 3, '  trois ans de projection');
}

{
  // computedForYear prime sur la reconstruction : ici la prose
  // designerait 2026 par le taux de croissance, le champ declare 2023.
  // C est le champ qui gagne.
  const rj = {
    financialData: {
      lastActualYear: 2023,
      lastActualYearEvidence: 'colonne 2023 qualifiee reel',
      revenueProjection: [
        { year: '2025', value: 2.0, basis: 'projected' },
        { year: '2026', value: 4.0, basis: 'projected' },
        { year: '2023', value: 1.483, basis: 'actual' },
      ],
    },
    indicators: {
      indicators: [
        {
          key: 'ruleOf40', label: 'Rule of 40', value: 110, unit: '%', verdict: 'best-in-class',
          rationale: 'Croissance YoY 100% + Marge EBITDA 10% = 110%.',
          computedForYear: 2023,
          baseState: 'actual',
        },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'la declaration du moteur bat la reconstruction par la prose');
}

{
  // Chemin legacy : sans computedForYear, le taux de croissance du
  // rationale identifie l annee de calcul. C est ce qui maintient la
  // detection sur les result_json anterieurs au champ, sans horloge.
  const rj = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'P&L 2024A audite',
      revenueProjection: [
        { year: '2024', value: 1.608, basis: 'actual' },
        { year: '2025', value: 2.16, basis: 'projected' },
        { year: '2026', value: 2.75, basis: 'projected' },
      ],
    },
    indicators: {
      indicators: [
        {
          key: 'ruleOf40', label: 'Rule of 40', value: 49.9, unit: '%', verdict: 'best-in-class',
          rationale: 'Croissance YoY 27.3% + Marge FCF 22.5% = 49.9%.',
        },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 1, 'legacy : le taux de croissance 27,3% designe 2026');
  check(cs[0]?.baseYearOfCalculation === 2026, '  baseYear reconstruit a 2026');
}

{
  // La reconstruction est falsifiable : un taux qu aucune paire de la
  // serie ne produit ne designe rien, et la brique se tait.
  const rj = {
    financialData: {
      lastActualYear: 2024,
      lastActualYearEvidence: 'P&L 2024A audite',
      revenueProjection: [
        { year: '2024', value: 1.608, basis: 'actual' },
        { year: '2026', value: 2.75, basis: 'projected' },
      ],
    },
    indicators: {
      indicators: [
        {
          key: 'ruleOf40', label: 'Rule of 40', value: 60, unit: '%', verdict: 'best-in-class',
          rationale: 'Croissance YoY 12.7% + Marge FCF 47.3% = 60%.',
        },
      ],
    },
  };
  const cs = detectLabelCalculationContradictions(rj, { nowYear: 2026 });
  check(cs.length === 0, 'taux introuvable dans la serie : silencieux plutot qu invente');
}

// ============================================================
// SUITE 6 - Regex de qualification
// ============================================================

console.log('\n[Suite 6] FORWARD_QUALIFIER_REGEX');

{
  check(FORWARD_QUALIFIER_REGEX.test('projete'), 'projete match');
  check(FORWARD_QUALIFIER_REGEX.test('projeté'), 'projeté (accent) match');
  check(FORWARD_QUALIFIER_REGEX.test('estime'), 'estime match');
  check(FORWARD_QUALIFIER_REGEX.test('forecast'), 'forecast match');
  check(FORWARD_QUALIFIER_REGEX.test('previsionnel'), 'previsionnel match');
  check(FORWARD_QUALIFIER_REGEX.test('cible 2026'), 'cible match');
  check(FORWARD_QUALIFIER_REGEX.test('2026E'), '2026E qualifier match');
  check(FORWARD_QUALIFIER_REGEX.test('2025F'), '2025F qualifier match');
  check(!FORWARD_QUALIFIER_REGEX.test('Rule of 40'), 'Rule of 40 seul : pas de qualifier');
  check(!FORWARD_QUALIFIER_REGEX.test('Revenue par employé'), 'Revenue par employé : pas de qualifier');
  check(!FORWARD_QUALIFIER_REGEX.test('annee courante'), 'annee courante : pas de qualifier forward');
}

// ============================================================
// SORTIE
// ============================================================

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
