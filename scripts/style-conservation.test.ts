// ============================================================
// Tests deterministes du controle de conservation du style
// ------------------------------------------------------------
// Ce que ces tests prouvent : le controle voit ses SEPT axes, et pas
// seulement les trois qu on avait en tete en l ecrivant.
//
// POURQUOI ILS EXISTENT
//
// Le controle a ete eprouve le 7 aout 2026 par trois mutations sur
// fichiers reels : retirer une regle, la recopier, la deplacer sans son
// JSX. Les trois rougissaient, et le controle a ete declare confronte.
// Il portait pourtant deux defauts que ces mutations ne pouvaient pas
// atteindre, l attribution de portee et l ordre de cascade, et le
// second lui faisait annoncer la mauvaise valeur gagnante.
//
// La lecon est le corollaire de la discipline des jeux d essai. Une
// mutation prouve qu un controle voit ce qu on lui montre ; elle ne dit
// rien de ce qu on ne lui a pas montre. La liste des mutations se
// derive donc des axes du controle, et non de ce qu on avait en tete au
// moment de l ecrire.
//
// LES SEPT AXES
//
//   1. conservation : une regle retiree se voit
//   2. duplication  : une regle recopiee le long de la relation se voit
//   3. orphelinat   : une regle chez qui ne rend pas sa classe se voit
//   4. portee       : deux portees distinctes ne se confondent pas
//   5. cascade      : la valeur annoncee gagnante est bien la derniere
//   6. couverture   : une classe rendue dans une portee que sa portee
//                     ne style pas, alors qu une autre la style
//   7. contexte     : une regle deplacee hors de son encadrement media
//                     est nommee comme telle, pas en perte + apparition
//
// Chaque axe est eprouve dans LES DEUX SENS quand cela a un sens : le
// controle doit rougir sur la faute et se taire sur le cas sain voisin.
// Un controle qui rougit toujours ne discrimine pas davantage qu un
// controle qui se tait toujours.
//
// Les tests entrent par la porte de production, `relever()`, avec des
// sources en memoire plutot qu une copie de sa logique.
//
// Execution : npx tsx scripts/style-conservation.test.ts
// ============================================================

import { relever, type Sources } from './style-conservation';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Un fichier de composant minimal, avec son bloc de style. */
function composant(nom: string, classes: string[], css: string, imports = ''): string {
  return `${imports}
function ${nom}() {
  return (
    <div>
      ${classes.map(c => `<span className="${c}" />`).join('\n      ')}
      <style jsx>{\`
${css}
      \`}</style>
    </div>
  );
}
`;
}

const PARENT = 'app/components/InvestmentNoteView.tsx';
const ENFANT = 'app/components/note/Bloc.tsx';

