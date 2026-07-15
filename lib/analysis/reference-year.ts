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
//   evidence textuelle du document, sinon null.
//
// Refonte brique 11. La cascade precedente (as_of colonne, max A/B
// des narratives, motif YYYY du filename) etait fondamentalement
// cassee sur trois axes : as_of etait la date du run d ingestion et
// non une propriete du dossier, le filename ne portait pas toujours
// l annee du memorandum, le max A/B remontait des chiffres
// historiques ponctuels (2013, 2014) comme reference d instruction
// pour des dossiers dont l exercice courant etait bien plus recent.
//
// Nouvelle doctrine : l annee de reference est une donnee du
// document, extraite par le LLM avec citation, ou elle n existe
// pas. Le pipeline ne l invente pas.
// ============================================================

/**
 * Derive l annee de reference d un dossier. Une seule source :
 * financialData.lastActualYear, alimente par le moteur d extraction
 * financiere quand le document qualifie explicitement un exercice
 * comme actual. Aucune inference, aucun fallback.
 *
 * Retourne null si le champ n existe pas ou si son evidence est
 * absente. Le pipeline doit alors declarer l absence, jamais deviner.
 */
export function deriveDossierReferenceYear(dossier: any): number | null {
  if (!dossier || typeof dossier !== 'object') return null;
  const fd = dossier.financialData;
  if (!fd || typeof fd !== 'object') return null;
  const y = fd.lastActualYear;
  if (typeof y !== 'number' || !Number.isFinite(y)) return null;
  if (y < 2000 || y > 2100) return null;
  // Evidence obligatoire. Sans citation extraite du document, on
  // considere lastActualYear comme non fiable et on refuse de le
  // consommer, quel que soit sa valeur.
  const ev = fd.lastActualYearEvidence;
  if (typeof ev !== 'string' || ev.trim().length === 0) return null;
  return y;
}
