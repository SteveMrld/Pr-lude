// ============================================================
// Tests deterministes du module visuel toile d araignee
// ------------------------------------------------------------
// Couvre la geometrie polygonale (sommets, conversion radiale,
// alignement des labels cardinaux) et le rendu SVG de la
// fonction renderSpiderChart pour les trois usages prioritaires
// du Sectoral Intelligence Layer. Pas de test reseau, pas de
// test base de donnees, juste de la geometrie et des chaines.
//
// Execution : tsx lib/visuals/spiderweb.test.ts
// ============================================================

import {
  PALETTE,
  TYPOGRAPHY,
  regularPolygonVertices,
  radialToCartesian,
  labelAlignmentForAngle,
  axisLabelPosition,
  measurePointOnAxis,
  renderSpiderChart,
  renderEngineMap,
  renderEngineAnimation,
  type DimensionData,
  type SpiderChartData,
} from './spiderweb';

let pass = 0, fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

function checkNear(label: string, actual: number, expected: number, eps = 0.001) {
  const ok = Math.abs(actual - expected) < eps;
  if (ok) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${actual}, expected close to ${expected}`);
    fail++;
  }
}

function checkThrows(label: string, fn: () => unknown) {
  try {
    fn();
    console.log(`  FAIL  ${label}: no exception thrown`);
    fail++;
  } catch {
    console.log(`  PASS  ${label}`);
    pass++;
  }
}

// ============================================================
// Helpers de mock pour les tests de rendu
// ============================================================

const HUIT_DIMENSIONS = [
  'Intensite capitalistique',
  'Pression reglementaire',
  'Velocite technologique',
  'Concentration concurrentielle',
  'Cyclicite macro',
  'Exposition geopolitique',
  'Tension capital-talent',
  'Vulnerabilite narrative',
];

function mockData(
  scores: Array<number | null>,
  overrides: Partial<SpiderChartData> = {},
): SpiderChartData {
  return {
    dimensions: scores.map((score, i) => ({
      label: HUIT_DIMENSIONS[i] ?? `Dim ${i}`,
      score,
    })),
    ...overrides,
  };
}

// ============================================================
// Test 1 : palette et typographie exportees
// ============================================================

console.log('\n=== Test 1 : constantes exportees ===');
{
  check('palette cream definie', PALETTE.cream, '#F5EFE6');
  check('palette ocre brule definie', PALETTE.ocreBrule, '#9C5A2A');
  check('palette ocre eteint definie', PALETTE.ocreEteint, '#C8A988');
  check('palette sepia definie', PALETTE.sepia, '#6B5841');
  check('palette encre definie', PALETTE.encre, '#2B2B2B');
  checkTrue('typography serif non vide', TYPOGRAPHY.serif.length > 0);
  checkTrue('typography grotesque non vide', TYPOGRAPHY.grotesqueCondensed.length > 0);
  check('axisLabelSize 11', TYPOGRAPHY.axisLabelSize, 11);
  check('graduationSize 9', TYPOGRAPHY.graduationSize, 9);
}

// ============================================================
// Test 2 : regularPolygonVertices pour n = 3 a 8
// ============================================================

console.log('\n=== Test 2 : regularPolygonVertices ===');
{
  const center = { x: 0, y: 0 };
  for (const n of [3, 4, 5, 6, 7, 8]) {
    const v = regularPolygonVertices(n, 100, center);
    check(`n=${n} retourne ${n} sommets`, v.length, n);
    // Tous les sommets a distance radius du centre.
    const allOnCircle = v.every((p) => Math.abs(Math.hypot(p.x, p.y) - 100) < 0.001);
    checkTrue(`n=${n} tous sommets sur le cercle de rayon 100`, allOnCircle);
    // Premier sommet au nord (x ~ 0, y ~ -100).
    checkNear(`n=${n} premier sommet x = 0`, v[0].x, 0);
    checkNear(`n=${n} premier sommet y = -100`, v[0].y, -100);
  }

  // Octogone specifique : sommet au sud attendu (index 4).
  const oct = regularPolygonVertices(8, 100, { x: 0, y: 0 });
  checkNear('octogone sommet 4 au sud x=0', oct[4].x, 0);
  checkNear('octogone sommet 4 au sud y=100', oct[4].y, 100);
  // Sommet est (index 2)
  checkNear('octogone sommet 2 est x=100', oct[2].x, 100);
  checkNear('octogone sommet 2 est y=0', oct[2].y, 0);
  // Sommet ouest (index 6)
  checkNear('octogone sommet 6 ouest x=-100', oct[6].x, -100);
  checkNear('octogone sommet 6 ouest y=0', oct[6].y, 0);

  // n < 3 doit echouer.
  checkThrows('n=2 leve une exception', () => regularPolygonVertices(2, 100, { x: 0, y: 0 }));
  checkThrows('n=0 leve une exception', () => regularPolygonVertices(0, 100, { x: 0, y: 0 }));
}

// ============================================================
// Test 3 : radialToCartesian
// ============================================================

console.log('\n=== Test 3 : radialToCartesian ===');
{
  const c = { x: 100, y: 100 };
  // Angle 0 = est (x augmente)
  const east = radialToCartesian(50, 0, c);
  checkNear('radial est x=150', east.x, 150);
  checkNear('radial est y=100', east.y, 100);

  // Angle -PI/2 = nord (y diminue, repere SVG)
  const north = radialToCartesian(50, -Math.PI / 2, c);
  checkNear('radial nord x=100', north.x, 100);
  checkNear('radial nord y=50', north.y, 50);

  // Angle PI = ouest
  const west = radialToCartesian(50, Math.PI, c);
  checkNear('radial ouest x=50', west.x, 50);
  checkNear('radial ouest y=100', west.y, 100);
}

// ============================================================
// Test 4 : labelAlignmentForAngle
// ============================================================

console.log('\n=== Test 4 : labelAlignmentForAngle ===');
{
  const north = labelAlignmentForAngle(-Math.PI / 2);
  check('nord textAnchor middle', north.textAnchor, 'middle');
  check('nord dominantBaseline auto', north.dominantBaseline, 'auto');

  const south = labelAlignmentForAngle(Math.PI / 2);
  check('sud textAnchor middle', south.textAnchor, 'middle');
  check('sud dominantBaseline hanging', south.dominantBaseline, 'hanging');

  const east = labelAlignmentForAngle(0);
  check('est textAnchor start', east.textAnchor, 'start');
  check('est dominantBaseline middle', east.dominantBaseline, 'middle');

  const west = labelAlignmentForAngle(Math.PI);
  check('ouest textAnchor end', west.textAnchor, 'end');
  check('ouest dominantBaseline middle', west.dominantBaseline, 'middle');

  // Quadrant nord-est : labels ancres a gauche
  const ne = labelAlignmentForAngle(-Math.PI / 4);
  check('nord-est textAnchor start', ne.textAnchor, 'start');

  // Quadrant nord-ouest : labels ancres a droite
  const nw = labelAlignmentForAngle(-3 * Math.PI / 4);
  check('nord-ouest textAnchor end', nw.textAnchor, 'end');
}

// ============================================================
// Test 5 : axisLabelPosition
// ============================================================

console.log('\n=== Test 5 : axisLabelPosition ===');
{
  const center = { x: 100, y: 100 };
  // Sommet au nord, label decale de 18 vers le nord
  const vertexNorth = { x: 100, y: 50 };
  const labelPos = axisLabelPosition(vertexNorth, center, 18);
  checkNear('label nord x=100', labelPos.x, 100);
  checkNear('label nord y=32', labelPos.y, 32);

  // Sommet a l est
  const vertexEast = { x: 150, y: 100 };
  const labelPosEast = axisLabelPosition(vertexEast, center, 18);
  checkNear('label est x=168', labelPosEast.x, 168);
  checkNear('label est y=100', labelPosEast.y, 100);

  // Vertex au centre (distance nulle) retourne le vertex tel quel
  const same = axisLabelPosition(center, center, 18);
  checkNear('vertex au centre x=100', same.x, 100);
  checkNear('vertex au centre y=100', same.y, 100);
}

// ============================================================
// Test 6 : measurePointOnAxis
// ============================================================

console.log('\n=== Test 6 : measurePointOnAxis ===');
{
  const center = { x: 100, y: 100 };
  const vertex = { x: 100, y: 0 }; // nord, rayon 100

  // Score 0 = centre
  const p0 = measurePointOnAxis(vertex, center, 0);
  checkNear('score 0 x=100', (p0 as { x: number; y: number }).x, 100);
  checkNear('score 0 y=100', (p0 as { x: number; y: number }).y, 100);

  // Score 100 = sommet
  const p100 = measurePointOnAxis(vertex, center, 100);
  checkNear('score 100 x=100', (p100 as { x: number; y: number }).x, 100);
  checkNear('score 100 y=0', (p100 as { x: number; y: number }).y, 0);

  // Score 50 = mi-chemin
  const p50 = measurePointOnAxis(vertex, center, 50);
  checkNear('score 50 x=100', (p50 as { x: number; y: number }).x, 100);
  checkNear('score 50 y=50', (p50 as { x: number; y: number }).y, 50);

  // Score null = retourne null
  const pNull = measurePointOnAxis(vertex, center, null);
  check('score null retourne null', pNull, null);

  // Score 150 clampe a 100
  const p150 = measurePointOnAxis(vertex, center, 150);
  checkNear('score 150 clampe en sommet y=0', (p150 as { x: number; y: number }).y, 0);

  // Score negatif clampe a 0
  const pNeg = measurePointOnAxis(vertex, center, -20);
  checkNear('score negatif clampe en centre y=100', (pNeg as { x: number; y: number }).y, 100);
}

// ============================================================
// Test 7 : renderSpiderChart mode single fiche complete
// ============================================================

console.log('\n=== Test 7 : renderSpiderChart mode single ===');
{
  const data = mockData([60, 75, 50, 30, 80, 40, 65, 55], {
    title: 'Fintech',
    subtitle: 'Fiche du 2026-Q2',
  });
  const svg = renderSpiderChart(data, { mode: 'single', size: 480 });

  checkTrue('svg commence par <svg', svg.startsWith('<svg'));
  checkTrue('svg termine par </svg>', svg.endsWith('</svg>'));
  checkTrue('svg contient un polygone', svg.includes('<polygon '));
  checkTrue('svg contient le titre', svg.includes('Fintech'));
  checkTrue('svg contient le sous-titre', svg.includes('Fiche du 2026-Q2'));
  checkTrue('svg utilise palette ocre brule', svg.includes(PALETTE.ocreBrule));
  checkTrue('svg utilise palette creme en fond', svg.includes(PALETTE.cream));
  checkTrue('svg contient les huit labels', HUIT_DIMENSIONS.every((label) => svg.includes(label)));
  checkTrue('svg contient les cercles concentriques', (svg.match(/<circle /g) ?? []).length >= 8);
  checkTrue('svg contient les graduations 25 50 75 100',
    svg.includes('>25<') && svg.includes('>50<') && svg.includes('>75<') && svg.includes('>100<'));
  // Pas de legende en mode single
  checkTrue('pas de legende en mode single', !svg.includes('stroke-dasharray="4 3"'));
}

// ============================================================
// Test 8 : renderSpiderChart degraded sur dimension manquante
// ============================================================

console.log('\n=== Test 8 : renderSpiderChart dimension manquante ===');
{
  // Une des huit dimensions a un score null.
  const data = mockData([60, null, 50, 30, 80, 40, 65, 55]);
  const svg = renderSpiderChart(data, { mode: 'single' });

  // En mode degraded : on rend une polyline (pas un polygon
  // strict) plus des segments pointilles sur l axe manquant.
  checkTrue('mode degraded contient polyline', svg.includes('<polyline '));
  // Cercle de mesure du sommet manquant absent : on doit avoir
  // un point de mesure de moins que de dimensions.
  // Compte de circles de mesure (r="3").
  const measureDots = (svg.match(/r="3"/g) ?? []).length;
  check('sept points de mesure rendus, le huitieme omis', measureDots, 7);
  // Branche pointillee : un segment avec stroke-dasharray "1 4".
  checkTrue('branche pointillee pour dimension manquante', svg.includes('stroke-dasharray="1 4"'));
}

// ============================================================
// Test 9 : renderSpiderChart mode overlay
// ============================================================

console.log('\n=== Test 9 : renderSpiderChart mode overlay ===');
{
  const primary = mockData([60, 75, 50, 30, 80, 40, 65, 55], { title: 'Fintech' });
  const secondary = mockData([55, 30, 80, 55, 45, 50, 75, 40], { title: 'IA appliquee' });
  const svg = renderSpiderChart(primary, {
    mode: 'overlay',
    secondary,
    primaryLabel: 'Fintech 2026-Q2',
    secondaryLabel: 'IA appliquee 2026-Q2',
  });

  // Deux polygones tracés (primaire + secondaire complets, pas
  // de donnee manquante).
  const polygonCount = (svg.match(/<polygon /g) ?? []).length;
  check('overlay rend deux polygones', polygonCount, 2);
  // Utilisation de l ocre eteint pour le secondaire en mode
  // overlay (et non temporal).
  checkTrue('overlay utilise ocre eteint', svg.includes(PALETTE.ocreEteint));
  // Legende presente
  checkTrue('legende contient label primaire', svg.includes('Fintech 2026-Q2'));
  checkTrue('legende contient label secondaire', svg.includes('IA appliquee 2026-Q2'));
}

// ============================================================
// Test 10 : renderSpiderChart mode temporal
// ============================================================

console.log('\n=== Test 10 : renderSpiderChart mode temporal ===');
{
  const current = mockData([60, 75, 50, 30, 80, 40, 65, 55]);
  const historical = mockData([55, 65, 45, 35, 70, 50, 60, 50]);
  const svg = renderSpiderChart(current, {
    mode: 'temporal',
    secondary: historical,
    primaryLabel: 'Fintech 2026-Q2',
    secondaryLabel: 'Fintech 2025-Q2',
  });

  // Le secondaire en mode temporal est rendu en pointille.
  checkTrue('temporal contient stroke-dasharray pointille', svg.includes('stroke-dasharray="4 3"'));
  // Les deux traces utilisent ocre brule (pas ocre eteint),
  // distingues par le pointille seul.
  const ocreBruleCount = (svg.match(new RegExp(PALETTE.ocreBrule.replace('#', '\\#'), 'g')) ?? []).length;
  checkTrue('ocre brule utilise plusieurs fois en temporal', ocreBruleCount >= 2);
  // Legende presente
  checkTrue('temporal legende primaire', svg.includes('Fintech 2026-Q2'));
  checkTrue('temporal legende historique', svg.includes('Fintech 2025-Q2'));
}

// ============================================================
// Test 11 : renderSpiderChart erreurs d entree
// ============================================================

console.log('\n=== Test 11 : renderSpiderChart erreurs ===');
{
  // Moins de trois dimensions : echec.
  checkThrows('rejet de 2 dimensions', () =>
    renderSpiderChart({ dimensions: [{ label: 'A', score: 50 }, { label: 'B', score: 50 }] }),
  );

  // Mode overlay sans secondary : echec.
  checkThrows('rejet overlay sans secondary', () =>
    renderSpiderChart(mockData([10, 20, 30]), { mode: 'overlay' }),
  );

  // Secondary avec nombre de dimensions divergent : echec.
  checkThrows('rejet secondary divergent', () =>
    renderSpiderChart(mockData([10, 20, 30]), {
      mode: 'overlay',
      secondary: { dimensions: [{ label: 'X', score: 10 }, { label: 'Y', score: 20 }] },
    }),
  );
}

// ============================================================
// Test 12 : escape XML dans les labels
// ============================================================

console.log('\n=== Test 12 : escape XML labels ===');
{
  const data: SpiderChartData = {
    dimensions: [
      { label: 'A & B', score: 50 },
      { label: '<inject>', score: 60 },
      { label: '"quote"', score: 40 },
    ],
    title: 'Test & escape',
  };
  const svg = renderSpiderChart(data);
  checkTrue('escape ampersand', svg.includes('A &amp; B'));
  checkTrue('escape less than', svg.includes('&lt;inject&gt;'));
  checkTrue('escape quote', svg.includes('&quot;quote&quot;'));
  checkTrue('aucun ampersand brut hors entities',
    !/&(?!amp;|lt;|gt;|quot;|apos;)/g.test(svg));
}

// ============================================================
// Test 13 : SVG produit est syntaxiquement parseable
// ============================================================

console.log('\n=== Test 13 : SVG parseable ===');
{
  const data = mockData([10, 20, 30, 40, 50, 60, 70, 80], { title: 'Parse test' });
  const svg = renderSpiderChart(data);
  // Verifications structurelles sans parseur XML reel.
  const openTags = svg.match(/<(\w+)/g) ?? [];
  const closeTags = svg.match(/<\/(\w+)>/g) ?? [];
  const selfClosing = (svg.match(/\/>/g) ?? []).length;
  // Open tags = close tags + self-closing.
  check('balance ouvrants vs fermants et self-closing',
    openTags.length, closeTags.length + selfClosing);
  // viewBox correct
  checkTrue('viewBox 0 0 480 480', svg.includes('viewBox="0 0 480 480"'));
  // role img pour accessibilite
  checkTrue('role img present', svg.includes('role="img"'));
  // aria-label pose
  checkTrue('aria-label pose', svg.includes('aria-label='));
}

// ============================================================
// Test 14 : stubs renderEngineMap et renderEngineAnimation
// ============================================================

console.log('\n=== Test 14 : stubs livraisons futures ===');
{
  checkThrows('renderEngineMap stub throw not implemented', () =>
    renderEngineMap([], []),
  );
  checkThrows('renderEngineAnimation stub throw not implemented', () =>
    renderEngineAnimation([], []),
  );
}

// ============================================================
// Test 15 : taille personnalisee
// ============================================================

console.log('\n=== Test 15 : taille personnalisee ===');
{
  const data = mockData([10, 20, 30, 40, 50, 60, 70, 80]);
  const svgSmall = renderSpiderChart(data, { size: 150 });
  checkTrue('size 150 viewBox', svgSmall.includes('viewBox="0 0 150 150"'));
  checkTrue('size 150 width attribute', svgSmall.includes('width="150"'));
  const svgLarge = renderSpiderChart(data, { size: 720 });
  checkTrue('size 720 viewBox', svgLarge.includes('viewBox="0 0 720 720"'));
}

// ============================================================
// Test 16 : rendu pour 3 dimensions et 5 dimensions (autres
// usages potentiels du langage visuel : triangle et pentagone)
// ============================================================

console.log('\n=== Test 16 : polygones non octogonaux ===');
{
  const tri = mockData([50, 60, 70]);
  const svgTri = renderSpiderChart(tri);
  checkTrue('triangle rendu', svgTri.includes('<polygon '));
  // Trois labels, trois points de mesure.
  check('triangle trois points de mesure', (svgTri.match(/r="3"/g) ?? []).length, 3);

  const penta = mockData([40, 50, 60, 70, 80]);
  const svgPenta = renderSpiderChart(penta);
  check('pentagone cinq points de mesure', (svgPenta.match(/r="3"/g) ?? []).length, 5);
}

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
