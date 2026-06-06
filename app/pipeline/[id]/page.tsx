// ============================================================
// PAGE PIPELINE - URL canonique d un run d analyse en cours
// ------------------------------------------------------------
// /pipeline/[id] est l URL canonique pendant qu un pipeline tourne.
// Elle apparait au partner via history.replaceState declenche par
// HomeClient au signal SSE analysis-created (juste apres le POST
// /api/analyze depuis l accueil). Le stream survit a ce changement
// d URL parce qu il s agit d un replaceState et non d une vraie
// navigation Next.
//
// Cas d entree :
//   1. Le partner vient d ailleurs (flux naturel depot -> live) :
//      cette page n est jamais vraiment montee, le DOM affiche deja
//      la vue pipeline depuis l accueil. Le replaceState ne demonte
//      pas.
//   2. Le partner bookmark l URL pendant un run (rare) : la page se
//      monte, on detecte si l analyse est deja complete cote serveur,
//      on redirige vers /dossiers/[id] si c est le cas. Sinon on
//      monte HomeClient en mode lecture qui re-affichera l etat
//      derniere persistance.
//
// Ce design garde la promesse "trois URLs distinctes pour les trois
// phases" sans toucher au stream SSE existant.
// ============================================================

import { redirect } from 'next/navigation';
import HomeClient from '@/app/HomeClient';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PipelinePage({ params }: { params: { id: string } }) {
  if (!isAuthEnabled()) {
    return <HomeClient initialAnalysisId={params.id} />;
  }

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const org = await getCurrentOrganization(user.id);
  if (!org) redirect('/onboarding');

  // Verification cote serveur : si l analyse est deja persistee complete,
  // /pipeline/[id] n a plus de sens, on redirige vers /dossiers/[id].
  // Couvre le cas du bookmark de l URL pipeline consultee a froid.
  try {
    const { getSupabaseAdminClient } = await import('@/lib/supabase/server');
    const admin = getSupabaseAdminClient();
    const { data } = await admin
      .from('analyses')
      .select('result_json')
      .eq('id', params.id)
      .maybeSingle();
    if (data?.result_json) {
      redirect(`/dossiers/${params.id}`);
    }
  } catch {
    // Erreur Supabase : on rend la page sans rediriger, HomeClient
    // gerera le chargement et signalera l erreur a l utilisateur.
  }

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
