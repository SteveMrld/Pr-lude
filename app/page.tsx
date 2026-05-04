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
