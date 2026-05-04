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
import { isPersistenceEnabled, getAnalysis } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, getCurrentOrganization, canEdit } from '@/lib/auth';
import { notifyIcVoteQuorum } from '@/lib/slack-store';

export const runtime = 'nodejs';
export const maxDuration = 15;

// Seuil de quorum pour declencher la notification Slack consolidee.
// Une fois ce nombre de votes atteint, le canal recoit un message
// avec le breakdown des positions. Notifie une seule fois par dossier.
const IC_QUORUM_THRESHOLD = 3;

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
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'Le vote IC est reserve aux membres editeurs.' },
      { status: 403 },
    );
  }

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

  // Notification quorum : si le nombre total de votes atteint le seuil,
  // on poste une notif Slack consolidee. notifyIcVoteQuorum gere lui-meme
  // l anti-doublon en consultant slack_notifications_log. Best effort,
  // ne fait pas echouer la requete si le post Slack tombe.
  try {
    const allVotes = await listIcVotes(params.id);
    if (allVotes.length >= IC_QUORUM_THRESHOLD) {
      const org = await getCurrentOrganization(ctx.user.id);
      if (org) {
        const analysis = await getAnalysis(params.id);
        if (analysis) {
          const baseUrl = req.headers.get('origin')
            || `https://${req.headers.get('host')}`
            || 'https://pr-lude.vercel.app';
          await notifyIcVoteQuorum({
            organizationId: org.id,
            analysisId: params.id,
            companyName: analysis.companyName,
            votes: allVotes.map((v) => ({
              userEmail: v.userEmail,
              voteOption: v.voteOption,
            })),
            baseUrl,
            quorumThreshold: IC_QUORUM_THRESHOLD,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[ic-votes] notify quorum failed (non-fatal):', err);
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
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'Le vote IC est reserve aux membres editeurs.' },
      { status: 403 },
    );
  }

  const result = await deleteIcVote({ analysisId: params.id, userId: ctx.user.id });
  if (!result.ok) {
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
