// ============================================================
// GARDES DE L INSTRUMENT DE CAPTURE
// ------------------------------------------------------------
// Ecrit le 7 aout 2026, apres qu une passe apres eut rendu vingt-cinq
// images identiques octet pour octet a leur reference en annoncant
// vingt-cinq capturees et zero en echec.
//
// La logique vit ici plutot que dans scripts/note-capture.ts parce
// qu un jeu d essai doit entrer par la porte de la production. Recopier
// ces fonctions dans un test mesurerait leur accord avec la copie et
// non leur justesse, ce que le depot a deja paye une fois sur la garde
// post-parse du type d operation.
//
// Ce module ne connait ni le navigateur ni le systeme de fichiers : il
// prend des chaines et des empreintes et rend des verdicts. Le harnais
// lui fournit ce qu il a lu.
// ============================================================

import { createHash } from 'crypto';

/** Ce que globals.css declare, partage en comparable et en indirect. */
export type JetonsDeclares = {
  /** Jetons a valeur litterale, comparables a ce que le navigateur calcule. */
  compares: Record<string, string>;
  /** Jetons dont la valeur passe par un var() : le navigateur rend la
   *  valeur substituee, la comparaison textuelle rougirait sans rien
   *  apprendre. Ecartes, mais nommes : un perimetre declare ce qu il ne
   *  couvre pas. */
  ecartes: string[];
};

/**
 * Lit les jetons de la note dans le premier bloc :root d une feuille.
 *
 * La liste ne s ecrit pas a la main : elle se derive du prefixe, si
 * bien qu un jeton ajoute demain entre dans la comparaison sans qu on
 * y pense. C est la difference entre une liste qui constate et une
 * liste qui vieillit.
 */
export function jetonsDeclares(css: string, prefixe = '--note-'): JetonsDeclares {
  const debut = css.indexOf(':root {');
  if (debut < 0) throw new Error('feuille : bloc :root introuvable');
  const fin = css.indexOf('\n}', debut);
  if (fin < 0) throw new Error('feuille : fin du bloc :root introuvable');
  const bloc = css.slice(debut, fin);

  const motif = new RegExp(`^\\s*(${prefixe.replace(/[-]/g, '\\-')}[a-z0-9-]+)\\s*:\\s*([^;]+);`);
  const compares: Record<string, string> = {};
  const ecartes: string[] = [];
  for (const l of bloc.split('\n')) {
    const m = l.match(motif);
    if (!m) continue;
    const [, nom, valeur] = m;
    if (valeur.includes('var(')) ecartes.push(nom);
    else compares[nom] = valeur.trim();
  }
  if (Object.keys(compares).length === 0) {
    throw new Error(`feuille : aucun jeton ${prefixe} a valeur litterale`);
  }
  return { compares, ecartes };
}

export type Divergence = { jeton: string; depot: string; servi: string };

/**
 * Compare ce que le depot declare a ce que le navigateur calcule.
 *
 * Un jeton absent du servi compte comme divergent et non comme non
 * mesure : une feuille qui ne porte pas le jeton n est pas la feuille
 * du depot. Le repli vaut chaine vide pour que le message le dise.
 */
export function divergencesJetons(
  depot: Record<string, string>,
  servi: Record<string, string>,
): Divergence[] {
  const out: Divergence[] = [];
  for (const [jeton, attendu] of Object.entries(depot)) {
    const rendu = (servi[jeton] ?? '').trim();
    if (rendu !== attendu) out.push({ jeton, depot: attendu, servi: rendu });
  }
  return out;
}

export function empreinte(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex');
}

export type VersusReference = 'differe' | 'identique' | 'sans-reference';

/**
 * Classe une capture face a sa reference.
 *
 * Les trois etats ne se replient pas l un sur l autre. Une image sans
 * contrepartie n est ni differente ni identique : la compter parmi les
 * differentes gonflerait le denominateur de la garde et lui ferait
 * annoncer une couverture qu elle n a pas.
 */
export function classerVersusReference(
  empreinteCapture: string,
  empreinteReference: string | undefined,
): VersusReference {
  if (empreinteReference === undefined) return 'sans-reference';
  return empreinteReference === empreinteCapture ? 'identique' : 'differe';
}

export type VerdictIdentite = {
  /** Faux quand au moins une capture reproduit sa reference. */
  conforme: boolean;
  differentes: number;
  identiques: number;
  sansReference: number;
};

/**
 * Rend le verdict d une passe declaree comme un apres.
 *
 * Une seule identite suffit a condamner la passe. Le raisonnement se
 * derive et ne se decrete pas : les jetons de la note sont globaux,
 * l attente de la capture porte sur `.note-section-title`, donc toute
 * note capturee rend au moins un titre qui consomme un jeton modifie.
 * Une image qui ne bouge pas dit alors quelque chose de l instrument,
 * jamais du produit.
 *
 * Sur une passe qui n est pas declaree comme un apres, il n y a rien a
 * comparer et la garde se tait : c est la declaration qui fait de
 * l identite un incident, pas l identite seule.
 */
export function verdictIdentite(etats: VersusReference[]): VerdictIdentite {
  const identiques = etats.filter(e => e === 'identique').length;
  return {
    conforme: identiques === 0,
    differentes: etats.filter(e => e === 'differe').length,
    identiques,
    sansReference: etats.filter(e => e === 'sans-reference').length,
  };
}
