// ============================================================
// PIPELINE TOILE - ADAPTATEUR D ETATS LIVE
// ------------------------------------------------------------
// Transforme la structure d etats moteur deja maintenue par
// HomeClient (Record<engineId, EngineState>) en la prop states
// attendue par PipelineToile (Record<topologyId, ToileNodeState>).
//
// Fonction pure, sans dependance React. La structure d entree
// est la meme que celle alimentee par les evenements engine-start
// et engine-done du SSE existant. On consomme, on ne reemet pas
// : aucune modification de /api/analyze ni du flux serveur.
//
// Convention :
//   - status 'running'  -> ToileNodeState 'running'
//   - status 'done'     -> ToileNodeState 'done'
//   - status 'error'    -> ToileNodeState 'error'
//   - status 'idle' ou absent -> ToileNodeState 'idle'
//
// Les ids hors topologie (prescan, moteurs Bloc 2 data room)
// sont ignores : la toile n affiche que les noeuds de la
// topologie. Les noeuds toile sans signal SSE (saas-metrics,
// industrial-metrics, benchmarks) tombent naturellement en idle.
// ============================================================

import { TOILE_NODE_IDS } from './mapping';

export type EngineStatus = 'idle' | 'running' | 'done' | 'error';

export interface EngineStateLike {
  status: EngineStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export type ToileNodeState = 'idle' | 'running' | 'done' | 'error';

/**
 * Convertit un EngineState (cote HomeClient) en ToileNodeState.
 * Les deux types partagent les memes labels aujourd hui, mais le
 * passage explicite documente l intention et permet de divergeer
 * proprement si l un des deux types evolue.
 */
export function engineStatusToToileState(status: EngineStatus | undefined): ToileNodeState {
  switch (status) {
    case 'running':
      return 'running';
    case 'done':
      return 'done';
    case 'error':
      return 'error';
    case 'idle':
    case undefined:
    default:
      return 'idle';
  }
}

/**
 * Construit le dictionnaire d etats consommable par PipelineToile
 * a partir des engineStates de HomeClient. Exhaustif sur la
 * topologie : tout noeud absent retombe en idle, jamais undefined.
 */
export function buildToileStates(
  engineStates: Record<string, EngineStateLike> | null | undefined,
): Record<string, ToileNodeState> {
  const result: Record<string, ToileNodeState> = {};
  const source = engineStates ?? {};
  for (const id of TOILE_NODE_IDS) {
    const s = source[id];
    result[id] = engineStatusToToileState(s?.status);
  }
  return result;
}

/**
 * Etat neutre : tous les noeuds en idle. Utilise quand la toile
 * est affichee sans run en cours et sans replay disponible
 * (analyse archivee chargee depuis l historique cote serveur sans
 * progress JSONB).
 */
export function buildIdleToileStates(): Record<string, ToileNodeState> {
  const result: Record<string, ToileNodeState> = {};
  for (const id of TOILE_NODE_IDS) result[id] = 'idle';
  return result;
}
