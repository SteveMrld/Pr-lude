// ============================================================
// Tests deterministes engine-status-recorder.ts
// ------------------------------------------------------------
// Suite 1 : les cinq statuts (ok, failed, timeout,
//           skipped_not_applicable, empty_output).
// Suite 2 : contrats minimaux par moteur, cas TOLSON.
// Suite 3 : calcul du statut de run et du message d erreur.
// Suite 4 : preservation d un statut failed / failed-upstream /
//           timeout deja enregistre lors du finalize.
// Suite 5 : promotion failed -> failed-upstream, distinction
//           attente sur dependances contre execution reelle.
// ============================================================

import {
  EngineStatusRecorder,
  passesMinimalContract,
  isSkippedByRelevanceMatrix,
  GAP_STATUSES,
} from './engine-status-recorder';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Les cinq statuts
// ============================================================

console.log('\n[Suite 1] Les cinq statuts');

{
  const r = new EngineStatusRecorder();
  r.markStart('team');
  r.record({ engine: 'team', status: 'ok', attempts: 1 });
  const s = r.snapshot();
  check(s.team?.status === 'ok', 'ok enregistre');
  check(typeof s.team?.durationMs === 'number', '  durationMs numerique');
}

{
  const r = new EngineStatusRecorder();
  r.record({ engine: 'market', status: 'failed', attempts: 1, errorMessage: 'Anthropic 529 overloaded', durationMs: 3000 });
  const s = r.snapshot();
  check(s.market?.status === 'failed', 'failed enregistre');
  check(s.market?.errorMessage === 'Anthropic 529 overloaded', '  errorMessage present');
}

{
  const r = new EngineStatusRecorder();
  r.record({ engine: 'macro', status: 'timeout', attempts: 1, errorMessage: 'deadline-exceeded', durationMs: 120000 });
  const s = r.snapshot();
  check(s.macro?.status === 'timeout', 'timeout enregistre');
  check(s.macro?.durationMs === 120000, '  durationMs bornee au deadline');
}

{
  const r = new EngineStatusRecorder();
  // Le moteur skipped_not_applicable est detecte via __skipped: true dans le sortant
  r.finalizeFromResult({ team: { __skipped: true, __overrideReason: 'growth-track' } }, { team: 'team' });
  const s = r.snapshot();
  check(s.team?.status === 'skipped_not_applicable', 'skipped_not_applicable detecte via __skipped');
}

{
  // Un moteur qui repond sans erreur mais avec null sortant est empty_output
  const r = new EngineStatusRecorder();
  r.finalizeFromResult({ market: null }, { market: 'market' });
  const s = r.snapshot();
  check(s.market?.status === 'empty_output', 'null sortant => empty_output');
}

// ============================================================
// SUITE 2 - Contrats minimaux, cas TOLSON
// ============================================================

console.log('\n[Suite 2] Contrats minimaux et cas TOLSON');

{
  // TOLSON reel : market NULL, narrativeDrift NULL, fragiliteStructurelle NULL,
  // finalRecommendation.decisionDrivers = []. Tous doivent sortir en empty_output.
  const tolsonResult = {
    extraction: { companyName: 'TOLSON', yearFounded: 2011 },
    market: null,
    narrativeDrift: null,
    fragiliteStructurelle: null,
    finalRecommendation: { verdict: 'approfondir', decisionDrivers: [] },
  };
  const r = new EngineStatusRecorder();
  r.finalizeFromResult(tolsonResult, {
    extraction: 'extraction',
    market: 'market',
    narrativeDrift: 'narrativeDrift',
    fragiliteStructurelle: 'fragiliteStructurelle',
    finalRecommendation: 'finalRecommendation',
  });
  const s = r.snapshot();
  check(s.extraction?.status === 'ok', 'TOLSON : extraction ok');
  check(s.market?.status === 'empty_output', 'TOLSON : market empty_output');
  check(s.narrativeDrift?.status === 'empty_output', 'TOLSON : narrativeDrift empty_output');
  check(s.fragiliteStructurelle?.status === 'empty_output', 'TOLSON : fragiliteStructurelle empty_output');
  check(s.finalRecommendation?.status === 'empty_output', 'TOLSON : finalRecommendation empty_output (decisionDrivers vide)');
}

