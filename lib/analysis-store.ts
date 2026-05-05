// ============================================================
// PRELUDE - Service de persistence des analyses
// ------------------------------------------------------------
// API de haut niveau pour stocker et recuperer les analyses
// produites par le pipeline. Encapsule l acces Supabase et
// applique le feature flag ENABLE_PERSISTENCE.
//
// MODES SUPPORTES (selon variables d environnement)
//
//   1. MODE SOLO (defaut quand persistence activee)
//      ENABLE_PERSISTENCE=true
//      ENABLE_AUTH=false (ou non defini)
//      -> utilise un user_id fixe (PRELUDE_SOLO_USER_ID) pour stocker
//         toutes les analyses sous un seul compte. Bypasse RLS via
//         service-role. Aucune authentification requise cote UI.
//      -> mode adapte a un usage personnel / dev / instance solo.
//
//   2. MODE MULTI-USER (futur)
//      ENABLE_PERSISTENCE=true
//      ENABLE_AUTH=true
//      -> utilise auth.getUser() pour identifier l utilisateur
//         courant. Chaque utilisateur ne voit que ses analyses (RLS).
//      -> mode adapte a une plateforme commerciale partagee.
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
// MODE SOLO : UUID admin par defaut
// ------------------------------------------------------------
// UUID fixe utilise quand l auth est desactivee. Cet UUID n a pas
// besoin d exister dans auth.users pour fonctionner avec le client
// admin (service-role bypasse les contraintes de cle etrangere ?
// non, donc on doit creer le user dans auth.users ou desactiver la
// FK). Approche choisie : on retire la contrainte FK quand l app
// est en mode solo, et on stocke ce UUID directement.
//
// Pour personnaliser, definir PRELUDE_SOLO_USER_ID dans les env vars.
// ============================================================

const DEFAULT_SOLO_USER_ID = '00000000-0000-0000-0000-000000000001';

function getSoloUserId(): string {
  return process.env.PRELUDE_SOLO_USER_ID || DEFAULT_SOLO_USER_ID;
}

function isAuthEnabled(): boolean {
  return process.env.ENABLE_AUTH === 'true';
}

/**
 * Resoud l user_id a utiliser pour la requete courante.
 * - Mode multi-user : essaie auth.getUser(), retourne null si pas de session
 * - Mode solo : retourne toujours le UUID solo
 *
 * Retourne aussi un flag indiquant s il faut utiliser le client admin
 * (qui bypasse RLS) ou le client utilisateur normal.
 */
async function resolveUserContext(): Promise<{
  userId: string | null;
  useAdminClient: boolean;
}> {
  if (!isAuthEnabled()) {
    // Mode solo : UUID fixe + client admin pour bypass RLS
    return { userId: getSoloUserId(), useAdminClient: true };
  }

  // Mode multi-user : auth Supabase requise
  try {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { userId: null, useAdminClient: false };
    }
    return { userId: userData.user.id, useAdminClient: false };
  } catch {
    return { userId: null, useAdminClient: false };
  }
}

/**
 * Retourne le bon client Supabase selon le contexte.
 * - useAdminClient=true : client service-role (bypasse RLS)
 * - useAdminClient=false : client user normal (respecte RLS)
 */
function getClient(useAdmin: boolean) {
  return useAdmin ? getSupabaseAdminClient() : getSupabaseServerClient();
}

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
  // Champs enrichis pour la vue de fonds (UI historique).
  // Joints depuis les tables collaboration (workflow, versions,
  // annotations). null si la persistance collab n est pas active
  // ou si la jointure echoue, on degrade silencieusement.
  workflowStage: string | null;
  workflowStageUpdatedAt: string | null;
  versionsCount: number;
  openCommentsCount: number;
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
  workflowStage?: string;     // depose, in_review, dd_field, ic_review, signed, declined
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
 * Cherche une analyse existante du meme nom de societe pour le user/org
 * courant. Utilise pour proposer la creation d une nouvelle version
 * plutot qu un nouveau dossier au moment d un re-run.
 */
export async function findExistingByCompany(
  companyName: string,
): Promise<{ id: string; companyName: string; createdAt: string; latestVersion: number } | null> {
  if (!isPersistenceEnabled()) return null;
  if (!companyName?.trim()) return null;

  try {
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return null;
    const supabase = getClient(useAdminClient);

    const needle = companyName.trim().toLowerCase();

    const { data, error } = await supabase
      .from('analyses')
      .select('id, company_name, created_at')
      .eq('user_id', userId)
      .ilike('company_name', needle)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;

    const match = data[0];

    // Recuperer le dernier version_num pour proposer un v(N+1) explicite
    const { data: versionData } = await supabase
      .from('analyses_versions')
      .select('version_num')
      .eq('analysis_id', match.id)
      .order('version_num', { ascending: false })
      .limit(1);

    const latestVersion = versionData?.[0]?.version_num ?? 1;

    return {
      id: match.id,
      companyName: match.company_name,
      createdAt: match.created_at,
      latestVersion,
    };
  } catch {
    return null;
  }
}

