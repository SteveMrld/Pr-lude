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
/**
 * Ce qui separe la valeur de son verbatim, quand quelque chose les
 * separe. Distinguer les natures est ce qui evite de traiter une unite
 * de periode comme une erreur de lecture.
 */
export type NatureDEcart = 'expression' | 'periode' | 'valeur' | 'absence' | null;

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
  /** Ce qui separe la valeur de son verbatim. Null quand rien ne les separe. */
  natureDEcart: NatureDEcart;
}

/**
 * Periode couverte par le verbatim, quand elle differe de celle de la
 * valeur.
 *
 * TROISIEME AXE, OUVERT PAR LE RUN DU 6 AOUT 2026
 *
 * Le premier lot reel a rendu quatre lignes d opex dont le verbatim
 * citait « 10,000 (Marketing Spend mensuel) » face a une valeur
 * annuelle de 0,12 million. La valeur etait probablement juste, le
 * verbatim aussi, et pourtant ils ne se comparaient pas : ils ne
 * portaient pas la meme periode, et l audit n avait aucun moyen de le
 * savoir. Il concluait a une erreur de valeur.
 *
 * Sans ce champ, un ecart de periode et une erreur de lecture se lisent
 * pareil, ce qui est exactement le genre de confusion que ce module a
 * ete ecrit pour retirer.
 */
export type PeriodeVerbatim = 'annuel' | 'trimestriel' | 'mensuel' | 'cumul' | 'ponctuel';

/** Facteur d annualisation d une periode. Null quand il ne se derive pas. */
const FACTEUR_ANNUEL: Record<PeriodeVerbatim, number | null> = {
  annuel: 1,
  trimestriel: 4,
  mensuel: 12,
  // Un cumul depuis l origine et un montant ponctuel ne s annualisent
  // pas : les rapporter a une annee serait une divination.
  cumul: null,
  ponctuel: null,
};

/**
 * Operateurs qui font d un verbatim une expression et non une citation.
 *
 * UNE REGLE QUI DIT QUOI FOURNIR SANS DIRE CE QUE C EST SE SATISFAIT
 * PAR AUTRE CHOSE
 *
 * La regle disait « le chiffre tel que le document l ecrit ». Le run du
 * 6 aout 2026 l a satisfaite a la lettre avec
 * « 16,875 + 26,250 + 35,625 + 42,500 (Sep-Dec 2025, B2B Total) +
 * 8,000 x 4 (B2C) » : tous ces nombres sont dans le document, aucun n a
 * ete invente, et le champ cense porter une transcription portait une
 * operation.
 *
 * Ce que cela detruit est l objet meme du champ. Un verbatim sert a
 * comparer ce que la valeur affirme a ce que le document ecrit ;
 * evaluer une expression du modele pour faire cette comparaison
 * reviendrait a lui faire confiance sur la structure du calcul, donc a
 * deplacer le calcul du modele vers le champ cense le controler. Le run
 * montre pourquoi c est refuse : sur quatre lignes, le modele a oublie
 * une composante deux fois, et sur deux autres sa propre somme etait
 * juste alors que la valeur declaree ne la suivait pas.
 *
 * Un verbatim designe donc une cellule et jamais une operation. La
 * porte est que le modele omette la ligne quand le document ne porte
 * pas de total, plutot que de le fabriquer.
 */
const OPERATEURS = /[+×*\/]|(?<=\d)\s*-\s*(?=\d)/;

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
  natureDEcart: 'absence',
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
  /** Periode du verbatim. `annuel` par defaut : c est la forme attendue. */
  periode?: unknown;
}): ValeurCitee {
  const valeur = typeof entree.valeur === 'number' && Number.isFinite(entree.valeur)
    ? entree.valeur
    : null;

  const verbatim = typeof entree.verbatim === 'string' && entree.verbatim.trim().length > 0
    ? entree.verbatim.trim()
    : null;

  if (verbatim === null) return { ...SANS_VERBATIM, valeur };

  // L expression se refuse avant toute comparaison : elle ne rend pas la
  // valeur fausse, elle rend le controle impossible.
  if (OPERATEURS.test(verbatim)) {
    return {
      verbatim, valeur, fondee: false, cause: 'incident',
      motif: `le verbatim « ${verbatim.slice(0, 90)}${verbatim.length > 90 ? '...' : ''} » est une operation et non une cellule. `
        + 'Un verbatim designe un chiffre tel que le document l ecrit, a un seul endroit. Quand le document ne porte pas '
        + 'de total, la ligne s omet au lieu de se fabriquer.',
      valeurDuVerbatim: null, ecart: null, tolerance: null, natureDEcart: 'expression',
    };
  }

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
      natureDEcart: 'absence',
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
      natureDEcart: 'valeur',
    };
  }

  const periode: PeriodeVerbatim = typeof entree.periode === 'string'
    && (entree.periode in FACTEUR_ANNUEL) ? entree.periode as PeriodeVerbatim : 'annuel';

  const aligne = alignerEchelle(brut, valeur);
  const ecart = Math.abs(valeur - aligne);
  const tolerance = toleranceDArrondi(valeur);
  const fondee = ecart <= tolerance;

  // Un ecart qui s explique par la periode n est pas une erreur de
  // valeur, et le dire evite de traiter une unite comme une faute. Le
  // facteur n est pas applique a la valeur : le module ne corrige rien,
  // il nomme ce qui separe les deux nombres.
  // Le facteur s applique AVANT l alignement d echelle, et l ordre n est
  // pas indifferent. L alignement choisit la puissance de dix la plus
  // proche de la valeur declaree : aligner d abord ferait choisir
  // l echelle annuelle a un verbatim mensuel, puis multiplier par douze
  // rendrait l ecart douze fois pire. Le premier jet de ce test l a
  // montre, et il aurait fait conclure a une erreur de valeur sur
  // exactement les lignes que ce champ existe pour disculper.
  const facteur = FACTEUR_ANNUEL[periode];
  const expliqueParLaPeriode = !fondee && facteur !== null && facteur !== 1
    && Math.abs(valeur - alignerEchelle(brut * facteur, valeur)) <= tolerance;

  return {
    verbatim,
    valeur,
    fondee,
    cause: fondee ? null : 'incident',
    motif: fondee
      ? null
      : expliqueParLaPeriode
        ? `le verbatim « ${verbatim} » est ${periode} et la valeur ${valeur} est annuelle : l ecart s explique par la periode et non par la lecture, mais les deux ne se comparent pas en l etat`
        : `la valeur ${valeur} ne descend pas du verbatim « ${verbatim} », qui vaut ${aligne} a l echelle declaree : ecart ${ecart.toPrecision(3)} pour une tolerance d arrondi de ${tolerance}`,
    valeurDuVerbatim: aligne,
    ecart,
    tolerance,
    natureDEcart: fondee ? null : expliqueParLaPeriode ? 'periode' : 'valeur',
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
    evaluerValeurCitee({ verbatim: e?.verbatim, valeur: (e as any)?.valeur ?? e?.value, periode: (e as any)?.verbatimPeriode }));
  return {
    evaluees,
    nonFondees: evaluees.filter((e) => !e.fondee).length,
    sansVerbatim: evaluees.filter((e) => e.verbatim === null).length,
  };
}
