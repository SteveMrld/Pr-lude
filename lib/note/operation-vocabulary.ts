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

import type { OperationType } from '@/lib/engines/types';

export const OPERATION_LABELS: Record<OperationType, string> = {
  'levee': 'Levee de fonds',
  'cession-partielle': 'Cession partielle',
  'cession-totale': 'Cession totale',
  'lbo': 'LBO',
  'non-etabli': 'Nature non etablie',
};

/** True pour les operations ou il n y a pas d entree au capital. */
export function estCession(t: OperationType | null | undefined): boolean {
  return t === 'cession-partielle' || t === 'cession-totale' || t === 'lbo';
}

/** Libelle du montant, dont la nature depend de l operation. */
export function libelleMontant(t: OperationType | null | undefined): string {
  if (t === 'levee') return 'Levee demandee';
  if (estCession(t)) return 'Prix ou valeur annonces';
  return 'Montant annonce';
}

/** Libelle de la contrepartie : investisseur lead sur une levee,
 *  conseil vendeur sur une cession. Le second remplace le premier et
 *  ne s y ajoute pas. */
export function libelleContrepartie(t: OperationType | null | undefined): string {
  return estCession(t) ? 'Conseil vendeur' : 'Investisseur lead';
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
