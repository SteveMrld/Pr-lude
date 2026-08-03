// ============================================================
// MOTIFS DE NON-LECTURE
// ------------------------------------------------------------
// Un motif de refus dit ce que le pipeline sait, jamais ce que le
// document contient.
//
// « Aucun montant annonce » etait la phrase que la note servait au
// partner quand le moteur de valorisation n avait pas de ticket. Elle
// est fausse de tout dossier qui en porte un que la lecture a manque,
// et elle l est en silence : le partner y lit une propriete du dossier,
// donc il ne redemande rien, donc la lacune de lecture ne remonte
// jamais. C est la meme dissymetrie que le battement absent, un fait
// negatif dont personne ne fait un evenement.
//
// Le pipeline ne peut pas savoir si un document est muet. Il sait ce
// que le modele lui a rendu et ce que la garde de citation a accepte.
// Ces deux choses se disent, et rien de plus.
//
// La fonction vit ici plutot que dans chacun des deux moteurs qui en
// ont besoin, parce qu une regle recopiee est une regle qui divergera :
// la phrase du moteur de valorisation et celle du moteur de benchmarks
// repondent a la meme question et doivent rester la meme reponse. C est
// le point de passage unique, la premiere des trois formes de portage
// d une regle ecrite.
// ============================================================

import type { LectureChampCause } from './types';

/** Ce dont on dit qu il n a pas ete lu, au singulier et sans article. */
export type ChampChiffre = 'montant' | 'valorisation';

const PHRASES: Record<ChampChiffre, { nonRendu: string; nonCite: string }> = {
  montant: {
    nonRendu: 'montant non extrait du dossier',
    nonCite: 'un montant figurait dans la lecture du dossier sans citation pour le fonder, il a ete refuse',
  },
  valorisation: {
    nonRendu: 'valorisation non extraite du dossier',
    nonCite: 'une valorisation figurait dans la lecture du dossier sans citation pour la fonder, elle a ete refusee',
  },
};

/**
 * Phrase de non-lecture d un champ chiffre de l extraction.
 *
 * Trois etats, trois phrases, et aucune ne prononce le document muet.
 *
 *   'non-cite'  : le modele a rendu une valeur qu aucune citation ne
 *                 fondait, la garde l a refusee. Le dossier en porte
 *                 donc vraisemblablement une, et c est l information la
 *                 plus utile des trois : il y a quelque chose a aller
 *                 chercher.
 *   'non-rendu' : le modele n a rien rendu. Le dossier peut en porter
 *                 une ou non, on n en sait rien, et la phrase ne
 *                 tranche pas.
 *   absent      : analyse anterieure au contrat de citation, ou la
 *                 question n etait pas posee. Son silence n est pas une
 *                 reponse, donc elle recoit la phrase prudente.
 */
export function motifChampNonLu(
  champ: ChampChiffre,
  cause: LectureChampCause | null | undefined,
): string {
  const p = PHRASES[champ];
  return cause === 'non-cite' ? p.nonCite : p.nonRendu;
}

/**
 * Lit la cause de non-lecture portee par une extraction, sans supposer
 * que le champ existe. Une analyse persistee avant le 3 aout 2026 n en
 * porte pas, et l absence du champ vaut « on ne sait pas », jamais
 * « le document ne porte rien ».
 */
export function causeChamp(
  extraction: unknown,
  champ: ChampChiffre,
): LectureChampCause | null | undefined {
  const fr = (extraction as any)?.fundraise;
  if (!fr) return undefined;
  return champ === 'montant' ? fr.amountCause : fr.valuationCause;
}
