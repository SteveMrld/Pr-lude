// ============================================================
// Tests Portfolio Trajectoires - Agrégateur et tri
// ------------------------------------------------------------
// Couvre les helpers d agrégation (sans Supabase) et le tri par
// cran d alerte attendu par le dashboard portfolio :
//   - derivePortfolioTag : signed -> in-portfolio, sinon instruction
//   - deriveDirection : score delta dans les zones up / stable / down
//   - rowToEngineSnapshot : conversion SQL -> engine, défaut sur dim null
//   - aggregateRow : édge cases 0, 1, N snapshots
//   - compareByCran : 1 < 2 < 3 < 4 < null, puis date desc
//   - aggregateDetail : chaîne complète et comparisons successives
//
// Lancement : npx tsx lib/portfolio-trajectoires.test.ts
// ============================================================

import {
  derivePortfolioTag,
  deriveDirection,
  rowToEngineSnapshot,
  aggregateRow,
  aggregateDetail,
  compareByCran,
  type PortfolioTrajectoryRow,
} from './portfolio-trajectoires-core';
import type { TrajectorySnapshotRow } from './trajectory-store';
import type { AnalysisSummary } from './analysis-store';

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

// ============================================================
// Mocks
// ============================================================

function mockAnalysis(
  id: string,
  opts: Partial<AnalysisSummary> = {},
): AnalysisSummary {
  return {
    id,
    companyName: `Dossier ${id}`,
    sector: 'SaaS',
    subSector: null,
    country: 'France',
    geographicHub: null,
    yearFounded: 2022,
    roundType: null,
    roundAmountEur: null,
    verdict: 'approfondir',
    verdictConfidence: null,
    globalScore: 60,
    blindspotScore: null,
    contrarianScore: null,
    coherenceScore: null,
    userNotes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    workflowStage: 'in_review',
    workflowStageUpdatedAt: null,
    versionsCount: 0,
    openCommentsCount: 0,
    hasBloc2: false,
    inPortfolio: false,
    ...opts,
  };
}

function mockSnapshotRow(
  analysisId: string,
  analyzedAt: string,
  globalScore: number,
  opts: Partial<TrajectorySnapshotRow> = {},
): TrajectorySnapshotRow {
  return {
    id: `snap-${analysisId}-${analyzedAt}`,
    analysisId,
    versionId: `v-${analyzedAt}`,
    versionNum: 1,
    userId: 'user-1',
    companyName: `Dossier ${analysisId}`,
    analyzedAt,
    globalScore,
    verdict: 'approfondir',
    dimensions: {
      team: 60, market: 60, macro: 60, financial: 60, contrarian: 60, vigilance: 60,
    },
    fragiliteScore: 40,
    fragiliteVerdict: 'sain',
    narrativeDriftScore: 30,
    narrativeDriftVerdict: 'sain',
    patterns: {},
    combinaisons: [],
    createdAt: analyzedAt,
    ...opts,
  };
}

// ============================================================
// Test 1 : derivePortfolioTag
// ============================================================
console.log('\n=== Test 1 : derivePortfolioTag ===');
check('signed -> in-portfolio', derivePortfolioTag('signed'), 'in-portfolio');
check('in_review -> instruction', derivePortfolioTag('in_review'), 'instruction');
check('dd_field -> instruction', derivePortfolioTag('dd_field'), 'instruction');
check('null -> instruction', derivePortfolioTag(null), 'instruction');
check('declined -> instruction', derivePortfolioTag('declined'), 'instruction');

// ============================================================
// Test 2 : deriveDirection
// ============================================================
console.log('\n=== Test 2 : deriveDirection ===');
check('delta null -> none', deriveDirection(null), 'none');
check('delta 0 -> stable', deriveDirection(0), 'stable');
check('delta +3 -> stable (sub tolerance)', deriveDirection(3), 'stable');
check('delta -3 -> stable', deriveDirection(-3), 'stable');
check('delta +5 -> up (au seuil)', deriveDirection(5), 'up');
check('delta -5 -> down (au seuil)', deriveDirection(-5), 'down');
check('delta +12 -> up', deriveDirection(12), 'up');
check('delta -15 -> down', deriveDirection(-15), 'down');

// ============================================================
// Test 3 : rowToEngineSnapshot avec dimensions null
// ============================================================
console.log('\n=== Test 3 : rowToEngineSnapshot avec dimensions null ===');
{
  const row = mockSnapshotRow('A', '2026-01-01', 60, {
    dimensions: {
      team: null, market: 50, macro: null, financial: 60, contrarian: null, vigilance: 70,
    },
  });
  const engine = rowToEngineSnapshot(row);
  check('team null -> 0 (default)', engine.dimensions.team, 0);
  check('market 50 conservé', engine.dimensions.market, 50);
  check('vigilance 70 conservé', engine.dimensions.vigilance, 70);
  check('verdict conservé', engine.verdict, 'approfondir');
  check('globalScore conservé', engine.globalScore, 60);
}

