// ============================================================
// PRELUDE - Digest hebdomadaire trajectoire
// ------------------------------------------------------------
// Agrege les alertes cran 3 produites sur les sept derniers jours,
// regroupees par user (partner proprietaire) et par dossier. Envoie
// un email digest par partner le lundi matin.
//
// La selection des alertes se fait via la comparaison snapshot a
// snapshot : pour chaque snapshot insere dans la fenetre temporelle,
// on calcule la comparaison avec le snapshot precedent du meme
// dossier, on evalue les alertes, on retient les cran 3.
//
// Si un dossier a cumule plusieurs cran 3 sur la semaine (plusieurs
// snapshots consecutifs avec transitions), toutes sont agregees dans
// le paragraphe dossier. Pas de deduplication agressive : la
// repetition d alertes successives sur un meme dossier est elle-meme
// un signal narratif que le digest doit transmettre.
//
// Le formatage final passe par trajectory-notifications.
// formatWeeklyDigestEmail, qui structure le corps en prose Le
// Grand Continent.
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { listSnapshotsForAnalysis, type TrajectorySnapshotRow } from '@/lib/trajectory-store';
import { compareAnalyses } from '@/lib/engines/trajectory/comparator';
import {
  evaluateTrajectoryAlerts,
  filterAlertsByCran,
  type TrajectoryAlert,
} from '@/lib/engines/trajectory/alerts';
import type { TrajectorySnapshot } from '@/lib/engines/trajectory/types';
import {
  dispatchEmail,
  formatWeeklyDigestEmail,
  type AlertedAnalysis,
} from '@/lib/trajectory-notifications';

// ============================================================
// HELPER : row -> snapshot d engine
// ============================================================
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

// ============================================================
// COLLECTE DES ALERTES CRAN 3 PAR USER ET PAR DOSSIER
// ============================================================

export interface CollectedDigestEntry {
  userId: string;
  analysisId: string;
  companyName: string;
  alerts: TrajectoryAlert[];
}

/**
 * Pour une liste plate de rangees snapshot insere dans la fenetre,
 * calcule les alertes cran 3 et regroupe par user et par dossier.
 * Fonction pure (entierement testable) : ne touche pas la base, ne
 * dispatche pas d email. Le caller fournit deja les snapshots de
 * la fenetre et les rangees historiques par dossier.
 *
 * @param snapshotsByAnalysis map analysisId -> liste de snapshots
 *                             ordonnee chronologique (ascendant).
 * @param recentVersionIds     identifiants des snapshots inseres
 *                             dans la fenetre temporelle, qui
 *                             doivent etre evalues contre leur
 *                             predecesseur immediat.
 */
