import 'server-only';
import { createClient } from '@supabase/supabase-js';
import {
  type MarketOutcome,
  MARKET_OUTCOME_VALUES,
  marketOutcomeToBinary,
  isResolvedOutcome,
} from './analysis-outcomes-taxonomy';

/**
 * Pilier preuve, brique reconciliation et calibration.
 * --------------------------------------------------
 * Issue de marche reelle d un dossier, decouplee de la decision
 * du fonds (qui vit dans realized_outcomes). Cette table cloture
 * la boucle prediction vs realite : un dossier resolu (exit,
 * alive_thriving ou fail) est calibrable.
 *
 * La taxonomie (six etats dont deux legacy) et le mapping vers
 * observed sont definis dans analysis-outcomes-taxonomy.ts, module
 * pur importable partout. Ici on ne fait que le CRUD Supabase.
 */

// Re-export de la taxonomie pour ne pas casser les consommateurs
// existants qui importent depuis ce module.
export {
  type MarketOutcome,
  MARKET_OUTCOME_VALUES,
  marketOutcomeToBinary,
  isResolvedOutcome,
};

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// Types
// ============================================================

export interface AnalysisOutcome {
  id: string;
  analysisId: string;
  userId: string;
  marketOutcome: MarketOutcome;
  observedAt: string;     // ISO date
  source: string;
  sourceUrl: string | null;
  sourceNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisOutcomeInput {
  analysisId: string;
  userId: string;
  marketOutcome: MarketOutcome;
  observedAt?: string;
  source?: string;
  sourceUrl?: string | null;
  sourceNotes?: string | null;
}

// ============================================================
// Mapping
// ============================================================

function mapOutcome(row: any): AnalysisOutcome {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    userId: row.user_id,
    marketOutcome: row.market_outcome as MarketOutcome,
    observedAt: row.observed_at,
    source: row.source || 'manual',
    sourceUrl: row.source_url,
    sourceNotes: row.source_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// CRUD
// ============================================================

export async function getAnalysisOutcome(
  analysisId: string,
  userId: string,
): Promise<AnalysisOutcome | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from('analysis_outcomes')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[analysis-outcomes] get error', error);
    return null;
  }
  return data ? mapOutcome(data) : null;
}

export async function upsertAnalysisOutcome(
  input: AnalysisOutcomeInput,
): Promise<AnalysisOutcome | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const payload = {
    analysis_id: input.analysisId,
    user_id: input.userId,
    market_outcome: input.marketOutcome,
    observed_at: input.observedAt || new Date().toISOString().slice(0, 10),
    source: input.source || 'manual',
    source_url: input.sourceUrl ?? null,
    source_notes: input.sourceNotes ?? null,
  };
  const { data, error } = await admin
    .from('analysis_outcomes')
    .upsert(payload, { onConflict: 'analysis_id' })
    .select('*')
    .single();
  if (error) {
    console.error('[analysis-outcomes] upsert error', error);
    return null;
  }
  return mapOutcome(data);
}

export async function deleteAnalysisOutcome(
  analysisId: string,
  userId: string,
): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;
  const { error } = await admin
    .from('analysis_outcomes')
    .delete()
    .eq('analysis_id', analysisId)
    .eq('user_id', userId);
  if (error) {
    console.error('[analysis-outcomes] delete error', error);
    return false;
  }
  return true;
}

export async function listAnalysisOutcomes(
  userId: string,
): Promise<AnalysisOutcome[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from('analysis_outcomes')
    .select('*')
    .eq('user_id', userId)
    .order('observed_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('[analysis-outcomes] list error', error);
    return [];
  }
  return data.map(mapOutcome);
}

// Mapping issue -> binaire, isResolvedOutcome : re-exportes ci-dessus
// depuis analysis-outcomes-taxonomy.ts.
