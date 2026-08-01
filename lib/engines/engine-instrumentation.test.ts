// ============================================================
// TESTS - INSTRUMENTATION D APPEL DES MOTEURS BUDGETES
// ------------------------------------------------------------
// Les fenetres posees par le commit precedent sont extrapolees a
// partir d un seul point mesure. Le volume de sortie reel des six
// moteurs est inconnu : aucun n a jamais abouti et callClaude ne
// remontait pas l usage. Dimensionner a l estime est tenable une fois,
// pas deux.
//
// La couche amont, team market macro financialCoherence et la synthese
// finale, rejoint la mesure au brief 17 (section 5). Le motif est le
// meme, l urgence est plus forte : team est la porte de cinq moteurs,
// sa fenetre de 180s a ete calibree sur des durees totales
// reconstituees a l exterieur du moteur, et le seul run qui l a fait
// tomber l a coupe pile a son plafond, donc sans rien apprendre de sa
// duree reelle. Instrumenter la porte est ce qui transforme le prochain
// arbitrage en mesure au lieu d un second pari.
//
// Ce qui est verrouille ici :
//   - Les onze sites passent par le canal qui rend l usage, et non plus
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
import { newMeasure, addCall, hitTokenCeiling, ENGINE_LLM_BUDGET } from './engine-budget';
import { parseJSON as parse } from './anthropic-client';
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

/** Le depot doit avoir lieu meme quand le moteur echoue : c est
 *  justement le cas ou la mesure renseigne le dimensionnement. Deux
 *  formes coexistent selon que le moteur vit dans une IIFE async ou
 *  dans une chaine de promesses, on verifie la garde et non la forme. */
function depotEstGarde(src: string, appel: string): boolean {
  const i = src.indexOf(appel);
  if (i < 0) return false;
  return /finally/.test(src.slice(Math.max(0, i - 600), i));
}
for (const { recorderKey } of ENGINES) {
  checkTrue(`route.ts : le depot de ${recorderKey} survit a l echec du moteur`,
    depotEstGarde(routeSrc, `enginesRecorder.recordMeasure('${recorderKey}', measure)`));
}

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
// SECTION 5. LA COUCHE AMONT ET LA SYNTHESE FINALE
// ------------------------------------------------------------
// Les cinq moteurs qui encadrent les six precedents dans le pipeline,
// la porte [team, market, macro], financialCoherence, et la synthese
// qui ferme le run. Aucun n etait mesure, et team est celui dont
// l ignorance coute le plus : il commande cinq moteurs en aval, son
// echec les condamne tous, et sa fenetre a ete dimensionnee sur des
// durees observees de l exterieur. Le prochain run doit rendre sa
// duree d appel reelle meme s il tombe encore.
// ============================================================

console.log('\n=== Section 5. Couche amont et synthese finale ===');

const AMONT: Array<{ file: string; recorderKey: string; sink: string }> = [
  { file: 'lib/engines/team-engine.ts', recorderKey: 'team', sink: 'teamMeasure' },
  { file: 'lib/engines/market-engine.ts', recorderKey: 'market', sink: 'marketMeasure' },
  { file: 'lib/engines/macro-engine.ts', recorderKey: 'macro', sink: 'macroMeasure' },
  { file: 'lib/engines/financial-coherence-engine.ts', recorderKey: 'financialCoherence', sink: 'financialCoherenceMeasure' },
  { file: 'lib/engines/orchestrator.ts', recorderKey: 'finalRecommendation', sink: 'orchestrateMeasure' },
];

