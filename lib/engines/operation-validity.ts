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
      interditLaDiscussionDePrix: false,
      mention: null,
      motif: `Aucun evenement externe posterieur a l ancre retenue (${ancre.annee}). ${ancre.declaration}`,
    };
  }

  const prose = posterieurs.some((e) => e.luDansLaProse);
  const sortie = TYPES_DE_SORTIE.has(type);
  const financiers = posterieurs.filter((e) => e.nature === 'financement');

  return {
    verdict: 'a-verifier',
    cause: null,
    ancre,
    operationType: type,
    evenementsPosterieurs: posterieurs,
    reposeSurDeLaProse: prose,
    interditLaDiscussionDePrix: sortie,
    mention: redigerMention(type, sortie, ancre, posterieurs, financiers, prose),
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
 * La formulation est une question posee au lecteur, jamais une
 * conclusion. Le module sait qu un evenement est posterieur ; il ne
 * sait pas si l operation a survecu, et rien dans les donnees ne le lui
 * dirait. Ecrire « l operation n existe probablement plus » depasserait
 * ce qui est etabli.
 */
function redigerMention(
  type: OperationType,
  sortie: boolean,
  ancre: AncreOperation,
  posterieurs: EvenementDate[],
  financiers: EvenementDate[],
  prose: boolean,
): string {
  const principal = financiers[0] ?? posterieurs[0];
  const quand = principal.mois
    ? `${String(principal.mois).padStart(2, '0')}/${principal.annee}`
    : String(principal.annee);
  const source = principal.source ? ` [${principal.source}]` : '';

  const tete = financiers.length > 0
    ? `Un evenement de financement posterieur a la date probable du document a ete trouve : ${principal.intitule} (${quand})${source}.`
    : `Un evenement posterieur a la date probable du document a ete trouve : ${principal.intitule} (${quand})${source}.`;

  // L asymetrie porte sur la question posee, pas seulement sur le ton.
  const question = sortie
    ? `Verifier si l operation instruite est toujours d actualite : le vendeur a pu trouver preneur ailleurs depuis.`
    : `Verifier si l operation instruite est toujours d actualite : cet evenement peut signifier que le tour decrit a deja ete realise.`;

  const reserve = prose
    ? ` Cette reserve repose sur une lecture de la prose des moteurs et non sur une donnee structuree : la date et la nature de l evenement sont a recouper avant d en tirer une conclusion.`
    : '';

  return `${tete} ${question}${reserve} ${ancre.declaration}`;
}

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

const MARQUEURS_FINANCEMENT = /\b(lev[ée]e|leve|tour de table|series\s+[a-e]\b|refinancement|introduction en bourse|ipo)\b/i;
const MARQUEURS_CONTROLE = /\b(rachat|rachet[ée]|acquisition|acquise?\s+par|cession|repris\s+par|prise de controle)\b/i;
const MARQUEURS_DIRIGEANT = /\b(nomination|nomm[ée]\s+(?:ceo|directeur|president)|depart du|remplac[ée]\s+au poste)\b/i;
const MARQUEURS_PROCEDURE = /\b(redressement judiciaire|liquidation|sauvegarde|procedure collective|cessation de paiement)\b/i;

const MOIS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

/**
 * Reconstitue des evenements dates depuis la prose des moteurs.
 * Provisoire, voir l en-tete de section.
 */
export function detecterEvenementsDansLaProse(lignes: string[]): EvenementDate[] {
  const out: EvenementDate[] = [];
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

    const anneeMatch = /\b(20[0-4]\d)\b/.exec(ligne);
    if (!anneeMatch) continue;
    const annee = Number(anneeMatch[1]);

    let mois: number | null = null;
    for (const [nom, n] of Object.entries(MOIS_FR)) {
      if (sansAccent.includes(nom)) { mois = n; break; }
    }

    const src = /\[web\s*:\s*([^\]]+)\]/i.exec(ligne);

    out.push({
      intitule: ligne.replace(/\s*\[[^\]]*\]\s*/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180),
      annee,
      mois,
      nature,
      source: src ? `web : ${src[1].trim()}` : null,
      luDansLaProse: true,
    });
  }
  return out;
}
