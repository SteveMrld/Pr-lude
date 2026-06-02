'use client';

// ============================================================
// PipelineToile - rendu SVG statique
// ------------------------------------------------------------
// Composant React qui prend un layout (cf lib/pipeline-toile/
// layout.ts) et un dictionnaire d etats par moteur, puis rend
// la toile en SVG fait main : rectangles arrondis hairline 1px
// pour les noeuds, courbes Bezier hairline pour les aretes,
// labels serif.
//
// Doctrine visuelle : planche d auscultation d auditeur. Pas
// de glow, pas d ombre portee, pas de gradient. Lisible imprime
// en noir et blanc. La seule animation permise est une pulsation
// d opacite (1400ms ease-in-out) sur les noeuds running. Les
// aretes ne sont jamais animees.
//
// Cette premiere session ne cable rien sur le SSE : l etat est
// passe en prop statique. Le cablage live arrive a la prochaine
// session.
// ============================================================

import type React from 'react';
import type { LayoutNode, ToileLayout } from '../../lib/pipeline-toile/layout';

export type ToileNodeState = 'idle' | 'running' | 'done' | 'error';

export interface PipelineToileProps {
  layout: ToileLayout;
  /**
   * Etat visuel par id de moteur. Tout id absent retombe sur
   * idle. Permet d afficher un run partiel sans avoir a remplir
   * tous les noeuds.
   */
  states?: Record<string, ToileNodeState>;
  /** Largeur d un rectangle noeud. Defaut 148. */
  nodeWidth?: number;
  /** Hauteur d un rectangle noeud. Defaut 36. */
  nodeHeight?: number;
  /**
   * Callback invoque au clic sur un noeud. Si fourni, les noeuds
   * deviennent interactifs : curseur pointer, role bouton, focus
   * clavier. Sans ce callback, la toile reste une planche
   * d auscultation passive.
   */
  onNodeClick?: (engineId: string) => void;
  /**
   * Id du moteur selectionne dans le drill-down. Le noeud
   * correspondant porte un cerne hairline ocre sans glow, lisible
   * en impression. Aucun decor flottant : on reste dans la
   * planche.
   */
  selectedId?: string | null;
}

const DEFAULT_NODE_WIDTH = 148;
const DEFAULT_NODE_HEIGHT = 36;

