/**
 * Loi de puissance des retours VC (Correlation Ventures) et quartiles de performance
 * de fonds (Cambridge Associates).
 *
 * Pourquoi c est essentiel:
 * Quand un dossier projette un retour de 5x ou 10x, ces benchmarks permettent
 * de calibrer objectivement la probabilite. La majorite des deals VC ne rapportent
 * pas plus que la mise. Les "home runs" sont rares.
 */

import { SOURCES } from './sources';

/**
 * Distribution des outcomes VC par tranche de retour.
 * Source: Correlation Ventures, sur ~10 ans d historique.
 *
 * Lecture: 65% des investissements VC rapportent entre 0x et 1x (perte ou
 * remboursement simple). Seuls 4% sont des "home runs" a plus de 10x.
 */
export const VC_POWER_LAW_DISTRIBUTION = {
  buckets: [
    { range: '0x-1x', percent: 65, label: 'Perte ou remboursement simple' },
    { range: '1x-5x', percent: 25, label: 'Retour modeste' },
    { range: '5x-10x', percent: 6, label: 'Bon retour' },
    { range: '10x+', percent: 4, label: 'Home run' },
  ],
  source: SOURCES.CORRELATION_VENTURES_POWER_LAW,
  notes: "Reference structurelle pour calibrer les attentes de retour d un dossier. Si un dossier projette un retour 8x au fonds, c est un pari sur les 10% superieurs du marche historique.",
} as const;

/**
 * Helper pour situer un retour projete dans la distribution.
 */
export function classifyProjectedReturn(multiple: number): {
  bucket: string;
  percentile: string;
  interpretation: string;
} {
  if (multiple < 1) {
    return {
      bucket: '0x-1x',
      percentile: '65% du marche',
      interpretation: 'Retour en dessous de la mise initiale, dans la majorite des outcomes.',
    };
  }
  if (multiple < 5) {
    return {
      bucket: '1x-5x',
      percentile: '25% du marche',
      interpretation: 'Retour modeste mais positif, dans le second tiers du marche.',
    };
  }
  if (multiple < 10) {
    return {
      bucket: '5x-10x',
      percentile: '6% du marche',
      interpretation: 'Bon retour, dans le top 10% des outcomes historiques.',
    };
  }
  return {
    bucket: '10x+',
    percentile: '4% du marche',
    interpretation: 'Home run. Seuls 4% des deals VC atteignent ce niveau de retour historiquement.',
  };
}

/**
 * Benchmarks de TRI et TVPI par quartile de fond VC.
 * Source: Cambridge Associates.
 */
export const VC_FUND_QUARTILE_BENCHMARKS = {
  topQuartile: {
    irrPercentMin: 25,
    tvpiMultipleMin: 3.0,
    label: 'Top 25%',
  },
  median: {
    irrPercentRange: [12, 15] as const,
    tvpiMultipleRange: [1.8, 2.2] as const,
    label: 'Mediane',
  },
  bottomQuartile: {
    irrPercentMax: 5,
    tvpiMultipleMax: 1.1,
    label: 'Bottom 25%',
    note: 'TRI peut etre negatif',
  },
  source: SOURCES.CAMBRIDGE_ASSOCIATES_QUARTILES,
} as const;

/**
 * Persistance de la performance des GP (Kaplan & Schoar).
 * Un GP top quartile sur le fonds N a 48% de chances de finir en top quartile sur le fonds N+1.
 */
export const GP_PERSISTENCE = {
  topQuartileNToTopQuartileNPlus1Percent: 48,
  source: SOURCES.CAMBRIDGE_ASSOCIATES_QUARTILES,
  notes: "Etudes Kaplan & Schoar (Chicago Booth). Donnee structurelle, faible variation.",
} as const;

/**
 * Gap de fundraising entre top et bottom quartile en 2024.
 * Source: Bain Global PE Report 2025.
 *
 * Interpretation: un GP top quartile augmente la taille de son fonds successeur
 * de 53% en moyenne, alors qu un GP bottom quartile peine a maintenir sa taille.
 * Gap historique de 10 points, gap actuel de 53 points.
 */
export const FUNDRAISING_GAP_BY_QUARTILE_2024 = {
  topQuartileFundSizeIncreasePercent: 53,
  bottomQuartileFundSizeIncreasePercent: 0,
  historicalGapPercentagePoints: 10,
  currentGapPercentagePoints: 53,
  topQuartileTimeToCloseMonths: 9,
  bottomQuartileTimeToCloseMonths: 24,
  source: SOURCES.BAIN_PE_2025,
  note: "Le gap de fundraising entre top et bottom quartile s est elargi massivement post-2022. Un fonds bottom quartile aujourd hui a une capacite limitee a accompagner ses dossiers sur plusieurs tours.",
} as const;
