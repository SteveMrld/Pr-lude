// ============================================================
// ENTREES DECLAREES DES MOTEURS
// ------------------------------------------------------------
// Ce qu un moteur exige pour avoir quelque chose a instruire, declare
// comme une donnee. C est le pendant du graphe de dependances
// deterministe : celui-la dit ce qu un moteur lit pour calculer,
// celui-ci dit ce sans quoi il n a rien a dire.
//
// LE DEFAUT QU IL FERME
//
// Un contrat minimal non satisfait sort aujourd hui en `failed`, ce qui
// annonce au lecteur que le dispositif est tombe. Deux cas vivent sous
// ce seul mot. L entree necessaire n etait pas dans le dossier et le
// moteur n avait rien a instruire : c est une absence, elle se declare,
// elle ne fait pas echouer le moteur. Ou l entree etait la et le moteur
// n a pas produit ce qu il devait : c est un incident, et il doit se
// voir.
//
// C est la conflation de la grappe 3 deplacee d un cran, du statut vers
// le contrat. Elle compte, parce que chez un fonds le cas courant est
// le deck pauvre : un produit qui se declare en panne sur un dossier
// simplement incomplet perd sa credibilite sur les dossiers ou il a
// raison.
//
// CE QUE LA DECLARATION PERMET
//
// Un echec de contrat se qualifie automatiquement. Si une entree
// declaree manquait, la cause est `absence` et le moteur rend une
// sortie qui se declare plutot que d echouer. Sinon la cause est
// `incident`.
//
// LE COURT-CIRCUIT DE financialCoherence EN EST LE MODELE
//
// Ce moteur teste deja `!hasBP && pas de projection de revenus` et rend
// une sortie structuree sans appeler le modele. Il ne devient pas une
// exception a maintenir : sa condition EST sa declaration d entrees,
// recopiee ici sous forme de donnee. Le court-circuit reste ecrit dans
// le moteur parce qu il fait plus que qualifier, il construit une
// sortie propre a ce moteur, ce qu aucune regle generale ne saura
// faire. La regle generale qualifie, le moteur repond.
//
// CE QUI VERROUILLE LA DECLARATION
//
// Un test de mutation : retirer une entree declaree doit rendre le
// moteur incapable de produire. Il ne s applique qu aux moteurs dont la
// disponibilite se lit sans appeler le modele, ce qui est le cas de
// tous ceux declares ici. Ce que le test n exerce pas est imprime et
// non tu.
// ============================================================

import type { NonProductionCause } from './non-production';

/**
 * Entrees d un moteur. `disponible` rend faux quand le dossier ne porte
 * pas de quoi instruire, et le libelle dit au lecteur ce qui manquait.
 */
export interface EntreesMoteur {
  /** Ce que la note dira si l entree manque. */
  libelle: string;
  /** Chemins lus, pour le lecteur et pour le test de mutation. */
  lit: string[];
  /** Vrai quand le dossier porte de quoi instruire. */
  disponible: (ctx: Record<string, any>) => boolean;
}

function nonVide(v: any): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

/**
 * Declaration par moteur. Volontairement partielle : n y figurent que
 * les moteurs dont on a etabli l exigence par lecture. Un moteur absent
 * de cette table n est pas repute sans entrees, il est repute non
 * instruit, et sa qualification reste `incident` par defaut, qui est le
 * comportement d avant.
 */
export const ENTREES_MOTEURS: Record<string, EntreesMoteur> = {
  financialCoherence: {
    libelle: 'aucune donnee financiere exploitable, ni business plan ni projection de revenus',
    lit: ['financialData.hasBP', 'financialData.revenueProjection'],
    // Recopie de la condition du court-circuit de
    // financial-coherence-engine.ts, dont c est la declaration.
    disponible: (c) => c.financialData?.hasBP === true
      || nonVide(c.financialData?.revenueProjection),
  },
  saasMetrics: {
    libelle: 'aucune metrique de recurrence dans le dossier',
    lit: ['extraction.traction', 'financialData.revenueProjection'],
    disponible: (c) => nonVide(c.extraction?.traction) || nonVide(c.financialData?.revenueProjection),
  },
  industrialMetrics: {
    libelle: 'aucune donnee industrielle dans le dossier',
    lit: ['extraction.traction', 'financialData'],
    disponible: (c) => nonVide(c.extraction?.traction) || nonVide(c.financialData),
  },
  referenceChecks: {
    libelle: 'aucun fondateur nomme, donc personne a recouper',
    lit: ['extraction.team'],
    disponible: (c) => nonVide(c.extraction?.team),
  },
  capTableExtraction: {
    libelle: 'aucune table de capitalisation fournie',
    lit: ['capTableDoc'],
    disponible: (c) => nonVide(c.capTableDoc),
  },
  finalRecommendation: {
    // L orchestrateur arbitre entre les moteurs d analyse. Sans aucun
    // d eux il n a rien a arbitrer, et son echec est une absence. Avec
    // au moins un, il devait produire un verdict : c est un incident.
    //
    // Le seuil est a un et non a tous : l orchestrateur est ecrit pour
    // conclure sur ce dont il dispose, et exiger les trois reviendrait
    // a declarer absente une instruction partielle qu il sait mener.
    libelle: 'aucun moteur d analyse n a produit de sortie a arbitrer',
    lit: ['team', 'market', 'macro', 'contrarianAnalysis', 'blindspotAnalysis'],
    disponible: (c) => nonVide(c.team) || nonVide(c.market) || nonVide(c.macro)
      || nonVide(c.contrarianAnalysis) || nonVide(c.blindspotAnalysis),
  },
  ddContractual: {
    libelle: 'aucun contrat ni statut fourni',
    lit: ['clientContracts', 'statutes', 'shareholdersAgreement'],
    disponible: (c) => nonVide(c.clientContracts) || nonVide(c.statutes) || nonVide(c.shareholdersAgreement),
  },
};

export interface QualificationEchec {
  cause: NonProductionCause;
  motif: string;
  entreeManquante: boolean;
}

/**
 * Qualifie un echec de contrat. Le pipeline sait desormais dire si
 * l entree necessaire etait la, donc il n a plus a appeler echec ce qui
 * est une absence.
 *
 * Un moteur non declare rend `incident`, qui est le comportement
 * anterieur : la table ne durcit rien retroactivement, elle qualifie ce
 * qu elle connait.
 */
export function qualifierEchecContrat(
  moteur: string,
  contexte: Record<string, any>,
): QualificationEchec {
  const decl = ENTREES_MOTEURS[moteur];
  if (!decl) {
    return {
      cause: 'incident',
      motif: `Le moteur ${moteur} n a pas produit une sortie conforme a son contrat, et ses entrees necessaires ne sont pas declarees : l echec ne peut pas etre qualifie plus finement.`,
      entreeManquante: false,
    };
  }
  if (!decl.disponible(contexte)) {
    return {
      cause: 'absence',
      motif: `Non instruit : ${decl.libelle}. Le moteur n a pas echoue, le dossier ne portait pas de quoi l alimenter.`,
      entreeManquante: true,
    };
  }
  return {
    cause: 'incident',
    motif: `Les entrees necessaires etaient disponibles et la sortie ne satisfait pas le contrat minimal. Il y a a reparer.`,
    entreeManquante: false,
  };
}

/** Moteurs dont les entrees sont declarees. Lu par le test de mutation. */
export function moteursDeclares(): string[] {
  return Object.keys(ENTREES_MOTEURS).sort();
}
