// ============================================================
// BENCHMARKS SECTORIELS DE VALORISATION
// ------------------------------------------------------------
// Plages de multiples par secteur et par stade, agregees a partir
// de sources publiques de reference du metier VC. Ces plages
// servent de base au moteur valuation-engine pour produire des
// fourchettes pre-money plausibles sur les dossiers instruits.
//
// SOURCES PUBLIQUES UTILISEES :
//   - Bessemer Cloud Index 2024 (multiples ARR pour SaaS public)
//   - OpenView SaaS Benchmarks 2024 (private SaaS metrics)
//   - Battery Ventures Cloud Software Index 2024
//   - Atomico State of European Tech 2024-2025
//   - Carta State of Private Markets Q3-Q4 2024
//   - SVB State of Tech Banking 2024
//
// PRINCIPE : on conserve une plage [min, central, max] par
// combinaison secteur x stade. Le central correspond a la mediane
// observee sur la periode 2023-2025, le min au 25e percentile, le
// max au 75e percentile. Pour les secteurs ou les donnees sont
// fragmentees (defense tech emergent, agritech, etc.), la plage
// est plus large et signalee 'wider-uncertainty'.
//
// MAINTENANCE : a refresher annuellement quand les rapports
// Bessemer / Atomico / Carta sortent. Les multiples bougent
// significativement avec les cycles macro (correction 2022-2023,
// rebond IA 2024-2025).
//
// LIMITATION : ces plages sont indicatives, pas predictives. Une
// startup avec une croissance superieure a 200% en SaaS B2B peut
// largement depasser le max de sa plage (cas typique : OpenAI,
// Anthropic). Inversement une startup en plateau peut cter sous
// le min. Le moteur applique des ajustements en fonction de la
// qualite equipe et du timing macro mesures dans les Bloc 1.
// ============================================================

/**
 * Une plage de multiple sectoriel : minimum, central (mediane),
 * maximum. Les valeurs sont des coefficients a multiplier par la
 * metrique de base (ARR, revenue, GMV selon le multipleType).
 */
export interface SectorMultipleRange {
  min: number;
  central: number;
  max: number;
  /**
   * Quelle metrique de base on multiplie. Determine si on a besoin
   * de l ARR (SaaS), du revenue (services), du GMV (marketplace),
   * ou de l EBITDA (profitable mature).
   */
  multipleType: 'arr' | 'revenue' | 'gmv' | 'ebitda';
  /** Niveau de fiabilite de la plage (depend du nombre de data points). */
  confidence: 'high' | 'medium' | 'low';
  /** Note metier specifique a la plage. */
  notes?: string;
}

/**
 * Cle = "asset-class normalisee", value = plages par stade.
 * Les asset-classes correspondent au champ sectorAssetClass utilise
 * ailleurs dans Prelude (verified-comparables, market-engine).
 */
export interface SectorBenchmarks {
  [assetClass: string]: {
    [stage: string]: SectorMultipleRange;
  };
}

/**
 * Mapping des stades : seed, series-a, series-b, series-c-plus.
 * Le pipeline normalise tous les stades vers ces quatre buckets
 * (le pre-seed se traite comme seed avec ajustement Berkus).
 */
export type ValuationStage = 'seed' | 'series-a' | 'series-b' | 'series-c-plus';

/**
 * Mapping permissif : differentes strings de roundType qu on peut
 * recevoir depuis l extraction LLM, vers les quatre stades canoniques.
 */
export function normalizeStage(rawStage: string | null | undefined): ValuationStage {
  if (!rawStage) return 'seed';
  const s = rawStage.toLowerCase();
  if (s.includes('pre-seed') || s.includes('preseed') || s.includes('pre seed')) return 'seed';
  if (s.includes('seed')) return 'seed';
  if (s.includes('series a') || s.includes('series-a') || s.includes('seriea') || s === 'a') return 'series-a';
  if (s.includes('series b') || s.includes('series-b') || s.includes('seriesb') || s === 'b') return 'series-b';
  if (s.includes('series c') || s.includes('series d') || s.includes('series e')
    || s.includes('growth') || s.includes('late') || s.includes('pre-ipo')) return 'series-c-plus';
  return 'seed';
}

/**
 * Plages de multiples par secteur et stade. Sources et periode de
 * collecte indiquees par bloc.
 *
 * Les plages incluent un facteur d ajustement pour le marche europeen
 * : les multiples sont generalement 20-30% plus bas qu aux US sur
 * les rounds prives early-stage. Les plages ci-dessous sont calibrees
 * pour des deals europeens.
 */
