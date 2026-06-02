'use client';

// ============================================================
// PipelineToileDrillDown
// ------------------------------------------------------------
// Panneau lateral du drill-down de la toile. Slide depuis la
// droite, hairline 1px, palette papier. Aucun backdrop blur,
// aucun gradient, aucune ombre portee. Lisible imprime en noir
// et blanc. Une seule selection a la fois : le panneau ouvre,
// affiche, ferme sobrement. La fermeture passe soit par le
// bouton dedie en haut a droite, soit par la touche Echap.
//
// Le contenu est delegue au registry de renderers (cf
// pipeline-toile-renderers/index.tsx). Le panneau lui-meme se
// contente de l ossature : en-tete avec label + etat + duree,
// corps scrollable, fermeture.
// ============================================================

import { useEffect } from 'react';
import { pickRenderer } from './pipeline-toile-renderers';
import { formatDuration } from './pipeline-toile-renderers/format';

interface ToileNodeLite {
  id: string;
  label: string;
}

interface EngineStateLite {
  status: 'idle' | 'running' | 'done' | 'error';
  durationMs?: number;
}

interface PipelineToileDrillDownProps {
  node: ToileNodeLite | null;
  state: EngineStateLite | null;
  output: unknown;
  onClose: () => void;
}

const STATE_LABEL: Record<EngineStateLite['status'], string> = {
  idle: 'Au repos',
  running: 'En cours',
  done: 'Termine',
  error: 'Erreur',
};

const STATE_COLOR: Record<EngineStateLite['status'], string> = {
  idle: 'var(--muted)',
  running: 'var(--ocre-brule)',
  done: 'var(--vert-foret)',
  error: 'var(--ocre-brule)',
};

export function PipelineToileDrillDown({
  node,
  state,
  output,
  onClose,
}: PipelineToileDrillDownProps) {
  // Fermeture clavier : Echap referme. On n attache l ecouteur que
  // si le panneau est ouvert pour eviter de capturer Echap en
  // dehors du contexte drill-down (ce qui interfererait avec
  // d autres listeners de la page).
  useEffect(() => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [node, onClose]);

  if (!node) return null;

  const status = state?.status ?? 'idle';
  const Renderer = pickRenderer(node.id);

  return (
    <aside
      className="toile-drilldown"
      role="complementary"
      aria-label={`Drill-down ${node.label}`}
    >
      <header className="toile-drilldown-header">
        <div className="toile-drilldown-eyebrow">Moteur</div>
        <h3 className="toile-drilldown-title">{node.label}</h3>
        <div className="toile-drilldown-meta">
          <span
            className="toile-drilldown-state"
            style={{ color: STATE_COLOR[status] }}
          >
            {STATE_LABEL[status]}
          </span>
          {typeof state?.durationMs === 'number' && (
            <>
              <span className="toile-drilldown-sep" aria-hidden="true">·</span>
              <span className="toile-drilldown-duration">
                {formatDuration(state.durationMs)}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          className="toile-drilldown-close"
          onClick={onClose}
          aria-label="Fermer le panneau"
        >
          Fermer
        </button>
      </header>

      <div className="toile-drilldown-body">
        <Renderer output={output} engineId={node.id} />
      </div>

      <style jsx>{`
        .toile-drilldown {
          position: sticky;
          top: 24px;
          height: fit-content;
          max-height: calc(100vh - 80px);
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .toile-drilldown-header {
          position: relative;
          padding: 20px 24px 18px;
          border-bottom: 1px solid var(--hairline);
        }
        .toile-drilldown-eyebrow {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 6px;
        }
        .toile-drilldown-title {
          font-family: var(--serif);
          font-size: 20px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: var(--ink);
          margin: 0 80px 8px 0;
          line-height: 1.25;
        }
        .toile-drilldown-meta {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: 0.02em;
        }
        .toile-drilldown-state {
          font-weight: 500;
        }
        .toile-drilldown-sep {
          opacity: 0.6;
        }
        .toile-drilldown-close {
          position: absolute;
          top: 16px;
          right: 18px;
          background: transparent;
          border: 1px solid var(--hairline);
          border-radius: 3px;
          padding: 5px 12px;
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-soft);
          cursor: pointer;
        }
        .toile-drilldown-close:hover {
          color: var(--ink);
          border-color: var(--ink-soft);
        }
        .toile-drilldown-close:focus-visible {
          outline: 1px solid var(--ocre-brule);
          outline-offset: 2px;
        }
        .toile-drilldown-body {
          padding: 22px 24px 26px;
          overflow-y: auto;
        }
      `}</style>
    </aside>
  );
}
