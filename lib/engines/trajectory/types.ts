// ============================================================
// SCORE DE TRAJECTOIRE - TYPES
// ------------------------------------------------------------
// Module de monitoring temporel des dossiers. Permet de comparer
// deux analyses successives du meme dossier et de calculer les
// deltas par dimension, par moteur et par pattern Phase 4.
//
// Cas d usage institutionnel : un fonds qui suit son portfolio
// sur 12-24 mois et veut visualiser l evolution des verdicts et
// des scores au fil des reanalyses.
//
// Le module est purement passif : il consomme deux outputs
// d analyse complets (extraits du payload persiste) et calcule
// la comparaison. La persistence elle-meme est gere par la
// couche Supabase, traitee dans un commit ulterieur.
// ============================================================

import type { Verdict } from '../score-calculator';
import type { PatternId, PatternVerdict, PatternApplicability } from '../fragility-structurelle/types';

/**
 * Snapshot d un axe individuel a l interieur d un pattern Phase 4.
 * La doctrine prevoit trois axes par pattern (axis1 identitaire,
 * axis2 et axis3 peripheriques). Le trajectory en garde le score
 * et le verdict pour servir le drill-down ; le rationale editorial
 * et les evidences ne sont pas persistes dans le snapshot
 * compact pour limiter la taille.
 */
export interface PatternAxisSnapshot {
  /** Score 0-100 de l axe, repris de PatternAxisAnalysis.score. */
  score: number;
  /** Verdict de l axe, repris de PatternAxisAnalysis.verdict. */
  verdict: PatternVerdict;
}

/**
 * Triplet d axes d un pattern Phase 4. Indexation par axis1,
 * axis2, axis3 alignee sur la structure de PatternAnalysisOutput.
 * Les libelles editoriaux des axes (unit economics pour Growth
 * Subsidized, intensite de la dependance pour Infrastructure
 * Hostage, etc.) sont resolus cote UI par pattern, pas portes
 * dans le snapshot.
 */
export interface PatternAxesSnapshot {
  axis1: PatternAxisSnapshot;
  axis2: PatternAxisSnapshot;
  axis3: PatternAxisSnapshot;
}

/**
 * Snapshot d une analyse a un instant T. Forme reduite extraite
 * du payload complet d analyse, gardant uniquement ce qui est
 * necessaire au calcul de trajectoire. Permet de stocker des
 * snapshots compacts en base (typiquement quelques Ko par
 * snapshot, contre quelques centaines de Ko pour une analyse
 * complete).
 */
export interface TrajectorySnapshot {
  /** Identifiant de l analyse source (UUID typiquement). */
  analysisId: string;
  /** Timestamp ISO de l analyse. */
  analyzedAt: string;
  /** Score global. */
  globalScore: number;
  /** Verdict global. */
  verdict: Verdict;
  /** Scores des six dimensions du moteur Bloc 1. */
  dimensions: {
    team: number;
    market: number;
    macro: number;
    financial: number;
    contrarian: number;
    vigilance: number;
  };
  /** Score Fragilite Structurelle, null si moteur non applicable. */
  fragiliteScore: number | null;
  /** Verdict Fragilite Structurelle, null si non applicable. */
  fragiliteVerdict: PatternVerdict | null;
  /** Score Narrative Drift (Lecture du langage), null si non applicable. */
  narrativeDriftScore: number | null;
  /** Verdict Narrative Drift. */
  narrativeDriftVerdict: PatternVerdict | null;
  /** Scores et verdicts des sept patterns Phase 4. Chaque entrée
   *  porte le pattern en surface (score, verdict, applicabilite)
   *  et, optionnellement, le triplet axe par axe pour le
   *  drill-down. Le champ `axes` est optionnel pour preserver la
   *  compatibilite avec les snapshots historiques produits avant
   *  l extension axe-par-axe. */
  patterns: Partial<Record<PatternId, {
    score: number;
    verdict: PatternVerdict;
    applicabilite: PatternApplicability;
    axes?: PatternAxesSnapshot;
  }>>;
  /** Combinaisons diagnostiques detectees a l instant T. */
  combinaisons: Array<{ nom: string; severite: 'attention' | 'alerte' | 'drapeau-rouge' }>;
}

/**
 * Delta numerique entre deux scores. Direction calculee selon
 * un seuil de tolerance (defaut 5 points) pour eviter le bruit.
 */
export interface ScoreDelta {
  before: number;
  after: number;
  delta: number;
  /** amelioration : score augmente significativement (delta >= +5)
   *  aggravation : score diminue significativement (delta <= -5)
   *  stable : variation dans la zone de tolerance */
  direction: 'amelioration' | 'aggravation' | 'stable';
}

/**
 * Transition entre deux verdicts. La hierarchie d ordre, du
 * meilleur au pire :
 *   INVESTIR > INVESTIR_AVEC_CONDITIONS > APPROFONDIR > REFUSER
 */
