'use client';

// ============================================================
// HEADER CLIENT - rendu nav globale
// ------------------------------------------------------------
// Recoit l identite (orgName, userEmail) calculee cote serveur par
// AppHeader. Calcule l active state via usePathname, gere la
// deconnexion et le theme toggle. Se masque sur les routes hors
// session (/login, /onboarding) ou la nav globale n a pas de sens.
//
// Quatre entrees de premier niveau dans l ordre editorial :
// Accueil, Historique, Portefeuille, Reglages. Le libelle reste
// Historique meme apres le renommage de la route en /deal-flow
// (Phase 4), c est une decision de produit.
// ============================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

interface Props {
  authEnabled: boolean;
  userEmail?: string;
  orgName?: string;
}

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

// L item Accueil capte aussi les routes derivees /pipeline/[id] et
// /dossiers/[id] qui seront introduites au decoupage HomeClient
// (Phase 3) : sur ces ecrans le partner est toujours en train
// d instruire un dossier, ce qui releve de l Accueil dans le mental
// model. Idem Historique capte /deal-flow apres le renommage.
const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Accueil',
    match: (p) =>
      p === '/' || p.startsWith('/pipeline') || p.startsWith('/dossiers'),
  },
  {
    href: '/history',
    label: 'Historique',
    match: (p) => p.startsWith('/history') || p.startsWith('/deal-flow'),
  },
  {
    href: '/portfolio',
    label: 'Portefeuille',
    match: (p) => p.startsWith('/portfolio') || p.startsWith('/portefeuille'),
  },
  {
    href: '/settings',
    label: 'Réglages',
    match: (p) => p.startsWith('/settings'),
  },
];

export default function HeaderClient({ authEnabled, userEmail, orgName }: Props) {
  const pathname = usePathname() || '/';

  if (pathname.startsWith('/login') || pathname.startsWith('/onboarding')) {
    return null;
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <header className="header app-header">
      <Link href="/" className="brand-link" aria-label="Prélude, accueil">
        <div className="brand">Prélude</div>
        <div className="brand-meta">Plateforme d&apos;instruction VC</div>
      </Link>

      <nav className="header-nav" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`header-nav-link${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {authEnabled && orgName ? (
        <div className="header-identity">
          <div className="header-org">{orgName}</div>
          {userEmail && <div className="header-user">{userEmail}</div>}
          <div className="header-actions">
            <button
              className="header-action"
              onClick={handleLogout}
              aria-label="Se déconnecter"
            >
              Déconnexion
            </button>
            <ThemeToggle />
          </div>
        </div>
      ) : (
        <div className="header-identity">
          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
