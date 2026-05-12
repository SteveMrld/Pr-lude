// ============================================================
// Tests TimelineGraph - Helpers de projection SVG
// ------------------------------------------------------------
// Couvre les edge cases de rendu du graphe trajectoire :
//   - 0 snapshot (rien à projeter)
//   - 1 snapshot (point seul centré)
//   - 2 snapshots (segment direct)
//   - 10 snapshots (étalement régulier)
//   - score aberrant clampé dans [0, 100]
//
// Le composant React lui-même n est pas rendu (pas de DOM ni de
// jsdom dans la suite déterministe). On teste les helpers de
// géométrie qui sont la partie qui peut casser silencieusement
// (un mauvais clamp ou un mauvais ratio donnerait un graphe
// visuellement incorrect mais sans erreur tsc).
//
// Lancement : npx tsx app/components/TimelineGraph.test.ts
// ============================================================

import {
  projectSnapshots,
  buildPolylinePoints,
  formatTickDate,
  DEFAULT_GEOMETRY,
  type TimelineGeometry,
} from './TimelineGraph';
import type { TrajectorySnapshot } from '@/lib/engines/trajectory/types';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T): void {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, condition: boolean): void {
  check(label, condition, true);
}

function mockSnapshot(analyzedAt: string, globalScore: number): TrajectorySnapshot {
  return {
    analysisId: `id-${analyzedAt}`,
    analyzedAt,
    globalScore,
    verdict: 'approfondir',
    dimensions: { team: 50, market: 50, macro: 50, financial: 50, contrarian: 50, vigilance: 50 },
    fragiliteScore: null,
    fragiliteVerdict: null,
    narrativeDriftScore: null,
    narrativeDriftVerdict: null,
    patterns: {},
    combinaisons: [],
  };
}

// ============================================================
// Test 1 : 0 snapshot
// ============================================================
console.log('\n=== Test 1 : 0 snapshot ===');
{
  const points = projectSnapshots([]);
  check('liste vide -> array vide', points.length, 0);
  check('polyline depuis vide -> chaine vide', buildPolylinePoints(points), '');
}

// ============================================================
// Test 2 : 1 snapshot, point au centre horizontal
// ============================================================
console.log('\n=== Test 2 : 1 snapshot, point au centre horizontal ===');
{
  const snap = mockSnapshot('2026-01-15T00:00:00Z', 70);
  const points = projectSnapshots([snap]);
  check('1 snapshot -> 1 point', points.length, 1);
  const g = DEFAULT_GEOMETRY;
  const innerWidth = g.width - g.paddingLeft - g.paddingRight;
  const expectedX = g.paddingLeft + innerWidth / 2;
  check('x au centre horizontal', points[0].x, expectedX);
  // score 70 -> y = paddingTop + innerHeight * 0.3 (1 - 0.7)
  const innerHeight = g.height - g.paddingTop - g.paddingBottom;
  const expectedY = g.paddingTop + innerHeight * 0.3;
  // tolerance flottant
  checkTrue('y reflète score 70 (zone haute)', Math.abs(points[0].y - expectedY) < 0.01);
  check('score conservé', points[0].score, 70);
  check('index 0', points[0].index, 0);
}

// ============================================================
// Test 3 : 2 snapshots, segment direct
// ============================================================
console.log('\n=== Test 3 : 2 snapshots, segment direct ===');
{
  const snaps = [
    mockSnapshot('2026-01-01T00:00:00Z', 50),
    mockSnapshot('2026-04-01T00:00:00Z', 30),
  ];
  const points = projectSnapshots(snaps);
  check('2 snapshots -> 2 points', points.length, 2);
  const g = DEFAULT_GEOMETRY;
  check('point 0 sur paddingLeft', points[0].x, g.paddingLeft);
  check('point 1 sur droite (width - paddingRight)', points[1].x, g.width - g.paddingRight);
  // Score baisse de 50 -> 30 : le point 1 doit être plus bas (y plus grand)
  checkTrue('y1 > y0 (score qui baisse va vers le bas)', points[1].y > points[0].y);

  const polyline = buildPolylinePoints(points);
  check('polyline contient 2 points séparés par espace', polyline.split(' ').length, 2);
}

