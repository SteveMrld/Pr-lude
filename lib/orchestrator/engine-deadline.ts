// ============================================================
// ENGINE DEADLINE WRAPPER
// ------------------------------------------------------------
// Deux gardes de temps distinctes pour chaque moteur du pipeline,
// alignees sur la structure reelle du travail :
//
//   WAIT_DEADLINE   temps maximum d attente sur les dependances
//                   amont, avant que le moteur n atteigne son
//                   propre appel LLM (markLLMStart). Fire si le
//                   moteur est bloque en cascade.
//
//   ENGINE_DEADLINE temps maximum d execution du moteur une fois
//                   qu il a effectivement demarre son appel LLM.
//                   Couvre le worst-case SDK par tentative-chain,
//                   independant du temps deja consomme en amont.
//
// Bug historique : l ancienne version armait ENGINE_DEADLINE des
// la construction du wrapper. Comme les 21 wrappers sont construits
// dans le meme tick synchrone (Promise.all central de route.ts),
// les 21 horloges demarraient a t=0 et bornaient le run entier a
// ENGINE_DEADLINE, meme pour les moteurs de couche 3-4 qui devaient
// legitimement attendre les couches amont avant de tirer leur propre
// LLM. Resultat sur 9201a046 : couche 3 avait ~0s pour s executer
// et 11 moteurs sont sortis en timeout pur cascade.
//
// Sous ce modele, chaque moteur reste borne :
//   - Un moteur qui n atteint jamais son LLM : fire wait au bout
//     de WAIT_DEADLINE, statut 'timeout', errorMessage
//     'wait-deadline-exceeded'. Downstream reste vivant avec null.
//   - Un moteur qui atteint son LLM : fire deadline au bout de
//     ENGINE_DEADLINE, statut 'timeout', errorMessage
//     'deadline-exceeded'. Meme comportement downstream.
//   - Le run global reste borne par RUN_BUDGET_MS (600s) qui race
//     le Promise.all central et l orchestrateur.
// ============================================================

import type { EngineStatusRecorder } from './engine-status-recorder';

export interface EngineDeadlineOptions {
  recorder: EngineStatusRecorder;
  /** Temps maximum d attente avant markLLMStart. */
  waitDeadlineMs: number;
  /** Temps maximum d execution apres markLLMStart. */
  llmDeadlineMs: number;
  /** Notifie l ouverture d un deadline (log + telemetrie). */
  onTimeout: (engine: string, reason: string, deadlineMs: number) => void;
  /** Notifie les consommateurs stream qu un moteur a resolu null
   *  (via timeout ou erreur). Idempotent cote appelant. */
  onDoneNull: (engine: string) => void;
  /** Notifie une erreur remontee par la promesse sous-jacente,
   *  distincte d un timeout. */
  onError: (engine: string, err: unknown) => void;
  /**
   * Source de temps des deux gardes. Par defaut les minuteurs du
   * runtime, comportement inchange en production.
   *
   * L injection existe pour les tests. Un test de deadline qui dort
   * reellement mesure la charge de la machine autant que la logique
   * qu il verifie : la suite engine-deadline echouait par intermittence
   * sous charge de suite complete, et elargir ses marges n aurait fait
   * que reculer le seuil auquel elle redevient trompeuse. Avec une
   * horloge injectee, le test avance le temps lui-meme et ne depend
   * plus de l ordonnanceur.
   */
  scheduler?: Scheduler;
}

/** Minuteurs utilises par les gardes. Signature volontairement reduite
 *  a ce que le wrapper emploie. */
export interface Scheduler {
  setTimeout: (fn: () => void, ms: number) => any;
  clearTimeout: (id: any) => void;
}

const SCHEDULER_RUNTIME: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

