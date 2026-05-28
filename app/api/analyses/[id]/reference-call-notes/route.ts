// ============================================================
// GET  /api/analyses/[id]/reference-call-notes  -> liste les notes
// POST /api/analyses/[id]/reference-call-notes  -> cree une note
//
// Les notes de reference call sont saisies APRES que le VC a
// effectivement passe l appel (vs reference-checks-engine qui
// genere le PLAN d appels en amont).
//
// En mode solo (auth desactivee), la lecture fonctionne mais
// l ecriture refuse : sans user authentifie on ne peut pas tracer
// l auteur de la note.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listReferenceCallNotes,
  createReferenceCallNote,
  CALL_CATEGORIES,
  OVERALL_TONES,
  type CallCategory,
  type OverallTone,
} from '@/lib/reference-call-notes-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ enabled: false, notes: [] });
  }
  const notes = await listReferenceCallNotes(params.id);
  return NextResponse.json({ enabled: true, notes });
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
      { error: 'auth-required', detail: 'La saisie de notes de référence nécessite un compte fonds.' },
      { status: 403 },
    );
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'La saisie de notes est reservee aux membres editeurs.' },
      { status: 403 },
    );
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const callCategory = body?.callCategory as CallCategory;
  if (!callCategory || !CALL_CATEGORIES.includes(callCategory)) {
    return NextResponse.json({ error: 'invalid-category' }, { status: 400 });
  }
  if (typeof body?.contactName !== 'string' || !body.contactName.trim()) {
    return NextResponse.json({ error: 'missing-contact-name' }, { status: 400 });
  }
  if (typeof body?.rawNotes !== 'string' || !body.rawNotes.trim()) {
    return NextResponse.json({ error: 'missing-raw-notes' }, { status: 400 });
  }

  const overallTone = body?.overallTone as OverallTone | undefined;
  if (overallTone && !OVERALL_TONES.includes(overallTone)) {
    return NextResponse.json({ error: 'invalid-tone' }, { status: 400 });
  }

  const ratingFields = ['ratingCompetence', 'ratingIntegrity', 'ratingLeadership', 'ratingWouldWorkAgain'];
  for (const f of ratingFields) {
    const v = body?.[f];
    if (v !== undefined && v !== null && (typeof v !== 'number' || v < 1 || v > 5)) {
      return NextResponse.json({ error: 'invalid-rating', field: f }, { status: 400 });
    }
  }

  const result = await createReferenceCallNote({
    analysisId: params.id,
    authorId: ctx.user.id,
    callCategory,
    contactName: body.contactName,
    contactRole: typeof body.contactRole === 'string' ? body.contactRole : null,
    contactCompany: typeof body.contactCompany === 'string' ? body.contactCompany : null,
    relatedSubject: typeof body.relatedSubject === 'string' ? body.relatedSubject : null,
    callDate: typeof body.callDate === 'string' ? body.callDate : null,
    durationMinutes: typeof body.durationMinutes === 'number' ? body.durationMinutes : null,
    rawNotes: body.rawNotes,
    overallTone: overallTone || null,
    ratingCompetence: typeof body.ratingCompetence === 'number' ? body.ratingCompetence : null,
    ratingIntegrity: typeof body.ratingIntegrity === 'number' ? body.ratingIntegrity : null,
    ratingLeadership: typeof body.ratingLeadership === 'number' ? body.ratingLeadership : null,
    ratingWouldWorkAgain: typeof body.ratingWouldWorkAgain === 'number' ? body.ratingWouldWorkAgain : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'create-failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
