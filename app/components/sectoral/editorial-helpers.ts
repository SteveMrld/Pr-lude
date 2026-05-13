// ============================================================
// PRELUDE - Helpers editoriaux des composants spider chart sectoriels
// ------------------------------------------------------------
// Fonctions deterministes consommees par SectoralSuperposition et
// SectoralTemporalComparison pour produire un paragraphe editorial
// sobre quand le payload backend ne fournit pas son propre texte.
// La doctrine prescrit que la superposition de deux fiches s
// accompagne d une lecture des convergences (ecart inferieur a dix
// points) et des divergences (ecart superieur a trente points), et
// que la comparaison temporelle commente les dimensions qui ont
// bouge significativement (delta superieur a dix points), en
// distinguant le rythme attendu du rythme inattendu.
//
// Voix editoriale : Le Grand Continent, phrases denses, pas de
// listes a puces, pas d em-dashes. Le composant React peut ecraser
// ce texte deterministe en fournissant son propre paragraphe via
// la prop editorial : c est le canal LLM quand il existe.
// ============================================================

import type { SectoralBrief } from '@/lib/engines/sectoral-intelligence/types';
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  type DimensionKey,
} from '@/lib/engines/sectoral-intelligence/types';

// ------------------------------------------------------------
// SEUILS DOCTRINAUX
// ------------------------------------------------------------
export const CONVERGENCE_THRESHOLD = 10; // ecart inferieur ou egal a 10 = convergence
export const DIVERGENCE_THRESHOLD = 30; // ecart superieur ou egal a 30 = divergence
export const TEMPORAL_DELTA_THRESHOLD = 10; // bouge significatif

