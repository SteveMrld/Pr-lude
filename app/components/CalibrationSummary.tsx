'use client';

// ============================================================
// CalibrationSummary - rapport de calibration segmente par version
// ------------------------------------------------------------
// Affiche pour chaque fingerprint de version stamp distinct soit
// les metriques calculees (Brier, courbe, discrimination) soit
// l etat "non calibrable encore, N dossiers resolus sur M
// necessaires". Jamais de metrique trompeuse sous le seuil :
// echec honnete.
//
// Pilier preuve, brique reconciliation et calibration.
// ============================================================

import { useEffect, useState } from 'react';

interface SegmentKey {
  commitSha: string | null;
  configsHash: string | null;
  enginesHash: string | null;
  modelsHash: string | null;
}

interface CalibrationBin {
  binLower: number;
  binUpper: number;
  count: number;
  meanPredicted: number;
  observedFrequency: number;
}

type Segment =
  | {
      calibrable: true;
      segmentKey: SegmentKey;
      resolvedCount: number;
      brier: number;
      discrimination: number;
      bins: CalibrationBin[];
    }
  | {
      calibrable: false;
      segmentKey: SegmentKey;
      resolvedCount: number;
      requiredCount: number;
      reason: 'insufficient-data';
    };

interface Summary {
  predictionsLogged: number;
  analysesWithPrediction: number;
  outcomesRecorded: number;
  totalResolved: number;
  totalUnresolved: number;
  minResolvedPerSegment: number;
  anyCalibrable: boolean;
  segments: Segment[];
}

function shortHash(h: string | null): string {
  if (!h) return '—';
  return h.slice(0, 8);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

export default function CalibrationSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/calibration/summary');
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setState('auth');
          return;
        }
        if (!res.ok) {
          setState('error');
          return;
        }
        const json = await res.json();
        setSummary(json.summary);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'auth') return null;
  if (state === 'loading') {
    return <p className="cs-loading">Chargement de la calibration...</p>;
  }
  if (state === 'error' || !summary) {
    return <p className="cs-error">Lecture de la calibration indisponible.</p>;
  }

  return (
    <div className="cs">
      <div className="cs-header">
        <h4 className="cs-title">Calibration du fonds</h4>
        <span className="cs-counts">
          {summary.predictionsLogged} prédictions loguées · {summary.outcomesRecorded} issues saisies
          · {summary.totalResolved} dossiers résolus
        </span>
      </div>

      {!summary.anyCalibrable && summary.segments.length === 0 && (
        <p className="cs-empty">
          Aucune prédiction loguée pour le moment. La calibration commence à se calculer
          dès qu&apos;une analyse a été sauvegardée et qu&apos;une issue marché lui a été
          rattachée. Sous {summary.minResolvedPerSegment} dossiers résolus par version,
          aucune métrique n&apos;est affichée : on refuse de produire une moyenne sur un
          échantillon trop petit pour être lue sérieusement.
        </p>
      )}

      {summary.segments.length > 0 && (
        <div className="cs-segments">
          {summary.segments.map((seg, i) => (
            <SegmentCard key={i} segment={seg} />
          ))}
        </div>
      )}

      <p className="cs-discipline">
        Chaque segment correspond à un tampon de version distinct (commit applicatif,
        configs de scoring, prompts moteurs, modèles LLM). On ne mélange jamais des
        prédictions produites par des instruments différents : ce serait moyenner des
        choses qui ne se mesurent pas dans la même unité.
      </p>

      <style jsx>{styles}</style>
    </div>
  );
}

