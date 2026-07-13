'use client';

// ============================================================
// PredictionSnapshot - cliche fige de la prediction loguee
// ------------------------------------------------------------
// Affiche en lecture seule ce que Prelude a predit pour ce
// dossier au moment de l analyse : verdict, score global,
// probabilite de succes, six scores de dimension, plus un
// resume compact du version stamp (commit + configs). Le record
// est immuable par contrat ; on ne propose aucun controle d
// edition. Si plusieurs runs ont eu lieu, on montre le plus
// recent et on signale le nombre d historiques disponibles.
//
// Brique reconciliation du pilier preuve.
// ============================================================

import { useEffect, useState } from 'react';
import SectionFallbackLine from './SectionFallbackLine';

interface PredictionRecord {
  id: string;
  capturedAt: string;
  verdict: string;
  globalScore: number | null;
  successProbability: number | null;
  dimensions: {
    team: number | null;
    market: number | null;
    macro: number | null;
    financial: number | null;
    contrarian: number | null;
    vigilance: number | null;
  };
  stampFingerprint: {
    commitSha: string | null;
    configsHash: string | null;
    enginesHash: string | null;
    modelsHash: string | null;
  };
  schemaVersion: string;
}

const DIMENSION_LABELS: Record<string, string> = {
  team: 'Équipe',
  market: 'Marché',
  macro: 'Macro',
  financial: 'Modèle économique',
  contrarian: 'Contrariens',
  vigilance: 'Vigilance',
};

function shortHash(h: string | null): string {
  if (!h) return '—';
  return h.slice(0, 8);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatScore(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return Math.round(v).toString();
}

export default function PredictionSnapshot({
  analysisId,
  printMode = false,
}: {
  analysisId: string;
  /** Rendu fige pour export PDF : jamais de spinner, ligne neutre a la place. */
  printMode?: boolean;
}) {
  const [latest, setLatest] = useState<PredictionRecord | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'empty' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/analyses/${analysisId}/prediction-record`);
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
        const records = (json.records as PredictionRecord[]) || [];
        if (records.length === 0) {
          setState('empty');
          return;
        }
        setLatest(records[0]);
        setHistoryCount(records.length);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  if (state === 'auth') return null;
  // Rendu fige (printMode / export PDF) : jamais de spinner, ligne neutre
  // section 6 a la place. La prediction loguee n a de sens que dans
  // l instance vivante ou le partner peut la lire/completer.
  if (printMode && (state === 'loading' || state === 'error' || state === 'empty')) {
    return <SectionFallbackLine kind="suivi-reconciliation" />;
  }
  if (state === 'loading') {
    return <p className="ps-loading">Chargement de la prédiction loguée...</p>;
  }
  if (state === 'error') {
    return <p className="ps-error">Lecture de la prédiction indisponible.</p>;
  }
  if (state === 'empty' || !latest) {
    return (
      <div className="ps">
        <h4 className="ps-title">Prédiction loguée</h4>
        <p className="ps-empty">
          Aucun cliché de prédiction enregistré pour ce dossier. Le record est créé
          automatiquement à la fin du pipeline ; cette absence signale soit une analyse
          antérieure au déploiement de la brique réconciliation, soit un échec de
          persistance qu&apos;il faut investiguer.
        </p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="ps">
      <div className="ps-header">
        <h4 className="ps-title">Prédiction loguée</h4>
        <span className="ps-captured">capturée le {formatDate(latest.capturedAt)}</span>
      </div>
      {historyCount > 1 && (
        <p className="ps-history">
          {historyCount} clichés sur ce dossier (relances successives). Affichage du plus récent.
        </p>
      )}
      <div className="ps-headline">
        <div className="ps-headline-item">
          <span className="ps-headline-label">Verdict</span>
          <span className="ps-headline-value">{latest.verdict}</span>
        </div>
        <div className="ps-headline-item">
          <span className="ps-headline-label">Score global</span>
          <span className="ps-headline-value">{formatScore(latest.globalScore)} / 100</span>
        </div>
        <div className="ps-headline-item">
          <span className="ps-headline-label">Probabilité de succès</span>
          <span className="ps-headline-value">
            {latest.successProbability === null ? '—' : `${formatScore(latest.successProbability)}%`}
          </span>
        </div>
      </div>
      <div className="ps-dims">
        {(Object.keys(DIMENSION_LABELS) as Array<keyof typeof DIMENSION_LABELS>).map((k) => (
          <div key={k} className="ps-dim">
            <span className="ps-dim-label">{DIMENSION_LABELS[k]}</span>
            <span className="ps-dim-value">{formatScore(latest.dimensions[k as keyof typeof latest.dimensions])}</span>
          </div>
        ))}
      </div>
      <details className="ps-stamp">
        <summary>Tampon de version</summary>
        <dl className="ps-stamp-grid">
          <div><dt>Commit</dt><dd>{shortHash(latest.stampFingerprint.commitSha)}</dd></div>
          <div><dt>Configs</dt><dd>{shortHash(latest.stampFingerprint.configsHash)}</dd></div>
          <div><dt>Moteurs</dt><dd>{shortHash(latest.stampFingerprint.enginesHash)}</dd></div>
          <div><dt>Modèles LLM</dt><dd>{shortHash(latest.stampFingerprint.modelsHash)}</dd></div>
          <div><dt>Schéma</dt><dd>{latest.schemaVersion}</dd></div>
        </dl>
        <p className="ps-stamp-note">
          Le tampon rattache cette prédiction à la version exacte du code, des configs et
          des moteurs qui l&apos;ont produite. Deux prédictions du même tampon sont
          comparables ; une refonte de prompt ou de seuil rebat les cartes.
        </p>
      </details>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .ps {
    margin-bottom: 28px;
    padding: 20px 22px;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 10px;
  }
  .ps-loading, .ps-error {
    padding: 16px;
    color: var(--muted);
    font-style: italic;
    font-size: 13px;
  }
  .ps-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .ps-title {
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }
  .ps-captured {
    font-family: var(--sans);
    font-size: 11px;
    color: var(--muted);
  }
  .ps-history {
    margin: 0 0 12px 0;
    font-size: 12px;
    color: var(--muted);
    font-style: italic;
  }
  .ps-empty {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }
  .ps-headline {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 14px 0;
    border-top: 1px solid var(--hairline);
    border-bottom: 1px solid var(--hairline);
    margin: 12px 0 14px 0;
  }
  @media (max-width: 600px) {
    .ps-headline { grid-template-columns: 1fr; }
  }
  .ps-headline-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ps-headline-label {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ps-headline-value {
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    font-feature-settings: "lnum","tnum";
  }
  .ps-dims {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }
  @media (max-width: 720px) {
    .ps-dims { grid-template-columns: repeat(3, 1fr); }
  }
  .ps-dim {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
  }
  .ps-dim-label {
    font-family: var(--sans);
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ps-dim-value {
    font-family: var(--serif);
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
    font-feature-settings: "lnum","tnum";
  }
  .ps-stamp {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--hairline);
  }
  .ps-stamp summary {
    font-family: var(--sans);
    font-size: 11px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--accent);
    cursor: pointer;
  }
  .ps-stamp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px 16px;
    margin: 10px 0;
  }
  .ps-stamp-grid dt {
    font-family: var(--sans);
    font-size: 9px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0;
  }
  .ps-stamp-grid dd {
    font-family: var(--mono, ui-monospace);
    font-size: 12px;
    color: var(--ink);
    margin: 2px 0 0 0;
  }
  .ps-stamp-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--muted);
  }
`;
