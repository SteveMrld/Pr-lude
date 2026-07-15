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
import { normalizeStringsRecursive } from './normalize-punctuation';
import { warnOnFlagFallback } from './env-flags';

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
  const enabled = process.env.ENABLE_AUTH === 'true';
  if (!enabled) warnOnFlagFallback('ENABLE_AUTH');
  return enabled;
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

/**
 * Expose l user_id de la requete courante. Utile aux modules qui
 * doivent persister une ligne rattachee au meme user que l analyse
 * en cours (cf prediction-records-store) sans avoir a dupliquer la
 * logique de resolution solo/multi-user. Retourne null si la
 * session est absente en mode multi-user.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await resolveUserContext();
  return userId;
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
  /**
   * True si au moins un moteur Bloc 2 (DD approfondie) a tourne et
   * produit un output. Permet a la liste d historique de differencier
   * les dossiers en attente de DD (Bloc 1 seul) des dossiers complets.
   * Maintenu en colonne dediee dans la table analyses pour eviter de
   * charger result_json a chaque list.
   */
  hasBloc2: boolean;
  /**
   * True si le partner a marque le dossier comme detenu en portefeuille
   * du fonds. Active la re-analyse automatique tous les six mois et le
   * dispatch des alertes de trajectoire vers le proprietaire du dossier.
   * Voir supabase-in-portfolio-schema.sql.
   */
  inPortfolio: boolean;
  /**
   * Nom du fichier source (pitch deck) tel qu il a ete uploade. Permet
   * de distinguer deux runs d un meme dossier dans la liste : meme
   * companyName, meme date, mais fichier different (nouvelle version
   * du deck). Present depuis la creation de la table, null pour les
   * dossiers antediluviens sans source persistee.
   */
  sourceFilename: string | null;
  /**
   * Statut brut du run tel qu il figure en base : 'running', 'completed',
   * 'completed_with_gaps', 'failed'. Rendu lisible cote UI par un helper
   * dedie, jamais affiche brut. Un dossier en completed_with_gaps ne doit
   * pas ressembler a un run complet dans la liste.
   */
  status: string | null;
  /**
   * Nombre de moteurs en echec pour ce run, calcule cote serveur depuis
   * pipeline_engines_status pour eviter d envoyer le JSONB entier au
   * client (potentiellement 50 KB par ligne x 50 lignes en liste). Somme
   * des statuts failed, failed-upstream, timeout, empty_output. null si
   * pipeline_engines_status est null (dossier anterieur a la brique 3) :
   * on ne pretend pas connaitre ce qu on n a pas mesure.
   */
  failedEnginesCount: number | null;
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
  /** Statut de run derive du releve per-moteur. Par defaut
   *  'completed' pour retrocompatibilite. 'completed_with_gaps'
   *  est ecrit quand au moins un moteur est failed / timeout /
   *  empty_output. Le pipeline_engines_status transporte le
   *  detail moteur par moteur. */
  runStatus?: 'completed' | 'completed_with_gaps';
  /** Message d erreur consolide, liste les moteurs defaillants
   *  par statut. null si le run est proprement completed. */
  runErrorMessage?: string | null;
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
  const enabled = process.env.ENABLE_PERSISTENCE === 'true';
  if (!enabled) warnOnFlagFallback('ENABLE_PERSISTENCE');
  return enabled;
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
  // mechanicalScore est la source de verite du score et du verdict,
  // calculee deterministe a partir des 16 moteurs Bloc 1 (cf brique 2
  // fix orchestrate fallback). Persiste desormais en top-level du
  // result par la route analyze. Sert de fallback dur au cas ou
  // finalRecommendation aurait un globalScore null (echec orchestrate
  // sur un ancien run persiste avant brique 1, ou tout chemin
  // downstream qui court-circuiterait le fallback conforme).
  const mech = result?.mechanicalScore || {};

  // Le verdict canonique : on prefere le verdict de la recommandation
  // finale s il est renseigne, sinon on tombe sur le verdict mecanique,
  // sinon sur la valeur par defaut. L ordre garantit qu on n ecrase
  // jamais un verdict LLM valide, mais qu on ne persiste jamais un
  // 'approfondir' par defaut alors que mechanicalScore avait deja
  // derive un verdict propre.
  const verdict =
    reco?.verdict ||
    reco?.recommendation ||
    mech?.verdict ||
    'approfondir';

  // Score global : preference finalRecommendation, fallback
  // mechanicalScore, sinon null. Le fallback couvre le cas d un
  // finalRecommendation degrade dont on aurait perdu la connexion
  // au mechanicalScore (protection en profondeur).
  const globalScore =
    reco?.globalScore ??
    reco?.confidence ??
    (typeof mech?.globalScore === 'number' ? mech.globalScore : null) ??
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
 * Calcule a partir du resultJson si la DD approfondie (Bloc 2) a deja
 * tourne sur ce dossier. Vrai si au moins un des cinq outputs Bloc 2
 * est present (objet non null/undefined) :
 *   - ledgerExtraction (grand livre)
 *   - ddFinancial (audit financier)
 *   - capTableExtraction (cap table)
 *   - ddContractual (audit contractuel)
 *   - ddTechnical (audit technique)
 *
 * Le flag est persiste dans la colonne has_bloc2 pour eviter de charger
 * tout result_json a chaque list. Voir migration supabase-has-bloc2-schema.sql.
 */
