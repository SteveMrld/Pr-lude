// ============================================================
// Tests lib/pipeline-toile/mapping
// ------------------------------------------------------------
// Garantit que la cartographie SSE / topologie est exhaustive
// et coherente. Si quelqu un ajoute un sendStart dans la route
// d analyse sans le tracer ici, ou ajoute un noeud a la
// topologie sans dire s il est trace ou silencieux, ces tests
// echouent. C est le garde-fou contre la derive de la toile.
//
// Lancement : npx tsx lib/pipeline-toile/mapping.test.ts
// ============================================================

import {
  SSE_EMITTED_ENGINE_IDS,
  TOILE_NODE_IDS,
  SSE_ONLY_IDS,
  TOILE_UNTRACED_IDS,
  TOILE_TRACED_IDS,
  toToileNodeId,
} from './mapping';

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

console.log('\n=== Partition SSE / topologie ===');

// SSE_ONLY + TOILE_UNTRACED + TOILE_TRACED partitionnent l union
// des deux ensembles.

const sseSet = new Set(SSE_EMITTED_ENGINE_IDS);
const toileSet = new Set(TOILE_NODE_IDS);

// Tout id SSE est soit dans SSE_ONLY soit dans TOILE_TRACED, jamais
// les deux.
let sseCovered = true;
for (const id of SSE_EMITTED_ENGINE_IDS) {
  const inOnly = SSE_ONLY_IDS.includes(id);
  const inTraced = TOILE_TRACED_IDS.includes(id);
  if (inOnly === inTraced) sseCovered = false;
}
checkTrue('chaque id SSE est dans exactement un sous-ensemble', sseCovered);

// Tout id topologie est soit dans TOILE_UNTRACED soit dans
// TOILE_TRACED, jamais les deux.
let toileCovered = true;
for (const id of TOILE_NODE_IDS) {
  const inUntraced = TOILE_UNTRACED_IDS.includes(id);
  const inTraced = TOILE_TRACED_IDS.includes(id);
  if (inUntraced === inTraced) toileCovered = false;
}
checkTrue('chaque noeud toile est dans exactement un sous-ensemble', toileCovered);

console.log('\n=== Ecarts attendus a date ===');

// Snapshot des ecarts a la session 2. Si ce snapshot change, la
// cartographie a derive et il faut consciemment remettre a jour.

const SSE_ONLY_EXPECTED = ['prescan'];
check(
  'SSE_ONLY contient exactement prescan',
  JSON.stringify([...SSE_ONLY_IDS].sort()),
  JSON.stringify([...SSE_ONLY_EXPECTED].sort()),
);

const TOILE_UNTRACED_EXPECTED = ['saas-metrics', 'industrial-metrics', 'benchmarks'];
check(
  'TOILE_UNTRACED contient exactement les trois moteurs deterministes',
  JSON.stringify([...TOILE_UNTRACED_IDS].sort()),
  JSON.stringify([...TOILE_UNTRACED_EXPECTED].sort()),
);

console.log('\n=== Tracage exhaustif des moteurs LLM critiques ===');

// Tout moteur LLM critique de la doctrine doit etre trace : si
// l un d eux glisse en silencieux, on perd la lecture live de
// l auditeur. On verrouille la liste.
const TRACED_REQUIRED = [
  'extraction',
  'team', 'market', 'macro', 'financial-extraction',
  'pattern', 'blindspot', 'contrarian',
  'financial-coherence', 'tech-claim', 'execution-friction',
  'narrative-drift', 'fragility-structurelle',
  'causal', 'reference-checks', 'orchestrate',
];
for (const id of TRACED_REQUIRED) {
  checkTrue(`${id} est trace`, TOILE_TRACED_IDS.includes(id));
}

console.log('\n=== toToileNodeId ===');

check('prescan -> null (hors toile)', toToileNodeId('prescan'), null);
check('extraction -> extraction', toToileNodeId('extraction'), 'extraction');
check('fragility-structurelle -> fragility-structurelle', toToileNodeId('fragility-structurelle'), 'fragility-structurelle');
check('benchmarks -> null (non trace)', toToileNodeId('benchmarks'), null);
check('id inconnu -> null', toToileNodeId('moteur-imaginaire'), null);

console.log('\n=== Coherence interne ===');

// Aucun doublon dans les ensembles.
check('pas de doublon dans SSE_EMITTED_ENGINE_IDS', new Set(SSE_EMITTED_ENGINE_IDS).size, SSE_EMITTED_ENGINE_IDS.length);
check('pas de doublon dans TOILE_NODE_IDS', new Set(TOILE_NODE_IDS).size, TOILE_NODE_IDS.length);

// Sommes coherentes.
check(
  'TOILE_TRACED + TOILE_UNTRACED == TOILE_NODE_IDS',
  TOILE_TRACED_IDS.length + TOILE_UNTRACED_IDS.length,
  TOILE_NODE_IDS.length,
);
check(
  'TOILE_TRACED + SSE_ONLY == SSE_EMITTED_ENGINE_IDS',
  TOILE_TRACED_IDS.length + SSE_ONLY_IDS.length,
  SSE_EMITTED_ENGINE_IDS.length,
);

// Inutile de re-tester sseSet/toileSet manuellement : Set sert
// juste a forcer la deduplication ci-dessus.
void sseSet;
void toileSet;

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
