// ============================================================
// GET /api/analyses/list
// ------------------------------------------------------------
// Liste les analyses de l utilisateur avec filtres optionnels.
// Query params : verdict, sector, q (search), from, to, limit, offset
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { listAnalyses, getAnalysesStats, isPersistenceEnabled } from '@/lib/analysis-store';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({
      enabled: false,
      analyses: [],
      stats: null,
    });
  }

  const url = new URL(req.url);
  const verdict = url.searchParams.get('verdict') || undefined;
  const sector = url.searchParams.get('sector') || undefined;
  const workflowStage = url.searchParams.get('workflow_stage') || undefined;
  const searchQuery = url.searchParams.get('q') || undefined;
  const fromDate = url.searchParams.get('from') || undefined;
  const toDate = url.searchParams.get('to') || undefined;
  const limit = url.searchParams.get('limit')
    ? parseInt(url.searchParams.get('limit')!, 10)
    : undefined;
  const offset = url.searchParams.get('offset')
    ? parseInt(url.searchParams.get('offset')!, 10)
    : undefined;

  const [analyses, stats] = await Promise.all([
    listAnalyses({ verdict, sector, workflowStage, searchQuery, fromDate, toDate, limit, offset }),
    getAnalysesStats(),
  ]);

  return NextResponse.json({
    enabled: true,
    analyses,
    stats,
  });
}
