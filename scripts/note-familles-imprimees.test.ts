// Verrou de la sonde des familles imprimees.
//
// Le jeu d essai entre par la porte de la production : il importe les
// fonctions que la commande appelle, et n en rejoue aucune. La liste des
// cas se derive de ce que le code decide et non de ce qu on avait en
// tete : il decide quelle route imprime, quels jetons sont fragiles,
// quelles fontes le document porte, et laquelle de ces fontes n avait
// pas ete demandee. Chaque decision s eprouve dans les deux sens, faute
// de quoi l assertion serait satisfaite par un instrument qui repond
// toujours pareil.

import { jetonsDeFamille, fontesDuPdf, lireArguments } from './note-familles-imprimees';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

console.log('\n[Suite 1] la route qui imprime se choisit, et son absence se distingue de son heritage');
{
  const sans = lireArguments(['http://localhost:3010', 'id-note']);
  check(sans.base === 'http://localhost:3010' && sans.idNote === 'id-note',
    'les positionnels se lisent');
  // LE CAS QUI DECIDE. Sans option, `exportBase` doit valoir null et non
  // la base de lecture : un repli qui rend la meme valeur que sa source
  // rendrait la source invisible, et l appelant ne pourrait plus dire
  // dans sa sortie si la route a ete choisie ou heritee.
  check(sans.exportBase === null, 'sans option la route n est pas choisie, et le repli ne la fabrique pas');
  check(sans.cookie === null, 'sans option la session est absente');

  const avec = lireArguments([
    'http://localhost:3010', 'id-note', 'sortie.pdf',
    '--export', 'https://exemple.test', '--cookie', 'c.txt',
  ]);
  check(avec.exportBase === 'https://exemple.test', 'la route choisie se lit');
  check(avec.cookie === 'c.txt', 'la session se lit');
  check(avec.sortie === 'sortie.pdf', 'le troisieme positionnel survit aux options');

  // Les options ne doivent pas dependre de leur rang, sinon la commande
  // n aurait qu une seule forme d invocation valide et rien ne le dirait.
  const melange = lireArguments([
    '--export', 'https://exemple.test', 'http://localhost:3010', '--cookie', 'c.txt', 'id-note',
  ]);
  check(melange.base === 'http://localhost:3010' && melange.idNote === 'id-note',
    'les positionnels se retrouvent quel que soit le rang des options');
  check(melange.exportBase === 'https://exemple.test' && melange.cookie === 'c.txt',
    'et les options aussi');
}

console.log('\n[Suite 2] les jetons fragiles se derivent de la feuille, et les autres restent dehors');
{
  const feuille = `
    :root {
      --serif: var(--font-serif), Georgia, serif;
      --sans: var(--font-sans), sans-serif;
      --mono: ui-monospace, Menlo, monospace;
      --ink: #14110d;
    }
  `;
  const j = jetonsDeFamille(feuille);
  const noms = j.map(x => x.nom).sort();
  check(noms.join(',') === '--sans,--serif', 'les deux jetons qui passent par var(--font-...) entrent');
  // Le second sens de l axe : ce qui ne depend d aucune variable de
  // next/font ne court pas le risque mesure, donc il reste dehors sans
  // qu on ait a l exclure par son nom.
  check(!noms.includes('--mono'), 'le jeton monospace, qui ne depend d aucune variable, reste dehors');
  check(!noms.includes('--ink'), 'un jeton qui n est pas une famille reste dehors');
  check(j.find(x => x.nom === '--serif')?.source === '--font-serif',
    'la variable dont le jeton descend se conserve');
  // Un troisieme jeton ajoute demain doit entrer sans qu on touche au
  // code. La declaration se pose en debut de ligne, comme la feuille les
  // ecrit : la regle ancre la, et la premiere ecriture de ce cas collait
  // le jeton derriere l accolade du selecteur, forme qu aucune feuille
  // du depot n emploie. Le rouge portait donc sur le jeu d essai.
  const troisieme = jetonsDeFamille(`${feuille}\n:root {\n  --display: var(--font-display), serif;\n}`);
  check(troisieme.some(x => x.nom === '--display'),
    'un jeton de famille ajoute demain entre sans modification');
}

console.log('\n[Suite 3] les fontes se lisent sur les deux clefs, et le prefixe de sous-ensemble ne nomme rien');
{
  // La clef du dictionnaire et celle du descripteur sont deux choses :
  // les fontes embarquees en Type 3 ne portent pas de /BaseFont par
  // construction, et une lecture qui n en connaitrait qu une rendrait un
  // verdict de non-conformite sur un document sain.
  const faux = Buffer.from(
    '/BaseFont /ABCDEF+Inter-Regular\n'
    + '/FontName /GHIJKL+SourceSerif4Roman-Regular\n'
    + '/FontName /MNOPQR+SourceSerif4Roman-Regular\n'
    + '/FontName /OpenSans-Bold\n',
    'latin1',
  );
  const f = fontesDuPdf(faux);
  const parNom = new Map(f.map(x => [x.famille, x.sousEnsembles]));
  check(parNom.get('Inter-Regular') === 1, 'la clef du dictionnaire est lue');
  check(parNom.get('OpenSans-Bold') === 1, 'la clef du descripteur est lue');
  // Le prefixe change a chaque production et ne nomme rien : deux
  // sous-ensembles de la meme fonte doivent se compter ensemble, sinon
  // le releve ferait passer une fonte pour plusieurs.
  check(parNom.get('SourceSerif4Roman-Regular') === 2,
    'deux prefixes de sous-ensemble se rangent sous la meme famille');
  check(!Array.from(parNom.keys()).some(k => k.includes('+')),
    'aucun prefixe ne survit dans le nom rendu');
  // Le second sens : un document sans fonte doit rendre zero et non une
  // famille plausible, parce que ce zero est declare ailleurs comme un
  // incident de l instrument.
  check(fontesDuPdf(Buffer.from('%PDF-1.4 sans aucune fonte', 'latin1')).length === 0,
    'un document sans fonte rend zero plutot qu une famille fabriquee');
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
