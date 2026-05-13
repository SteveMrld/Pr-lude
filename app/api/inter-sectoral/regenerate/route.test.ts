// ============================================================
// Tests d integration sur le role check de la regeneration manuelle
// ------------------------------------------------------------
// Verifie que POST /api/inter-sectoral/regenerate refuse l acces
// non-super-admin (401, 403) et accepte un payload valide en 202.
//
// Approche : neutralisation de lib/auth, lib/error-logger, et du
// module engine via require.cache. Aucun appel reseau, aucun LLM.
//
// Execution :
//   tsx app/api/inter-sectoral/regenerate/route.test.ts
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
// MOCKS
// ============================================================

let mockUser: { id: string; email: string; displayName: string | null } | null = null;
let mockIsAdmin = false;

const authPath = require.resolve('@/lib/auth');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    isAuthEnabled: () => true,
    getCurrentUser: async () => mockUser,
    isSuperAdmin: async () => mockIsAdmin,
    getCurrentOrganization: async () => null,
    getAuthenticatedContext: async () => null,
    canEdit: () => false,
    canAdminister: () => false,
  },
} as any;

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

const aggregatorPath = require.resolve('@/lib/engines/sectoral-intelligence/inter-sector-aggregator');
require.cache[aggregatorPath] = {
  id: aggregatorPath,
  filename: aggregatorPath,
  loaded: true,
  exports: {
    aggregateInterSectoral: async () => ({
      status: 'rejected_no_data',
      brief: null,
      cost_usd: 0,
      duration_ms: 0,
      rejection_reason: 'mocked',
    }),
    INTER_SECTORAL_PROMPT_VERSION: 'inter-v1',
  },
} as any;

const storePath = require.resolve('@/lib/engines/sectoral-intelligence/inter-sector-store');
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: {
    upsertInterSectoralBrief: async (b: any) => b,
    getInterSectoralBriefByPeriod: async () => null,
    getLatestInterSectoralBrief: async () => null,
    listInterSectoralPeriods: async () => [],
    listLatestBriefsAcrossSectors: async () => [],
    listBriefsForPreviousQuarter: async () => [],
  },
} as any;

async function loadRoute() {
  return import('./route');
}

function makeRequest(body: any): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/inter-sectoral/regenerate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  } as any);
}

// ============================================================
async function run() {
  const route = await loadRoute();

  console.log('\n--- auth ---');

  mockUser = null;
  mockIsAdmin = false;
  const r1 = await route.POST(makeRequest({ period_quarter: '2026-Q2' }));
  check('sans session retourne 401', r1.status, 401);

  mockUser = { id: 'u1', email: 'user@test.io', displayName: null };
  mockIsAdmin = false;
  const r2 = await route.POST(makeRequest({ period_quarter: '2026-Q2' }));
  check('avec session non-admin retourne 403', r2.status, 403);

  console.log('\n--- super-admin nominal ---');

  mockUser = { id: 'admin', email: 'admin@prelude.io', displayName: 'Admin' };
  mockIsAdmin = true;

  const r3 = await route.POST(makeRequest({ period_quarter: '2026-Q2' }));
  check('super-admin avec body valide retourne 202', r3.status, 202);
  const body3 = await r3.json();
  checkTrue('reponse 202 contient accepted=true', body3.accepted === true);
  check('reponse 202 contient period_quarter', body3.period_quarter, '2026-Q2');
  check('reponse 202 contient triggered_by', body3.triggered_by, 'admin@prelude.io');

  console.log('\n--- defaults sur period_quarter ---');

  const r4 = await route.POST(makeRequest({}));
  check('body vide accepte avec period_quarter = courant', r4.status, 202);
  const body4 = await r4.json();
  checkTrue(
    'period_quarter defaut au format YYYY-Qn',
    /^\d{4}-Q[1-4]$/.test(body4.period_quarter),
  );

  const r5 = await route.POST(makeRequest({ period_quarter: 'invalid-format' }));
  check('period_quarter invalide tombe en defaut courant', r5.status, 202);
  const body5 = await r5.json();
  checkTrue(
    'period_quarter rejette le format invalide et retombe en defaut',
    /^\d{4}-Q[1-4]$/.test(body5.period_quarter),
  );

  console.log('\n--- body non-JSON tolere ---');

  const r6 = await route.POST(
    new NextRequest(new URL('http://localhost:3000/api/inter-sectoral/regenerate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'pas-du-json-{',
    } as any),
  );
  check('body non-JSON : 202 avec period_quarter defaut', r6.status, 202);

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
