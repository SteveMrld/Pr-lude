// ============================================================
// QUEL SEAU DE COMPARABLES POUR QUEL DOSSIER
// ------------------------------------------------------------
// Deux taxonomies coexistent et ne se parlaient pas. Les comparables se
// filtrent sur sept seaux, la valorisation et la matrice de pertinence
// sur vingt et une classes d actif. Le moteur de comparables ignorait
// la seconde et rejouait sa propre classification par mots-clefs sur la
// prose de l extraction.
//
// CE QUE CA COUTAIT, MESURE
//
// Sur les cinquante et une extractions persistees, quarante et un pour
// cent des dossiers ressortaient `biotech_medtech`, dont quatorze
// dossiers e-commerce, parce que la liste de mots-clefs biotech porte
// « sante », « clinique » et « medecine » et qu un teaser de soins
// capillaires les emploie. Six dossiers SaaS ressortaient
// `deeptech_hardware` sur « industrie » et « production ». Un seul
// dossier sur cinquante et un tombait faute de signal : le probleme
// n etait pas le silence, c etait une classification confiante et
// fausse.
//
// C est le motif du brief 22, la fiche sectorielle inversee : un
// balayage par mots-clefs qui l emporte sur une classification etablie.
// La classe d actif normalisee existe, elle est arbitree par la matrice
// entre l indice sectoriel et la chaine de production detectee, et elle
// a deja tranche. Elle prime donc, et le balayage ne decide plus que ce
// qu elle ne tranche pas.
//
// POURQUOI UNE CORRESPONDANCE ET NON DES SEAUX ELARGIS
//
// Elargir les sept seaux a vingt et un a ete mesure avant d etre
// ecarte. En normalisant les libelles libres des 124 fiches vers les
// classes d actif : sept classes restent vides, defense, hospitality,
// adtech, foodtech, services-b2b, profitable-mature et sportstech, et
// cinq sont tenues par une ou deux fiches, dont healthtech par la seule
// Olive AI, qui est un echec. Douze classes sur vingt et une seraient
// vides ou quasi.
//
// Un comparable unique qui est un echec est pire qu un comparable
// approximatif, parce qu il a l air d etre une reponse. La
// correspondance garde des seaux qui vont de seize a cinquante-six
// fiches, au prix d une grossierete qui se declare au lecteur plutot
// que de se taire.
//
// CE QUE LA CORRESPONDANCE EST
//
// Une liste ecrite a la main, et c est assume. La doctrine du depot
// distingue la liste qui constate, qui se remplace par une propriete
// observable, et la liste qui tranche, qui se garde et se date. Celle-ci
// tranche : dire que climate-tech va chercher ses comparables dans
// deeptech_hardware est un arbitrage doctrinal sur la nature economique
// d une classe, il ne se deduit d aucune propriete des donnees. Chaque
// ligne porte donc sa raison, faute de quoi personne ne pourrait la
// contester.
// ============================================================

import type { ExtractionOutput } from './types';
import type { NonProductionCauseOrNull } from './non-production';
import { detectAssetClass, type ComparablesAssetClass } from '../data/verified-comparables';

/** Date de l arbitrage porte par la table ci-dessous. */
export const CORRESPONDANCE_ARBITREE_LE = '2026-08-05';

export type SeauComparables = Exclude<ComparablesAssetClass, 'all'>;

interface Correspondance {
  seau: SeauComparables;
  /**
   * True quand le seau est celui de la classe elle-meme, false quand
   * la classe emprunte celui d une voisine. L emprunt n est pas un
   * defaut, c est une approximation, et elle doit se dire au lecteur.
   */
  propre: boolean;
  /** Pourquoi ce seau et pas un autre. Sans quoi l arbitrage ne se conteste pas. */
  raison: string;
}

