// ============================================================
// TESTS - INSTRUMENTATION D APPEL DES SIX MOTEURS BUDGETES
// ------------------------------------------------------------
// Les fenetres posees par le commit precedent sont extrapolees a
// partir d un seul point mesure. Le volume de sortie reel des six
// moteurs est inconnu : aucun n a jamais abouti et callClaude ne
// remontait pas l usage. Dimensionner a l estime est tenable une fois,
// pas deux.
//
// Ce qui est verrouille ici :
//   - Les six sites passent par le canal qui rend l usage, et non plus
//     par celui qui le jette.
//   - Le puits de mesure accumule duree, tokens et nombre d appels, et
//     tolere son absence pour que les moteurs restent appelables sans
//     instrumentation.
//   - La mesure survit a finalizeFromResult, qui reconstruit les
//     entrees des moteurs aboutis et perdrait toute mesure logee dans
//     l entree elle-meme.
//   - Le plafond de tokens atteint se lit comme une troncature, pas
//     comme un besoin de fenetre plus longue.
//
// Execution : npx tsx lib/engines/engine-instrumentation.test.ts
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import { newMeasure, addCall, hitTokenCeiling } from './engine-budget';
import { EngineStatusRecorder } from '../orchestrator/engine-status-recorder';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); fail++; }
}

