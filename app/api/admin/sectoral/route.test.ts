// ============================================================
// Tests d integration sur le role check des routes admin sectoral
// ------------------------------------------------------------
// Verifie que GET /api/admin/sectoral et POST /api/admin/sectoral
// /regenerate refusent un acces non-super-admin avec 401 (pas de
// session) ou 403 (session sans role admin), avant meme de
// toucher a Supabase ou au regenerator.
//
// Approche : on neutralise lib/auth via require.cache et on
// invoque les handlers exportes directement avec un NextRequest
// minimaliste. Aucun acces reseau, aucun appel LLM.
//
// Execution :
//   tsx app/api/admin/sectoral/route.test.ts
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
// MOCK DE LIB/AUTH
// On instrumente l export avant d importer les routes pour que
// les routes voient nos versions mockees plutot que les vraies.
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

// Mock minimaliste de getSupabaseAdminClient pour eviter qu une
// session valide ne tape une vraie base. Sert si jamais on
// arrive jusqu au point ou on lit sectoral_briefs : on doit
// reussir a lire (vide). Mais le vrai but ici, c est de tester
// le rejet avant ce point.
const supabasePath = require.resolve('@/lib/supabase/server');
require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: {
    getSupabaseAdminClient: () => ({
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
          eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
        }),
      }),
    }),
    getSupabaseServerClient: () => ({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    }),
  },
} as any;

// Imports des routes apres injection des mocks. Necessite des
// imports dynamiques pour respecter l ordre de cache.
async function loadRoutes() {
  const getRoute = await import('./route');
  const postRoute = await import('./regenerate/route');
  return { getRoute, postRoute };
}

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

// ============================================================
async function run() {
  const { getRoute, postRoute } = await loadRoutes();

  // ----------------------------------------------------------
  console.log('\n--- GET /api/admin/sectoral ---');
  // ----------------------------------------------------------

  mockUser = null;
  mockIsAdmin = false;
  const r1 = await getRoute.GET(makeRequest('http://localhost:3000/api/admin/sectoral'));
  check('GET sans session retourne 401', r1.status, 401);

  mockUser = { id: 'user-1', email: 'test@example.com', displayName: null };
  mockIsAdmin = false;
  const r2 = await getRoute.GET(makeRequest('http://localhost:3000/api/admin/sectoral'));
  check('GET avec session non-admin retourne 403', r2.status, 403);

  // ----------------------------------------------------------
  console.log('\n--- POST /api/admin/sectoral/regenerate ---');
  // ----------------------------------------------------------

  mockUser = null;
  mockIsAdmin = false;
  const p1 = await postRoute.POST(
    makeRequest('http://localhost:3000/api/admin/sectoral/regenerate', {
      method: 'POST',
      body: JSON.stringify({ sector_slug: 'fintech', mode: 'full' }),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  check('POST sans session retourne 401', p1.status, 401);

  mockUser = { id: 'user-1', email: 'test@example.com', displayName: null };
  mockIsAdmin = false;
  const p2 = await postRoute.POST(
    makeRequest('http://localhost:3000/api/admin/sectoral/regenerate', {
      method: 'POST',
      body: JSON.stringify({ sector_slug: 'fintech', mode: 'full' }),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  check('POST avec session non-admin retourne 403', p2.status, 403);

  // Validation body : super-admin mais body invalide doit
  // remonter 400 (et pas declencher le job background).
  mockUser = { id: 'admin-1', email: 'admin@prelude.io', displayName: 'Admin' };
  mockIsAdmin = true;
  const p3 = await postRoute.POST(
    makeRequest('http://localhost:3000/api/admin/sectoral/regenerate', {
      method: 'POST',
      body: JSON.stringify({ sector_slug: 'inconnu', mode: 'full' }),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  check('POST admin avec slug inconnu retourne 400', p3.status, 400);

  const p4 = await postRoute.POST(
    makeRequest('http://localhost:3000/api/admin/sectoral/regenerate', {
      method: 'POST',
      body: JSON.stringify({ sector_slug: 'fintech', mode: 'partial' }),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  check('POST admin avec mode invalide retourne 400', p4.status, 400);

  const p5 = await postRoute.POST(
    makeRequest('http://localhost:3000/api/admin/sectoral/regenerate', {
      method: 'POST',
      body: JSON.stringify({ sector_slug: 'fintech', mode: 'dimension' }),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  check('POST admin sans dimension en mode dimension retourne 400', p5.status, 400);

  // Body JSON malforme
  const p6 = await postRoute.POST(
    new NextRequest(new URL('http://localhost:3000/api/admin/sectoral/regenerate'), {
      method: 'POST',
      body: 'pas-du-json-{',
      headers: { 'Content-Type': 'application/json' },
    } as any),
  );
  check('POST admin avec body non-JSON retourne 400', p6.status, 400);

  // Cas nominal : super-admin, body valide, le handler doit
  // accepter en 202 sans bloquer (le job tourne en background).
  // On ne teste pas l execution effective du job ici ; le
  // mock Supabase ne fait que retourner vide, donc le job
  // background va echouer silencieusement, ce qui est OK pour
  // ce test (on valide la surface HTTP).
  const p7 = await postRoute.POST(
    makeRequest('http://localhost:3000/api/admin/sectoral/regenerate', {
      method: 'POST',
      body: JSON.stringify({ sector_slug: 'fintech', mode: 'full' }),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  check('POST admin avec body valide retourne 202', p7.status, 202);
  const body7 = await p7.json();
  checkTrue('reponse 202 contient accepted=true', body7.accepted === true);
  check('reponse 202 contient sector_slug', body7.sector_slug, 'fintech');
  check('reponse 202 contient mode', body7.mode, 'full');
  check('reponse 202 contient triggered_by', body7.triggered_by, 'admin@prelude.io');

  // ----------------------------------------------------------
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
