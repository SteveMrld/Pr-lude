// ============================================================
// Tests deterministes des helpers de rendu trajectoire
// ------------------------------------------------------------
// Couvre les fonctions pures de lib/trajectory-render.ts : format
// de date, header de section, annotation pattern, bandeau de top
// alerte, et le contexte agrege buildTrajectoryRenderContext.
//
// Les helpers sont des fonctions pures, on les teste avec des
// TrajectoryComparison construites a la main (mock). Pas de
// React ni de DOM dans cette suite.
//
// Lancement : npx tsx lib/trajectory-render.test.ts
// ============================================================

import {
  formatPreviousDate,
  getLastComparison,
  buildTrajectoryHeader,
  buildPatternDeltaAnnotation,
  buildTrajectoryBanner,
  buildTrajectoryRenderContext,
} from './trajectory-render';
import { compareAnalyses } from './engines/trajectory';
import type { TrajectorySnapshot, TrajectorySummary, TrajectoryComparison } from './engines/trajectory';

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
// Helpers de mock
// ============================================================

function mockSnapshot(opts: Partial<TrajectorySnapshot> = {}): TrajectorySnapshot {
  return {
    analysisId: 'test-id',
    analyzedAt: '2026-01-01T00:00:00Z',
    globalScore: 60,
    verdict: 'investir avec conditions',
    dimensions: {
      team: 60, market: 60, macro: 60,
      financial: 60, contrarian: 60, vigilance: 60,
    },
    fragiliteScore: 40,
    fragiliteVerdict: 'sain',
    narrativeDriftScore: 30,
    narrativeDriftVerdict: 'sain',
    patterns: {
      'growth-subsidized-model': { score: 30, verdict: 'sain', applicabilite: 'full' },
      'fixed-cost-trap': { score: 25, verdict: 'sain', applicabilite: 'full' },
      'commoditization-drift': { score: 0, verdict: 'non-applicable', applicabilite: 'not-applicable' },
      'infrastructure-hostage': { score: 0, verdict: 'non-applicable', applicabilite: 'not-applicable' },
      'regulatory-time-bomb': { score: 0, verdict: 'non-applicable', applicabilite: 'not-applicable' },
      'capital-structure-fragility': { score: 0, verdict: 'non-applicable', applicabilite: 'not-applicable' },
      'scale-mirage-risk': { score: 0, verdict: 'non-applicable', applicabilite: 'not-applicable' },
    },
    combinaisons: [],
    ...opts,
  };
}

function mockSummary(snapshots: TrajectorySnapshot[]): TrajectorySummary {
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
  const successive: TrajectoryComparison[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    successive.push(compareAnalyses(snapshots[i - 1], snapshots[i]));
  }
  const overall = compareAnalyses(snapshots[0], snapshots[snapshots.length - 1]);
  return {
    totalAnalyses: snapshots.length,
    firstSnapshot: snapshots[0],
    lastSnapshot: snapshots[snapshots.length - 1],
    totalDays: overall.daysBetween,
    overallComparison: overall,
    successiveComparisons: successive,
    totalDrapeauxRougesApparus: 0,
    tendanceGlobale: overall.trajectoireGlobale,
  };
}

// ============================================================
// Test 1 : formatPreviousDate
// ============================================================

console.log('\n=== Test 1 : formatPreviousDate ===');
{
  const out = formatPreviousDate('2024-08-15T10:00:00Z');
  checkTrue('format FR contient aout', out.includes('août'));
  checkTrue('format FR contient annee', out.includes('2024'));
  check('null retourne chaine vide', formatPreviousDate(null), '');
  check('undefined retourne chaine vide', formatPreviousDate(undefined), '');
  check('chaine vide retourne chaine vide', formatPreviousDate(''), '');
  check('date invalide retourne chaine vide', formatPreviousDate('not a date'), '');
}

// ============================================================
// Test 2 : getLastComparison
// ============================================================

