// ============================================================
// TimelineGraph - Graphe trajectoire sobre
// ------------------------------------------------------------
// Composant SVG inline minimaliste pour la timeline d un dossier.
// Entrée : liste de TrajectorySnapshot triée par date asc.
// Sortie : SVG ligne ocre brûlé qui monte ou descend selon
// l évolution du score global, points marqueurs sur chaque
// analyse, axes discrets.
//
// Aucune dépendance librairie chart : tout est calculé en pur SVG
// pour rester maîtrisable typographiquement. Les helpers de
// calcul de coordonnées sont exportés pour test déterministe.
//
// Edge cases gérés :
//  - 0 snapshot : retourne null (le caller affiche un placeholder)
//  - 1 snapshot : affiche un point seul au centre, pas de ligne
//  - 2 snapshots : segment direct
//  - N snapshots : polyline reliant les points dans l ordre
// ============================================================

'use client';

import type { TrajectorySnapshot } from '@/lib/engines/trajectory/types';

// ============================================================
// HELPERS DE COORDONNEES
// ============================================================

/**
 * Géométrie d un point projeté sur le canvas SVG. Coordonnées en
 * pixels relatives au viewBox du composant.
 */
export interface TimelinePoint {
  x: number;
  y: number;
  /** Score global du snapshot, conservé pour le tooltip et les
   *  tests d alignement. */
  score: number;
  /** Index dans la liste source, sert à retrouver le snapshot
   *  associé au point. */
  index: number;
}

/**
 * Paramètres de géométrie utilisés pour la projection. Valeurs
 * par défaut alignées sur le viewBox 480x140 du composant rendu.
 * Le padding est asymétrique : plus large à gauche pour laisser
 * la place au label de l axe Y (0/50/100), plus serré à droite
 * pour ne pas perdre d espace horizontal.
 */
export interface TimelineGeometry {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}

export const DEFAULT_GEOMETRY: TimelineGeometry = {
  width: 480,
  height: 140,
  paddingLeft: 36,
  paddingRight: 16,
  paddingTop: 18,
  paddingBottom: 26,
};

/**
 * Projette une liste de snapshots sur le canvas SVG. Renvoie un
 * tableau de points (x, y, score, index) prêts à être posés dans
 * une polyline ou en marqueurs.
 *
 * Cas particuliers :
 *  - 1 snapshot : on le pose au centre horizontal, à la verticale
 *    correspondant à son score. La ligne degenere en un seul point.
 *  - N snapshots : on étale linéairement sur l axe X selon l index
 *    dans la liste (pas selon la date réelle ; on ne fait pas de
 *    densité temporelle). Pour la densité temporelle réelle, il
 *    faudrait normaliser sur les timestamps, mais la lecture est
 *    moins claire dans le cas où deux analyses sont rapprochées.
 *    On garde l étalement par index pour la lisibilité.
 *
 * L axe Y est fixé sur la plage 0-100 pour rendre les graphes
 * comparables entre dossiers. Un score de 0 est tout en bas, 100
 * tout en haut.
 */
export function projectSnapshots(
  snapshots: TrajectorySnapshot[],
  geometry: TimelineGeometry = DEFAULT_GEOMETRY,
): TimelinePoint[] {
  if (snapshots.length === 0) return [];

  const innerWidth =
    geometry.width - geometry.paddingLeft - geometry.paddingRight;
  const innerHeight =
    geometry.height - geometry.paddingTop - geometry.paddingBottom;

  // Cas un seul snapshot : centré horizontalement
  if (snapshots.length === 1) {
    const s = snapshots[0];
    const score = clampScore(s.globalScore);
    return [
      {
        x: geometry.paddingLeft + innerWidth / 2,
        y: geometry.paddingTop + innerHeight * (1 - score / 100),
        score: s.globalScore,
        index: 0,
      },
    ];
  }

  // N >= 2 : étalement linéaire sur l axe X par index
  return snapshots.map((s, i) => {
    const ratio = i / (snapshots.length - 1);
    const score = clampScore(s.globalScore);
    return {
      x: geometry.paddingLeft + ratio * innerWidth,
      y: geometry.paddingTop + innerHeight * (1 - score / 100),
      score: s.globalScore,
      index: i,
    };
  });
}

/**
 * Clamp un score dans la plage [0, 100] pour éviter qu un score
 * aberrant (ex. 110 ou -5 issus d un payload bogué) ne pousse le
 * point hors viewBox.
 */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

