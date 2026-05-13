// ============================================================
// PRELUDE - Persistence inter-sectorielle (server-only)
// ------------------------------------------------------------
// Lit et ecrit dans la table inter_sectoral_briefs et tire des
// briefs sectoriels les snapshots T et T-1 a partir d une periode
// trimestrielle.
//
// Module SERVER-ONLY : tire lib/supabase/server. Aucun composant
// client ne doit l importer directement (la separation est gardee
// par convention et par le barrel client.ts qui ne re-exporte
// rien d ici).
// ============================================================

import { getSupabaseAdminClient } from '../../supabase/server';
import { previousPeriodQuarter } from './inter-sector-computations';
import type {
  SectoralBrief,
  SectoralBriefDimensions,
} from './types';
import type {
  InterSectoralBrief,
  ConvergencePairWithInterpretation,
  DivergencePairWithInterpretation,
  MacroPatternWithInterpretation,
} from './inter-sector-types';

// ------------------------------------------------------------
// LECTURE DES FICHES SECTORIELLES POUR L AGREGATEUR
// ------------------------------------------------------------

interface SectoralBriefRow {
  id: string;
  sector_slug: string;
  generated_at: string;
  dimensions: SectoralBriefDimensions;
  narrative_summary: string;
  regeneration_trigger: SectoralBrief['regeneration_trigger'];
  supersedes_id: string | null;
  generation_metadata: SectoralBrief['generation_metadata'];
  created_at: string;
}

function rowToSectoralBrief(row: SectoralBriefRow): SectoralBrief {
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

/**
 * Liste la fiche la plus recente de chaque secteur du catalogue,
 * tous secteurs confondus. S appuie sur la vue
 * sectoral_briefs_latest livree par le sous-chantier 1 pour eviter
 * un scan complet.
 */
export async function listLatestBriefsAcrossSectors(): Promise<SectoralBrief[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('sectoral_briefs_latest')
    .select('*');
  if (error) {
    throw new Error(`listLatestBriefsAcrossSectors: ${error.message}`);
  }
  return (data ?? []).map((row) => rowToSectoralBrief(row as SectoralBriefRow));
}

/**
 * Liste les fiches sectorielles antherieures correspondant au
 * trimestre precedent une periode donnee. Pour chaque secteur, on
 * prend la fiche la plus recente generee dans la fenetre du
 * trimestre cible.
 */
export async function listBriefsForPreviousQuarter(
  currentPeriod: string,
): Promise<SectoralBrief[]> {
  const previousPeriod = previousPeriodQuarter(currentPeriod);
  const range = quarterDateRange(previousPeriod);
  const supabase = getSupabaseAdminClient();

  // On selectionne toutes les fiches generees dans la fenetre puis
  // on garde la plus recente par secteur cote applicatif. Une vue
  // SQL serait plus elegante mais une vue par trimestre n est pas
  // prevue au schema initial ; cette agregation reste tres legere
  // (52 lignes max par an).
  const { data, error } = await supabase
    .from('sectoral_briefs')
    .select('*')
    .gte('generated_at', range.start)
    .lt('generated_at', range.end)
    .order('generated_at', { ascending: false });
  if (error) {
    throw new Error(`listBriefsForPreviousQuarter: ${error.message}`);
  }

  const seen = new Set<string>();
  const out: SectoralBrief[] = [];
  for (const row of (data ?? []) as SectoralBriefRow[]) {
    if (seen.has(row.sector_slug)) continue;
    seen.add(row.sector_slug);
    out.push(rowToSectoralBrief(row));
  }
  return out;
}

// ------------------------------------------------------------
// PERSISTENCE DU BRIEF INTER-SECTORIEL
// ------------------------------------------------------------

interface InterSectoralBriefRow {
  id: string;
  generated_at: string;
  period_quarter: string;
  convergences: ConvergencePairWithInterpretation[];
  divergences: DivergencePairWithInterpretation[];
  macro_patterns: MacroPatternWithInterpretation[];
  narrative_summary: string;
  sources_consulted: InterSectoralBrief['sources_consulted'];
  generation_metadata: InterSectoralBrief['generation_metadata'];
  created_at: string;
}

function rowToInterSectoralBrief(row: InterSectoralBriefRow): InterSectoralBrief {
  return {
    id: row.id,
    period_quarter: row.period_quarter,
    generated_at: row.generated_at,
    convergences: row.convergences ?? [],
    divergences: row.divergences ?? [],
    macro_patterns: row.macro_patterns ?? [],
    narrative_summary: row.narrative_summary,
    sources_consulted: row.sources_consulted ?? [],
    generation_metadata: row.generation_metadata,
  };
}

/**
 * Persiste le brief inter-sectoriel. La contrainte UNIQUE
 * period_quarter en SQL bloque la creation d un second brief sur
 * la meme periode : pour ecraser, le caller doit passer par
 * upsert (on prefere l erreur explicite au silencieux).
 */
export async function persistInterSectoralBrief(
  brief: InterSectoralBrief,
): Promise<InterSectoralBrief> {
  const supabase = getSupabaseAdminClient();
  const payload = {
    period_quarter: brief.period_quarter,
    generated_at: brief.generated_at,
    convergences: brief.convergences,
    divergences: brief.divergences,
    macro_patterns: brief.macro_patterns,
    narrative_summary: brief.narrative_summary,
    sources_consulted: brief.sources_consulted,
    generation_metadata: brief.generation_metadata,
  };
  const { data, error } = await supabase
    .from('inter_sectoral_briefs')
    .insert(payload)
    .select('*')
    .single();
  if (error) {
    throw new Error(`persistInterSectoralBrief: ${error.message}`);
  }
  return rowToInterSectoralBrief(data as InterSectoralBriefRow);
}

/**
 * Idempotent variant : si un brief existe deja pour la periode,
 * il est ecrase. Sert a la regeneration manuelle ou au cron qui
 * peut etre re-execute apres une regeneration sectorielle de
 * derniere minute.
 */
export async function upsertInterSectoralBrief(
  brief: InterSectoralBrief,
): Promise<InterSectoralBrief> {
  const supabase = getSupabaseAdminClient();
  const payload = {
    period_quarter: brief.period_quarter,
    generated_at: brief.generated_at,
    convergences: brief.convergences,
    divergences: brief.divergences,
    macro_patterns: brief.macro_patterns,
    narrative_summary: brief.narrative_summary,
    sources_consulted: brief.sources_consulted,
    generation_metadata: brief.generation_metadata,
  };
  const { data, error } = await supabase
    .from('inter_sectoral_briefs')
    .upsert(payload, { onConflict: 'period_quarter' })
    .select('*')
    .single();
  if (error) {
    throw new Error(`upsertInterSectoralBrief: ${error.message}`);
  }
  return rowToInterSectoralBrief(data as InterSectoralBriefRow);
}

/**
 * Recupere le brief d une periode precise (utile au selecteur de
 * periode dans le dashboard partner).
 */
export async function getInterSectoralBriefByPeriod(
  periodQuarter: string,
): Promise<InterSectoralBrief | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('inter_sectoral_briefs')
    .select('*')
    .eq('period_quarter', periodQuarter)
    .maybeSingle();
  if (error) {
    throw new Error(`getInterSectoralBriefByPeriod: ${error.message}`);
  }
  if (!data) return null;
  return rowToInterSectoralBrief(data as InterSectoralBriefRow);
}

