// ============================================================
// GET /api/reconciliation/dossier/[id]
// ------------------------------------------------------------
// Retourne la reconciliation d un dossier specifique : prediction
// Prelude (dimensionProbabilities, drivers, risques, conditions)
// vs realite observee (decision, milestones, alignement these).
//
// Auth obligatoire (sinon 401). Filtrage par user_id.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getDossierReconciliation } from '@/lib/reconciliation-aggregator';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const reconciliation = await getDossierReconciliation(id, ctx.user.id);
  if (!reconciliation) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  return NextResponse.json({ reconciliation });
}
