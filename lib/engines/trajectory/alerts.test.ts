// ============================================================
// Tests Score de Trajectoire - Module d alertes hierarchise
// ------------------------------------------------------------
// Couvre la classification cran par cran, les edge cases
// (premier snapshot sans baseline geree en amont, snapshots
// identiques, transitions multiples simultanees) et les
// utilitaires getHighestCran et filterAlertsByCran.
//
// Lancement : npx tsx lib/engines/trajectory/alerts.test.ts
// ============================================================

import {
  evaluateTrajectoryAlerts,
  getHighestCran,
  filterAlertsByCran,
  isCriticalFragilityDowngrade,
  type TrajectoryAlert,
} from './alerts';
import { compareAnalyses } from './comparator';
import type { TrajectorySnapshot } from './types';

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
// Helpers de mock snapshot
// ============================================================

function mockSnapshot(opts: Partial<TrajectorySnapshot> = {}): TrajectorySnapshot {
  return {
    analysisId: 'test-id',
    analyzedAt: '2026-01-01T00:00:00Z',
    globalScore: 60,
    verdict: 'investir avec conditions',
    dimensions: {
      team: 60,
      market: 60,
      macro: 60,
      financial: 60,
      contrarian: 60,
      vigilance: 60,
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

// ============================================================
// Test 1 : isCriticalFragilityDowngrade
// ============================================================

console.log('\n=== Test 1 : isCriticalFragilityDowngrade ===');
{
  checkTrue('sain -> alerte = critique', isCriticalFragilityDowngrade('sain', 'alerte'));
  checkTrue('sain -> drapeau-rouge = critique', isCriticalFragilityDowngrade('sain', 'drapeau-rouge'));
  checkTrue('attention -> drapeau-rouge = critique', isCriticalFragilityDowngrade('attention', 'drapeau-rouge'));
  check('sain -> attention = pas critique', isCriticalFragilityDowngrade('sain', 'attention'), false);
  check('attention -> alerte = pas critique', isCriticalFragilityDowngrade('attention', 'alerte'), false);
  check('sain -> sain = pas critique', isCriticalFragilityDowngrade('sain', 'sain'), false);
  check('null ou undefined = pas critique', isCriticalFragilityDowngrade(null, 'drapeau-rouge'), false);
  check('upgrade = pas critique', isCriticalFragilityDowngrade('alerte', 'sain'), false);
}

// ============================================================
// Test 2 : CRAN 1a - combinaison drapeau-rouge apparue
// ============================================================

console.log('\n=== Test 2 : Cran 1a combinaison drapeau-rouge apparue ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    combinaisons: [{ nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' }],
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran1 = filterAlertsByCran(alerts, 1);
  checkTrue('au moins une alerte cran 1', cran1.length >= 1);
  checkTrue('tag combinaison-drapeau-rouge present', cran1.some(a => a.tag === 'combinaison-drapeau-rouge-apparue'));
  const a1 = cran1.find(a => a.tag === 'combinaison-drapeau-rouge-apparue')!;
  checkTrue('raison cite la combinaison', a1.raison.includes('Trajectoire WeWork'));
  checkTrue('recommandation parle d examen immediat', a1.recommandation.includes('immédiatement'));
}

// ============================================================
// Test 3 : CRAN 1a - combinaison alerte n est PAS cran 1
// ============================================================

console.log('\n=== Test 3 : Cran 1a combinaison alerte pas cran 1 ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    combinaisons: [{ nom: 'Pattern Britishvolt', severite: 'alerte' }],
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran1 = filterAlertsByCran(alerts, 1);
  checkTrue('aucune alerte cran 1', cran1.length === 0);
}

// ============================================================
// Test 4 : CRAN 1b - verdict fragilite sain vers alerte
// ============================================================

console.log('\n=== Test 4 : Cran 1b sain -> alerte ===');
{
  const before = mockSnapshot({ fragiliteVerdict: 'sain', fragiliteScore: 30 });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    fragiliteVerdict: 'alerte',
    fragiliteScore: 70,
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran1 = filterAlertsByCran(alerts, 1);
  checkTrue('tag fragilite-globale present', cran1.some(a => a.tag === 'fragilite-globale-downgrade-critique'));
  const a1 = cran1.find(a => a.tag === 'fragilite-globale-downgrade-critique')!;
  checkTrue('raison cite sain et alerte', a1.raison.includes('sain') && a1.raison.includes('alerte'));
  checkTrue('citations contiennent score delta', a1.citations.some(c => c.includes('30') && c.includes('70')));
}

// ============================================================
// Test 5 : CRAN 1b - sain vers drapeau-rouge
// ============================================================

console.log('\n=== Test 5 : Cran 1b sain -> drapeau-rouge ===');
{
  const before = mockSnapshot({ fragiliteVerdict: 'sain' });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    fragiliteVerdict: 'drapeau-rouge',
    fragiliteScore: 85,
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran1 = filterAlertsByCran(alerts, 1);
  checkTrue('cran 1 fragilite declenche', cran1.some(a => a.tag === 'fragilite-globale-downgrade-critique'));
}

// ============================================================
// Test 6 : CRAN 1b - attention vers drapeau-rouge
// ============================================================

console.log('\n=== Test 6 : Cran 1b attention -> drapeau-rouge ===');
{
  const before = mockSnapshot({ fragiliteVerdict: 'attention', fragiliteScore: 55 });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    fragiliteVerdict: 'drapeau-rouge',
    fragiliteScore: 85,
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran1 = filterAlertsByCran(alerts, 1);
  checkTrue('cran 1 fragilite declenche', cran1.some(a => a.tag === 'fragilite-globale-downgrade-critique'));
}

// ============================================================
// Test 7 : CRAN 1b - sain vers attention n est PAS cran 1
// ============================================================

console.log('\n=== Test 7 : Cran 1b sain -> attention pas cran 1 ===');
{
  const before = mockSnapshot({ fragiliteVerdict: 'sain' });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    fragiliteVerdict: 'attention',
    fragiliteScore: 50,
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran1 = filterAlertsByCran(alerts, 1);
  check('pas de cran 1 fragilite (sain -> attention)', cran1.find(a => a.tag === 'fragilite-globale-downgrade-critique'), undefined);
}

// ============================================================
// Test 8 : CRAN 2a - score global chute >= 20 points
// ============================================================

console.log('\n=== Test 8 : Cran 2a chute >= 20 points ===');
{
  const before = mockSnapshot({ globalScore: 75 });
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z', globalScore: 50 });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran2 = filterAlertsByCran(alerts, 2);
  checkTrue('tag score-global-chute-20 declenche', cran2.some(a => a.tag === 'score-global-chute-20'));
  const a2 = cran2.find(a => a.tag === 'score-global-chute-20')!;
  checkTrue('raison cite 25 points', a2.raison.includes('25'));
}

// ============================================================
// Test 9 : CRAN 2a - chute exactement 20 declenche
// ============================================================

console.log('\n=== Test 9 : Cran 2a seuil exact 20 ===');
{
  const before = mockSnapshot({ globalScore: 70 });
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z', globalScore: 50 });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran2 = filterAlertsByCran(alerts, 2);
  checkTrue('chute exactement 20 declenche cran 2', cran2.some(a => a.tag === 'score-global-chute-20'));
}

// ============================================================
// Test 10 : CRAN 2a - chute 19 ne declenche PAS cran 2
// ============================================================

console.log('\n=== Test 10 : Cran 2a chute 19 pas cran 2 ===');
{
  const before = mockSnapshot({ globalScore: 65 });
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z', globalScore: 46 });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran2 = filterAlertsByCran(alerts, 2);
  check('pas de cran 2 score (chute 19)', cran2.find(a => a.tag === 'score-global-chute-20'), undefined);
  // En revanche cran 3 score-global-chute-10 devrait declencher
  const cran3 = filterAlertsByCran(alerts, 3);
  checkTrue('cran 3 score-chute-10 declenche en remplacement', cran3.some(a => a.tag === 'score-global-chute-10'));
}

// ============================================================
// Test 11 : CRAN 2b - newly-applicable en alerte
// ============================================================

console.log('\n=== Test 11 : Cran 2b newly-applicable alerte ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'scale-mirage-risk': { score: 75, verdict: 'alerte', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran2 = filterAlertsByCran(alerts, 2);
  checkTrue('tag pattern-nouveau-actif-critique declenche', cran2.some(a => a.tag === 'pattern-nouveau-actif-critique'));
  const a2 = cran2.find(a => a.tag === 'pattern-nouveau-actif-critique')!;
  checkTrue('raison cite scale-mirage', a2.raison.includes('scale-mirage'));
}

// ============================================================
// Test 12 : CRAN 2b - newly-applicable en attention PAS cran 2
// ============================================================

console.log('\n=== Test 12 : Cran 2b newly-applicable attention pas cran 2 ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'scale-mirage-risk': { score: 50, verdict: 'attention', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran2 = filterAlertsByCran(alerts, 2);
  check('pas de cran 2 (newly-applicable attention)', cran2.find(a => a.tag === 'pattern-nouveau-actif-critique'), undefined);
}

// ============================================================
// Test 13 : CRAN 3a - pattern sain vers attention
// ============================================================

console.log('\n=== Test 13 : Cran 3a sain -> attention ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': { score: 50, verdict: 'attention', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran3 = filterAlertsByCran(alerts, 3);
  checkTrue('tag pattern-sain-vers-non-sain declenche', cran3.some(a => a.tag === 'pattern-sain-vers-non-sain'));
  const a3 = cran3.find(a => a.tag === 'pattern-sain-vers-non-sain')!;
  checkTrue('raison cite growth-subsidized et attention', a3.raison.includes('growth-subsidized') && a3.raison.includes('attention'));
  checkTrue('recommandation mentionne digest hebdomadaire', a3.recommandation.includes('digest hebdomadaire'));
}

// ============================================================
// Test 14 : CRAN 3a - pattern sain vers alerte
// ============================================================

console.log('\n=== Test 14 : Cran 3a sain -> alerte ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': { score: 70, verdict: 'alerte', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran3 = filterAlertsByCran(alerts, 3);
  checkTrue('sain -> alerte aussi capture en cran 3', cran3.some(a => a.tag === 'pattern-sain-vers-non-sain'));
}

// ============================================================
// Test 15 : CRAN 3a - attention vers alerte PAS cran 3a
// ============================================================

console.log('\n=== Test 15 : Cran 3a attention -> alerte pas cran 3a ===');
{
  const before = mockSnapshot({
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': { score: 50, verdict: 'attention', applicabilite: 'full' },
    },
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': { score: 70, verdict: 'alerte', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran3 = filterAlertsByCran(alerts, 3);
  check('pas de pattern-sain-vers-non-sain (attention -> alerte)', cran3.find(a => a.tag === 'pattern-sain-vers-non-sain'), undefined);
}

// ============================================================
// Test 16 : CRAN 3b - score chute 10-19 sans cran 1/2
// ============================================================

console.log('\n=== Test 16 : Cran 3b chute 15 sans cran 1/2 ===');
{
  const before = mockSnapshot({ globalScore: 70 });
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z', globalScore: 55 });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran3 = filterAlertsByCran(alerts, 3);
  checkTrue('cran 3 score-chute-10 declenche', cran3.some(a => a.tag === 'score-global-chute-10'));
}

// ============================================================
// Test 17 : CRAN 3b - score chute 15 supprime si cran 1/2 declenche
// ============================================================

console.log('\n=== Test 17 : Cran 3b supprime si cran 1 declenche ===');
{
  const before = mockSnapshot({ globalScore: 70, fragiliteVerdict: 'sain' });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    globalScore: 55,
    fragiliteVerdict: 'drapeau-rouge',
    fragiliteScore: 85,
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran1 = filterAlertsByCran(alerts, 1);
  const cran3 = filterAlertsByCran(alerts, 3);
  checkTrue('cran 1 declenche', cran1.length > 0);
  check('cran 3b score-chute-10 supprime', cran3.find(a => a.tag === 'score-global-chute-10'), undefined);
}

// ============================================================
// Test 18 : CRAN 3c - axe identitaire downgrade
// ============================================================

console.log('\n=== Test 18 : Cran 3c axe identitaire downgrade ===');
{
  const before = mockSnapshot({
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': {
        score: 40,
        verdict: 'attention',
        applicabilite: 'full',
        axes: {
          axis1: { score: 40, verdict: 'sain' },
          axis2: { score: 45, verdict: 'sain' },
          axis3: { score: 35, verdict: 'sain' },
        },
      },
    },
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': {
        score: 55,
        verdict: 'attention',
        applicabilite: 'full',
        axes: {
          axis1: { score: 75, verdict: 'alerte' },
          axis2: { score: 50, verdict: 'attention' },
          axis3: { score: 35, verdict: 'sain' },
        },
      },
    },
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran3 = filterAlertsByCran(alerts, 3);
  checkTrue('cran 3 axe-identitaire-downgrade declenche', cran3.some(a => a.tag === 'axe-identitaire-downgrade'));
  const a3 = cran3.find(a => a.tag === 'axe-identitaire-downgrade')!;
  checkTrue('raison cite growth-subsidized et sain alerte', a3.raison.includes('growth-subsidized') && a3.raison.includes('alerte'));
}

// ============================================================
// Test 19 : CRAN 3c - axe identitaire maintenu pas de declenchement
// ============================================================

console.log('\n=== Test 19 : Cran 3c axis1 maintenu pas de cran 3c ===');
{
  const before = mockSnapshot({
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': {
        score: 40,
        verdict: 'attention',
        applicabilite: 'full',
        axes: {
          axis1: { score: 40, verdict: 'sain' },
          axis2: { score: 45, verdict: 'sain' },
          axis3: { score: 35, verdict: 'sain' },
        },
      },
    },
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': {
        score: 45,
        verdict: 'attention',
        applicabilite: 'full',
        axes: {
          axis1: { score: 42, verdict: 'sain' },
          axis2: { score: 70, verdict: 'alerte' },
          axis3: { score: 38, verdict: 'sain' },
        },
      },
    },
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran3 = filterAlertsByCran(alerts, 3);
  check('pas de cran 3c (axis1 maintenu sain)', cran3.find(a => a.tag === 'axe-identitaire-downgrade'), undefined);
}

