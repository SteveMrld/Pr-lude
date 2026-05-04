'use client';

import { useEffect, useRef, useState } from 'react';

export type EngineStatus = 'idle' | 'running' | 'done' | 'error';

export interface EngineState {
  status: EngineStatus;
  startedAt?: number;
  completedAt?: number;
  /** Duree finale en ms si fournie par le serveur (sinon calculee
   *  cote client a partir de startedAt / completedAt). */
  durationMs?: number;
}

export interface EngineDescriptor {
  id: string;
  name: string;
  label?: string;
}

interface Props {
  engines: EngineDescriptor[];
  states: Record<string, EngineState>;
  /** True pendant que le pipeline tourne, false sinon. */
  analyzing: boolean;
  /** Optionnel : fonction de scroll vers la section correspondante du dashboard. */
  onEngineClick?: (engineId: string) => void;
  /** Optionnel : duree totale ecoulee depuis le debut du run, en ms. */
  elapsedMs?: number;
}

/**
 * Bandeau horizontal de progression du pipeline. S'affiche en sticky en haut
 * de l'ecran pendant le run, puis bascule en mode resume compact une fois
 * termine. Inspire du flow Meegle (PM tool ByteDance) mais avec la palette
 * editoriale Prelude (papier ancien, encre, accent ocre).
 *
 * Donnees alimentees par le SSE existant dans HomeClient.tsx (events
 * engine-start / engine-done sur /api/analyze). Aucun polling necessaire.
 */
