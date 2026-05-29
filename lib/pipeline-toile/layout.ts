// ============================================================
// PIPELINE TOILE - LAYOUT EN COUCHES
// ------------------------------------------------------------
// Module pur, deterministe, sans dependance React ou DOM. Prend
// une topologie de moteurs (cf lib/engines/pipeline-topology.ts)
// et calcule un layout en couches a la Sugiyama simplifie : la
// couche d un noeud est 1 + max(couche de ses dependances), 0
// si pas de dep.
//
// d3-hierarchy n est pas utilise. La librairie est calibree pour
// des arbres (un parent par noeud), pas pour des DAG avec
// dependances partagees. Le pipeline a explicitement des noeuds
// multi-parents (fragility-structurelle depend de market ET
// financial-extraction, pattern depend de team ET market ET
// macro, etc). Tri topologique maison plus honnete.
//
// Sortie : positions x,y absolues pour chaque noeud, plus les
// aretes orientees, plus les dimensions du viewport SVG. Le
// rendu (SVG, couleurs, animations) est strictement separe dans
// app/components/PipelineToile.tsx.
// ============================================================

import type { PipelineNode } from '../engines/pipeline-topology';

export interface LayoutNode {
  id: string;
  label: string;
  layer: number;
  /** Centre x du noeud, en pixels SVG. */
  x: number;
  /** Centre y du noeud, en pixels SVG. */
  y: number;
  dependsOn: string[];
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface ToileLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  /** Largeur totale du viewport SVG en pixels. */
  width: number;
  /** Hauteur totale du viewport SVG en pixels. */
  height: number;
  /** Nombre total de couches (0..layers-1). */
  layers: number;
}

export interface LayoutConfig {
  /** Distance horizontale entre deux couches (centres). */
  layerSpacing?: number;
  /** Distance verticale entre deux noeuds dans une meme couche (centres). */
  nodeSpacing?: number;
  /** Marge horizontale autour du graphe. */
  marginX?: number;
  /** Marge verticale autour du graphe. */
  marginY?: number;
  /** Largeur d un rectangle noeud (utilisee pour caler les marges). */
  nodeWidth?: number;
}

/**
 * Libelles editoriaux des moteurs. Le but est d afficher la note
 * lisible plutot que l id technique dans les rectangles noeud.
 * Tout id non liste retombe sur lui-meme.
 */
const NODE_LABELS: Record<string, string> = {
  'extraction': 'Extraction',
  'team': 'Equipe',
  'market': 'Marche',
  'macro': 'Macro',
  'financial-extraction': 'Extraction financiere',
  'saas-metrics': 'Metriques SaaS',
  'industrial-metrics': 'Metriques industrielles',
  'benchmarks': 'Benchmarks',
  'pattern': 'Pattern matching',
  'blindspot': 'Aveuglement',
  'contrarian': 'Contrarien',
  'financial-coherence': 'Coherence financiere',
  'tech-claim': 'Tech claim',
  'execution-friction': 'Friction execution',
  'narrative-drift': 'Derive narrative',
  'fragility-structurelle': 'Fragilite structurelle',
  'causal': 'Retournement causal',
  'reference-checks': 'Reference checks',
  'orchestrate': 'Orchestration',
};

/**
 * Calcule la couche topologique de chaque noeud. La couche d un
 * noeud sans dep est 0. Sinon, 1 + max(couche de ses dependances).
 * Detecte les cycles et leve une erreur explicite.
 */
export function computeLayers(topology: PipelineNode[]): Map<string, number> {
  const depsById = new Map<string, string[]>();
  for (const n of topology) depsById.set(n.id, n.deps);

  const layerCache = new Map<string, number>();

  function resolve(id: string, visiting: Set<string>): number {
    const cached = layerCache.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) {
      throw new Error(`Cycle detecte dans la topologie au noeud ${id}`);
    }
    const deps = depsById.get(id);
    if (!deps) {
      throw new Error(`Noeud ${id} reference mais absent de la topologie`);
    }
    if (deps.length === 0) {
      layerCache.set(id, 0);
      return 0;
    }
    visiting.add(id);
    const maxDepLayer = Math.max(...deps.map((d) => resolve(d, visiting)));
    visiting.delete(id);
    const layer = maxDepLayer + 1;
    layerCache.set(id, layer);
    return layer;
  }

  for (const n of topology) resolve(n.id, new Set());
  return layerCache;
}

/**
 * Calcule le layout complet a partir d une topologie. Pure,
 * deterministe : meme entree, meme sortie au pixel pres. Les
 * noeuds dans une couche sont tries par id pour l ordre vertical,
 * ce qui evite tout reordonnancement entre deux rendus.
 */
export function layoutTopology(
  topology: PipelineNode[],
  config: LayoutConfig = {},
): ToileLayout {
  const layerSpacing = config.layerSpacing ?? 180;
  const nodeSpacing = config.nodeSpacing ?? 56;
  const marginX = config.marginX ?? 80;
  const marginY = config.marginY ?? 40;
  const nodeWidth = config.nodeWidth ?? 148;

  const layers = computeLayers(topology);

  // Groupage par couche. Ordre des noeuds dans une couche : tri
  // alphabetique pour determinisme parfait.
  const byLayer = new Map<number, string[]>();
  let maxLayer = 0;
  for (const n of topology) {
    const l = layers.get(n.id);
    if (l === undefined) continue;
    if (l > maxLayer) maxLayer = l;
    let bucket = byLayer.get(l);
    if (!bucket) {
      bucket = [];
      byLayer.set(l, bucket);
    }
    bucket.push(n.id);
  }
  byLayer.forEach((bucket) => bucket.sort());

  // Hauteur du contenu : la couche la plus peuplee dicte la
  // hauteur disponible. Les autres couches sont centrees
  // verticalement par rapport a la hauteur max.
  let maxNodesInLayer = 0;
  byLayer.forEach((bucket) => {
    if (bucket.length > maxNodesInLayer) maxNodesInLayer = bucket.length;
  });
  const contentHeight = maxNodesInLayer * nodeSpacing;
  const totalHeight = contentHeight + marginY * 2;

  const layoutNodes: LayoutNode[] = [];
  const nodeMap = new Map<string, PipelineNode>();
  for (const n of topology) nodeMap.set(n.id, n);

  for (let l = 0; l <= maxLayer; l++) {
    const ids = byLayer.get(l) ?? [];
    const layerHeight = ids.length * nodeSpacing;
    const yStart = (totalHeight - layerHeight) / 2 + nodeSpacing / 2;
    const xCenter = marginX + nodeWidth / 2 + l * layerSpacing;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const node = nodeMap.get(id);
      if (!node) continue;
      layoutNodes.push({
        id,
        label: NODE_LABELS[id] ?? id,
        layer: l,
        x: xCenter,
        y: yStart + i * nodeSpacing,
        dependsOn: node.deps,
      });
    }
  }

  const edges: LayoutEdge[] = [];
  for (const n of topology) {
    for (const dep of n.deps) {
      edges.push({ from: dep, to: n.id });
    }
  }

  const totalWidth = marginX * 2 + nodeWidth + maxLayer * layerSpacing;

  return {
    nodes: layoutNodes,
    edges,
    width: totalWidth,
    height: totalHeight,
    layers: maxLayer + 1,
  };
}
