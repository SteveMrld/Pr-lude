// ============================================================
// Tests du middleware d authentification
// ------------------------------------------------------------
// Verrouille la seule propriete du middleware dont la violation est
// silencieuse : les taches planifiees ne doivent jamais etre traitees
// comme des routes protegees. Sous ENABLE_AUTH, le middleware les
// redirigeait en 307 vers /login. Un 307 se lit comme un succes dans
// les logs Vercel Cron, donc les six taches ont paru actives pendant
// des mois sans jamais atteindre leur handler.
//
// Le test compare le declare au reel : il lit les chemins depuis
// vercel.json au lieu d en garder une copie. Une septieme tache
// planifiee sera donc couverte sans que personne ait a penser a ce
// fichier, et une regression du matcher la fera echouer.
//
// Execution :
//   tsx middleware.test.ts
// ============================================================

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { config, isCronPath, isHeaderGuardedPath, HEADER_GUARDED_PATHS } from './middleware';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

// ------------------------------------------------------------
// Le matcher Next est une chaine litterale compilee en expression
// reguliere ancree sur le pathname. On reproduit cet ancrage pour
// pouvoir interroger le matcher reellement exporte, et non une
// transcription de ce qu on croit qu il contient.
// ------------------------------------------------------------
const matcherSources = config.matcher;
checkTrue('le middleware exporte au moins un matcher', matcherSources.length > 0);

function isMatchedByMiddleware(pathname: string): boolean {
  return matcherSources.some((src) => new RegExp(`^${src}$`).test(pathname));
}

// ------------------------------------------------------------
// Source de verite : les chemins reellement planifies.
// ------------------------------------------------------------
interface VercelCron { path: string; schedule: string }
const vercelConfig = JSON.parse(
  readFileSync(join(process.cwd(), 'vercel.json'), 'utf-8'),
) as { crons?: VercelCron[] };
const cronPaths = (vercelConfig.crons || []).map((c) => c.path);

console.log(`\nvercel.json declare ${cronPaths.length} tache(s) planifiee(s)`);
checkTrue('vercel.json declare au moins une tache planifiee', cronPaths.length > 0);

for (const p of cronPaths) {
  checkTrue(`${p} est hors du matcher du middleware`, !isMatchedByMiddleware(p));
  checkTrue(`${p} est reconnu par isCronPath`, isCronPath(p));
}

// ------------------------------------------------------------
// Controle inverse. Une exclusion trop large rouvrirait l application
// entiere : ces chemins doivent rester couverts par le middleware.
// Sans ces assertions, un matcher qui n exclut plus rien passerait le
// bloc precedent a condition d exclure tout.
// ------------------------------------------------------------
const STILL_PROTECTED = [
  '/api/analyze',
  '/api/trajectory/snapshot',
  '/historique',
  '/onboarding',
  '/admin/sectoral',
];

for (const p of STILL_PROTECTED) {
  checkTrue(`${p} reste soumis au middleware`, isMatchedByMiddleware(p));
  check(`${p} n est pas pris pour une tache planifiee`, isCronPath(p), false);
}

// ------------------------------------------------------------
// Precision du prefixe. L exclusion porte sur le segment /api/cron/,
// pas sur toute chaine qui commence par ces lettres : une route
// d administration nommee ainsi ne doit pas heriter de la dispense.
// ------------------------------------------------------------
const DECOYS = ['/api/cronjobs-admin', '/api/cron-history', '/apicron/x'];
for (const p of DECOYS) {
  check(`${p} n est pas reconnu comme tache planifiee`, isCronPath(p), false);
  checkTrue(`${p} reste soumis au middleware`, isMatchedByMiddleware(p));
}

// ============================================================
// LES ROUTES GARDEES PAR EN-TETE, CONFRONTEES AU DEPOT
// ------------------------------------------------------------
// La premiere correction portait sur le prefixe /api/cron/. C etait le
// mauvais critere : ce qui distingue ces routes n est pas leur
// emplacement mais leur mode d authentification. Le webhook sectoriel
// event-trigger se garde par en-tete, vit ailleurs, et portait donc la
// meme panne sans que rien ne la signale.
//
// Ce bloc verrouille le critere reel. Il releve dans app/api les
// routes qui lisent un en-tete d autorisation, et exige que chacune
// soit ecartee du middleware. Trois declarations doivent coincider :
// HEADER_GUARDED_PATHS, le matcher litteral, et le depot. Le test
// echoue des que l une diverge, ce qui est la seule forme qui survive
// a l ajout d une huitieme route par quelqu un qui ne lira pas ce
// fichier.
// ============================================================

console.log('\n--- routes gardees par en-tete ---');

function routesGardeesParEnTete(): string[] {
  const racine = join(process.cwd(), 'app', 'api');
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const nom of readdirSync(dir)) {
      const chemin = join(dir, nom);
      if (statSync(chemin).isDirectory()) { walk(chemin); continue; }
      if (nom !== 'route.ts') continue;
      const src = readFileSync(chemin, 'utf-8');
      // Une route gardee par en-tete lit l en-tete Authorization,
      // directement ou via la garde partagee des taches planifiees.
      const litEnTete =
        /headers\.get\(\s*['"]authorization['"]\s*\)/i.test(src)
        || /isCronAuthorized|evaluateCronAuth/.test(src);
      if (!litEnTete) continue;
      const rel = chemin
        .slice(join(process.cwd(), 'app').length)
        .replace(/\\/g, '/')
        .replace(/\/route\.ts$/, '');
      out.push(rel);
    }
  };
  walk(racine);
  return out.sort();
}

const gardees = routesGardeesParEnTete();
checkTrue(`le depot porte des routes gardees par en-tete (${gardees.length})`, gardees.length > 0);

for (const route of gardees) {
  checkTrue(`${route} est reconnue comme gardee par en-tete`, isHeaderGuardedPath(route));
  check(`${route} est ecartee du matcher`, isMatchedByMiddleware(route), false);
}

// L inverse aussi : un chemin declare garde par en-tete qui ne
// correspondrait a aucune route du depot serait une entree perimee,
// et une entree perimee ouvre le middleware sur un chemin qui n a plus
// de garde propre.
for (const declare of HEADER_GUARDED_PATHS) {
  const couvre = gardees.some((r) =>
    declare.endsWith('/') ? r.startsWith(declare) : r === declare,
  );
  checkTrue(`le chemin declare ${declare} correspond a une route reelle`, couvre);
}

// Une route qui n est pas gardee par en-tete ne doit pas etre ecartee :
// une exclusion trop large rendrait publique une route protegee, ce qui
// est le sens inverse de l erreur et il est pire.
check('une route applicative reste soumise au middleware', isHeaderGuardedPath('/api/analyses/list'), false);
check('la racine sectorielle n est pas ecartee en bloc', isHeaderGuardedPath('/api/sectoral/autre-chose'), false);
checkTrue('la route applicative reste dans le matcher', isMatchedByMiddleware('/api/analyses/list'));

// ------------------------------------------------------------
// Ce que ce fichier n exerce pas, et qu il ne faut donc pas compter
// comme couvert : l appel effectif de middleware() sous ENABLE_AUTH
// avec une session Supabase reelle. Le verifier demanderait un client
// Supabase joignable, donc un appel reseau dans une suite qui doit
// rester deterministe. La sortie anticipee est placee avant toute
// lecture de session, ce qui rend ce chemin sans effet observable
// autre que celui teste ici.
// ------------------------------------------------------------

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
