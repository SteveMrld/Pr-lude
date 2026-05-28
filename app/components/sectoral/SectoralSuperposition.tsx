// ============================================================
// PRELUDE - Composant SectoralSuperposition (mode overlay)
// ------------------------------------------------------------
// Rend la superposition de deux fiches sectorielles sur le meme
// octogone. Polygone primaire en ocre brule plein, polygone
// secondaire en ocre eteint, legende sobre en bas a droite.
// Sous le graphique, un paragraphe editorial nomme les axes de
// convergence (ecart inferieur a dix points) et les axes de
// divergence (ecart superieur a trente points).
//
// Le paragraphe editorial est genere de maniere deterministe
// par buildOverlayEditorial sauf si le caller fournit son
// propre texte via la prop editorial (canal LLM quand existant).
// ============================================================

'use client';

import * as React from 'react';
import {
  renderSpiderChart,
  type DimensionData,
  type SpiderChartData,
  PALETTE,
} from '@/lib/visuals/spiderweb';
import type { SectoralBrief } from '@/lib/engines/sectoral-intelligence/types';
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  type DimensionKey,
} from '@/lib/engines/sectoral-intelligence/types';
import { buildOverlayEditorial } from './editorial-helpers';

export interface SectoralSuperpositionProps {
  /** Fiche primaire, rendue en ocre brule plein. */
  primary: SectoralBrief;
  /** Fiche secondaire, rendue en ocre eteint. */
  secondary: SectoralBrief;
  /** Libelle editorial du secteur primaire. */
  primaryLabel: string;
  /** Libelle editorial du secteur secondaire. */
  secondaryLabel: string;
  /** Cote du carre englobant, defaut 480. */
  size?: number;
  /** Paragraphe editorial fourni par le backend (LLM-genere).
   *  Si absent, le composant produit un texte deterministe via
   *  buildOverlayEditorial. */
  editorial?: string | null;
}

function briefToDimensions(brief: SectoralBrief): DimensionData[] {
  return DIMENSION_KEYS.map((key: DimensionKey) => {
    const d = brief.dimensions[key];
    return {
      label: DIMENSION_LABELS[key],
      score: d?.data_missing ? null : (typeof d?.score === 'number' ? d.score : null),
      confidence: d?.confidence,
    };
  });
}

export function SectoralSuperposition(props: SectoralSuperpositionProps): React.ReactElement {
  const {
    primary,
    secondary,
    primaryLabel,
    secondaryLabel,
    size = 480,
    editorial,
  } = props;

  const primaryData: SpiderChartData = {
    dimensions: briefToDimensions(primary),
  };
  const secondaryData: SpiderChartData = {
    dimensions: briefToDimensions(secondary),
  };

  const svgString = renderSpiderChart(primaryData, {
    size,
    mode: 'overlay',
    secondary: secondaryData,
    primaryLabel,
    secondaryLabel,
  });

  const paragraph =
    editorial && editorial.trim().length > 0
      ? editorial
      : buildOverlayEditorial(primary, secondary, { primaryLabel, secondaryLabel });

  return (
    <div
      className="sectoral-superposition"
      data-testid="sectoral-superposition"
      data-size={size}
    >
      <div className="sectoral-superposition-header">
        <div className="sectoral-superposition-title">
          {primaryLabel} <span className="sep">contre</span> {secondaryLabel}
        </div>
        <div className="sectoral-superposition-subtitle">
          Superposition des deux fiches sectorielles, lecture éditoriale des
          convergences et divergences sous le polygone.
        </div>
      </div>
      <div
        className="sectoral-superposition-svg"
        data-testid="sectoral-superposition-svg"
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
      <p
        className="sectoral-superposition-editorial"
        data-testid="sectoral-superposition-editorial"
      >
        {paragraph}
      </p>

      <style jsx>{`
        .sectoral-superposition {
          background: ${PALETTE.cream};
          padding: 20px 24px;
          border: 1px solid ${PALETTE.ocreEteint};
          border-radius: 2px;
          font-family: var(--serif, Georgia, serif);
          color: ${PALETTE.encre};
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .sectoral-superposition-header {
          text-align: center;
        }
        .sectoral-superposition-title {
          font-size: 1.05rem;
          font-weight: 600;
          letter-spacing: 0.005em;
        }
        .sectoral-superposition-title .sep {
          font-style: italic;
          color: ${PALETTE.sepia};
          font-weight: 400;
        }
        .sectoral-superposition-subtitle {
          font-size: 0.82rem;
          color: ${PALETTE.sepia};
          font-family: var(--grotesque-condensed, sans-serif);
          margin-top: 4px;
        }
        .sectoral-superposition-svg {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .sectoral-superposition-svg :global(svg) {
          max-width: 100%;
          height: auto;
        }
        .sectoral-superposition-editorial {
          font-size: 0.92rem;
          line-height: 1.65;
          color: ${PALETTE.encre};
          margin: 0;
          max-width: 60ch;
          text-align: left;
        }
      `}</style>
    </div>
  );
}

export default SectoralSuperposition;
