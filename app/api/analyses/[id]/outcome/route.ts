// ============================================================
// /api/analyses/[id]/outcome - decision finale du fonds
// ------------------------------------------------------------
// GET    : recupere la decision si elle existe
// PUT    : upsert la decision (cree ou met a jour)
// DELETE : retire la decision (et conserve les milestones)
//
// Bloc E3 - Reconciliation prediction vs reality.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import {
  getOutcomeForAnalysis,
  upsertOutcome,
  deleteOutcome,
  type Decision,
} from '@/lib/reconciliation-store';
import { isPersistenceEnabled, getAnalysis } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

const VALID_DECISIONS: Decision[] = ['invested', 'passed', 'declined', 'waitlisted'];

async function requireUser() {
  if (!isAuthEnabled()) {
    return { error: 'auth-required', status: 403 } as const;
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return { error: 'unauthorized', status: 401 } as const;
  }
  if (!canEdit(ctx.org.role)) {
    return { error: 'forbidden', status: 403 } as const;
  }
  return { ctx } as const;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Verification que l analyse appartient au user (ou son org)
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const outcome = await getOutcomeForAnalysis(id, auth.ctx.user.id);
  return NextResponse.json({ outcome });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (!body?.decision || !VALID_DECISIONS.includes(body.decision)) {
    return NextResponse.json(
      { error: 'invalid-decision', detail: `decision doit etre l un de ${VALID_DECISIONS.join(', ')}` },
      { status: 400 },
    );
  }

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  // Coercition souple des nombres (les forms HTML envoient des strings)
  const num = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const outcome = await upsertOutcome({
    analysisId: id,
    userId: auth.ctx.user.id,
    decision: body.decision,
    decisionDate: body.decisionDate || undefined,
    decisionNotes: body.decisionNotes ?? null,
    entryRoundType: body.entryRoundType ?? null,
    entryRoundSizeEur: num(body.entryRoundSizeEur),
    entryValuationEur: num(body.entryValuationEur),
    entryValuationBasis: body.entryValuationBasis ?? null,
    entryTicketSizeEur: num(body.entryTicketSizeEur),
    entryOwnershipPct: num(body.entryOwnershipPct),
    entryLead: typeof body.entryLead === 'boolean' ? body.entryLead : null,
    entryCoInvestors: Array.isArray(body.entryCoInvestors) ? body.entryCoInvestors : null,
  });

  if (!outcome) {
    return NextResponse.json({ error: 'persistence-failed' }, { status: 500 });
  }
  return NextResponse.json({ outcome });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const ok = await deleteOutcome(id, auth.ctx.user.id);
  return NextResponse.json({ ok });
}
