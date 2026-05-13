// ============================================================
// PRELUDE - Calculs deterministes inter-sectoriels
// ------------------------------------------------------------
// Module purement fonctionnel : prend les fiches sectorielles du
// trimestre courant et celles du trimestre precedent, et produit
// les trois objets analytiques qui structurent le brief Etat
// systemique des secteurs : convergences, divergences, patterns
// macro structurels.
//
// Aucun appel LLM, aucun appel Supabase, aucun import qui
// remonte vers next/headers. Le module est donc importable cote
// client sans casser le build webpack (lecon du fix du sous-
// chantier 6/7).
//
// Doctrine des seuils :
//   - Convergence : deux secteurs dont l ecart sur une meme
//     dimension passe de >20 a <10 entre T-1 et T. Lecture
//     editoriale : un signal sectoriel autrefois disjoint devient
//     commun, ce qui temoigne d une dynamique transverse en train
//     de cristalliser.
//   - Divergence : deux secteurs dont l ecart passe de <15 a >30.
//     Lecture editoriale : une dynamique commune se rompt
//     brutalement, soit par accident exogene (regulation,
//     technologie de rupture), soit par maturation differentielle.
//   - Pattern macro : une dimension qui bouge de >10 points dans
//     la meme direction sur plus de la moitie des secteurs (>=7
//     sur 13). Lecture editoriale : un choc systemique traverse
//     l ecosysteme, pas seulement un ou deux verticaux.
//
// Les seuils sont exposes en constantes pour rester ajustables
// sans toucher a la logique. Les tests deterministes calibrent
// chaque borne au pixel pres pour eviter toute derive silencieuse.
// ============================================================

import type {
  DimensionKey,
  SectoralBrief,
  SectoralBriefDimensions,
} from './types';
import { DIMENSION_KEYS, SECTORS } from './types';

// ------------------------------------------------------------
// SEUILS DOCTRINAUX
// ------------------------------------------------------------

/** Convergence : ecart au trimestre precedent strictement
 *  superieur a ce seuil (en points 0-100). */
export const CONVERGENCE_PREV_GAP_THRESHOLD = 20;

/** Convergence : ecart au trimestre courant strictement inferieur
 *  a ce seuil. La transition entre les deux seuils est ce qui
 *  caracterise une convergence. */
export const CONVERGENCE_CURR_GAP_THRESHOLD = 10;

/** Divergence : ecart au trimestre precedent strictement inferieur
 *  a ce seuil. Les secteurs etaient quasi-alignes. */
export const DIVERGENCE_PREV_GAP_THRESHOLD = 15;

/** Divergence : ecart au trimestre courant strictement superieur
 *  a ce seuil. La rupture est nette. */
export const DIVERGENCE_CURR_GAP_THRESHOLD = 30;

/** Pattern macro : delta minimum (en points) pour qu un secteur
 *  soit considere comme ayant bouge sur la dimension. */
export const MACRO_PATTERN_DELTA_THRESHOLD = 10;

/** Pattern macro : nombre minimum de secteurs qui doivent avoir
 *  bouge dans la meme direction pour considerer la dynamique
 *  comme structurelle. Cale sur "plus de la moitie des 13" = 7. */
export const MACRO_PATTERN_MIN_SECTORS = 7;

// ------------------------------------------------------------
// TYPES PUBLICS
// ------------------------------------------------------------

export interface ConvergencePair {
  /** Slugs ordonnes alphabetiquement pour stabilite. */
  sectors: [string, string];
  dimension: DimensionKey;
  /** Ecart en points absolu au trimestre precedent. */
  delta_t_minus_1: number;
  /** Ecart en points absolu au trimestre courant. */
  delta_t: number;
}

export interface DivergencePair {
  sectors: [string, string];
  dimension: DimensionKey;
  delta_t_minus_1: number;
  delta_t: number;
}

export type MacroDirection = 'up' | 'down';

export interface MacroPattern {
  dimension: DimensionKey;
  direction: MacroDirection;
  /** Moyenne arithmetique des deltas signes pour les secteurs
   *  affectes. Permet de quantifier l intensite du choc. */
  average_delta: number;
  /** Slugs des secteurs qui ont bouge dans la direction
   *  identifiee. Tries alphabetiquement pour stabilite. */
  sectors_affected: string[];
}

