// ============================================================
// PRELUDE - Sectoral Intelligence Layer, types partages
// ------------------------------------------------------------
// Miroir TypeScript du schema Supabase sectoral_briefs livre au
// sous-chantier 1. Les huit dimensions standardisees sont
// definies en doctrine dans docs/patterns/sectoral-intelligence.md,
// section "Decision 2 : structure standardisee des fiches
// sectorielles". Les cles utilisees ici doivent rester en
// adherence stricte avec les cles JSONB attendues dans la table
// Supabase, sous peine de divergence silencieuse entre la couche
// applicative et la couche persistence.
// ============================================================

// ------------------------------------------------------------
// CLES DE DIMENSIONS
// L ordre du tableau est l ordre de tracage de la spider chart
// (premier sommet au nord, sens horaire). Toute modification de
// cet ordre invalide les snapshots historiques rendus
// graphiquement, raison pour laquelle il est gele.
// ------------------------------------------------------------
export type DimensionKey =
  | 'intensite_capitalistique'
  | 'pression_reglementaire'
  | 'velocite_technologique'
  | 'concentration_concurrentielle'
  | 'cyclicite_macroeconomique'
  | 'exposition_geopolitique'
  | 'tension_capital_talent'
  | 'vulnerabilite_narrative_sectorielle';

export const DIMENSION_KEYS: ReadonlyArray<DimensionKey> = [
  'intensite_capitalistique',
  'pression_reglementaire',
  'velocite_technologique',
  'concentration_concurrentielle',
  'cyclicite_macroeconomique',
  'exposition_geopolitique',
  'tension_capital_talent',
  'vulnerabilite_narrative_sectorielle',
] as const;

// Libelles d affichage pour la spider chart, prose serif. Restent
// homogenes en longueur pour ne pas casser l alignement radial.
export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  intensite_capitalistique: 'Intensite capitalistique',
  pression_reglementaire: 'Pression reglementaire',
  velocite_technologique: 'Velocite technologique',
  concentration_concurrentielle: 'Concentration concurrentielle',
  cyclicite_macroeconomique: 'Cyclicite macro',
  exposition_geopolitique: 'Exposition geopolitique',
  tension_capital_talent: 'Tension capital-talent',
  vulnerabilite_narrative_sectorielle: 'Vulnerabilite narrative',
};

// ------------------------------------------------------------
// TRIGGERS
// ------------------------------------------------------------
export type RegenerationTrigger = 'cron' | 'manual' | 'event';

// ------------------------------------------------------------
// CONFIDENCE ET SOURCES
// Discipline anti-hallucination : aucune dimension n est notee
// sans au moins une source citee. Si le LLM ne peut pas citer,
// la dimension sort en data_missing=true, score=null, et la
// fiche est rejetee si plus de deux dimensions sont en data_missing.
// ------------------------------------------------------------
export type Confidence = 'high' | 'medium' | 'low' | 'data_missing';

export interface SourceCitation {
  url: string;
  title: string;
  // ISO 8601, ex "2026-05-12T14:32:00Z". Le LLM peut produire la
  // date courante au moment de la regeneration.
  accessed_at: string;
  // Citation textuelle courte de la source si l information
  // remontee est non-triviale. Facultatif.
  quote?: string;
}

export interface SectoralDimension {
  // Score 0 a 100 selon la grille doctrinale de la dimension.
  // null si data_missing. Pas de valeur "par defaut" : l absence
  // est signalee explicitement.
  score: number | null;
  // Definition exacte appliquee a la generation. Conservee pour
  // audit doctrinal : si la doctrine evolue, on garde trace de
  // la version qui a produit cette note.
  definition_applied: string;
  // Toutes les sources que le LLM a effectivement utilisees pour
  // formuler son score. Vide uniquement si data_missing=true.
  sources_cited: SourceCitation[];
  confidence: Confidence;
  data_missing: boolean;
  // Lecture editoriale courte de la dimension, deux a trois
  // phrases. Sert au resume agrege et a l export PDF.
  notes?: string;
}

// Cle a cle, les huit dimensions standardisees forment la fiche.
export type SectoralBriefDimensions = Record<DimensionKey, SectoralDimension>;

// ------------------------------------------------------------
// METADONNEES DE GENERATION
// Audit complet de l appel LLM qui a produit la fiche, conserve
// pour pouvoir reproduire ou contester un score.
// ------------------------------------------------------------
export interface GenerationMetadata {
  // Modele utilise pour les appels dimension par dimension.
  // Anthropic Sonnet en production, mockable en test.
  dimension_model: string;
  // Modele utilise pour l agregation editoriale finale, Opus en
  // production.
  aggregator_model: string;
  // Version du prompt builder utilise. Permet de tracer
  // l evolution doctrinale du module.
  prompt_version: string;
  // Cout total estime en dollars USD pour la generation complete
  // (huit dimensions plus agregation). Approximation basee sur
  // les comptages de tokens retournes par l API.
  cost_usd: number;
  // Duree totale de la generation, en millisecondes.
  duration_ms: number;
  // Sous-ensemble de dimensions effectivement regenerees. Vaut
  // les huit cles pour une fiche complete, un sous-ensemble pour
  // une regeneration surgicale dimension par dimension.
  dimensions_regenerated: DimensionKey[];
}

