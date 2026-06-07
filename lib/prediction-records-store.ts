import 'server-only';
import { createClient } from '@supabase/supabase-js';
import {
  type VersionStamp,
  fingerprintStamp,
} from './instrumentation/version-stamp';

/**
 * Pilier preuve, brique reconciliation et calibration.
 * --------------------------------------------------
 * Persiste les predictions de Prelude comme cliches figes au
 * moment de la sauvegarde d une analyse : verdict, score global,
 * probabilite de succes, six scores de dimension, version stamp
 * complet. C est la matiere brute qui, accumulee sur N dossiers
 * resolus, permet de calculer une calibration honnete segmentee
 * par version d instrument.
 *
 * Le record est immuable : on insert, on ne reecrit jamais. Si
 * une analyse est relancee plus tard, c est un nouveau record.
 */

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// Types
// ============================================================

export interface PredictionRecord {
  id: string;
  analysisId: string;
  userId: string;
  capturedAt: string;
  verdict: string;
  globalScore: number | null;
  successProbability: number | null;
  dimensions: {
    team: number | null;
    market: number | null;
    macro: number | null;
    financial: number | null;
    contrarian: number | null;
    vigilance: number | null;
  };
  versionStamp: VersionStamp;
  stampFingerprint: {
    commitSha: string | null;
    configsHash: string | null;
    enginesHash: string | null;
    modelsHash: string | null;
    inputsHash: string | null;
  };
  schemaVersion: string;
  createdAt: string;
}

export interface PredictionRecordInput {
  analysisId: string;
  userId: string;
  verdict: string;
  globalScore: number | null;
  successProbability: number | null;
  dimensions: {
    team: number | null;
    market: number | null;
    macro: number | null;
    financial: number | null;
    contrarian: number | null;
    vigilance: number | null;
  };
  versionStamp: VersionStamp;
  capturedAt?: string;
}

// ============================================================
// Mapping ligne brute -> objet TypeScript
// ============================================================

function mapRecord(row: any): PredictionRecord {
  const num = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: row.id,
    analysisId: row.analysis_id,
    userId: row.user_id,
    capturedAt: row.captured_at,
    verdict: row.verdict,
    globalScore: num(row.global_score),
    successProbability: num(row.success_probability),
    dimensions: {
      team: num(row.dim_team),
      market: num(row.dim_market),
      macro: num(row.dim_macro),
      financial: num(row.dim_financial),
      contrarian: num(row.dim_contrarian),
      vigilance: num(row.dim_vigilance),
    },
    versionStamp: row.version_stamp,
    stampFingerprint: {
      commitSha: row.stamp_commit_sha ?? null,
      configsHash: row.stamp_configs_hash ?? null,
      enginesHash: row.stamp_engines_hash ?? null,
      modelsHash: row.stamp_models_hash ?? null,
      inputsHash: row.stamp_inputs_hash ?? null,
    },
    schemaVersion: row.schema_version,
    createdAt: row.created_at,
  };
}

// ============================================================
// Ecriture - immuable
// ============================================================

/**
 * Persiste un cliche fige de prediction. Best-effort : si la
 * couche Supabase est down, on log et on retourne null. Le
 * pipeline d analyse ne doit jamais echouer parce que la
 * reconciliation n a pas pu logger.
 */
export async function insertPredictionRecord(
  input: PredictionRecordInput,
): Promise<PredictionRecord | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const fingerprint = fingerprintStamp(input.versionStamp);

  const payload = {
    analysis_id: input.analysisId,
    user_id: input.userId,
    captured_at: input.capturedAt || new Date().toISOString(),
    verdict: input.verdict,
    global_score: input.globalScore,
    success_probability: input.successProbability,
    dim_team: input.dimensions.team,
    dim_market: input.dimensions.market,
    dim_macro: input.dimensions.macro,
    dim_financial: input.dimensions.financial,
    dim_contrarian: input.dimensions.contrarian,
    dim_vigilance: input.dimensions.vigilance,
    version_stamp: input.versionStamp,
    stamp_commit_sha: fingerprint.commitSha,
    stamp_configs_hash: fingerprint.configsHash,
    stamp_engines_hash: fingerprint.enginesHash,
    stamp_models_hash: fingerprint.modelsHash,
    stamp_inputs_hash: fingerprint.inputsHash,
    schema_version: input.versionStamp.schemaVersion,
  };

  const { data, error } = await admin
    .from('prediction_records')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[prediction-records] insert error', error);
    return null;
  }
  return mapRecord(data);
}

