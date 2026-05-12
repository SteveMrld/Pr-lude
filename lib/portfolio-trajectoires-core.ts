// ============================================================
// PORTFOLIO TRAJECTOIRES - CORE LOGIQUE PURE
// ------------------------------------------------------------
// Helpers d agrégation et de tri qui ne dépendent pas de
// Supabase. Tout ce qui touche I/O (charger des analyses,
// charger des snapshots) vit dans portfolio-trajectoires.ts ;
// ce module reste testable de manière déterministe sans
// environnement Next.js.
// ============================================================

import type { AnalysisSummary } from './analysis-store';
import type { TrajectorySnapshotRow } from './trajectory-store';
import { compareAnalyses } from './engines/trajectory/comparator';
import {
  evaluateTrajectoryAlerts,
  getHighestCran,
  type AlertCran,
  type TrajectoryAlert,
} from './engines/trajectory/alerts';
import type {
  TrajectoryComparison,
  TrajectorySnapshot,
} from './engines/trajectory/types';
import type { PatternVerdict } from './engines/fragility-structurelle/types';

// ============================================================
// TYPES
// ============================================================

/**
 * Qualification du tag portfolio. Dérivée du workflowStage : un
 * dossier au stade `signed` est in-portfolio (le fonds est entré
 * au capital), tout autre stade reste en instruction. Cette
 * dérivation est doctrinalement défendable et évite d ajouter une
 * colonne dédiée tant que le besoin n est pas confirmé en prod.
 */
export type PortfolioTag = 'in-portfolio' | 'instruction';

/**
 * Direction de la trajectoire pour la pastille discrète en bout
 * de ligne du listing portfolio. Dérivée du delta du score global
 * (avec le seuil SCORE_TOLERANCE) quand au moins deux snapshots
 * existent. `none` quand la chaîne ne porte qu un snapshot.
 */
export type TrajectoryDirection = 'up' | 'down' | 'stable' | 'none';

/**
 * Ligne agrégée d un dossier dans la vue portfolio trajectoires.
 * Contient le strict nécessaire pour le listing trié et filtré.
 * La timeline complète et le détail des comparisons restent
 * chargés à la demande dans la vue drill-down.
 */
export interface PortfolioTrajectoryRow {
  analysisId: string;
  companyName: string;
  sector: string | null;
  /** Stage workflow brut (in_review, dd_field, ic_review, signed, declined). */
  workflowStage: string | null;
  /** Tag dérivé du workflowStage. */
  portfolioTag: PortfolioTag;
  /** Verdict global actuel (dernier snapshot). */
  verdict: string | null;
  /** Score global actuel (dernier snapshot). */
  globalScore: number | null;
  /** Score Fragilité Structurelle actuel, null si non applicable. */
  fragiliteScore: number | null;
  /** Verdict Fragilité Structurelle actuel, null si non applicable. */
  fragiliteVerdict: PatternVerdict | null;
  /** Nombre total de snapshots dans la chaîne (>= 0). */
  snapshotsCount: number;
  /** Date du dernier snapshot. null si chaîne vide. */
  lastAnalyzedAt: string | null;
  /** Date du premier snapshot, identique à lastAnalyzedAt si un
   *  seul snapshot. null si chaîne vide. */
  firstAnalyzedAt: string | null;
  /** Direction de la trajectoire, dérivée du delta global entre
   *  l avant dernier et le dernier snapshot. */
  direction: TrajectoryDirection;
  /** Delta numérique du score global entre l avant dernier et le
   *  dernier snapshot. null si moins de deux snapshots. */
  scoreDelta: number | null;
  /** Cran d alerte le plus critique parmi les alertes calculées
   *  sur la dernière transition. null si moins de deux snapshots
   *  (pas de transition à classifier). */
  highestCran: AlertCran | null;
  /** Liste des alertes calculées sur la dernière transition. */
  alerts: TrajectoryAlert[];
}

/**
 * Détail trajectoire complet d un dossier, servi à la vue
 * drill-down. Contient toute la chaîne de snapshots et l ensemble
 * des comparisons successives entre paires consécutives.
 */
