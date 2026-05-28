// API : gestion des cles BYOK d une organisation.
//   GET    /api/api-keys           -> liste les cles configurees (masquees)
//   PUT    /api/api-keys           -> upsert une cle (body : sourceId, key)
//   DELETE /api/api-keys?sourceId  -> supprime une cle

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';
import {
  listOrgApiKeys,
  setOrgApiKey,
  deleteOrgApiKey,
} from '@/lib/auth/api-keys';
import { ensureKmsKey } from '@/lib/auth/crypto';
import { getSourceById } from '@/lib/sources';

export const dynamic = 'force-dynamic';

function requireAuthEnabled(): NextResponse | null {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'Auth requise pour les clés BYOK' },
      { status: 400 },
    );
  }
  return null;
}

export async function GET() {
  const guard = requireAuthEnabled();
  if (guard) return guard;
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const keys = await listOrgApiKeys(ctx.org.id);
  return NextResponse.json({ keys });
}

export async function PUT(req: NextRequest) {
  const guard = requireAuthEnabled();
  if (guard) return guard;
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  // Verification KMS key tot pour donner une erreur claire si manquante
  try {
    ensureKmsKey();
  } catch (e: any) {
    return NextResponse.json(
      { error: 'PRELUDE_KMS_KEY non configurée côté serveur. Voir AUTH_SETUP.md.' },
      { status: 500 },
    );
  }

  let body: { sourceId?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const sourceId = (body.sourceId || '').trim();
  const key = (body.key || '').trim();

  const desc = getSourceById(sourceId);
  if (!desc) {
    return NextResponse.json({ error: 'Source inconnue' }, { status: 400 });
  }
  if (desc.access !== 'byok' && desc.access !== 'free-byok') {
    return NextResponse.json(
      { error: 'Cette source n’attend pas de clé utilisateur' },
      { status: 400 },
    );
  }
  if (!key) {
    return NextResponse.json({ error: 'Clé vide' }, { status: 400 });
  }
  if (key.length > 4096) {
    return NextResponse.json({ error: 'Clé trop longue' }, { status: 400 });
  }

  try {
    await setOrgApiKey({
      organizationId: ctx.org.id,
      sourceId,
      plaintextKey: key,
      userId: ctx.user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Echec sauvegarde' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const guard = requireAuthEnabled();
  if (guard) return guard;
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sourceId = (searchParams.get('sourceId') || '').trim();
  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId manquant' }, { status: 400 });
  }

  try {
    await deleteOrgApiKey(ctx.org.id, sourceId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Echec suppression' },
      { status: 500 },
    );
  }
}
