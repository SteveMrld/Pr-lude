// ============================================================
// Registry des renderers du drill-down de la toile
// ------------------------------------------------------------
// Architecture : un renderer par moteur si le shape de l output
// merite un rendu specifique, sinon fallback sur le renderer
// generique. Le registry est une table id -> composant. La
// fonction pickRenderer encapsule la selection et reste pure
// pour qu un test deterministe puisse en verifier le contrat.
//
// Trois renderers types sont en place a cette session :
//   - orchestrate (synthese finale)
//   - fragility-structurelle (patterns + combinaisons)
//   - market (lecture rapide + sizing + defensibilite)
//
// Tout autre moteur tombe sur le generique. Les sessions
// suivantes etoufferont la liste a mesure que des renderers
// dedies sont ecrits (team, blindspot, contrarian, etc.).
// ============================================================

import type { ComponentType } from 'react';
import type { ToileRendererProps } from './types';
import { GenericRenderer } from './generic-renderer';
import { OrchestratorRenderer } from './orchestrator-renderer';
import { FragilityRenderer } from './fragility-renderer';
import { MarketRenderer } from './market-renderer';

export type ToileRenderer = ComponentType<ToileRendererProps>;

export const TYPED_RENDERERS: Record<string, ToileRenderer> = {
  orchestrate: OrchestratorRenderer,
  'fragility-structurelle': FragilityRenderer,
  market: MarketRenderer,
};

/**
 * Selectionne le renderer adapte a un engineId. Pas de magie :
 * si un renderer dedie est enregistre, on le retourne ; sinon on
 * retombe sur le generique. La fonction est pure et le retour
 * stable, ce qui permet une comparaison deterministe en test.
 */
export function pickRenderer(engineId: string): ToileRenderer {
  return TYPED_RENDERERS[engineId] ?? GenericRenderer;
}

/**
 * Indique si un engineId est cable sur un renderer dedie. Utile
 * pour tester le contrat sans avoir a inspecter le type du
 * composant retourne, et pour eventuellement marquer dans l UI
 * les noeuds dont la lecture est specialisee.
 */
export function hasTypedRenderer(engineId: string): boolean {
  return engineId in TYPED_RENDERERS;
}

export { GenericRenderer, OrchestratorRenderer, FragilityRenderer, MarketRenderer };
export type { ToileRendererProps };
