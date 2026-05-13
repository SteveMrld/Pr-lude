// ============================================================
// PRELUDE - Types du brief inter-sectoriel (pure)
// ------------------------------------------------------------
// Module purement declaratif. Aucune fonction, aucun import qui
// remonte vers Supabase ou next/headers. Le barrel client.ts peut
// re-exporter ces types sans risque d activation d une chaine
// server-only au build.
//
// La logique d agregation vit dans inter-sector-aggregator.ts
// (server-only, tire anthropic-client). La persistence vit dans
// inter-sector-store.ts (server-only, tire supabase/server). Les
// deux modules importent leurs types depuis ce fichier.
// ============================================================

import type {
  ConvergencePair,
  DivergencePair,
  MacroPattern,
  DataCompleteness,
} from './inter-sector-computations';

export interface ConvergencePairWithInterpretation extends ConvergencePair {
  interpretation: string;
}

export interface DivergencePairWithInterpretation extends DivergencePair {
  interpretation: string;
}

export interface MacroPatternWithInterpretation extends MacroPattern {
  interpretation: string;
}

export interface InterSectoralBriefSource {
  sector_slug: string;
  brief_id: string | null;
  generated_at: string;
}

export interface InterSectoralBriefMetadata {
  model: string;
  prompt_version: string;
  cost_usd: number;
  duration_ms: number;
  previous_brief_id: string | null;
}

export interface InterSectoralBrief {
  id?: string;
  period_quarter: string;
  generated_at: string;
  convergences: ConvergencePairWithInterpretation[];
  divergences: DivergencePairWithInterpretation[];
  macro_patterns: MacroPatternWithInterpretation[];
  narrative_summary: string;
  sources_consulted: InterSectoralBriefSource[];
  generation_metadata: InterSectoralBriefMetadata;
  /** Renseigne si moins de treize fiches sectorielles sont
   *  disponibles. Aucun rejet : le brief est genere avec mention
   *  explicite en tete pour signaler le perimetre degraded. */
  data_completeness?: DataCompleteness;
}

export interface InterSectoralPeriodEntry {
  id: string;
  period_quarter: string;
  generated_at: string;
}
