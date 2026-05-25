// ============================================================
// BENCHMARKS DES INDICATEURS DEAL TYPE
// ------------------------------------------------------------
// Seuils de classification des sept indicateurs cles par couple
// (asset-class, stage). Permet de produire un verdict pour chaque
// indicateur calcule sur le dossier instruit :
//   - best-in-class : top quartile, signal tres positif
//   - sain : entre mediane et top quartile, signal acceptable
//   - a-surveiller : entre mediane basse et mediane, signal prudent
//   - rouge : sous la mediane basse, signal critique
//
// SOURCES PUBLIQUES UTILISEES :
//   - David Sacks Burn Multiple framework 2020-2024
//   - OpenView SaaS Benchmarks 2024 (NDR, Magic Number, Payback)
//   - Bessemer State of the Cloud 2024 (Rule of 40, Net Magic)
//   - Pavilion B2B SaaS Benchmarks 2024 (Revenue per employee)
//   - ChartMogul SaaS Churn Benchmarks 2024 (NDR, GRR)
//   - Atomico State of European Tech 2024-2025
//   - Crunchbase + PitchBook Q4 2024 sectoriels
//
// PRINCIPE EDITORIAL : ces seuils sont indicatifs, calibres sur
// l etat du marche europeen 2024-2025. Ils servent a positionner
// le dossier instruit par rapport a une distribution sectorielle
// connue, pas a juger en absolu. Un dossier rouge sur Burn Multiple
// peut etre defendable si le narratif accompagne (acquisition
// massive de marche pre-monetisation), mais il merite un drapeau
// dans la note d investissement.
//
// MAINTENANCE : a refresher annuellement avec les rapports de
// reference (OpenView, Bessemer, Pavilion, Carta).
// ============================================================

import type { ValuationStage } from './sector-benchmarks';

/**
 * Seuils de classification d un indicateur. Higher-is-better par
 * defaut (best > sain > surveille > rouge). Pour les indicateurs
 * lower-is-better (Burn Multiple, Payback CAC), c est l inverse.
 */
export interface IndicatorThresholds {
  /** Seuil au-dessus duquel l indicateur est best-in-class. */
  best: number;
  /** Seuil au-dessus duquel l indicateur est sain (mais pas top). */
  sain: number;
  /** Seuil au-dessus duquel l indicateur est a-surveiller. */
  surveille: number;
  /** Tout ce qui est sous surveille tombe dans rouge. */
  /** Direction : 'higher-is-better' (defaut) ou 'lower-is-better'. */
  direction: 'higher-is-better' | 'lower-is-better';
  /** Unite affichable (ex. '%', 'mois', 'EUR/FTE'). */
  unit: string;
}

/**
 * Benchmarks complets pour un couple (asset-class, stage). Tous les
 * indicateurs ne sont pas applicables a tous les couples (ex. NDR
 * non applicable a ecommerce-dtc qui n a pas de revenue recurrent),
 * dans ce cas la cle correspondante est absente.
 */
export interface IndicatorBenchmarkSet {
  burnMultiple?: IndicatorThresholds;
  ruleOf40?: IndicatorThresholds;
  ndr?: IndicatorThresholds;
  magicNumber?: IndicatorThresholds;
  paybackCac?: IndicatorThresholds;
  grossMargin?: IndicatorThresholds;
  revenuePerEmployee?: IndicatorThresholds;
}

// ----- Templates reutilisables ---------------------------------

// SaaS pur : standards Sacks / Bessemer / OpenView
const TPL_SAAS_SEED: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2, sain: 3, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 60, sain: 30, surveille: 0, direction: 'higher-is-better', unit: '%' },
  // NDR mesurable seulement si plusieurs cohortes existent : peu fiable au seed
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 75, sain: 65, surveille: 50, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 150_000, sain: 100_000, surveille: 50_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

