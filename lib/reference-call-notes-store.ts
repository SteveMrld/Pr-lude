// ============================================================
// REFERENCE CALL NOTES STORE
// ------------------------------------------------------------
// CRUD des notes d appels de reference + cache de la synthese
// agregee. La synthese est generee par reference-aggregation
// engine et invalidee automatiquement a chaque mutation.
//
// Le tri se fait par date de creation desc (les derniers calls
// remontent en premier dans l UI).
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import type { ReferenceAggregationOutput } from '@/lib/engines/reference-aggregation-engine';

export type CallCategory =
  | 'founder_superior'
  | 'founder_peer'
  | 'founder_subordinate'
  | 'customer'
  | 'board_advisor'
  | 'weak_signal'
  | 'other';

export const CALL_CATEGORIES: CallCategory[] = [
  'founder_superior',
  'founder_peer',
  'founder_subordinate',
  'customer',
  'board_advisor',
  'weak_signal',
  'other',
];

export const CALL_CATEGORY_LABELS: Record<CallCategory, string> = {
  founder_superior: 'Ancien superieur du fondateur',
  founder_peer: 'Ancien pair du fondateur',
  founder_subordinate: 'Ancien subordonne du fondateur',
  customer: 'Client / utilisateur cle',
  board_advisor: 'Board / advisor',
  weak_signal: 'Verification signal faible',
  other: 'Autre interlocuteur',
};

export type OverallTone =
  | 'tres_positif'
  | 'positif'
  | 'mitige'
  | 'negatif'
  | 'tres_negatif'
  | 'non_concluant';

export const OVERALL_TONES: OverallTone[] = [
  'tres_positif',
  'positif',
  'mitige',
  'negatif',
  'tres_negatif',
  'non_concluant',
];

export const OVERALL_TONE_LABELS: Record<OverallTone, string> = {
  tres_positif: 'Tres positif',
  positif: 'Positif',
  mitige: 'Mitige',
  negatif: 'Negatif',
  tres_negatif: 'Tres negatif',
  non_concluant: 'Non concluant',
};

export interface ReferenceCallNote {
  id: string;
  analysisId: string;
  authorId: string;
  authorEmail: string | null;
  callCategory: CallCategory;
  contactName: string;
  contactRole: string | null;
  contactCompany: string | null;
  relatedSubject: string | null;
  callDate: string | null;
  durationMinutes: number | null;
  rawNotes: string;
  overallTone: OverallTone | null;
  ratingCompetence: number | null;
  ratingIntegrity: number | null;
  ratingLeadership: number | null;
  ratingWouldWorkAgain: number | null;
  createdAt: string;
  updatedAt: string;
}

function rowToNote(row: any, emailMap?: Map<string, string>): ReferenceCallNote {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    authorId: row.author_id,
    authorEmail: emailMap?.get(row.author_id) || null,
    callCategory: row.call_category,
    contactName: row.contact_name,
    contactRole: row.contact_role,
    contactCompany: row.contact_company,
    relatedSubject: row.related_subject,
    callDate: row.call_date,
    durationMinutes: row.duration_minutes,
    rawNotes: row.raw_notes,
    overallTone: row.overall_tone,
    ratingCompetence: row.rating_competence,
    ratingIntegrity: row.rating_integrity,
    ratingLeadership: row.rating_leadership,
    ratingWouldWorkAgain: row.rating_would_work_again,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listReferenceCallNotes(
  analysisId: string,
): Promise<ReferenceCallNote[]> {
  if (!isPersistenceEnabled()) return [];
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('analyses_reference_call_notes')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (error) console.warn('[ref-calls] list error:', error);
      return [];
    }

    // Enrichir avec emails (pour afficher l auteur dans l UI).
    const userIds = Array.from(new Set(data.map((r: any) => r.author_id)));
    const emailMap = new Map<string, string>();
    try {
      for (const uid of userIds) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) emailMap.set(uid, u.user.email);
      }
    } catch (err) {
      console.warn('[ref-calls] email enrich failed (non-fatal):', err);
    }

    return data.map((row: any) => rowToNote(row, emailMap));
  } catch (err) {
    console.error('[ref-calls] list exception:', err);
    return [];
  }
}

export interface CreateReferenceCallNoteParams {
  analysisId: string;
  authorId: string;
  callCategory: CallCategory;
  contactName: string;
  contactRole?: string | null;
  contactCompany?: string | null;
  relatedSubject?: string | null;
  callDate?: string | null;
  durationMinutes?: number | null;
  rawNotes: string;
  overallTone?: OverallTone | null;
  ratingCompetence?: number | null;
  ratingIntegrity?: number | null;
  ratingLeadership?: number | null;
  ratingWouldWorkAgain?: number | null;
}

export async function createReferenceCallNote(
  params: CreateReferenceCallNoteParams,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isPersistenceEnabled()) return { ok: false, error: 'persistence-disabled' };
  if (!CALL_CATEGORIES.includes(params.callCategory)) {
    return { ok: false, error: 'invalid-category' };
  }
  if (!params.contactName?.trim() || !params.rawNotes?.trim()) {
    return { ok: false, error: 'missing-required-fields' };
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('analyses_reference_call_notes')
      .insert({
        analysis_id: params.analysisId,
        author_id: params.authorId,
        call_category: params.callCategory,
        contact_name: params.contactName.trim(),
        contact_role: params.contactRole?.trim() || null,
        contact_company: params.contactCompany?.trim() || null,
        related_subject: params.relatedSubject?.trim() || null,
        call_date: params.callDate || null,
        duration_minutes: params.durationMinutes || null,
        raw_notes: params.rawNotes.trim(),
        overall_tone: params.overallTone || null,
        rating_competence: params.ratingCompetence || null,
        rating_integrity: params.ratingIntegrity || null,
        rating_leadership: params.ratingLeadership || null,
        rating_would_work_again: params.ratingWouldWorkAgain || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ref-calls] insert error:', error);
      return { ok: false, error: error.message };
    }

    // Invalider le cache d agregation puisqu une nouvelle note arrive.
    await invalidateAggregation(params.analysisId);

    return { ok: true, id: data?.id };
  } catch (err: any) {
    console.error('[ref-calls] insert exception:', err);
    return { ok: false, error: err?.message || 'unknown' };
  }
}

