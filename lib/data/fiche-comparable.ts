// ============================================================
// CONTRAT D UNE FICHE DE COMPARABLE
// ------------------------------------------------------------
// Ce que doit porter une fiche pour etre utilisable par les moteurs, et
// ce qui la fait refuser.
//
// LE DEFAUT QUE CE CONTRAT FERME
//
// Les 124 fiches existantes portent leur classe dans un champ de texte
// libre, `sectorAssetClass`, du genre « marketplace B2C / hospitality /
// asset-light » ou « hardware deeptech ». Ce libelle sert a rattacher la
// fiche a un seau, et le rattachement se fait par recherche de
// mots-clefs dans la prose. Le releve du 5 aout 2026 montre ce que ca
// donne quand on demande au normaliseur de ranger ces libelles dans les
// vingt et une classes d actif : Moderna et BioNTech atterrissent en
// `industrial-hardware`.
//
// C est la meme faute que celle qui vient d etre fermee cote dossier, un
// balayage lexical qui decide d une classification. La fermer d un cote
// et la laisser de l autre reviendrait a deplacer le probleme : le
// dossier serait bien classe et le comparable mal range.
//
// La classe est donc un vocabulaire ferme, et elle n est pas devinee.
// Celui qui collecte choisit parmi les vingt et une classes du
// catalogue, et le seau se derive de la correspondance datee. Le libelle
// libre survit en champ facultatif, pour la prose, sans role de
// classement.
//
// OU VIT LA FIABILITE, ET POURQUOI PAS SUR LA FICHE
//
// Sur le jalon, jamais sur la fiche. Une fiche porte deux a quatre
// jalons dont les sources n ont pas la meme force : une Series A connue
// par un article de presse et une IPO lue dans un S-1 depose ne se
// citent pas avec la meme assurance. Une marque unique pour la fiche
// entiere serait trop genereuse pour l un et trop severe pour l autre,
// et elle empecherait le moteur de choisir quoi citer.
//
// C est la troisieme occurrence de la meme regle. La capture des sources
// a etabli qu une lecture exterieure porte l adresse, la date et
// l extrait, faute de quoi le tag n est qu un souvenir. Le verbatim des
// nombres a etabli qu une valeur extraite porte le chiffre tel que le
// document l ecrit, faute de quoi elle est une affirmation sur un
// document. Ici, un jalon porte sa marque de fiabilite et sa source,
// faute de quoi il n est pas citable avec un chiffre. La marque voyage
// avec le chiffre, elle ne reste pas a l entree du dossier.
//
// CE QUE CHAQUE NIVEAU AUTORISE
//
// Le niveau ne decrit pas une opinion sur la qualite, il decrit ce que
// le moteur a le droit d en faire. C est ce qui le rend verifiable
// plutot qu appreciatif.
// ============================================================

import type { ComparableOutcome, ComparableStade } from './verified-comparables';
import { SECTOR_BENCHMARKS } from './sector-benchmarks';

/**
 * Force d une source, du plus fort au plus faible.
 *
 *   officiel     document depose ou emis par la societe elle-meme ou
 *                par une autorite : S-1, 8-K, comptes deposes, communique
 *                officiel, decision d autorite de concurrence.
 *   presse       article d un media identifie et date. Nommer le media,
 *                pas « la presse ».
 *   base-agregee Crunchbase, PitchBook, Dealroom et equivalents. Fiables
 *                sur l existence d un tour, souvent faux sur son montant
 *                exact et sur les tours d amorcage.
 *   declaratif   la societe le dit d elle-meme sans document opposable :
 *                interview, page « about », deck. Utile pour la
 *                narration, sans valeur probante sur un chiffre.
 */
export type Fiabilite = 'officiel' | 'presse' | 'base-agregee' | 'declaratif';

/**
 * Ce que chaque niveau autorise le moteur a faire du jalon.
 *
 * Table exposee plutot que laissee au prompt : c est elle qui rend la
 * regle verifiable par un test, et non une consigne dont on espererait
 * qu elle soit suivie.
 */
export const AUTORISE_PAR_FIABILITE: Record<Fiabilite, {
  /** Le chiffre peut etre cite dans la prose de la note. */
  chiffreCitable: boolean;
  /**
   * Le chiffre peut entrer dans le calcul d une fourchette de
   * valorisation.
   *
   * La distinction avec `chiffreCitable` est le coeur de l echelle et
   * elle n est pas de degre mais de nature. Citer un chiffre engage la
   * note sur une affirmation que le lecteur peut aller verifier ; le
   * faire entrer dans un calcul engage un prix, qui se propage au
   * verdict et que plus personne ne rattache a sa source. Une base
   * agregee se trompe couramment sur le montant d un tour d amorcage
   * tout en ayant raison sur son existence : elle peut donc etayer un
   * recit et pas fonder une fourchette.
   */
  alimenteUneFourchette: boolean;
  mention: string | null;
}> = {
  officiel: { chiffreCitable: true, alimenteUneFourchette: true, mention: null },
  presse: {
    chiffreCitable: true,
    alimenteUneFourchette: true,
    mention: 'source de presse, a nommer dans la citation',
  },
  'base-agregee': {
    chiffreCitable: true,
    alimenteUneFourchette: false,
    mention: 'base agregee, fiable sur l existence du tour et incertaine sur son montant : '
      + 'citable dans la prose avec la reserve, jamais dans le calcul d une fourchette',
  },
  declaratif: {
    chiffreCitable: false,
    alimenteUneFourchette: false,
    mention: 'declaratif de la societe, sans document opposable : citable en prose sans chiffre, '
      + 'jamais dans le calcul d une fourchette',
  },
};