(() => {
  // ============================================================
  console.log('\n[Axe 1] conservation : une regle retiree se voit');
  // ============================================================
  {
    const avant = relever({ [PARENT]: composant('InvestmentNoteView', ['a', 'b'], '.a { color: red; }\n.b { color: blue; }') });
    const apres = relever({ [PARENT]: composant('InvestmentNoteView', ['a', 'b'], '.a { color: red; }') });
    check(Object.keys(avant.regles).length === 2, 'deux regles avant');
    check(Object.keys(apres.regles).length === 1, 'une regle apres : la perte est visible');
  }

  // ============================================================
  console.log('\n[Axe 2] duplication : le long de la relation, et pas ailleurs');
  // ============================================================
  {
    // Le parent importe l enfant : ils sont en relation de rendu.
    const enRelation: Sources = {
      [PARENT]: composant('InvestmentNoteView', ['a'], '.a { color: red; }', "import Bloc from './note/Bloc';\n"),
      [ENFANT]: composant('Bloc', ['a'], '.a { color: red; }'),
    };
    const r = relever(enRelation);
    const clef = Object.keys(r.regles).find(k => k.includes('.a'))!;
    check(r.regles[clef].length === 2, 'la regle vit dans deux portees');
    check(r.relations[PARENT].includes(ENFANT), 'la relation parent-enfant est derivee de l import');
  }
  {
    // Deux composants sans rapport : homonymie et non duplication.
    const sansRelation: Sources = {
      [PARENT]: composant('InvestmentNoteView', ['a'], '.a { color: red; }'),
      [ENFANT]: composant('Bloc', ['a'], '.a { color: red; }'),
    };
    const r = relever(sansRelation);
    check(!r.relations[PARENT].includes(ENFANT), 'sans import, aucune relation n est derivee');
    check((r.relations[ENFANT] || []).length === 0, 'et la relation inverse n existe pas davantage');
  }

  // ============================================================
  console.log('\n[Axe 3] orphelinat : la classe visee est-elle rendue');
  // ============================================================
  {
    const sain = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '.a { color: red; }') });
    check(sain.orphelines.length === 0, 'une regle dont la classe est rendue n est pas orpheline');

    const orphelin = relever({ [PARENT]: composant('InvestmentNoteView', ['b'], '.a { color: red; }') });
    check(orphelin.orphelines.length === 1, 'une regle dont la classe n est pas rendue est orpheline');
    check(orphelin.orphelines[0].selecteur === '.a', 'et elle est nommee');
  }
  {
    // Un selecteur sans classe sort du controle plutot que d y entrer
    // par defaut : sinon toute balise nue serait declaree orpheline.
    const nu = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], 'p { margin: 0; }') });
    check(nu.orphelines.length === 0, 'un selecteur de balise nue n est pas compte comme orphelin');
  }

  // ============================================================
  console.log('\n[Axe 4] portee : deux blocs du meme fichier ne se confondent pas');
  // ============================================================
  {
    // Deux composants dans un seul fichier, chacun son bloc, meme
    // selecteur et meme propriete avec des valeurs differentes. Ce
    // n est PAS une divergence : styled-jsx scope chacun au sien et
    // les deux ne se rencontrent jamais. C est le cas reel de
    // `.note-h4`, que le controle lisait comme un conflit.
    const deuxPortees = composant('Auxiliaire', ['a'], '.a { color: red; }')
      + composant('InvestmentNoteView', ['a'], '.a { color: blue; }');
    const r = relever({ [PARENT]: deuxPortees });
    check(r.portees.length === 2, 'deux portees sont reconnues dans un seul fichier');
    check(r.portees.some(p => p.endsWith('::Auxiliaire')) && r.portees.some(p => p.endsWith('::InvestmentNoteView')),
      'et chacune porte le nom de son composant');
    check(r.divergences.length === 0,
      'meme selecteur, meme propriete, valeurs differentes, portees distinctes : aucune divergence');
  }
  {
    // Le cas voisin qui doit rougir : les deux declarations dans LA
    // MEME portee. Sans ce second sens, le test precedent serait
    // satisfait par un controle qui ne detecte jamais rien.
    const unePortee = composant('InvestmentNoteView', ['a'], '.a { color: red; }\n.a { color: blue; }');
    const r = relever({ [PARENT]: unePortee });
    check(r.divergences.length === 1, 'les memes deux declarations dans une seule portee sont une divergence');
    check(r.divergences[0].propriete === 'color', 'et la propriete en conflit est nommee');
  }

  // ============================================================
  console.log('\n[Axe 5] cascade : la valeur annoncee est la derniere de la source');
  // ============================================================
  {
    // Le cas reel de `.action-list li`, ou deux declarations de la
    // meme propriete cohabitent dans UN SEUL bloc de regle.
    const r = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '.a { font-size: 14px; font-size: 12px; }') });
    check(r.divergences.length === 1, 'deux valeurs de la meme propriete dans une regle : divergence');
    check(r.divergences[0].appliquee === '12px', 'la derniere de la source s applique');
    check(r.divergences[0].inatteignables.join(',') === '14px', 'la premiere est inatteignable');
  }
  {
    // Le sens inverse. Un controle qui repondrait au hasard, ou qui
    // trierait les valeurs, passerait le test precedent une fois sur
    // deux ; celui-ci le prend en defaut. C est exactement la faute
    // trouvee le 7 aout, ou le tri des declarations avait detruit
    // l ordre et faisait annoncer la mauvaise gagnante.
    const r = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '.a { font-size: 12px; font-size: 14px; }') });
    check(r.divergences[0].appliquee === '14px', 'ordre inverse : c est l autre qui s applique');
    check(r.divergences[0].inatteignables.join(',') === '12px', 'et l autre qui devient inatteignable');
  }
  {
    // Entre deux regles distinctes de la meme portee, c est aussi la
    // derniere qui gagne.
    const r = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '.a { color: red; }\n.a { color: green; }') });
    check(r.divergences[0].appliquee === 'green', 'entre deux regles, la derniere gagne aussi');
  }
  // ============================================================
  console.log('\n[Axe 6] couverture : l element parti sans sa regle');
  // ============================================================
  {
    // Le mode de perte propre a styled-jsx, et le seul que les cinq
    // axes precedents ne voient pas. La regle reste chez le parent, a
    // bon droit puisqu il la rend encore ailleurs ; c est l ELEMENT qui
    // est parti. Ni perdue, ni dupliquee, ni orpheline, et pourtant le
    // titre de l enfant sort sans style.
    const parent = composant('InvestmentNoteView', ['titre', 'autre'], '.titre { font-size: 20px; }', "import Bloc from './note/Bloc';\n");
    const enfant = composant('Bloc', ['titre', 'local'], '.local { color: red; }');
    const r = relever({ [PARENT]: parent, [ENFANT]: enfant });
    const trous = r.classesSansRegleDansLeurPortee;
    check(trous.length === 1, 'une classe rendue par l enfant et stylee seulement chez le parent est vue');
    check(trous[0].classe === 'titre', 'et elle est nommee');
    check(trous[0].portee.endsWith('::Bloc'), 'la portee qui la rend sans la styler est nommee');
    check(trous[0].regleVitDans.some(p => p.endsWith('::InvestmentNoteView')), 'et celle qui la style aussi');

    // Aucun des cinq autres axes ne le voyait : c est ce qui justifie
    // le sixieme, et cela s asserte plutot que cela ne se raconte.
    check(r.orphelines.length === 0, 'la regle n est pas orpheline : le parent rend encore la classe');
    check(Object.values(r.regles).every(v => v.length === 1), 'elle n est pas dupliquee non plus');
    check(r.divergences.length === 0, 'et il n y a aucune divergence de valeur');
  }
  {
    // Le sens sain : la regle a suivi l element. Sans ce second sens,
    // l assertion precedente serait satisfaite par un controle qui
    // signale toute classe rendue par un enfant.
    const parent = composant('InvestmentNoteView', ['autre'], '.autre { font-size: 20px; }', "import Bloc from './note/Bloc';\n");
    const enfant = composant('Bloc', ['titre'], '.titre { font-size: 20px; }');
    const r = relever({ [PARENT]: parent, [ENFANT]: enfant });
    check(r.classesSansRegleDansLeurPortee.length === 0, 'une regle qui a suivi son element ne signale rien');
  }
  {
    // Une classe que personne ne style ne pose aucune question, et le
    // controle ne doit pas la compter. C est le cas de `mono` dans la
    // note reelle, rendue cinq fois et stylee nulle part.
    const r = relever({ [PARENT]: composant('InvestmentNoteView', ['mono'], '.autre { color: red; }') });
    check(r.classesSansRegleDansLeurPortee.length === 0, 'une classe stylee nulle part n est pas signalee');
  }
  // ============================================================
  console.log('\n[Axe 7] contexte : une regle sortie de son @media est nommee');
  // ============================================================
  {
    // La conservation le voyait deja, le contexte faisant partie de la
    // clef. Ce qui est teste ici est le diagnostic : deux lignes dont
    // il faut inferer le rapport valent moins qu une qui le nomme.
    const sousMedia = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '@media print {\n  .a { color: red; }\n}') });
    const hors = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '.a { color: red; }') });
    const clefSous = Object.keys(sousMedia.regles)[0];
    const clefHors = Object.keys(hors.regles)[0];
    check(clefSous.startsWith('@media print|'), 'le contexte fait partie de la clef de la regle');
    check(clefHors.startsWith('|'), 'et une regle hors encadrement porte un contexte vide');
    check(clefSous !== clefHors, 'les deux ne sont donc pas la meme regle');
  }
  {
    // Le sens sain : la regle reste dans son encadrement. Sans ce
    // second sens, l assertion precedente serait satisfaite par un
    // controle qui distingue toujours tout.
    const a = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '@media print {\n  .a { color: red; }\n}') });
    const b = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '@media print {\n  .a { color: red; }\n}') });
    check(Object.keys(a.regles)[0] === Object.keys(b.regles)[0], 'la meme regle sous le meme encadrement a la meme clef');
  }
  {
    // Deux encadrements differents ne se confondent pas davantage.
    const ecran = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '@media screen {\n  .a { color: red; }\n}') });
    const impr = relever({ [PARENT]: composant('InvestmentNoteView', ['a'], '@media print {\n  .a { color: red; }\n}') });
    check(Object.keys(ecran.regles)[0] !== Object.keys(impr.regles)[0], 'ecran et impression ne sont pas le meme contexte');
  }
})();

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail > 0 ? 1 : 0);
