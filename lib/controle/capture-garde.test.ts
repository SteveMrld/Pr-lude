// ============================================================
// Tests deterministes des gardes de l instrument de capture
// ------------------------------------------------------------
// Le defaut constate dont ils naissent : le 7 aout 2026, une passe
// apres a rendu vingt-cinq images identiques octet pour octet a leur
// reference et l a annonce comme un succes, vingt-cinq capturees et
// zero en echec. L instrument avait reproduit sa propre reference et
// rien dans sa sortie ne le disait.
//
// LA LISTE DES MUTATIONS SE DERIVE DES AXES, PAS DE L INTENTION
//
// Le dispositif decide six choses, et il faut donc six mutations et
// non trois : quels jetons il retient, lesquels il ecarte, ce qu il
// appelle une divergence, ce qu il fait d un jeton que le servi ne
// porte pas, comment il classe une capture face a sa reference, et ce
// que ce classement fait au verdict.
//
// Chaque axe s eprouve dans les deux sens quand cela a un sens : la
// garde doit rougir sur la faute et se taire sur le cas sain voisin.
// Le premier sens prouve qu elle voit, le second qu elle discrimine.
//
// Execution : npx tsx lib/controle/capture-garde.test.ts
// ============================================================

import {
  classerVersusReference,
  divergencesJetons,
  empreinte,
  jetonsDeclares,
  verdictIdentite,
  type VersusReference,
} from './capture-garde';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/**
 * Une feuille minimale de la forme reelle de globals.css : un bloc
 * :root qui declare des jetons de la note, des jetons d une autre
 * famille, et un jeton indirect.
 *
 * Les valeurs sont discriminantes plutot que realistes. Un jeu d essai
 * qui porterait 30px des deux cotes mesurerait l identite de deux
 * copies et pas la dependance : c est la faute que le verrou du graphe
 * de dependances a payee quatre fois.
 */
function feuille(extra = ''): string {
  return `:root {
  --ink: #101010;
  --note-size-h2: 31px;
  --note-size-h3: 22px;
  --note-weight-h2: 700;
  --note-rhythm-section: var(--note-space-8);
${extra}}

@media print {
  .x { color: red; }
}
`;
}

console.log('\nAXE 1 - la liste des jetons se derive du prefixe');
{
  const d = jetonsDeclares(feuille());
  check(
    d.compares['--note-size-h2'] === '31px' && d.compares['--note-size-h3'] === '22px',
    'les jetons de la note a valeur litterale sont retenus avec leur valeur',
  );
  check(!('--ink' in d.compares), 'un jeton hors prefixe reste dehors, le perimetre discrimine');

  // MUTATION : un jeton ajoute demain doit entrer sans qu on touche au
  // code. C est ce qui separe une derivation d une liste ecrite a la
  // main, qui vieillit sans le dire.
  const apres = jetonsDeclares(feuille('  --note-tracking-h4: 0.09em;\n'));
  check(
    apres.compares['--note-tracking-h4'] === '0.09em',
    'un jeton ajoute a la feuille entre dans la comparaison sans modifier le code',
  );
}

console.log('\nAXE 2 - le partage entre comparable et indirect');
{
  const d = jetonsDeclares(feuille());
  check(
    d.ecartes.includes('--note-rhythm-section') && !('--note-rhythm-section' in d.compares),
    'un jeton dont la valeur passe par var() est ecarte et non compare',
  );
  check(
    d.ecartes.length === 1,
    'et il est nomme : un perimetre declare ce qu il ne couvre pas',
  );

  // MUTATION EN SENS INVERSE : le meme jeton, valeur litterale, doit
  // revenir dans les compares. Sans ce sens, l assertion serait
  // satisfaite par un code qui ecarte tout.
  const direct = jetonsDeclares(':root {\n  --note-rhythm-section: 64px;\n}\n');
  check(
    direct.compares['--note-rhythm-section'] === '64px' && direct.ecartes.length === 0,
    'le meme jeton en valeur litterale redevient comparable',
  );
}