/**
 * Inventaire des secteurs absents des donnees (fiche manquante a
 * T ou a T-1, ou data_missing pour la dimension consideree). Sert
 * a alimenter la mention "donnees incompletes sur les secteurs"
 * en tete du brief editorial quand le set d entree n est pas
 * complet.
 */
export interface DataCompleteness {
  /** Slugs presents a T mais pas a T-1 (donc pas comparables). */
  missing_at_t_minus_1: string[];
  /** Slugs presents a T-1 mais pas a T. */
  missing_at_t: string[];
  /** Slugs absents des deux trimestres. */
  missing_both: string[];
  /** Slugs comparables (presents aux deux trimestres). */
  comparable: string[];
}

export interface InterSectoralComputations {
  convergences: ConvergencePair[];
  divergences: DivergencePair[];
  macro_patterns: MacroPattern[];
  completeness: DataCompleteness;
}

// ------------------------------------------------------------
// API PRINCIPALE
// ------------------------------------------------------------

/**
 * Calcule les trois objets analytiques + l inventaire de
 * completude. Les listes en entree peuvent etre dans un ordre
 * arbitraire ; le module reindexe par sector_slug.
 *
 * Discipline anti-hallucination : un secteur ou une dimension en
 * data_missing est traite comme une donnee absente, pas comme un
 * score de zero. Les paires impliquant des donnees manquantes
 * sont exclues silencieusement, jamais imputees.
 */
export function computeInterSectoralAnalytics(
  currentBriefs: SectoralBrief[],
  previousBriefs: SectoralBrief[],
): InterSectoralComputations {
  const currBySlug = indexBySlug(currentBriefs);
  const prevBySlug = indexBySlug(previousBriefs);

  const completeness = computeCompleteness(currBySlug, prevBySlug);
  const comparableSlugs = completeness.comparable;

  const convergences = computeConvergences(currBySlug, prevBySlug, comparableSlugs);
  const divergences = computeDivergences(currBySlug, prevBySlug, comparableSlugs);
  const macro_patterns = computeMacroPatterns(currBySlug, prevBySlug, comparableSlugs);

  return {
    convergences,
    divergences,
    macro_patterns,
    completeness,
  };
}

// ------------------------------------------------------------
// CONVERGENCES
// ------------------------------------------------------------

export function computeConvergences(
  currBySlug: Map<string, SectoralBrief>,
  prevBySlug: Map<string, SectoralBrief>,
  comparableSlugs: string[],
): ConvergencePair[] {
  const out: ConvergencePair[] = [];
  const sortedSlugs = [...comparableSlugs].sort();

  for (const dim of DIMENSION_KEYS) {
    for (let i = 0; i < sortedSlugs.length; i++) {
      for (let j = i + 1; j < sortedSlugs.length; j++) {
        const a = sortedSlugs[i];
        const b = sortedSlugs[j];

        const aPrev = readScore(prevBySlug.get(a)?.dimensions, dim);
        const bPrev = readScore(prevBySlug.get(b)?.dimensions, dim);
        const aCurr = readScore(currBySlug.get(a)?.dimensions, dim);
        const bCurr = readScore(currBySlug.get(b)?.dimensions, dim);

        // Donnees manquantes : pas de paire formee.
        if (aPrev === null || bPrev === null || aCurr === null || bCurr === null) continue;

        const gapPrev = Math.abs(aPrev - bPrev);
        const gapCurr = Math.abs(aCurr - bCurr);

        if (
          gapPrev > CONVERGENCE_PREV_GAP_THRESHOLD &&
          gapCurr < CONVERGENCE_CURR_GAP_THRESHOLD
        ) {
          out.push({
            sectors: [a, b],
            dimension: dim,
            delta_t_minus_1: gapPrev,
            delta_t: gapCurr,
          });
        }
      }
    }
  }

  // Tri stable : intensite de la convergence (gapPrev - gapCurr)
  // decroissante, puis dimension, puis paire alpha.
  out.sort((x, y) => {
    const intensityX = x.delta_t_minus_1 - x.delta_t;
    const intensityY = y.delta_t_minus_1 - y.delta_t;
    if (intensityX !== intensityY) return intensityY - intensityX;
    if (x.dimension !== y.dimension) return x.dimension.localeCompare(y.dimension);
    return (x.sectors[0] + x.sectors[1]).localeCompare(y.sectors[0] + y.sectors[1]);
  });

  return out;
}

