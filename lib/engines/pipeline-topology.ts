// ============================================================
// PIPELINE TOPOLOGY
// ------------------------------------------------------------
// Modelisation du graphe de dependances du pipeline d analyse
// Bloc 1 et calcul du chemin critique (critical path) en fonction
// des durees observees par moteur. Permet de :
//   - quantifier le gain theorique d une refonte d ordonnancement
//   - detecter les goulets d etranglement futurs sans relancer le
//     pipeline complet
//   - documenter et tester en deterministe la structure de
//     dependances qui n est sinon expressee qu en JavaScript dans
//     /api/analyze/route.ts
//
// Le code ici ne lance aucun appel reseau, il opere uniquement sur
// des descriptions de noeuds et leurs durees. Les durees fournies
// peuvent etre soit mockees (pour tests deterministes), soit
// remplies par les engineDurations reels observes sur un dossier
// (Platypus Craft, Ambulife, etc.).
// ============================================================

/**
 * Noeud du graphe de dependances. Un noeud par moteur. Le champ
 * deps liste les autres noeuds dont la sortie est consommee par
 * ce moteur. Une dep absente du tableau signifie que le moteur
 * peut demarrer immediatement apres extraction.
 */
export interface PipelineNode {
  id: string;
  deps: string[];
}

/**
 * Topologie historique du pipeline (avant refonte dep-driven).
 * Modele les barrieres vague 2 / vague 3 / vague 4 / vague 5
 * explicites : chaque moteur d une vague attend la fin de tous
 * les moteurs de la vague precedente, meme s il ne consomme pas
 * leur output.
 */
export const WAVE_BASED_TOPOLOGY: PipelineNode[] = [
  { id: 'extraction', deps: [] },
  // Vague 2 : tous attendent extraction
  { id: 'team', deps: ['extraction'] },
  { id: 'market', deps: ['extraction'] },
  { id: 'macro', deps: ['extraction'] },
  { id: 'financial-extraction', deps: ['extraction'] },
  { id: 'saas-metrics', deps: ['extraction'] },
  { id: 'industrial-metrics', deps: ['extraction'] },
  // Benchmarks tournait apres vague 2, avant vague 3
  { id: 'benchmarks', deps: ['team', 'market', 'macro', 'financial-extraction', 'saas-metrics', 'industrial-metrics'] },
  // Vague 3 : barriere artificielle sur l ensemble de la vague 2
  { id: 'pattern', deps: ['benchmarks'] },
  { id: 'blindspot', deps: ['benchmarks'] },
  { id: 'contrarian', deps: ['benchmarks'] },
  { id: 'financial-coherence', deps: ['benchmarks'] },
  { id: 'tech-claim', deps: ['benchmarks'] },
  { id: 'execution-friction', deps: ['benchmarks'] },
  { id: 'narrative-drift', deps: ['benchmarks'] },
  // Vague 4 : barriere artificielle sur l ensemble de la vague 3
  { id: 'causal', deps: ['pattern', 'blindspot', 'contrarian', 'financial-coherence', 'tech-claim', 'execution-friction', 'narrative-drift'] },
  { id: 'fragility-structurelle', deps: ['pattern', 'blindspot', 'contrarian', 'financial-coherence', 'tech-claim', 'execution-friction', 'narrative-drift'] },
  // Vague 5 : orchestrate et reference-checks
  { id: 'reference-checks', deps: ['causal', 'fragility-structurelle'] },
  { id: 'orchestrate', deps: ['causal', 'fragility-structurelle'] },
];

/**
 * Topologie dep-driven (apres refonte). Chaque moteur n attend que
 * ses deps strictes. Les barrieres vague disparaissent. fragility
 * remonte au meme niveau que pattern/blindspot/etc. reference-checks
 * fire des que team+blindspot+causal sont prets, sans attendre
 * la convergence finale.
 */
