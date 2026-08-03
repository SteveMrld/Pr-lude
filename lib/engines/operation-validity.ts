// ============================================================
// VALIDITE DE L OPERATION INSTRUITE
// ------------------------------------------------------------
// La relecture de la note Braincube du 3 aout 2026 a releve le defaut
// le plus grave de la serie. Le moteur Equipe avait trouve une levee de
// 83 millions d euros annoncee en novembre 2023, la note la lisait
// comme un signal de traction favorable, et le memorandum instruit
// proposait un cash-in de 10 a 15 millions avec sortie de deux
// investisseurs. Si la levee a eu lieu, l operation decrite n existe
// probablement plus. La note avait l information et n en tirait rien.
//
// Le principe qui en sort depasse le cas : un evenement posterieur a la
// date du document et qui contredit l operation decrite doit etre
// souleve, jamais absorbe comme un signal favorable.
//
// TROIS ARBITRAGES, poses avant l ecriture.
//
// 1. La peremption de la base et celle de l operation sont deux choses.
//    La premiere est une question de prix, traitee par la garde de
//    millesime : les multiples sont recents, le chiffre d affaires ne
//    l est pas. La seconde est une question d objet : si l operation
//    n existe plus, la fourchette n est pas trop vieille, elle est sans
//    emploi. Ce module ne vit donc pas dans le moteur de valorisation.
//
// 2. Le moteur Equipe produit l evenement date, il ne l interprete pas.
//    Lui faire conclure sur la validite de l operation reviendrait a
//    lui faire trancher une question qui n est pas la sienne, ce qui
//    est exactement la faute de sector_fit au pre-scan : un jugement
//    demande la ou une comparaison suffit. Ce module ne vit donc pas
//    non plus dans le moteur Equipe.
//
// 3. La regle est asymetrique par type d operation. Sur une levee, un
//    evenement de financement posterieur peut simplement signifier que
//    le tour s est fait. Sur une cession ou un LBO, il signifie que le
//    vendeur a peut-etre trouve preneur ailleurs. La portee n est pas
//    la meme, la consequence non plus.
//
// Le module est deterministe et n appelle jamais le modele.
// ============================================================

import type { NonProductionCauseOrNull } from './non-production';
import type { OperationType } from './types';

/** Nature d un evenement externe date. */
export type EvenementNature =
  | 'financement'
  | 'changement-de-controle'
  | 'dirigeant'
  | 'procedure-collective'
  | 'indetermine';

/**
 * Evenement externe date, tel que le module le consomme.
 *
 * PROVISOIRE cote production : aujourd hui ces evenements sont
 * reconstitues par lecture de la prose du moteur Equipe, faute d exister
 * comme donnee. Cette interface EST la sortie que le moteur Equipe doit
 * produire, et la grappe « evenement externe structure » a pour objet de
 * l y installer. Voir docs/diagnostics/prelude-grappe-evenements.md.
 */
export interface EvenementDate {
  intitule: string;
  annee: number;
  /** 1 a 12 quand le document ou la source le donne, null sinon. */
  mois: number | null;
  nature: EvenementNature;
  /** Source telle que la prose la tague, ou null. */
  source: string | null;
  /**
   * True quand l evenement vient de la detection provisoire sur prose
   * et non d une donnee structuree. La cause du verdict le declare, de
   * sorte qu un lecteur du code comme un lecteur de la note sachent sur
   * quoi la reserve repose.
   */
  luDansLaProse: boolean;
}

/** Ancre temporelle retenue, et par quel chemin. */
export interface AncreOperation {
  annee: number;
  /**
   * Mois a partir duquel un evenement est tenu pour posterieur, 1 a 12.
   * La comparaison se fait au mois et non a l annee : le cas qui a
   * ouvert ce module est une levee de novembre 2023 contre une ancre
   * reconstituee a 2023, que la comparaison a l annee ratait d un an.
   */
  mois: number;
  origine: 'date-du-document' | 'millesime-plus-deux';
  declaration: string;
}

export type VerdictValidite = 'aucune-reserve' | 'a-verifier' | 'non-applicable';

