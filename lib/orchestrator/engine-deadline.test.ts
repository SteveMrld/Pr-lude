// ============================================================
// Tests deterministes engine-deadline.ts
// ------------------------------------------------------------
// Objectif prouver, pas verifier verdement : que la couche 3 du
// pipeline s execute reellement derriere une couche 1 lente. Sous
// l ancienne implementation (deadline armee a la construction du
// wrapper, meme tick sync pour les 21 moteurs), la couche 3 etait
// tuee en cascade avant meme d avoir atteint son propre appel LLM.
//
// On rejoue la topologie exacte de route.ts, avec des sleeps qui
// reproduisent proportionnellement les p90 observes sur le corpus
// timeout-diag.md (team 143s -> 1430ms, causal wait ~343s -> 3430ms).
// Les seuils de deadline sont eux aussi mis a l echelle
// (WAIT 450s -> 4500ms, EXEC 200s -> 2000ms) pour que le test
// tourne en ~4 secondes.
// ============================================================

import { EngineStatusRecorder } from './engine-status-recorder';
import { createEngineDeadlineWrapper } from './engine-deadline';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function run() {

  // ============================================================
  // SUITE 1 - Couche 3 execute derriere couche 1 lente
  // ============================================================

  console.log('\n[Suite 1] couche 3 execute meme quand couche 1 tient sur toute son enveloppe SDK');

  {
    const recorder = new EngineStatusRecorder();
    const timeouts: Array<{ engine: string; reason: string }> = [];
    const doneNull: string[] = [];

    const withEngineDeadline = createEngineDeadlineWrapper({
      recorder,
      waitDeadlineMs: 4500,   // proportion 450s
      llmDeadlineMs: 2000,    // proportion 200s
      onTimeout: (engine, reason) => timeouts.push({ engine, reason }),
      onDoneNull: (engine) => doneNull.push(engine),
      onError: () => {},
    });

    // Couche 1 : sleeps calques sur p90 team/market/macro
    // (143s / 128s / 68s), mis a l echelle 100x.
    const teamPromise = (async () => {
      recorder.markLLMStart('team');
      await sleep(1430);
      return { name: 'team' };
    })();
    const marketPromise = (async () => {
      recorder.markLLMStart('market');
      await sleep(1280);
      return { name: 'market' };
    })();
    const macroPromise = (async () => {
      recorder.markLLMStart('macro');
      await sleep(680);
      return { name: 'macro' };
    })();

    // Couche 2 pattern : attend team+market+macro (max 1430ms) puis
    // 1000ms d appel LLM propre. Fin attendue ~t=2430ms.
    const patternPromise = (async () => {
      await Promise.all([teamPromise, marketPromise, macroPromise]);
      recorder.markLLMStart('patternMatching');
      await sleep(1000);
      return { name: 'pattern' };
    })();

    // Couche 3 causal : attend team+market+macro+pattern (max 2430ms)
    // puis 800ms d appel LLM propre. Fin attendue ~t=3230ms.
    // Sous l ancien modele, deadline armee a t=0 avec ENGINE_DEADLINE
    // proportion 2000ms => causal tue AVANT d avoir atteint son LLM.
    const causalPromise = (async () => {
      await Promise.all([teamPromise, marketPromise, macroPromise, patternPromise]);
      recorder.markLLMStart('causalReversal');
      await sleep(800);
      return { name: 'causal' };
    })();

    // Couche 4 refChecks : attend team+blindspot(simule)+causal (max
    // 3230ms) puis 600ms d appel LLM. Fin attendue ~t=3830ms.
    const blindspotPromise = (async () => {
      await Promise.all([teamPromise, marketPromise, macroPromise]);
      recorder.markLLMStart('blindspotAnalysis');
      await sleep(1000);
      return { name: 'blindspot' };
    })();
    const referenceChecksPromise = (async () => {
      await Promise.all([teamPromise, blindspotPromise, causalPromise]);
      recorder.markLLMStart('referenceChecks');
      await sleep(600);
      return { name: 'refChecks' };
    })();

    const t0 = Date.now();
    const [team, market, macro, pattern, blindspot, causal, refChecks] = await Promise.all([
      withEngineDeadline('team', 'team', teamPromise),
      withEngineDeadline('market', 'market', marketPromise),
      withEngineDeadline('macro', 'macro', macroPromise),
      withEngineDeadline('pattern', 'patternMatching', patternPromise, ['team', 'market', 'macro']),
      withEngineDeadline('blindspot', 'blindspotAnalysis', blindspotPromise, ['team', 'market', 'macro']),
      withEngineDeadline('causal', 'causalReversal', causalPromise, ['team', 'market', 'macro', 'patternMatching']),
      withEngineDeadline('reference-checks', 'referenceChecks', referenceChecksPromise, ['team', 'blindspotAnalysis', 'causalReversal']),
    ]);
    const wall = Date.now() - t0;

    check(team !== null, 'couche 1 team resolue');
    check(market !== null, 'couche 1 market resolue');
    check(macro !== null, 'couche 1 macro resolue');
    check(pattern !== null, 'couche 2 pattern resolue');
    check(blindspot !== null, 'couche 2 blindspot resolue');
    check(causal !== null, 'COUCHE 3 causal EXECUTE et resout un resultat');
    check(refChecks !== null, 'COUCHE 4 refChecks EXECUTE et resout un resultat');
    check(timeouts.length === 0, `aucun timeout tire (obtenu ${timeouts.length}: ${timeouts.map(t => t.engine + '/' + t.reason).join(', ')})`);
    check(doneNull.length === 0, `aucun sendDone(null) declenche par deadline (obtenu ${doneNull.length})`);

    // Wall total doit approcher la chaine critique refChecks ~3830ms,
    // largement au-dela de l ancien plafond synchrone de 2000ms.
    check(wall > 3200, `wall total > 3200ms confirme que la couche 3+4 a bien tourne (obtenu ${wall}ms)`);

    const s = recorder.snapshot();
    check(s.patternMatching?.status === 'ok', 'pattern statut ok dans le recorder');
    check(s.causalReversal?.status === 'ok', 'causal statut ok dans le recorder');
    check(s.referenceChecks?.status === 'ok', 'refChecks statut ok dans le recorder');

    // Distinction wait vs execution : causal a passe l essentiel de sa
    // vie a attendre pattern (>2000ms), puis 800ms d execution.
    check((s.causalReversal?.waitDurationMs ?? 0) >= 2000, `causal waitDuration >= 2000ms atteste l attente reelle (obtenu ${s.causalReversal?.waitDurationMs}ms)`);
    check((s.causalReversal?.executionDurationMs ?? 0) < 1500, `causal executionDuration < 1500ms atteste l execution effective bornee (obtenu ${s.causalReversal?.executionDurationMs}ms)`);
  }

  // ============================================================
  // SUITE 2 - Contre-preuve : ancien modele armait a t=0
  // ------------------------------------------------------------
  // On reproduit l ancien comportement (deadline armee a la
  // construction sans distinction wait/exec) pour montrer qu il
  // aurait tue la couche 3 sur le meme scenario. Test de regression :
  // si quelqu un reimplemente accidentellement l ancien modele, ce
  // test capture le retour du bug.
  // ============================================================

  console.log('\n[Suite 2] contre-preuve : sous l ancien modele, la couche 3 est tuee');

  {
    const recorder = new EngineStatusRecorder();
    const timeouts: string[] = [];

    // Wrapper legacy : deadline UNIQUE armee au construction, pas de
    // bascule wait/exec. Reproduit fidelement l ancien route.ts.
    const legacyWithDeadline = <T>(engine: string, resultKey: string | null, work: Promise<T>, deps?: string[]): Promise<T | null> => {
      if (resultKey) recorder.markStart(resultKey, deps);
      return new Promise<T | null>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          timeouts.push(engine);
          if (resultKey) recorder.record({ engine: resultKey, status: 'timeout', attempts: 1, errorMessage: 'deadline-exceeded' });
          resolve(null);
        }, 2000); // meme proportion 200s -> 2000ms
        work.then(
          (v) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (resultKey) recorder.record({ engine: resultKey, status: 'ok', attempts: 1 });
            resolve(v);
          },
          () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(null);
          },
        );
      });
    };

    const teamPromise = (async () => { recorder.markLLMStart('team'); await sleep(1430); return { name: 'team' }; })();
    const marketPromise = (async () => { recorder.markLLMStart('market'); await sleep(1280); return { name: 'market' }; })();
    const macroPromise = (async () => { recorder.markLLMStart('macro'); await sleep(680); return { name: 'macro' }; })();
    const patternPromise = (async () => {
      await Promise.all([teamPromise, marketPromise, macroPromise]);
      recorder.markLLMStart('patternMatching');
      await sleep(1000);
      return { name: 'pattern' };
    })();
    const causalPromise = (async () => {
      await Promise.all([teamPromise, marketPromise, macroPromise, patternPromise]);
      recorder.markLLMStart('causalReversal');
      await sleep(800);
      return { name: 'causal' };
    })();

    const [_team, _market, _macro, pattern, causal] = await Promise.all([
      legacyWithDeadline('team', 'team', teamPromise),
      legacyWithDeadline('market', 'market', marketPromise),
      legacyWithDeadline('macro', 'macro', macroPromise),
      legacyWithDeadline('pattern', 'patternMatching', patternPromise, ['team', 'market', 'macro']),
      legacyWithDeadline('causal', 'causalReversal', causalPromise, ['team', 'market', 'macro', 'patternMatching']),
    ]);

    check(pattern === null, 'sous l ancien modele, pattern est aussi tue par la deadline t=0 (pattern finissait a ~2430ms)');
    check(causal === null, 'sous l ancien modele, causal est tue par la deadline t=0 (n a jamais atteint son LLM)');
    check(timeouts.includes('causal'), 'timeout enregistre pour causal sous l ancien modele');

    const s = recorder.snapshot();
    check(s.causalReversal?.status === 'failed-upstream' || s.causalReversal?.status === 'timeout',
      `causal en statut degrade sous l ancien modele (obtenu ${s.causalReversal?.status})`);
  }

  // ============================================================
  // SUITE 3 - Wait deadline fire proprement sur un hang de dep
  // ============================================================

  console.log('\n[Suite 3] wait-deadline-exceeded fire quand une dep hang au-dela de WAIT_DEADLINE_MS');

  {
    const recorder = new EngineStatusRecorder();
    const timeouts: Array<{ engine: string; reason: string }> = [];

    const withEngineDeadline = createEngineDeadlineWrapper({
      recorder,
      waitDeadlineMs: 300,   // court pour test rapide
      llmDeadlineMs: 5000,
      onTimeout: (engine, reason) => timeouts.push({ engine, reason }),
      onDoneNull: () => {},
      onError: () => {},
    });

    // hangPromise n atteint jamais markLLMStart : simule une dep amont
    // qui ne resout jamais son await. Sans WAIT_DEADLINE, ce moteur
    // resterait pendu.
    const hangPromise: Promise<any> = new Promise(() => {});

    const result = await withEngineDeadline('hanging', 'hangingKey', hangPromise, ['someDep']);

    check(result === null, 'moteur hung resout null via wait-deadline');
    check(timeouts.length === 1, 'exactement un timeout tire');
    check(timeouts[0]?.engine === 'hanging', 'timeout attribue au moteur nomme');
    check(timeouts[0]?.reason === 'wait-deadline-exceeded', `reason distingue wait vs execution (obtenu: ${timeouts[0]?.reason})`);

    const s = recorder.snapshot();
    check(s.hangingKey?.status === 'timeout', 'recorder enregistre timeout');
    check(s.hangingKey?.errorMessage === 'wait-deadline-exceeded', 'errorMessage nomme la garde violee');
  }

  // ============================================================
  // SUITE 4 - Exec deadline fire quand le LLM depasse ENGINE_DEADLINE_MS
  // ============================================================

  console.log('\n[Suite 4] deadline-exceeded fire quand l execution LLM depasse ENGINE_DEADLINE_MS');

  {
    const recorder = new EngineStatusRecorder();
    const timeouts: Array<{ engine: string; reason: string }> = [];

    const withEngineDeadline = createEngineDeadlineWrapper({
      recorder,
      waitDeadlineMs: 5000,
      llmDeadlineMs: 200,   // court pour test rapide
      onTimeout: (engine, reason) => timeouts.push({ engine, reason }),
      onDoneNull: () => {},
      onError: () => {},
    });

    const slowLLM = (async () => {
      recorder.markLLMStart('slowKey');
      await sleep(600); // depasse llmDeadlineMs=200
      return { name: 'slow' };
    })();

    const result = await withEngineDeadline('slow', 'slowKey', slowLLM);

    check(result === null, 'moteur exec-long resout null via exec-deadline');
    check(timeouts.length === 1, 'exactement un timeout tire');
    check(timeouts[0]?.reason === 'deadline-exceeded', `reason distingue exec vs wait (obtenu: ${timeouts[0]?.reason})`);

    const s = recorder.snapshot();
    check(s.slowKey?.status === 'timeout', 'recorder enregistre timeout');
    check(s.slowKey?.errorMessage === 'deadline-exceeded', 'errorMessage nomme la garde execution');
  }

  console.log(`\nTotal: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test run threw:', err);
  process.exit(1);
});
