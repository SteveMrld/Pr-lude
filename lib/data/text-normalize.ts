// ============================================================
// TEXT-NORMALIZE : helpers de normalisation lexicale FR
// ------------------------------------------------------------
// L extraction LLM produit des libelles libres ou les
// utilisateurs (et les decks) ecrivent indifferemment Sante,
// Sante, Santé, SANTÉ, énergie, énergies, Énergie, etc.
// Toute detection sectorielle ou business-model en aval doit
// donc :
//   1. Ne pas etre sensible a la casse.
//   2. Ne pas etre sensible aux diacritiques.
//
// Plutot que d enumerer dans chaque liste de keywords les
// variantes accentuees et non accentuees (charge de maintenance,
// risque d oubli), on normalise une fois le texte d entree et on
// matche contre des keywords sans accents. Un mot accentue dans
// un libelle source est aplati par normalizeFrText, le keyword
// non accentue le capture, fin de l histoire.
//
// Pourquoi pas une dependance externe (deburr, latinize) :
// String.prototype.normalize est natif Node depuis longtemps et
// suffit largement pour le perimetre FR + EN sectoriel.
// ============================================================

/**
 * Supprime les diacritiques (accents, cedille, trema) d une
 * chaine sans toucher au reste.
 *
 * Implementation : decomposition NFD (separe la lettre de base
 * du diacritique en deux points de code), puis suppression des
 * marques combinantes dans la plage Unicode U+0300 a U+036F qui
 * regroupe accents aigus, graves, circonflexes, tremas, tildes,
 * cedilles et compagnie. On evite le sucre syntaxique
 * /\p{Diacritic}/gu (drapeau u) parce que le tsconfig vise es5
 * et refuse le flag Unicode sur les regex litterales.
 */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normalisation canonique pour les matches sectoriels et
 * business-model : minuscules plus suppression des diacritiques.
 * Tolere null et undefined pour usage direct sur les champs
 * optionnels de l extraction.
 */
export function normalizeFrText(s: string | null | undefined): string {
  if (!s) return '';
  return stripAccents(s.toLowerCase());
}
