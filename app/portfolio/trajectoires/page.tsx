// ============================================================
// PAGE PORTFOLIO TRAJECTOIRES
// ------------------------------------------------------------
// Vue liste qui place chaque dossier du fonds avec son score
// global courant, son score Fragilité, son verdict, et une
// indication discrète de la trajectoire (delta plus arrow up /
// down / stable). Tri par cran d alerte croissant et drill-down
// vers /portfolio/trajectoires/[id].
// ============================================================

import { redirect } from 'next/navigation';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';
import { listPortfolioTrajectoires } from '@/lib/portfolio-trajectoires';
import TrajectoiresClient from './TrajectoiresClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TrajectoiresPage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  const rows = await listPortfolioTrajectoires();

  return (
    <TrajectoiresClient
      rows={rows}
      orgName={org.name}
      userEmail={user.email}
    />
  );
}
