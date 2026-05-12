// ============================================================
// PORTFOLIO TRAJECTOIRES STORE
// ------------------------------------------------------------
// Service serveur qui aggrège pour chaque dossier du fonds sa
// trajectoire complète : liste de snapshots chronologiques,
// dernière analyse (verdict, score global, score Fragilité), et,
// si une analyse antérieure existe, la comparaison entre l avant
// dernier et le dernier snapshot avec les alertes hiérarchisées
// associées.
//
// Le dashboard consomme cette structure pour la vue liste portfolio
// (tri par cran d alerte, filtres) et pour la vue drill-down par
// dossier (timeline complète, comparisons successives).
//
// La logique pure (agrégation, tri, conversions de format) vit
// dans portfolio-trajectoires-core.ts et reste testable sans
// dépendre de Supabase. Ce fichier ne porte que l orchestration
// I/O et garde le marqueur server-only pour s assurer qu il ne
// fuit pas dans un bundle client.
// ============================================================

import 'server-only';
import { listAnalyses, type AnalysisSummary } from './analysis-store';
import { listSnapshotsForAnalysis } from './trajectory-store';
import { aggregateRow, aggregateDetail } from './portfolio-trajectoires-core';
import type {
  PortfolioTrajectoryRow,
  PortfolioTrajectoryDetail,
} from './portfolio-trajectoires-core';
import { compareByCran } from './portfolio-trajectoires-core';

// Re-exports pour les callers (route handlers, components) qui
// n ont pas à connaître la séparation interne core/io.
export type {
  PortfolioTrajectoryRow,
  PortfolioTrajectoryDetail,
  PortfolioTag,
  TrajectoryDirection,
} from './portfolio-trajectoires-core';
export {
  derivePortfolioTag,
  deriveDirection,
  rowToEngineSnapshot,
  aggregateRow,
  aggregateDetail,
  compareByCran,
} from './portfolio-trajectoires-core';

// ============================================================
// AGREGATION LIST
// ============================================================

/**
 * Construit l agrégat portfolio trajectoires pour tous les
 * dossiers de l user courant. Charge en parallèle les snapshots
 * de chaque dossier, calcule la comparison + les alertes sur la
 * dernière transition, et retourne les lignes triées par cran
 * d alerte croissant.
 *
 * Si la persistence n est pas activée, retourne un tableau vide.
 * Si un dossier n a aucun snapshot (cas degraded : analyse persistée
 * avant le trigger trajectory_snapshots), il est inclus avec
 * snapshotsCount = 0 et direction = none, pour ne pas le faire
 * disparaître silencieusement du listing.
 */
export async function listPortfolioTrajectoires(): Promise<PortfolioTrajectoryRow[]> {
  const analyses = await listAnalyses({ limit: 500 });
  if (analyses.length === 0) return [];

  const rows = await Promise.all(
    analyses.map((a) => buildRowForAnalysis(a)),
  );

  return rows.sort(compareByCran);
}

async function buildRowForAnalysis(
  analysis: AnalysisSummary,
): Promise<PortfolioTrajectoryRow> {
  const snapshotRows = await listSnapshotsForAnalysis(analysis.id);
  return aggregateRow(analysis, snapshotRows);
}

// ============================================================
// AGREGATION DETAIL
// ============================================================

/**
 * Charge le détail trajectoire complet d un dossier pour la vue
 * drill-down. Inclut toute la chaîne de snapshots, les comparisons
 * successives entre paires consécutives, et les alertes par
 * comparison.
 */
export async function getPortfolioTrajectoryDetail(
  analysisId: string,
): Promise<PortfolioTrajectoryDetail | null> {
  const analyses = await listAnalyses({ limit: 500 });
  const analysis = analyses.find((a) => a.id === analysisId);
  if (!analysis) return null;

  const snapshotRows = await listSnapshotsForAnalysis(analysisId);
  return aggregateDetail(analysis, snapshotRows);
}
