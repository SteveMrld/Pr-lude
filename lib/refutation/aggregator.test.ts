// ============================================================
// Tests deterministes aggregator.ts
// ------------------------------------------------------------
// Suite 1 : TOLSON, cas positif combine, verdict-signal + 2
//           label-calc, numeric silencieux.
// Suite 2 : dossier sain, silence total.
// Suite 3 : structures invalides et gardes.
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import { aggregateRefutations } from './aggregator';

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - TOLSON : cas positif combine
// ------------------------------------------------------------
// Compose une fixture combinee des deux fixtures TOLSON existantes
// (verdict-signal + label-calc). numeric-contradictions reste
// silencieux car aucun conflit chiffre n a ete detecte sur TOLSON
// dans la brique 1 (fixture tolson.fixture.json coherente).
// ============================================================

console.log('\n[Suite 1] TOLSON combine : verdict-signal + 2 label-calc');
{
  const verdictSignalFixture = JSON.parse(
    readFileSync(join(__dirname, 'fixtures/tolson-verdict-signal.fixture.json'), 'utf-8'),
  );
  const labelCalcFixture = JSON.parse(
    readFileSync(join(__dirname, 'fixtures/tolson-label-calc.fixture.json'), 'utf-8'),
  );
  // Fusion des deux fixtures en un result_json TOLSON reconstruit
  const tolson = {
    ...labelCalcFixture,
    relevanceMatrix: verdictSignalFixture.relevanceMatrix,
    extraction: {
      ...labelCalcFixture.extraction,
      yearFounded: verdictSignalFixture.extraction.yearFounded,
      traction: verdictSignalFixture.extraction.traction,
    },
  };
  const refs = aggregateRefutations(tolson, {
    nowYear: 2026,
    sourceFilename: 'TOLSON - Information Memorandum - 2024.11.25 - vF.pdf',
  });
  check(refs.length === 3, `TOLSON combine : 3 contradictions attendues (obtenu ${refs.length})`);
  const families = refs.map(r => r.family);
  check(families.filter(f => f === 'verdict-signal').length === 1, '  1 verdict-signal');
  check(families.filter(f => f === 'label-calc').length === 2, '  2 label-calc');
  check(families.filter(f => f === 'numeric').length === 0, '  0 numeric (fixture coherente)');
  const labelCalcKinds = refs.filter(r => r.family === 'label-calc').map(r => r.ruleId).sort();
  check(labelCalcKinds.includes('label-calc:ruleOf40'), '  label-calc:ruleOf40 present');
  check(labelCalcKinds.includes('label-calc:revenuePerEmployee'), '  label-calc:revenuePerEmployee present');
  for (const r of refs) {
    check(typeof r.claim === 'string' && r.claim.length > 0, `  ${r.ruleId} : claim non vide`);
    check(typeof r.contradiction === 'string' && r.contradiction.length > 0, `  ${r.ruleId} : contradiction non vide`);
    check(typeof r.tension === 'string' && r.tension.length > 0, `  ${r.ruleId} : tension non vide`);
    check(typeof r.source === 'string' && r.source.startsWith('refutation.'), `  ${r.ruleId} : source trace`);
  }
}

// ============================================================
// SUITE 2 - Dossier sain : silence total
// ============================================================

console.log('\n[Suite 2] Dossier sain : silence total');
{
  const healthy = {
    financialData: { revenueProjection: [{ year: '2024', value: 1.0 }], rawNotes: 'Chiffres 2024A.' },
    extraction: {
      companyName: 'HealthyCo',
      yearFounded: 2023,
      rawSummary: 'Jeune boite 2024A.',
      traction: { customers: '5 clients', metrics: ['ARR 400 k€'] },
    },
    market: { defensibility: { aiReplicability: { verdict: 'protected', reasoning: 'donnees proprietaires' } } },
    indicators: {
      indicators: [
        {
          key: 'ruleOf40', label: 'Rule of 40 (forward 2024)', value: 60, unit: '%',
          verdict: 'sain', rationale: 'Projection 2024 : croissance + marge = 60%.',
        },
      ],
    },
  };
  const refs = aggregateRefutations(healthy, { nowYear: 2024 });
  check(refs.length === 0, `dossier sain : 0 contradiction (obtenu ${refs.length})`);
}

// ============================================================
// SUITE 3 - Gardes
// ============================================================

console.log('\n[Suite 3] Gardes');
{
  check(aggregateRefutations(null).length === 0, 'null : silencieux');
  check(aggregateRefutations(undefined as any).length === 0, 'undefined : silencieux');
  check(aggregateRefutations({}).length === 0, 'objet vide : silencieux');
  check(aggregateRefutations('string' as any).length === 0, 'primitif : silencieux');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
