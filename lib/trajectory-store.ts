// ============================================================
// PRELUDE - Trajectory Store
// ------------------------------------------------------------
// Lectures et ecritures sur la table trajectory_snapshots, vue
// denormalisee de l historique d analyses pour les requetes de
// monitoring portfolio. L ecriture principale est gerée par le
// trigger Postgres write_trajectory_snapshot_from_version qui
// projette automatiquement chaque insertion dans analyses_versions
// vers une ligne trajectory_snapshots. Ce module TypeScript
// expose les lectures et un backfill manuel (utile pour la
// migration initiale et la reconciliation en cas d echec trigger).
//
// L atomicite de l ecriture est donc garantie au niveau base : on
// ne peut pas avoir une version sans son snapshot trajectoire (sauf
// cas degraded ou globalScore non extractible, qui est consigne).
//
// Toutes les fonctions sont safe-by-default :
//   - Si la persistence n est pas activee, retournent un objet vide
//   - Si la base est inaccessible, retournent vide et loggent
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import type { PatternId, PatternVerdict, PatternApplicability } from './engines/fragility-structurelle/types';
import type { Verdict } from './engines/score-calculator';

// ============================================================
// TYPES
// ============================================================

/**
 * Ligne projetee dans trajectory_snapshots. Correspond au format
 * de la vue denormalisee : colonnes typees pour les scores et
 * verdicts, JSONB compact pour les patterns et combinaisons.
 *
 * Cette interface est proche du TrajectorySnapshot de
 * lib/engines/trajectory/types.ts mais s en distingue : le snapshot
 * d engine porte les donnees brutes consommees par le comparator,
 * le store porte la ligne SQL avec metadonnees de persistance
 * (versionId, versionNum, userId, companyName).
 */
export interface TrajectorySnapshotRow {
  id: string;
  analysisId: string;
  versionId: string;
  versionNum: number;
  userId: string;
  companyName: string;
  analyzedAt: string;
  globalScore: number;
  verdict: Verdict;
  dimensions: {
    team: number | null;
    market: number | null;
    macro: number | null;
    financial: number | null;
    contrarian: number | null;
    vigilance: number | null;
  };
  fragiliteScore: number | null;
  fragiliteVerdict: PatternVerdict | null;
  narrativeDriftScore: number | null;
  narrativeDriftVerdict: PatternVerdict | null;
  patterns: Partial<Record<PatternId, {
    score: number;
    verdict: PatternVerdict;
    applicabilite: PatternApplicability;
  }>>;
  combinaisons: Array<{ nom: string; severite: 'attention' | 'alerte' | 'drapeau-rouge' }>;
  createdAt: string;
}

// ============================================================
// HELPERS DE MAPPING
// ============================================================

/**
 * Convertit une ligne Postgres brute (snake_case) en
 * TrajectorySnapshotRow (camelCase). Defensive : tolere les
 * valeurs absentes en stockant null ou un fallback.
 */
function rowToSnapshot(raw: any): TrajectorySnapshotRow {
  return {
    id: raw.id,
    analysisId: raw.analysis_id,
    versionId: raw.version_id,
    versionNum: raw.version_num,
    userId: raw.user_id,
    companyName: raw.company_name,
    analyzedAt: raw.analyzed_at,
    globalScore: typeof raw.global_score === 'number' ? raw.global_score : Number(raw.global_score),
    verdict: raw.verdict as Verdict,
    dimensions: {
      team: raw.dim_team !== null ? Number(raw.dim_team) : null,
      market: raw.dim_market !== null ? Number(raw.dim_market) : null,
      macro: raw.dim_macro !== null ? Number(raw.dim_macro) : null,
      financial: raw.dim_financial !== null ? Number(raw.dim_financial) : null,
      contrarian: raw.dim_contrarian !== null ? Number(raw.dim_contrarian) : null,
      vigilance: raw.dim_vigilance !== null ? Number(raw.dim_vigilance) : null,
    },
    fragiliteScore: raw.fragilite_score !== null ? Number(raw.fragilite_score) : null,
    fragiliteVerdict: (raw.fragilite_verdict ?? null) as PatternVerdict | null,
    narrativeDriftScore: raw.narrative_drift_score !== null ? Number(raw.narrative_drift_score) : null,
    narrativeDriftVerdict: (raw.narrative_drift_verdict ?? null) as PatternVerdict | null,
    patterns: parsePatternsJson(raw.patterns_json),
    combinaisons: parseCombinaisonsJson(raw.combinaisons_json),
    createdAt: raw.created_at,
  };
}

/**
 * Parse le champ jsonb patterns_json en map typee. Defensive :
 * filtre les entrees malformees plutot que d echouer.
 */
function parsePatternsJson(raw: any): TrajectorySnapshotRow['patterns'] {
  if (!raw || typeof raw !== 'object') return {};
  const out: TrajectorySnapshotRow['patterns'] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as any;
    if (v.applicabilite === 'not-applicable') {
      out[key as PatternId] = {
        score: 0,
        verdict: 'non-applicable',
        applicabilite: 'not-applicable',
      };
      continue;
    }
    if (typeof v.globalScore !== 'number') continue;
    out[key as PatternId] = {
      score: v.globalScore,
      verdict: (v.verdict ?? 'sain') as PatternVerdict,
      applicabilite: (v.applicabilite ?? 'full') as PatternApplicability,
    };
  }
  return out;
}

