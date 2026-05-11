// ============================================================
// SCORE DE TRAJECTOIRE - COMPARATEUR
// ------------------------------------------------------------
// Helpers de comparaison entre deux snapshots successifs du
// meme dossier. Calcule les deltas par dimension, par moteur
// et par pattern Phase 4. Produit un resume editorial qui
// qualifie la trajectoire.
//
// Aucune dependance Supabase ou LLM dans ce module : il opere
// sur deux objets TrajectorySnapshot deja construits par la
// couche persistence amont. Cette separation permet de tester
// le calcul de trajectoire de maniere unitaire et deterministe.
// ============================================================

import type {
  TrajectorySnapshot,
  TrajectoryComparison,
  ScoreDelta,
  VerdictTransition,
  PatternVerdictTransition,
  PatternAxesDelta,
  PatternAxisDelta,
} from './types';
import { SCORE_TOLERANCE, VERDICT_HIERARCHY, PATTERN_VERDICT_HIERARCHY } from './types';
import { PATTERN_IDS, type PatternId, type PatternVerdict } from '../fragility-structurelle/types';
import type { Verdict } from '../score-calculator';

// ============================================================
// HELPERS DE BASE
// ============================================================

/**
 * Calcule un delta entre deux scores numeriques avec direction
 * derivee selon la zone de tolerance. Utilise pour les six
 * dimensions, le score global, et les scores moteurs Phase 4.
 */
export function computeScoreDelta(before: number, after: number): ScoreDelta {
  const delta = Math.round((after - before) * 100) / 100;
  let direction: ScoreDelta['direction'];
  if (delta >= SCORE_TOLERANCE) direction = 'amelioration';
  else if (delta <= -SCORE_TOLERANCE) direction = 'aggravation';
  else direction = 'stable';
  return { before, after, delta, direction };
}

/**
 * Compare deux verdicts globaux et derive le type de transition
 * selon la hierarchie. Utilise une normalisation insensible a la
 * casse pour absorber les variations possibles dans le payload
 * persiste.
 */
export function computeVerdictTransition(from: Verdict, to: Verdict): VerdictTransition {
  const normalizedFrom = (from || '').toLowerCase() as Verdict;
  const normalizedTo = (to || '').toLowerCase() as Verdict;
  const fromIdx = VERDICT_HIERARCHY.indexOf(normalizedFrom);
  const toIdx = VERDICT_HIERARCHY.indexOf(normalizedTo);

  let type: VerdictTransition['type'];
  if (fromIdx === -1 || toIdx === -1) {
    // Verdicts non standard (ex 'A reinstruire' du fallback) : on
    // les classifie comme maintained si identiques, sinon le code
    // appelant est libre d interpreter.
    type = normalizedFrom === normalizedTo ? 'maintained' : 'downgraded';
  } else if (toIdx > fromIdx) type = 'upgraded';
  else if (toIdx < fromIdx) type = 'downgraded';
  else type = 'maintained';

  return { from, to, type };
}

/**
 * Compare deux verdicts patterns et derive le type de transition.
 * Cas particuliers : passage en applicable (un pattern non
 * applicable a T-1 devient applicable a T) ou inversement.
 */
export function computePatternVerdictTransition(
  from: PatternVerdict,
  to: PatternVerdict,
): PatternVerdictTransition {
  // Cas non-applicable
  if (from === 'non-applicable' && to !== 'non-applicable') {
    return { from, to, type: 'newly-applicable' };
  }
  if (from !== 'non-applicable' && to === 'non-applicable') {
    return { from, to, type: 'newly-not-applicable' };
  }
  if (from === 'non-applicable' && to === 'non-applicable') {
    return { from, to, type: 'maintained' };
  }

  const fromIdx = PATTERN_VERDICT_HIERARCHY.indexOf(from);
  const toIdx = PATTERN_VERDICT_HIERARCHY.indexOf(to);

  let type: PatternVerdictTransition['type'];
  if (fromIdx === -1 || toIdx === -1) {
    type = from === to ? 'maintained' : 'downgraded';
  } else if (toIdx > fromIdx) type = 'upgraded';
  else if (toIdx < fromIdx) type = 'downgraded';
  else type = 'maintained';

  return { from, to, type };
}

