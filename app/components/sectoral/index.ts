// ============================================================
// PRELUDE - Barre d export des composants spider chart sectoriels
// ------------------------------------------------------------
// Surface publique des trois composants livrables du sous-chantier
// 5 de la Sectoral Intelligence Layer. Les consommateurs (note
// d instruction, dashboard partner, page admin future) importent
// uniquement depuis ce fichier.
// ============================================================

export { SectoralSpiderChart, briefToSpiderData } from './SectoralSpiderChart';
export type {
  SectoralSpiderChartProps,
  SectoralRenderMode,
} from './SectoralSpiderChart';

export { SectoralSuperposition } from './SectoralSuperposition';
export type { SectoralSuperpositionProps } from './SectoralSuperposition';

export { SectoralTemporalComparison } from './SectoralTemporalComparison';
export type { SectoralTemporalComparisonProps } from './SectoralTemporalComparison';

export {
  CONVERGENCE_THRESHOLD,
  DIVERGENCE_THRESHOLD,
  TEMPORAL_DELTA_THRESHOLD,
  formatSectoralDate,
  computeDimensionDiffs,
  computeTemporalMoves,
  buildOverlayEditorial,
  buildTemporalEditorial,
} from './editorial-helpers';
export type {
  DimensionDiff,
  TemporalMove,
  OverlayEditorialOptions,
  TemporalEditorialOptions,
} from './editorial-helpers';
