// ============================================================
// PAGE PORTFOLIO TRAJECTOIRE DETAIL
// ------------------------------------------------------------
// Drill-down d un dossier : timeline complète des analyses
// successives, comparisons successives par paire, alertes par
// transition. Server component qui charge le détail puis rend
// le client.
// ============================================================

import { redirect, notFound } from 'next/navigation';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';
import { getPortfolioTrajectoryDetail } from '@/lib/portfolio-trajectoires';
import TrajectoireDetailClient from './TrajectoireDetailClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function TrajectoireDetailPage({ params }: PageProps) {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  const detail = await getPortfolioTrajectoryDetail(params.id);
  if (!detail) notFound();

  return (
    <TrajectoireDetailClient
      detail={detail}
      orgName={org.name}
      userEmail={user.email}
    />
  );
}
