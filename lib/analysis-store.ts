// ============================================================
// PRELUDE - Service de persistence des analyses
// ------------------------------------------------------------
// API de haut niveau pour stocker et recuperer les analyses
// produites par le pipeline. Encapsule l acces Supabase et
// applique le feature flag ENABLE_PERSISTENCE.
//
// PRINCIPE : tout marche meme sans persistence.
//   - Si ENABLE_PERSISTENCE != 'true', les fonctions retournent
//     null/false sans rien casser
//   - Si la base est down, les erreurs sont catchees et loggees
//     mais la pipeline d analyse principale continue normalement
//   - On ne fait JAMAIS planter une analyse a cause d un probleme
//     de persistence : c est une fonctionnalite optionnelle, pas
//     un point critique du pipeline
// ============================================================

import { getSupabaseServerClient, getSupabaseAdminClient } from './supabase/server';

// ============================================================
// TYPES
// ============================================================

/**
 * Resume d une analyse pour les vues liste (sans le result_json complet).
 * Optimise pour ne pas charger 500KB+ a chaque requete liste.
 */
export interface AnalysisSummary {
  id: string;
  companyName: string;
  sector: string | null;
  subSector: string | null;
  country: string | null;
  geographicHub: string | null;
  yearFounded: number | null;
  roundType: string | null;
  roundAmountEur: number | null;
  verdict: string;
  verdictConfidence: number | null;
  globalScore: number | null;
  blindspotScore: number | null;
  contrarianScore: number | null;
  coherenceScore: number | null;
  userNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Analyse complete avec le payload pipeline (12 moteurs).
 * Charge a la demande quand l utilisateur ouvre une analyse passee.
 */
export interface AnalysisFull extends AnalysisSummary {
  resultJson: any;
  sourceText: string | null;
  sourceFilename: string | null;
  sourcePages: number | null;
  pipelineDurationMs: number | null;
  pipelineEnginesStatus: any;
}

/**
 * Payload pour creer une nouvelle analyse.
 */
export interface SaveAnalysisInput {
  companyName: string;
  sector?: string | null;
  subSector?: string | null;
  country?: string | null;
  geographicHub?: string | null;
  yearFounded?: number | null;
  roundType?: string | null;
  roundAmountEur?: number | null;
  verdict: string;
  verdictConfidence?: number | null;
  globalScore?: number | null;
  blindspotScore?: number | null;
  contrarianScore?: number | null;
  coherenceScore?: number | null;
  resultJson: any;
  sourceText?: string | null;
  sourceFilename?: string | null;
  sourcePages?: number | null;
  pipelineDurationMs?: number | null;
  pipelineEnginesStatus?: any;
}

/**
 * Filtres pour la liste d analyses.
 */
export interface ListAnalysesFilters {
  verdict?: string;
  sector?: string;
  searchQuery?: string;       // recherche texte sur companyName
  fromDate?: string;          // ISO date
  toDate?: string;            // ISO date
  limit?: number;             // defaut 50
  offset?: number;            // defaut 0
}

// ============================================================
// FEATURE FLAG
// ============================================================

/**
 * Verifie si la persistence est activee.
 * Permet de developper et deployer sans casser quoi que ce soit
 * tant que les variables Supabase ne sont pas configurees en prod.
 */
export function isPersistenceEnabled(): boolean {
  return process.env.ENABLE_PERSISTENCE === 'true';
}

// ============================================================
// EXTRACTION DES METADONNEES
// ------------------------------------------------------------
// Extrait les champs scoreables depuis le result_json complet
// du pipeline. Toleerant aux variations de structure.
// ============================================================

export function extractAnalysisMetadata(result: any): Partial<SaveAnalysisInput> {
  // Extraction defensive : on accepte que les champs manquent
  const e = result?.extraction || {};
  const blindspot = result?.blindspotAnalysis || {};
  const contrarian = result?.contrarianSingularity || {};
  const coherence = result?.financialCoherence || {};
  const reco = result?.finalRecommendation || {};

  // Le verdict canonique : on prefere le verdict de la recommandation
  // finale, sinon on tombe sur le verdict du moteur principal
  const verdict =
    reco?.verdict ||
    reco?.recommendation ||
    'approfondir';

  // Score global : pondere de plusieurs sources possibles
  const globalScore =
    reco?.globalScore ??
    reco?.confidence ??
    null;

  // Conversion sure du montant si present
  let roundAmountEur: number | null = null;
  const rawAmount = e?.roundAmount || e?.amount;
  if (typeof rawAmount === 'number') {
    roundAmountEur = rawAmount;
  } else if (typeof rawAmount === 'string') {
    const parsed = parseFloat(rawAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(parsed)) roundAmountEur = parsed;
  }

  return {
    companyName: e?.companyName || 'Sans nom',
    sector: e?.sector || null,
    subSector: e?.subSector || null,
    country: e?.country || null,
    geographicHub: e?.geographicHub || null,
    yearFounded: typeof e?.yearFounded === 'number' ? e.yearFounded : null,
    roundType: e?.roundType || e?.roundStage || null,
    roundAmountEur,
    verdict,
    verdictConfidence: typeof reco?.confidence === 'number' ? reco.confidence : null,
    globalScore: typeof globalScore === 'number' ? globalScore : null,
    blindspotScore: typeof blindspot?.globalBlindspotScore === 'number' ? blindspot.globalBlindspotScore : null,
    contrarianScore: typeof contrarian?.globalContrarianScore === 'number' ? contrarian.globalContrarianScore : null,
    coherenceScore: typeof coherence?.globalCoherenceScore === 'number' ? coherence.globalCoherenceScore : null,
  };
}

// ============================================================
// SAVE
// ============================================================

/**
 * Sauvegarde une analyse complete dans la base.
 * Retourne l ID de l analyse creee, ou null si la persistence
 * est desactivee ou si une erreur survient.
 *
 * IMPORTANT : ne throw jamais. Une erreur de persistence ne doit
 * jamais casser l affichage de l analyse a l ecran.
 */
export async function saveAnalysis(
  input: SaveAnalysisInput,
): Promise<string | null> {
  if (!isPersistenceEnabled()) return null;

  try {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      console.warn('[analysis-store] saveAnalysis : pas de user authentifie');
      return null;
    }

    const { data, error } = await supabase
      .from('analyses')
      .insert({
        user_id: userData.user.id,
        company_name: input.companyName,
        sector: input.sector,
        sub_sector: input.subSector,
        country: input.country,
        geographic_hub: input.geographicHub,
        year_founded: input.yearFounded,
        round_type: input.roundType,
        round_amount_eur: input.roundAmountEur,
        verdict: input.verdict,
        verdict_confidence: input.verdictConfidence,
        global_score: input.globalScore,
        blindspot_score: input.blindspotScore,
        contrarian_score: input.contrarianScore,
        coherence_score: input.coherenceScore,
        result_json: input.resultJson,
        source_text: input.sourceText,
        source_filename: input.sourceFilename,
        source_pages: input.sourcePages,
        pipeline_duration_ms: input.pipelineDurationMs,
        pipeline_engines_status: input.pipelineEnginesStatus,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[analysis-store] saveAnalysis erreur Supabase :', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('[analysis-store] saveAnalysis exception :', err);
    return null;
  }
}

// ============================================================
// LIST
// ============================================================

/**
 * Liste les analyses de l utilisateur avec filtres optionnels.
 * Retourne toujours un array (vide si erreur ou persistence off).
 */
export async function listAnalyses(
  filters: ListAnalysesFilters = {},
): Promise<AnalysisSummary[]> {
  if (!isPersistenceEnabled()) return [];

  try {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];

    let query = supabase
      .from('analyses')
      .select(`
        id, company_name, sector, sub_sector, country, geographic_hub,
        year_founded, round_type, round_amount_eur,
        verdict, verdict_confidence, global_score, blindspot_score,
        contrarian_score, coherence_score, user_notes,
        created_at, updated_at
      `)
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (filters.verdict) query = query.eq('verdict', filters.verdict);
    if (filters.sector) query = query.eq('sector', filters.sector);
    if (filters.searchQuery) {
      query = query.ilike('company_name', `%${filters.searchQuery}%`);
    }
    if (filters.fromDate) query = query.gte('created_at', filters.fromDate);
    if (filters.toDate) query = query.lte('created_at', filters.toDate);

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      console.error('[analysis-store] listAnalyses erreur :', error);
      return [];
    }

    return (data || []).map(rowToSummary);
  } catch (err) {
    console.error('[analysis-store] listAnalyses exception :', err);
    return [];
  }
}

