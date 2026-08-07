// ============================================================
// PRELUDE - BandeauTrajectoire (note d instruction)
// ------------------------------------------------------------
// Bandeau d alerte en tete de note quand une alerte de cran 1 ou 2 a
// ete declenchee sur la transition entre la version precedente et la
// version courante. Meme grammaire que le bandeau gouvernance : raison
// editoriale courte, recommandation, citations factuelles pour audit.
//
// Les alertes de cran 3, digest hebdomadaire, et 4, passif UI, ne
// remontent pas ici ; elles vivent dans les annotations en marge des
// sections concernees.
//
// Extrait de InvestmentNoteView le 7 aout 2026, lot 2 du chantier de
// decoupage.
//
// CE BLOC EST LE SEUL DU LOT QUE LE HARNAIS DE CORPUS NE PEUT PAS
// EXERCER. Sa condition depend d un etat alimente par un `useEffect`
// qui interroge une route, et les effets ne s executent pas en rendu
// serveur : zero note sur cinquante-six le declenche, et aucun corpus
// n y changerait rien. C est un zero d instrument et non un zero de
// corpus, et les deux ne se traitent pas pareil.
//
// La verification a donc ete faite par un avant-apres sur un cas
// construit, en forcant la baseline dans une copie de travail du parent
// et en rendant la note avec la meme alteration des deux cotes.
// L alteration n a jamais ete posee dans le code de production : c est
// ce qui distingue ce procede d une couture de test, qui aurait fait
// porter au produit le cout de sa propre verification.
// ============================================================

'use client';

import React from 'react';

export interface BandeauTrajectoireProps {
  /**
   * La baseline de trajectoire, ou null quand il n y en a pas. Le
   * composant rend null dans ce cas plutot que de laisser l appelant
   * porter la condition : le seuil qui declenche le bandeau, cran 1 ou
   * 2 et non 3 ou 4, est une propriete du bandeau.
   */
  banner: {
    cran: number;
    raison: string;
    recommandation: string;
    citations: string[];
    additionalCriticalCount?: number;
  } | null | undefined;
}

export function BandeauTrajectoire({ banner }: BandeauTrajectoireProps): React.ReactElement | null {
  if (!banner) return null;
const b = banner;
  const palette = b.cran === 1
    ? { ink: '#7a2916', bg: 'rgba(122, 41, 22, 0.05)' }
    : { ink: '#8a4a17', bg: 'rgba(138, 74, 23, 0.05)' };
  return (
    <section
      aria-label="Alerte trajectoire"
      style={{
        margin: '12px 0 16px',
        padding: '14px 18px',
        borderLeft: `3px solid ${palette.ink}`,
        background: palette.bg,
        fontFamily: 'var(--serif)',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.ink, fontWeight: 600, marginBottom: 8 }}>
        Alerte trajectoire · Cran {b.cran}
        {b.additionalCriticalCount > 0 && (
          <span style={{ marginLeft: 8, opacity: 0.7, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            plus {b.additionalCriticalCount} autre{b.additionalCriticalCount > 1 ? 's' : ''} alerte{b.additionalCriticalCount > 1 ? 's' : ''} critique{b.additionalCriticalCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.55, margin: 0, marginBottom: 6 }}>
        {b.raison}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.92 }}>
        {b.recommandation}
      </p>
      {b.citations.length > 0 && (
        <p style={{ fontSize: 12, lineHeight: 1.55, marginTop: 8, marginBottom: 0, fontStyle: 'italic', opacity: 0.7 }}>
          {b.citations.join(' · ')}
        </p>
      )}
    </section>
  );
      
}

export default BandeauTrajectoire;
