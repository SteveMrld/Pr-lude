// ============================================================
// GET /api/cron/cleanup-stale-running
// ------------------------------------------------------------
// Cron quotidien qui balaie les analyses coincees en status
// 'running' depuis plus de 30 minutes et les bascule en 'failed'.
//
// Pourquoi ce nettoyage est structurel : le pipeline
// /api/analyze cree la ligne a t0 (status='running') et pose un
// statut terminal (completed ou failed) en sortie. Si le runtime
// meurt entre les deux, cas classiques :
//   - timeout Vercel 800s sur un pipeline lourd
//   - kill process ou redeploy pendant l execution
//   - deconnexion Supabase pendant markAnalysisFailed lui-meme
// la ligne reste indefiniment en running. L Historique se
// pollue alors de dossiers fantomes qui ne se termineront jamais
// et le partner voit du bruit qu il n a aucun moyen de nettoyer
// depuis l UI.
//
// Le seuil de 30 minutes est un compromis :
//   - assez long pour ne jamais tuer un pipeline vivant (le
//     pipeline early stage tourne en 4 a 10 min, celui growth
//     en 2 a 6 min, marge x 3 confortable)
//   - assez court pour que le nettoyage soit percu comme
//     immediat au sens metier (le partner n attend jamais une
//     analyse plus longtemps que ca sans reprendre l onglet)
//
// Authentification : Vercel Cron envoie
// Authorization: Bearer CRON_SECRET. Sans ce header (et avec le
// secret defini en env), on refuse 401. En dev sans secret
// defini, on autorise pour permettre le test manuel.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { isPersistenceEnabled, markStaleRunningAsFailed } from '@/lib/analysis-store';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DEFAULT_THRESHOLD_MINUTES = 30;

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
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 503 });
  }

  const thresholdParam = req.nextUrl.searchParams.get('thresholdMinutes');
  const threshold = thresholdParam
    ? Math.max(5, Math.min(1440, Number.parseInt(thresholdParam, 10) || DEFAULT_THRESHOLD_MINUTES))
    : DEFAULT_THRESHOLD_MINUTES;

  const triggeredAt = new Date().toISOString();
  const { swept, ids } = await markStaleRunningAsFailed(threshold);

  if (swept > 0) {
    console.warn(
      `[cron/cleanup-stale-running] ${swept} analyse(s) basculee(s) en failed (seuil ${threshold} min) :`,
      ids,
    );
  }

  return NextResponse.json({
    triggeredAt,
    thresholdMinutes: threshold,
    sweptCount: swept,
    ids,
  });
}
