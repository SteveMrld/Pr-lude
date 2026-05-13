// ============================================================
// PRELUDE - Sectoral Intelligence Layer, surface client-safe
// ------------------------------------------------------------
// Barrel reserve aux composants client React. Re-exporte
// uniquement les types, constantes et helpers purs : aucune
// fonction Supabase, aucun appel reseau, aucune dependance a
// next/headers ni a getSupabaseServerClient.
//
// Pourquoi ce barrel separe : le fichier index.ts importe
// lib/supabase/server.ts pour exposer getLatestBriefForSector,
// persistSectoralBrief et consorts. Cet import top-level
// declenche une chaine qui remonte jusqu a next/headers, ce
// qui casse le build webpack des qu un composant client tente
// d importer ne serait-ce qu un type depuis index.ts.
//
// Convention : tout composant marque 'use client' qui doit
// consommer une cle de dimension, un libelle, un helper de
// fraicheur, ou un type SectoralBrief importe depuis ce fichier.
// Les Server Components et les Route Handlers continuent a
// passer par lib/engines/sectoral-intelligence (le barrel
// principal) pour profiter des fonctions de persistence.
// ============================================================

// Types et catalogue (sans appel Supabase)
export type {
  DimensionKey,
  RegenerationTrigger,
  Confidence,
  SourceCitation,
  SectoralDimension,
  SectoralBriefDimensions,
  GenerationMetadata,
  SectoralBrief,
  RegenerationStatus,
  SectoralRegenerationResult,
  SectorDefinition,
} from './types';

export {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  SECTORS,
  getSectorBySlug,
} from './types';

// Helpers de fraicheur (page admin, badges UI, dashboard partner)
export type { FreshnessState, FreshnessColorKey } from './freshness';
export {
  computeFreshness,
  computeAgeDays,
  freshnessLabel,
  freshnessColorKey,
  FRESHNESS_THRESHOLD_A_JOUR_DAYS,
  FRESHNESS_THRESHOLD_RECOMMANDEE_DAYS,
} from './freshness';

// Computations inter-sectorielles : types et helpers purs (page
// dashboard partner /portfolio/secteurs/etat-systemique).
export type {
  ConvergencePair,
  DivergencePair,
  MacroPattern,
  MacroDirection,
  DataCompleteness,
  InterSectoralComputations,
} from './inter-sector-computations';
export {
  formatPeriodQuarter,
  previousPeriodQuarter,
  isFirstDayOfQuarter,
  CONVERGENCE_PREV_GAP_THRESHOLD,
  CONVERGENCE_CURR_GAP_THRESHOLD,
  DIVERGENCE_PREV_GAP_THRESHOLD,
  DIVERGENCE_CURR_GAP_THRESHOLD,
  MACRO_PATTERN_DELTA_THRESHOLD,
  MACRO_PATTERN_MIN_SECTORS,
} from './inter-sector-computations';

// Types du brief inter-sectoriel : exposes pour le dashboard
// partner qui recoit les briefs en props depuis le Server Component
// parent. Le module aggregator complet (qui tire l API Anthropic et
// la persistence Supabase) reste server-only ; les types vivent
// dans un fichier pur dedie pour garantir l absence de fuite.
export type {
  InterSectoralBrief,
  InterSectoralBriefSource,
  InterSectoralBriefMetadata,
  InterSectoralPeriodEntry,
  ConvergencePairWithInterpretation,
  DivergencePairWithInterpretation,
  MacroPatternWithInterpretation,
} from './inter-sector-types';
