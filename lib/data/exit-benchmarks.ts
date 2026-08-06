// ============================================================
// SORTIES DE REFERENCE PAR CLASSE D ACTIF
// ------------------------------------------------------------
// Vingt et un nombres qui decident seuls de la sortie de domaine de la
// VC inverse, c est-a-dire de la seule methode qui donne un prix
// pre-money sur un dossier sans revenus exploitables.
//
// Ils vivaient jusqu au 5 aout 2026 dans un objet litteral au milieu de
// `getExitScenarios`, dans valuation-engine.ts, sans date, sans source
// verifiable, sans confiance declaree, et sans nom. Une donnee logee
// dans un moteur ne se relit pas : elle n apparait dans aucun
// inventaire, aucun controle ne la parcourt, et personne ne peut
// repondre a la question « de quand datent ces chiffres » sans ouvrir
// le moteur et lire une ligne de commentaire.
//
// Ce module ne change aucune valeur. Il les sort du moteur et declare
// ce qu elles sont, pour que la collecte qui suivra soit possible et
// pour que ce qui manque se voie.
//
// CE QUE L ARCHEOLOGIE A ETABLI, LE 5 AOUT 2026
//
// Le commentaire d origine citait « Crunchbase exits 2020-2025, Atomico
// exits Europe » et etiquetait les valeurs « en EUR ». Les deux lignes
// viennent du meme commit, a3c531a du 7 mai 2026, ecrites par la meme
// main le meme jour, alors que les deux sources nommees publient en
// dollars. Le message de ce commit source les multiples avec precision,
// Bessemer, OpenView, Atomico, Carta, et ne source pas les sorties : il
// dit seulement « calibres sur les exits 2020-2025 ».
//
// La forme des nombres tranche mieux que l archeologie. Vingt et une
// classes portent dix valeurs distinctes, toutes multiples de dix
// millions : 50, 60, 70, 80, 90, 100, 120, 150, 200, 250. Et 80 M
// revient quatre fois, 60 M et 70 M trois fois chacun. Vingt et une
// medianes publiees ne tombent pas sur une echelle de dix barreaux
// ronds, et quatre classes d actif distinctes n ont pas exactement la
// meme mediane de sortie.
//
// Ce ne sont donc pas des statistiques transcrites, ni en dollars ni en
// euros : ce sont des ordres de grandeur poses a la main. La question de
// la devise est sans objet, puisqu il n y a rien a convertir. Et la
// source citee a cote n a pas produit ces nombres.
//
// Le commentaire Crunchbase a disparu pour cette raison. Une source qui
// n a pas ete utilisee ne se cite pas : la citer donnait a ces valeurs
// une autorite qu elles n ont jamais eue, et c est precisement ce qui
// les a rendues invisibles pendant trois mois.
//
// CE QUE CES CHIFFRES NE PORTENT PAS, ET IL FAUT LE LIRE AVANT DE LES
// UTILISER
//
// Aucune dimension de stade. Une sortie de reference vaut le meme
// montant en seed et en series-C, et le stade n intervient qu ensuite,
// par un multiplicateur qui elargit la bande bear/bull autour du meme
// socle. Une societe SaaS B2B sort donc a 80 M€ de reference qu elle
// leve son premier tour ou son quatrieme. C est une simplification
// assumee tant que la collecte n a pas eu lieu, et elle est declaree
// ici plutot que subie dans un moteur.
//
// Aucune source. Voir plus haut : la seule qui figurait au code n a pas
// produit ces nombres.
//
// Aucune devise etablie. Ce n est pas une donnee manquante, c est une
// question sans objet : un ordre de grandeur pose a la main n est
// libelle dans aucune monnaie tant que personne ne le rattache a une
// mesure. La garde qui les compare a une valeur d entreprise le declare
// desormais.
//
// Aucune geographie. Une sortie mediane europeenne et une sortie
// mediane americaine different d un facteur que ces nombres ignorent,
// sur un produit vendu a des fonds europeens.
// ============================================================

