// Verrou du vocabulaire de dossier.
//
// Le jeu d essai entre par la porte de la production et, sur les deux
// valeurs que le module doit repeter faute de pouvoir les importer sans
// alourdir le bundle client, il compare le declare au reel plutot que de
// se croire sur parole. C est la troisieme forme de portage : a defaut
// d un point de passage unique, un test qui echoue le jour ou les deux
// divergent.
//
// La liste des cas se derive des axes que le module decide : quel etat
// porte un statut, quelle pastille porte un etat, quel libelle porte un
// verdict, et quelle classe CSS en sort. Chaque axe dans les deux sens.

import { readFileSync } from 'fs';
import { join } from 'path';

import { INSUFFICIENT_BASIS_VERDICT } from '../engines/score-calculator';
import {
  STATUTS_DOSSIER,
  etatDuDossier,
  libelleEtat,
  PRESENTATION_ETAT,
  PRESENTATION_VERDICT,
  presenterVerdict,
  classeVerdict,
  VERDICT_SOCLE_INSUFFISANT,
  VERDICT_ECARTE_PRESCAN,
  LIBELLE_SANS_NOM,
  nommerDossier,
} from './vocabulaire-dossier';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

const racine = join(__dirname, '..', '..');

console.log('\n[Suite 1] le declare et le reel, sur les valeurs que le module repete');
{
  // Le troisieme etat du calcul mecanique s importe ici sans cout, et
  // c est la seule facon de savoir que la copie n a pas derive.
  check(
    VERDICT_SOCLE_INSUFFISANT === INSUFFICIENT_BASIS_VERDICT,
    'le socle insuffisant dit la meme chose que le calculateur de score',
  );

  // Le verdict d ecartement vient du pre-scan, dont le vocabulaire est
  // un type et ne se lit donc pas a l execution. On le confronte a la
  // source, ce qui echoue le jour ou le pre-scan renomme sa valeur.
  const prescan = readFileSync(join(racine, 'lib', 'engines', 'prescan-engine.ts'), 'utf-8');
  check(
    prescan.includes(`'${VERDICT_ECARTE_PRESCAN}'`),
    'le verdict d ecartement figure bien dans le moteur de pre-scan',
  );

  // LE CONTROLE QUI FERME LA LISTE. Les statuts declares se confrontent
  // a ceux que le magasin ecrit reellement. Un septieme statut ecrit
  // sans etre declare fera echouer ce test, ce que le type ne faisait
  // pas : il en declarait quatre quand le code en ecrivait six.
  const magasin = readFileSync(join(racine, 'lib', 'analysis-store.ts'), 'utf-8');
  const ecrits = new Set<string>();
  const re = /status:\s*'([a-z_]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(magasin)) !== null) ecrits.add(m[1]);
  const declares = new Set<string>(STATUTS_DOSSIER as readonly string[]);
  const nonDeclares = Array.from(ecrits).filter(s => !declares.has(s));
  check(
    nonDeclares.length === 0,
    `tout statut ecrit par le magasin est declare${nonDeclares.length ? ` (manquants : ${nonDeclares.join(', ')})` : ''}`,
  );
  check(ecrits.size > 0, 'le releve a bien trouve des statuts, donc il mesure quelque chose');
}

