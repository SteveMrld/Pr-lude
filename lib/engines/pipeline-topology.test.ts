// ============================================================
// Tests pipeline-topology
// ------------------------------------------------------------
// Verifie le calcul du chemin critique sur les deux topologies
// (wave-based historique et dep-driven actuelle) et documente le
// gain mesure en deterministe sur les durees representatives.
//
// Le test n est pas une mesure reelle, c est une simulation a
// partir de durees observees. Il garantit que la nouvelle
// topologie ne regresse pas et que les barrieres artificielles
// des vagues historiques sont bien levees.
//
// Lancement : npx tsx lib/engines/pipeline-topology.test.ts
// ============================================================

import {
  WAVE_BASED_TOPOLOGY,
  DEP_DRIVEN_TOPOLOGY,
  REPRESENTATIVE_DURATIONS_MS,
  computeFinishTimes,
  criticalPathMs,
  type PipelineNode,
} from './pipeline-topology';

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

console.log('\n=== computeFinishTimes ===');

// Topologie minimale : A -> B -> C lineaire
const lineaire: PipelineNode[] = [
  { id: 'A', deps: [] },
  { id: 'B', deps: ['A'] },
  { id: 'C', deps: ['B'] },
];
const linDur = { A: 10, B: 20, C: 30 };
const linFin = computeFinishTimes(lineaire, linDur);
check('A finit a 10', linFin.A, 10);
check('B finit a 30 (10+20)', linFin.B, 30);
check('C finit a 60 (30+30)', linFin.C, 60);

// Topologie en losange : A puis (B et C parallel) puis D
const losange: PipelineNode[] = [
  { id: 'A', deps: [] },
  { id: 'B', deps: ['A'] },
  { id: 'C', deps: ['A'] },
  { id: 'D', deps: ['B', 'C'] },
];
const losDur = { A: 10, B: 30, C: 50, D: 20 };
const losFin = computeFinishTimes(losange, losDur);
check('A finit a 10', losFin.A, 10);
check('B finit a 40 (10+30)', losFin.B, 40);
check('C finit a 60 (10+50)', losFin.C, 60);
check('D demarre quand C fini, finit a 80', losFin.D, 80);

console.log('\n=== criticalPathMs ===');

check('chemin critique lineaire = 60', criticalPathMs(lineaire, linDur), 60);
check('chemin critique losange = 80', criticalPathMs(losange, losDur), 80);

console.log('\n=== gain wave-based vs dep-driven (durees representatives) ===');

const waveMs = criticalPathMs(WAVE_BASED_TOPOLOGY, REPRESENTATIVE_DURATIONS_MS);
const depMs = criticalPathMs(DEP_DRIVEN_TOPOLOGY, REPRESENTATIVE_DURATIONS_MS);

console.log(`    wave-based critical path : ${(waveMs / 1000).toFixed(1)}s`);
console.log(`    dep-driven  critical path : ${(depMs / 1000).toFixed(1)}s`);
console.log(`    gain                       : ${((waveMs - depMs) / 1000).toFixed(1)}s (${((1 - depMs / waveMs) * 100).toFixed(1)}%)`);

checkTrue('dep-driven plus rapide que wave-based', depMs < waveMs);
checkTrue('gain au moins 30 secondes', waveMs - depMs >= 30000);

console.log('\n=== fragility ne bloque plus sur la vague 3 ===');

const waveFin = computeFinishTimes(WAVE_BASED_TOPOLOGY, REPRESENTATIVE_DURATIONS_MS);
const depFin = computeFinishTimes(DEP_DRIVEN_TOPOLOGY, REPRESENTATIVE_DURATIONS_MS);

const fragWave = waveFin['fragility-structurelle'];
const fragDep = depFin['fragility-structurelle'];

console.log(`    fragility finit a ${(fragWave / 1000).toFixed(1)}s (wave) vs ${(fragDep / 1000).toFixed(1)}s (dep-driven)`);
checkTrue('fragility termine plus tot en dep-driven', fragDep < fragWave);

console.log('\n=== reference-checks ne bloque plus sur la convergence vague 4 ===');

const rcWave = waveFin['reference-checks'];
const rcDep = depFin['reference-checks'];

console.log(`    reference-checks finit a ${(rcWave / 1000).toFixed(1)}s (wave) vs ${(rcDep / 1000).toFixed(1)}s (dep-driven)`);
checkTrue('reference-checks termine plus tot en dep-driven', rcDep < rcWave);

console.log('\n=== pattern/blindspot/contrarian ne bloquent plus sur financial-extraction ===');

// Sur la topologie wave-based, ces moteurs attendent la fin de
// financial-extraction parce que la barriere vague 2 inclut ce moteur.
// En dep-driven, ils ne consomment que team+market+macro, ils peuvent
// donc demarrer plus tot.

// Pattern attend benchmarks dans wave-based, qui attend
// financial-extraction (55s) en plus de team/market/macro.
const patternStartWave = Math.max(
  waveFin['team'], waveFin['market'], waveFin['macro'],
  waveFin['financial-extraction'], waveFin['saas-metrics'], waveFin['industrial-metrics'],
  waveFin['benchmarks'],
);
const patternStartDep = Math.max(depFin['team'], depFin['market'], depFin['macro']);

console.log(`    pattern demarre a ${(patternStartWave / 1000).toFixed(1)}s (wave) vs ${(patternStartDep / 1000).toFixed(1)}s (dep-driven)`);
checkTrue('pattern demarre plus tot en dep-driven', patternStartDep < patternStartWave);

console.log('\n=== causal demarre des que pattern resout, sans attendre toute la vague 3 ===');

const causalStartWave = Math.max(
  waveFin['pattern'], waveFin['blindspot'], waveFin['contrarian'],
  waveFin['financial-coherence'], waveFin['tech-claim'], waveFin['execution-friction'],
  waveFin['narrative-drift'],
);
const causalStartDep = Math.max(depFin['team'], depFin['market'], depFin['macro'], depFin['pattern']);

console.log(`    causal demarre a ${(causalStartWave / 1000).toFixed(1)}s (wave) vs ${(causalStartDep / 1000).toFixed(1)}s (dep-driven)`);
checkTrue('causal demarre plus tot en dep-driven', causalStartDep < causalStartWave);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) {
  process.exit(1);
}
