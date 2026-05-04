// ============================================================
// POST /api/slack/test
// ------------------------------------------------------------
// Envoie un message de test sur le webhook configure.
// Met a jour last_test_at / last_test_ok dans la config.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { testSlackWebhook } from '@/lib/slack-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(_req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await testSlackWebhook(ctx.org.id);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error || 'test-failed',
    }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
