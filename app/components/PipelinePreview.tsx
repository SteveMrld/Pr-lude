'use client';

import { useEffect, useState } from 'react';

interface Step {
  label: string;
  durationMs: number;
}

const PIPELINE_STEPS: Step[] = [
  { label: 'Lecture du dossier', durationMs: 600 },
  { label: 'Équipe', durationMs: 800 },
  { label: 'Marché', durationMs: 700 },
  { label: 'Macro', durationMs: 500 },
  { label: 'Pattern matching', durationMs: 700 },
  { label: 'Aveuglement collectif', durationMs: 800 },
  { label: 'Singularités contrariennes', durationMs: 800 },
  { label: 'Cohérence financière', durationMs: 700 },
  { label: 'Orchestration', durationMs: 600 },
];

const TOTAL_LOOP_MS = PIPELINE_STEPS.reduce((s, x) => s + x.durationMs, 0) + 1500; // +pause finale
const PAUSE_AFTER_LOOP_MS = 2000;

/**
 * Demonstration animee du pipeline. Defile sur ~8 secondes en montrant
 * les moteurs s'enchainer puis affiche un verdict synthetique. Boucle.
 *
 * Utilise pour la home page : illustre concretement ce que produit
 * Prelude sans avoir besoin de connecter une vraie analyse. Garde la
 * meme palette editoriale (encre, ocre, vert sombre) et la meme
 * typographie que le bandeau du vrai pipeline.
 */
export default function PipelinePreview() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showVerdict, setShowVerdict] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeouts: any[] = [];

    const runLoop = () => {
      if (cancelled) return;
      setCurrentStep(0);
      setCompletedSteps(new Set());
      setShowVerdict(false);

      let elapsed = 0;
      PIPELINE_STEPS.forEach((step, i) => {
        const startAt = elapsed;
        const endAt = elapsed + step.durationMs;
        timeouts.push(setTimeout(() => {
          if (cancelled) return;
          setCurrentStep(i);
        }, startAt));
        timeouts.push(setTimeout(() => {
          if (cancelled) return;
          setCompletedSteps(prev => {
            const next = new Set(prev);
            next.add(i);
            return next;
          });
        }, endAt));
        elapsed = endAt;
      });

      // Affichage verdict apres tous les steps
      timeouts.push(setTimeout(() => {
        if (cancelled) return;
        setShowVerdict(true);
      }, elapsed + 300));

      // Restart apres pause
      timeouts.push(setTimeout(runLoop, elapsed + PAUSE_AFTER_LOOP_MS));
    };

    runLoop();

    return () => {
      cancelled = true;
      timeouts.forEach(t => clearTimeout(t));
    };
  }, []);

  return (
    <div style={{
      maxWidth: 720,
      margin: '40px auto 0',
      padding: '20px 22px',
      background: 'rgba(247, 240, 230, 0.6)',
      border: '1px solid rgba(40, 30, 20, 0.12)',
      fontSize: 12,
    }}>
      <div style={{
        fontSize: 10,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        opacity: 0.6,
        marginBottom: 14,
      }}>
        Démonstration · Pipeline d'instruction
      </div>

      {/* Liste des étapes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PIPELINE_STEPS.map((step, i) => {
          const isDone = completedSteps.has(i);
          const isCurrent = currentStep === i && !isDone;
          const isUpcoming = !isDone && !isCurrent;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '4px 0',
                opacity: isUpcoming ? 0.3 : 1,
                transition: 'opacity 300ms ease',
              }}
            >
              <span style={{
                fontSize: 11,
                width: 14,
                color: isDone ? '#3a5a3a' : isCurrent ? '#5a4a32' : 'rgba(40, 30, 20, 0.4)',
                animation: isCurrent ? 'previewPulse 1.0s ease-in-out infinite' : 'none',
              }}>
                {isDone ? '●' : isCurrent ? '◐' : '○'}
              </span>
              <span style={{
                fontFamily: 'var(--serif, Georgia, serif)',
                fontSize: 13,
                flex: 1,
                color: isDone ? 'var(--ink, #2a1f12)' : isCurrent ? 'var(--ink, #2a1f12)' : 'rgba(40, 30, 20, 0.5)',
              }}>
                {step.label}
              </span>
              {isDone && (
                <span style={{ fontSize: 10, opacity: 0.55 }}>
                  ✓ {(step.durationMs / 100).toFixed(1)}s
                </span>
              )}
              {isCurrent && (
                <span style={{ fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>
                  en cours
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Verdict synthétique apparaît à la fin */}
      <div style={{
        marginTop: 18,
        paddingTop: 14,
        borderTop: '1px solid rgba(40, 30, 20, 0.10)',
        opacity: showVerdict ? 1 : 0,
        transition: 'opacity 600ms ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', opacity: 0.6, marginRight: 8 }}>
              Verdict
            </span>
            <span style={{ fontFamily: 'var(--serif, Georgia, serif)', fontSize: 16, fontWeight: 500 }}>
              Approfondir
            </span>
          </div>
          <div>
            <span style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', opacity: 0.6, marginRight: 8 }}>
              Probabilité de succès
            </span>
            <span style={{ fontFamily: 'var(--serif, Georgia, serif)', fontSize: 18, fontWeight: 500 }}>
              42<span style={{ fontSize: 12, opacity: 0.55 }}>%</span>
            </span>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.55, opacity: 0.75 }}>
          Tension dialectique non résolue. Singularité contrarienne forte sur la verticale produit, contrebalancée par une cohérence unit economics insuffisante. Cycle d'instruction supplémentaire requis avant signature.
        </div>
      </div>

      <style jsx>{`
        @keyframes previewPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
