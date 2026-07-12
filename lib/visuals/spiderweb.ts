// ============================================================
// PRELUDE - Module visuel toile d araignee
// ------------------------------------------------------------
// Ce module isole les helpers du langage visuel spider web
// commun a trois usages prioritaires (fiche sectorielle isolee,
// superposition de deux secteurs, comparaison temporelle T versus
// T-12 mois) et a deux usages futurs anticipes (cartographie
// statique des quatorze moteurs Prelude, animation pendant
// l analyse). La sobriete est doctrinale : palette ocre brule
// sur creme, lignes fines, interpolation strictement lineaire,
// aucun effet decoratif gratuit.
//
// Regles structurelles :
//
//   - Le titre et le sous-titre ne sont JAMAIS emis dans le SVG.
//     Ils appartiennent a la caption semantique du composant hote,
//     posee au-dessus du radar. Le SVG ne rend que la geometrie.
//   - Les libellés d axes sont dimensionnes et decoupes pour tenir
//     dans le viewBox : la marge est calculee a partir du plus long
//     libellé et l alignement suit le quadrant du sommet.
//   - Un axe sans donnee est neutralise a mi-echelle avec un style
//     distinct (pointille grise, marque n/e). Il est exclu du calcul
//     d aire et ne penalise pas le dossier.
//
// Toute extension future passe par ce module. Les composants
// React qui consomment du SVG inline doivent appeler les
// fonctions exportees plutot que de redefinir les constantes
// de palette ou la geometrie polygonale, sous peine de
// divergences visuelles entre les surfaces.
// ============================================================

// ------------------------------------------------------------
// PALETTE
// Cinq couleurs admises dans le langage visuel, pas une de plus.
// Les etats (sain, attention, alerte, drapeau rouge) ne se
// codent pas par couleur mais par densite de trace ou opacite,
// pour preserver la coherence chromatique.
// ------------------------------------------------------------
export const PALETTE = {
  cream: '#F5EFE6',
  ocreBrule: '#9C5A2A',
  ocreEteint: '#C8A988',
  sepia: '#6B5841',
  encre: '#2B2B2B',
} as const;

export type PaletteKey = keyof typeof PALETTE;

// ------------------------------------------------------------
// TYPOGRAPHIE
// Serif pour les elements nommes que l oeil lit en bloc,
// grotesque condensee pour les chiffres que l oeil scanne.
// Les choix de polices precises sont laisses aux feuilles de
// style globales du projet ; ce module n encode que les piles
// de repli et les tailles de reference.
// ------------------------------------------------------------
export const TYPOGRAPHY = {
  serif: '"Source Serif Pro", "Lyon Display", "Tiempos Text", Georgia, serif',
  grotesqueCondensed: '"Inter Condensed", "Söhne Mono Condensed", "Roboto Condensed", sans-serif',
  axisLabelSize: 11,
  graduationSize: 9,
  titleSize: 18,
  subtitleSize: 12,
} as const;

// ------------------------------------------------------------
// TYPES PUBLICS
// ------------------------------------------------------------
export interface DimensionData {
  // Libelle affiche sur l axe (ex : "Intensite capitalistique").
  label: string;
  // Score sur l echelle 0 a 100. null = donnee manquante : la
  // branche est neutralisee a mi-echelle avec la marque n/e et
  // exclue du calcul d aire du polygone principal.
  score: number | null;
  // Confidence facultative, sert au rendu degrade.
  confidence?: 'high' | 'medium' | 'low' | 'data_missing';
}

export interface SpiderChartData {
  dimensions: DimensionData[];
  // Titre et sous-titre : conserves dans l API pour compatibilite
  // et pour peupler l attribut aria-label du SVG, mais JAMAIS
  // emis comme texte visible dans le SVG. L emission textuelle
  // appartient a la caption du composant hote.
  title?: string;
  subtitle?: string;
}

export type SpiderChartMode = 'single' | 'overlay' | 'temporal';

