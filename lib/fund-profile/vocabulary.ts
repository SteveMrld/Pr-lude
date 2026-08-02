// ============================================================
// VOCABULAIRES FERMES DU PROFIL DE FONDS
// ------------------------------------------------------------
// Ces listes vivaient dans app/settings/fonds/FundProfileClient.tsx,
// c est-a-dire dans un composant client, alors qu elles sont le
// referentiel que le pre-scan doit comparer au dossier. Une comparaison
// deterministe suppose deux cotes ecrits dans le meme vocabulaire ; les
// laisser dans l interface aurait garanti la derive du jour ou
// quelqu un ajoute un secteur d un cote sans l autre.
//
// Elles sont fermees et independantes du fonds. Ce que ce module
// declare, c est la taxonomie de la plateforme, pas la these d un
// fonds : quels secteurs, quelles zones et quels stades existent. Quels
// secteurs un fonds cible releve du profil, et le profil ne descend
// jamais dans un prompt.
//
// La distinction est la doctrine tranchee de la grappe pre-scan. Le
// modele peut lire un deck et dire de quel secteur il releve, c est un
// jugement sur un document. Il ne peut pas dire si ce secteur entre
// dans la these, c est une appartenance a un ensemble, et une
// appartenance se calcule.
// ============================================================

/** Secteurs proposables comme cible. Fermee, ordonnee pour l interface. */
export const SECTORS: readonly string[] = [
  'SaaS B2B', 'Fintech', 'Insurtech', 'Healthtech', 'Biotech', 'Medtech',
  'Deeptech', 'Cleantech', 'Climate tech', 'AI / ML', 'Cyber',
  'Mobilité', 'Spatial', 'Defense', 'Agritech', 'Foodtech',
  'E-commerce', 'Marketplace', 'Consumer', 'Education', 'HR tech',
  'Proptech', 'Industrial tech', 'Robotique', 'IoT', 'Web3 / Crypto',
] as const;

/** Secteurs proposables comme exclusion. */
export const SECTORS_EXCLUDED: readonly string[] = [
  'Defense', 'Tabac', 'Alcool', 'Jeu', 'Adult', 'Fossile', 'Crypto spéculatif',
] as const;

export const GEOGRAPHIES: readonly string[] = [
  'France', 'Royaume-Uni', 'Allemagne', 'Espagne', 'Italie',
  'Benelux', 'Nordics', 'Europe (UE)', 'Royaume-Uni + Irlande',
  'États-Unis', 'Canada', 'Amérique du Nord',
  'Israël', 'MENA', 'Afrique', 'Amérique latine', 'Asie', 'Monde',
] as const;

export const GEOGRAPHIES_EXCLUDED: readonly string[] = [
  'Russie', 'Chine', 'Iran', 'Corée du Nord', 'Pays sous sanctions',
] as const;

/** Stades, du plus amont au plus aval. L ordre porte l adjacence. */
export const STAGES: readonly string[] = [
  'pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth',
  'late-stage', 'pre-IPO',
] as const;

/**
 * Vocabulaire complet remis au modele pour qu il classe le dossier.
 * Union des cibles et des exclusions : le modele doit pouvoir nommer un
 * secteur que le fonds exclut, sinon un dossier de tabac ressortirait
 * hors vocabulaire au lieu d etre exclu.
 */
export const SECTOR_VOCABULARY: readonly string[] =
  Array.from(new Set([...SECTORS, ...SECTORS_EXCLUDED]));

export const GEOGRAPHY_VOCABULARY: readonly string[] =
  Array.from(new Set([...GEOGRAPHIES, ...GEOGRAPHIES_EXCLUDED]));

// ------------------------------------------------------------
// Inclusion geographique
// ------------------------------------------------------------
// Un fonds qui cible « Europe (UE) » vise la France. L inverse est
// faux. La comparaison a donc besoin d un ordre partiel et pas d une
// egalite de chaines, sans quoi un dossier francais serait declare hors
// zone par un fonds europeen.
//
// La table donne, pour chaque zone, les zones qui la contiennent.
// Elle est volontairement pauvre : elle ne modelise que ce que les
// libelles de l interface permettent d affirmer.