/** Type public du wrapper produit. Les quatre premiers parametres sont
 *  ceux de l ancienne fonction inline de route.ts, aucun des 21 sites
 *  d appel n a eu a changer.
 *
 *  Le cinquieme, llmDeadlineMs, aligne la garde d execution sur la
 *  fenetre reelle du moteur. Une valeur unique pour les 21 moteurs
 *  obligeait a la caler sur le plus lent, ce qui laissait les rapides
 *  courir bien au-dela de leur fenetre utile avant d etre coupes, et
 *  aurait coupe blindspot (fenetre 240s) avant que son SDK ne rende la
 *  main. Omis, le defaut du wrapper s applique, comportement
 *  historique inchange. */
export type EngineDeadlineWrapper = <T>(
  engine: string,
  resultKey: string | null,
  work: Promise<T>,
  deps?: string[],
  llmDeadlineMs?: number,
) => Promise<T | null>;

export function createEngineDeadlineWrapper(opts: EngineDeadlineOptions): EngineDeadlineWrapper {
  const { recorder, waitDeadlineMs, llmDeadlineMs: defaultLlmDeadlineMs, onTimeout, onDoneNull, onError } = opts;
  const horloge = opts.scheduler ?? SCHEDULER_RUNTIME;

  return function withEngineDeadline<T>(
    engine: string,
    resultKey: string | null,
    work: Promise<T>,
    deps?: string[],
    llmDeadlineOverrideMs?: number,
  ): Promise<T | null> {
    const llmDeadlineMs = llmDeadlineOverrideMs ?? defaultLlmDeadlineMs;
    if (resultKey) recorder.markStart(resultKey, deps);

    return new Promise<T | null>((resolve) => {
      let settled = false;
      let timer: any;

      const fire = (reason: string, deadlineMs: number) => {
        if (settled) return;
        settled = true;
        horloge.clearTimeout(timer);
        onTimeout(engine, reason, deadlineMs);
        try { onDoneNull(engine); } catch { /* controller closed */ }
        if (resultKey) {
          recorder.record({
            engine: resultKey,
            status: 'timeout',
            attempts: 1,
            errorMessage: reason,
          });
        }
        resolve(null);
      };

      // Garde attente : armee inconditionnellement des la construction.
      // Si le moteur atteint markLLMStart avant la fin de cette fenetre,
      // on la remplace par la garde execution.
      timer = horloge.setTimeout(() => fire('wait-deadline-exceeded', waitDeadlineMs), waitDeadlineMs);

      // Bascule wait -> execution au moment ou le moteur declare son
      // appel LLM. Si markLLMStart a deja ete emis, l abonnement fire
      // immediatement (couche 1, les moteurs sans dep).
      if (resultKey) {
        recorder.onLLMStart(resultKey, () => {
          if (settled) return;
          horloge.clearTimeout(timer);
          timer = horloge.setTimeout(() => fire('deadline-exceeded', llmDeadlineMs), llmDeadlineMs);
        });
      }

      work.then(
        (v) => {
          if (settled) return;
          settled = true;
          horloge.clearTimeout(timer);
          if (resultKey) recorder.record({ engine: resultKey, status: 'ok', attempts: 1 });
          resolve(v);
        },
        (err) => {
          if (settled) return;
          settled = true;
          horloge.clearTimeout(timer);
          onError(engine, err);
          try { onDoneNull(engine); } catch { /* controller closed */ }
          if (resultKey) {
            // Les extremites du texte fautif remontent avec l erreur.
            // Portees par EngineContractError et par elle seule : une
            // erreur reseau n a pas de texte a montrer, et lui en
            // inventer un serait pire que de n en avoir aucun.
            const e = err as any;
            const fautif = typeof e?.rawLength === 'number'
              ? { longueur: e.rawLength, debut: String(e.rawDebut ?? ''), fin: String(e.rawFin ?? '') }
              : undefined;
            recorder.record({
              engine: resultKey,
              status: 'failed',
              attempts: 1,
              errorMessage: String(e?.message || err),
              ...(fautif ? { parseFautif: fautif } : {}),
            });
          }
          resolve(null);
        },
      );
    });
  };
}