{
  // finalRecommendation avec drivers renseignes => ok
  const r = new EngineStatusRecorder();
  r.finalizeFromResult({
    finalRecommendation: { verdict: 'investir', decisionDrivers: ['equipe solide', 'moat reseau', 'timing marche'] },
  }, { finalRecommendation: 'finalRecommendation' });
  check(r.snapshot().finalRecommendation?.status === 'ok', 'finalRecommendation avec drivers => ok');
}

{
  // Objet vide = empty_output
  const r = new EngineStatusRecorder();
  r.finalizeFromResult({ market: {} }, { market: 'market' });
  check(r.snapshot().market?.status === 'empty_output', 'objet vide => empty_output');
}

{
  // market avec un seul champ minimal (perceivedSize) => ok
  const r = new EngineStatusRecorder();
  r.finalizeFromResult({ market: { perceivedSize: 'large' } }, { market: 'market' });
  check(r.snapshot().market?.status === 'ok', 'market avec perceivedSize => ok');
}

{
  check(isSkippedByRelevanceMatrix({ __skipped: true }) === true, 'isSkippedByRelevanceMatrix true');
  check(isSkippedByRelevanceMatrix({ verdict: 'ok' }) === false, 'isSkippedByRelevanceMatrix false sans marqueur');
  check(isSkippedByRelevanceMatrix(null) === false, 'isSkippedByRelevanceMatrix null');
  check(isSkippedByRelevanceMatrix({ __skipped: false }) === false, 'isSkippedByRelevanceMatrix false explicit');
}