export const SECTOR_BENCHMARKS: SectorBenchmarks = {
  // ============================================================
  // SAAS B2B
  // Sources : Bessemer Cloud Index 2024, OpenView 2024, Atomico 2025
  // Periode : transactions 2023-2025
  // ============================================================
  'saas-b2b': {
    seed: {
      min: 4, central: 8, max: 15, multipleType: 'arr', confidence: 'medium',
      notes: 'A ce stade l ARR est souvent <300k. Les multiples eleves refletent l option-value, pas une realite economique.',
    },
    'series-a': {
      min: 8, central: 15, max: 25, multipleType: 'arr', confidence: 'high',
      notes: 'Plage centrale 15x ARR pour SaaS B2B europeen avec croissance 100-150%. Au-dela de 200% de croissance, depassement frequent du max.',
    },
    'series-b': {
      min: 6, central: 10, max: 18, multipleType: 'arr', confidence: 'high',
      notes: 'La compression des multiples post-2022 a touche la Series B en premier. Median ~10x.',
    },
    'series-c-plus': {
      min: 4, central: 7, max: 12, multipleType: 'arr', confidence: 'high',
      notes: 'Multiples convergent vers ceux du marche public a mesure que le deal s approche du IPO.',
    },
  },

  // ============================================================
  // FINTECH (banking, lending, payments, insurtech)
  // Sources : Carta Q4 2024, FT Partners 2024, Atomico 2025
  // ============================================================
  'fintech': {
    seed: {
      min: 3, central: 6, max: 12, multipleType: 'revenue', confidence: 'medium',
      notes: 'Multiples plus bas que SaaS pur a cause du cout d acquisition reglementaire et de la pression marges.',
    },
    'series-a': {
      min: 5, central: 10, max: 18, multipleType: 'revenue', confidence: 'high',
      notes: 'Large dispersion selon vertical : payments (premium) vs lending (decoté).',
    },
    'series-b': {
      min: 4, central: 7, max: 13, multipleType: 'revenue', confidence: 'high',
    },
    'series-c-plus': {
      min: 2, central: 5, max: 9, multipleType: 'revenue', confidence: 'high',
      notes: 'Compression severe sur fintech mature post-correction 2022.',
    },
  },

  // ============================================================
  // MARKETPLACE B2C / CONSUMER
  // Sources : Atomico 2025, Crunchbase 2024, public benchmarks
  // (Airbnb, Uber, DoorDash trajectoires)
  // ============================================================
  'marketplace-b2c': {
    seed: {
      min: 2, central: 4, max: 8, multipleType: 'gmv', confidence: 'medium',
      notes: 'Multiple sur GMV plutot que revenue : a ce stade le take-rate fluctue trop. Si pas de GMV stable, retomber sur Berkus.',
    },
    'series-a': {
      min: 1.5, central: 3, max: 6, multipleType: 'gmv', confidence: 'medium',
      notes: 'Plage etroite : la qualite de la liquidite (depth marketplace) compte plus que le GMV brut.',
    },
    'series-b': {
      min: 1, central: 2, max: 4, multipleType: 'gmv', confidence: 'medium',
    },
    'series-c-plus': {
      min: 0.5, central: 1.2, max: 2.5, multipleType: 'gmv', confidence: 'high',
    },
  },

  // ============================================================
  // ECOMMERCE / DTC
  // Sources : Carta 2024, Atomico 2024, deal data publique
  // ============================================================
  'ecommerce-dtc': {
    seed: {
      min: 1, central: 2.5, max: 5, multipleType: 'revenue', confidence: 'medium',
      notes: 'DTC sous pression depuis 2022. Multiples 50% plus bas qu en 2021.',
    },
    'series-a': {
      min: 0.8, central: 2, max: 4, multipleType: 'revenue', confidence: 'high',
    },
    'series-b': {
      min: 0.6, central: 1.5, max: 3, multipleType: 'revenue', confidence: 'high',
    },
    'series-c-plus': {
      min: 0.4, central: 1, max: 2.2, multipleType: 'revenue', confidence: 'high',
      notes: 'Convergence vers les multiples retail public (1-2x revenue mature).',
    },
  },

  // ============================================================
  // DEEPTECH (hardware, biotech, advanced materials, quantum)
  // Sources : Atomico Deeptech 2024, KfW Capital 2024
  // ============================================================
  'deeptech': {
    seed: {
      min: 0, central: 0, max: 0, multipleType: 'revenue', confidence: 'low',
      notes: 'A ce stade pre-revenue le multiple n est pas applicable. Utiliser methode Berkus + valorisation IP / TRL. Plage typique observee : pre-money 3-15M€ selon TRL et qualite equipe.',
    },
    'series-a': {
      min: 8, central: 18, max: 40, multipleType: 'revenue', confidence: 'low',
      notes: 'Tres forte dispersion. Le multiple eleve reflete la valorisation forward (revenue projete 24 mois) plutot que le revenue actuel. Si pas de revenue, basculer sur methode VC inverse.',
    },
    'series-b': {
      min: 5, central: 12, max: 22, multipleType: 'revenue', confidence: 'medium',
    },
    'series-c-plus': {
      min: 3, central: 7, max: 14, multipleType: 'revenue', confidence: 'medium',
    },
  },

  // ============================================================
  // CYBERSECURITY
  // Sources : Momentum Cyber 2024, Atomico 2024
  // ============================================================
  'cybersecurity': {
    seed: {
      min: 5, central: 10, max: 18, multipleType: 'arr', confidence: 'medium',
      notes: 'Premium par rapport au SaaS B2B generique grace au TAM grow et a la bargaining power CISO.',
    },
    'series-a': {
      min: 10, central: 18, max: 30, multipleType: 'arr', confidence: 'high',
    },
    'series-b': {
      min: 7, central: 12, max: 20, multipleType: 'arr', confidence: 'high',
    },
    'series-c-plus': {
      min: 5, central: 8, max: 14, multipleType: 'arr', confidence: 'high',
    },
  },

  // ============================================================
  // HEALTHTECH / DIGITAL HEALTH
  // Sources : Rock Health 2024, Atomico Healthtech 2024
  // ============================================================
  'healthtech': {
    seed: {
      min: 3, central: 6, max: 12, multipleType: 'revenue', confidence: 'medium',
      notes: 'Distinguer digital health (multiples SaaS) et MedTech reglemente (multiples plus bas).',
    },
    'series-a': {
      min: 6, central: 11, max: 18, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 4, central: 8, max: 14, multipleType: 'revenue', confidence: 'medium',
    },
    'series-c-plus': {
      min: 3, central: 6, max: 10, multipleType: 'revenue', confidence: 'high',
    },
  },

  // ============================================================
  // CLIMATE TECH / ENERGY
  // Sources : Sightline Climate 2024, Atomico Climate 2024
  // ============================================================
  'climate-tech': {
    seed: {
      min: 2, central: 5, max: 10, multipleType: 'revenue', confidence: 'medium',
      notes: 'Souvent capital intensive : valorisation impacted par CAPEX requis. Multiples plus bas que SaaS pur.',
    },
    'series-a': {
      min: 4, central: 9, max: 16, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 3, central: 6, max: 11, multipleType: 'revenue', confidence: 'medium',
    },
    'series-c-plus': {
      min: 2, central: 4, max: 8, multipleType: 'revenue', confidence: 'medium',
    },
  },

  // ============================================================
  // DEFENSE TECH (emergent post-2022)
  // Sources : SVB Defense Tech 2024, NATO Innovation Fund
  // ============================================================
  'defense': {
    seed: {
      min: 0, central: 0, max: 0, multipleType: 'revenue', confidence: 'low',
      notes: 'Secteur recent. Multiples non stabilises. Utiliser comparables Anduril/Helsing/ICEYE en justification qualitative plutot qu en plage chiffree.',
    },
    'series-a': {
      min: 8, central: 18, max: 35, multipleType: 'revenue', confidence: 'low',
      notes: 'Premium tres eleve sur backlog gov contracts vs revenue execute. La distinction backlog vs revenue execute est critique.',
    },
    'series-b': {
      min: 6, central: 12, max: 22, multipleType: 'revenue', confidence: 'low',
    },
    'series-c-plus': {
      min: 4, central: 8, max: 15, multipleType: 'revenue', confidence: 'low',
    },
  },

  // ============================================================
  // HOSPITALITY / TRAVEL TECH
  // Sources : Skift 2024, Atomico Travel 2024
  // ============================================================
  'hospitality': {
    seed: {
      min: 1, central: 3, max: 6, multipleType: 'revenue', confidence: 'medium',
    },
    'series-a': {
      min: 2, central: 4.5, max: 9, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 1.5, central: 3.5, max: 7, multipleType: 'revenue', confidence: 'medium',
    },
    'series-c-plus': {
      min: 1, central: 2.5, max: 5, multipleType: 'revenue', confidence: 'medium',
    },
  },

  // ============================================================
  // AI / GENERATIVE AI (categorie premium 2024-2026)
  // Sources : CB Insights 2024, Crunchbase AI 2024
  // ATTENTION : multiples extremes a manipuler avec precaution
  // ============================================================
  'ai-generative': {
    seed: {
      min: 5, central: 15, max: 40, multipleType: 'arr', confidence: 'low',
      notes: 'Plage tres large reflechissant la frenesie 2023-2024. Les multiples bas (5x) correspondent aux dossiers AI wrapper sans defensibilite, les multiples eleves aux vrais foundation models. Le moteur doit ajuster en fonction du score Singularites contrariennes (defensibilite reelle).',
    },
    'series-a': {
      min: 10, central: 25, max: 60, multipleType: 'arr', confidence: 'low',
      notes: 'Cas Anthropic/OpenAI/Mistral : multiples 50-200x non aberrants. Cas AI feature thin wrapper : multiples 5-10x.',
    },
    'series-b': {
      min: 8, central: 18, max: 35, multipleType: 'arr', confidence: 'low',
    },
    'series-c-plus': {
      min: 5, central: 12, max: 25, multipleType: 'arr', confidence: 'low',
    },
  },
};

