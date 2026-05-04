// ============================================================
// IC VOTES STORE
// ------------------------------------------------------------
// CRUD des votes du comite d investissement. Un user vote une
// fois par dossier, peut changer son vote (upsert sur la
// contrainte UNIQUE(analysis_id, user_id)). Le compte ne se
// fait pas en base : on retourne tous les votes du dossier et
// l UI consolide cote client.
//
// Les votes sont enrichis a la lecture du email du user (pour
// pouvoir afficher Voted by jane@fund.com cote UI sans avoir
// besoin d un join cote serveur sur auth.users).
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { isPersistenceEnabled } from '@/lib/analysis-store';

export type IcVoteOption = 'investir' | 'investir-conditions' | 'approfondir' | 'refuser';

export const IC_VOTE_OPTIONS: IcVoteOption[] = [
  'investir',
  'investir-conditions',
  'approfondir',
  'refuser',
];

export interface IcVote {
  id: string;
  analysisId: string;
  userId: string;
  userEmail: string | null;
  voteOption: IcVoteOption;
  comment: string | null;
  votedAt: string;
}

export async function listIcVotes(analysisId: string): Promise<IcVote[]> {
  if (!isPersistenceEnabled()) return [];
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('analyses_ic_votes')
      .select('id, analysis_id, user_id, vote_option, comment, voted_at')
      .eq('analysis_id', analysisId)
      .order('voted_at', { ascending: true });

    if (error || !data) {
      if (error) console.warn('[ic-votes] listIcVotes error:', error);
      return [];
    }

    // Enrichir avec emails. Best effort : si auth.admin n est pas
    // disponible, on retourne les votes sans email.
    const userIds = Array.from(new Set(data.map((v: any) => v.user_id)));
    const emailMap = new Map<string, string>();
    try {
      // Recupere les emails un par un (acceptable pour un comite
      // de 5-15 membres, pas pour des listes massives).
      for (const uid of userIds) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) emailMap.set(uid, u.user.email);
      }
    } catch (err) {
      console.warn('[ic-votes] enrich emails failed (non-fatal):', err);
    }

    return data.map((row: any) => ({
      id: row.id,
      analysisId: row.analysis_id,
      userId: row.user_id,
      userEmail: emailMap.get(row.user_id) || null,
      voteOption: row.vote_option,
      comment: row.comment,
      votedAt: row.voted_at,
    }));
  } catch (err) {
    console.error('[ic-votes] listIcVotes exception:', err);
    return [];
  }
}

export async function upsertIcVote(params: {
  analysisId: string;
  userId: string;
  voteOption: IcVoteOption;
  comment?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isPersistenceEnabled()) return { ok: false, error: 'persistence-disabled' };
  if (!IC_VOTE_OPTIONS.includes(params.voteOption)) {
    return { ok: false, error: 'invalid-option' };
  }

  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from('analyses_ic_votes')
      .upsert({
        analysis_id: params.analysisId,
        user_id: params.userId,
        vote_option: params.voteOption,
        comment: params.comment ?? null,
        voted_at: new Date().toISOString(),
      }, { onConflict: 'analysis_id,user_id' });

    if (error) {
      console.error('[ic-votes] upsert error:', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[ic-votes] upsert exception:', err);
    return { ok: false, error: err?.message || 'unknown' };
  }
}

export async function deleteIcVote(params: {
  analysisId: string;
  userId: string;
}): Promise<{ ok: boolean }> {
  if (!isPersistenceEnabled()) return { ok: false };
  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from('analyses_ic_votes')
      .delete()
      .eq('analysis_id', params.analysisId)
      .eq('user_id', params.userId);
    if (error) {
      console.error('[ic-votes] delete error:', error);
      return { ok: false };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
