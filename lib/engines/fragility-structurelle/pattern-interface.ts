// ============================================================
// FRAGILITE STRUCTURELLE - INTERFACE PATTERN
// ------------------------------------------------------------
// Contrat de code que chaque pattern Phase 4 doit honorer pour
// pouvoir etre orchestree par fragility-structurelle/orchestrator.
//
// Chaque pattern est un module autonome qui exporte :
//   - PATTERN_ID : son identifiant
//   - PATTERN_LABEL : son libelle editorial
//   - analyze(input) : sa fonction d analyse asynchrone
//   - isApplicable(extraction, financialData) : sa pre-evaluation
//     d applicabilite, avant l appel LLM, base sur la matrice et
//     ses propres conditions internes
//
// L orchestrateur consomme cette interface pour construire la
// vague d execution parallele des patterns applicables.
// ============================================================

import type {
  PatternId,
  PatternInput,
  PatternAnalysisOutput,
  PatternApplicability,
} from './types';
import type { ExtractionOutput, FinancialDataExtraction } from '../types';

/**
 * Resultat de la pre-evaluation d applicabilite. Sert a decider si
 * on lance l appel LLM ou si on retourne directement un output
 * not-applicable sans bruler de tokens.
 */
export interface PatternApplicabilityCheck {
  /** Niveau d applicabilite que le pattern atteindra au mieux */
  level: PatternApplicability;

  /** Rationale pour le partner, en une phrase. */
  rationale: string;

  /** Si false, l orchestrateur skippe l appel LLM et retourne
   *  directement un output minimal not-applicable. */
  shouldRun: boolean;
}

/**
 * Signature commune des sept patterns. Chaque module pattern
 * exporte un objet conforme a cette interface, qui est ensuite
 * agrege dans l orchestrateur via un registry.
 */
export interface PatternModule {
  /** Identifiant unique du pattern, doit matcher PatternId */
  patternId: PatternId;

  /** Pre-evaluation locale d applicabilite, sans appel LLM. La
   *  matrice de pertinence donne un verdict global, le pattern
   *  fait sa propre verification fine sur la matiere disponible. */
  isApplicable(
    extraction: ExtractionOutput,
    financialData?: FinancialDataExtraction | null,
  ): PatternApplicabilityCheck;

  /** Analyse complete du pattern. Retourne un PatternAnalysisOutput
   *  meme en cas d applicabilite partielle ou nulle (avec axes a
   *  non-applicable, score 0, verdict non-applicable). */
  analyze(input: PatternInput): Promise<PatternAnalysisOutput>;
}

/**
 * Helper : construit un output minimal not-applicable. Utilise
 * par les patterns quand isApplicable.shouldRun = false, ou par
 * l orchestrateur quand la matrice declare le pattern non
 * applicable.
 */
export function buildNotApplicableOutput(
  patternId: PatternId,
  rationale: string,
): PatternAnalysisOutput {
  const naAxis = {
    score: 0,
    verdict: 'non-applicable' as const,
    rationale: 'Non applicable sur ce dossier (corpus ou matiere insuffisante).',
    evidencePro: [],
    evidenceContra: [],
    confidence: 0,
  };

  return {
    patternId,
    applicabilite: 'not-applicable',
    applicabiliteRationale: rationale,
    globalScore: 0,
    verdict: 'non-applicable',
    resumeEditorial: rationale,
    axis1: naAxis,
    axis2: naAxis,
    axis3: naAxis,
    counterArchetype: {
      closest: 'non determine',
      direction: 'non determine',
      rationale: 'Pattern non applicable.',
    },
    recommandationDD: '',
    auditTrail: {
      sourceTags: [],
      claimsChiffres: [],
    },
  };
}
