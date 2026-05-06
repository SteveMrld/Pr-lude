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

export function buildFundNoteBlock(note: string | null | undefined, dimension: string): string {
  if (!note || !note.trim()) return '';
  return `

# NUANCES DE LA THÈSE DU FONDS · DIMENSION ${dimension.toUpperCase()}

Le fonds qui instruit ce dossier a precise les nuances suivantes pour cette dimension. Ces nuances priment sur les heuristiques generiques en cas de tension. Lis-les attentivement avant de produire ton analyse, et adapte ton raisonnement si elles s appliquent au dossier.

${note.trim()}

# FIN DES NUANCES THESE
`;
}
