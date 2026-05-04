// ============================================================
// POST /api/analyses
// ------------------------------------------------------------
// Sauvegarde une analyse complete dans la base.
// Appele par le client apres reception du resultat de /api/analyze.
//
// Trois modes de fonctionnement :
//
//   1. mode='detect' (defaut) : detecter automatiquement les collisions
//      avec un dossier existant du meme nom. Si collision, retourner
//      { collision: {...} } sans rien creer. Le client peut alors
//      proposer un dialogue de choix a l utilisateur.
//
//   2. mode='new-record' : creer un nouveau dossier explicitement,
//      meme s il existe deja un dossier du meme nom (cas de re-run avec
//      un projet different mais nom identique).
//
//   3. mode='new-version' : creer une nouvelle version d un dossier
//      existant identifie par existingId. Insere un snapshot dans
//      analyses_versions et met a jour le live de la table analyses.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  saveAnalysis,
  updateAnalysisLive,
  findExistingByCompany,
  extractAnalysisMetadata,
  isPersistenceEnabled,
} from '@/lib/analysis-store';
import { createVersion } from '@/lib/collaboration-store';

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

  const mode = (body.mode === 'new-version' || body.mode === 'new-record') ? body.mode : 'detect';
  const existingId = typeof body.existingId === 'string' ? body.existingId : null;

  const metadata = extractAnalysisMetadata(body.result);
  const companyName = metadata.companyName || 'Sans nom';

  const saveInput = {
    ...metadata,
    companyName,
    verdict: metadata.verdict || 'approfondir',
    resultJson: body.result,
    sourceText: body.sourceText || null,
    sourceFilename: body.sourceFilename || null,
    sourcePages: body.sourcePages || null,
    pipelineDurationMs: body.pipelineDurationMs || null,
    pipelineEnginesStatus: body.pipelineEnginesStatus || null,
  };

  // -------- MODE DETECT --------
  if (mode === 'detect') {
    const existing = await findExistingByCompany(companyName);
    if (existing) {
      return NextResponse.json({
        saved: false,
        collision: {
          existingId: existing.id,
          existingCompanyName: existing.companyName,
          existingCreatedAt: existing.createdAt,
          nextVersionNum: existing.latestVersion + 1,
        },
      }, { status: 200 });
    }
    const id = await saveAnalysis(saveInput);
    if (!id) {
      return NextResponse.json({ saved: false, reason: 'save-failed' }, { status: 200 });
    }
    return NextResponse.json({ saved: true, id, mode: 'new-record' }, { status: 200 });
  }

  // -------- MODE NEW-RECORD --------
  if (mode === 'new-record') {
    const id = await saveAnalysis(saveInput);
    if (!id) {
      return NextResponse.json({ saved: false, reason: 'save-failed' }, { status: 200 });
    }
    return NextResponse.json({ saved: true, id, mode: 'new-record' }, { status: 200 });
  }

  // -------- MODE NEW-VERSION --------
  if (mode === 'new-version') {
    if (!existingId) {
      return NextResponse.json({ error: 'existingId required for new-version mode' }, { status: 400 });
    }

    const version = await createVersion({
      analysisId: existingId,
      snapshotJson: body.result,
      sourceFilename: body.sourceFilename || null,
      pipelineDurationMs: body.pipelineDurationMs || null,
      note: typeof body.versionNote === 'string' ? body.versionNote : 'Re-run pipeline',
    });

    if (!version) {
      return NextResponse.json({ saved: false, reason: 'version-create-failed' }, { status: 200 });
    }

    const updated = await updateAnalysisLive(existingId, saveInput);
    if (!updated) {
      console.warn('[api/analyses] new-version : version creee mais live update echoue');
    }

    return NextResponse.json({
      saved: true,
      id: existingId,
      mode: 'new-version',
      versionNum: version.versionNum,
    }, { status: 200 });
  }

  return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
}