// ============================================================
// Test 20 : CRAN 4 - variation sub-significative
// ============================================================

console.log('\n=== Test 20 : Cran 4 stable ===');
{
  const before = mockSnapshot({ globalScore: 60 });
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z', globalScore: 62 });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  check('exactement une alerte', alerts.length, 1);
  check('alerte est cran 4', alerts[0].cran, 4);
  check('tag variation-sub-significative', alerts[0].tag, 'variation-sub-significative');
}

// ============================================================
// Test 21 : CRAN 4 - snapshots identiques
// ============================================================

console.log('\n=== Test 21 : snapshots identiques ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z' });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  check('une seule alerte cran 4', alerts.length, 1);
  check('cran 4', alerts[0].cran, 4);
}

// ============================================================
// Test 22 : CRAN 4 supprime si alertes superieures
// ============================================================

console.log('\n=== Test 22 : Cran 4 supprime si autre alerte ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    combinaisons: [{ nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' }],
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const cran4 = filterAlertsByCran(alerts, 4);
  check('aucun cran 4 si cran 1 declenche', cran4.length, 0);
}

// ============================================================
// Test 23 : Transitions multiples simultanees
// ============================================================

console.log('\n=== Test 23 : transitions multiples simultanees ===');
{
  // Scenario : score chute 25, combinaison drapeau-rouge apparue,
  // fragilite globale sain -> alerte, pattern sain -> attention,
  // axe identitaire d un pattern downgrade.
  const before = mockSnapshot({
    globalScore: 75,
    fragiliteVerdict: 'sain',
    fragiliteScore: 30,
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': {
        score: 30,
        verdict: 'sain',
        applicabilite: 'full',
        axes: {
          axis1: { score: 30, verdict: 'sain' },
          axis2: { score: 30, verdict: 'sain' },
          axis3: { score: 30, verdict: 'sain' },
        },
      },
    },
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    globalScore: 50,
    fragiliteVerdict: 'alerte',
    fragiliteScore: 75,
    combinaisons: [{ nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' }],
    patterns: {
      ...mockSnapshot().patterns,
      'growth-subsidized-model': {
        score: 60,
        verdict: 'attention',
        applicabilite: 'full',
        axes: {
          axis1: { score: 75, verdict: 'alerte' },
          axis2: { score: 50, verdict: 'attention' },
          axis3: { score: 40, verdict: 'sain' },
        },
      },
    },
  });
  const c = compareAnalyses(before, after);
  const alerts = evaluateTrajectoryAlerts(c);
  const tags = alerts.map(a => a.tag);
  checkTrue('combinaison-drapeau-rouge present', tags.includes('combinaison-drapeau-rouge-apparue'));
  checkTrue('fragilite-globale-downgrade present', tags.includes('fragilite-globale-downgrade-critique'));
  checkTrue('score-chute-20 present', tags.includes('score-global-chute-20'));
  checkTrue('pattern-sain-vers-non-sain present', tags.includes('pattern-sain-vers-non-sain'));
  checkTrue('axe-identitaire-downgrade present', tags.includes('axe-identitaire-downgrade'));
  // Pas de cran 3b parce que cran 1/2 ont fire
  check('pas de score-global-chute-10', tags.includes('score-global-chute-10'), false);
  // Pas de cran 4 parce que d autres alertes existent
  check('pas de variation-sub-significative', tags.includes('variation-sub-significative'), false);
}

