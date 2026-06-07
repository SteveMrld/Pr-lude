import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Pilier preuve, brique reconciliation et calibration.
 * --------------------------------------------------
 * Issue de marche reelle d un dossier (alive / exit / fail / flat),
 * decouplee de la decision du fonds (qui vit dans realized_outcomes).
 * Cette table est ce qui permet de cloturer la boucle prediction
 * vs realite : un dossier resolu (exit ou fail) est calibrable.
 *
 * Taxonomie volontairement simple et extensible : quatre etats
 * initiaux qui couvrent l espace observable. De nouveaux etats
 * peuvent etre ajoutes par migration sans casser le code parce que
 * la couche calibration mappe explicitement chaque etat vers le
 * binaire succes/echec et ignore les etats inconnus.
 */

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// Types
// ============================================================

export type MarketOutcome = 'alive' | 'exit' | 'fail' | 'flat';

export const MARKET_OUTCOME_VALUES: MarketOutcome[] = ['alive', 'exit', 'fail', 'flat'];

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

// ============================================================
// Mapping issue -> binaire succes/echec pour calibration
// ------------------------------------------------------------
// On ne calibre que sur les dossiers explicitement resolus dans
// un sens ou dans l autre. Alive et flat sont incompletement
// resolus et sont exclus de l agregation : on ne sait pas encore
// si l investissement etait bon, donc on ne dit rien.
//
// 'exit' -> succes (1.0)
// 'fail' -> echec (0.0)
// 'alive' -> non resolu (null, exclu)
// 'flat' -> non resolu (null, exclu)
//
// Extensible : si demain on ajoute 'shutdown_voluntary' ou
// 'pivot_success', il suffit de l ajouter ici. Un etat non mappe
// est traite comme non-resolu (null).
// ============================================================

export function marketOutcomeToBinary(outcome: MarketOutcome): 0 | 1 | null {
  if (outcome === 'exit') return 1;
  if (outcome === 'fail') return 0;
  // alive, flat : non resolus
  return null;
}

export function isResolvedOutcome(outcome: MarketOutcome): boolean {
  return marketOutcomeToBinary(outcome) !== null;
}