export interface SpiderChartOptions {
  // Cote du carre englobant en pixels. Par defaut 480.
  size?: number;
  // Mode de rendu. 'single' = fiche isolee, 'overlay' =
  // superposition de deux secteurs, 'temporal' = comparaison
  // T vs T-12 mois (le secondaire est rendu en pointille).
  mode?: SpiderChartMode;
  // Donnees secondaires pour overlay et temporal. Doit etre
  // homogene en nombre de dimensions avec data.dimensions.
  secondary?: SpiderChartData;
  // Libelles de legende. Optionnels.
  primaryLabel?: string;
  secondaryLabel?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export type TextAnchor = 'start' | 'middle' | 'end';
export type DominantBaseline = 'auto' | 'middle' | 'hanging';

export interface LabelAlignment {
  textAnchor: TextAnchor;
  dominantBaseline: DominantBaseline;
}

// ------------------------------------------------------------
// HELPERS GEOMETRIQUES
// ------------------------------------------------------------

// Pour un polygone regulier a n cotes, le premier sommet est
// place sur la verticale (angle -PI/2 en coordonnees
// trigonometriques standard, soit le nord en repere SVG). Les
// autres sommets sont distribues uniformement en sens horaire,
// ce qui permet a un octogone d avoir un sommet au nord et un
// sommet au sud comme reperes cardinaux stables.
export function regularPolygonVertices(
  n: number,
  radius: number,
  center: Point2D,
): Point2D[] {
  if (n < 3) {
    throw new Error(`regularPolygonVertices: n doit etre superieur ou egal a 3, recu ${n}`);
  }
  const startAngle = -Math.PI / 2;
  const step = (2 * Math.PI) / n;
  const vertices: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * step;
    vertices.push(radialToCartesian(radius, angle, center));
  }
  return vertices;
}

// Conversion d un couple (rayon, angle radian) vers cartesien.
// Le repere SVG a son origine en haut a gauche et l axe Y
// descendant, mais on travaille avec un centre passe en argument
// donc la conversion reste trigonometrique standard.
export function radialToCartesian(
  radius: number,
  angle: number,
  center: Point2D,
): Point2D {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };
}

// Alignement des labels d axes selon la position cardinale du
// sommet correspondant. Un sommet au nord est centre et descend
// au-dessus de lui ; un sommet a l est est ancre a gauche du
// label (le label part vers la droite) ; etc. La tolerance sur
// les axes cardinaux est de 0.01 radian pour absorber les
// erreurs de virgule flottante.
export function labelAlignmentForAngle(angle: number): LabelAlignment {
  // Normalise l angle dans [-PI, PI] pour simplifier les
  // comparaisons cardinales.
  const normalized = Math.atan2(Math.sin(angle), Math.cos(angle));
  const eps = 0.01;

  // Nord (angle = -PI/2)
  if (Math.abs(normalized + Math.PI / 2) < eps) {
    return { textAnchor: 'middle', dominantBaseline: 'auto' };
  }
  // Sud (angle = PI/2)
  if (Math.abs(normalized - Math.PI / 2) < eps) {
    return { textAnchor: 'middle', dominantBaseline: 'hanging' };
  }
  // Est (angle = 0)
  if (Math.abs(normalized) < eps) {
    return { textAnchor: 'start', dominantBaseline: 'middle' };
  }
  // Ouest (angle = PI ou -PI)
  if (Math.abs(Math.abs(normalized) - Math.PI) < eps) {
    return { textAnchor: 'end', dominantBaseline: 'middle' };
  }
  // Quadrants
  if (normalized > -Math.PI / 2 && normalized < Math.PI / 2) {
    // Hemisphere est : labels ancres a gauche du texte.
    return { textAnchor: 'start', dominantBaseline: 'middle' };
  }
  // Hemisphere ouest : labels ancres a droite du texte.
  return { textAnchor: 'end', dominantBaseline: 'middle' };
}

