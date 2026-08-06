// ============================================================
// REGROUPEMENT DES ANALYSES D UN MEME DOSSIER
// ------------------------------------------------------------
// Rend, pour une analyse donnee, la liste des analyses qui portent sur
// la meme societe, afin que la trajectoire se lise sur un dossier plutot
// que sur une chaine de versions.
//
// POURQUOI CE MODULE EXISTE
//
// `buildTrajectoryFromAnalyses` declare depuis l origine accepter une
// liste venue d un listAnalyses filtre par societe autant que des
// versions. Seule la seconde source etait cablee, et elle est vide : au
// 6 aout 2026 le corpus porte soixante-cinq analyses et zero version,
// parce que le versionnement automatique a disparu avec la creation de
// ligne a t0 et que le seul chemin restant passe par un dialogue qui ne
// s ouvre qu en cas d echec de persistance. La trajectoire ne pouvait
// donc rien rendre, quel que soit le nombre de runs.
//
// CE SUR QUOI ON REGROUPE, ET CE QUI L EMPECHE DE FUSIONNER DEUX
// DOSSIERS DISTINCTS
//
// La cle est le couple (proprietaire, nom normalise). La normalisation
// est declaree et close : NFKC, espaces de bordure retires, casse
// repliee, espaces internes reduits a un seul. Rien d autre. Pas de
// sous-chaine, pas de distance d edition, pas de retrait de forme
// juridique. Deux lignes se rejoignent si et seulement si leurs noms
// sont la meme chaine a la casse et aux espaces pres, ce qui est un
// predicat decidable et non une ressemblance appreciee.
//
// Trois garanties, et la troisieme est une declaration et non une
// preuve, ce qui doit se dire plutot que se sous-entendre.
//
//   1. Le regroupement ne sort jamais d un proprietaire. Deux fonds ne
//      peuvent pas se melanger, quelle que soit l homonymie.
//
//   2. Une ligne n entre que si elle porte un resultat ET si son nom
//      n est pas celui que le pipeline pose avant que l extraction ait
//      nomme la societe. Ce second refus n est pas une liste ecrite a
//      la main : il lit `LIBELLE_AVANT_EXTRACTION`, la constante meme
//      qu ecrit `createPendingAnalysis`, si bien qu il suit le jour ou
//      elle change. Le corpus rendait le cas sans qu on l ait cherche :
//      dix lignes portent ce libelle et couvrent quatre societes sans
//      rapport, dont deux survivent au seul critere du resultat parce
//      qu un knockout de pre-scan ecrit un resultat sans avoir nomme
//      personne.
//
//   3. Deux societes reellement distinctes portant exactement le meme
//      nom chez le meme fonds se rejoindraient. Rien dans les donnees
//      ne les separe, et fabriquer une garde sur le pays ou le secteur
//      serait pire : ce sont des sorties de modele qui bougent d un
//      tirage a l autre, donc la garde couperait de vrais dossiers plus
//      souvent qu elle n empecherait de fausses fusions. Un palliatif
//      sur un axe qui ne se lit nulle part fabriquerait l autorite
//      qu on cherche a etablir. La sortie est que la chaine declare ce
//      dont elle est faite, identifiant, date, fichier et empreinte de
//      document par membre, pour qu une fusion se voie et se conteste
//      au lieu de se produire en silence.
//
// ET LA QUESTION QUI PASSE AVANT DE LIRE UNE TRAJECTOIRE
//
// N lignes du meme dossier ne font une trajectoire que si elles
// reposent sur plusieurs documents. Sept runs du meme memorandum ne
// racontent pas l evolution d une societe, ils mesurent la dispersion
// du pipeline, et les lire comme une trajectoire ferait passer une
// variance pour une evolution. C est la faute de la variance mesuree
// entre deux commits prise par l autre bout. `assiseDocumentaire` rend
// donc le nombre de documents distincts sous la chaine, et il se lit
// avant les deltas.
//
// L empreinte de document est absente des lignes anterieures a son
// introduction. Elle ne se remplace pas par le nom de fichier, qui n est
// pas une empreinte : deux documents peuvent le partager. Les lignes
// sans empreinte se comptent a part et la fonction ne conclut pas a leur
// place, faute de quoi une assise indeterminee se lirait comme une
// assise mesuree.
// ============================================================

import { LIBELLE_AVANT_EXTRACTION } from './analysis-store';

/**
 * Ligne candidate au regroupement. Volontairement etroite : le
 * regroupement se decide sans charger `result_json`, qui n est lu que
 * pour les membres retenus.
 */
