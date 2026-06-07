// ============================================================
// /api/analyses/[id]/prediction-record - cliche fige des
// predictions logguees pour cette analyse.
// ------------------------------------------------------------
// GET : retourne la liste des prediction records (en pratique le
//       dernier en premier) et le plus recent en raccourci.
//
// Pas de POST cote API : le record est cree automatiquement par
// /api/analyze en fin de pipeline. Pas de PUT : le record est
// immuable par contrat (cf supabase-prediction-records-schema.sql).
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { listPredictionRecordsForAnalysis } from '@/lib/prediction-records-store';
import { isPersistenceEnabled, getAnalysis } from '@/lib/analysis-store';
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

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const records = await listPredictionRecordsForAnalysis(id, ctx.user.id);
  return NextResponse.json({
    records,
    latest: records[0] || null,
  });
}
