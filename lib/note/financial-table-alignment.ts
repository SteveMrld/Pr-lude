// ============================================================
// PRELUDE - Alignement des series financieres par annee
// ------------------------------------------------------------
// Le tableau Profil financier de InvestmentNoteView aggregait trois
// series (revenueProjection, grossMarginProjection, ebitdaProjection,
// plus fcfProjection quand present) en les rendant chacune ligne par
// ligne avec .map(index -> cellule). L en-tete etait construit
// exclusivement depuis revenueProjection. Sur un dossier ou les series
// n ont pas la meme longueur (cas 9201a046 InHairCare : revenue 8
// entrees 2019..2026, grossMargin et ebitda 7 entrees 2020..2026),
// l alignement positionnel decalait toutes les valeurs d un an. La
// note affichait EBITDA 2024 = 0.402 alors que la vraie valeur pour
// 2024 dans le run est 0.138. Le cartouche Rule of 40 calcule sur
// 0.138 (correctement, depuis financialData directement), ce qui
// creait une contradiction visible dans la note entre le tableau et
// le calcul derive.
//
// Ce module offre deux fonctions pures qui fournissent le contrat
// d alignement doctrinal :
//
//   1. unionYears(...series) : union triee ascending des annees
//      presentes dans une ou plusieurs series. Tolere le mixte
//      number|string via normalisation en string. Tri numerique
//      (2019 < 2020 < ... < 2026), pas lexical.
//
//   2. alignSeriesToYears(series, years) : projette une serie sur un
//      tableau d annees de reference. Retourne un tableau de meme
//      longueur ou chaque cellule est la valeur de la serie pour
//      cette annee, ou null si la serie n a pas d entree pour cette
//      annee.
//
// Le composant utilise unionYears pour construire l en-tete puis
// alignSeriesToYears pour chaque ligne. Toute cellule null est
// rendue vide. Aucune ligne n a besoin d avoir la meme longueur que
// l en-tete au niveau des donnees source : l alignement se fait par
// cle annee, pas par position.
// ============================================================

export interface YearValueEntry {
  year: string | number;
  value: number;
  basis?: string | null;
  source?: string | null;
}

/**
 * Union triee ascending (numeriquement) des annees presentes dans
 * une ou plusieurs series financieres. Les annees sont normalisees
 * en string pour tolerer le mixte number|string dans les sortants
 * du moteur financial-extraction (le prompt LLM les rend en string
 * mais la deserialisation JSON peut varier).
 */
export function unionYears(
  ...serieses: Array<YearValueEntry[] | null | undefined>
): string[] {
  const set = new Set<string>();
  for (const series of serieses) {
    if (!Array.isArray(series)) continue;
    for (const entry of series) {
      if (entry == null || entry.year == null) continue;
      set.add(String(entry.year));
    }
  }
  return Array.from(set).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

/**
 * Aligne une serie sur un tableau d annees de reference. Retourne un
 * tableau de (number | null) de meme longueur que years. Cellule null
 * signifie que la serie n a pas d entree pour cette annee, et sera
 * rendue vide dans le tableau. Doublons dans la serie source :
 * premiere occurrence retenue, comportement previsible et documente.
 * Entree avec value non-numerique : ignoree comme si absente.
 */
export function alignSeriesToYears(
  series: YearValueEntry[] | null | undefined,
  years: string[],
): Array<number | null> {
  if (!Array.isArray(series)) return years.map(() => null);
  const map = new Map<string, number>();
  for (const entry of series) {
    if (entry == null || entry.year == null) continue;
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) continue;
    const key = String(entry.year);
    if (!map.has(key)) map.set(key, entry.value);
  }
  return years.map((y) => (map.has(y) ? (map.get(y) as number) : null));
}