/**
 * Calcule le nombre de jours separant deux timestamps ISO.
 * Tolere des entrees malformees en retournant 0.
 */
export function computeDaysBetween(beforeIso: string, afterIso: string): number {
  const before = new Date(beforeIso).getTime();
  const after = new Date(afterIso).getTime();
  if (isNaN(before) || isNaN(after)) return 0;
  return Math.round(Math.abs(after - before) / (1000 * 60 * 60 * 24));
}

// ============================================================
// COMPARAISON DES PATTERNS PHASE 4
// ============================================================

/**
 * Calcule le delta d un axe individuel entre deux snapshots d axe.
 * Suit la meme grammaire que computeScoreDelta plus
 * computePatternVerdictTransition mais au niveau axe.
 */
function compareAxis(
  before: { score: number; verdict: PatternVerdict },
  after: { score: number; verdict: PatternVerdict },
): PatternAxisDelta {
  return {
    scoreDelta: computeScoreDelta(before.score, after.score),
    verdictTransition: computePatternVerdictTransition(before.verdict, after.verdict),
  };
}

/**
 * Calcule le triplet de deltas axe par axe pour un pattern donne.
 * Retourne undefined si l un des deux snapshots ne porte pas le
 * triplet (cas degraded snapshots historiques avant l extension
 * axe-par-axe). L UI peut alors degrader son drill-down sans
 * casser.
 */
function compareAxes(
  beforeP: NonNullable<TrajectorySnapshot['patterns'][PatternId]>,
  afterP: NonNullable<TrajectorySnapshot['patterns'][PatternId]>,
): PatternAxesDelta | undefined {
  if (!beforeP.axes || !afterP.axes) return undefined;
  return {
    axis1: compareAxis(beforeP.axes.axis1, afterP.axes.axis1),
    axis2: compareAxis(beforeP.axes.axis2, afterP.axes.axis2),
    axis3: compareAxis(beforeP.axes.axis3, afterP.axes.axis3),
  };
}

/**
 * Calcule pour chaque pattern Phase 4 son delta de score (si
 * applicable dans les deux snapshots) et sa transition de
 * verdict. Patterns non applicables dans les deux snapshots sont
 * omis du resultat (pas de bruit visuel).
 *
 * En plus du pattern de surface, si les deux snapshots portent
 * l information axe par axe (cas snapshots produits apres
 * l extension Phase 4 v2), on calcule aussi le triplet de deltas
 * axe par axe. Le drill-down UI consomme ce triplet pour
 * expliquer "ce pattern s aggrave parce que l axe identitaire a
 * monte de 15 points".
 */
function comparePatterns(
  before: TrajectorySnapshot,
  after: TrajectorySnapshot,
): TrajectoryComparison['patternsDeltas'] {
  const deltas: TrajectoryComparison['patternsDeltas'] = {};

  for (const patternId of PATTERN_IDS) {
    const beforeP = before.patterns?.[patternId];
    const afterP = after.patterns?.[patternId];

    // Patterns non applicables dans les deux : on saute pour ne pas
    // surcharger le rapport
    if ((!beforeP || beforeP.applicabilite === 'not-applicable') &&
        (!afterP || afterP.applicabilite === 'not-applicable')) {
      continue;
    }

    const fromVerdict: PatternVerdict = beforeP?.verdict ?? 'non-applicable';
    const toVerdict: PatternVerdict = afterP?.verdict ?? 'non-applicable';
    const verdictTransition = computePatternVerdictTransition(fromVerdict, toVerdict);

    // Score delta uniquement si les deux snapshots ont un score (donc
    // le pattern etait applicable des deux cotes)
    let scoreDelta: ScoreDelta | null = null;
    let axesDeltas: PatternAxesDelta | undefined;
    if (beforeP?.applicabilite !== 'not-applicable' && afterP?.applicabilite !== 'not-applicable'
        && beforeP && afterP) {
      scoreDelta = computeScoreDelta(beforeP.score, afterP.score);
      axesDeltas = compareAxes(beforeP, afterP);
    }

    deltas[patternId] = axesDeltas
      ? { scoreDelta, verdictTransition, axesDeltas }
      : { scoreDelta, verdictTransition };
  }

  return deltas;
}

