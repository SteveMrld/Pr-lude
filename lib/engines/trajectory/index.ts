// ============================================================
// SCORE DE TRAJECTOIRE - INDEX
// ------------------------------------------------------------
// Surface publique du module. La couche persistence et l API
// publique seront ajoutees dans des commits ulterieurs.
// ============================================================

export type {
  TrajectorySnapshot,
  ScoreDelta,
  VerdictTransition,
  PatternVerdictTransition,
  TrajectoryComparison,
} from './types';

export {
  SCORE_TOLERANCE,
  VERDICT_HIERARCHY,
  PATTERN_VERDICT_HIERARCHY,
} from './types';

export {
  compareAnalyses,
  computeScoreDelta,
  computeVerdictTransition,
  computePatternVerdictTransition,
  computeDaysBetween,
} from './comparator';

export { extractSnapshot, type AnalysisPayloadForSnapshot } from './snapshot-extractor';

export { buildTrajectoryFromAnalyses, type TrajectorySummary } from './chain-builder';