// ============================================================
// GET ONE
// ============================================================

/**
 * Recupere une analyse complete par son ID, avec verification
 * d ownership (RLS). Retourne null si non trouvee, non accessible,
 * ou si persistence off.
 */
export async function getAnalysis(id: string): Promise<AnalysisFull | null> {
  if (!isPersistenceEnabled()) return null;

  try {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') { // pas d erreur log si juste 'not found'
        console.error('[analysis-store] getAnalysis erreur :', error);
      }
      return null;
    }

    return rowToFull(data);
  } catch (err) {
    console.error('[analysis-store] getAnalysis exception :', err);
    return null;
  }
}

// ============================================================
// DELETE
// ============================================================

/**
 * Supprime une analyse. Retourne true si supprimee, false sinon.
 */
export async function deleteAnalysis(id: string): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;

  try {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const { error } = await supabase
      .from('analyses')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('[analysis-store] deleteAnalysis erreur :', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[analysis-store] deleteAnalysis exception :', err);
    return false;
  }
}

// ============================================================
// UPDATE NOTES (annotation rapide pour Niveau 3 futur)
// ============================================================

export async function updateAnalysisNotes(
  id: string,
  userNotes: string,
): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;

  try {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;

    const { error } = await supabase
      .from('analyses')
      .update({ user_notes: userNotes })
      .eq('id', id)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('[analysis-store] updateAnalysisNotes erreur :', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[analysis-store] updateAnalysisNotes exception :', err);
    return false;
  }
}

