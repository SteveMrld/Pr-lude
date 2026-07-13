'use client';

// ============================================================
// SectionFallbackLine
// ------------------------------------------------------------
// Ligne neutre unique pour toute section dont le contenu n est
// pas resolu au moment du rendu fige. Rend une phrase courte,
// italique discrete, dans la teinte muted du theme. Aucune
// mention technique, aucun spinner, aucun imperatif.
//
// Doctrine "jamais d etat non resolu au rendu" :
//   - Un titre nu sans corps recoit cette ligne.
//   - Une section a chargement asynchrone en rendu fige (print,
//     export PDF, view note) rend cette ligne plutot que son
//     spinner.
//   - Une section volontairement masquee (comparables en attente
//     de reparation du hard filter) rend cette ligne aussi.
//
// Source de la copie : lib/note/section-fallback.ts.
// ============================================================

import { sectionFallbackCopy, type SectionKind } from '@/lib/note/section-fallback';

interface Props {
  kind?: SectionKind;
  /**
   * Copie override si la ligne doit exprimer un cas specifique
   * non prevu dans le catalogue. A eviter : preferer ajouter la
   * variante dans section-fallback.ts pour garder la source unique.
   */
  copy?: string;
  /**
   * Marge verticale ajustable pour s inserer proprement dans
   * differents contextes (interieur d une card, sous un h3, sous
   * un h4). Defaut sobre.
   */
  marginTop?: number;
  marginBottom?: number;
}

export default function SectionFallbackLine({
  kind = 'section-generic',
  copy,
  marginTop = 6,
  marginBottom = 12,
}: Props) {
  const text = copy ?? sectionFallbackCopy(kind);
  return (
    <p
      className="section-fallback-line"
      style={{
        marginTop,
        marginBottom,
        fontSize: 13,
        fontStyle: 'italic',
        color: 'var(--muted, #6e6c66)',
        lineHeight: 1.55,
      }}
    >
      {text}
    </p>
  );
}
