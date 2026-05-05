// Page Settings : gestion des cles BYOK de l organisation.
// Server Component qui precharge la liste des cles configurees + le
// registre des sources BYOK, puis delegue le rendu au Client Component.

import { redirect } from 'next/navigation';
import {
  isAuthEnabled,
  getCurrentUser,
  getCurrentOrganization,
} from '@/lib/auth';
import { listOrgApiKeys } from '@/lib/auth/api-keys';
import { getByokSources } from '@/lib/sources';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  if (!isAuthEnabled()) {
    // Sans auth, on ne peut pas attacher des cles a une org
    redirect('/');
  }

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  const [byokSources, configuredKeys] = await Promise.all([
    Promise.resolve(getByokSources()),
    listOrgApiKeys(org.id),
  ]);

  return (
    <SettingsClient
      orgName={org.name}
      orgRole={org.role}
      userEmail={user.email}
      userDisplayName={user.displayName}
      byokSources={byokSources}
      configuredKeys={configuredKeys}
    />
  );
}
