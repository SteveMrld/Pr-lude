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
  /**
   * Annee de calibration du seuil. Optionnel et reserve aux overrides
   * par indicateur (ex. NDR recalibre sur une source plus recente). Par
   * defaut, la fraicheur du seuil est portee par IndicatorBenchmarkSet.
   * asOf, partagee par tous les seuils du couple (asset-class, stage).
   * Format conventionnel : 'YYYY' ou 'YYYY-Qn'.
   */
  asOf?: string;
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
  /**
   * Annee de calibration la plus recente parmi les sources citees dans
   * l en-tete de fichier. Surfacee par computeBenchmarkFreshnessMonths
   * pour declencher un signal sobre dans la note d instruction quand
   * l ancrage benchmark depasse 12 mois. Optionnel pour compat retro.
   */
  asOf?: string;
  /**
   * Niveau de fiabilite du jeu de seuils pour ce couple (asset-class,
   * stage). Utile quand on signale au lecteur que les seuils sont
   * partages avec un autre asset class par defaut de calibration
   * dediee (cas industrial-hardware et deeptech, dont les templates
   * ne sont pas differencies par stade).
   */
  confidence?: 'high' | 'medium' | 'low';
  /** Note de doctrine pour ce jeu de seuils (limite, fallback, etc.). */
  notes?: string;
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
  asOf: '2024',
};

