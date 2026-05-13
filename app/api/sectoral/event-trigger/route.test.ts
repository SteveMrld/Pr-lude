// ============================================================
// Tests d integration du webhook /api/sectoral/event-trigger
// ------------------------------------------------------------
// Verifie que le endpoint refuse l acces sans token (401), refuse
// les payloads invalides (400), refuse si SECTORAL_EVENT_TOKEN
// n est pas configure cote serveur (503), et accepte un payload
// valide avec un token correct (202).
//
// Approche : neutralisation de lib/auth, lib/error-logger et
// lib/engines/sectoral-intelligence via require.cache. Aucun
// acces reseau, aucun appel LLM.
//
// Execution :
//   tsx app/api/sectoral/event-trigger/route.test.ts
// ============================================================

import { NextRequest } from 'next/server';

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

// ============================================================
// MOCK DES DEPS
// ============================================================

const errorLoggerPath = require.resolve('@/lib/error-logger');
require.cache[errorLoggerPath] = {
  id: errorLoggerPath,
  filename: errorLoggerPath,
  loaded: true,
  exports: {
    logError: async () => {},
    logException: async () => {},
    logExceptionAsync: () => {},
  },
} as any;

// Mock du module engine pour eviter les vrais appels LLM. Le job
// background va appeler regenerateSectoralBrief : on retourne un
// rejet rapide pour ne pas tenir l event loop ouvert.
const enginePath = require.resolve('@/lib/engines/sectoral-intelligence');
const realEngine = require(enginePath);
require.cache[enginePath] = {
  id: enginePath,
  filename: enginePath,
  loaded: true,
  exports: {
    ...realEngine,
    getLatestBriefForSector: async () => null,
    persistSectoralBrief: async (b: any) => b,
    regenerateSectoralBrief: async () => ({
      status: 'rejected_data_missing',
      brief: null,
      dimensions_missing: [],
      total_sources_cited: 0,
      cost_usd: 0,
      duration_ms: 0,
      rejection_reason: 'mocked',
    }),
  },
} as any;

async function loadRoute() {
  const mod = await import('./route');
  return mod;
}

function makeRequest(headers: Record<string, string>, body: any): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/sectoral/event-trigger'), {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  } as any);
}

// ============================================================
async function run() {
  const route = await loadRoute();

  // ----------------------------------------------------------
  console.log('\n--- token absent cote serveur ---');
  // ----------------------------------------------------------

  delete process.env.SECTORAL_EVENT_TOKEN;
  const r1 = await route.POST(
    makeRequest(
      { 'Content-Type': 'application/json', Authorization: 'Bearer anything' },
      { event_type: 'regulatory.act_adoption', sector_slug: 'fintech', rationale: 'rationale longue qui passe le minimum' },
    ),
  );
  check('token serveur absent retourne 503', r1.status, 503);

  // ----------------------------------------------------------
  console.log('\n--- token configure ---');
  // ----------------------------------------------------------

  process.env.SECTORAL_EVENT_TOKEN = 'TEST-TOKEN-123';

  const r2 = await route.POST(
    makeRequest(
      { 'Content-Type': 'application/json' },
      { event_type: 'regulatory.act_adoption', sector_slug: 'fintech', rationale: 'rationale longue qui passe le minimum' },
    ),
  );
  check('header Authorization absent retourne 401', r2.status, 401);

  const r3 = await route.POST(
    makeRequest(
      { 'Content-Type': 'application/json', Authorization: 'Bearer mauvais-token' },
      { event_type: 'regulatory.act_adoption', sector_slug: 'fintech', rationale: 'rationale longue qui passe le minimum' },
    ),
  );
  check('mauvais token retourne 401', r3.status, 401);

  // ----------------------------------------------------------
  console.log('\n--- validation payload (token correct) ---');
  // ----------------------------------------------------------

  const r4 = await route.POST(
    new NextRequest(new URL('http://localhost:3000/api/sectoral/event-trigger'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer TEST-TOKEN-123' },
      body: 'pas-du-json-{',
    } as any),
  );
  check('body non-JSON retourne 400', r4.status, 400);

  const r5 = await route.POST(
    makeRequest(
      { 'Content-Type': 'application/json', Authorization: 'Bearer TEST-TOKEN-123' },
      {},
    ),
  );
  check('body vide retourne 400', r5.status, 400);

  const r6 = await route.POST(
    makeRequest(
      { 'Content-Type': 'application/json', Authorization: 'Bearer TEST-TOKEN-123' },
      { event_type: 'reg', sector_slug: 'inconnu', rationale: 'rationale longue qui passe le minimum' },
    ),
  );
  check('sector inconnu retourne 400', r6.status, 400);

  const r7 = await route.POST(
    makeRequest(
      { 'Content-Type': 'application/json', Authorization: 'Bearer TEST-TOKEN-123' },
      { event_type: 'regulatory.act_adoption', sector_slug: 'fintech', rationale: 'court' },
    ),
  );
  check('rationale trop courte retourne 400', r7.status, 400);

  // Cas nominal
  const r8 = await route.POST(
    makeRequest(
      { 'Content-Type': 'application/json', Authorization: 'Bearer TEST-TOKEN-123' },
      {
        event_type: 'regulatory.act_adoption',
        sector_slug: 'fintech',
        rationale: 'SVB en resolution, contagion attendue sur les startups americaines.',
      },
    ),
  );
  check('payload valide + token correct retourne 202', r8.status, 202);
  const body8 = await r8.json();
  checkTrue('reponse 202 contient accepted=true', body8.accepted === true);
  check('reponse 202 contient sector_slug', body8.sector_slug, 'fintech');
  check('reponse 202 contient event_type', body8.event_type, 'regulatory.act_adoption');
  checkTrue(
    'reponse 202 contient rationale_preview',
    typeof body8.rationale_preview === 'string' && body8.rationale_preview.length > 0,
  );

  // Defense croisee : un token CRON_SECRET ne doit pas deverrouiller
  // ce endpoint, meme s il est configure ailleurs.
  process.env.CRON_SECRET = 'CRON-SECRET-VALUE';
  const r9 = await route.POST(
    makeRequest(
      { 'Content-Type': 'application/json', Authorization: 'Bearer CRON-SECRET-VALUE' },
      { event_type: 'regulatory.act_adoption', sector_slug: 'fintech', rationale: 'rationale longue qui passe le minimum' },
    ),
  );
  check('CRON_SECRET ne deverrouille pas event-trigger', r9.status, 401);

  // ----------------------------------------------------------
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
