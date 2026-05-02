// Server Component d entree. Ne fait que de l orchestration auth :
//   - Si ENABLE_AUTH absent ou faux : rend HomeClient sans props (legacy)
//   - Si ENABLE_AUTH=true et pas de session : le middleware aura redirige
//     vers /login avant qu on arrive ici, donc cas impossible
//   - Si ENABLE_AUTH=true et user sans org : redirect /onboarding
//   - Si ENABLE_AUTH=true et user + org : rend HomeClient avec props identite
//
// Toute la logique d analyse reste dans HomeClient (Client Component).

import { redirect } from 'next/navigation';
import HomeClient from './HomeClient';
import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';

export default async function Home() {
  if (!isAuthEnabled()) {
    return <HomeClient />;
  }

  const user = await getCurrentUser();
  if (!user) {
    // Cas defensif. Le middleware doit avoir redirige avant.
    redirect('/login');
  }

  const org = await getCurrentOrganization(user.id);
  if (!org) {
    redirect('/onboarding');
  }

  return (
    <HomeClient
      authEnabled={true}
      userEmail={user.email}
      orgName={org.name}
    />
  );
}
