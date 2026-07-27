// ============================================================
// CALLBACKS DE LOG DU WRAPPER DEADLINE
// ------------------------------------------------------------
// Les deux callbacks onTimeout et onError de
// createEngineDeadlineWrapper etaient ecrits en litteral dans
// app/api/analyze/route.ts. Consequence pratique : ils etaient le
// seul chemin par lequel passent les incidents de la quasi-totalite
// des moteurs du pipeline, et ils n etaient testables par aucun
// test deterministe puisque route.ts n est pas importable hors
// contexte de requete Next.
//
// C est ce qui a laisse passer le defaut de rattachement : sur le
// run c487a8b2, cinq des six lignes error_logs de timeout portaient
// un analysis_id null, donc n etaient corrélables au run que par
// fenetre temporelle a la main. Sortir les callbacks ici leur donne
// une surface de test et un point unique ou poser l identifiant du
// run, sans introduire de contexte ambiant.
//
// Le passage de l analysisId reste explicite, par thunk. Pas
// d AsyncLocalStorage : la conservation du contexte ALS a travers
// les callbacks du ReadableStream de la route Next 14 n est pas
// etablie, et une propagation implicite qui se perd en silence
// reproduirait exactement la panne qu on corrige.
// ============================================================

import { logException } from '../error-logger';

/**
 * Signature du puits de log. Correspond a logException, garde une
 * forme injectable pour que les tests observent l entree emise sans
 * toucher Supabase.
 */
export type EngineLogSink = (
  source: string,
  err: any,
  options: {
    severity?: 'error' | 'warning' | 'info';
    context?: Record<string, any>;
    analysisId?: string | null;
  },
) => void | Promise<void>;

export interface EngineLogCallbacks {
  onTimeout: (engine: string, reason: string, deadlineMs: number) => void;
  onError: (engine: string, err: unknown) => void;
}

/**
 * Fabrique les deux callbacks de log passes a
 * createEngineDeadlineWrapper. getAnalysisId est un thunk et non une
 * valeur : dans route.ts, le wrapper est construit dans la meme
 * portee que la variable analysisId, laquelle est affectee plus haut
 * mais reste un let. Lire a l appel plutot qu a la construction evite
 * de figer un null si l ordre d initialisation change.
 */
export function createEngineLogCallbacks(opts: {
  getAnalysisId: () => string | null;
  log?: EngineLogSink;
}): EngineLogCallbacks {
  const log: EngineLogSink = opts.log ?? logException;

  return {
    onTimeout: (engine, reason, deadlineMs) => {
      log(`pipeline.${engine}`, new Error(reason), {
        severity: 'warning',
        analysisId: opts.getAnalysisId(),
        context: { engine, deadlineMs, reason },
      });
    },
    onError: (engine, err) => {
      log(`pipeline.${engine}`, err as Error, {
        severity: 'warning',
        analysisId: opts.getAnalysisId(),
        context: { engine, phase: 'engine-error' },
      });
    },
  };
}