{
  check(passesMinimalContract('market', { perceivedSize: 'large' }) === true, 'contrat market : perceivedSize suffit');
  check(passesMinimalContract('market', { needIntensity: { rationale: 'x' } }) === true, 'contrat market : needIntensity suffit');
  check(passesMinimalContract('market', null) === false, 'contrat market : null echoue');
  check(passesMinimalContract('narrativeDrift', { verdict: 'stable' }) === true, 'contrat narrativeDrift : verdict suffit');
  check(passesMinimalContract('narrativeDrift', null) === false, 'contrat narrativeDrift : null echoue');
  // fragiliteStructurelle : la sortie reelle expose patterns en Record
  // indexe par PatternId, pas en Array. L ancien contrat qui exigeait
  // Array.isArray produisait un empty_output sur toute sortie nominale
  // (bug cause racine du run c50bb153).
  check(passesMinimalContract('fragiliteStructurelle', {
    patterns: { 'growth-subsidized-model': { patternId: 'growth-subsidized-model' } },
  }) === true, 'contrat fragiliteStructurelle : patterns Record satisfait');
  check(passesMinimalContract('fragiliteStructurelle', {
    globalFragilityScore: 33,
    combinaisons: [],
  }) === true, 'contrat fragiliteStructurelle : globalFragilityScore suffit');
  check(passesMinimalContract('fragiliteStructurelle', {
    combinaisons: [{ nom: 'x' }],
  }) === true, 'contrat fragiliteStructurelle : combinaisons non vide suffit');
  check(passesMinimalContract('fragiliteStructurelle', { patterns: {} }) === false,
    'contrat fragiliteStructurelle : patterns Record vide echoue');
  check(passesMinimalContract('fragiliteStructurelle', null) === false,
    'contrat fragiliteStructurelle : null echoue');

  // saasMetrics : ndr et magicNumber sont imbriques sous retention et
  // salesEfficiency (structure canonique du moteur).
  check(passesMinimalContract('saasMetrics', {
    retention: { ndr: 105, ndrProvenance: 'declared' },
  }) === true, 'contrat saasMetrics : retention presente suffit');
  check(passesMinimalContract('saasMetrics', {
    salesEfficiency: { magicNumber: 1.2, magicNumberProvenance: 'declared' },
  }) === true, 'contrat saasMetrics : salesEfficiency presente suffit');
  check(passesMinimalContract('saasMetrics', { ndr: 105 }) === false,
    'contrat saasMetrics : ndr top-level (ancien contrat) ne satisfait pas');
  check(passesMinimalContract('saasMetrics', null) === false,
    'contrat saasMetrics : null echoue');

  // industrialMetrics : structure plate a champs metriques, pas de
  // champ indicators. Marqueur __skipped valide pour hors-scope.
  check(passesMinimalContract('industrialMetrics', {
    commercialCycleMonths: 8,
    commercialCycleProvenance: 'declared',
  }) === true, 'contrat industrialMetrics : un champ metrique nominal suffit');
  check(passesMinimalContract('industrialMetrics', { __skipped: true }) === true,
    'contrat industrialMetrics : marqueur __skipped satisfait');
  check(passesMinimalContract('industrialMetrics', { indicators: [1] }) === false,
    'contrat industrialMetrics : champ indicators (ancien contrat) ne satisfait pas');
  check(passesMinimalContract('industrialMetrics', {}) === false,
    'contrat industrialMetrics : objet vide echoue');

  // macro : champs reels sont structuralTrends et regulatoryEnvironment.
  check(passesMinimalContract('macro', { structuralTrends: ['t1'] }) === true,
    'contrat macro : structuralTrends satisfait (nouveau nom reel)');
  check(passesMinimalContract('macro', { regulatoryEnvironment: 'stable' }) === true,
    'contrat macro : regulatoryEnvironment satisfait');
  check(passesMinimalContract('macro', { cyclePosition: 'mature' }) === true,
    'contrat macro : cyclePosition (deja correct) preserve');

  // patternMatching : averageScore et insights vivent sous
  // retrospectiveBenchmark, pas top-level.
  check(passesMinimalContract('patternMatching', {
    retrospectiveBenchmark: { averageScore: 65, insights: 'x' },
  }) === true, 'contrat patternMatching : retrospectiveBenchmark.averageScore satisfait');
  check(passesMinimalContract('patternMatching', {
    comparables: [{ caseId: 'c1' }],
  }) === true, 'contrat patternMatching : comparables top-level (deja correct) preserve');

  // executionFriction : le score global s appelle globalScore, pas
  // overallScore. Ancien contrat testait overallScore qui n existe pas.
  check(passesMinimalContract('executionFriction', { globalScore: 60 }) === true,
    'contrat executionFriction : globalScore (nom reel) satisfait');
  check(passesMinimalContract('executionFriction', { axes: [{ axis: 'x' }] }) === true,
    'contrat executionFriction : axes (deja correct) preserve');

  // narrativeDrift : verdict reste correct ; on ajoute globalDriftScore
  // et metriquesLexicales qui existent aussi dans la sortie reelle.
  check(passesMinimalContract('narrativeDrift', { globalDriftScore: 40 }) === true,
    'contrat narrativeDrift : globalDriftScore satisfait');
  check(passesMinimalContract('narrativeDrift', {
    metriquesLexicales: { densiteConcrete: 0.4 },
  }) === true, 'contrat narrativeDrift : metriquesLexicales satisfait');

  check(passesMinimalContract('finalRecommendation', { verdict: 'investir', decisionDrivers: [] }) === false, 'finalRecommendation : verdict seul insuffisant si drivers vides');
  check(passesMinimalContract('finalRecommendation', { verdict: 'investir', decisionDrivers: ['x'] }) === true, 'finalRecommendation : verdict + drivers ok');
}

// ============================================================
// SUITE 3 - Statut de run et message d erreur
// ============================================================

console.log('\n[Suite 3] Statut de run et message d erreur');

{
  const r = new EngineStatusRecorder();
  r.record({ engine: 'team', status: 'ok', attempts: 1, durationMs: 5000 });
  r.record({ engine: 'market', status: 'ok', attempts: 1, durationMs: 6000 });
  check(r.computeRunStatus() === 'completed', 'aucune lacune : completed');
  check(r.computeErrorMessage() === null, '  errorMessage null');
}

{
  const r = new EngineStatusRecorder();
  r.record({ engine: 'team', status: 'ok', attempts: 1 });
  r.record({ engine: 'market', status: 'failed', attempts: 1, errorMessage: '529 overloaded' });
  check(r.computeRunStatus() === 'completed_with_gaps', 'une lacune failed : completed_with_gaps');
  const msg = r.computeErrorMessage();
  check(msg !== null && msg.includes('failed: market'), `  errorMessage liste market failed (obtenu: ${msg})`);
}

