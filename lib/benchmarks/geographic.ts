/**
 * Comparaison structurelle US versus Europe.
 * Sources: PitchBook-NVCA Q1 2026 (US), Atomico State of European Tech 2025 (Europe).
 *
 * Pourquoi c est central pour Prelude:
 * Prelude cible des fonds europeens (Frst, Daphni, Serena, LocalGlobe). Or les bornes
 * US ne sont pas applicables telles quelles a un dossier europeen. Le marche europeen
 * est structurellement plus petit, plus profond aux stades early que late, et avec
 * des comparables differents.
 */

import { SOURCES } from './sources';

/**
 * Profondeur des marches VC compares.
 */
export const MARKET_DEPTH_2025_2026 = {
  us: {
    annualInvestmentBillionsUsd2025: 339.4, // PitchBook Q4 2025
    q1_2026_investmentBillionsUsd: 267.2, // PitchBook Q1 2026
    sourceUs: SOURCES.PITCHBOOK_NVCA_Q1_2026,
  },
  europe: {
    annualInvestmentBillionsUsd2025: 44, // Atomico SoET 2025 (estimation annee pleine)
    sourceEurope: SOURCES.ATOMICO_SOET_2025,
  },
  ratio: {
    usQ1OverEuropeAnnual: 6.07, // 267.2 / 44
    note: "Le marche US deploie en un seul trimestre plus de 6x ce que l Europe deploie en une annee complete.",
  },
} as const;

/**
 * Concentration extreme du capital US Q1 2026.
 * Source: PitchBook-NVCA Q1 2026.
 */
export const US_CAPITAL_CONCENTRATION_2026_Q1 = {
  topFiveDealsShareOfDealValuePercent: 73.2, // OpenAI, Anthropic, xAI, Waymo, Databricks
  topFiveFundsShareOfFundraisingPercent: 73.1, // a16z, Thrive, Founders Fund, Battery, Kleiner Perkins, Lux
  experiencedFirmsShareOfCapitalRaisedPercent: 90.9, // record historique
  bayAreaShareOfDealValuePercent: 90.9, // hubs Bay Area + NY + LA + Boston
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
} as const;

/**
 * Allocation des fonds de pension au VC (% AUM).
 * Source: Atomico State of European Tech 2025.
 * Donnee structurante pour expliquer la voilure plus contrainte des fonds europeens.
 */
export const PENSION_FUND_VC_ALLOCATION_2024 = {
  usPercentOfAum: 0.028,
  europePercentOfAum: 0.009,
  byEuropeanRegion: {
    franceBenelux: 0.023,
    nordics: 0.008,
    dachAndItaly: 0.007,
    ukAndIreland: 0.001,
  },
  potentialUnlockBillionsUsd10Years: 210, // si Europe alignait sur niveau US
  source: SOURCES.ATOMICO_SOET_2025,
  note: "Les fonds de pension US allouent 3x plus au VC que leurs pairs europeens. Aligner l Europe au niveau US debloquerait 210 milliards sur 10 ans.",
} as const;

/**
 * Multiples median d entree EBITDA sur le marche buyout.
 * Source: Bain Global Private Equity Report 2025 (donnees 2024).
 * Attention: c est du buyout (later stage / mature), PAS du VC pur.
 * A utiliser uniquement pour les dossiers Series D+ ou venture growth.
 */
export const BUYOUT_TEV_EBITDA_MULTIPLES_2024 = {
  northAmerica: 11.9,
  westernEurope: 12.1,
  source: SOURCES.BAIN_PE_2025,
  warning: "Multiples buyout. NE PAS appliquer a un seed/Series A SaaS qui se valorise en multiple d ARR.",
} as const;

/**
 * Repartition geographique US Q1 2026.
 * Source: PitchBook-NVCA Q1 2026.
 */
export const US_GEOGRAPHIC_BREAKDOWN_2026_Q1 = {
  bayArea: { dealCount: 669, dealValueBillionsUsd: 221.1 },
  newYorkCity: { dealCount: 490, dealValueBillionsUsd: 11.4 },
  losAngeles: { dealCount: 189, dealValueBillionsUsd: 3.5 },
  boston: { dealCount: 181, dealValueBillionsUsd: 5.4 },
  philadelphia: { dealCount: 207, dealValueBillionsUsd: 2.8 },
  austin: { dealCount: 102, dealValueBillionsUsd: 4.9 },
  miami: { dealCount: 100, dealValueBillionsUsd: 1.4 },
  denver: { dealCount: 95, dealValueBillionsUsd: 0.8 },
  washingtonDC: { dealCount: 83, dealValueBillionsUsd: 1.0 },
  seattle: { dealCount: 69, dealValueBillionsUsd: 1.5 },
  otherCities: { dealCount: 3022, dealValueBillionsUsd: 13.5 },
  hubsShareOfDealValuePercent: 90.9, // Bay + NY + LA + Boston
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
} as const;

/**
 * Sentiment de la communaute tech europeenne (signal contraire au sentiment US Q1 2026).
 * Source: Atomico State of European Tech 2025.
 */
export const EUROPEAN_TECH_SENTIMENT_2025 = {
  optimisticPercent: 50, // plus optimistes qu il y a 12 mois
  optimisticPercentPriorYear: 34,
  ecosystemValueTrillionsUsd: 4,
  ecosystemValueShareOfGdpPercent: 15,
  ecosystemValueShareOfGdp2016Percent: 4,
  source: SOURCES.ATOMICO_SOET_2025,
  note: "Le sentiment europeen est en hausse forte tandis que le sentiment US est plus prudent post-volatilite fevrier 2026. Divergence transatlantique notable.",
} as const;
