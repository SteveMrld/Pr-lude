// ============================================================
// OUVERTURE DE LA NOTE POUR UN INSTRUMENT DE CAPTURE
//
// Ce module existe pour une raison et une seule : la page d un
// dossier ouvre sur le tableau de bord, et la note vit derriere un
// bouton. Un instrument qui l ignore photographie le tableau de bord,
// rend une serie parfaitement coherente, et ne mesure rien de la note.
// C est l incident du 7 aout 2026, ecrit au registre : vingt-cinq
// images de reference qui montraient le mauvais ecran, et une passe
// apres identique octet pour octet qui s annoncait comme un succes.
//
// La navigation vit donc ici plutot que dans le script qui capture,
// parce qu il y a desormais deux instruments qui en ont besoin, la
// passe de corpus et les vues de lecture. Recopier la bascule dans le
// second aurait reconduit l incident par le seul chemin qui restait :
// le jour ou le libelle du bouton change, un des deux le suit et
// l autre recommence a photographier le tableau de bord, en silence
// et avec la meme apparence de succes.
// ============================================================

import type { Page } from 'puppeteer-core';

// Le libelle du bouton de bascule. Il vit ici, en un seul endroit,
// pour la raison ci-dessus. Ce n est pas une propriete observable au
// sens de la doctrine des listes, c est un contrat avec l interface :
// s il change, l instrument doit echouer bruyamment plutot que de se
// rabattre sur ce qu il trouve. C est ce que fait `bascule === false`.
export const LIBELLE_BASCULE = "Note d'investissement";

/**
 * Dit si le libelle de bascule existe encore dans la vue, hors
 * commentaires.
 *
 * La portee de ce controle se declare, parce qu il est plus faible
 * qu il n en a l air. Il etablit que la chaine subsiste dans le source,
 * pas qu elle etiquette le bouton de bascule : un libelle deplace sur
 * un autre bouton le satisferait. Ce qui prouve reellement le lien est
 * l echec dur de l instrument, `bouton de bascule vers la note
 * introuvable`, qui arrete la passe sans ecrire d image. Ce controle-ci
 * sert a ce que la rupture se voie a la suite de tests plutot qu au
 * milieu d une passe de vingt-cinq minutes.
 *
 * Les commentaires sont retires avant lecture, et ce n est pas un
 * detail de forme : la ligne qui precede le bouton dans HomeClient est
 * un commentaire qui nomme le libelle. Un controle qui les garderait
 * resterait vert apres le renommage du bouton, en lisant la phrase qui
 * decrit ce qui n existe plus. C est la garde inerte dans sa forme la
 * plus ordinaire, verte pour la mauvaise raison.
 *
 * Les entites JSX sont decodees pour la meme raison : le source ecrit
 * `Note d&apos;investissement` et le DOM rend une apostrophe. Comparer
 * le libelle au source brut echouerait sur un bouton parfaitement sain.
 */
export function libelleBasculePresent(source: string): boolean {
  const sansCommentaires = source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
  const decode = sansCommentaires
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, '’');
  // Le JSX coupe ses lignes ou il veut : le libelle peut arriver
  // decoupe par une indentation. On compare donc sur les espaces
  // normalises plutot que sur la chaine telle qu elle est ecrite.
  const plat = decode.replace(/\s+/g, ' ');
  return plat.includes(LIBELLE_BASCULE);
}

// Un selecteur PROPRE a la note. Le repli sur `.dashboard-content` de
// la premiere version matchait dans les deux vues, donc l attente
// reussissait sur la mauvaise chose : un selecteur qui ne peut pas
// echouer est une garde inerte.
const SELECTEUR_NOTE = '.note-section-title';

export type OuvertureNote = {
  hauteur: number;
};

/**
 * Charge le dossier, bascule sur la note, attend qu elle soit rendue,
 * et rend la hauteur du document.
 *
 * La hauteur est rendue plutot que laissee a l appelant parce qu elle
 * est la grandeur qui recuse une serie : c est elle qui a etabli que
 * les images de reference montraient le tableau de bord, cinq mille
 * neuf cent quatre-vingt-trois pixels contre quarante-cinq mille deux
 * cent trente-quatre. Un instrument qui la rapporte porte de quoi se
 * recuser lui-meme ; il reste a la lire.
 */
export async function ouvrirLaNote(
  page: Page,
  base: string,
  id: string,
): Promise<OuvertureNote> {
  await page.goto(`${base}/dossiers/${id}`, { waitUntil: 'networkidle0', timeout: 90_000 });

  // Le clic se fait dans la page plutot que par un handle : le handle
  // rendu par evaluateHandle porte un Node et non un Element, ce que le
  // typage de puppeteer refuse a bon droit, puisque rien ne garantit
  // qu un Node soit cliquable.
  const bascule: boolean = await page.evaluate((libelle: string) => {
    const boutons = Array.from(document.querySelectorAll('button'));
    const b = boutons.find(x => (x.textContent || '').trim().startsWith(libelle));
    if (!b) return false;
    b.click();
    return true;
  }, LIBELLE_BASCULE);
  if (!bascule) throw new Error('bouton de bascule vers la note introuvable');

  await page.waitForSelector(SELECTEUR_NOTE, { timeout: 45_000 });
  await new Promise(r => setTimeout(r, 1800));

  const hauteur = await page.evaluate(() => document.body.scrollHeight);
  return { hauteur };
}