export interface OperationValidityOutput {
  verdict: VerdictValidite;
  /** Null quand le verdict est rendu. Renseigne sinon, au sens de la grappe 3. */
  cause: NonProductionCauseOrNull;
  ancre: AncreOperation | null;
  operationType: OperationType | null;
  /** Evenements retenus comme posterieurs a l ancre. */
  evenementsPosterieurs: EvenementDate[];
  /** True si la reserve repose, meme partiellement, sur de la prose. */
  reposeSurDeLaProse: boolean;
  /**
   * Nature de la lecture qui fonde la reserve. C est la cause au sens
   * ou la grappe 3 l entend, appliquee non pas a une non-production
   * mais a une production : le lecteur doit savoir si la reserve
   * s appuie sur une donnee ou sur une phrase.
   *
   * `prose-provisoire` est un etat de transition, pas un mode de
   * fonctionnement. Il disparait quand le moteur Equipe produit
   * EvenementDate au lieu de le decrire.
   */
  natureDeLaLecture: 'donnee-structuree' | 'prose-provisoire' | 'sans-objet';
  /**
   * True quand la reserve interdit de discuter un prix. Reserve aux
   * operations ou l evenement peut signifier que l operation n existe
   * plus, c est-a-dire les cessions et les LBO.
   */
  interditLaDiscussionDePrix: boolean;
  /** Phrase destinee au lecteur. Null quand il n y a rien a dire. */
  mention: string | null;
  /** Motif du verdict, destine au lecteur du code et de la note. */
  motif: string;
}

/** Types d operation ou un evenement posterieur peut tuer l operation. */
const TYPES_DE_SORTIE: ReadonlySet<string> = new Set([
  'cession-partielle', 'cession-totale', 'lbo',
]);

/**
 * Ecart en annees a partir duquel un evenement est tenu pour posterieur
 * au document quand la date de redaction n est pas connue. Le millesime
 * de reference donne un plancher, un document qui qualifie 2021 de
 * realise n est pas anterieur a 2022 ; deux ans absorbent l incertitude
 * qui reste entre le dernier exercice et la redaction.
 */
export const MARGE_MILLESIME_ANNEES = 2;

export interface OperationValidityInput {
  operationType: OperationType | null | undefined;
  /**
   * Composantes de l operation. Quand elles existent, la reserve porte
   * sur la composante que l evenement met en cause et non sur
   * l operation entiere : une levee posterieure conteste le cash-in,
   * elle ne dit rien de la sortie des fonds ; un changement de controle
   * conteste la cession.
   */
  operationComponents?: Array<{ kind: string; evidence: string; perimetre?: string | null }> | null;
  /** Date de redaction, format YYYY, YYYY-MM ou YYYY-MM-DD. */
  documentDate: string | null | undefined;
  /** Millesime de reference du moteur de valorisation, repli d ancre. */
  millesimeReference: number | null | undefined;
  evenements: EvenementDate[];
}

/**
 * Rend le verdict de validite de l operation. Deterministe : deux
 * appels sur les memes entrees rendent exactement la meme sortie.
 */
