// ============================================================
// Tests deterministes de la lecture du nom de section
// ------------------------------------------------------------
// Le defaut constate dont ils naissent : le 7 aout 2026, la note
// portait six titres de section pour quarante-huit mille pixels, donc
// une fenetre d ecran sur cinq en contenait un. Le repere qui repond a
// cela nomme la section courante, a l ecran et sur papier, et les deux
// supports lisent ce nom par cette fonction. Une seconde lecture aurait
// diverge sans rien casser : l ecran aurait dit une chose, le PDF une
// autre, toutes deux plausibles.
//
// LA LISTE DES MUTATIONS SE DERIVE DES AXES, PAS DE L INTENTION
//
// La lecture decide cinq choses : ou elle prend le texte, ce qu elle
// fait des espaces, ce qu elle retire en tete, ce qu elle rend quand il
// n y a pas de titre, et ce qu elle rend quand le titre est vide. Il
// faut donc cinq mutations, et chacune dans les deux sens quand cela a
// un sens : la fonction doit retirer le numero quand il est la, et ne
// rien retirer quand ce qui lui ressemble n en est pas un. Le premier
// sens prouve qu elle voit, le second qu elle discrimine.
//
// CE QU ILS NE COUVRENT PAS. L enveloppe imprimee, `poserLesTetesCourantes`,
// construit des noeuds et n entre pas ici : elle demande un DOM, et le
// depot n en porte pas hors navigateur. Elle se verifie par le PDF
// produit, ou l on compte sur combien de pages l en-tete se redessine,
// ce qui est une mesure plus forte qu une assertion sur des noeuds.
//
// Execution : npx tsx lib/note/titre-courant.test.ts
// ============================================================

import { nomDeSection, type NoeudLisible } from './titre-courant';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/**
 * Une section de fixture, reduite a ce que la lecture regarde.
 *
 * Elle entre par la porte de la production : la fonction testee est
 * celle qui est exportee, et l interface `NoeudLisible` existe pour que
 * ce jeu d essai n ait pas a recopier la logique a cote. Une copie ne
 * mesurerait que son accord avec elle-meme.
 */
function section(opts: { titre?: string; num?: string }): NoeudLisible {
  const num: NoeudLisible | null = opts.num === undefined
    ? null
    : { textContent: opts.num, querySelector: () => null };
  const titre: NoeudLisible | null = opts.titre === undefined
    ? null
    : {
        textContent: opts.titre,
        querySelector: (s: string) => (s === '.note-section-num' ? num : null),
      };
  return {
    textContent: opts.titre ?? null,
    querySelector: (s: string) => (s === '.note-section-title' ? titre : null),
  };
}

// AXE 1 : ou le texte se prend.
check(
  nomDeSection(section({ titre: 'Modalités' })) === 'Modalités',
  'le nom se lit dans le titre de section',
);
check(
  nomDeSection(section({})) === '',
  'une section sans titre ne rend rien, plutot qu un nom devine',
);

// AXE 2 : les espaces. Le DOM rend l espace entre le span du numero et
// le nom, plus l indentation du JSX ; sans normalisation le bandeau
// afficherait des blancs multiples.
check(
  nomDeSection(section({ titre: '4.\n        Modalités  ', num: '4.' })) === 'Modalités',
  'les blancs qui bordent le nom sont retires',
);
check(
  // La mutation qui a survecu au premier tirage. Le cas precedent ne
  // mesurait rien de la normalisation : le rognage des bords suffisait
  // a le rendre vert, si bien qu une lecture sans normalisation passait.
  // Ce qu il faut exercer est le blanc INTERIEUR, celui qu un titre
  // ecrit sur deux lignes de JSX porte entre ses mots.
  nomDeSection(section({ titre: '6.  Suivi\n          & réconciliation', num: '6.' }))
    === 'Suivi & réconciliation',
  'les blancs interieurs sont normalises, pas seulement rognes aux bords',
);

// AXE 3 : le numero se retire, et les deux sens comptent.
check(
  nomDeSection(section({ titre: '4. Modalités', num: '4.' })) === 'Modalités',
  'le numero en tete se retire',
);
check(
  // Le sens qui discrimine. Le numero se retire par sa valeur lue et non
  // par une expression sur des chiffres : une numerotation romaine passe
  // sans qu on touche a la fonction, et c est ce que cette assertion
  // etablit. Une implementation par regex sur \d+ rendrait « I. Thèse ».
  nomDeSection(section({ titre: 'I. Thèse', num: 'I.' })) === 'Thèse',
  'une numerotation non chiffree se retire aussi, la lecture ne suppose pas de chiffre',
);
check(
  // L autre sens qui discrimine. Ce qui ressemble a un numero mais que
  // le titre ne porte pas en tete ne se retire pas : couper a l aveugle
  // sur la longueur du span mangerait les premiers caracteres du nom.
  nomDeSection(section({ titre: 'Modalités', num: '4.' })) === 'Modalités',
  'un numero absent du debut du titre ne fait rien couper',
);
check(
  nomDeSection(section({ titre: 'Modalités' })) === 'Modalités',
  'un titre sans span de numero se rend entier',
);

// AXE 4 : l absence de section. Le composant d ecran appelle la lecture
// sur chaque section rencontree ; un noeud nul ne doit pas lever au
// milieu d un defilement.
check(
  nomDeSection(null) === '',
  'une section absente rend la chaine vide plutot que de lever',
);

// AXE 5 : le titre vide. Il ne se distingue pas d une absence pour le
// consommateur, et c est voulu : dire « rien » effacerait le nom de la
// section precedente, c est-a-dire annoncerait au lecteur qu il n est
// nulle part.
//
// Cet axe n a pas de branche propre dans la fonction, et c est un
// constat plutot qu un oubli. Le premier tirage en portait une, et une
// mutation qui la retirait laissait la suite entierement verte : un
// titre blanc rend la chaine vide par le chemin ordinaire, la branche
// ne changeait donc aucun resultat. Elle a ete retiree du code plutot
// que couverte par une assertion de plus, qui aurait mesure l existence
// d une ligne et non un comportement.
check(
  nomDeSection(section({ titre: '   ', num: '4.' })) === '',
  'un titre blanc rend la chaine vide, que le bandeau ignore',
);

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail === 0 ? 0 : 1);
