/**
 * Bornes IA versus non-IA par stade. Donnee critique pour 2026.
 * Source: PitchBook-NVCA Venture Monitor Q1 2026.
 *
 * Pourquoi cette separation est essentielle:
 * 88,8% du capital US Q1 2026 va a l IA. Les dossiers IA et non-IA n ont plus
 * les memes attentes de marche. Un dossier IA Series A a 50M$ pre-money est
 * en dessous de la mediane (78M$). Un dossier non-IA Series A a 50M$ pre-money
 * est au-dessus de la mediane (42,4M$). Sans cette separation, les benchmarks
 * generiques sont trompeurs.
 */

import { SOURCES } from './sources';
import type { Stage } from './valuations-by-stage';

export type AiVsNonAiPair = {
  ai: number;
  nonAi: number;
};

export type AiVsNonAiBenchmark = {
  preMoneyMedianMillionsUsd: AiVsNonAiPair;
};

/**
 * Medianes pre-money par stade, separees IA / non-IA.
 * Source: PitchBook-NVCA Q1 2026.
 */
export const MEDIAN_VALUATIONS_AI_VS_NON_AI_2026_Q1: Record<Stage, AiVsNonAiBenchmark> & {
  source: typeof SOURCES.PITCHBOOK_NVCA_Q1_2026;
} = {
  seed: {
    preMoneyMedianMillionsUsd: { ai: 18.7, nonAi: 18.0 },
  },
  seriesA: {
    preMoneyMedianMillionsUsd: { ai: 78, nonAi: 42.4 },
  },
  seriesB: {
    preMoneyMedianMillionsUsd: { ai: 270.8, nonAi: 174 },
  },
  seriesC: {
    preMoneyMedianMillionsUsd: { ai: 606.5, nonAi: 507.3 },
  },
  seriesDPlus: {
    preMoneyMedianMillionsUsd: { ai: 4700, nonAi: 1285 },
  },
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
};

/**
 * Step-up median (multiple de valorisation entre tours successifs).
 * Source: PitchBook-NVCA Q1 2026.
 */
export const STEP_UP_MEDIAN_2026_Q1 = {
  ai: 2.2,
  nonAi: 1.6,
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
  notes: "Le step-up IA reste structurellement plus eleve, signe de la pression a l investissement sur ce segment.",
} as const;

/**
 * Temps median entre deux tours successifs (en annees).
 * Source: PitchBook-NVCA Q1 2026.
 * Implication: les startups IA levent ~6 mois plus vite que les non-IA.
 */
export const YEARS_BETWEEN_ROUNDS_2026_Q1 = {
  ai: 1.3,
  nonAi: 1.8,
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
  notes: "Les startups IA levent en moyenne 6 mois plus tot que les non-IA. FOMO investisseur documente.",
} as const;

/**
 * Part de l IA dans le capital deploye et le nombre de deals.
 * Source: PitchBook-NVCA Q1 2026.
 */
export const AI_SHARE_OF_MARKET_2026_Q1 = {
  shareOfDealValuePercent: 88.8,
  shareOfDealCountPercent: 42.5,
  shareOfMarketCapPercent: 45,
  shareOfCvcDealsPercent: 51, // plus de la moitie des deals CVC sont en IA
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
} as const;

/**
 * Benchmark Menlo Ventures pour Series A IA en 2026:
 * Trajectoire ARR exceptionnelle = 0 -> 3M$ -> 15M$ -> 60M$ sur periode courte.
 * A utiliser comme reference pour evaluer la qualite de croissance d un dossier IA.
 */
export const MENLO_AI_SERIES_A_ARR_BENCHMARK = {
  trajectoryMillionsUsd: [0, 3, 15, 60],
  description: "Trajectoire ARR consideree comme exceptionnelle par Menlo Ventures pour une Series A IA en 2026. Periode courte (typiquement 18-36 mois).",
  source: SOURCES.MENLO_VENTURES_AI_BENCHMARK,
  notes: "Cite par Amy Wu Martin (Menlo Ventures) dans interview Dentons publiee dans PitchBook Q1 2026. Au-dela du chiffre absolu, ce qui compte est la qualite de la croissance: usage critique versus tool parmi d autres.",
} as const;
