// ============================================================
// UN NOMBRE EXTRAIT D UN DOCUMENT PORTE SON VERBATIM
// ------------------------------------------------------------
// Troisieme occurrence de la meme regle, et c est ce qui la rend
// generale plutot que particuliere.
//
// La premiere portait sur les sources web. La plateforme rendait les
// pages atteintes a cote de la prose, le pipeline les jetait, et ce qui
// tenait lieu de tracabilite etait un tag `[web : crunchbase]` ecrit de
// memoire par le modele. Un tag n est pas une source : c est un souvenir
// qui a la forme d une preuve. La regle posee alors est qu une
// acquisition se capture au moment ou elle a lieu, avec de quoi la
// reconnaitre plus tard.
//
// La deuxieme portait sur les montants d operation. `amount` et
// `valuation` sortaient sans citation, donc sans moyen de distinguer un
// chiffre lu d un chiffre reconstitue, et la reparation a ete la meme :
// une evidence obligatoire, un refus sans elle.
//
// La troisieme est celle-ci, etablie le 5 aout 2026 sur le run
// b8d0e9ac. Le classeur de Project Hello porte 3334 cellules
// numeriques ; aucune ne rend l une des quatre valeurs que l extraction
// a inscrites dans `revenueProjection`. La plus proche de 2025 est une
// ligne d EBITDA de l annee suivante, celles de 2027 et 2028 sont la
// ligne B2B et non le total, et la seule qui vise la bonne ligne est
// approximee d un pour cent. Trois fautes dans quatre valeurs.
//
// Un chiffre sans verbatim est donc le meme objet qu un tag `[web]` sans
// capture : une affirmation sur un document, que rien ne permet de
// verifier, et qui porte l autorite d un nombre. C est pire qu une
// affirmation en prose, parce qu un nombre ne se relit pas. Un partner
// qui ouvre le document a cote de la note ne trouve pas la ligne, et il
// n a aucun moyen de distinguer une erreur de lecture d une invention.
//
// CE QUE LE MODULE IMPOSE
//
// 1. Le verbatim est ce que le document ecrit, tel quel, sans
//    normalisation. La valeur normalisee en descend et jamais l inverse.
//    Le module ne fabrique donc aucun verbatim a partir d une valeur :
//    une valeur seule reste une valeur seule.
//
// 2. Un ecart entre les deux au-dela de la tolerance est un incident
//    declare, jamais une correction silencieuse. Le module ne remplace
//    pas la valeur par celle du verbatim : substituer effacerait la
//    trace de la divergence, qui est precisement l information.
//
// 3. Une valeur sans verbatim est non fondee, exactement comme une
//    revendication de lecture web sans page atteinte. Meme bascule, meme
//    raison : ce qui distingue une lecture d une reconstitution est la
//    trace, et son absence ne se compense pas.
//
// LA TOLERANCE SE DERIVE, ELLE NE SE POSE PAS
//
// Un seuil relatif choisi a la main aurait ete un jugement, et il aurait
// vieilli. Celui-ci descend de la valeur elle-meme : un nombre ecrit
// avec `d` decimales declare une precision de plus ou moins un demi de
// la derniere decimale, et c est tout ce qu un arrondi legitime peut
// couter. Au-dela, ce n est plus le meme nombre.
//
// C est la discipline de precision prise dans son sens direct : une
// precision non donnee ne doit pas produire une severite qu elle ne
// fonde pas, et une precision donnee ne doit pas se voir accorder une
// latitude qu elle refuse.
//
// La mesure du corpus le 5 aout 2026, sur 1143 valeurs numeriques non
// nulles de 51 notes portant `financialData` : 99,2 % s ecrivent avec
// trois decimales au plus, 42 % avec exactement trois, 31 % avec une,
// 21 % sans. La regle a donc du sens sur la quasi-totalite du corpus, et
// la granularite relative qu elle implique va de 0,03 % pour les valeurs
// a trois decimales a 0,69 % pour les entiers, medianes.
//
// Eprouvee sur le seul cas ou le document est connu, les quatre valeurs
// de Project Hello : elle retient les quatre, y compris la plus proche,
// 0,963 contre 963 750 qui vaut 0,96375 et devrait s ecrire 0,964. Et
// elle accepterait la valeur juste, 1 059 750 rendu 1,060. Elle
// discrimine donc exactement la ou il faut, sans qu aucun chiffre ait
// ete choisi pour cela.
// ============================================================