function computeHasBloc2(resultJson: any): boolean {
  if (!resultJson || typeof resultJson !== 'object') return false;
  return !!(
    resultJson.ledgerExtraction
    || resultJson.ddFinancial
    || resultJson.capTableExtraction
    || resultJson.ddContractual
    || resultJson.ddTechnical
  );
}

/**
 * Filtre final applique a result_json juste avant ecriture en base.
 * Walk recursif qui elimine em-dashes (—) et en-dashes (–) residuels
 * en sortie de pipeline (LLM majoritairement, plus rares concatenations
 * statiques). La regle est implementee dans normalizeStringsRecursive
 * et reste idempotente, donc une eventuelle double application en
 * amont ne pose aucun probleme. Toute sortie persistee est garantie
 * sans tiret long quelle que soit la source du contenu.
 */
function normalizeResultJsonForPersistence(resultJson: any): any {
  if (!resultJson || typeof resultJson !== 'object') return resultJson;
  return normalizeStringsRecursive(resultJson);
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
        result_json: normalizeResultJsonForPersistence(input.resultJson),
        has_bloc2: computeHasBloc2(input.resultJson),
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
        result_json: normalizeResultJsonForPersistence(input.resultJson),
        has_bloc2: computeHasBloc2(input.resultJson),
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
// CYCLE DE VIE STATUTAIRE (refonte transit + polling)
// ------------------------------------------------------------
// Le pipeline /api/analyze ne persiste plus en fin de course :
// il cree la ligne a t0 (status='running'), la met a jour au fil
// des vagues (progress JSON), puis pose un statut terminal a la
// fin (completed ou failed). Avantages :
//   - L id est connu du client des le depart : la lecture par id
//     ne renvoie plus jamais "Analyse introuvable" sur cause de
//     timeout pipeline.
//   - Le client peut basculer en polling si la connexion SSE
//     coupe : il appelle GET /api/analyses/[id]/status jusqu a
//     status='completed' puis recharge le result_json.
//   - L admin voit les jobs orphelins (status='running' depuis
//     plus de N minutes) pour nettoyage cron.
// ============================================================

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CreatePendingAnalysisInput {
  /** Nom provisoire affiche tant que extraction n a pas tourne. */
  initialCompanyName?: string | null;
  /** Nom du fichier source principal (deck) pour la liste Historique. */
  sourceFilename?: string | null;
  /** References Storage des fichiers deposes (audit + cleanup futur). */
  uploadedFiles?: Array<{
    storagePath: string;
    name: string;
    mimeType: string;
    size: number;
  }>;
  /**
   * Mode gele (corpus ingestion, replay deterministe). false par defaut.
   * Le flag est aussi propage aux moteurs et au version stamp ; on le
   * persiste sur la ligne analyses pour permettre de filtrer le bassin
   * corpus sans rejoindre prediction_records.
   */
  frozen?: boolean;
  /**
   * Date de provenance du deck (ISO date YYYY-MM-DD). Pour le flux courant,
   * absente. Pour le corpus, c est la date de reception du dossier.
   */
  asOf?: string | null;
}

/**
 * Cree une ligne d analyse en statut 'running' au tout debut du
 * pipeline. Retourne l id assigne par Postgres. Si la persistence
 * est desactivee, retourne null (la route appelante doit alors
 * refuser de demarrer le pipeline parce que le polling n a aucun
 * moyen de fonctionner sans base).
 */
export async function createPendingAnalysis(
  input: CreatePendingAnalysisInput,
): Promise<string | null> {
  if (!isPersistenceEnabled()) return null;
  try {
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) {
      console.warn('[analysis-store] createPendingAnalysis : pas de user');
      return null;
    }
    const supabase = getClient(useAdminClient);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        company_name: input.initialCompanyName || '(analyse en cours)',
        verdict: null,
        result_json: null,
        status: 'running',
        progress: { stage: 'started', engines: {} },
        started_at: now,
        source_filename: input.sourceFilename || null,
        uploaded_files: input.uploadedFiles || [],
        // Provenance corpus. Defauts inoffensifs pour le flux courant :
        // frozen=false (web search inchange), as_of=null (pas de date
        // de reception). La migration reference_dossiers ajoute ces
        // deux colonnes en NOT NULL DEFAULT false / NULL.
        frozen: input.frozen === true,
        as_of: input.asOf || null,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[analysis-store] createPendingAnalysis erreur :', error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.error('[analysis-store] createPendingAnalysis exception :', err);
    return null;
  }
}