/**
 * Mapping permissif des secteurs / asset classes textuels vers les
 * cles SECTOR_BENCHMARKS. Le moteur d extraction LLM produit des
 * libelles libres, on les normalise ici.
 */
export function normalizeAssetClass(raw: string | null | undefined): string {
  if (!raw) return 'saas-b2b'; // default safe
  const s = raw.toLowerCase();

  if (s.includes('ai') || s.includes('genai') || s.includes('llm') || s.includes('generative')
    || s.includes('foundation model') || s.includes('intelligence artificielle')) return 'ai-generative';
  if (s.includes('saas') || s.includes('b2b') || s.includes('software')) return 'saas-b2b';
  if (s.includes('fintech') || s.includes('finance') || s.includes('banking') || s.includes('payment')
    || s.includes('insurtech') || s.includes('lending')) return 'fintech';
  if (s.includes('marketplace') || s.includes('platform b2c') || s.includes('consumer marketplace')) return 'marketplace-b2c';
  if (s.includes('ecommerce') || s.includes('dtc') || s.includes('direct to consumer')
    || s.includes('retail')) return 'ecommerce-dtc';
  if (s.includes('deeptech') || s.includes('deep tech') || s.includes('hardware')
    || s.includes('biotech') || s.includes('quantum') || s.includes('materials')) return 'deeptech';
  if (s.includes('cyber') || s.includes('security')) return 'cybersecurity';
  if (s.includes('health') || s.includes('medical') || s.includes('digital health')
    || s.includes('medtech')) return 'healthtech';
  if (s.includes('climate') || s.includes('energy') || s.includes('cleantech') || s.includes('greentech')
    || s.includes('decarbonisation')) return 'climate-tech';
  if (s.includes('defense') || s.includes('defence') || s.includes('military')
    || s.includes('dual-use') || s.includes('aerospace')) return 'defense';
  if (s.includes('hospitality') || s.includes('travel') || s.includes('tourism')
    || s.includes('hotel') || s.includes('vacation')) return 'hospitality';

  return 'saas-b2b'; // fallback safe
}

/**
 * Recupere les multiples sectoriels pour une combinaison
 * (secteur, stade) donnee, avec normalisation des deux entrees.
 * Retourne null si on tombe sur une combinaison ou les multiples
 * ne sont pas applicables (typiquement deeptech seed pre-revenue).
 */
export function getSectorMultiples(
  rawAssetClass: string | null | undefined,
  rawStage: string | null | undefined,
): { range: SectorMultipleRange; assetClass: string; stage: ValuationStage } | null {
  const assetClass = normalizeAssetClass(rawAssetClass);
  const stage = normalizeStage(rawStage);
  const sectorData = SECTOR_BENCHMARKS[assetClass];
  if (!sectorData) return null;
  const range = sectorData[stage];
  if (!range || (range.min === 0 && range.central === 0 && range.max === 0)) return null;
  return { range, assetClass, stage };
}
