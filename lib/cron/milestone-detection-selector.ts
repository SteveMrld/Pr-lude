// ============================================================
// PRELUDE - Selecteur dossiers eligibles a la detection auto milestones
// ------------------------------------------------------------
// Module purement fonctionnel : prend une liste d outcomes plus un
// horodatage de reference, retourne les analysisIds a scanner par
// le cron de detection web. Toute la logique de fetching base et
// de dispatch reste dans la route cron handler.
//
// La separation est volontaire pour la testabilite (la doctrine
// d eligibilite peut etre exercee avec une horloge figee et sans
// toucher Supabase) et l auditabilite (les regles d eligibilite
// sont concentrees dans une fonction lisible plutot que diluees
// dans le code de la route).
//
// Doctrine d eligibilite :
//   1. La decision doit dater de plus de SIX MOIS (180 jours). Avant
//      ce seuil, peu de signaux publics significatifs sont apparus
//      sur une societe en early/growth stage : laisser le temps a
//      la realite de se materialiser.
//   2. Si aucune detection auto n a jamais tourne sur ce dossier,
//      il rentre dans la file (premier scan).
//   3. Sinon, il rentre dans la file si la derniere detection auto
//      date de plus de TROIS MOIS (90 jours). Le cadenas de 6 mois
//      + 12 mois mentionne dans le brief est satisfait par cette
//      regle simple : 6m apres decision, le 1er scan ; 9m, le 2eme
//      (90j apres) ; 12m, le 3eme. Plus simple a raisonner qu un
//      switch arbitraire entre deux fenetres.
//   4. Si un dossier a deja plus de MAX_PENDING_PROPOSED (3)
//      milestones proposes en attente de confirmation, on saute :
//      le partner doit d abord trier sa file avant qu on en empile
//      plus. Evite la lassitude.
//
// Plafond global du run :
//   Le cron limite chaque execution a MAX_DOSSIERS_PER_RUN dossiers
//   (defaut 8) pour ne pas saturer la WebSearch Anthropic ni faire
//   exploser la duree d execution Vercel. Les dossiers les plus
//   anciens en attente passent en tete.
// ============================================================

import type { Decision } from '@/lib/reconciliation-store';

export interface DetectionCandidate {
  analysisId: string;
  userId: string;
  companyName: string;
  decision: Decision;
  /** ISO date YYYY-MM-DD */
  decisionDate: string;
  /** ISO timestamp ou null si jamais scanne */
  lastAutoDetectionAt: string | null;
  pendingProposedCount: number;
}

export interface SelectedForDetection {
  analysisId: string;
  userId: string;
  companyName: string;
  decision: Decision;
  decisionDate: string;
  daysSinceDecision: number;
  daysSinceLastDetection: number | null;
}

export const DETECTION_FIRST_SCAN_DAYS = 180;        // 6 mois
export const DETECTION_RESCAN_INTERVAL_DAYS = 90;    // 3 mois
export const MAX_PENDING_PROPOSED = 3;
export const MAX_DOSSIERS_PER_RUN = 8;

/**
 * Selectionne les dossiers eligibles a la detection auto de milestones.
 *
 * @param candidates  Liste des outcomes avec leur contexte de scan.
 * @param now         Horodatage de reference (Date.now du cron ou Date
 *                    deterministe en test).
 * @param options     Override des seuils pour les tests. En prod, les
 *                    valeurs par defaut s appliquent.
 * @returns Liste tronquee a MAX_DOSSIERS_PER_RUN, triee par anciennete
 *          decroissante (dossiers en attente depuis le plus longtemps
 *          en tete).
 */
export function selectEligibleForDetection(
  candidates: DetectionCandidate[],
  now: Date,
  options: {
    firstScanDays?: number;
    rescanIntervalDays?: number;
    maxPendingProposed?: number;
    maxDossiersPerRun?: number;
  } = {},
): SelectedForDetection[] {
  const firstScanDays = options.firstScanDays ?? DETECTION_FIRST_SCAN_DAYS;
  const rescanIntervalDays = options.rescanIntervalDays ?? DETECTION_RESCAN_INTERVAL_DAYS;
  const maxPendingProposed = options.maxPendingProposed ?? MAX_PENDING_PROPOSED;
  const maxPerRun = options.maxDossiersPerRun ?? MAX_DOSSIERS_PER_RUN;

  const nowMs = now.getTime();
  const out: SelectedForDetection[] = [];

  for (const c of candidates) {
    // Decision date parsable ?
    const decisionMs = Date.parse(c.decisionDate);
    if (Number.isNaN(decisionMs)) continue;

    const daysSinceDecision = Math.floor((nowMs - decisionMs) / (1000 * 60 * 60 * 24));
    if (daysSinceDecision < firstScanDays) continue;

    // Skip si trop de proposed en attente
    if (c.pendingProposedCount >= maxPendingProposed) continue;

    let daysSinceLastDetection: number | null = null;
    if (c.lastAutoDetectionAt) {
      const lastMs = Date.parse(c.lastAutoDetectionAt);
      if (!Number.isNaN(lastMs)) {
        daysSinceLastDetection = Math.floor((nowMs - lastMs) / (1000 * 60 * 60 * 24));
        if (daysSinceLastDetection < rescanIntervalDays) continue;
      }
    }

    out.push({
      analysisId: c.analysisId,
      userId: c.userId,
      companyName: c.companyName,
      decision: c.decision,
      decisionDate: c.decisionDate,
      daysSinceDecision,
      daysSinceLastDetection,
    });
  }

  // Tri : priorite a ceux qui n ont jamais ete scannes (null en tete),
  // puis par anciennete de dernier scan (plus vieux en tete). Quand
  // egal, par decision la plus ancienne.
  out.sort((a, b) => {
    if (a.daysSinceLastDetection === null && b.daysSinceLastDetection !== null) return -1;
    if (a.daysSinceLastDetection !== null && b.daysSinceLastDetection === null) return 1;
    if (a.daysSinceLastDetection !== null && b.daysSinceLastDetection !== null) {
      if (a.daysSinceLastDetection !== b.daysSinceLastDetection) {
        return b.daysSinceLastDetection - a.daysSinceLastDetection;
      }
    }
    return b.daysSinceDecision - a.daysSinceDecision;
  });

  return out.slice(0, maxPerRun);
}
