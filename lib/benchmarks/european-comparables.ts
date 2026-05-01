/**
 * Comparables europeens crédibles pour Prelude.
 * Source: Atomico State of European Tech 2025.
 *
 * Pourquoi c est central:
 * Quand le moteur Pattern matching de Prelude cherche des comparables pour un dossier
 * europeen, il faut prioriser des companies europeennes plutot que d aller chercher
 * Anthropic ou OpenAI qui ne sont pas comparables (taille de capital deploye, profondeur
 * de marche, ecosysteme local).
 */

import { SOURCES } from './sources';

/**
 * Critères de qualification de la Mighty 50 (Atomico).
 */
export const MIGHTY_50_CRITERIA = {
  foundedSince: 2000,
  medianRevenueMillionsUsdMin: 100,
  valuationBillionsUsdMin: 2,
  employeeCountMin: 200,
  source: SOURCES.ATOMICO_SOET_2025,
} as const;

/**
 * Liste partielle de la Mighty 50 (Atomico SoET 2025).
 * A enrichir au fil de l eau quand de nouveaux noms emergent.
 */
export const MIGHTY_50_SAMPLE = [
  { name: 'Mistral', sector: 'AI / foundation models', country: 'France', notes: 'Series C 2 milliards US avec ASML' },
  { name: 'Lovable', sector: 'AI coding', country: 'Sweden', notes: 'Atteint 100M$ ARR en 8 mois (record software)' },
  { name: 'Synthesia', sector: 'AI video / enterprise', country: 'UK', notes: 'Gold standard enterprise AI video' },
  { name: 'n8n', sector: 'AI workflows', country: 'Germany', notes: 'Challenger de Zapier' },
  { name: 'DeepL', sector: 'AI translation', country: 'Germany', notes: 'Concurrent direct de Google Translate sur enterprise' },
  { name: 'ElevenLabs', sector: 'AI voice', country: 'UK / US', notes: 'Leader voix synthetique' },
  { name: 'Helsing', sector: 'Defense AI', country: 'Germany', notes: 'Series D 660M US 2025' },
  { name: 'Revolut', sector: 'Fintech / banking', country: 'UK', notes: '65M clients, cible 100M' },
  { name: 'Oura', sector: 'Healthtech / wearables', country: 'Finland', notes: 'CA 2025 estime a 2 milliards US (triple vs 2024)' },
  { name: 'Spotify', sector: 'Music streaming', country: 'Sweden', notes: 'Reference historique de licorne europeenne sortie' },
  { name: 'Stripe', sector: 'Fintech / payments', country: 'Ireland / US', notes: 'Reference fintech mondiale' },
  { name: 'Wise', sector: 'Fintech / cross-border', country: 'UK', notes: 'IPO Londres' },
  { name: 'Klarna', sector: 'Fintech / BNPL', country: 'Sweden', notes: 'IPO 2025 attendue / realisee selon date' },
] as const;

/**
 * Levees notables europeennes 2025.
 * Source: Atomico SoET 2025.
 */
export const NOTABLE_EUROPEAN_ROUNDS_2025 = [
  {
    company: 'NScale',
    sector: 'AI infrastructure',
    country: 'UK',
    round: 'Series B',
    amountMillionsUsd: 1100,
    notes: "Plus gros Series B UK historique. Partenariat strategique multi-investor (Aker ASA, NVIDIA, Dell, Nokia).",
  },
  {
    company: 'Mistral',
    sector: 'AI / foundation models',
    country: 'France',
    round: 'Series C',
    amountMillionsUsd: 2000,
    notes: "Anchor 1,5Md US par ASML.",
  },
  {
    company: 'Helsing',
    sector: 'Defense AI',
    country: 'Germany',
    round: 'Series D',
    amountMillionsUsd: 660,
  },
  {
    company: 'Isomorphic Labs',
    sector: 'AI / drug discovery',
    country: 'UK',
    round: 'Series A+',
    amountMillionsUsd: 600,
    notes: 'Spin-out de DeepMind.',
  },
  {
    company: 'Proxima Fusion',
    sector: 'Deeptech / fusion',
    country: 'Germany',
    round: 'Series A extension',
    amountMillionsEur: 200,
  },
] as const;

/**
 * Allocation deeptech europeenne 2025.
 * Source: Atomico SoET 2025.
 */
export const EUROPEAN_DEEPTECH_2025 = {
  shareOfEuropeanVcDollarsPercent: 36,
  shareOfEuropeanVcDollarsPercent2021: 19,
  totalDeployedBillionsUsd: 16,
  comparisonUsBigAiBetsBillionsUsd: 63, // OpenAI + Anthropic seuls
  notes: "L Europe diversifie ses paris deeptech (compute, quantum, defense, mobility, climate) tandis que les US concentrent sur quelques labs IA geants. Strategie differente, pas necessairement inferieure mais avec moins de gros gagnants potentiels.",
  source: SOURCES.ATOMICO_SOET_2025,
} as const;

/**
 * Trajectoire fondateurs europeens qui s expatrient aux US.
 * Source: Atomico SoET 2025.
 */
export const EUROPEAN_FOUNDER_FLIGHT = {
  seasonedFoundersIncorporatingInUsPercent2016: 10,
  seasonedFoundersIncorporatingInUsPercent2025: 18,
  aiFoundersStayingInEuropePercent2016: 74,
  aiFoundersStayingInEuropePercent2025: 81,
  notes: "Les seasoned founders europeens incorporent de plus en plus aux US (10% -> 18% en 9 ans). Mais a contre-courant, les founders IA restent davantage en Europe (74% -> 81%). Pour Prelude: un fondateur europeen qui choisit d incorporer en Europe est un signal positif, pas neutre.",
  source: SOURCES.ATOMICO_SOET_2025,
} as const;

/**
 * Nombre de nouveaux fondateurs europeens par an.
 * Source: Atomico SoET 2025.
 */
export const EUROPEAN_FOUNDER_PIPELINE = {
  newFoundersIn2025: 27000,
  growthVs2023Percent: 60, // ~60% de plus qu en 2023
  europeShareOfGlobalFoundersPercent2025: 28,
  asiaShareOfGlobalFoundersPercent2025: 28,
  source: SOURCES.ATOMICO_SOET_2025,
} as const;