export interface LigneCandidate {
  id: string;
  /** Proprietaire de la ligne. Le regroupement n en sort jamais. */
  userId: string | null;
  companyName: string | null;
  createdAt: string;
  sourceFilename: string | null;
  /** Empreinte du document analyse. Null sur les lignes anterieures. */
  deckHash: string | null;
  /** Vrai si la ligne porte un resultat exploitable. */
  aUnResultat: boolean;
}

export interface AssiseDocumentaire {
  /** Nombre d empreintes de document distinctes sous la chaine. */
  documentsDistincts: number;
  /** Membres sans empreinte : ni comptes, ni supposes identiques. */
  sansEmpreinte: number;
  /**
   * Faux des que la chaine peut ne reposer que sur un seul document.
   * Une chaine dont l assise est indeterminee rend faux : l absence de
   * preuve du contraire n est pas une preuve.
   */
  reposeSurPlusieursDocuments: boolean;
}

/**
 * Normalisation close du nom de societe. NFKC, bordures, casse, espaces
 * internes. Rien d autre, et surtout aucune tolerance : ce qui rend ce
 * regroupement verifiable est qu il se reduit a une egalite de chaines.
 *
 * Rend null quand la ligne ne porte aucun nom exploitable, ce qui
 * couvre le nom vide et le libelle pose avant extraction. Une cle nulle
 * n est jamais egale a une autre cle nulle : deux lignes sans identite
 * ne forment pas un dossier commun, elles n en forment aucun.
 */
export function cleDeDossier(companyName: string | null | undefined): string | null {
  if (typeof companyName !== 'string') return null;
  const normalise = companyName.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (normalise === '') return null;
  const replie = normalise.toLowerCase();
  if (replie === LIBELLE_AVANT_EXTRACTION.toLowerCase()) return null;
  return replie;
}

/**
 * Cle complete, proprietaire compris. Rend null des que le nom ne donne
 * pas de cle : sans identite de societe, il n y a pas de dossier, et le
 * proprietaire seul n en fait pas un.
 */
export function cleComplete(ligne: Pick<LigneCandidate, 'userId' | 'companyName'>): string | null {
  const nom = cleDeDossier(ligne.companyName);
  if (nom === null) return null;
  if (!ligne.userId) return null;
  return `${ligne.userId}::${nom}`;
}

/**
 * Rend les lignes du meme dossier que l ancre, l ancre comprise, triees
 * par date croissante. Rend un tableau vide quand l ancre elle-meme
 * n est pas indexable : une ligne sans identite de societe n appelle
 * aucun voisin, et lui en donner reviendrait a inventer le dossier
 * qu elle ne declare pas.
 *
 * Les lignes sans resultat sont ecartees, y compris l ancre. Le critere
 * porte sur ce que la ligne contient et non sur son statut, dont la
 * liste des valeurs vieillirait.
 */
export function membresDuDossier(
  ancre: LigneCandidate,
  candidates: LigneCandidate[],
): LigneCandidate[] {
  if (!ancre.aUnResultat) return [];
  const cle = cleComplete(ancre);
  if (cle === null) return [];

  const retenues = candidates.filter(
    (c) => c.aUnResultat && cleComplete(c) === cle,
  );
  // L ancre entre meme si l appelant ne l a pas mise dans les
  // candidates, et elle n entre pas deux fois s il l a fait.
  if (!retenues.some((r) => r.id === ancre.id)) retenues.push(ancre);

  return retenues.sort((a, b) => {
    const d = a.createdAt.localeCompare(b.createdAt);
    // Depart departage par identifiant : deux lignes ecrites a la meme
    // milliseconde doivent rendre le meme ordre a chaque lecture, sans
    // quoi deux appels rendraient deux chaines et la comparaison
    // successive changerait de sens sans que rien ait bouge.
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

/**
 * Sur combien de documents distincts la chaine repose. Se lit avant les
 * deltas : une chaine a un seul document ne mesure pas une evolution.
 */
export function assiseDocumentaire(membres: LigneCandidate[]): AssiseDocumentaire {
  const empreintes = new Set<string>();
  let sansEmpreinte = 0;
  for (const m of membres) {
    if (m.deckHash) empreintes.add(m.deckHash);
    else sansEmpreinte++;
  }
  return {
    documentsDistincts: empreintes.size,
    sansEmpreinte,
    // Deux empreintes distinctes etablissent l assise. Une seule
    // empreinte plus des lignes sans empreinte ne l etablit pas : ces
    // lignes portent peut-etre le meme document, et rien ne permet de
    // trancher. Le doute se resout du cote qui retient la conclusion.
    reposeSurPlusieursDocuments: empreintes.size >= 2,
  };
}
