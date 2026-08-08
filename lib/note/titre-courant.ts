// ============================================================
// TITRE COURANT DE LA NOTE : CE QUI EST COMMUN AUX DEUX SUPPORTS
// ------------------------------------------------------------
// La note porte six titres de section pour quarante-huit mille pixels,
// soit un titre tous les huit mille. Une fenetre d ecran en contient
// donc un une fois sur cinq, et les quatre autres fois le lecteur voit
// des cartes, des rubriques et des scores sans savoir a quelle section
// ils appartiennent. Grossir le niveau haut ne peut rien y faire,
// puisque le defaut est qu il est hors champ. Il faut un repere qui
// voyage avec le lecteur, et c est ce qu un document imprime fait
// depuis toujours.
//
// Deux supports, deux mecanismes, et c est une mesure qui l a etabli
// plutot qu une supposition. Une sonde du 7 aout 2026 a rendu, sur un
// document de huit pages imprime par Chromium 151 : un element
// `position: sticky` present sur la page 1 et sur elle seule ; un
// `<thead>` de tableau present sur les huit ; un element
// `position: fixed` present sur les huit aussi, mais avec un contenu
// unique pour tout le document, donc incapable de nommer la section
// courante. L ecran prend le collant, l impression prend l en-tete de
// tableau, et rien d autre ne repond.
//
// CE QUI VIT ICI ET POURQUOI. Les deux dispositifs doivent nommer la
// meme chose. Deux lectures separees du nom de section auraient diverge
// au premier remaniement du titre, et la divergence n aurait rien casse :
// l ecran aurait dit une chose, le PDF une autre, tous deux plausibles.
// La lecture est donc unique, et ce module la porte.
//
// LA SECTION NE SE DECLARE NULLE PART. Elle se lit dans le rendu par sa
// classe. Une section ajoutee demain entre sans qu on y pense, une
// section retiree sort de meme. Une liste ecrite a la main aurait vieilli
// au premier remaniement de la note sans que rien le signale, puisque le
// bandeau aurait continue de rendre un nom plausible.
// ============================================================

export const SELECTEUR_SECTION = '.note-section';
export const SELECTEUR_TITRE = '.note-section-title';
export const SELECTEUR_NUM = '.note-section-num';

/** La classe du tableau qui porte l en-tete repete a l impression. */
export const CLASSE_TABLE_IMPRIMEE = 'note-tete-imprimee';
/** La classe de la cellule d en-tete, celle que Chromium repete. */
export const CLASSE_TETE_IMPRIMEE = 'note-tete-imprimee-titre';

/**
 * Le minimum structurel dont la lecture du nom a besoin.
 *
 * Il est declare plutot qu emprunte a `Element` pour que la fonction
 * s eprouve sans navigateur : un jeu d essai qui ne peut pas entrer par
 * la porte de la production finit par recopier la logique a cote, et une
 * copie ne mesure que son accord avec elle-meme.
 */
export interface NoeudLisible {
  textContent: string | null;
  querySelector(selecteur: string): NoeudLisible | null;
}

/**
 * Le nom d une section, sans son numero.
 *
 * Le numero vit dans un span propre, et il est retire : le repere porte
 * le nom de la section et rien d autre. Un « 4. » suspendu en haut de
 * page n oriente personne, et le numero est deja dans le sommaire.
 *
 * Rend la chaine vide quand la section ne porte pas de titre lisible.
 * Ce cas n est pas une anomalie a signaler, c est une section que le
 * repere doit laisser passer sans changer ce qu il affiche : dire
 * « rien » effacerait le nom de la section precedente, c est-a-dire
 * accuserait le lecteur d etre nulle part.
 */
export function nomDeSection(section: NoeudLisible | null): string {
  if (!section) return '';
  const titre = section.querySelector(SELECTEUR_TITRE);
  if (!titre) return '';
  // Les blancs se normalisent avant toute comparaison. Le titre est
  // ecrit sur plusieurs lignes de JSX, donc son texte porte des retours
  // et des indentations que rien d autre n enleve, y compris entre le
  // numero et le nom.
  const texte = (titre.textContent || '').replace(/\s+/g, ' ').trim();

  const num = titre.querySelector(SELECTEUR_NUM);
  const prefixe = (num?.textContent || '').replace(/\s+/g, ' ').trim();
  // On retire le numero par sa valeur lue et non par une expression
  // reguliere sur des chiffres : le jour ou la numerotation devient
  // « I. » ou « A. », la lecture suit sans qu on y touche.
  if (prefixe && texte.startsWith(prefixe)) {
    return texte.slice(prefixe.length).trim();
  }
  return texte;
}