/** Ce qu on sait de la provenance d une valeur de sortie. */
export interface ExitBenchmark {
  /**
   * Sortie de reference. L unite n est pas etablie, voir `devise` : le
   * champ portait « en euros » sur la foi d un commentaire que
   * l archeologie a refute.
   */
  base: number;
  /**
   * Millesime de la donnee. `null` sur les vingt et une entrees, et ce
   * n est pas un oubli de saisie : aucune mesure ne les fonde, donc
   * aucune date ne les qualifie.
   */
  asOf: string | null;
  /**
   * Ce que la valeur est, et non d ou elle vient : tant qu aucune mesure
   * ne la fonde, le champ decrit sa nature plutot que d inventer une
   * provenance.
   */
  source: string;
  /**
   * Devise de la valeur. `'inconnue'` tant que le nombre n est pas
   * rattache a une mesure : un ordre de grandeur pose a la main n est
   * libelle dans aucune monnaie, et lui en attribuer une serait la
   * precision inventee que la doctrine interdit.
   */
  devise: 'EUR' | 'USD' | 'GBP' | 'inconnue';
  /**
   * `low` partout a la reprise, et ce n est pas une precaution de
   * style. Une valeur dont on ne peut pas dire quelle statistique elle
   * est ne peut pas porter mieux, quelle que soit sa plausibilite.
   */
  confidence: 'low' | 'medium' | 'high';
  /** Ce qui reste a etablir sur cette ligne. */
  notes?: string;
}

/**
 * Millesime de la reprise. Sert a distinguer une valeur qui n a jamais
 * ete revisitee d une valeur collectee depuis.
 */
export const EXIT_BENCHMARKS_REPRIS_LE = '2026-08-05';

/**
 * Ce que sont reellement les vingt et une valeurs, etabli par la forme
 * des nombres et non par le commentaire qui les accompagnait.
 */
const NATURE_REELLE = 'estimation d ordre de grandeur posee a la main, non sourcee, sans devise etablie';

const A_ETABLIR = 'valeur reprise telle quelle le 5 aout 2026, a mesurer, dater, sourcer et libeller';

function origine(base: number, notes: string = A_ETABLIR): ExitBenchmark {
  return { base, asOf: null, source: NATURE_REELLE, devise: 'inconnue', confidence: 'low', notes };
}

/**
 * True quand cette entree repose sur une mesure et non sur une
 * estimation posee a la main.
 *
 * Les trois conditions sont conjointes et aucune n est decorative. Une
 * date sans devise ne dit pas ce qu on compare ; une devise sans date ne
 * dit pas de quand ; et une confiance basse dit que celui qui a ecrit la
 * valeur ne la tenait pas lui-meme pour etablie.
 */
export function estMesuree(b: ExitBenchmark): boolean {
  return b.asOf !== null && b.devise !== 'inconnue' && b.confidence !== 'low';
}

/**
 * True quand la sortie de reference d une classe donnee repose sur une
 * estimation.
 *
 * PAR CLASSE ET NON PAR TABLE, ET LA DIFFERENCE COMPTE
 *
 * La premiere version rendait un verdict global : tant qu une seule des
 * vingt et une entrees restait non mesuree, la garde se declarait non
 * fiable sur tous les dossiers. C etait juste au moment ou aucune ne
 * l etait, et faux des la premiere collectee : un dossier SaaS aurait
 * continue de lire une reserve sur une valeur mesuree, au motif que
 * sportstech ne l est pas.
 *
 * Une reserve qui s affiche quand elle ne s applique pas cesse d etre
 * lue, et c est le meme mecanisme que le bruit du validateur d
 * assertions. La declaration suit donc la classe du dossier, et elle
 * disparait d elle-meme classe par classe a mesure que la collecte
 * avance, sans qu aucun drapeau soit a baisser a la main.
 */
export function sortieNonMesuree(assetClass: string): boolean {
  const b = EXIT_BENCHMARKS[assetClass];
  if (!b) return true;
  return !estMesuree(b);
}

/**
 * @deprecated Lire `sortieNonMesuree(classe)`. Une reserve globale
 * s affiche la ou elle ne s applique pas.
 */
export function tableNonFiable(): boolean {
  return Object.values(EXIT_BENCHMARKS).some((x) => !estMesuree(x));
}

/**
 * Sorties de reference par classe d actif normalisee.
 *
 * Les clefs sont celles de SECTOR_BENCHMARKS, et un test verrouille
 * qu aucune des deux tables ne porte une classe que l autre ignore :
 * une classe presente ici et absente la-bas rendrait une sortie sans
 * multiple, et l inverse rendrait un multiple sans sortie, ce qui fait
 * tomber la VC inverse hors domaine sans que rien ne le dise.
 */
