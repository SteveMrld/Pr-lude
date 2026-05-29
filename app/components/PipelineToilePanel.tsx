'use client';

// ============================================================
// PipelineToilePanel
// ------------------------------------------------------------
// Panneau de l onglet Pipeline du dashboard d analyse. Cale la
// toile sur les engineStates deja maintenus par HomeClient et
// alimentes par le SSE existant. Lecture seule cote serveur :
// aucune modification de /api/analyze, aucun re-emission. Le
// bandeau PipelineProgress du header reste en place et inchange ;
// la toile est une vue complementaire, en plan etendu, qui rend
// lisible le graphe de dependances au-dela de la liste lineaire.
//
// Modes :
//   - run en cours dans la session : la toile s anime au fil
//     des engine-start / engine-done.
//   - run termine dans la session : tous les noeuds en done
//     (sauf untraced silencieux et noeuds d un sous-pipeline non
//     pertinent).
//   - analyse archivee chargee depuis l historique : tous les
//     noeuds en idle, une mention sobre rappelle que la vue live
//     n est disponible que pendant l instruction. Pas de plantage,
//     pas de promesse fausse.
// ============================================================

import { useMemo } from 'react';
import { PipelineToile, type ToileNodeState } from './PipelineToile';
import { layoutTopology } from '../../lib/pipeline-toile/layout';
import { buildToileStates } from '../../lib/pipeline-toile/states-adapter';
import { DEP_DRIVEN_TOPOLOGY } from '../../lib/engines/pipeline-topology';

interface EngineStateLike {
  status: 'idle' | 'running' | 'done' | 'error';
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

interface PipelineToilePanelProps {
  engineStates: Record<string, EngineStateLike>;
}

export function PipelineToilePanel({ engineStates }: PipelineToilePanelProps) {
  const layout = useMemo(() => layoutTopology(DEP_DRIVEN_TOPOLOGY), []);
  const states = useMemo(() => buildToileStates(engineStates), [engineStates]);

  // Detection mode : si aucun noeud trace n est en running/done/
  // error, on est soit avant le premier engine-start de la session,
  // soit sur une analyse archivee rechargee. Dans les deux cas, on
  // affiche la mention sobre. Pendant et apres un run, elle
  // disparait.
  const hasLiveSignal = useMemo(() => {
    for (const id of Object.keys(states)) {
      const s = states[id];
      if (s === 'running' || s === 'done' || s === 'error') return true;
    }
    return false;
  }, [states]);

  return (
    <div className="pipeline-toile-panel">
      <header className="pipeline-toile-header">
        <div className="pipeline-toile-eyebrow">Fabrique</div>
        <h2 className="pipeline-toile-title">Pipeline d instruction</h2>
        <p className="pipeline-toile-lede">
          Planche d auscultation du pipeline. Chaque cartouche est un moteur,
          chaque filet une dependance reelle. Pendant l instruction, les
          cartouches s allument au fil des engine-start et engine-done. La
          lecture n est pas chronologique, elle est causale : on remonte les
          fleches pour voir d ou un moteur tire ses entrees.
        </p>
      </header>

      <PipelineToile layout={layout} states={states} />

      <footer className="pipeline-toile-footer">
        <Legend />
        {!hasLiveSignal && (
          <p className="pipeline-toile-archive-note">
            Vue live disponible pendant l instruction. Sur une analyse
            archivee, la toile reste neutre : le replay des etats moteur
            depuis la persistance arrivera dans une session ulterieure.
          </p>
        )}
      </footer>

      <style jsx>{`
        .pipeline-toile-panel {
          padding: 36px 32px 56px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .pipeline-toile-header {
          margin-bottom: 24px;
        }
        .pipeline-toile-eyebrow {
          font-family: var(--sans);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 10.5px;
          color: var(--muted);
          margin-bottom: 8px;
        }
        .pipeline-toile-title {
          font-family: var(--serif);
          font-size: 28px;
          font-weight: 500;
          letter-spacing: -0.015em;
          color: var(--ink);
          margin: 0 0 12px;
        }
        .pipeline-toile-lede {
          font-family: var(--serif);
          font-size: 15px;
          line-height: 1.65;
          color: var(--ink-soft);
          max-width: 640px;
          margin: 0;
        }
        .pipeline-toile-footer {
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid var(--hairline);
        }
        .pipeline-toile-archive-note {
          font-family: var(--serif);
          font-style: italic;
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--muted);
          margin: 18px 0 0;
          max-width: 620px;
        }
      `}</style>
    </div>
  );
}

function Legend() {
  const items: Array<{ state: ToileNodeState; label: string }> = [
    { state: 'idle', label: 'Au repos' },
    { state: 'running', label: 'En cours' },
    { state: 'done', label: 'Termine' },
    { state: 'error', label: 'Erreur' },
  ];
  return (
    <div className="pipeline-toile-legend">
      {items.map((it) => (
        <div key={it.state} className="pipeline-toile-legend-item">
          <LegendSwatch state={it.state} />
          <span className="pipeline-toile-legend-label">{it.label}</span>
        </div>
      ))}
      <style jsx>{`
        .pipeline-toile-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 20px 24px;
          align-items: center;
        }
        .pipeline-toile-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .pipeline-toile-legend-label {
          font-family: var(--sans);
          font-size: 11.5px;
          color: var(--ink-soft);
          letter-spacing: 0.01em;
        }
      `}</style>
    </div>
  );
}

function LegendSwatch({ state }: { state: ToileNodeState }) {
  let stroke = 'var(--hairline-strong)';
  let strokeOpacity = 0.55;
  let strokeWidth = 0.75;
  let fill = 'var(--paper)';
  let className = '';
  switch (state) {
    case 'running':
      stroke = 'var(--ocre-brule)';
      strokeOpacity = 1;
      strokeWidth = 1.25;
      className = 'legend-swatch-running';
      break;
    case 'done':
      stroke = 'var(--vert-foret)';
      strokeOpacity = 1;
      strokeWidth = 1;
      fill = 'var(--vert-foret-soft)';
      break;
    case 'error':
      stroke = 'var(--ocre-brule)';
      strokeOpacity = 1;
      strokeWidth = 1.5;
      fill = 'var(--ocre-brule-soft)';
      break;
  }
  return (
    <span className={`pipeline-toile-swatch ${className}`}>
      <svg width={26} height={14} viewBox="0 0 26 14" aria-hidden="true">
        <rect
          x={0.5}
          y={0.5}
          width={25}
          height={13}
          rx={3}
          ry={3}
          fill={fill}
          stroke={stroke}
          strokeOpacity={strokeOpacity}
          strokeWidth={strokeWidth}
        />
      </svg>
      <style jsx>{`
        :global(.legend-swatch-running) {
          animation: legendPulse 1400ms ease-in-out infinite;
        }
        @keyframes legendPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </span>
  );
}