export function evaluerValiditeOperation(input: OperationValidityInput): OperationValidityOutput {
  const type = (input.operationType ?? null) as OperationType | null;

  // Sans type etabli, la regle asymetrique n a pas de branche a
  // choisir. On ne rend pas un verdict par defaut : on declare que la
  // question n a pas ete instruite, avec sa cause.
  if (!type || type === 'non-etabli') {
    return sansVerdict(
      'absence',
      'Le type d operation n est pas etabli par le document. La portee d un evenement posterieur en depend entierement, une levee et une cession ne se lisant pas de la meme facon, donc la validite de l operation n est pas instruite.',
      type,
    );
  }

  const ancre = resoudreAncre(input.documentDate, input.millesimeReference);
  if (!ancre) {
    return sansVerdict(
      'absence',
      'Ni la date de redaction du document ni un millesime de reference ne sont etablis. Aucune ancre temporelle ne permet de dire qu un evenement est posterieur au document.',
      type,
    );
  }

  const posterieurs = input.evenements
    .filter((e) => estPosterieur(e, ancre))
    .sort((a, b) => (b.annee - a.annee) || ((b.mois ?? 0) - (a.mois ?? 0)));

  if (posterieurs.length === 0) {
    return {
      verdict: 'aucune-reserve',
      cause: null,
      ancre,
      operationType: type,
      evenementsPosterieurs: [],
      reposeSurDeLaProse: false,
      natureDeLaLecture: input.evenements.some((e) => e.luDansLaProse) ? 'prose-provisoire' : 'donnee-structuree',
      interditLaDiscussionDePrix: false,
      mention: null,
      motif: `Aucun evenement externe posterieur a l ancre retenue (${ancre.annee}). ${ancre.declaration}`,
    };
  }

  const prose = posterieurs.some((e) => e.luDansLaProse);
  const financiers = posterieurs.filter((e) => e.nature === 'financement');

  // Quelle composante l evenement met-il en cause. Un evenement de
  // financement conteste le cash-in, un changement de controle conteste
  // la cession, une procedure collective conteste tout. La reserve
  // porte sur elle et la mention la nomme, plutot que d etre globale ou
  // absente.
  const comps = input.operationComponents ?? null;
  const principalPourCause = financiers[0] ?? posterieurs[0];
  const porteComposante = (k: string) => comps ? comps.some((c) => c.kind === k) : null;
  // Un evenement de financement conteste le cash-in quand il en existe
  // un. Quand il n en existe pas, il conteste l operation elle-meme :
  // sur une cession pure, une levee posterieure signifie que le vendeur
  // a trouve son financement ailleurs.
  const composanteVisee = principalPourCause.nature === 'procedure-collective' ? 'toutes'
    : principalPourCause.nature === 'changement-de-controle' ? 'cession'
    : porteComposante('cash-in') === false ? 'cession'
    : 'cash-in';

  // Le prix ne se refuse que si la composante mise en cause est celle
  // qui porte le prix, c est-a-dire la cession. Sur une operation mixte
  // qu une levee posterieure conteste, les cedants peuvent encore
  // vendre : la reserve se leve, le prix reste discutable.
  const sortie = comps
    ? (composanteVisee === 'toutes'
        ? porteComposante('cession') === true
        : composanteVisee === 'cession' && porteComposante('cession') === true)
    : TYPES_DE_SORTIE.has(type);

  return {
    verdict: 'a-verifier',
    cause: null,
    ancre,
    operationType: type,
    evenementsPosterieurs: posterieurs,
    reposeSurDeLaProse: prose,
    natureDeLaLecture: prose ? 'prose-provisoire' : 'donnee-structuree',
    interditLaDiscussionDePrix: sortie,
    mention: redigerMention(type, sortie, ancre, posterieurs, financiers, prose, comps, composanteVisee),
    motif: `${posterieurs.length} evenement(s) externe(s) posterieur(s) a ${ancre.annee}. ${ancre.declaration}`
      + (prose ? ' Detection provisoire par lecture de la prose des moteurs, en attendant que les evenements existent comme donnee.' : ''),
  };
}

/**
 * Un evenement est posterieur a l ancre quand il la depasse au mois.
 * Un evenement sans mois est reporte en fin d annee : sans precision,
 * on ne lui prete pas une anteriorite qu il n a pas etablie.
 */
function estPosterieur(e: EvenementDate, ancre: AncreOperation): boolean {
  if (!Number.isFinite(e.annee)) return false;
  const moisEvenement = e.mois && e.mois >= 1 && e.mois <= 12 ? e.mois : 12;
  return (e.annee * 12 + moisEvenement) >= (ancre.annee * 12 + ancre.mois);
}

function sansVerdict(
  cause: NonProductionCauseOrNull,
  motif: string,
  type: OperationType | null,
): OperationValidityOutput {
  return {
    verdict: 'non-applicable',
    cause,
    ancre: null,
    operationType: type,
    evenementsPosterieurs: [],
    reposeSurDeLaProse: false,
    natureDeLaLecture: 'sans-objet',
    interditLaDiscussionDePrix: false,
    mention: null,
    motif,
  };
}

/**
 * L ancre est la date de redaction quand elle est etablie, le millesime
 * de reference augmente de deux ans sinon. La sortie declare laquelle a
 * servi : les deux n ont pas la meme force, et le lecteur doit savoir
 * s il lit une date lue ou un plancher reconstitue.
 */