console.log('\n[Suite 2] chaque statut porte un etat, et l ignorance ne s habille pas');
{
  for (const s of STATUTS_DOSSIER) {
    check(etatDuDossier(s) !== 'inconnu', `${s} rend un etat nomme`);
  }
  // LE CAS QUI A MOTIVE LE MODULE : il tombait au bout d une liste de
  // quatre et ne recevait aucune pastille.
  check(etatDuDossier('knockout') === 'ecarte-prescan', 'un dossier ecarte au pre-scan a son etat');
  check(PRESENTATION_ETAT['ecarte-prescan'].visible, 'et cet etat porte une pastille visible');
  check(
    PRESENTATION_ETAT['ecarte-prescan'].ton !== PRESENTATION_ETAT.abouti.ton,
    'qui ne se confond pas avec celle d un dossier abouti',
  );
  // Le second sens : ce qu on ne sait pas ne doit emprunter le
  // vocabulaire d aucun etat mesure, ni celui qui rassure ni celui qui
  // accuse.
  check(etatDuDossier(null) === 'inconnu', 'un statut absent rend inconnu');
  check(etatDuDossier('un-statut-invente') === 'inconnu', 'un statut etranger rend inconnu');
  check(!PRESENTATION_ETAT.inconnu.visible, 'et l inconnu ne pose pas de pastille');
  check(PRESENTATION_ETAT.inconnu.libelle === '', 'ni de libelle qui affirmerait quelque chose');
  // Les cinq etats nommes doivent se distinguer par le ton, sinon la
  // pastille existe et ne distingue rien.
  const nommes = ['en-instruction', 'abouti', 'abouti-degrade', 'ecarte-prescan', 'tombe'] as const;
  const tons = new Set(nommes.map(e => PRESENTATION_ETAT[e].ton));
  check(tons.size === 5, 'les cinq etats nommes portent cinq tons distincts');
  const libelles = new Set(nommes.map(e => PRESENTATION_ETAT[e].libelle));
  check(libelles.size === 5, 'et cinq libelles distincts');
  // LA COLLISION DE VOCABULAIRE. L editeur de stade de la meme ligne
  // emploie « En instruction » pour `in_review`. La pastille parle du
  // run et le stade parle du dossier : deux grandeurs sans rapport ne
  // peuvent pas se lire dans les memes mots a dix centimetres l une de
  // l autre, faute de quoi la ligne dit deux fois la meme chose et n en
  // dit aucune.
  check(
    !nommes.some(e => PRESENTATION_ETAT[e].libelle.toLowerCase() === 'en instruction'),
    'aucun libelle d etat n emprunte les mots du stade d instruction',
  );
}

console.log('\n[Suite 3] le compte de moteurs ne se fabrique pas');
{
  // Les assertions portent sur la propriete et non sur le libelle exact.
  // Elles comparaient une chaine entiere, donc elles rougissaient au
  // moindre resserrage de la formulation en donnant a croire a une
  // regression du compte. Ce qui doit tenir est que le compte mesure
  // figure et que le nombre commande l accord, pas la phrase qui les
  // porte.
  const trois = libelleEtat('abouti-degrade', 3);
  check(trois.includes('3'), 'un compte mesure figure dans le libelle');
  check(/lacunes/.test(trois), 'et le pluriel s applique au-dela de un');
  const une = libelleEtat('abouti-degrade', 1);
  check(une.includes('1'), 'un compte de un figure aussi');
  check(/lacune(?!s)/.test(une), 'et le singulier se respecte');
  // La longueur compte, parce que ce libelle se lit trente fois a cote
  // du nom du dossier et qu il concurrencait le nom lui-meme.
  check(libelleEtat('abouti-degrade', 14).length <= 20, 'le libelle reste court a deux chiffres');
  // Le second sens : un compte non mesure ne devient pas zero, parce
  // qu un moteur en lacune dont on ignore le nombre et zero moteur en
  // lacune sont deux choses.
  check(
    !libelleEtat('abouti-degrade', null).includes('0'),
    'un compte absent ne s ecrit pas zero',
  );
  check(
    libelleEtat('abouti', 4) === PRESENTATION_ETAT.abouti.libelle,
    'un etat qui n a pas de lacune ignore le compte',
  );
}