// ------------------------------------------------------------
// FICHE SECTORIELLE COMPLETE
// Forme exacte attendue en ecriture dans sectoral_briefs.
// L id est optionnel cote applicatif (gen_random_uuid cote SQL).
// ------------------------------------------------------------
export interface SectoralBrief {
  id?: string;
  sector_slug: string;
  // ISO 8601. Cote SQL, defaut a now() si non fourni.
  generated_at: string;
  dimensions: SectoralBriefDimensions;
  // Resume editorial Le Grand Continent, 1500 caracteres maximum.
  // Sert d ancrage commun a tous les moteurs sectoriels en
  // injection au pipeline.
  narrative_summary: string;
  regeneration_trigger: RegenerationTrigger;
  // Identifiant de la fiche precedente du meme secteur, null
  // pour la premiere generation.
  supersedes_id: string | null;
  generation_metadata: GenerationMetadata;
}

// ------------------------------------------------------------
// RESULTAT DE REGENERATION
// Etat retourne par regenerateSectoralBrief, structure pour
// permettre une lecture programmatique du succes ou de l echec.
// ------------------------------------------------------------
export type RegenerationStatus = 'success' | 'rejected_data_missing' | 'rejected_error';

export interface SectoralRegenerationResult {
  status: RegenerationStatus;
  // La fiche assemblee si status=success. null sinon.
  brief: SectoralBrief | null;
  // Liste des cles de dimension sorties en data_missing. Vide si
  // toutes les dimensions ont produit un score.
  dimensions_missing: DimensionKey[];
  // Total sources citees a travers les huit dimensions.
  total_sources_cited: number;
  // Cout LLM total estime en dollars USD.
  cost_usd: number;
  duration_ms: number;
  // Motif de rejet en clair si status=rejected_*.
  rejection_reason?: string;
  // Erreur sous-jacente si status=rejected_error.
  error_message?: string;
}

// ------------------------------------------------------------
// CATALOGUE DES SECTEURS LANCEMENT
// Treize secteurs valides en fiche conceptuelle. L ordre est
// celui de l initialisation par sous-chantier 3 et n a pas
// d effet doctrinal au-dela.
// ------------------------------------------------------------
export interface SectorDefinition {
  slug: string;
  label: string;
  // Description courte pour briefer le LLM dans le prompt.
  // Pose le perimetre du secteur sans le sur-determiner.
  perimeter_brief: string;
}

