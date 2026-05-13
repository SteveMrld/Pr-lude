'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  type DimensionKey,
  type FreshnessState,
} from '@/lib/engines/sectoral-intelligence';

// ============================================================
// CLIENT COMPONENT - DASHBOARD ADMIN SECTORAL
// ------------------------------------------------------------
// Voix Le Grand Continent / The Atlantic, palette claire alignee
// sur /admin/errors. Aucune fonctionnalite de modification
// manuelle des scores ou des definitions : la fiche est soit
// regeneree par LLM avec sources auditables, soit elle ne l est
// pas.
// ============================================================

interface SectorRow {
  slug: string;
  label: string;
  perimeter_brief: string;
  latest_brief_id: string | null;
  generated_at: string | null;
  age_days: number | null;
  freshness: FreshnessState;
  total_sources_cited: number;
  scores: Record<DimensionKey, number | null>;
  data_missing_count: number;
  regeneration_trigger: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
}

interface LogEntry {
  brief_id: string;
  sector_slug: string;
  sector_label: string;
  generated_at: string;
  regeneration_trigger: string;
  dimension_model: string | null;
  aggregator_model: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  dimensions_regenerated: DimensionKey[];
  total_sources_cited: number;
}

interface AdminPayload {
  sectors: SectorRow[];
  log: LogEntry[];
  generated_at: string;
}

interface Props {
  userEmail: string;
}

export default function SectoralAdminClient({ userEmail }: Props) {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<'full' | 'dimension' | null>(null);
  const [dimensionSelector, setDimensionSelector] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/sectoral?logLimit=30');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Erreur ${res.status}`);
      }
      const payload = (await res.json()) as AdminPayload;
      setData(payload);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function triggerRegeneration(
    sectorSlug: string,
    mode: 'full' | 'dimension',
    dimension?: DimensionKey,
  ) {
    setPendingSlug(sectorSlug);
    setPendingMode(mode);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/sectoral/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sector_slug: sectorSlug,
          mode,
          dimension: dimension ?? null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `Erreur ${res.status}`);
      }
      const dimText = dimension ? ` (dimension ${DIMENSION_LABELS[dimension]})` : '';
      setStatusMessage(
        `Regeneration lancee pour ${sectorSlug}${dimText}. La fiche apparaitra dans la table d ici une a deux minutes.`,
      );
      setDimensionSelector(null);
      // Petit polling discret apres 30s puis 90s pour rafraichir
      // sans imposer une attente synchrone a l admin.
      setTimeout(() => fetchData(), 30_000);
      setTimeout(() => fetchData(), 90_000);
    } catch (err: any) {
      setStatusMessage(`Echec : ${err?.message || 'erreur inconnue'}`);
    } finally {
      setPendingSlug(null);
      setPendingMode(null);
    }
  }

  return (
    <main className="sa-main">
      <header className="sa-header">
        <div>
          <div className="sa-eyebrow">Administration · Prélude</div>
          <h1 className="sa-title">Cartographie sectorielle</h1>
          <div className="sa-meta">Connecté en super-admin · {userEmail}</div>
          <p className="sa-lede">
            Treize secteurs, huit dimensions par fiche. Chaque
            régénération est tracée, datée, sourcée. Aucune édition
            manuelle des scores : une fiche est régénérée par LLM
            avec sources auditables, ou elle ne l&apos;est pas.
          </p>
        </div>
        <div className="sa-actions">
          <Link href="/" className="sa-link">Retour</Link>
          <button onClick={fetchData} className="sa-btn">Rafraîchir</button>
        </div>
      </header>

      {statusMessage && <div className="sa-status">{statusMessage}</div>}
      {error && <div className="sa-error">{error}</div>}
      {loading && !data && <div className="sa-loading">Chargement…</div>}

      {data && (
        <>
          <SectorsTable
            sectors={data.sectors}
            onTriggerFull={(slug) => triggerRegeneration(slug, 'full')}
            onOpenDimensionSelector={(slug) => setDimensionSelector(slug)}
            pendingSlug={pendingSlug}
            pendingMode={pendingMode}
            dimensionSelectorSlug={dimensionSelector}
            onPickDimension={(slug, dim) => triggerRegeneration(slug, 'dimension', dim)}
            onCloseDimensionSelector={() => setDimensionSelector(null)}
          />

          <RecentLog log={data.log} />
        </>
      )}

      <style jsx>{`
        .sa-main {
          max-width: 1280px;
          margin: 0 auto;
          padding: 40px 24px 80px;
          font-family: var(--serif);
          color: var(--ink);
        }
        .sa-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          padding-bottom: 24px;
          border-bottom: 2px solid var(--hairline-strong);
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .sa-eyebrow {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
          margin-bottom: 8px;
        }
        .sa-title {
          font-size: 32px;
          font-weight: 500;
          line-height: 1.15;
          color: var(--ink);
          margin-bottom: 8px;
        }
        .sa-meta {
          font-family: var(--sans);
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 12px;
        }
        .sa-lede {
          font-size: 15px;
          line-height: 1.55;
          color: var(--ink-soft);
          max-width: 760px;
          margin: 0;
        }
        .sa-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .sa-link, .sa-btn {
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
        .sa-link:hover, .sa-btn:hover {
          border-color: var(--ink);
        }
        .sa-status {
          padding: 12px 16px;
          background: var(--paper-accent);
          border-left: 3px solid var(--accent);
          font-size: 13px;
          color: var(--ink);
          margin-bottom: 16px;
        }
        .sa-error {
          padding: 14px 18px;
          background: var(--rouge-anglais-soft);
          border-left: 3px solid var(--rouge-anglais);
          color: var(--rouge-anglais);
          font-size: 13px;
          margin-bottom: 16px;
        }
        .sa-loading {
          padding: 40px 20px;
          text-align: center;
          color: var(--muted);
          font-style: italic;
          font-size: 14px;
        }
      `}</style>
    </main>
  );
}