/**
 * Met a jour la progression d une analyse en cours. Patch shallow :
 * seules les cles fournies sont ecrites. companyName et metadata
 * sont remplis des que extraction a tourne, pour que la liste
 * Historique affiche le nom reel sans attendre la fin du pipeline.
 */
export interface UpdateAnalysisProgressInput {
  companyName?: string | null;
  sector?: string | null;
  subSector?: string | null;
  country?: string | null;
  geographicHub?: string | null;
  yearFounded?: number | null;
  roundType?: string | null;
  roundAmountEur?: number | null;
  /** Snapshot des etats moteurs pour reprise apres coupure SSE. */
  progress?: any;
}

export async function updateAnalysisProgress(
  analysisId: string,
  input: UpdateAnalysisProgressInput,
): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  try {
    const { useAdminClient } = await resolveUserContext();
    const supabase = getClient(useAdminClient);
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.companyName !== undefined) patch.company_name = input.companyName;
    if (input.sector !== undefined) patch.sector = input.sector;
    if (input.subSector !== undefined) patch.sub_sector = input.subSector;
    if (input.country !== undefined) patch.country = input.country;
    if (input.geographicHub !== undefined) patch.geographic_hub = input.geographicHub;
    if (input.yearFounded !== undefined) patch.year_founded = input.yearFounded;
    if (input.roundType !== undefined) patch.round_type = input.roundType;
    if (input.roundAmountEur !== undefined) patch.round_amount_eur = input.roundAmountEur;
    if (input.progress !== undefined) patch.progress = input.progress;
    const { error } = await supabase.from('analyses').update(patch).eq('id', analysisId);
    if (error) {
      console.warn('[analysis-store] updateAnalysisProgress erreur :', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[analysis-store] updateAnalysisProgress exception :', err);
    return false;
  }
}

/**
 * Pose le statut terminal succes : ecrit result_json complet,
 * metadata extraites, verdict, scores, et passe status='completed'.
 * C est cette ecriture qui rend l analyse consultable en lecture
 * pleine. Avant elle, le polling ne voit que status='running'.
 */
