// ============================================================
// PAGE DOSSIER - URL canonique d une analyse rendue
// ------------------------------------------------------------
// /dossiers/[id] est la route de lecture d un dossier dans son
// etat note IC complete : extraction, moteurs, recommandation,
// onglets de fabrique. C est la cible des liens depuis l Historique
// et la destination du redirect automatique a la fin du run live
// declenche sur /pipeline/[id].
//
// La page est server : auth + redirect en cas de session manquante,
// puis montage de HomeClient en mode lecture (prop initialAnalysisId).
// HomeClient charge l analyse via /api/analyses/[id] et bascule sur
// son mode dashboard onglets. Aucun stream SSE n est ouvert pour
// les dossiers deja persistes.
//
// Retro-compat : l ancienne URL /?analysis=ID redirige vers cette
// route depuis app/page.tsx pour preserver les bookmarks.
// ============================================================

import { redirect } from 'next/navigation';
import HomeClient from '@/app/HomeClient';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DossierPage({ params }: { params: { id: string } }) {
  if (!isAuthEnabled()) {
    return <HomeClient initialAnalysisId={params.id} />;
  }

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  return (
    <HomeClient
      authEnabled={true}
      userEmail={user.email}
      userId={user.id}
      orgName={org.name}
      userRole={org.role}
      initialAnalysisId={params.id}
    />
  );
}
