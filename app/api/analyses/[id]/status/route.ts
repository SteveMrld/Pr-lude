// ============================================================
// GET /api/analyses/[id]/status   -> stage actuel + historique
// PATCH /api/analyses/[id]/status -> change le stage du dossier
//
// En mode solo (ENABLE_AUTH=false), GET fonctionne mais PATCH refuse :
// la notion de stage partage entre membres n a pas de sens sans equipe.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkflowStatus,
  setWorkflowStage,
  getWorkflowHistory,
  WORKFLOW_STAGES,
  type WorkflowStage,
} from '@/lib/collaboration-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const status = await getWorkflowStatus(params.id);
  const history = await getWorkflowHistory(params.id);
  return NextResponse.json({ status, history });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'auth-required', detail: 'Le workflow multi-stade necessite un compte fonds.' },
      { status: 403 },
    );
  }

  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const stage = body?.stage as WorkflowStage;
  if (!stage || !WORKFLOW_STAGES.includes(stage)) {
    return NextResponse.json({ error: 'invalid-stage' }, { status: 400 });
  }

  const comment = typeof body?.comment === 'string' ? body.comment : undefined;

  const ok = await setWorkflowStage(params.id, stage, ctx.user.id, comment);
  if (!ok) {
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }
  return NextResponse.json({ updated: true, stage });
}