function resoudreAncre(
  documentDate: string | null | undefined,
  millesime: number | null | undefined,
): AncreOperation | null {
  if (typeof documentDate === 'string' && /^\d{4}/.test(documentDate)) {
    const annee = Number(documentDate.slice(0, 4));
    if (Number.isFinite(annee) && annee >= 1990) {
      // Quand le document ne donne que l annee, l ancre se pose en fin
      // d annee : seul un evenement clairement ulterieur declenche la
      // reserve. Une precision non donnee ne doit pas produire une
      // severite qu elle ne fonde pas.
      const moisDoc = /^\d{4}-(\d{2})/.exec(documentDate);
      return {
        annee,
        mois: moisDoc ? Number(moisDoc[1]) : 12,
        origine: 'date-du-document',
        declaration: `Ancre : la date de redaction du document, ${documentDate}, lue dans le document avec citation.`,
      };
    }
  }
  if (typeof millesime === 'number' && Number.isFinite(millesime) && millesime >= 1990) {
    const annee = millesime + MARGE_MILLESIME_ANNEES;
    return {
      annee,
      // Ancre reconstituee posee en debut d annee : la marge de deux ans
      // a deja repousse la date presumee de redaction, la reprendre au
      // mois reviendrait a la repousser deux fois et a taire le cas que
      // ce module existe pour lever.
      mois: 1,
      origine: 'millesime-plus-deux',
      declaration: `Ancre : le document ne porte pas sa date de redaction. Elle est reconstituee depuis le dernier exercice qu il qualifie de realise (${millesime}), augmente de ${MARGE_MILLESIME_ANNEES} ans pour absorber l ecart entre cet exercice et la redaction. L ancre retenue est donc ${annee}, et elle est prudente et non exacte.`,
    };
  }
  return null;
}

/**
 * Delai en deca duquel un element de confirmation est tenu pour recent.
 *
 * CONVENTIONNEL, et rien dans le code ne le fonde. Il est pose parce
 * que l absence de convention laisserait le lecteur sans action : « a
 * verifier » sans horizon ne se traduit par aucun geste. Trois mois est
 * l ordre de grandeur d un mandat de cession vivant. A discuter avec un
 * praticien, pas a deriver d une donnee.
 */
export const FRAICHEUR_CONFIRMATION_MOIS = 3;

/**
 * Nom de l operation en prose. Un type technique n a rien a faire dans
 * un texte adresse a un lecteur : le partner lit une cession, pas
 * `cession-totale`. Les trois types de sortie se disent « cession »
 * parce que c est ce que la reserve met en cause, la capacite du
 * vendeur a ceder ailleurs.
 */
function nommerOperation(type: OperationType): string {
  if (type === 'levee') return 'une levee de fonds';
  if (type === 'cession-partielle') return 'une cession partielle';
  return 'une cession';
}

/**
 * Rend l intitule au fait qu il porte, sans la lecture editoriale que
 * le moteur d origine y a jointe. Le moteur Equipe presente une levee
 * comme un signal favorable ; reprendre sa phrase entiere dans un
 * paragraphe qui s en sert pour refuser donne deux tons contradictoires
 * dans la meme ligne.
 */
function faitSeul(intitule: string): string {
  const coupe = (intitule.split(/\s+:\s+/)[0] || intitule).replace(/\s+/g, ' ').trim();
  // La date est donnee separement par la phrase : la laisser dans
  // l intitule la ferait dire deux fois.
  const sansDate = coupe
    .replace(/\s*(annonc[ée]e?|datée?|survenue?|intervenue?)?\s*(en|au|le)?\s*(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)?\s*20[0-4]\d\s*$/i, '')
    .trim();
  const brut = sansDate.length >= 12 ? sansDate : coupe;
  // La coupe se fait sur une frontiere de proposition, pas au
  // caractere : tronquer au milieu d un mot donne « le cash-in vise
  // dans l, » et ruine une phrase destinee a un lecteur.
  let fait = brut;
  if (brut.length > 130) {
    const pivot = brut.slice(0, 130).lastIndexOf(', ');
    fait = pivot > 40 ? brut.slice(0, pivot) : brut.slice(0, brut.slice(0, 130).lastIndexOf(' '));
  }
  fait = fait.replace(/[\s,;:]+$/, '');
  return fait.charAt(0).toLowerCase() + fait.slice(1);
}

/**
 * La mention se lit en quatre mouvements : la decision, sa raison, ce
 * qu elle n invalide pas, ce qui la leve. La provenance vient en
 * dernier et en retrait.
 *
 * L ordre n est pas cosmetique. La premiere version donnait la preuve
 * avant la decision, ne disait jamais que le reste de la note tenait,
 * et placait la mention de provenance en troisieme argument, ou elle se
 * lisait comme un aveu de faiblesse au milieu meme du paragraphe cense
 * justifier un refus. Un partner qui voit une note refuser de conclure
 * y lit une panne s il ne lit pas d abord que c est une decision.
 *
 * La formulation ne conclut toujours pas : elle dit que le prix ne se
 * discute pas, jamais que l operation est morte.
 */
