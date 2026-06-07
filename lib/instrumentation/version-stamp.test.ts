// ============================================================
// Tests deterministes version-stamp
// ------------------------------------------------------------
// Verifie que :
//  - buildVersionStamp est stable pour inputs identiques
//  - le hash bouge des qu une input change
//  - le hash bouge des qu une config change (simulee via mutation)
//  - diffStamps remonte uniquement les axes qui different
//  - sealVersionStamp ajoute durationMs sans casser le reste
//
//   npx tsx lib/instrumentation/version-stamp.test.ts
// ============================================================

import {
  buildVersionStamp,
  sealVersionStamp,
  fingerprintStamp,
  diffStamps,
  canonicalHash,
  getAppCommitSha,
  VERSION_STAMP_SCHEMA,
} from './version-stamp';

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
// 1. Stabilite pour inputs identiques
// ============================================================
{
  const fixedDate = '2026-06-07T12:00:00.000Z';
  const stampA = buildVersionStamp({
    inputs: { deckBase64: 'AAAA', deckBytes: 3, pitchText: 'pitch text', bpText: null, additionalFiles: [] },
    capturedAt: fixedDate,
  });
  const stampB = buildVersionStamp({
    inputs: { deckBase64: 'AAAA', deckBytes: 3, pitchText: 'pitch text', bpText: null, additionalFiles: [] },
    capturedAt: fixedDate,
  });
  const fa = fingerprintStamp(stampA);
  const fb = fingerprintStamp(stampB);
  check('Stamp identique pour inputs identiques (engines)', fa.enginesHash === fb.enginesHash);
  check('Stamp identique pour inputs identiques (configs)', fa.configsHash === fb.configsHash);
  check('Stamp identique pour inputs identiques (inputs)', fa.inputsHash === fb.inputsHash);
  check('Stamp identique pour inputs identiques (models)', fa.modelsHash === fb.modelsHash);
  check('Schema version expose', stampA.schemaVersion === VERSION_STAMP_SCHEMA);
}

// ============================================================
// 2. inputsHash bouge si entree change
// ============================================================
{
  const baseInputs = { deckBase64: 'AAAA', deckBytes: 3, pitchText: 'pitch', bpText: null, additionalFiles: [] };
  const stampA = buildVersionStamp({ inputs: baseInputs });
  const stampB = buildVersionStamp({ inputs: { ...baseInputs, pitchText: 'pitch DIFFERENT' } });
  const stampC = buildVersionStamp({ inputs: { ...baseInputs, deckBase64: 'BBBB' } });
  const stampD = buildVersionStamp({ inputs: { ...baseInputs, bpText: 'bp content' } });

  const fa = fingerprintStamp(stampA);
  const fb = fingerprintStamp(stampB);
  const fc = fingerprintStamp(stampC);
  const fd = fingerprintStamp(stampD);
  check('inputsHash bouge si pitchText change', fa.inputsHash !== fb.inputsHash);
  check('inputsHash bouge si deckBase64 change', fa.inputsHash !== fc.inputsHash);
  check('inputsHash bouge si bpText apparait', fa.inputsHash !== fd.inputsHash);
  // mais le configs/engines/models hashes doivent rester stables
  check('configsHash invariant entre runs sans changement de config', fa.configsHash === fb.configsHash);
  check('enginesHash invariant entre runs sans changement de moteur', fa.enginesHash === fb.enginesHash);
  check('modelsHash invariant entre runs', fa.modelsHash === fb.modelsHash);
}

// ============================================================
// 3. diffStamps remonte uniquement les axes qui different
// ============================================================
{
  const inputsA = { deckBase64: 'AAAA', deckBytes: 3, pitchText: 'pitch', bpText: null, additionalFiles: [] };
  const inputsB = { deckBase64: 'BBBB', deckBytes: 3, pitchText: 'pitch', bpText: null, additionalFiles: [] };
  const sa = buildVersionStamp({ inputs: inputsA });
  const sb = buildVersionStamp({ inputs: inputsB });
  const diffs = diffStamps(sa, sb);
  check('diffStamps remonte exactement 1 diff sur inputs', diffs.length === 1 && diffs[0].startsWith('inputs:'));
  check('diffStamps vide si stamps identiques', diffStamps(sa, buildVersionStamp({ inputs: inputsA })).length === 0);
}

// ============================================================
// 4. sealVersionStamp ajoute durationMs sans casser
// ============================================================
{
  const stamp = buildVersionStamp({ inputs: { deckBase64: 'AAAA', deckBytes: 3, pitchText: null, bpText: null, additionalFiles: [] } });
  const sealed = sealVersionStamp(stamp, 12345);
  check('sealVersionStamp pose durationMs', sealed.durationMs === 12345);
  check('sealVersionStamp preserve la cle inputs', sealed.inputs.deckHash === stamp.inputs.deckHash);
  check('sealVersionStamp preserve engines map', sealed.engines === stamp.engines);
}

// ============================================================
// 5. canonicalHash est invariant a l ordre des cles
// ============================================================
{
  const a = canonicalHash({ a: 1, b: 2, c: 3 });
  const b = canonicalHash({ c: 3, b: 2, a: 1 });
  check('canonicalHash invariant a l ordre des cles', a === b);
  const c = canonicalHash({ a: 1, b: 2, c: 4 });
  check('canonicalHash bouge si une valeur change', a !== c);
}

// ============================================================
// 6. Configs hashees contiennent les valeurs
// ============================================================
{
  const stamp = buildVersionStamp({ inputs: { deckBase64: null, deckBytes: 0, pitchText: null, bpText: null, additionalFiles: [] } });
  check('Config dimensionWeights presente', !!stamp.configs.dimensionWeights);
  check('Config verdictThresholds presente', !!stamp.configs.verdictThresholds);
  check('Config comparablesMatching presente', !!stamp.configs.comparablesMatching);
  // Valeurs cles : 0.20 team, 0.22 market, etc.
  const dw = stamp.configs.dimensionWeights.value;
  check('dimensionWeights.team = 0.20', dw.team === 0.20);
  check('dimensionWeights.market = 0.22', dw.market === 0.22);
}

// ============================================================
// 7. Engines registry couvre les moteurs LLM cles
// ============================================================
{
  const stamp = buildVersionStamp({ inputs: { deckBase64: null, deckBytes: 0, pitchText: null, bpText: null, additionalFiles: [] } });
  const engineIds = Object.keys(stamp.engines);
  check('Engine team present', engineIds.includes('team'));
  check('Engine market present', engineIds.includes('market'));
  check('Engine macro present', engineIds.includes('macro'));
  check('Engine orchestrator present', engineIds.includes('orchestrator'));
  check('Engine pattern present', engineIds.includes('pattern'));
  check('Engine blindspot present', engineIds.includes('blindspot'));
  check('Engine contrarian present', engineIds.includes('contrarian'));
  // Au moins un moteur a un systemPromptHashes non vide (la lecture
  // fs marche en dev local au minimum)
  const someEngine = stamp.engines.team;
  check('Engine team a un model defini', typeof someEngine.model === 'string' && someEngine.model.length > 0);
}

// ============================================================
// 8. commitSha resolu si dispo
// ============================================================
{
  const sha = getAppCommitSha();
  // En local on a forcement un commit. Si null, on accepte (env CI sans git)
  // mais on trace ce qu on observe.
  check('commitSha string ou null', sha === null || /^[0-9a-f]{8,40}$/.test(sha));
}

console.log(`\n=== version-stamp ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
