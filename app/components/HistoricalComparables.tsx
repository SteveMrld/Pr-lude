'use client';

// ============================================================
// HISTORICAL COMPARABLES
// ------------------------------------------------------------
// Affiche les 5 dossiers historiques les plus proches du dossier
// en cours, avec leur outcome (success / medium / fail / active),
// et le pattern dominant.
//
// Inspiration : PULSAR VC Comparable Engine.
// Repond a la question editoriale : "ce dossier ressemble a quels
// cas passes du marche europeen ?".
// ============================================================

import { useEffect, useState } from 'react';

interface Comparable {
  id: string;
  name: string;
  country: string;
  sector: string;
  subSector: string | null;
  founded: number | null;
  outcome: string;
  exitType: string | null;
  features: {
    founder: number;
    market: number;
    traction: number;
    deal: number;
    defensibility: number;
    risk: number;
  };
  finalScore: number;
  signalsPositive: string | null;
  signalsNegative: string | null;
  similarity: number;
  sectorMatch: 'exact' | 'related' | 'different';
}

interface TrajectoryScenario {
  label: string;
  probability: number;
  multipleRange: string;
  multipleMedian: number;
  exampleCase: Comparable | null;
  narrative: string;
}

interface ComparablesData {
  features: {
    founder: number; market: number; traction: number;
    deal: number; defensibility: number; risk: number;
    sector: string | null;
  };
  topComparables: Comparable[];
  outcomeDistribution: {
    success: number; medium: number; fail: number; active: number; total: number;
  };
  trajectory: {
    optimistic: TrajectoryScenario;
    median: TrajectoryScenario;
    downside: TrajectoryScenario;
    expectedMultiple: number;
    narrative: string;
  };
  dominantPattern: 'success-leaning' | 'fail-leaning' | 'mixed';
  closestSuccess: Comparable | null;
  closestFailure: Comparable | null;
  diligenceQuestions: string[];
}

interface Props {
  analysisId: string;
}

const OUTCOME_LABELS: Record<string, string> = {
  success: 'Succès',
  success_private: 'Succès (privé)',
  success_exit: 'Succès (exit)',
  medium: 'Mitigé',
  active: 'Actif',
  fail: 'Échec',
  fail_uncertain: 'Échec probable',
  fail_weak_exit: 'Échec (sortie faible)',
  volatile_private: 'Volatile',
};

const OUTCOME_COLORS: Record<string, string> = {
  success: 'var(--vert-foret)',
  success_private: 'var(--vert-foret)',
  success_exit: 'var(--vert-foret)',
  medium: 'var(--ocre-brule)',
  active: 'var(--accent)',
  fail: 'var(--warn)',
  fail_uncertain: 'var(--warn)',
  fail_weak_exit: 'var(--warn)',
  volatile_private: 'var(--ocre-brule)',
};

const PATTERN_LABELS: Record<string, { label: string; color: string; tone: string }> = {
  'success-leaning': {
    label: 'Pattern dominant : succès',
    color: 'var(--vert-foret)',
    tone: 'La majorité des cas comparables ont produit un outcome positif. Cela ne garantit rien, mais le narratif est aligné avec des trajectoires connues qui ont fonctionné.',
  },
  'fail-leaning': {
    label: 'Pattern dominant : échec',
    color: 'var(--warn)',
    tone: 'Une part significative des cas comparables a échoué. La diligence doit identifier les écarts précis avec ces cas et la thèse qui justifie un outcome différent.',
  },
  'mixed': {
    label: 'Pattern mixte',
    color: 'var(--accent)',
    tone: 'Les cas comparables se répartissent entre succès, mitigés et échecs. Le dossier est dans une zone d\'ambiguïté où le verdict dépend de variables propres au dossier que les comparables ne capturent pas.',
  },
};

