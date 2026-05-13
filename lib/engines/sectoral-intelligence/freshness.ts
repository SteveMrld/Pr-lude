// ============================================================
// PRELUDE - Sectoral Intelligence Layer, helpers de fraicheur
// ------------------------------------------------------------
// Calcule l etat de fraicheur d une fiche sectorielle en
// fonction de la date de derniere regeneration. Sert la page
// admin /admin/sectoral et eventuellement le widget partner qui
// signale qu une fiche commence a vieillir.
//
// Doctrine :
//   - Le cycle de regeneration est trimestriel (sous-chantier 7).
//     Une fiche est donc a jour tant qu elle n a pas depasse un
//     trimestre plus une petite marge de tolerance.
//   - Au-dela, on entre en zone recommandation : la fiche reste
//     exploitable mais merite une regeneration au prochain
//     creneau. Le seuil fin de zone est cale sur un second cycle
//     trimestriel.
//   - Au-dela encore, la fiche est consideree perimee : elle ne
//     doit plus etre injectee dans les moteurs sans regeneration
//     manuelle prealable.
//   - L absence totale de fiche pour un secteur est traitee comme
//     une periemption (etat le plus rouge possible) : le pipeline
//     ne doit jamais tourner sans ancrage sectoriel.
//
// Les seuils sont exprimes en jours et exposes en constantes pour
// rester ajustables sans toucher a la logique. Ils sont calibres
// sur le pas trimestriel (90 jours) avec marge.
// ============================================================

export type FreshnessState = 'a_jour' | 'recommandee' | 'perimee';

// Seuil fin de zone "a jour" : un trimestre plus dix jours de
// marge pour absorber le decalage cron et les jours feries.
export const FRESHNESS_THRESHOLD_A_JOUR_DAYS = 100;

// Seuil fin de zone "recommandee" : deux trimestres pleins.
// Au-dela, la fiche est consideree perimee.
export const FRESHNESS_THRESHOLD_RECOMMANDEE_DAYS = 185;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ------------------------------------------------------------
// CALCUL DE FRAICHEUR
// ------------------------------------------------------------
// Retourne l etat de fraicheur d une fiche en fonction de l ecart
// entre sa date de generation et la date de reference (now en
// production, fixee en test). Si generatedAt est null ou
// undefined, la fonction retourne directement perimee : aucune
// fiche n est traite comme periemption maximale.

export function computeFreshness(
  generatedAt: string | Date | null | undefined,
  now: Date = new Date(),
): FreshnessState {
  if (!generatedAt) return 'perimee';

  const generated = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) return 'perimee';

  const ageMs = now.getTime() - generated.getTime();
  if (ageMs < 0) {
    // Date dans le futur, on traite comme une fiche fraichement
    // generee. Ne devrait jamais arriver en production mais on
    // protege l UI contre une horloge desynchronisee.
    return 'a_jour';
  }

  const ageDays = ageMs / MS_PER_DAY;

  if (ageDays < FRESHNESS_THRESHOLD_A_JOUR_DAYS) return 'a_jour';
  if (ageDays < FRESHNESS_THRESHOLD_RECOMMANDEE_DAYS) return 'recommandee';
  return 'perimee';
}

// ------------------------------------------------------------
// AGE EN JOURS, ARRONDI ENTIER
// Sert l affichage admin "regenere il y a N jours".
// ------------------------------------------------------------

export function computeAgeDays(
  generatedAt: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!generatedAt) return null;
  const generated = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (Number.isNaN(generated.getTime())) return null;
  const ageMs = now.getTime() - generated.getTime();
  if (ageMs < 0) return 0;
  return Math.floor(ageMs / MS_PER_DAY);
}

// ------------------------------------------------------------
// LIBELLE EDITORIAL D ETAT
// Sert directement l UI admin. Voix Le Grand Continent : prose
// sobre, pas d em-dashes, pas de jargon technique.
// ------------------------------------------------------------

export function freshnessLabel(state: FreshnessState): string {
  switch (state) {
    case 'a_jour':
      return 'A jour';
    case 'recommandee':
      return 'Regeneration recommandee';
    case 'perimee':
      return 'Perimee';
  }
}

// ------------------------------------------------------------
// COULEUR D AFFICHAGE
// Cle semantique qui sera mappee a une variable CSS cote UI. Le
// helper ne renvoie pas la couleur directement pour decoupler la
// logique de la palette.
// ------------------------------------------------------------

export type FreshnessColorKey = 'green' | 'amber' | 'red';

export function freshnessColorKey(state: FreshnessState): FreshnessColorKey {
  switch (state) {
    case 'a_jour':
      return 'green';
    case 'recommandee':
      return 'amber';
    case 'perimee':
      return 'red';
  }
}
