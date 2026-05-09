// ============================================================
// SKIPPED OUTPUTS - FABRIQUES D OUTPUTS NEUTRES
// ------------------------------------------------------------
// Quand le partner choisit le parcours growth (serie B et au-dela),
// les moteurs early stage (team, pattern matching, blindspot,
// causal) ne sont pas executes. Pour conserver la signature des
// fonctions aval (orchestrate, score-calculator, etc) qui
// attendent ces outputs en parametres, on fournit des outputs
// neutres marques comme skipped.
//
// Les outputs neutres sont conformes aux interfaces TypeScript
// mais portent un drapeau __skipped et des valeurs neutres qui
// n influencent pas le score final. Le score-calculator et
// l orchestrate doivent reconnaitre ce drapeau et exclure ces
// dimensions du calcul.
//
// Usage typique dans le pipeline :
//   const team = (track === 'growth')
//     ? buildSkippedTeamOutput()
//     : await analyzeTeam(...);
// ============================================================

import type {
  TeamAnalysisOutput,
  PatternMatchingOutput,
  BlindspotAnalysisOutput,
  CausalReversalOutput,
} from './types';

/**
 * Drapeau ajoute aux outputs skipped. Permet aux consommateurs en
 * aval de reconnaitre qu un moteur n a pas tourne et d adapter
 * leur traitement (typiquement, exclure cette dimension du calcul).
 */
export const SKIPPED_FLAG = '__skipped';

/**
 * Construit un output Team neutre, marque skipped. Score 50
 * (mediane neutre), tous les sous-modules avec rationale qui
 * indique le skip.
 */
export function buildSkippedTeamOutput(): TeamAnalysisOutput & { [SKIPPED_FLAG]: true } {
  return {
    [SKIPPED_FLAG]: true,
    foundersCount: 0,
    pedigreeCanonical: false,
    averageAge: 'mid',
    sectorExperience: 'medium',
    riskTaken: 'medium',
    systemicCoverage: {
      score: 50,
      rationale: 'Moteur Equipe non execute en parcours growth : la lecture detaillee de l equipe fondatrice est calibree pour les stades early (seed, serie A) et n est pas pertinente sur dossier serie B et au-dela ou l execution operationnelle prime sur le profil de fondation.',
      gaps: [],
    },
    collectiveAntiFragility: { score: 50, rationale: 'Non evalue en parcours growth.' },
    experienceTransposition: { score: 50, rationale: 'Non evalue en parcours growth.', analogousSectors: [] },
    founderObsession: { score: 50, rationale: 'Non evalue en parcours growth.' },
  } as TeamAnalysisOutput & { [SKIPPED_FLAG]: true };
}

/**
 * Construit un output Pattern Matching neutre, marque skipped.
 * Aucun pattern detecte, score global neutre.
 */
export function buildSkippedPatternMatchingOutput(): PatternMatchingOutput & { [SKIPPED_FLAG]: true } {
  return {
    [SKIPPED_FLAG]: true,
    detectedPatterns: [],
    closestArchetypes: [],
    differentiatingFactors: [],
    overallPatternScore: 50,
    rationale: 'Moteur Pattern Matching non execute en parcours growth : la comparaison aux archetypes de fondation (Stripe, Airbnb, Doctolib) est calibree pour les stades early et perd sa puissance discriminante sur dossier serie B et au-dela ou la trajectoire commerciale fournit deja la matiere de comparaison.',
  } as unknown as PatternMatchingOutput & { [SKIPPED_FLAG]: true };
}

/**
 * Construit un output Blindspot neutre, marque skipped.
 */
export function buildSkippedBlindspotOutput(): BlindspotAnalysisOutput & { [SKIPPED_FLAG]: true } {
  return {
    [SKIPPED_FLAG]: true,
    detectedBlindspots: [],
    cognitiveBiases: [],
    overallBlindspotScore: 50,
    rationale: 'Moteur Aveuglement non execute en parcours growth : l analyse des biais cognitifs du fondateur est calibree pour les stades early ou le pitch est dense en affirmations psychologiques. Sur dossier serie B et au-dela, les indicateurs operationnels et la trajectoire commerciale priment sur la lecture du discours.',
  } as unknown as BlindspotAnalysisOutput & { [SKIPPED_FLAG]: true };
}

/**
 * Construit un output Causal Reversal neutre, marque skipped.
 */
export function buildSkippedCausalOutput(): CausalReversalOutput & { [SKIPPED_FLAG]: true } {
  return {
    [SKIPPED_FLAG]: true,
    reversedThesis: 'Non evalue en parcours growth.',
    keyAssumptions: [],
    fragilityScore: 50,
    rationale: 'Moteur Retournement Causal non execute en parcours growth : le retournement dialectique de la these est calibre pour les stades early ou les hypotheses fondatrices sont en pleine cristallisation. Sur dossier serie B et au-dela, l analyse de Fragilite structurelle remplace structurellement ce moteur en remontant les patterns de scale-up qui menacent la trajectoire.',
  } as unknown as CausalReversalOutput & { [SKIPPED_FLAG]: true };
}

/**
 * Helper : verifie si un output a ete skipped. Permet aux
 * consommateurs en aval (orchestrate, score-calculator,
 * note-renderer) d adapter leur traitement.
 */
export function isSkipped(output: any): boolean {
  return output && output[SKIPPED_FLAG] === true;
}
