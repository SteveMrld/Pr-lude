// ============================================================
// PRELUDE - Composant SectoralTemporalComparison (mode temporal)
// ------------------------------------------------------------
// Rend la comparaison d une fiche sectorielle a sa version
// historique (T versus T-12 mois ou autre horizon). Le polygone
// actuel est trace en ocre brule plein, le polygone historique
// en pointille ocre brule a 60% d opacite. La legende explicite
// la date de chaque trace. Sous le graphique, un paragraphe
// editorial nomme les dimensions qui ont bouge significativement
// (delta superieur a dix points) et distingue les evolutions
// naturelles des evolutions surprenantes.
//
// Le paragraphe editorial est genere de maniere deterministe
// par buildTemporalEditorial sauf si le caller fournit son propre
// texte via la prop editorial.
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
import { buildTemporalEditorial, formatSectoralDate } from './editorial-helpers';

export interface SectoralTemporalComparisonProps {
  /** Fiche actuelle, rendue en trait plein ocre brule. */
  current: SectoralBrief;
  /** Fiche historique a comparer, rendue en pointille ocre brule. */
  previous: SectoralBrief;
  /** Libelle editorial du secteur. */
  sectorLabel: string;
  /** Cote du carre englobant, defaut 480. */
  size?: number;
  /** Paragraphe editorial fourni par le backend (LLM-genere).
   *  Si absent, le composant produit un texte deterministe via
   *  buildTemporalEditorial. */
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

export function SectoralTemporalComparison(
  props: SectoralTemporalComparisonProps,
): React.ReactElement {
  const { current, previous, sectorLabel, size = 480, editorial } = props;

  const currentData: SpiderChartData = {
    dimensions: briefToDimensions(current),
  };
  const previousData: SpiderChartData = {
    dimensions: briefToDimensions(previous),
  };

  const currentDateLabel = formatSectoralDate(current.generated_at);
  const previousDateLabel = formatSectoralDate(previous.generated_at);

  const svgString = renderSpiderChart(currentData, {
    size,
    mode: 'temporal',
    secondary: previousData,
    primaryLabel: `Aujourd hui (${currentDateLabel})`,
    secondaryLabel: `Reference historique (${previousDateLabel})`,
  });

  const paragraph =
    editorial && editorial.trim().length > 0
      ? editorial
      : buildTemporalEditorial(current, previous, { sectorLabel });

  return (
    <div
      className="sectoral-temporal"
      data-testid="sectoral-temporal"
      data-size={size}
    >
      <div className="sectoral-temporal-header">
        <div className="sectoral-temporal-title">
          {sectorLabel}, evolution sectorielle
        </div>
        <div className="sectoral-temporal-subtitle">
          Comparaison entre la fiche actuelle ({currentDateLabel}) et la
          reference historique ({previousDateLabel}).
        </div>
      </div>
      <div
        className="sectoral-temporal-svg"
        data-testid="sectoral-temporal-svg"
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
      <p
        className="sectoral-temporal-editorial"
        data-testid="sectoral-temporal-editorial"
      >
        {paragraph}
      </p>

      <style jsx>{`
        .sectoral-temporal {
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
        .sectoral-temporal-header {
          text-align: center;
        }
        .sectoral-temporal-title {
          font-size: 1.05rem;
          font-weight: 600;
          letter-spacing: 0.005em;
        }
        .sectoral-temporal-subtitle {
          font-size: 0.82rem;
          color: ${PALETTE.sepia};
          font-family: var(--grotesque-condensed, sans-serif);
          margin-top: 4px;
        }
        .sectoral-temporal-svg {
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .sectoral-temporal-svg :global(svg) {
          max-width: 100%;
          height: auto;
        }
        .sectoral-temporal-editorial {
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

export default SectoralTemporalComparison;