export const DEP_DRIVEN_TOPOLOGY: PipelineNode[] = [
  { id: 'extraction', deps: [] },
  // Couche 1 : depend uniquement de extraction
  { id: 'team', deps: ['extraction'] },
  { id: 'market', deps: ['extraction'] },
  { id: 'macro', deps: ['extraction'] },
  { id: 'financial-extraction', deps: ['extraction'] },
  { id: 'saas-metrics', deps: ['extraction'] },
  { id: 'industrial-metrics', deps: ['extraction'] },
  // Benchmarks : chaine sur financial-extraction uniquement
  { id: 'benchmarks', deps: ['financial-extraction'] },
  // Couche 2 : deps reelles, pas de barriere
  { id: 'pattern', deps: ['team', 'market', 'macro'] },
  { id: 'blindspot', deps: ['team', 'market', 'macro'] },
  { id: 'contrarian', deps: ['team', 'market', 'macro'] },
  { id: 'financial-coherence', deps: ['market', 'financial-extraction', 'benchmarks'] },
  { id: 'tech-claim', deps: ['financial-extraction'] },
  { id: 'execution-friction', deps: ['financial-extraction'] },
  { id: 'narrative-drift', deps: ['extraction'] },
  { id: 'fragility-structurelle', deps: ['market', 'financial-extraction'] },
  // Couche 3 : causal demarre quand pattern resout
  { id: 'causal', deps: ['team', 'market', 'macro', 'pattern'] },
  // Couche 4 : reference-checks demarre quand team+blindspot+causal resolvent
  { id: 'reference-checks', deps: ['team', 'blindspot', 'causal'] },
  // Couche 5 : orchestrate consomme tout
  { id: 'orchestrate', deps: [
    'team', 'market', 'macro',
    'pattern', 'blindspot', 'contrarian',
    'financial-coherence', 'tech-claim', 'execution-friction',
    'narrative-drift', 'fragility-structurelle',
    'causal',
  ] },
];

/**
 * Durees representatives d un dossier seed standard. Estimees a
 * partir de runs observes sur dossiers Ambulife et Platypus Craft.
 * Tous en millisecondes. Les durees deterministes (benchmarks,
 * saas-metrics quand non applicable, etc.) sont negligeables et
 * fixees a 100ms pour le calcul.
 */
export const REPRESENTATIVE_DURATIONS_MS: Record<string, number> = {
  extraction: 35000,
  team: 25000,
  market: 35000,
  macro: 28000,
  'financial-extraction': 55000,
  'saas-metrics': 18000,
  'industrial-metrics': 100,
  benchmarks: 100,
  pattern: 65000,
  blindspot: 75000,
  contrarian: 55000,
  'financial-coherence': 50000,
  'tech-claim': 35000,
  'execution-friction': 40000,
  'narrative-drift': 32000,
  'fragility-structurelle': 70000,
  causal: 50000,
  'reference-checks': 28000,
  orchestrate: 80000,
};

/**
 * Calcule la date de fin de chaque noeud en chemin critique sachant
 * que tous les noeuds sans dep demarrent a t=0 et que chaque noeud
 * demarre des que tous ses parents sont termines.
 *
 * Retourne un map id -> finishedAt (ms).
 */
export function computeFinishTimes(
  nodes: PipelineNode[],
  durations: Record<string, number>,
): Record<string, number> {
  const byId: Record<string, PipelineNode> = {};
  for (const n of nodes) byId[n.id] = n;

  const finishedAt: Record<string, number> = {};

  function compute(id: string): number {
    if (id in finishedAt) return finishedAt[id];
    const node = byId[id];
    if (!node) throw new Error(`Unknown node: ${id}`);
    const startAt = node.deps.length === 0
      ? 0
      : Math.max(...node.deps.map(compute));
    const dur = durations[id] ?? 0;
    finishedAt[id] = startAt + dur;
    return finishedAt[id];
  }

  for (const n of nodes) compute(n.id);
  return finishedAt;
}

/**
 * Chemin critique : la duree totale du pipeline est la date de fin
 * du dernier noeud (orchestrate). On retourne la duree max parmi
 * tous les noeuds pour rester robuste a une topologie sans
 * orchestrate explicite.
 */
export function criticalPathMs(
  nodes: PipelineNode[],
  durations: Record<string, number>,
): number {
  const finishes = computeFinishTimes(nodes, durations);
  return Math.max(...Object.values(finishes));
}
