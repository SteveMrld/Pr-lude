// ============================================================
// PATCH  /api/analyses/[id]/reference-call-notes/[noteId]
// DELETE /api/analyses/[id]/reference-call-notes/[noteId]
//
// Permet a l auteur de modifier ou supprimer sa propre note.
// La RLS Supabase contraint cette regle au niveau base de donnees
// (les routes ne font qu une couche de validation).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  updateReferenceCallNote,
  deleteReferenceCallNote,
  CALL_CATEGORIES,
  OVERALL_TONES,
  type CallCategory,
  type OverallTone,
} from '@/lib/reference-call-notes-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; noteId: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  if (body?.callCategory && !CALL_CATEGORIES.includes(body.callCategory as CallCategory)) {
    return NextResponse.json({ error: 'invalid-category' }, { status: 400 });
  }
  if (body?.overallTone && !OVERALL_TONES.includes(body.overallTone as OverallTone)) {
    return NextResponse.json({ error: 'invalid-tone' }, { status: 400 });
  }

  const result = await updateReferenceCallNote(params.noteId, ctx.user.id, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'update-failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; noteId: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const result = await deleteReferenceCallNote(params.noteId, ctx.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
