// ============================================================
// POST /api/inter-sectoral/regenerate
// ------------------------------------------------------------
// Endpoint super-admin pour declencher la regeneration manuelle
// du brief inter-sectoriel pour le trimestre courant (ou un
// trimestre arbitraire passe en body). La regeneration tourne en
// arriere-plan via fire-and-forget : la requete HTTP retourne 202
// Accepted des que le job est dispatche, sans attendre l appel
// LLM Opus qui peut prendre une a deux minutes sur treize fiches.
//
// Le suivi se fait par lecture de /api/inter-sectoral/list ou par
// affichage direct via /portfolio/secteurs/etat-systemique.
//
// Auth : super-admin Prelude uniquement. Sinon 403.
//
// Body JSON optionnel :
//   {
//     "period_quarter": "2026-Q2"  // defaut = trimestre courant
//   }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import { logException } from '@/lib/error-logger';
import {
  aggregateInterSectoral,
} from '@/lib/engines/sectoral-intelligence/inter-sector-aggregator';
import {
  upsertInterSectoralBrief,
  getInterSectoralBriefByPeriod,
} from '@/lib/engines/sectoral-intelligence/inter-sector-store';
import { formatPeriodQuarter, previousPeriodQuarter } from '@/lib/engines/sectoral-intelligence/inter-sector-computations';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface RegenerateBody {
  period_quarter?: unknown;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isAdmin = await isSuperAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: RegenerateBody;
  try {
    body = (await req.json().catch(() => ({}))) as RegenerateBody;
  } catch {
    body = {};
  }

  let periodQuarter: string;
  if (typeof body.period_quarter === 'string' && /^\d{4}-Q[1-4]$/.test(body.period_quarter)) {
    periodQuarter = body.period_quarter;
  } else {
    periodQuarter = formatPeriodQuarter(new Date());
  }

  const triggeredBy = user.email || user.id;
  runAggregationInBackground(periodQuarter, triggeredBy);

  return NextResponse.json(
    {
      accepted: true,
      period_quarter: periodQuarter,
      triggered_by: triggeredBy,
      triggered_at: new Date().toISOString(),
      message:
        'Regeneration inter-sectorielle lancee en arriere-plan. Le brief apparaitra dans /portfolio/secteurs/etat-systemique d ici une a deux minutes.',
    },
    { status: 202 },
  );
}

function runAggregationInBackground(periodQuarter: string, triggeredBy: string): void {
  const job = async () => {
    try {
      // Resoud previous_brief_id si un brief existe deja au trimestre
      // precedent (utile pour traceabilite dans la metadata).
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
          'api.inter-sectoral.regenerate',
          new Error(
            `Agregation ${result.status} pour ${periodQuarter} : ${result.rejection_reason ?? 'motif inconnu'}`,
          ),
          {
            severity: result.status === 'rejected_no_data' ? 'warning' : 'error',
            context: {
              period_quarter: periodQuarter,
              triggered_by: triggeredBy,
              status: result.status,
              error_message: result.error_message,
            },
          },
        );
        return;
      }

      // upsert pour permettre la re-regeneration manuelle (par
      // exemple apres avoir corrige une fiche sectorielle hors
      // norme et relance le brief inter-sectoriel).
      await upsertInterSectoralBrief(result.brief);
    } catch (err) {
      await logException('api.inter-sectoral.regenerate.unexpected', err, {
        severity: 'error',
        context: { period_quarter: periodQuarter, triggered_by: triggeredBy },
      }).catch(() => {
        /* derniere ligne de defense */
      });
    }
  };
  void job();
}
