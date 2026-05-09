// ============================================================
// Tests Score de Trajectoire - Comparator
// ============================================================

import {
  compareAnalyses,
  computeScoreDelta,
  computeVerdictTransition,
  computePatternVerdictTransition,
  computeDaysBetween,
} from './comparator';
import type { TrajectorySnapshot } from './types';

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

// ============================================================
// Test 1 : computeScoreDelta avec direction
// ============================================================

console.log('\n=== Test 1 : computeScoreDelta ===');
{
  const d1 = computeScoreDelta(50, 60);
  check('amelioration delta=10', d1.delta, 10);
  check('amelioration direction', d1.direction, 'amelioration');

  const d2 = computeScoreDelta(60, 50);
  check('aggravation delta=-10', d2.delta, -10);
  check('aggravation direction', d2.direction, 'aggravation');

  const d3 = computeScoreDelta(50, 53);
  check('stable delta=3', d3.delta, 3);
  check('stable direction (sous tolerance 5)', d3.direction, 'stable');

  const d4 = computeScoreDelta(50, 55);
  check('amelioration au seuil exact 5', d4.direction, 'amelioration');

  const d5 = computeScoreDelta(50, 45);
  check('aggravation au seuil exact -5', d5.direction, 'aggravation');
}

// ============================================================
// Test 2 : computeVerdictTransition
// ============================================================

console.log('\n=== Test 2 : computeVerdictTransition ===');
{
  const t1 = computeVerdictTransition('refuser', 'investir');
  check('refuser -> investir = upgraded', t1.type, 'upgraded');

  const t2 = computeVerdictTransition('investir', 'approfondir');
  check('investir -> approfondir = downgraded', t2.type, 'downgraded');

  const t3 = computeVerdictTransition('approfondir', 'approfondir');
  check('approfondir -> approfondir = maintained', t3.type, 'maintained');

  const t4 = computeVerdictTransition('investir avec conditions', 'investir');
  check('investir avec conditions -> investir = upgraded', t4.type, 'upgraded');

  // Casse insensible
  const t5 = computeVerdictTransition('REFUSER' as any, 'INVESTIR' as any);
  check('REFUSER -> INVESTIR (case insensitive) = upgraded', t5.type, 'upgraded');
}

// ============================================================
// Test 3 : computePatternVerdictTransition
// ============================================================

console.log('\n=== Test 3 : computePatternVerdictTransition ===');
{
  const t1 = computePatternVerdictTransition('drapeau-rouge', 'sain');
  check('drapeau-rouge -> sain = upgraded', t1.type, 'upgraded');

  const t2 = computePatternVerdictTransition('sain', 'drapeau-rouge');
  check('sain -> drapeau-rouge = downgraded', t2.type, 'downgraded');

  const t3 = computePatternVerdictTransition('attention', 'attention');
  check('attention -> attention = maintained', t3.type, 'maintained');

  const t4 = computePatternVerdictTransition('non-applicable', 'alerte');
  check('non-applicable -> alerte = newly-applicable', t4.type, 'newly-applicable');

  const t5 = computePatternVerdictTransition('alerte', 'non-applicable');
  check('alerte -> non-applicable = newly-not-applicable', t5.type, 'newly-not-applicable');

  const t6 = computePatternVerdictTransition('non-applicable', 'non-applicable');
  check('non-applicable -> non-applicable = maintained', t6.type, 'maintained');
}

// ============================================================
// Test 4 : computeDaysBetween
// ============================================================

