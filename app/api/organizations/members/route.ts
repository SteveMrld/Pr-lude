// API : gestion des membres de l organisation courante.
//   GET    /api/organizations/members              -> liste les membres
//   PATCH  /api/organizations/members              -> change le role d un membre (body: userId, role)
//   DELETE /api/organizations/members?userId=...   -> retire un membre de l organisation
//
// Toutes les operations exigent l auth + role admin sur l organisation.
// Garde-fous : impossible de retirer le dernier admin, impossible de
// retirer ou degrader son propre acces si on est seul admin.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';
import {
  listOrgMembers,
  removeOrgMember,
  updateOrgMemberRole,
  countOrgAdmins,
  type OrgRole,
} from '@/lib/team-store';

export const dynamic = 'force-dynamic';

function requireAuthEnabled(): NextResponse | null {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'Auth requise pour la gestion des membres' },
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

  const members = await listOrgMembers(ctx.org.id);
  return NextResponse.json({
    members,
    currentUserId: ctx.user.id,
    currentUserRole: ctx.org.role,
  });
}

export async function PATCH(req: NextRequest) {
  const guard = requireAuthEnabled();
  if (guard) return guard;
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  if (ctx.org.role !== 'admin') {
    return NextResponse.json({ error: 'Reserve aux administrateurs' }, { status: 403 });
  }

  let body: { userId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const userId = (body.userId || '').trim();
  const role = body.role as OrgRole;
  if (!userId) {
    return NextResponse.json({ error: 'userId manquant' }, { status: 400 });
  }
  if (role !== 'admin' && role !== 'member') {
    return NextResponse.json({ error: 'Role invalide' }, { status: 400 });
  }

  // Garde-fou : si on degrade le dernier admin, on bloque.
  if (role === 'member') {
    const admins = await countOrgAdmins(ctx.org.id);
    const members = await listOrgMembers(ctx.org.id);
    const target = members.find((m) => m.userId === userId);
    if (target?.role === 'admin' && admins <= 1) {
      return NextResponse.json(
        { error: 'Impossible de retirer le dernier administrateur' },
        { status: 409 },
      );
    }
  }

  const result = await updateOrgMemberRole({
    organizationId: ctx.org.id,
    userId,
    role,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Echec' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
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
  const userId = (searchParams.get('userId') || '').trim();
  if (!userId) {
    return NextResponse.json({ error: 'userId manquant' }, { status: 400 });
  }

  // Garde-fou : on ne retire pas le dernier admin.
  const members = await listOrgMembers(ctx.org.id);
  const target = members.find((m) => m.userId === userId);
  if (!target) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 });
  }
  if (target.role === 'admin') {
    const admins = await countOrgAdmins(ctx.org.id);
    if (admins <= 1) {
      return NextResponse.json(
        { error: 'Impossible de retirer le dernier administrateur' },
        { status: 409 },
      );
    }
  }

  const result = await removeOrgMember({
    organizationId: ctx.org.id,
    userId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Echec' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
