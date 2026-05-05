// ============================================================
// /api/auth/profile
// ------------------------------------------------------------
// PATCH : modifie le profil de l utilisateur courant
//   - display_name (user_metadata.display_name)
//   - email (declenche un mail de confirmation Supabase)
//   - password (changement direct si current_password fourni)
//
// L update email passe par auth.admin.updateUserById qui envoie
// automatiquement un mail de verification au nouvel email. Tant que
// l user n a pas clique le lien, l email n est pas effectivement change.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAuthEnabled } from '@/lib/auth';
import { getSupabaseAdminClient, getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'Auth desactivee' }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  let body: {
    displayName?: string;
    email?: string;
    newPassword?: string;
    currentPassword?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const updates: any = {};
  const userMetaUpdates: any = {};
  let emailConfirmationPending = false;

  // Display name
  if (typeof body.displayName === 'string') {
    const displayName = body.displayName.trim();
    if (displayName.length > 120) {
      return NextResponse.json({ error: 'Nom affiche trop long (max 120)' }, { status: 400 });
    }
    userMetaUpdates.display_name = displayName || null;
  }

  // Email change : declenche un mail de confirmation Supabase Auth.
  // L email actuel reste valide tant que la confirmation n est pas faite.
  if (typeof body.email === 'string' && body.email.trim() && body.email.trim() !== user.email) {
    const newEmail = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }
    updates.email = newEmail;
    emailConfirmationPending = true;
  }

  // Password : on demande l ancien pour eviter qu un session vol
  // ouvre la porte a un takeover discret. On verifie via signInWithPassword.
  if (body.newPassword) {
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Mot de passe trop court (min 8 caracteres)' },
        { status: 400 },
      );
    }
    if (!body.currentPassword) {
      return NextResponse.json(
        { error: 'Mot de passe actuel requis pour changer de mot de passe' },
        { status: 400 },
      );
    }
    // Verification du mot de passe actuel via un client server temporaire
    const verifClient = getSupabaseServerClient();
    const { error: signInErr } = await verifClient.auth.signInWithPassword({
      email: user.email,
      password: body.currentPassword,
    });
    if (signInErr) {
      return NextResponse.json(
        { error: 'Mot de passe actuel incorrect' },
        { status: 401 },
      );
    }
    updates.password = body.newPassword;
  }

  // Si rien a changer
  if (Object.keys(updates).length === 0 && Object.keys(userMetaUpdates).length === 0) {
    return NextResponse.json({ error: 'Rien a mettre a jour' }, { status: 400 });
  }

  // Application des updates user_metadata
  if (Object.keys(userMetaUpdates).length > 0) {
    updates.user_metadata = userMetaUpdates;
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, updates);
  if (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Mise a jour echouee' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    emailConfirmationPending,
    detail: emailConfirmationPending
      ? 'Un mail de confirmation a ete envoye a la nouvelle adresse. Le changement ne sera effectif qu apres validation du lien.'
      : null,
  });
}