import { lireMontant } from './lecture-montant';
import type { NonProductionCauseOrNull } from './non-production';

/**
 * Un nombre extrait d un document, avec ce que le document en ecrit.
 *
 * `valeur` reste la valeur declaree par l extraction, meme quand elle
 * diverge : la remplacer par celle du verbatim serait la correction
 * silencieuse que la deuxieme exigence interdit. Ce qui change en cas
 * de divergence est `fondee`, et les consommateurs lisent ce champ.
 */
export interface ValeurCitee {
  /** Ce que le document ecrit, tel quel. Jamais fabrique. */
  verbatim: string | null;
  /** Valeur normalisee telle que l extraction l a declaree. */
  valeur: number | null;
  /** True quand le verbatim etaye la valeur. */
  fondee: boolean;
  /** Cause de non-fondation, au sens de la grappe 3. */
  cause: NonProductionCauseOrNull;
  /** Motif destine au lecteur du code et de la note. */
  motif: string | null;
  /** Valeur lue dans le verbatim, apres alignement d echelle. */
  valeurDuVerbatim: number | null;
  /** Ecart absolu entre la valeur declaree et celle du verbatim. */
  ecart: number | null;
  /** Ce qu un arrondi legitime pouvait couter, sur la valeur declaree. */
  tolerance: number | null;
}