for (const { file } of AMONT) {
  const src = read(file);
  checkTrue(`${file} : passe par callClaudeWithUsage`, src.includes('callClaudeWithUsage('));
  checkTrue(`${file} : n appelle plus le canal qui jette l usage`,
    !/[^h]\bcallClaude\(/.test(src));
  checkTrue(`${file} : accepte un puits de mesure optionnel`, src.includes('measure?: LlmMeasure'));
  checkTrue(`${file} : depose son appel dans le puits`, src.includes('addCall(measure'));
}

/** Le modele passe desormais explicitement a chaque site d appel.
 *  callClaude et callClaudeWithUsage ont le meme defaut, la bascule
 *  est donc neutre, mais un undefined positionnel en quatrieme place
 *  laissait la lecture du site dependre de la signature du client. On
 *  inspecte chaque appel et non le fichier entier : un undefined dans
 *  un appel voisin n a rien a voir avec le modele. */
function appelsAvecUsage(src: string): string[] {
  const out: string[] = [];
  let i = src.indexOf('callClaudeWithUsage(');
  while (i >= 0) {
    out.push(src.slice(i, i + 400));
    i = src.indexOf('callClaudeWithUsage(', i + 1);
  }
  return out;
}
for (const { file } of AMONT) {
  const appels = appelsAvecUsage(read(file));
  checkTrue(`${file} : au moins un appel instrumente`, appels.length >= 1);
  checkTrue(`${file} : chaque appel nomme son modele`,
    appels.every(a => /\bMODEL,/.test(a)));
  checkTrue(`${file} : aucun appel ne laisse undefined en position modele`,
    appels.every(a => !/^\s+undefined,/m.test(a.split(');')[0])));
}

for (const { recorderKey, sink } of AMONT) {
  checkTrue(`route.ts : reverse la mesure de ${recorderKey} dans le releve`,
    routeSrc.includes(`enginesRecorder.recordMeasure('${recorderKey}', ${sink})`));
  checkTrue(`route.ts : le depot de ${recorderKey} survit a l echec du moteur`,
    depotEstGarde(routeSrc, `enginesRecorder.recordMeasure('${recorderKey}', ${sink})`));
  checkTrue(`route.ts : le puits de ${recorderKey} est cree par la route`,
    routeSrc.includes(`const ${sink} = newMeasure()`));
}

// La synthese ne recoit son puits que si la route le lui passe : elle
// est le seul des cinq a etre appelee en positionnel long.
checkTrue('route.ts : la synthese recoit son puits en argument',
  /analysisId,\n\s+orchestrateMeasure,/.test(routeSrc));

// Onze moteurs mesures, ni plus ni moins. Un moteur ajoute au pipeline
// sans puits se lit ici comme un ecart de compte.
check('route.ts : onze depots de mesure au total',
  (routeSrc.match(/enginesRecorder\.recordMeasure\(/g) || []).length, 11);

// La cle de la synthese est celle que finalizeFromResult reconstruit.
// Si les deux divergeaient, la mesure serait posee a cote de l entree
// au lieu d y etre fusionnee, et n apparaitrait nulle part.
checkTrue('route.ts : la cle de mesure de la synthese est celle du releve final',
  routeSrc.includes("finalRecommendation: 'finalRecommendation'"));

const rec4 = new EngineStatusRecorder();
rec4.markLLMStart('finalRecommendation');
const synthese = newMeasure();
addCall(synthese, Date.now() - 96_000, { input_tokens: 61000, output_tokens: 4200 }, 5000);
rec4.recordMeasure('finalRecommendation', synthese);
rec4.finalizeFromResult(
  { finalRecommendation: { verdict: 'A instruire', decisionDrivers: [{ label: 'X' }] } },
  { finalRecommendation: 'finalRecommendation' },
);
const snap4 = rec4.snapshot();
check('Synthese : statut reconstruit par la finalisation', snap4.finalRecommendation.status, 'ok');
check('Synthese : la mesure survit a la finalisation', snap4.finalRecommendation.outputTokens, 4200);
check('Synthese : le plafond de 5000 est lisible dans le releve', snap4.finalRecommendation.maxTokens, 5000);
checkTrue('Synthese : duree d appel lisible dans le releve',
  (snap4.finalRecommendation.llmDurationMs ?? 0) >= 96_000);

// La boucle de reprise de la route partage un puits unique entre ses
// trois tentatives. Le nombre d appels doit donc valoir le nombre de
// tentatives reellement parties, c est ce qui distingue une synthese
// lente d une synthese rejouee.
const troisTentatives = newMeasure();
addCall(troisTentatives, Date.now() - 150_000, { output_tokens: 0 }, 5000);
addCall(troisTentatives, Date.now() - 150_000, { output_tokens: 0 }, 5000);
check('Puits partage : deux tentatives comptees', troisTentatives.calls, 2);
checkTrue('Puits partage : durees des tentatives cumulees', troisTentatives.llmDurationMs >= 300_000);

// Le cas qui motive tout le commit : team tombe, et sa mesure doit
// quand meme dire combien de temps son appel a tenu avant la coupure.
const rec5 = new EngineStatusRecorder();
rec5.record({ engine: 'team', status: 'timeout', attempts: 1, errorMessage: 'engine team timeout' });
const teamTombe = newMeasure();
addCall(teamTombe, Date.now() - 179_000, undefined, 8000);
rec5.recordMeasure('team', teamTombe);
const snap5 = rec5.snapshot();
check('Porte tombee : statut conserve', snap5.team.status, 'timeout');
checkTrue('Porte tombee : la duree de son appel est enfin lisible',
  (snap5.team.llmDurationMs ?? 0) >= 179_000);
check('Porte tombee : un appel compte', snap5.team.llmCalls, 1);

// ============================================================
// SECTION 6. TRACABILITE DU PARSE ET FRANCHISSEMENT DU PLAFOND
// ------------------------------------------------------------
// jsonrepair recoud une sortie coupee sans lever ni logger, et le
// moteur ressort en ok. reference-checks a rendu exactement 4000
// tokens sur 4000 au run 2517a288 avec un parse reussi, sans qu on
// puisse trancher entre une sortie complete et une reparation. Deux
// champs ferment la question au prochain run.
// ============================================================

console.log('\n=== Section 6. Tracabilite du parse et plafond ===');

const tDirect = newMeasure();
parse('{"a":1}', tDirect);
check('JSON propre : parse direct', tDirect.parseMode, 'direct');

const tExtrait = newMeasure();
parse('Voici le resultat :\n{"a":1}', tExtrait);
check('JSON enrobe de prose : parse extrait', tExtrait.parseMode, 'extracted');

// Structure coupee : le parseur la complete lui-meme, seconde voie de
// reparation silencieuse distincte de jsonrepair et tout aussi muette
// avant ce commit.
const tCoupe = newMeasure();
parse('{"a":1,"b":[1,2', tCoupe);
check('Structure non refermee : parse recupere', tCoupe.parseMode, 'recovered');

// Structure fermee mais mal formee : jsonrepair intervient.
const tRepare = newMeasure();
parse('{"a":1,"b":2,}', tRepare);
checkTrue('Structure fermee mais mal formee : la sortie est declaree modifiee',
  tRepare.parseMode === 'recovered' || tRepare.parseMode === 'repaired');

// Les deux voies qui modifient la structure doivent etre distinguables
// de celles qui ne la modifient pas : c est tout l objet du champ.
const NE_MODIFIE_PAS = ['direct', 'extracted'];
checkTrue('Une sortie propre n est jamais declaree modifiee',
  NE_MODIFIE_PAS.includes(tDirect.parseMode!) && NE_MODIFIE_PAS.includes(tExtrait.parseMode!));
checkTrue('Une sortie coupee est toujours declaree modifiee',
  !NE_MODIFIE_PAS.includes(tCoupe.parseMode!));

const tFence = newMeasure();
parse('```json\n{"a":1}\n```', tFence);
check('Fence markdown : reste un parse direct', tFence.parseMode, 'direct');

checkTrue('Puits absent : parseJSON ne leve pas',
  (() => { try { parse('{"a":1}'); return true; } catch { return false; } })());

// Le franchissement est evalue appel par appel. Un moteur qui reprend
// apres une coupure noierait le signal dans la somme cumulee : le
// premier appel coupe a 4000 plus une reprise courte a 900 donne 4900
// sur un plafond de 5000, soit moins que le seuil, alors qu un appel
// a bien ete coupe.
const coupePuisRepris = newMeasure();
addCall(coupePuisRepris, Date.now(), { output_tokens: 5000 }, 5000);
addCall(coupePuisRepris, Date.now(), { output_tokens: 900 }, 5000);
check('Coupure puis reprise : le cumul repasse sous le seuil', coupePuisRepris.outputTokens, 5900);
checkTrue('Coupure puis reprise : le drapeau retient la coupure',
  coupePuisRepris.hitCeiling === true);

const jamaisCoupe = newMeasure();
addCall(jamaisCoupe, Date.now(), { output_tokens: 2800 }, 5000);
checkTrue('Sortie confortable : aucun franchissement', !jamaisCoupe.hitCeiling);

// Les deux champs doivent atteindre le releve, sinon ils ne servent
// a rien : c est le JSON persiste qu on relit apres un run.
const recTrace = new EngineStatusRecorder();
const mTrace = newMeasure();
addCall(mTrace, Date.now(), { output_tokens: 5000 }, 5000);
mTrace.parseMode = 'repaired';
recTrace.recordMeasure('referenceChecks', mTrace);
recTrace.finalizeFromResult(
  { referenceChecks: { founderChecks: [{ q: 'x' }] } },
  { referenceChecks: 'referenceChecks' },
);
const snapTrace = recTrace.snapshot();
check('Releve : le franchissement est persiste', snapTrace.referenceChecks.hitCeiling, true);
check('Releve : le mode de parse est persiste', snapTrace.referenceChecks.parseMode, 'repaired');
checkTrue('Releve : les deux champs survivent a la finalisation',
  snapTrace.referenceChecks.status === 'ok'
  && snapTrace.referenceChecks.hitCeiling === true
  && snapTrace.referenceChecks.parseMode === 'repaired');

// Un moteur non instrumente ne doit pas afficher de faux champs.
const recNu = new EngineStatusRecorder();
const mNu = newMeasure();
addCall(mNu, Date.now(), { output_tokens: 100 }, 5000);
recNu.recordMeasure('macro', mNu);
const snapNu = recNu.snapshot();
check('Aucune coupure : pas de drapeau pose', snapNu.macro.hitCeiling, undefined);
check('Aucun parse trace : pas de mode pose', snapNu.macro.parseMode, undefined);

// Le plafond de reference-checks et son cablage.
const refEngineSrc = read('lib/engines/reference-checks-engine.ts');
checkTrue('reference-checks : le plafond est nomme et vaut 5000',
  refEngineSrc.includes('export const REFERENCE_CHECKS_MAX_TOKENS = 5000'));
checkTrue('reference-checks : plus aucun litteral 4000 au site d appel',
  !/userPrompt, 4000, FAST_MODEL/.test(refEngineSrc));
check('reference-checks : les deux appels lisent le plafond nomme',
  (refEngineSrc.match(/REFERENCE_CHECKS_MAX_TOKENS/g) || []).length, 5);
checkTrue('reference-checks : sa fenetre de temps n a pas bouge',
  ENGINE_LLM_BUDGET.referenceChecks.timeout === 70_000);

// Les onze moteurs instrumentes doivent tous tracer leur parse,
// sinon le champ ne dit rien de la moitie du pipeline.
//
// Deux cablages coexistent depuis le brief 21. Les moteurs passes au
// point de passage unique deposent leur puits via l option trace de
// parseEngineOutput, qui evalue le contrat minimal au site d appel et
// releve le mode exactement comme parseJSON le faisait. Les autres
// gardent l appel direct a parseJSON. Ce qui est verifie ici n est pas
// la voie prise mais le fait que le puits soit passe : un moteur qui
// parse sans tracer laisse une colonne muette dans le releve.
for (const { file } of [...ENGINES, ...AMONT]) {
  const src = read(file);
  checkTrue(`${file} : passe le puits a la couche de parse`,
    /parseJSON<[^;]*>\([a-zA-Z]+, measure\)/.test(src)
    || /trace: measure/.test(src));
}

// Le point de passage du contrat, quand il est cable, doit l etre avec
// la cle de releve du moteur et non son libelle : c est cette cle qui
// indexe MINIMAL_CONTRACTS et pipeline_engines_status.
{
  const CLES_ATTENDUES: Record<string, string> = {
    'lib/engines/team-engine.ts': 'team',
    'lib/engines/market-engine.ts': 'market',
    'lib/engines/macro-engine.ts': 'macro',
    'lib/engines/blindspot-engine.ts': 'blindspotAnalysis',
    'lib/engines/contrarian-engine.ts': 'contrarianAnalysis',
    'lib/engines/causal-engine.ts': 'causalReversal',
    'lib/engines/pattern-engine.ts': 'patternMatching',
    'lib/engines/narrative-drift-engine.ts': 'narrativeDrift',
    'lib/engines/financial-coherence-engine.ts': 'financialCoherence',
    'lib/engines/reference-checks-engine.ts': 'referenceChecks',
    'lib/engines/orchestrator.ts': 'finalRecommendation',
  };
  for (const [file, cle] of Object.entries(CLES_ATTENDUES)) {
    const src = read(file);
    checkTrue(`${file} : contrat evalue au site d appel sous la cle ${cle}`,
      src.includes('parseEngineOutput') && src.includes(`'${cle}'`));
  }
}

// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);
