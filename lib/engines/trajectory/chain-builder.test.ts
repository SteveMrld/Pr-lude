// ============================================================
// Tests Chain Builder de Trajectoire
// ============================================================

import { buildTrajectoryFromAnalyses } from './chain-builder';
import type { AnalysisPayloadForSnapshot } from './snapshot-extractor';

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

function checkTrue(label: string, condition: boolean) {
  check(label, condition, true);
}

function mockAnalysis(opts: Partial<AnalysisPayloadForSnapshot> & { id: string; date: string; score: number; verdict?: string }): AnalysisPayloadForSnapshot {
  return {
    analysisId: opts.id,
    analyzedAt: opts.date,
    mechanicalScore: {
      globalScore: opts.score,
      verdict: (opts.verdict ?? 'investir avec conditions') as any,
      dimensions: {
        team: { score: opts.score },
        market: { score: opts.score },
        macro: { score: opts.score },
        financial: { score: opts.score },
        contrarian: { score: opts.score },
        vigilance: { score: opts.score },
      },
    },
    ...opts,
  };
}

console.log('\n=== Test 1 : chaine vide ===');
(() => {
  const summary = buildTrajectoryFromAnalyses([]);
  check('totalAnalyses 0', summary.totalAnalyses, 0);
  check('firstSnapshot null', summary.firstSnapshot, null);
  check('lastSnapshot null', summary.lastSnapshot, null);
  check('overallComparison null', summary.overallComparison, null);
  check('successiveComparisons empty', summary.successiveComparisons.length, 0);
  check('tendance null', summary.tendanceGlobale, null);
})();

console.log('\n=== Test 2 : une seule analyse ===');
(() => {
  const summary = buildTrajectoryFromAnalyses([
    mockAnalysis({ id: 'a1', date: '2026-01-01T00:00:00Z', score: 60 }),
  ]);
  check('totalAnalyses 1', summary.totalAnalyses, 1);
  checkTrue('firstSnapshot non null', !!summary.firstSnapshot);
  checkTrue('lastSnapshot egal a firstSnapshot', summary.firstSnapshot === summary.lastSnapshot);
  check('totalDays 0', summary.totalDays, 0);
  check('overallComparison null (besoin 2 minimum)', summary.overallComparison, null);
  check('successiveComparisons empty', summary.successiveComparisons.length, 0);
})();

console.log('\n=== Test 3 : deux analyses, amelioration ===');
(() => {
  const summary = buildTrajectoryFromAnalyses([
    mockAnalysis({ id: 'a1', date: '2026-01-01T00:00:00Z', score: 50, verdict: 'approfondir' }),
    mockAnalysis({ id: 'a2', date: '2026-04-01T00:00:00Z', score: 70, verdict: 'investir avec conditions' }),
  ]);
  check('totalAnalyses 2', summary.totalAnalyses, 2);
  checkTrue('overallComparison non null', !!summary.overallComparison);
  check('successiveComparisons 1', summary.successiveComparisons.length, 1);
  check('totalDays 90', summary.totalDays, 90);
  check('tendanceGlobale amelioration', summary.tendanceGlobale, 'amelioration');
})();

console.log('\n=== Test 4 : ordre d entree non chronologique - tri auto ===');
(() => {
  const summary = buildTrajectoryFromAnalyses([
    mockAnalysis({ id: 'a3', date: '2026-06-01T00:00:00Z', score: 80 }),
    mockAnalysis({ id: 'a1', date: '2026-01-01T00:00:00Z', score: 50 }),
    mockAnalysis({ id: 'a2', date: '2026-03-01T00:00:00Z', score: 65 }),
  ]);
  check('totalAnalyses 3', summary.totalAnalyses, 3);
  check('first = a1 (le plus ancien)', summary.firstSnapshot?.analysisId, 'a1');
  check('last = a3 (le plus recent)', summary.lastSnapshot?.analysisId, 'a3');
  check('successiveComparisons 2 (3 analyses = 2 transitions)', summary.successiveComparisons.length, 2);
})();

console.log('\n=== Test 5 : aggravation continue avec drapeaux rouges ===');
(() => {
  const baseFs = (combinaisonsNoms: string[]) => ({
    fragiliteStructurelle: {
      globalFragilityScore: 70,
      verdict: 'alerte' as const,
      patterns: {},
      combinaisons: combinaisonsNoms.map(nom => ({ nom, severite: 'drapeau-rouge' as const })),
    },
  });

  const summary = buildTrajectoryFromAnalyses([
    { ...mockAnalysis({ id: 'a1', date: '2026-01-01T00:00:00Z', score: 65 }), ...baseFs([]) },
    { ...mockAnalysis({ id: 'a2', date: '2026-04-01T00:00:00Z', score: 55 }), ...baseFs(['Trajectoire WeWork']) },
    { ...mockAnalysis({ id: 'a3', date: '2026-07-01T00:00:00Z', score: 45 }), ...baseFs(['Trajectoire WeWork', 'Pattern Britishvolt']) },
  ]);
  check('totalAnalyses 3', summary.totalAnalyses, 3);
  // Drapeaux apparus : Trajectoire WeWork sur transition 1->2, Pattern Britishvolt sur 2->3
  check('totalDrapeauxRougesApparus 2', summary.totalDrapeauxRougesApparus, 2);
  check('tendance aggravation', summary.tendanceGlobale, 'aggravation');
})();

console.log('\n=== Test 6 : analyses non-snapshotables ignorees ===');
(() => {
  const summary = buildTrajectoryFromAnalyses([
    mockAnalysis({ id: 'a1', date: '2026-01-01T00:00:00Z', score: 50 }),
    { analyzedAt: '2026-02-01T00:00:00Z', globalScore: 60 } as any, // pas d id, ignore
    { analysisId: 'a3' } as any, // pas de timestamp, ignore
    mockAnalysis({ id: 'a4', date: '2026-04-01T00:00:00Z', score: 70 }),
  ]);
  check('totalAnalyses 2 (deux invalides ignorees)', summary.totalAnalyses, 2);
  check('first = a1', summary.firstSnapshot?.analysisId, 'a1');
  check('last = a4', summary.lastSnapshot?.analysisId, 'a4');
})();

console.log('\n=== Test 7 : 5 analyses avec stabilisation puis aggravation finale ===');
(() => {
  const summary = buildTrajectoryFromAnalyses([
    mockAnalysis({ id: 'a1', date: '2026-01-01T00:00:00Z', score: 60 }),
    mockAnalysis({ id: 'a2', date: '2026-02-01T00:00:00Z', score: 62 }),
    mockAnalysis({ id: 'a3', date: '2026-03-01T00:00:00Z', score: 61 }),
    mockAnalysis({ id: 'a4', date: '2026-04-01T00:00:00Z', score: 60 }),
    mockAnalysis({ id: 'a5', date: '2026-05-01T00:00:00Z', score: 35, verdict: 'refuser' }),
  ]);
  check('totalAnalyses 5', summary.totalAnalyses, 5);
  check('successiveComparisons 4', summary.successiveComparisons.length, 4);
  // Overall = a1 -> a5 = 60 -> 35 = -25 = aggravation
  check('tendance globale aggravation', summary.tendanceGlobale, 'aggravation');
  // Les 3 premieres transitions sont stables, la derniere aggrave
  check('transition 1 stable', summary.successiveComparisons[0].trajectoireGlobale, 'stabilisation');
  check('transition 2 stable', summary.successiveComparisons[1].trajectoireGlobale, 'stabilisation');
  check('transition 4 aggravation', summary.successiveComparisons[3].trajectoireGlobale, 'aggravation');
})();

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
