// ============================================================
// /api/analyses/[id]/milestones
// ------------------------------------------------------------
// GET  : liste des milestones du dossier (chronologique inverse)
// POST : creation d un nouveau milestone
//
// Un milestone est un evenement date post-decision. Plusieurs par
// dossier. Bloc E3 - Reconciliation prediction vs reality.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { listMilestones, addMilestone, type MilestoneType } from '@/lib/reconciliation-store';
import { isPersistenceEnabled, getAnalysis } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

const VALID_TYPES: MilestoneType[] = [
  'fundraise', 'pivot', 'team_change', 'revenue_update', 'metric_update',
  'churn', 'partnership', 'product_launch', 'regulatory', 'legal',
  'macro_shock', 'exit', 'fail', 'other',
];

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

  const milestones = await listMilestones(id, auth.ctx.user.id);
  return NextResponse.json({ milestones });
}

export async function POST(
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

  if (!body?.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'missing-title' }, { status: 400 });
  }
  if (!body?.milestoneDate || isNaN(Date.parse(body.milestoneDate))) {
    return NextResponse.json({ error: 'invalid-date' }, { status: 400 });
  }
  if (!body?.milestoneType || !VALID_TYPES.includes(body.milestoneType)) {
    return NextResponse.json({ error: 'invalid-type' }, { status: 400 });
  }

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const num = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const milestone = await addMilestone({
    analysisId: id,
    userId: auth.ctx.user.id,
    milestoneDate: body.milestoneDate,
    milestoneType: body.milestoneType,
    title: body.title.slice(0, 200),
    description: body.description ?? null,
    impact: body.impact ?? null,
    numericalValue: num(body.numericalValue),
    numericalUnit: body.numericalUnit ?? null,
    thesisAlignment: body.thesisAlignment ?? null,
    sourceUrl: body.sourceUrl ?? null,
    sourceType: body.sourceType ?? null,
  });

  if (!milestone) {
    return NextResponse.json({ error: 'persistence-failed' }, { status: 500 });
  }
  return NextResponse.json({ milestone });
}