console.log('\n[Suite 4] le verdict se lit, et l inconnu ne se traduit pas');
{
  // L ORTHOGRAPHE QUI MANQUAIT. La table de l historique connaissait
  // `investir-conditions`, qu aucun producteur n ecrit.
  const conditionnel = presenterVerdict('investir avec conditions');
  check(conditionnel.connu, 'le oui conditionnel du calculateur est reconnu');
  check(conditionnel.libelle === 'Investir avec conditions', 'et il porte son libelle');
  // Le cas qui coute : il ne doit pas se presenter comme un oui franc.
  check(
    conditionnel.ton !== PRESENTATION_VERDICT.investir.ton,
    'et son ton se distingue de celui du oui franc',
  );
  check(presenterVerdict('refuser').connu, 'le refus est reconnu');
  check(presenterVerdict(VERDICT_ECARTE_PRESCAN).libelle === 'Ecarte au pre-scan',
    'le verdict du pre-scan se dit en francais et non en code');
  check(!presenterVerdict(VERDICT_ECARTE_PRESCAN).positionDInstruction,
    'et il ne se compte pas comme une position d instruction');
  // Le second sens : une valeur ecrite sous un contrat ancien se rend
  // telle quelle plutot que de se rapprocher de la plus ressemblante.
  const etranger = presenterVerdict('investir-conditions');
  check(!etranger.connu, 'une orthographe qui n est plus produite reste inconnue');
  check(etranger.libelle === 'investir-conditions', 'et se rend telle quelle, sans etre devinee');
  check(!presenterVerdict(null).connu, 'un verdict absent est inconnu');
  check(presenterVerdict(null).libelle === 'Verdict absent', 'et le dit plutot que de rester vide');
}

console.log('\n[Suite 5] le nom d un dossier dont l extraction n a pas abouti');
{
  // Le declare et le reel, sur la valeur que ce module repete pour ne
  // pas faire entrer le magasin d analyses dans le bundle client.
  const magasin = readFileSync(join(racine, 'lib', 'analysis-store.ts'), 'utf-8');
  check(
    magasin.includes(`LIBELLE_AVANT_EXTRACTION = '${LIBELLE_SANS_NOM}'`),
    'le libelle d attente dit la meme chose que le magasin d analyses',
  );
  // LE CAS QUI A MOTIVE LA FONCTION : huit lignes sur trente-neuf
  // portaient ce libelle, dont six marquees « pipeline tombe ».
  const tombe = nommerDossier('(analyse en cours)', 'Project Woodpecker_Info Memo.pdf');
  check(tombe.nom === 'Project Woodpecker_Info Memo', 'le fichier source remplace le libelle d attente');
  check(tombe.provisoire, 'et le nom se declare provisoire');
  check(!tombe.nom.includes('.pdf'), 'l extension ne nomme rien et se retire');
  // Le second sens : un vrai nom ne doit jamais etre remplace, sinon la
  // ligne afficherait un nom de fichier a la place d une societe.
  const vrai = nommerDossier('Braincube', 'Project Woodpecker_Info Memo.pdf');
  check(vrai.nom === 'Braincube', 'un nom extrait est conserve');
  check(!vrai.provisoire, 'et il ne se declare pas provisoire');
  // Les deux absences, qui ne doivent pas rendre une chaine vide : un
  // vide se lit comme un defaut d affichage et non comme une absence.
  check(nommerDossier(null, null).nom === 'Dossier sans nom', 'sans nom ni fichier, cela se dit');
  check(nommerDossier('   ', '').provisoire, 'un nom blanc compte comme absent');
}

console.log('\n[Suite 6] la classe CSS ne peut plus se decouper');
{
  // LE DEFAUT MESURE SUR LA PAGE VIVANTE : `verdict-investir avec
  // conditions` valait trois classes, dont une qui existait.
  const c = classeVerdict('investir avec conditions');
  check(!/\s/.test(c), 'la classe d un verdict a espaces ne porte aucun espace');
  check(c !== classeVerdict('investir'), 'et elle differe de celle du oui franc');
  check(classeVerdict('socle insuffisant') === 'verdict-socle-insuffisant',
    'les espaces deviennent des tirets');
  // La propriete generale plutot que les trois cas connus : aucun
  // verdict du vocabulaire ne doit produire une classe a espace, et
  // toutes doivent etre distinctes deux a deux.
  const toutes = Object.keys(PRESENTATION_VERDICT).map(classeVerdict);
  check(toutes.every(x => !/\s/.test(x)), 'aucune classe du vocabulaire ne porte d espace');
  check(new Set(toutes).size === toutes.length, 'et toutes les classes sont distinctes');
  // Le second sens : une valeur vide ne doit pas rendre `verdict-`, qui
  // atteindrait par prefixe tout ce qui commence ainsi.
  check(classeVerdict('') === 'verdict-absent', 'une valeur vide rend une classe nommee');
  check(classeVerdict('   ') === 'verdict-absent', 'une valeur blanche aussi');
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
