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
import { notifyAnalysisComplete, notifyCriticalAlert } from '@/lib/slack-store';
import { computeTopRisks } from '@/lib/compute-top-risks';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Declenche les notifications Slack pour une analyse fraichement
 * sauvegardee (creation ou nouvelle version). Non-bloquant : les
 * erreurs sont loggees dans slack_notifications_log et ne remontent
 * pas au client. Si l org n a pas de config Slack, no-op silencieux.
 */
async function dispatchSlackNotifications(params: {
  organizationId: string;
  analysisId: string;
  result: any;
  baseUrl: string;
}): Promise<void> {
  try {
    const ext = params.result?.extraction || {};
    const reco = params.result?.finalRecommendation || {};
    const blindspot = params.result?.blindspotAnalysis || {};
    const topRisks = computeTopRisks(params.result, 3);

    const verdict = reco.verdict || 'approfondir';
    const globalScore = reco.computedScoreBreakdown?.finalComputedScore
      ?? reco.globalScore
      ?? null;

    // Notification standard : tous les dossiers
    await notifyAnalysisComplete({
      organizationId: params.organizationId,
      analysisId: params.analysisId,
      companyName: ext.companyName || 'Sans nom',
      sector: ext.sector || null,
      country: ext.country || null,
      verdict,
      globalScore: typeof globalScore === 'number' ? globalScore : null,
      successProbability: typeof reco.successProbability === 'number' ? reco.successProbability : null,
      failureProbability: typeof reco.failureProbability === 'number' ? reco.failureProbability : null,
      decisionDrivers: Array.isArray(reco.decisionDrivers) ? reco.decisionDrivers : [],
      topRisks,
      baseUrl: params.baseUrl,
    });

    // Alerte critique si verdict=refuser ou blindspot global > 75
    const blindspotScore = typeof blindspot.globalBlindspotScore === 'number'
      ? blindspot.globalBlindspotScore
      : 0;
    let alertReason: string | null = null;
    if (verdict === 'refuser') {
      alertReason = `Verdict d instruction *Refuser* avec un score global de ${globalScore ?? '—'}/100. Cette decision merite une revue collegiale rapide.`;
    } else if (blindspotScore >= 75) {
      alertReason = `Score d aveuglement collectif tres eleve (${blindspotScore}/100). Le dossier presente plusieurs patterns à risque intenses qui justifient une attention particuliere.`;
    }

    if (alertReason) {
      await notifyCriticalAlert({
        organizationId: params.organizationId,
        analysisId: params.analysisId,
        companyName: ext.companyName || 'Sans nom',
        verdict,
        reason: alertReason,
        baseUrl: params.baseUrl,
      });
    }
  } catch (err) {
    console.warn('[api/analyses] dispatchSlackNotifications error:', err);
  }
}

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

    return NextResponse.json({
      saved: true,
      id: existingId,
      mode: 'new-version',
      versionNum: version.versionNum,
    }, { status: 200 });
  }

  return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
}
