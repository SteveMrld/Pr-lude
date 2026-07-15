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
  // Rationale sans revenu absolu, fallback min(nowYear, maxProjection)
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
  check(cs.length === 1, 'fallback : baseYear = min(2026, 2028) = 2026');
  check(cs[0]?.baseYearOfCalculation === 2026, '  baseYear = 2026');
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
