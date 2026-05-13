// ============================================================
// Tests d integration de la route cron inter-sectoriel
// ------------------------------------------------------------
// Verifie l auth Bearer CRON_SECRET, le predicat de garde de date
// (skip hors du 1er jour de trimestre), l idempotence (skip si
// brief deja persiste), et le pipeline complet en cas nominal.
//
// Aucun acces reseau, aucun LLM, aucune dependance Supabase
// reelle (tout est mocke via require.cache).
//
// Execution :
//   tsx app/api/cron/inter-sectoral-regenerate/route.test.ts
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

let mockExistingBriefForPeriod: any = null;
let mockAggregateResult: any = {
  status: 'success',
  brief: {
    period_quarter: '2026-Q2',
    generated_at: new Date().toISOString(),
    convergences: [],
    divergences: [],
    macro_patterns: [],
    narrative_summary: 'Mocked',
    sources_consulted: [],
    generation_metadata: {
      model: 'claude-opus-4-7',
      prompt_version: 'inter-v1',
      cost_usd: 0.5,
      duration_ms: 60000,
      previous_brief_id: null,
    },
  },
  cost_usd: 0.5,
  duration_ms: 60000,
};
let mockUpsertCalls = 0;

const aggregatorPath = require.resolve('@/lib/engines/sectoral-intelligence/inter-sector-aggregator');
require.cache[aggregatorPath] = {
  id: aggregatorPath,
  filename: aggregatorPath,
  loaded: true,
  exports: {
    aggregateInterSectoral: async () => mockAggregateResult,
    INTER_SECTORAL_PROMPT_VERSION: 'inter-v1',
  },
} as any;

const storePath = require.resolve('@/lib/engines/sectoral-intelligence/inter-sector-store');
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: {
    upsertInterSectoralBrief: async (b: any) => {
      mockUpsertCalls++;
      return { ...b, id: 'persisted-id' };
    },
    getInterSectoralBriefByPeriod: async () => mockExistingBriefForPeriod,
    getLatestInterSectoralBrief: async () => null,
    listInterSectoralPeriods: async () => [],
    listLatestBriefsAcrossSectors: async () => [],
    listBriefsForPreviousQuarter: async () => [],
  },
} as any;

async function loadRoute() {
  return import('./route');
}

function makeRequest(authValue?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authValue) headers.Authorization = authValue;
  return new NextRequest(new URL('http://localhost:3000/api/cron/inter-sectoral-regenerate'), {
    method: 'GET',
    headers,
  } as any);
}

// On simule la date du systeme via override de Date pour tester
// le guard "1er du trimestre". Restaure apres chaque scenario.
const RealDate = Date;
function freezeDate(iso: string): () => void {
  const frozen = new RealDate(iso);
  // @ts-ignore
  global.Date = class extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(frozen);
      } else {
        // @ts-ignore
        super(...args);
      }
    }
    static now() {
      return frozen.getTime();
    }
  };
  return () => {
    // @ts-ignore
    global.Date = RealDate;
  };
}

// ============================================================
async function run() {
  const route = await loadRoute();

  (process.env as Record<string, string>).NODE_ENV = 'production';
  process.env.CRON_SECRET = 'CRON-SECRET-VAL';

  console.log('\n--- auth ---');

  const r1 = await route.GET(makeRequest());
  check('sans header en prod retourne 401', r1.status, 401);

  const r2 = await route.GET(makeRequest('Bearer mauvais-secret'));
  check('mauvais secret en prod retourne 401', r2.status, 401);

  console.log('\n--- guard de date : non eligible ---');

  // Date non-eligible : 15 mai 2026
  let restore = freezeDate('2026-05-15T08:00:00Z');
  const r3 = await route.GET(makeRequest('Bearer CRON-SECRET-VAL'));
  check('hors 1er trimestre : 200 OK', r3.status, 200);
  const body3 = await r3.json();
  check('status skipped', body3.status, 'skipped');
  check('upsert non appele', mockUpsertCalls, 0);
  restore();

  console.log('\n--- guard de date : 2 janvier non eligible ---');

  restore = freezeDate('2026-01-02T08:00:00Z');
  const r4 = await route.GET(makeRequest('Bearer CRON-SECRET-VAL'));
  const body4 = await r4.json();
  check('2 janvier : status skipped', body4.status, 'skipped');
  restore();

  console.log('\n--- guard de date : 1er avril eligible ---');

  mockExistingBriefForPeriod = null;
  mockUpsertCalls = 0;
  restore = freezeDate('2026-04-01T08:00:00Z');
  const r5 = await route.GET(makeRequest('Bearer CRON-SECRET-VAL'));
  check('1er avril : 200 OK', r5.status, 200);
  const body5 = await r5.json();
  check('1er avril : status success', body5.status, 'success');
  check('1er avril : period_quarter = 2026-Q2', body5.period_quarter, '2026-Q2');
  check('1er avril : upsert appele', mockUpsertCalls, 1);
  restore();

  console.log('\n--- idempotence : 1er avril mais brief deja persiste ---');

  mockExistingBriefForPeriod = { id: 'already-here', period_quarter: '2026-Q2' };
  mockUpsertCalls = 0;
  restore = freezeDate('2026-04-01T08:00:00Z');
  const r6 = await route.GET(makeRequest('Bearer CRON-SECRET-VAL'));
  const body6 = await r6.json();
  check('idempotence : status already_exists', body6.status, 'already_exists');
  check('idempotence : upsert non rappele', mockUpsertCalls, 0);
  restore();

  console.log('\n--- agregation echoue : status propage ---');

  mockExistingBriefForPeriod = null;
  mockUpsertCalls = 0;
  mockAggregateResult = {
    status: 'rejected_no_data',
    brief: null,
    cost_usd: 0,
    duration_ms: 1000,
    rejection_reason: 'aucune fiche',
  };
  restore = freezeDate('2026-07-01T08:00:00Z');
  const r7 = await route.GET(makeRequest('Bearer CRON-SECRET-VAL'));
  const body7 = await r7.json();
  check('rejet d agregation : status propage', body7.status, 'rejected_no_data');
  check('rejet d agregation : upsert non appele', mockUpsertCalls, 0);
  restore();

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
