/**
 * Medianes de valorisation pre-money et de taille de tour par stade.
 * Source primaire: PitchBook-NVCA Venture Monitor Q1 2026.
 *
 * Ces bornes sont LES references US pour calibrer un dossier au stade donne.
 * Pour un dossier europeen, utiliser plutot lib/benchmarks/european-comparables.ts
 * en combinaison avec ces bornes (le marche europeen est ~6x plus petit annuellement,
 * voir lib/benchmarks/geographic.ts).
 */

import { SOURCES } from './sources';

export type Stage = 'seed' | 'seriesA' | 'seriesB' | 'seriesC' | 'seriesDPlus';

export type StageBenchmark = {
  preMoneyMedianMillionsUsd: number;
  dealSizeMedianMillionsUsd: number;
};

/**
 * Medianes US toutes verticales confondues, Q1 2026.
 * Source: PitchBook-NVCA Q1 2026.
 */
export const MEDIAN_VALUATIONS_US_2026_Q1: Record<Stage, StageBenchmark> & {
  source: typeof SOURCES.PITCHBOOK_NVCA_Q1_2026;
} = {
  seed: {
    preMoneyMedianMillionsUsd: 18.4,
    dealSizeMedianMillionsUsd: 3.0,
  },
  seriesA: {
    preMoneyMedianMillionsUsd: 62,
    dealSizeMedianMillionsUsd: 19.6,
  },
  seriesB: {
    preMoneyMedianMillionsUsd: 203,
    dealSizeMedianMillionsUsd: 40,
  },
  seriesC: {
    preMoneyMedianMillionsUsd: 579,
    dealSizeMedianMillionsUsd: 75,
  },
  seriesDPlus: {
    preMoneyMedianMillionsUsd: 2395,
    dealSizeMedianMillionsUsd: 190,
  },
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
};

/**
 * Medianes US toutes verticales confondues, fin 2025 (annee pleine).
 * Source: PitchBook-NVCA Q4 2025.
 * Conservees pour comparer evolution Q4 2025 -> Q1 2026.
 */
export const MEDIAN_VALUATIONS_US_2025: Record<Stage, StageBenchmark> & {
  source: typeof SOURCES.PITCHBOOK_NVCA_Q4_2025;
} = {
  seed: {
    preMoneyMedianMillionsUsd: 16,
    dealSizeMedianMillionsUsd: 3.8,
  },
  seriesA: {
    preMoneyMedianMillionsUsd: 49,
    dealSizeMedianMillionsUsd: 15,
  },
  seriesB: {
    preMoneyMedianMillionsUsd: 145,
    dealSizeMedianMillionsUsd: 33.8,
  },
  seriesC: {
    preMoneyMedianMillionsUsd: 316.3,
    dealSizeMedianMillionsUsd: 54,
  },
  seriesDPlus: {
    preMoneyMedianMillionsUsd: 856.5,
    dealSizeMedianMillionsUsd: 100,
  },
  source: SOURCES.PITCHBOOK_NVCA_Q4_2025,
};

/**
 * Bandes de tolerance pour qualifier l ecart d un dossier vs la mediane.
 * Utilisees par benchmark-engine pour produire le verdict de positionnement.
 */
export const DEVIATION_BANDS = {
  IN_LINE_PERCENT: 20, // ecart < 20% : aligne au marche
  ABOVE_MARKET_PERCENT: 50, // ecart 20-50% : au-dessus
  EXTREME_OUTLIER_PERCENT: 50, // ecart > 50% : outlier extreme (positif ou negatif)
} as const;

/**
 * Helper pour qualifier la deviation d un dossier vs benchmark.
 */
export function classifyDeviation(
  dossierValue: number,
  benchmarkMedian: number
): 'below_market' | 'in_line' | 'above_market' | 'extreme_outlier' {
  if (benchmarkMedian === 0) return 'in_line';
  const deviationPercent = ((dossierValue - benchmarkMedian) / benchmarkMedian) * 100;
  const absDeviation = Math.abs(deviationPercent);

  if (absDeviation <= DEVIATION_BANDS.IN_LINE_PERCENT) return 'in_line';
  if (absDeviation > DEVIATION_BANDS.EXTREME_OUTLIER_PERCENT) return 'extreme_outlier';
  return deviationPercent > 0 ? 'above_market' : 'below_market';
}