// ============================================================
// Test 4 : aggregateRow avec 0 snapshot
// ============================================================
console.log('\n=== Test 4 : aggregateRow avec 0 snapshot ===');
{
  const row = aggregateRow(mockAnalysis('A'), []);
  check('analysisId', row.analysisId, 'A');
  check('snapshotsCount = 0', row.snapshotsCount, 0);
  check('direction = none', row.direction, 'none');
  check('highestCran = null', row.highestCran, null);
  check('alerts vide', row.alerts.length, 0);
  check('scoreDelta = null', row.scoreDelta, null);
  // Fallback sur globalScore d analyse pour ne pas perdre l info
  // courante quand le trigger trajectory n a pas tourné.
  check('globalScore tombe sur analysis.globalScore', row.globalScore, 60);
}

// ============================================================
// Test 5 : aggregateRow avec 1 snapshot (pas de transition)
// ============================================================
console.log('\n=== Test 5 : aggregateRow avec 1 snapshot ===');
{
  const snap = mockSnapshotRow('A', '2026-03-01', 70);
  const row = aggregateRow(mockAnalysis('A'), [snap]);
  check('snapshotsCount = 1', row.snapshotsCount, 1);
  check('direction = none (pas de transition)', row.direction, 'none');
  check('highestCran = null', row.highestCran, null);
  check('alerts vide', row.alerts.length, 0);
  check('scoreDelta = null', row.scoreDelta, null);
  check('globalScore depuis snapshot', row.globalScore, 70);
  check('lastAnalyzedAt = snapshot', row.lastAnalyzedAt, '2026-03-01');
  check('firstAnalyzedAt = snapshot', row.firstAnalyzedAt, '2026-03-01');
}

// ============================================================
// Test 6 : aggregateRow avec 2 snapshots, score qui chute
// ============================================================
console.log('\n=== Test 6 : aggregateRow avec 2 snapshots, score qui chute ===');
{
  // 25 points de chute, doit produire un cran 2 (score-global-chute-20)
  const snaps = [
    mockSnapshotRow('A', '2026-01-01', 75),
    mockSnapshotRow('A', '2026-04-01', 50),
  ];
  const row = aggregateRow(mockAnalysis('A'), snaps);
  check('snapshotsCount = 2', row.snapshotsCount, 2);
  check('scoreDelta = -25', row.scoreDelta, -25);
  check('direction = down', row.direction, 'down');
  check('highestCran = 2', row.highestCran, 2);
  checkTrue('au moins une alerte cran 2', row.alerts.some((a) => a.cran === 2));
}

// ============================================================
// Test 7 : aggregateRow avec 2 snapshots stables
// ============================================================
console.log('\n=== Test 7 : aggregateRow avec 2 snapshots stables ===');
{
  const snaps = [
    mockSnapshotRow('A', '2026-01-01', 60),
    mockSnapshotRow('A', '2026-04-01', 62),
  ];
  const row = aggregateRow(mockAnalysis('A'), snaps);
  check('scoreDelta = +2', row.scoreDelta, 2);
  check('direction = stable', row.direction, 'stable');
  // Aucune alerte critique -> cran 4 par défaut (signal stabilité)
  check('highestCran = 4', row.highestCran, 4);
  checkTrue('alerte cran 4 présente', row.alerts.some((a) => a.cran === 4));
}

// ============================================================
// Test 8 : aggregateRow avec snapshots dans le désordre
// ============================================================
console.log('\n=== Test 8 : aggregateRow trie les snapshots avant comparaison ===');
{
  // On envoie dans le désordre : la comparaison doit comparer le
  // plus ancien vs le plus récent peu importe l ordre d entrée.
  const snaps = [
    mockSnapshotRow('A', '2026-04-01', 50),
    mockSnapshotRow('A', '2026-01-01', 75),
  ];
  const row = aggregateRow(mockAnalysis('A'), snaps);
  check('scoreDelta calculé du plus ancien vers le plus récent', row.scoreDelta, -25);
  check('lastAnalyzedAt = plus récent', row.lastAnalyzedAt, '2026-04-01');
  check('firstAnalyzedAt = plus ancien', row.firstAnalyzedAt, '2026-01-01');
}