export async function markAnalysisCompleted(
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
        result_json: normalizeResultJsonForPersistence(input.resultJson),
        has_bloc2: computeHasBloc2(input.resultJson),
        source_text: input.sourceText,
        source_filename: input.sourceFilename,
        source_pages: input.sourcePages,
        pipeline_duration_ms: input.pipelineDurationMs,
        pipeline_engines_status: input.pipelineEnginesStatus,
        status: input.runStatus || 'completed',
        completed_at: new Date().toISOString(),
        error_message: input.runErrorMessage ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
    if (error) {
      console.error('[analysis-store] markAnalysisCompleted erreur :', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[analysis-store] markAnalysisCompleted exception :', err);
    return false;
  }
}

/**
 * Pose le statut terminal erreur. Permet a l UI de differencier
 * une analyse perdue (jamais creee) d une analyse plantee (creee
 * mais avec error_message rempli) et d offrir un rejeu sur la
 * meme ligne plutot que la creation d un nouveau dossier homonyme.
 */
export async function markAnalysisFailed(
  analysisId: string,
  errorMessage: string,
): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  try {
    const { useAdminClient } = await resolveUserContext();
    const supabase = getClient(useAdminClient);
    const { error } = await supabase
      .from('analyses')
      .update({
        status: 'failed',
        error_message: (errorMessage || 'unknown').slice(0, 2000),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
    if (error) {
      console.error('[analysis-store] markAnalysisFailed erreur :', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[analysis-store] markAnalysisFailed exception :', err);
    return false;
  }
}

// ============================================================
// CLEANUP DES ANALYSES ORPHELINES
// ------------------------------------------------------------
// Le pipeline cree une ligne en status='running' au demarrage et
// pose un statut terminal (completed ou failed) en sortie. Si le
// runtime meurt entre les deux (timeout Vercel 800s, kill process,
// exception non catchee, deconnexion Supabase lors du markFailed),
// la ligne reste indefiniment en 'running'. Un cron quotidien
// balaie ces orphelins et les bascule en 'failed' avec un message
// explicite. Sans ce nettoyage, l Historique s empoisonne de
// dossiers fantomes que rien ne clot.
// ============================================================

export interface StaleRunningRow {
  id: string;
  userId: string;
  companyName: string;
  startedAt: string | null;
  updatedAt: string;
}

/**
 * Balaie toutes les analyses coincees en status='running' dont le
 * dernier updated_at est plus ancien que thresholdMinutes. Retourne
 * la liste avant bascule pour permettre le logging cote appelant.
 * Passe par le client admin (service_role) parce que le cron n a
 * pas de contexte user.
 */
export async function listStaleRunningAnalyses(
  thresholdMinutes: number,
): Promise<StaleRunningRow[]> {
  if (!isPersistenceEnabled()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000).toISOString();
    const { data, error } = await supabase
      .from('analyses')
      .select('id, user_id, company_name, started_at, updated_at')
      .eq('status', 'running')
      .lt('updated_at', cutoff)
      .order('updated_at', { ascending: true })
      .limit(500);
    if (error) {
      console.error('[analysis-store] listStaleRunningAnalyses erreur :', error);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      companyName: row.company_name || '(sans nom)',
      startedAt: row.started_at || null,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error('[analysis-store] listStaleRunningAnalyses exception :', err);
    return [];
  }
}

/**
 * Bascule en 'failed' toutes les analyses running dont updated_at
 * est anterieur au seuil. Utilise pour le cron cleanup-stale-running.
 * Retourne le nombre de lignes basculees. Message d erreur explicite
 * pour differencier ces failures des erreurs metier.
 */
export async function markStaleRunningAsFailed(
  thresholdMinutes: number,
): Promise<{ swept: number; ids: string[] }> {
  if (!isPersistenceEnabled()) return { swept: 0, ids: [] };
  const stale = await listStaleRunningAnalyses(thresholdMinutes);
  if (stale.length === 0) return { swept: 0, ids: [] };
  const message =
    `Analyse coincee en running depuis plus de ${thresholdMinutes} minutes, ` +
    'basculee automatiquement en failed par le cron cleanup-stale-running. ' +
    'Le pipeline a probablement subi un timeout runtime (Vercel 800s) ou ' +
    'un kill process, sans possibilite de poser le statut terminal.';
  try {
    const supabase = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000).toISOString();
    const { data, error } = await supabase
      .from('analyses')
      .update({
        status: 'failed',
        error_message: message.slice(0, 2000),
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('status', 'running')
      .lt('updated_at', cutoff)
      .select('id');
    if (error) {
      console.error('[analysis-store] markStaleRunningAsFailed erreur :', error);
      return { swept: 0, ids: [] };
    }
    const ids = (data || []).map((row: any) => row.id).filter(Boolean);
    return { swept: ids.length, ids };
  } catch (err) {
    console.error('[analysis-store] markStaleRunningAsFailed exception :', err);
    return { swept: 0, ids: [] };
  }
}

/**
 * Lecture legere pour le polling cote client : retourne status,
 * progress, companyName et verdict sans charger result_json.
 * Vise a etre appele toutes les 2 a 5 secondes par la page de
 * resultat tant que status n est pas terminal.
 */
export interface AnalysisStatusSnapshot {
  id: string;
  status: AnalysisStatus;
  progress: any;
  companyName: string;
  verdict: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export async function getAnalysisStatus(
  analysisId: string,
): Promise<AnalysisStatusSnapshot | null> {
  if (!isPersistenceEnabled()) return null;
  try {
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return null;
    const supabase = getClient(useAdminClient);
    const { data, error } = await supabase
      .from('analyses')
      .select(
        'id, status, progress, company_name, verdict, error_message, started_at, completed_at, updated_at, user_id',
      )
      .eq('id', analysisId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      if ((error as any).code !== 'PGRST116') {
        console.warn('[analysis-store] getAnalysisStatus erreur :', error);
      }
      return null;
    }
    if (!data) return null;
    return {
      id: data.id,
      status: (data.status || 'running') as AnalysisStatus,
      progress: data.progress || null,
      companyName: data.company_name,
      verdict: data.verdict || null,
      errorMessage: data.error_message || null,
      startedAt: data.started_at || null,
      completedAt: data.completed_at || null,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.warn('[analysis-store] getAnalysisStatus exception :', err);
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
        contrarian_score, coherence_score, user_notes, has_bloc2,
        in_portfolio, source_filename, status, pipeline_engines_status,
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
// PORTFOLIO TAG
// ------------------------------------------------------------
// Bascule le flag in_portfolio sur un dossier. Le booleen pilote
// l eligibilite du dossier au cron de re-analyse automatique tous
// les six mois et au dispatch des alertes de trajectoire vers le
// partner proprietaire. Voir supabase-in-portfolio-schema.sql et
// lib/cron/portfolio-reanalysis-selector.ts pour la doctrine.
// ============================================================

export async function setAnalysisPortfolioFlag(
  id: string,
  inPortfolio: boolean,
): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;

  try {
    const { userId, useAdminClient } = await resolveUserContext();
    if (!userId) return false;
    const supabase = getClient(useAdminClient);

    const { error } = await supabase
      .from('analyses')
      .update({ in_portfolio: inPortfolio })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[analysis-store] setAnalysisPortfolioFlag erreur :', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[analysis-store] setAnalysisPortfolioFlag exception :', err);
    return false;
  }
}

/**
 * Liste les dossiers in-portfolio de tous les users (mode admin
 * cron). Sert au selecteur d eligibilite pour la re-analyse auto :
 * on charge la liste plate, on enrichit avec le dernier snapshot
 * trajectoire, on filtre par anciennete. Bypasse RLS via le client
 * admin parce que le cron doit voir tous les fonds.
 *
 * Retourne le minimum necessaire au selecteur : id, user_id,
 * company_name, source_text (pour la re-analyse), updated_at. Le
 * cron n a pas besoin du result_json complet ici, il le chargera
 * a la demande pour chaque dossier qu il decide de re-instruire.
 */
export interface PortfolioCandidate {
  id: string;
  userId: string;
  companyName: string;
  inPortfolio: boolean;
  /** Date de creation initiale du dossier. */
  createdAt: string;
}

export async function listAllInPortfolioAnalyses(): Promise<PortfolioCandidate[]> {
  if (!isPersistenceEnabled()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('analyses')
      .select('id, user_id, company_name, in_portfolio, created_at')
      .eq('in_portfolio', true);

    if (error) {
      console.error('[analysis-store] listAllInPortfolioAnalyses erreur :', error);
      return [];
    }
    return (data || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      companyName: r.company_name,
      inPortfolio: r.in_portfolio === true,
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error('[analysis-store] listAllInPortfolioAnalyses exception :', err);
    return [];
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
    hasBloc2: row.has_bloc2 === true,
    inPortfolio: row.in_portfolio === true,
    sourceFilename: row.source_filename ?? null,
    status: row.status ?? null,
    // Count deterministe cote serveur pour ne pas transporter le JSONB
    // brut au client. Somme des statuts failed, failed-upstream, timeout,
    // empty_output. null preserve la distinction "pas mesure" contre "zero".
    failedEnginesCount: countFailedEngines(row.pipeline_engines_status),
  };
}

/**
 * Compte les moteurs dont le statut denonce une lacune : failed (incident
 * SDK reel), failed-upstream (cascade), timeout (deadline externe),
 * empty_output (moteur a repondu null ou sans champ minimal). Doit
 * rester coherent avec GAP_STATUSES de engine-status-recorder.ts.
 * Retourne null si pipeline_engines_status n est pas renseigne, ce qui
 * signifie que le run est anterieur a la brique 3 et qu on n a pas de
 * releve fiable a exposer.
 */
function countFailedEngines(pipelineEnginesStatus: any): number | null {
  if (!pipelineEnginesStatus || typeof pipelineEnginesStatus !== 'object') {
    return null;
  }
  let count = 0;
  for (const entry of Object.values(pipelineEnginesStatus)) {
    const status = (entry as any)?.status;
    if (status === 'failed' || status === 'failed-upstream' || status === 'timeout' || status === 'empty_output') {
      count++;
    }
  }
  return count;
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