export const SECTORS: ReadonlyArray<SectorDefinition> = [
  {
    slug: 'logiciel-entreprise-horizontal',
    label: 'Logiciel d entreprise horizontal',
    perimeter_brief:
      'SaaS B2B horizontal couvrant productivity, collaboration, dev tools, ERP, CRM, ITSM, HR tech. Hors verticalisations sectorielles, hors IA appliquee.',
  },
  {
    slug: 'ia-appliquee',
    label: 'IA appliquee et infrastructure d apprentissage',
    perimeter_brief:
      'Modeles fondation, infrastructure MLOps, applications verticales d IA generative, agents autonomes, plus la couche compute (GPU cloud, accelerateurs).',
  },
  {
    slug: 'fintech',
    label: 'Fintech',
    perimeter_brief:
      'Paiements, pret, neobanques, infrastructure financiere (KYC, conformite, banking-as-a-service), insurtech, wealth tech. Hors crypto, hors marketplaces consumer.',
  },
  {
    slug: 'sante-biotech',
    label: 'Sante et biotech',
    perimeter_brief:
      'Medtech, digital health, biotech therapeutique, diagnostic, dispositifs medicaux, drug discovery assistee. Hors wellness consumer pur.',
  },
  {
    slug: 'climat-energie',
    label: 'Climat et energie',
    perimeter_brief:
      'Renouvelables, stockage, hydrogene, captation carbone, efficacite energetique, batteries, climate adaptation. Hors mobilite (categorie distincte).',
  },
  {
    slug: 'mobilite-logistique',
    label: 'Mobilite et logistique',
    perimeter_brief:
      'Transport, supply chain, last mile, vehicules electriques, autonomes, fret, logistique B2B. Hors moteurs energetiques amont (climat).',
  },
  {
    slug: 'industrie-hardware',
    label: 'Industrie et hardware',
    perimeter_brief:
      'Manufacturing 4.0, robotique, semi-conducteurs, electronique, hardware embarque, deeptech industrielle. Hors hardware specifique a un autre secteur (defense, medtech).',
  },
  {
    slug: 'agritech-foodtech',
    label: 'Agritech et foodtech',
    perimeter_brief:
      'Production agricole augmentee, alternative proteins, supply chain alimentaire, agriculture verticale, biotech vegetal, packaging durable.',
  },
  {
    slug: 'commerce-marketplaces',
    label: 'Commerce et marketplaces verticales',
    perimeter_brief:
      'D2C, marketplaces verticales B2B et B2C, retail tech, social commerce. Hors fintech embedded, hors logistique amont.',
  },
  {
    slug: 'cybersecurite-defense',
    label: 'Cybersecurite et defense',
    perimeter_brief:
      'Cybersecurite enterprise, securite cloud, identite, defense tech dual-use, ISR, drones militaires, souverainete numerique.',
  },
  {
    slug: 'crypto-blockchain',
    label: 'Crypto et infrastructure blockchain',
    perimeter_brief:
      'Infrastructure blockchain L1 L2, DeFi, stablecoins, custody institutionnel, tokenisation d actifs reels. Hors fintech regulee classique.',
  },
  {
    slug: 'proptech-construction',
    label: 'Proptech et construction',
    perimeter_brief:
      'Immobilier commercial et residentiel, construction tech, BIM, materiaux bas carbone, gestion locative, marketplaces immobilieres.',
  },
  {
    slug: 'education-future-of-work',
    label: 'Education et future of work',
    perimeter_brief:
      'Edtech K-12 et supeerieur, formation continue, certification, marketplaces de talent, outils RH avances, future of work platforms.',
  },
] as const;

// Helpers de lookup.
export function getSectorBySlug(slug: string): SectorDefinition | undefined {
  return SECTORS.find((s) => s.slug === slug);
}

// ------------------------------------------------------------
// TYPES INTERNES DE L ORCHESTRATEUR
// Exposes ici pour permettre l injection de dependances dans les
// tests deterministes (mocks LLM, mocks fetchers).
// ------------------------------------------------------------

// Reponse attendue d un appel LLM pour une dimension. Le LLM
// est instruit de produire ce schema en JSON strict.
export interface DimensionLLMResponse {
  score: number | null;
  confidence: Confidence;
  data_missing: boolean;
  definition_applied: string;
  sources_cited: SourceCitation[];
  notes?: string;
  // Comptages bruts retournes pour le calcul de cout.
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Reponse attendue de l agregation editoriale.
export interface AggregatorLLMResponse {
  narrative_summary: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Surface d injection de dependances pour les tests.
export interface RegeneratorDependencies {
  callDimensionLLM: (
    dimension: DimensionKey,
    sector: SectorDefinition,
  ) => Promise<DimensionLLMResponse>;
  callAggregatorLLM: (
    sector: SectorDefinition,
    dimensions: SectoralBriefDimensions,
  ) => Promise<AggregatorLLMResponse>;
}

export interface RegenerateOptions {
  // Subset de dimensions a regenerer. Si absent, toutes les huit
  // dimensions sont regenerees.
  dimensions?: DimensionKey[];
  // Fiche precedente a chainer via supersedes_id. Si absente,
  // supersedes_id = null (premiere fiche du secteur).
  previousBrief?: { id: string };
  // Dependances injectables, sert exclusivement aux tests
  // deterministes. En production, le module instancie ses defauts.
  deps?: Partial<RegeneratorDependencies>;
  // Override des modeles utilises (par defaut Sonnet pour
  // dimensions, Opus pour agregation).
  dimensionModel?: string;
  aggregatorModel?: string;
}

// ------------------------------------------------------------
// CONSTANTES DE COUT
// Tarifs Anthropic publics au moment de l ecriture (2026-05).
// USD par million de tokens. Mis a jour si les tarifs evoluent ;
// utilises uniquement pour l estimation de cost_usd dans la
// metadata, pas pour la facturation reelle (qui passe par
// l API Anthropic).
// ------------------------------------------------------------
export const MODEL_PRICING: Record<
  string,
  { input_per_million: number; output_per_million: number }
> = {
  'claude-sonnet-4-6': { input_per_million: 3, output_per_million: 15 },
  'claude-sonnet-4-5': { input_per_million: 3, output_per_million: 15 },
  'claude-opus-4-7': { input_per_million: 15, output_per_million: 75 },
  'claude-haiku-4-5-20251001': { input_per_million: 1, output_per_million: 5 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.input_per_million +
    (outputTokens / 1_000_000) * pricing.output_per_million
  );
}
