// ============================================================
// Tests deterministes engine-status-recorder.ts
// ------------------------------------------------------------
// Suite 1 : les cinq statuts (ok, failed, timeout,
//           skipped_not_applicable, empty_output).
// Suite 2 : contrats minimaux par moteur, cas TOLSON.
// Suite 3 : calcul du statut de run et du message d erreur.
// Suite 4 : preservation d un statut failed / timeout deja
//           enregistre lors du finalize.
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
  check(passesMinimalContract('fragiliteStructurelle', { patterns: [{ patternId: 'p1' }] }) === true, 'contrat fragiliteStructurelle : patterns array');
  check(passesMinimalContract('fragiliteStructurelle', { patterns: [] }) === false, 'contrat fragiliteStructurelle : patterns vide echoue');
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
  check(GAP_STATUSES.length === 3, '3 statuts de lacune');
  check((GAP_STATUSES as readonly string[]).includes('failed'), 'GAP inclut failed');
  check((GAP_STATUSES as readonly string[]).includes('timeout'), 'GAP inclut timeout');
  check((GAP_STATUSES as readonly string[]).includes('empty_output'), 'GAP inclut empty_output');
  check(!(GAP_STATUSES as readonly string[]).includes('skipped_not_applicable'), 'GAP n inclut pas skipped');
  check(!(GAP_STATUSES as readonly string[]).includes('ok'), 'GAP n inclut pas ok');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
