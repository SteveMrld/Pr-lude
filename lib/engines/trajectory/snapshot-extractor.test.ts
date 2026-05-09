// ============================================================
// Tests Snapshot Extractor
// ============================================================

import { extractSnapshot, type AnalysisPayloadForSnapshot } from './snapshot-extractor';

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

console.log('\n=== Test 1 : payload complet ===');
(() => {
  const payload: AnalysisPayloadForSnapshot = {
    analysisId: 'analysis-123',
    analyzedAt: '2026-05-09T12:00:00Z',
    mechanicalScore: {
      globalScore: 67,
      verdict: 'investir avec conditions',
      dimensions: {
        team: { score: 72 }, market: { score: 68 }, macro: { score: 60 },
        financial: { score: 65 }, contrarian: { score: 70 }, vigilance: { score: 55 },
      },
    },
    fragiliteStructurelle: {
      globalFragilityScore: 45,
      verdict: 'attention',
      patterns: {
        'growth-subsidized-model': { globalScore: 50, verdict: 'attention', applicabilite: 'full' },
        'fixed-cost-trap': { globalScore: 30, verdict: 'sain', applicabilite: 'full' },
        'commoditization-drift': { globalScore: 0, verdict: 'non-applicable', applicabilite: 'not-applicable' },
      },
      combinaisons: [],
    },
    narrativeDrift: { globalDriftScore: 25, verdict: 'sain' },
  };
  const snap = extractSnapshot(payload);
  checkTrue('snapshot non null', !!snap);
  if (!snap) return;
  check('analysisId', snap.analysisId, 'analysis-123');
  check('analyzedAt', snap.analyzedAt, '2026-05-09T12:00:00Z');
  check('globalScore', snap.globalScore, 67);
  check('verdict', snap.verdict, 'investir avec conditions');
  check('team dim', snap.dimensions.team, 72);
  check('vigilance dim', snap.dimensions.vigilance, 55);
  check('fragiliteScore', snap.fragiliteScore, 45);
  check('fragiliteVerdict', snap.fragiliteVerdict, 'attention');
  check('narrativeDriftScore', snap.narrativeDriftScore, 25);
  check('narrativeDriftVerdict', snap.narrativeDriftVerdict, 'sain');
  check('growth-subsidized score', snap.patterns['growth-subsidized-model']?.score, 50);
  check('growth-subsidized applicabilite', snap.patterns['growth-subsidized-model']?.applicabilite, 'full');
  check('commoditization-drift verdict', snap.patterns['commoditization-drift']?.verdict, 'non-applicable');
})();

console.log('\n=== Test 2 : payload legacy sans Phase 4 ===');
(() => {
  const payload: AnalysisPayloadForSnapshot = {
    analysisId: 'old-analysis',
    analyzedAt: '2025-08-01T00:00:00Z',
    mechanicalScore: {
      globalScore: 60,
      verdict: 'investir avec conditions',
      dimensions: {
        team: { score: 65 }, market: { score: 60 }, macro: { score: 55 },
        financial: { score: 70 }, contrarian: { score: 60 }, vigilance: { score: 50 },
      },
    },
  };
  const snap = extractSnapshot(payload);
  checkTrue('snapshot non null', !!snap);
  if (!snap) return;
  check('fragiliteScore null', snap.fragiliteScore, null);
  check('fragiliteVerdict null', snap.fragiliteVerdict, null);
  check('narrativeDriftScore null', snap.narrativeDriftScore, null);
  check('aucun pattern dans patterns', Object.keys(snap.patterns).length, 0);
  check('aucune combinaison', snap.combinaisons.length, 0);
})();

console.log('\n=== Test 3 : payload minimal sans dimensions ===');
(() => {
  const payload: AnalysisPayloadForSnapshot = {
    id: 'minimal-analysis',
    timestamp: '2026-01-01T00:00:00Z',
    globalScore: 50,
    verdict: 'approfondir',
  };
  const snap = extractSnapshot(payload);
  checkTrue('snapshot non null malgre format minimal', !!snap);
  if (!snap) return;
  check('id alternatif accepte', snap.analysisId, 'minimal-analysis');
  check('timestamp alternatif accepte', snap.analyzedAt, '2026-01-01T00:00:00Z');
  check('verdict accepte', snap.verdict, 'approfondir');
  check('team dim fallback globalScore', snap.dimensions.team, 50);
  check('vigilance dim fallback globalScore', snap.dimensions.vigilance, 50);
})();

console.log('\n=== Test 4 : payload sans id ===');
(() => {
  const snap = extractSnapshot({ analyzedAt: '2026-01-01T00:00:00Z', globalScore: 50 });
  check('snapshot null si pas d id', snap, null);
})();

