// ============================================================
// Tests d integration de la route cron /api/cron/sectoral-regenerate
// ------------------------------------------------------------
// Verifie l auth Bearer CRON_SECRET, le pipeline complet sur 13
// secteurs mockes a anciennetes variees (le selecteur prend les
// bonnes), la persistence appelee uniquement sur les succes, et
// la propagation correcte des verdicts dans la reponse JSON.
//
// Approche : neutralisation du module engine via require.cache
// pour controler getLatestBriefForSector, regenerateSectoralBrief
// et persistSectoralBrief sans toucher Anthropic ni Supabase.
//
// Execution :
//   tsx app/api/cron/sectoral-regenerate/route.test.ts
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

const NOW = new Date();
const MS_PER_DAY = 1000 * 60 * 60 * 24;
function daysAgoIso(n: number): string {
  return new Date(NOW.getTime() - n * MS_PER_DAY).toISOString();
}

// ============================================================
// MOCK DU MODULE ENGINE
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

const enginePath = require.resolve('@/lib/engines/sectoral-intelligence');
const realEngine = require(enginePath);

// Etat partage entre tests, reinitialise par scenario
let mockBriefAges: Record<string, string | null> = {};
let regenerateCalls: string[] = [];
let persistCalls: string[] = [];
let regenerateImpl: (sectorSlug: string, trigger: string) => Promise<any> = async () => ({
  status: 'success',
  brief: { sector_slug: 'unused', generated_at: NOW.toISOString() },
  dimensions_missing: [],
  total_sources_cited: 0,
  cost_usd: 0.42,
  duration_ms: 30000,
});

require.cache[enginePath] = {
  id: enginePath,
  filename: enginePath,
  loaded: true,
  exports: {
    ...realEngine,
    getLatestBriefForSector: async (slug: string) => {
      const at = mockBriefAges[slug];
      if (at === undefined) return null;
      if (at === null) return null;
      return {
        id: `prev-${slug}`,
        sector_slug: slug,
        generated_at: at,
        dimensions: {},
        narrative_summary: '',
        regeneration_trigger: 'cron',
        supersedes_id: null,
        generation_metadata: {
          dimension_model: 'claude-sonnet-4-6',
          aggregator_model: 'claude-opus-4-7',
          prompt_version: 'v1',
          cost_usd: 0,
          duration_ms: 0,
          dimensions_regenerated: [],
        },
      };
    },
    regenerateSectoralBrief: async (slug: string, trigger: string) => {
      regenerateCalls.push(slug);
      return regenerateImpl(slug, trigger);
    },
    persistSectoralBrief: async (b: any) => {
      persistCalls.push(b.sector_slug);
      return b;
    },
  },
} as any;

async function loadRoute() {
  const route = await import('./route');
  return route;
}

function makeRequest(authValue?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authValue) headers.Authorization = authValue;
  return new NextRequest(new URL('http://localhost:3000/api/cron/sectoral-regenerate'), {
    method: 'GET',
    headers,
  } as any);
}