// Calcule la position d un label d axe a partir de la position
// du sommet correspondant. Le label est decale radialement vers
// l exterieur de `padding` pixels pour ne pas chevaucher le
// trace du polygone.
export function axisLabelPosition(
  vertex: Point2D,
  center: Point2D,
  padding: number,
): Point2D {
  const dx = vertex.x - center.x;
  const dy = vertex.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) {
    return { ...vertex };
  }
  const ratio = (distance + padding) / distance;
  return {
    x: center.x + dx * ratio,
    y: center.y + dy * ratio,
  };
}

// Calcule la position du point de mesure sur un axe etant donne
// un score 0..100. Si score est null, retourne null : le point
// ne sera pas trace et la branche sera marquee donnee manquante.
export function measurePointOnAxis(
  vertex: Point2D,
  center: Point2D,
  score: number | null,
): Point2D | null {
  if (score === null) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, score));
  const ratio = clamped / 100;
  return {
    x: center.x + (vertex.x - center.x) * ratio,
    y: center.y + (vertex.y - center.y) * ratio,
  };
}

// ------------------------------------------------------------
// HELPERS SVG INTERNES
// ------------------------------------------------------------

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatNumber(value: number): string {
  // Trois decimales suffisent pour la geometrie SVG et evitent
  // les chaines a rallonge type 123.456789012345.
  return Number.isInteger(value) ? value.toString() : value.toFixed(3);
}

function pointsAttribute(points: Point2D[]): string {
  return points
    .map((p) => `${formatNumber(p.x)},${formatNumber(p.y)}`)
    .join(' ');
}

// ------------------------------------------------------------
// TAILLE DE POLICE ADAPTATIVE
// ------------------------------------------------------------
// La police des libelles d axes s ajuste a la taille du canvas
// pour rester lisible sans deborder. Formule empirique calibree
// sur le mini chart 150 px et la fiche pleine 480 px.
function computeAxisFontSize(size: number): number {
  // 150 -> 7, 240 -> 9, 320 -> 10, 480 -> 11, 720 -> 11
  const target = Math.round(size / 44);
  return Math.max(7, Math.min(11, target));
}

// Approximation empirique de la largeur d un caractere serif a
// la taille de police donnee. Suffisant pour calibrer les marges
// et decider d un wrap ; pas de precision pixel-parfaite requise.
function estimateCharWidth(fontSize: number): number {
  return fontSize * 0.55;
}

// ------------------------------------------------------------
// WRAP ET TRONCATURE DES LIBELLES
// ------------------------------------------------------------
// Un libellé qui deborde la marge disponible est d abord decoupe
// sur deux lignes au boundary d espace le plus equilibre, puis
// tronque avec ellipsis si le decoupage n a pas suffi. Le libellé
// integral reste accessible via le <title> enfant du <text>.
export interface WrappedLabel {
  lines: string[];
  truncated: boolean;
}

export function wrapLabelToFit(
  label: string,
  maxCharsPerLine: number,
): WrappedLabel {
  if (maxCharsPerLine < 3) {
    return { lines: [label.slice(0, Math.max(1, maxCharsPerLine))], truncated: true };
  }
  if (label.length <= maxCharsPerLine) {
    return { lines: [label], truncated: false };
  }
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return {
      lines: [label.slice(0, maxCharsPerLine - 1) + '…'],
      truncated: true,
    };
  }
  // Cherche le point de coupure qui equilibre au mieux deux
  // lignes tenant chacune sous maxCharsPerLine.
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    if (l1.length <= maxCharsPerLine && l2.length <= maxCharsPerLine) {
      const diff = Math.abs(l1.length - l2.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
  }
  if (bestIdx > 0) {
    return {
      lines: [
        words.slice(0, bestIdx).join(' '),
        words.slice(bestIdx).join(' '),
      ],
      truncated: false,
    };
  }
  // Aucun decoupage propre : tronque la deuxieme ligne.
  // Cherche le premier mot qui, avec le premier, tient sous la
  // limite ; sinon tronque le premier mot.
  const first = words[0];
  const rest = words.slice(1).join(' ');
  const l1 = first.length <= maxCharsPerLine ? first : first.slice(0, maxCharsPerLine - 1) + '…';
  const l2 = rest.length <= maxCharsPerLine
    ? rest
    : rest.slice(0, Math.max(0, maxCharsPerLine - 1)) + '…';
  return { lines: [l1, l2], truncated: true };
}

