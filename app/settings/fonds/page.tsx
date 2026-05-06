// Page Settings > Profil fonds : these d investissement de l organisation.
// Server Component qui precharge le profil existant et delegue au Client.

import { redirect } from 'next/navigation';
import {
  isAuthEnabled,
  getCurrentUser,
  getCurrentOrganization,
} from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import FundProfileClient from './FundProfileClient';

export const dynamic = 'force-dynamic';

interface FundProfileRow {
  organization_id: string;
  sectors_focus: string[];
  sectors_excluded: string[];
  geographies_focus: string[];
  geographies_excluded: string[];
  ticket_min_eur: number | null;
  ticket_max_eur: number | null;
  stages_focus: string[];
  notes: string | null;
  updated_at: string;
}

export default async function FundProfilePage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  // Precharge le profil. Si jamais configure, on passe null et l UI
  // affiche un ecran de saisie initiale.
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('fund_profiles')
    .select('*')
    .eq('organization_id', org.id)
    .maybeSingle();

  const initialProfile = data
    ? {
        sectorsFocus: (data as FundProfileRow).sectors_focus || [],
        sectorsExcluded: (data as FundProfileRow).sectors_excluded || [],
        geographiesFocus: (data as FundProfileRow).geographies_focus || [],
        geographiesExcluded: (data as FundProfileRow).geographies_excluded || [],
        ticketMinEur: (data as FundProfileRow).ticket_min_eur,
        ticketMaxEur: (data as FundProfileRow).ticket_max_eur,
        stagesFocus: (data as FundProfileRow).stages_focus || [],
        notes: (data as FundProfileRow).notes,
        updatedAt: (data as FundProfileRow).updated_at,
      }
    : null;

  return (
    <FundProfileClient
      orgName={org.name}
      orgRole={org.role}
      initialProfile={initialProfile}
    />
  );
}
