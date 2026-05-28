// ============================================================
// FICHE SECTORIELLE COMPLETE - CLIENT
// ------------------------------------------------------------
// Trois vues commutables :
//
//   - 'single'    : fiche isolee, taille pleine
//   - 'overlay'   : superposition avec un autre secteur du catalogue
//   - 'temporal'  : comparaison T versus T-N (selection parmi
//                   l historique anterieur)
//
// Le toggle de vue est un trio de boutons sobres en haut. La
// selection du secteur secondaire (overlay) ou de la fiche
// historique (temporal) est en ligne avec le toggle.
// ============================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  SectoralSpiderChart,
  SectoralSuperposition,
  SectoralTemporalComparison,
  formatSectoralDate,
} from '@/app/components/sectoral';
import { computeFreshness } from '@/lib/engines/sectoral-injection-pure';
import { PALETTE } from '@/lib/visuals/spiderweb';
import type { SectoralBrief } from '@/lib/engines/sectoral-intelligence/client';

type ViewMode = 'single' | 'overlay' | 'temporal';

interface SectorMeta {
  slug: string;
  label: string;
  perimeter: string;
}

interface Props {
  sector: SectorMeta;
  current: SectoralBrief | null;
  history: SectoralBrief[];
  otherSectors: Array<{ slug: string; label: string; brief: SectoralBrief | null }>;
  orgName: string;
  userEmail: string;
}

