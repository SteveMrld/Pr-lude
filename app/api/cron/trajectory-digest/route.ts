// ============================================================
// GET /api/cron/trajectory-digest
// ------------------------------------------------------------
// Cron hebdomadaire (lundi matin) : agrege toutes les alertes cran 3
// produites sur la semaine ecoulee sur les dossiers in-portfolio,
// puis envoie un digest editorial par partner. Le formatage passe
// par formatWeeklyDigestEmail (voix Le Grand Continent, prose dense,
// pas de tableau austere).
//
// Authentification : meme schema que le cron de re-analyse,
// Authorization: Bearer <CRON_SECRET>. La route refuse les requetes
// non signees en production.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { isPersistenceEnabled } from '@/lib/analysis-store';
import { runWeeklyDigest } from '@/lib/cron/trajectory-weekly-digest';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function resolveEmail(userId: string): Promise<string | null> {
  const fallback = process.env.PRELUDE_PARTNER_EMAIL || null;
  if (process.env.ENABLE_AUTH !== 'true') return fallback;
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return fallback;
    return data.user.email;
  } catch {
    return fallback;
  }
}

function dossierUrl(analysisId: string): string {
  const base =
    process.env.PRELUDE_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://prelude.app');
  return `${base}/?dossier=${encodeURIComponent(analysisId)}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 503 });
  }

  const now = new Date();
  const result = await runWeeklyDigest(now, 7, resolveEmail, dossierUrl);

  return NextResponse.json({
    triggeredAt: now.toISOString(),
    ...result,
  });
}
