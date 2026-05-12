'use client';

// ============================================================
// COMPANY LOGO
// ------------------------------------------------------------
// Pastille visuelle a cote du nom d entreprise dans les listes
// portfolio. Va chercher le logo via Clearbit (logo.clearbit.com)
// a partir du domaine derive du nom, et bascule sobrement sur un
// cercle ocre brule avec les initiales si Clearbit renvoie 404
// ou si la derivation du domaine echoue.
//
// Le composant gere son propre etat de chargement et d erreur,
// jamais il ne bloque ni ne fait flickerer la grille parente :
//   - tant que le logo n est pas charge, on rend le fallback
//     initiales (l image se superpose ensuite sans CLS car les
//     dimensions sont fixees par la prop size)
//   - en cas d erreur reseau ou 404, on reste sur le fallback
//   - si aucun domaine ne peut etre derive, on saute direct au
//     fallback sans tenter de requete
//
// Pas de prop URL externe (on derive en interne), pas de prop
// couleur (palette fixee par la doctrine UI). On expose juste la
// taille pour adapter le rendu au contexte d affichage.
// ============================================================

import { useMemo, useState } from 'react';
import { clearbitLogoUrl, deriveDomainFromName, getInitials } from '@/lib/company-logo';

interface Props {
  companyName: string | null | undefined;
  /**
   * Domaine web explicite si connu (champ website d une analyse).
   * Si absent, on infere depuis companyName.
   */
  domain?: string | null;
  /**
   * Taille du carre en pixels. Defaut 28px, adapte aux lignes de
   * liste editoriale. Pour les badges plus generaux (en-tete d une
   * card detail), passer 40 ou 48.
   */
  size?: number;
}

export function CompanyLogo({ companyName, domain, size = 28 }: Props) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const resolvedDomain = useMemo(() => {
    if (domain && domain.trim().length > 0) return domain.trim();
    return deriveDomainFromName(companyName);
  }, [domain, companyName]);

  const initials = useMemo(() => getInitials(companyName), [companyName]);

  const showLogo = resolvedDomain && !hasError;
  const fontSize = Math.max(10, Math.round(size * 0.36));

  return (
    <span
      className="cl"
      style={{ width: size, height: size, fontSize }}
      aria-hidden="true"
    >
      <span className={`cl-fallback ${isLoaded ? 'cl-fallback-hidden' : ''}`}>
        {initials}
      </span>
      {showLogo && (
        <img
          src={clearbitLogoUrl(resolvedDomain!)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setHasError(true)}
          onLoad={() => setIsLoaded(true)}
          className={`cl-img ${isLoaded ? 'cl-img-loaded' : ''}`}
        />
      )}
      <style jsx>{`
        .cl {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 50%;
          overflow: hidden;
          background: var(--paper-warm, #fef7f4);
          line-height: 1;
          font-family: var(--sans, system-ui, sans-serif);
        }
        .cl-fallback {
          position: absolute;
          inset: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--ocre-brule, #b45309);
          color: #fffaf0;
          font-weight: 600;
          letter-spacing: 0.02em;
          transition: opacity 160ms ease;
        }
        .cl-fallback-hidden {
          opacity: 0;
        }
        .cl-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #ffffff;
          opacity: 0;
          transition: opacity 160ms ease;
        }
        .cl-img-loaded {
          opacity: 1;
        }
      `}</style>
    </span>
  );
}