export interface VerdictTransition {
  from: Verdict;
  to: Verdict;
  /** maintained : meme verdict
   *  upgraded : verdict ameliore (ex APPROFONDIR -> INVESTIR_AVEC_CONDITIONS)
   *  downgraded : verdict aggrave */
  type: 'maintained' | 'upgraded' | 'downgraded';
}

/**
 * Transition entre deux verdicts patterns Phase 4 (ou Narrative
 * Drift). Hierarchie : sain > attention > alerte > drapeau-rouge.
 * non-applicable est traite comme stable s il l est dans les deux
 * snapshots.
 */
export interface PatternVerdictTransition {
  from: PatternVerdict;
  to: PatternVerdict;
  type: 'maintained' | 'upgraded' | 'downgraded' | 'newly-applicable' | 'newly-not-applicable';
}

/**
 * Delta d un axe individuel entre deux snapshots. Suit la meme
 * grammaire que ScoreDelta plus PatternVerdictTransition au
 * niveau pattern, mais transposee a l axe. Sert le drill-down UI
 * "pourquoi ce pattern s aggrave : sur quel axe precisement".
 */
export interface PatternAxisDelta {
  scoreDelta: ScoreDelta | null;
  verdictTransition: PatternVerdictTransition;
}

/**
 * Triplet de deltas axe par axe pour un pattern donne. Indexe
 * comme PatternAxesSnapshot. Un axe peut avoir scoreDelta null
 * si l un des deux snapshots ne porte pas la donnee de cet axe
 * (cas degraded compatibilite snapshots historiques).
 */
export interface PatternAxesDelta {
  axis1: PatternAxisDelta;
  axis2: PatternAxisDelta;
  axis3: PatternAxisDelta;
}

/**
 * Resultat de la comparaison entre deux snapshots du meme
 * dossier. Contient tous les deltas calcules et un resume
 * editorial qui qualifie la trajectoire dans l ensemble.
 */
export interface TrajectoryComparison {
  /** Snapshot anterieur (plus ancien des deux). */
  before: TrajectorySnapshot;
  /** Snapshot recent (plus recent des deux). */
  after: TrajectorySnapshot;
  /** Nombre de jours entre les deux analyses. */
  daysBetween: number;
  /** Delta du score global. */
  globalScoreDelta: ScoreDelta;
  /** Transition de verdict global. */
  verdictTransition: VerdictTransition;
  /** Deltas des six dimensions Bloc 1. */
  dimensionsDeltas: Record<keyof TrajectorySnapshot['dimensions'], ScoreDelta>;
  /** Delta Fragilite Structurelle, null si non applicable dans
   *  l un des deux snapshots. */
  fragiliteDelta: ScoreDelta | null;
  /** Delta Narrative Drift, null si non applicable dans l un des
   *  deux snapshots. */
  narrativeDriftDelta: ScoreDelta | null;
  /** Deltas par pattern Phase 4. Patterns non applicables dans
   *  les deux snapshots sont omis. Le champ `axesDeltas` est
   *  optionnel : il est present quand les deux snapshots portent
   *  l information axe-par-axe (snapshots produits apres
   *  l extension axe-par-axe), absent sinon (snapshots
   *  historiques). Permet a l UI de degrader sa lecture sans
   *  casser. */
  patternsDeltas: Partial<Record<PatternId, {
    scoreDelta: ScoreDelta | null;
    verdictTransition: PatternVerdictTransition;
    axesDeltas?: PatternAxesDelta;
  }>>;
  /** Combinaisons diagnostiques apparues entre before et after. */
  combinaisonsApparues: Array<{ nom: string; severite: 'attention' | 'alerte' | 'drapeau-rouge' }>;
  /** Combinaisons diagnostiques resolues entre before et after. */
  combinaisonsResolues: Array<{ nom: string; severite: 'attention' | 'alerte' | 'drapeau-rouge' }>;
  /** Combinaisons qui sont restees actives sur les deux snapshots. */
  combinaisonsPersistantes: Array<{ nom: string; severite: 'attention' | 'alerte' | 'drapeau-rouge' }>;
  /** Qualification editoriale globale de la trajectoire. */
  trajectoireGlobale: 'amelioration' | 'aggravation' | 'stabilisation' | 'volatilite';
  /** Synthese editoriale 2-3 phrases. */
  syntheseTrajectoire: string;
  /** Top alertes de trajectoire : aggravations critiques ou
   *  combinaisons drapeau-rouge nouvellement apparues. */
  topAlertesTrajectoire: string[];
}

// ============================================================
// CONSTANTES
// ============================================================

/** Seuil de variation au-dela duquel on considere un score
 *  significativement modifie. En dessous, classifie en stable. */
export const SCORE_TOLERANCE = 5;

/** Hierarchie des verdicts du score mecanique, du pire au
 *  meilleur. Permet de calculer les transitions. */
export const VERDICT_HIERARCHY: Verdict[] = [
  'refuser',
  'approfondir',
  'investir avec conditions',
  'investir',
];

/** Hierarchie des verdicts patterns, du pire au meilleur. */
export const PATTERN_VERDICT_HIERARCHY: PatternVerdict[] = [
  'drapeau-rouge',
  'alerte',
  'attention',
  'sain',
];