{
  // Cas TOLSON reproduit avec quatre lacunes empty_output
  const r = new EngineStatusRecorder();
  r.finalizeFromResult({
    market: null,
    narrativeDrift: null,
    fragiliteStructurelle: null,
    finalRecommendation: { verdict: 'approfondir', decisionDrivers: [] },
  }, {
    market: 'market',
    narrativeDrift: 'narrativeDrift',
    fragiliteStructurelle: 'fragiliteStructurelle',
    finalRecommendation: 'finalRecommendation',
  });
  check(r.computeRunStatus() === 'completed_with_gaps', 'TOLSON : completed_with_gaps');
  const msg = r.computeErrorMessage()!;
  check(msg.includes('empty_output:'), '  errorMessage mentionne empty_output');
  check(msg.includes('market'), '  ...market');
  check(msg.includes('narrativeDrift'), '  ...narrativeDrift');
  check(msg.includes('fragiliteStructurelle'), '  ...fragiliteStructurelle');
  check(msg.includes('finalRecommendation'), '  ...finalRecommendation');
}

{
  const r = new EngineStatusRecorder();
  r.record({ engine: 'team', status: 'skipped_not_applicable', attempts: 1 });
  check(r.computeRunStatus() === 'completed', 'skipped_not_applicable ne compte pas comme lacune');
}

{
  // Melange : ok + skipped + failed
  const r = new EngineStatusRecorder();
  r.record({ engine: 'extraction', status: 'ok', attempts: 1 });
  r.record({ engine: 'team', status: 'skipped_not_applicable', attempts: 1 });
  r.record({ engine: 'market', status: 'timeout', attempts: 1, errorMessage: 'deadline-exceeded' });
  check(r.computeRunStatus() === 'completed_with_gaps', 'ok + skipped + timeout => completed_with_gaps');
  const msg = r.computeErrorMessage()!;
  check(msg.includes('timeout: market'), '  errorMessage : timeout market');
  check(!msg.includes('team'), '  errorMessage ne mentionne pas team (skipped)');
}

// ============================================================
// SUITE 4 - Preservation d un statut failed / timeout
// ============================================================

console.log('\n[Suite 4] Preservation d un statut failed / timeout dans finalize');

{
  const r = new EngineStatusRecorder();
  // Le moteur a rejette avec 529, on l enregistre
  r.record({ engine: 'market', status: 'failed', attempts: 3, errorMessage: '529 overloaded', durationMs: 90000 });
  // Puis le orchestrateur finalise a partir du result qui contient market=null (fallback)
  r.finalizeFromResult({ market: null }, { market: 'market' });
  const s = r.snapshot();
  check(s.market?.status === 'failed', 'failed prealable preserve, pas ecrase par empty_output');
  check(s.market?.errorMessage === '529 overloaded', '  errorMessage prealable preserve');
  check(s.market?.attempts === 3, '  attempts prealable preserve');
}

{
  const r = new EngineStatusRecorder();
  r.record({ engine: 'macro', status: 'timeout', attempts: 1, errorMessage: 'deadline-exceeded' });
  r.finalizeFromResult({ macro: null }, { macro: 'macro' });
  check(r.snapshot().macro?.status === 'timeout', 'timeout prealable preserve');
}

{
  // En revanche, un enregistrement ok peut etre reevalue en empty_output si
  // le sortant final ne satisfait plus le contrat. Cas d un moteur qui a
  // repondu quelque chose mais dont l orchestrateur a remplace le sortant
  // par null en downstream.
  const r = new EngineStatusRecorder();
  r.record({ engine: 'market', status: 'ok', attempts: 1 });
  r.finalizeFromResult({ market: null }, { market: 'market' });
  check(r.snapshot().market?.status === 'empty_output', 'ok reevalue en empty_output si sortant final null');
}

