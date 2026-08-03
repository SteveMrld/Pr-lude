// ============================================================
// Tests deterministes de la garde des taches planifiees
// ------------------------------------------------------------
// Le module est le point de passage unique des crons, cree apres la
// decouverte qu une des six copies de la garde avait diverge en
// acceptant un User-Agent choisi par l appelant. Un point de passage
// unique ne vaut que s il est juste : quand toutes les routes en
// dependent, sa faute devient la faute de toutes, ce qui est le prix du
// gain. Il est donc le morceau du depot qui merite le plus d etre
// verrouille, et il n avait aucun test a lui.
//
// Quatre proprietes, dont deux sont des refus.
//
//   npx tsx lib/cron/auth.test.ts
// ============================================================

import { evaluateCronAuth, isCronAuthorized } from './auth';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Requete minimale : la garde ne lit que les en-tetes. */
function requete(entetes: Record<string, string> = {}): any {
  const bas = new Map(Object.entries(entetes).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (n: string) => bas.get(n.toLowerCase()) ?? null } };
}

const SECRET = 'secret-temoin-XJ4417';

function avecEnv(vars: Record<string, string | undefined>, corps: () => void) {
  const avant: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    avant[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try { corps(); } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ============================================================
console.log('\n[Suite 1] secret configure : Bearer strict');
// ============================================================

avecEnv({ CRON_SECRET: SECRET }, () => {
  check(evaluateCronAuth(requete({ authorization: `Bearer ${SECRET}` })).authorized === true,
    'le bon Bearer passe');
  check(evaluateCronAuth(requete({ Authorization: `Bearer ${SECRET}` })).authorized === true,
    'et la casse du nom d en-tete est indifferente');

  check(evaluateCronAuth(requete()).authorized === false,
    'aucun en-tete : refuse');
  check(evaluateCronAuth(requete({ authorization: 'Bearer mauvais-secret-QN8802' })).authorized === false,
    'un secret errone : refuse');
  check(evaluateCronAuth(requete({ authorization: SECRET })).authorized === false,
    'le secret nu sans le mot Bearer : refuse, la forme fait partie du contrat');
  check(evaluateCronAuth(requete({ authorization: `bearer ${SECRET}` })).authorized === false,
    'un bearer minuscule : refuse, la comparaison est exacte');
  check(evaluateCronAuth(requete({ authorization: `Bearer ${SECRET} ` })).authorized === false,
    'un espace de trop : refuse');

  // La faute d origine, verrouillee ici et non dans une seule route.
  // Un en-tete que l appelant compose lui-meme ne prouve rien, et
  // c est exactement ce qui avait laisse passer tout appel pendant une
  // semaine sur la route qui ecrit un statut terminal.
  check(evaluateCronAuth(requete({ 'user-agent': 'vercel-cron/1.0' })).authorized === false,
    'un User-Agent vercel-cron sans Authorization : refuse');
  check(evaluateCronAuth(requete({ 'user-agent': 'vercel-cron/1.0', 'x-vercel-cron': '1' })).authorized === false,
    'et aucun autre en-tete choisi par l appelant ne remplace le secret');
});

// ============================================================
console.log('\n[Suite 2] les deux refus ne se confondent pas');
// ============================================================

avecEnv({ CRON_SECRET: SECRET }, () => {
  const r = evaluateCronAuth(requete());
  check(r.reason.includes('defini cote serveur'),
    'secret present et en-tete absent : la raison designe l appelant');
});

avecEnv({ CRON_SECRET: undefined, NODE_ENV: 'production' }, () => {
  const r = evaluateCronAuth(requete({ authorization: `Bearer ${SECRET}` }));
  check(r.authorized === false, 'secret absent en production : refuse meme avec un en-tete');
  check(r.reason.includes('absent cote serveur'),
    'et la raison designe la configuration du serveur, pas l appelant');
  // La distinction existe pour qu un 401 dise s il faut configurer une
  // variable ou la corriger. Deux raisons identiques la perdraient.
  const autre = (() => { let x = ''; avecEnv({ CRON_SECRET: SECRET }, () => { x = evaluateCronAuth(requete()).reason; }); return x; })();
  check(r.reason !== autre, 'les deux raisons sont distinctes, sans quoi le 401 ne dirait rien');
});

// ============================================================
console.log('\n[Suite 3] hors production, la tolerance est bornee au cas sans secret');
// ============================================================

avecEnv({ CRON_SECRET: undefined, NODE_ENV: 'development' }, () => {
  check(evaluateCronAuth(requete()).authorized === true,
    'sans secret hors production : accepte, pour permettre le declenchement manuel');
});

avecEnv({ CRON_SECRET: SECRET, NODE_ENV: 'development' }, () => {
  // Le point qui compte : hors production n est pas un blanc-seing. Des
  // qu un secret est configure, il est exige, y compris en local.
  check(evaluateCronAuth(requete()).authorized === false,
    'avec un secret configure hors production : exige quand meme le Bearer');
  check(evaluateCronAuth(requete({ authorization: `Bearer ${SECRET}` })).authorized === true,
    'et le bon Bearer passe');
});

// ============================================================
console.log('\n[Suite 4] la forme booleenne dit la meme chose que la forme detaillee');
// ============================================================

avecEnv({ CRON_SECRET: SECRET }, () => {
  // Cinq routes lisent la forme courte et une la forme longue. Si les
  // deux divergeaient, on aurait recree la situation que ce module a
  // ete ecrit pour supprimer.
  const cas = [
    requete(),
    requete({ authorization: `Bearer ${SECRET}` }),
    requete({ authorization: 'Bearer faux-QN8802' }),
    requete({ 'user-agent': 'vercel-cron/1.0' }),
  ];
  const accord = cas.every((r) => isCronAuthorized(r) === evaluateCronAuth(r).authorized);
  check(accord, 'isCronAuthorized suit evaluateCronAuth sur les quatre cas');
  // Et le jeu n est pas trivial : il contient au moins un accepte et un refuse.
  check(cas.some((r) => isCronAuthorized(r)) && cas.some((r) => !isCronAuthorized(r)),
    'le jeu porte les deux issues, l accord n est pas celui de deux constantes');
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
