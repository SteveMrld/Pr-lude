'use client';

// ============================================================
// THEME TOGGLE
// ------------------------------------------------------------
// Bouton trois etats : clair, sombre, systeme. Persistance dans
// localStorage sous la cle prelude_theme. Le script d initiali-
// sation pose dans app/layout.tsx applique deja le theme avant
// le premier paint, donc ce composant ne fait que :
//   1. lire l etat courant depuis localStorage au montage
//   2. cycler entre les trois etats au clic
//   3. ecrire dans localStorage et appliquer data-theme sur html
//
// Ne s affiche pas en mode print (export PDF) pour ne pas
// polluer le rendu.
// ============================================================

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem('prelude_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('prelude_theme', theme);
  } catch {}
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  function cycleTheme() {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    applyTheme(next);
  }

  // Pour eviter un mismatch SSR/client, on ne rend rien tant que
  // le composant n est pas monte. La taille reservee evite un
  // saut visuel quand le bouton apparait.
  if (!mounted) {
    return <div className="theme-toggle-placeholder" aria-hidden="true" />;
  }

  const label = theme === 'light' ? 'Clair' : theme === 'dark' ? 'Sombre' : 'Système';
  const icon = theme === 'light' ? '☀' : theme === 'dark' ? '☾' : '◐';
  const titleAttr = `Thème actuel : ${label}. Cliquer pour cycler clair / sombre / système.`;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="theme-toggle"
      title={titleAttr}
      aria-label={titleAttr}
    >
      <span className="theme-toggle-icon" aria-hidden="true">{icon}</span>
      <span className="theme-toggle-label">{label}</span>
    </button>
  );
}