const TPL_SAAS_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2, surveille: 3, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 60, sain: 40, surveille: 20, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 120, sain: 110, surveille: 100, direction: 'higher-is-better', unit: '%' },
  magicNumber: { best: 1, sain: 0.75, surveille: 0.5, direction: 'higher-is-better', unit: 'x' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 80, sain: 70, surveille: 60, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 200_000, sain: 150_000, surveille: 100_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

const TPL_SAAS_SERIES_B: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1, sain: 1.5, surveille: 2, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 60, sain: 40, surveille: 20, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 130, sain: 115, surveille: 100, direction: 'higher-is-better', unit: '%' },
  magicNumber: { best: 1, sain: 0.75, surveille: 0.5, direction: 'higher-is-better', unit: 'x' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 80, sain: 75, surveille: 65, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 200_000, surveille: 150_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

const TPL_SAAS_SERIES_C: IndicatorBenchmarkSet = {
  burnMultiple: { best: 0.5, sain: 1, surveille: 1.5, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 60, sain: 40, surveille: 20, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 130, sain: 115, surveille: 100, direction: 'higher-is-better', unit: '%' },
  magicNumber: { best: 1, sain: 0.75, surveille: 0.5, direction: 'higher-is-better', unit: 'x' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 80, sain: 75, surveille: 65, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 300_000, sain: 250_000, surveille: 200_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

// Marketplace : take rate effectif comme proxy de marge brute, NDR pas pertinent
const TPL_MARKETPLACE_SEED: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2, sain: 3, surveille: 5, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 40, sain: 20, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 18, sain: 24, surveille: 36, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 35, sain: 25, surveille: 15, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 200_000, sain: 120_000, surveille: 60_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

const TPL_MARKETPLACE_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2.5, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 40, sain: 25, surveille: 10, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 18, sain: 24, surveille: 36, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 40, sain: 30, surveille: 20, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 180_000, surveille: 100_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

// Fintech B2B/B2C : marges intermediaires, NDR applicable B2B
const TPL_FINTECH_SEED: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2, sain: 3, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 25, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 18, sain: 24, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 65, sain: 50, surveille: 35, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 200_000, sain: 150_000, surveille: 80_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

const TPL_FINTECH_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2, surveille: 3, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 30, surveille: 15, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 115, sain: 105, surveille: 95, direction: 'higher-is-better', unit: '%' },
  magicNumber: { best: 0.75, sain: 0.5, surveille: 0.3, direction: 'higher-is-better', unit: 'x' },
  paybackCac: { best: 18, sain: 24, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 70, sain: 55, surveille: 40, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 180_000, surveille: 120_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

// Edtech : marges contenu legerement plus elevees que services humains
const TPL_EDTECH_SEED: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2, sain: 3, surveille: 5, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 25, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 12, sain: 18, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 65, sain: 50, surveille: 35, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 150_000, sain: 100_000, surveille: 50_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

const TPL_EDTECH_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2.5, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 30, surveille: 15, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 110, sain: 100, surveille: 90, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 12, sain: 18, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 70, sain: 55, surveille: 40, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 180_000, sain: 130_000, surveille: 80_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

// Hardware / industrial : marges 30-50%, capital efficiency comme metrique cle
const TPL_HARDWARE_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2.5, sain: 4, surveille: 6, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 30, sain: 15, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 24, sain: 36, surveille: 48, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 50, sain: 40, surveille: 25, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 350_000, sain: 250_000, surveille: 150_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

// Deeptech : phases longues, profitability tardive
const TPL_DEEPTECH_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 3, sain: 5, surveille: 8, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 30, sain: 10, surveille: -10, direction: 'higher-is-better', unit: '%' },
  grossMargin: { best: 70, sain: 55, surveille: 40, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 150_000, surveille: 80_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

// AI generative : marges erodees par cout LLM
const TPL_AI_GEN_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2.5, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 30, surveille: 10, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 120, sain: 105, surveille: 95, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 65, sain: 50, surveille: 35, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 300_000, sain: 200_000, surveille: 150_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

// Profitable-mature : on durcit le burn multiple, on baisse l exigence sur growth
const TPL_PROFITABLE_MATURE: IndicatorBenchmarkSet = {
  burnMultiple: { best: 0, sain: 0.5, surveille: 1, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 40, sain: 25, surveille: 15, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 50, sain: 35, surveille: 25, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 400_000, sain: 300_000, surveille: 200_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
};

// ----- Mapping complet ----------------------------------------

export const INDICATOR_BENCHMARKS: Record<string, Record<ValuationStage, IndicatorBenchmarkSet>> = {
  'saas-b2b': {
    'seed': TPL_SAAS_SEED,
    'series-a': TPL_SAAS_SERIES_A,
    'series-b': TPL_SAAS_SERIES_B,
    'series-c-plus': TPL_SAAS_SERIES_C,
  },
  'cybersecurity': {
    'seed': TPL_SAAS_SEED,
    'series-a': TPL_SAAS_SERIES_A,
    'series-b': TPL_SAAS_SERIES_B,
    'series-c-plus': TPL_SAAS_SERIES_C,
  },
  'ai-generative': {
    'seed': TPL_SAAS_SEED,
    'series-a': TPL_AI_GEN_SERIES_A,
    'series-b': TPL_AI_GEN_SERIES_A,
    'series-c-plus': TPL_AI_GEN_SERIES_A,
  },
  'fintech': {
    'seed': TPL_FINTECH_SEED,
    'series-a': TPL_FINTECH_SERIES_A,
    'series-b': TPL_FINTECH_SERIES_A,
    'series-c-plus': TPL_FINTECH_SERIES_A,
  },
  'marketplace-b2c': {
    'seed': TPL_MARKETPLACE_SEED,
    'series-a': TPL_MARKETPLACE_SERIES_A,
    'series-b': TPL_MARKETPLACE_SERIES_A,
    'series-c-plus': TPL_MARKETPLACE_SERIES_A,
  },
  'ecommerce-dtc': {
    'seed': TPL_MARKETPLACE_SEED,
    'series-a': TPL_MARKETPLACE_SERIES_A,
    'series-b': TPL_MARKETPLACE_SERIES_A,
    'series-c-plus': TPL_MARKETPLACE_SERIES_A,
  },
  'edtech': {
    'seed': TPL_EDTECH_SEED,
    'series-a': TPL_EDTECH_SERIES_A,
    'series-b': TPL_EDTECH_SERIES_A,
    'series-c-plus': TPL_EDTECH_SERIES_A,
  },
  'mediatech': {
    'seed': TPL_EDTECH_SEED,
    'series-a': TPL_EDTECH_SERIES_A,
    'series-b': TPL_EDTECH_SERIES_A,
    'series-c-plus': TPL_EDTECH_SERIES_A,
  },
  'adtech': {
    'seed': TPL_EDTECH_SEED,
    'series-a': TPL_EDTECH_SERIES_A,
    'series-b': TPL_EDTECH_SERIES_A,
    'series-c-plus': TPL_EDTECH_SERIES_A,
  },
  'sportstech': {
    'seed': TPL_EDTECH_SEED,
    'series-a': TPL_EDTECH_SERIES_A,
    'series-b': TPL_EDTECH_SERIES_A,
    'series-c-plus': TPL_EDTECH_SERIES_A,
  },
  'healthtech': {
    'seed': TPL_FINTECH_SEED,
    'series-a': TPL_FINTECH_SERIES_A,
    'series-b': TPL_FINTECH_SERIES_A,
    'series-c-plus': TPL_FINTECH_SERIES_A,
  },
  'climate-tech': {
    'seed': TPL_FINTECH_SEED,
    'series-a': TPL_FINTECH_SERIES_A,
    'series-b': TPL_FINTECH_SERIES_A,
    'series-c-plus': TPL_FINTECH_SERIES_A,
  },
  'defense': {
    'seed': TPL_FINTECH_SEED,
    'series-a': TPL_HARDWARE_SERIES_A,
    'series-b': TPL_HARDWARE_SERIES_A,
    'series-c-plus': TPL_HARDWARE_SERIES_A,
  },
  'hospitality': {
    'seed': TPL_MARKETPLACE_SEED,
    'series-a': TPL_MARKETPLACE_SERIES_A,
    'series-b': TPL_MARKETPLACE_SERIES_A,
    'series-c-plus': TPL_MARKETPLACE_SERIES_A,
  },
  'foodtech': {
    'seed': TPL_HARDWARE_SERIES_A,
    'series-a': TPL_HARDWARE_SERIES_A,
    'series-b': TPL_HARDWARE_SERIES_A,
    'series-c-plus': TPL_HARDWARE_SERIES_A,
  },
  'proptech': {
    'seed': TPL_FINTECH_SEED,
    'series-a': TPL_FINTECH_SERIES_A,
    'series-b': TPL_FINTECH_SERIES_A,
    'series-c-plus': TPL_FINTECH_SERIES_A,
  },
  'logistics': {
    'seed': TPL_HARDWARE_SERIES_A,
    'series-a': TPL_HARDWARE_SERIES_A,
    'series-b': TPL_HARDWARE_SERIES_A,
    'series-c-plus': TPL_HARDWARE_SERIES_A,
  },
  'services-b2b': {
    'seed': TPL_EDTECH_SEED,
    'series-a': TPL_EDTECH_SERIES_A,
    'series-b': TPL_EDTECH_SERIES_A,
    'series-c-plus': TPL_EDTECH_SERIES_A,
  },
  'industrial-hardware': {
    'seed': TPL_HARDWARE_SERIES_A,
    'series-a': TPL_HARDWARE_SERIES_A,
    'series-b': TPL_HARDWARE_SERIES_A,
    'series-c-plus': TPL_HARDWARE_SERIES_A,
  },
  'deeptech': {
    'seed': TPL_DEEPTECH_SERIES_A,
    'series-a': TPL_DEEPTECH_SERIES_A,
    'series-b': TPL_DEEPTECH_SERIES_A,
    'series-c-plus': TPL_DEEPTECH_SERIES_A,
  },
  'profitable-mature': {
    'seed': TPL_PROFITABLE_MATURE,
    'series-a': TPL_PROFITABLE_MATURE,
    'series-b': TPL_PROFITABLE_MATURE,
    'series-c-plus': TPL_PROFITABLE_MATURE,
  },
};

/**
 * Recupere les benchmarks pour un couple (asset-class, stage).
 *
 * Doctrine : pas de fallback silencieux vers saas-b2b. Si la
 * combinaison n est pas couverte (asset-class 'unclassified', stage
 * 'unknown', ou paire absente de la table), retourne null. Le call
 * site (indicators-engine) doit alors marquer les sept indicateurs
 * canoniques non applicables, jamais les juger contre des seuils SaaS
 * decales (un constructeur naval note a l aune du burn multiple SaaS,
 * cas Platypus Craft mai 2026).
 *
 * Voir corollaire normalizeStage qui peut desormais retourner
 * 'unknown' : la propagation de l incertitude jusqu a la note
 * d investissement protege le partner d un score faux qui inspire une
 * fausse confiance.
 */
export function getIndicatorBenchmarks(
  assetClass: string,
  stage: ValuationStage | 'unknown',
): IndicatorBenchmarkSet | null {
  if (stage === 'unknown') return null;
  if (assetClass === 'unclassified') return null;
  return INDICATOR_BENCHMARKS[assetClass]?.[stage] ?? null;
}

/**
 * Classifie une valeur par rapport a un seuil de benchmark, en
 * tenant compte de la direction (higher-is-better ou lower-is-better).
 */
export function classifyValue(
  value: number,
  thresholds: IndicatorThresholds,
): 'best-in-class' | 'sain' | 'a-surveiller' | 'rouge' {
  if (thresholds.direction === 'higher-is-better') {
    if (value >= thresholds.best) return 'best-in-class';
    if (value >= thresholds.sain) return 'sain';
    if (value >= thresholds.surveille) return 'a-surveiller';
    return 'rouge';
  }
  // lower-is-better
  if (value <= thresholds.best) return 'best-in-class';
  if (value <= thresholds.sain) return 'sain';
  if (value <= thresholds.surveille) return 'a-surveiller';
  return 'rouge';
}