function redigerMention(
  type: OperationType,
  sortie: boolean,
  ancre: AncreOperation,
  posterieurs: EvenementDate[],
  financiers: EvenementDate[],
  prose: boolean,
  comps: Array<{ kind: string }> | null,
  composanteVisee: string,
): string {
  const principal = financiers[0] ?? posterieurs[0];
  const quand = principal.mois
    ? `${MOIS_EN_LETTRES[principal.mois]} ${principal.annee}`
    : String(principal.annee);
  const fait = faitSeul(principal.intitule);

  // 1. La decision, avant toute preuve. Sur une operation a plusieurs
  // composantes, elle nomme celle qui est mise en cause : une reserve
  // globale dirait plus que ce qui est etabli, et aucune reserve
  // tairait ce qui l est.
  const mixte = comps !== null && comps.some((c) => c.kind === 'cash-in') && comps.some((c) => c.kind === 'cession');
  const nomComposante = composanteVisee === 'cash-in' ? 'le cash-in demande'
    : composanteVisee === 'cession' ? 'la cession de titres'
    : 'l operation entiere';
  const decision = sortie
    ? `Le prix n est pas discute sur ce dossier, et c est une decision.`
    : mixte
    ? `Une reserve porte sur une composante de l operation, ${nomComposante}, et non sur l operation entiere. Elle n empeche pas de discuter le prix.`
    : `Une reserve porte sur l actualite de l operation, et elle n empeche pas de discuter le prix.`;

  // 2. Sa raison, en une phrase qui nomme l operation en clair.
  const consequence = sortie
    ? `Si cet evenement a eu lieu, le vendeur a trouve son financement ailleurs et l operation decrite n a plus le meme objet. En discuter le prix reviendrait a valoriser une transaction dont on ignore si elle existe encore.`
    : `Cet evenement peut signifier que le tour decrit a deja ete realise, auquel cas le dossier instruit une operation passee.`;
  // La nature se dit depuis les composantes quand elles existent : le
  // type herite dirait « une cession » sur une levee pure des lors
  // qu il aurait ete derive autrement.
  const parComposantes = comps === null ? null
    : mixte ? 'une operation mixte, cession de titres et cash-in de croissance'
    : comps.some((c) => c.kind === 'cession') ? 'une cession'
    : comps.some((c) => c.kind === 'cash-in') ? 'une levee de fonds'
    : 'une operation a effet de levier';
  const objet = `Le document instruit ${parComposantes ?? nommerOperation(type)}`;
  const consequenceMixte = mixte && composanteVisee === 'cash-in'
    ? `Si cet evenement a eu lieu, la societe a trouve son financement ailleurs et la composante cash-in du document n a plus d objet. La cession de titres, elle, peut rester d actualite : c est ce qu il faut verifier.`
    : consequence;
  const raison = `${objet}, or un evenement lui est posterieur : ${fait}, ${quand}. ${consequenceMixte}`;

  // 3. Ce que la reserve n invalide pas.
  const portee = sortie
    ? `Le reste de la note tient. Les methodes, les multiples et la fourchette restent calcules et affiches plus bas : ce qui est suspendu, c est la recommandation, pas l analyse.`
    : `Le reste de la note tient, fourchette comprise.`;

  // 4. Ce qui leve la reserve, avec un geste et un horizon.
  const geste = sortie
    ? `etablir aupres du vendeur ou de son conseil que le mandat reste ouvert et que le perimetre annonce n a pas change`
    : mixte
    ? `etablir aupres du vendeur et de la societe quelles composantes de l operation subsistent, et a quels termes`
    : `etablir aupres de la societe que le tour decrit est toujours en cours et que ses termes n ont pas change`;
  const levee = `Ce qui leverait la reserve : ${geste}. Un element date de moins de ${FRAICHEUR_CONFIRMATION_MOIS} mois suffit${sortie ? ', et la fourchette redevient alors directement utilisable' : ''}.`;

  // 5. La provenance, en dernier. Verifiable sans etre un argument.
  const origineAncre = ancre.origine === 'date-du-document'
    ? `la date de redaction est lue dans le document, ${ancre.annee}.`
    : `le document ne porte pas sa date de redaction, estimee a ${ancre.annee} au plus tot depuis le dernier exercice qu il qualifie de realise.`;
  const provenance = `Sur quoi repose cette reserve : ${origineAncre}`
    + (principal.source ? ` L evenement a ete releve dans les sources publiques consultees [${principal.source}]` : ' L evenement a ete releve dans les sources consultees')
    + (prose ? `, sa date et sa nature restent a recouper.` : `.`);

  return [decision, raison, portee, levee, provenance].join(' ');
}

