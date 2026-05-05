// ============================================================
// /api/analyses/[id]/milestones/[milestoneId] - delete
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { deleteMilestone } from '@/lib/reconciliation-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const { milestoneId } = await params;
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
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const ok = await deleteMilestone(milestoneId, ctx.user.id);
  return NextResponse.json({ ok });
}
