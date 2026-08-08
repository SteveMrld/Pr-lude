// ============================================================
// REGROUPER LES EXECUTIONS EN DOSSIERS
// ------------------------------------------------------------
// La liste montrait des executions la ou l oeil attend des dossiers.
// Releve du 8 aout 2026 : trente et une des cinquante-six lignes nommees
// partagent leur nom avec une autre, In Haircare treize fois, Braincube
// huit, Hello Planet quatre. Avec les dix lignes sans nom, quarante et
// une lignes sur soixante-six n etaient pas identifiees par leur nom de
// societe, et le nom du fichier etait la seule chose qui les distinguait.
// Ce n etait pas un defaut d ecriture du nom, mesure deux fois : c etait
// l unite de la liste.
//
// Huit runs d In Haircare sont un dossier avec huit instructions. Le
// dernier se lit en tete, les precedents se replient dessous, et le repli
// porte ce qui les distingue entre eux plutot que de les repeter.
//
// LE REGROUPEMENT NE DEVINE AUCUN RAPPROCHEMENT. La clef est le nom
// affiche, egalite exacte, et rien d autre. Le corpus porte deux paires
// qui se ressemblent et qui restent separees : `Bemersive` et `Bemersive
// (EVABOX)`, `Compagnie des Alpes - Portefeuille de 6 parcs (Project
// Chamois)` et la meme chaine avec `Projet`. Les rapprocher demanderait
// de decider qu une parenthese ou une lettre ne comptent pas, ce qui est
// une regle qu aucune donnee ne fonde ici. Deux lignes du meme dossier
// separees se voient et se corrigent ; deux dossiers fondus a tort ne se
// voient pas.
//
// Une ligne sans nom etabli reste seule, et sa clef est son identifiant.
// Grouper les sans-nom entre elles reviendrait a affirmer qu elles
// parlent de la meme societe, ce que rien ne dit : les dix du corpus
// portent quatre fichiers sources differents.
// ============================================================

import { nomDUsage, nommerDossier } from './vocabulaire-dossier';

export type LectureRun = {
  id: string;
  companyName: string | null | undefined;
  sourceFilename: string | null | undefined;
  createdAt: string | null | undefined;
  verdict: string | null | undefined;
};

export type DossierGroupe<T> = {
  /** Egalite exacte sur cette clef, jamais de rapprochement approche. */
  clef: string;
  /** Le nom affiche en tete du groupe. */
  nom: string;
  /** Faux quand le nom n a pas pu etre etabli : la ligne reste seule. */
  nomEtabli: boolean;
  /** Du plus recent au plus ancien. */
  runs: T[];
  /**
   * L instruction la plus recente, celle qui se lit en tete.
   *
   * CE N EST PAS L ANALYSE DE REFERENCE DU DOSSIER, ET LA DISTINCTION
   * DOIT SURVIVRE A CE COMMENTAIRE. Mettre la plus recente en tete est
   * une convention d affichage : elle dit qu elle est la derniere, elle
   * ne dit pas qu elle fait foi. Un registre de decisions ne peut pas
   * laisser deviner laquelle compte, et sur les trois dossiers du corpus
   * qui portent plusieurs instructions le verdict differe d une
   * instruction a l autre : la question est donc reelle et elle n est pas
   * repondue ici.
   *
   * Designer une reference demande de decider qui designe, ce qui n a pas
   * de sens tant qu un dossier appartient a une personne et non a une
   * organisation, `organization_id` etant nul sur les soixante-six lignes
   * au 8 aout 2026. La piece appartient au chantier multi-fonds, et le
   * registre porte la question.
   *
   * Le jour ou une reference sera designee, elle sera un champ et non un
   * rang : ce nom-la devra le dire, et celui-ci restera ce qu il est.
   */
  tete: T;
  /** Combien d instructions precedentes se replient dessous. */
  reprises: number;
  /**
   * Vrai quand les runs de ce dossier ne rendent pas tous le meme
   * verdict. C est une information et non un encombrement : un dossier
   * rejoue dont le verdict a bouge est precisement ce qu un partner doit
   * voir sans deplier.
   */
  verdictABouge: boolean;
};

function auPlusRecent(a: string | null | undefined, b: string | null | undefined): number {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  // Une date illisible ne remonte pas en tete par accident : elle passe
  // derriere ce qui se date, plutot que de rendre NaN et de laisser
  // l ordre au hasard du tri.
  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
  if (Number.isNaN(ta)) return 1;
  if (Number.isNaN(tb)) return -1;
  return tb - ta;
}

/**
 * Regroupe des executions en dossiers.
 *
 * L ordre des groupes suit celui de leur tete, donc la liste reste
 * classee du dossier le plus recemment instruit au plus ancien, ce qui
 * est l ordre qu elle avait avant le regroupement.
 *
 * LE TRI PAR DATE EST UNE CONVENTION D AFFICHAGE. Il ne designe aucune
 * instruction comme faisant foi ; voir le champ `tete`. Une convention
 * qu on oublie d avoir choisie devient une regle que personne n a
 * decidee, et le depot en porte deja un exemple avec le stade
 * `in_review` affiche par defaut sur des dossiers ou personne ne l avait
 * pose.
 */
export function regrouperParDossier<T>(
  items: T[],
  lire: (item: T) => LectureRun,
): Array<DossierGroupe<T>> {
  const groupes = new Map<string, DossierGroupe<T>>();

  for (const item of items) {
    const r = lire(item);
    const identite = nommerDossier(r.companyName, r.sourceFilename);
    const nomBrut = String(r.companyName || '').trim();
    const etabli = !identite.provisoire && !!nomBrut;
    // La clef d une ligne sans nom est son identifiant : elle ne peut
    // donc rencontrer aucune autre ligne.
    const clef = etabli ? `nom:${nomDUsage(nomBrut).toLowerCase()}` : `seul:${r.id}`;

    const existant = groupes.get(clef);
    if (existant) {
      existant.runs.push(item);
      continue;
    }
    groupes.set(clef, {
      clef,
      nom: identite.nom,
      nomEtabli: etabli,
      runs: [item],
      tete: item,
      reprises: 0,
      verdictABouge: false,
    });
  }

  const sortie = Array.from(groupes.values());
  for (const g of sortie) {
    g.runs.sort((a, b) => auPlusRecent(lire(a).createdAt, lire(b).createdAt));
    g.tete = g.runs[0];
    g.reprises = g.runs.length - 1;
    const verdicts = new Set(
      g.runs.map(x => String(lire(x).verdict || '').trim().toLowerCase()).filter(Boolean),
    );
    g.verdictABouge = verdicts.size > 1;
  }
  sortie.sort((a, b) => auPlusRecent(lire(a.tete).createdAt, lire(b.tete).createdAt));
  return sortie;
}
