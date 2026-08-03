// ============================================================
// LECTURE D UN MONTANT EN TEXTE LIBRE
// ------------------------------------------------------------
// Une seule implementation, parce que trois lectures differentes d une
// meme chaine ne se contredisent pas bruyamment : elles se contredisent
// en silence, chacune dans son moteur, et le partner lit trois chiffres
// dont il croit qu ils descendent du meme.
//
// Les trois qui existaient ne divergeaient pas sur les cas propres.
// « 4 M€ » se lisait pareil partout. Elles divergeaient sur le cas sale,
// qui est le cas frequent : deux d entre elles, celle des benchmarks et
// celle du budget technologique, convertissaient par defaut vers les
// millions un nombre sans unite ni devise. « Dec-22a », en-tete de
// colonne d une serie de revenus au millesime, y devenait vingt-deux
// millions. La troisieme, celle du moteur de valorisation, refusait ce
// nombre, ayant supprime la conversion par defaut, mais echouait a
// l autre bout : elle retenait le premier jeton du libelle, si bien que
// « Dec-22a : 1,2 M€ » lui rendait vingt-deux, donc rien.
//
// Le defaut commun ne tient pas a l unite, il tient au rang : le premier
// nombre d un libelle n est pas le montant du libelle. Un fragment de
// date en porte un, et il arrive en tete parce qu une ligne de tableau
// commence par sa periode.
//
// D ou la regle de ce module : un jeton pris dans un fragment de date
// n est pas un candidat. Il n est ni lu ni compte comme un echec, il est
// retire, et la lecture continue sur ce qui suit. « Dec-22a » seul ne
// rend donc aucun montant, et « Dec-22a : 1,2 M€ » rend un million deux.
//
// Ce que ce module ne fait pas, et qu il faut savoir en le lisant. Une
// annee nue, « 2024 : 4 M€ », reste un candidat : le premier jeton y est
// bien pris pour le montant, et la lecture rend deux mille vingt-quatre
// quand une devise figure ailleurs dans le libelle. Ecarter tout nombre
// de quatre chiffres compris entre 1900 et 2100 fermerait ce cas et en
// ouvrirait un autre, celui du montant qui tombe legitimement dans cette
// plage. Le choix n est pas tranche ici, il est nomme.
// ============================================================

import type { NonProductionCauseOrNull } from './non-production';

export type Devise = 'EUR' | 'USD' | 'GBP';

export interface MontantLu {
  /**
   * Le montant, dans la devise lue quand il y en a une. Le module ne
   * convertit jamais : une parite est une hypothese datee, et elle
   * appartient au moteur qui l assume, pas au lecteur qui la subirait.
   */
  value: number | null;
  /** Devise lue dans le libelle, ou null quand aucune n y figure. */
  devise: Devise | null;
  cause: NonProductionCauseOrNull;
  motif: string | null;
}

/**
 * Un nombre, son unite eventuelle, son signe pourcent eventuel.
 *
 * Les formes longues precedent les courtes dans l alternative, sans quoi
 * « m » mordrait sur « millions » puis echouerait sur la limite de mot,
 * et l unite serait perdue au lieu d etre lue. C est la lecture que
 * portait le prefill de reconciliation, quatrieme implementation du
 * meme parsing, et elle est reprise ici plutot que perdue.
 */
const UNITE_JETON = /(\d+(?:\.\d+)?)\s*((?:milliards?|millions?|milliers?|mille|mds?|m|k|b)(?![a-z]))?\s*(%)?/g;

const AUCUN: MontantLu = {
  value: null, devise: null, cause: 'absence',
  motif: 'aucun montant extrait du dossier',
};

/**
 * Noms de mois, francais et anglais, entiers et abreges. La limite de
 * mot en fin d alternative n est pas cosmetique : sans elle, « mai »
 * mordait sur « maintenance » et un poste budgetaire devenait une date.
 */