// ============================================================
// COMPARAISON DES COMBINAISONS DIAGNOSTIQUES
// ============================================================

/**
 * Compare les listes de combinaisons diagnostiques entre deux
 * snapshots. Categorise chaque combinaison en apparue (nouvelle),
 * resolue (disparue), ou persistante (sur les deux). C est
 * souvent l information la plus diagnostique du rapport de
 * trajectoire pour le partner.
 */
function compareCombinaisons(
  before: TrajectorySnapshot,
  after: TrajectorySnapshot,
): {
  apparues: TrajectoryComparison['combinaisonsApparues'];
  resolues: TrajectoryComparison['combinaisonsResolues'];
  persistantes: TrajectoryComparison['combinaisonsPersistantes'];
} {
  const beforeNoms = new Set((before.combinaisons ?? []).map(c => c.nom));
  const afterNoms = new Set((after.combinaisons ?? []).map(c => c.nom));

  const apparues = (after.combinaisons ?? []).filter(c => !beforeNoms.has(c.nom));
  const resolues = (before.combinaisons ?? []).filter(c => !afterNoms.has(c.nom));
  const persistantes = (after.combinaisons ?? []).filter(c => beforeNoms.has(c.nom));

  return { apparues, resolues, persistantes };
}

// ============================================================
// QUALIFICATION GLOBALE DE LA TRAJECTOIRE
// ============================================================

/**
 * Derive un verdict editorial global de la trajectoire a partir
 * du delta du score global, des transitions de verdicts, et de
 * l apparition de combinaisons drapeau-rouge.
 *
 * - amelioration : score global en hausse significative ET
 *   verdict ameliore ou maintenu, sans nouvelle combinaison
 *   drapeau-rouge
 * - aggravation : score global en baisse significative OU verdict
 *   downgrade OU nouvelle combinaison drapeau-rouge
 * - stabilisation : variations dans la zone de tolerance, pas de
 *   transition de verdict, pas de combinaison nouvelle
 * - volatilite : signaux contradictoires (par ex score en hausse
 *   mais nouvelle combinaison drapeau-rouge, qui appelle de la
 *   prudence)
 */
function qualifyTrajectory(
  globalScoreDelta: ScoreDelta,
  verdictTransition: VerdictTransition,
  combinaisonsApparues: TrajectoryComparison['combinaisonsApparues'],
): TrajectoryComparison['trajectoireGlobale'] {
  const newDrapeauRouge = combinaisonsApparues.some(c => c.severite === 'drapeau-rouge');
  const scoreDirection = globalScoreDelta.direction;
  const verdictDirection = verdictTransition.type;

  // Aggravation forte : score en baisse OU verdict downgrade OU
  // nouvelle combinaison drapeau-rouge
  const hasAggravation = scoreDirection === 'aggravation' ||
                         verdictDirection === 'downgraded' ||
                         newDrapeauRouge;
  const hasAmelioration = scoreDirection === 'amelioration' ||
                          verdictDirection === 'upgraded';

  if (hasAggravation && hasAmelioration) {
    // Signaux contradictoires : score qui monte et nouvelle combinaison
    // drapeau-rouge, ou verdict upgrade malgre score en baisse.
    return 'volatilite';
  }

  if (hasAggravation) {
    return 'aggravation';
  }

  if (hasAmelioration) {
    return 'amelioration';
  }

  return 'stabilisation';
}

// ============================================================
// SYNTHESE EDITORIALE
// ============================================================

