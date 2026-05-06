// Server Component d entree. Orchestration auth :
//   - Si ENABLE_AUTH absent ou faux : rend HomeClient (legacy/dev).
//   - Si ENABLE_AUTH=true et pas de session : rend la landing publique
//     (page de pitch). Le middleware ne redirige plus / vers /login.
//   - Si ENABLE_AUTH=true et user sans org : redirect /onboarding.
//   - Si ENABLE_AUTH=true et user + org : rend HomeClient avec props identite.
//
// Toute la logique d analyse reste dans HomeClient (Client Component).
// La landing est dans app/components/LandingPage.tsx.

import { redirect } from 'next/navigation';
import HomeClient from './HomeClient';
import LandingPage from './components/LandingPage';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';

export default async function Home() {
  if (!isAuthEnabled()) {
    return <HomeClient />;
  }

  const user = await getCurrentUser();
  if (!user) {
    // Pas de session : on montre la landing pitch publique. Le visiteur
    // peut decider de cliquer sur Lancer une instruction qui l envoie
    // vers /login.
    return <LandingPage />;
  }

  const org = await getCurrentOrganization(user.id);
  if (!org) {
    redirect('/onboarding');
  }

  // Verifie que la these du fonds est renseignee avant de laisser
  // l utilisateur lancer une analyse. Sans these, le pre-scan ne peut
  // pas evaluer le fit sectoriel/geographique/ticket/stade et tourne
  // en mode degrade (6 tests universels au lieu de 10). On force donc
  // l onboarding profil fonds des la premiere connexion d un nouveau
  // fonds, pour materialiser que la these est un pre-requis structurel
  // de Prelude, pas un setting optionnel.
  //
  // Une these est consideree comme renseignee des qu une ligne existe
  // pour l org dans fund_profiles, meme si tous les tableaux sont
  // vides. C est suffisant : le fonds a fait acte de configuration,
  // meme s il choisit le mode generaliste pur. Le check ci-dessous
  // ne redirige donc QUE si le profil n a jamais ete cree.
  //
  // Le redirect ne s applique pas aux super-admins Prelude (Steve +
  // ops) qui peuvent avoir besoin d acceder au pipeline pour debug
  // sans avoir configure un profil sur leur org de test.
  const { getSupabaseAdminClient } = await import('@/lib/supabase/server');
  const { isSuperAdmin } = await import('@/lib/auth');
  const isOpsUser = await isSuperAdmin(user.id);
  if (!isOpsUser) {
    const admin = getSupabaseAdminClient();
    const { data: profileRow } = await admin
      .from('fund_profiles')
      .select('organization_id')
      .eq('organization_id', org.id)
      .maybeSingle();
    if (!profileRow) {
      redirect('/settings/fonds?onboarding=1');
    }
  }

  return (
    <HomeClient
      authEnabled={true}
      userEmail={user.email}
      userId={user.id}
      orgName={org.name}
      userRole={org.role}
    />
  );
}