const MOIS = String.raw`(?:jan(?:v|vier|uary)?|f[ée]v(?:r|rier)?|feb(?:ruary)?|mar(?:s|ch)?|avr(?:il)?|apr(?:il)?|mai|may|juin|jun(?:e)?|juil(?:let)?|jul(?:y)?|ao[uû]t|aug(?:ust)?|sep(?:t|tembre|tember)?|oct(?:obre|ober)?|nov(?:embre|ember)?|d[ée]c(?:embre|ember)?)\b`;

/**
 * Fragments de date, dans les formes que le corpus porte reellement :
 * en-tetes de colonnes de business plan, libelles d exercice, periodes
 * de tableau. Le suffixe d une lettre couvre les millesimes annotes,
 * « Dec-22a » pour actual, « Dec-24e » pour estimate.
 */
const FRAGMENTS_DATE: RegExp[] = [
  new RegExp(String.raw`${MOIS}\.?\s*[-/ ]?\s*\d{2,4}[a-z]?`, 'g'),
  new RegExp(String.raw`\d{2,4}\s*[-/ ]?\s*${MOIS}\.?`, 'g'),
  /(?:fy|exercice|ex\.)\s*\d{2,4}[a-z]?/g,
  /[qt][1-4]\s*[-/ ]?\s*\d{2,4}[a-z]?/g,
  /\d{2,4}\s*[-/ ]?\s*[qt][1-4]/g,
  /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g,
  /\d{4}-\d{2}(?:-\d{2})?/g,
  /\d{1,2}\/\d{4}/g,
];

/** Intervalles de caracteres occupes par un fragment de date. */
function plagesDeDate(s: string): Array<[number, number]> {
  const plages: Array<[number, number]> = [];
  for (const re of FRAGMENTS_DATE) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      plages.push([m.index, m.index + m[0].length]);
    }
  }
  return plages;
}

function dansUnePlage(index: number, plages: Array<[number, number]>): boolean {
  return plages.some(([d, f]) => index >= d && index < f);
}

/**
 * Lit un montant dans un libelle libre, avec sa cause de non-lecture.
 *
 * Historique des defauts fermes, conserve avec la fonction plutot
 * qu avec le moteur qui l hebergeait, puisqu il vaut desormais pour ses
 * trois consommateurs.
 *
 * « Cession de 100% du capital » rendait 100 M EUR. La forme d origine
 * prenait le premier nombre du libelle, ignorait ce qui le suivait, et
 * convertissait par defaut tout nombre sous mille en millions. Un
 * pourcentage devenait un montant, une part de capital devenait un
 * ticket. Mesure sur le corpus au 3 aout 2026 : sur trente-trois
 * dossiers portant un candidat de ticket, cinq annoncent une part de
 * capital et un annonce un nombre de parcs cedes ; six dossiers sur
 * trente-trois portaient donc un ticket fabrique, dont quatre cessions
 * totales.
 *
 * Quatre regles, dans cet ordre.
 *
 * Un jeton pris dans un fragment de date n est pas un candidat, et il
 * est retire plutot que refuse : « Dec-22a : 1,2 M€ » rend un million
 * deux, la ou le premier nombre du libelle aurait rendu vingt-deux.
 *
 * Un nombre immediatement suivi d un signe pourcent n est pas un
 * montant, et la lecture passe au suivant plutot que d abandonner le
 * libelle entier : « cession de 100% du capital pour 12 M EUR » porte
 * bien un montant. C est aussi ce qui evite de perdre le ticket de
 * Crowdaa, ou un pourcentage de discount suit le montant recherche.
 *
 * L unite d une fourchette porte sur ses deux bornes. « 10-15m » lit
 * dix millions et non dix, parce que le suffixe trouve plus loin dans
 * la meme expression s applique a la borne basse. Elle ne se cherche
 * pas n importe ou : « 500 000 recherches, plafond 7M » ne vaut pas
 * cinq cent mille millions.
 *
 * Sans unite ni devise, il n y a pas de montant. La conversion par
 * defaut vers les millions transformait un nombre quelconque en somme
 * d argent, ce qui est une divination. Verifie sur le corpus, aucune
 * valeur legitime n en dependait, les quarante-huit candidats non vides
 * portant tous soit un suffixe soit une devise.
 */
