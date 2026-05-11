// ============================================================
// INJECTION DES NOTES DIMENSIONNELLES DE LA THESE DU FONDS
// ------------------------------------------------------------
// Helper unifie pour injecter dans le user prompt des moteurs
// Bloc 1 les nuances de these specifiques a leur dimension
// (team, market, macro, financial, general).
//
// Les listes sectoriels/geographiques/tickets/stades sont deja
// gerees au niveau du pre-scan via fundProfileForPreScan. Les
// notes texte qualitatives (ex : "preferer les fondateurs
// sectoriels", "tolerer les burns eleves jusqu a 24 mois",
// "exclure tout dossier sans gouvernance independante") meritent
// une injection ciblee dans le moteur correspondant pour ne pas
// diluer le contexte.
//
// Convention : chaque moteur appelle buildFundNoteBlock(note)
// avec sa note dimensionnelle. Si null, retourne chaine vide
// (pas d injection). Sinon retourne un bloc structure avec un
// titre clair pour que le LLM identifie la nuance.
// ============================================================

import { normalizeFrText } from '../data/text-normalize';

export function buildFundNoteBlock(note: string | null | undefined, dimension: string): string {
  if (!note || !note.trim()) return '';
  return `

# NUANCES DE LA THÈSE DU FONDS · DIMENSION ${dimension.toUpperCase()}

Le fonds qui instruit ce dossier a precise les nuances suivantes pour cette dimension. Ces nuances priment sur les heuristiques generiques en cas de tension. Lis-les attentivement avant de produire ton analyse, et adapte ton raisonnement si elles s appliquent au dossier.

${note.trim()}

# FIN DES NUANCES THESE
`;
}

/**
 * Formate la geographie d un dossier sans artefact cosmetique
 * quand des champs sont absents ou redondants. Remplace le motif
 * "${geographicHub ?? '?'}, ${country ?? '?'}" qui produisait des
 * "?, France" ou "France, France" dans les user prompts envoyes
 * au LLM et dans le bloc CONTEXTE de la note d instruction.
 *
 * Regles :
 *   geographicHub seul, country seul, ou les deux egaux (insensible
 *   a la casse et aux accents) -> on rend une chaine simple. Les
 *   deux differents -> "hub, country". Les deux absents -> mention
 *   "non precise" explicite plutot qu une paire de points
 *   d interrogation.
 */
export function formatExtractionGeography(
  extraction: { geographicHub?: string | null; country?: string | null } | null | undefined,
): string {
  const hub = (extraction?.geographicHub ?? '').trim();
  const country = (extraction?.country ?? '').trim();
  if (!hub && !country) return 'non precise';
  if (!hub) return country;
  if (!country) return hub;
  if (normalizeFrText(hub) === normalizeFrText(country)) return country;
  return `${hub}, ${country}`;
}
