// ============================================================
// PRELUDE - Selecteur de dossiers eligibles a la re-analyse auto
// ------------------------------------------------------------
// Module purement fonctionnel : prend une liste de candidats et
// un horodatage de reference, retourne les identifiants des
// dossiers qui doivent etre re-instruits. Toute la logique de
// fetching base et de dispatch est laissee au cron handler.
//
// L isolation est volontaire pour deux raisons. D abord la
// testabilite : le selecteur est appele dans un test deterministe
// qui injecte une horloge figee, sans toucher Supabase. Ensuite
// l auditabilite : la doctrine d eligibilite (six mois, dossier
// in-portfolio, pas de re-analyse trop recente) est concentree
// dans une fonction lisible plutot que diluee dans le code de
// la route Vercel Cron.
//
// Doctrine :
//   1. Seuls les dossiers in-portfolio sont eligibles (le partner
//      a coche le tag dans l UI).
//   2. La derniere analyse, ou re-analyse auto, doit dater de plus
//      de six mois civils (180 jours, choix simple et stable).
//      Au-dela du seuil, le dossier rentre dans la file.
//   3. Si plusieurs candidats franchissent le seuil le meme jour,
//      l ordre de priorite est l anciennete : plus le dernier
//      snapshot est lointain, plus la re-analyse est prioritaire.
//      Permet un comportement deterministe et reproductible si le
//      cron doit traiter une file longue par batches.
//   4. Aucun candidat ne franchit le seuil si son dernier snapshot
//      est null : on considere que le dossier n a jamais ete
//      snapshote, ce qui peut signifier persistence desactivee ou
//      backfill non execute. Plutot que de re-instruire dans le
//      vide, on saute. Le cron loggera ce cas pour suivi.
// ============================================================

/**
 * Candidat soumis au selecteur. Le caller doit fournir l identifiant
 * de l analyse, le timestamp ISO de son dernier snapshot trajectoire,
 * et le flag in_portfolio pour permettre une defense en profondeur
 * (le caller filtre en amont par in_portfolio = true, le selecteur
 * verifie a nouveau pour eviter qu un bug de query ne deborde).
 */
export interface ReanalysisCandidate {
  analysisId: string;
  /** ISO 8601. Null si aucun snapshot n a jamais ete projete. */
  lastSnapshotAt: string | null;
  /** Reduplique le flag de la table analyses pour defense en profondeur. */
  inPortfolio: boolean;
}

/**
 * Resultat du selecteur. Ordre = priorite : plus le dernier snapshot
 * est ancien, plus le dossier est prioritaire (head de liste).
 */
export interface SelectedForReanalysis {
  analysisId: string;
  lastSnapshotAt: string;
  /** Nombre de jours depuis le dernier snapshot. Utile pour le log
   *  et pour confirmer le franchissement de seuil. */
  daysSinceLastSnapshot: number;
}

/**
 * Seuil par defaut : six mois civils interprete comme 180 jours.
 * Choix pragmatique pour eviter les drift entre 6x30 et 6x31. Le
 * seuil est parametrable pour permettre la fenestration en test
 * et un eventuel ajustement par fonds plus tard.
 */
export const DEFAULT_REANALYSIS_THRESHOLD_DAYS = 180;

/**
 * Selectionne les dossiers eligibles a la re-analyse automatique.
 *
 * @param candidates Liste plate des dossiers in-portfolio avec leur
 *                   dernier snapshot trajectoire et le flag tag.
 * @param now        Horodatage de reference. Injecte (Date.now du
 *                   cron ou Date deterministe en test).
 * @param thresholdDays Seuil d eligibilite en jours. Defaut 180.
 * @returns Liste ordonnee par anciennete decroissante du dernier
 *          snapshot (le plus ancien en tete).
 */
export function selectEligibleForReanalysis(
  candidates: ReanalysisCandidate[],
  now: Date,
  thresholdDays: number = DEFAULT_REANALYSIS_THRESHOLD_DAYS,
): SelectedForReanalysis[] {
  const out: SelectedForReanalysis[] = [];
  const nowMs = now.getTime();

  for (const c of candidates) {
    // Defense en profondeur : si le flag a fuite dans la liste alors
    // que le dossier n est pas in-portfolio, on saute. Cas pathologique
    // mais peu couteux a verifier.
    if (!c.inPortfolio) continue;

    // Sans snapshot, on saute. La re-analyse a besoin d un point de
    // comparaison pour produire un signal de trajectoire ; sans
    // baseline, le snapshot apres re-analyse ne pourra etre compare
    // a rien.
    if (!c.lastSnapshotAt) continue;

    const snapshotMs = Date.parse(c.lastSnapshotAt);
    if (Number.isNaN(snapshotMs)) continue;

    const days = Math.floor((nowMs - snapshotMs) / (1000 * 60 * 60 * 24));
    if (days < thresholdDays) continue;

    out.push({
      analysisId: c.analysisId,
      lastSnapshotAt: c.lastSnapshotAt,
      daysSinceLastSnapshot: days,
    });
  }

  // Tri par anciennete decroissante : le dossier dont le dernier
  // snapshot est le plus vieux passe en premier. Permet au cron de
  // traiter en priorite ce qui a derive le plus, et de produire un
  // comportement deterministe en cas de batch tronque.
  out.sort((a, b) => b.daysSinceLastSnapshot - a.daysSinceLastSnapshot);

  return out;
}