console.log('\nAXE 3 - ce que la garde appelle une divergence');
{
  const depot = { '--note-size-h2': '30px', '--note-size-h3': '20px' };

  check(
    divergencesJetons(depot, { '--note-size-h2': '30px', '--note-size-h3': '20px' }).length === 0,
    'un servi conforme ne produit aucune divergence, la garde se tait',
  );

  // MUTATION : le cas qui s est produit, un serveur reste sur les
  // anciennes valeurs.
  const d = divergencesJetons(depot, { '--note-size-h2': '32px', '--note-size-h3': '20px' });
  check(d.length === 1 && d[0].jeton === '--note-size-h2', 'un servi perime est signale, et le jeton est nomme');
  check(
    d[0].depot === '30px' && d[0].servi === '32px',
    'la divergence porte les deux valeurs, sans quoi le message ne dit pas de quel cote chercher',
  );

  check(
    divergencesJetons(depot, { '--note-size-h2': '  30px  ', '--note-size-h3': '20px' }).length === 0,
    'l espace autour de la valeur servie ne fabrique pas de divergence',
  );
}

console.log('\nAXE 4 - un jeton que le servi ne porte pas');
{
  const d = divergencesJetons({ '--note-size-h2': '30px' }, {});
  check(
    d.length === 1 && d[0].servi === '',
    'un jeton absent du servi compte comme divergent et non comme non mesure',
  );
}

console.log('\nAXE 5 - le classement d une capture face a sa reference');
{
  const a = empreinte(Buffer.from('image-a'));
  const b = empreinte(Buffer.from('image-b'));

  check(classerVersusReference(a, a) === 'identique', 'une image qui reproduit sa reference est dite identique');
  check(classerVersusReference(a, b) === 'differe', 'une image qui bouge est dite differente, la garde discrimine');
  check(
    classerVersusReference(a, undefined) === 'sans-reference',
    'une image sans contrepartie n est ni l une ni l autre',
  );
  check(
    empreinte(Buffer.from('image-a')) === a && a !== b,
    'l empreinte est stable sur le meme contenu et separe deux contenus',
  );
}

console.log('\nAXE 6 - ce que le classement fait au verdict');
{
  const tousDifferents: VersusReference[] = ['differe', 'differe', 'differe'];
  check(verdictIdentite(tousDifferents).conforme, 'une passe ou tout bouge est conforme');

  // MUTATION : une seule identite parmi des differences. Les jetons de
  // la note etant globaux et toute note capturee rendant un titre de
  // section, une image qui ne bouge pas dit quelque chose de
  // l instrument. Une seule suffit donc a condamner la passe.
  const uneIdentique: VersusReference[] = ['differe', 'identique', 'differe'];
  const v = verdictIdentite(uneIdentique);
  check(!v.conforme, 'une seule identite suffit a rendre la passe non conforme');
  check(v.identiques === 1 && v.differentes === 2, 'et le verdict porte son compte des deux cotes');

  // Le cas qui s est produit : toutes identiques, annonce comme un
  // succes par l ancien harnais.
  check(
    !verdictIdentite(['identique', 'identique', 'identique']).conforme,
    'la passe du 7 aout, vingt-cinq images identiques, aurait echoue',
  );

  // MUTATION SUR LE DENOMINATEUR : une image sans contrepartie ne se
  // range pas parmi les differentes. La compter la gonflerait le
  // denominateur et ferait annoncer une couverture qu on n a pas.
  const d = verdictIdentite(['differe', 'sans-reference', 'sans-reference']);
  check(
    d.differentes === 1 && d.sansReference === 2 && d.conforme,
    'une image sans contrepartie est comptee a part, et ne vaut pas une difference',
  );
}

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail === 0 ? 0 : 1);
