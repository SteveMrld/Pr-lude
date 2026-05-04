// ============================================================
// IC DECISION STORE
// ------------------------------------------------------------
// CRUD du verdict final officiel d un dossier au sortir du comite.
// Materialise les 4 champs decisionnels du Pack IC page 3 :
// partner principal, date de comite, resultat du vote, conditions.
//
// Une seule ligne par analyse. Upsert sur analysis_id. La modification
// reservee aux membres editeurs (admin / member) cote Route Handler.
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import {
  IC_VOTE_RESULTS,
  IC_VOTE_RESULT_LABELS,
  type IcVoteResult,
  type IcDecision,
} from '@/lib/ic-decision-types';

export { IC_VOTE_RESULTS, IC_VOTE_RESULT_LABELS };
export type { IcVoteResult, IcDecision };

export async function getIcDecision(analysisId: string): Promise<IcDecision | null> {
  if (!isPersistenceEnabled()) return null;
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('analyses_ic_decision')
      .select('analysis_id, partner_principal, committee_date, vote_result, conditions, updated_at, updated_by')
      .eq('analysis_id', analysisId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn('[ic-decision] get error:', error);
      return null;
    }
    return {
      analysisId: data.analysis_id,
      partnerPrincipal: data.partner_principal,
      committeeDate: data.committee_date,
      voteResult: data.vote_result as IcVoteResult | null,
      conditions: data.conditions,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  } catch (err) {
    console.error('[ic-decision] get exception:', err);
    return null;
  }
}

export async function upsertIcDecision(params: {
  analysisId: string;
  partnerPrincipal?: string | null;
  committeeDate?: string | null;
  voteResult?: IcVoteResult | null;
  conditions?: string | null;
  updatedBy: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isPersistenceEnabled()) return { ok: false, error: 'persistence-disabled' };

  // Validation legere des champs presents.
  if (
    'voteResult' in params &&
    params.voteResult != null &&
    !IC_VOTE_RESULTS.includes(params.voteResult)
  ) {
    return { ok: false, error: 'invalid-vote-result' };
  }
  if (
    'committeeDate' in params &&
    params.committeeDate != null && params.committeeDate !== '' &&
    !/^\d{4}-\d{2}-\d{2}$/.test(params.committeeDate)
  ) {
    return { ok: false, error: 'invalid-date' };
  }

  try {
    const admin = getSupabaseAdminClient();

    // Lecture de l existant pour merger (patch partiel). Sans cette
    // etape, l upsert ecraserait les champs absents du patch avec null
    // a chaque sauvegarde de champ unique.
    const { data: existing } = await admin
      .from('analyses_ic_decision')
      .select('partner_principal, committee_date, vote_result, conditions')
      .eq('analysis_id', params.analysisId)
      .maybeSingle();

    const partnerPrincipal = 'partnerPrincipal' in params
      ? trimOrNull(params.partnerPrincipal, 200)
      : (existing?.partner_principal ?? null);
    const committeeDate = 'committeeDate' in params
      ? (params.committeeDate || null)
      : (existing?.committee_date ?? null);
    const voteResult = 'voteResult' in params
      ? (params.voteResult || null)
      : (existing?.vote_result ?? null);
    const conditions = 'conditions' in params
      ? trimOrNull(params.conditions, 4000)
      : (existing?.conditions ?? null);

    const { error } = await admin
      .from('analyses_ic_decision')
      .upsert({
        analysis_id: params.analysisId,
        partner_principal: partnerPrincipal,
        committee_date: committeeDate,
        vote_result: voteResult,
        conditions: conditions,
        updated_at: new Date().toISOString(),
        updated_by: params.updatedBy,
      }, { onConflict: 'analysis_id' });
    if (error) {
      console.error('[ic-decision] upsert error:', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[ic-decision] upsert exception:', err);
    return { ok: false, error: err?.message || 'unknown' };
  }
}

function trimOrNull(value: string | null | undefined, maxLen: number): string | null {
  if (value == null) return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}
