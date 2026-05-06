// ============================================================
// GET  /api/analyses/[id]/reference-aggregation  -> agrege les notes
// POST /api/analyses/[id]/reference-aggregation  -> force regeneration
//
// L agregation est mise en cache : la signature des notes (id +
// updatedAt de chaque note) est comparee a celle stockee. Si elle
// matche on retourne le cache, sinon on rejoue le LLM.
//
// POST permet de forcer une regeneration meme si le cache est
// valide (utile si on a change le prompt ou pour iterer sur la
// synthese).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listReferenceCallNotes,
  getCachedAggregation,
  saveAggregation,
  buildNotesSignature,
} from '@/lib/reference-call-notes-store';
import { aggregateReferenceCallNotes } from '@/lib/engines/reference-aggregation-engine';
import { isPersistenceEnabled, getAnalysis } from '@/lib/analysis-store';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function buildAggregation(analysisId: string, force: boolean) {
  const notes = await listReferenceCallNotes(analysisId);
  const signature = buildNotesSignature(notes);

  if (!force) {
    const cached = await getCachedAggregation(analysisId);
    if (cached && cached.notesSignature === signature) {
      return {
        cached: true,
        notesCount: cached.notesCount,
        aggregation: cached.aggregation,
        generatedAt: cached.generatedAt,
      };
    }
  }

  const analysis = await getAnalysis(analysisId);
  const companyName = analysis?.companyName || 'Societe';
  const sector = (analysis as any)?.sector;
  const companyContext = sector ? `Secteur : ${sector}` : undefined;

  const aggregation = await aggregateReferenceCallNotes({
    companyName,
    companyContext,
    notes,
  });

  // Sauve seulement si on a au moins une note (l agregation vide
  // est deterministe, pas la peine de la cacher).
  if (notes.length > 0) {
    await saveAggregation({
      analysisId,
      notesCount: notes.length,
      notesSignature: signature,
      aggregation,
    });
  }

  return {
    cached: false,
    notesCount: notes.length,
    aggregation,
    generatedAt: new Date().toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ enabled: false });
  }
  try {
    const result = await buildAggregation(params.id, false);
    return NextResponse.json({ enabled: true, ...result });
  } catch (err: any) {
    console.error('[reference-aggregation] GET exception:', err);
    return NextResponse.json({ error: err?.message || 'aggregation-failed' }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  try {
    const result = await buildAggregation(params.id, true);
    return NextResponse.json({ enabled: true, ...result });
  } catch (err: any) {
    console.error('[reference-aggregation] POST exception:', err);
    return NextResponse.json({ error: err?.message || 'aggregation-failed' }, { status: 500 });
  }
}