{
  // GAP_STATUSES est stable
  check(GAP_STATUSES.length === 4, '4 statuts de lacune');
  check((GAP_STATUSES as readonly string[]).includes('failed'), 'GAP inclut failed');
  check((GAP_STATUSES as readonly string[]).includes('failed-upstream'), 'GAP inclut failed-upstream');
  check((GAP_STATUSES as readonly string[]).includes('timeout'), 'GAP inclut timeout');
  check((GAP_STATUSES as readonly string[]).includes('empty_output'), 'GAP inclut empty_output');
  check(!(GAP_STATUSES as readonly string[]).includes('skipped_not_applicable'), 'GAP n inclut pas skipped');
  check(!(GAP_STATUSES as readonly string[]).includes('ok'), 'GAP n inclut pas ok');
}

// ============================================================
// SUITE 5 - Promotion failed -> failed-upstream et durees
// ============================================================

console.log('\n[Suite 5] Promotion failed -> failed-upstream, distinction wait / execution');

{
  // Cas In Haircare : team appelle son LLM et timeout ; pattern
  // depend de team, market, macro et rejete en cascade sans avoir
  // jamais appele son LLM. Doit sortir failed-upstream, pas failed,
  // et son errorMessage doit nommer team, jamais "Request timed out."
  const r = new EngineStatusRecorder();
  r.markStart('team');
  r.markLLMStart('team');
  r.record({ engine: 'team', status: 'failed', attempts: 1, errorMessage: 'Request timed out.', durationMs: 61000 });

  r.markStart('patternMatching', ['team', 'market', 'macro']);
  // markLLMStart JAMAIS appele : pattern attendait ses deps
  r.record({ engine: 'patternMatching', status: 'failed', attempts: 1, errorMessage: 'Request timed out.', durationMs: 61200 });

  const s = r.snapshot();
  check(s.team?.status === 'failed', 'team reste failed (a appele son LLM)');
  check(s.team?.errorMessage === 'Request timed out.', '  team errorMessage inchange');
  check(s.patternMatching?.status === 'failed-upstream', 'pattern promu failed-upstream (jamais appele son LLM)');
  check(s.patternMatching?.errorMessage === 'dependency failed: team', `  pattern errorMessage nomme team (obtenu: ${s.patternMatching?.errorMessage})`);
  check(s.patternMatching?.failedDependencies?.length === 1 && s.patternMatching?.failedDependencies?.[0] === 'team', '  failedDependencies liste team');
}

{
  // Plusieurs deps fautives : errorMessage les liste toutes.
  const r = new EngineStatusRecorder();
  r.markStart('team');
  r.markLLMStart('team');
  r.record({ engine: 'team', status: 'failed', attempts: 1, errorMessage: 'timeout' });
  r.markStart('market');
  r.markLLMStart('market');
  r.record({ engine: 'market', status: 'failed', attempts: 1, errorMessage: '529 overloaded' });
  r.markStart('macro');
  r.markLLMStart('macro');
  r.record({ engine: 'macro', status: 'ok', attempts: 1 });

  r.markStart('patternMatching', ['team', 'market', 'macro']);
  r.record({ engine: 'patternMatching', status: 'failed', attempts: 1, errorMessage: '529 overloaded' });

  const s = r.snapshot();
  check(s.patternMatching?.status === 'failed-upstream', 'cascade avec deux deps fautives');
  check(s.patternMatching?.errorMessage === 'dependency failed: team, market', `  errorMessage cite team et market (obtenu: ${s.patternMatching?.errorMessage})`);
  check(s.patternMatching?.failedDependencies?.length === 2, '  failedDependencies a deux entrees');
  check(!s.patternMatching?.failedDependencies?.includes('macro'), '  macro non cite (etait ok)');
}

{
  // markLLMStart appele => rejection n est PAS promue, meme sans succession
  // apres. Un moteur qui a effectivement appele son LLM et vu ce dernier
  // rejeter reste failed avec son propre message, jamais promu upstream.
  const r = new EngineStatusRecorder();
  r.markStart('narrativeDrift', ['extraction']);
  r.markLLMStart('narrativeDrift');
  r.record({ engine: 'narrativeDrift', status: 'failed', attempts: 1, errorMessage: 'Request timed out.' });
  const s = r.snapshot();
  check(s.narrativeDrift?.status === 'failed', 'appel LLM effectif reste failed');
  check(s.narrativeDrift?.errorMessage === 'Request timed out.', '  errorMessage propre preserve');
  check(s.narrativeDrift?.failedDependencies === undefined, '  aucun failedDependencies');
}