// ============================================================
// Test 4 : 10 snapshots, étalement régulier
// ============================================================
console.log('\n=== Test 4 : 10 snapshots, étalement régulier ===');
{
  const snaps = Array.from({ length: 10 }, (_, i) =>
    mockSnapshot(`2026-0${(i % 9) + 1}-01T00:00:00Z`, 40 + i * 4),
  );
  const points = projectSnapshots(snaps);
  check('10 snapshots -> 10 points', points.length, 10);
  const g = DEFAULT_GEOMETRY;
  const innerWidth = g.width - g.paddingLeft - g.paddingRight;
  const expectedStep = innerWidth / 9;
  // Vérifie que les écarts sont réguliers
  for (let i = 1; i < points.length; i++) {
    const gap = points[i].x - points[i - 1].x;
    checkTrue(`écart régulier entre points ${i - 1} et ${i}`, Math.abs(gap - expectedStep) < 0.01);
  }
  // Premier sur paddingLeft, dernier sur width - paddingRight
  check('premier point sur paddingLeft', points[0].x, g.paddingLeft);
  check('dernier point sur width - paddingRight', points[9].x, g.width - g.paddingRight);
}

// ============================================================
// Test 5 : score aberrant clampé
// ============================================================
console.log('\n=== Test 5 : score aberrant clampé ===');
{
  const g = DEFAULT_GEOMETRY;
  const innerHeight = g.height - g.paddingTop - g.paddingBottom;
  // score = 110 -> doit être traité comme 100 -> y = paddingTop
  const ptsHi = projectSnapshots([mockSnapshot('2026-01-01', 110)]);
  checkTrue('score > 100 clampé en haut du canvas', Math.abs(ptsHi[0].y - g.paddingTop) < 0.01);
  // score = -5 -> doit être traité comme 0 -> y = paddingTop + innerHeight
  const ptsLo = projectSnapshots([mockSnapshot('2026-01-01', -5)]);
  checkTrue('score < 0 clampé en bas du canvas', Math.abs(ptsLo[0].y - (g.paddingTop + innerHeight)) < 0.01);
  // Score conservé brut dans le point (clamp visuel seulement, pas
  // de mutation des données sources)
  check('score brut conservé pour le tooltip', ptsHi[0].score, 110);
}

// ============================================================
// Test 6 : géométrie custom respectée
// ============================================================
console.log('\n=== Test 6 : géométrie custom respectée ===');
{
  const customGeo: TimelineGeometry = {
    width: 800,
    height: 200,
    paddingLeft: 40,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
  };
  const points = projectSnapshots(
    [mockSnapshot('2026-01-01', 50), mockSnapshot('2026-02-01', 50)],
    customGeo,
  );
  check('premier point respecte paddingLeft custom', points[0].x, customGeo.paddingLeft);
  check('dernier point respecte width custom - paddingRight', points[1].x, customGeo.width - customGeo.paddingRight);
}

// ============================================================
// Test 7 : formatTickDate
// ============================================================
console.log('\n=== Test 7 : formatTickDate ===');
{
  const label = formatTickDate('2026-05-12T00:00:00Z');
  // Construction relative à fuseau local : on vérifie la présence
  // du mois (mai) et de l année (26) sans être strict sur le jour
  // pour éviter les flakies de fuseau.
  checkTrue('label contient le mois "mai"', label.toLowerCase().includes('mai'));
  checkTrue('label contient le suffixe d année "26"', label.includes('26'));
  check('date invalide -> chaine vide', formatTickDate('not-a-date'), '');
}

// ============================================================
// FIN
// ============================================================

console.log(`\nTotal: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
