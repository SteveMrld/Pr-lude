// ============================================================
// GET /api/cron/inter-sectoral-regenerate
// ------------------------------------------------------------
// Cron quotidien guarde par un predicat de date : declenche la
// regeneration du brief inter-sectoriel uniquement le premier
// jour de chaque trimestre civil (1er janvier, 1er avril, 1er
// juillet, 1er octobre). Vercel Cron ne supporte pas une syntax
// "1 du mois pour 4 mois selectionnes" plus elegante : on planifie
// donc le cron a 8h UTC tous les jours dans vercel.json et on
// laisse le code decider d agir ou non.
//
// Comportement les autres jours : 200 OK avec status="skipped",
// catalog_size=0, processed=false. Le cron reste leger.
//
// Le 1er janvier, avril, juillet ou octobre, le cron :
//   1. Calcule la periode courante (formatPeriodQuarter du jour).
//   2. Verifie qu un brief n existe pas deja pour cette periode
//      (idempotence). Si oui, skip.
//   3. Lance aggregateInterSectoral et persiste le resultat avec
//      upsertInterSectoralBrief.
//
// Auth : Bearer CRON_SECRET, meme convention que les autres crons
// Prelude.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { logException } from '@/lib/error-logger';
import {
  aggregateInterSectoral,
} from '@/lib/engines/sectoral-intelligence/inter-sector-aggregator';
import {
  upsertInterSectoralBrief,
  getInterSectoralBriefByPeriod,
} from '@/lib/engines/sectoral-intelligence/inter-sector-store';
import {
  formatPeriodQuarter,
  isFirstDayOfQuarter,
  previousPeriodQuarter,
} from '@/lib/engines/sectoral-intelligence/inter-sector-computations';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const triggeredAt = now.toISOString();

  // Garde de date : on n agit qu en debut de trimestre.
  if (!isFirstDayOfQuarter(now)) {
    return NextResponse.json({
      triggered_at: triggeredAt,
      status: 'skipped',
      reason: 'Hors du premier jour de trimestre civil.',
    });
  }

  const periodQuarter = formatPeriodQuarter(now);

  // Idempotence : si un brief existe deja pour cette periode, on
  // skip pour ne pas re-facturer Opus inutilement. Une regeneration
  // manuelle est toujours possible via la route admin si l admin
  // veut forcer une mise a jour.
  try {
    const existing = await getInterSectoralBriefByPeriod(periodQuarter);
    if (existing) {
      return NextResponse.json({
        triggered_at: triggeredAt,
        period_quarter: periodQuarter,
        status: 'already_exists',
        reason: 'Un brief inter-sectoriel est deja persiste pour cette periode.',
      });
    }
  } catch (err: any) {
    await logException('cron.inter-sectoral-regenerate', err, {
      severity: 'error',
      context: { phase: 'check-existing', period_quarter: periodQuarter },
    });
    return NextResponse.json(
      { error: err?.message || 'check-existing failed' },
      { status: 500 },
    );
  }

  // Resoud previous_brief_id pour traceabilite.
  let previousBriefId: string | null = null;
  try {
    const prevPeriod = previousPeriodQuarter(periodQuarter);
    const prev = await getInterSectoralBriefByPeriod(prevPeriod);
    previousBriefId = prev?.id ?? null;
  } catch {
    previousBriefId = null;
  }

  const result = await aggregateInterSectoral({
    period_quarter: periodQuarter,
    previous_brief_id: previousBriefId,
  });

  if (result.status !== 'success' || !result.brief) {
    await logException(
      'cron.inter-sectoral-regenerate',
      new Error(
        `Agregation ${result.status} pour ${periodQuarter} : ${result.rejection_reason ?? 'motif inconnu'}`,
      ),
      {
        severity: result.status === 'rejected_no_data' ? 'warning' : 'error',
        context: {
          period_quarter: periodQuarter,
          status: result.status,
          error_message: result.error_message,
        },
      },
    );
    return NextResponse.json({
      triggered_at: triggeredAt,
      period_quarter: periodQuarter,
      status: result.status,
      rejection_reason: result.rejection_reason,
      duration_ms: result.duration_ms,
    });
  }

  try {
    const persisted = await upsertInterSectoralBrief(result.brief);
    return NextResponse.json({
      triggered_at: triggeredAt,
      period_quarter: periodQuarter,
      status: 'success',
      brief_id: persisted.id,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
    });
  } catch (err: any) {
    await logException('cron.inter-sectoral-regenerate.persist', err, {
      severity: 'error',
      context: { period_quarter: periodQuarter },
    });
    return NextResponse.json(
      { error: err?.message || 'persistence failed', period_quarter: periodQuarter },
      { status: 500 },
    );
  }
}
