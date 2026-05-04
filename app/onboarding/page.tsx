// /onboarding (server)
// Detecte les invitations pending pour l email de l user connecte et
// les passe au client component pour proposer Rejoindre [org] avant
// le formulaire de creation d organisation.

import { redirect } from 'next/navigation';
import {
  isAuthEnabled,
  getCurrentUser,
  getCurrentOrganization,
} from '@/lib/auth';
import { listInvitationsForEmail, normalizeEmail } from '@/lib/team-store';
import OnboardingClient, { type PendingInvitation } from './OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Si l user a deja une org, il n a rien a faire ici.
  const org = await getCurrentOrganization(user.id);
  if (org) {
    redirect('/');
  }

  // Charge les invitations pending pour l email exact (lowercased).
  const emailLc = normalizeEmail(user.email);
  const rawInvitations = await listInvitationsForEmail(emailLc);

  const pendingInvitations: PendingInvitation[] = rawInvitations.map((inv) => ({
    id: inv.id,
    organizationId: inv.organizationId,
    organizationName: inv.organizationName || 'Organisation',
    role: inv.role,
    invitedByEmail: inv.invitedByEmail,
    createdAt: inv.createdAt,
  }));

  return (
    <OnboardingClient
      userEmail={user.email}
      pendingInvitations={pendingInvitations}
    />
  );
}
