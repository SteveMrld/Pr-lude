// ============================================================
// GET /api/analyses/[id]/versions  -> liste des metadonnees versions
// POST /api/analyses/[id]/versions -> cree une nouvelle version
//                                     (snapshot du resultJson actuel)
//
// Le POST est appele apres un re-run du pipeline sur le meme dossier
// (deck v2). En mode solo, on tolere la creation pour permettre le
// versioning interne meme sans equipe.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { listVersions, createVersion } from '@/lib/collaboration-store';
import { getAnalysis, isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const versions = await listVersions(params.id);
  return NextResponse.json({ versions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }

  let createdBy: string | null = null;
  if (isAuthEnabled()) {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    createdBy = ctx.user.id;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  let snapshotJson = body?.snapshotJson;
  let sourceFilename = body?.sourceFilename ?? null;
  let pipelineDurationMs = body?.pipelineDurationMs ?? null;

  // Si pas de snapshot fourni, on prend le resultJson actuel de l analyse
  // (cas typique : "fige une version a l etat actuel" sans re-run).
  if (!snapshotJson) {
    const current = await getAnalysis(params.id);
    if (!current) {
      return NextResponse.json({ error: 'analysis-not-found' }, { status: 404 });
    }
    snapshotJson = current.resultJson;
    sourceFilename = sourceFilename ?? current.sourceFilename;
    pipelineDurationMs = pipelineDurationMs ?? current.pipelineDurationMs;
  }

  const note = typeof body?.note === 'string' ? body.note : null;

  const version = await createVersion({
    analysisId: params.id,
    snapshotJson,
    sourceFilename,
    pipelineDurationMs,
    createdBy,
    note,
  });

  if (!version) {
    return NextResponse.json({ error: 'create-failed' }, { status: 500 });
  }
  return NextResponse.json({ version });
}