console.log('\n=== Test 2 : getLastComparison ===');
{
  const empty = getLastComparison(null);
  check('null summary retourne null', empty, null);

  const undef = getLastComparison(undefined);
  check('undefined summary retourne null', undef, null);

  const single = mockSummary([mockSnapshot()]);
  check('1 snapshot retourne null', getLastComparison(single), null);

  const two = mockSummary([
    mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z' }),
    mockSnapshot({ analyzedAt: '2026-01-15T00:00:00Z', globalScore: 55 }),
  ]);
  const c = getLastComparison(two);
  checkTrue('2 snapshots retourne comparison', !!c);
  check('comparison before = first', c?.before.analyzedAt, '2024-08-15T00:00:00Z');
  check('comparison after = second', c?.after.analyzedAt, '2026-01-15T00:00:00Z');

  const three = mockSummary([
    mockSnapshot({ analyzedAt: '2024-01-01T00:00:00Z' }),
    mockSnapshot({ analyzedAt: '2024-06-01T00:00:00Z' }),
    mockSnapshot({ analyzedAt: '2025-01-01T00:00:00Z' }),
  ]);
  const cLast = getLastComparison(three);
  check('3 snapshots, derniere comparison = 2eme -> 3eme', cLast?.before.analyzedAt, '2024-06-01T00:00:00Z');
  check('3 snapshots, derniere comparison after = 3eme', cLast?.after.analyzedAt, '2025-01-01T00:00:00Z');
}

// ============================================================
// Test 3 : buildTrajectoryHeader sans baseline
// ============================================================

console.log('\n=== Test 3 : buildTrajectoryHeader sans baseline ===');
{
  check('null retourne null', buildTrajectoryHeader(null), null);
}

// ============================================================
// Test 4 : buildTrajectoryHeader verdict en transition
// ============================================================

console.log('\n=== Test 4 : header verdict sain -> attention ===');
{
  const before = mockSnapshot({
    analyzedAt: '2024-08-15T00:00:00Z',
    fragiliteVerdict: 'sain',
    fragiliteScore: 30,
  });
  const after = mockSnapshot({
    analyzedAt: '2026-01-15T00:00:00Z',
    fragiliteVerdict: 'attention',
    fragiliteScore: 55,
  });
  const c = compareAnalyses(before, after);
  const header = buildTrajectoryHeader(c);
  checkTrue('header non null', !!header);
  checkTrue('header cite aout 2024', header?.includes('août 2024') ?? false);
  checkTrue('header cite sain et attention', (header?.includes('sain') && header?.includes('attention')) ?? false);
  checkTrue('header demarre par Evolution', header?.startsWith('Évolution') ?? false);
}

// ============================================================
// Test 5 : buildTrajectoryHeader verdict maintenu, score qui bouge
// ============================================================

console.log('\n=== Test 5 : header score bouge sans transition ===');
{
  const before = mockSnapshot({
    analyzedAt: '2024-08-15T00:00:00Z',
    fragiliteVerdict: 'attention',
    fragiliteScore: 50,
  });
  const after = mockSnapshot({
    analyzedAt: '2026-01-15T00:00:00Z',
    fragiliteVerdict: 'attention',
    fragiliteScore: 65,
  });
  const c = compareAnalyses(before, after);
  const header = buildTrajectoryHeader(c);
  checkTrue('header non null', !!header);
  checkTrue('header cite verdict maintenu', header?.includes('maintenu') ?? false);
  checkTrue('header cite delta +15', header?.includes('+15') ?? false);
}

// ============================================================
// Test 6 : buildTrajectoryHeader stabilite
// ============================================================

console.log('\n=== Test 6 : header trajectoire stable ===');
{
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z', fragiliteVerdict: 'sain', fragiliteScore: 30 });
  const after = mockSnapshot({ analyzedAt: '2026-01-15T00:00:00Z', fragiliteVerdict: 'sain', fragiliteScore: 32 });
  const c = compareAnalyses(before, after);
  const header = buildTrajectoryHeader(c);
  checkTrue('header non null', !!header);
  checkTrue('header signale stabilite', header?.includes('stable') ?? false);
}

// ============================================================
// Test 7 : buildPatternDeltaAnnotation delta numerique aggravation
// ============================================================

