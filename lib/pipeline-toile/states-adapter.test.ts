// ============================================================
// Tests lib/pipeline-toile/states-adapter
// ------------------------------------------------------------
// Verifie la conversion engine state -> toile node state sur des
// sequences d evenements typiques observees au SSE :
//   - run vide (avant le premier engine-start)
//   - phase d extraction (extraction running, le reste idle)
//   - phase paralleles (plusieurs running simultanes)
//   - erreur sur un moteur, les autres continuent
//   - run termine (tous done)
//   - run partiel charge depuis l historique
//   - presence de moteurs hors topologie (prescan, dataroom)
//     dans engineStates : ne doivent pas polluer la sortie.
//
// Lancement : npx tsx lib/pipeline-toile/states-adapter.test.ts
// ============================================================

import {
  buildToileStates,
  buildIdleToileStates,
  engineStatusToToileState,
} from './states-adapter';
import { TOILE_NODE_IDS, TOILE_UNTRACED_IDS } from './mapping';

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

console.log('\n=== engineStatusToToileState ===');

check('running -> running', engineStatusToToileState('running'), 'running');
check('done -> done', engineStatusToToileState('done'), 'done');
check('error -> error', engineStatusToToileState('error'), 'error');
check('idle -> idle', engineStatusToToileState('idle'), 'idle');
check('undefined -> idle', engineStatusToToileState(undefined), 'idle');

console.log('\n=== buildIdleToileStates ===');

const idle = buildIdleToileStates();
check('idle: nombre de noeuds = TOILE_NODE_IDS', Object.keys(idle).length, TOILE_NODE_IDS.length);
let allIdle = true;
for (const id of TOILE_NODE_IDS) {
  if (idle[id] !== 'idle') allIdle = false;
}
checkTrue('idle: tous les noeuds en idle', allIdle);

console.log('\n=== buildToileStates ===');

// 1. Entree vide ou null
check('null -> tous idle', buildToileStates(null)['extraction'], 'idle');
check('undefined -> tous idle', buildToileStates(undefined)['orchestrate'], 'idle');
const empty = buildToileStates({});
check('vide: extraction idle', empty['extraction'], 'idle');
check('vide: nombre de noeuds couvre toute la topologie', Object.keys(empty).length, TOILE_NODE_IDS.length);

// 2. Phase extraction
const phaseExtraction = buildToileStates({
  extraction: { status: 'running' },
});
check('extraction running -> running', phaseExtraction['extraction'], 'running');
check('extraction running: team reste idle', phaseExtraction['team'], 'idle');
check('extraction running: orchestrate reste idle', phaseExtraction['orchestrate'], 'idle');

// 3. Phase paralleles : extraction done, vague 1 lancee
const vague1 = buildToileStates({
  extraction: { status: 'done', durationMs: 35000 },
  team: { status: 'running', startedAt: 100 },
  market: { status: 'running', startedAt: 100 },
  macro: { status: 'running', startedAt: 100 },
  'financial-extraction': { status: 'running', startedAt: 100 },
});
check('vague1: extraction done', vague1['extraction'], 'done');
check('vague1: team running', vague1['team'], 'running');
check('vague1: market running', vague1['market'], 'running');
check('vague1: macro running', vague1['macro'], 'running');
check('vague1: financial-extraction running', vague1['financial-extraction'], 'running');
check('vague1: pattern reste idle (depend de vague1)', vague1['pattern'], 'idle');

// 4. Erreur isolee sur un moteur, autres continuent
const erreur = buildToileStates({
  extraction: { status: 'done' },
  team: { status: 'done' },
  market: { status: 'done' },
  macro: { status: 'done' },
  'financial-extraction': { status: 'done' },
  pattern: { status: 'running' },
  blindspot: { status: 'running' },
  contrarian: { status: 'error' },
});
check('erreur: contrarian error', erreur['contrarian'], 'error');
check('erreur: pattern continue running', erreur['pattern'], 'running');
check('erreur: blindspot continue running', erreur['blindspot'], 'running');

// 5. Run termine complet
const allDone: Record<string, { status: 'done' }> = {};
for (const id of TOILE_NODE_IDS) allDone[id] = { status: 'done' };
const terminal = buildToileStates(allDone);
let allTerminalDone = true;
for (const id of TOILE_NODE_IDS) {
  if (terminal[id] !== 'done') allTerminalDone = false;
}
checkTrue('terminal: tous les noeuds en done', allTerminalDone);

// 6. Moteurs untraced restent idle meme avec d autres en running
const untracedStaysIdle = buildToileStates({
  extraction: { status: 'done' },
  'financial-extraction': { status: 'done' },
  pattern: { status: 'running' },
});
for (const id of TOILE_UNTRACED_IDS) {
  check(`untraced ${id} reste idle`, untracedStaysIdle[id], 'idle');
}

// 7. Ids hors topologie (prescan, dataroom) : ignores
const horsTopologie = buildToileStates({
  prescan: { status: 'done' },
  'ledger-parsing': { status: 'running' },
  'dd-financial': { status: 'done' },
  extraction: { status: 'running' },
});
check('prescan ignore: non present en sortie', 'prescan' in horsTopologie, false);
check('ledger-parsing ignore', 'ledger-parsing' in horsTopologie, false);
check('dd-financial ignore', 'dd-financial' in horsTopologie, false);
check('extraction toujours propage', horsTopologie['extraction'], 'running');

// 8. Determinisme : meme entree, meme sortie binaire
const ref = buildToileStates(allDone);
const ref2 = buildToileStates(allDone);
checkTrue('determinisme: deux appels identiques', JSON.stringify(ref) === JSON.stringify(ref2));

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
