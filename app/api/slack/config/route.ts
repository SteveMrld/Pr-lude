// ============================================================
// /api/slack/config
// ------------------------------------------------------------
// GET    : recupere la config publique (webhook masque)
// PUT    : cree ou met a jour la config (webhook complet)
// DELETE : supprime la config (desactive Slack pour l org)
//
// Necessite auth + appartenance a une org. En mode solo, Slack
// n a pas de sens donc routes 403.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getSlackConfigPublic,
  upsertSlackConfig,
  deleteSlackConfig,
} from '@/lib/slack-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(_req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const config = await getSlackConfigPublic(ctx.org.id);
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const webhookUrl = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
  if (!webhookUrl.startsWith('https://hooks.slack.com/services/')) {
    return NextResponse.json({
      error: 'invalid-webhook',
      detail: 'L URL doit commencer par https://hooks.slack.com/services/',
    }, { status: 400 });
  }

  const ok = await upsertSlackConfig({
    organizationId: ctx.org.id,
    webhookUrl,
    channelName: typeof body.channelName === 'string' ? body.channelName : null,
    defaultPartnerMention: typeof body.defaultPartnerMention === 'string' ? body.defaultPartnerMention : null,
    alertThresholdScore: typeof body.alertThresholdScore === 'number' ? body.alertThresholdScore : 50,
    notifyOnCriticalVerdict: body.notifyOnCriticalVerdict !== false,
    notifyOnHighBlindspot: body.notifyOnHighBlindspot !== false,
    enabled: body.enabled !== false,
    createdBy: ctx.user.id,
  });

  if (!ok) {
    return NextResponse.json({ error: 'save-failed' }, { status: 500 });
  }
  const config = await getSlackConfigPublic(ctx.org.id);
  return NextResponse.json({ saved: true, config });
}

export async function DELETE(_req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'auth-required' }, { status: 403 });
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ok = await deleteSlackConfig(ctx.org.id);
  if (!ok) {
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
