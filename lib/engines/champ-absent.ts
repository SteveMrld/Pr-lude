// ============================================================
// CHAMP ABSENT
// ------------------------------------------------------------
// Une garde inerte est plus dangereuse qu une garde absente, parce
// qu elle a la forme d une garde.
//
// Le contrat d extraction dit, depuis l origine et dans le prompt lui
// meme : « Si une information n est pas presente dans le deck, retourne
// une chaine vide "" ». Les prompts des moteurs en aval se gardaient
// contre null : `${extraction.fundraise?.amount ?? '?'}`. L operateur
// de coalescence ne rattrape ni la chaine vide ni les blancs, donc la
// garde ne se declenchait jamais sur le cas qu elle visait, et le
// modele recevait « Montant annonce : » suivi de rien.
//
// Ce que le modele fait d une ligne tronquee n est pas neutre. Il ne
// voit pas un champ vide, il voit une phrase interrompue, et il la
// comble comme le reste de sa lecture. La garde ecrite pour eviter
// exactement cela le favorisait.
//
// La faute ne se voit pas a la relecture : le code a la forme correcte,
// il nomme le bon champ, il pose le bon defaut, et il ne lui manque que
// d etre vrai. C est ce qui la distingue d une garde oubliee, laquelle
// se cherche et se trouve. Une garde inerte ne se cherche pas, puisque
// rien ne manque.
//
// D ou cette fonction plutot qu un `|| '?'` ecrit six fois. La regle
// « une chaine vide vaut absence » a un seul endroit ou elle vit, et le
// test compagnon refuse qu une coalescence nulle reapparaisse en face
// d un champ dont le contrat dit qu il vaudra la chaine vide.
// ============================================================

/** Ce que le prompt lit quand le pipeline n a rien a mettre. */
export const CHAMP_NON_RENSEIGNE = 'non renseigne';

/**
 * Rend la valeur, ou la mention d absence quand il n y a rien a rendre.
 *
 * Absent veut dire null, undefined, chaine vide, ou chaine de blancs.
 * Les trois derniers sont ce que le contrat d extraction produit, et
 * c est exactement ce que la coalescence nulle laissait passer.
 *
 * Zero n est pas absent : un score de zero est un score, et le
 * confondre avec un champ non rempli est la faute symetrique, celle
 * que `|| ` commet la ou `??` echouait.
 */
export function champ(valeur: unknown, defaut: string = CHAMP_NON_RENSEIGNE): string {
  if (valeur === null || valeur === undefined) return defaut;
  const s = typeof valeur === 'string' ? valeur.trim() : String(valeur).trim();
  return s.length > 0 ? s : defaut;
}