/**
 * Construit la chaîne `points` d une polyline SVG depuis une
 * liste de TimelinePoint. Format `x1,y1 x2,y2 ...` attendu par
 * l attribut `points` d un <polyline>.
 */
export function buildPolylinePoints(points: TimelinePoint[]): string {
  return points
    .map((p) => `${roundCoord(p.x)},${roundCoord(p.y)}`)
    .join(' ');
}

function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Formate une date ISO en label compact pour l axe X. Format
 * `mai 26` ou `12 mai` selon la longueur disponible. Ce format
 * reste lisible dans une SVG étroite, c est ce qu on attend dans
 * la voix éditoriale Le Grand Continent.
 */
export function formatTickDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(2);
    return `${day} ${month} ${year}`;
  } catch {
    return '';
  }
}

// ============================================================
// COMPOSANT
// ============================================================

interface TimelineGraphProps {
  /** Liste de snapshots triée par date ascendante. Le composant
   *  ne re-trie pas : c est la responsabilité du caller. */
  snapshots: TrajectorySnapshot[];
  /** Hauteur du SVG en pixels. Largeur fluide via le conteneur
   *  parent (le SVG respecte preserveAspectRatio). */
  height?: number;
  /** Si true, affiche les labels de date sous chaque point.
   *  Désactivé par défaut sur la vue liste pour rester sobre,
   *  activé sur la vue drill-down. */
  showDateLabels?: boolean;
  /** Couleur de la ligne. Par défaut --ocre-brule (palette
   *  Le Grand Continent). */
  lineColor?: string;
  /** Aria-label pour l accessibilité. */
  ariaLabel?: string;
}

export function TimelineGraph({
  snapshots,
  height = 140,
  showDateLabels = false,
  lineColor = 'var(--ocre-brule)',
  ariaLabel,
}: TimelineGraphProps) {
  if (snapshots.length === 0) {
    return null;
  }

  // Ajuste la géométrie à la hauteur demandée tout en gardant le
  // ratio par défaut. Le width reste 480 en viewBox, le SVG est
  // responsive via preserveAspectRatio.
  const geometry: TimelineGeometry = {
    ...DEFAULT_GEOMETRY,
    height,
    paddingBottom: showDateLabels ? 26 : 14,
  };
  const points = projectSnapshots(snapshots, geometry);
  const polylinePoints = buildPolylinePoints(points);

  // Axes : ligne horizontale en bas du canvas, graduations Y à 0,
  // 50, 100 pour lecture rapide.
  const yAxisX = geometry.paddingLeft;
  const xAxisY = geometry.height - geometry.paddingBottom;
  const yTicks = [0, 50, 100];

  const label = ariaLabel ?? `Trajectoire sur ${snapshots.length} analyse${snapshots.length > 1 ? 's' : ''}`;

  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height={height}
      role="img"
      aria-label={label}
      style={{ display: 'block' }}
    >
      {/* Axe Y discret avec graduations 0/50/100 */}
      {yTicks.map((tick) => {
        const innerHeight = geometry.height - geometry.paddingTop - geometry.paddingBottom;
        const y = geometry.paddingTop + innerHeight * (1 - tick / 100);
        return (
          <g key={`y-${tick}`}>
            <line
              x1={yAxisX - 3}
              x2={geometry.width - geometry.paddingRight}
              y1={y}
              y2={y}
              stroke="var(--hairline)"
              strokeDasharray={tick === 0 || tick === 100 ? '0' : '2 4'}
              strokeWidth={tick === 0 || tick === 100 ? 1 : 0.8}
            />
            <text
              x={yAxisX - 8}
              y={y + 3}
              textAnchor="end"
              fontFamily="var(--sans)"
              fontSize="9"
              fill="var(--muted)"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Ligne et points */}
      {points.length >= 2 && (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {points.map((p) => (
        <g key={`pt-${p.index}`}>
          <circle
            cx={p.x}
            cy={p.y}
            r={2.6}
            fill="var(--paper)"
            stroke={lineColor}
            strokeWidth={1.4}
          />
          {showDateLabels && (
            <text
              x={p.x}
              y={xAxisY + 14}
              textAnchor="middle"
              fontFamily="var(--sans)"
              fontSize="9"
              fill="var(--muted)"
            >
              {formatTickDate(snapshots[p.index].analyzedAt)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
