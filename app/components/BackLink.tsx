'use client';

// ============================================================
// BACK LINK - Affordance de retour uniforme
// ------------------------------------------------------------
// Composant partage pour la navigation retour sur toutes les pages
// autonomes (historique, secteurs, trajectoires, reglages, etc.).
// Style sobre, calque sur le pattern existant pf-back utilise dans
// PortfolioClient : sans-serif, 11px, lettrage espace, ocre brule en
// hover. Utilise next/link pour la nav soft avec prefetch, evite la
// degradation FOUC d une nav navigateur dure.
//
// Convention : la prop href pointe vers la page parent ou racine. Le
// label par defaut est "Retour" mais accepte une variante explicite
// pour les contextes ou la cible est utile a nommer ("Portefeuille",
// "Reglages").
// ============================================================

import Link from 'next/link';

interface Props {
  href: string;
  label?: string;
}

export function BackLink({ href, label = 'Retour' }: Props) {
  return (
    <Link href={href} className="prelude-back-link">
      <span aria-hidden="true">←</span>
      <span>{label}</span>
      <style jsx>{`
        :global(.prelude-back-link) {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          text-decoration: none;
          transition: color 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        :global(.prelude-back-link:hover) {
          color: var(--accent);
        }
      `}</style>
    </Link>
  );
}
