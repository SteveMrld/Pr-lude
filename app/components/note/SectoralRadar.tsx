// ============================================================
// PRELUDE - SectoralRadar (note d instruction)
// ------------------------------------------------------------
// Bloc radar de la section methodologique de la note. Rend le
// mini polygone spider chart, la caption editoriale au-dessus
// (secteur primaire, date de la fiche, secteurs secondaires si
// pertinents), et sert les mentions textuelles sobres pour les
// modes degrades (unknown_sector, expired, no_brief).
//
// Extrait de InvestmentNoteView.tsx pour deux raisons :
//
//   1. Isoler la logique radar sectoriel, la seule zone du note
//      view qui manipule directement le SectoralContext et ses
//      quatre modes ; cette isolation clarifie le contrat entre
//      la note et le Sectoral Intelligence Layer.
//   2. Degrossir le monolithe InvestmentNoteView (6500+ lignes)
//      en sortant une brique autonome, testable et reutilisable.
//
// Regle structurelle : le titre du secteur et le sous-titre
// "Fiche du [date]" sont rendus EXCLUSIVEMENT dans la caption
// semantique ci-dessous, jamais dans le SVG. Le module visuel
// spiderweb l applique de son cote. Toute duplication ferait
// deborder le libellé dans la zone de trace du polygone, ce que
// la doctrine interdit.
// ============================================================

'use client';

import React from 'react';
import { SectoralSpiderChart } from '../sectoral';
import type { SectoralRenderMode } from '../sectoral';
import { SECTORS as SECTORAL_SECTORS } from '@/lib/engines/sectoral-intelligence/types';
import type { SectoralContext } from '@/lib/engines/sectoral-injection';

export interface SectoralRadarProps {
  sectoral: SectoralContext | null | undefined;
}

export function SectoralRadar({ sectoral }: SectoralRadarProps): React.ReactElement | null {
  // Pas de contexte du tout : on n affiche rien, le pipeline a
  // tourne sans resolution sectorielle (cas legacy ou erreur en
  // amont).
  if (!sectoral) return null;

  // Mode unknown_sector : mention textuelle, pas de chart.
  if (sectoral.mode === 'unknown_sector') {
    return (
      <div className="note-sectoral-method" data-testid="note-sectoral-unknown">
        <p className="note-sectoral-method-mention">
          Secteur emergent non couvert par la matrice sectorielle Prelude. La
          lecture sectorielle a ete suspendue pour ce dossier ; l analyse s
          appuie sur le seul contenu du pitch et sur la doctrine generale
          des moteurs.
        </p>
        <RadarStyles />
      </div>
    );
  }

  // Mode expired : fiche perimee, mention explicite.
  if (sectoral.mode === 'expired') {
    return (
      <div className="note-sectoral-method" data-testid="note-sectoral-expired">
        <p className="note-sectoral-method-mention">
          {sectoral.methodologyNote}
        </p>
        <RadarStyles />
      </div>
    );
  }

  // Mode no_brief : secteur reconnu mais aucune fiche persistee.
  if (sectoral.mode === 'no_brief') {
    return (
      <div className="note-sectoral-method" data-testid="note-sectoral-no-brief">
        <p className="note-sectoral-method-mention">
          {sectoral.methodologyNote}
        </p>
        <RadarStyles />
      </div>
    );
  }

  // Mode applied (fresh ou stale) : on rend le mini chart.
  const primary = sectoral.primary;
  if (!primary) return null;

  const sectorLabel =
    SECTORAL_SECTORS.find((s) => s.slug === primary.brief.sector_slug)?.label
    ?? primary.brief.sector_slug;

  const secondaryLabels = sectoral.secondaries
    .map((s) =>
      SECTORAL_SECTORS.find((sd) => sd.slug === s.brief.sector_slug)?.label
      ?? s.brief.sector_slug,
    )
    .filter(Boolean);

  const subtitle = secondaryLabels.length > 0
    ? `Secteurs secondaires : ${secondaryLabels.join(' et ')}`
    : undefined;

  const mode: SectoralRenderMode = primary.freshness === 'stale' ? 'stale' : 'fresh';

  return (
    <div className="note-sectoral-method" data-testid="note-sectoral-applied">
      <SectoralSpiderChart
        brief={primary.brief}
        sectorLabel={`Secteur primaire : ${sectorLabel}`}
        mode={mode}
        size={320}
        subtitle={subtitle}
        href={`/portfolio/secteurs/${primary.brief.sector_slug}`}
      />
      <RadarStyles />
    </div>
  );
}

function RadarStyles(): React.ReactElement {
  return (
    <style jsx>{`
      .note-sectoral-method {
        margin: 16px 0 20px;
        display: flex;
        justify-content: center;
      }
      .note-sectoral-method-mention {
        font-family: var(--serif, Georgia, serif);
        font-size: 0.88rem;
        line-height: 1.55;
        color: var(--ink-secondary, #4a4338);
        font-style: italic;
        margin: 0;
        padding: 12px 16px;
        background: #fef7f4;
        border-left: 3px solid #9c5a2a;
        max-width: 760px;
      }
      @media print {
        .note-sectoral-method {
          break-inside: avoid;
          page-break-inside: avoid;
          margin: 12px 0 16px;
        }
        .note-sectoral-method :global(svg) {
          max-width: 100%;
          height: auto;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `}</style>
  );
}

export default SectoralRadar;