const MOIS_EN_LETTRES: Record<number, string> = {
  1: 'janvier', 2: 'fevrier', 3: 'mars', 4: 'avril', 5: 'mai', 6: 'juin',
  7: 'juillet', 8: 'aout', 9: 'septembre', 10: 'octobre', 11: 'novembre', 12: 'decembre',
};

// ============================================================
// DETECTION PROVISOIRE SUR PROSE
// ------------------------------------------------------------
// PROVISOIRE, et il faut le lire comme tel. Cette fonction lit de la
// prose pour decider, ce que la grappe 3 a interdit partout ailleurs :
// aucun consommateur en aval ne lit un message pour trancher. Elle
// existe parce que les evenements externes n ont pas d existence
// structuree, et sa sortie EST l interface EvenementDate ci-dessus,
// c est-a-dire exactement ce que le moteur Equipe doit produire a sa
// place. Elle n est pas une amelioration possible du dispositif, elle
// est la dette qui tient lieu de dispositif en attendant.
//
// Sa precision est mediocre et mesuree comme telle : sur les six
// dossiers du corpus portant un millesime exploitable, elle rend deux
// candidats dont un faux positif, une donnee de traction prise pour un
// evenement de financement. Ce taux est acceptable a ce niveau de
// formulation, parce qu une question inutile coute moins cher qu une
// operation morte instruite en silence. Il ne le serait pas si la
// mention concluait.
// ============================================================

// Les marqueurs exigent un evenement et non une mention. « levee » ne
// suffit pas, « levee de 83m » ou « a leve 83 millions » oui : la
// premiere version, plus permissive, rendait vingt et un evenements sur
// le run de gel dont la quasi-totalite etaient des phrases descriptives
// contenant un mot de financement et une annee de fondation.
const MARQUEURS_FINANCEMENT = /\b(?:lev[ée]e de\s+\d|a lev[ée]\s+\d|tour de (?:table|financement)\s|series\s+[a-e]\b|refinancement|introduction en bourse|\bipo\b|boucl[ée]\s+(?:un|une|son)\s+(?:tour|lev))/i;
const MARQUEURS_CONTROLE = /\b(?:rachat de|rachet[ée]e? par|acquisition de|acquise? par|cession de|repris(?:e)? par|prise de controle)\b/i;
const MARQUEURS_DIRIGEANT = /\b(?:nomination de|nomm[ée]\s+(?:ceo|directeur|president)|depart du|remplac[ée]\s+au poste)\b/i;
const MARQUEURS_PROCEDURE = /\b(?:redressement judiciaire|liquidation judiciaire|proc[ée]dure de sauvegarde|procedure collective|cessation de paiement)\b/i;

/**
 * Contextes ou une annee ne date pas l evenement mais autre chose : la
 * fondation, l anciennete, un exercice comptable. Une annee prise dans
 * ces contextes n est pas une date d evenement.
 */
const ANNEE_NON_EVENEMENTIELLE = /\b(?:fond[ée]e?\s+en|cr[ée][ée]e?\s+en|depuis|exercice|fy\s*\d|dec-|d[ée]cembre\s+20\d\d\s*(?:a|A)\b)\s*$/i;

/** Distance maximale, en caracteres, entre le marqueur et l annee. */
const PROXIMITE_MAX = 90;

const MOIS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

