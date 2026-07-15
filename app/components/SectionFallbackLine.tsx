'use client';

import React from 'react';

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
  /**
   * Point d entree futur pour enrichir la copie avec la cause
   * precise du gap (timeout, empty_output, failed) a partir de
   * pipeline_engines_status. Non consomme aujourd hui, propage
   * simplement a sectionFallbackCopy pour reservation d API.
   */
  enginesStatus?: Record<string, any> | null;
  engineKey?: string;
}

export default function SectionFallbackLine({
  kind = 'section-generic',
  copy,
  marginTop = 6,
  marginBottom = 12,
  enginesStatus = null,
  engineKey,
}: Props) {
  const text = copy ?? sectionFallbackCopy(kind, { enginesStatus, engineKey });
  // Data attributes discrets qui rendent le cablage observable sans
  // alterer la copie visible. data-engines-status="present" prouve que
  // la valeur non nulle est arrivee au composant. data-engine-status
  // remonte le status specifique du moteur cible s il est disponible
  // dans le snapshot. Utile a l inspecteur DOM et aux tests SSR.
  const hasStatus = enginesStatus !== null && enginesStatus !== undefined && Object.keys(enginesStatus).length > 0;
  const engineEntry = engineKey && hasStatus ? enginesStatus?.[engineKey] : null;
  const engineStatusTag = engineEntry?.status ?? null;
  return (
    <p
      className="section-fallback-line"
      data-kind={kind}
      data-engine-key={engineKey || undefined}
      data-engines-status={hasStatus ? 'present' : 'absent'}
      data-engine-status={engineStatusTag || undefined}
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
