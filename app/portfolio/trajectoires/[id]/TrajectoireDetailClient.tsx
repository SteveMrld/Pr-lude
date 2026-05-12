'use client';

// ============================================================
// TRAJECTOIRE DETAIL CLIENT
// ------------------------------------------------------------
// Drill-down d un dossier : timeline complète en SVG ocre brûlé,
// synthèse éditoriale globale, liste chronologique des transitions
// avec leur cran d alerte et leur synthèse.
// ============================================================

import Link from 'next/link';
import { TimelineGraph } from '@/app/components/TimelineGraph';
import type { PortfolioTrajectoryDetail } from '@/lib/portfolio-trajectoires-core';

interface Props {
  detail: PortfolioTrajectoryDetail;
  orgName: string;
  userEmail: string;
}

const STAGE_LABELS: Record<string, string> = {
  deposited: 'Déposé',
  in_review: 'En instruction',
  dd_field: 'DD terrain',
  ic_review: 'Pret pour IC',
  signed: 'Signé',
  declined: 'Refusé',
};

const CRAN_LABEL: Record<number, string> = {
  1: 'Cran 1 — Immédiat',
  2: 'Cran 2 — Immédiat',
  3: 'Cran 3 — Digest',
  4: 'Cran 4 — Passif',
};

const TRAJECTOIRE_LABEL: Record<string, string> = {
  amelioration: 'Amélioration nette',
  aggravation: 'Aggravation',
  stabilisation: 'Stabilisation',
  volatilite: 'Volatilité, signaux contradictoires',
};

function formatLongDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function cranColor(cran: number | null): string {
  switch (cran) {
    case 1: return '#7a2916';
    case 2: return '#7a3916';
    case 3: return '#7a5a1d';
    case 4: return 'var(--muted)';
    default: return 'var(--muted-soft)';
  }
}

function cranBg(cran: number | null): string {
  switch (cran) {
    case 1: return '#e9d3cc';
    case 2: return '#f3dec9';
    case 3: return '#fcf2dc';
    case 4: return '#ece9e1';
    default: return 'transparent';
  }
}