interface AxisGeometry {
  vertex: Point2D;
  labelPosition: Point2D;
  alignment: LabelAlignment;
  angle: number;
  dimension: DimensionData;
  // Nombre max de caracteres par ligne calcule a partir de la
  // marge libre entre le labelPosition et le bord du viewBox le
  // plus proche dans la direction du texte.
  maxCharsPerLine: number;
  fontSize: number;
}

// ------------------------------------------------------------
// GEOMETRIE : radius adaptatif et calcul des marges labels
// ------------------------------------------------------------
// Le rayon du polygone est fixe a une fraction reservee du canvas
// (60% du demi-cote). Le reste (~40%) est reserve aux libellés,
// avec padding radial et wrap sur deux lignes si necessaire.
function computePolygonRadius(size: number): number {
  return Math.round((size / 2) * 0.6);
}

function computeLabelPadding(size: number): number {
  return Math.max(6, Math.round(size / 40));
}

function computeMaxCharsForAxis(
  angle: number,
  labelPosition: Point2D,
  alignment: LabelAlignment,
  size: number,
  fontSize: number,
  safeMargin: number,
): number {
  const charWidth = estimateCharWidth(fontSize);
  // Distance disponible du labelPosition jusqu au bord du viewBox
  // dans la direction ou le texte s etend (fonction de textAnchor).
  const dxRightAvail = size - safeMargin - labelPosition.x;
  const dxLeftAvail = labelPosition.x - safeMargin;
  const dyTopAvail = labelPosition.y - safeMargin;
  const dyBottomAvail = size - safeMargin - labelPosition.y;

  let horizontalBudget: number;
  if (alignment.textAnchor === 'start') {
    horizontalBudget = dxRightAvail;
  } else if (alignment.textAnchor === 'end') {
    horizontalBudget = dxLeftAvail;
  } else {
    // middle : le texte s etend a droite ET a gauche du labelPos.
    horizontalBudget = 2 * Math.min(dxRightAvail, dxLeftAvail);
  }

  // Contrainte verticale : le libelle peut etre wrap sur deux
  // lignes. Verifier qu il reste au moins 2 * fontSize dans la
  // direction ou le texte s empile.
  const verticalStackSpace = alignment.dominantBaseline === 'hanging'
    ? dyBottomAvail
    : alignment.dominantBaseline === 'auto'
      ? dyTopAvail
      : Math.min(dyTopAvail, dyBottomAvail) * 2;
  const canWrapTwoLines = verticalStackSpace >= 2 * fontSize;

  // On accepte deux lignes : multiplier le budget effectif par 2.
  const effectiveBudget = canWrapTwoLines ? horizontalBudget * 2 : horizontalBudget;
  void angle; // conserve la signature pour extensions futures
  return Math.max(3, Math.floor(effectiveBudget / charWidth));
}

function buildAxes(
  dimensions: DimensionData[],
  center: Point2D,
  radius: number,
  labelPadding: number,
  size: number,
  fontSize: number,
): AxisGeometry[] {
  const n = dimensions.length;
  const startAngle = -Math.PI / 2;
  const step = (2 * Math.PI) / n;
  const safeMargin = 4;
  const axes: AxisGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * step;
    const vertex = radialToCartesian(radius, angle, center);
    const labelPos = axisLabelPosition(vertex, center, labelPadding);
    const alignment = labelAlignmentForAngle(angle);
    const maxChars = computeMaxCharsForAxis(
      angle,
      labelPos,
      alignment,
      size,
      fontSize,
      safeMargin,
    );
    axes.push({
      vertex,
      labelPosition: labelPos,
      alignment,
      angle,
      dimension: dimensions[i],
      maxCharsPerLine: maxChars,
      fontSize,
    });
  }
  return axes;
}