console.log('\n=== Test 5 : payload sans timestamp ===');
(() => {
  const snap = extractSnapshot({ analysisId: 'foo', globalScore: 50 });
  check('snapshot null si pas de timestamp', snap, null);
})();

console.log('\n=== Test 6 : payload sans score ===');
(() => {
  const snap = extractSnapshot({ analysisId: 'foo', analyzedAt: '2026-01-01T00:00:00Z' });
  check('snapshot null si pas de score', snap, null);
})();

console.log('\n=== Test 7 : combinaisons malformees filtrees ===');
(() => {
  const payload: AnalysisPayloadForSnapshot = {
    analysisId: 'foo',
    analyzedAt: '2026-01-01T00:00:00Z',
    globalScore: 50,
    verdict: 'investir avec conditions',
    fragiliteStructurelle: {
      globalFragilityScore: 60,
      verdict: 'alerte',
      combinaisons: [
        { nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' },
        { nom: 'Pattern Britishvolt', severite: 'alerte' },
        { nom: '', severite: 'alerte' } as any,
        { severite: 'alerte' } as any,
        null as any,
      ],
    },
  };
  const snap = extractSnapshot(payload);
  checkTrue('snapshot non null', !!snap);
  if (!snap) return;
  check('2 combinaisons valides preservees', snap.combinaisons.length, 2);
  check('Trajectoire WeWork preservee', snap.combinaisons[0]?.nom, 'Trajectoire WeWork');
  check('Pattern Britishvolt preservee', snap.combinaisons[1]?.nom, 'Pattern Britishvolt');
})();

console.log('\n=== Test 8 : score venant de finalRecommendation ===');
(() => {
  const payload: AnalysisPayloadForSnapshot = {
    analysisId: 'compat',
    analyzedAt: '2026-01-01T00:00:00Z',
    finalRecommendation: { globalScore: 72, verdict: 'investir' },
  };
  const snap = extractSnapshot(payload);
  checkTrue('snapshot non null', !!snap);
  if (!snap) return;
  check('score lu depuis finalRecommendation', snap.globalScore, 72);
  check('verdict lu depuis finalRecommendation', snap.verdict, 'investir');
})();

console.log('\n=== Test 9 : priorite des sources de score ===');
(() => {
  const payload: AnalysisPayloadForSnapshot = {
    analysisId: 'priority',
    analyzedAt: '2026-01-01T00:00:00Z',
    globalScore: 30,
    verdict: 'refuser',
    finalRecommendation: { globalScore: 50, verdict: 'approfondir' },
    mechanicalScore: { globalScore: 70, verdict: 'investir avec conditions' },
  };
  const snap = extractSnapshot(payload);
  checkTrue('snapshot non null', !!snap);
  if (!snap) return;
  check('mechanicalScore prioritaire sur tout', snap.globalScore, 70);
  check('verdict mechanicalScore prioritaire', snap.verdict, 'investir avec conditions');
})();

console.log('\n=== Test 10 : Phase 4 patterns mixtes ===');
(() => {
  const payload: AnalysisPayloadForSnapshot = {
    analysisId: 'phase4-mixed',
    analyzedAt: '2026-05-09T00:00:00Z',
    mechanicalScore: { globalScore: 55, verdict: 'investir avec conditions' },
    fragiliteStructurelle: {
      globalFragilityScore: 65,
      verdict: 'alerte',
      patterns: {
        'growth-subsidized-model': { globalScore: 70, verdict: 'alerte', applicabilite: 'full' },
        'fixed-cost-trap': { globalScore: 65, verdict: 'alerte', applicabilite: 'full' },
        'infrastructure-hostage': { globalScore: 0, verdict: 'non-applicable', applicabilite: 'not-applicable' },
        'regulatory-time-bomb': { globalScore: 40, verdict: 'attention', applicabilite: 'partial' },
      },
      combinaisons: [{ nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' }],
    },
  };
  const snap = extractSnapshot(payload);
  checkTrue('snapshot non null', !!snap);
  if (!snap) return;
  check('growth-subsidized score', snap.patterns['growth-subsidized-model']?.score, 70);
  check('fixed-cost-trap verdict alerte', snap.patterns['fixed-cost-trap']?.verdict, 'alerte');
  check('infrastructure-hostage non applicable', snap.patterns['infrastructure-hostage']?.applicabilite, 'not-applicable');
  check('regulatory-time-bomb partial', snap.patterns['regulatory-time-bomb']?.applicabilite, 'partial');
  check('1 combinaison drapeau-rouge', snap.combinaisons.length, 1);
  check('combinaison Trajectoire WeWork', snap.combinaisons[0]?.nom, 'Trajectoire WeWork');
})();

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