function buildSyntheseTrajectoire(
  comparison: Pick<TrajectoryComparison,
    'globalScoreDelta' | 'verdictTransition' | 'combinaisonsApparues' |
    'combinaisonsResolues' | 'daysBetween' | 'trajectoireGlobale'>,
): string {
  const days = comparison.daysBetween;
  const scoreDelta = comparison.globalScoreDelta.delta;
  const scoreSign = scoreDelta >= 0 ? '+' : '';
  const trajectoire = comparison.trajectoireGlobale;
  const verdictType = comparison.verdictTransition.type;

  let resume = `Sur ${days} jour${days > 1 ? 's' : ''} entre les deux analyses, le score global evolue de ${scoreSign}${scoreDelta} points`;

  // Verdict
  if (verdictType === 'maintained') {
    resume += `, le verdict est maintenu (${comparison.verdictTransition.to}).`;
  } else if (verdictType === 'upgraded') {
    resume += `, le verdict s ameliore de ${comparison.verdictTransition.from} a ${comparison.verdictTransition.to}.`;
  } else if (verdictType === 'downgraded') {
    resume += `, le verdict regresse de ${comparison.verdictTransition.from} a ${comparison.verdictTransition.to}.`;
  } else {
    resume += '.';
  }

  // Combinaisons
  const apparues = comparison.combinaisonsApparues;
  const resolues = comparison.combinaisonsResolues;
  if (apparues.length > 0) {
    const drapeauxRouges = apparues.filter(c => c.severite === 'drapeau-rouge');
    if (drapeauxRouges.length > 0) {
      resume += ` Combinaison${drapeauxRouges.length > 1 ? 's' : ''} drapeau-rouge nouvellement detectee${drapeauxRouges.length > 1 ? 's' : ''} : ${drapeauxRouges.map(c => c.nom).join(', ')}.`;
    } else {
      resume += ` Nouvelle${apparues.length > 1 ? 's' : ''} combinaison${apparues.length > 1 ? 's' : ''} : ${apparues.map(c => c.nom).join(', ')}.`;
    }
  }
  if (resolues.length > 0) {
    resume += ` Combinaison${resolues.length > 1 ? 's' : ''} resolue${resolues.length > 1 ? 's' : ''} : ${resolues.map(c => c.nom).join(', ')}.`;
  }

  // Qualification globale
  const trajectoireLabel = {
    'amelioration': 'amelioration nette',
    'aggravation': 'aggravation',
    'stabilisation': 'stabilisation',
    'volatilite': 'volatilite (signaux contradictoires)',
  }[trajectoire];
  resume += ` Trajectoire qualifiee : ${trajectoireLabel}.`;

  return resume;
}

// ============================================================
// TOP ALERTES DE TRAJECTOIRE
// ============================================================

function buildTopAlertes(
  comparison: Pick<TrajectoryComparison,
    'verdictTransition' | 'globalScoreDelta' | 'combinaisonsApparues' |
    'patternsDeltas' | 'dimensionsDeltas'>,
): string[] {
  const alertes: string[] = [];

  // Combinaisons drapeau-rouge nouvellement apparues
  for (const comb of comparison.combinaisonsApparues) {
    if (comb.severite === 'drapeau-rouge') {
      alertes.push(`Nouvelle combinaison drapeau-rouge : ${comb.nom}`);
    }
  }
  for (const comb of comparison.combinaisonsApparues) {
    if (comb.severite === 'alerte') {
      alertes.push(`Nouvelle combinaison alerte : ${comb.nom}`);
    }
  }

  // Verdict downgrade
  if (comparison.verdictTransition.type === 'downgraded') {
    alertes.push(`Downgrade de verdict : ${comparison.verdictTransition.from} -> ${comparison.verdictTransition.to}`);
  }

  // Score global en aggravation
  if (comparison.globalScoreDelta.direction === 'aggravation') {
    alertes.push(`Score global en baisse : ${comparison.globalScoreDelta.delta} points`);
  }

  // Dimensions Bloc 1 en aggravation forte (>= 10 points)
  for (const [dim, delta] of Object.entries(comparison.dimensionsDeltas)) {
    if (delta.delta <= -10) {
      alertes.push(`Dimension ${dim} en chute : ${delta.delta} points`);
    }
  }

  // Patterns Phase 4 en downgrade
  for (const [patternId, deltaInfo] of Object.entries(comparison.patternsDeltas)) {
    if (deltaInfo?.verdictTransition?.type === 'downgraded') {
      alertes.push(`Pattern ${patternId} : ${deltaInfo.verdictTransition.from} -> ${deltaInfo.verdictTransition.to}`);
    }
  }

  return alertes;
}