/** Nombre de decimales ecrites par une valeur. */
export function decimalesDe(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = String(n);
  if (s.includes('e') || s.includes('E')) return 0;
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

/**
 * Ce qu un arrondi legitime peut couter sur une valeur donnee.
 *
 * Un nombre ecrit avec trois decimales est arrondi a un demi-milliieme
 * pres, et rien de plus. La tolerance est donc absolue et non relative :
 * elle suit la precision declaree et pas la magnitude, ce qui est le
 * seul sens ou elle ne demande aucun arbitrage.
 */
export function toleranceDArrondi(valeur: number): number {
  return 0.5 * Math.pow(10, -decimalesDe(valeur));
}

/**
 * Aligne la valeur du verbatim sur l echelle de la valeur declaree.
 *
 * Le verbatim d une cellule de tableau ne porte pas toujours son unite,
 * qui vit dans l en-tete de colonne : « 963,750 » sous « En €k » vaut
 * 963 750 euros et l extraction le normalise en millions. Comparer les
 * deux nombres bruts n apprendrait rien.
 *
 * L alignement se fait sur la puissance de dix la plus proche, et il ne
 * masque pas une erreur d echelle du modele : la valeur declaree n est
 * jamais remplacee, donc un facteur dix errone reste dans la sortie et
 * reste faux. Ce que l alignement permet est de mesurer l ecart de
 * lecture, qui est la question posee.
 */
export function alignerEchelle(valeurDuVerbatim: number, valeurDeclaree: number): number {
  if (valeurDuVerbatim === 0 || valeurDeclaree === 0) return valeurDuVerbatim;
  const rapport = Math.abs(valeurDeclaree) / Math.abs(valeurDuVerbatim);
  const exposant = Math.round(Math.log10(rapport));
  return valeurDuVerbatim * Math.pow(10, exposant);
}

const SANS_VERBATIM: Omit<ValeurCitee, 'valeur'> = {
  verbatim: null,
  fondee: false,
  cause: 'absence',
  motif: 'aucun verbatim : la valeur affirme quelque chose du document sans montrer ce qu elle y a lu',
  valeurDuVerbatim: null,
  ecart: null,
  tolerance: null,
};

/**
 * Evalue une valeur extraite au regard de son verbatim.
 *
 * Ne fabrique jamais l un a partir de l autre. Une valeur sans verbatim
 * ressort non fondee, une valeur qui diverge de son verbatim ressort non
 * fondee avec son ecart, et aucune des deux n est corrigee.
 */
export function evaluerValeurCitee(entree: {
  verbatim?: unknown;
  valeur?: unknown;
}): ValeurCitee {
  const valeur = typeof entree.valeur === 'number' && Number.isFinite(entree.valeur)
    ? entree.valeur
    : null;

  const verbatim = typeof entree.verbatim === 'string' && entree.verbatim.trim().length > 0
    ? entree.verbatim.trim()
    : null;

  if (verbatim === null) return { ...SANS_VERBATIM, valeur };

  if (valeur === null) {
    return {
      verbatim,
      valeur: null,
      fondee: false,
      cause: 'absence',
      motif: 'verbatim present sans valeur normalisee : rien a etayer',
      valeurDuVerbatim: null,
      ecart: null,
      tolerance: null,
    };
  }

  // La lecture du verbatim passe par le lecteur unique du depot. En
  // ecrire un second ici, meme minuscule, reconduirait le defaut que ce
  // lecteur a ete ecrit pour fermer : trois lectures d une meme chaine
  // ne se contredisent pas bruyamment, elles se contredisent en silence.
  const lu = lireMontant(verbatim);
  // Un verbatim sans unite ni devise n est pas un montant pour le
  // lecteur, mais il reste un nombre lisible : une cellule de tableau
  // porte son unite dans son en-tete. On retombe donc sur le premier
  // nombre du libelle, et seulement dans ce cas.
  const brut = lu.value ?? premierNombre(verbatim);

  if (brut === null) {
    return {
      verbatim,
      valeur,
      fondee: false,
      cause: 'incident',
      motif: `verbatim illisible : ${lu.motif ?? 'aucun nombre'}`,
      valeurDuVerbatim: null,
      ecart: null,
      tolerance: null,
    };
  }

  const aligne = alignerEchelle(brut, valeur);
  const ecart = Math.abs(valeur - aligne);
  const tolerance = toleranceDArrondi(valeur);
  const fondee = ecart <= tolerance;

  return {
    verbatim,
    valeur,
    fondee,
    cause: fondee ? null : 'incident',
    motif: fondee
      ? null
      : `la valeur ${valeur} ne descend pas du verbatim « ${verbatim} », qui vaut ${aligne} a l echelle declaree : ecart ${ecart.toPrecision(3)} pour une tolerance d arrondi de ${tolerance}`,
    valeurDuVerbatim: aligne,
    ecart,
    tolerance,
  };
}

/** Premier nombre d un libelle, sans unite ni devise. */
function premierNombre(s: string): number | null {
  const nettoye = s
    .replace(/[  ]/g, ' ')
    .replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  const m = nettoye.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Applique l evaluation a une serie, et rend le compte de ce qui n est
 * pas fonde. Destine aux consommateurs qui doivent declarer une reserve
 * plutot que d instruire valeur par valeur.
 */
export function evaluerSerie(
  serie: Array<{ verbatim?: unknown; value?: unknown; valeur?: unknown }> | null | undefined,
): { evaluees: ValeurCitee[]; nonFondees: number; sansVerbatim: number } {
  const evaluees = (Array.isArray(serie) ? serie : []).map((e) =>
    evaluerValeurCitee({ verbatim: e?.verbatim, valeur: e?.valeur ?? e?.value }));
  return {
    evaluees,
    nonFondees: evaluees.filter((e) => !e.fondee).length,
    sansVerbatim: evaluees.filter((e) => e.verbatim === null).length,
  };
}
