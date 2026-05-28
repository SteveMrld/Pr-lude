// ============================================================
// Tests deterministes du regenerateur sectoriel
// ------------------------------------------------------------
// Couvre l orchestration sur huit dimensions, l agregation
// editoriale finale, la gestion data_missing avec rejet
// au-dela de deux, le clamp des scores, la propagation des cas
// d erreur (timeout LLM, parse JSON, absence de sources), et
// l estimation de cout. Aucun appel reseau, aucune dependance
// Supabase : tout passe par l injection de mocks via
// RegeneratorDependencies.
//
// Execution : tsx lib/engines/sectoral-intelligence/regenerator.test.ts
// ============================================================

import {
  regenerateSectoralBrief,
  regenerateDimension,
  __TEST_ONLY,
} from './regenerator';
import {
  buildDimensionSystemPrompt,
  buildDimensionUserPrompt,
  buildAggregatorSystemPrompt,
  PROMPT_VERSION,
} from './dimension-prompts';
import {
  DIMENSION_KEYS,
  SECTORS,
  getSectorBySlug,
  estimateCostUsd,
  MODEL_PRICING,
} from './types';
import type {
  DimensionKey,
  DimensionLLMResponse,
  AggregatorLLMResponse,
  RegeneratorDependencies,
  SectorDefinition,
  SourceCitation,
} from './types';

let pass = 0, fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(
      `  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
    fail++;
  }
}

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

function checkNear(label: string, actual: number, expected: number, eps = 0.0001) {
  const ok = Math.abs(actual - expected) < eps;
  if (ok) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${actual}, expected close to ${expected}`);
    fail++;
  }
}

// ============================================================
// Helpers de mock
// ============================================================

function makeSource(idx: number): SourceCitation {
  return {
    url: `https://example.org/source-${idx}`,
    title: `Source de test ${idx}`,
    accessed_at: '2026-05-12T10:00:00Z',
    quote: `Citation textuelle de la source ${idx}.`,
  };
}

function makeDimensionResponse(
  overrides: Partial<DimensionLLMResponse> = {},
): DimensionLLMResponse {
  return {
    score: 65,
    confidence: 'high',
    data_missing: false,
    definition_applied: 'Definition exacte appliquee.',
    sources_cited: [makeSource(1), makeSource(2)],
    notes: 'Lecture editoriale courte sur la dimension analysee.',
    usage: { input_tokens: 1500, output_tokens: 500 },
    ...overrides,
  };
}

function makeAggregatorResponse(
  overrides: Partial<AggregatorLLMResponse> = {},
): AggregatorLLMResponse {
  return {
    narrative_summary:
      'Le secteur evolue sous une triple tension structurelle. Le capital exige des paliers longs, la reglementation se durcit a vitesse europeenne, et le talent se concentre sur quelques laboratoires. Cette configuration produit une fragilite latente qui ne se lit pas dans les comptes annuels mais dans la chronologie des deux dernieres annees, ou les multiples ont decroche.',
    usage: { input_tokens: 2000, output_tokens: 400 },
    ...overrides,
  };
}

function mockDeps(
  options: {
    dimensionResponse?:
      | DimensionLLMResponse
      | ((dim: DimensionKey, sector: SectorDefinition) => Promise<DimensionLLMResponse>);
    aggregatorResponse?:
      | AggregatorLLMResponse
      | ((sector: SectorDefinition) => Promise<AggregatorLLMResponse>);
  } = {},
): RegeneratorDependencies {
  const dimImpl = options.dimensionResponse;
  const aggImpl = options.aggregatorResponse;
  return {
    callDimensionLLM: async (dim, sector) => {
      if (typeof dimImpl === 'function') return dimImpl(dim, sector);
      if (dimImpl) return dimImpl;
      return makeDimensionResponse();
    },
    callAggregatorLLM: async (sector) => {
      if (typeof aggImpl === 'function') return aggImpl(sector);
      if (aggImpl) return aggImpl;
      return makeAggregatorResponse();
    },
  };
}

