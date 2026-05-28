// ============================================================
// PRELUDE - Dedup canonique des comparables historiques
// ------------------------------------------------------------
// Le corpus historical_companies peut contenir plusieurs lignes
// pour une meme societe (variantes de saisie : "Pasqal" vs
// "Pasqal SAS", accents inegaux, suffixes legaux differents).
// Sans dedup, ces variantes scorent toutes deux haut sur le meme
// dossier et apparaissent en doublon dans le top N. Visible cote
// note : "Pasqal" apparait deux fois dans le top 5 de Pen Group
// avec le meme score 13 pour cent similaire.
//
// Ce module est volontairement extrait hors de comparables-engine
// pour rester pur (pas de 'server-only', pas de dependance
// Supabase) et donc testable en deterministe.
// ============================================================

/**
 * Normalise un nom de societe en cle canonique pour la dedup.
 * - retire les diacritiques
 * - lowercase
 * - trim et collapse des espaces
 * - retire la ponctuation legere (. ,)
 * - retire le suffixe legal final si present (SAS, SA, Inc, Ltd,
 *   LLC, GmbH, AG, BV, NV, PLC, SARL, SpA, SRL, Oy, AB, AS, KG, Co)
 *
 * Volontairement conservateur : ne tente pas de normaliser des
 * variantes de nommage profondes (ex "Pasqal Computing" vs "Pasqal")
 * qui seraient deux entites differentes a juste titre. Seul le bruit
 * de saisie est attaque.
 */
export function canonicalCompanyName(name: string): string {
  if (!name) return '';
  let key = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
  // Retire un eventuel suffixe legal terminal. Liste limitee aux
  // formes les plus repandues sur le corpus europeen et americain.
  // Les points ont deja ete strippes ci-dessus, donc S.A.S devient sas.
  key = key.replace(
    /\s+(sas|sa|inc|incorporated|ltd|limited|llc|gmbh|ag|bv|nv|plc|sarl|spa|srl|oy|ab|as|kg|co)$/,
    '',
  );
  return key.trim();
}

/**
 * Forme minimale attendue d un comparable pour la dedup. Aligne
 * sur le champ name (string) et similarity (number) du type
 * Comparable de comparables-engine, sans en dependre directement
 * pour rester decouple.
 */
export interface DedupableComparable {
  name: string;
  similarity: number;
}

/**
 * Dedupique une liste de comparables par nom canonique. Conserve
 * la premiere occurrence rencontree pour chaque cle.
 *
 * Pre-requis : l appelant a deja trie par similarity decroissante.
 * Avec ce tri, la premiere occurrence d une cle correspond a la
 * meilleure similarity de cette societe, ce qui est le comportement
 * attendu. Si la liste n est pas triee, on retombe sur "premiere
 * occurrence dans l ordre fourni", ce qui peut ne pas etre le
 * comparable le plus pertinent mais reste fonctionnellement correct
 * (pas de doublon en sortie).
 */
export function dedupByCanonicalName<T extends DedupableComparable>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = canonicalCompanyName(item.name);
    if (!key) {
      // Nom vide ou non normalisable : on laisse passer sans dedup
      // pour ne pas masquer silencieusement une donnee anormale.
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
