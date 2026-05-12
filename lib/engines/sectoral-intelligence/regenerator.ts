// ============================================================
// PRELUDE - Sectoral Intelligence Layer, orchestrateur de
// regeneration
// ------------------------------------------------------------
// Orchestre la generation complete d une fiche sectorielle. Huit
// appels LLM en parallele (un par dimension, modele Sonnet en
// production) suivis d un appel d agregation editoriale (modele
// Opus en production) qui produit le resume narratif. Assemble
// le SectoralBrief final avec metadata complete.
//
// Garde-fous doctrinaux :
//   - Si plus de deux dimensions sortent en data_missing, la
//     fiche est rejetee avec status="rejected_data_missing".
//   - Si une dimension produit un score sans aucune source
//     citee, l orchestrateur force data_missing=true (le LLM
//     etait cense respecter cette discipline, on l applique en
//     post-traitement par securite).
//   - Si l appel LLM dimension echoue (rate limit, parse JSON),
//     la dimension est marquee data_missing et l orchestrateur
//     continue sur les sept autres avant d evaluer le rejet.
//
// L injection de dependances par RegeneratorDependencies permet
// aux tests deterministes de fournir des mocks sans toucher au
// reseau ni a l API Anthropic.
// ============================================================

import { callClaude, parseJSON } from '../anthropic-client';
import {
  buildDimensionSystemPrompt,
  buildDimensionUserPrompt,
  buildAggregatorSystemPrompt,
  buildAggregatorUserPrompt,
  PROMPT_VERSION,
} from './dimension-prompts';
import type {
  DimensionKey,
  DimensionLLMResponse,
  AggregatorLLMResponse,
  SectorDefinition,
  SectoralBrief,
  SectoralBriefDimensions,
  SectoralDimension,
  SectoralRegenerationResult,
  RegenerateOptions,
  RegenerationTrigger,
  RegeneratorDependencies,
  GenerationMetadata,
} from './types';
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  estimateCostUsd,
  getSectorBySlug,
} from './types';

const DEFAULT_DIMENSION_MODEL = 'claude-sonnet-4-6';
const DEFAULT_AGGREGATOR_MODEL = 'claude-opus-4-7';

const MAX_DATA_MISSING_TOLERATED = 2;

// ------------------------------------------------------------
// API PRINCIPALE
// ------------------------------------------------------------

