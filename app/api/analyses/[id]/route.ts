// ============================================================
// GET /api/analyses/[id]      -> recupere l analyse complete
// DELETE /api/analyses/[id]   -> supprime
// PATCH /api/analyses/[id]    -> met a jour les notes utilisateur
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, deleteAnalysis, updateAnalysisNotes, isPersistenceEnabled } from '@/lib/analysis-store';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }

  const analysis = await getAnalysis(params.id);
  if (!analysis) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  return NextResponse.json({ analysis });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }

  const ok = await deleteAnalysis(params.id);
  if (!ok) {
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  if (typeof body?.userNotes !== 'string') {
    return NextResponse.json({ error: 'missing-userNotes' }, { status: 400 });
  }

  const ok = await updateAnalysisNotes(params.id, body.userNotes);
  if (!ok) {
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }
  return NextResponse.json({ updated: true });
}