// ------------------------------------------------------------
// FORMATAGE
// ------------------------------------------------------------
export function formatSectoralDate(iso: string | undefined | null): string {
  if (!iso) return 'date inconnue';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ------------------------------------------------------------
// LECTURE EDITORIALE DE LA SUPERPOSITION (deux secteurs)
// ------------------------------------------------------------
// Compare dimension par dimension les scores des deux fiches.
// Retourne un paragraphe sobre qui nomme les axes de convergence
// et les axes de divergence. Si tout est convergent ou tout est
// divergent, le texte adapte sa lecture en consequence.
//
// Cas data_missing : la dimension est exclue de la lecture
// editoriale (pas de comparaison possible quand l une au moins
// des deux fiches signale donnee insuffisante).
// ------------------------------------------------------------
export interface DimensionDiff {
  key: DimensionKey;
  label: string;
  primaryScore: number | null;
  secondaryScore: number | null;
  delta: number | null;
}

export function computeDimensionDiffs(
  primary: SectoralBrief,
  secondary: SectoralBrief,
): DimensionDiff[] {
  return DIMENSION_KEYS.map((key) => {
    const p = primary.dimensions[key]?.score;
    const s = secondary.dimensions[key]?.score;
    const primaryScore = typeof p === 'number' ? p : null;
    const secondaryScore = typeof s === 'number' ? s : null;
    const delta =
      primaryScore !== null && secondaryScore !== null
        ? Math.abs(primaryScore - secondaryScore)
        : null;
    return {
      key,
      label: DIMENSION_LABELS[key],
      primaryScore,
      secondaryScore,
      delta,
    };
  });
}

export interface OverlayEditorialOptions {
  primaryLabel: string;
  secondaryLabel: string;
}

export function buildOverlayEditorial(
  primary: SectoralBrief,
  secondary: SectoralBrief,
  options: OverlayEditorialOptions,
): string {
  const diffs = computeDimensionDiffs(primary, secondary).filter((d) => d.delta !== null);
  if (diffs.length === 0) {
    return `La superposition entre ${options.primaryLabel} et ${options.secondaryLabel} reste illisible : trop de dimensions sortent en donnee insuffisante dans l une ou l autre fiche pour que la comparaison soit honnete.`;
  }

  const convergences = diffs.filter((d) => (d.delta ?? 0) <= CONVERGENCE_THRESHOLD);
  const divergences = diffs.filter((d) => (d.delta ?? 0) >= DIVERGENCE_THRESHOLD);

  const parts: string[] = [];

  if (convergences.length > 0) {
    const noms = formatList(convergences.map((d) => d.label.toLowerCase()));
    parts.push(
      `Les fiches ${options.primaryLabel} et ${options.secondaryLabel} convergent sur ${noms}, ou les ecarts restent inferieurs a dix points et signalent des dynamiques sectorielles communes a l echelle europeenne.`,
    );
  }

  if (divergences.length > 0) {
    const lignes = divergences.map((d) => {
      const dir =
        (d.primaryScore ?? 0) > (d.secondaryScore ?? 0)
          ? options.primaryLabel
          : options.secondaryLabel;
      return `${d.label.toLowerCase()} tire ${Math.round(d.delta ?? 0)} points en faveur de ${dir}`;
    });
    parts.push(
      `Les divergences structurelles portent sur ${formatList(lignes)}. Cette amplitude au-dela de trente points indique des regimes sectoriels distincts qu un dossier transverse devrait articuler explicitement plutot que diluer.`,
    );
  }

  if (parts.length === 0) {
    parts.push(
      `Entre ${options.primaryLabel} et ${options.secondaryLabel} la lecture est moyenne : aucune dimension ne resserre les deux fiches a moins de dix points, mais aucune non plus ne les ecarte au-dela de trente. Le partner garde l autonomie de l interpretation par axe.`,
    );
  }

  return parts.join(' ');
}

// ------------------------------------------------------------
// LECTURE EDITORIALE DE LA COMPARAISON TEMPORELLE
// ------------------------------------------------------------
// Compare la fiche actuelle a sa version T-12 mois (ou autre
// horizon historique). Identifie les dimensions qui ont bouge
// significativement (delta >= 10 points). Distingue les
// evolutions naturelles (rythme attendu du secteur, typiquement
// vulnerabilite narrative qui glisse avec le cycle) des
// evolutions surprenantes (cyclicite ou intensite capitalistique
// qui sont reputees stables sur un horizon court).
// ------------------------------------------------------------

// Dimensions reputees stables a horizon douze mois. Une variation
// significative sur ces axes est une evolution surprenante.
const STABLE_DIMENSIONS: ReadonlySet<DimensionKey> = new Set<DimensionKey>([
  'intensite_capitalistique',
  'cyclicite_macroeconomique',
]);

// Dimensions reputees mouvantes a horizon douze mois. Variation
// attendue, le moteur la note sans s en alarmer.
const VOLATILE_DIMENSIONS: ReadonlySet<DimensionKey> = new Set<DimensionKey>([
  'vulnerabilite_narrative_sectorielle',
  'velocite_technologique',
  'pression_reglementaire',
]);

export interface TemporalEditorialOptions {
  sectorLabel: string;
}

export interface TemporalMove {
  key: DimensionKey;
  label: string;
  currentScore: number | null;
  previousScore: number | null;
  delta: number; // signe : positif = hausse du score
  expected: boolean;
}

export function computeTemporalMoves(
  current: SectoralBrief,
  previous: SectoralBrief,
): TemporalMove[] {
  return DIMENSION_KEYS.map((key) => {
    const curr = current.dimensions[key]?.score;
    const prev = previous.dimensions[key]?.score;
    const currentScore = typeof curr === 'number' ? curr : null;
    const previousScore = typeof prev === 'number' ? prev : null;
    if (currentScore === null || previousScore === null) {
      return {
        key,
        label: DIMENSION_LABELS[key],
        currentScore,
        previousScore,
        delta: 0,
        expected: !STABLE_DIMENSIONS.has(key),
      } satisfies TemporalMove;
    }
    return {
      key,
      label: DIMENSION_LABELS[key],
      currentScore,
      previousScore,
      delta: currentScore - previousScore,
      expected: VOLATILE_DIMENSIONS.has(key) || !STABLE_DIMENSIONS.has(key),
    } satisfies TemporalMove;
  });
}

export function buildTemporalEditorial(
  current: SectoralBrief,
  previous: SectoralBrief,
  options: TemporalEditorialOptions,
): string {
  const allMoves = computeTemporalMoves(current, previous);
  const significant = allMoves.filter(
    (m) =>
      m.currentScore !== null &&
      m.previousScore !== null &&
      Math.abs(m.delta) >= TEMPORAL_DELTA_THRESHOLD,
  );

  if (significant.length === 0) {
    return `La fiche ${options.sectorLabel} est stable entre les deux generations comparees : aucune dimension ne bouge de plus de dix points. La lecture sectorielle peut etre conservee a l identique sur les dossiers en cours d instruction.`;
  }

  const expected = significant.filter((m) => m.expected);
  const surprising = significant.filter((m) => !m.expected);

  const parts: string[] = [];

  if (expected.length > 0) {
    parts.push(
      `Evolutions attendues sur ${options.sectorLabel} : ${formatMoves(expected)}. Ces dimensions sont par construction mouvantes a horizon douze mois, leur variation traduit le rythme propre du secteur.`,
    );
  }

  if (surprising.length > 0) {
    parts.push(
      `Evolutions inattendues : ${formatMoves(surprising)}. Ces dimensions sont reputees stables a horizon court, une variation au-dela de dix points appelle un examen specifique (cycle macro, bascule capex, restructuration sectorielle).`,
    );
  }

  return parts.join(' ');
}

// ------------------------------------------------------------
// HELPERS INTERNES
// ------------------------------------------------------------

function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} et ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

function formatMoves(moves: TemporalMove[]): string {
  return formatList(
    moves.map((m) => {
      const dir = m.delta >= 0 ? 'hausse' : 'baisse';
      return `${m.label.toLowerCase()} en ${dir} de ${Math.abs(Math.round(m.delta))} points`;
    }),
  );
}