function renderConcentricRings(center: Point2D, radius: number): string {
  // Cercles concentriques aux quart de l axe. Le langage visuel
  // prescrit du pointille sepia opacite 0.25.
  const fractions = [0.25, 0.5, 0.75, 1];
  return fractions
    .map((f) => {
      const r = radius * f;
      return (
        `<circle cx="${formatNumber(center.x)}" cy="${formatNumber(center.y)}" ` +
        `r="${formatNumber(r)}" fill="none" stroke="${PALETTE.sepia}" ` +
        `stroke-width="0.5" stroke-opacity="0.25" stroke-dasharray="2 3" />`
      );
    })
    .join('');
}

function renderRadialAxes(axes: AxisGeometry[], center: Point2D): string {
  // Lignes radiales du centre vers chaque sommet. Trait plein
  // sepia opacite 0.3.
  return axes
    .map(
      (a) =>
        `<line x1="${formatNumber(center.x)}" y1="${formatNumber(center.y)}" ` +
        `x2="${formatNumber(a.vertex.x)}" y2="${formatNumber(a.vertex.y)}" ` +
        `stroke="${PALETTE.sepia}" stroke-width="0.5" stroke-opacity="0.3" />`,
    )
    .join('');
}

function renderAxisLabels(axes: AxisGeometry[]): string {
  return axes
    .map((a) => {
      const { labelPosition, alignment, dimension, maxCharsPerLine, fontSize } = a;
      const wrapped = wrapLabelToFit(dimension.label, maxCharsPerLine);
      const lineHeight = fontSize * 1.1;
      // Ancrage vertical du bloc multi-ligne : on centre la pile
      // sur labelPosition en fonction de dominantBaseline.
      let firstLineDy = 0;
      if (wrapped.lines.length > 1) {
        if (alignment.dominantBaseline === 'middle') {
          // Empile symetriquement autour du labelPosition.
          firstLineDy = -((wrapped.lines.length - 1) * lineHeight) / 2;
        } else if (alignment.dominantBaseline === 'auto') {
          // Text sits above labelPosition. Recule d autant de
          // lignes qu il y en a au dessus de la ligne de base.
          firstLineDy = -(wrapped.lines.length - 1) * lineHeight;
        }
        // hanging : premiere ligne au labelPosition, lignes
        // suivantes descendent. Rien a faire.
      }

      const tspans = wrapped.lines
        .map((line, idx) => {
          const dy = idx === 0 ? firstLineDy : lineHeight;
          const dyAttr = dy === 0 ? '' : ` dy="${formatNumber(dy)}"`;
          return `<tspan x="${formatNumber(labelPosition.x)}"${dyAttr}>${escapeXml(line)}</tspan>`;
        })
        .join('');

      const safeFullLabel = escapeXml(dimension.label);
      return (
        `<text x="${formatNumber(labelPosition.x)}" y="${formatNumber(labelPosition.y)}" ` +
        `text-anchor="${alignment.textAnchor}" ` +
        `dominant-baseline="${alignment.dominantBaseline}" ` +
        `font-family='${TYPOGRAPHY.serif}' font-size="${fontSize}" ` +
        `fill="${PALETTE.encre}">` +
        `<title>${safeFullLabel}</title>` +
        tspans +
        `</text>`
      );
    })
    .join('');
}

interface PolygonStyle {
  stroke: string;
  fillOpacity: number;
  strokeOpacity: number;
  strokeWidth: number;
  dashed: boolean;
}