/**
 * Parse combinaisons_json en array typee.
 */
function parseCombinaisonsJson(raw: any): TrajectorySnapshotRow['combinaisons'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c: any) => c && typeof c.nom === 'string' && c.nom.trim().length > 0 && !!c.severite)
    .map((c: any) => ({ nom: c.nom, severite: c.severite }));
}

// ============================================================
// LECTURES
// ============================================================

/**
 * Liste tous les snapshots d un dossier dans l ordre chronologique
 * croissant. Le caller construit la chaine de trajectoire via
 * chain-builder sur cette liste.
 */
export async function listSnapshotsForAnalysis(analysisId: string): Promise<TrajectorySnapshotRow[]> {
  if (!isPersistenceEnabled()) return [];
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('trajectory_snapshots')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('analyzed_at', { ascending: true });

  if (error) {
    console.error('[trajectory-store] listSnapshotsForAnalysis error:', error);
    return [];
  }
  return (data ?? []).map(rowToSnapshot);
}

/**
 * Recupere le snapshot le plus recent d un dossier. Utile pour
 * afficher le score courant dans une vue portfolio sans charger
 * tout l historique.
 */
export async function getLatestSnapshot(analysisId: string): Promise<TrajectorySnapshotRow | null> {
  if (!isPersistenceEnabled()) return null;
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('trajectory_snapshots')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[trajectory-store] getLatestSnapshot error:', error);
    return null;
  }
  return rowToSnapshot(data);
}

/**
 * Liste les snapshots d un meme dossier identifie par company_name
 * (et user_id pour le scoping). Permet de reconstituer la
 * trajectoire meme quand un dossier a ete supprime et ré-uploade
 * (nouveau analysis_id mais meme company_name).
 */
export async function listSnapshotsByCompany(
  userId: string,
  companyName: string,
): Promise<TrajectorySnapshotRow[]> {
  if (!isPersistenceEnabled()) return [];
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('trajectory_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('company_name', companyName)
    .order('analyzed_at', { ascending: true });

  if (error) {
    console.error('[trajectory-store] listSnapshotsByCompany error:', error);
    return [];
  }
  return (data ?? []).map(rowToSnapshot);
}

/**
 * Liste les snapshots les plus recents pour chaque dossier d un
 * user. Sert la vue portfolio : "tous mes dossiers, score courant,
 * verdict courant, fragilite courante". Filtres optionnels pour
 * limiter aux verdicts qui interessent le partner.
 */
export async function listPortfolioLatestSnapshots(
  userId: string,
  filters: {
    verdicts?: Verdict[];
    fragiliteVerdicts?: PatternVerdict[];
  } = {},
): Promise<TrajectorySnapshotRow[]> {
  if (!isPersistenceEnabled()) return [];
  const admin = getSupabaseAdminClient();

  // Sous-requete : pour chaque analysis_id, prendre la version
  // la plus recente. On utilise DISTINCT ON cote SQL via une vue
  // intermediaire. Cote PostgREST, on contourne en chargeant tous
  // les snapshots puis en filtrant cote applicatif. C est viable
  // jusqu a quelques milliers de dossiers par user, au-dela on
  // ajoutera une vue Postgres dediee.
  let query = admin
    .from('trajectory_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('analyzed_at', { ascending: false });

  if (filters.verdicts && filters.verdicts.length > 0) {
    query = query.in('verdict', filters.verdicts);
  }
  if (filters.fragiliteVerdicts && filters.fragiliteVerdicts.length > 0) {
    query = query.in('fragilite_verdict', filters.fragiliteVerdicts);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[trajectory-store] listPortfolioLatestSnapshots error:', error);
    return [];
  }

  // Deduplication cote applicatif : garder le plus recent par
  // analysis_id. Comme on a ordonne desc, on prend le premier vu.
  const seen = new Set<string>();
  const out: TrajectorySnapshotRow[] = [];
  for (const raw of data ?? []) {
    if (seen.has(raw.analysis_id)) continue;
    seen.add(raw.analysis_id);
    out.push(rowToSnapshot(raw));
  }
  return out;
}

// ============================================================
// BACKFILL
// ============================================================

/**
 * Re-projette toutes les analyses_versions vers
 * trajectory_snapshots. Utile pour la migration initiale (versions
 * creees avant l existence du trigger) et la reconciliation. Delegue
 * a la fonction Postgres backfill_trajectory_snapshots qui execute
 * la projection en SQL.
 *
 * Retourne le nombre de lignes nouvellement projetees. Les lignes
 * deja presentes en base ne sont pas touchees (la fonction Postgres
 * filtre via NOT EXISTS sur version_id).
 *
 * Si analysisId est fourni, le backfill se limite a ce dossier.
 */
export async function backfillTrajectorySnapshots(
  analysisId?: string,
): Promise<number> {
  if (!isPersistenceEnabled()) return 0;
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin.rpc('backfill_trajectory_snapshots', {
    p_analysis_id: analysisId ?? null,
  });

  if (error) {
    console.error('[trajectory-store] backfillTrajectorySnapshots error:', error);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}

// ============================================================
// EXPORTS UTILITAIRES
// ============================================================

export { rowToSnapshot as __testRowToSnapshot };
export { parsePatternsJson as __testParsePatternsJson };
export { parseCombinaisonsJson as __testParseCombinaisonsJson };