export const EXIT_BENCHMARKS: Record<string, ExitBenchmark> = {
  'saas-b2b': origine(80_000_000),
  'fintech': origine(100_000_000),
  'marketplace-b2c': origine(150_000_000),
  'ecommerce-dtc': origine(60_000_000),
  'deeptech': origine(120_000_000),
  'cybersecurity': origine(200_000_000),
  'healthtech': origine(90_000_000),
  'climate-tech': origine(100_000_000),
  'defense': origine(250_000_000),
  'hospitality': origine(70_000_000),
  'ai-generative': origine(250_000_000),
  'adtech': origine(80_000_000),
  'foodtech': origine(70_000_000),
  'proptech': origine(80_000_000),
  'edtech': origine(60_000_000),
  'logistics': origine(90_000_000),
  'services-b2b': origine(50_000_000),
  'industrial-hardware': origine(70_000_000),
  'profitable-mature': origine(120_000_000),
  'mediatech': origine(80_000_000),
  'sportstech': origine(60_000_000),
};

/**
 * Une valeur de sortie et l etat qui dit ce qu elle vaut.
 *
 * LES DEUX VOYAGENT ENSEMBLE, ET C EST TOUT L OBJET DU TYPE
 *
 * La table servira deux natures de nombres le jour ou la collecte
 * aboutira sur une partie des classes : des medianes mesurees et des
 * ordres de grandeur poses a la main. Rien ne les distingue a la
 * lecture, et cinq classes mesurees rendraient les seize autres plus
 * credibles qu elles ne sont, par simple voisinage dans la meme table.
 *
 * Un consommateur ne peut donc pas obtenir le nombre sans obtenir son
 * etat : ils sortent du meme appel, dans le meme objet. C est la forme
 * la plus solide des trois que la discipline des regles ecrites
 * enumere, le point de passage unique, et elle remplace ici un
 * commentaire qui demandait de penser a lire l etat a cote.
 */
export interface SortieDeReference {
  /** La valeur. Sans `mesuree`, elle ne veut rien dire. */
  valeur: number;
  /** True quand elle repose sur une mesure datee, libellee et sourcee. */
  mesuree: boolean;
  /** Le millesime, null tant qu aucune mesure ne la fonde. */
  asOf: string | null;
  /** La devise, `'inconnue'` tant qu il n y a rien a convertir. */
  devise: ExitBenchmark['devise'];
}

/**
 * Lecture d une sortie de reference avec son etat.
 *
 * Rend `null` quand la classe n est pas couverte, ce qui fait sortir la
 * VC inverse du domaine plutot que de lui donner un socle invente.
 */
export function lireSortieDeReference(assetClass: string): SortieDeReference | null {
  const b = EXIT_BENCHMARKS[assetClass];
  if (!b) return null;
  return { valeur: b.base, mesuree: estMesuree(b), asOf: b.asOf, devise: b.devise };
}

/**
 * L entree brute, pour les seuls inventaires et controles.
 *
 * Separee de la lecture de production a dessein : elle porte `base` sans
 * etat accolé, donc elle se prete a l oubli que le type ci-dessus
 * ferme. Un moteur qui l appelle contourne la garde, et le test de
 * perimetre le refuse.
 */
export function lireEntreeBrute(assetClass: string): ExitBenchmark | null {
  return EXIT_BENCHMARKS[assetClass] ?? null;
}

/**
 * Ce que la table sait d elle-meme, pour que le controle et le registre
 * de collecte le lisent sans le recalculer.
 */
export function etatDesSortiesDeReference(): {
  entrees: number;
  mesurees: string[];
  sansDate: number;
  sansDevise: number;
  confianceBasse: number;
  aCollecter: string[];
} {
  const clefs = Object.keys(EXIT_BENCHMARKS);
  return {
    entrees: clefs.length,
    mesurees: clefs.filter((k) => estMesuree(EXIT_BENCHMARKS[k])),
    sansDate: clefs.filter((k) => EXIT_BENCHMARKS[k].asOf === null).length,
    sansDevise: clefs.filter((k) => EXIT_BENCHMARKS[k].devise === 'inconnue').length,
    confianceBasse: clefs.filter((k) => EXIT_BENCHMARKS[k].confidence === 'low').length,
    aCollecter: clefs.filter((k) => !estMesuree(EXIT_BENCHMARKS[k])),
  };
}
