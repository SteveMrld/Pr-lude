// ============================================================
// PAGE PORTFOLIO
// ------------------------------------------------------------
// Dashboard agrege de l activite du fonds. Server component qui
// charge les stats au mount et passe au client. Pas de loading state
// cote client : Next.js streame le HTML une fois la query Supabase
// terminee.
// ============================================================

import { redirect } from 'next/navigation';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';
import { getPortfolioStats } from '@/lib/portfolio-stats';
import PortfolioClient from './PortfolioClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  const stats = await getPortfolioStats();

  return (
    <PortfolioClient
      stats={stats}
      orgName={org.name}
      userEmail={user.email}
    />
  );
}
