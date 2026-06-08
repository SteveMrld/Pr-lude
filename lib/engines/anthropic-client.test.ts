// ============================================================
// Tests deterministes anthropic-client - applyRunOptions
// ------------------------------------------------------------
// Verifie le contrat critique du mode frozen : frozen=true coupe
// en dur enableWebSearch, surpasse l indicateur isWebSearchEnabled
// (lui-meme drive par ENABLE_WEB_SEARCH). C est ce qui empeche
// toute fuite reseau sur un re-run corpus.
//
//   npx tsx lib/engines/anthropic-client.test.ts
// ============================================================

import { applyRunOptions } from './anthropic-client';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`FAIL : ${label}`);
  }
}

// ============================================================
// 1. Defaut : runOptions absent -> baseOptions inchanges
// ============================================================
{
  const base = { maxWebSearches: 4 };
  const out = applyRunOptions(base, undefined);
  check('runOptions absent -> identite des options', JSON.stringify(out) === JSON.stringify(base));
}

// ============================================================
// 2. frozen=false : baseOptions inchanges
// ============================================================
{
  const base = { maxWebSearches: 3 };
  const out = applyRunOptions(base, { frozen: false });
  check('frozen=false -> identite des options', JSON.stringify(out) === JSON.stringify(base));
  check('frozen=false -> enableWebSearch reste undefined', (out as any).enableWebSearch === undefined);
}

// ============================================================
// 3. frozen=true : enableWebSearch force a false
// ============================================================
{
  const base = { maxWebSearches: 4 };
  const out = applyRunOptions(base, { frozen: true });
  check('frozen=true -> enableWebSearch=false', out.enableWebSearch === false);
  check('frozen=true -> conserve maxWebSearches', out.maxWebSearches === 4);
}

// ============================================================
// 4. frozen=true ecrase un enableWebSearch=true explicite
// ------------------------------------------------------------
// Le contrat exige que frozen prevaut sur tout. Si un moteur
// fixait explicitement enableWebSearch=true dans ses baseOptions
// (cas hypothetique), frozen doit l ecraser quand meme.
// ============================================================
{
  const base = { maxWebSearches: 4, enableWebSearch: true };
  const out = applyRunOptions(base, { frozen: true });
  check('frozen=true ecrase enableWebSearch=true des baseOptions', out.enableWebSearch === false);
}

// ============================================================
// 5. Idempotence : appel double = appel simple
// ============================================================
{
  const base = { maxWebSearches: 2 };
  const once = applyRunOptions(base, { frozen: true });
  const twice = applyRunOptions(once, { frozen: true });
  check('applyRunOptions idempotent sous frozen=true',
    JSON.stringify(once) === JSON.stringify(twice));
}

console.log(`\n=== anthropic-client.applyRunOptions ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
