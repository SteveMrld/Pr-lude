/**
 * Cadrage macro 2026 du marche VC/PE.
 * Sources: PitchBook-NVCA Q4 2025, Q1 2026, Bain Global PE Report 2025, Atomico SoET 2025.
 *
 * Pourquoi c est central pour Prelude:
 * Toute note d investissement doit s ouvrir sur un cadrage du marche dans lequel
 * le dossier s inscrit. Ce fichier consolide les chiffres essentiels pour
 * differencier US versus Europe et 2025 (annee pleine) versus 2026 (Q1).
 */

import { SOURCES } from './sources';

/**
 * Etat de la liquidite LP cote PE/VC en 2024-2025.
 * Source: Bain Global PE Report 2025 + PitchBook Q4 2025.
 *
 * Implication pour Prelude: les fonds qui instruisent les dossiers operent
 * sous tension de distribution. Les LPs n ont pas recu suffisamment de
 * distributions depuis 2022, donc les fonds sont plus selectifs.
 */
export const LP_LIQUIDITY_PRESSURE = {
  distributionsToNavPercent2024: 11, // plus bas niveau en plus de 10 ans (Bain buyout)
  cashFlowsNegativeYearsOutOfLast6: 5,
  cumulativeCashFlowsToLpsBillionsUsdSince2022: -196.9, // PitchBook VC US
  notes: "Les distributions aux LPs sont au plus bas. Les fonds sous-performants peinent a lever leur prochain vehicule. La consolidation du capital se fait au profit des top performers.",
  bainSource: SOURCES.BAIN_PE_2025,
  pitchbookSource: SOURCES.PITCHBOOK_NVCA_Q4_2025,
} as const;

/**
 * Concentration extreme du marche VC US Q1 2026.
 * Source: PitchBook-NVCA Q1 2026.
 */
export const MARKET_CONCENTRATION_2026_Q1 = {
  topFiveDealsShareOfDealValuePercent: 73.2,
  topFiveCompaniesNamed: ['OpenAI', 'Anthropic', 'xAI', 'Waymo', 'Databricks'],
  topFiveFundsShareOfFundraisingPercent: 73.1,
  topFundsNamed: ['Andreessen Horowitz', 'Thrive Capital', 'Founders Fund', 'Battery Ventures', 'Kleiner Perkins', 'Lux Capital'],
  experiencedFirmsShareOfCapitalRaisedPercent: 90.9,
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
  note: "Concentration sans precedent dans l histoire moderne du VC. Le marche est devenu un jeu de consensus deals.",
} as const;

/**
 * Dry powder global VC/PE et son vieillissement.
 * Sources: Bain Global PE Report 2025 (buyout), PitchBook Q4 2025 (VC US).
 */
export const DRY_POWDER_2024_2025 = {
  globalBuyoutDryPowderTrillionsUsd: 1.2, // Bain end of 2024
  agingDryPowder4PlusYearsPercent: 24, // Bain
  vcDryPowderUsBillionsUsd: 299.3, // PitchBook H1 2025 H1
  vcDryPowderConcentrationIn500MPlusFundsPercent: 52.3,
  bainSource: SOURCES.BAIN_PE_2025,
  pitchbookSource: SOURCES.PITCHBOOK_NVCA_Q4_2025,
  note: "Plus de 50% du dry powder VC US est detenu par des fonds de plus de 500M$. Ces fonds representent seulement 6,7% des fonds clos sur 4 ans. Bifurcation extreme.",
} as const;

/**
 * Fundraising bifurque en 2025-2026.
 * Source: PitchBook-NVCA Q4 2025 + Q1 2026.
 */
export const FUNDRAISING_BIFURCATION_2026 = {
  vcCapitalRaisedBillionsUsd2025: 66.1,
  vcFundsClosed2025: 537,
  vcCapitalRaisedBillionsUsdQ1_2026: 47.8,
  vcFundsClosedQ1_2026: 172,
  medianFundSizeMillionsUsd2025: 25,
  medianFundSizeMillionsUsdQ1_2026: 15.3,
  averageFundSizeMillionsUsd2025: 120.2,
  averageFundSizeMillionsUsdQ1_2026: 289.7,
  firstTimeFundsCount2025: 106,
  firstTimeFundsCountQ1_2026: 29,
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
  note: "Bifurcation extreme: la mediane chute (15M$) tandis que la moyenne explose (290M$). Les megafonds prennent toute la place, les emerging managers sont presque exclus du marche.",
} as const;

/**
 * Cadrage europeen 2025.
 * Source: Atomico SoET 2025.
 */
export const EUROPEAN_MACRO_2025 = {
  totalInvestmentBillionsUsd: 44,
  ecosystemValueTrillionsUsd: 4,
  ecosystemValueShareOfGdpPercent: 15,
  newFoundersCount: 27000,
  newFoundersGrowthVs2023Percent: 60,
  globalExitValueBillionsUsd2025: 608,
  globalExitValueGrowthVs2024Percent: 67, // 608 / 364 - 1
  europeanShareOfGlobalExitsPercent: null, // US > 50%, Europe non publie precisement mais infere autour de 15-20%
  notes: "Le marche europeen 2025 est en recovery mesuree. Les pension funds europeens sous-allouent au VC (0,009% AUM vs 0,028% US). Reformes EU-INC et 28e regime attendues Q1 2026.",
  source: SOURCES.ATOMICO_SOET_2025,
} as const;

/**
 * Sentiment du marche VC US Q1 2026.
 * Source: PitchBook-NVCA Q1 2026 + JP Morgan commentary.
 */
export const US_MARKET_SENTIMENT_2026_Q1 = {
  publicSoftwareEquityMultiples: '10-year lows',
  aiNarrative: 'Passage de productivity tool a existential threat de disintermediation',
  techJobCutsAttributedToAi2026Q1Percent: 8, // vs 5% en 2025, 3% en 2023
  techJobCutsYtdGrowthVsPrior: 51,
  fedRateRangeExpected2026: '3,50% - 3,75%',
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
  notes: "Volatilite februaire 2026 a revele un marche public a cran. Investisseurs en quete de raisons de vendre. Les startups SaaS face au risque de disintermediation par l IA.",
} as const;

/**
 * Reglementation europeenne en chantier 2026.
 * Source: Atomico SoET 2025.
 */
export const EUROPEAN_REGULATORY_PIPELINE_2026 = {
  initiatives: [
    { name: '28e Regime pour les Innovative Companies', timeline: 'Q1 2026', description: 'Status Regulation vs Directive non confirme' },
    { name: 'European Innovation Act', timeline: 'Q1 2026' },
    { name: 'Savings & Investment Union', timeline: 'Q1 2026' },
    { name: 'Cloud and AI Development Act', timeline: 'Q1 2026' },
    { name: 'Public Procurement Act', timeline: 'Q2 2026' },
    { name: 'Quantum Act', timeline: 'Q2 2026' },
    { name: 'Update of European VC funds Regulation', timeline: 'Q3 2026' },
  ],
  founderSurveyRestrictivePercent: 70,
  source: SOURCES.ATOMICO_SOET_2025,
} as const;