export function PipelineToile({
  layout,
  states,
  nodeWidth = DEFAULT_NODE_WIDTH,
  nodeHeight = DEFAULT_NODE_HEIGHT,
  onNodeClick,
  selectedId,
}: PipelineToileProps) {
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="pipeline-toile-frame">
      <svg
        className="pipeline-toile-svg"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label="Toile du pipeline d instruction"
      >
        <defs>
          <marker
            id="toile-arrow-idle"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--hairline-strong)" fillOpacity="0.45" />
          </marker>
        </defs>

        <g className="pipeline-toile-edges">
          {layout.edges.map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + nodeWidth / 2;
            const y1 = from.y;
            const x2 = to.x - nodeWidth / 2;
            const y2 = to.y;
            const cx1 = x1 + (x2 - x1) * 0.45;
            const cx2 = x2 - (x2 - x1) * 0.45;
            const path = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
            return (
              <path
                key={`${edge.from}->${edge.to}`}
                d={path}
                stroke="var(--hairline-strong)"
                strokeOpacity={0.32}
                strokeWidth={0.75}
                fill="none"
                markerEnd="url(#toile-arrow-idle)"
              />
            );
          })}
        </g>

        <g className="pipeline-toile-nodes">
          {layout.nodes.map((node) => {
            const state = states?.[node.id] ?? 'idle';
            return (
              <ToileNode
                key={node.id}
                node={node}
                state={state}
                width={nodeWidth}
                height={nodeHeight}
                onClick={onNodeClick}
                selected={selectedId === node.id}
              />
            );
          })}
        </g>
      </svg>

      <style jsx>{`
        .pipeline-toile-frame {
          background: var(--paper);
          padding: 32px 24px;
          overflow-x: auto;
        }
        .pipeline-toile-svg {
          display: block;
          margin: 0 auto;
        }
        :global(.pipeline-toile-node-running) {
          animation: pipelineToilePulse 1400ms ease-in-out infinite;
        }
        @keyframes pipelineToilePulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

interface ToileNodeStyle {
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  fill: string;
  fillOpacity: number;
  textColor: string;
  textOpacity: number;
  className: string;
}

function styleForState(state: ToileNodeState): ToileNodeStyle {
  switch (state) {
    case 'running':
      return {
        stroke: 'var(--ocre-brule)',
        strokeOpacity: 1,
        strokeWidth: 1.25,
        fill: 'var(--paper)',
        fillOpacity: 1,
        textColor: 'var(--ocre-brule)',
        textOpacity: 1,
        className: 'pipeline-toile-node-running',
      };
    case 'done':
      return {
        stroke: 'var(--vert-foret)',
        strokeOpacity: 1,
        strokeWidth: 1,
        fill: 'var(--vert-foret-soft)',
        fillOpacity: 1,
        textColor: 'var(--vert-foret)',
        textOpacity: 1,
        className: '',
      };
    case 'error':
      return {
        stroke: 'var(--ocre-brule)',
        strokeOpacity: 1,
        strokeWidth: 1.5,
        fill: 'var(--ocre-brule-soft)',
        fillOpacity: 1,
        textColor: 'var(--ocre-brule)',
        textOpacity: 1,
        className: '',
      };
    case 'idle':
    default:
      return {
        stroke: 'var(--hairline-strong)',
        strokeOpacity: 0.55,
        strokeWidth: 0.75,
        fill: 'var(--paper)',
        fillOpacity: 1,
        textColor: 'var(--ink)',
        textOpacity: 0.62,
        className: '',
      };
  }
}

function ToileNode({
  node,
  state,
  width,
  height,
  onClick,
  selected,
}: {
  node: LayoutNode;
  state: ToileNodeState;
  width: number;
  height: number;
  onClick?: (engineId: string) => void;
  selected?: boolean;
}) {
  const style = styleForState(state);
  const x = node.x - width / 2;
  const y = node.y - height / 2;
  const interactive = typeof onClick === 'function';

  const handleClick = interactive
    ? () => onClick!(node.id)
    : undefined;
  const handleKey = interactive
    ? (e: React.KeyboardEvent<SVGGElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick!(node.id);
        }
      }
    : undefined;

  return (
    <g
      className={`${style.className} ${interactive ? 'pipeline-toile-node-interactive' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKey}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Drill-down ${node.label}` : undefined}
      style={interactive ? { cursor: 'pointer' } : undefined}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        ry={3}
        fill={style.fill}
        fillOpacity={style.fillOpacity}
        stroke={style.stroke}
        strokeOpacity={style.strokeOpacity}
        strokeWidth={style.strokeWidth}
      />
      {/*
        Cerne de selection : une seconde frame hairline ocre
        decalee de 3px vers l exterieur, sans fill, sans glow.
        Lisible imprime, n alourdit pas la planche. On ne le
        peint que sur le noeud actif du drill-down.
      */}
      {selected && (
        <rect
          x={x - 3}
          y={y - 3}
          width={width + 6}
          height={height + 6}
          rx={4}
          ry={4}
          fill="none"
          stroke="var(--ocre-brule)"
          strokeOpacity={1}
          strokeWidth={1}
        />
      )}
      <text
        x={node.x}
        y={node.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--serif)"
        fontSize={11.5}
        fill={style.textColor}
        fillOpacity={style.textOpacity}
        style={{ letterSpacing: '-0.005em', pointerEvents: 'none' }}
      >
        {node.label}
      </text>
    </g>
  );
}