function renderPolygon(
  axes: AxisGeometry[],
  data: DimensionData[],
  center: Point2D,
  style: PolygonStyle,
): string {
  // Construit le polygone d aire. Les axes data_missing sont
  // exclus du calcul d aire (doctrine : neutre, pas zero). Le
  // polygone est trace comme s ils n existaient pas, les axes
  // presents forment un polygone reduit. Sur les axes manquants,
  // un marqueur separe a mi-echelle est rendu par ailleurs.
  const presentIndices: number[] = [];
  const presentPoints: Point2D[] = [];
  for (let i = 0; i < axes.length; i++) {
    const score = data[i]?.score ?? null;
    if (score === null) continue;
    const pt = measurePointOnAxis(axes[i].vertex, center, score);
    if (pt) {
      presentIndices.push(i);
      presentPoints.push(pt);
    }
  }

  if (presentPoints.length < 3) {
    // Trop peu de points presents pour former un polygone d aire.
    // On rend les points isoles uniquement.
    let svg = '';
    for (const p of presentPoints) {
      svg += (
        `<circle cx="${formatNumber(p.x)}" cy="${formatNumber(p.y)}" r="3" ` +
        `fill="${style.stroke}" />`
      );
    }
    return svg;
  }

  const dasharray = style.dashed ? ' stroke-dasharray="4 3"' : '';
  const polygonPoints = pointsAttribute(presentPoints);

  let svg = (
    `<polygon points="${polygonPoints}" ` +
    `fill="${style.stroke}" fill-opacity="${style.fillOpacity}" ` +
    `stroke="${style.stroke}" stroke-width="${style.strokeWidth}" ` +
    `stroke-opacity="${style.strokeOpacity}"${dasharray} />`
  );

  // Points de mesure aux sommets pleins.
  for (const p of presentPoints) {
    svg += (
      `<circle cx="${formatNumber(p.x)}" cy="${formatNumber(p.y)}" r="3" ` +
      `fill="${style.stroke}" />`
    );
  }

  return svg;
}

// ------------------------------------------------------------
// RENDU DES AXES NEUTRALISES (data_missing)
// ------------------------------------------------------------
// Sur les axes ou la donnee est absente, on trace :
//   - un segment pointille grise du centre au point mi-echelle
//   - un cercle grise vide a la mi-echelle
//   - une marque "n/e" (non evaluable) posee pres du sommet
// L axe n est pas inclus dans le polygone d aire, ce qui respecte
// la doctrine absent egale suivi pas penalite.
function renderNeutralAxes(
  axes: AxisGeometry[],
  data: DimensionData[],
  center: Point2D,
): string {
  let svg = '';
  for (let i = 0; i < axes.length; i++) {
    const score = data[i]?.score ?? null;
    if (score !== null) continue;
    const axis = axes[i];
    const midPoint = measurePointOnAxis(axis.vertex, center, 50);
    if (!midPoint) continue;

    // Segment pointille centre -> mi-echelle.
    svg += (
      `<line x1="${formatNumber(center.x)}" y1="${formatNumber(center.y)}" ` +
      `x2="${formatNumber(midPoint.x)}" y2="${formatNumber(midPoint.y)}" ` +
      `stroke="${PALETTE.sepia}" stroke-width="1" stroke-opacity="0.5" ` +
      `stroke-dasharray="1 4" />`
    );

    // Cercle vide grise a la mi-echelle.
    svg += (
      `<circle cx="${formatNumber(midPoint.x)}" cy="${formatNumber(midPoint.y)}" r="3" ` +
      `fill="${PALETTE.cream}" stroke="${PALETTE.sepia}" stroke-width="1" ` +
      `stroke-opacity="0.6" />`
    );

    // Marque "n/e" pres du sommet (entre mi-echelle et sommet).
    const marker = measurePointOnAxis(axis.vertex, center, 72);
    if (marker) {
      svg += (
        `<text x="${formatNumber(marker.x)}" y="${formatNumber(marker.y)}" ` +
        `text-anchor="middle" dominant-baseline="middle" ` +
        `font-family='${TYPOGRAPHY.grotesqueCondensed}' ` +
        `font-size="${TYPOGRAPHY.graduationSize}" ` +
        `fill="${PALETTE.sepia}" fill-opacity="0.7">n/e</text>`
      );
    }
  }
  return svg;
}

