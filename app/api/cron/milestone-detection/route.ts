// ============================================================
// GET /api/cron/milestone-detection
// ------------------------------------------------------------
// Cron quotidien : pour chaque dossier dont la decision est posee
// depuis assez longtemps, va chercher sur le web les evenements
// publics survenus depuis et propose des milestones que le partner
// confirmera ou ajustera. Couvre les cadences 6 mois, 12 mois et
// opportunistes par une regle simple : 90 jours mini entre deux
// scans, scan initial 180 jours apres decision.
//
// Le cron ne saisit jamais de milestone confirmed : tous les
// milestones produits sont inseres en 'proposed' et n entrent pas
// dans l agregation de calibration tant que le partner n a pas
// valide. C est ce qui permet de capturer la realite quasi sans
// friction tout en preservant la propriete miroir : pas d hallucination
// LLM qui pollue les statistiques du fonds.
//
// Authentification : Vercel Cron envoie Authorization: Bearer
// CRON_SECRET. Sans ce header (et avec le secret defini en env),
// on refuse 401. En dev (NODE_ENV !== production) sans secret defini,
// on autorise pour permettre le test manuel.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { listOutcomesForDetection } from '@/lib/reconciliation-store';
import {
  selectEligibleForDetection,
  type DetectionCandidate,
} from '@/lib/cron/milestone-detection-selector';
import { runMilestoneDetection } from '@/lib/cron/milestone-detection-runner';

export const runtime = 'nodejs';
// Le scan LLM avec web_search peut prendre 15-30s par dossier. On
// laisse une marge confortable jusqu a maxDuration Vercel Pro
// (800s) pour absorber un batch jusqu a 8 dossiers en serie.
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

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

  const now = new Date();

  // 1. Liste plate cross-user des outcomes a scanner. Filtre invested
  //    + passed par defaut (declined/waitlisted ne necessitent pas
  //    de monitoring post-decision detaille pour la reconciliation).
  const outcomes = await listOutcomesForDetection(['invested', 'passed']);

  // 2. Map vers DetectionCandidate
  const candidates: DetectionCandidate[] = outcomes.map((o) => ({
    analysisId: o.analysisId,
    userId: o.userId,
    companyName: o.companyName,
    decision: o.decision,
    decisionDate: o.decisionDate,
    lastAutoDetectionAt: o.lastAutoDetectionAt,
    pendingProposedCount: o.pendingProposedCount,
  }));

  // 3. Selection par la doctrine (6 mois + 3 mois rescan + plafond 8)
  const eligible = selectEligibleForDetection(candidates, now);

  // 4. Iteration serielle. Saturer Anthropic en parallele ne fait
  //    qu accelerer les rate limits et compliquer le log.
  const results = [];
  for (const e of eligible) {
    const result = await runMilestoneDetection({
      analysisId: e.analysisId,
      userId: e.userId,
      companyName: e.companyName,
      decision: e.decision,
      decisionDate: e.decisionDate,
    });
    results.push(result);
  }

  return NextResponse.json({
    triggeredAt: now.toISOString(),
    candidatesCount: candidates.length,
    eligibleCount: eligible.length,
    results,
  });
}
