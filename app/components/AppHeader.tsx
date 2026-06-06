// ============================================================
// APP HEADER - nav globale Server Component
// ------------------------------------------------------------
// Monte en tete de body via app/layout.tsx. Recupere cote serveur
// l etat d authentification et l identite (orgName, userEmail) puis
// delegue le rendu et le calcul de l active state au HeaderClient.
//
// Trois cas :
//   1. ENABLE_AUTH absent ou faux : on rend HeaderClient en mode
//      legacy (sans identite, juste wordmark + nav + theme toggle).
//   2. ENABLE_AUTH=true et pas de session : null (la landing publique
//      ou la page /login affichent leur propre chrome).
//   3. ENABLE_AUTH=true avec user et org : HeaderClient complet.
//
// Le composant qui decide de se masquer sur les routes /login et
// /onboarding est HeaderClient (besoin de usePathname). On renvoie
// donc HeaderClient meme sur ces routes, c est lui qui fait null.
// ============================================================

import { isAuthEnabled, getCurrentUser, getCurrentOrganization } from '@/lib/auth';
import HeaderClient from './HeaderClient';

export default async function AppHeader() {
  const authEnabled = isAuthEnabled();

  if (!authEnabled) {
    return <HeaderClient authEnabled={false} />;
  }

  const user = await getCurrentUser();
  if (!user) return null;

  const org = await getCurrentOrganization(user.id);
  if (!org) return null;

  return (
    <HeaderClient
      authEnabled={true}
      userEmail={user.email}
      orgName={org.name}
    />
  );
}
