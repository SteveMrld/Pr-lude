'use client';

import { useEffect, useRef, useState } from 'react';
import { Picto } from './Picto';

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
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--hairline)',
        padding: '14px 20px 12px',
        marginBottom: 18,
      }}
    >
      {/* Ligne de tete : titre + compteur global */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--sans)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: analyzing ? 'var(--ocre-brule)' : 'var(--vert-foret)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: analyzing ? 'var(--ocre-brule)' : 'var(--vert-foret)',
              animation: analyzing ? 'preludePulse 1.4s ease-in-out infinite' : 'none',
            }} />
            {analyzing ? 'Pipeline en cours' : 'Pipeline terminé'}
          </span>
          <span style={{
            fontFamily: 'var(--serif)',
            fontSize: 15,
            color: 'var(--ink)',
            fontWeight: 600,
          }}>
            {completedCount}/{total}
            <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>
              moteur{total > 1 ? 's' : ''}
            </span>
            {errorCount > 0 && (
              <span style={{ marginLeft: 10, color: 'var(--warn)', fontSize: 13 }}>
                · {errorCount} erreur{errorCount > 1 ? 's' : ''}
              </span>
            )}
          </span>
        </div>
        {elapsedLabel && (
          <span style={{
            fontSize: 11,
            color: 'var(--muted)',
            fontFamily: 'var(--sans)',
            letterSpacing: '0.04em',
          }}>
            {analyzing ? 'Temps écoulé · ' : 'Durée totale · '}
            <span style={{
              fontFamily: 'var(--serif)',
              fontSize: 13,
              color: 'var(--ink)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {elapsedLabel}
            </span>
          </span>
        )}
      </div>

      {/* Barre de progression : 3px, fond hairline, fill bleu encre. */}
      <div style={{
        height: 3,
        background: 'var(--hairline-soft)',
        marginBottom: 14,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2,
      }}>
        <div style={{
          height: '100%',
          width: `${progressPercent}%`,
          background: errorCount > 0
            ? 'var(--warn)'
            : 'linear-gradient(90deg, var(--accent), var(--accent-mid))',
          transition: 'width 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          borderRadius: 2,
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

          // Palette par statut. Aligne sur les tokens du design system :
          // bleu encre (running) / vert (done) / rouge (error) / hairline (idle).
          // Couleurs en variables CSS pour qu une evolution future de la palette
          // ne necessite pas de toucher ce composant.
          type StatusPalette = {
            bg: string;
            border: string;
            fg: string;
            iconName: 'circle' | 'circle-half' | 'check' | 'sparkle';
          };
          const palette: StatusPalette = ({
            idle:    { bg: 'var(--surface)',         border: 'var(--hairline)',          fg: 'var(--muted-soft)', iconName: 'circle' },
            running: { bg: 'var(--ocre-brule-soft)', border: 'var(--ocre-brule)',         fg: 'var(--ocre-brule)', iconName: 'circle-half' },
            done:    { bg: 'var(--vert-foret-soft)', border: 'var(--vert-foret)',         fg: 'var(--vert-foret)', iconName: 'check' },
            error:   { bg: 'var(--warn-soft)',       border: 'var(--warn)',               fg: 'var(--warn)',       iconName: 'sparkle' },
          } as const)[state.status];

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
                  gap: 7,
                  padding: '7px 12px',
                  border: `1px solid ${palette.border}`,
                  background: palette.bg,
                  color: palette.fg,
                  fontFamily: 'inherit',
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: isClickable ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                  minHeight: 30,
                  borderRadius: 999,
                  position: 'relative',
                  overflow: 'hidden',
                  // Highlight visible du moteur en cours : ombre douce ocre.
                  boxShadow: isRunning
                    ? '0 0 0 3px rgba(180, 83, 9, 0.15), 0 1px 4px rgba(180, 83, 9, 0.20)'
                    : 'none',
                }}
              >
                {/* Mini barre indeterminee defile sous le pill du moteur en cours
                    pour signaler le travail en arriere-plan. Gradient ocre. */}
                {isRunning && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      height: 2,
                      background: 'linear-gradient(90deg, transparent, var(--ocre-brule), transparent)',
                      backgroundSize: '50% 100%',
                      backgroundRepeat: 'no-repeat',
                      animation: 'preludeShimmer 1.4s linear infinite',
                    }}
                  />
                )}
                <span
                  style={{
                    width: 14,
                    height: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: isRunning ? 'preludePulse 1.4s ease-in-out infinite' : 'none',
                    color: palette.fg,
                    flexShrink: 0,
                  }}
                >
                  <Picto name={palette.iconName} size={14} strokeWidth={2} />
                </span>
                <span style={{ letterSpacing: '0.01em', color: state.status === 'idle' ? 'var(--muted-soft)' : 'var(--ink)' }}>
                  {engine.name}
                </span>
                {duration && (
                  <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 2, fontVariantNumeric: 'tabular-nums' }}>
                    {duration}
                  </span>
                )}
              </button>
              {!isLast && (
                <span style={{
                  width: 12,
                  height: 1,
                  background: state.status === 'done' ? 'var(--vert-foret)' : 'var(--hairline)',
                  flexShrink: 0,
                  margin: '0 2px',
                  transition: 'background 220ms cubic-bezier(0.16, 1, 0.3, 1)',
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
