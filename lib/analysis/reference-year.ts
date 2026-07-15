// ============================================================
// ANNEE DE REFERENCE DU DOSSIER
// ------------------------------------------------------------
// Primitive partagee, module pur, aucune I/O, aucune lecture
// d horloge, aucune heuristique de nom de fichier, aucune
// devinette a partir de narratives.
//
// Regle en une phrase :
//
//   L annee de reference du dossier est financialData.lastActualYear
//   quand le moteur d extraction financiere l a renseigne avec
//   evidence textuelle du document ET quand la valeur reste dans
//   une fenetre de trois ans avec la derniere annee des projections.
//   Sinon null, avec un motif de rejet expose.
//
// La garde de vraisemblance est dans le code, pas dans la suite
// de tests. Un modele qui produit lastActualYear=2013 sur un
// dossier dont les projections vont jusqu a 2026 se voit refuser
// la valeur par la primitive, il ne se contente pas d etre
// signale par un test. La production le rejette au runtime.
//
// L exigence d evidence est dans le code, pas dans le prompt.
// Un modele qui produit lastActualYear=2024 sans citation
// textuelle du document se voit egalement rejeter. Le contrat
// est doctrinal, pas conversationnel.
// ============================================================

export type ReferenceYearRejectionReason =
  | 'no-dossier'
  | 'no-financial-data'
  | 'last-actual-year-absent'
  | 'last-actual-year-out-of-bounds'
  | 'evidence-absent'
  | 'evidence-empty'
  | 'year-not-in-projections'
  | 'year-after-last-projection';

export interface ReferenceYearResult {
  /** Annee retenue apres passage de la garde, ou null si rejet. */
  year: number | null;
  /** Motif de rejet si year === null, ou null si valeur acceptee. */
  rejectionReason: ReferenceYearRejectionReason | null;
  /** Contexte editorial du rejet, court, pret pour affichage dans
   *  un motif d indicateur non-applicable ou dans un log d audit. */
  rejectionDetail: string | null;
}

/**
 * Extrait les annees valides d une projection. Ignore les entrees
 * mal formees, retourne un tableau trie ou un tableau vide.
 */
function projectionYears(projection: any): number[] {
  if (!Array.isArray(projection)) return [];
  const years = projection
    .map((p: any) => parseInt(String(p?.year), 10))
    .filter((y: number) => Number.isFinite(y) && y >= 2000 && y <= 2100);
  years.sort((a, b) => a - b);
  return years;
}

/**
 * Variante avec motif expose. Retourne systematiquement un objet
 * ReferenceYearResult, meme en cas d acceptation. Utile aux
 * consommateurs qui veulent communiquer la raison d un rejet
 * (typiquement le moteur d indicateurs qui affiche un motif
 * d indicateur non-applicable).
 */
export function deriveDossierReferenceYearWithReason(dossier: any): ReferenceYearResult {
  if (!dossier || typeof dossier !== 'object') {
    return { year: null, rejectionReason: 'no-dossier', rejectionDetail: 'Aucun dossier fourni a la primitive.' };
  }
  const fd = dossier.financialData;
  if (!fd || typeof fd !== 'object') {
    return { year: null, rejectionReason: 'no-financial-data', rejectionDetail: 'financialData absent du dossier, aucune source d annee de reference.' };
  }
  const y = fd.lastActualYear;
  if (typeof y !== 'number' || !Number.isFinite(y)) {
    return { year: null, rejectionReason: 'last-actual-year-absent', rejectionDetail: 'financialData.lastActualYear non renseigne par le moteur d extraction.' };
  }
  if (y < 2000 || y > 2100) {
    return { year: null, rejectionReason: 'last-actual-year-out-of-bounds', rejectionDetail: `lastActualYear=${y} hors plage plausible [2000, 2100].` };
  }
  const ev = fd.lastActualYearEvidence;
  if (ev === undefined || ev === null) {
    return { year: null, rejectionReason: 'evidence-absent', rejectionDetail: 'lastActualYearEvidence absente, la primitive refuse une valeur sans citation textuelle du document.' };
  }
  if (typeof ev !== 'string' || ev.trim().length === 0) {
    return { year: null, rejectionReason: 'evidence-empty', rejectionDetail: 'lastActualYearEvidence vide, la primitive refuse une valeur sans citation textuelle du document.' };
  }

  // Deux gardes non numeriques, doctrinales.
  //   1. Appartenance : lastActualYear doit figurer parmi les annees
  //      des projections du dossier. Une annee qui n a jamais ete
  //      chiffree par le BP ne peut pas etre l annee de reference
  //      d execution qu on lit dessus.
  //   2. Posteriorite : lastActualYear ne peut pas etre strictement
  //      superieur a la derniere annee des projections. Une annee
  //      realisee posterieure a tout ce que le dossier documente est
  //      structurellement incoherente.
  // Aucun seuil numerique arbitraire. Les deux conditions decoulent
  // de la structure des donnees, pas d une doctrine d ecart.
  const years = projectionYears(fd.revenueProjection);
  if (years.length > 0) {
    const maxProj = years[years.length - 1];
    if (y > maxProj) {
      return {
        year: null,
        rejectionReason: 'year-after-last-projection',
        rejectionDetail: `lastActualYear=${y} strictement posterieur a la derniere annee des projections (${maxProj}). Une annee realisee ne peut pas depasser ce que le dossier documente.`,
      };
    }
    if (!years.includes(y)) {
      return {
        year: null,
        rejectionReason: 'year-not-in-projections',
        rejectionDetail: `lastActualYear=${y} ne figure pas parmi les annees des projections du dossier (${years.join(', ')}). Une annee absente du BP ne peut pas etre annee de reference.`,
      };
    }
  }

  return { year: y, rejectionReason: null, rejectionDetail: null };
}

/**
 * Signature simple. Delegue au helper avec motif et jette la raison.
 * Retenue pour la compatibilite avec les consommateurs qui n ont
 * besoin que de l annee.
 */
export function deriveDossierReferenceYear(dossier: any): number | null {
  return deriveDossierReferenceYearWithReason(dossier).year;
}
