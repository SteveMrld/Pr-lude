// ============================================================
// PAGE RECONCILIATION
// ------------------------------------------------------------
// Bloc E3.3 - Vue de reconciliation prediction vs reality.
// Server component qui charge la reconciliation portfolio au
// premier load. L onglet Dossier fetch en client lors de la
// selection d un dossier.
// ============================================================

import { redirect } from 'next/navigation';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';
import { getPortfolioReconciliation } from '@/lib/reconciliation-aggregator';
import { listAnalyses } from '@/lib/analysis-store';
import ReconciliationClient from './ReconciliationClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ReconciliationPage() {
  if (!isAuthEnabled()) {
    redirect('/');
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  // Charge la reconciliation portfolio au premier load
  const portfolio = await getPortfolioReconciliation(user.id);

  // Charge la liste des dossiers pour le selector dossier
  const analyses = await listAnalyses({ limit: 100 });
  const dossiersList = (analyses || []).map((a: any) => ({
    id: a.id,
    companyName: a.companyName,
    createdAt: a.createdAt,
  }));

  return (
    <ReconciliationClient
      portfolio={portfolio}
      dossiersList={dossiersList}
      orgName={org.name}
      userEmail={user.email}
    />
  );
}