export async function regenerateSectoralBrief(
  sectorSlug: string,
  trigger: RegenerationTrigger,
  options: RegenerateOptions = {},
): Promise<SectoralRegenerationResult> {
  const start = Date.now();

  const sector = getSectorBySlug(sectorSlug);
  if (!sector) {
    return {
      status: 'rejected_error',
      brief: null,
      dimensions_missing: [],
      total_sources_cited: 0,
      cost_usd: 0,
      duration_ms: Date.now() - start,
      rejection_reason: `Secteur inconnu : ${sectorSlug}. Verifier le slug dans types.SECTORS.`,
      error_message: 'sector_unknown',
    };
  }

  const dimensionsRequested =
    options.dimensions && options.dimensions.length > 0
      ? options.dimensions
      : ([...DIMENSION_KEYS] as DimensionKey[]);

  const dimensionModel = options.dimensionModel ?? DEFAULT_DIMENSION_MODEL;
  const aggregatorModel = options.aggregatorModel ?? DEFAULT_AGGREGATOR_MODEL;

  const deps: RegeneratorDependencies = {
    callDimensionLLM:
      options.deps?.callDimensionLLM ??
      createDefaultDimensionCaller(dimensionModel),
    callAggregatorLLM:
      options.deps?.callAggregatorLLM ??
      createDefaultAggregatorCaller(aggregatorModel),
  };

  // Appels dimension en parallele. Promise.allSettled pour qu une
  // dimension echouante ne fasse pas tomber les sept autres.
  const settled = await Promise.allSettled(
    dimensionsRequested.map((dim) => deps.callDimensionLLM(dim, sector)),
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let costAccumulator = 0;

  // Assemble les huit dimensions (les non-regenerees restent vides
  // pour cette implementation, le scenario de regeneration partielle
  // se traite par fusion avec une fiche precedente, hors scope de
  // cet orchestrateur initial).
  const dimensions: Partial<SectoralBriefDimensions> = {};
  const missing: DimensionKey[] = [];
  let totalSourcesCited = 0;

  settled.forEach((res, idx) => {
    const key = dimensionsRequested[idx];
    if (res.status === 'fulfilled') {
      const sanitized = sanitizeDimensionResponse(key, res.value);
      dimensions[key] = sanitized;
      if (sanitized.data_missing) missing.push(key);
      totalSourcesCited += sanitized.sources_cited.length;
      if (res.value.usage) {
        totalInputTokens += res.value.usage.input_tokens;
        totalOutputTokens += res.value.usage.output_tokens;
        costAccumulator += estimateCostUsd(
          dimensionModel,
          res.value.usage.input_tokens,
          res.value.usage.output_tokens,
        );
      }
    } else {
      // Echec total de l appel : on marque data_missing avec le
      // message d erreur en notes pour traçabilite.
      const err = res.reason instanceof Error ? res.reason.message : String(res.reason);
      dimensions[key] = makeDataMissingDimension(
        key,
        `Echec appel LLM pour ${DIMENSION_LABELS[key]}. ${err}`,
      );
      missing.push(key);
    }
  });

  // Comble les dimensions non regenerees (cas regeneration partielle)
  // par des entrees data_missing explicites, pour que la structure
  // de sortie reste homogene sur les huit cles.
  for (const k of DIMENSION_KEYS) {
    if (!dimensions[k]) {
      dimensions[k] = makeDataMissingDimension(
        k,
        'Dimension non incluse dans cette regeneration.',
      );
    }
  }

  // Recompte les data_missing sur les huit dimensions finales. La
  // discipline anti-hallucination s applique a la fiche complete
  // qui sera persistee, pas seulement au subset regenere : une
  // regeneration partielle qui laisse six dimensions sans source
  // doit etre rejetee comme une fiche complete avec six
  // data_missing. Le scenario propre de regeneration surgicale
  // passe par regenerateDimension, pas par regenerateSectoralBrief
  // avec subset.
  const finalMissing: DimensionKey[] = DIMENSION_KEYS.filter(
    (k) => (dimensions as SectoralBriefDimensions)[k].data_missing,
  );

  // Verdict anti-hallucination : rejet si trop de data_missing.
  if (finalMissing.length > MAX_DATA_MISSING_TOLERATED) {
    return {
      status: 'rejected_data_missing',
      brief: null,
      dimensions_missing: finalMissing,
      total_sources_cited: totalSourcesCited,
      cost_usd: costAccumulator,
      duration_ms: Date.now() - start,
      rejection_reason: `${finalMissing.length} dimensions en data_missing, seuil de tolerance fixe a ${MAX_DATA_MISSING_TOLERATED}. Dimensions concernees : ${finalMissing.join(
        ', ',
      )}.`,
    };
  }

  // Reutilise finalMissing pour le rapport ; la variable missing
  // ne sert plus apres ce point.
  const reportedMissing = finalMissing;

  // Agregation editoriale. Si elle echoue, la fiche est rejetee
  // avec rejected_error : on ne stocke pas de fiche sans son
  // resume editorial, parce qu il sert d ancrage commun aux
  // moteurs en injection au pipeline.
  let aggregatorResponse: AggregatorLLMResponse;
  try {
    aggregatorResponse = await deps.callAggregatorLLM(
      sector,
      dimensions as SectoralBriefDimensions,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'rejected_error',
      brief: null,
      dimensions_missing: reportedMissing,
      total_sources_cited: totalSourcesCited,
      cost_usd: costAccumulator,
      duration_ms: Date.now() - start,
      rejection_reason: 'Echec de l agregation editoriale finale.',
      error_message: message,
    };
  }

  if (aggregatorResponse.usage) {
    totalInputTokens += aggregatorResponse.usage.input_tokens;
    totalOutputTokens += aggregatorResponse.usage.output_tokens;
    costAccumulator += estimateCostUsd(
      aggregatorModel,
      aggregatorResponse.usage.input_tokens,
      aggregatorResponse.usage.output_tokens,
    );
  }

  const generation_metadata: GenerationMetadata = {
    dimension_model: dimensionModel,
    aggregator_model: aggregatorModel,
    prompt_version: PROMPT_VERSION,
    cost_usd: costAccumulator,
    duration_ms: Date.now() - start,
    dimensions_regenerated: dimensionsRequested,
  };

  const brief: SectoralBrief = {
    sector_slug: sector.slug,
    generated_at: new Date().toISOString(),
    dimensions: dimensions as SectoralBriefDimensions,
    narrative_summary: aggregatorResponse.narrative_summary.trim(),
    regeneration_trigger: trigger,
    supersedes_id: options.previousBrief?.id ?? null,
    generation_metadata,
  };

  return {
    status: 'success',
    brief,
    dimensions_missing: reportedMissing,
    total_sources_cited: totalSourcesCited,
    cost_usd: costAccumulator,
    duration_ms: Date.now() - start,
  };
}

// ------------------------------------------------------------
// REGENERATION SURGICALE D UNE SEULE DIMENSION
// Sert le cas d intervention manuelle quand une dimension d une
// fiche existante sort anormale et meriterait d etre relancee
// sans tout refaire.
// ------------------------------------------------------------

export async function regenerateDimension(
  sectorSlug: string,
  dimension: DimensionKey,
  options: { deps?: Partial<RegeneratorDependencies>; dimensionModel?: string } = {},
): Promise<{
  status: 'success' | 'data_missing' | 'error';
  dimension: SectoralDimension | null;
  cost_usd: number;
  duration_ms: number;
  error_message?: string;
}> {
  const start = Date.now();
  const sector = getSectorBySlug(sectorSlug);
  if (!sector) {
    return {
      status: 'error',
      dimension: null,
      cost_usd: 0,
      duration_ms: Date.now() - start,
      error_message: `Secteur inconnu : ${sectorSlug}`,
    };
  }

  const dimensionModel = options.dimensionModel ?? DEFAULT_DIMENSION_MODEL;
  const caller = options.deps?.callDimensionLLM ?? createDefaultDimensionCaller(dimensionModel);

  try {
    const response = await caller(dimension, sector);
    const sanitized = sanitizeDimensionResponse(dimension, response);
    const cost = response.usage
      ? estimateCostUsd(dimensionModel, response.usage.input_tokens, response.usage.output_tokens)
      : 0;
    return {
      status: sanitized.data_missing ? 'data_missing' : 'success',
      dimension: sanitized,
      cost_usd: cost,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      dimension: makeDataMissingDimension(dimension, message),
      cost_usd: 0,
      duration_ms: Date.now() - start,
      error_message: message,
    };
  }
}

// ------------------------------------------------------------
// HELPERS INTERNES
// ------------------------------------------------------------

function sanitizeDimensionResponse(
  dimension: DimensionKey,
  raw: DimensionLLMResponse,
): SectoralDimension {
  // Validation defensive : si le LLM a produit un score sans
  // citer de source, on force data_missing meme s il a marque
  // confidence="high". La discipline anti-hallucination prime
  // sur la confiance affichee par le modele.
  const hasSources = Array.isArray(raw.sources_cited) && raw.sources_cited.length > 0;

  if (raw.data_missing || !hasSources) {
    return {
      score: null,
      definition_applied: typeof raw.definition_applied === 'string' ? raw.definition_applied : '',
      sources_cited: hasSources ? raw.sources_cited : [],
      confidence: 'data_missing',
      data_missing: true,
      notes: raw.notes ?? `Donnee insuffisante pour ${DIMENSION_LABELS[dimension]}.`,
    };
  }

  // Clamp du score dans [0, 100] sans masquer un eventuel hors-
  // borne (on log la valeur originale en notes si elle a ete
  // ajustee, pour que l audit puisse remonter au prompt).
  const originalScore = raw.score;
  let clampedScore: number | null = null;
  let scoreNote: string | null = null;
  if (typeof originalScore === 'number' && !Number.isNaN(originalScore)) {
    clampedScore = Math.max(0, Math.min(100, originalScore));
    if (clampedScore !== originalScore) {
      scoreNote = `Score original ${originalScore} clampe a ${clampedScore} pour respecter l echelle 0-100.`;
    }
  } else {
    // Score non-numerique alors que data_missing=false : on bascule
    // en data_missing pour ne pas inventer.
    return {
      score: null,
      definition_applied: typeof raw.definition_applied === 'string' ? raw.definition_applied : '',
      sources_cited: hasSources ? raw.sources_cited : [],
      confidence: 'data_missing',
      data_missing: true,
      notes: `Score non-numerique retourne par le LLM, bascule en data_missing pour ${DIMENSION_LABELS[dimension]}.`,
    };
  }

  const baseNotes = raw.notes ?? '';
  const finalNotes = scoreNote ? `${baseNotes} ${scoreNote}`.trim() : baseNotes;

  return {
    score: clampedScore,
    definition_applied: typeof raw.definition_applied === 'string' ? raw.definition_applied : '',
    sources_cited: raw.sources_cited,
    confidence: raw.confidence ?? 'medium',
    data_missing: false,
    notes: finalNotes,
  };
}

function makeDataMissingDimension(
  dimension: DimensionKey,
  reason: string,
): SectoralDimension {
  return {
    score: null,
    definition_applied: '',
    sources_cited: [],
    confidence: 'data_missing',
    data_missing: true,
    notes: reason || `Donnee insuffisante pour ${DIMENSION_LABELS[dimension]}.`,
  };
}

function summarizeDimensionsForAggregator(
  dimensions: SectoralBriefDimensions,
): string {
  return DIMENSION_KEYS.map((k) => {
    const d = dimensions[k];
    const scoreText = d.data_missing ? 'donnee manquante' : `score ${d.score}/100`;
    const conf = d.confidence;
    const note = d.notes ? ` Notes : ${d.notes}` : '';
    return `- ${DIMENSION_LABELS[k]} (${scoreText}, confidence ${conf}).${note}`;
  }).join('\n');
}

// ------------------------------------------------------------
// CALLERS PAR DEFAUT
// Encapsulent l appel a anthropic-client. Les tests injectent
// leurs propres callers et n entrent jamais dans ces fonctions.
// ------------------------------------------------------------

function createDefaultDimensionCaller(
  model: string,
): (dim: DimensionKey, sector: SectorDefinition) => Promise<DimensionLLMResponse> {
  return async (dim, sector) => {
    const systemPrompt = buildDimensionSystemPrompt(dim);
    const userPrompt = buildDimensionUserPrompt(dim, sector);
    const raw = await callClaude(systemPrompt, userPrompt, 2500, model, {
      enableWebSearch: true,
      maxWebSearches: 4,
    });
    const parsed = parseJSON<DimensionLLMResponse>(raw);
    return parsed;
  };
}

function createDefaultAggregatorCaller(
  model: string,
): (sector: SectorDefinition, dims: SectoralBriefDimensions) => Promise<AggregatorLLMResponse> {
  return async (sector, dims) => {
    const systemPrompt = buildAggregatorSystemPrompt();
    const userPrompt = buildAggregatorUserPrompt(
      sector,
      summarizeDimensionsForAggregator(dims),
    );
    const raw = await callClaude(systemPrompt, userPrompt, 1200, model, {
      enableWebSearch: false,
    });
    const parsed = parseJSON<AggregatorLLMResponse>(raw);
    return parsed;
  };
}

// ------------------------------------------------------------
// EXPORTS DE TEST
// Surface restreinte exposee pour permettre aux tests unitaires
// de tester les helpers internes sans dependre de l API publique.
// ------------------------------------------------------------

export const __TEST_ONLY = {
  sanitizeDimensionResponse,
  makeDataMissingDimension,
  summarizeDimensionsForAggregator,
  MAX_DATA_MISSING_TOLERATED,
  DEFAULT_DIMENSION_MODEL,
  DEFAULT_AGGREGATOR_MODEL,
};