function renderGraduations(center: Point2D, radius: number): string {
  // Les graduations chiffrees 25, 50, 75, 100 sont posees sur
  // l axe vertical nord, en grotesque condensee, opacite mesuree.
  const fractions = [0.25, 0.5, 0.75, 1];
  return fractions
    .map((f) => {
      const y = center.y - radius * f;
      const value = Math.round(f * 100);
      return (
        `<text x="${formatNumber(center.x + 4)}" y="${formatNumber(y)}" ` +
        `text-anchor="start" dominant-baseline="middle" ` +
        `font-family='${TYPOGRAPHY.grotesqueCondensed}' ` +
        `font-size="${TYPOGRAPHY.graduationSize}" ` +
        `fill="${PALETTE.sepia}" fill-opacity="0.6">${value}</text>`
      );
    })
    .join('');
}

function renderLegend(
  primaryLabel: string | undefined,
  secondaryLabel: string | undefined,
  size: number,
  secondaryDashed: boolean,
): string {
  if (!primaryLabel && !secondaryLabel) return '';
  const baseY = size - 24;
  const baseX = size - 16;
  let svg = '';
  const items: Array<{ label: string; color: string; dashed: boolean }> = [];
  if (primaryLabel) items.push({ label: primaryLabel, color: PALETTE.ocreBrule, dashed: false });
  if (secondaryLabel) {
    items.push({
      label: secondaryLabel,
      color: secondaryDashed ? PALETTE.ocreBrule : PALETTE.ocreEteint,
      dashed: secondaryDashed,
    });
  }
  items.forEach((item, idx) => {
    const y = baseY + idx * 16;
    const swatchX = baseX - 80;
    const dasharray = item.dashed ? ' stroke-dasharray="4 3"' : '';
    svg += (
      `<line x1="${formatNumber(swatchX)}" y1="${formatNumber(y)}" ` +
      `x2="${formatNumber(swatchX + 14)}" y2="${formatNumber(y)}" ` +
      `stroke="${item.color}" stroke-width="2"${dasharray} />`
    );
    svg += (
      `<text x="${formatNumber(swatchX + 20)}" y="${formatNumber(y)}" ` +
      `text-anchor="start" dominant-baseline="middle" ` +
      `font-family='${TYPOGRAPHY.grotesqueCondensed}' ` +
      `font-size="${TYPOGRAPHY.subtitleSize}" ` +
      `fill="${PALETTE.encre}">${escapeXml(item.label)}</text>`
    );
  });
  return svg;
}

