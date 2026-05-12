// ============================================================
// Tests resolvePreScanOverride
// ------------------------------------------------------------
// Couvre la resolution du payload pre-scan emis quand le partner
// force l analyse complete apres un knockout. Garantit que le
// verdict d origine est preserve quand le client le renvoie, et
// qu un stub typesafe est synthetise sinon.
//
// Lancement : npx tsx lib/engines/prescan-override.test.ts
// ============================================================

import { resolvePreScanOverride } from './prescan-override';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T): void {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, condition: boolean): void {
  check(label, condition, true);
}

console.log('\n=== resolvePreScanOverride ===');

// Cas 1 : verdict knockout d origine renvoye par le client
const knockoutOrigin = {
  score: 2,
  totalTests: 6,
  recommendation: 'not_recommended' as const,
  summary: 'Triage defavorable : marche flou, fondateurs sans transposition.',
  tests: [
    { id: 'market', name: 'Marche', status: 'fail' as const, rationale: 'Pas de TAM defini.', evidence: '' },
    { id: 'founder', name: 'Fondateurs', status: 'fail' as const, rationale: 'Pas de transposition.', evidence: '' },
  ],
  failedTests: ['Marche', 'Fondateurs'],
};

const r1 = resolvePreScanOverride(knockoutOrigin);
check('preserve score', r1.score, 2);
check('preserve recommendation', r1.recommendation, 'not_recommended');
check('preserve summary', r1.summary, knockoutOrigin.summary);
checkTrue('preserve tests array', Array.isArray(r1.tests) && r1.tests!.length === 2);
checkTrue('preserve failedTests', Array.isArray(r1.failedTests) && r1.failedTests!.length === 2);
check('drapeau override', r1.__overrideReason, 'force-prescan');
checkTrue('pas marque skipped quand verdict preserve', r1.__skipped !== true);

// Cas 2 : null = client n a pas renvoye le verdict (reload, nouvel onglet)
const r2 = resolvePreScanOverride(null);
check('stub recommendation neutre', r2.recommendation, 'pipeline_with_caveats');
checkTrue('stub summary mentionne override', typeof r2.summary === 'string' && r2.summary.includes('force'));
checkTrue('stub marque skipped', r2.__skipped === true);
check('stub drapeau override', r2.__overrideReason, 'force-prescan');
checkTrue('stub totalTests 0', r2.totalTests === 0);
checkTrue('stub tests vide', Array.isArray(r2.tests) && r2.tests!.length === 0);
checkTrue('stub failedTests vide', Array.isArray(r2.failedTests) && r2.failedTests!.length === 0);

// Cas 3 : undefined = symetrique de null
const r3 = resolvePreScanOverride(undefined);
checkTrue('undefined produit le meme stub', r3.__skipped === true && r3.__overrideReason === 'force-prescan');

// Cas 4 : payload malforme (manque recommendation)
const r4 = resolvePreScanOverride({ summary: 'incomplet', tests: [] });
checkTrue('payload sans recommendation tombe sur le stub', r4.__skipped === true);

// Cas 5 : payload malforme (manque summary)
const r5 = resolvePreScanOverride({ recommendation: 'not_recommended', tests: [] });
checkTrue('payload sans summary tombe sur le stub', r5.__skipped === true);

// Cas 6 : payload string (cas degenere de parsing JSON failure)
const r6 = resolvePreScanOverride('not-an-object');
checkTrue('payload string tombe sur le stub', r6.__skipped === true);

// Cas 7 : verdict ready_for_pipeline preserve (cas theorique : partner
// peut forcer meme apres un verdict positif si l API a renvoye un
// faux knockout). On verifie que la fonction ne sur-ecrit pas le
// verdict d origine sous pretexte d override.
const okOrigin = {
  recommendation: 'ready_for_pipeline' as const,
  summary: 'Triage favorable.',
  score: 6,
  totalTests: 6,
  tests: [],
  failedTests: [],
};
const r7 = resolvePreScanOverride(okOrigin);
check('verdict ready_for_pipeline preserve', r7.recommendation, 'ready_for_pipeline');
check('pas de mutation summary', r7.summary, 'Triage favorable.');

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) {
  process.exit(1);
}
