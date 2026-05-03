// ============================================================
// POST /api/analyses
// ------------------------------------------------------------
// Sauvegarde une analyse complete dans la base.
// Appele par le client apres reception du resultat de /api/analyze.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { saveAnalysis, extractAnalysisMetadata, isPersistenceEnabled } from '@/lib/analysis-store';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ saved: false, reason: 'persistence-disabled' }, { status: 200 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.result) {
    return NextResponse.json({ error: 'Missing result field' }, { status: 400 });
  }

  // Extraction des metadonnees pour les colonnes scoreables
  const metadata = extractAnalysisMetadata(body.result);

  const id = await saveAnalysis({
    ...metadata,
    companyName: metadata.companyName || 'Sans nom',
    verdict: metadata.verdict || 'approfondir',
    resultJson: body.result,
    sourceText: body.sourceText || null,
    sourceFilename: body.sourceFilename || null,
    sourcePages: body.sourcePages || null,
    pipelineDurationMs: body.pipelineDurationMs || null,
    pipelineEnginesStatus: body.pipelineEnginesStatus || null,
  });

  if (!id) {
    return NextResponse.json(
      { saved: false, reason: 'save-failed' },
      { status: 200 }, // 200 pour ne pas casser le client : c est non-bloquant
    );
  }

  return NextResponse.json({ saved: true, id }, { status: 200 });
}
