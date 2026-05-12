// ============================================================
// GET /api/cron/trajectory-reanalysis
// ------------------------------------------------------------
// Cron quotidien : identifie les dossiers in-portfolio dont la
// derniere analyse a plus de six mois et declenche leur re-analyse
// automatique en arriere-plan. Pour chaque dossier eligible,
// appelle runAutoReanalysis qui re-execute le sous-ensemble du
// pipeline reutilisable depuis le snapshot precedent (fragilite +
// narrative-drift) et persiste un nouveau snapshot via createVersion,
// projete par le trigger Postgres vers trajectory_snapshots.
//
// Apres chaque re-analyse, on evalue les transitions detectees
// contre le snapshot precedent et on dispatche les alertes cran 1
// ou 2 immediatement par email au partner proprietaire.
//
// Authentification : Vercel Cron envoie le header
// Authorization: Bearer <CRON_SECRET>. On accepte uniquement les
// requetes qui le portent. Permet de bloquer un trigger hostile
// externe sans empecher Vercel de declencher le job.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { listAllInPortfolioAnalyses, isPersistenceEnabled } from '@/lib/analysis-store';
import { getLatestSnapshot } from '@/lib/trajectory-store';
import {
  selectEligibleForReanalysis,
  type ReanalysisCandidate,
} from '@/lib/cron/portfolio-reanalysis-selector';
import { runAutoReanalysis } from '@/lib/cron/portfolio-reanalysis-runner';
import {
  evaluateForAnalysis,
  dispatchImmediateIfNeeded,
} from '@/lib/cron/trajectory-alert-dispatcher';

export const runtime = 'nodejs';
// Le job peut tourner plusieurs minutes par dossier (analyses
// LLM serielles). On reserve la duree max Vercel Pro.
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // En l absence de secret configure, on autorise pour permettre
    // les triggers manuels en dev. Sur Vercel Pro, le secret doit
    // etre defini : sans lui, n importe qui peut declencher le job.
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

  const now = new Date();

  // 1. Liste plate des dossiers in-portfolio (admin, cross-users)
  const candidates = await listAllInPortfolioAnalyses();

  // 2. Enrichit chaque candidat de la date de son dernier snapshot
  //    trajectoire. Parallelise les lectures pour limiter la latence.
  const enriched: ReanalysisCandidate[] = await Promise.all(
    candidates.map(async (c) => {
      const latest = await getLatestSnapshot(c.id);
      return {
        analysisId: c.id,
        lastSnapshotAt: latest?.analyzedAt || null,
        inPortfolio: c.inPortfolio,
      };
    }),
  );

  // 3. Selectionne les eligibles via la doctrine 180 jours
  const eligible = selectEligibleForReanalysis(enriched, now);

  // 4. Pour chaque eligible : runAutoReanalysis puis evaluation
  //    + dispatch immediat des alertes cran 1/2. Iteration serielle
  //    pour ne pas saturer Anthropic et garder un log lisible.
  const results: Array<{
    analysisId: string;
    status: 'ok' | 'skipped' | 'failed';
    immediateDispatched: boolean;
    reason?: string;
  }> = [];

  for (const e of eligible) {
    const runResult = await runAutoReanalysis(e.analysisId);
    let immediateDispatched = false;

    if (runResult.status === 'ok') {
      try {
        const evaluation = await evaluateForAnalysis(e.analysisId);
        if (evaluation) {
          immediateDispatched = await dispatchImmediateIfNeeded(evaluation);
        }
      } catch (err: any) {
        console.error(
          `[cron/trajectory-reanalysis] dispatch failure for ${e.analysisId}: ${err?.message || err}`,
        );
      }
    }

    results.push({
      analysisId: e.analysisId,
      status: runResult.status,
      immediateDispatched,
      reason: runResult.reason,
    });
  }

  return NextResponse.json({
    triggeredAt: now.toISOString(),
    candidatesCount: candidates.length,
    eligibleCount: eligible.length,
    results,
  });
}