const TPL_SAAS_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2, surveille: 3, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 60, sain: 40, surveille: 20, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 120, sain: 110, surveille: 100, direction: 'higher-is-better', unit: '%' },
  magicNumber: { best: 1, sain: 0.75, surveille: 0.5, direction: 'higher-is-better', unit: 'x' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 80, sain: 70, surveille: 60, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 200_000, sain: 150_000, surveille: 100_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

const TPL_SAAS_SERIES_B: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1, sain: 1.5, surveille: 2, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 60, sain: 40, surveille: 20, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 130, sain: 115, surveille: 100, direction: 'higher-is-better', unit: '%' },
  magicNumber: { best: 1, sain: 0.75, surveille: 0.5, direction: 'higher-is-better', unit: 'x' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 80, sain: 75, surveille: 65, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 200_000, surveille: 150_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

const TPL_SAAS_SERIES_C: IndicatorBenchmarkSet = {
  burnMultiple: { best: 0.5, sain: 1, surveille: 1.5, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 60, sain: 40, surveille: 20, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 130, sain: 115, surveille: 100, direction: 'higher-is-better', unit: '%' },
  magicNumber: { best: 1, sain: 0.75, surveille: 0.5, direction: 'higher-is-better', unit: 'x' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 80, sain: 75, surveille: 65, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 300_000, sain: 250_000, surveille: 200_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

// Marketplace : take rate effectif comme proxy de marge brute, NDR pas pertinent
const TPL_MARKETPLACE_SEED: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2, sain: 3, surveille: 5, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 40, sain: 20, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 18, sain: 24, surveille: 36, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 35, sain: 25, surveille: 15, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 200_000, sain: 120_000, surveille: 60_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

const TPL_MARKETPLACE_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2.5, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 40, sain: 25, surveille: 10, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 18, sain: 24, surveille: 36, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 40, sain: 30, surveille: 20, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 180_000, surveille: 100_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

// Fintech B2B/B2C : marges intermediaires, NDR applicable B2B
const TPL_FINTECH_SEED: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2, sain: 3, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 25, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 18, sain: 24, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 65, sain: 50, surveille: 35, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 200_000, sain: 150_000, surveille: 80_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

const TPL_FINTECH_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2, surveille: 3, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 30, surveille: 15, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 115, sain: 105, surveille: 95, direction: 'higher-is-better', unit: '%' },
  magicNumber: { best: 0.75, sain: 0.5, surveille: 0.3, direction: 'higher-is-better', unit: 'x' },
  paybackCac: { best: 18, sain: 24, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 70, sain: 55, surveille: 40, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 180_000, surveille: 120_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

// Edtech : marges contenu legerement plus elevees que services humains
const TPL_EDTECH_SEED: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2, sain: 3, surveille: 5, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 25, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 12, sain: 18, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 65, sain: 50, surveille: 35, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 150_000, sain: 100_000, surveille: 50_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

const TPL_EDTECH_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2.5, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 30, surveille: 15, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 110, sain: 100, surveille: 90, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 12, sain: 18, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 70, sain: 55, surveille: 40, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 180_000, sain: 130_000, surveille: 80_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

// Hardware / industrial : marges 30-50%, capital efficiency comme metrique cle.
// G4 (audit corpus mai 2026) : ce template est applique aux 4 stages
// (seed/A/B/C+) faute de matiere editoriale dediee permettant de
// modeliser la pente attendue de durcissement du burn multiple avec
// la maturite. On refuse d inventer une contraction par translation
// abstraite de la pente SaaS : on signale la limite confidence: low
// et on documente le partage par stade dans notes. Le pipeline avale
// peut surfacer cette limite vers le lecteur sans masquer la
// degradation de precision pour les industriels Series B+.
const TPL_HARDWARE_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2.5, sain: 4, surveille: 6, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 30, sain: 15, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 24, sain: 36, surveille: 48, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 50, sain: 40, surveille: 25, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 350_000, sain: 250_000, surveille: 150_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
  confidence: 'low',
  notes: 'Seuils calibres sur Series A industrielle, appliques sans differenciation aux stades seed / Series B / Series C+ faute de matiere editoriale dediee permettant de modeliser la pente attendue de durcissement avec la maturite. A interpreter en fonction du stade reel du dossier : un industriel Series C+ devrait etre plus exigeant sur le burn multiple, un seed plus tolerant. En attente de sources externes pour calibration par stade.',
};

// Deeptech : phases longues, profitability tardive.
// Meme remarque G4 que TPL_HARDWARE_SERIES_A : template applique aux
// 4 stades faute de calibration dediee, confidence: low.
const TPL_DEEPTECH_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 3, sain: 5, surveille: 8, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 30, sain: 10, surveille: -10, direction: 'higher-is-better', unit: '%' },
  grossMargin: { best: 70, sain: 55, surveille: 40, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 150_000, surveille: 80_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
  confidence: 'low',
  notes: 'Seuils calibres sur Series A deeptech, appliques sans differenciation aux stades seed / Series B / Series C+ faute de matiere editoriale dediee. Un deeptech mature en Series C+ avec produit commercialise devrait etre plus exigeant sur burn multiple ; un seed pre-revenu plus tolerant. En attente de sources externes pour calibration par stade.',
};

// Healthtech : profil dominant healthcare SaaS calibre sur Bessemer
// Venture Partners Atlas "Benchmarks for Growing Health Tech Businesses"
// 2022 et "How to scale a health tech business to 100M ARR" 2023 (reprise
// Rocket Digital Health 2025). Cycle de vente sante plus lent que le
// SaaS pur (paybackCac assoupli), composante services frequente
// (grossMargin tolerante a 60% sain), R-of-40 plus modere reflet de la
// frilosite des hopitaux et payeurs sur le tempo d adoption.
// G3 (audit corpus mai 2026) : sortie du mapping TPL_FINTECH qui
// imposait des seuils fintech SaaS decales sur un dossier sante.
const TPL_HEALTHTECH: IndicatorBenchmarkSet = {
  burnMultiple: { best: 2, sain: 3, surveille: 5, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 35, sain: 15, surveille: 0, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 15, sain: 20, surveille: 30, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 75, sain: 60, surveille: 45, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 200_000, sain: 130_000, surveille: 70_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2023',
  confidence: 'medium',
  notes: 'Template cale sur le profil dominant healthcare SaaS (sources Bessemer Atlas 2022/2023). Sous-modeles a affiner : les services tech-enabled sante portent des marges brutes plus basses (25-45% a 1-10M$ revenu, montant vers 35-60% top quartile) et se jugent en EV/Gross Profit plutot qu en EV/ARR. Le medtech device releve d un profil hardware (exit 2-5x revenue, cycle reglementaire long), pas de ce template. NDR et Magic Number non instrumentes faute de seuils sources publies par stade.',
};

// Climate-tech : profil capital-intensif a long horizon, calibration
// qualitative sur Sightline Climate / CTVC 2025 Climate Tech Investment
// Trends et Net Zero Insights State of Climate Tech Q3 2025. Le climate-
// tech recouvre des economies opposees : software (comptabilite carbone,
// marges SaaS) versus hardware/infrastructure (gigafactory, hydrogene,
// capital lourd). Aucun benchmark operationnel granulaire par stade n est
// publiquement sourcable a ce jour, d ou confidence: low.
// G3 (audit corpus mai 2026) : sortie du mapping TPL_FINTECH qui calait
// un climate-tech CAPEX sur des seuils fintech SaaS asset-light.
const TPL_CLIMATE: IndicatorBenchmarkSet = {
  burnMultiple: { best: 3, sain: 5, surveille: 8, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 25, sain: 10, surveille: -10, direction: 'higher-is-better', unit: '%' },
  grossMargin: { best: 60, sain: 35, surveille: 15, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 250_000, sain: 150_000, surveille: 80_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2025',
  confidence: 'low',
  notes: 'Le climate-tech recouvre du software (comptabilite carbone, marges SaaS) et du hardware/infrastructure (capital lourd), economies opposees. Ce template vise le profil capital-intensif dominant en VC climate europeen. Calibration qualitative faute de benchmark operationnel granulaire publie par stade. A interpreter selon que le dossier est software ou hardware. Garder en tete : Series C devenue valley of death sur le climate-tech 2024-2025, financement first-of-a-kind reste la falaise structurelle du runway (sources Sightline / CTVC 2025, Net Zero Insights Q3 2025). PaybackCac SaaS non pertinent par defaut.',
};

// AI generative : marges erodees par cout LLM
const TPL_AI_GEN_SERIES_A: IndicatorBenchmarkSet = {
  burnMultiple: { best: 1.5, sain: 2.5, surveille: 4, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 50, sain: 30, surveille: 10, direction: 'higher-is-better', unit: '%' },
  ndr: { best: 120, sain: 105, surveille: 95, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 65, sain: 50, surveille: 35, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 300_000, sain: 200_000, surveille: 150_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
};

// Profitable-mature : on durcit le burn multiple, on baisse l exigence sur growth
const TPL_PROFITABLE_MATURE: IndicatorBenchmarkSet = {
  burnMultiple: { best: 0, sain: 0.5, surveille: 1, direction: 'lower-is-better', unit: 'x' },
  ruleOf40: { best: 40, sain: 25, surveille: 15, direction: 'higher-is-better', unit: '%' },
  paybackCac: { best: 12, sain: 18, surveille: 24, direction: 'lower-is-better', unit: 'mois' },
  grossMargin: { best: 50, sain: 35, surveille: 25, direction: 'higher-is-better', unit: '%' },
  revenuePerEmployee: { best: 400_000, sain: 300_000, surveille: 200_000, direction: 'higher-is-better', unit: 'EUR/FTE' },
  asOf: '2024',
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
    'seed': TPL_HEALTHTECH,
    'series-a': TPL_HEALTHTECH,
    'series-b': TPL_HEALTHTECH,
    'series-c-plus': TPL_HEALTHTECH,
  },
  'climate-tech': {
    'seed': TPL_CLIMATE,
    'series-a': TPL_CLIMATE,
    'series-b': TPL_CLIMATE,
    'series-c-plus': TPL_CLIMATE,
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
 * Calcule l anciennete d un asOf benchmark en mois pleins, relative
 * au today fourni (ou Date.now() par defaut). Accepte les formats
 * 'YYYY' et 'YYYY-Qn'. La date de reference est calee en fin de
 * periode (decembre pour 'YYYY', dernier mois du trimestre pour
 * 'YYYY-Qn') pour eviter de sur-flagger : on suppose toujours que la
 * source a ete publiee au plus tard possible dans sa periode.
 *
 * Retourne null si le format est invalide ou si asOf est absent. Le
 * code appelant traite null comme "pas de signal de fraicheur",
 * different de zero qui voudrait dire "calibration toute fraiche".
 */
export function computeBenchmarkFreshnessMonths(
  asOf: string | undefined | null,
  today: Date = new Date(),
): number | null {
  if (!asOf) return null;
  const trimmed = asOf.trim();
  // 'YYYY-Qn' : on prend le dernier mois du trimestre.
  const qMatch = /^(\d{4})-Q([1-4])$/.exec(trimmed);
  if (qMatch) {
    const year = parseInt(qMatch[1], 10);
    const quarter = parseInt(qMatch[2], 10);
    const month = quarter * 3; // Q1->3, Q2->6, Q3->9, Q4->12
    const ref = new Date(Date.UTC(year, month - 1, 28));
    return monthsBetween(ref, today);
  }
  // 'YYYY' : on suppose decembre (la source a ete publiee dans l annee).
  const yMatch = /^(\d{4})$/.exec(trimmed);
  if (yMatch) {
    const year = parseInt(yMatch[1], 10);
    const ref = new Date(Date.UTC(year, 11, 28)); // 28 decembre
    return monthsBetween(ref, today);
  }
  return null;
}

function monthsBetween(from: Date, to: Date): number {
  const diff = (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + (to.getUTCMonth() - from.getUTCMonth());
  return Math.max(0, diff);
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
