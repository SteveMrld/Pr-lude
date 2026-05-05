// ============================================================
// GET /api/reconciliation/portfolio
// ------------------------------------------------------------
// Retourne la reconciliation portfolio agregee : taux de
// confirmation des theses, performance par dimension, patterns
// systemiques. Le seuil PORTFOLIO_RECONCILIATION_THRESHOLD = 30
// dossiers reconcilies est expose via thresholdMet.
//
// Auth obligatoire (sinon 401). Filtrage par user_id.
// ============================================================

import { NextResponse } from 'next/server';
import { getPortfolioReconciliation } from '@/lib/reconciliation-aggregator';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const reconciliation = await getPortfolioReconciliation(ctx.user.id);
  return NextResponse.json({ reconciliation });
}
