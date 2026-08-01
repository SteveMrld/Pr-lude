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
import {
  ENGINE_LLM_BUDGET,
  TEMPERATURE_DIALECTIQUE,
  TEMPERATURE_SCORE,
} from '../engines/engine-budget';
import { PATTERN_LLM_OPTIONS } from '../engines/fragility-structurelle/pattern-interface';

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

  // Le tri devait etre recursif et ne l etait pas. Le second argument
  // de JSON.stringify n est pas un comparateur mais une liste blanche
  // de noms de proprietes, appliquee a tous les niveaux : dans un objet
  // imbrique, elle ne retenait dans chaque sous-objet que les
  // proprietes portant le nom d une cle de premier niveau, donc aucune.
  // enginesHash ne voyait ni les modeles, ni les prompts, ni les
  // sources. Ces trois tests le tiennent ferme.
  check('canonicalHash voit une valeur imbriquee changer',
    canonicalHash({ team: { model: 'sonnet', temperature: 0 } })
      !== canonicalHash({ team: { model: 'sonnet', temperature: 1 } }));
  check('canonicalHash reste invariant a l ordre des cles imbriquees',
    canonicalHash({ team: { model: 'sonnet', temperature: 0 } })
      === canonicalHash({ team: { temperature: 0, model: 'sonnet' } }));
  check('canonicalHash voit un tableau imbrique changer',
    canonicalHash({ team: { hashes: ['a', 'b'] } })
      !== canonicalHash({ team: { hashes: ['a', 'c'] } }));
  // L ordre d un tableau porte du sens, il ne doit pas etre trie.
  check('canonicalHash preserve l ordre des tableaux',
    canonicalHash({ team: { hashes: ['a', 'b'] } })
      !== canonicalHash({ team: { hashes: ['b', 'a'] } }));
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

// ============================================================
// 9. runMode frozen entre dans configsHash, asOf n entre pas
// ------------------------------------------------------------
// Le segment corpus doit etre etanche : un re-run frozen sur un
// deck identique a un run live doit produire un configsHash
// distinct, sans quoi la couche de calibration melangerait les
// deux segments. asOf est provenance pure, sans effet sur le
// hash : deux re-runs frozen pris a des dates differentes du
// meme deck restent dans le meme segment de calibration.
// ============================================================
{
  const fixedDate = '2026-06-07T12:00:00.000Z';
  const baseInputs = { deckBase64: 'XYZ', deckBytes: 3, pitchText: null, bpText: null };

  const live = buildVersionStamp({ inputs: baseInputs, capturedAt: fixedDate });
  const frozen = buildVersionStamp({
    inputs: baseInputs,
    capturedAt: fixedDate,
    runMode: { frozen: true, asOf: '2024-09-15' },
  });
  const fpLive = fingerprintStamp(live);
  const fpFrozen = fingerprintStamp(frozen);

  check('Frozen change configsHash', fpLive.configsHash !== fpFrozen.configsHash);
  check('Frozen ne change pas enginesHash', fpLive.enginesHash === fpFrozen.enginesHash);
  check('Frozen ne change pas inputsHash', fpLive.inputsHash === fpFrozen.inputsHash);
  check('Frozen ne change pas modelsHash', fpLive.modelsHash === fpFrozen.modelsHash);

  // Deux frozen avec asOf differents -> meme configsHash. asOf n est
  // pas dans le hash.
  const frozenA = buildVersionStamp({
    inputs: baseInputs,
    capturedAt: fixedDate,
    runMode: { frozen: true, asOf: '2024-09-15' },
  });
  const frozenB = buildVersionStamp({
    inputs: baseInputs,
    capturedAt: fixedDate,
    runMode: { frozen: true, asOf: '2025-03-01' },
  });
  check('asOf seul ne change pas configsHash',
    fingerprintStamp(frozenA).configsHash === fingerprintStamp(frozenB).configsHash);

  // Stamp top-level expose runMode pour debug et persistance dans
  // prediction_record.version_stamp.
  check('runMode.frozen reflete l input', frozen.runMode.frozen === true);
  check('runMode.asOf reflete l input', frozen.runMode.asOf === '2024-09-15');
  check('Defaut runMode.frozen=false', live.runMode.frozen === false);
  check('Defaut runMode.asOf=null', live.runMode.asOf === null);

  // webSearchEnabled effectif : frozen=true force false meme si
  // ENABLE_WEB_SEARCH=true. Test en mutant temporairement l env var.
  const savedEnv = process.env.ENABLE_WEB_SEARCH;
  process.env.ENABLE_WEB_SEARCH = 'true';
  const live2 = buildVersionStamp({ inputs: baseInputs, capturedAt: fixedDate });
  const frozen2 = buildVersionStamp({
    inputs: baseInputs,
    capturedAt: fixedDate,
    runMode: { frozen: true, asOf: null },
  });
  check('Live respecte ENABLE_WEB_SEARCH=true', live2.webSearchEnabled === true);
  check('Frozen force webSearchEnabled=false', frozen2.webSearchEnabled === false);
  if (savedEnv === undefined) {
    delete process.env.ENABLE_WEB_SEARCH;
  } else {
    process.env.ENABLE_WEB_SEARCH = savedEnv;
  }
}

