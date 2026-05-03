// ============================================================
// PATCH /api/analyses/[id]/annotations/[annotationId]
//   -> marque une annotation comme resolue
// DELETE /api/analyses/[id]/annotations/[annotationId]
//   -> supprime une annotation (auteur ou admin org)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { resolveAnnotation, deleteAnnotation as removeAnnotation } from '@/lib/collaboration-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string; annotationId: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ok = await resolveAnnotation(params.annotationId, ctx.user.id);
  if (!ok) {
    return NextResponse.json({ error: 'resolve-failed' }, { status: 500 });
  }
  return NextResponse.json({ resolved: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; annotationId: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ok = await removeAnnotation(params.annotationId);
  if (!ok) {
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