console.log('\n=== Test 4 : computeDaysBetween ===');
{
  const d1 = computeDaysBetween('2026-01-01T00:00:00Z', '2026-01-15T00:00:00Z');
  check('14 jours', d1, 14);

  const d2 = computeDaysBetween('2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z');
  check('meme date = 0 jours', d2, 0);

  const d3 = computeDaysBetween('invalid', '2026-05-01T00:00:00Z');
  check('date invalide = 0', d3, 0);

  const d4 = computeDaysBetween('2026-05-15T00:00:00Z', '2026-05-01T00:00:00Z');
  check('after avant before = absolu (14 jours)', d4, 14);
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
      team: 65,
      market: 60,
      macro: 55,
      financial: 70,
      contrarian: 60,
      vigilance: 50,
    },
    fragiliteScore: 40,
    fragiliteVerdict: 'attention',
    narrativeDriftScore: 30,
    narrativeDriftVerdict: 'sain',
    patterns: {
      'growth-subsidized-model': { score: 40, verdict: 'attention', applicabilite: 'full' },
      'fixed-cost-trap': { score: 30, verdict: 'sain', applicabilite: 'full' },
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
// Test 5 : compareAnalyses scenario stabilisation
// ============================================================

console.log('\n=== Test 5 : trajectoire stabilisation ===');
{
  const before = mockSnapshot({ analyzedAt: '2026-01-01T00:00:00Z', globalScore: 60 });
  const after = mockSnapshot({ analyzedAt: '2026-01-15T00:00:00Z', globalScore: 62 });
  const c = compareAnalyses(before, after);

  check('14 jours entre les deux', c.daysBetween, 14);
  check('globalScore delta = 2', c.globalScoreDelta.delta, 2);
  check('direction stable (sous tolerance)', c.globalScoreDelta.direction, 'stable');
  check('verdict maintained', c.verdictTransition.type, 'maintained');
  check('trajectoire stabilisation', c.trajectoireGlobale, 'stabilisation');
  checkTrue('synthese mentionne stabilisation', c.syntheseTrajectoire.includes('stabilisation'));
}

// ============================================================
// Test 6 : compareAnalyses scenario aggravation forte
// ============================================================

console.log('\n=== Test 6 : trajectoire aggravation avec downgrade verdict ===');
{
  const before = mockSnapshot({
    analyzedAt: '2026-01-01T00:00:00Z',
    globalScore: 70,
    verdict: 'investir avec conditions',
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    globalScore: 50,
    verdict: 'approfondir',
  });
  const c = compareAnalyses(before, after);

  check('globalScore delta = -20', c.globalScoreDelta.delta, -20);
  check('aggravation', c.globalScoreDelta.direction, 'aggravation');
  check('verdict downgraded', c.verdictTransition.type, 'downgraded');
  check('trajectoire aggravation', c.trajectoireGlobale, 'aggravation');
  checkTrue('top alertes contient downgrade', c.topAlertesTrajectoire.some(a => a.includes('Downgrade')));
  checkTrue('top alertes contient score en baisse', c.topAlertesTrajectoire.some(a => a.includes('Score global en baisse')));
}

// ============================================================
// Test 7 : compareAnalyses combinaisons apparues
// ============================================================

console.log('\n=== Test 7 : trajectoire avec nouvelle combinaison drapeau-rouge ===');
{
  const before = mockSnapshot({
    globalScore: 55,
    combinaisons: [],
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    globalScore: 48,
    combinaisons: [
      { nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' },
    ],
  });
  const c = compareAnalyses(before, after);

  check('1 combinaison apparue', c.combinaisonsApparues.length, 1);
  check('combinaison apparue Trajectoire WeWork', c.combinaisonsApparues[0]?.nom, 'Trajectoire WeWork');
  check('0 combinaison resolue', c.combinaisonsResolues.length, 0);
  check('trajectoire aggravation (combinaison drapeau-rouge nouvelle)', c.trajectoireGlobale, 'aggravation');
  checkTrue('alerte contient nouvelle combinaison', c.topAlertesTrajectoire.some(a => a.includes('Trajectoire WeWork')));
  checkTrue('synthese mentionne drapeau-rouge', c.syntheseTrajectoire.toLowerCase().includes('drapeau-rouge'));
}

// ============================================================
// Test 8 : combinaison resolue
// ============================================================

console.log('\n=== Test 8 : trajectoire avec combinaison resolue ===');
{
  const before = mockSnapshot({
    globalScore: 55,
    combinaisons: [
      { nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' },
    ],
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    globalScore: 65,
    combinaisons: [],
  });
  const c = compareAnalyses(before, after);

  check('1 combinaison resolue', c.combinaisonsResolues.length, 1);
  check('combinaison resolue Trajectoire WeWork', c.combinaisonsResolues[0]?.nom, 'Trajectoire WeWork');
  check('0 combinaison apparue', c.combinaisonsApparues.length, 0);
  check('amelioration', c.trajectoireGlobale, 'amelioration');
  checkTrue('synthese mentionne resolue', c.syntheseTrajectoire.toLowerCase().includes('resolue'));
}

// ============================================================
// Test 9 : volatilite (signaux contradictoires)
// ============================================================

console.log('\n=== Test 9 : trajectoire volatilite ===');
{
  const before = mockSnapshot({
    globalScore: 45,
    verdict: 'approfondir',
    combinaisons: [],
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    globalScore: 65,  // amelioration
    verdict: 'investir avec conditions',  // upgraded
    combinaisons: [
      { nom: 'Pattern Britishvolt', severite: 'drapeau-rouge' },  // mais nouveau drapeau rouge
    ],
  });
  const c = compareAnalyses(before, after);

  check('amelioration score', c.globalScoreDelta.direction, 'amelioration');
  check('upgrade verdict', c.verdictTransition.type, 'upgraded');
  check('combinaison drapeau-rouge nouvelle', c.combinaisonsApparues.length, 1);
  check('volatilite (signaux contradictoires)', c.trajectoireGlobale, 'volatilite');
}

// ============================================================
// Test 10 : pattern delta avec passage en applicable
// ============================================================

console.log('\n=== Test 10 : pattern devient applicable ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      ...mockSnapshot().patterns,
      'commoditization-drift': { score: 75, verdict: 'alerte', applicabilite: 'full' },
    },
  });
  const c = compareAnalyses(before, after);

  const driftDelta = c.patternsDeltas['commoditization-drift'];
  checkTrue('commoditization-drift dans patternsDeltas', !!driftDelta);
  check('verdict transition newly-applicable', driftDelta?.verdictTransition.type, 'newly-applicable');
  check('scoreDelta null car etait non-applicable', driftDelta?.scoreDelta, null);
}

