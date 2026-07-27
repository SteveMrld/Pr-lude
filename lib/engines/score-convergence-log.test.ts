// ============================================================
// Tests deterministes du site de log de l audit anti-convergence
// ------------------------------------------------------------
// Ce site appelait logError avec trois arguments positionnels contre
// une signature a objet unique. Consequence : entry.message sortait
// undefined, l insert levait sur .slice a l interieur du try de
// logError, et l exception etait avalee par le catch silencieux.
// Le site paraissait actif depuis sa creation et n a jamais ecrit une
// seule ligne en base. Un audit qui ne s ecrit pas est pire qu un
// audit absent : il donne l illusion d une surveillance.
//
// Les assertions portent sur la ligne exacte remise a .insert(),
// construite par buildErrorLogRow.
// ============================================================

import { buildScoreConvergenceLogEntry } from './orchestrator';
import { buildErrorLogRow } from '../error-logger';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const RUN_ID = 'c487a8b2-74bf-49bd-a3a3-1ba929314e99';

const DIMS = [
  { dimensionName: 'equipe', successProbability: 52, weight: 0.3 },
  { dimensionName: 'marche', successProbability: 54, weight: 0.3 },
  { dimensionName: 'produit', successProbability: 55, weight: 0.2 },
  { dimensionName: 'financier', successProbability: 53, weight: 0.2 },
];

console.log('\n[Suite 1] la ligne est complete et rattachee');

{
  const entry = buildScoreConvergenceLogEntry({
    amplitude: 3,
    dimList: DIMS.map(d => `${d.dimensionName}=${d.successProbability}`).join(', '),
    dims: DIMS,
    llmScore: 53,
    finalComputedScore: 53,
    verdict: 'approfondir',
    analysisId: RUN_ID,
  });
  const row = buildErrorLogRow(entry);

  check(typeof row.message === 'string' && row.message.length > 0, 'message renseigne');
  check(row.message.includes('amplitude 3 points'), 'message porte l amplitude mesuree');
  check(row.message.includes('equipe=52'), 'message porte le detail des dimensions');
  check(row.analysis_id === RUN_ID, 'analysis_id renseigne, ligne joignable au run');
  check(row.source === 'pipeline.orchestrator.score-convergence', 'source conforme');
  check(row.severity === 'warning', 'severite warning');
  check(row.context?.amplitude === 3, 'context porte l amplitude');
  check(Array.isArray(row.context?.dimensions) && row.context.dimensions.length === 4, 'context porte les quatre dimensions');
  check(row.context?.verdict === 'approfondir', 'context porte le verdict');
}

console.log('\n[Suite 2] persistence-off : ligne ecrite, colonne nulle assumee');

{
  const entry = buildScoreConvergenceLogEntry({
    amplitude: 8,
    dimList: 'equipe=50, marche=58',
    dims: DIMS.slice(0, 2),
    llmScore: 54,
    finalComputedScore: 54,
    verdict: null,
    analysisId: null,
  });
  const row = buildErrorLogRow(entry);

  check(row.analysis_id === null, 'analysis_id null quand il n y a pas de ligne analyses');
  check(row.message.length > 0, 'message renseigne quand meme');
}

console.log('\n[Suite 3] non-regression de la panne muette du logger');

{
  // Reproduit ce que produisait l ancien appel positionnel : un entry
  // dont message est undefined. buildErrorLogRow doit coercer au lieu
  // de lever, sinon la ligne disparait sans trace.
  let threw = false;
  let row: any = null;
  try {
    row = buildErrorLogRow({ severity: 'warning', source: 'x' } as any);
  } catch {
    threw = true;
  }
  check(!threw, 'un message absent ne leve plus');
  check(row?.message === 'unknown error', 'message absent coerce en unknown error');
  check(row?.analysis_id === null, 'analysis_id absent tombe a null');

  let threw2 = false;
  try {
    // L appel positionnel historique : la source arrivait en entry.
    buildErrorLogRow('pipeline.orchestrator.score-convergence' as any);
  } catch {
    threw2 = true;
  }
  check(!threw2, 'un entry non-objet ne leve plus');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
