// API : acceptation d une invitation par l utilisateur connecte.
//   POST /api/organizations/invitations/accept   (body: invitationId)
//
// L utilisateur doit etre authentifie ; l email de l invitation doit
// correspondre exactement (lowercased) a son email de session.
// L acceptation cree le membership et marque l invitation accepted.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAuthEnabled } from '@/lib/auth';
import { acceptInvitation } from '@/lib/team-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'Auth requise' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  let body: { invitationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const invitationId = (body.invitationId || '').trim();
  if (!invitationId) {
    return NextResponse.json({ error: 'invitationId manquant' }, { status: 400 });
  }

  const result = await acceptInvitation({
    invitationId,
    userId: user.id,
    userEmail: user.email,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Echec' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, organizationId: result.organizationId });
}