// ============================================================
// Test 11 : pattern reste non-applicable des deux cotes -> omis
// ============================================================

console.log('\n=== Test 11 : pattern non applicable des deux cotes ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z' });
  const c = compareAnalyses(before, after);

  // commoditization-drift est non-applicable dans les deux mocks par defaut
  checkTrue('commoditization-drift omis du resultat', !c.patternsDeltas['commoditization-drift']);
  checkTrue('infrastructure-hostage omis du resultat', !c.patternsDeltas['infrastructure-hostage']);
  // En revanche growth-subsidized-model et fixed-cost-trap sont actifs
  checkTrue('growth-subsidized-model present', !!c.patternsDeltas['growth-subsidized-model']);
}

// ============================================================
// Test 12 : pattern applicable, score evolue
// ============================================================

console.log('\n=== Test 12 : pattern score evolue ===');
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

  const gsmDelta = c.patternsDeltas['growth-subsidized-model'];
  check('scoreDelta = 30 (40 -> 70)', gsmDelta?.scoreDelta?.delta, 30);
  check('verdict transition downgraded (attention -> alerte)', gsmDelta?.verdictTransition.type, 'downgraded');
}

// ============================================================
// Test 13 : dimensions delta dans top alertes
// ============================================================

console.log('\n=== Test 13 : dimension en chute remonte en alerte ===');
{
  const before = mockSnapshot();
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    dimensions: {
      ...mockSnapshot().dimensions,
      team: 50,  // chute de 65 -> 50 = -15 points
    },
  });
  const c = compareAnalyses(before, after);

  check('team delta = -15', c.dimensionsDeltas.team.delta, -15);
  checkTrue('alerte sur dimension team', c.topAlertesTrajectoire.some(a => a.includes('team') && a.includes('-15')));
}

// ============================================================
// Test 14 : Fragilite et Narrative Drift deltas
// ============================================================

console.log('\n=== Test 14 : Fragilite et Narrative Drift deltas ===');
{
  const before = mockSnapshot({ fragiliteScore: 40, narrativeDriftScore: 30 });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    fragiliteScore: 60,
    narrativeDriftScore: 25,
  });
  const c = compareAnalyses(before, after);

  check('fragiliteDelta delta = 20', c.fragiliteDelta?.delta, 20);
  check('fragiliteDelta direction aggravation (Fragilite : plus haut = pire)', c.fragiliteDelta?.direction, 'amelioration');
  // Note : pour Fragilite Score, "amelioration" du score signifie en realite
  // une AGGRAVATION du dossier (plus de fragilite). C est de la responsabilite
  // de la couche editoriale d interpreter dans le bon sens. Le delta numerique
  // est neutre.
  check('narrativeDrift delta = -5', c.narrativeDriftDelta?.delta, -5);
}

// ============================================================
// Test 15 : Fragilite delta null si non applicable d un cote
// ============================================================

console.log('\n=== Test 15 : Fragilite null si moteur non applicable d un cote ===');
{
  const before = mockSnapshot({ fragiliteScore: null });
  const after = mockSnapshot({ analyzedAt: '2026-04-01T00:00:00Z', fragiliteScore: 60 });
  const c = compareAnalyses(before, after);

  check('fragiliteDelta null car before n a pas de score', c.fragiliteDelta, null);
}

// ============================================================
// Test 16 : combinaisons persistantes
// ============================================================

console.log('\n=== Test 16 : combinaisons persistantes ===');
{
  const before = mockSnapshot({
    combinaisons: [
      { nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' },
      { nom: 'Pattern Britishvolt', severite: 'alerte' },
    ],
  });
  const after = mockSnapshot({
    analyzedAt: '2026-04-01T00:00:00Z',
    combinaisons: [
      { nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' },  // persiste
      { nom: 'Wrapper sans differenciation', severite: 'drapeau-rouge' },  // nouvelle
    ],
  });
  const c = compareAnalyses(before, after);

  check('1 combinaison persistante', c.combinaisonsPersistantes.length, 1);
  check('Trajectoire WeWork persistante', c.combinaisonsPersistantes[0]?.nom, 'Trajectoire WeWork');
  check('1 combinaison apparue', c.combinaisonsApparues.length, 1);
  check('1 combinaison resolue', c.combinaisonsResolues.length, 1);
}

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
