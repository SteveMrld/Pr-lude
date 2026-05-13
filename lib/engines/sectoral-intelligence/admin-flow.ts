// ============================================================
// PRELUDE - Sectoral Intelligence Layer, helpers admin
// ------------------------------------------------------------
// Logique pure utilisee par la route /api/admin/sectoral et la
// page /admin/sectoral. Extraite du route handler pour permettre
// des tests deterministes sans avoir a monter un serveur Next ni
// a mocker Supabase.
//
// Trois familles de helpers :
//   - validation des body POST de regeneration
//   - assemblage des SectorRow a partir d une fiche persistee
//   - merge de la fiche precedente avec une dimension regeneree
//     surgicale (sert le cas dimension-by-dimension)
// ============================================================

import { DIMENSION_KEYS, SECTORS, getSectorBySlug } from './types';
import { computeFreshness, computeAgeDays, type FreshnessState } from './freshness';
import type {
  DimensionKey,
  SectorDefinition,
  SectoralBrief,
  SectoralBriefDimensions,
  SectoralDimension,
} from './types';

// ------------------------------------------------------------
// VALIDATION DU BODY POST
// ------------------------------------------------------------

export type RegenerateMode = 'full' | 'dimension';

export interface RegenerateRequestBody {
  sector_slug?: unknown;
  mode?: unknown;
  dimension?: unknown;
}

export type RegenerateValidation =
  | {
      ok: true;
      sector_slug: string;
      mode: RegenerateMode;
      dimension: DimensionKey | null;
    }
  | { ok: false; error: string };

export function validateRegenerateRequest(
  body: RegenerateRequestBody | null | undefined,
): RegenerateValidation {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body JSON requis.' };
  }

  const { sector_slug, mode, dimension } = body;

  if (typeof sector_slug !== 'string' || !sector_slug) {
    return { ok: false, error: 'Champ sector_slug requis.' };
  }
  if (!getSectorBySlug(sector_slug)) {
    return {
      ok: false,
      error: `Slug secteur inconnu : ${sector_slug}. Slugs valides : ${SECTORS.map((s) => s.slug).join(', ')}.`,
    };
  }

  if (mode !== 'full' && mode !== 'dimension') {
    return {
      ok: false,
      error: `Mode requis (full ou dimension), recu : ${typeof mode === 'string' ? mode : '(absent)'}.`,
    };
  }

  if (mode === 'dimension') {
    if (typeof dimension !== 'string' || !DIMENSION_KEYS.includes(dimension as DimensionKey)) {
      return {
        ok: false,
        error: `Dimension requise et doit appartenir a ${DIMENSION_KEYS.join(', ')}. Recu : ${typeof dimension === 'string' ? dimension : '(absente)'}.`,
      };
    }
    return { ok: true, sector_slug, mode, dimension: dimension as DimensionKey };
  }

  return { ok: true, sector_slug, mode, dimension: null };
}

// ------------------------------------------------------------
// ASSEMBLAGE DES SECTOR ROW POUR LE GET
// ------------------------------------------------------------

export interface SectorRow {
  slug: string;
  label: string;
  perimeter_brief: string;
  latest_brief_id: string | null;
  generated_at: string | null;
  age_days: number | null;
  freshness: FreshnessState;
  total_sources_cited: number;
  scores: Record<DimensionKey, number | null>;
  data_missing_count: number;
  regeneration_trigger: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
}

export function emptySectorRow(sector: SectorDefinition): SectorRow {
  const scores: Record<string, number | null> = {};
  for (const k of DIMENSION_KEYS) scores[k] = null;
  return {
    slug: sector.slug,
    label: sector.label,
    perimeter_brief: sector.perimeter_brief,
    latest_brief_id: null,
    generated_at: null,
    age_days: null,
    freshness: 'perimee',
    total_sources_cited: 0,
    scores: scores as Record<DimensionKey, number | null>,
    data_missing_count: DIMENSION_KEYS.length,
    regeneration_trigger: null,
    cost_usd: null,
    duration_ms: null,
  };
}