// ============================================================
// Test 9 : aggregateRow avec 3 snapshots compare les 2 derniers
// ============================================================
console.log('\n=== Test 9 : aggregateRow avec 3 snapshots compare les 2 derniers ===');
{
  const snaps = [
    mockSnapshotRow('A', '2026-01-01', 50),
    mockSnapshotRow('A', '2026-02-01', 80),
    mockSnapshotRow('A', '2026-03-01', 60),
  ];
  const row = aggregateRow(mockAnalysis('A'), snaps);
  check('snapshotsCount = 3', row.snapshotsCount, 3);
  // Delta calculé entre les 2 derniers seulement : 60 - 80 = -20
  check('scoreDelta sur la dernière transition', row.scoreDelta, -20);
  check('direction = down', row.direction, 'down');
  check('highestCran = 2 (chute 20)', row.highestCran, 2);
}

// ============================================================
// Test 10 : compareByCran : tri 1 < 2 < 3 < 4 < null
// ============================================================
console.log('\n=== Test 10 : compareByCran tri par cran croissant ===');
{
  const row = (id: string, cran: number | null, date: string): PortfolioTrajectoryRow => {
    return {
      analysisId: id,
      companyName: id,
      sector: null,
      workflowStage: null,
      portfolioTag: 'instruction',
      verdict: null,
      globalScore: null,
      fragiliteScore: null,
      fragiliteVerdict: null,
      snapshotsCount: 2,
      lastAnalyzedAt: date,
      firstAnalyzedAt: date,
      direction: 'stable',
      scoreDelta: 0,
      highestCran: cran as any,
      alerts: [],
    };
  };
  const rows = [
    row('D', 4, '2026-03-01'),
    row('A', 1, '2026-01-01'),
    row('Z', null, '2026-04-01'),
    row('B', 2, '2026-02-01'),
    row('C', 3, '2026-02-15'),
  ];
  const sorted = [...rows].sort(compareByCran);
  check('1er = cran 1', sorted[0].analysisId, 'A');
  check('2e = cran 2', sorted[1].analysisId, 'B');
  check('3e = cran 3', sorted[2].analysisId, 'C');
  check('4e = cran 4', sorted[3].analysisId, 'D');
  check('5e = sans cran (null)', sorted[4].analysisId, 'Z');
}

// ============================================================
// Test 11 : compareByCran à cran égal, date la plus récente d abord
// ============================================================
console.log('\n=== Test 11 : compareByCran à cran égal, date desc ===');
{
  const row = (id: string, date: string): PortfolioTrajectoryRow => {
    return {
      analysisId: id, companyName: id, sector: null, workflowStage: null,
      portfolioTag: 'instruction',
      verdict: null, globalScore: null, fragiliteScore: null, fragiliteVerdict: null,
      snapshotsCount: 2, lastAnalyzedAt: date, firstAnalyzedAt: date,
      direction: 'stable', scoreDelta: 0, highestCran: 2, alerts: [],
    };
  };
  const rows = [
    row('OLD', '2026-01-01'),
    row('NEW', '2026-05-01'),
    row('MID', '2026-03-01'),
  ];
  const sorted = [...rows].sort(compareByCran);
  check('plus récente d abord', sorted[0].analysisId, 'NEW');
  check('intermédiaire ensuite', sorted[1].analysisId, 'MID');
  check('plus ancienne en dernier', sorted[2].analysisId, 'OLD');
}

// ============================================================
// Test 12 : aggregateDetail avec 10 snapshots
// ============================================================
console.log('\n=== Test 12 : aggregateDetail avec 10 snapshots ===');
{
  const snaps = Array.from({ length: 10 }, (_, i) =>
    mockSnapshotRow('A', `2026-0${(i % 9) + 1}-01`, 60 - i * 2),
  );
  const detail = aggregateDetail(mockAnalysis('A'), snaps);
  check('10 snapshots dans la chaîne', detail.snapshots.length, 10);
  // 10 snapshots -> 9 comparisons successives
  check('9 comparisons successives', detail.successiveComparisons.length, 9);
  check('9 sets d alertes (un par comparison)', detail.successiveAlerts.length, 9);
  checkTrue('overallComparison non null', detail.overallComparison !== null);
  // Premier snapshot doit être le plus ancien dans la chaîne triée
  checkTrue('snapshots triés par date asc', new Date(detail.snapshots[0].analyzedAt).getTime() <= new Date(detail.snapshots[9].analyzedAt).getTime());
}

// ============================================================
// Test 13 : aggregateDetail avec 1 snapshot
// ============================================================
console.log('\n=== Test 13 : aggregateDetail avec 1 snapshot ===');
{
  const detail = aggregateDetail(mockAnalysis('A'), [mockSnapshotRow('A', '2026-01-01', 60)]);
  check('1 snapshot', detail.snapshots.length, 1);
  check('aucune comparison', detail.successiveComparisons.length, 0);
  check('aucune alerte', detail.successiveAlerts.length, 0);
  check('overallComparison = null', detail.overallComparison, null);
}

// ============================================================
// FIN
// ============================================================
console.log(`\nTotal: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