export default function PipelineProgress({
  engines,
  states,
  analyzing,
  onEngineClick,
  elapsedMs,
}: Props) {
  // Force un re-render toutes les secondes pour que les durees ecoulees
  // s'actualisent visuellement pendant qu'un moteur tourne.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!analyzing) return;
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [analyzing]);

  // Auto-scroll horizontal vers le dernier moteur passe a running. Garde
  // l etape courante visible meme sur mobile ou la liste deborde de l ecran.
  // Refs par moteur pour pouvoir scroller vers l element exact.
  const flowRef = useRef<HTMLDivElement>(null);
  const engineRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastScrolledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!analyzing) return;
    // Trouve le dernier moteur en running (ou le dernier done s il n y a
    // plus de running, pour suivre la progression jusqu au bout).
    const running = engines.filter(e => states[e.id]?.status === 'running');
    const target = running.length > 0
      ? running[running.length - 1]
      : engines.slice().reverse().find(e => states[e.id]?.status === 'done');
    if (!target) return;
    if (lastScrolledRef.current === target.id) return;
    const el = engineRefs.current[target.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      lastScrolledRef.current = target.id;
    }
  }, [analyzing, engines, states]);

  const completedCount = engines.filter(e => states[e.id]?.status === 'done').length;
  const errorCount = engines.filter(e => states[e.id]?.status === 'error').length;
  const total = engines.length;
  const progressPercent = Math.round((completedCount / total) * 100);

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}m${rem > 0 ? rem.toString().padStart(2, '0') : ''}`;
  };

  const elapsedLabel = elapsedMs !== undefined && elapsedMs > 0
    ? formatTime(elapsedMs)
    : null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(247, 240, 230, 0.96)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(40, 30, 20, 0.15)',
        padding: '14px 20px 12px',
        marginBottom: 18,
      }}
    >
      {/* Ligne de tete : titre + compteur global */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 10,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <span style={{
            fontSize: 10,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            opacity: 0.6,
            marginRight: 8,
          }}>
            {analyzing ? 'Pipeline en cours' : 'Pipeline terminé'}
          </span>
          <span style={{
            fontFamily: 'var(--serif, Georgia, serif)',
            fontSize: 14,
          }}>
            {completedCount}/{total} moteur{total > 1 ? 's' : ''}
            {errorCount > 0 ? ` · ${errorCount} erreur${errorCount > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        {elapsedLabel && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            {analyzing ? 'Temps écoulé · ' : 'Durée totale · '}
            <span style={{ fontFamily: 'var(--serif, Georgia, serif)', fontSize: 13 }}>
              {elapsedLabel}
            </span>
          </span>
        )}
      </div>

      {/* Barre de progression fine */}
      <div style={{
        height: 2,
        background: 'rgba(40, 30, 20, 0.10)',
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progressPercent}%`,
          background: errorCount > 0 ? '#a04438' : 'var(--ink, #2a1f12)',
          transition: 'width 400ms ease',
        }} />
      </div>

      {/* Flow horizontal des moteurs avec scroll horizontal sur mobile */}
      <div
        ref={flowRef}
        style={{
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {engines.map((engine, i) => {
          const state = states[engine.id] || { status: 'idle' as const };
          const isLast = i === engines.length - 1;
          const isClickable = state.status === 'done' && onEngineClick;

          // Duree du moteur : completedAt - startedAt si terminé,
          // now - startedAt si en cours. Si durationMs est fourni
          // explicitement (cas du reload depuis l historique), on
          // prend cette valeur en priorite.
          let duration: string | null = null;
          if (state.durationMs != null) {
            duration = formatTime(state.durationMs);
          } else if (state.startedAt) {
            const end = state.completedAt || Date.now();
            duration = formatTime(end - state.startedAt);
          }

          // Couleurs et icones par statut
          const palette = {
            idle: { bg: 'transparent', border: 'rgba(40, 30, 20, 0.20)', fg: 'rgba(40, 30, 20, 0.40)', icon: '○' },
            running: { bg: 'rgba(196, 164, 132, 0.22)', border: '#c4a484', fg: 'var(--ink, #2a1f12)', icon: '◐' },
            done: { bg: 'rgba(70, 100, 70, 0.10)', border: '#5a7a5a', fg: '#3a5a3a', icon: '●' },
            error: { bg: 'rgba(160, 68, 56, 0.10)', border: '#a04438', fg: '#a04438', icon: '✕' },
          }[state.status];

          const isRunning = state.status === 'running';

          return (
            <div
              key={engine.id}
              ref={(el) => { engineRefs.current[engine.id] = el; }}
              style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <button
                type="button"
                onClick={isClickable ? () => onEngineClick(engine.id) : undefined}
                title={engine.label || engine.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  border: `1px solid ${palette.border}`,
                  background: palette.bg,
                  color: palette.fg,
                  fontFamily: 'inherit',
                  fontSize: 11,
                  cursor: isClickable ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  transition: 'all 200ms ease',
                  minHeight: 28,
                  position: 'relative',
                  overflow: 'hidden',
                  // Highlight visible du moteur en cours :
                  boxShadow: isRunning
                    ? '0 0 0 2px rgba(196, 164, 132, 0.30), 0 1px 4px rgba(196, 164, 132, 0.30)'
                    : 'none',
                }}
              >
                {/* Mini barre indeterminee qui defile sous le bouton du
                    moteur en cours pour signaler le travail en arriere-plan */}
                {isRunning && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      height: 2,
                      background: 'linear-gradient(90deg, transparent, #c4a484, transparent)',
                      backgroundSize: '50% 100%',
                      backgroundRepeat: 'no-repeat',
                      animation: 'preludeShimmer 1.4s linear infinite',
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: 1,
                    width: 12,
                    height: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: isRunning ? 'preludePulse 1.4s ease-in-out infinite' : 'none',
                  }}
                >
                  {palette.icon}
                </span>
                <span style={{ letterSpacing: '0.02em' }}>
                  {engine.name}
                </span>
                {duration && (
                  <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 2 }}>
                    {duration}
                  </span>
                )}
              </button>
              {!isLast && (
                <span style={{
                  width: 10,
                  height: 1,
                  background: state.status === 'done' ? '#5a7a5a' : 'rgba(40, 30, 20, 0.15)',
                  flexShrink: 0,
                  margin: '0 1px',
                }} />
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes preludePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes preludeShimmer {
          0% { background-position: -50% 0; }
          100% { background-position: 150% 0; }
        }
      `}</style>
    </div>
  );
}
