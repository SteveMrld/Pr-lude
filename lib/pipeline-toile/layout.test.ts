// ============================================================
// Tests lib/pipeline-toile/layout
// ------------------------------------------------------------
// Garantit que le module de layout est strictement deterministe
// et respecte les invariants topologiques. Pas d appel reseau,
// pas d appel React, juste de la geometrie pure sur la
// topologie dep-driven et sur des cas synthetiques.
//
// Lancement : npx tsx lib/pipeline-toile/layout.test.ts
// ============================================================

import { computeLayers, layoutTopology } from './layout';
import { DEP_DRIVEN_TOPOLOGY } from '../engines/pipeline-topology';
import type { PipelineNode } from '../engines/pipeline-topology';

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

console.log('\n=== computeLayers ===');

const lineaire: PipelineNode[] = [
  { id: 'A', deps: [] },
  { id: 'B', deps: ['A'] },
  { id: 'C', deps: ['B'] },
];
const linL = computeLayers(lineaire);
check('lineaire A couche 0', linL.get('A'), 0);
check('lineaire B couche 1', linL.get('B'), 1);
check('lineaire C couche 2', linL.get('C'), 2);

const losange: PipelineNode[] = [
  { id: 'A', deps: [] },
  { id: 'B', deps: ['A'] },
  { id: 'C', deps: ['A'] },
  { id: 'D', deps: ['B', 'C'] },
];
const losL = computeLayers(losange);
check('losange A couche 0', losL.get('A'), 0);
check('losange B couche 1', losL.get('B'), 1);
check('losange C couche 1', losL.get('C'), 1);
check('losange D couche 2', losL.get('D'), 2);

// Multi-parents avec branches inegales : un noeud qui a une dep
// profonde doit etre place apres meme si son autre dep est peu
// profonde. Verifie que la regle max-profondeur est bien appliquee.
const branches: PipelineNode[] = [
  { id: 'root', deps: [] },
  { id: 'shallow', deps: ['root'] },
  { id: 'deep1', deps: ['root'] },
  { id: 'deep2', deps: ['deep1'] },
  { id: 'merge', deps: ['shallow', 'deep2'] },
];
const brL = computeLayers(branches);
check('shallow couche 1', brL.get('shallow'), 1);
check('deep2 couche 2', brL.get('deep2'), 2);
check('merge couche 3 (max(1,2)+1)', brL.get('merge'), 3);

// Detection de cycle
const cycle: PipelineNode[] = [
  { id: 'X', deps: ['Y'] },
  { id: 'Y', deps: ['X'] },
];
let cycleDetected = false;
try {
  computeLayers(cycle);
} catch (e) {
  cycleDetected = (e as Error).message.toLowerCase().includes('cycle');
}
checkTrue('cycle detecte avec erreur explicite', cycleDetected);

console.log('\n=== layoutTopology sur DEP_DRIVEN_TOPOLOGY ===');

const layout = layoutTopology(DEP_DRIVEN_TOPOLOGY);

// La topologie dep-driven a 5 couches : extraction (0), vague
// directe (1), vague pattern/blindspot/contrarian/benchmarks/etc
// (2), causal + financial-coherence (3), orchestrate + reference-
// checks (4).
check('5 couches au total', layout.layers, 5);

const extraction = layout.nodes.find((n) => n.id === 'extraction');
check('extraction en couche 0', extraction?.layer, 0);

const orchestrate = layout.nodes.find((n) => n.id === 'orchestrate');
check('orchestrate en derniere couche', orchestrate?.layer, layout.layers - 1);

const referenceChecks = layout.nodes.find((n) => n.id === 'reference-checks');
check('reference-checks en derniere couche (parallele a orchestrate)', referenceChecks?.layer, layout.layers - 1);

const causal = layout.nodes.find((n) => n.id === 'causal');
check('causal en couche 3', causal?.layer, 3);

const fragility = layout.nodes.find((n) => n.id === 'fragility-structurelle');
check('fragility en couche 2', fragility?.layer, 2);