// ============================================================
// TABLE DES SECTEURS
// ============================================================

interface SectorsTableProps {
  sectors: SectorRow[];
  onTriggerFull: (slug: string) => void;
  onOpenDimensionSelector: (slug: string) => void;
  onPickDimension: (slug: string, dim: DimensionKey) => void;
  onCloseDimensionSelector: () => void;
  pendingSlug: string | null;
  pendingMode: 'full' | 'dimension' | null;
  dimensionSelectorSlug: string | null;
}

function SectorsTable({
  sectors,
  onTriggerFull,
  onOpenDimensionSelector,
  onPickDimension,
  onCloseDimensionSelector,
  pendingSlug,
  pendingMode,
  dimensionSelectorSlug,
}: SectorsTableProps) {
  return (
    <section className="sa-table">
      <header className="sa-table-head">
        <div className="sa-th sa-th-sector">Secteur</div>
        <div className="sa-th sa-th-fresh">État</div>
        <div className="sa-th sa-th-date">Dernière régénération</div>
        <div className="sa-th sa-th-sources">Sources</div>
        <div className="sa-th sa-th-scores">Distribution des huit scores</div>
        <div className="sa-th sa-th-actions">Actions</div>
      </header>

      {sectors.map((row) => (
        <SectorRowComponent
          key={row.slug}
          row={row}
          isPending={pendingSlug === row.slug}
          pendingMode={pendingMode}
          showDimensionSelector={dimensionSelectorSlug === row.slug}
          onTriggerFull={() => onTriggerFull(row.slug)}
          onOpenDimensionSelector={() => onOpenDimensionSelector(row.slug)}
          onPickDimension={(dim) => onPickDimension(row.slug, dim)}
          onCloseDimensionSelector={onCloseDimensionSelector}
        />
      ))}

      <style jsx>{`
        .sa-table {
          background: var(--surface);
          border: 1px solid var(--hairline);
          margin-bottom: 40px;
        }
        .sa-table-head {
          display: grid;
          grid-template-columns: 2fr 1.1fr 1.4fr 0.7fr 2.4fr 1.5fr;
          gap: 16px;
          padding: 14px 18px;
          background: var(--paper-accent);
          border-bottom: 1px solid var(--hairline);
        }
        .sa-th {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
        }
        @media (max-width: 1100px) {
          .sa-table-head { display: none; }
        }
      `}</style>
    </section>
  );
}

interface SectorRowComponentProps {
  row: SectorRow;
  isPending: boolean;
  pendingMode: 'full' | 'dimension' | null;
  showDimensionSelector: boolean;
  onTriggerFull: () => void;
  onOpenDimensionSelector: () => void;
  onPickDimension: (dim: DimensionKey) => void;
  onCloseDimensionSelector: () => void;
}

