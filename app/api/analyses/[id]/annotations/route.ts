// ============================================================
// GET /api/analyses/[id]/annotations  -> liste des commentaires
// POST /api/analyses/[id]/annotations -> creer un commentaire
//
// Query params GET :
//   - section (optionnel) : filtrer par section UI
//   - includeResolved=true : inclure les commentaires deja adresses
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { listAnnotations, createAnnotation } from '@/lib/collaboration-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const sp = req.nextUrl.searchParams;
  const sectionId = sp.get('section') || undefined;
  const includeResolved = sp.get('includeResolved') === 'true';

  const annotations = await listAnnotations(params.id, { sectionId, includeResolved });
  return NextResponse.json({ annotations });
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
      { error: 'auth-required', detail: 'Les annotations partagées nécessitent un compte fonds.' },
      { status: 403 },
    );
  }

  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'L ajout de commentaires est reserve aux membres editeurs.' },
      { status: 403 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const sectionId = typeof body?.sectionId === 'string' ? body.sectionId.trim() : '';
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  const paragraphAnchor = typeof body?.paragraphAnchor === 'string' ? body.paragraphAnchor : null;

  if (!sectionId) return NextResponse.json({ error: 'missing-sectionId' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'missing-body' }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: 'body-too-long' }, { status: 400 });

  const annotation = await createAnnotation({
    analysisId: params.id,
    sectionId,
    body: text,
    createdBy: ctx.user.id,
    paragraphAnchor,
  });

  if (!annotation) {
    return NextResponse.json({ error: 'create-failed' }, { status: 500 });
  }
  return NextResponse.json({ annotation });
}
