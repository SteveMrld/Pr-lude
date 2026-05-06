'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ============================================================
// CLIENT COMPONENT - DASHBOARD ERROR LOGS
// ------------------------------------------------------------
// Affiche les logs d erreur recents avec filtres severity et
// source. Permet de drill-down sur un log pour voir context et
// stack. Voix Le Grand Continent / The Atlantic, palette claire.
// ============================================================

interface ErrorLogRow {
  id: string;
  occurred_at: string;
  severity: 'error' | 'warning' | 'info';
  source: string;
  message: string;
  context: Record<string, any>;
  organization_id: string | null;
  user_id: string | null;
  analysis_id: string | null;
}

interface Stats {
  total: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
}

interface Props {
  userEmail: string;
}

const SEVERITY_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Toutes' },
  { value: 'error', label: 'Erreurs' },
  { value: 'warning', label: 'Avertissements' },
  { value: 'info', label: 'Infos' },
];

const SOURCE_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Toutes sources' },
  { value: 'pipeline.', label: 'Moteurs pipeline' },
  { value: 'api.', label: 'Routes API' },
  { value: 'external.', label: 'Services externes' },
];

export default function ErrorLogsClient({ userEmail }: Props) {
  const [logs, setLogs] = useState<ErrorLogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState('');
  const [source, setSource] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (severity) params.set('severity', severity);
      if (source) params.set('source', source);
      params.set('limit', '200');
      const res = await fetch(`/api/admin/error-logs?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [severity, source]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function severityColor(s: string): string {
    if (s === 'error') return 'var(--rouge-anglais)';
    if (s === 'warning') return 'var(--ocre-brule)';
    return 'var(--muted)';
  }

  return (
    <main className="el-main">
      <header className="el-header">
        <div>
          <div className="el-eyebrow">Administration · Prélude</div>
          <h1 className="el-title">Logs d&apos;erreurs serveur</h1>
          <div className="el-meta">Connecté en super-admin · {userEmail}</div>
        </div>
        <div className="el-actions">
          <Link href="/" className="el-link">Retour</Link>
          <button onClick={fetchLogs} className="el-btn">Rafraîchir</button>
        </div>
      </header>

      {stats && (
        <section className="el-stats">
          <div className="el-stat">
            <div className="el-stat-num">{stats.total}</div>
            <div className="el-stat-label">Total fenêtre</div>
          </div>
          <div className="el-stat">
            <div className="el-stat-num" style={{ color: 'var(--rouge-anglais)' }}>
              {stats.bySeverity.error || 0}
            </div>
            <div className="el-stat-label">Erreurs</div>
          </div>
          <div className="el-stat">
            <div className="el-stat-num" style={{ color: 'var(--ocre-brule)' }}>
              {stats.bySeverity.warning || 0}
            </div>
            <div className="el-stat-label">Avertissements</div>
          </div>
          <div className="el-stat">
            <div className="el-stat-num">{stats.bySeverity.info || 0}</div>
            <div className="el-stat-label">Infos</div>
          </div>
        </section>
      )}

      <section className="el-filters">
        <div className="el-filter">
          <label className="el-filter-label">Sévérité</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="el-select"
          >
            {SEVERITY_FILTERS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="el-filter">
          <label className="el-filter-label">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="el-select"
          >
            {SOURCE_FILTERS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </section>

      {error && <div className="el-error">{error}</div>}

      {loading && <div className="el-loading">Chargement…</div>}

      {!loading && logs.length === 0 && !error && (
        <div className="el-empty">
          Aucun log pour cette fenêtre. C&apos;est plutôt bon signe.
        </div>
      )}

      {!loading && logs.length > 0 && (
        <section className="el-table">
          {logs.map((log) => (
            <article
              key={log.id}
              className="el-row"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              <div className="el-row-head">
                <div className="el-row-meta">
                  <span
                    className="el-severity-pill"
                    style={{
                      color: severityColor(log.severity),
                      borderColor: severityColor(log.severity),
                    }}
                  >
                    {log.severity}
                  </span>
                  <span className="el-source">{log.source}</span>
                  <span className="el-date">{formatDate(log.occurred_at)}</span>
                </div>
              </div>
              <div className="el-message">{log.message}</div>

              {expandedId === log.id && (
                <div className="el-detail">
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div className="el-detail-block">
                      <div className="el-detail-label">Contexte</div>
                      <pre className="el-detail-content">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div className="el-detail-meta">
                    {log.organization_id && <span>Org · {log.organization_id.slice(0, 8)}</span>}
                    {log.analysis_id && <span>Analyse · {log.analysis_id.slice(0, 8)}</span>}
                    {log.user_id && <span>User · {log.user_id.slice(0, 8)}</span>}
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      <style jsx>{`
        .el-main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 24px 80px;
          font-family: var(--serif);
          color: var(--ink);
        }
        .el-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding-bottom: 24px;
          border-bottom: 2px solid var(--hairline-strong);
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .el-eyebrow {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
          margin-bottom: 8px;
        }
        .el-title {
          font-size: 32px;
          font-weight: 500;
          line-height: 1.15;
          color: var(--ink);
          margin-bottom: 8px;
        }
        .el-meta {
          font-family: var(--sans);
          font-size: 12px;
          color: var(--muted);
        }
        .el-actions { display: flex; gap: 12px; align-items: center; }
        .el-link, .el-btn {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink);
          padding: 9px 14px;
          border: 1px solid var(--hairline);
          background: var(--surface);
          text-decoration: none;
          cursor: pointer;
          transition: all var(--motion-fast);
          border-radius: 4px;
          font-weight: 500;
        }
        .el-link:hover, .el-btn:hover {
          border-color: var(--ink);
        }
        .el-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 32px;
        }
        .el-stat {
          padding: 18px 20px;
          background: var(--surface);
          border: 1px solid var(--hairline);
        }
        .el-stat-num {
          font-family: var(--serif);
          font-size: 36px;
          font-weight: 500;
          line-height: 1;
          margin-bottom: 6px;
        }
        .el-stat-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .el-filters {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .el-filter { display: flex; flex-direction: column; gap: 6px; }
        .el-filter-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
        }
        .el-select {
          padding: 8px 12px;
          border: 1px solid var(--hairline);
          background: var(--surface);
          color: var(--ink);
          font-family: var(--sans);
          font-size: 13px;
          border-radius: 4px;
          cursor: pointer;
        }
        .el-error {
          padding: 14px 18px;
          background: var(--rouge-anglais-soft);
          border-left: 3px solid var(--rouge-anglais);
          color: var(--rouge-anglais);
          font-size: 13px;
          margin-bottom: 16px;
        }
        .el-loading, .el-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--muted);
          font-family: var(--serif);
          font-size: 14px;
          font-style: italic;
        }
        .el-table { display: flex; flex-direction: column; gap: 8px; }
        .el-row {
          padding: 16px 20px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          cursor: pointer;
          transition: border-color var(--motion-fast);
        }
        .el-row:hover { border-color: var(--ink); }
        .el-row-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .el-row-meta { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .el-severity-pill {
          font-family: var(--sans);
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 3px 8px;
          border: 1px solid;
          border-radius: 999px;
          font-weight: 600;
        }
        .el-source {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--ink-soft);
        }
        .el-date {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
        }
        .el-message {
          font-size: 14px;
          line-height: 1.5;
          color: var(--ink);
          font-family: var(--serif);
        }
        .el-detail {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--hairline);
        }
        .el-detail-block { margin-bottom: 12px; }
        .el-detail-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
          margin-bottom: 6px;
        }
        .el-detail-content {
          font-family: var(--mono);
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--ink-soft);
          background: var(--paper-accent);
          padding: 10px 12px;
          border-radius: 4px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .el-detail-meta {
          display: flex;
          gap: 16px;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--muted);
          flex-wrap: wrap;
        }
        @media (max-width: 700px) {
          .el-main { padding: 24px 16px 60px; }
          .el-title { font-size: 24px; }
          .el-stats { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </main>
  );
}