export default function HistoricalComparables({ analysisId }: Props) {
  const [data, setData] = useState<ComparablesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/analyses/${analysisId}/comparables`);
        if (!res.ok) {
          if (cancelled) return;
          if (res.status === 422) {
            setError('Données scoring insuffisantes pour rapprocher de cas historiques.');
          } else {
            setError('Comparables indisponibles.');
          }
          setLoading(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Erreur réseau.');
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [analysisId]);

  if (loading) {
    return (
      <div className="hc-loading">
        <span className="hc-loading-dot"></span>
        <span>Recherche des cas comparables...</span>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="hc-empty">
        <p>{error || 'Comparables indisponibles.'}</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  const pattern = PATTERN_LABELS[data.dominantPattern];

  return (
    <div className="hc">
      <div className="hc-pattern" style={{ borderLeftColor: pattern.color }}>
        <div className="hc-pattern-label" style={{ color: pattern.color }}>
          {pattern.label}
        </div>
        <p className="hc-pattern-tone">{pattern.tone}</p>
        <div className="hc-distribution">
          <div className="hc-dist-cell">
            <div className="hc-dist-num" style={{ color: 'var(--vert-foret)' }}>{data.outcomeDistribution.success}</div>
            <div className="hc-dist-label">Succès</div>
          </div>
          <div className="hc-dist-cell">
            <div className="hc-dist-num" style={{ color: 'var(--ocre-brule)' }}>{data.outcomeDistribution.medium}</div>
            <div className="hc-dist-label">Mitigés</div>
          </div>
          <div className="hc-dist-cell">
            <div className="hc-dist-num" style={{ color: 'var(--warn)' }}>{data.outcomeDistribution.fail}</div>
            <div className="hc-dist-label">Échecs</div>
          </div>
          <div className="hc-dist-cell">
            <div className="hc-dist-num" style={{ color: 'var(--accent)' }}>{data.outcomeDistribution.active}</div>
            <div className="hc-dist-label">Actifs</div>
          </div>
        </div>
      </div>

      {/* TRAJECTOIRE PROJETEE - 3 scenarios optimistic / median / downside,
          deduits de la distribution des outcomes du top 5. Bornes de
          multiples heuristiques par classe d outcome. */}
      <div className="hc-trajectory">
        <div className="hc-trajectory-head">
          <div className="hc-trajectory-kicker">Trajectoire projetée</div>
          <div className="hc-trajectory-expected">
            <span className="hc-trajectory-expected-label">Espérance pondérée</span>
            <span className="hc-trajectory-expected-num">
              {data.trajectory.expectedMultiple < 1
                ? data.trajectory.expectedMultiple.toFixed(2).replace(/\.?0+$/, '')
                : (Math.round(data.trajectory.expectedMultiple * 10) / 10)}
              <span className="hc-trajectory-expected-x">x</span>
            </span>
          </div>
        </div>
        <p className="hc-trajectory-narrative">{data.trajectory.narrative}</p>
        <div className="hc-trajectory-grid">
          {(['optimistic', 'median', 'downside'] as const).map((key) => {
            const scenario = data.trajectory[key];
            const labels = {
              optimistic: { fr: 'Optimiste', color: 'var(--vert-foret)' },
              median: { fr: 'Median', color: 'var(--ocre-brule)' },
              downside: { fr: 'Downside', color: 'var(--warn)' },
            }[key];
            return (
              <div className="hc-scenario" key={key} style={{ borderTopColor: labels.color }}>
                <div className="hc-scenario-head">
                  <span className="hc-scenario-label" style={{ color: labels.color }}>
                    {labels.fr}
                  </span>
                  <span className="hc-scenario-prob">{scenario.probability}%</span>
                </div>
                <div className="hc-scenario-multiple">
                  <span className="hc-scenario-multiple-num" style={{ color: labels.color }}>
                    {scenario.multipleRange}
                  </span>
                  <span className="hc-scenario-multiple-label">multiple</span>
                </div>
                {scenario.exampleCase && (
                  <div className="hc-scenario-case">
                    Référence : <strong>{scenario.exampleCase.name}</strong>
                  </div>
                )}
                <p className="hc-scenario-narrative">{scenario.narrative}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hc-list">
        <div className="hc-list-header">
          <span>Cas comparables (top 5)</span>
        </div>
        {data.topComparables.map((c) => (
          <div className="hc-row" key={c.id}>
            <div className="hc-row-main">
              <div className="hc-row-name">
                {c.name}
                {c.sectorMatch === 'exact' && <span className="hc-pill hc-pill-exact">Même secteur</span>}
                {c.sectorMatch === 'related' && <span className="hc-pill hc-pill-related">Secteur voisin</span>}
              </div>
              <div className="hc-row-meta">
                {[c.country, c.sector, c.founded].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div className="hc-row-outcome" style={{
              color: OUTCOME_COLORS[c.outcome] || 'var(--muted)',
              borderColor: OUTCOME_COLORS[c.outcome] || 'var(--hairline)',
            }}>
              {OUTCOME_LABELS[c.outcome] || c.outcome}
            </div>
            <div className="hc-row-similarity">
              <div className="hc-row-similarity-num">{c.similarity}%</div>
              <div className="hc-row-similarity-label">similaire</div>
            </div>
          </div>
        ))}
      </div>

      {(data.closestSuccess || data.closestFailure) && (
        <div className="hc-narratives">
          {data.closestSuccess && (
            <div className="hc-narrative hc-narrative-success">
              <div className="hc-narrative-kicker">Cas de succès le plus proche</div>
              <div className="hc-narrative-name">{data.closestSuccess.name}</div>
              <p className="hc-narrative-text">{data.closestSuccess.signalsPositive}</p>
            </div>
          )}
          {data.closestFailure && (
            <div className="hc-narrative hc-narrative-fail">
              <div className="hc-narrative-kicker">Cas d&apos;échec le plus proche</div>
              <div className="hc-narrative-name">{data.closestFailure.name}</div>
              <p className="hc-narrative-text">{data.closestFailure.signalsNegative}</p>
            </div>
          )}
        </div>
      )}

      {data.diligenceQuestions.length > 0 && (
        <div className="hc-questions">
          <div className="hc-questions-kicker">Questions de diligence inspirées des cas comparables</div>
          <ul>
            {data.diligenceQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="hc-disclaimer">
        Les scores des cas comparables sont des inférences analytiques V1 (confidence 2/5).
        Le rapprochement est indicatif et doit être interprété par l&apos;analyste.
      </p>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .hc {
    font-family: var(--serif);
    color: var(--ink);
  }

  .hc-loading {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 24px;
    color: var(--muted);
    font-style: italic;
    background: var(--surface);
    border: 1px dashed var(--hairline);
    border-radius: 10px;
  }
  .hc-loading-dot {
    width: 8px;
    height: 8px;
    background: var(--accent);
    border-radius: 50%;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .hc-empty {
    padding: 24px;
    color: var(--muted);
    background: var(--surface);
    border: 1px dashed var(--hairline);
    border-radius: 10px;
    font-style: italic;
  }
  .hc-empty p { margin: 0; }

  .hc-pattern {
    padding: 18px 22px;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-left: 3px solid;
    border-radius: 0 10px 10px 0;
    margin-bottom: 24px;
  }
  .hc-pattern-label {
    font-family: var(--sans);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .hc-pattern-tone {
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0 0 18px 0;
  }
  .hc-distribution {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding-top: 14px;
    border-top: 1px solid var(--hairline-soft);
  }
  .hc-dist-cell {
    text-align: center;
  }
  .hc-dist-num {
    font-family: var(--serif);
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
    font-feature-settings: "lnum","tnum";
  }
  .hc-dist-label {
    font-family: var(--sans);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-top: 4px;
    font-weight: 600;
  }

  .hc-list {
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 24px;
  }

  /* TRAJECTORY */
  .hc-trajectory {
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 10px;
    padding: 22px 24px;
    margin-bottom: 24px;
  }
  .hc-trajectory-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .hc-trajectory-kicker {
    font-family: var(--sans);
    font-size: 11px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 700;
    padding-top: 4px;
  }
  .hc-trajectory-expected {
    text-align: right;
  }
  .hc-trajectory-expected-label {
    display: block;
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
    margin-bottom: 2px;
  }
  .hc-trajectory-expected-num {
    font-family: var(--serif);
    font-size: 28px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1;
    letter-spacing: -0.02em;
    font-feature-settings: "lnum","tnum";
  }
  .hc-trajectory-expected-x {
    font-size: 18px;
    opacity: 0.5;
    margin-left: 1px;
    font-weight: 500;
  }
  .hc-trajectory-narrative {
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0 0 18px 0;
  }
  .hc-trajectory-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .hc-scenario {
    padding: 14px 16px;
    background: var(--paper);
    border: 1px solid var(--hairline);
    border-top: 3px solid;
    border-radius: 0 0 8px 8px;
  }
  .hc-scenario-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
  }
  .hc-scenario-label {
    font-family: var(--sans);
    font-size: 10.5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .hc-scenario-prob {
    font-family: var(--serif);
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    font-feature-settings: "lnum","tnum";
  }
  .hc-scenario-multiple {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 8px;
  }
  .hc-scenario-multiple-num {
    font-family: var(--serif);
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.012em;
    font-feature-settings: "lnum","tnum";
  }
  .hc-scenario-multiple-label {
    font-family: var(--sans);
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .hc-scenario-case {
    font-family: var(--sans);
    font-size: 11.5px;
    color: var(--muted);
    margin-bottom: 10px;
    letter-spacing: 0.02em;
  }
  .hc-scenario-case strong {
    color: var(--ink);
    font-weight: 700;
  }
  .hc-scenario-narrative {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-soft);
    margin: 0;
  }
  .hc-list-header {
    padding: 12px 18px;
    background: var(--paper-accent);
    border-bottom: 1px solid var(--hairline);
    font-family: var(--sans);
    font-size: 11px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 700;
  }
  .hc-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--hairline-soft);
  }
  .hc-row:last-child { border-bottom: none; }
  .hc-row-main {
    min-width: 0;
  }
  .hc-row-name {
    font-family: var(--serif);
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 3px;
  }
  .hc-row-meta {
    font-family: var(--sans);
    font-size: 11.5px;
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  .hc-pill {
    font-family: var(--sans);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 999px;
    font-weight: 700;
  }
  .hc-pill-exact {
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid var(--accent);
  }
  .hc-pill-related {
    background: var(--hairline-soft);
    color: var(--muted);
    border: 1px solid var(--hairline);
  }
  .hc-row-outcome {
    font-family: var(--sans);
    font-size: 10.5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    font-weight: 700;
    padding: 5px 12px;
    border: 1px solid;
    border-radius: 999px;
  }
  .hc-row-similarity {
    text-align: right;
    min-width: 64px;
  }
  .hc-row-similarity-num {
    font-family: var(--serif);
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
    font-feature-settings: "lnum","tnum";
  }
  .hc-row-similarity-label {
    font-family: var(--sans);
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 0.04em;
    margin-top: 2px;
  }

  .hc-narratives {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 24px;
  }
  .hc-narrative {
    padding: 16px 18px;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-top: 3px solid;
    border-radius: 0 0 10px 10px;
  }
  .hc-narrative-success { border-top-color: var(--vert-foret); }
  .hc-narrative-fail { border-top-color: var(--warn); }
  .hc-narrative-kicker {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
    margin-bottom: 6px;
  }
  .hc-narrative-name {
    font-family: var(--serif);
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 8px;
  }
  .hc-narrative-text {
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0;
  }

  .hc-questions {
    padding: 18px 22px;
    background: var(--ocre-brule-soft);
    border-radius: 0 10px 10px 0;
    border-left: 3px solid var(--ocre-brule);
    margin-bottom: 16px;
  }
  .hc-questions-kicker {
    font-family: var(--sans);
    font-size: 11px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ocre-brule);
    font-weight: 700;
    margin-bottom: 12px;
  }
  .hc-questions ul {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
    line-height: 1.65;
    color: var(--ink);
  }
  .hc-questions li {
    margin-bottom: 6px;
  }

  .hc-disclaimer {
    font-family: var(--sans);
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
    margin: 0;
    padding: 8px 0;
    line-height: 1.5;
  }

  @media (max-width: 720px) {
    .hc-narratives { grid-template-columns: 1fr; }
    .hc-trajectory-grid { grid-template-columns: 1fr; }
    .hc-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .hc-row-outcome, .hc-row-similarity { justify-self: start; text-align: left; }
    .hc-distribution { grid-template-columns: repeat(2, 1fr); }
  }
`;