/**
 * Un jalon de trajectoire, avec ce qui permet de le verifier.
 *
 * Le montant porte son verbatim pour la meme raison que les nombres
 * extraits d un document : « 7M$ » et « 7 000 000 » ne se relisent pas
 * pareil, et la valeur normalisee doit descendre de ce que la source
 * ecrit et jamais l inverse.
 */
export interface JalonComparable {
  /** Annee du jalon. */
  annee: number;
  /** Ce qui s est passe, en une phrase citable telle quelle. */
  libelle: string;
  /** Le montant tel que la source l ecrit. Absent quand le jalon n en porte pas. */
  montantVerbatim?: string;
  /** Devise, quand un montant est present. */
  devise?: 'EUR' | 'USD' | 'GBP';
  /** Force de la source. Obligatoire : un jalon sans marque n est pas citable. */
  fiabilite: Fiabilite;
  /**
   * De quoi refaire le chemin : URL, reference de document depose, ou
   * nom du media avec sa date. Obligatoire, et une chaine vide ne compte
   * pas.
   */
  source: string;
}

/**
 * Une fiche de comparable.
 *
 * Les champs obligatoires sont ceux sans lesquels le moteur ne peut ni
 * ranger la fiche ni la citer sans risque. Les facultatifs enrichissent
 * la prose sans porter de decision.
 */
export interface FicheComparable {
  // ---------- Obligatoire ----------
  /** Nom exact, tel que la societe s ecrit elle-meme. */
  name: string;
  /** Annee de fondation. */
  founded: number;
  /**
   * Classe d actif, parmi les vingt et une du catalogue. Vocabulaire
   * ferme : c est ce qui remplace le texte libre et ce qui rattache la
   * fiche a un seau par la correspondance datee.
   */
  assetClass: string;
  /** Stade structurel, pour la clause de cadrage cross-echelle. */
  stade: ComparableStade;
  /** Issue verifiee, qui decide du registre dans lequel citer la fiche. */
  outcome: ComparableOutcome;
  /**
   * Pays du siege, en clair. Obligatoire parce qu une trajectoire
   * americaine et une trajectoire europeenne ne se comparent pas, et que
   * le produit est vendu a des fonds europeens.
   */
  pays: string;
  /** Deux a quatre jalons, chacun avec sa source et sa marque. */
  jalons: JalonComparable[];
  /** Etat aujourd hui, en clair : cote avec son ticker, prive, acquis par qui et quand, disparu et quand. */
  statut: string;
  /**
   * Pieges d hallucination connus sur cette societe. « Ne pas confondre
   * X avec Y », « n a jamais fait de series C », « la valorisation de
   * 2021 a ete divisee par quatre ». C est le champ qui evite au moteur
   * de repeter une erreur repandue, et il vaut souvent plus que les
   * jalons.
   */
  pieges: string;

  // ---------- Facultatif ----------
  /** Fondateurs, pour la prose. */
  founders?: string;
  /** Sous-secteur en clair. Aucune valeur de classement. */
  sousSecteur?: string;
  /**
   * Modele economique en une ligne. C est l ancien `sectorAssetClass`,
   * conserve pour la prose et prive de son role de classement.
   */
  modeleEconomique?: string;
}

export interface RefusDeFiche {
  champ: string;
  motif: string;
}

/** Les vingt et une classes du catalogue, lues et non recopiees. */
export function classesAdmises(): string[] {
  return Object.keys(SECTOR_BENCHMARKS);
}

const STADES: ComparableStade[] = ['startup', 'scaleup', 'mature'];
const OUTCOMES: ComparableOutcome[] = ['success', 'failure', 'ongoing', 'contested'];
const FIABILITES: Fiabilite[] = ['officiel', 'presse', 'base-agregee', 'declaratif'];

function vide(v: unknown): boolean {
  return typeof v !== 'string' || v.trim().length === 0;
}

/**
 * Verifie une fiche et rend la liste de ce qui la fait refuser.
 *
 * Rend un tableau vide quand la fiche est recevable. Ne corrige rien :
 * une fiche incomplete se renvoie a celui qui l a ecrite, elle ne se
 * complete pas par defaut, sans quoi le defaut deviendrait la donnee.
 */