// ============================================================
async function run() {
  const route = await loadRoute();

  // ----------------------------------------------------------
  console.log('\n--- auth ---');
  // ----------------------------------------------------------

  // process.env.NODE_ENV est readonly cote types, on bypass via cast
  // pour simuler l execution en production sans toucher au typage.
  (process.env as Record<string, string>).NODE_ENV = 'production';
  process.env.CRON_SECRET = 'CRON-SECRET-VALUE';

  const r1 = await route.GET(makeRequest());
  check('sans header en prod retourne 401', r1.status, 401);

  const r2 = await route.GET(makeRequest('Bearer mauvais-secret'));
  check('mauvais secret en prod retourne 401', r2.status, 401);

  // ----------------------------------------------------------
  console.log('\n--- pipeline complet sur 13 secteurs ---');
  // ----------------------------------------------------------

  // Reset etat
  regenerateCalls = [];
  persistCalls = [];
  mockBriefAges = {
    'logiciel-entreprise-horizontal': daysAgoIso(30), // recent
    'ia-appliquee': daysAgoIso(200), // perimee, prio 2
    fintech: daysAgoIso(100), // eligible
    'sante-biotech': daysAgoIso(45), // recent
    'climat-energie': daysAgoIso(140), // eligible, prio 4
    'mobilite-logistique': daysAgoIso(60), // recent
    'industrie-hardware': daysAgoIso(120), // eligible
    'agritech-foodtech': null, // jamais, prio 1
    'commerce-marketplaces': daysAgoIso(95), // eligible
    'cybersecurite-defense': daysAgoIso(150), // eligible, prio 3
    'crypto-blockchain': daysAgoIso(20), // recent
    'proptech-construction': daysAgoIso(75), // recent
    'education-future-of-work': daysAgoIso(85), // recent
  };

  regenerateImpl = async (slug) => ({
    status: 'success',
    brief: {
      sector_slug: slug,
      generated_at: NOW.toISOString(),
      dimensions: {},
      narrative_summary: '',
      regeneration_trigger: 'cron',
      supersedes_id: null,
      generation_metadata: {
        dimension_model: 'claude-sonnet-4-6',
        aggregator_model: 'claude-opus-4-7',
        prompt_version: 'v1',
        cost_usd: 0.42,
        duration_ms: 30000,
        dimensions_regenerated: [],
      },
    },
    dimensions_missing: [],
    total_sources_cited: 16,
    cost_usd: 0.42,
    duration_ms: 30000,
  });

  const r3 = await route.GET(makeRequest('Bearer CRON-SECRET-VALUE'));
  check('cron autorise retourne 200', r3.status, 200);

  const body3 = await r3.json();
  check('catalog_size = 13', body3.catalog_size, 13);
  check('eligible_count = 4 (truncated to budget)', body3.eligible_count, 4);
  check('processed_count = 4', body3.processed_count, 4);
  check('regenerateSectoralBrief appele 4 fois', regenerateCalls.length, 4);
  check('persistSectoralBrief appele 4 fois (tous succes)', persistCalls.length, 4);

  // Ordre attendu : agritech (jamais), ia-appliquee (200j),
  // cybersecurite (150j), climat-energie (140j)
  check('1er traite = agritech-foodtech', regenerateCalls[0], 'agritech-foodtech');
  check('2eme traite = ia-appliquee', regenerateCalls[1], 'ia-appliquee');
  check('3eme traite = cybersecurite-defense', regenerateCalls[2], 'cybersecurite-defense');
  check('4eme traite = climat-energie', regenerateCalls[3], 'climat-energie');

  checkTrue(
    'tous les results status=success',
    body3.results.every((r: any) => r.status === 'success'),
  );

  // ----------------------------------------------------------
  console.log('\n--- regeneration rejected_data_missing ---');
  // ----------------------------------------------------------

  regenerateCalls = [];
  persistCalls = [];

  regenerateImpl = async (slug) => ({
    status: 'rejected_data_missing',
    brief: null,
    dimensions_missing: ['intensite_capitalistique', 'pression_reglementaire', 'velocite_technologique'],
    total_sources_cited: 5,
    cost_usd: 0.15,
    duration_ms: 20000,
    rejection_reason: 'trois dimensions data_missing',
  });

  const r4 = await route.GET(makeRequest('Bearer CRON-SECRET-VALUE'));
  const body4 = await r4.json();
  check(
    'pipeline tient malgre rejets',
    body4.results.every((r: any) => r.status === 'rejected_data_missing'),
    true,
  );
  check('persist non appele si rejet', persistCalls.length, 0);
  check('processed_count reste = budget', body4.processed_count, 4);

  // ----------------------------------------------------------
  console.log('\n--- regeneration mixed (success + rejected_error) ---');
  // ----------------------------------------------------------

  regenerateCalls = [];
  persistCalls = [];

  let callIdx = 0;
  regenerateImpl = async (slug) => {
    callIdx++;
    if (callIdx === 2) {
      return {
        status: 'rejected_error',
        brief: null,
        dimensions_missing: [],
        total_sources_cited: 0,
        cost_usd: 0,
        duration_ms: 1000,
        rejection_reason: 'agregateur Opus a echoue',
        error_message: 'Anthropic 503',
      };
    }
    return {
      status: 'success',
      brief: {
        sector_slug: slug,
        generated_at: NOW.toISOString(),
        dimensions: {},
        narrative_summary: '',
        regeneration_trigger: 'cron',
        supersedes_id: null,
        generation_metadata: {
          dimension_model: 'claude-sonnet-4-6',
          aggregator_model: 'claude-opus-4-7',
          prompt_version: 'v1',
          cost_usd: 0.42,
          duration_ms: 30000,
          dimensions_regenerated: [],
        },
      },
      dimensions_missing: [],
      total_sources_cited: 16,
      cost_usd: 0.42,
      duration_ms: 30000,
    };
  };

  const r5 = await route.GET(makeRequest('Bearer CRON-SECRET-VALUE'));
  const body5 = await r5.json();
  check('un echec milieu de file ne bloque pas la suite', body5.processed_count, 4);
  check('persist appele 3 fois (3 succes sur 4)', persistCalls.length, 3);
  check('result 2 = rejected_error', body5.results[1]?.status, 'rejected_error');

  // ----------------------------------------------------------
  console.log('\n--- toutes les fiches recentes : aucune regeneration ---');
  // ----------------------------------------------------------

  regenerateCalls = [];
  persistCalls = [];

  for (const slug of Object.keys(mockBriefAges)) {
    mockBriefAges[slug] = daysAgoIso(10);
  }

  const r6 = await route.GET(makeRequest('Bearer CRON-SECRET-VALUE'));
  const body6 = await r6.json();
  check('eligible_count = 0 si tout recent', body6.eligible_count, 0);
  check('processed_count = 0 si tout recent', body6.processed_count, 0);
  check('regenerate non appele', regenerateCalls.length, 0);
  check('persist non appele', persistCalls.length, 0);

  // ----------------------------------------------------------
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
