// ============================================================
// Tests d integration des trois routes cron restees sans test
// ------------------------------------------------------------
// milestone-detection, trajectory-digest et trajectory-reanalysis sont
// les trois taches planifiees qui ont passe trois mois mortes,
// interceptees par le middleware et redirigees en 307 avant d atteindre
// leur handler. La correction du middleware est verrouillee ailleurs,
// par middleware.test.ts, qui verifie que les chemins declares dans
// vercel.json sont exclus. Ce qui n etait verrouille nulle part, c est
// que le handler, une fois atteint, refuse.
//
// Les deux gardes se completent et aucune ne remplace l autre. Le test
// du middleware dit que la requete arrive ; celui-ci dit ce qu elle
// trouve en arrivant. Une route accessible et ouverte serait un defaut
// plus grave que la panne d origine, puisque deux de ces trois routes
// declenchent des appels au modele factures et que la troisieme envoie
// des courriels a des partners.
//
// Un seul fichier pour les trois, et c est deliberé. Trois fichiers
// quasi identiques seraient la situation meme que lib/cron/auth.ts a
// ete ecrit pour supprimer : des copies localement coherentes dont une
// finit par diverger sans que rien ne le montre.
//
//   npx tsx app/api/cron/routes-guard.test.ts
// ============================================================

import { neutraliserServerOnly } from '@/lib/test-support/supabase-double';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

neutraliserServerOnly();

// ============================================================
// Doubles. Tout ce qui travaille est double : le but est de constater
// qu on n arrive jamais jusqu au travail, et un double qui compte ses
// appels le prouve mieux qu une absence d effet.
// ============================================================

const travaux: string[] = [];
function poserDouble(chemin: string, exports: Record<string, unknown>) {
  const p = require.resolve(chemin);
  let reel: Record<string, unknown> = {};
  try { reel = require(p); } catch { /* module a effets de bord */ }
  require.cache[p] = { id: p, filename: p, loaded: true, exports: { ...reel, ...exports } } as any;
}

let persistenceActive = true;

poserDouble('@/lib/analysis-store', {
  isPersistenceEnabled: () => persistenceActive,
  listAllInPortfolioAnalyses: async () => { travaux.push('listAllInPortfolioAnalyses'); return []; },
  getAnalysis: async () => { travaux.push('getAnalysis'); return null; },
});
poserDouble('@/lib/reconciliation-store', {
  listOutcomesForDetection: async () => { travaux.push('listOutcomesForDetection'); return []; },
  listMilestonesForDedup: async () => { travaux.push('listMilestonesForDedup'); return []; },
  addMilestone: async () => { travaux.push('addMilestone'); return null; },
});
poserDouble('@/lib/trajectory-store', {
  getLatestSnapshot: async () => { travaux.push('getLatestSnapshot'); return null; },
});
poserDouble('@/lib/cron/milestone-detection-runner', {
  runMilestoneDetection: async () => { travaux.push('runMilestoneDetection'); return { analysisId: '', status: 'skipped', detected: 0, inserted: 0 }; },
});
poserDouble('@/lib/cron/trajectory-weekly-digest', {
  runWeeklyDigest: async () => { travaux.push('runWeeklyDigest'); return { sent: 0, skipped: 0 }; },
});
poserDouble('@/lib/cron/portfolio-reanalysis-runner', {
  runAutoReanalysis: async () => { travaux.push('runAutoReanalysis'); return { relances: 0 }; },
});
poserDouble('@/lib/supabase/server', {
  getSupabaseAdminClient: () => { travaux.push('getSupabaseAdminClient'); return null; },
});

const SECRET = 'secret-temoin-XJ4417';

/** Requete cron minimale. NextRequest exige une URL absolue. */
function requete(entetes: Record<string, string> = {}): any {
  const { NextRequest } = require('next/server');
  return new NextRequest('https://prelude.test/api/cron/x', { headers: entetes });
}

const ROUTES = [
  { nom: 'milestone-detection', chemin: './milestone-detection/route' },
  { nom: 'trajectory-digest', chemin: './trajectory-digest/route' },
  { nom: 'trajectory-reanalysis', chemin: './trajectory-reanalysis/route' },
];

(async () => {
  for (const r of ROUTES) {
    console.log(`\n[${r.nom}]`);
    const mod = await import(r.chemin);

    // Que le handler existe et soit atteignable est la premiere chose
    // a verifier : c est precisement ce qui manquait pendant trois mois.
    check(typeof mod.GET === 'function', 'la route expose un handler GET atteignable depuis le test');

    // ---- refus, secret configure et en-tete absent ----
    {
      const avant = process.env.CRON_SECRET;
      process.env.CRON_SECRET = SECRET;
      travaux.length = 0;
      const rep = await mod.GET(requete());
      const corps = await rep.json();
      check(rep.status === 401, 'sans Authorization : 401');
      check(corps?.error === 'unauthorized', 'et le corps dit unauthorized');
      check(travaux.length === 0, 'aucun travail declenche : la garde est atteinte avant tout le reste');
      if (avant === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = avant;
    }

    // ---- refus, mauvais secret ----
    {
      const avant = process.env.CRON_SECRET;
      process.env.CRON_SECRET = SECRET;
      travaux.length = 0;
      const rep = await mod.GET(requete({ authorization: 'Bearer mauvais-QN8802' }));
      check(rep.status === 401, 'avec un mauvais Bearer : 401');
      check(travaux.length === 0, 'et toujours aucun travail');
      if (avant === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = avant;
    }

    // ---- refus, User-Agent seul ----
    {
      const avant = process.env.CRON_SECRET;
      process.env.CRON_SECRET = SECRET;
      travaux.length = 0;
      const rep = await mod.GET(requete({ 'user-agent': 'vercel-cron/1.0' }));
      check(rep.status === 401, 'un User-Agent vercel-cron ne suffit pas : 401');
      check(travaux.length === 0, 'et il ne declenche rien');
      if (avant === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = avant;
    }

    // ---- le bon secret franchit la garde ----
    {
      // Sans ce cas, les trois refus precedents seraient indiscernables
      // d une route qui refuse tout, y compris le cron legitime. C est
      // le controle de sensibilite de la garde elle-meme.
      const avant = process.env.CRON_SECRET;
      process.env.CRON_SECRET = SECRET;
      persistenceActive = false;
      travaux.length = 0;
      const rep = await mod.GET(requete({ authorization: `Bearer ${SECRET}` }));
      check(rep.status !== 401, 'avec le bon Bearer : la garde d authentification est franchie');
      check(rep.status === 503, 'et la garde suivante, celle de la persistence, repond 503');
      check(travaux.length === 0, 'sans persistence, aucun travail non plus');
      persistenceActive = true;
      if (avant === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = avant;
    }
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