export function lireMontant(raw: unknown): MontantLu {
  if (raw === null || raw === undefined || raw === '') return AUCUN;
  if (typeof raw === 'number') {
    return raw > 0
      ? { value: raw, devise: null, cause: null, motif: null }
      : { value: null, devise: null, cause: 'absence', motif: 'montant nul ou negatif' };
  }
  if (typeof raw !== 'string') return AUCUN;

  // Les espaces ne sont supprimes qu entre chiffres, la ou ils separent
  // les milliers. Les supprimer partout collait le suffixe au mot
  // suivant : « 15m de cash-in » devenait « 15mde », donc quinze
  // milliards. Le suffixe doit finir sur autre chose qu une lettre.
  const s = raw.toLowerCase()
    .replace(/[  ]/g, ' ')
    .replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1')
    .replace(/,(\d)/g, '.$1');

  const devise: Devise | null = /€|eur/.test(s) ? 'EUR'
    : /\$|usd/.test(s) ? 'USD'
    : /£|gbp/.test(s) ? 'GBP'
    : null;

  const plages = plagesDeDate(s);
  const jetons = Array.from(s.matchAll(UNITE_JETON));
  if (jetons.length === 0) {
    return { value: null, devise, cause: 'absence', motif: 'aucun nombre dans le libelle' };
  }

  // Un jeton pris dans un fragment de date est retire avant tout
  // arbitrage, et non refuse apres coup : le libelle qui porte une
  // periode puis un montant doit rendre le montant, pas echouer sur la
  // periode.
  const horsDate = jetons.filter((j) => !dansUnePlage(j.index ?? 0, plages));
  if (horsDate.length === 0) {
    return {
      value: null, devise, cause: 'absence',
      motif: 'le libelle ne porte qu une date, pas un montant',
    };
  }

  const nonPourcent = horsDate.filter((j) => j[3] !== '%');
  if (nonPourcent.length === 0) {
    return {
      value: null, devise, cause: 'absence',
      motif: 'le libelle exprime une part et non un montant',
    };
  }

  const premier = nonPourcent[0];
  const value = parseFloat(premier[1]);
  if (isNaN(value) || value <= 0) {
    return { value: null, devise, cause: 'absence', motif: 'nombre non exploitable' };
  }

  let suffixe = premier[2];
  if (suffixe === undefined) {
    const suivant = nonPourcent[1];
    if (suivant && suivant[2] !== undefined) {
      const finPremier = (premier.index ?? 0) + premier[0].length;
      const entre = s.slice(finPremier, suivant.index ?? finPremier);
      if (/^\s*(?:-|–|—|a|à|to|\/)\s*$/.test(entre)) suffixe = suivant[2];
    }
  }

  if (suffixe !== undefined && /^(?:mds?|b|milliards?)$/.test(suffixe)) {
    return { value: value * 1_000_000_000, devise, cause: null, motif: null };
  }
  if (suffixe !== undefined && /^(?:m|millions?)$/.test(suffixe)) {
    return { value: value * 1_000_000, devise, cause: null, motif: null };
  }
  if (suffixe !== undefined && /^(?:k|milliers?|mille)$/.test(suffixe)) {
    return { value: value * 1_000, devise, cause: null, motif: null };
  }

  if (devise !== null && value >= 1000) return { value, devise, cause: null, motif: null };

  return {
    value: null,
    devise,
    cause: 'absence',
    motif: devise !== null
      ? `montant de ${value} sans ordre de grandeur, non interpretable`
      : 'nombre sans unite ni devise, donc pas un montant',
  };
}