const CONTENANTS: Record<string, readonly string[]> = {
  'France': ['Europe (UE)', 'Monde'],
  'Allemagne': ['Europe (UE)', 'Monde'],
  'Espagne': ['Europe (UE)', 'Monde'],
  'Italie': ['Europe (UE)', 'Monde'],
  'Benelux': ['Europe (UE)', 'Monde'],
  'Nordics': ['Europe (UE)', 'Monde'],
  'Europe (UE)': ['Monde'],
  'Royaume-Uni': ['Royaume-Uni + Irlande', 'Monde'],
  'Royaume-Uni + Irlande': ['Monde'],
  'États-Unis': ['Amérique du Nord', 'Monde'],
  'Canada': ['Amérique du Nord', 'Monde'],
  'Amérique du Nord': ['Monde'],
  'Israël': ['MENA', 'Monde'],
  'MENA': ['Monde'],
  'Afrique': ['Monde'],
  'Amérique latine': ['Monde'],
  'Asie': ['Monde'],
  'Chine': ['Asie', 'Monde'],
  'Iran': ['MENA', 'Asie', 'Monde'],
  'Corée du Nord': ['Asie', 'Monde'],
  'Russie': ['Monde'],
  'Monde': [],
  'Pays sous sanctions': [],
};

/**
 * True si `zone` est couverte par `perimetre`, egalite comprise.
 * « France » est dans « Europe (UE) », « Europe (UE) » n est pas dans
 * « France ».
 */
export function zoneCouvertePar(zone: string, perimetre: string): boolean {
  if (zone === perimetre) return true;
  return (CONTENANTS[zone] ?? []).includes(perimetre);
}

// ------------------------------------------------------------
// Voisinage sectoriel
// ------------------------------------------------------------
// Sert au seul statut `warn` : un dossier qui ne tombe pas dans la
// these mais dans une zone connexe merite une alerte, pas une
// elimination. La table est declaree par paires et symetrisee au
// chargement, pour qu on ne puisse pas ecrire une adjacence qui ne
// vaut que dans un sens.

const PAIRES_VOISINES: ReadonlyArray<readonly [string, string]> = [
  ['Consumer', 'E-commerce'],
  ['Consumer', 'Marketplace'],
  ['Consumer', 'Foodtech'],
  ['E-commerce', 'Marketplace'],
  ['Fintech', 'Insurtech'],
  ['Fintech', 'Web3 / Crypto'],
  ['Healthtech', 'Biotech'],
  ['Healthtech', 'Medtech'],
  ['Biotech', 'Medtech'],
  ['Cleantech', 'Climate tech'],
  ['Climate tech', 'Agritech'],
  ['AI / ML', 'Deeptech'],
  ['Deeptech', 'Robotique'],
  ['Deeptech', 'Spatial'],
  ['Deeptech', 'Cyber'],
  ['IoT', 'Industrial tech'],
  ['IoT', 'Robotique'],
  ['Industrial tech', 'Robotique'],
  ['Industrial tech', 'Proptech'],
  ['Industrial tech', 'Mobilité'],
  ['Agritech', 'Foodtech'],
  ['Education', 'HR tech'],
  ['HR tech', 'SaaS B2B'],
  ['Spatial', 'Defense'],
  ['Cyber', 'Defense'],
];

const VOISINS: Map<string, Set<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const [a, b] of PAIRES_VOISINES) {
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a)!.add(b);
    m.get(b)!.add(a);
  }
  return m;
})();

/** True si les deux secteurs sont connexes. Symetrique par construction. */
export function secteursVoisins(a: string, b: string): boolean {
  return VOISINS.get(a)?.has(b) === true;
}

/**
 * True si les deux stades se touchent dans l ordre du financement.
 * Symetrique. Deux stades identiques ne sont pas voisins, ils sont
 * egaux, et l appelant traite l egalite avant.
 */
export function stadesVoisins(a: string, b: string): boolean {
  const ia = STAGES.indexOf(a);
  const ib = STAGES.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  return Math.abs(ia - ib) === 1;
}

/**
 * Fourchettes de ticket conventionnelles par stade, en euros. Elles ne
 * viennent pas du profil du fonds : elles disent ce qu une levee de ce
 * stade pese habituellement sur le marche, ce qui est precisement
 * l objet du test de coherence stade contre ticket.
 */
export const FOURCHETTES_PAR_STADE: Record<string, { bas: number; haut: number }> = {
  'pre-seed': { bas: 50_000, haut: 1_000_000 },
  'seed': { bas: 250_000, haut: 4_000_000 },
  'series-a': { bas: 2_000_000, haut: 15_000_000 },
  'series-b': { bas: 8_000_000, haut: 40_000_000 },
  'series-c': { bas: 20_000_000, haut: 100_000_000 },
  'growth': { bas: 20_000_000, haut: 300_000_000 },
  'late-stage': { bas: 30_000_000, haut: 500_000_000 },
  'pre-IPO': { bas: 50_000_000, haut: 1_000_000_000 },
};
