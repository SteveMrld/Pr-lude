// Tests deterministes du mapping engineId -> cle result_json.
// Couvre l exhaustivite sur la topologie tracee + les fallback
// defensifs (result null, cle inconnue, valeur absente).

import {
  ENGINE_TO_RESULT_KEY,
  pickEngineOutputFromResult,
  buildEngineOutputsFromResult,
} from './result-mapping';
import { TOILE_TRACED_IDS, SSE_EMITTED_ENGINE_IDS } from './mapping';

let pass = 0;
let fail = 0;

function check<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${JSON.stringify(expected)}`);
    console.log(`        actual:   ${JSON.stringify(actual)}`);
  }
}

function checkTrue(condition: boolean, label: string) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
  }
}

console.log('\n=== ENGINE_TO_RESULT_KEY exhaustivite ===');
// Tous les moteurs traces de la toile ont une entree dans la
// table : le drill-down d une analyse archivee doit pouvoir
// resoudre l output pour n importe quel noeud cliquable.
for (const id of TOILE_TRACED_IDS) {
  checkTrue(
    typeof ENGINE_TO_RESULT_KEY[id] === 'string',
    `${id} mappe sur une cle result`,
  );
}

// Tous les moteurs emis par le SSE (y compris prescan) ont une
// entree. Ainsi, meme si on decide plus tard de drill-down sur
// prescan, la matiere est resolue.
for (const id of SSE_EMITTED_ENGINE_IDS) {
  checkTrue(
    typeof ENGINE_TO_RESULT_KEY[id] === 'string',
    `SSE_EMITTED ${id} mappe sur une cle result`,
  );
}

console.log('\n=== pickEngineOutputFromResult ===');

const fakeResult = {
  team: { score: 72, verdict: 'solide' },
  market: { perceivedSize: 'large' },
  patternMatching: { matches: ['a', 'b'] },
  fragiliteStructurelle: { globalFragilityScore: 41 },
  finalRecommendation: { verdict: 'approfondir', globalScore: 58 },
  // tech-claim absent : techClaimCoherence non present
};

check(
  pickEngineOutputFromResult(fakeResult, 'team'),
  { score: 72, verdict: 'solide' },
  'team -> team',
);
check(
  pickEngineOutputFromResult(fakeResult, 'pattern'),
  { matches: ['a', 'b'] },
  'pattern -> patternMatching',
);
check(
  pickEngineOutputFromResult(fakeResult, 'fragility-structurelle'),
  { globalFragilityScore: 41 },
  'fragility-structurelle -> fragiliteStructurelle',
);
check(
  pickEngineOutputFromResult(fakeResult, 'orchestrate'),
  { verdict: 'approfondir', globalScore: 58 },
  'orchestrate -> finalRecommendation',
);
check(
  pickEngineOutputFromResult(fakeResult, 'tech-claim'),
  null,
  'cle absente du result -> null',
);
check(
  pickEngineOutputFromResult(null, 'team'),
  null,
  'result null -> null',
);
check(
  pickEngineOutputFromResult(undefined, 'team'),
  null,
  'result undefined -> null',
);
check(
  pickEngineOutputFromResult(fakeResult, 'inconnu'),
  null,
  'engineId inconnu -> null',
);

console.log('\n=== buildEngineOutputsFromResult ===');

const built = buildEngineOutputsFromResult(fakeResult);
check(
  Object.keys(built).sort(),
  ['fragility-structurelle', 'market', 'orchestrate', 'pattern', 'team'],
  'cles presentes uniquement pour les valeurs non null',
);
check(
  built['orchestrate'],
  { verdict: 'approfondir', globalScore: 58 },
  'orchestrate present dans le build',
);
check(
  built['tech-claim'],
  undefined,
  'tech-claim absent du build',
);

const builtFromNull = buildEngineOutputsFromResult(null);
check(builtFromNull, {}, 'result null -> {}');

const builtFromUndef = buildEngineOutputsFromResult(undefined);
check(builtFromUndef, {}, 'result undefined -> {}');

// null en valeur n est pas absorbe (filtree comme absent)
const resultWithNull = { team: null, market: { ok: true } };
const builtPartial = buildEngineOutputsFromResult(resultWithNull);
check(
  Object.keys(builtPartial),
  ['market'],
  'valeur null filtree, seul market remonte',
);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