/**
 * Les sections d une racine, en ordre de document, sans les imbriquees.
 *
 * L exclusion des imbriquees est une precaution et non un constat : la
 * note n en porte pas aujourd hui. Elle est ecrite parce que le remede
 * imprime enveloppe chaque section dans un tableau, et qu envelopper une
 * section deja enveloppee produirait deux en-tetes concurrents sur la
 * meme page, ce qui est pire que pas d en-tete du tout.
 */
export function sectionsDe(racine: ParentNode): Element[] {
  const toutes = Array.from(racine.querySelectorAll(SELECTEUR_SECTION));
  return toutes.filter(s => {
    const parent = s.parentElement;
    return !parent || !parent.closest(SELECTEUR_SECTION);
  });
}

/**
 * Enveloppe chaque section dans un tableau dont l en-tete porte son nom.
 *
 * C EST LE SEUL MECANISME QUI REPETE. Chromium n implemente pas les
 * boites de marge de la specification des medias pagines, et son
 * `headerTemplate` ne connait que le titre du document, l URL, la date et
 * le numero de page : rien qui puisse changer de section en section. Un
 * `<thead>`, lui, se reimprime en tete de chaque page occupee par son
 * tableau, et il porte donc un texte propre a chaque section. La sonde
 * citee en tete de fichier l a mesure avant que ce code soit ecrit.
 *
 * L ENVELOPPE EST POSEE AUTOUR ET NON DEDANS. La section n est pas
 * ouverte : elle descend telle quelle dans la cellule du corps. Tout
 * selecteur qui descend dans la section continue donc de s appliquer, et
 * le seul du depot qui regarde sa structure, `.note-section >
 * .note-h3:first-of-type`, ne voit aucune difference. Ouvrir la section
 * pour y glisser un en-tete aurait deplace son premier enfant, ce qui
 * aurait casse cette regle en silence.
 *
 * A N APPLIQUER QUE SUR UN CLONE. React possede le DOM rendu ; deplacer
 * ses noeuds sous lui le ferait echouer au prochain rendu, sur une erreur
 * de reconciliation qui n aurait aucun rapport lisible avec l impression.
 *
 * @returns le nombre de sections enveloppees, pour que l appelant puisse
 *   dire zero plutot que de le taire. Un zero ici ne veut pas dire que la
 *   note n a pas de sections, il veut dire que le clone n en portait pas,
 *   et les deux appellent des reponses opposees.
 */
export function poserLesTetesCourantes(racine: ParentNode, doc: Document): number {
  let posees = 0;
  for (const section of sectionsDe(racine)) {
    const nom = nomDeSection(section as unknown as NoeudLisible);
    if (!nom) continue;
    const parent = section.parentNode;
    if (!parent) continue;

    const table = doc.createElement('table');
    table.className = CLASSE_TABLE_IMPRIMEE;
    // Le tableau est un artifice de pagination et non une donnee
    // tabulaire. Il se declare comme tel, faute de quoi un lecteur
    // d ecran annoncerait a chaque section un tableau d une ligne et
    // d une colonne.
    table.setAttribute('role', 'presentation');

    const thead = doc.createElement('thead');
    const trTete = doc.createElement('tr');
    const th = doc.createElement('th');
    th.className = CLASSE_TETE_IMPRIMEE;
    th.textContent = nom;
    trTete.appendChild(th);
    thead.appendChild(trTete);

    const tbody = doc.createElement('tbody');
    const trCorps = doc.createElement('tr');
    const td = doc.createElement('td');
    trCorps.appendChild(td);
    tbody.appendChild(trCorps);

    table.appendChild(thead);
    table.appendChild(tbody);
    parent.replaceChild(table, section);
    td.appendChild(section);
    posees += 1;
  }
  return posees;
}
