// ============================================================
// PRELUDE - Selecteur cron sectoriel
// ------------------------------------------------------------
// Module purement fonctionnel : prend une liste plate de
// candidats (un par secteur catalogue, avec la date du dernier
// brief persiste) et un horodatage de reference, retourne la
// file des secteurs a regenerer aujourd hui.
//
// L isolation est volontaire pour deux raisons. D abord la
// testabilite : le selecteur est appele dans un test deterministe
// qui injecte une horloge figee, sans toucher Supabase ni l API
// Anthropic. Ensuite l auditabilite : la doctrine d eligibilite
// (90 jours, max quatre par jour, oldest first puis slug
// alphabetique en tie-break) est concentree dans une fonction
// lisible plutot que diluee dans le code de la route Vercel Cron.
//
// Doctrine :
//   1. Une fiche est eligible si la derniere generation date de
//      plus de 90 jours pleins. Le seuil reflete le pas
//      trimestriel de la doctrine sectorielle.
//   2. Si la fiche n a jamais ete generee (latestGeneratedAt
//      null), le secteur est traite comme prioritaire absolu :
//      sans ancrage sectoriel, le pipeline tourne a vide. Score
//      d age fixe a +Infinity en pratique pour passer en tete.
//   3. Maximum quatre secteurs sont traites par jour pour amortir
//      le cout LLM sur la semaine et permettre une intervention
//      manuelle si une fiche sort anormale avant que la suivante
//      ne parte. Le reste est repousse au lendemain par
//      construction (le cron tourne tous les jours).
//   4. Tri principal : age decroissant (le plus vieux passe en
//      premier). Tri secondaire : slug alphabetique pour
//      stabiliser l ordre quand plusieurs fiches ont strictement
//      le meme age (cas marginal mais possible apres un seed
//      simultane). L ordre stable evite les sorties non
//      reproductibles entre deux invocations du selecteur sur le
//      meme etat.
// ============================================================

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------

/**
 * Seuil d eligibilite, en jours. Cale sur le pas trimestriel
 * (un quart d annee = 91 jours, on arrondit en bas pour ne pas
 * laisser une fiche deborder le trimestre).
 */
export const DEFAULT_SECTOR_REGEN_THRESHOLD_DAYS = 90;

/**
 * Plafond quotidien de regenerations cron. Quatre secteurs par
 * jour, soit treize secteurs traites en quatre jours, ce qui
 * laisse trois jours de marge dans la semaine pour les
 * declenchements event ou les retries d echec.
 */
export const DEFAULT_DAILY_REGEN_BUDGET = 4;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ------------------------------------------------------------
// TYPES PUBLICS
// ------------------------------------------------------------

/**
 * Candidat soumis au selecteur. Le caller doit fournir le slug
 * du secteur et la date ISO de sa derniere generation persistee.
 * Si jamais regenere, latestGeneratedAt vaut null.
 */
export interface SectorRegenCandidate {
  sectorSlug: string;
  /** ISO 8601, ou null si aucune fiche n a jamais ete generee. */
  latestGeneratedAt: string | null;
}

/**
 * Resultat du selecteur. Ordre = priorite : la fiche la plus
 * ancienne (ou jamais generee) sort en tete. Le caller traite
 * en serie pour ne pas saturer Anthropic.
 */
export interface SelectedSector {
  sectorSlug: string;
  /** ISO 8601, ou null si jamais generee. */
  latestGeneratedAt: string | null;
  /** Nombre de jours depuis la derniere generation, +Infinity si
   *  jamais generee. Utile pour le log et pour confirmer le
   *  franchissement de seuil. */
  ageDays: number;
}

export interface SelectorOptions {
  thresholdDays?: number;
  dailyBudget?: number;
}

// ------------------------------------------------------------
// API PRINCIPALE
// ------------------------------------------------------------

/**
 * Selectionne les secteurs a regenerer aujourd hui.
 *
 * @param candidates Liste plate des secteurs catalogues avec leur
 *                   derniere date de generation persistee. Le
 *                   caller (cron handler) construit cette liste a
 *                   partir de SECTORS et de la table
 *                   sectoral_briefs.
 * @param now        Horodatage de reference. Injecte (Date.now du
 *                   cron en production, Date deterministe en test).
 * @param options    Surcharges du seuil et du budget quotidien,
 *                   utiles aux tests et a un eventuel ajustement
 *                   par environnement.
 * @returns Liste tronquee au budget quotidien, triee par anciennete
 *          decroissante puis slug alphabetique.
 */
export function selectEligibleSectorsForRegeneration(
  candidates: SectorRegenCandidate[],
  now: Date,
  options: SelectorOptions = {},
): SelectedSector[] {
  const threshold = options.thresholdDays ?? DEFAULT_SECTOR_REGEN_THRESHOLD_DAYS;
  const budget = options.dailyBudget ?? DEFAULT_DAILY_REGEN_BUDGET;
  const nowMs = now.getTime();

  const eligible: SelectedSector[] = [];

  for (const c of candidates) {
    // Sans fiche persistee, le secteur est immediatement eligible
    // (priorite maximale, ageDays = +Infinity).
    if (!c.latestGeneratedAt) {
      eligible.push({
        sectorSlug: c.sectorSlug,
        latestGeneratedAt: null,
        ageDays: Number.POSITIVE_INFINITY,
      });
      continue;
    }

    const ts = Date.parse(c.latestGeneratedAt);
    if (Number.isNaN(ts)) {
      // Date invalide : on la traite comme une absence de fiche
      // pour ne pas bloquer le cron sur un cas pathologique.
      // L admin verra dans le log que le secteur a ete repris.
      eligible.push({
        sectorSlug: c.sectorSlug,
        latestGeneratedAt: c.latestGeneratedAt,
        ageDays: Number.POSITIVE_INFINITY,
      });
      continue;
    }

    const days = Math.floor((nowMs - ts) / MS_PER_DAY);
    if (days < threshold) continue;

    eligible.push({
      sectorSlug: c.sectorSlug,
      latestGeneratedAt: c.latestGeneratedAt,
      ageDays: days,
    });
  }

  // Tri primaire age decroissant, tri secondaire slug alphabetique.
  // Stabilite indispensable pour reproductibilite entre invocations.
  eligible.sort((a, b) => {
    if (a.ageDays !== b.ageDays) return b.ageDays - a.ageDays;
    return a.sectorSlug.localeCompare(b.sectorSlug);
  });

  // Tronque au budget quotidien.
  return eligible.slice(0, Math.max(0, budget));
}