// ------------------------------------------------------------
// DIVERGENCES
// ------------------------------------------------------------

export function computeDivergences(
  currBySlug: Map<string, SectoralBrief>,
  prevBySlug: Map<string, SectoralBrief>,
  comparableSlugs: string[],
): DivergencePair[] {
  const out: DivergencePair[] = [];
  const sortedSlugs = [...comparableSlugs].sort();

  for (const dim of DIMENSION_KEYS) {
    for (let i = 0; i < sortedSlugs.length; i++) {
      for (let j = i + 1; j < sortedSlugs.length; j++) {
        const a = sortedSlugs[i];
        const b = sortedSlugs[j];

        const aPrev = readScore(prevBySlug.get(a)?.dimensions, dim);
        const bPrev = readScore(prevBySlug.get(b)?.dimensions, dim);
        const aCurr = readScore(currBySlug.get(a)?.dimensions, dim);
        const bCurr = readScore(currBySlug.get(b)?.dimensions, dim);

        if (aPrev === null || bPrev === null || aCurr === null || bCurr === null) continue;

        const gapPrev = Math.abs(aPrev - bPrev);
        const gapCurr = Math.abs(aCurr - bCurr);

        if (
          gapPrev < DIVERGENCE_PREV_GAP_THRESHOLD &&
          gapCurr > DIVERGENCE_CURR_GAP_THRESHOLD
        ) {
          out.push({
            sectors: [a, b],
            dimension: dim,
            delta_t_minus_1: gapPrev,
            delta_t: gapCurr,
          });
        }
      }
    }
  }

  // Tri : intensite de la divergence (gapCurr - gapPrev) decroissante.
  out.sort((x, y) => {
    const intensityX = x.delta_t - x.delta_t_minus_1;
    const intensityY = y.delta_t - y.delta_t_minus_1;
    if (intensityX !== intensityY) return intensityY - intensityX;
    if (x.dimension !== y.dimension) return x.dimension.localeCompare(y.dimension);
    return (x.sectors[0] + x.sectors[1]).localeCompare(y.sectors[0] + y.sectors[1]);
  });

  return out;
}

// ------------------------------------------------------------
// PATTERNS MACRO STRUCTURELS
// ------------------------------------------------------------

export function computeMacroPatterns(
  currBySlug: Map<string, SectoralBrief>,
  prevBySlug: Map<string, SectoralBrief>,
  comparableSlugs: string[],
): MacroPattern[] {
  const out: MacroPattern[] = [];

  for (const dim of DIMENSION_KEYS) {
    const upSectors: Array<{ slug: string; delta: number }> = [];
    const downSectors: Array<{ slug: string; delta: number }> = [];

    for (const slug of comparableSlugs) {
      const prev = readScore(prevBySlug.get(slug)?.dimensions, dim);
      const curr = readScore(currBySlug.get(slug)?.dimensions, dim);
      if (prev === null || curr === null) continue;
      const delta = curr - prev;
      if (delta > MACRO_PATTERN_DELTA_THRESHOLD) {
        upSectors.push({ slug, delta });
      } else if (delta < -MACRO_PATTERN_DELTA_THRESHOLD) {
        downSectors.push({ slug, delta });
      }
    }

    if (upSectors.length >= MACRO_PATTERN_MIN_SECTORS) {
      out.push({
        dimension: dim,
        direction: 'up',
        average_delta: roundTo(meanDelta(upSectors), 1),
        sectors_affected: upSectors.map((s) => s.slug).sort(),
      });
    }
    if (downSectors.length >= MACRO_PATTERN_MIN_SECTORS) {
      out.push({
        dimension: dim,
        direction: 'down',
        average_delta: roundTo(meanDelta(downSectors), 1),
        sectors_affected: downSectors.map((s) => s.slug).sort(),
      });
    }
  }

  // Tri : intensite du pattern (|average_delta| decroissant), puis
  // nombre de secteurs decroissant, puis dimension alpha.
  out.sort((x, y) => {
    const ax = Math.abs(x.average_delta);
    const ay = Math.abs(y.average_delta);
    if (ax !== ay) return ay - ax;
    if (x.sectors_affected.length !== y.sectors_affected.length) {
      return y.sectors_affected.length - x.sectors_affected.length;
    }
    return x.dimension.localeCompare(y.dimension);
  });

  return out;
}

