// ============================================================
// VOCABULAIRE DE L OPERATION
// ------------------------------------------------------------
// La note parlait de tour, de levee demandee et de lead investor sur
// tous les dossiers, parce que le pipeline ne connaissait que la
// levee. Sur un memorandum de cession, chacun de ces mots est faux.
//
// Les libelles vivent ici et non dans les composants : la note ne doit
// pas pouvoir nommer une operation autrement que le contrat qui l a
// extraite, de la meme facon que les libelles de nature de valeur
// viennent du moteur de valorisation.
//
// 'non-etabli' ne bascule rien vers le vocabulaire de cession. Le
// pipeline ne sait pas, donc il garde une formulation neutre et le dit.
// ============================================================

import type { OperationComponent, OperationComponentKind, OperationType } from '@/lib/engines/types';
import { composantesDepuisTypeHerite } from '@/lib/engines/operation-components';

/**
 * Lecture canonique des composantes d une operation. Point d entree
 * unique de tous les consommateurs depuis le 3 aout 2026.
 *
 * Il lit `operationComponents` quand il existe, et reconstitue les
 * composantes depuis le type herite sinon. Ce n est pas une seconde
 * source de verite : la reconstitution ne s applique qu a des analyses
 * ou les composantes n existent pas, et elle ne produit jamais une
 * composante que le type ne contenait pas deja.
 */
export function composantesDe(fundraise: any): OperationComponent[] {
  const c = fundraise?.operationComponents;
  if (Array.isArray(c) && c.length > 0) return c as OperationComponent[];
  return composantesDepuisTypeHerite(fundraise?.operationType, fundraise?.operationTypeEvidence) as OperationComponent[];
}

export function porte(fundraise: any, kind: OperationComponentKind): boolean {
  return composantesDe(fundraise).some((c) => c.kind === kind);
}

/**
 * True quand l operation porte a la fois une entree d argent dans la
 * societe et une sortie de titres. C est le cas que le type unique ne
 * savait pas dire, et il est courant sur les memorandums.
 */
export function estMixte(fundraise: any): boolean {
  return porte(fundraise, 'cash-in') && porte(fundraise, 'cession');
}

/**
 * Libelle de la nature de l operation, composee. « Cession avec
 * reinvestissement » plutot qu un type dominant qui tairait une moitie
 * du document.
 */
export function libelleNature(fundraise: any): string {
  const comps = composantesDe(fundraise);
  if (comps.length === 0) return 'Nature non etablie';
  const cash = porte(fundraise, 'cash-in');
  const cess = porte(fundraise, 'cession');
  const dette = porte(fundraise, 'dette');
  if (cash && cess) return dette ? 'Operation mixte avec effet de levier' : 'Operation mixte, cession et cash-in';
  if (cess) return dette ? 'Cession avec effet de levier' : 'Cession';
  if (cash) return 'Levee de fonds';
  return 'Operation a effet de levier';
}

export const OPERATION_LABELS: Record<OperationType, string> = {
  'levee': 'Levee de fonds',
  'cession-partielle': 'Cession partielle',
  'cession-totale': 'Cession totale',
  'lbo': 'LBO',
  'non-etabli': 'Nature non etablie',
};

/**
 * True quand l operation comporte une cession de titres.
 *
 * La fonction ne repond plus par oui ou non a « est-ce une cession » :
 * elle repond a « comporte-t-elle une cession », qui est la question
 * qu on lui posait deja sans le dire. Sur une operation mixte la
 * reponse est oui, et les appelants qui ont besoin de savoir si elle
 * est AUSSI un cash-in lisent estMixte.
 */
export function estCession(fundraiseOuType: any): boolean {
  if (typeof fundraiseOuType === 'string' || fundraiseOuType === null || fundraiseOuType === undefined) {
    const t = fundraiseOuType as OperationType | null | undefined;
    return t === 'cession-partielle' || t === 'cession-totale' || t === 'lbo';
  }
  return porte(fundraiseOuType, 'cession');
}

/**
 * Libelle du montant. Sur une operation mixte il nomme les deux
 * natures, parce qu un seul libelle en tairait une : le montant du
 * cash-in et le prix des titres ne mesurent pas la meme chose et ne
 * vont pas dans la meme poche.
 */
export function libelleMontant(fundraiseOuType: any): string {
  if (typeof fundraiseOuType === 'string' || fundraiseOuType === null || fundraiseOuType === undefined) {
    const t = fundraiseOuType as OperationType | null | undefined;
    if (t === 'levee') return 'Levee demandee';
    if (estCession(t)) return 'Prix ou valeur annonces';
    return 'Montant annonce';
  }
  const cash = porte(fundraiseOuType, 'cash-in');
  const cess = porte(fundraiseOuType, 'cession');
  if (cash && cess) return 'Cash-in demande et prix des titres cedes';
  if (cess) return 'Prix ou valeur annonces';
  if (cash) return 'Levee demandee';
  return 'Montant annonce';
}

/** Libelle de la contrepartie : investisseur lead sur une levee,
 *  conseil vendeur sur une cession. Le second remplace le premier et
 *  ne s y ajoute pas. */
export function libelleContrepartie(fundraiseOuType: any): string {
  if (typeof fundraiseOuType === 'object' && fundraiseOuType !== null && estMixte(fundraiseOuType)) {
    return 'Conseil vendeur et investisseur entrant';
  }
  return estCession(fundraiseOuType) ? 'Conseil vendeur' : 'Investisseur lead';
}

/**
 * Mention portee par un LBO. Ecrite comme une production et non comme
 * un avertissement technique, sur le modele de la mention de peremption
 * du brief 23 : elle dit au lecteur ce que le dossier ne contient pas,
 * ce qui est en soi un resultat d instruction.
 */
export const MENTION_LBO =
  "Operation structuree en LBO. La structure de dette d acquisition, qui determine le rendement de l operation autant que le prix paye, n est pas documentee dans le dossier instruit : le contrat d extraction financiere ne porte ni dette financiere, ni tresorerie, ni besoin en fonds de roulement. Le partner instruit ici l actif, pas le montage.";

/** Mention portee quand le type n a pas pu etre etabli. */
export const MENTION_TYPE_NON_ETABLI =
  "La nature de l operation n a pas pu etre etablie a partir du document : aucune citation ne fonde une levee, une cession ni un LBO. Les methodes de valorisation tournent donc sans neutralisation, et le vocabulaire ci-dessous reste neutre. A confirmer avec le partner avant de lire les chiffres comme ceux d un tour de table.";