function SectorRowComponent({
  row,
  isPending,
  pendingMode,
  showDimensionSelector,
  onTriggerFull,
  onOpenDimensionSelector,
  onPickDimension,
  onCloseDimensionSelector,
}: SectorRowComponentProps) {
  const freshnessText = useMemo(() => freshnessLabel(row.freshness), [row.freshness]);
  const ageText = formatAge(row.age_days);

  return (
    <article className="sa-row">
      <div className="sa-row-grid">
        <div className="sa-cell sa-cell-sector">
          <div className="sa-sector-label">{row.label}</div>
          <div className="sa-sector-slug">{row.slug}</div>
        </div>

        <div className="sa-cell sa-cell-fresh">
          <span
            className="sa-freshness-pill"
            data-state={row.freshness}
          >
            {freshnessText}
          </span>
        </div>

        <div className="sa-cell sa-cell-date">
          {row.generated_at ? (
            <>
              <div className="sa-date">{formatDate(row.generated_at)}</div>
              <div className="sa-age">{ageText}</div>
              {row.regeneration_trigger && (
                <div className="sa-trigger">via {row.regeneration_trigger}</div>
              )}
            </>
          ) : (
            <div className="sa-date sa-empty">Jamais générée</div>
          )}
        </div>

        <div className="sa-cell sa-cell-sources">
          <div className="sa-sources-num">{row.total_sources_cited}</div>
          {row.data_missing_count > 0 && (
            <div className="sa-data-missing">{row.data_missing_count} données manquantes</div>
          )}
        </div>

        <div className="sa-cell sa-cell-scores">
          <ScoresMiniBars scores={row.scores} />
        </div>

        <div className="sa-cell sa-cell-actions">
          <button
            className="sa-action-btn"
            onClick={onTriggerFull}
            disabled={isPending}
          >
            {isPending && pendingMode === 'full' ? 'Lancement…' : 'Régénérer la fiche'}
          </button>
          <button
            className="sa-action-btn sa-action-secondary"
            onClick={onOpenDimensionSelector}
            disabled={isPending}
          >
            {isPending && pendingMode === 'dimension' ? 'Lancement…' : 'Une dimension'}
          </button>
        </div>
      </div>

      {showDimensionSelector && (
        <div className="sa-dim-panel">
          <div className="sa-dim-head">
            <span>Choisir la dimension à régénérer</span>
            <button className="sa-dim-close" onClick={onCloseDimensionSelector}>
              Annuler
            </button>
          </div>
          <div className="sa-dim-grid">
            {DIMENSION_KEYS.map((dim) => (
              <button
                key={dim}
                className="sa-dim-btn"
                onClick={() => onPickDimension(dim)}
              >
                <span className="sa-dim-label">{DIMENSION_LABELS[dim]}</span>
                <span className="sa-dim-score">
                  {row.scores[dim] !== null ? `${row.scores[dim]}/100` : 'donnée manquante'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .sa-row {
          border-bottom: 1px solid var(--hairline);
        }
        .sa-row:last-child {
          border-bottom: none;
        }
        .sa-row-grid {
          display: grid;
          grid-template-columns: 2fr 1.1fr 1.4fr 0.7fr 2.4fr 1.5fr;
          gap: 16px;
          padding: 18px;
          align-items: start;
        }
        .sa-cell { font-size: 13px; line-height: 1.45; }
        .sa-sector-label {
          font-family: var(--serif);
          font-size: 15px;
          font-weight: 500;
          color: var(--ink);
          margin-bottom: 4px;
        }
        .sa-sector-slug {
          font-family: var(--mono);
          font-size: 10.5px;
          color: var(--muted);
        }
        .sa-freshness-pill {
          display: inline-block;
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 4px 10px;
          border: 1px solid;
          border-radius: 999px;
          font-weight: 600;
        }
        .sa-freshness-pill[data-state='a_jour'] {
          color: #2f6f3e;
          border-color: #2f6f3e;
          background: #effaf1;
        }
        .sa-freshness-pill[data-state='recommandee'] {
          color: var(--ocre-brule, #a6691a);
          border-color: var(--ocre-brule, #a6691a);
          background: #fbf3e3;
        }
        .sa-freshness-pill[data-state='perimee'] {
          color: var(--rouge-anglais, #a23b2c);
          border-color: var(--rouge-anglais, #a23b2c);
          background: #fbeae6;
        }
        .sa-date {
          font-family: var(--sans);
          font-size: 12.5px;
          color: var(--ink);
        }
        .sa-date.sa-empty {
          font-style: italic;
          color: var(--muted);
        }
        .sa-age {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
        }
        .sa-trigger {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
          margin-top: 4px;
        }
        .sa-sources-num {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 500;
          color: var(--ink);
        }
        .sa-data-missing {
          font-family: var(--sans);
          font-size: 10px;
          color: var(--rouge-anglais, #a23b2c);
          margin-top: 4px;
        }
        .sa-action-btn {
          display: block;
          width: 100%;
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 8px 12px;
          border: 1px solid var(--ink);
          background: var(--ink);
          color: var(--paper);
          cursor: pointer;
          margin-bottom: 6px;
          border-radius: 4px;
          font-weight: 500;
          transition: all var(--motion-fast);
        }
        .sa-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sa-action-btn:hover:not(:disabled) {
          background: var(--ink-soft);
          border-color: var(--ink-soft);
        }
        .sa-action-secondary {
          background: transparent;
          color: var(--ink);
        }
        .sa-action-secondary:hover:not(:disabled) {
          background: var(--paper-accent);
          color: var(--ink);
        }
        .sa-dim-panel {
          padding: 16px 18px 22px;
          background: var(--paper-accent);
          border-top: 1px solid var(--hairline);
        }
        .sa-dim-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
        }
        .sa-dim-close {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: transparent;
          border: 1px solid var(--hairline);
          color: var(--ink);
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
        }
        .sa-dim-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 8px;
        }
        .sa-dim-btn {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 4px;
          cursor: pointer;
          font-family: var(--sans);
          text-align: left;
          transition: border-color var(--motion-fast);
        }
        .sa-dim-btn:hover {
          border-color: var(--ink);
        }
        .sa-dim-label {
          font-size: 12px;
          color: var(--ink);
        }
        .sa-dim-score {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--muted);
        }
        @media (max-width: 1100px) {
          .sa-row-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .sa-cell-actions {
            display: flex;
            gap: 8px;
          }
          .sa-action-btn {
            margin-bottom: 0;
          }
        }
      `}</style>
    </article>
  );
}

// ============================================================
// MINI BARRES DES HUIT SCORES
// ------------------------------------------------------------
// Visualisation rapide. Chaque dimension est une barre verticale,
// hauteur proportionnelle au score 0-100. Donnee manquante = barre
// hachuree gris pale. Tooltip natif sur hover.
// ============================================================

function ScoresMiniBars({ scores }: { scores: Record<DimensionKey, number | null> }) {
  return (
    <div className="bars">
      {DIMENSION_KEYS.map((k) => {
        const score = scores[k];
        const isMissing = score === null || score === undefined;
        const heightPct = isMissing ? 100 : Math.max(2, score);
        return (
          <div
            key={k}
            className={`bar ${isMissing ? 'bar-missing' : ''}`}
            title={`${DIMENSION_LABELS[k]} : ${isMissing ? 'donnée manquante' : `${score}/100`}`}
          >
            <span
              className="bar-fill"
              style={{
                height: `${heightPct}%`,
                opacity: isMissing ? 0.25 : 1,
              }}
            />
          </div>
        );
      })}
      <style jsx>{`
        .bars {
          display: flex;
          gap: 4px;
          align-items: flex-end;
          height: 44px;
        }
        .bar {
          width: 14px;
          height: 100%;
          background: var(--paper-accent);
          border: 1px solid var(--hairline);
          position: relative;
          display: flex;
          align-items: flex-end;
          border-radius: 1px;
        }
        .bar-fill {
          display: block;
          width: 100%;
          background: var(--ink);
        }
        .bar-missing .bar-fill {
          background: repeating-linear-gradient(
            45deg,
            var(--muted, #999),
            var(--muted, #999) 2px,
            transparent 2px,
            transparent 4px
          );
        }
      `}</style>
    </div>
  );
}

// ============================================================
// LOG DE REGENERATIONS RECENTES
// ============================================================

function RecentLog({ log }: { log: LogEntry[] }) {
  if (log.length === 0) {
    return (
      <section className="rl">
        <h2 className="rl-title">Journal des régénérations récentes</h2>
        <div className="rl-empty">Aucune régénération enregistrée pour l&apos;instant.</div>
        <style jsx>{logStyles}</style>
      </section>
    );
  }
  return (
    <section className="rl">
      <h2 className="rl-title">Journal des régénérations récentes</h2>
      <div className="rl-list">
        {log.map((entry) => (
          <div key={entry.brief_id} className="rl-row">
            <div className="rl-row-head">
              <div className="rl-sector">{entry.sector_label}</div>
              <div className="rl-date">{formatDate(entry.generated_at)}</div>
            </div>
            <div className="rl-meta">
              <span className="rl-trigger" data-trigger={entry.regeneration_trigger}>
                {entry.regeneration_trigger}
              </span>
              {entry.dimensions_regenerated.length === 8 ? (
                <span className="rl-scope">fiche complète</span>
              ) : (
                <span className="rl-scope">
                  {entry.dimensions_regenerated.length} dimension{entry.dimensions_regenerated.length > 1 ? 's' : ''} :{' '}
                  {entry.dimensions_regenerated
                    .map((d) => DIMENSION_LABELS[d])
                    .join(', ')}
                </span>
              )}
              {entry.dimension_model && (
                <span className="rl-model">dimensions {entry.dimension_model}</span>
              )}
              {entry.aggregator_model && entry.dimensions_regenerated.length === 8 && (
                <span className="rl-model">agrégation {entry.aggregator_model}</span>
              )}
              {entry.cost_usd !== null && (
                <span className="rl-cost">{formatCost(entry.cost_usd)}</span>
              )}
              {entry.duration_ms !== null && (
                <span className="rl-duration">{formatDuration(entry.duration_ms)}</span>
              )}
              <span className="rl-sources">{entry.total_sources_cited} sources</span>
            </div>
          </div>
        ))}
      </div>
      <style jsx>{logStyles}</style>
    </section>
  );
}

const logStyles = `
  .rl {
    background: var(--surface);
    border: 1px solid var(--hairline);
    padding: 24px 24px 28px;
  }
  .rl-title {
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 500;
    color: var(--ink);
    margin: 0 0 16px;
  }
  .rl-empty {
    font-style: italic;
    color: var(--muted);
    font-size: 13px;
  }
  .rl-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .rl-row {
    padding: 12px 14px;
    background: var(--paper-accent);
    border-left: 2px solid var(--hairline);
  }
  .rl-row-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    flex-wrap: wrap;
    gap: 6px;
  }
  .rl-sector {
    font-family: var(--serif);
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
  }
  .rl-date {
    font-family: var(--sans);
    font-size: 11px;
    color: var(--muted);
  }
  .rl-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 14px;
    font-family: var(--sans);
    font-size: 11px;
    color: var(--ink-soft);
  }
  .rl-trigger {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    font-size: 10px;
    padding: 2px 7px;
    border: 1px solid var(--hairline);
    border-radius: 999px;
  }
  .rl-trigger[data-trigger='manual'] {
    color: var(--accent);
    border-color: var(--accent);
  }
  .rl-trigger[data-trigger='cron'] {
    color: var(--ink);
    border-color: var(--ink);
  }
  .rl-trigger[data-trigger='event'] {
    color: var(--ocre-brule, #a6691a);
    border-color: var(--ocre-brule, #a6691a);
  }
  .rl-model, .rl-cost, .rl-duration, .rl-sources {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--muted);
  }
  .rl-scope {
    font-style: italic;
  }
`;

// ============================================================
// HELPERS DE FORMATAGE
// ============================================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAge(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return "il y a moins d'un jour";
  if (days === 1) return 'il y a 1 jour';
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.round(days / 30);
  if (months === 1) return 'il y a environ 1 mois';
  return `il y a environ ${months} mois`;
}

function formatCost(usd: number): string {
  if (usd === 0) return '0 $';
  if (usd < 0.01) return '< 0,01 $';
  return `${usd.toFixed(2)} $`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min} min ${rem} s`;
}

function freshnessLabel(state: FreshnessState): string {
  switch (state) {
    case 'a_jour':
      return 'A jour';
    case 'recommandee':
      return 'Régénération recommandée';
    case 'perimee':
      return 'Périmée';
  }
}
