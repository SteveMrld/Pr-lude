/**
 * Couche Benchmarks Prelude.
 *
 * Donnees de reference utilisees par les moteurs (notamment benchmark-engine,
 * cohérence financière, macro, blindspot, pattern matching) pour calibrer
 * les dossiers d investissement.
 *
 * Mise a jour trimestrielle quand de nouveaux rapports sortent:
 * - PitchBook-NVCA Venture Monitor (trimestriel)
 * - Atomico State of European Tech (annuel)
 * - Bain Global Private Equity Report (annuel)
 *
 * Pour ajouter de nouvelles donnees, modifier le fichier thematique correspondant
 * et bumper le `asOf` dans sources.ts.
 */

// Sources et metadonnees
export {
  SOURCES,
  type BenchmarkSource,
  type SourceId,
} from './sources';

// Valorisations US toutes verticales
export {
  MEDIAN_VALUATIONS_US_2026_Q1,
  MEDIAN_VALUATIONS_US_2025,
  DEVIATION_BANDS,
  classifyDeviation,
  type Stage,
  type StageBenchmark,
} from './valuations-by-stage';

// Separation IA versus non-IA
export {
  MEDIAN_VALUATIONS_AI_VS_NON_AI_2026_Q1,
  STEP_UP_MEDIAN_2026_Q1,
  YEARS_BETWEEN_ROUNDS_2026_Q1,
  AI_SHARE_OF_MARKET_2026_Q1,
  MENLO_AI_SERIES_A_ARR_BENCHMARK,
  type AiVsNonAiPair,
  type AiVsNonAiBenchmark,
} from './ai-vs-non-ai';

// Geographique US versus Europe
export {
  MARKET_DEPTH_2025_2026,
  US_CAPITAL_CONCENTRATION_2026_Q1,
  PENSION_FUND_VC_ALLOCATION_2024,
  BUYOUT_TEV_EBITDA_MULTIPLES_2024,
  US_GEOGRAPHIC_BREAKDOWN_2026_Q1,
  EUROPEAN_TECH_SENTIMENT_2025,
} from './geographic';

// Loi de puissance et quartiles de fonds
export {
  VC_POWER_LAW_DISTRIBUTION,
  classifyProjectedReturn,
  VC_FUND_QUARTILE_BENCHMARKS,
  GP_PERSISTENCE,
  FUNDRAISING_GAP_BY_QUARTILE_2024,
} from './power-law';

// Sorties et trajectoires post-IPO
export {
  POST_IPO_PERFORMANCE_2025,
  US_IPO_VOLUMES,
  EXIT_CHANNELS_2026,
  SECONDARY_MARKET,
} from './exits-trajectories';

// Comparables europeens
export {
  MIGHTY_50_CRITERIA,
  MIGHTY_50_SAMPLE,
  NOTABLE_EUROPEAN_ROUNDS_2025,
  EUROPEAN_DEEPTECH_2025,
  EUROPEAN_FOUNDER_FLIGHT,
  EUROPEAN_FOUNDER_PIPELINE,
} from './european-comparables';

// Cadrage macro consolide
export {
  LP_LIQUIDITY_PRESSURE,
  MARKET_CONCENTRATION_2026_Q1,
  DRY_POWDER_2024_2025,
  FUNDRAISING_BIFURCATION_2026,
  EUROPEAN_MACRO_2025,
  US_MARKET_SENTIMENT_2026_Q1,
  EUROPEAN_REGULATORY_PIPELINE_2026,
} from './macro-context';

/**
 * Version courante de la couche benchmarks.
 * A bumper a chaque mise a jour trimestrielle.
 */
export const BENCHMARKS_VERSION = '2026-Q2-v1';
export const BENCHMARKS_LAST_UPDATED = '2026-05-01';