function checkTrue(label: string, cond: boolean) {
  if (cond) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}`); fail++; }
}

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ============================================================
// SECTION 1. LE CANAL D APPEL
// ============================================================

console.log('\n=== Section 1. Canal d appel des six moteurs ===');

const ENGINES: Array<{ file: string; fn: string; recorderKey: string }> = [
  { file: 'lib/engines/pattern-engine.ts', fn: 'matchPatterns', recorderKey: 'patternMatching' },
  { file: 'lib/engines/blindspot-engine.ts', fn: 'analyzeBlindspots', recorderKey: 'blindspotAnalysis' },
  { file: 'lib/engines/contrarian-engine.ts', fn: 'analyzeContrarian', recorderKey: 'contrarianAnalysis' },
  { file: 'lib/engines/causal-engine.ts', fn: 'performCausalReversal', recorderKey: 'causalReversal' },
  { file: 'lib/engines/reference-checks-engine.ts', fn: 'generateReferenceChecks', recorderKey: 'referenceChecks' },
  { file: 'lib/engines/narrative-drift-engine.ts', fn: 'analyzeNarrativeDrift', recorderKey: 'narrativeDrift' },
];

for (const { file } of ENGINES) {
  const src = read(file);
  checkTrue(`${file} : passe par callClaudeWithUsage`, src.includes('callClaudeWithUsage('));
  checkTrue(`${file} : n appelle plus le canal qui jette l usage`,
    !/[^h]\bcallClaude\(/.test(src));
  checkTrue(`${file} : accepte un puits de mesure optionnel`, src.includes('measure?: LlmMeasure'));
  checkTrue(`${file} : depose son appel dans le puits`, src.includes('addCall(measure'));
}

const routeSrc = read('app/api/analyze/route.ts');
for (const { recorderKey } of ENGINES) {
  checkTrue(`route.ts : reverse la mesure de ${recorderKey} dans le releve`,
    routeSrc.includes(`enginesRecorder.recordMeasure('${recorderKey}', measure)`));
}
// Le depot doit avoir lieu meme quand le moteur echoue : c est
// justement le cas ou la mesure renseigne le dimensionnement.
check('route.ts : six depots de mesure, tous en finally',
  (routeSrc.match(/} finally {\n\s+enginesRecorder\.recordMeasure\(/g) || []).length, 6);

// ============================================================
// SECTION 2. LE PUITS DE MESURE
// ============================================================

console.log('\n=== Section 2. Accumulation dans le puits ===');

const m = newMeasure();
check('Puits vierge : aucun appel', m.calls, 0);
check('Puits vierge : aucun token', m.outputTokens, 0);

addCall(m, Date.now() - 1500, { input_tokens: 12000, output_tokens: 3200 }, 4000);
check('Un appel : compteur a 1', m.calls, 1);
check('Un appel : tokens de sortie', m.outputTokens, 3200);
check('Un appel : tokens d entree', m.inputTokens, 12000);
check('Un appel : plafond conserve', m.maxTokens, 4000);
checkTrue('Un appel : duree mesuree coherente', m.llmDurationMs >= 1500 && m.llmDurationMs < 5000);

addCall(m, Date.now() - 800, { input_tokens: 12000, output_tokens: 2900 }, 4000);
check('Deux appels : compteur a 2', m.calls, 2);
check('Deux appels : tokens cumules', m.outputTokens, 6100);
checkTrue('Deux appels : durees cumulees', m.llmDurationMs >= 2300);

// Tolerance a l absence de puits : les moteurs doivent rester
// appelables depuis leurs tests et les scripts de calibration.
let threw = false;
try { addCall(undefined, Date.now(), { output_tokens: 10 }, 100); } catch { threw = true; }
checkTrue('Puits absent : addCall ne leve pas', !threw);

// Usage absent ou partiel : on n invente pas de zeros faux.
const partial = newMeasure();
addCall(partial, Date.now(), undefined, 4000);
check('Usage absent : appel compte quand meme', partial.calls, 1);
check('Usage absent : tokens a zero', partial.outputTokens, 0);

// ============================================================
// SECTION 3. PLAFOND DE TOKENS ATTEINT
// ------------------------------------------------------------
// Un outputTokens au plafond dit que le modele a ete coupe. C est le
// signal definitif de troncature, la ou l heuristique textuelle de
// reference-checks ne fait que la supposer.
// ============================================================

console.log('\n=== Section 3. Lecture du plafond de tokens ===');

const ceiling = newMeasure();
addCall(ceiling, Date.now(), { output_tokens: 4000 }, 4000);
checkTrue('Sortie pile au plafond : troncature', hitTokenCeiling(ceiling));

const nearCeiling = newMeasure();
addCall(nearCeiling, Date.now(), { output_tokens: 3960 }, 4000);
checkTrue('Sortie a 99 % du plafond : troncature', hitTokenCeiling(nearCeiling));

const comfortable = newMeasure();
addCall(comfortable, Date.now(), { output_tokens: 2800 }, 4000);
checkTrue('Sortie a 70 % du plafond : pas une troncature', !hitTokenCeiling(comfortable));

checkTrue('Puits vide : pas de troncature affirmee', !hitTokenCeiling(newMeasure()));
checkTrue('Puits absent : pas de troncature affirmee', !hitTokenCeiling(undefined));

const refSrc = read('lib/engines/reference-checks-engine.ts');
checkTrue('reference-checks : la garde de reprise consulte le plafond de tokens',
  refSrc.includes('hitTokenCeiling(measure) || looksTruncated(raw)'));

// ============================================================
// SECTION 4. SURVIE DE LA MESURE DANS LE RELEVE
// ------------------------------------------------------------
// finalizeFromResult reconstruit les entrees des moteurs aboutis a
// partir du result_json. Une mesure ecrite dans l entree serait
// effacee la, exactement comme le sont deja waitDurationMs et
// executionDurationMs sur les moteurs ok. Elle doit donc vivre a cote
// et etre fusionnee au snapshot.
// ============================================================

console.log('\n=== Section 4. Persistance de la mesure ===');

const rec = new EngineStatusRecorder();
rec.markStart('patternMatching');
rec.markLLMStart('patternMatching');
rec.record({ engine: 'patternMatching', status: 'ok', attempts: 1 });
const measured = newMeasure();
addCall(measured, Date.now() - 42_000, { input_tokens: 30000, output_tokens: 5100 }, 8000);
rec.recordMeasure('patternMatching', measured);

const snapBefore = rec.snapshot();
check('Avant finalize : tokens de sortie poses', snapBefore.patternMatching.outputTokens, 5100);
check('Avant finalize : nombre d appels pose', snapBefore.patternMatching.llmCalls, 1);
check('Avant finalize : plafond pose', snapBefore.patternMatching.maxTokens, 8000);
checkTrue('Avant finalize : duree LLM posee',
  (snapBefore.patternMatching.llmDurationMs ?? 0) >= 42_000);

rec.finalizeFromResult(
  { patternMatching: { comparables: [{ name: 'X' }] } },
  { patternMatching: 'patternMatching' },
);
const snapAfter = rec.snapshot();
check('Apres finalize : statut recalcule', snapAfter.patternMatching.status, 'ok');
check('Apres finalize : la mesure survit', snapAfter.patternMatching.outputTokens, 5100);
check('Apres finalize : le nombre d appels survit', snapAfter.patternMatching.llmCalls, 1);

// Cas du moteur tombe : c est celui qui renseigne le plus le
// dimensionnement, sa mesure doit etre lisible.
const rec2 = new EngineStatusRecorder();
rec2.markStart('blindspotAnalysis');
rec2.markLLMStart('blindspotAnalysis');
rec2.record({ engine: 'blindspotAnalysis', status: 'failed', attempts: 1, errorMessage: 'Request timed out.' });
const failedMeasure = newMeasure();
addCall(failedMeasure, Date.now() - 3_000, { output_tokens: 0 }, 14000);
rec2.recordMeasure('blindspotAnalysis', failedMeasure);
const snap2 = rec2.snapshot();
check('Moteur tombe : statut conserve', snap2.blindspotAnalysis.status, 'failed');
check('Moteur tombe : appel compte', snap2.blindspotAnalysis.llmCalls, 1);
check('Moteur tombe : message conserve', snap2.blindspotAnalysis.errorMessage, 'Request timed out.');

// Puits reste vide : rien ne doit etre pose, on ne veut pas de zeros
// qui se liraient comme une mesure faite.
const rec3 = new EngineStatusRecorder();
rec3.record({ engine: 'causalReversal', status: 'failed-upstream', attempts: 1 });
rec3.recordMeasure('causalReversal', newMeasure());
const snap3 = rec3.snapshot();
check('Aucun appel effectue : aucune mesure posee', snap3.causalReversal.llmCalls, undefined);
check('Aucun appel effectue : aucun token pose', snap3.causalReversal.outputTokens, undefined);

// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);
