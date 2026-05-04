// Page Settings -> Membres : gestion des membres et invitations.
// Server Component qui verifie l auth, le role admin, et precharge la
// liste des membres et invitations. Le rendu et les interactions sont
// delegues a MembersClient.

import { redirect } from 'next/navigation';
import {
  isAuthEnabled,
  getCurrentUser,
  getCurrentOrganization,
} from '@/lib/auth';
import { listOrgMembers, listOrgInvitations } from '@/lib/team-store';
import MembersClient from './MembersClient';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  // Lecture seule pour les non-admins : ils voient la liste mais ne peuvent
  // ni inviter ni retirer.
  const [members, invitations] = await Promise.all([
    listOrgMembers(org.id),
    org.role === 'admin' ? listOrgInvitations(org.id) : Promise.resolve([]),
  ]);

  return (
    <MembersClient
      orgName={org.name}
      orgRole={org.role}
      currentUserId={user.id}
      currentUserEmail={user.email}
      initialMembers={members}
      initialInvitations={invitations}
    />
  );
}
