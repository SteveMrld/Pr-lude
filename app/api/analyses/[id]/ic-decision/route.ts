// ============================================================
// GET /api/analyses/[id]/ic-decision   -> recupere le verdict final
// PUT /api/analyses/[id]/ic-decision   -> upsert les champs decisionnels
//
// En mode solo (ENABLE_AUTH=false), GET fonctionne et retourne null si
// pas encore renseigne. PUT exige l auth + le role canEdit (admin /
// member). Les observateurs ne peuvent pas modifier le verdict officiel.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getIcDecision,
  upsertIcDecision,
  type IcVoteResult,
  IC_VOTE_RESULTS,
} from '@/lib/ic-decision-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ enabled: false, decision: null });
  }
  const decision = await getIcDecision(params.id);
  return NextResponse.json({ enabled: true, decision });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'auth-required', detail: 'La décision IC nécessite un compte fonds.' },
      { status: 403 },
    );
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'La decision IC est reservee aux membres editeurs.' },
      { status: 403 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  // Patch partiel : on ne touche que les champs explicitement presents
  // dans le body. Une cle absente = pas de modification (preserve la
  // valeur existante). Une cle = null efface explicitement le champ.
  const patch: Parameters<typeof upsertIcDecision>[0] = {
    analysisId: params.id,
    updatedBy: ctx.user.id,
  };

  if ('partnerPrincipal' in body) {
    patch.partnerPrincipal =
      typeof body.partnerPrincipal === 'string' ? body.partnerPrincipal : null;
  }
  if ('committeeDate' in body) {
    patch.committeeDate =
      typeof body.committeeDate === 'string' ? body.committeeDate : null;
  }
  if ('conditions' in body) {
    patch.conditions =
      typeof body.conditions === 'string' ? body.conditions : null;
  }
  if ('voteResult' in body) {
    if (body.voteResult && typeof body.voteResult === 'string') {
      if (!IC_VOTE_RESULTS.includes(body.voteResult as IcVoteResult)) {
        return NextResponse.json({ error: 'invalid-vote-result' }, { status: 400 });
      }
      patch.voteResult = body.voteResult as IcVoteResult;
    } else {
      patch.voteResult = null;
    }
  }

  const result = await upsertIcDecision(patch);

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'upsert-failed' }, { status: 500 });
  }

  // Re-lit pour renvoyer l etat consolide cote client.
  const decision = await getIcDecision(params.id);
  return NextResponse.json({ ok: true, decision });
}
