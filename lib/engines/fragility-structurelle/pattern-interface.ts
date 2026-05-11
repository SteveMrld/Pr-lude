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
  PatternAxisAnalysis,
  PatternVerdict,
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
  const naAxis: PatternAxisAnalysis = {
    score: 0,
    verdict: 'non-applicable',
    rationale: 'Non applicable sur ce dossier (corpus ou matiere insuffisante).',
    evidencePro: [],
    evidenceContra: [],
    confidence: 0,
  };

  return {
    patternId,
    applicabilite: 'not-applicable',
    applicabiliteRationale: rationale,
    globalScore: null,
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

// ============================================================
// PRE-CHECK FINANCIALDATA UNIVERSEL
// ------------------------------------------------------------
// Court-circuit avant l appel LLM si aucune donnee chiffree de
// base n est disponible. Aligne sur la doctrine commune aux sept
// fiches patterns : sans revenu mesurable et sans burn observe,
// le moteur ne peut pas raisonner sur la fragilite economique.
//
// Cette regle s applique aux sept patterns. Chaque pattern peut
// avoir des conditions supplementaires propres (capex pour Scale
// Mirage, pacte pour Cap Structure, etc.) qui sont verifiees dans
// son propre isApplicable.
// ============================================================

/**
 * Retourne true si financialData contient au moins un signal chiffre
 * ou narratif suffisant pour fonder un raisonnement de fragilite.
 * Sert de garde universelle avant appel LLM ; si false, le pattern
 * doit retourner not-applicable avec rationale explicite.
 *
 * La verification cible la structure canonique reellement produite
 * par financial-extraction-engine (revenueProjection, currentRound,
 * unitEconomics, rawNotes). Un fallback sur des champs flat
 * (revenue, monthlyBurn) est conserve pour rester compatible avec
 * les mocks heritage utilises dans les tests unitaires de chaque
 * pattern.
 */
export function hasMinimalFinancialSignal(
  financialData?: FinancialDataExtraction | null,
): boolean {
  if (!financialData) return false;
  const f: any = financialData;

  // Structure canonique : presence de projections de revenu chiffrees
  if (Array.isArray(f.revenueProjection) && f.revenueProjection.length > 0) {
    return true;
  }

  // Structure canonique : tour en cours avec montant ou burn renseigne
  const cr = f.currentRound;
  if (cr && typeof cr === 'object') {
    if (typeof cr.amount === 'string' && cr.amount.trim().length > 0) return true;
    if (typeof cr.monthlyBurn === 'string' && cr.monthlyBurn.trim().length > 0) return true;
  }

  // Structure canonique : unit economics avec CAC ou LTV declares
  const ue = f.unitEconomics;
  if (ue && typeof ue === 'object') {
    if (typeof ue.estimatedCAC === 'string' && ue.estimatedCAC.trim().length > 0) return true;
    if (typeof ue.estimatedLTV === 'string' && ue.estimatedLTV.trim().length > 0) return true;
  }

  // Structure canonique : notes brutes suffisantes pour un raisonnement
  if (typeof f.rawNotes === 'string' && f.rawNotes.length > 100) return true;

  // Fallback legacy : champs flat utilises par les mocks de test
  // (revenue, monthlyBurn, etc.). Ne correspond a aucune production
  // reelle mais conservation indispensable pour la suite deterministe.
  const revenue = f.revenue ?? f.arr ?? f.annualRevenue;
  const burn = f.monthlyBurn ?? f.burnRate ?? f.monthly_burn ?? f.burn;
  return (revenue !== null && revenue !== undefined)
    || (burn !== null && burn !== undefined);
}

// ============================================================
// GATING AXE CENTRAL
// ------------------------------------------------------------
// Si l axe identitaire du pattern (axe central defini par la
// fiche doctrinale) est neutralise par le LLM (verdict
// non-applicable ou score null), alors le verdict global du
// pattern doit etre force a non-applicable, sans agregation des
// axes peripheriques. La doctrine est explicite : un pattern
// n a pas d objet sans son axe identitaire.
//
// Cette regle resout le bug observe sur Theranos / Growth
// Subsidized (axe 1 not-applicable mais score global 90 par
// agregation des axes 2 et 3) et sur les cas de contamination
// inter-patterns sur Fixed Cost Trap.
// ============================================================

export type CentralAxisKey = 'axis1' | 'axis2' | 'axis3';

/**
 * Applique le gating axe central. Si l axe identitaire est
 * neutralise, force globalVerdict='non-applicable' et
 * globalScore=null. Les axes peripheriques sont conserves dans
 * l output pour audit, mais ne portent pas de verdict global.
 *
 * @param patternOutput sortie du LLM convertie en
 *   PatternAnalysisOutput (apres parse, avant retour final)
 * @param centralAxis cle de l axe central pour ce pattern
 *   (axis1 pour 6 patterns, axis2 pour fixed-cost-trap)
 * @param gatingRationale explication doctrinale a injecter
 *   dans applicabiliteRationale et resumeEditorial
 */
export function applyCentralAxisGating(
  patternOutput: PatternAnalysisOutput,
  centralAxis: CentralAxisKey,
  gatingRationale: string,
): PatternAnalysisOutput {
  const axis = patternOutput[centralAxis];
  const axisNeutralized = axis.verdict === 'non-applicable';

  if (!axisNeutralized) return patternOutput;

  return {
    ...patternOutput,
    applicabilite: 'not-applicable',
    applicabiliteRationale: gatingRationale,
    globalScore: null,
    verdict: 'non-applicable',
    resumeEditorial: gatingRationale,
  };
}