export function verifierFiche(f: Partial<FicheComparable> | null | undefined): RefusDeFiche[] {
  const refus: RefusDeFiche[] = [];
  if (!f || typeof f !== 'object') return [{ champ: '(fiche)', motif: 'fiche absente ou illisible' }];

  if (vide(f.name)) refus.push({ champ: 'name', motif: 'nom obligatoire' });
  if (typeof f.founded !== 'number' || !Number.isInteger(f.founded) || f.founded < 1800 || f.founded > 2100) {
    refus.push({ champ: 'founded', motif: 'annee de fondation obligatoire, entiere et plausible' });
  }
  if (vide(f.assetClass) || !classesAdmises().includes(String(f.assetClass))) {
    refus.push({
      champ: 'assetClass',
      motif: `classe obligatoire et prise dans le vocabulaire ferme : ${classesAdmises().join(', ')}`,
    });
  }
  if (!f.stade || !STADES.includes(f.stade)) {
    refus.push({ champ: 'stade', motif: `stade obligatoire parmi ${STADES.join(', ')}` });
  }
  if (!f.outcome || !OUTCOMES.includes(f.outcome)) {
    refus.push({ champ: 'outcome', motif: `issue obligatoire parmi ${OUTCOMES.join(', ')}` });
  }
  if (vide(f.pays)) refus.push({ champ: 'pays', motif: 'pays du siege obligatoire' });
  if (vide(f.statut)) refus.push({ champ: 'statut', motif: 'etat actuel obligatoire' });
  if (vide(f.pieges)) {
    refus.push({ champ: 'pieges', motif: 'pieges d hallucination obligatoires : une fiche sans piege connu se dit « aucun piege connu a ce jour »' });
  }

  const jalons = Array.isArray(f.jalons) ? f.jalons : [];
  if (jalons.length < 2 || jalons.length > 6) {
    refus.push({ champ: 'jalons', motif: `deux a six jalons attendus, ${jalons.length} fourni(s)` });
  }
  jalons.forEach((j: any, i) => {
    const ou = `jalons[${i}]`;
    if (!j || typeof j !== 'object') {
      refus.push({ champ: ou, motif: 'jalon absent ou illisible' });
      return;
    }
    if (typeof j?.annee !== 'number') refus.push({ champ: `${ou}.annee`, motif: 'annee obligatoire' });
    if (vide(j?.libelle)) refus.push({ champ: `${ou}.libelle`, motif: 'libelle obligatoire' });
    if (!j?.fiabilite || !FIABILITES.includes(j.fiabilite)) {
      refus.push({ champ: `${ou}.fiabilite`, motif: `marque obligatoire parmi ${FIABILITES.join(', ')}` });
    }
    if (vide(j?.source)) {
      refus.push({ champ: `${ou}.source`, motif: 'source obligatoire : de quoi refaire le chemin, URL, document depose ou media date' });
    }
    // La regle qui donne sa valeur a la base. Un chiffre porte par un
    // jalon declaratif n est pas citable, donc l ecrire reviendrait a
    // fabriquer une autorite que la source ne donne pas.
    if (j?.montantVerbatim && j?.fiabilite === 'declaratif') {
      refus.push({
        champ: `${ou}.montantVerbatim`,
        motif: 'un jalon declaratif ne porte pas de montant : la societe l affirme sans document opposable, '
          + 'donc le chiffre n est pas citable et ne doit pas entrer dans la base',
      });
    }
    if (j?.montantVerbatim && !j?.devise) {
      refus.push({ champ: `${ou}.devise`, motif: 'un montant sans devise n est pas un montant' });
    }
  });

  return refus;
}

/**
 * Verifie la composition d un seau, au-dela de chaque fiche prise seule.
 *
 * Un seau qui ne porte que des reussites est un seau qui ment par
 * selection : la trajectoire mediane d une classe d actif comporte des
 * echecs, et une base qui les tait apprend au moteur qu ils n existent
 * pas. Une fiche `failure` ou `contested` par tranche de quatre est le
 * plancher retenu, et il est arbitre plutot que mesure, donc il se date.
 */
export const PLANCHER_CONTRE_EXEMPLES_LE = '2026-08-05';

export function verifierComposition(fiches: FicheComparable[] | null | undefined): RefusDeFiche[] {
  if (!Array.isArray(fiches) || fiches.length === 0) return [];
  const contreExemples = fiches.filter((f) => f.outcome === 'failure' || f.outcome === 'contested').length;
  const attendu = Math.floor(fiches.length / 4);
  if (contreExemples < attendu) {
    return [{
      champ: '(composition)',
      motif: `${fiches.length} fiches pour ${contreExemples} contre-exemple(s), ${attendu} attendu(s) : `
        + 'un seau qui ne porte que des reussites apprend au moteur que les echecs n existent pas',
    }];
  }
  return [];
}
