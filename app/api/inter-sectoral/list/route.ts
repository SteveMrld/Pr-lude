// ============================================================
// GET /api/inter-sectoral/list
// ------------------------------------------------------------
// Liste les trimestres pour lesquels un brief inter-sectoriel
// existe en base. Sert le selecteur de periode dans le dashboard
// partner.
//
// Auth : tout utilisateur authentifie peut lire la liste des
// briefs. Le brief lui-meme est une lecture systemique non
// confidentielle, expose en cross-org dans le dashboard.
// ============================================================

import { NextResponse } from 'next/server';
import { getCurrentUser, isAuthEnabled } from '@/lib/auth';
import { listInterSectoralPeriods } from '@/lib/engines/sectoral-intelligence/inter-sector-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (isAuthEnabled()) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const periods = await listInterSectoralPeriods();
    return NextResponse.json({ periods });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur de lecture' },
      { status: 500 },
    );
  }
}