// ============================================================
// STATS
// ============================================================

/**
 * Retourne les compteurs par verdict pour l utilisateur courant.
 * Utilise pour le dashboard /history.
 */
export async function getAnalysesStats(): Promise<{
  total: number;
  byVerdict: Record<string, number>;
  avgGlobalScore: number | null;
  avgBlindspotScore: number | null;
  lastAnalysisAt: string | null;
} | null> {
  if (!isPersistenceEnabled()) return null;

  try {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data, error } = await supabase
      .from('analyses_stats')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();

    if (error || !data) {
      // Pas de stats = pas d analyses, c est ok
      return {
        total: 0,
        byVerdict: {},
        avgGlobalScore: null,
        avgBlindspotScore: null,
        lastAnalysisAt: null,
      };
    }

    return {
      total: data.total_count || 0,
      byVerdict: {
        investir: data.verdict_investir_count || 0,
        'investir-conditions': data.verdict_conditions_count || 0,
        approfondir: data.verdict_approfondir_count || 0,
        refuser: data.verdict_refuser_count || 0,
      },
      avgGlobalScore: data.avg_global_score,
      avgBlindspotScore: data.avg_blindspot_score,
      lastAnalysisAt: data.last_analysis_at,
    };
  } catch (err) {
    console.error('[analysis-store] getAnalysesStats exception :', err);
    return null;
  }
}

// ============================================================
// MAPPERS
// ============================================================

function rowToSummary(row: any): AnalysisSummary {
  return {
    id: row.id,
    companyName: row.company_name,
    sector: row.sector,
    subSector: row.sub_sector,
    country: row.country,
    geographicHub: row.geographic_hub,
    yearFounded: row.year_founded,
    roundType: row.round_type,
    roundAmountEur: row.round_amount_eur,
    verdict: row.verdict,
    verdictConfidence: row.verdict_confidence,
    globalScore: row.global_score,
    blindspotScore: row.blindspot_score,
    contrarianScore: row.contrarian_score,
    coherenceScore: row.coherence_score,
    userNotes: row.user_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFull(row: any): AnalysisFull {
  return {
    ...rowToSummary(row),
    resultJson: row.result_json,
    sourceText: row.source_text,
    sourceFilename: row.source_filename,
    sourcePages: row.source_pages,
    pipelineDurationMs: row.pipeline_duration_ms,
    pipelineEnginesStatus: row.pipeline_engines_status,
  };
}