async function runTests() {
// ============================================================
// Test 1 : catalogue des secteurs et helpers basiques
// ============================================================

console.log('\n=== Test 1 : catalogue et helpers ===');
{
  check('treize secteurs au lancement', SECTORS.length, 13);
  check('huit dimensions standardisees', DIMENSION_KEYS.length, 8);
  const slugs = SECTORS.map((s) => s.slug);
  const unique = new Set(slugs);
  check('slugs uniques', unique.size, slugs.length);
  checkTrue('fintech present', slugs.includes('fintech'));
  checkTrue('ia-appliquee present', slugs.includes('ia-appliquee'));
  checkTrue('climat-energie present', slugs.includes('climat-energie'));
  check('getSectorBySlug fintech', getSectorBySlug('fintech')?.label, 'Fintech');
  check('getSectorBySlug inconnu retourne undefined', getSectorBySlug('inconnu'), undefined);
}

// ============================================================
// Test 2 : pricing et estimation cout
// ============================================================

console.log('\n=== Test 2 : estimateCostUsd ===');
{
  // Sonnet 3 USD input + 15 USD output par million.
  // 1M input + 0 output = 3 USD
  checkNear('cout 1M input Sonnet', estimateCostUsd('claude-sonnet-4-6', 1_000_000, 0), 3);
  // 0 input + 1M output Sonnet = 15 USD
  checkNear('cout 1M output Sonnet', estimateCostUsd('claude-sonnet-4-6', 0, 1_000_000), 15);
  // 1500 input + 500 output Sonnet
  // = 1500/1M * 3 + 500/1M * 15
  // = 0.0045 + 0.0075 = 0.012
  checkNear('cout 1500+500 Sonnet', estimateCostUsd('claude-sonnet-4-6', 1500, 500), 0.012);
  // Opus 15 USD input + 75 USD output par million.
  // 2000 in + 400 out = 2000/1M * 15 + 400/1M * 75 = 0.03 + 0.03 = 0.06
  checkNear('cout 2000+400 Opus', estimateCostUsd('claude-opus-4-7', 2000, 400), 0.06);
  // Modele inconnu retourne 0
  checkNear('cout modele inconnu', estimateCostUsd('gpt-5-mythique', 1000, 1000), 0);
  checkTrue('pricing sonnet 4-6 defini', !!MODEL_PRICING['claude-sonnet-4-6']);
  checkTrue('pricing opus 4-7 defini', !!MODEL_PRICING['claude-opus-4-7']);
}

// ============================================================
// Test 3 : prompts dimension et agregateur
// ============================================================

console.log('\n=== Test 3 : prompts ===');
{
  const sysIntensite = buildDimensionSystemPrompt('intensite_capitalistique');
  checkTrue('system intensite contient definition', sysIntensite.includes('palier de soutenabilite'));
  checkTrue('system intensite mentionne World Bank', sysIntensite.includes('World Bank'));
  checkTrue('system intensite mentionne JSON schema', sysIntensite.includes('Schema JSON strict'));
  checkTrue('system intensite proscrit em-dashes', sysIntensite.includes('Pas d em-dashes'));

  const sysNarr = buildDimensionSystemPrompt('vulnerabilite_narrative_sectorielle');
  checkTrue('system narrative contient WeWork ou foodtech ou crypto exemples',
    sysNarr.includes('foodtech') || sysNarr.includes('crypto') || sysNarr.includes('IA generative'));

  const userFintech = buildDimensionUserPrompt('pression_reglementaire', SECTORS[2]);
  checkTrue('user prompt contient label secteur', userFintech.includes('Fintech'));
  checkTrue('user prompt contient perimetre', userFintech.includes('Paiements'));
  checkTrue('user prompt rappelle JSON strict', userFintech.includes('JSON strict'));

  const sysAgg = buildAggregatorSystemPrompt();
  checkTrue('system aggregator Le Grand Continent', sysAgg.includes('Le Grand Continent'));
  checkTrue('system aggregator mentionne narrative_summary', sysAgg.includes('narrative_summary'));
  checkTrue('system aggregator borne 1200-1500 chars', sysAgg.includes('1200') && sysAgg.includes('1500'));
}

// ============================================================
// Test 4 : sanitize dimension response, cas nominaux
// ============================================================

console.log('\n=== Test 4 : sanitizeDimensionResponse ===');
{
  const ok = __TEST_ONLY.sanitizeDimensionResponse(
    'intensite_capitalistique',
    makeDimensionResponse(),
  );
  check('score conserve', ok.score, 65);
  check('confidence conservee', ok.confidence, 'high');
  check('data_missing false', ok.data_missing, false);
  check('sources conservees', ok.sources_cited.length, 2);

  // Score hors borne haut clampe a 100.
  const high = __TEST_ONLY.sanitizeDimensionResponse(
    'intensite_capitalistique',
    makeDimensionResponse({ score: 150 }),
  );
  check('score 150 clampe a 100', high.score, 100);
  checkTrue('notes mentionnent le clamp', (high.notes ?? '').includes('clampé'));

  // Score negatif clampe a 0.
  const low = __TEST_ONLY.sanitizeDimensionResponse(
    'intensite_capitalistique',
    makeDimensionResponse({ score: -20 }),
  );
  check('score -20 clampe a 0', low.score, 0);

  // Sources vides : force data_missing meme si LLM a marque sain.
  const noSrc = __TEST_ONLY.sanitizeDimensionResponse(
    'intensite_capitalistique',
    makeDimensionResponse({ sources_cited: [], confidence: 'high' }),
  );
  check('sources vides force data_missing', noSrc.data_missing, true);
  check('sources vides score=null', noSrc.score, null);
  check('sources vides confidence=data_missing', noSrc.confidence, 'data_missing');

  // data_missing=true respecte meme avec sources.
  const dm = __TEST_ONLY.sanitizeDimensionResponse(
    'intensite_capitalistique',
    makeDimensionResponse({ data_missing: true, score: 50 }),
  );
  check('data_missing=true force score=null', dm.score, null);

  // Score non-numerique bascule en data_missing.
  const nan = __TEST_ONLY.sanitizeDimensionResponse(
    'intensite_capitalistique',
    makeDimensionResponse({ score: NaN }),
  );
  check('score NaN bascule en data_missing', nan.data_missing, true);

  const undef = __TEST_ONLY.sanitizeDimensionResponse(
    'intensite_capitalistique',
    // @ts-expect-error simulation LLM cassee
    makeDimensionResponse({ score: 'pas un nombre' }),
  );
  check('score string bascule en data_missing', undef.data_missing, true);
}

// ============================================================
// Test 5 : orchestration nominale, fiche complete
// ============================================================

console.log('\n=== Test 5 : regenerateSectoralBrief nominale ===');
{
  const deps = mockDeps();
  const result = await regenerateSectoralBrief('fintech', 'manual', { deps });
  check('status success', result.status, 'success');
  check('huit dimensions notees', Object.keys(result.brief!.dimensions).length, 8);
  check('aucune dimension manquante', result.dimensions_missing.length, 0);
  check('total sources 16', result.total_sources_cited, 16); // 2 sources x 8 dimensions
  checkTrue('cout positif', result.cost_usd > 0);
  checkTrue('duree positive', result.duration_ms >= 0);
  check('sector slug correct', result.brief!.sector_slug, 'fintech');
  check('trigger manual', result.brief!.regeneration_trigger, 'manual');
  check('supersedes_id null', result.brief!.supersedes_id, null);
  check('prompt version trace', result.brief!.generation_metadata.prompt_version, PROMPT_VERSION);
  check('huit dimensions regenerees', result.brief!.generation_metadata.dimensions_regenerated.length, 8);
  checkTrue('narrative_summary non vide', result.brief!.narrative_summary.length > 100);
}

// ============================================================
// Test 6 : rejet par exces de data_missing
// ============================================================

console.log('\n=== Test 6 : rejet > 2 data_missing ===');
{
  let callCount = 0;
  const deps = mockDeps({
    dimensionResponse: async () => {
      callCount++;
      // Trois premieres dimensions sortent data_missing, les cinq
      // autres saines. Trois > 2 doit declencher le rejet.
      if (callCount <= 3) {
        return makeDimensionResponse({
          score: null,
          confidence: 'data_missing',
          data_missing: true,
          sources_cited: [],
        });
      }
      return makeDimensionResponse();
    },
  });
  const result = await regenerateSectoralBrief('fintech', 'cron', { deps });
  check('status rejected_data_missing', result.status, 'rejected_data_missing');
  check('brief null', result.brief, null);
  check('trois dimensions manquantes', result.dimensions_missing.length, 3);
  checkTrue('rejection reason cite seuil', result.rejection_reason!.includes('seuil'));
}

// ============================================================
// Test 7 : exactement 2 data_missing accepte
// ============================================================

console.log('\n=== Test 7 : seuil exact 2 data_missing tolere ===');
{
  let callCount = 0;
  const deps = mockDeps({
    dimensionResponse: async () => {
      callCount++;
      if (callCount <= 2) {
        return makeDimensionResponse({
          score: null,
          confidence: 'data_missing',
          data_missing: true,
          sources_cited: [],
        });
      }
      return makeDimensionResponse();
    },
  });
  const result = await regenerateSectoralBrief('fintech', 'manual', { deps });
  check('status success malgre 2 data_missing', result.status, 'success');
  check('deux dimensions manquantes', result.dimensions_missing.length, 2);
}

// ============================================================
// Test 8 : echec d une dimension par exception
// ============================================================

console.log('\n=== Test 8 : exception sur une dimension ===');
{
  let callCount = 0;
  const deps = mockDeps({
    dimensionResponse: async () => {
      callCount++;
      if (callCount === 1) throw new Error('Rate limit Anthropic 429');
      return makeDimensionResponse();
    },
  });
  const result = await regenerateSectoralBrief('fintech', 'manual', { deps });
  // Une seule dimension manquante, fiche acceptee.
  check('status success avec une dimension echec', result.status, 'success');
  check('une dimension manquante', result.dimensions_missing.length, 1);
  // Verifie que la dimension en echec porte la trace de l erreur.
  const missingKey = result.dimensions_missing[0];
  const missingDim = result.brief!.dimensions[missingKey];
  checkTrue('note mentionne rate limit', (missingDim.notes ?? '').includes('Rate limit'));
}

// ============================================================
// Test 9 : echec de l agregation editoriale
// ============================================================

console.log('\n=== Test 9 : echec agregation ===');
{
  const deps = mockDeps({
    aggregatorResponse: async () => {
      throw new Error('Opus timeout');
    },
  });
  const result = await regenerateSectoralBrief('fintech', 'manual', { deps });
  check('status rejected_error', result.status, 'rejected_error');
  check('brief null sur echec aggregator', result.brief, null);
  checkTrue('error_message conserve', (result.error_message ?? '').includes('Opus timeout'));
}

// ============================================================
// Test 10 : secteur inconnu
// ============================================================

console.log('\n=== Test 10 : secteur inconnu ===');
{
  const result = await regenerateSectoralBrief('quantum-networking', 'manual', {
    deps: mockDeps(),
  });
  check('status rejected_error', result.status, 'rejected_error');
  check('error_message sector_unknown', result.error_message, 'sector_unknown');
}

// ============================================================
// Test 11 : parallelisme des appels dimension
// ============================================================

console.log('\n=== Test 11 : parallelisme dimension ===');
{
  const callTimes: number[] = [];
  const start = Date.now();
  const deps = mockDeps({
    dimensionResponse: async () => {
      callTimes.push(Date.now() - start);
      // 50ms de delai simule
      await new Promise((r) => setTimeout(r, 50));
      return makeDimensionResponse();
    },
  });
  await regenerateSectoralBrief('fintech', 'manual', { deps });
  // Si serial, les huit appels prendraient 8 * 50 = 400ms minimum.
  // En parallele, tous demarrent dans une fenetre tres courte.
  const maxStartGap = Math.max(...callTimes) - Math.min(...callTimes);
  checkTrue(`tous appels demarrent en < 30ms (gap=${maxStartGap})`, maxStartGap < 30);
}

// ============================================================
// Test 12 : regeneration partielle (subset de dimensions)
// ============================================================

console.log('\n=== Test 12 : regeneration partielle ===');
{
  let callCount = 0;
  const calledDimensions: DimensionKey[] = [];
  const deps = mockDeps({
    dimensionResponse: async (dim) => {
      callCount++;
      calledDimensions.push(dim);
      return makeDimensionResponse();
    },
  });
  const result = await regenerateSectoralBrief('fintech', 'manual', {
    deps,
    dimensions: ['pression_reglementaire', 'velocite_technologique'],
  });
  check('deux appels dimension realises', callCount, 2);
  checkTrue('pression_reglementaire appelee', calledDimensions.includes('pression_reglementaire'));
  checkTrue('velocite_technologique appelee', calledDimensions.includes('velocite_technologique'));
  // Six dimensions non regenerees sortent data_missing par construction.
  check('six dimensions manquantes', result.dimensions_missing.length, 6);
  // 6 > 2, donc rejet.
  check('rejet par data_missing six dimensions', result.status, 'rejected_data_missing');
}

// ============================================================
// Test 13 : regenerateDimension surgicale
// ============================================================

console.log('\n=== Test 13 : regenerateDimension surgicale ===');
{
  let dimCalled: DimensionKey | null = null;
  const deps: Partial<RegeneratorDependencies> = {
    callDimensionLLM: async (dim) => {
      dimCalled = dim;
      return makeDimensionResponse({ score: 72 });
    },
  };
  const result = await regenerateDimension('fintech', 'tension_capital_talent', { deps });
  check('status success', result.status, 'success');
  check('dimension correcte appelee', dimCalled, 'tension_capital_talent');
  check('score retourne', result.dimension!.score, 72);

  // Cas erreur
  const errDeps: Partial<RegeneratorDependencies> = {
    callDimensionLLM: async () => {
      throw new Error('parse JSON failed');
    },
  };
  const errResult = await regenerateDimension('fintech', 'pression_reglementaire', { deps: errDeps });
  check('status error', errResult.status, 'error');
  checkTrue('error_message conservee', (errResult.error_message ?? '').includes('parse JSON failed'));

  // Cas secteur inconnu
  const unknownResult = await regenerateDimension('inconnu', 'pression_reglementaire', { deps });
  check('secteur inconnu status error', unknownResult.status, 'error');
}

// ============================================================
// Test 14 : metadata de generation traceable
// ============================================================

console.log('\n=== Test 14 : metadata generation ===');
{
  const deps = mockDeps();
  const result = await regenerateSectoralBrief('ia-appliquee', 'cron', {
    deps,
    dimensionModel: 'claude-sonnet-4-6',
    aggregatorModel: 'claude-opus-4-7',
  });
  const meta = result.brief!.generation_metadata;
  check('dimension_model trace', meta.dimension_model, 'claude-sonnet-4-6');
  check('aggregator_model trace', meta.aggregator_model, 'claude-opus-4-7');
  check('prompt_version trace', meta.prompt_version, PROMPT_VERSION);
  checkTrue('cost_usd > 0', meta.cost_usd > 0);
  checkTrue('duration_ms positive', meta.duration_ms >= 0);
  check('huit dimensions regenerees', meta.dimensions_regenerated.length, 8);
}

// ============================================================
// Test 15 : chainage supersedes_id
// ============================================================

console.log('\n=== Test 15 : supersedes_id ===');
{
  const deps = mockDeps();
  const result = await regenerateSectoralBrief('fintech', 'cron', {
    deps,
    previousBrief: { id: '11111111-2222-3333-4444-555555555555' },
  });
  check('supersedes_id propage', result.brief!.supersedes_id, '11111111-2222-3333-4444-555555555555');
}

// ============================================================
// Test 16 : agregation summarize lisible
// ============================================================

console.log('\n=== Test 16 : summarizeDimensionsForAggregator ===');
{
  const dummyDim = {
    score: 60,
    definition_applied: 'def',
    sources_cited: [makeSource(1)],
    confidence: 'high' as const,
    data_missing: false,
    notes: 'note ed',
  };
  const dims = {
    intensite_capitalistique: dummyDim,
    pression_reglementaire: dummyDim,
    velocite_technologique: dummyDim,
    concentration_concurrentielle: dummyDim,
    cyclicite_macroeconomique: dummyDim,
    exposition_geopolitique: dummyDim,
    tension_capital_talent: dummyDim,
    vulnerabilite_narrative_sectorielle: { ...dummyDim, data_missing: true, score: null, confidence: 'data_missing' as const },
  };
  const summary = __TEST_ONLY.summarizeDimensionsForAggregator(dims);
  // Le summary utilise les libelles d affichage, pas les cles brutes.
  const { DIMENSION_LABELS } = await import('./types');
  checkTrue(
    'summary contient les huit libelles de dimension',
    DIMENSION_KEYS.every((k) => summary.includes(DIMENSION_LABELS[k])),
  );
  checkTrue('summary mentionne donnee manquante', summary.includes('donnée manquante'));
  checkTrue('summary mentionne score 60/100', summary.includes('60/100'));
}

// ============================================================
// Test 17 : seuil max data_missing exporte
// ============================================================

console.log('\n=== Test 17 : seuil de tolerance ===');
{
  check('seuil = 2', __TEST_ONLY.MAX_DATA_MISSING_TOLERATED, 2);
  check('modele dimension defaut Sonnet 4-6', __TEST_ONLY.DEFAULT_DIMENSION_MODEL, 'claude-sonnet-4-6');
  check('modele aggregator defaut Opus 4-7', __TEST_ONLY.DEFAULT_AGGREGATOR_MODEL, 'claude-opus-4-7');
}

// ============================================================
// Test 18 : structure du SectoralBrief produit
// ============================================================

console.log('\n=== Test 18 : structure SectoralBrief ===');
{
  const deps = mockDeps();
  const result = await regenerateSectoralBrief('climat-energie', 'event', { deps });
  const brief = result.brief!;
  checkTrue('generated_at est ISO', /\d{4}-\d{2}-\d{2}T/.test(brief.generated_at));
  for (const key of DIMENSION_KEYS) {
    checkTrue(`dimension ${key} presente`, brief.dimensions[key] !== undefined);
    const d = brief.dimensions[key];
    checkTrue(`dimension ${key} a un score numerique`, typeof d.score === 'number');
    checkTrue(`dimension ${key} a definition_applied`, typeof d.definition_applied === 'string');
    checkTrue(`dimension ${key} a sources_cited array`, Array.isArray(d.sources_cited));
  }
  check('event trigger propage', brief.regeneration_trigger, 'event');
}

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Erreur non rattrapee dans la suite de tests :', err);
  process.exit(1);
});