// ============================================================
// Ecriture - records legacy backfilles
// ------------------------------------------------------------
// Variante reservee au script de backfill des analyses historiques
// (cf scripts/backfill-prediction-records.ts). Accepte un fingerprint
// explicite plutot que de le calculer depuis un version stamp reel :
// les analyses pre-brique-reconciliation n ont pas de stamp, et on
// veut que le segment legacy soit strictement separable du segment
// courant en SQL.
//
// La payload version_stamp est un objet libre, pas un VersionStamp
// canonique. La couche de calibration sait segmenter sur les colonnes
// stamp_* peu importe ce qui est dans le jsonb.
// ============================================================

export interface LegacyPredictionRecordInput {
  analysisId: string;
  userId: string;
  capturedAt: string;
  verdict: string;
  globalScore: number | null;
  successProbability: number | null;
  dimensions: {
    team: number | null;
    market: number | null;
    macro: number | null;
    financial: number | null;
    contrarian: number | null;
    vigilance: number | null;
  };
  /** Stamp arbitraire serialise en jsonb. Le script backfill y met
   *  un objet { legacy: true, backfilledAt, sourceAnalysisId, ... }. */
  legacyStamp: Record<string, any>;
  /** Fingerprint explicite, ecrit tel quel sur les colonnes stamp_*.
   *  Pour le backfill, le quartet identique pour tous les records :
   *    commitSha: 'legacy-pre-a259c0d', configsHash/enginesHash/
   *    modelsHash: 'legacy'. L inputs_hash est differencie par
   *    analysisId pour preserver l unicite du tuple. */
  fingerprint: {
    commitSha: string | null;
    configsHash: string | null;
    enginesHash: string | null;
    modelsHash: string | null;
    inputsHash: string | null;
  };
  /** schemaVersion du stamp. Pour les legacy, 'legacy-v1'. */
  schemaVersion: string;
}

export async function insertLegacyPredictionRecord(
  input: LegacyPredictionRecordInput,
): Promise<PredictionRecord | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const payload = {
    analysis_id: input.analysisId,
    user_id: input.userId,
    captured_at: input.capturedAt,
    verdict: input.verdict,
    global_score: input.globalScore,
    success_probability: input.successProbability,
    dim_team: input.dimensions.team,
    dim_market: input.dimensions.market,
    dim_macro: input.dimensions.macro,
    dim_financial: input.dimensions.financial,
    dim_contrarian: input.dimensions.contrarian,
    dim_vigilance: input.dimensions.vigilance,
    version_stamp: input.legacyStamp,
    stamp_commit_sha: input.fingerprint.commitSha,
    stamp_configs_hash: input.fingerprint.configsHash,
    stamp_engines_hash: input.fingerprint.enginesHash,
    stamp_models_hash: input.fingerprint.modelsHash,
    stamp_inputs_hash: input.fingerprint.inputsHash,
    schema_version: input.schemaVersion,
  };

  const { data, error } = await admin
    .from('prediction_records')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[prediction-records] legacy insert error', error);
    return null;
  }
  return mapRecord(data);
}

// ============================================================
// Lecture - granulaire
// ============================================================

export async function listPredictionRecordsForAnalysis(
  analysisId: string,
  userId: string,
): Promise<PredictionRecord[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from('prediction_records')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('user_id', userId)
    .order('captured_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('[prediction-records] list error', error);
    return [];
  }
  return data.map(mapRecord);
}

export async function getLatestPredictionRecord(
  analysisId: string,
  userId: string,
): Promise<PredictionRecord | null> {
  const records = await listPredictionRecordsForAnalysis(analysisId, userId);
  return records[0] || null;
}

// ============================================================
// Lecture en bulk pour calibration
// ------------------------------------------------------------
// Pour calculer la courbe de calibration, on a besoin de tous
// les records d un user (ou de tout le systeme en mode admin).
// La couche calibration filtre ensuite par version et par
// disponibilite d une issue resolue.
// ============================================================

export interface ListAllOptions {
  userId?: string;
  /** Limite optionnelle (defaut 1000, pour eviter de charger des
   *  millions de records si le bassin grandit). */
  limit?: number;
}

export async function listAllPredictionRecords(
  opts: ListAllOptions = {},
): Promise<PredictionRecord[]> {
  const admin = getAdmin();
  if (!admin) return [];
  let query = admin.from('prediction_records').select('*');
  if (opts.userId) query = query.eq('user_id', opts.userId);
  query = query.order('captured_at', { ascending: false }).limit(opts.limit ?? 1000);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error('[prediction-records] listAll error', error);
    return [];
  }
  return data.map(mapRecord);
}
