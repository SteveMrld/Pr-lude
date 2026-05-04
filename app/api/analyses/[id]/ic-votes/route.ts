// ============================================================
// GET    /api/analyses/[id]/ic-votes  -> liste les votes du comite
// POST   /api/analyses/[id]/ic-votes  -> enregistre/modifie son vote
// DELETE /api/analyses/[id]/ic-votes  -> retire son vote
//
// En mode solo (ENABLE_AUTH=false), GET fonctionne mais POST refuse :
// la notion de vote multi-membres n a pas de sens sans equipe.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listIcVotes,
  upsertIcVote,
  deleteIcVote,
  IC_VOTE_OPTIONS,
  type IcVoteOption,
} from '@/lib/ic-votes-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ enabled: false, votes: [] });
  }
  const votes = await listIcVotes(params.id);
  return NextResponse.json({ enabled: true, votes });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'auth-required', detail: 'Le vote IC necessite un compte fonds.' },
      { status: 403 },
    );
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const voteOption = body?.voteOption as IcVoteOption;
  if (!voteOption || !IC_VOTE_OPTIONS.includes(voteOption)) {
    return NextResponse.json({ error: 'invalid-option' }, { status: 400 });
  }

  const result = await upsertIcVote({
    analysisId: params.id,
    userId: ctx.user.id,
    voteOption,
    comment: typeof body?.comment === 'string' ? body.comment : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'upsert-failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await deleteIcVote({ analysisId: params.id, userId: ctx.user.id });
  if (!result.ok) {
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
