// ============================================================
// Tests deterministes du module trajectory-store
// ------------------------------------------------------------
// Couvre les helpers de mapping (rowToSnapshot, parsePatternsJson,
// parseCombinaisonsJson) sans toucher a Supabase. Les fonctions
// asynchrones qui passent par le client admin sont testees par
// integration en environnement reel, hors suite deterministe.
//
// Lancement : npx tsx lib/trajectory-store.test.ts
// ============================================================

import {
  __testRowToSnapshot as rowToSnapshot,
  __testParsePatternsJson as parsePatternsJson,
  __testParseCombinaisonsJson as parseCombinaisonsJson,
} from './trajectory-store';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
}

function checkTrue(label: string, actual: boolean): void {
  if (actual) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
  }
}

// ============================================================
// Test 1 : rowToSnapshot mappe correctement une ligne complete
// ============================================================
console.log('\n=== Test 1 : rowToSnapshot ligne complete ===');
{
  const raw = {
    id: 'snap-1',
    analysis_id: 'analysis-1',
    version_id: 'version-1',
    version_num: 2,
    user_id: 'user-1',
    company_name: 'TestCo',
    analyzed_at: '2026-01-15T10:00:00Z',
    global_score: 65,
    verdict: 'approfondir',
    dim_team: 70,
    dim_market: 60,
    dim_macro: 50,
    dim_financial: 80,
    dim_contrarian: 55,
    dim_vigilance: 65,
    fragilite_score: 45,
    fragilite_verdict: 'attention',
    narrative_drift_score: 22,
    narrative_drift_verdict: 'sain',
    patterns_json: {
      'growth-subsidized-model': {
        globalScore: 55,
        verdict: 'attention',
        applicabilite: 'full',
      },
    },
    combinaisons_json: [
      { nom: 'Trajectoire WeWork', severite: 'alerte' },
    ],
    created_at: '2026-01-15T10:00:01Z',
  };
  const s = rowToSnapshot(raw);
  check('analysisId mappe', s.analysisId, 'analysis-1');
  check('versionNum mappe', s.versionNum, 2);
  check('globalScore typed', s.globalScore, 65);
  check('verdict mappe', s.verdict, 'approfondir');
  check('dim_team typed', s.dimensions.team, 70);
  check('dim_macro typed', s.dimensions.macro, 50);
  check('fragiliteScore typed', s.fragiliteScore, 45);
  check('fragiliteVerdict mappe', s.fragiliteVerdict, 'attention');
  check('narrativeDriftScore typed', s.narrativeDriftScore, 22);
  check('patterns parses', s.patterns['growth-subsidized-model'], {
    score: 55,
    verdict: 'attention',
    applicabilite: 'full',
  });
  check('combinaisons parses', s.combinaisons, [{ nom: 'Trajectoire WeWork', severite: 'alerte' }]);
}

// ============================================================
// Test 2 : rowToSnapshot defensive sur valeurs nulles
// ============================================================
console.log('\n=== Test 2 : rowToSnapshot defensive nulls ===');
{
  const raw = {
    id: 'snap-2',
    analysis_id: 'analysis-2',
    version_id: 'version-2',
    version_num: 1,
    user_id: 'user-1',
    company_name: 'EmptyCo',
    analyzed_at: '2026-01-15T10:00:00Z',
    global_score: 50,
    verdict: 'approfondir',
    dim_team: null,
    dim_market: null,
    dim_macro: null,
    dim_financial: null,
    dim_contrarian: null,
    dim_vigilance: null,
    fragilite_score: null,
    fragilite_verdict: null,
    narrative_drift_score: null,
    narrative_drift_verdict: null,
    patterns_json: {},
    combinaisons_json: [],
    created_at: '2026-01-15T10:00:01Z',
  };
  const s = rowToSnapshot(raw);
  check('dim_team null preserve', s.dimensions.team, null);
  check('fragiliteScore null preserve', s.fragiliteScore, null);
  check('fragiliteVerdict null preserve', s.fragiliteVerdict, null);
  check('patterns vides', s.patterns, {});
  check('combinaisons vides', s.combinaisons, []);
}

// ============================================================
// Test 3 : parsePatternsJson tolere entrees malformees
// ============================================================
console.log('\n=== Test 3 : parsePatternsJson defensive ===');
{
  const p1 = parsePatternsJson(null);
  check('null retourne map vide', p1, {});

  const p2 = parsePatternsJson('not an object');
  check('string retourne map vide', p2, {});

  const p3 = parsePatternsJson({
    'growth-subsidized-model': {
      globalScore: 60,
      verdict: 'alerte',
      applicabilite: 'full',
    },
    'fixed-cost-trap': {
      applicabilite: 'not-applicable',
    },
    'malformed-no-score': {
      verdict: 'sain',
    },
  });
  check('pattern applicable parse', p3['growth-subsidized-model'], {
    score: 60,
    verdict: 'alerte',
    applicabilite: 'full',
  });
  check('pattern not-applicable parse', p3['fixed-cost-trap'], {
    score: 0,
    verdict: 'non-applicable',
    applicabilite: 'not-applicable',
  });
  checkTrue('pattern sans score ignore', !('malformed-no-score' in p3));
}

// ============================================================
// Test 4 : parseCombinaisonsJson filtre entrees malformees
// ============================================================
console.log('\n=== Test 4 : parseCombinaisonsJson defensive ===');
{
  const c1 = parseCombinaisonsJson(null);
  check('null retourne array vide', c1, []);

  const c2 = parseCombinaisonsJson('not an array');
  check('string retourne array vide', c2, []);

  const c3 = parseCombinaisonsJson([
    { nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' },
    { nom: '', severite: 'alerte' },
    { severite: 'attention' },
    { nom: 'Pattern Northvolt' },
    { nom: 'Wrapper sans differenciation', severite: 'alerte' },
  ]);
  check('combinaisons valides extraites', c3, [
    { nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' },
    { nom: 'Wrapper sans differenciation', severite: 'alerte' },
  ]);
}

// ============================================================
// Test 5 : rowToSnapshot accepte scores en string Postgres
// ============================================================
console.log('\n=== Test 5 : conversion numeric Postgres ===');
{
  // Postgres NUMERIC type est parfois retourne comme string par
  // certains clients. rowToSnapshot doit absorber cette variation.
  const raw = {
    id: 'snap-3',
    analysis_id: 'analysis-3',
    version_id: 'version-3',
    version_num: 1,
    user_id: 'user-1',
    company_name: 'NumericCo',
    analyzed_at: '2026-01-15T10:00:00Z',
    global_score: '72.5',
    verdict: 'investir avec conditions',
    dim_team: '80',
    dim_market: '65',
    dim_macro: '70',
    dim_financial: '75',
    dim_contrarian: '60',
    dim_vigilance: '78',
    fragilite_score: '38',
    fragilite_verdict: 'sain',
    narrative_drift_score: '15',
    narrative_drift_verdict: 'sain',
    patterns_json: {},
    combinaisons_json: [],
    created_at: '2026-01-15T10:00:01Z',
  };
  const s = rowToSnapshot(raw);
  check('globalScore converti depuis string', s.globalScore, 72.5);
  check('dim_team converti depuis string', s.dimensions.team, 80);
  check('fragiliteScore converti depuis string', s.fragiliteScore, 38);
}

// ============================================================
// FIN
// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) {
  process.exit(1);
}
