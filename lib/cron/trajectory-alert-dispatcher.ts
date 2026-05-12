// ============================================================
// PRELUDE - Dispatcher d alertes de trajectoire
// ------------------------------------------------------------
// Pont entre la couche snapshot (trajectory_snapshots) et la
// couche email (trajectory-notifications). A partir d un analysisId,
// charge les deux derniers snapshots, calcule la comparaison via
// compareAnalyses, evalue les alertes via evaluateTrajectoryAlerts,
// puis route :
//   - Cran 1 ou 2 -> email immediat au proprietaire
//   - Cran 3      -> mise en file pour le digest hebdomadaire
//   - Cran 4      -> rien
//
// Volontairement isole de l UI : appelable depuis le cron, depuis
// les save-paths de l API analyze, depuis un script de backfill.
// Logique unique en une fonction, evite la divergence de regles
// entre canaux.
// ============================================================

import { listSnapshotsForAnalysis, type TrajectorySnapshotRow } from '@/lib/trajectory-store';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { compareAnalyses } from '@/lib/engines/trajectory/comparator';
import {
  evaluateTrajectoryAlerts,
  filterAlertsByCran,
  type TrajectoryAlert,
} from '@/lib/engines/trajectory/alerts';
import type { TrajectorySnapshot } from '@/lib/engines/trajectory/types';
import {
  dispatchEmail,
  formatImmediateAlertEmail,
  type AlertedAnalysis,
} from '@/lib/trajectory-notifications';

// ============================================================
// HELPERS
// ============================================================

/**
 * Convertit une ligne trajectory_snapshots en TrajectorySnapshot
 * exploitable par compareAnalyses. La ligne DB porte des metadonnees
 * (versionNum, userId, companyName) que le snapshot d engine ignore.
 */
function rowToEngineSnapshot(row: TrajectorySnapshotRow): TrajectorySnapshot {
  return {
    analysisId: row.analysisId,
    analyzedAt: row.analyzedAt,
    globalScore: row.globalScore,
    verdict: row.verdict,
    dimensions: {
      team: row.dimensions.team ?? row.globalScore,
      market: row.dimensions.market ?? row.globalScore,
      macro: row.dimensions.macro ?? row.globalScore,
      financial: row.dimensions.financial ?? row.globalScore,
      contrarian: row.dimensions.contrarian ?? row.globalScore,
      vigilance: row.dimensions.vigilance ?? row.globalScore,
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
 * Resout l email du proprietaire d un dossier. En mode auth, on lit
 * auth.users.email via le client admin. En mode solo (pas d auth),
 * on utilise PRELUDE_PARTNER_EMAIL si defini, sinon on retourne null
 * (le dispatch log uniquement).
 */
async function resolvePartnerEmail(userId: string): Promise<string | null> {
  const fallback = process.env.PRELUDE_PARTNER_EMAIL || null;
  if (process.env.ENABLE_AUTH !== 'true') return fallback;

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return fallback;
    return data.user.email;
  } catch {
    return fallback;
  }
}

/**
 * Compose l URL canonique d un dossier. Lu depuis PRELUDE_BASE_URL
 * (Vercel injecte VERCEL_URL en runtime mais sans schema).
 */
function buildDossierUrl(analysisId: string): string {
  const base =
    process.env.PRELUDE_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://prelude.app');
  return `${base}/?dossier=${encodeURIComponent(analysisId)}`;
}

// ============================================================
// EVALUATION POUR UN DOSSIER
// ============================================================

export interface TrajectoryEvaluation {
  analysisId: string;
  companyName: string;
  userId: string;
  alerts: TrajectoryAlert[];
  /** Adresse email du partner si resolue, null sinon. */
  partnerEmail: string | null;
  dossierUrl: string;
}

/**
 * Charge les deux derniers snapshots d un dossier et calcule la
 * liste hierarchisee d alertes. Retourne null si moins de deux
 * snapshots disponibles (rien a comparer).
 */
export async function evaluateForAnalysis(
  analysisId: string,
): Promise<TrajectoryEvaluation | null> {
  const snapshots = await listSnapshotsForAnalysis(analysisId);
  if (snapshots.length < 2) return null;

  const before = snapshots[snapshots.length - 2];
  const after = snapshots[snapshots.length - 1];

  const comparison = compareAnalyses(
    rowToEngineSnapshot(before),
    rowToEngineSnapshot(after),
  );
  const alerts = evaluateTrajectoryAlerts(comparison);

  const partnerEmail = await resolvePartnerEmail(after.userId);
  return {
    analysisId,
    companyName: after.companyName,
    userId: after.userId,
    alerts,
    partnerEmail,
    dossierUrl: buildDossierUrl(analysisId),
  };
}

// ============================================================
// DISPATCH IMMEDIAT - CRANS 1 ET 2
// ============================================================

/**
 * Envoie un email immediat si la liste d alertes contient au moins
 * un cran 1 ou 2. Idempotent par construction (un meme call envoie
 * un seul email). Le caller decide quand appeler : typiquement
 * juste apres la creation d un nouveau snapshot (api/analyses POST
 * apres createVersion, ou cron de re-analyse apres runAutoReanalysis).
 *
 * Retourne true si un email a ete envoye ou tente, false si rien a
 * dispatcher (alerts crans 1/2 vides, ou pas d email partner resolu).
 */
export async function dispatchImmediateIfNeeded(
  evaluation: TrajectoryEvaluation,
): Promise<boolean> {
  const criticalAlerts = [
    ...filterAlertsByCran(evaluation.alerts, 1),
    ...filterAlertsByCran(evaluation.alerts, 2),
  ];
  if (criticalAlerts.length === 0) return false;
  if (!evaluation.partnerEmail) {
    console.warn(
      `[trajectory-alert-dispatcher] cran 1/2 sur ${evaluation.analysisId} mais email partner absent`,
    );
    return false;
  }

  const alerted: AlertedAnalysis = {
    analysisId: evaluation.analysisId,
    companyName: evaluation.companyName,
    alerts: criticalAlerts,
    dossierUrl: evaluation.dossierUrl,
  };

  const payload = formatImmediateAlertEmail(evaluation.partnerEmail, alerted);
  const result = await dispatchEmail(payload);
  return result.sent || result.provider === 'log';
}
