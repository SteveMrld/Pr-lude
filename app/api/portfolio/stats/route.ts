// ============================================================
// GET /api/portfolio/stats
// ------------------------------------------------------------
// Retourne les stats agregees du portefeuille pour l organisation
// courante. Auth obligatoire (sinon 401).
// ============================================================

import { NextResponse } from 'next/server';
import { getPortfolioStats } from '@/lib/portfolio-stats';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  const stats = await getPortfolioStats();
  if (!stats) {
    return NextResponse.json({ error: 'unauthorized or no organization' }, { status: 401 });
  }
  return NextResponse.json({ stats });
}