// Invariant central : aucun noeud ne peut etre dans une couche
// inferieure ou egale a une de ses dependances.
let depsBeforeAll = true;
const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
for (const n of layout.nodes) {
  for (const dep of n.dependsOn) {
    const depNode = nodeById.get(dep);
    if (!depNode || depNode.layer >= n.layer) {
      depsBeforeAll = false;
      console.log(`    violation: ${n.id} couche ${n.layer} mais dep ${dep} couche ${depNode?.layer}`);
    }
  }
}
checkTrue('chaque noeud strictement apres ses dependances', depsBeforeAll);

// Tous les noeuds d une meme couche partagent le meme x.
const byLayer = new Map<number, Array<{ id: string; x: number; y: number }>>();
for (const n of layout.nodes) {
  let bucket = byLayer.get(n.layer);
  if (!bucket) {
    bucket = [];
    byLayer.set(n.layer, bucket);
  }
  bucket.push({ id: n.id, x: n.x, y: n.y });
}

let sameXPerLayer = true;
byLayer.forEach((ids) => {
  const xs = new Set(ids.map((i) => i.x));
  if (xs.size !== 1) sameXPerLayer = false;
});
checkTrue('memes x par couche', sameXPerLayer);

// x croit strictement avec la couche.
let xMonotonic = true;
const xByLayer = new Map<number, number>();
for (const n of layout.nodes) xByLayer.set(n.layer, n.x);
for (let l = 1; l <= layout.layers - 1; l++) {
  const prev = xByLayer.get(l - 1);
  const cur = xByLayer.get(l);
  if (prev === undefined || cur === undefined || cur <= prev) xMonotonic = false;
}
checkTrue('x strictement croissant avec la couche', xMonotonic);

// Pas deux noeuds aux memes coordonnees exactes dans une meme
// couche : on doit pouvoir cliquer sans collision.
let noOverlap = true;
byLayer.forEach((ids, layer) => {
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (ids[i].x === ids[j].x && ids[i].y === ids[j].y) {
        console.log(`    chevauchement couche ${layer}: ${ids[i].id} et ${ids[j].id}`);
        noOverlap = false;
      }
    }
  }
});
checkTrue('pas de chevauchement xy dans une meme couche', noOverlap);

// Dans une couche donnee, y est strictement croissant avec l ordre
// alphabetique (gage de determinisme du rendu).
let yMonotonicByAlpha = true;
byLayer.forEach((ids) => {
  const sorted = ids.slice().sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y <= sorted[i - 1].y) yMonotonicByAlpha = false;
  }
});
checkTrue('y croissant en ordre alphabetique dans chaque couche', yMonotonicByAlpha);

// Aretes : une par paire (dep, node).
const expectedEdgeCount = DEP_DRIVEN_TOPOLOGY.reduce((sum, n) => sum + n.deps.length, 0);
check('nombre d aretes egal a somme des deps', layout.edges.length, expectedEdgeCount);

// Toutes les aretes pointent vers une couche superieure.
let edgesForward = true;
for (const e of layout.edges) {
  const from = nodeById.get(e.from);
  const to = nodeById.get(e.to);
  if (!from || !to || from.layer >= to.layer) {
    edgesForward = false;
    console.log(`    arete retrograde: ${e.from} (${from?.layer}) -> ${e.to} (${to?.layer})`);
  }
}
checkTrue('toutes les aretes vont vers une couche superieure', edgesForward);

// Determinisme : meme entree, meme sortie binaire.
const layout2 = layoutTopology(DEP_DRIVEN_TOPOLOGY);
checkTrue('determinisme: deux appels identiques produisent le meme layout', JSON.stringify(layout) === JSON.stringify(layout2));

// Dimensions : width et height > 0, et coherents avec le nombre
// de couches.
checkTrue('width > 0', layout.width > 0);
checkTrue('height > 0', layout.height > 0);

console.log('\n=== layoutTopology determinisme sur losange ===');

const losLayout = layoutTopology(losange);
check('losange : 3 couches', losLayout.layers, 3);
check('losange : 4 noeuds', losLayout.nodes.length, 4);
check('losange : 4 aretes (A-B, A-C, B-D, C-D)', losLayout.edges.length, 4);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) {
  process.exit(1);
}