export default function TrajectoireDetailClient({ detail, orgName, userEmail }: Props) {
  const { snapshots, successiveComparisons, successiveAlerts, overallComparison } = detail;
  const hasChain = snapshots.length >= 2;

  return (
    <main className="tjd">
      <header className="tjd-header">
        <Link href="/portfolio/trajectoires" className="tjd-back">← Toutes les trajectoires</Link>
        <div className="tjd-header-id">
          <div className="tjd-org">{orgName}</div>
          <div className="tjd-user">{userEmail}</div>
        </div>
      </header>

      <section className="tjd-intro">
        <div className="tjd-kicker">
          <span className="tjd-kicker-dot" />
          <span>Trajectoire · Drill-down</span>
        </div>
        <h1 className="tjd-title">{detail.companyName}</h1>
        <div className="tjd-subtitle">
          {detail.sector && <span>{detail.sector}</span>}
          {detail.workflowStage && (
            <span>{STAGE_LABELS[detail.workflowStage] ?? detail.workflowStage}</span>
          )}
          <span>{detail.portfolioTag === 'in-portfolio' ? 'In-portfolio' : 'En instruction'}</span>
          <span>{snapshots.length} analyse{snapshots.length > 1 ? 's' : ''}</span>
        </div>

        <Link href={`/?analysis=${detail.analysisId}`} className="tjd-link-analysis">
          Ouvrir l analyse complète →
        </Link>
      </section>

      <section className="tjd-section">
        <div className="tjd-section-head">
          <div className="tjd-section-kicker">Vue d ensemble</div>
          <h2 className="tjd-section-title">
            {hasChain
              ? `Évolution du score global sur ${overallComparison?.daysBetween} jour${(overallComparison?.daysBetween ?? 0) > 1 ? 's' : ''}`
              : 'Pas encore de chaîne'}
          </h2>
          {hasChain && overallComparison && (
            <p className="tjd-section-sub">
              {overallComparison.syntheseTrajectoire}
            </p>
          )}
          {!hasChain && (
            <p className="tjd-section-sub">
              Une seule analyse pour ce dossier. La trajectoire se déclenchera
              à partir de la prochaine instruction.
            </p>
          )}
        </div>
        <div className="tjd-graph">
          {snapshots.length > 0 ? (
            <TimelineGraph
              snapshots={snapshots}
              height={220}
              showDateLabels
              ariaLabel={`Score global sur ${snapshots.length} analyse${snapshots.length > 1 ? 's' : ''} de ${detail.companyName}`}
            />
          ) : (
            <div className="tjd-graph-empty">Aucun snapshot disponible.</div>
          )}
        </div>
      </section>

      {hasChain && (
        <section className="tjd-section">
          <div className="tjd-section-head">
            <div className="tjd-section-kicker">Transitions</div>
            <h2 className="tjd-section-title">
              {successiveComparisons.length} transition{successiveComparisons.length > 1 ? 's' : ''} successive{successiveComparisons.length > 1 ? 's' : ''}
            </h2>
            <p className="tjd-section-sub">
              Lecture chronologique de chaque saut entre deux analyses
              consécutives, avec le cran d alerte attribué par le module
              hiérarchisé.
            </p>
          </div>

          <div className="tjd-transitions">
            {successiveComparisons.map((c, i) => {
              const alerts = successiveAlerts[i] ?? [];
              const topCran = alerts.length > 0
                ? alerts.reduce((min, a) => (a.cran < min ? a.cran : min), 4)
                : null;
              const scoreSign = c.globalScoreDelta.delta > 0 ? '+' : '';
              return (
                <article key={i} className="tjd-transition">
                  <header className="tjd-transition-head">
                    <div className="tjd-transition-dates">
                      <span>{formatLongDate(c.before.analyzedAt)}</span>
                      <span className="tjd-transition-arrow">→</span>
                      <span>{formatLongDate(c.after.analyzedAt)}</span>
                      <span className="tjd-transition-days">{c.daysBetween}j</span>
                    </div>
                    {topCran && (
                      <span
                        className="tjd-transition-cran"
                        style={{ background: cranBg(topCran), color: cranColor(topCran) }}
                      >
                        {CRAN_LABEL[topCran]}
                      </span>
                    )}
                  </header>

                  <div className="tjd-transition-grid">
                    <div className="tjd-transition-metric">
                      <div className="tjd-metric-label">Score global</div>
                      <div className="tjd-metric-value">
                        {c.before.globalScore} → {c.after.globalScore}
                        <span className="tjd-metric-delta">
                          {scoreSign}{c.globalScoreDelta.delta}
                        </span>
                      </div>
                    </div>
                    <div className="tjd-transition-metric">
                      <div className="tjd-metric-label">Verdict</div>
                      <div className="tjd-metric-value">
                        {c.verdictTransition.from}
                        {c.verdictTransition.from !== c.verdictTransition.to && (
                          <> → {c.verdictTransition.to}</>
                        )}
                      </div>
                    </div>
                    <div className="tjd-transition-metric">
                      <div className="tjd-metric-label">Trajectoire</div>
                      <div className="tjd-metric-value">
                        {TRAJECTOIRE_LABEL[c.trajectoireGlobale] ?? c.trajectoireGlobale}
                      </div>
                    </div>
                  </div>

                  <p className="tjd-transition-synthese">{c.syntheseTrajectoire}</p>

                  {alerts.length > 0 && (
                    <ul className="tjd-alerts">
                      {alerts.map((a, idx) => (
                        <li key={idx} className="tjd-alert">
                          <span
                            className="tjd-alert-cran"
                            style={{ background: cranBg(a.cran), color: cranColor(a.cran) }}
                          >
                            {a.cran}
                          </span>
                          <div className="tjd-alert-body">
                            <div className="tjd-alert-raison">{a.raison}</div>
                            <div className="tjd-alert-reco">{a.recommandation}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {(c.combinaisonsApparues.length > 0 || c.combinaisonsResolues.length > 0) && (
                    <div className="tjd-combinaisons">
                      {c.combinaisonsApparues.length > 0 && (
                        <div className="tjd-combinaisons-block">
                          <span className="tjd-combinaisons-label">Apparues</span>
                          <span className="tjd-combinaisons-list">
                            {c.combinaisonsApparues.map((cb) => cb.nom).join(', ')}
                          </span>
                        </div>
                      )}
                      {c.combinaisonsResolues.length > 0 && (
                        <div className="tjd-combinaisons-block">
                          <span className="tjd-combinaisons-label">Résolues</span>
                          <span className="tjd-combinaisons-list">
                            {c.combinaisonsResolues.map((cb) => cb.nom).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <style jsx>{`
        .tjd {
          background: var(--paper);
          color: var(--ink);
          font-family: var(--serif);
          min-height: 100vh;
          padding-bottom: 80px;
        }
        .tjd-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding: 22px 40px 18px;
          border-bottom: 1px solid var(--hairline);
          margin-bottom: 48px;
        }
        .tjd-back {
          font-family: var(--sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          text-decoration: none;
        }
        .tjd-back:hover { color: var(--accent); }
        .tjd-header-id { text-align: right; font-family: var(--sans); }
        .tjd-org { font-size: 13.5px; font-weight: 600; color: var(--ink); }
        .tjd-user { font-size: 11px; color: var(--muted); margin-top: 2px; }

        .tjd-intro {
          max-width: 920px;
          margin: 0 auto 40px;
          padding: 0 40px;
        }
        .tjd-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 18px;
          font-weight: 600;
        }
        .tjd-kicker-dot {
          width: 6px;
          height: 6px;
          background: var(--ocre-brule);
          border-radius: 50%;
          display: inline-block;
        }
        .tjd-title {
          font-family: var(--serif);
          font-size: clamp(34px, 4.8vw, 52px);
          font-weight: 700;
          letter-spacing: -0.022em;
          line-height: 1.05;
          margin-bottom: 18px;
        }
        .tjd-subtitle {
          display: flex;
          gap: 18px;
          font-family: var(--sans);
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 0.04em;
          margin-bottom: 18px;
        }
        .tjd-subtitle span + span::before {
          content: '·';
          margin-right: 18px;
          opacity: 0.4;
        }
        .tjd-link-analysis {
          display: inline-block;
          font-family: var(--sans);
          font-size: 12px;
          color: var(--ocre-brule);
          letter-spacing: 0.04em;
          text-decoration: none;
          border-bottom: 1px dotted var(--ocre-brule);
        }
        .tjd-link-analysis:hover { color: var(--ink); border-bottom-color: var(--ink); }

        .tjd-section {
          max-width: 920px;
          margin: 0 auto 56px;
          padding: 0 40px;
        }
        .tjd-section-head {
          margin-bottom: 22px;
        }
        .tjd-section-kicker {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ocre-brule);
          font-weight: 600;
          margin-bottom: 10px;
        }
        .tjd-section-title {
          font-family: var(--serif);
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.012em;
          margin-bottom: 8px;
          color: var(--ink);
        }
        .tjd-section-sub {
          font-family: var(--serif);
          font-size: 15px;
          line-height: 1.55;
          color: var(--ink-soft);
          max-width: 680px;
        }

        .tjd-graph {
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 8px;
          padding: 14px 18px 8px;
        }
        .tjd-graph-empty {
          font-family: var(--serif);
          font-style: italic;
          color: var(--muted);
          padding: 32px;
          text-align: center;
        }

        .tjd-transitions {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .tjd-transition {
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 8px;
          padding: 18px 22px 20px;
        }
        .tjd-transition-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--hairline-soft);
        }
        .tjd-transition-dates {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: var(--sans);
          font-size: 12px;
          color: var(--ink-soft);
          letter-spacing: 0.02em;
        }
        .tjd-transition-arrow {
          color: var(--muted);
        }
        .tjd-transition-days {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          padding: 2px 8px;
          background: var(--paper-accent);
          border-radius: 3px;
        }
        .tjd-transition-cran {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 600;
          padding: 5px 9px;
          border-radius: 3px;
          white-space: nowrap;
        }

        .tjd-transition-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-bottom: 14px;
        }
        .tjd-transition-metric {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tjd-metric-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
        }
        .tjd-metric-value {
          font-family: var(--serif);
          font-size: 14.5px;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
        .tjd-metric-delta {
          font-family: var(--sans);
          font-size: 12px;
          color: var(--ocre-brule);
          margin-left: 8px;
        }

        .tjd-transition-synthese {
          font-family: var(--serif);
          font-size: 14.5px;
          line-height: 1.55;
          color: var(--ink-soft);
          margin-bottom: 14px;
        }

        .tjd-alerts {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .tjd-alert {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 12px;
          align-items: flex-start;
        }
        .tjd-alert-cran {
          font-family: var(--sans);
          font-size: 13px;
          font-weight: 700;
          width: 24px;
          height: 24px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tjd-alert-body {
          font-family: var(--serif);
        }
        .tjd-alert-raison {
          font-size: 13.5px;
          color: var(--ink);
          font-weight: 600;
          margin-bottom: 4px;
        }
        .tjd-alert-reco {
          font-size: 13px;
          line-height: 1.5;
          color: var(--ink-soft);
        }

        .tjd-combinaisons {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px dotted var(--hairline);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tjd-combinaisons-block {
          display: flex;
          gap: 12px;
          align-items: baseline;
          font-family: var(--serif);
          font-size: 13px;
        }
        .tjd-combinaisons-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
          min-width: 80px;
        }
        .tjd-combinaisons-list {
          color: var(--ink-soft);
        }

        @media (max-width: 800px) {
          .tjd-header { padding: 18px 24px 14px; }
          .tjd-intro, .tjd-section { padding: 0 24px; }
          .tjd-transition-grid { grid-template-columns: 1fr; }
          .tjd-transition-head { flex-direction: column; align-items: flex-start; gap: 8px; }
        }
      `}</style>
    </main>
  );
}
