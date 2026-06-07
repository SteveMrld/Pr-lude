// ============================================================
// /api/calibration/summary - rapport de calibration du fonds
// ------------------------------------------------------------
// GET : rapport segmente par version stamp (un sous-rapport par
//       fingerprint de version distinct), avec pour chaque segment
//       soit les metriques calculees (Brier, courbe, discrimination)
//       soit l etat "donnees insuffisantes" avec le compte resolus
//       / requis.
//
// Pilier preuve, brique reconciliation et calibration.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { buildCalibrationSummary } from '@/lib/calibration/calibration-aggregator';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
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

  // Seuil optionnel via query string. Defaut = constante du module
  // calibration-metrics. Permet aux admins de baisser le seuil pour
  // explorer la calibration avant d avoir N=10 dossiers resolus, en
  // pleine conscience de la faible robustesse statistique.
  const url = new URL(req.url);
  const minResolvedRaw = url.searchParams.get('minResolved');
  const minResolvedPerSegment = minResolvedRaw
    ? Math.max(1, Math.min(1000, Number.parseInt(minResolvedRaw, 10) || 0))
    : undefined;

  const summary = await buildCalibrationSummary({
    userId: ctx.user.id,
    minResolvedPerSegment,
  });

  return NextResponse.json({ summary });
}