export function collectCran3Alerts(
  snapshotsByAnalysis: Map<string, TrajectorySnapshotRow[]>,
  recentVersionIds: Set<string>,
): CollectedDigestEntry[] {
  const grouped = new Map<string, CollectedDigestEntry>();

  for (const [analysisId, snapshots] of Array.from(snapshotsByAnalysis.entries())) {
    if (snapshots.length < 2) continue;
    // On itere les indices 1..N : chaque snapshot recent (dans la
    // fenetre) est compare a son predecesseur immediat.
    for (let i = 1; i < snapshots.length; i++) {
      const cur = snapshots[i];
      if (!recentVersionIds.has(cur.id)) continue;
      const prev = snapshots[i - 1];
      const comparison = compareAnalyses(
        rowToEngineSnapshot(prev),
        rowToEngineSnapshot(cur),
      );
      const alerts = evaluateTrajectoryAlerts(comparison);
      const cran3 = filterAlertsByCran(alerts, 3);
      if (cran3.length === 0) continue;

      const key = `${cur.userId}::${analysisId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.alerts.push(...cran3);
      } else {
        grouped.set(key, {
          userId: cur.userId,
          analysisId,
          companyName: cur.companyName,
          alerts: [...cran3],
        });
      }
    }
  }

  return Array.from(grouped.values());
}

// ============================================================
// DISPATCH HEBDOMADAIRE
// ============================================================

export interface WeeklyDigestRunResult {
  digestsSent: number;
  partnersNotified: number;
  totalDossiers: number;
}

/**
 * Execute le digest hebdomadaire pour tous les dossiers in-portfolio
 * de tous les fonds. Charge les snapshots insere depuis 7 jours,
 * agrege les alertes cran 3 par user, formate et dispatch un email
 * par user.
 *
 * @param now         Horodatage de reference, typiquement l heure
 *                    courante de la cron (injecte pour test).
 * @param windowDays  Fenetre de digest, defaut 7 jours.
 * @param baseUrlBuilder Fonction qui construit l URL d un dossier
 *                       a partir de son id. Injectee pour test.
 */
export async function runWeeklyDigest(
  now: Date,
  windowDays: number,
  resolveEmail: (userId: string) => Promise<string | null>,
  baseUrlBuilder: (analysisId: string) => string,
): Promise<WeeklyDigestRunResult> {
  const admin = getSupabaseAdminClient();
  const since = new Date(now.getTime() - windowDays * 86400000).toISOString();

  // Charge les snapshots inseres dans la fenetre, joints aux
  // dossiers in-portfolio. On filtre cote app sur in_portfolio :
  // les snapshots stockent user_id et analysis_id, on resout
  // in_portfolio en croisant avec la table analyses.
  const { data: recent, error: errRecent } = await admin
    .from('trajectory_snapshots')
    .select('id, analysis_id, user_id')
    .gte('analyzed_at', since);

  if (errRecent || !recent || recent.length === 0) {
    if (errRecent) {
      console.error('[trajectory-weekly-digest] recent snapshots query error:', errRecent);
    }
    return { digestsSent: 0, partnersNotified: 0, totalDossiers: 0 };
  }

  const recentAnalysisIds = Array.from(new Set(recent.map((r: any) => r.analysis_id)));
  const recentVersionIds = new Set<string>(recent.map((r: any) => r.id));

  // Filtre les analyses qui sont in_portfolio
  const { data: portfolioAnalyses, error: errPortfolio } = await admin
    .from('analyses')
    .select('id')
    .in('id', recentAnalysisIds)
    .eq('in_portfolio', true);

  if (errPortfolio || !portfolioAnalyses) {
    if (errPortfolio) {
      console.error('[trajectory-weekly-digest] portfolio filter error:', errPortfolio);
    }
    return { digestsSent: 0, partnersNotified: 0, totalDossiers: 0 };
  }

  const portfolioIds = new Set(portfolioAnalyses.map((a: any) => a.id));
  if (portfolioIds.size === 0) {
    return { digestsSent: 0, partnersNotified: 0, totalDossiers: 0 };
  }

  // Charge l historique complet pour chaque dossier eligible. On
  // parallelise les lectures avec un cap conservateur pour eviter
  // de saturer la base si le portfolio est grand.
  const snapshotsByAnalysis = new Map<string, TrajectorySnapshotRow[]>();
  await Promise.all(
    Array.from(portfolioIds).map(async (id) => {
      const snaps = await listSnapshotsForAnalysis(id as string);
      snapshotsByAnalysis.set(id as string, snaps);
    }),
  );

  // Calcule la liste regroupee par user et par dossier.
  const grouped = collectCran3Alerts(snapshotsByAnalysis, recentVersionIds);

  // Regroupe par user pour produire un email par partner.
  const byUser = new Map<string, CollectedDigestEntry[]>();
  for (const entry of grouped) {
    const arr = byUser.get(entry.userId) || [];
    arr.push(entry);
    byUser.set(entry.userId, arr);
  }

  let digestsSent = 0;
  let partnersNotified = 0;
  let totalDossiers = 0;

  // Calcule le debut de la semaine du digest (lundi de la semaine
  // courante au sens UTC). Pour simplifier on prend la date now
  // moins (windowDays - 1) jours et on l envoie comme reference.
  const weekStart = new Date(now.getTime() - (windowDays - 1) * 86400000);

  for (const [userId, entries] of Array.from(byUser.entries())) {
    if (entries.length === 0) continue;
    const email = await resolveEmail(userId);
    if (!email) {
      console.warn(`[trajectory-weekly-digest] pas d email pour user ${userId}, skip`);
      continue;
    }

    const analyses: AlertedAnalysis[] = entries.map((e) => ({
      analysisId: e.analysisId,
      companyName: e.companyName,
      alerts: e.alerts,
      dossierUrl: baseUrlBuilder(e.analysisId),
    }));

    const payload = formatWeeklyDigestEmail(email, analyses, weekStart);
    const result = await dispatchEmail(payload);
    if (result.sent || result.provider === 'log') {
      digestsSent++;
      partnersNotified++;
      totalDossiers += entries.length;
    }
  }

  return { digestsSent, partnersNotified, totalDossiers };
}