export default function SecteurDetailClient({
  sector,
  current,
  history,
  otherSectors,
  orgName,
  userEmail,
}: Props): React.ReactElement {
  const [viewMode, setViewMode] = React.useState<ViewMode>('single');
  const [overlaySlug, setOverlaySlug] = React.useState<string | null>(() => {
    const firstAvailable = otherSectors.find((s) => s.brief !== null);
    return firstAvailable?.slug ?? null;
  });
  const [historyId, setHistoryId] = React.useState<string | null>(
    history.length > 0 ? (history[0].id ?? null) : null,
  );

  const overlayBrief = React.useMemo(() => {
    if (!overlaySlug) return null;
    return otherSectors.find((s) => s.slug === overlaySlug)?.brief ?? null;
  }, [overlaySlug, otherSectors]);
  const overlayLabel = React.useMemo(() => {
    if (!overlaySlug) return null;
    return otherSectors.find((s) => s.slug === overlaySlug)?.label ?? null;
  }, [overlaySlug, otherSectors]);

  const historyBrief = React.useMemo(() => {
    if (!historyId) return null;
    return history.find((b) => b.id === historyId) ?? null;
  }, [historyId, history]);

  return (
    <main className="sectoral-detail-page">
      <header className="sectoral-detail-header">
        <Link href="/portfolio/secteurs" className="sectoral-back">
          ← Catalogue sectoriel
        </Link>
        <div className="sectoral-page-id">
          <div className="sectoral-org">{orgName}</div>
          <div className="sectoral-user">{userEmail}</div>
        </div>
      </header>

      <section className="sectoral-detail-intro">
        <div className="sectoral-kicker">
          <span className="sectoral-kicker-dot"></span>
          <span>Fiche sectorielle Prelude</span>
        </div>
        <h1 className="sectoral-detail-title">{sector.label}</h1>
        <p className="sectoral-detail-perimeter">{sector.perimeter}</p>
        {current && (
          <p className="sectoral-detail-meta">
            Dernière génération le {formatSectoralDate(current.generated_at)}{' '}
            {(() => {
              const { freshness, ageDays } = computeFreshness(current.generated_at);
              if (freshness === 'stale') {
                return `(âge ${Math.floor(ageDays / 30)} mois, régénération recommandée)`;
              }
              return `(${ageDays} jours)`;
            })()}
          </p>
        )}
      </section>

      {!current && (
        <section className="sectoral-detail-empty" data-testid="sectoral-detail-empty">
          <p>
            Aucune fiche sectorielle n&apos;est encore persistée pour {sector.label}.
            La première génération est attendue au prochain cycle trimestriel
            ou par déclenchement manuel depuis la page admin.
          </p>
        </section>
      )}

      {current && (
        <>
          <div className="sectoral-detail-controls" data-testid="sectoral-detail-controls">
            <div className="sectoral-detail-toggle">
              <button
                type="button"
                className={viewMode === 'single' ? 'is-active' : ''}
                onClick={() => setViewMode('single')}
              >
                Fiche isolee
              </button>
              <button
                type="button"
                className={viewMode === 'overlay' ? 'is-active' : ''}
                onClick={() => setViewMode('overlay')}
                disabled={otherSectors.every((s) => s.brief === null)}
              >
                Superposition
              </button>
              <button
                type="button"
                className={viewMode === 'temporal' ? 'is-active' : ''}
                onClick={() => setViewMode('temporal')}
                disabled={history.length === 0}
              >
                Comparaison temporelle
              </button>
            </div>

            {viewMode === 'overlay' && (
              <label className="sectoral-detail-select">
                <span>Secteur de comparaison</span>
                <select
                  value={overlaySlug ?? ''}
                  onChange={(ev) => setOverlaySlug(ev.target.value || null)}
                  data-testid="sectoral-detail-overlay-select"
                >
                  {otherSectors.map((s) => (
                    <option key={s.slug} value={s.slug} disabled={!s.brief}>
                      {s.label}
                      {!s.brief ? ' (aucune fiche)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {viewMode === 'temporal' && (
              <label className="sectoral-detail-select">
                <span>Reference historique</span>
                <select
                  value={historyId ?? ''}
                  onChange={(ev) => setHistoryId(ev.target.value || null)}
                  data-testid="sectoral-detail-history-select"
                >
                  {history.map((b) => (
                    <option key={b.id ?? b.generated_at} value={b.id ?? ''}>
                      Fiche du {formatSectoralDate(b.generated_at)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="sectoral-detail-chart" data-testid="sectoral-detail-chart">
            {viewMode === 'single' && (
              <SectoralSpiderChart
                brief={current}
                sectorLabel={sector.label}
                mode={
                  computeFreshness(current.generated_at).freshness === 'stale'
                    ? 'stale'
                    : 'fresh'
                }
                size={480}
                expandable
                defaultExpanded
              />
            )}

            {viewMode === 'overlay' && overlayBrief && overlayLabel && (
              <SectoralSuperposition
                primary={current}
                secondary={overlayBrief}
                primaryLabel={sector.label}
                secondaryLabel={overlayLabel}
                size={480}
              />
            )}

            {viewMode === 'overlay' && (!overlayBrief || !overlayLabel) && (
              <p className="sectoral-detail-fallback">
                Selectionne un secteur disponible pour produire la superposition.
              </p>
            )}

            {viewMode === 'temporal' && historyBrief && (
              <SectoralTemporalComparison
                current={current}
                previous={historyBrief}
                sectorLabel={sector.label}
                size={480}
              />
            )}

            {viewMode === 'temporal' && !historyBrief && (
              <p className="sectoral-detail-fallback">
                Aucune reference historique anterieure n est disponible pour ce
                secteur. La comparaison temporelle s active au deuxieme cycle
                de regeneration.
              </p>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .sectoral-detail-page {
          background: ${PALETTE.cream};
          min-height: 100vh;
          padding: 24px 32px 80px;
          color: ${PALETTE.encre};
          font-family: var(--serif, Georgia, serif);
        }
        .sectoral-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding-bottom: 16px;
          border-bottom: 1px solid ${PALETTE.ocreEteint};
          margin-bottom: 32px;
        }
        .sectoral-back {
          font-family: var(--grotesque-condensed, sans-serif);
          font-size: 0.82rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: ${PALETTE.ocreBrule};
          text-decoration: none;
        }
        .sectoral-back:hover {
          color: ${PALETTE.encre};
        }
        .sectoral-page-id {
          text-align: right;
          font-family: var(--grotesque-condensed, sans-serif);
          font-size: 0.8rem;
        }
        .sectoral-org {
          color: ${PALETTE.encre};
          font-weight: 600;
        }
        .sectoral-user {
          color: ${PALETTE.sepia};
          margin-top: 2px;
        }
        .sectoral-detail-intro {
          max-width: 880px;
          margin: 0 auto 24px;
        }
        .sectoral-kicker {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--grotesque-condensed, sans-serif);
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${PALETTE.sepia};
          margin-bottom: 8px;
        }
        .sectoral-kicker-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${PALETTE.ocreBrule};
        }
        .sectoral-detail-title {
          font-size: 2rem;
          line-height: 1.2;
          font-weight: 600;
          margin: 0 0 8px;
        }
        .sectoral-detail-perimeter {
          font-size: 0.95rem;
          line-height: 1.5;
          color: ${PALETTE.sepia};
          margin: 0 0 8px;
          font-style: italic;
        }
        .sectoral-detail-meta {
          font-family: var(--grotesque-condensed, sans-serif);
          font-size: 0.85rem;
          color: ${PALETTE.sepia};
          margin: 0;
        }
        .sectoral-detail-controls {
          display: flex;
          gap: 24px;
          align-items: center;
          flex-wrap: wrap;
          max-width: 880px;
          margin: 0 auto 24px;
          padding: 16px 0;
          border-bottom: 1px dashed ${PALETTE.ocreEteint};
        }
        .sectoral-detail-toggle {
          display: flex;
          gap: 0;
          border: 1px solid ${PALETTE.ocreEteint};
        }
        .sectoral-detail-toggle button {
          font-family: var(--serif, Georgia, serif);
          font-size: 0.88rem;
          background: transparent;
          color: ${PALETTE.encre};
          border: none;
          padding: 8px 14px;
          cursor: pointer;
          border-right: 1px solid ${PALETTE.ocreEteint};
        }
        .sectoral-detail-toggle button:last-child {
          border-right: none;
        }
        .sectoral-detail-toggle button:hover:not(:disabled) {
          background: rgba(156, 90, 42, 0.06);
        }
        .sectoral-detail-toggle button.is-active {
          background: ${PALETTE.ocreBrule};
          color: ${PALETTE.cream};
        }
        .sectoral-detail-toggle button:disabled {
          color: ${PALETTE.sepia};
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sectoral-detail-select {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-family: var(--grotesque-condensed, sans-serif);
          font-size: 0.78rem;
          color: ${PALETTE.sepia};
        }
        .sectoral-detail-select select {
          font-family: var(--serif, Georgia, serif);
          font-size: 0.9rem;
          color: ${PALETTE.encre};
          background: ${PALETTE.cream};
          border: 1px solid ${PALETTE.ocreEteint};
          padding: 6px 10px;
          min-width: 240px;
        }
        .sectoral-detail-chart {
          max-width: 880px;
          margin: 0 auto;
        }
        .sectoral-detail-fallback {
          padding: 16px 20px;
          background: ${PALETTE.cream};
          border: 1px dashed ${PALETTE.ocreEteint};
          font-style: italic;
          color: ${PALETTE.sepia};
          text-align: center;
        }
        .sectoral-detail-empty {
          max-width: 880px;
          margin: 0 auto;
          padding: 24px;
          background: ${PALETTE.cream};
          border: 1px dashed ${PALETTE.ocreEteint};
          text-align: center;
          font-style: italic;
          color: ${PALETTE.sepia};
        }
        .sectoral-detail-empty p {
          margin: 0;
        }
      `}</style>
    </main>
  );
}
