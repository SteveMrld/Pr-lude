// ============================================================
// GET /api/analyses/[id]      -> recupere l analyse complete
// DELETE /api/analyses/[id]   -> supprime
// PATCH /api/analyses/[id]    -> met a jour les notes utilisateur
//                                ou bascule le flag in_portfolio
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAnalysis,
  deleteAnalysis,
  updateAnalysisNotes,
  setAnalysisPortfolioFlag,
  isPersistenceEnabled,
} from '@/lib/analysis-store';

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

  // Champ inPortfolio prioritaire si present : bascule le tag de
  // monitoring continu. Le PATCH n est pas mutuellement exclusif,
  // on traite les champs presents dans l ordre semantique (notes
  // d abord parce qu elles existent depuis plus longtemps, tag
  // portfolio ensuite). Si un seul des deux est fourni, on n
  // exige pas l autre.
  let updatedAnything = false;

  if (typeof body?.userNotes === 'string') {
    const ok = await updateAnalysisNotes(params.id, body.userNotes);
    if (!ok) {
      return NextResponse.json({ error: 'update-failed' }, { status: 500 });
    }
    updatedAnything = true;
  }

  if (typeof body?.inPortfolio === 'boolean') {
    const ok = await setAnalysisPortfolioFlag(params.id, body.inPortfolio);
    if (!ok) {
      return NextResponse.json({ error: 'portfolio-update-failed' }, { status: 500 });
    }
    updatedAnything = true;
  }

  if (!updatedAnything) {
    return NextResponse.json({ error: 'missing-fields' }, { status: 400 });
  }

  return NextResponse.json({ updated: true });
}
