// ============================================================
// /api/analyses/[id]/milestones/[milestoneId]
// ------------------------------------------------------------
// DELETE : retire un milestone (manuel ou auto). Le partner peut
//         vouloir nettoyer une saisie erronee. Pour les milestones
//         auto proposes par le cron, prefere PATCH detection_status
//         = rejected (conserve la trace), DELETE est l action
//         radicale.
//
// PATCH  : met a jour les champs editables d un milestone, ou bascule
//         son detection_status. Sert deux flux :
//           - confirmation d un milestone propose par le cron de
//             detection : detection_status passe de 'proposed' a
//             'confirmed' (avec ou sans ajustement des champs)
//           - rejet d un milestone propose : detection_status passe
//             a 'rejected'. La ligne reste en base pour eviter
//             que le cron ne le re-propose, mais elle n entre pas
//             dans l agregation.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import {
  deleteMilestone,
  patchMilestone,
  updateMilestoneDetectionStatus,
  type MilestoneType,
  type MilestoneImpact,
  type ThesisAlignment,
  type MilestoneDetectionStatus,
} from '@/lib/reconciliation-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled, canEdit } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 10;

const VALID_TYPES: MilestoneType[] = [
  'fundraise', 'pivot', 'team_change', 'revenue_update', 'metric_update',
  'churn', 'partnership', 'product_launch', 'regulatory', 'legal',
  'macro_shock', 'exit', 'fail', 'other',
];
const VALID_IMPACTS: MilestoneImpact[] = ['positive', 'negative', 'neutral', 'mixed'];
const VALID_ALIGNMENTS: ThesisAlignment[] = [
  'confirms_driver', 'confirms_risk',
  'contradicts_driver', 'contradicts_risk',
  'unforeseen_positive', 'unforeseen_negative',
];
const VALID_STATUSES: MilestoneDetectionStatus[] = ['confirmed', 'proposed', 'rejected'];

async function requireUser() {
  if (!isAuthEnabled()) {
    return { error: 'auth-required', status: 403 } as const;
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return { error: 'unauthorized', status: 401 } as const;
  if (!canEdit(ctx.org.role)) return { error: 'forbidden', status: 403 } as const;
  return { ctx } as const;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const { milestoneId } = await params;
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ok = await deleteMilestone(milestoneId, auth.ctx.user.id);
  return NextResponse.json({ ok });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const { milestoneId } = await params;
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  // Shortcut : si seul detectionStatus est dans le body et qu il vaut
  // 'confirmed' ou 'rejected', on passe par le helper dedie. Permet
  // a l UI d envoyer un PATCH minimal { detectionStatus: 'confirmed' }
  // pour valider un milestone propose sans rien ajuster.
  const bodyKeys = Object.keys(body || {});
  if (bodyKeys.length === 1 && bodyKeys[0] === 'detectionStatus') {
    if (!VALID_STATUSES.includes(body.detectionStatus)) {
      return NextResponse.json({ error: 'invalid-status' }, { status: 400 });
    }
    const updated = await updateMilestoneDetectionStatus(
      milestoneId, auth.ctx.user.id, body.detectionStatus,
    );
    if (!updated) {
      return NextResponse.json({ error: 'update-failed' }, { status: 500 });
    }
    return NextResponse.json({ milestone: updated });
  }

  // Sinon, patch ouvert : on autorise la mise a jour selective des
  // champs editables. Verifie les enums avant d ecrire.
  if (body.milestoneType !== undefined && !VALID_TYPES.includes(body.milestoneType)) {
    return NextResponse.json({ error: 'invalid-type' }, { status: 400 });
  }
  if (body.impact !== undefined && body.impact !== null && !VALID_IMPACTS.includes(body.impact)) {
    return NextResponse.json({ error: 'invalid-impact' }, { status: 400 });
  }
  if (body.thesisAlignment !== undefined && body.thesisAlignment !== null
      && !VALID_ALIGNMENTS.includes(body.thesisAlignment)) {
    return NextResponse.json({ error: 'invalid-alignment' }, { status: 400 });
  }
  if (body.detectionStatus !== undefined && !VALID_STATUSES.includes(body.detectionStatus)) {
    return NextResponse.json({ error: 'invalid-status' }, { status: 400 });
  }
  if (body.milestoneDate !== undefined && isNaN(Date.parse(body.milestoneDate))) {
    return NextResponse.json({ error: 'invalid-date' }, { status: 400 });
  }

  const num = (v: any): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const updated = await patchMilestone(milestoneId, auth.ctx.user.id, {
    milestoneDate: body.milestoneDate,
    milestoneType: body.milestoneType,
    title: typeof body.title === 'string' ? body.title.slice(0, 200) : undefined,
    description: body.description,
    impact: body.impact,
    numericalValue: num(body.numericalValue),
    numericalUnit: body.numericalUnit,
    thesisAlignment: body.thesisAlignment,
    sourceUrl: body.sourceUrl,
    sourceType: body.sourceType,
    detectionStatus: body.detectionStatus,
  });

  if (!updated) {
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }
  return NextResponse.json({ milestone: updated });
}