{
  // Record externe sans markStart : comportement legacy preserve,
  // pas de promotion. Les tests des suites 1 a 4 depensent de ca.
  const r = new EngineStatusRecorder();
  r.record({ engine: 'market', status: 'failed', attempts: 1, errorMessage: '529 overloaded', durationMs: 3000 });
  const s = r.snapshot();
  check(s.market?.status === 'failed', 'record externe sans markStart reste failed');
  check(s.market?.errorMessage === '529 overloaded', '  errorMessage preserve');
}

{
  // Sans markLLMStart, le fallback wait = totalDuration et execution = 0.
  // Verification synchrone d abord.
  const r = new EngineStatusRecorder();
  r.markStart('patternMatching', ['team']);
  r.record({ engine: 'patternMatching', status: 'failed', attempts: 1, errorMessage: 'x', durationMs: 500 });
  const s = r.snapshot();
  check(s.patternMatching?.waitDurationMs === 500, 'wait = total quand aucun LLM start (obtenu ' + s.patternMatching?.waitDurationMs + ')');
  check(s.patternMatching?.executionDurationMs === 0, 'execution = 0 quand aucun LLM start');
}

{
  // Sans deps declarees, la promotion utilise le balayage global des entrees.
  const r2 = new EngineStatusRecorder();
  r2.markStart('team');
  r2.markLLMStart('team');
  r2.record({ engine: 'team', status: 'failed', attempts: 1, errorMessage: 'timeout' });
  r2.markStart('patternMatching');
  r2.record({ engine: 'patternMatching', status: 'failed', attempts: 1, errorMessage: 'timeout' });
  const s2 = r2.snapshot();
  check(s2.patternMatching?.status === 'failed-upstream', 'sans deps declarees, balayage global');
  check(s2.patternMatching?.errorMessage?.includes('team') === true, 'errorMessage nomme team via balayage (obtenu: ' + s2.patternMatching?.errorMessage + ')');
}

{
  // finalizeFromResult preserve failed-upstream au meme titre que failed / timeout.
  const r3 = new EngineStatusRecorder();
  r3.markStart('patternMatching', ['team']);
  r3.markStart('team');
  r3.markLLMStart('team');
  r3.record({ engine: 'team', status: 'failed', attempts: 1, errorMessage: 'timeout' });
  r3.record({ engine: 'patternMatching', status: 'failed', attempts: 1, errorMessage: 'propage' });
  r3.finalizeFromResult({ patternMatching: null }, { patternMatching: 'patternMatching' });
  const s3 = r3.snapshot();
  check(s3.patternMatching?.status === 'failed-upstream', 'finalizeFromResult n ecrase pas failed-upstream');
}

{
  // failed-upstream compte comme lacune et computeErrorMessage le distingue de failed.
  const r4 = new EngineStatusRecorder();
  r4.markStart('team');
  r4.markLLMStart('team');
  r4.record({ engine: 'team', status: 'failed', attempts: 1, errorMessage: 'timeout' });
  r4.markStart('patternMatching', ['team']);
  r4.record({ engine: 'patternMatching', status: 'failed', attempts: 1, errorMessage: 'propage' });
  check(r4.computeRunStatus() === 'completed_with_gaps', 'failed-upstream compte comme gap');
  const msg = r4.computeErrorMessage()!;
  check(msg.includes('failed: team'), 'message liste team en failed (obtenu: ' + msg + ')');
  check(msg.includes('failed-upstream: patternMatching'), 'message liste pattern en failed-upstream (obtenu: ' + msg + ')');
  const failedSegment = msg.split(';').find((s) => s.trim().startsWith('failed:'));
  check(failedSegment !== undefined && !failedSegment.includes('patternMatching'), 'segment failed n inclut pas patternMatching');
}

