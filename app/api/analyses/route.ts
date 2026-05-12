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
import { dispatchSlackNotifications } from '@/lib/slack-dispatch';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';
import {
  evaluateForAnalysis,
  dispatchImmediateIfNeeded,
} from '@/lib/cron/trajectory-alert-dispatcher';

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
    // Notification Slack non-bloquante
    if (isAuthEnabled()) {
      const ctx = await getAuthenticatedContext();
      if (ctx) {
        const baseUrl = req.nextUrl.origin;
        // Fire and forget : on ne await pas pour ne pas bloquer la reponse
        dispatchSlackNotifications({
          organizationId: ctx.org.id,
          analysisId: id,
          result: body.result,
          baseUrl,
        }).catch(() => {});
      }
    }
    return NextResponse.json({ saved: true, id, mode: 'new-record' }, { status: 200 });
  }

  // -------- MODE NEW-RECORD --------
  if (mode === 'new-record') {
    const id = await saveAnalysis(saveInput);
    if (!id) {
      return NextResponse.json({ saved: false, reason: 'save-failed' }, { status: 200 });
    }
    if (isAuthEnabled()) {
      const ctx = await getAuthenticatedContext();
      if (ctx) {
        dispatchSlackNotifications({
          organizationId: ctx.org.id,
          analysisId: id,
          result: body.result,
          baseUrl: req.nextUrl.origin,
        }).catch(() => {});
      }
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

    // Notification Slack pour la nouvelle version aussi : permet a l equipe
    // de voir que le dossier a ete remis a jour et que le verdict peut
    // avoir change.
    if (isAuthEnabled()) {
      const ctx = await getAuthenticatedContext();
      if (ctx) {
        dispatchSlackNotifications({
          organizationId: ctx.org.id,
          analysisId: existingId,
          result: body.result,
          baseUrl: req.nextUrl.origin,
        }).catch(() => {});
      }
    }

    // Dispatch immediat des alertes de trajectoire crans 1 ou 2 si
    // la comparaison nouveau-snapshot vs precedent franchit un des
    // seuils critiques. Fire-and-forget pour ne pas bloquer la
    // reponse client. L echec d email ne casse jamais la chaine de
    // persistance, c est une notification dissociee qui se rejoue
    // a la demande via le runner cron en cas de probleme provider.
    (async () => {
      try {
        const evaluation = await evaluateForAnalysis(existingId);
        if (evaluation) {
          await dispatchImmediateIfNeeded(evaluation);
        }
      } catch (err: any) {
        console.error('[api/analyses] dispatch trajectoire echec:', err?.message || err);
      }
    })();

    return NextResponse.json({
      saved: true,
      id: existingId,
      mode: 'new-version',
      versionNum: version.versionNum,
    }, { status: 200 });
  }

  return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
}
