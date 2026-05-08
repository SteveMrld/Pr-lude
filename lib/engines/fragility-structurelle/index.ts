// ============================================================
// FRAGILITE STRUCTURELLE - INDEX MODULE
// ------------------------------------------------------------
// Point d entree unique du moteur Phase 4. Re-exporte les
// types, l interface pattern, et le point d entree orchestrateur.
//
// Usage typique depuis app/api/analyze/route.ts :
//
//   import { analyzeFragiliteStructurelle } from '@/lib/engines/fragility-structurelle';
//   const result = await analyzeFragiliteStructurelle(input, relevanceMatrix);
//
// Les patterns individuels n ont pas a etre importes a la
// surface : ils s auto-enregistrent dans le registry de
// l orchestrateur via leur side-effect d import.
// ============================================================

export {
  PATTERN_IDS,
  PATTERN_LABELS,
  type PatternId,
  type PatternVerdict,
  type PatternApplicability,
  type PatternInput,
  type PatternAxisAnalysis,
  type PatternAnalysisOutput,
  type FragiliteStructurelleAnalysisOutput,
} from './types';

export {
  type PatternModule,
  type PatternApplicabilityCheck,
  buildNotApplicableOutput,
} from './pattern-interface';

export {
  analyzeFragiliteStructurelle,
  registerPattern,
} from './orchestrator';