// ============================================================
// Test 24 : getHighestCran
// ============================================================

console.log('\n=== Test 24 : getHighestCran ===');
{
  const liste1: TrajectoryAlert[] = [
    { cran: 3, tag: 't1', raison: 'r', citations: [], recommandation: '' },
    { cran: 1, tag: 't2', raison: 'r', citations: [], recommandation: '' },
    { cran: 2, tag: 't3', raison: 'r', citations: [], recommandation: '' },
  ];
  check('plus haut cran = 1', getHighestCran(liste1), 1);

  const liste2: TrajectoryAlert[] = [
    { cran: 4, tag: 't', raison: 'r', citations: [], recommandation: '' },
  ];
  check('seul cran 4 retourne 4', getHighestCran(liste2), 4);

  check('liste vide retourne null', getHighestCran([]), null);
}

// ============================================================
// Test 25 : filterAlertsByCran
// ============================================================

console.log('\n=== Test 25 : filterAlertsByCran ===');
{
  const liste: TrajectoryAlert[] = [
    { cran: 1, tag: 't1', raison: 'r', citations: [], recommandation: '' },
    { cran: 3, tag: 't2', raison: 'r', citations: [], recommandation: '' },
    { cran: 1, tag: 't3', raison: 'r', citations: [], recommandation: '' },
    { cran: 2, tag: 't4', raison: 'r', citations: [], recommandation: '' },
  ];
  check('filtre cran 1 retourne 2', filterAlertsByCran(liste, 1).length, 2);
  check('filtre cran 3 retourne 1', filterAlertsByCran(liste, 3).length, 1);
  check('filtre cran 4 retourne 0', filterAlertsByCran(liste, 4).length, 0);
}

// ============================================================
// FIN
// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