/**
 * Recupere le brief le plus recent disponible. Sert au chargement
 * initial du dashboard partner.
 */
export async function getLatestInterSectoralBrief(): Promise<InterSectoralBrief | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('inter_sectoral_briefs')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`getLatestInterSectoralBrief: ${error.message}`);
  }
  if (!data) return null;
  return rowToInterSectoralBrief(data as InterSectoralBriefRow);
}

/**
 * Liste l ensemble des periodes pour lesquelles un brief existe,
 * triees du plus recent au plus ancien. Sert au selecteur de
 * periode dans le dashboard partner.
 */
export async function listInterSectoralPeriods(): Promise<
  Array<{ period_quarter: string; generated_at: string; id: string }>
> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('inter_sectoral_briefs')
    .select('id, period_quarter, generated_at')
    .order('generated_at', { ascending: false });
  if (error) {
    throw new Error(`listInterSectoralPeriods: ${error.message}`);
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    period_quarter: r.period_quarter,
    generated_at: r.generated_at,
  }));
}

// ------------------------------------------------------------
// HELPERS DE FENETRE TEMPORELLE
// ------------------------------------------------------------

/**
 * Convertit un libelle ISO trimestriel en intervalle ISO 8601
 * exclusif a droite. Exemple : "2026-Q2" donne
 * { start: "2026-04-01T00:00:00.000Z", end: "2026-07-01T00:00:00.000Z" }.
 */
export function quarterDateRange(period: string): { start: string; end: string } {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!m) throw new Error(`Format de periode invalide : ${period}. Attendu YYYY-Qn.`);
  const year = parseInt(m[1], 10);
  const quarter = parseInt(m[2], 10);
  const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0)).toISOString();
  const endYear = startMonth + 3 > 11 ? year + 1 : year;
  const endMonth = (startMonth + 3) % 12;
  const end = new Date(Date.UTC(endYear, endMonth, 1, 0, 0, 0, 0)).toISOString();
  return { start, end };
}