/**
 * Met a jour le result_json d une analyse existante, sans creer une
 * nouvelle ligne. Utilise quand on cree une nouvelle version : le snapshot
 * historique est insere dans analyses_versions, et le live de la table
 * analyses est ecrase pour que le dashboard et la liste refletent
 * immediatement la derniere version.
 */
export async function updateAnalysisLive(
  analysisId: string,
  input: SaveAnalysisInput,
): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  try {
    const { useAdminClient } = await resolveUserContext();
    const supabase = getClient(useAdminClient);

    const { error } = await supabase
      .from('analyses')
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    if (error) {
      console.error('[analysis-store] updateAnalysisLive erreur :', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[analysis-store] updateAnalysisLive exception :', err);
    return false;
  }
}

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
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) {
      console.warn('[analysis-store] saveAnalysis : pas de user (auth requise)');
      return null;
    }
    const supabase = getClient(useAdminClient);

    const { data, error } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
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
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return [];
    const supabase = getClient(useAdminClient);

    let query = supabase
      .from('analyses')
      .select(`
        id, company_name, sector, sub_sector, country, geographic_hub,
        year_founded, round_type, round_amount_eur,
        verdict, verdict_confidence, global_score, blindspot_score,
        contrarian_score, coherence_score, user_notes,
        created_at, updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters.verdict) query = query.eq('verdict', filters.verdict);
    if (filters.sector) query = query.eq('sector', filters.sector);
    if (filters.searchQuery) {
      query = query.ilike('company_name', `%${filters.searchQuery}%`);
    }
    if (filters.fromDate) query = query.gte('created_at', filters.fromDate);
    if (filters.toDate) query = query.lte('created_at', filters.toDate);

    // Filtre par stade workflow : on resout d abord les analysis_ids
    // qui matchent le stade, puis on filtre la query principale.
    // Si la table workflow n existe pas (old schema), on degrade
    // silencieusement et on ignore le filtre.
    if (filters.workflowStage) {
      try {
        const { data: wfRows } = await supabase
          .from('analyses_workflow_status')
          .select('analysis_id')
          .eq('stage', filters.workflowStage);
        const matchingIds = (wfRows || []).map((r: any) => r.analysis_id);
        if (matchingIds.length === 0) return [];
        query = query.in('id', matchingIds);
      } catch {
        // ignore : pas de table workflow
      }
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      console.error('[analysis-store] listAnalyses erreur :', error);
      return [];
    }

    const summaries = (data || []).map(rowToSummary);
    if (summaries.length === 0) return summaries;

    // Enrichissement collab : on charge en parallele les workflow stages,
    // le compte de versions, et le compte de commentaires non resolus
    // pour les analyses listees. Si une jointure echoue, on degrade
    // silencieusement (les champs restent a leurs valeurs par defaut).
    const analysisIds = summaries.map((s) => s.id);

    try {
      const [workflowRes, versionsRes, commentsRes] = await Promise.all([
        supabase
          .from('analyses_workflow_status')
          .select('analysis_id, stage, updated_at')
          .in('analysis_id', analysisIds),
        supabase
          .from('analyses_versions')
          .select('analysis_id')
          .in('analysis_id', analysisIds),
        supabase
          .from('analyses_annotations')
          .select('analysis_id')
          .in('analysis_id', analysisIds)
          .is('resolved_at', null),
      ]);

      // Workflow : un stage par analyse
      const workflowMap = new Map<string, { stage: string; updatedAt: string }>();
      (workflowRes.data || []).forEach((w: any) => {
        workflowMap.set(w.analysis_id, { stage: w.stage, updatedAt: w.updated_at });
      });

      // Versions : compteur par analyse
      const versionsCountMap = new Map<string, number>();
      (versionsRes.data || []).forEach((v: any) => {
        versionsCountMap.set(v.analysis_id, (versionsCountMap.get(v.analysis_id) || 0) + 1);
      });

      // Commentaires ouverts : compteur par analyse
      const commentsCountMap = new Map<string, number>();
      (commentsRes.data || []).forEach((c: any) => {
        commentsCountMap.set(c.analysis_id, (commentsCountMap.get(c.analysis_id) || 0) + 1);
      });

      summaries.forEach((s) => {
        const wf = workflowMap.get(s.id);
        if (wf) {
          s.workflowStage = wf.stage;
          s.workflowStageUpdatedAt = wf.updatedAt;
        }
        s.versionsCount = versionsCountMap.get(s.id) || 0;
        s.openCommentsCount = commentsCountMap.get(s.id) || 0;
      });
    } catch (enrichErr) {
      console.warn('[analysis-store] enrichissement collab failed:', enrichErr);
    }

    return summaries;
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
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return null;
    const supabase = getClient(useAdminClient);

    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
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
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return false;
    const supabase = getClient(useAdminClient);

    const { error } = await supabase
      .from('analyses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

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
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return false;
    const supabase = getClient(useAdminClient);

    const { error } = await supabase
      .from('analyses')
      .update({ user_notes: userNotes })
      .eq('id', id)
      .eq('user_id', userId);

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
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return null;
    const supabase = getClient(useAdminClient);

    const { data, error } = await supabase
      .from('analyses_stats')
      .select('*')
      .eq('user_id', userId)
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
    // Defaults pour les champs collab : null/0. La jointure dans
    // listAnalyses les remplit ensuite quand disponibles.
    workflowStage: null,
    workflowStageUpdatedAt: null,
    versionsCount: 0,
    openCommentsCount: 0,
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

// ============================================================
// NIVEAU 3.A - APPRENTISSAGE PAR FEEDBACK SUPERVISE
// ------------------------------------------------------------
// Recupere les annotations utilisateur passees pertinentes pour
// un nouveau dossier. Ces annotations sont injectees dans le
// prompt de finalRecommendation comme contexte d apprentissage.
//
// Strategie de pertinence (par ordre de priorite) :
//   1. Meme secteur exact (ex. 'Defense', 'Defense')
//   2. Sous-secteur similaire (ex. 'drones certifies', 'UAS')
//   3. Memes patterns à risque detectes
//   4. Recence (les plus recentes en premier)
//
// Pour le 3.A simplifie, on filtre simplement par secteur exact
// et on retourne les 5 plus recentes. Le 3 complet ajoutera de
// la similarite semantique sur sub_sector et patterns.
// ============================================================

export interface PastAnnotation {
  companyName: string;
  sector: string | null;
  subSector: string | null;
  verdict: string;
  globalScore: number | null;
  userNotes: string;
  createdAt: string;
}

/**
 * Recupere les annotations passees pertinentes pour un nouveau dossier.
 * Filtre par secteur, exclut les analyses sans user_notes, prend les
 * 5 plus recentes.
 *
 * Retourne array vide si :
 *   - persistence desactivee
 *   - pas d annotations dans le secteur
 *   - erreur Supabase
 *
 * Non-bloquant : ne fait jamais planter le pipeline.
 */
export async function getRelevantPastAnnotations(
  sector: string | null | undefined,
  excludeAnalysisId?: string,
  maxResults: number = 5,
): Promise<PastAnnotation[]> {
  if (!isPersistenceEnabled()) return [];
  if (!sector) return [];

  try {
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return [];
    const supabase = getClient(useAdminClient);

    let query = supabase
      .from('analyses')
      .select(`
        company_name, sector, sub_sector, verdict, global_score,
        user_notes, created_at
      `)
      .eq('user_id', userId)
      .eq('sector', sector)
      .not('user_notes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(maxResults);

    if (excludeAnalysisId) {
      query = query.neq('id', excludeAnalysisId);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error('[analysis-store] getRelevantPastAnnotations erreur :', error);
      return [];
    }

    // Filtre supplementaire : on garde uniquement les annotations
    // non-vides (les empty strings ou whitespace-only sont retires)
    return data
      .filter((row: any) => row.user_notes && row.user_notes.trim().length > 0)
      .map((row: any) => ({
        companyName: row.company_name,
        sector: row.sector,
        subSector: row.sub_sector,
        verdict: row.verdict,
        globalScore: row.global_score,
        userNotes: row.user_notes.trim(),
        createdAt: row.created_at,
      }));
  } catch (err) {
    console.error('[analysis-store] getRelevantPastAnnotations exception :', err);
    return [];
  }
}

/**
 * Formate les annotations passees en bloc texte injectable dans
 * un prompt LLM. Format compact et structure.
 *
 * Si pas d annotations, retourne chaine vide (rien a injecter).
 */
export function formatPastAnnotationsForPrompt(annotations: PastAnnotation[]): string {
  if (annotations.length === 0) return '';

  const formatted = annotations
    .map((a, i) => {
      const date = new Date(a.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
      const score = a.globalScore != null ? `${Math.round(a.globalScore)}/100` : '?';
      return `[Annotation ${i + 1}] ${a.companyName} (${date}) · Verdict ${a.verdict} · Score ${score}
"${a.userNotes}"`;
    })
    .join('\n\n');

  return `# CONTEXTE D APPRENTISSAGE - ANNOTATIONS PASSEES SUR LE MEME SECTEUR

L utilisateur a annote les analyses precedentes dans ce secteur. Ces
annotations refletent sa sensibilite, son experience accumulee, et ses
corrections par rapport aux analyses brutes du moteur. Elles sont
fournies comme contexte pour calibrer ta recommandation finale.

REGLES D USAGE :
  - Utilise ces annotations comme un MIROIR de la pensee du partner
  - Si une annotation passee dit "le moteur a sous-estime X", verifie
    que ton analyse actuelle ne reproduit pas le meme biais
  - Si une annotation dit "ce comparable n est pas pertinent", evite
    de citer ce comparable dans des contextes similaires
  - Mais reste rigoureux : ne te plie pas aveuglement aux annotations
    si les faits du dossier les contredisent. Mentionne explicitement
    les divergences dans ton raisonnement.

ANNOTATIONS RECENTES (${annotations.length} dossier${annotations.length > 1 ? 's' : ''} dans ce secteur) :

${formatted}

`;
}