// ============================================================
// SKIP DECLARE PAR LA MATRICE DE PERTINENCE
// ------------------------------------------------------------
// Un moteur ecarte par la matrice rend null. La finalisation ne voit
// que ce null, et un null nu ne dit pas s il vient d une decision
// doctrinale ou d un echec : le contrat minimal tombait, le moteur
// atterrissait en empty_output, et le run entier basculait en
// completed_with_gaps pour un moteur qui avait fait exactement ce
// qu on lui demandait. Le pipeline declare desormais le skip a la
// source, la ou le verdict de la matrice est connu.
// ============================================================
{
  const r = new EngineStatusRecorder();
  r.recordSkippedByMatrix('industrialMetrics', 'Modele non industriel.');
  const s = r.snapshot();
  check(s.industrialMetrics?.status === 'skipped_not_applicable',
    'skip matrice : statut skipped_not_applicable');
  check(s.industrialMetrics?.skipReason === 'Modele non industriel.',
    'skip matrice : le motif de la matrice est porte par le releve');
  check(r.gaps().length === 0, 'skip matrice : n ouvre aucune lacune');
  check(!(GAP_STATUSES as readonly string[]).includes('skipped_not_applicable'),
    'skip matrice : le statut n est pas un statut de lacune');
}

// La finalisation relit le result_json et y trouve le null laisse par
// la branche court-circuitee. Elle ne doit pas recouvrir le skip.
{
  const r = new EngineStatusRecorder();
  r.recordSkippedByMatrix('industrialMetrics', 'Modele non industriel.');
  r.finalizeFromResult(
    { industrialMetrics: null },
    { industrialMetrics: 'industrialMetrics' },
  );
  const s = r.snapshot();
  check(s.industrialMetrics?.status === 'skipped_not_applicable',
    'skip matrice : survit a finalizeFromResult malgre le null');
  check(s.industrialMetrics?.skipReason === 'Modele non industriel.',
    'skip matrice : le motif survit a la finalisation');
  check(r.computeRunStatus() === 'completed',
    'skip matrice : le run reste eligible a un completed nu');
}

// Sans declaration, le meme null reste une lacune. C est le
// comportement qu on veut conserver pour un moteur qui devait tourner.
{
  const r = new EngineStatusRecorder();
  r.finalizeFromResult(
    { industrialMetrics: null },
    { industrialMetrics: 'industrialMetrics' },
  );
  const s = r.snapshot();
  check(s.industrialMetrics?.status === 'empty_output',
    'null non declare : reste empty_output');
  check(r.gaps().length === 1, 'null non declare : ouvre bien une lacune');
}

// Un skip declare ne doit pas masquer un echec reel : si le moteur a
// tourne et echoue, c est l echec qui prime, quel que soit l ordre.
{
  const r = new EngineStatusRecorder();
  r.record({ engine: 'narrativeDrift', status: 'failed', attempts: 1, errorMessage: 'boom' });
  r.recordSkippedByMatrix('narrativeDrift', 'motif matrice');
  check(r.snapshot().narrativeDrift?.status === 'skipped_not_applicable',
    'dernier ecrivain gagne : le skip declare apres un echec ecrase (branche exclusive par construction)');
}

// La convention historique du drapeau __skipped reste valide : elle
// couvre le parcours growth, ou les moteurs rendent un objet conforme
// a leur interface. Les deux voies coexistent.
{
  check(isSkippedByRelevanceMatrix({ __skipped: true }) === true,
    'drapeau __skipped : toujours reconnu');
  check(isSkippedByRelevanceMatrix(null) === false,
    'drapeau __skipped : un null nu n est pas un skip');
}

// ============================================================
// GARDE DE NON-RECOUVREMENT DANS record()
// ------------------------------------------------------------
// Le brief 18 posait la declaration a la source et la garde a la
// finalisation, mais laissait un point de passage ouvert entre les
// deux. La branche ecartee remplace le travail par un
// Promise.resolve(null) que withEngineDeadline attend comme les
// autres. Cette promesse aboutit toujours, et la voie de succes du
// wrapper ecrivait un ok par-dessus la declaration : la finalisation
// ne trouvait plus de skip a preserver, relisait le null, echouait le
// contrat minimal et posait empty_output. Le run 4e30c644 le montre,
// entree persistee { status: empty_output, attempts: 1, durationMs: 0 }
// alors que la matrice avait rendu applicable: none. Le champ attempts
// est le discriminant : recordSkippedByMatrix ecrit 0, seule la voie
// de succes du wrapper introduit 1.
// ============================================================

