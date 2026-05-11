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

  // ============================================================
  // ADTECH / MEDIATECH
  // Sources : LUMA Partners 2024, eMarketer 2024
  // ============================================================
  'adtech': {
    seed: {
      min: 2, central: 4, max: 8, multipleType: 'revenue', confidence: 'medium',
      notes: 'Multiples plus bas que SaaS pur a cause du rev share et de la dependance plateformes (Google, Meta). Premium si ad tech infrastructure plutot que media buying.',
    },
    'series-a': {
      min: 3, central: 6, max: 11, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 2, central: 4.5, max: 8, multipleType: 'revenue', confidence: 'high',
    },
    'series-c-plus': {
      min: 1.5, central: 3, max: 6, multipleType: 'revenue', confidence: 'high',
    },
  },

  // ============================================================
  // FOODTECH / AGRITECH
  // Sources : AgFunder 2024, Atomico Foodtech 2024
  // ============================================================
  'foodtech': {
    seed: {
      min: 2, central: 5, max: 10, multipleType: 'revenue', confidence: 'medium',
      notes: 'Tres heterogene : multiples differents pour vertical farming (capex intensive, plus bas) vs digital nutrition (multiples SaaS). Selon le modele, retomber sur SaaS B2B ou marketplace si pertinent.',
    },
    'series-a': {
      min: 3, central: 7, max: 13, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 2, central: 5, max: 10, multipleType: 'revenue', confidence: 'medium',
    },
    'series-c-plus': {
      min: 1.5, central: 3.5, max: 7, multipleType: 'revenue', confidence: 'medium',
    },
  },

  // ============================================================
  // PROPTECH / REAL ESTATE TECH
  // Sources : RECNet 2024, Atomico 2024
  // ============================================================
  'proptech': {
    seed: {
      min: 3, central: 6, max: 11, multipleType: 'revenue', confidence: 'medium',
      notes: 'Distinguer SaaS proptech (multiples plus eleves, 8-15x ARR si recurrent) des plateformes transactionnelles (multiples revenue plus bas). Verifier si modele transactional ou recurrent dans le pitch.',
    },
    'series-a': {
      min: 4, central: 8, max: 14, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 3, central: 6, max: 11, multipleType: 'revenue', confidence: 'medium',
    },
    'series-c-plus': {
      min: 2, central: 4, max: 8, multipleType: 'revenue', confidence: 'high',
    },
  },

  // ============================================================
  // EDTECH / EDUCATION
  // Sources : HolonIQ Edtech 2024, Atomico 2024
  // ============================================================
  'edtech': {
    seed: {
      min: 2, central: 4, max: 8, multipleType: 'revenue', confidence: 'medium',
      notes: 'B2C edtech sous pression depuis 2022. B2B (corporate learning, K-12 SaaS) plus stable. Si modele SaaS B2B clair, retomber sur saas-b2b.',
    },
    'series-a': {
      min: 3, central: 6, max: 11, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 2, central: 4.5, max: 8, multipleType: 'revenue', confidence: 'high',
    },
    'series-c-plus': {
      min: 1.5, central: 3, max: 6, multipleType: 'revenue', confidence: 'high',
    },
  },

  // ============================================================
  // LOGISTICS / SUPPLY CHAIN
  // Sources : Pitchbook Logistics 2024, Atomico 2024
  // ============================================================
  'logistics': {
    seed: {
      min: 1.5, central: 3, max: 6, multipleType: 'revenue', confidence: 'medium',
      notes: 'Multiples bas refletent l intensite capitalistique et la commoditisation. Si SaaS supply chain pur, retomber sur saas-b2b. Si freight forwarding ou last mile asset-heavy, multiples encore plus bas.',
    },
    'series-a': {
      min: 2, central: 4, max: 7, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 1.5, central: 3, max: 5.5, multipleType: 'revenue', confidence: 'high',
    },
    'series-c-plus': {
      min: 1, central: 2, max: 4, multipleType: 'revenue', confidence: 'high',
    },
  },

  // ============================================================
  // SERVICES B2B (consulting, agencies, professional services)
  // Sources : SaaS Capital 2024, Equiteq 2024
  // ============================================================
  'services-b2b': {
    seed: {
      min: 0.8, central: 1.5, max: 3, multipleType: 'revenue', confidence: 'high',
      notes: 'Services non recurrents valorises a 1-2x revenue ou 4-8x EBITDA. Si la part recurrente / managed services depasse 40%, le multiple monte vers 2-4x revenue.',
    },
    'series-a': {
      min: 1, central: 2, max: 3.5, multipleType: 'revenue', confidence: 'high',
    },
    'series-b': {
      min: 0.8, central: 1.5, max: 2.8, multipleType: 'revenue', confidence: 'high',
    },
    'series-c-plus': {
      min: 0.6, central: 1.2, max: 2.2, multipleType: 'revenue', confidence: 'high',
      notes: 'Sur les Series B+ profitable, basculer sur EBITDA multiples (6-12x EBITDA) qui sont plus pertinents que revenue multiples.',
    },
  },

  // ============================================================
  // INDUSTRIES TRADITIONNELLES / HARDWARE NON-TECHNO
  // Sources : KfW Capital 2024, BPI France 2024
  // Multiples calcules en EBITDA pour les profitable, revenue pour
  // les pre-profitable.
  // ============================================================
  'industrial-hardware': {
    seed: {
      min: 0, central: 0, max: 0, multipleType: 'revenue', confidence: 'low',
      notes: 'A ce stade pre-revenue ou faiblement revenue, basculer sur Berkus + valorisation IP / TRL. Plage typique observee : pre-money 2-8M EUR selon TRL.',
    },
    'series-a': {
      min: 1, central: 2.5, max: 5, multipleType: 'revenue', confidence: 'medium',
      notes: 'Multiples revenue plus bas que pure tech. Si profitable, basculer sur EBITDA multiples (5-10x).',
    },
    'series-b': {
      min: 0.8, central: 2, max: 4, multipleType: 'revenue', confidence: 'high',
    },
    'series-c-plus': {
      min: 0.6, central: 1.5, max: 3, multipleType: 'revenue', confidence: 'high',
      notes: 'Sur les profitable mature : EBITDA multiples 5-10x deviennent la reference. La methode revenue est conservee pour comparaison.',
    },
  },

  // ============================================================
  // PROFITABLE MATURE (PME profitable, EBITDA-based valuation)
  // Sources : Argos Index 2024, S&P Global SME 2024
  // Pour les boites Series B+ qui sont profitable et dont l EBITDA
  // est la metrique pertinente plutot que ARR / revenue.
  // ============================================================
  'profitable-mature': {
    seed: {
      min: 0, central: 0, max: 0, multipleType: 'ebitda', confidence: 'low',
      notes: 'Categorie non applicable au seed. Une boite seed n a pas d EBITDA stable.',
    },
    'series-a': {
      min: 0, central: 0, max: 0, multipleType: 'ebitda', confidence: 'low',
      notes: 'Rare au stade Series A d avoir un EBITDA stable et representatif. Privilegier multiples revenue.',
    },
    'series-b': {
      min: 6, central: 10, max: 15, multipleType: 'ebitda', confidence: 'high',
      notes: 'EBITDA multiples standard PME profitable Europe : Argos Index mediane 9-11x sur PME 2024. Premium si croissance > 20%.',
    },
    'series-c-plus': {
      min: 7, central: 11, max: 17, multipleType: 'ebitda', confidence: 'high',
      notes: 'Approche du marche public : multiples EBITDA convergent vers 10-12x sur PME mature europeenne. Sources : Argos Index Q4 2024 (mediane 9,8x), S&P Global SME 2024.',
    },
  },

  // ============================================================
  // CONTENT / MEDIATECH (streaming, publishing, gaming)
  // Sources : Atomico Content 2024, Drake Star Gaming 2024
  // ============================================================
  'mediatech': {
    seed: {
      min: 1.5, central: 3, max: 6, multipleType: 'revenue', confidence: 'medium',
      notes: 'Distinguer subscription content (multiples SaaS-like, 4-8x ARR) du gaming hit-driven (multiples revenue volatils selon catalogue).',
    },
    'series-a': {
      min: 2, central: 4, max: 8, multipleType: 'revenue', confidence: 'medium',
    },
    'series-b': {
      min: 1.5, central: 3, max: 6, multipleType: 'revenue', confidence: 'medium',
    },
    'series-c-plus': {
      min: 1, central: 2, max: 4, multipleType: 'revenue', confidence: 'high',
    },
  },

  // ============================================================
  // SPORTSTECH
  // Sources : Drake Star Sportstech 2024
  // ============================================================
  'sportstech': {
    seed: {
      min: 2, central: 4, max: 8, multipleType: 'revenue', confidence: 'low',
      notes: 'Categorie etroite, peu de comparables stables. Selon vertical (athlete tech, fan engagement, betting tech, performance analytics) les multiples varient fortement. Souvent retomber sur saas-b2b ou marketplace-b2c selon modele.',
    },
    'series-a': {
      min: 3, central: 6, max: 11, multipleType: 'revenue', confidence: 'low',
    },
    'series-b': {
      min: 2, central: 4, max: 8, multipleType: 'revenue', confidence: 'low',
    },
    'series-c-plus': {
      min: 1.5, central: 3, max: 6, multipleType: 'revenue', confidence: 'low',
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

  // ----- Premium / categorie speciale
  if (s.includes('genai') || s.includes('llm') || s.includes('generative')
    || s.includes('foundation model') || s.includes('intelligence artificielle')
    || /\bai\b/.test(s)) return 'ai-generative';

  // ----- Energies marines / infrastructures marines : prioritaire
  // sur climate-tech generique car le profil economique (CAPEX par
  // projet, cycle long, infrastructure physique) releve de l asset
  // class hardware industriel et non du climate-tech logiciel.
  if (s.includes('energie marine') || s.includes('énergie marine')
    || s.includes('energies marines') || s.includes('énergies marines')
    || s.includes('marine energy') || s.includes('ocean energy')
    || s.includes('offshore') || s.includes('genie maritime') || s.includes('génie maritime')
    || s.includes('swac') || s.includes('otec') || s.includes('etm')
    || /\bemr\b/.test(s)) return 'industrial-hardware';

  // ----- Asset-classes principales
  if (s.includes('cyber') || s.includes('security') || s.includes('siem') || s.includes('zero trust')) return 'cybersecurity';
  if (s.includes('fintech') || s.includes('finance') || s.includes('banking') || s.includes('payment')
    || s.includes('insurtech') || s.includes('lending') || s.includes('regtech')) return 'fintech';
  if (s.includes('marketplace') || s.includes('platform b2c') || s.includes('consumer marketplace')) return 'marketplace-b2c';
  if (s.includes('ecommerce') || s.includes('e-commerce') || s.includes('dtc') || s.includes('direct to consumer')
    || s.includes('retail')) return 'ecommerce-dtc';
  if (s.includes('deeptech') || s.includes('deep tech') || s.includes('biotech')
    || s.includes('quantum') || s.includes('materials') || s.includes('semiconductor')) return 'deeptech';
  // Transport medical / sanitaire FR : route explicitement vers
  // healthtech. La chaine de valeur (remboursement assurance
  // maladie, agrement ARS, conventionnement CPAM) est doctrinalement
  // adjacente au healthtech, pas a la mobilite generaliste. Bloc
  // place avant le bloc health generique pour rester defensif sur
  // les accents et l ordre des mots.
  if (s.includes('transport sanitaire') || s.includes('transport médical')
    || s.includes('transport medical') || s.includes('transports sanitaires')
    || s.includes('transports médicaux') || s.includes('transports medicaux')
    || s.includes('ambulance') || s.includes('ambulancier') || s.includes('ambulancière')
    || s.includes('mobilité médicale') || s.includes('mobilite medicale')
    || s.includes('mobilité medicale') || s.includes('mobilite médicale')
    || s.includes('taxi cpam') || s.includes('vsl ')) return 'healthtech';
  if (s.includes('health') || s.includes('medical') || s.includes('digital health')
    || s.includes('medtech') || s.includes('healthtech')) return 'healthtech';
  if (s.includes('climate') || s.includes('cleantech') || s.includes('greentech')
    || s.includes('energy') || s.includes('decarbonisation') || s.includes('carbon')
    || s.includes('energie') || s.includes('énergie') || s.includes('energies') || s.includes('énergies')
    || s.includes('energetique') || s.includes('énergétique')
    || s.includes('renouvelable') || s.includes('renouvelables')
    || s.includes('transition energetique') || s.includes('transition énergétique')
    || /\benr\b/.test(s)) return 'climate-tech';
  if (s.includes('defense') || s.includes('defence') || s.includes('military')
    || s.includes('dual-use') || s.includes('aerospace')) return 'defense';
  if (s.includes('hospitality') || s.includes('travel') || s.includes('tourism')
    || s.includes('hotel') || s.includes('vacation')) return 'hospitality';

  // ----- Asset-classes ajoutees pour couverture etendue
  if (s.includes('adtech') || s.includes('ad tech') || s.includes('advertising')
    || s.includes('martech') || s.includes('marketing tech')) return 'adtech';
  if (s.includes('foodtech') || s.includes('agritech') || s.includes('agriculture')
    || s.includes('food tech') || s.includes('vertical farming') || s.includes('alt protein')) return 'foodtech';
  if (s.includes('proptech') || s.includes('real estate') || s.includes('immobilier')
    || s.includes('construction tech') || s.includes('contech')) return 'proptech';
  if (s.includes('edtech') || s.includes('education') || s.includes('e-learning')
    || s.includes('learning')) return 'edtech';
  if (s.includes('logistics') || s.includes('supply chain') || s.includes('freight')
    || s.includes('shipping') || s.includes('last mile')) return 'logistics';
  if (s.includes('media') || s.includes('streaming') || s.includes('publishing')
    || s.includes('gaming') || s.includes('content') || s.includes('entertainment')) return 'mediatech';
  // Detection sport via word-boundary pour eviter la capture par
  // substring de "transport", "transports", "transport sanitaire",
  // qui sortaient avant en sportstech alors qu ils n ont aucune
  // proximite economique avec le sport. esports traite separement
  // pour conserver le routage historique des dossiers gaming-sport.
  if (/\bsport(s|stech|s-tech|tech)?\b/.test(s) || /\besports?\b/.test(s)
    || s.includes('athletetech') || s.includes('fan engagement')) return 'sportstech';
  if (s.includes('services') || s.includes('consulting') || s.includes('agency')
    || s.includes('agencies') || s.includes('professional services')) return 'services-b2b';
  if (s.includes('hardware') || s.includes('manufacturing') || s.includes('industrial')
    || s.includes('industrie') || s.includes('industriel') || s.includes('robotics')
    || s.includes('infrastructure') || s.includes('genie civil') || s.includes('génie civil')) return 'industrial-hardware';

  // ----- SaaS / B2B logiciel : par defaut quand on est dans la nuance
  if (s.includes('saas') || s.includes('b2b') || s.includes('software')
    || s.includes('hrtech') || s.includes('legaltech') || s.includes('govtech')) return 'saas-b2b';

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