console.log('\n=== Test 7 : annotation delta aggravation ===');
{
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z' });
  const after = mockSnapshot({
    analyzedAt: '2026-01-15T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': { score: 55, verdict: 'attention', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);
  const ann = buildPatternDeltaAnnotation(c, 'growth-subsidized-model');
  checkTrue('annotation non null', !!ann);
  check('kind delta', ann?.kind, 'delta');
  if (ann?.kind === 'delta') {
    check('texte +25 vs aout 2024', ann.text.includes('+25') && ann.text.includes('août 2024'), true);
    check('direction aggravation', ann.direction, 'aggravation');
  }
}

// ============================================================
// Test 8 : buildPatternDeltaAnnotation newly-applicable
// ============================================================

console.log('\n=== Test 8 : annotation newly-applicable ===');
{
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z' });
  const after = mockSnapshot({
    analyzedAt: '2026-01-15T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'commoditization-drift': { score: 70, verdict: 'alerte', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);
  const ann = buildPatternDeltaAnnotation(c, 'commoditization-drift');
  checkTrue('annotation non null', !!ann);
  check('kind newly-applicable', ann?.kind, 'newly-applicable');
  if (ann?.kind === 'newly-applicable') {
    checkTrue('texte cite nouvellement actif', ann.text.includes('nouvellement actif'));
    checkTrue('texte cite alerte', ann.text.includes('alerte'));
    checkTrue('pas de delta numerique trompeur', !ann.text.match(/\+\d+/));
  }
}

// ============================================================
// Test 9 : buildPatternDeltaAnnotation newly-not-applicable
// ============================================================

console.log('\n=== Test 9 : annotation newly-not-applicable ===');
{
  const before = mockSnapshot({
    analyzedAt: '2024-08-15T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'commoditization-drift': { score: 65, verdict: 'attention', applicabilite: 'full' },
    },
  });
  const after = mockSnapshot({ analyzedAt: '2026-01-15T00:00:00Z' });
  const c = compareAnalyses(before, after);
  const ann = buildPatternDeltaAnnotation(c, 'commoditization-drift');
  checkTrue('annotation non null', !!ann);
  check('kind newly-not-applicable', ann?.kind, 'newly-not-applicable');
  if (ann?.kind === 'newly-not-applicable') {
    checkTrue('texte cite desormais non applicable', ann.text.includes('non applicable'));
    checkTrue('pas de delta numerique', !ann.text.match(/\+\d+/));
  }
}

// ============================================================
// Test 10 : buildPatternDeltaAnnotation pattern stable
// ============================================================

console.log('\n=== Test 10 : annotation pattern stable ===');
{
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z' });
  const after = mockSnapshot({
    analyzedAt: '2026-01-15T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': { score: 32, verdict: 'sain', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);
  const ann = buildPatternDeltaAnnotation(c, 'growth-subsidized-model');
  check('kind maintained', ann?.kind, 'maintained');
  if (ann?.kind === 'maintained') {
    checkTrue('texte cite stable et date', ann.text.includes('Stable') && ann.text.includes('août'));
  }
}

// ============================================================
// Test 11 : buildPatternDeltaAnnotation pattern absent retourne null
// ============================================================

console.log('\n=== Test 11 : annotation absent retourne null ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z' });
  const c = compareAnalyses(before, after);
  // commoditization-drift est non-applicable des deux cotes -> omis
  const ann = buildPatternDeltaAnnotation(c, 'commoditization-drift');
  check('null pour pattern non applicable des deux cotes', ann, null);
}

// ============================================================
// Test 12 : buildTrajectoryBanner pas d alerte critique
// ============================================================

console.log('\n=== Test 12 : banner sans alerte critique ===');
{
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z' });
  const after = mockSnapshot({ analyzedAt: '2026-01-15T00:00:00Z' });
  const c = compareAnalyses(before, after);
  const banner = buildTrajectoryBanner(c);
  check('banner null si trajectoire stable', banner, null);
}

// ============================================================
// Test 13 : buildTrajectoryBanner cran 1 combinaison drapeau-rouge
// ============================================================

console.log('\n=== Test 13 : banner cran 1 combinaison drapeau-rouge ===');
{
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z' });
  const after = mockSnapshot({
    analyzedAt: '2026-01-15T00:00:00Z',
    combinaisons: [{ nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' }],
  });
  const c = compareAnalyses(before, after);
  const banner = buildTrajectoryBanner(c);
  checkTrue('banner non null', !!banner);
  check('cran 1', banner?.cran, 1);
  checkTrue('raison cite la combinaison', banner?.raison.includes('Trajectoire WeWork') ?? false);
  checkTrue('recommandation contient examen immediat', banner?.recommandation.includes('immédiatement') ?? false);
}

// ============================================================
// Test 14 : buildTrajectoryBanner cran 2 score chute >=20
// ============================================================

console.log('\n=== Test 14 : banner cran 2 score chute >=20 ===');
{
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z', globalScore: 75 });
  const after = mockSnapshot({ analyzedAt: '2026-01-15T00:00:00Z', globalScore: 50 });
  const c = compareAnalyses(before, after);
  const banner = buildTrajectoryBanner(c);
  checkTrue('banner non null', !!banner);
  check('cran 2', banner?.cran, 2);
  checkTrue('raison cite la chute', banner?.raison.includes('25 points') ?? false);
}

// ============================================================
// Test 15 : buildTrajectoryBanner cran 3 ne remonte pas
// ============================================================

console.log('\n=== Test 15 : banner cran 3 ne remonte pas en banner ===');
{
  // Score chute 15 -> cran 3 score-chute-10, pas cran 1/2
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z', globalScore: 70 });
  const after = mockSnapshot({ analyzedAt: '2026-01-15T00:00:00Z', globalScore: 55 });
  const c = compareAnalyses(before, after);
  const banner = buildTrajectoryBanner(c);
  check('cran 3 seul ne remonte pas en banner', banner, null);
}

// ============================================================
// Test 16 : buildTrajectoryBanner priorite cran 1 sur cran 2
// ============================================================

console.log('\n=== Test 16 : banner priorite cran 1 sur cran 2 ===');
{
  const before = mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z', globalScore: 75 });
  const after = mockSnapshot({
    analyzedAt: '2026-01-15T00:00:00Z',
    globalScore: 50,  // cran 2 score chute
    combinaisons: [{ nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' }],  // cran 1
  });
  const c = compareAnalyses(before, after);
  const banner = buildTrajectoryBanner(c);
  check('cran 1 prioritaire', banner?.cran, 1);
  check('additionalCriticalCount = 1 (cran 2)', banner?.additionalCriticalCount, 1);
}

// ============================================================
// Test 17 : buildTrajectoryRenderContext sans baseline
// ============================================================

console.log('\n=== Test 17 : render context sans baseline ===');
{
  const ctx = buildTrajectoryRenderContext(null);
  check('hasBaseline false', ctx.hasBaseline, false);
  check('comparison null', ctx.comparison, null);
  check('header null', ctx.header, null);
  check('banner null', ctx.banner, null);
  check('alerts vide', ctx.alerts.length, 0);

  const ctxSingle = buildTrajectoryRenderContext(mockSummary([mockSnapshot()]));
  check('hasBaseline false avec 1 snapshot', ctxSingle.hasBaseline, false);
}

// ============================================================
// Test 18 : buildTrajectoryRenderContext baseline avec alertes
// ============================================================

console.log('\n=== Test 18 : render context avec baseline et alertes ===');
{
  const summary = mockSummary([
    mockSnapshot({ analyzedAt: '2024-08-15T00:00:00Z' }),
    mockSnapshot({
      analyzedAt: '2026-01-15T00:00:00Z',
      combinaisons: [{ nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' }],
    }),
  ]);
  const ctx = buildTrajectoryRenderContext(summary);
  check('hasBaseline true', ctx.hasBaseline, true);
  checkTrue('comparison present', !!ctx.comparison);
  checkTrue('header non null', !!ctx.header);
  checkTrue('banner non null (cran 1)', !!ctx.banner);
  check('banner cran 1', ctx.banner?.cran, 1);
  checkTrue('alerts non vide', ctx.alerts.length > 0);
}

// ============================================================
// FIN
// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
