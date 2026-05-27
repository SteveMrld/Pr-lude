// ============================================================
// GET /api/analyses/[id]/status   -> stage actuel + historique
// PATCH /api/analyses/[id]/status -> change le stage du dossier
//
// En mode solo (ENABLE_AUTH=false), GET fonctionne mais PATCH refuse :
// la notion de stage partage entre membres n a pas de sens sans equipe.
//
// Effet de bord important : quand un PATCH change le stage, on poste
// une notification dans Slack pour que toute l equipe du fonds voie
// le mouvement (si la config Slack de l org est active). Best effort,
// l echec du Slack ne fait pas echouer le PATCH.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkflowStatus,
  setWorkflowStage,
  getWorkflowHistory,
  WORKFLOW_STAGES,
  type WorkflowStage,
} from '@/lib/collaboration-store';
import { isPersistenceEnabled, getAnalysis } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, getCurrentOrganization, canEdit } from '@/lib/auth';
import { notifyWorkflowStageChange } from '@/lib/slack-store';
import {
  getOutcomeForAnalysis,
  upsertOutcome,
} from '@/lib/reconciliation-store';
import { buildKanbanOutcomePrefill } from '@/lib/reconciliation-prefill';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const status = await getWorkflowStatus(params.id);
  const history = await getWorkflowHistory(params.id);
  return NextResponse.json({ status, history });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'auth-required', detail: 'Le workflow multi-stade necessite un compte fonds.' },
      { status: 403 },
    );
  }

  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!canEdit(ctx.org.role)) {
    return NextResponse.json(
      { error: 'forbidden', detail: 'La modification du stade est reservee aux membres editeurs.' },
      { status: 403 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const stage = body?.stage as WorkflowStage;
  if (!stage || !WORKFLOW_STAGES.includes(stage)) {
    return NextResponse.json({ error: 'invalid-stage' }, { status: 400 });
  }

  const comment = typeof body?.comment === 'string' ? body.comment : undefined;

  // Stage actuel avant update : utile pour le message Slack (transition)
  const previous = await getWorkflowStatus(params.id);
  const fromStage = previous?.stage ?? null;

  const ok = await setWorkflowStage(params.id, stage, ctx.user.id, comment);
  if (!ok) {
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }

  // Auto-capture decision Kanban -> realized_outcomes.
  // Branchee sur les transitions terminales (signed / declined) :
  // on cree un outcome en source='kanban_auto' avec un pre-fill
  // derive du result_json (round type, montant, valo). Le partner
  // verra dans la section reconciliation de la note une banniere
  // "decision deduite, precisez les conditions" qui ouvre le
  // formulaire en mode edition pre-rempli.
  //
  // Regle de non-ecrasement : si un outcome existe deja pour ce
  // dossier (saisi manuellement ou cree par un Kanban precedent),
  // on ne touche a rien. Le manuel l emporte toujours sur l auto.
  // L outcome auto-cree par une transition signed reste meme si
  // le partner repasse en ic_review (rollback Kanban).
  let outcomeAutoCreated = false;
  if (fromStage !== stage && (stage === 'signed' || stage === 'declined')) {
    try {
      const existing = await getOutcomeForAnalysis(params.id, ctx.user.id);
      if (!existing) {
        const analysis = await getAnalysis(params.id);
        const prefill = buildKanbanOutcomePrefill(
          params.id,
          ctx.user.id,
          stage,
          analysis?.resultJson,
        );
        if (prefill) {
          const created = await upsertOutcome(prefill);
          if (created) outcomeAutoCreated = true;
        }
      }
    } catch (err) {
      console.warn('[status] auto-capture outcome failed (non-fatal):', err);
    }
  }

  // Notification Slack : best effort, ne pas faire echouer la requete
  // si le webhook tombe ou n est pas configure. On notifie seulement si
  // le stage change reellement (pas un re-set du meme stage).
  if (fromStage !== stage) {
    try {
      const org = await getCurrentOrganization(ctx.user.id);
      if (org) {
        const analysis = await getAnalysis(params.id);
        if (analysis) {
          const baseUrl = req.headers.get('origin')
            || `https://${req.headers.get('host')}`
            || 'https://pr-lude.vercel.app';
          await notifyWorkflowStageChange({
            organizationId: org.id,
            analysisId: params.id,
            companyName: analysis.companyName,
            fromStage,
            toStage: stage,
            changedByDisplay: ctx.user.email || null,
            comment: comment || null,
            baseUrl,
          });
        }
      }
    } catch (err) {
      console.warn('[status] Slack notify failed (non-fatal):', err);
    }
  }

  return NextResponse.json({ updated: true, stage, outcomeAutoCreated });
}
