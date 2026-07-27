// ============================================================
// Tests deterministes engine-log-callbacks.ts
// ------------------------------------------------------------
// Ce que ces tests prouvent : une exception moteur, ou un
// depassement de deadline, passe par le wrapper deadline et produit
// une ligne error_logs dont la colonne analysis_id est renseignee.
//
// Pourquoi ils existent : sur le run c487a8b2 du 27 juillet, les six
// lignes de timeout persistees portaient analysis_id null. Cinq
// venaient du callback onError du wrapper, une du catch inline de
// narrative-drift. Aucune n etait joignable au run en SQL, la seule
// correlation possible etait la fenetre temporelle a la main, ce qui
// a coute trois rounds de diagnostic. Le defaut n avait aucun test
// qui l aurait attrape parce que les callbacks vivaient en litteral
// dans route.ts, hors de portee de la suite deterministe.
//
// L assertion porte sur la ligne construite par buildErrorLogRow,
// c est a dire l objet exact remis a .insert(). Pas d appel reseau :
// on verifie le contrat de la ligne, pas la disponibilite Supabase.
// ============================================================

import { EngineStatusRecorder } from './engine-status-recorder';
import { createEngineDeadlineWrapper } from './engine-deadline';
import { createEngineLogCallbacks, type EngineLogSink } from './engine-log-callbacks';
import { buildErrorLogRow, type ErrorLogEntry } from '../error-logger';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const RUN_ID = 'c487a8b2-74bf-49bd-a3a3-1ba929314e99';

/**
 * Puits de log espion. Reconstitue l entree ErrorLogEntry telle que
 * logException la remettrait a logError, puis la ligne telle que
 * logError la remettrait a l insert.
 */
function makeSpy() {
  const rows: Record<string, any>[] = [];
  const sink: EngineLogSink = (source, err, options) => {
    const entry: ErrorLogEntry = {
      severity: options.severity || 'error',
      source,
      message: err?.message || String(err),
      stack: err?.stack,
      context: options.context,
      analysisId: options.analysisId,
    };
    rows.push(buildErrorLogRow(entry));
  };
  return { rows, sink };
}

async function run() {

  // ============================================================
  // SUITE 1 - Exception moteur : la ligne porte analysis_id
  // ============================================================

  console.log('\n[Suite 1] exception moteur passee par withEngineDeadline');

  {
    const { rows, sink } = makeSpy();
    const recorder = new EngineStatusRecorder();
    const callbacks = createEngineLogCallbacks({
      getAnalysisId: () => RUN_ID,
      log: sink,
    });
    const withEngineDeadline = createEngineDeadlineWrapper({
      recorder,
      waitDeadlineMs: 4000,
      llmDeadlineMs: 2000,
      onTimeout: callbacks.onTimeout,
      onDoneNull: () => {},
      onError: callbacks.onError,
    });

    // Rejoue exactement le profil observe sur c487a8b2 : le SDK
    // Anthropic rejette avec 'Request timed out.' apres que le moteur
    // a declare son appel LLM.
    const work = (async () => {
      recorder.markLLMStart('contrarianAnalysis');
      await sleep(20);
      throw new Error('Request timed out.');
    })();

    const out = await withEngineDeadline('contrarian', 'contrarianAnalysis', work);

    check(out === null, 'le moteur en echec resout null, le pipeline continue');
    check(rows.length === 1, 'une ligne error_logs emise');
    check(rows[0]?.analysis_id === RUN_ID, 'analysis_id renseigne sur la ligne');
    check(rows[0]?.analysis_id !== null, 'analysis_id non null, ligne joignable au run');
    check(rows[0]?.source === 'pipeline.contrarian', 'source conforme a la convention pipeline.<engine>');
    check(rows[0]?.message === 'Request timed out.', 'message preserve');
    check(rows[0]?.severity === 'warning', 'severite warning, moteur non bloquant');
    check(rows[0]?.context?.phase === 'engine-error', 'context discrimine le site d appel');
    check(recorder.snapshot()?.contrarianAnalysis?.status === 'failed', 'recorder marque failed');
  }

  // ============================================================
  // SUITE 2 - Depassement de deadline : meme rattachement
  // ============================================================

  console.log('\n[Suite 2] depassement de deadline execution');

  {
    const { rows, sink } = makeSpy();
    const recorder = new EngineStatusRecorder();
    const callbacks = createEngineLogCallbacks({
      getAnalysisId: () => RUN_ID,
      log: sink,
    });
    const withEngineDeadline = createEngineDeadlineWrapper({
      recorder,
      waitDeadlineMs: 4000,
      llmDeadlineMs: 200,
      onTimeout: callbacks.onTimeout,
      onDoneNull: () => {},
      onError: callbacks.onError,
    });

    const work = (async () => {
      recorder.markLLMStart('patternMatching');
      await sleep(2000);
      return { done: true };
    })();

    const out = await withEngineDeadline('pattern', 'patternMatching', work);

    check(out === null, 'le moteur en deadline resout null');
    check(rows.length === 1, 'une ligne error_logs emise sur timeout');
    check(rows[0]?.analysis_id === RUN_ID, 'analysis_id renseigne sur la ligne de timeout');
    check(rows[0]?.message === 'deadline-exceeded', 'la raison de deadline devient le message');
    check(rows[0]?.context?.deadlineMs === 200, 'context porte la fenetre depassee');
  }

  // ============================================================
  // SUITE 3 - Lecture a l appel, pas a la construction
  // ============================================================

  console.log('\n[Suite 3] le thunk lit l identifiant a l emission');

  {
    const { rows, sink } = makeSpy();
    let currentId: string | null = null;
    const callbacks = createEngineLogCallbacks({
      getAnalysisId: () => currentId,
      log: sink,
    });

    // Callbacks construits alors que l id n est pas encore affecte,
    // topologie de route.ts ou analysisId est un let renseigne par
    // createPendingAnalysis.
    currentId = RUN_ID;
    callbacks.onError('macro', new Error('boom'));

    check(rows[0]?.analysis_id === RUN_ID, 'id affecte apres construction, lu quand meme');
  }

  {
    const { rows, sink } = makeSpy();
    const callbacks = createEngineLogCallbacks({
      getAnalysisId: () => null,
      log: sink,
    });
    callbacks.onError('macro', new Error('boom'));

    // Mode persistence-off : pas de ligne analyses, donc pas de
    // rattachement possible. La ligne doit rester ecrite, la colonne
    // a null, sans lever. La FK analysis_id accepte null.
    check(rows.length === 1, 'persistence-off : la ligne est quand meme emise');
    check(rows[0]?.analysis_id === null, 'persistence-off : analysis_id null assume');
  }

  console.log(`\n${pass} passes, ${fail} echecs`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => { console.error(err); process.exit(1); });
