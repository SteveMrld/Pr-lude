// ============================================================
// Tests deterministes du controle de conservation du style
// ------------------------------------------------------------
// Ce que ces tests prouvent : le controle voit ses CINQ axes, et pas
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
// LES CINQ AXES
//
//   1. conservation : une regle retiree se voit
//   2. duplication  : une regle recopiee le long de la relation se voit
//   3. orphelinat   : une regle chez qui ne rend pas sa classe se voit
//   4. portee       : deux portees distinctes ne se confondent pas
//   5. cascade      : la valeur annoncee gagnante est bien la derniere
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
})();

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail > 0 ? 1 : 0);
