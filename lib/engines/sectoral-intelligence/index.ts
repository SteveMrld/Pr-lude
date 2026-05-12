// ============================================================
// PRELUDE - Sectoral Intelligence Layer, API publique
// ------------------------------------------------------------
// Surface d export consolidee du module. Les consommateurs
// applicatifs (routes API, jobs cron, scripts d initialisation,
// UI admin) importent uniquement depuis ce fichier. Le detail
// d implementation (prompts, types internes de l orchestrateur,
// fetchers) reste accessible via les fichiers dedies si besoin
// d extension, mais l API stable se tient ici.
// ============================================================

// Types publics et catalogue des secteurs.
export type {
  DimensionKey,
  RegenerationTrigger,
  Confidence,
  SourceCitation,
  SectoralDimension,
  SectoralBriefDimensions,
  GenerationMetadata,
  SectoralBrief,
  RegenerationStatus,
  SectoralRegenerationResult,
  SectorDefinition,
  DimensionLLMResponse,
  AggregatorLLMResponse,
  RegeneratorDependencies,
  RegenerateOptions,
} from './types';

export {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  SECTORS,
  getSectorBySlug,
  estimateCostUsd,
  MODEL_PRICING,
} from './types';

// Prompts et version de prompt pour audit.
export {
  PROMPT_VERSION,
  buildDimensionSystemPrompt,
  buildDimensionUserPrompt,
  buildAggregatorSystemPrompt,
  buildAggregatorUserPrompt,
} from './dimension-prompts';

// Fetchers et interface d injection.
export type { FetchResult, SectoralFetchers, WebSearchResult } from './fetchers';
export {
  fetchIMF,
  fetchWorldBank,
  fetchEURLex,
  fetchOpenAlex,
  fetchArxiv,
  fetchGitHub,
  webSearch,
  defaultFetchers,
} from './fetchers';

// Orchestrateur principal.
export { regenerateSectoralBrief, regenerateDimension } from './regenerator';

// ============================================================
// PERSISTENCE SUPABASE
// ------------------------------------------------------------
// Helpers de lecture sur sectoral_briefs. L ecriture est faite
// par les scripts d initialisation et le job cron du
// sous-chantier 3, qui passent par getSupabaseAdminClient et
// inserent en service_role.
// ============================================================

import { getSupabaseAdminClient } from '../../supabase/server';
import type { SectoralBrief } from './types';

interface SectoralBriefRow {
  id: string;
  sector_slug: string;
  generated_at: string;
  dimensions: SectoralBrief['dimensions'];
  narrative_summary: string;
  regeneration_trigger: SectoralBrief['regeneration_trigger'];
  supersedes_id: string | null;
  generation_metadata: SectoralBrief['generation_metadata'];
  created_at: string;
}

function rowToBrief(row: SectoralBriefRow): SectoralBrief {
  return {
    id: row.id,
    sector_slug: row.sector_slug,
    generated_at: row.generated_at,
    dimensions: row.dimensions,
    narrative_summary: row.narrative_summary,
    regeneration_trigger: row.regeneration_trigger,
    supersedes_id: row.supersedes_id,
    generation_metadata: row.generation_metadata,
  };
}

// Recupere la derniere fiche d un secteur, ou null si aucune
// fiche n a encore ete generee pour ce secteur.
export async function getLatestBriefForSector(
  sectorSlug: string,
): Promise<SectoralBrief | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('sectoral_briefs')
    .select('*')
    .eq('sector_slug', sectorSlug)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getLatestBriefForSector: ${error.message}`);
  }
  if (!data) return null;
  return rowToBrief(data as SectoralBriefRow);
}

// Recupere la fiche d un secteur la plus recente anterieure ou
// egale a la date passee. Sert la comparaison T versus T-12 mois.
export async function getBriefAtDate(
  sectorSlug: string,
  targetDate: Date,
): Promise<SectoralBrief | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('sectoral_briefs')
    .select('*')
    .eq('sector_slug', sectorSlug)
    .lte('generated_at', targetDate.toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getBriefAtDate: ${error.message}`);
  }
  if (!data) return null;
  return rowToBrief(data as SectoralBriefRow);
}

// Liste les N dernieres fiches d un secteur (utile pour audit ou
// pour la timeline du dashboard partner).
export async function listBriefsForSector(
  sectorSlug: string,
  limit = 10,
): Promise<SectoralBrief[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('sectoral_briefs')
    .select('*')
    .eq('sector_slug', sectorSlug)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listBriefsForSector: ${error.message}`);
  }
  return (data ?? []).map((row) => rowToBrief(row as SectoralBriefRow));
}

// Insere une fiche dans Supabase. Retourne la ligne creee avec
// son id genere cote SQL. Le sous-chantier 3 utilise cette
// fonction depuis le script d initialisation.
export async function persistSectoralBrief(
  brief: SectoralBrief,
): Promise<SectoralBrief> {
  const supabase = getSupabaseAdminClient();
  const payload = {
    sector_slug: brief.sector_slug,
    generated_at: brief.generated_at,
    dimensions: brief.dimensions,
    narrative_summary: brief.narrative_summary,
    regeneration_trigger: brief.regeneration_trigger,
    supersedes_id: brief.supersedes_id,
    generation_metadata: brief.generation_metadata,
  };
  const { data, error } = await supabase
    .from('sectoral_briefs')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`persistSectoralBrief: ${error.message}`);
  }
  return rowToBrief(data as SectoralBriefRow);
}
