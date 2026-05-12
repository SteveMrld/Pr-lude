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
  // branche est rendue en pointille clair sans valeur affichee.
  score: number | null;
  // Confidence facultative, sert au rendu degrade.
  confidence?: 'high' | 'medium' | 'low' | 'data_missing';
}

export interface SpiderChartData {
  dimensions: DimensionData[];
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

function pointsAttribute(points: Array<Point2D | null>): string {
  // Pour le rendu de polygone : si une mesure est manquante
  // (point null), on tombe sur le centre relatif. Cette branche
  // est en realite traitee en amont, mais la fonction reste
  // defensive.
  return points
    .filter((p): p is Point2D => p !== null)
    .map((p) => `${formatNumber(p.x)},${formatNumber(p.y)}`)
    .join(' ');
}

interface RenderedAxis {
  vertex: Point2D;
  labelPosition: Point2D;
  alignment: LabelAlignment;
  angle: number;
  dimension: DimensionData;
}

function buildAxes(
  dimensions: DimensionData[],
  center: Point2D,
  radius: number,
  labelPadding: number,
): RenderedAxis[] {
  const n = dimensions.length;
  const startAngle = -Math.PI / 2;
  const step = (2 * Math.PI) / n;
  const axes: RenderedAxis[] = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * step;
    const vertex = radialToCartesian(radius, angle, center);
    const labelPos = axisLabelPosition(vertex, center, labelPadding);
    axes.push({
      vertex,
      labelPosition: labelPos,
      alignment: labelAlignmentForAngle(angle),
      angle,
      dimension: dimensions[i],
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

function renderRadialAxes(axes: RenderedAxis[], center: Point2D): string {
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

function renderAxisLabels(axes: RenderedAxis[]): string {
  return axes
    .map((a) => {
      const { labelPosition, alignment, dimension } = a;
      const safeLabel = escapeXml(dimension.label);
      return (
        `<text x="${formatNumber(labelPosition.x)}" y="${formatNumber(labelPosition.y)}" ` +
        `text-anchor="${alignment.textAnchor}" ` +
        `dominant-baseline="${alignment.dominantBaseline}" ` +
        `font-family='${TYPOGRAPHY.serif}' font-size="${TYPOGRAPHY.axisLabelSize}" ` +
        `fill="${PALETTE.encre}">${safeLabel}</text>`
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
  axes: RenderedAxis[],
  data: DimensionData[],
  center: Point2D,
  style: PolygonStyle,
): string {
  // Construit le polygone des mesures. Les points manquants sont
  // rendus en pointille sur la branche correspondante : on trace
  // le polygone connectant uniquement les points presents, et on
  // ajoute des segments en pointille pour les branches absentes.
  const points: Array<Point2D | null> = axes.map((a, idx) =>
    measurePointOnAxis(a.vertex, center, data[idx]?.score ?? null),
  );

  const hasMissing = points.some((p) => p === null);
  const polygonPoints = pointsAttribute(points);
  const dasharray = style.dashed ? ' stroke-dasharray="4 3"' : '';

  let svg = '';

  if (!hasMissing) {
    svg += (
      `<polygon points="${polygonPoints}" ` +
      `fill="${style.stroke}" fill-opacity="${style.fillOpacity}" ` +
      `stroke="${style.stroke}" stroke-width="${style.strokeWidth}" ` +
      `stroke-opacity="${style.strokeOpacity}"${dasharray} />`
    );
  } else {
    // Cas degraded : on trace une polyline sur les points
    // presents en pleins, et on ajoute des segments pointilles
    // depuis le centre vers les axes ou la donnee manque, pour
    // visualiser explicitement l absence.
    svg += (
      `<polyline points="${polygonPoints}" ` +
      `fill="${style.stroke}" fill-opacity="${Math.max(0, style.fillOpacity - 0.04)}" ` +
      `stroke="${style.stroke}" stroke-width="${style.strokeWidth}" ` +
      `stroke-opacity="${style.strokeOpacity}"${dasharray} />`
    );
    for (let i = 0; i < points.length; i++) {
      if (points[i] === null) {
        const v = axes[i].vertex;
        svg += (
          `<line x1="${formatNumber(center.x)}" y1="${formatNumber(center.y)}" ` +
          `x2="${formatNumber(v.x)}" y2="${formatNumber(v.y)}" ` +
          `stroke="${PALETTE.sepia}" stroke-width="0.5" stroke-opacity="0.4" ` +
          `stroke-dasharray="1 4" />`
        );
      }
    }
  }

  // Points de mesure aux sommets pleins.
  for (const p of points) {
    if (p === null) continue;
    svg += (
      `<circle cx="${formatNumber(p.x)}" cy="${formatNumber(p.y)}" r="3" ` +
      `fill="${style.stroke}" />`
    );
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

function renderHeader(
  data: SpiderChartData,
  center: Point2D,
  size: number,
): string {
  if (!data.title && !data.subtitle) return '';
  let svg = '';
  const topMargin = 24;
  if (data.title) {
    svg += (
      `<text x="${formatNumber(center.x)}" y="${formatNumber(topMargin)}" ` +
      `text-anchor="middle" dominant-baseline="hanging" ` +
      `font-family='${TYPOGRAPHY.serif}' font-size="${TYPOGRAPHY.titleSize}" ` +
      `fill="${PALETTE.encre}">${escapeXml(data.title)}</text>`
    );
  }
  if (data.subtitle) {
    const yOffset = data.title ? topMargin + TYPOGRAPHY.titleSize + 4 : topMargin;
    svg += (
      `<text x="${formatNumber(center.x)}" y="${formatNumber(yOffset)}" ` +
      `text-anchor="middle" dominant-baseline="hanging" ` +
      `font-family='${TYPOGRAPHY.grotesqueCondensed}' ` +
      `font-size="${TYPOGRAPHY.subtitleSize}" ` +
      `fill="${PALETTE.sepia}">${escapeXml(data.subtitle)}</text>`
    );
  }
  // size est explicitement passe pour permettre l ajustement
  // futur de la marge basse selon la taille totale.
  void size;
  return svg;
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
// Le parametre data porte les huit dimensions standardisees
// dans l ordre attendu de l octogone (rotation calee sur la
// verticale, premier sommet au nord). En mode 'overlay' ou
// 'temporal', le parametre options.secondary doit etre homogene
// en nombre de dimensions avec data.dimensions, sans quoi le
// rendu echoue.
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
  // Marge laissee pour les labels d axes : on reserve un cinquieme
  // du cote pour la typographie radiale.
  const radius = size / 2 - size * 0.18;
  const labelPadding = 18;

  const axes = buildAxes(data.dimensions, center, radius, labelPadding);

  let body = '';
  // Fond creme pour garantir le rendu hors-contexte (note PDF,
  // image isolee). En contexte applicatif le fond peut etre
  // ecrase par un wrapper, mais l autonomie est preservee.
  body += `<rect x="0" y="0" width="${size}" height="${size}" fill="${PALETTE.cream}" />`;

  body += renderHeader(data, center, size);
  body += renderConcentricRings(center, radius);
  body += renderRadialAxes(axes, center);
  body += renderGraduations(center, radius);
  body += renderAxisLabels(axes);

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