/**
 * Collecte les chaines de prose d une sortie de moteur, quelle que soit
 * sa forme.
 *
 * Le defaut ferme, mesure sur le run de gel du 3 aout : la detection ne
 * lisait que quatre listes du moteur Equipe. L evenement qu elle
 * cherchait, « la levee de 83m€ finalement conclue en novembre 2023 »,
 * vivait dans le moteur Fragilite structurelle. Et les trois lignes du
 * moteur Equipe qui mentionnaient bien la levee ne portaient aucune
 * annee, donc la detection aurait echoue meme sur le bon moteur.
 *
 * Enumerer des chemins de champs reproduisait la faute qu on corrige :
 * une chose n existe dans la mesure que si quelqu un a pense a l y
 * mettre. Le parcours est donc structurel, il descend dans l objet et
 * prend toute chaine assez longue pour porter une phrase.
 */
export function collecterProse(source: unknown, profondeurMax = 6): string[] {
  const out: string[] = [];
  const vu = new Set<unknown>();
  const descendre = (o: unknown, p: number): void => {
    if (p > profondeurMax || o === null || o === undefined) return;
    if (typeof o === 'string') { if (o.trim().length >= 25) out.push(o); return; }
    if (typeof o !== 'object') return;
    if (vu.has(o)) return;
    vu.add(o);
    if (Array.isArray(o)) { for (const v of o) descendre(v, p + 1); return; }
    for (const v of Object.values(o as Record<string, unknown>)) descendre(v, p + 1);
  };
  descendre(source, 0);
  return out;
}

/**
 * Reconstitue des evenements dates depuis la prose des moteurs.
 * Provisoire, voir l en-tete de section.
 */
export function detecterEvenementsDansLaProse(lignes: string[]): EvenementDate[] {
  const out: EvenementDate[] = [];
  const dejaVus = new Set<string>();
  for (const brut of lignes) {
    if (typeof brut !== 'string' || brut.trim().length === 0) continue;
    const ligne = brut.trim();
    const sansAccent = ligne
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    let nature: EvenementNature | null = null;
    if (MARQUEURS_PROCEDURE.test(sansAccent)) nature = 'procedure-collective';
    else if (MARQUEURS_FINANCEMENT.test(sansAccent)) nature = 'financement';
    else if (MARQUEURS_CONTROLE.test(sansAccent)) nature = 'changement-de-controle';
    else if (MARQUEURS_DIRIGEANT.test(sansAccent)) nature = 'dirigeant';
    if (!nature) continue;

    // L annee doit etre proche du marqueur, sinon elle date autre
    // chose que lui. Sur le run de gel, « fondee en 2007 » et un mot de
    // financement vingt lignes plus loin produisaient un evenement de
    // 2007 qui n existait pas.
    const posMarqueur = sansAccent.search(
      nature === 'procedure-collective' ? MARQUEURS_PROCEDURE
      : nature === 'financement' ? MARQUEURS_FINANCEMENT
      : nature === 'changement-de-controle' ? MARQUEURS_CONTROLE
      : MARQUEURS_DIRIGEANT,
    );
    let annee = 0;
    let posAnnee = -1;
    for (const m of Array.from(ligne.matchAll(/\b(20[0-4]\d)\b/g))) {
      const idx = m.index ?? 0;
      if (Math.abs(idx - posMarqueur) > PROXIMITE_MAX) continue;
      if (ANNEE_NON_EVENEMENTIELLE.test(ligne.slice(Math.max(0, idx - 22), idx))) continue;
      annee = Number(m[1]);
      posAnnee = idx;
    }
    if (!annee) continue;

    // Bordure de mot obligatoire : sans elle, « mai » se lit dans
    // « jamais », « domaine » ou « semaine », et un evenement de
    // novembre ressortait date de mai.
    let mois: number | null = null;
    for (const [nom, n] of Object.entries(MOIS_FR)) {
      if (new RegExp(`\\b${nom}\\b`).test(sansAccent)) { mois = n; break; }
    }

    const src = /\[web\s*:\s*([^\]]+)\]/i.exec(ligne);

    const intitule = ligne.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    // Le meme fait revient dans plusieurs champs d un meme moteur, et
    // dans plusieurs moteurs. Une reserve ne se compte qu une fois.
    const clef = `${nature}|${annee}|${mois ?? ''}|${intitule.slice(0, 60).toLowerCase()}`;
    if (dejaVus.has(clef)) continue;
    dejaVus.add(clef);
    out.push({
      intitule,
      annee,
      mois,
      nature,
      source: src ? `web : ${src[1].trim()}` : null,
      luDansLaProse: true,
    });
  }
  return out;
}
