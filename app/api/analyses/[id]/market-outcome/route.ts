// ============================================================
// /api/analyses/[id]/market-outcome - issue de marche du dossier
// ------------------------------------------------------------
// GET    : recupere l outcome si il existe
// PUT    : upsert l outcome (cree ou met a jour)
// DELETE : retire l outcome
//
// Pilier preuve, brique reconciliation et calibration. Decouple
// du realized_outcomes (decision du fonds) parce que la decision
// du fonds et l issue de marche sont deux choses distinctes :
// le fonds peut avoir passe un dossier qui exit (faux negatif)
// ou investi sur un dossier qui fail (faux positif).
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import {
  getAnalysisOutcome,
  upsertAnalysisOutcome,
  deleteAnalysisOutcome,
  MARKET_OUTCOME_VALUES,
  type MarketOutcome,
} from '@/lib/analysis-outcomes-store';
import { isPersistenceEnabled, getAnalysis } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

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
  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  const outcome = await getAnalysisOutcome(id, auth.ctx.user.id);
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

  if (!body?.marketOutcome || !MARKET_OUTCOME_VALUES.includes(body.marketOutcome as MarketOutcome)) {
    return NextResponse.json(
      {
        error: 'invalid-market-outcome',
        detail: `marketOutcome doit etre l un de ${MARKET_OUTCOME_VALUES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const outcome = await upsertAnalysisOutcome({
    analysisId: id,
    userId: auth.ctx.user.id,
    marketOutcome: body.marketOutcome,
    observedAt: typeof body.observedAt === 'string' ? body.observedAt : undefined,
    source: typeof body.source === 'string' ? body.source : 'manual',
    sourceUrl: body.sourceUrl ?? null,
    sourceNotes: body.sourceNotes ?? null,
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
  const ok = await deleteAnalysisOutcome(id, auth.ctx.user.id);
  return NextResponse.json({ ok });
}
