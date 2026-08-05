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
// Ce module ne change aucune valeur. Il les sort du moteur, les date,
// les source et declare leur confiance, pour que la collecte qui suivra
// soit possible et pour que ce qui manque se voie. Un chiffre qu on
// deplace sans le corriger reste faux ; ce qui change est qu il est
// desormais faux a un endroit ou on le regarde.
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
// Aucune source primaire. Le commentaire d origine disait « Crunchbase
// exits 2020-2025, Atomico exits Europe », ce qui nomme deux corpus
// sans dire quelle statistique en a ete tiree, sur quel perimetre, ni a
// quelle date. C est une provenance declaree et non une source
// verifiable, au sens ou la doctrine de la capture l entend : personne
// ne peut refaire le chemin. Toutes les entrees sont donc en confiance
// basse, sans exception, y compris celles qui paraissent plausibles.
//
// Aucune geographie. Une sortie mediane europeenne et une sortie
// mediane americaine different d un facteur que ces nombres ignorent,
// sur un produit vendu a des fonds europeens.
// ============================================================

/** Ce qu on sait de la provenance d une valeur de sortie. */
export interface ExitBenchmark {
  /** Sortie de reference, en euros. */
  base: number;
  /**
   * Millesime de la donnee. `null` quand il n est pas etabli, ce qui
   * est le cas de toutes les entrees a la reprise du 5 aout 2026 : le
   * commentaire d origine citait une fenetre 2020-2025 sans dire de
   * quand datait la statistique retenue.
   */
  asOf: string | null;
  /**
   * Provenance telle qu on peut l ecrire aujourd hui. Ce n est pas une
   * source au sens de la doctrine de capture tant qu elle ne permet pas
   * de refaire le chemin.
   */
  source: string;
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
 * Provenance commune aux vingt et une entrees d origine, recopiee du
 * commentaire qui les accompagnait et non reformulee : c est tout ce
 * qui existe, et le dire ainsi est plus honnete que de le presenter
 * comme une reference.
 */
const PROVENANCE_ORIGINE = 'declaree a l origine « Crunchbase exits 2020-2025, Atomico exits Europe », '
  + 'sans statistique nommee ni perimetre ni date : provenance et non source verifiable';

const A_ETABLIR = 'valeur reprise telle quelle le 5 aout 2026, a dater et sourcer';

function origine(base: number, notes: string = A_ETABLIR): ExitBenchmark {
  return { base, asOf: null, source: PROVENANCE_ORIGINE, confidence: 'low', notes };
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
 * Lecture d une sortie de reference. Rend `null` quand la classe n est
 * pas couverte, ce qui fait sortir la VC inverse du domaine plutot que
 * de lui donner un socle invente.
 */
export function lireSortieDeReference(assetClass: string): ExitBenchmark | null {
  return EXIT_BENCHMARKS[assetClass] ?? null;
}

/**
 * Ce que la table sait d elle-meme, pour que le controle et le registre
 * de collecte le lisent sans le recalculer.
 */
export function etatDesSortiesDeReference(): {
  entrees: number;
  sansDate: number;
  confianceBasse: number;
  aCollecter: string[];
} {
  const clefs = Object.keys(EXIT_BENCHMARKS);
  return {
    entrees: clefs.length,
    sansDate: clefs.filter((k) => EXIT_BENCHMARKS[k].asOf === null).length,
    confianceBasse: clefs.filter((k) => EXIT_BENCHMARKS[k].confidence === 'low').length,
    aCollecter: clefs.filter((k) => EXIT_BENCHMARKS[k].asOf === null || EXIT_BENCHMARKS[k].confidence === 'low'),
  };
}