// ============================================================
// TEMPERATURE PAR MOTEUR
// ------------------------------------------------------------
// Le champ valait 'api-default' sur les vingt-neuf entrees, ce qui
// etait exact tant qu aucun site d appel ne pouvait en decider. Il
// porte desormais la valeur reelle, et entre dans enginesHash : deux
// runs qui ne partagent pas le meme regime d echantillonnage ne
// peuvent plus se comparer comme s ils l avaient fait.
//
// Ce qui compte ici n est pas la valeur, c est qu elle soit derivee.
// Un stamp qui redeclare en dur ce que la table decide finit toujours
// par affirmer une temperature que le moteur n a pas eue.
// ============================================================
{
  const stamp = buildVersionStamp({
    inputs: { deckBase64: 'AAAA', deckBytes: 3, pitchText: 'pitch', bpText: null, additionalFiles: [] },
    capturedAt: '2026-08-01T12:00:00.000Z',
  });
  const eng = stamp.engines;

  check('Aucun moteur ne reste sur le sentinel api-default',
    Object.values(eng).every(e => typeof e.temperature === 'number'));

  // Les six moteurs de dimension, quel que soit le chemin par lequel
  // leur temperature arrive au stamp, table ou litteral.
  for (const id of ['team', 'market', 'macro', 'financial-coherence', 'contrarian', 'blindspot']) {
    check(`${id} alimente une dimension, stamp a ${TEMPERATURE_SCORE}`,
      eng[id].temperature === TEMPERATURE_SCORE);
  }
  // Et la couche d extraction, deterministe depuis l origine.
  for (const id of ['extraction', 'financial-extraction', 'saas-metrics', 'industrial-metrics', 'prescan']) {
    check(`${id} extrait, stamp a 0`, eng[id].temperature === 0);
  }
  // Les moteurs dialectiques gardent le defaut API, declare.
  for (const id of ['pattern', 'causal', 'narrative-drift', 'reference-checks', 'orchestrator']) {
    check(`${id} raisonne, stamp a ${TEMPERATURE_DIALECTIQUE}`,
      eng[id].temperature === TEMPERATURE_DIALECTIQUE);
  }

  // Derivation effective : on ne teste pas une egalite de valeurs mais
  // que le stamp lit bien la table. Si quelqu un recopie un litteral
  // ici, ce test continue de passer et c est sa limite ; il casse en
  // revanche si la table bouge sans que le stamp suive.
  check('team derive sa temperature de la table budget',
    eng['team'].temperature === ENGINE_LLM_BUDGET.team.temperature);
  check('orchestrator derive sa temperature de la table budget',
    eng['orchestrator'].temperature === ENGINE_LLM_BUDGET.finalRecommendation.temperature);
  check('les sept patterns derivent de PATTERN_LLM_OPTIONS',
    Object.keys(eng).filter(k => k.startsWith('fragility-'))
      .every(k => eng[k].temperature === PATTERN_LLM_OPTIONS.temperature));
  check('les sept patterns sont bien sept',
    Object.keys(eng).filter(k => k.startsWith('fragility-')).length === 7);

  // La temperature entre dans enginesHash, sinon le stamp la note sans
  // que la comparaison de deux runs en tienne compte.
  check('la temperature entre dans enginesHash',
    fingerprintStamp(stamp).enginesHash
      !== canonicalHash(Object.fromEntries(Object.entries(eng).map(([k, v]) => [k, {
        model: v.model,
        systemPromptHashes: v.systemPromptHashes,
        promptVersion: v.promptVersion,
        sourceFileHash: v.sourceFileHash,
      }]))));

  // Il n y a plus de temperature a l echelle du run : deux regimes
  // coexistent et le champ global ne peut plus affirmer un defaut.
  check('models.defaultTemperature acte la bascule par moteur',
    stamp.models.defaultTemperature === 'per-engine');
}

console.log(`\n=== version-stamp ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