// ------------------------------------------------------------
// COMPLETUDE
// ------------------------------------------------------------

export function computeCompleteness(
  currBySlug: Map<string, SectoralBrief>,
  prevBySlug: Map<string, SectoralBrief>,
): DataCompleteness {
  const allCatalogSlugs = SECTORS.map((s) => s.slug);
  const missingT: string[] = [];
  const missingTMinus1: string[] = [];
  const missingBoth: string[] = [];
  const comparable: string[] = [];

  for (const slug of allCatalogSlugs) {
    const inCurr = currBySlug.has(slug);
    const inPrev = prevBySlug.has(slug);
    if (inCurr && inPrev) comparable.push(slug);
    else if (inCurr && !inPrev) missingTMinus1.push(slug);
    else if (!inCurr && inPrev) missingT.push(slug);
    else missingBoth.push(slug);
  }

  return {
    missing_at_t_minus_1: missingTMinus1.sort(),
    missing_at_t: missingT.sort(),
    missing_both: missingBoth.sort(),
    comparable: comparable.sort(),
  };
}

// ------------------------------------------------------------
// HELPERS DE PERIODE TRIMESTRIELLE
// ------------------------------------------------------------

/**
 * Retourne le libelle ISO trimestriel d une date donnee, par
 * exemple "2026-Q2". Convention : le trimestre 1 va de janvier
 * a mars, etc.
 */
export function formatPeriodQuarter(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-11
  const q = Math.floor(m / 3) + 1;
  return `${y}-Q${q}`;
}

/**
 * Retourne le libelle du trimestre precedent. Exemple :
 * "2026-Q2" -> "2026-Q1", "2026-Q1" -> "2025-Q4".
 */
export function previousPeriodQuarter(period: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!m) throw new Error(`Format de periode invalide : ${period}. Attendu YYYY-Qn.`);
  const y = parseInt(m[1], 10);
  const q = parseInt(m[2], 10);
  if (q === 1) return `${y - 1}-Q4`;
  return `${y}-Q${q - 1}`;
}

/**
 * Predicat utile au cron mensuel : retourne true si la date passee
 * tombe le premier jour d un trimestre civil (1er janvier, 1er
 * avril, 1er juillet, 1er octobre). Permet de declencher la
 * regeneration trimestrielle depuis un cron quotidien sans
 * dependre d une syntax cron complexe (Vercel Cron limite).
 */
export function isFirstDayOfQuarter(date: Date): boolean {
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  return d === 1 && (m === 0 || m === 3 || m === 6 || m === 9);
}

// ------------------------------------------------------------
// HELPERS INTERNES
// ------------------------------------------------------------

function indexBySlug(briefs: SectoralBrief[]): Map<string, SectoralBrief> {
  const out = new Map<string, SectoralBrief>();
  for (const b of briefs) {
    if (!b?.sector_slug) continue;
    out.set(b.sector_slug, b);
  }
  return out;
}

function readScore(
  dims: SectoralBriefDimensions | undefined,
  key: DimensionKey,
): number | null {
  if (!dims) return null;
  const dim = dims[key];
  if (!dim) return null;
  if (dim.data_missing) return null;
  if (typeof dim.score !== 'number' || Number.isNaN(dim.score)) return null;
  return dim.score;
}

function meanDelta(arr: Array<{ delta: number }>): number {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((acc, x) => acc + x.delta, 0);
  return sum / arr.length;
}

function roundTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}