// ============================================================
// POINT D ENTREE PRINCIPAL
// ============================================================

/**
 * Calcule la comparaison entre deux snapshots du meme dossier.
 * before et after doivent provenir du meme dossier ; la fonction
 * ne verifie pas cette coherence, elle est laissee a la couche
 * persistence amont.
 *
 * Si les deux snapshots ont le meme analyzedAt, la fonction
 * fonctionne quand meme (daysBetween = 0). C est une signature
 * pure : meme inputs => meme outputs.
 */
export function compareAnalyses(
  before: TrajectorySnapshot,
  after: TrajectorySnapshot,
): TrajectoryComparison {
  const daysBetween = computeDaysBetween(before.analyzedAt, after.analyzedAt);
  const globalScoreDelta = computeScoreDelta(before.globalScore, after.globalScore);
  const verdictTransition = computeVerdictTransition(before.verdict, after.verdict);

  const dimensionsDeltas = {
    team: computeScoreDelta(before.dimensions.team, after.dimensions.team),
    market: computeScoreDelta(before.dimensions.market, after.dimensions.market),
    macro: computeScoreDelta(before.dimensions.macro, after.dimensions.macro),
    financial: computeScoreDelta(before.dimensions.financial, after.dimensions.financial),
    contrarian: computeScoreDelta(before.dimensions.contrarian, after.dimensions.contrarian),
    vigilance: computeScoreDelta(before.dimensions.vigilance, after.dimensions.vigilance),
  };

  const fragiliteDelta = (before.fragiliteScore !== null && after.fragiliteScore !== null)
    ? computeScoreDelta(before.fragiliteScore, after.fragiliteScore)
    : null;

  const narrativeDriftDelta = (before.narrativeDriftScore !== null && after.narrativeDriftScore !== null)
    ? computeScoreDelta(before.narrativeDriftScore, after.narrativeDriftScore)
    : null;

  const patternsDeltas = comparePatterns(before, after);
  const { apparues, resolues, persistantes } = compareCombinaisons(before, after);
  const trajectoireGlobale = qualifyTrajectory(globalScoreDelta, verdictTransition, apparues);

  const partial: Pick<TrajectoryComparison,
    'globalScoreDelta' | 'verdictTransition' | 'combinaisonsApparues' |
    'combinaisonsResolues' | 'daysBetween' | 'trajectoireGlobale' |
    'patternsDeltas' | 'dimensionsDeltas'> = {
    globalScoreDelta,
    verdictTransition,
    combinaisonsApparues: apparues,
    combinaisonsResolues: resolues,
    daysBetween,
    trajectoireGlobale,
    patternsDeltas,
    dimensionsDeltas,
  };

  return {
    before,
    after,
    daysBetween,
    globalScoreDelta,
    verdictTransition,
    dimensionsDeltas,
    fragiliteDelta,
    narrativeDriftDelta,
    patternsDeltas,
    combinaisonsApparues: apparues,
    combinaisonsResolues: resolues,
    combinaisonsPersistantes: persistantes,
    trajectoireGlobale,
    syntheseTrajectoire: buildSyntheseTrajectoire(partial),
    topAlertesTrajectoire: buildTopAlertes(partial),
  };
}