export function briefToSectorRow(
  sector: SectorDefinition,
  brief: SectoralBrief,
  now: Date = new Date(),
): SectorRow {
  const scores: Record<string, number | null> = {};
  let dataMissing = 0;
  let totalSources = 0;
  for (const k of DIMENSION_KEYS) {
    const dim = brief.dimensions[k];
    scores[k] = dim?.score ?? null;
    if (!dim || dim.data_missing) dataMissing++;
    if (dim?.sources_cited?.length) totalSources += dim.sources_cited.length;
  }
  return {
    slug: sector.slug,
    label: sector.label,
    perimeter_brief: sector.perimeter_brief,
    latest_brief_id: brief.id ?? null,
    generated_at: brief.generated_at,
    age_days: computeAgeDays(brief.generated_at, now),
    freshness: computeFreshness(brief.generated_at, now),
    total_sources_cited: totalSources,
    scores: scores as Record<DimensionKey, number | null>,
    data_missing_count: dataMissing,
    regeneration_trigger: brief.regeneration_trigger,
    cost_usd: brief.generation_metadata?.cost_usd ?? null,
    duration_ms: brief.generation_metadata?.duration_ms ?? null,
  };
}

export function countSourcesInDimensions(
  dims: Record<string, { sources_cited?: unknown }> | null | undefined,
): number {
  if (!dims) return 0;
  let n = 0;
  for (const k of Object.keys(dims)) {
    const sources = dims[k]?.sources_cited;
    if (Array.isArray(sources)) n += sources.length;
  }
  return n;
}

// ------------------------------------------------------------
// MERGE D UNE DIMENSION REGENEREE DANS UNE FICHE PRECEDENTE
// ------------------------------------------------------------
// Le scenario : un admin clique "Regenerer une dimension" pour
// la pression reglementaire fintech. On reappelle Sonnet sur
// cette dimension uniquement, puis on persiste une nouvelle
// fiche qui reutilise les sept autres dimensions de la fiche
// precedente plus la nouvelle pression reglementaire. Le
// supersedes_id pointe sur la fiche precedente. Le narrative
// summary est conserve : pour un changement marginal, ne pas
// reappeler Opus.

export interface MergeDimensionInput {
  previous: SectoralBrief;
  dimension: DimensionKey;
  regenerated: SectoralDimension;
  cost_usd: number;
  duration_ms: number;
  generatedAt?: Date;
}

export function mergeDimensionIntoNewBrief(input: MergeDimensionInput): SectoralBrief {
  const merged: SectoralBriefDimensions = { ...input.previous.dimensions };
  merged[input.dimension] = input.regenerated;
  const generatedAt = input.generatedAt ?? new Date();

  return {
    sector_slug: input.previous.sector_slug,
    generated_at: generatedAt.toISOString(),
    dimensions: merged,
    narrative_summary: input.previous.narrative_summary,
    regeneration_trigger: 'manual',
    supersedes_id: input.previous.id ?? null,
    generation_metadata: {
      dimension_model:
        input.previous.generation_metadata?.dimension_model ?? 'claude-sonnet-4-6',
      aggregator_model:
        input.previous.generation_metadata?.aggregator_model ?? 'claude-opus-4-7',
      prompt_version: input.previous.generation_metadata?.prompt_version ?? 'unknown',
      cost_usd: input.cost_usd,
      duration_ms: input.duration_ms,
      dimensions_regenerated: [input.dimension],
    },
  };
}

// ------------------------------------------------------------
// FORMATAGE EDITORIAL
// Sert l UI admin et garantit une homogeneite voix Le Grand
// Continent : pas d em-dashes, prose francaise.
// ------------------------------------------------------------

export function formatAge(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return "il y a moins d'un jour";
  if (days === 1) return 'il y a 1 jour';
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.round(days / 30);
  if (months === 1) return 'il y a environ 1 mois';
  return `il y a environ ${months} mois`;
}

export function formatCost(usd: number | null): string {
  if (usd === null) return '';
  if (usd === 0) return '0 $';
  if (usd < 0.01) return '< 0,01 $';
  return `${usd.toFixed(2)} $`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '';
  if (ms < 1000) return `${ms} ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min} min ${rem} s`;
}