// Sequence exacte du pipeline sur un dossier non industriel.
{
  const r = new EngineStatusRecorder();
  r.recordSkippedByMatrix('industrialMetrics', 'Modele non industriel.');
  r.markStart('industrialMetrics');
  // withEngineDeadline, voie de succes sur Promise.resolve(null).
  r.record({ engine: 'industrialMetrics', status: 'ok', attempts: 1 });
  r.finalizeFromResult(
    { industrialMetrics: null },
    { industrialMetrics: 'industrialMetrics' },
  );
  const s = r.snapshot();
  check(s.industrialMetrics?.status === 'skipped_not_applicable',
    'garde record : le ok du wrapper ne recouvre pas le skip declare');
  check(s.industrialMetrics?.attempts === 0,
    'garde record : attempts reste a 0, aucun appel n a eu lieu');
  check(s.industrialMetrics?.skipReason === 'Modele non industriel.',
    'garde record : le motif de la matrice survit au point de jonction');
  check(r.gaps().length === 0, 'garde record : aucune lacune ouverte');
  check(r.computeRunStatus() === 'completed',
    'garde record : un dossier non industriel rend completed sans lacune');
}

// Les deux autres branches ecartees du pipeline traversent le meme
// wrapper (route.ts:1350 et 1351) et sont couvertes par la meme ligne.
for (const moteur of ['narrativeDrift', 'fragiliteStructurelle']) {
  const r = new EngineStatusRecorder();
  r.recordSkippedByMatrix(moteur, 'motif matrice');
  r.markStart(moteur);
  r.record({ engine: moteur, status: 'ok', attempts: 1 });
  const s = r.snapshot();
  check(s[moteur]?.status === 'skipped_not_applicable',
    `garde record : ${moteur} ecarte survit au ok du wrapper`);
  check(s[moteur]?.attempts === 0, `garde record : ${moteur} garde attempts a 0`);
}

// Aucun statut posterieur n a autorite sur la decision doctrinale. Un
// moteur jamais appele ne peut ni echouer ni depasser sa fenetre.
{
  for (const statut of ['failed', 'timeout', 'empty_output'] as const) {
    const r = new EngineStatusRecorder();
    r.recordSkippedByMatrix('industrialMetrics', 'motif matrice');
    r.record({ engine: 'industrialMetrics', status: statut, attempts: 1, errorMessage: 'boom' });
    check(r.snapshot().industrialMetrics?.status === 'skipped_not_applicable',
      `garde record : un ${statut} posterieur ne recouvre pas le skip`);
  }
}

// Non-regression : la garde ne vise que le skip matrice. Toute autre
// entree reste ecrasable, c est le contrat historique de record().
{
  const r = new EngineStatusRecorder();
  r.record({ engine: 'market', status: 'ok', attempts: 1 });
  r.record({ engine: 'market', status: 'failed', attempts: 2, errorMessage: 'boom' });
  check(r.snapshot().market?.status === 'failed',
    'garde record : une entree non ecartee reste ecrasable');
  check(r.snapshot().market?.attempts === 2,
    'garde record : le dernier ecrivain garde ses tentatives');
}

// Durees mesurees : test asynchrone en fin de fichier avec setTimeout pour
// simuler wait sur deps puis execution reelle.
(async () => {
  const r = new EngineStatusRecorder();
  r.markStart('patternMatching', ['team']);
  await new Promise((resolve) => setTimeout(resolve, 30));
  r.markLLMStart('patternMatching');
  await new Promise((resolve) => setTimeout(resolve, 20));
  r.record({ engine: 'patternMatching', status: 'ok', attempts: 1 });
  const s = r.snapshot();
  const w = s.patternMatching?.waitDurationMs ?? -1;
  const e = s.patternMatching?.executionDurationMs ?? -1;
  const total = s.patternMatching?.durationMs ?? -1;
  check(w >= 25 && w <= 80, 'wait ~30ms mesure (obtenu ' + w + ')');
  check(e >= 15 && e <= 80, 'execution ~20ms mesure (obtenu ' + e + ')');
  check(total >= 45, 'duration totale >= somme (obtenu ' + total + ')');

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})();
