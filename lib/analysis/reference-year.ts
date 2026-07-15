// ============================================================
// ANNEE DE REFERENCE DU DOSSIER
// ------------------------------------------------------------
// Primitive partagee, module pur, aucune I/O, aucune lecture
// d horloge. Une note d instruction dont les chiffres dependent
// de la date du run n est pas reproductible : deux runs a des
// dates systeme differentes sortiraient des valeurs differentes
// sur le meme document. Cette primitive tranche la question a
// la source : l annee de reference est une propriete du dossier,
// jamais du calendrier.
//
// Regle en une phrase :
//
//   L annee de reference est la premiere valeur disponible dans
//   cet ordre : (1) as_of / frozen_as_of de la ligne analyses,
//   (2) plus grande annee suffixee A ou B trouvee dans les
//   narratives extraction.rawSummary et financialData.rawNotes,
//   (3) annee extraite du source_filename via motif YYYY.MM.DD
//   ou premier YYYY present ; sinon null, la primitive refuse
//   de deviner.
//
// Un dossier dont l annee de reference n est pas derivable est
// un dossier a instruire manuellement, jamais un dossier a
// calculer sur l horloge courante. C est la doctrine.
//
// Cette primitive est le seul point de derivation dans le code.
// Toute lecture de new Date().getFullYear() dans un moteur qui
// touche aux chiffres du dossier est un bug.
// ============================================================

export interface ReferenceYearMeta {
  /** Champ analyses.as_of (ISO date ou annee) si present en base. */
  asOf?: string | null;
  /** Nom de fichier source du deck. */
  sourceFilename?: string | null;
  /** Override injectable pour tests deterministes ou configuration
   *  exceptionnelle. Aucune consommation en production hors tests. */
  refYearOverride?: number | null;
}

/** Regex qui capture les qualifiers de periode YYYYA / YYYYB / YYYYE / YYYYF
 *  dans les narratives. Reserve aux qualifiers A (Actual) et B (Budget)
 *  pour la derivation : E (Estimated) et F (Forecast) sont des projections
 *  et ne fondent pas une reference historique. */
const YEAR_QUALIFIER_REGEX = /(20\d{2})\s*([ABEFP])\b/gi;

/**
 * Derive l annee de reference d un dossier. Retourne null si aucun
 * signal fiable n est disponible. Ne devine jamais, ne lit jamais
 * l horloge systeme, ne consulte pas yearFounded (age de la boite,
 * pas reference d instruction).
 *
 * Le dossier passe en argument doit contenir extraction et
 * financialData s ils sont disponibles ; leur absence est tolere,
 * la primitive tente les autres sources.
 */
export function deriveDossierReferenceYear(
  dossier: any,
  meta: ReferenceYearMeta = {},
): number | null {
  // Override explicite prioritaire (tests, configuration operatoire)
  if (meta.refYearOverride != null && Number.isFinite(meta.refYearOverride)) {
    return meta.refYearOverride;
  }

  // 1. as_of / frozen_as_of : champ de base de donnees, formatte en
  //    ISO date ou annee brute. Prefixe extrait sur 4 caracteres.
  if (typeof meta.asOf === 'string') {
    const y = parseInt(meta.asOf.slice(0, 4), 10);
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
  }

  // 2. Qualifiers de periode dans les narratives. On garde le max
  //    parmi A et B, ce sont les seuls qualifiers qui attestent d une
  //    grandeur observee ou budgetee, pas d une projection.
  const notes = String(dossier?.financialData?.rawNotes || '') + ' ' +
    String(dossier?.extraction?.rawSummary || '');
  let maxActualYear = 0;
  YEAR_QUALIFIER_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = YEAR_QUALIFIER_REGEX.exec(notes)) !== null) {
    const y = parseInt(m[1], 10);
    const q = m[2].toUpperCase();
    if (q === 'A' || q === 'B') {
      if (y > maxActualYear && y >= 2000 && y <= 2100) maxActualYear = y;
    }
  }
  if (maxActualYear > 0) return maxActualYear;

  // 3. Nom de fichier source. Priorite au motif date ISO complete
  //    YYYY.MM.DD (convention de nommage de memorandum), fallback
  //    premier YYYY present. Pas plus intelligent : sortir null
  //    plutot que deriver une annee inventee.
  if (typeof meta.sourceFilename === 'string') {
    const iso = meta.sourceFilename.match(/(20\d{2})[.\-_](\d{2})[.\-_](\d{2})/);
    if (iso) {
      const y = parseInt(iso[1], 10);
      if (Number.isFinite(y)) return y;
    }
    const bare = meta.sourceFilename.match(/(20\d{2})/);
    if (bare) {
      const y = parseInt(bare[1], 10);
      if (Number.isFinite(y)) return y;
    }
  }

  return null;
}