export async function updateReferenceCallNote(
  id: string,
  authorId: string,
  patch: Partial<CreateReferenceCallNoteParams>,
): Promise<{ ok: boolean; error?: string }> {
  if (!isPersistenceEnabled()) return { ok: false, error: 'persistence-disabled' };

  try {
    const admin = getSupabaseAdminClient();
    const updateRow: any = { updated_at: new Date().toISOString() };
    if (patch.callCategory && CALL_CATEGORIES.includes(patch.callCategory)) {
      updateRow.call_category = patch.callCategory;
    }
    if (patch.contactName !== undefined) updateRow.contact_name = patch.contactName.trim();
    if (patch.contactRole !== undefined) updateRow.contact_role = patch.contactRole?.trim() || null;
    if (patch.contactCompany !== undefined) updateRow.contact_company = patch.contactCompany?.trim() || null;
    if (patch.relatedSubject !== undefined) updateRow.related_subject = patch.relatedSubject?.trim() || null;
    if (patch.callDate !== undefined) updateRow.call_date = patch.callDate || null;
    if (patch.durationMinutes !== undefined) updateRow.duration_minutes = patch.durationMinutes || null;
    if (patch.rawNotes !== undefined) updateRow.raw_notes = patch.rawNotes.trim();
    if (patch.overallTone !== undefined) updateRow.overall_tone = patch.overallTone || null;
    if (patch.ratingCompetence !== undefined) updateRow.rating_competence = patch.ratingCompetence || null;
    if (patch.ratingIntegrity !== undefined) updateRow.rating_integrity = patch.ratingIntegrity || null;
    if (patch.ratingLeadership !== undefined) updateRow.rating_leadership = patch.ratingLeadership || null;
    if (patch.ratingWouldWorkAgain !== undefined) updateRow.rating_would_work_again = patch.ratingWouldWorkAgain || null;

    const { data, error } = await admin
      .from('analyses_reference_call_notes')
      .update(updateRow)
      .eq('id', id)
      .eq('author_id', authorId)
      .select('analysis_id')
      .single();

    if (error || !data) {
      console.error('[ref-calls] update error:', error);
      return { ok: false, error: error?.message || 'not-found' };
    }

    await invalidateAggregation(data.analysis_id);
    return { ok: true };
  } catch (err: any) {
    console.error('[ref-calls] update exception:', err);
    return { ok: false, error: err?.message || 'unknown' };
  }
}

export async function deleteReferenceCallNote(
  id: string,
  authorId: string,
): Promise<{ ok: boolean }> {
  if (!isPersistenceEnabled()) return { ok: false };
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('analyses_reference_call_notes')
      .delete()
      .eq('id', id)
      .eq('author_id', authorId)
      .select('analysis_id')
      .single();

    if (error || !data) return { ok: false };
    await invalidateAggregation(data.analysis_id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ----------------------------------------------------------------
// Cache d agregation : la synthese LLM est cher a generer, on la
// stocke en jsonb avec une signature des notes pour pouvoir la
// rejouer si pertinent.
// ----------------------------------------------------------------

export interface CachedAggregation {
  notesCount: number;
  notesSignature: string;
  aggregation: ReferenceAggregationOutput;
  generatedAt: string;
}

export function buildNotesSignature(notes: ReferenceCallNote[]): string {
  // Signature deterministe : on hash les ids + updatedAt de chaque note.
  // Suffisant pour detecter qu une note a ete ajoutee, modifiee ou supprimee.
  return notes
    .map(n => `${n.id}:${n.updatedAt}`)
    .sort()
    .join('|');
}

export async function getCachedAggregation(
  analysisId: string,
): Promise<CachedAggregation | null> {
  if (!isPersistenceEnabled()) return null;
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('analyses_reference_aggregations')
      .select('notes_count, notes_signature, aggregation, generated_at')
      .eq('analysis_id', analysisId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      notesCount: data.notes_count,
      notesSignature: data.notes_signature,
      aggregation: data.aggregation as ReferenceAggregationOutput,
      generatedAt: data.generated_at,
    };
  } catch {
    return null;
  }
}

export async function saveAggregation(params: {
  analysisId: string;
  notesCount: number;
  notesSignature: string;
  aggregation: ReferenceAggregationOutput;
}): Promise<{ ok: boolean }> {
  if (!isPersistenceEnabled()) return { ok: false };
  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from('analyses_reference_aggregations')
      .upsert({
        analysis_id: params.analysisId,
        notes_count: params.notesCount,
        notes_signature: params.notesSignature,
        aggregation: params.aggregation,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'analysis_id' });
    if (error) {
      console.error('[ref-calls] save aggregation error:', error);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[ref-calls] save aggregation exception:', err);
    return { ok: false };
  }
}

export async function invalidateAggregation(analysisId: string): Promise<void> {
  if (!isPersistenceEnabled()) return;
  try {
    const admin = getSupabaseAdminClient();
    await admin
      .from('analyses_reference_aggregations')
      .delete()
      .eq('analysis_id', analysisId);
  } catch (err) {
    console.warn('[ref-calls] invalidate aggregation failed (non-fatal):', err);
  }
}