/**
 * Des vingt et une classes d actif vers les sept seaux de comparables.
 *
 * Les clefs sont celles de SECTOR_BENCHMARKS, et un test verrouille
 * qu aucune ne manque : une classe absente d ici retomberait sur le
 * balayage par mots-clefs, c est-a-dire sur le defaut que ce module
 * ferme.
 */
export const CORRESPONDANCE: Record<string, Correspondance> = {
  'saas-b2b': { seau: 'saas', propre: true,
    raison: 'le seau porte son nom, cinquante et une fiches dont Figma, Notion, Datadog, Snowflake' },
  'fintech': { seau: 'fintech', propre: true,
    raison: 'seau propre, seize fiches dont Stripe, Klarna, Nubank' },
  'marketplace-b2c': { seau: 'marketplace', propre: true,
    raison: 'seau propre, quinze fiches dont Airbnb, Uber, DoorDash' },
  'ecommerce-dtc': { seau: 'consumer', propre: true,
    raison: 'la vente directe au consommateur est le seau consumer, qui porte Shopify, Klaviyo, Cazoo' },
  'ai-generative': { seau: 'ai_deeptech', propre: true,
    raison: 'seau propre, quatorze fiches dont OpenAI, Anthropic, Mistral' },
  'healthtech': { seau: 'biotech_medtech', propre: true,
    raison: 'le seau couvre le medical au sens large, et la chaine de valeur du remboursement y est commune' },
  'deeptech': { seau: 'deeptech_hardware', propre: true,
    raison: 'seau propre, cinquante-six fiches, le plus fourni de la base' },
  'industrial-hardware': { seau: 'deeptech_hardware', propre: true,
    raison: 'meme chaine de production physique, meme intensite capitalistique, meme cycle long' },
  'cybersecurity': { seau: 'saas', propre: false,
    raison: 'modele economique de logiciel par abonnement, courbe de retention et multiples ARR communs ; '
      + 'la specificite securite porte sur le risque, pas sur la forme economique' },
  'climate-tech': { seau: 'deeptech_hardware', propre: false,
    raison: 'capex par projet, cycle de deploiement long et actif physique : le profil economique est industriel, '
      + 'meme quand la brique technique est logicielle' },
  'proptech': { seau: 'marketplace', propre: false,
    raison: 'la valeur se cree par mise en relation d une offre et d une demande sur un actif detenu par des tiers ; '
      + 'WeWork, seul comparable proptech de la base, est un contre-exemple et non un repere' },
  'edtech': { seau: 'saas', propre: false,
    raison: 'abonnement recurrent, cout d acquisition et churn qui se lisent comme un SaaS ; '
      + 'la seule fiche edtech de la base est Pluralsight, insuffisante pour tenir un seau' },
  'logistics': { seau: 'marketplace', propre: false,
    raison: 'intermediation entre chargeurs et transporteurs, effets de reseau et prise de marge sur flux tiers' },
  'mediatech': { seau: 'consumer', propre: false,
    raison: 'audience grand public, monetisation par abonnement ou publicite, dynamique de contenu ; '
      + 'Spotify et Quibi y vivent deja' },
  'adtech': { seau: 'saas', propre: false,
    raison: 'vendu a des annonceurs en B2B sur un modele de plateforme, meme structure de revenus recurrents' },
  'foodtech': { seau: 'consumer', propre: false,
    raison: 'produit vendu au consommateur final, contrainte de marge brute et de logistique du frais' },
  'services-b2b': { seau: 'saas', propre: false,
    raison: 'contrats recurrents et vente entreprise ; le seau saas est le moins faux, la difference etant '
      + 'l intensite en main d oeuvre, que les comparables ne portent pas' },
  'sportstech': { seau: 'consumer', propre: false,
    raison: 'audience et engagement grand public, meme mecanique de monetisation que le media' },
  'hospitality': { seau: 'consumer', propre: false,
    raison: 'depense discretionnaire des menages, saisonnalite et sensibilite au cycle ; '
      + 'Airbnb est dans marketplace, mais un operateur de sites n est pas un intermediaire' },
  'profitable-mature': { seau: 'saas', propre: false,
    raison: 'classe derivee du moteur de valorisation et non d un secteur : le seau le plus fourni en '
      + 'trajectoires longues et en sorties documentees est le moins arbitraire' },
  'defense': { seau: 'deeptech_hardware', propre: false,
    raison: 'programme long, client public, integration materielle ; Helsing et Tekever y sont deja classes '
      + 'par leur libelle, la classe defense n a aucune fiche propre' },
};

