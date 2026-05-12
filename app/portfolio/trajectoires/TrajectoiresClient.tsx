'use client';

// ============================================================
// TRAJECTOIRES CLIENT
// ------------------------------------------------------------
// Vue liste : un dossier par ligne, score global, score Fragilité,
// verdict, mini-timeline en SVG, indication de trajectoire
// (delta plus arrow), cran d alerte, drill-down vers
// /portfolio/trajectoires/[id].
//
// Sobriété typographique, encre noire sur papier crème, palette
// ocre brûlé pour les indicateurs. Pas d emojis, pas de bullets
// gratuits dans les cards. Voix Le Grand Continent.
// ============================================================

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PortfolioTrajectoryRow } from '@/lib/portfolio-trajectoires-core';

interface Props {
  rows: PortfolioTrajectoryRow[];
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

const VERDICT_LABELS: Record<string, string> = {
  investir: 'Investir',
  'investir avec conditions': 'Investir avec conditions',
  approfondir: 'Approfondir',
  refuser: 'Refuser',
};

const FRAGILITE_VERDICT_LABEL: Record<string, string> = {
  sain: 'Sain',
  attention: 'Attention',
  alerte: 'Alerte',
  'drapeau-rouge': 'Drapeau rouge',
  'non-applicable': 'Non applicable',
};

const CRAN_LABEL: Record<number, string> = {
  1: 'Cran 1 — Immédiat',
  2: 'Cran 2 — Immédiat',
  3: 'Cran 3 — Digest',
  4: 'Cran 4 — Passif',
};

/**
 * Cartouche de couleur sobre par verdict global. Encre lavée pour
 * l arrière-plan, encre plus saturée pour le texte. Reste lisible
 * sur papier crème.
 */
function verdictBadgeStyle(verdict: string | null): React.CSSProperties {
  const v = (verdict ?? '').toLowerCase();
  if (v.includes('investir') && !v.includes('condition')) {
    return { background: '#e8f1de', color: '#2f3a1b' };
  }
  if (v.includes('investir') && v.includes('condition')) {
    return { background: '#e7e9f2', color: '#2a3358' };
  }
  if (v.includes('approfondir') || v.includes('hold')) {
    return { background: '#ede2c8', color: '#7a5a1d' };
  }
  if (v.includes('refuser') || v.includes('reject')) {
    return { background: '#e9d3cc', color: '#7a2916' };
  }
  return { background: '#ece9e1', color: '#444038' };
}

/**
 * Cartouche fragilité, palette alignée sur l UI patterns existante.
 */
function fragiliteBadgeStyle(verdict: string | null): React.CSSProperties {
  switch (verdict) {
    case 'sain': return { background: '#e8f1de', color: '#2f3a1b' };
    case 'attention': return { background: '#fcf2dc', color: '#7a5a1d' };
    case 'alerte': return { background: '#f3dec9', color: '#7a3916' };
    case 'drapeau-rouge': return { background: '#e9d3cc', color: '#7a2916' };
    default: return { background: '#ece9e1', color: '#666056' };
  }
}

/**
 * Indication discrète de trajectoire : pictogramme texte (↑, ↓, →)
 * et delta numérique. Le pictogramme reste typographique pour
 * éviter d ajouter de l iconographie SaaS. Ocre brûlé pour les
 * deltas down, encre soft pour stable, vert sourd pour up.
 */
function DirectionMark({ direction, delta }: { direction: PortfolioTrajectoryRow['direction']; delta: number | null }) {
  if (direction === 'none' || delta === null) {
    return <span style={{ color: 'var(--muted)', fontFamily: 'var(--sans)', fontSize: 12 }}>—</span>;
  }
  let symbol = '→';
  let color = 'var(--muted)';
  if (direction === 'up') { symbol = '↑'; color = '#3f6b2b'; }
  else if (direction === 'down') { symbol = '↓'; color = 'var(--ocre-brule)'; }
  const sign = delta > 0 ? '+' : '';
  return (
    <span style={{
      fontFamily: 'var(--sans)',
      fontSize: 12,
      color,
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '0.02em',
    }}>
      {symbol}&nbsp;{sign}{delta}
    </span>
  );
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return "aujourd'hui";
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays}j`;
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem`;
    if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)} mois`;
    const y = Math.floor(diffDays / 365);
    return `il y a ${y} an${y > 1 ? 's' : ''}`;
  } catch {
    return '';
  }
}

export default function TrajectoiresClient({ rows, orgName, userEmail }: Props) {
  const [stageFilter, setStageFilter] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [verdictFilter, setVerdictFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');

  // Listes uniques pour alimenter les selects de filtre. Reconstruites
  // à chaque changement de rows (par défaut la prop ne change pas
  // après mount, c est server-side rendered).
  const stages = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.workflowStage) set.add(r.workflowStage); });
    return Array.from(set).sort();
  }, [rows]);
  const sectors = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.sector) set.add(r.sector); });
    return Array.from(set).sort();
  }, [rows]);
  const verdicts = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.verdict) set.add(r.verdict); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (stageFilter && r.workflowStage !== stageFilter) return false;
      if (sectorFilter && r.sector !== sectorFilter) return false;
      if (verdictFilter && r.verdict !== verdictFilter) return false;
      if (tagFilter && r.portfolioTag !== tagFilter) return false;
      return true;
    });
  }, [rows, stageFilter, sectorFilter, verdictFilter, tagFilter]);

  // Compteurs en tête de liste pour donner au partner la lecture
  // immédiate de la concentration d alertes critiques.
  const counts = useMemo(() => {
    return {
      total: filtered.length,
      cran1: filtered.filter((r) => r.highestCran === 1).length,
      cran2: filtered.filter((r) => r.highestCran === 2).length,
      cran3: filtered.filter((r) => r.highestCran === 3).length,
      cran4: filtered.filter((r) => r.highestCran === 4).length,
      sansChaine: filtered.filter((r) => r.highestCran === null).length,
    };
  }, [filtered]);

  const hasFilters = stageFilter || sectorFilter || verdictFilter || tagFilter;

  return (
    <main className="trajectoires">
      <header className="tj-header">
        <Link href="/portfolio" className="tj-back">← Portefeuille</Link>
        <div className="tj-header-id">
          <div className="tj-org">{orgName}</div>
          <div className="tj-user">{userEmail}</div>
        </div>
      </header>

      <section className="tj-intro">
        <div className="tj-kicker">
          <span className="tj-kicker-dot" />
          <span>Trajectoires · Vue temporelle</span>
        </div>
        {rows.length === 0 ? (
          <>
            <h1 className="tj-title">
              Aucune trajectoire <em>à surveiller pour l instant.</em>
            </h1>
            <p className="tj-lede">
              Le suivi temporel se déclenche dès la deuxième analyse d un même
              dossier. Une fois la chaîne établie, ce tableau remontera les
              dossiers dont le diagnostic se déplace, classés par niveau
              d alerte.
            </p>
          </>
        ) : (
          <>
            <h1 className="tj-title">
              {rows.length} dossier{rows.length > 1 ? 's' : ''} suivi{rows.length > 1 ? 's' : ''},
              <br />
              <em>classés par signal de trajectoire.</em>
            </h1>
            <p className="tj-lede">
              Chaque ligne représente un dossier instruit, son score global
              courant, son verdict, et la dynamique observée depuis l analyse
              précédente. Le tri remonte en tête les signaux les plus
              critiques.
            </p>
          </>
        )}
      </section>

      {rows.length > 0 && (
        <>
          <section className="tj-counts">
            <div className="tj-count">
              <span className="tj-count-num" style={{ color: '#7a2916' }}>{counts.cran1}</span>
              <span className="tj-count-label">Cran 1</span>
            </div>
            <div className="tj-count">
              <span className="tj-count-num" style={{ color: 'var(--ocre-brule)' }}>{counts.cran2}</span>
              <span className="tj-count-label">Cran 2</span>
            </div>
            <div className="tj-count">
              <span className="tj-count-num" style={{ color: '#7a5a1d' }}>{counts.cran3}</span>
              <span className="tj-count-label">Cran 3</span>
            </div>
            <div className="tj-count">
              <span className="tj-count-num" style={{ color: 'var(--muted)' }}>{counts.cran4}</span>
              <span className="tj-count-label">Cran 4</span>
            </div>
            <div className="tj-count">
              <span className="tj-count-num" style={{ color: 'var(--muted-soft)' }}>{counts.sansChaine}</span>
              <span className="tj-count-label">Sans chaîne</span>
            </div>
          </section>

          <section className="tj-filters">
            <label className="tj-filter">
              <span>Stade</span>
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                <option value="">Tous</option>
                {stages.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s] ?? s}</option>
                ))}
              </select>
            </label>
            <label className="tj-filter">
              <span>Secteur</span>
              <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
                <option value="">Tous</option>
                {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="tj-filter">
              <span>Verdict actuel</span>
              <select value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)}>
                <option value="">Tous</option>
                {verdicts.map((v) => (
                  <option key={v} value={v}>{VERDICT_LABELS[v] ?? v}</option>
                ))}
              </select>
            </label>
            <label className="tj-filter">
              <span>Tag</span>
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="">Tous</option>
                <option value="in-portfolio">In-portfolio</option>
                <option value="instruction">Instruction</option>
              </select>
            </label>
            {hasFilters && (
              <button
                type="button"
                className="tj-filter-clear"
                onClick={() => {
                  setStageFilter('');
                  setSectorFilter('');
                  setVerdictFilter('');
                  setTagFilter('');
                }}
              >
                Réinitialiser
              </button>
            )}
          </section>

          <section className="tj-list">
            {filtered.length === 0 ? (
              <div className="tj-empty">Aucun dossier ne correspond aux filtres.</div>
            ) : (
              filtered.map((row) => (
                <Link
                  key={row.analysisId}
                  href={`/portfolio/trajectoires/${row.analysisId}`}
                  className="tj-row"
                >
                  <div className="tj-row-cran">
                    {row.highestCran ? (
                      <span className={`tj-cran tj-cran-${row.highestCran}`}>
                        {CRAN_LABEL[row.highestCran]}
                      </span>
                    ) : (
                      <span className="tj-cran tj-cran-none">Chaîne incomplète</span>
                    )}
                  </div>
                  <div className="tj-row-main">
                    <div className="tj-row-name">{row.companyName}</div>
                    <div className="tj-row-meta">
                      {row.sector && <span>{row.sector}</span>}
                      {row.workflowStage && <span>{STAGE_LABELS[row.workflowStage] ?? row.workflowStage}</span>}
                      <span>{row.portfolioTag === 'in-portfolio' ? 'In-portfolio' : 'En instruction'}</span>
                      <span>{row.snapshotsCount} analyse{row.snapshotsCount > 1 ? 's' : ''}</span>
                      <span>{formatRelativeDate(row.lastAnalyzedAt)}</span>
                    </div>
                  </div>
                  <div className="tj-row-badges">
                    {row.verdict && (
                      <span className="tj-badge" style={verdictBadgeStyle(row.verdict)}>
                        {VERDICT_LABELS[row.verdict.toLowerCase()] ?? row.verdict}
                      </span>
                    )}
                    {row.fragiliteVerdict && (
                      <span className="tj-badge" style={fragiliteBadgeStyle(row.fragiliteVerdict)}>
                        Fragilité · {FRAGILITE_VERDICT_LABEL[row.fragiliteVerdict] ?? row.fragiliteVerdict}
                      </span>
                    )}
                  </div>
                  <div className="tj-row-scores">
                    <div className="tj-score">
                      <div className="tj-score-num">{row.globalScore ?? '—'}{row.globalScore != null && <span className="tj-score-unit">/100</span>}</div>
                      <div className="tj-score-label">Global</div>
                    </div>
                    <div className="tj-score">
                      <div className="tj-score-num" style={{ color: 'var(--ocre-brule)' }}>{row.fragiliteScore ?? '—'}{row.fragiliteScore != null && <span className="tj-score-unit">/100</span>}</div>
                      <div className="tj-score-label">Fragilité</div>
                    </div>
                    <div className="tj-direction">
                      <DirectionMark direction={row.direction} delta={row.scoreDelta} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </section>
        </>
      )}

      <style jsx>{`
        .trajectoires {
          background: var(--paper);
          color: var(--ink);
          font-family: var(--serif);
          min-height: 100vh;
          padding-bottom: 80px;
        }
        .tj-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding: 22px 40px 18px;
          border-bottom: 1px solid var(--hairline);
          margin-bottom: 48px;
        }
        .tj-back {
          font-family: var(--sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          text-decoration: none;
          transition: color var(--motion-fast);
        }
        .tj-back:hover { color: var(--accent); }
        .tj-header-id {
          text-align: right;
          font-family: var(--sans);
        }
        .tj-org { font-size: 13.5px; font-weight: 600; color: var(--ink); }
        .tj-user { font-size: 11px; color: var(--muted); margin-top: 2px; }

        .tj-intro {
          max-width: 1080px;
          margin: 0 auto 40px;
          padding: 0 40px;
        }
        .tj-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 24px;
          font-weight: 600;
        }
        .tj-kicker-dot {
          width: 6px;
          height: 6px;
          background: var(--ocre-brule);
          border-radius: 50%;
          display: inline-block;
        }
        .tj-title {
          font-family: var(--serif);
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.022em;
          margin-bottom: 24px;
        }
        .tj-title em {
          color: var(--ocre-brule);
          font-style: italic;
          font-weight: 500;
        }
        .tj-lede {
          font-size: 17px;
          line-height: 1.6;
          color: var(--ink-soft);
          max-width: 680px;
        }

        .tj-counts {
          max-width: 1080px;
          margin: 0 auto 32px;
          padding: 0 40px;
          display: flex;
          gap: 32px;
          align-items: baseline;
        }
        .tj-count {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tj-count-num {
          font-family: var(--serif);
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .tj-count-label {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
        }

        .tj-filters {
          max-width: 1080px;
          margin: 0 auto 24px;
          padding: 16px 24px;
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          align-items: flex-end;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 8px;
          margin-left: 40px;
          margin-right: 40px;
        }
        .tj-filter {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tj-filter span {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
        }
        .tj-filter select {
          font-family: var(--serif);
          font-size: 13.5px;
          padding: 6px 8px;
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 4px;
          color: var(--ink);
          min-width: 140px;
        }
        .tj-filter-clear {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.06em;
          background: transparent;
          border: 1px solid var(--hairline);
          color: var(--ink-soft);
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }
        .tj-filter-clear:hover {
          background: var(--paper-accent);
          color: var(--ink);
        }

        .tj-list {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 40px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .tj-empty {
          font-family: var(--serif);
          font-style: italic;
          color: var(--muted);
          padding: 28px 0;
          text-align: center;
        }
        .tj-row {
          display: grid;
          grid-template-columns: 168px 1fr auto auto;
          gap: 24px;
          align-items: center;
          padding: 16px 22px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-left-width: 3px;
          border-left-color: var(--hairline);
          border-radius: 6px;
          text-decoration: none;
          color: inherit;
          transition: all var(--motion-fast);
        }
        .tj-row:hover {
          border-color: var(--muted-soft);
          box-shadow: var(--shadow-2);
          transform: translateY(-1px);
        }
        .tj-row-cran {
          display: flex;
          align-items: center;
        }
        .tj-cran {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 600;
          padding: 5px 9px;
          border-radius: 3px;
          white-space: nowrap;
        }
        .tj-cran-1 { background: #e9d3cc; color: #7a2916; }
        .tj-cran-2 { background: #f3dec9; color: #7a3916; }
        .tj-cran-3 { background: #fcf2dc; color: #7a5a1d; }
        .tj-cran-4 { background: #ece9e1; color: #444038; }
        .tj-cran-none { background: transparent; border: 1px dashed var(--hairline); color: var(--muted); }

        .tj-row-main {
          min-width: 0;
        }
        .tj-row-name {
          font-family: var(--serif);
          font-size: 17px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 4px;
          letter-spacing: -0.012em;
        }
        .tj-row-meta {
          display: flex;
          gap: 14px;
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
        }
        .tj-row-meta span {
          letter-spacing: 0.04em;
        }
        .tj-row-meta span + span::before {
          content: '·';
          margin-right: 14px;
          opacity: 0.4;
        }

        .tj-row-badges {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;
        }
        .tj-badge {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.04em;
          padding: 3px 8px;
          border-radius: 3px;
          font-weight: 600;
          white-space: nowrap;
        }

        .tj-row-scores {
          display: flex;
          gap: 18px;
          align-items: center;
        }
        .tj-score {
          text-align: right;
          min-width: 56px;
        }
        .tj-score-num {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.015em;
        }
        .tj-score-unit {
          font-size: 11px;
          color: var(--muted);
          margin-left: 1px;
          font-weight: 400;
        }
        .tj-score-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          margin-top: 4px;
          font-weight: 600;
        }
        .tj-direction {
          min-width: 60px;
          text-align: right;
        }

        @media (max-width: 900px) {
          .tj-header { padding: 18px 24px 14px; }
          .tj-intro { padding: 0 24px; }
          .tj-counts { padding: 0 24px; flex-wrap: wrap; gap: 18px; }
          .tj-list { padding: 0 24px; }
          .tj-filters { margin-left: 24px; margin-right: 24px; }
          .tj-row {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 14px 16px;
          }
          .tj-row-scores {
            justify-content: space-between;
            width: 100%;
          }
          .tj-row-badges {
            flex-direction: row;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </main>
  );
}
