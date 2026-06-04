// ============================================================
// NORMALISATION DETERMINISTE DE LA PONCTUATION FRANCAISE
// ------------------------------------------------------------
// Les sorties LLM intercalent regulierement des em-dashes (U+2014)
// et en-dashes (U+2013) malgre l interdiction explicite dans les
// system prompts. Repeter la consigne dans dix prompts supplementaires
// ne change rien : seul un post-processing deterministe garantit
// l absence totale dans les sorties persistees.
//
// Le module expose deux primitives :
//
//   normalizeFrenchPunctuation(text) : applique le remplacement
//     contextuel sur une chaine. Pure et idempotente.
//
//   normalizeStringsRecursive(value) : walk recursif sur un objet
//     ou tableau, transforme uniquement les valeurs string et
//     preserve la structure (cles, types, undefined, null).
//
// Regles de remplacement :
//   - U+2014 (em-dash) et U+2013 (en-dash) entoures d espaces
//     deviennent une virgule plus un espace (incise francaise).
//   - U+2014 et U+2013 entre deux chiffres deviennent un tiret
//     simple (plage numerique 60-150, intervalle 2024-2025).
//   - U+2014 et U+2013 colle a un chiffre d un seul cote (ex :
//     -10) deviennent un tiret simple.
//   - U+2014 et U+2013 en debut de ligne deviennent un tiret simple
//     (cas d une liste a puces typographique).
//   - U+2014 et U+2013 dans toute autre position (sans espace
//     autour) deviennent un tiret simple.
//   - U+002D (tiret-moins ordinaire) n est JAMAIS touche : plages,
//     URLs, identifiants, dates sont preserves.
//
// Idempotente par construction : aucun caractere produit n est lui
// meme un em-dash ou en-dash, donc une seconde application ne change
// rien.
// ============================================================

const EM_DASH = '—';
const EN_DASH = '–';

/**
 * Normalise les em-dashes (—) et en-dashes (–) en ponctuation
 * conforme a la voix Le Grand Continent. Ne touche pas au tiret
 * simple ordinaire (U+002D) ni a aucun autre caractere.
 *
 * Pure : meme entree donne meme sortie. Idempotente : appliquer
 * deux fois donne le meme resultat qu une fois.
 */
export function normalizeFrenchPunctuation(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return text;
  if (text.indexOf(EM_DASH) === -1 && text.indexOf(EN_DASH) === -1) return text;

  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== EM_DASH && c !== EN_DASH) {
      out += c;
      continue;
    }
    const prev = i > 0 ? text[i - 1] : '';
    const next = i < text.length - 1 ? text[i + 1] : '';
    const prevIsDigit = /\d/.test(prev);
    const nextIsDigit = /\d/.test(next);
    const prevIsSpace = prev === ' ' || prev === '\t';
    const nextIsSpace = next === ' ' || next === '\t';
    const prevIsLineStart = prev === '' || prev === '\n' || prev === '\r';

    if (prevIsDigit && nextIsDigit) {
      out += '-';
    } else if (prevIsDigit || nextIsDigit) {
      out += '-';
    } else if (prevIsSpace && nextIsSpace) {
      if (out.endsWith(' ')) out = out.slice(0, -1);
      out += ', ';
      i++;
    } else if (prevIsLineStart) {
      out += '-';
    } else {
      out += '-';
    }
  }
  return out;
}

/**
 * Walk recursif qui applique normalizeFrenchPunctuation sur toutes
 * les valeurs string d un objet ou tableau, et preserve la
 * structure (cles d objet, types primitifs autres que string, null,
 * undefined).
 *
 * Conserve les references pour les sous-arbres sans em-dash ni
 * en-dash (court-circuit normalizeFrenchPunctuation) pour eviter
 * une duplication memoire inutile sur les result_json volumineux.
 */
export function normalizeStringsRecursive<T>(value: T): T {
  if (typeof value === 'string') {
    return normalizeFrenchPunctuation(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeStringsRecursive(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      out[key] = normalizeStringsRecursive(src[key]);
    }
    return out as unknown as T;
  }
  return value;
}
