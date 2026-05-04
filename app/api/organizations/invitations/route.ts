// API : gestion des invitations a une organisation.
//   GET    /api/organizations/invitations           -> liste les invitations de l org courante
//   POST   /api/organizations/invitations           -> cree une invitation (body: email, role)
//   DELETE /api/organizations/invitations?id=...    -> revoque une invitation pending
//
// Lecture et ecriture reservees aux administrateurs de l organisation.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';
import {
  listOrgInvitations,
  createInvitation,
  revokeInvitation,
  type OrgRole,
} from '@/lib/team-store';

export const dynamic = 'force-dynamic';

function requireAuthEnabled(): NextResponse | null {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'Auth requise pour la gestion des invitations' },
      { status: 400 },
    );
  }
  return null;
}

export async function GET() {
  const guard = requireAuthEnabled();
  if (guard) return guard;
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  if (ctx.org.role !== 'admin') {
    return NextResponse.json({ error: 'Reserve aux administrateurs' }, { status: 403 });
  }

  const invitations = await listOrgInvitations(ctx.org.id);
  return NextResponse.json({ invitations });
}

export async function POST(req: NextRequest) {
  const guard = requireAuthEnabled();
  if (guard) return guard;
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  if (ctx.org.role !== 'admin') {
    return NextResponse.json({ error: 'Reserve aux administrateurs' }, { status: 403 });
  }

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const email = (body.email || '').trim();
  const role = (body.role as OrgRole) || 'member';

  if (!email) {
    return NextResponse.json({ error: 'Email manquant' }, { status: 400 });
  }

  const result = await createInvitation({
    organizationId: ctx.org.id,
    emailRaw: email,
    role,
    invitedBy: ctx.user.id,
  });
  if (!result.ok) {
    const errMsg = result.error || 'Echec creation invitation';
    const status = errMsg.includes('deja') ? 409 : 400;
    return NextResponse.json({ error: errMsg }, { status });
  }

  return NextResponse.json({ invitation: result.invitation });
}

export async function DELETE(req: NextRequest) {
  const guard = requireAuthEnabled();
  if (guard) return guard;
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  if (ctx.org.role !== 'admin') {
    return NextResponse.json({ error: 'Reserve aux administrateurs' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get('id') || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 });
  }

  const result = await revokeInvitation({
    invitationId: id,
    organizationId: ctx.org.id,
    revokedBy: ctx.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Echec' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
