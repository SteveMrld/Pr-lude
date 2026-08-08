// Verrou du graphe de flux.
//
// LE VERROU EST LA RAISON D ETRE DU MODULE. `DEP_DRIVEN_TOPOLOGY`
// declarait deja les dependances reelles et son en-tete disait qu elle
// documentait ce que la route exprime. Personne n avait compare les deux :
// `extraction` etait passee a treize moteurs sur quatorze et declaree sur
// sept. Un graphe faux qui a l air vrai est le pire des trois etats,
// puisque rien n invite a le relire.
//
// Il echoue donc dans les deux sens, et c est la seule forme qui vaille :
// une arete declaree qui n apparait pas dans l appel est un fil faux, et
// un argument de l appel qui n est pas declare est un fil manquant.
//
// Il lit la route plutot qu une transcription de la route.

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  GRAPHE_FLUX,
  IDENTIFIANT_VERS_MOTEUR,
  argumentsDeLAppel,
  moteursConsommes,
  aretesDuFlux,
} from './graphe-flux';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

const route = readFileSync(join(__dirname, '..', '..', 'app', 'api', 'analyze', 'route.ts'), 'utf-8');

console.log('\n[Suite 1] la declaration se confronte a l appel, dans les deux sens');
{
  let confrontes = 0;
  for (const n of GRAPHE_FLUX) {
    if (n.entreesNonEtablies) continue;
    if (!n.appel) { check(false, `${n.id} declare des entrees sans nommer son appel`); continue; }
    const args = argumentsDeLAppel(route, n.appel);
    if (args === null) {
      // Un appel introuvable est un echec du verrou et non un resultat :
      // sans lui, la declaration ne serait confrontee a rien et le test
      // serait vert pour la mauvaise raison.
      check(false, `${n.id} : l appel ${n.appel}( est introuvable dans la route`);
      continue;
    }
    confrontes += 1;
    const reels = moteursConsommes(args).filter(m => m !== n.id);
    const declares = [...n.consomme].sort();
    const manquants = reels.filter(m => !declares.includes(m));
    const enTrop = declares.filter(m => !reels.includes(m));
    check(
      manquants.length === 0,
      `${n.id} : aucune entree reelle non declaree${manquants.length ? ` (manque ${manquants.join(', ')})` : ''}`,
    );
    check(
      enTrop.length === 0,
      `${n.id} : aucune declaration sans appel${enTrop.length ? ` (fil faux vers ${enTrop.join(', ')})` : ''}`,
    );
  }
  // LE DENOMINATEUR DU VERROU. Sans lui, un module qui ne confronterait
  // plus rien passerait pour vert.
  check(confrontes >= 12, `le verrou a confronte ${confrontes} moteurs, et non zero`);
}

console.log('\n[Suite 2] le verrou voit ce qu on lui montre, et discrimine');
{
  // Le premier sens : une entree presente dans l appel se retrouve.
  const args = argumentsDeLAppel(route, 'performCausalReversal');
  check(args !== null, 'les arguments d un appel se lisent, parentheses equilibrees');
  const m = moteursConsommes(args || '');
  check(m.includes('pattern'), 'et le moteur consomme y figure');
  check(m.includes('extraction'), 'extraction comprise, qui manquait a l ancienne declaration');
  // Le second sens : ce qui n est pas passe ne doit pas se retrouver,
  // sinon le verrou accepterait n importe quelle declaration.
  check(!m.includes('narrative-drift'), 'un moteur non passe ne se retrouve pas');
  check(!m.includes('benchmarks'), 'ni un autre');
  // Un nom cite dans un commentaire ne doit pas compter comme une
  // dependance : la route en porte beaucoup.
  check(
    moteursConsommes('extraction, /* voir benchmarks pour le detail */ team').join(',') === 'extraction,team',
    'un moteur cite en commentaire ne fabrique pas de fil',
  );
  // Une clef d objet ne compte pas, seule la valeur compte.
  check(
    moteursConsommes('{ marketAnalysis: market }').join(',') === 'market',
    'une clef d objet ne compte pas, sa valeur si',
  );
}

console.log('\n[Suite 3] ce qui ne se lit pas reste dehors et se declare');
{
  const nonEtablis = GRAPHE_FLUX.filter(n => n.entreesNonEtablies);
  check(nonEtablis.length > 0, 'des moteurs declarent que leurs entrees ne sont pas etablies');
  check(
    nonEtablis.every(n => n.consomme.length === 0),
    'et aucun ne se voit inventer un fil',
  );
  // Le second sens : un moteur dont les entrees SONT lisibles ne doit
  // pas se declarer non etabli, faute de quoi la mention serait une
  // porte de sortie plutot qu un constat.
  const etablis = GRAPHE_FLUX.filter(n => !n.entreesNonEtablies && n.id !== 'extraction');
  check(etablis.every(n => n.consomme.length > 0), 'tout moteur etabli porte au moins une entree');
  check(
    GRAPHE_FLUX.find(n => n.id === 'extraction')!.consomme.length === 0,
    'la racine ne consomme rien, et c est ce qui en fait la racine',
  );
}

console.log('\n[Suite 4] le flux est un graphe et non une chronologie');
{
  const aretes = aretesDuFlux();
  const depuisExtraction = aretes.filter(a => a.from === 'extraction').length;
  // LE FAIT QUE LA TOILE DOIT MONTRER. Prelude ne pose pas vingt-deux
  // questions independantes : il lit un document, puis chaque moteur
  // travaille sur ce que les precedents ont etabli.
  check(depuisExtraction >= 12, `extraction alimente ${depuisExtraction} moteurs`);
  const versOrchestrate = aretes.filter(a => a.to === 'orchestrate').length;
  check(versOrchestrate >= 8, `la synthese consomme ${versOrchestrate} moteurs`);
  // Un graphe de flux a des noeuds multi-parents : c est ce qui le
  // distingue d une chronologie, ou chaque etape n aurait qu un
  // predecesseur.
  const multiParents = GRAPHE_FLUX.filter(n => n.consomme.length > 1).length;
  check(multiParents >= 8, `${multiParents} moteurs consomment plus d une sortie`);
  // Aucun cycle : un moteur ne peut pas consommer sa propre sortie,
  // directement ou non.
  const rang = new Map<string, number>();
  const calculer = (id: string, vus: Set<string>): number => {
    if (vus.has(id)) return -1;
    if (rang.has(id)) return rang.get(id)!;
    const n = GRAPHE_FLUX.find(x => x.id === id);
    if (!n || !n.consomme.length) { rang.set(id, 0); return 0; }
    const suivants = new Set(vus); suivants.add(id);
    let max = 0;
    for (const d of n.consomme) {
      const r = calculer(d, suivants);
      if (r < 0) return -1;
      max = Math.max(max, r + 1);
    }
    rang.set(id, max);
    return max;
  };
  const cycles = GRAPHE_FLUX.filter(n => calculer(n.id, new Set()) < 0);
  check(cycles.length === 0, `aucun cycle dans le flux${cycles.length ? ` (${cycles.map(c => c.id).join(', ')})` : ''}`);
  // La table d identifiants ne doit pas renvoyer vers un moteur absent
  // du graphe, ce qui fabriquerait une arete vers un noeud inexistant.
  const ids = new Set(GRAPHE_FLUX.map(n => n.id));
  const orphelins = Object.values(IDENTIFIANT_VERS_MOTEUR).filter(m => !ids.has(m));
  check(orphelins.length === 0, `aucun identifiant ne renvoie hors du graphe${orphelins.length ? ` (${orphelins.join(', ')})` : ''}`);
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
