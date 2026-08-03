// ============================================================
// PRELUDE - Lecture des series financieres par annee
// ------------------------------------------------------------
// Le module vivait sous lib/note/ sous le nom financial-table-alignment,
// parce qu il est ne d un tableau de la note. Il n y appartenait pas :
// lire une serie annuelle a une annee donnee est une primitive
// d analyse, et trois moteurs en avaient chacun leur copie. Un moteur
// n a pas a importer la couche de rendu pour cela.
//
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

// ============================================================
// LECTURE PONCTUELLE A UNE ANNEE
// ------------------------------------------------------------
// Cette fonction existait en trois exemplaires prives, plus une
// quatrieme forme positionnelle, et le scan du 3 aout 2026 a montre
// que les trois se croyaient identiques sans l etre.
//
//   - valuation-engine.ts:822 ecartait les valeurs non numeriques par
//     !isNaN(v) et rendait null ;
//   - indicators-engine.ts:145 ne le faisait pas et rendait NaN, qui
//     se propage silencieusement dans tout calcul ulterieur ;
//   - dd-financial-engine.ts:119 ne cherchait pas par annee du tout :
//     faute de correspondance exacte, il rendait projection[0], et sa
//     jumelle getNextYearProjection rendait projection[1] sans aucune
//     arithmetique d annee.
//
// Le troisieme cas est celui qui coutait. Le test T6 du moteur DD
// resolvait ses deux termes par des regles incompatibles, donc ni
// consecutifs ni ordonnes, puis calculait entre eux une croissance
// qu il nommait « BP croissance Y+1 » et confrontait a la croissance
// reelle du grand livre. Sur une serie de la forme InHairCare, ou
// l annee du grand livre tombe a un indice avance, la pente projetee
// sortait negative et le test qualifiait l ecart en points.
//
// C est le meme defaut que celui repare dans ce module pour le
// tableau de la note : l indice d une serie ne designe pas une annee.
// La correction avait ete branchee la ou le symptome se voyait, un
// tableau decale, et laissee la ou il ne se voyait pas, un drapeau de
// due diligence.
//
// La forme retenue est le comportement le plus prudent des trois : on
// cherche par annee, on ecarte le non numerique, et on rend null
// plutot qu une valeur d une autre annee. La discipline de precision
// impose cet arrondi-la : quand la donnee est moins precise que le
// calcul qui la consomme, on retient la conclusion au lieu de la
// produire.
// ============================================================

/**
 * Valeur d une serie a une annee donnee, ou null.
 *
 * @param year Annee cherchee. Comparee numeriquement, ce qui absorbe
 *   le mixte string/number que la deserialisation JSON peut produire.
 * @param unitMultiplier Applique a la valeur trouvee. Vaut 1 par
 *   defaut : le multiplicateur est une decision de l appelant, qui
 *   seul sait dans quelle unite il raisonne, et un defaut a un million
 *   ferait porter au module une hypothese d unite qui ne lui
 *   appartient pas.
 */
export function pickValueAtYear(
  series: YearValueEntry[] | null | undefined,
  year: number | null | undefined,
  unitMultiplier = 1,
): number | null {
  if (!Array.isArray(series) || series.length === 0) return null;
  if (year === null || year === undefined || !Number.isFinite(year)) return null;
  for (const entry of series) {
    if (entry == null || entry.year == null) continue;
    const y = parseInt(String(entry.year), 10);
    if (y !== year) continue;
    const v = Number(entry.value);
    if (!Number.isFinite(v)) return null;
    return v * unitMultiplier;
  }
  return null;
}

/**
 * Annees d une serie, triees ascending, en nombres. Les entrees dont
 * l annee n est pas parseable sont ecartees plutot que rangees en fin
 * de tri, ou elles se feraient passer pour les plus recentes.
 */
export function seriesYears(series: YearValueEntry[] | null | undefined): number[] {
  if (!Array.isArray(series)) return [];
  const out: number[] = [];
  for (const entry of series) {
    if (entry == null || entry.year == null) continue;
    const y = parseInt(String(entry.year), 10);
    if (Number.isFinite(y) && !out.includes(y)) out.push(y);
  }
  return out.sort((a, b) => a - b);
}