// ------------------------------------------------------------
// API PUBLIQUE : renderSpiderChart
// ------------------------------------------------------------
// Retourne une chaine SVG complete, inline, sans dependance
// externe. Le SVG produit est embarquable tel quel dans une
// page web ou dans la generation PDF de la note d instruction.
//
// Regle non negociable : le SVG ne contient PAS de titre ni de
// sous-titre visibles. La caption editoriale est rendue par le
// composant hote au-dessus du radar. data.title alimente
// uniquement l attribut aria-label pour l accessibilite.
//
// Le parametre data porte les dimensions dans l ordre attendu
// du polygone (rotation calee sur la verticale, premier sommet
// au nord). En mode 'overlay' ou 'temporal', le parametre
// options.secondary doit etre homogene en nombre de dimensions
// avec data.dimensions, sans quoi le rendu echoue.
export function renderSpiderChart(
  data: SpiderChartData,
  options: SpiderChartOptions = {},
): string {
  const size = options.size ?? 480;
  const mode = options.mode ?? 'single';
  const n = data.dimensions.length;

  if (n < 3) {
    throw new Error(
      `renderSpiderChart: au moins trois dimensions sont requises, recu ${n}`,
    );
  }

  if (mode !== 'single') {
    if (!options.secondary) {
      throw new Error(
        `renderSpiderChart: mode '${mode}' requiert options.secondary`,
      );
    }
    if (options.secondary.dimensions.length !== n) {
      throw new Error(
        `renderSpiderChart: les donnees secondaires doivent avoir ${n} dimensions, recu ${options.secondary.dimensions.length}`,
      );
    }
  }

  const center: Point2D = { x: size / 2, y: size / 2 };
  const radius = computePolygonRadius(size);
  const labelPadding = computeLabelPadding(size);
  const fontSize = computeAxisFontSize(size);

  const axes = buildAxes(data.dimensions, center, radius, labelPadding, size, fontSize);

  let body = '';
  // Fond creme pour garantir le rendu hors-contexte (note PDF,
  // image isolee). En contexte applicatif le fond peut etre
  // ecrase par un wrapper, mais l autonomie est preservee.
  body += `<rect x="0" y="0" width="${size}" height="${size}" fill="${PALETTE.cream}" />`;

  body += renderConcentricRings(center, radius);
  body += renderRadialAxes(axes, center);
  body += renderGraduations(center, radius);
  body += renderAxisLabels(axes);

  // Marqueurs neutres pour les axes data_missing du polygone
  // primaire. Le secondaire n en a pas besoin : les fiches
  // sectorielles secondaires ne sont trace que si toutes les
  // dimensions sont presentes.
  body += renderNeutralAxes(axes, data.dimensions, center);

  // Le polygone secondaire (si present) se dessine d abord pour
  // que le primaire reste lisible au-dessus.
  if (options.secondary) {
    const secondaryDashed = mode === 'temporal';
    const secondaryStyle: PolygonStyle = {
      stroke: secondaryDashed ? PALETTE.ocreBrule : PALETTE.ocreEteint,
      fillOpacity: 0.08,
      strokeOpacity: secondaryDashed ? 0.6 : 0.85,
      strokeWidth: 1.5,
      dashed: secondaryDashed,
    };
    body += renderPolygon(axes, options.secondary.dimensions, center, secondaryStyle);
  }

  // Polygone primaire toujours rendu en ocre brule plein.
  const primaryStyle: PolygonStyle = {
    stroke: PALETTE.ocreBrule,
    fillOpacity: 0.12,
    strokeOpacity: 1,
    strokeWidth: 1.5,
    dashed: false,
  };
  body += renderPolygon(axes, data.dimensions, center, primaryStyle);

  // Legende uniquement pour les modes comparatifs.
  if (mode !== 'single') {
    const secondaryDashed = mode === 'temporal';
    body += renderLegend(options.primaryLabel, options.secondaryLabel, size, secondaryDashed);
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" ` +
    `role="img" aria-label="${escapeXml(data.title ?? 'spider chart')}">` +
    body +
    `</svg>`
  );
}

// ------------------------------------------------------------
// API PUBLIQUE : stubs pour les livraisons futures
// ------------------------------------------------------------
// Les signatures sont figees ici pour que les composants
// consommateurs puissent prendre dependance sans attendre
// l implementation. Tout appel reel jette : la livraison
// ulterieure remplacera ces stubs sans changer l API publique.

export interface EngineNode {
  id: string;
  label: string;
  phase: 'extraction' | 'parallel' | 'orchestration';
}

export interface EngineConnection {
  from: string;
  to: string;
}

export interface EngineMapOptions {
  size?: number;
  highlightedEngineId?: string;
}

export function renderEngineMap(
  engines: EngineNode[],
  connections: EngineConnection[],
  options: EngineMapOptions = {},
): string {
  void engines;
  void connections;
  void options;
  throw new Error(
    'renderEngineMap: not implemented. Stub reserve pour la cartographie statique des quatorze moteurs Prelude, livraison ulterieure.',
  );
}

export interface EngineAnimationOptions {
  size?: number;
  // Duree totale de l animation en millisecondes. Defaut 3000.
  durationMs?: number;
  // Delai entre l apparition de deux moteurs consecutifs.
  staggerMs?: number;
}

export interface EngineAnimationResult {
  svg: string;
  css: string;
}

export function renderEngineAnimation(
  engines: EngineNode[],
  connections: EngineConnection[],
  options: EngineAnimationOptions = {},
): EngineAnimationResult {
  void engines;
  void connections;
  void options;
  throw new Error(
    'renderEngineAnimation: not implemented. Stub reserve pour l animation pendant l analyse, livraison ulterieure.',
  );
}