function SegmentCard({ segment }: { segment: Segment }) {
  if (segment.calibrable === false) {
    const resolved = segment.resolvedCount;
    const required = segment.requiredCount;
    return (
      <div className="cs-segment cs-segment-empty">
        <div className="cs-segment-head">
          <div className="cs-stamp">
            <span>{shortHash(segment.segmentKey.commitSha)}</span>
            <span className="cs-dot">·</span>
            <span>configs {shortHash(segment.segmentKey.configsHash)}</span>
            <span className="cs-dot">·</span>
            <span>moteurs {shortHash(segment.segmentKey.enginesHash)}</span>
          </div>
          <span className="cs-status cs-status-empty">Non calibrable encore</span>
        </div>
        <p className="cs-segment-msg">
          {resolved} dossier{resolved > 1 ? 's' : ''} résolu
          {resolved > 1 ? 's' : ''} sur {required} nécessaire
          {required > 1 ? 's' : ''} pour produire une métrique fiable.
        </p>
        <style jsx>{segmentStyles}</style>
      </div>
    );
  }

  return (
    <div className="cs-segment cs-segment-ready">
      <div className="cs-segment-head">
        <div className="cs-stamp">
          <span>{shortHash(segment.segmentKey.commitSha)}</span>
          <span className="cs-dot">·</span>
          <span>configs {shortHash(segment.segmentKey.configsHash)}</span>
          <span className="cs-dot">·</span>
          <span>moteurs {shortHash(segment.segmentKey.enginesHash)}</span>
        </div>
        <span className="cs-status cs-status-ready">{segment.resolvedCount} résolus</span>
      </div>
      <div className="cs-metrics">
        <div className="cs-metric">
          <span className="cs-metric-label">Brier</span>
          <span className="cs-metric-value">{segment.brier.toFixed(3)}</span>
          <span className="cs-metric-hint">0 parfait, 0,25 aléatoire</span>
        </div>
        <div className="cs-metric">
          <span className="cs-metric-label">Discrimination</span>
          <span className="cs-metric-value">{segment.discrimination.toFixed(2)}</span>
          <span className="cs-metric-hint">0,5 aléatoire, 1 parfaite</span>
        </div>
      </div>
      {segment.bins.length > 0 && (
        <table className="cs-curve">
          <thead>
            <tr>
              <th>Bin</th>
              <th>n</th>
              <th>Prédit moyen</th>
              <th>Observé réel</th>
            </tr>
          </thead>
          <tbody>
            {segment.bins.map((b, i) => (
              <tr key={i}>
                <td>{pct(b.binLower)}–{pct(b.binUpper)}</td>
                <td>{b.count}</td>
                <td>{pct(b.meanPredicted)}</td>
                <td>{pct(b.observedFrequency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <style jsx>{segmentStyles}</style>
    </div>
  );
}

const styles = `
  .cs {
    margin-bottom: 28px;
    padding: 20px 22px;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 10px;
  }
  .cs-loading, .cs-error {
    padding: 16px;
    color: var(--muted);
    font-style: italic;
    font-size: 13px;
  }
  .cs-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cs-title {
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }
  .cs-counts {
    font-family: var(--sans);
    font-size: 11px;
    color: var(--muted);
  }
  .cs-empty {
    margin: 0 0 12px 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }
  .cs-segments {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 12px 0;
  }
  .cs-discipline {
    margin: 16px 0 0 0;
    padding-top: 12px;
    border-top: 1px solid var(--hairline);
    font-size: 12px;
    line-height: 1.6;
    color: var(--muted);
    font-style: italic;
  }
`;

const segmentStyles = `
  .cs-segment {
    padding: 12px 14px;
    border: 1px solid var(--hairline);
    border-radius: 8px;
    background: var(--paper);
  }
  .cs-segment-empty {
    border-style: dashed;
    background: var(--paper-accent, transparent);
  }
  .cs-segment-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }
  .cs-stamp {
    font-family: var(--mono, ui-monospace);
    font-size: 11px;
    color: var(--muted);
  }
  .cs-dot { margin: 0 4px; }
  .cs-status {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .cs-status-empty {
    background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.12));
    color: var(--ocre-brule, #b47832);
  }
  .cs-status-ready {
    background: var(--vert-foret-soft, rgba(31, 95, 63, 0.12));
    color: var(--vert-foret, #1f5f3f);
  }
  .cs-segment-msg {
    margin: 0;
    font-size: 12.5px;
    color: var(--ink);
    line-height: 1.5;
  }
  .cs-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin: 10px 0;
  }
  .cs-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cs-metric-label {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .cs-metric-value {
    font-family: var(--serif);
    font-size: 22px;
    font-weight: 700;
    color: var(--ink);
    font-feature-settings: "lnum","tnum";
  }
  .cs-metric-hint {
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
  }
  .cs-curve {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 12px;
  }
  .cs-curve th, .cs-curve td {
    text-align: right;
    padding: 4px 6px;
    border-bottom: 1px solid var(--hairline);
    font-feature-settings: "lnum","tnum";
  }
  .cs-curve th {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .cs-curve td:first-child, .cs-curve th:first-child {
    text-align: left;
  }
`;
