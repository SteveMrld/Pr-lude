// ============================================================
// GET /api/inter-sectoral/[period]
// ------------------------------------------------------------
// Renvoie le brief inter-sectoriel d une periode trimestrielle
// precise. Le parametre dynamique [period] doit etre au format
// ISO trimestriel (YYYY-Qn), sinon la route renvoie 400.
//
// Special case : si period === "latest", renvoie le brief le plus
// recent disponible. Sert le chargement initial du dashboard.
//
// Auth : meme regle que /list. Tout utilisateur authentifie.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAuthEnabled } from '@/lib/auth';
import {
  getInterSectoralBriefByPeriod,
  getLatestInterSectoralBrief,
} from '@/lib/engines/sectoral-intelligence/inter-sector-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: { period: string } },
) {
  if (isAuthEnabled()) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const period = ctx?.params?.period;
  if (!period) {
    return NextResponse.json({ error: 'Periode manquante.' }, { status: 400 });
  }

  try {
    if (period === 'latest') {
      const latest = await getLatestInterSectoralBrief();
      if (!latest) {
        return NextResponse.json({ brief: null }, { status: 200 });
      }
      return NextResponse.json({ brief: latest });
    }

    if (!/^\d{4}-Q[1-4]$/.test(period)) {
      return NextResponse.json(
        {
          error: `Format de periode invalide : ${period}. Attendu YYYY-Qn (ex 2026-Q2).`,
        },
        { status: 400 },
      );
    }

    const brief = await getInterSectoralBriefByPeriod(period);
    if (!brief) {
      return NextResponse.json({ brief: null }, { status: 200 });
    }
    return NextResponse.json({ brief });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur de lecture' },
      { status: 500 },
    );
  }
}
