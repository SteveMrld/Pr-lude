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

/**
 * Un perimetre de composante porte indifferemment une part du capital
 * (« totalite des parts », « 100% ») ou une somme (« €10-15m »). Seul
 * le second peut tenir lieu de montant d operation, et le distinguer se
 * fait sur la forme et non sur le nom de la composante : une cession
 * peut porter un prix, un cash-in peut porter une quote-part.
 */
export function perimetreEstMontant(perimetre: unknown): boolean {
  if (typeof perimetre !== 'string') return false;
  const p = perimetre.trim();
  if (p.length === 0) return false;
  // Une part de capital n est pas un montant, meme chiffree.
  if (/%|pour ?cent|totalit|majorit|minorit|integralit/i.test(p)) return false;
  // Une somme porte une devise, sous forme de symbole, de code, ou de
  // suffixe de magnitude accole a un nombre.
  return /[€$£]|\b(?:eur|usd|gbp|k€|m€)\b|\d\s?(?:k|m|md|bn|mds?)\b/i.test(p);
}

/**
 * Provenance du montant affiche au tableau d operation.
 *
 * `amount` reste le champ de reference et n est jamais reecrit : la
 * valeur d un perimetre de composante ne dit pas la meme chose, elle
 * porte sur une composante et non sur l operation, et la recopier
 * effacerait cette difference. La lecture descend donc d un cran et le
 * declare, plutot que de remonter la valeur d un cran et de mentir sur
 * sa portee.
 *
 * Le cas est du 4 aout 2026 : sur un memorandum qui ecrit « Inject
 * 10-15m in cash-in to support the next growth phase », l extraction a
 * rendu `amount` vide avec la cause `non-rendu`, tandis que la
 * composante cash-in portait « 10-15m » avec sa citation. Le tableau
 * affichait une ligne vide en premiere page alors que la donnee etait
 * dans le resultat, a un champ de la.
 */
export type ProvenanceMontant = 'champ-operation' | 'perimetre-de-composante' | 'absent';

export function montantAffiche(fundraise: any): {
  valeur: string | null;
  citation: string | null;
  provenance: ProvenanceMontant;
  /** Composante dont le perimetre a ete lu, quand c est le cas. */
  composante: string | null;
} {
  const amount = typeof fundraise?.amount === 'string' ? fundraise.amount.trim() : '';
  if (amount.length > 0) {
    return {
      valeur: amount,
      citation: typeof fundraise?.amountEvidence === 'string' && fundraise.amountEvidence.trim().length > 0
        ? fundraise.amountEvidence : null,
      provenance: 'champ-operation',
      composante: null,
    };
  }
  for (const c of composantesDe(fundraise)) {
    if (!perimetreEstMontant((c as any).perimetre)) continue;
    return {
      valeur: String((c as any).perimetre).trim(),
      citation: typeof (c as any).evidence === 'string' && (c as any).evidence.trim().length > 0
        ? (c as any).evidence : null,
      provenance: 'perimetre-de-composante',
      composante: c.kind,
    };
  }
  return { valeur: null, citation: null, provenance: 'absent', composante: null };
}

/** Libelle de la composante, pour declarer d ou vient un montant lu bas. */
export const LIBELLE_COMPOSANTE: Record<string, string> = {
  'cash-in': 'cash-in',
  cession: 'cession',
  dette: 'dette',
};

/**
 * Cedant affiche au tableau d operation.
 *
 * Le champ `seller` est un champ de synthese : le modele le redige a
 * partir de sa lecture, et la mesure de stabilite du depot etablit que
 * les champs de synthese derivent d un tirage a l autre la ou les
 * champs de copie tiennent caractere pour caractere. Sur le dossier
 * gele, il a rendu « Iris Capital, Next47, equipe fondatrice (dont
 * Helene Olphe-Galliard) » sur un run et « Iris Capital, Next47, Helene
 * Olphe-Galliard, equipe fondatrice » sur un autre, donc une personne
 * physique nommee comme cedante a part entiere selon le tirage, dans un
 * document vendu a des fonds.
 *
 * La citation de la composante `cession` est un champ de copie : elle
 * est stable, elle est verifiable, et le cedant s y lit ou nulle part.
 * On la prefere donc au champ redige des que celui-ci n est pas lui-meme
 * cite, plutot que d imprimer un nom propre que rien ne fonde.
 */
export type ProvenanceCedant = 'champ-cite' | 'citation-de-composante' | 'absent';

export function cedantAffiche(fundraise: any): {
  valeur: string | null;
  citation: string | null;
  provenance: ProvenanceCedant;
} {
  const seller = typeof fundraise?.seller === 'string' ? fundraise.seller.trim() : '';
  const evidence = typeof fundraise?.sellerEvidence === 'string' ? fundraise.sellerEvidence.trim() : '';
  if (seller.length > 0 && evidence.length > 0) {
    return { valeur: seller, citation: evidence, provenance: 'champ-cite' };
  }
  const cession = composantesDe(fundraise).find((c) => c.kind === 'cession');
  const citation = typeof (cession as any)?.evidence === 'string' ? (cession as any).evidence.trim() : '';
  if (citation.length > 0) {
    return { valeur: null, citation, provenance: 'citation-de-composante' };
  }
  return { valeur: null, citation: null, provenance: 'absent' };
}
