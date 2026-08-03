// ============================================================
// Tests de la route cron cleanup-stale-running
// ------------------------------------------------------------
// Deux proprietes, dont la violation a ete reelle et silencieuse.
//
// La premiere est que l authentification ne se laisse pas satisfaire
// par un en-tete que l appelant choisit. La route a accepte pendant
// une semaine tout appel portant User-Agent: vercel-cron/, y compris
// quand CRON_SECRET etait configure et le header Authorization
// absent. Le secret ne protegeait alors rien.
//
// La seconde est que le seuil d immobilite reste superieur a la
// duree maximale d un run. Un balayage sous cette duree bascule en
// 'failed' des analyses vivantes, irreversiblement, et ce defaut est
// independant de l authentification : un cron parfaitement
// authentifie l aurait declenche sur un run un peu long.
//
// Execution :
//   tsx app/api/cron/cleanup-stale-running/route.test.ts
// ============================================================

import { NextRequest } from 'next/server';
import { evaluateCronAuth } from '@/lib/cron/auth';
import {
  MAX_PIPELINE_DURATION_MINUTES,
  MIN_STALE_THRESHOLD_MINUTES,
  STALE_SWEEP_THRESHOLD_MINUTES,
  enforceStaleThreshold,
} from '@/lib/analysis-store';

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

const SECRET = 'valeur-de-secret-qui-n-existe-nulle-part-ailleurs';

function req(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://prelude.app/api/cron/cleanup-stale-running', {
    headers: new Headers(headers),
  });
}

const savedSecret = process.env.CRON_SECRET;
const savedNodeEnv = process.env.NODE_ENV;

function setEnv(secret: string | undefined, nodeEnv: string) {
  if (secret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secret;
  // NODE_ENV est en lecture seule dans les typings Node mais reste un
  // champ ordinaire a l execution ; la route la lit dynamiquement, un
  // cast a l ecriture suffit.
  (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
}

// ------------------------------------------------------------
// Authentification. Le secret utilise ici est une valeur que rien
// d autre ne peut fournir : si une branche autorisait sans le lire,
// le test ne pourrait pas le confondre avec une reussite legitime.
// ------------------------------------------------------------
console.log('\nAuthentification, secret configure, en production');
setEnv(SECRET, 'production');

check(
  'Bearer exact autorise',
  evaluateCronAuth(req({ authorization: `Bearer ${SECRET}` })).authorized,
  true,
);
check(
  'Bearer absent refuse',
  evaluateCronAuth(req({})).authorized,
  false,
);
check(
  'Bearer errone refuse',
  evaluateCronAuth(req({ authorization: 'Bearer mauvais' })).authorized,
  false,
);
check(
  'secret nu sans le prefixe Bearer refuse',
  evaluateCronAuth(req({ authorization: SECRET })).authorized,
  false,
);

// La regression precise qui a ouvert la route. Un appelant anonyme
// choisit son User-Agent ; il ne doit rien lui acheter.
check(
  'user-agent vercel-cron sans Authorization refuse',
  evaluateCronAuth(req({ 'user-agent': 'vercel-cron/1.0' })).authorized,
  false,
);
check(
  'user-agent vercel-cron avec Authorization erronee refuse',
  evaluateCronAuth(req({ 'user-agent': 'vercel-cron/1.0', authorization: 'Bearer mauvais' })).authorized,
  false,
);

console.log('\nAuthentification, secret absent');
setEnv(undefined, 'production');
check(
  'sans secret en production, refus',
  evaluateCronAuth(req({})).authorized,
  false,
);
check(
  'sans secret en production, user-agent vercel-cron ne rachete rien',
  evaluateCronAuth(req({ 'user-agent': 'vercel-cron/1.0' })).authorized,
  false,
);

setEnv(undefined, 'development');
check(
  'sans secret hors production, autorise pour le declenchement manuel',
  evaluateCronAuth(req({})).authorized,
  true,
);

setEnv(savedSecret, savedNodeEnv || 'test');

// ------------------------------------------------------------
// Plancher du seuil. La garantie est portee par le store, donc
// c est le store qu on interroge, pas la constante de la route.
// ------------------------------------------------------------
console.log('\nPlancher du seuil d immobilite');

checkTrue(
  `le plancher (${MIN_STALE_THRESHOLD_MINUTES} min) depasse la duree max d un run (${MAX_PIPELINE_DURATION_MINUTES.toFixed(2)} min)`,
  MIN_STALE_THRESHOLD_MINUTES > MAX_PIPELINE_DURATION_MINUTES,
);
checkTrue(
  'le plancher garde une marge d au moins cinq minutes sur la duree max',
  MIN_STALE_THRESHOLD_MINUTES - MAX_PIPELINE_DURATION_MINUTES >= 5,
);
checkTrue(
  `la politique de la route (${STALE_SWEEP_THRESHOLD_MINUTES} min) respecte le plancher`,
  STALE_SWEEP_THRESHOLD_MINUTES >= MIN_STALE_THRESHOLD_MINUTES,
);

// La valeur exacte qui etait atteignable par query string.
check('un seuil de 5 minutes est remonte au plancher', enforceStaleThreshold(5), MIN_STALE_THRESHOLD_MINUTES);
check('un seuil de 0 est remonte au plancher', enforceStaleThreshold(0), MIN_STALE_THRESHOLD_MINUTES);
check('un seuil negatif est remonte au plancher', enforceStaleThreshold(-100), MIN_STALE_THRESHOLD_MINUTES);
check('un NaN est remonte au plancher', enforceStaleThreshold(Number.NaN), MIN_STALE_THRESHOLD_MINUTES);
check('un seuil legitime passe intact', enforceStaleThreshold(STALE_SWEEP_THRESHOLD_MINUTES), STALE_SWEEP_THRESHOLD_MINUTES);
check('un seuil large passe intact', enforceStaleThreshold(1440), 1440);

// ------------------------------------------------------------
// Ce que ce fichier n exerce pas, et qu il ne faut pas compter
// comme couvert.
//
// L appel de GET lui-meme n est pas joue : il ecrit dans error_logs
// et lit la table analyses des la premiere ligne, donc l exercer
// demanderait un Supabase joignable, ce qui sortirait la suite du
// deterministe. En consequence, deux choses restent verifiees par
// lecture et non par assertion : que GET consomme bien la constante
// plutot que la query string, et que le log d invocation precede la
// garde. La seconde est ce qui a rendu la panne demontrable, elle
// merite un jour un test d integration.
//
// Le plancher, lui, est verrouille la ou il compte : meme si un
// appelant reintroduisait un seuil arbitraire, enforceStaleThreshold
// le ramenerait, et c est cette fonction qui est testee ici.
// ------------------------------------------------------------

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
