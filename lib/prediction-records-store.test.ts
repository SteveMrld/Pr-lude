// ============================================================
// Tests deterministes prediction-records-store.ts
// ------------------------------------------------------------
// Couvre uniquement la couche pure : mapping d input -> payload
// et utilisation du fingerprint extrait du version stamp. Les
// appels Supabase eux-memes sont hors scope (necessitent une base
// reelle, traite dans les tests integration manuels).
// ============================================================

import { buildVersionStamp, fingerprintStamp } from './instrumentation/version-stamp';

let pass = 0;
let fail = 0;

function check(cond: boolean, label: string) {
  if (cond) {
    pass++;
    console.log(`  OK  ${label}`);
  } else {
    fail++;
    console.error(`  KO  ${label}`);
  }
}

// ============================================================
// SUITE - Le fingerprint extrait d un version stamp recompose
// les colonnes stamp_* de prediction_records de maniere stable.
// ============================================================

console.log('\n[Suite] Fingerprint d un version stamp -> colonnes stamp_*');

{
  const stamp = buildVersionStamp({
    inputs: {
      deckBase64: 'YWJj',
      deckBytes: 3,
      pitchText: 'hello',
      bpText: null,
    },
    capturedAt: '2026-06-07T00:00:00.000Z',
  });
  const fp = fingerprintStamp(stamp);

  check(typeof fp.configsHash === 'string' && fp.configsHash.length > 0, 'configsHash : string non vide');
  check(typeof fp.enginesHash === 'string' && fp.enginesHash.length > 0, 'enginesHash : string non vide');
  check(typeof fp.modelsHash === 'string' && fp.modelsHash.length > 0, 'modelsHash : string non vide');
  check(typeof fp.inputsHash === 'string' && fp.inputsHash.length > 0, 'inputsHash : string non vide');
  // commitSha peut etre null en CI sans git, mais en local pas null
  check(fp.commitSha === null || typeof fp.commitSha === 'string', 'commitSha : null ou string');

  // Recalcul -> mêmes valeurs (stabilite)
  const fp2 = fingerprintStamp(stamp);
  check(fp.configsHash === fp2.configsHash, 'fingerprint stable : configsHash');
  check(fp.enginesHash === fp2.enginesHash, 'fingerprint stable : enginesHash');
  check(fp.modelsHash === fp2.modelsHash, 'fingerprint stable : modelsHash');
  check(fp.inputsHash === fp2.inputsHash, 'fingerprint stable : inputsHash');
}

{
  // Deux stamps avec des inputs differents -> inputsHash bouge mais
  // configsHash et modelsHash restent identiques.
  const stampA = buildVersionStamp({
    inputs: { deckBase64: 'aaa', pitchText: null, bpText: null },
    capturedAt: '2026-06-07T00:00:00.000Z',
  });
  const stampB = buildVersionStamp({
    inputs: { deckBase64: 'bbb', pitchText: null, bpText: null },
    capturedAt: '2026-06-07T00:00:00.000Z',
  });
  const fpA = fingerprintStamp(stampA);
  const fpB = fingerprintStamp(stampB);
  check(fpA.inputsHash !== fpB.inputsHash, 'inputs differents : inputsHash bouge');
  check(fpA.configsHash === fpB.configsHash, 'inputs differents : configsHash stable');
  check(fpA.modelsHash === fpB.modelsHash, 'inputs differents : modelsHash stable');
  check(fpA.enginesHash === fpB.enginesHash, 'inputs differents : enginesHash stable');
}

// ============================================================
// RESUME
// ============================================================

console.log(`\nResultats : ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
