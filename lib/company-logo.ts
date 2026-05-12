// ============================================================
// COMPANY LOGO HELPERS
// ------------------------------------------------------------
// Derive un domaine web depuis le nom d entreprise pour aller
// chercher un logo via l API publique Clearbit (logo.clearbit.com).
// Genere aussi les initiales pour le fallback sobre quand le logo
// n est pas trouve.
//
// Le pipeline d analyse ne capture pas systematiquement le domaine
// web du dossier. On infere donc depuis le companyName, qui est
// toujours present. La derivation reste deliberement naive : on
// retire les suffixes legaux (SAS, GmbH, Inc, etc.), on normalise
// l accentuation, et on accole un .com. Pour la plupart des YC,
// SaaS et fonds europeens ca matche. Pour les cas tordus
// (companyName = "Acme Ventures, le robot conversationnel"), le
// fallback initiales prend le relais sans bruit visuel.
//
// Aucun appel reseau ici. Le fetch du logo se fait cote browser
// via la balise img et le fallback est trigge par onError.
// ============================================================

const LEGAL_SUFFIXES =
  /\b(SAS|SASU|SARL|SA|Inc|LLC|Ltd|Limited|GmbH|Corp|Corporation|AG|AB|Oy|BV|Pty|PLC|SCA|SCS|SCI|EURL|SNC|Co|Group|Holding|Holdings)\b\.?/gi;

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Normalise un nom d entreprise en candidat de domaine en .com.
 * Retourne null si le nom est vide ou ne contient aucun caractere
 * alphanumerique apres nettoyage.
 *
 * Exemples :
 *   "Klarna"           -> "klarna.com"
 *   "Mistral AI"       -> "mistralai.com"
 *   "Le Robot SAS"     -> "lerobot.com"
 *   "Acme & Sons Inc." -> "acmesons.com"
 *   "L Étoffe"         -> "letoffe.com"
 *   ""                 -> null
 *   "   "              -> null
 */
export function deriveDomainFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const withoutLegal = trimmed.replace(LEGAL_SUFFIXES, '').trim();
  const source = withoutLegal || trimmed;

  const normalized = source
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9]/g, '');

  if (!normalized) return null;
  return `${normalized}.com`;
}

/**
 * Construit l URL Clearbit pour un domaine donne. Pas de retour
 * conditionnel : si le domaine est invalide, l API renverra 404
 * et le composant basculera sur le fallback via onError.
 */
export function clearbitLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

/**
 * Initiales du nom pour la pastille de fallback. Maximum trois
 * lettres, en majuscules. Strategie :
 *   - 0 mot alphabetique     -> les 2 premiers chars du nom brut
 *   - 1 mot                  -> les 2 premieres lettres
 *   - 2 mots                 -> initiales des deux
 *   - 3+ mots                -> initiales des trois premiers
 * On retire les suffixes legaux avant de splitter pour eviter
 * "AS" pour "Acme SAS" ou "GI" pour "Groupe Industriel GmbH".
 *
 * Le nom vide ou null renvoie "?" pour rester visible plutot que
 * de produire un cercle muet.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';

  const withoutLegal = trimmed.replace(LEGAL_SUFFIXES, '').trim();
  const source = withoutLegal || trimmed;

  const words = source
    .split(/[\s\-_·.,/]+/)
    .map((w) => w.replace(/[^A-Za-zÀ-ÿ0-9]/g, ''))
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    const fallback = source.replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 2).toUpperCase();
    return fallback || '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
}