export interface ChoixDeSeau {
  /** Null quand aucun seau n a pu etre choisi. */
  seau: SeauComparables | null;
  /** Classe d actif arbitree par la matrice, quand elle a tranche. */
  classeArbitree: string | null;
  /** D ou vient la decision. */
  origine: 'classe-arbitree' | 'balayage' | 'aucune';
  /** True quand le seau est emprunte a une classe voisine. */
  emprunte: boolean;
  /** La raison de l arbitrage, pour le lecteur comme pour le prompt. */
  raison: string | null;
  /** Cause de non-production, au sens de la grappe 3. Null si un seau est rendu. */
  cause: NonProductionCauseOrNull;
  motif: string;
}

/**
 * Choisit le seau de comparables d un dossier.
 *
 * La classe arbitree prime. Le balayage par mots-clefs ne decide que ce
 * qu elle ne tranche pas, et quand il ne tranche pas non plus, la
 * fonction rend une non-production declaree avec sa cause plutot qu un
 * seau par defaut.
 *
 * Le remplissage par defaut est precisement ce qui est retire. Avant ce
 * module, une classe non tranchee faisait injecter les cent vingt-quatre
 * fiches de la base, ce qui a l air d une reponse riche et n est qu une
 * absence de choix. Une non-production declaree est moins confortable et
 * plus vraie.
 */
export function choisirSeauComparables(
  extraction: ExtractionOutput | null | undefined,
  classeArbitree: string | null | undefined,
): ChoixDeSeau {
  const classe = typeof classeArbitree === 'string' && classeArbitree.length > 0
    ? classeArbitree
    : null;

  if (classe !== null && classe !== 'unclassified') {
    const c = CORRESPONDANCE[classe];
    if (c) {
      return {
        seau: c.seau,
        classeArbitree: classe,
        origine: 'classe-arbitree',
        emprunte: !c.propre,
        raison: c.raison,
        cause: null,
        motif: c.propre
          ? `classe ${classe}, seau propre`
          : `classe ${classe}, seau ${c.seau} emprunte : ${c.raison}`,
      };
    }
    // Classe hors catalogue : c est une decision doctrinale de ne pas
    // servir de comparables plutot qu une panne.
    return {
      seau: null,
      classeArbitree: classe,
      origine: 'aucune',
      emprunte: false,
      raison: null,
      cause: 'doctrine',
      motif: `la classe ${classe} n est pas au catalogue des vingt et une, aucun seau ne lui correspond`,
    };
  }

  // La matrice n a pas tranche. Le balayage reprend la main, et c est
  // le seul cas ou il decide encore.
  const balaye = extraction ? detectAssetClass(extraction) : 'all';
  if (balaye !== 'all') {
    return {
      seau: balaye,
      classeArbitree: null,
      origine: 'balayage',
      emprunte: false,
      raison: 'la matrice n a pas tranche la classe, le seau vient du balayage lexical de l extraction',
      cause: null,
      motif: `classe non tranchee par la matrice, seau ${balaye} retenu par balayage lexical`,
    };
  }

  return {
    seau: null,
    classeArbitree: null,
    origine: 'aucune',
    emprunte: false,
    raison: null,
    cause: 'absence',
    motif: 'ni la matrice ni le balayage lexical ne tranchent la classe du dossier : '
      + 'aucun comparable n est fourni plutot qu une base entiere injectee faute de choix',
  };
}
