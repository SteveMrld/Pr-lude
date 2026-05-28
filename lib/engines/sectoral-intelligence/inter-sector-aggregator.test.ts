// ============================================================
// Tests deterministes de l agregateur LLM inter-sectoriel
// ------------------------------------------------------------
// Mock complet du LLM et des sources : on injecte des fiches
// sectorielles deterministes, un callLLM qui retourne un JSON
// previsible, et on verifie que l agregateur compose
// correctement le brief de sortie.
//
// Aucun acces reseau, aucune dependance Supabase ni LLM reel.
//
// Execution :
//   tsx lib/engines/sectoral-intelligence/inter-sector-aggregator.test.ts
// ============================================================

import {
  aggregateInterSectoral,
  buildAggregatorSystemPrompt,
  buildAggregatorUserPrompt,
  INTER_SECTORAL_PROMPT_VERSION,
  __TEST_ONLY,
} from './inter-sector-aggregator';
import { DIMENSION_KEYS, SECTORS } from './types';
import type {
  DimensionKey,
  SectoralBrief,
  SectoralBriefDimensions,
  SectoralDimension,
} from './types';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  const eq = actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
  if (eq) {
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
// FIXTURES
// ============================================================

function makeDimension(score: number | null): SectoralDimension {
  return {
    score,
    definition_applied: 'def',
    sources_cited: score === null ? [] : [{ url: 'https://x', title: 't', accessed_at: '2026-01-01' }],
    confidence: score === null ? 'data_missing' : 'medium',
    data_missing: score === null,
  };
}

function makeBrief(slug: string, scores: Partial<Record<DimensionKey, number>>): SectoralBrief {
  const dims: Partial<SectoralBriefDimensions> = {};
  for (const k of DIMENSION_KEYS) {
    dims[k] = makeDimension(scores[k] ?? 50);
  }
  return {
    id: `brief-${slug}-2026Q2`,
    sector_slug: slug,
    generated_at: '2026-04-15T10:00:00.000Z',
    dimensions: dims as SectoralBriefDimensions,
    narrative_summary: `Resume editorial du secteur ${slug} pour le trimestre.`,
    regeneration_trigger: 'cron',
    supersedes_id: null,
    generation_metadata: {
      dimension_model: 'claude-sonnet-4-6',
      aggregator_model: 'claude-opus-4-7',
      prompt_version: 'v1',
      cost_usd: 0,
      duration_ms: 0,
      dimensions_regenerated: [...DIMENSION_KEYS],
    },
  };
}

const NARRATIVE_MOCK =
  'Synthese trimestrielle Le Grand Continent.\n\nCe trimestre voit converger les secteurs sur le talent et diverger sur la technologie.\n\nLa pression reglementaire avance.';

// ============================================================
console.log('\n--- aggregateInterSectoral : cas nominal ---');
// ============================================================

(async () => {
  // 13 fiches courantes, 13 fiches T-1 avec un mouvement detectable.
  const slugs = SECTORS.map((s) => s.slug);
  const currentBriefs = slugs.map((slug) => {
    // 9 secteurs : pression_reglementaire +12pts
    const pressionT = slugs.indexOf(slug) < 9 ? 52 : 50;
    return makeBrief(slug, { pression_reglementaire: pressionT });
  });
  const previousBriefs = slugs.map((slug) =>
    makeBrief(slug, {
      pression_reglementaire: slugs.indexOf(slug) < 9 ? 40 : 50,
    }),
  );

  let llmCalled = false;
  let llmInput: any = null;
  const mockLLM = async (
    curr: SectoralBrief[],
    prev: SectoralBrief[],
    convs: any[],
    divs: any[],
    macros: any[],
  ) => {
    llmCalled = true;
    llmInput = { currLen: curr.length, prevLen: prev.length, convsLen: convs.length, divsLen: divs.length, macrosLen: macros.length };
    return {
      narrative_summary: NARRATIVE_MOCK,
      convergences_interpretation: convs.map((_, i) => `Interp conv ${i}.`),
      divergences_interpretation: divs.map((_, i) => `Interp div ${i}.`),
      macro_patterns_interpretation: macros.map((_, i) => `Interp macro ${i}.`),
      usage: { input_tokens: 5000, output_tokens: 2000 },
    };
  };

  const result = await aggregateInterSectoral({
    period_quarter: '2026-Q2',
    previous_brief_id: 'prev-brief-id',
    deps: {
      fetchCurrentBriefs: async () => currentBriefs,
      fetchPreviousBriefs: async () => previousBriefs,
      callLLM: mockLLM,
    },
  });

  check('status success', result.status, 'success');
  checkTrue('brief produit', result.brief !== null);
  checkTrue('LLM appele', llmCalled);
  check(
    'LLM recoit 13 fiches courantes',
    llmInput.currLen,
    13,
  );
  check('LLM recoit 13 fiches T-1', llmInput.prevLen, 13);
  check('1 pattern macro detecte par les computations', llmInput.macrosLen, 1);

  if (result.brief) {
    check('period_quarter conservee', result.brief.period_quarter, '2026-Q2');
    check('previous_brief_id conserve', result.brief.generation_metadata.previous_brief_id, 'prev-brief-id');
    check('prompt_version annote', result.brief.generation_metadata.prompt_version, INTER_SECTORAL_PROMPT_VERSION);
    check('narrative_summary copie', result.brief.narrative_summary, NARRATIVE_MOCK);
    check('1 macro_pattern annote', result.brief.macro_patterns.length, 1);
    checkTrue(
      'macro_pattern a une interpretation non-vide',
      result.brief.macro_patterns[0].interpretation === 'Interp macro 0.',
    );
    check('13 sources consultees', result.brief.sources_consulted.length, 13);
    checkTrue(
      'cost_usd calcule depuis usage',
      result.brief.generation_metadata.cost_usd > 0,
    );
    check(
      'data_completeness vide quand 13 fiches presentes',
      result.brief.data_completeness,
      undefined,
    );
  }

  // ============================================================
  console.log('\n--- aggregateInterSectoral : aucune fiche T -> rejected_no_data ---');
  // ============================================================

  const emptyResult = await aggregateInterSectoral({
    period_quarter: '2026-Q2',
    deps: {
      fetchCurrentBriefs: async () => [],
      fetchPreviousBriefs: async () => previousBriefs,
      callLLM: mockLLM,
    },
  });
  check('aucune fiche T : status rejected_no_data', emptyResult.status, 'rejected_no_data');
  check('aucune fiche T : pas de brief', emptyResult.brief, null);

  // ============================================================
  console.log('\n--- aggregateInterSectoral : echec LLM -> rejected_error ---');
  // ============================================================

  const errorResult = await aggregateInterSectoral({
    period_quarter: '2026-Q2',
    deps: {
      fetchCurrentBriefs: async () => currentBriefs,
      fetchPreviousBriefs: async () => previousBriefs,
      callLLM: async () => {
        throw new Error('Anthropic 503');
      },
    },
  });
  check('LLM echoue : status rejected_error', errorResult.status, 'rejected_error');
  check('LLM echoue : error_message propage', errorResult.error_message, 'Anthropic 503');

  // ============================================================
  console.log('\n--- aggregateInterSectoral : donnees incompletes -> data_completeness signalee ---');
  // ============================================================

  // 8 fiches au lieu de 13, dont 2 nouvelles (sans T-1)
  const partialCurr = currentBriefs.slice(0, 8);
  const partialPrev = previousBriefs.slice(2, 8); // 6 fiches T-1, deux sans equivalent T
  const partialResult = await aggregateInterSectoral({
    period_quarter: '2026-Q2',
    deps: {
      fetchCurrentBriefs: async () => partialCurr,
      fetchPreviousBriefs: async () => partialPrev,
      callLLM: mockLLM,
    },
  });
  check('donnees partielles : status success', partialResult.status, 'success');
  checkTrue(
    'donnees partielles : data_completeness renseignee',
    partialResult.brief?.data_completeness !== undefined,
  );
  if (partialResult.brief?.data_completeness) {
    checkTrue(
      'donnees partielles : secteurs sans T-1 identifies',
      partialResult.brief.data_completeness.missing_at_t_minus_1.length === 2,
    );
    checkTrue(
      'donnees partielles : secteurs absents des deux trimestres identifies',
      partialResult.brief.data_completeness.missing_both.length > 0,
    );
  }

  // ============================================================
  console.log('\n--- aggregateInterSectoral : LLM renvoie trop peu d interpretations ---');
  // ============================================================

  const incompleteLLM = async (curr: SectoralBrief[], prev: SectoralBrief[], convs: any[]) => ({
    narrative_summary: 'Court resume.',
    convergences_interpretation: [], // vide alors qu il y a peut-etre des paires
    divergences_interpretation: [],
    macro_patterns_interpretation: [], // vide alors qu il y a 1 pattern
    usage: { input_tokens: 1000, output_tokens: 500 },
  });

  const truncResult = await aggregateInterSectoral({
    period_quarter: '2026-Q2',
    deps: {
      fetchCurrentBriefs: async () => currentBriefs,
      fetchPreviousBriefs: async () => previousBriefs,
      callLLM: incompleteLLM as any,
    },
  });
  check('LLM tronque : status success quand meme', truncResult.status, 'success');
  if (truncResult.brief) {
    check(
      'LLM tronque : interpretation par defaut = chaine vide',
      truncResult.brief.macro_patterns[0]?.interpretation,
      '',
    );
  }

  // ============================================================
  console.log('\n--- annotateAll : alignement strict ---');
  // ============================================================

  const items = [{ x: 1 }, { x: 2 }, { x: 3 }];
  const interpretationsOk = ['a', 'b', 'c'];
  const annotated = __TEST_ONLY.annotateAll(items, interpretationsOk);
  check('annotateAll : 3 items annotes', annotated.length, 3);
  check('annotateAll : interpretation [0] = a', annotated[0].interpretation, 'a');

  const trunc = __TEST_ONLY.annotateAll(items, ['a']);
  check('annotateAll : interp manquante = chaine vide', trunc[1].interpretation, '');
  check('annotateAll : interp manquante = chaine vide', trunc[2].interpretation, '');

  const longerInterpretations = __TEST_ONLY.annotateAll(items, ['a', 'b', 'c', 'd', 'e']);
  check(
    'annotateAll : extra interp ignoree (length = items.length)',
    longerInterpretations.length,
    3,
  );

  // ============================================================
  console.log('\n--- buildAggregatorSystemPrompt : voix editoriale ---');
  // ============================================================

  const sys = buildAggregatorSystemPrompt();
  checkTrue('system prompt evoque Le Grand Continent', sys.includes('Grand Continent'));
  checkTrue('system prompt interdit em-dashes', sys.includes("Pas d'em-dashes"));
  checkTrue('system prompt force JSON strict', sys.includes('JSON strict'));
  checkTrue('system prompt rappelle la voix Prelude', sys.includes('Prélude'));

  // ============================================================
  console.log('\n--- buildAggregatorUserPrompt : indexation ---');
  // ============================================================

  const userPrompt = buildAggregatorUserPrompt(
    '2026-Q2',
    currentBriefs.slice(0, 2),
    previousBriefs.slice(0, 2),
    [
      { sectors: ['a', 'b'], dimension: 'intensite_capitalistique', delta_t_minus_1: 25, delta_t: 5 } as any,
    ],
    [],
    [
      { dimension: 'pression_reglementaire', direction: 'up', average_delta: 12, sectors_affected: ['x'] } as any,
    ],
    {
      missing_at_t: [],
      missing_at_t_minus_1: ['nouveau'],
      missing_both: [],
      comparable: ['a', 'b'],
    },
  );
  checkTrue('user prompt cite la periode', userPrompt.includes('2026-Q2'));
  checkTrue('user prompt indexe les convergences', userPrompt.includes('[0]'));
  checkTrue('user prompt signale donnees incompletes', userPrompt.includes('Données incomplètes'));
  checkTrue(
    'user prompt liste les secteurs manquants',
    userPrompt.includes('nouveau'),
  );

  // ============================================================
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