export interface PortfolioTrajectoryDetail {
  analysisId: string;
  companyName: string;
  sector: string | null;
  workflowStage: string | null;
  portfolioTag: PortfolioTag;
  snapshots: TrajectorySnapshot[];
  /** Comparisons entre snapshots consécutifs, indexée par position
   *  (comparison[i] = entre snapshots[i] et snapshots[i+1]). Vide
   *  si moins de deux snapshots. */
  successiveComparisons: TrajectoryComparison[];
  /** Alertes calculées sur chaque comparison successive. Aligné
   *  par index sur successiveComparisons. */
  successiveAlerts: TrajectoryAlert[][];
  /** Comparison entre le premier et le dernier snapshot. null si
   *  moins de deux snapshots. */
  overallComparison: TrajectoryComparison | null;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Dérive le tag portfolio depuis le workflowStage. Le stade
 * `signed` correspond aux dossiers in-portfolio (le fonds est
 * entré au capital), tout autre stade reste en instruction.
 */
export function derivePortfolioTag(workflowStage: string | null): PortfolioTag {
  return workflowStage === 'signed' ? 'in-portfolio' : 'instruction';
}

/**
 * Convertit une ligne TrajectorySnapshotRow (forme SQL) en
 * TrajectorySnapshot (forme engine). La forme engine est attendue
 * par compareAnalyses, evaluateTrajectoryAlerts et chain-builder.
 */
export function rowToEngineSnapshot(row: TrajectorySnapshotRow): TrajectorySnapshot {
  return {
    analysisId: row.analysisId,
    analyzedAt: row.analyzedAt,
    globalScore: row.globalScore,
    verdict: row.verdict,
    dimensions: {
      team: row.dimensions.team ?? 0,
      market: row.dimensions.market ?? 0,
      macro: row.dimensions.macro ?? 0,
      financial: row.dimensions.financial ?? 0,
      contrarian: row.dimensions.contrarian ?? 0,
      vigilance: row.dimensions.vigilance ?? 0,
    },
    fragiliteScore: row.fragiliteScore,
    fragiliteVerdict: row.fragiliteVerdict,
    narrativeDriftScore: row.narrativeDriftScore,
    narrativeDriftVerdict: row.narrativeDriftVerdict,
    patterns: row.patterns,
    combinaisons: row.combinaisons,
  };
}

/**
 * Dérive la direction de la trajectoire depuis le delta du score
 * global entre l avant dernier et le dernier snapshot. Le seuil
 * SCORE_TOLERANCE (5 points) sépare stable de up/down.
 */
export function deriveDirection(
  delta: number | null,
  tolerance: number = 5,
): TrajectoryDirection {
  if (delta === null) return 'none';
  if (delta >= tolerance) return 'up';
  if (delta <= -tolerance) return 'down';
  return 'stable';
}

/**
 * Comparateur de tri par cran d alerte croissant (1 d abord, puis
 * 2, 3, 4), puis par date de dernière analyse décroissante. Un
 * dossier sans cran (highestCran null, c est à dire moins de deux
 * snapshots) est placé après les dossiers cran 4, parce qu il n a
 * pas encore produit de signal trajectoire exploitable.
 */
export function compareByCran(
  a: PortfolioTrajectoryRow,
  b: PortfolioTrajectoryRow,
): number {
  const ca = a.highestCran ?? 5;
  const cb = b.highestCran ?? 5;
  if (ca !== cb) return ca - cb;
  // Egalité de cran : on remonte les analyses les plus récentes
  // d abord, pour que le partner voie en premier les signaux qui
  // datent.
  const ta = a.lastAnalyzedAt ? new Date(a.lastAnalyzedAt).getTime() : 0;
  const tb = b.lastAnalyzedAt ? new Date(b.lastAnalyzedAt).getTime() : 0;
  return tb - ta;
}

// ============================================================
// AGREGATION
// ============================================================

/**
 * Construction d une ligne d agrégat depuis une analyse et sa
 * liste de snapshots. Pure : pas d I/O, prêt pour test
 * déterministe.
 */
export function aggregateRow(
  analysis: AnalysisSummary,
  snapshotRows: TrajectorySnapshotRow[],
): PortfolioTrajectoryRow {
  const sorted = [...snapshotRows].sort(
    (a, b) => new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime(),
  );

  const portfolioTag = derivePortfolioTag(analysis.workflowStage);

  if (sorted.length === 0) {
    return {
      analysisId: analysis.id,
      companyName: analysis.companyName,
      sector: analysis.sector,
      workflowStage: analysis.workflowStage,
      portfolioTag,
      verdict: analysis.verdict ?? null,
      globalScore: analysis.globalScore,
      fragiliteScore: null,
      fragiliteVerdict: null,
      snapshotsCount: 0,
      lastAnalyzedAt: null,
      firstAnalyzedAt: null,
      direction: 'none',
      scoreDelta: null,
      highestCran: null,
      alerts: [],
    };
  }

  const latest = sorted[sorted.length - 1];
  const earliest = sorted[0];

  // Si un seul snapshot, on ne peut pas calculer de comparison ni
  // d alertes. La ligne reflète juste l état courant.
  if (sorted.length === 1) {
    return {
      analysisId: analysis.id,
      companyName: analysis.companyName,
      sector: analysis.sector,
      workflowStage: analysis.workflowStage,
      portfolioTag,
      verdict: latest.verdict,
      globalScore: latest.globalScore,
      fragiliteScore: latest.fragiliteScore,
      fragiliteVerdict: latest.fragiliteVerdict,
      snapshotsCount: 1,
      lastAnalyzedAt: latest.analyzedAt,
      firstAnalyzedAt: earliest.analyzedAt,
      direction: 'none',
      scoreDelta: null,
      highestCran: null,
      alerts: [],
    };
  }

  // Au moins deux snapshots : on compare l avant dernier et le
  // dernier, on calcule les alertes hiérarchisées sur cette
  // transition.
  const prev = sorted[sorted.length - 2];
  const comparison = compareAnalyses(
    rowToEngineSnapshot(prev),
    rowToEngineSnapshot(latest),
  );
  const alerts = evaluateTrajectoryAlerts(comparison);
  const highestCran = getHighestCran(alerts);
  const scoreDelta = comparison.globalScoreDelta.delta;

  return {
    analysisId: analysis.id,
    companyName: analysis.companyName,
    sector: analysis.sector,
    workflowStage: analysis.workflowStage,
    portfolioTag,
    verdict: latest.verdict,
    globalScore: latest.globalScore,
    fragiliteScore: latest.fragiliteScore,
    fragiliteVerdict: latest.fragiliteVerdict,
    snapshotsCount: sorted.length,
    lastAnalyzedAt: latest.analyzedAt,
    firstAnalyzedAt: earliest.analyzedAt,
    direction: deriveDirection(scoreDelta),
    scoreDelta,
    highestCran,
    alerts,
  };
}

/**
 * Construction d un détail depuis une analyse et ses snapshots.
 * Pure : pas d I/O. Retourne toute la chaîne de snapshots et les
 * comparisons successives entre paires consécutives.
 */
export function aggregateDetail(
  analysis: AnalysisSummary,
  snapshotRows: TrajectorySnapshotRow[],
): PortfolioTrajectoryDetail {
  const sorted = [...snapshotRows].sort(
    (a, b) => new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime(),
  );

  const snapshots = sorted.map(rowToEngineSnapshot);
  const successiveComparisons: TrajectoryComparison[] = [];
  const successiveAlerts: TrajectoryAlert[][] = [];

  for (let i = 1; i < snapshots.length; i++) {
    const c = compareAnalyses(snapshots[i - 1], snapshots[i]);
    successiveComparisons.push(c);
    successiveAlerts.push(evaluateTrajectoryAlerts(c));
  }

  const overallComparison =
    snapshots.length >= 2
      ? compareAnalyses(snapshots[0], snapshots[snapshots.length - 1])
      : null;

  return {
    analysisId: analysis.id,
    companyName: analysis.companyName,
    sector: analysis.sector,
    workflowStage: analysis.workflowStage,
    portfolioTag: derivePortfolioTag(analysis.workflowStage),
    snapshots,
    successiveComparisons,
    successiveAlerts,
    overallComparison,
  };
}
