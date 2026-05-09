// ============================================================
// SCORE DE TRAJECTOIRE - BUILDER DE CHAINE
// ------------------------------------------------------------
// Helper qui construit une chaine de comparaisons a partir d une
// liste d analyses ordonnees du meme dossier. Pour N analyses,
// produit N-1 TrajectoryComparison entre chaque paire successive.
//
// Cas d usage : dashboard qui affiche l evolution d un dossier
// sur plusieurs analyses. Le partner voit chaque transition entre
// versions, plus la trajectoire globale agregee.
//
// L application existante de Prelude regroupe les analyses du
// meme dossier via le systeme de versions (collaboration-store).
// Ce builder consomme une liste d analyses qui peut etre
// recuperee via getAnalysisVersions ou un listAnalyses filtre par
// company. Il ne fait aucun appel base lui-meme : separation
// stricte entre la couche persistence (qui charge) et la couche
// trajectoire (qui calcule).
// ============================================================

import { compareAnalyses } from './comparator';
import { extractSnapshot, type AnalysisPayloadForSnapshot } from './snapshot-extractor';
import type { TrajectorySnapshot, TrajectoryComparison } from './types';

/**
 * Resume agrege d une trajectoire complete sur N analyses.
 * Permet d afficher en synthese sans expanser toutes les
 * comparisons individuelles.
 */
export interface TrajectorySummary {
  /** Nombre d analyses dans la chaine. */
  totalAnalyses: number;
  /** Premier et dernier snapshots. Null si chaine vide ou un seul
   *  snapshot. */
  firstSnapshot: TrajectorySnapshot | null;
  lastSnapshot: TrajectorySnapshot | null;
  /** Duree totale en jours entre la premiere et la derniere
   *  analyse. 0 si chaine vide ou un seul snapshot. */
  totalDays: number;
  /** Comparaison globale entre la premiere et la derniere analyse.
   *  Null si moins de 2 snapshots exploitables. */
  overallComparison: TrajectoryComparison | null;
  /** Comparaisons successives entre chaque paire d analyses
   *  consecutives. Vide si moins de 2 snapshots exploitables. */
  successiveComparisons: TrajectoryComparison[];
  /** Nombre de combinaisons drapeau-rouge apparues sur l ensemble
   *  de la trajectoire (cumul de toutes les comparisons
   *  successives). Indicateur agrege pour la synthese. */
  totalDrapeauxRougesApparus: number;
  /** Tendance globale derivee de overallComparison. Null si moins
   *  de 2 snapshots. */
  tendanceGlobale: TrajectoryComparison['trajectoireGlobale'] | null;
}

/**
 * Construit une chaine de comparaisons a partir d une liste
 * d analyses du meme dossier. Les analyses doivent venir du
 * meme dossier (la fonction ne le verifie pas, c est la
 * responsabilite du caller). L ordre d entree n est pas critique :
 * la fonction trie automatiquement par analyzedAt croissant avant
 * de comparer.
 *
 * Les analyses qui ne produisent pas de snapshot exploitable
 * (extractSnapshot retourne null) sont silencieusement ignorees.
 */
export function buildTrajectoryFromAnalyses(
  analyses: AnalysisPayloadForSnapshot[],
): TrajectorySummary {
  // Extraction et tri chronologique
  const snapshots = analyses
    .map(extractSnapshot)
    .filter((s): s is TrajectorySnapshot => s !== null)
    .sort((a, b) => {
      const ta = new Date(a.analyzedAt).getTime();
      const tb = new Date(b.analyzedAt).getTime();
      return ta - tb;
    });

  if (snapshots.length === 0) {
    return {
      totalAnalyses: 0,
      firstSnapshot: null,
      lastSnapshot: null,
      totalDays: 0,
      overallComparison: null,
      successiveComparisons: [],
      totalDrapeauxRougesApparus: 0,
      tendanceGlobale: null,
    };
  }

  if (snapshots.length === 1) {
    return {
      totalAnalyses: 1,
      firstSnapshot: snapshots[0],
      lastSnapshot: snapshots[0],
      totalDays: 0,
      overallComparison: null,
      successiveComparisons: [],
      totalDrapeauxRougesApparus: 0,
      tendanceGlobale: null,
    };
  }

  // Au moins 2 snapshots : on calcule la chaine
  const firstSnapshot = snapshots[0];
  const lastSnapshot = snapshots[snapshots.length - 1];

  const successiveComparisons: TrajectoryComparison[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    successiveComparisons.push(compareAnalyses(snapshots[i - 1], snapshots[i]));
  }

  const overallComparison = compareAnalyses(firstSnapshot, lastSnapshot);

  // Cumul des combinaisons drapeau-rouge apparues sur l ensemble
  // des transitions successives. Indicateur de fragilite
  // accumulee dans le temps : un dossier qui voit apparaitre
  // plusieurs combinaisons drapeau-rouge sur une trajectoire est
  // dans une dynamique de degradation continue, signal plus fort
  // qu une seule combinaison apparue ponctuellement.
  let totalDrapeauxRougesApparus = 0;
  for (const c of successiveComparisons) {
    totalDrapeauxRougesApparus += c.combinaisonsApparues.filter(
      comb => comb.severite === 'drapeau-rouge'
    ).length;
  }

  return {
    totalAnalyses: snapshots.length,
    firstSnapshot,
    lastSnapshot,
    totalDays: overallComparison.daysBetween,
    overallComparison,
    successiveComparisons,
    totalDrapeauxRougesApparus,
    tendanceGlobale: overallComparison.trajectoireGlobale,
  };
}
