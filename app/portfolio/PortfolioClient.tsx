'use client';

import React from 'react';

// ============================================================
// PORTFOLIO CLIENT
// ------------------------------------------------------------
// Tableau de bord visuel des stats agregees du fonds.
// Composition (de haut en bas) :
//   1. Header editorial (PRELUDE / Portefeuille / org)
//   2. KPIs de premier ordre : 4 grandes stats cards
//      (total dossiers, derniere analyse, score moyen, blindspot moyen)
//   3. Velocite : line chart 12 derniers mois
//   4. Funnel de conversion : 4 etages stylises avec taux entre chaque
//   5. Repartition stade : barres horizontales avec couleurs semantiques
//   6. Verdicts donnes : 4 cards numerotees colore
//   7. Top secteurs et pays : 2 colonnes liste
//   8. Durees moyennes par stade : table
//
// La palette suit le design system Prelude : papier creme, encre quasi-noire,
// accent ocre brule porteur, vert sombre sobre, rouge anglais critique.
// ============================================================

import Link from 'next/link';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import type { PortfolioStats } from '@/lib/portfolio-stats';
import { Picto } from '../components/Picto';
import { CompanyLogo } from '../components/CompanyLogo';

interface Props {
  stats: PortfolioStats | null;
}

const STAGE_LABELS: Record<string, string> = {
  deposited: 'Déposé',
  in_review: 'En instruction',
  dd_field: 'DD terrain',
  ic_review: 'Pret pour IC',
  signed: 'Signé',
  declined: 'Refusé',
};

// Palette identite Prelude : fond blanc, encre quasi-noire, accent ocre brule.
// Trio verdict (vert investir, ocre approfondir, rouge refuser) reserve aux
// pills. Les hex sont alignes sur les tokens CSS de globals.css (recharts ne
// resout pas var(--) en SSR, d ou la duplication assumee).
const STAGE_COLORS: Record<string, string> = {
  deposited: '#948770',  // muted
  in_review: '#c97a3f',  // ocre mi-ton
  dd_field: '#a8541d',   // ocre brule porteur
  ic_review: '#14110d',  // encre, decision imminente
  signed: '#2f5d3a',     // vert foret
  declined: '#9b2c1d',   // rouge anglais
};

const VERDICT_LABELS: Record<string, string> = {
  investir: 'Investir',
  'investir-conditions': 'Investir avec conditions',
  approfondir: 'Approfondir',
  refuser: 'Refuser',
  autre: 'Autre',
};

const VERDICT_COLORS: Record<string, string> = {
  investir: '#2f5d3a',                // vert foret
  'investir-conditions': '#14110d',   // encre, decision conditionnelle
  approfondir: '#a8541d',             // ocre brule, signal porteur
  refuser: '#9b2c1d',                 // rouge anglais
  autre: '#948770',                   // muted
};

function formatRelativeDate(iso: string | null): string {
  if (!iso) return 'jamais';
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

function formatMonth(key: string): string {
  // 2026-05 -> Mai 26
  const [y, m] = key.split('-');
  const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${labels[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function PortfolioClient({ stats }: Props) {
  // Cas null (auth ou erreur Supabase)
  // Cas vide : pas encore de dossiers
  // Cas normal : on affiche tout
  // Tous les cas partagent le meme layout/styles, on conditionne juste
  // le contenu interne pour que le <style jsx> du return final
  // s applique systematiquement.
  const isError = !stats;
  const isEmpty = stats !== null && stats.total === 0;
  const hasData = stats !== null && stats.total > 0;

  const verdicts = ['investir', 'investir-conditions', 'approfondir', 'refuser'] as const;
  const totalVelocity = hasData ? stats.velocity.reduce((s, v) => s + v.count, 0) : 0;
  const avgVelocity = hasData && stats.velocity.length > 0
    ? Math.round((totalVelocity / stats.velocity.length) * 10) / 10
    : 0;

  return (
    <main className="portfolio">
      {/* Intro editoriale - conditionnel selon l etat. La nav globale
          (wordmark, identite, deconnexion) est rendue par AppHeader
          dans app/layout.tsx. */}
      <section className="pf-intro">
        <div className="pf-kicker">
          <span className="pf-kicker-dot"></span>
          <span>{isError ? 'Portefeuille' : 'Portefeuille · Vue agrégée'}</span>
        </div>
        {isError && (
          <>
            <h1 className="pf-title">
              Stats <em>indisponibles.</em>
            </h1>
            <p className="pf-lede">
              Le portefeuille n&apos;a pas pu etre chargé. Reessayer plus tard.
            </p>
          </>
        )}
        {isEmpty && (
          <>
            <h1 className="pf-title">
              Aucun dossier <em>instruit pour l&apos;instant.</em>
            </h1>
            <p className="pf-lede">
              Le tableau de bord se remplit automatiquement après votre première analyse.
              Déposez un pitch deck pour démarrer.
            </p>
            <Link href="/" className="pf-cta-primary">
              <span>Lancer une instruction</span>
              <Picto name="arrow-right" size={14} />
            </Link>
          </>
        )}
        {hasData && (
          <>
            <h1 className="pf-title">
              {stats!.total} dossier{stats!.total > 1 ? 's' : ''} instruit{stats!.total > 1 ? 's' : ''},
              <br />
              <em>une trajectoire de fonds.</em>
            </h1>
            <p className="pf-lede">
              Vue consolidée de l&apos;activité de l&apos;organisation. Vélocité, conversion, répartition
              par stade et par secteur, durées moyennes d&apos;instruction.
            </p>
            <Link href="/portfolio/trajectoires" className="pf-link-trajectoires">
              Trajectoires · suivi temporel des dossiers →
            </Link>
            <Link href="/portfolio/secteurs" className="pf-link-trajectoires">
              Secteurs · catalogue sectoriel Prelude →
            </Link>
          </>
        )}
      </section>

      {/* Contenu principal : visible uniquement si on a des donnees */}
      {hasData && (
        <>
      {/* KPIs */}
      <section className="pf-kpis">
        <div className="pf-kpi">
          <div className="pf-kpi-num pf-kpi-num-ink">{stats!.total}</div>
          <div className="pf-kpi-label">Dossiers instruits</div>
          <div className="pf-kpi-sub">Sur la période</div>
        </div>
        <div className="pf-kpi">
          <div className="pf-kpi-num pf-kpi-num-ink">{avgVelocity}</div>
          <div className="pf-kpi-label">Dossiers / mois</div>
          <div className="pf-kpi-sub">Moyenne sur 12 mois</div>
        </div>
        <div className="pf-kpi">
          <div className="pf-kpi-num pf-kpi-num-amber">{stats!.avgGlobalScore ?? '—'}{stats!.avgGlobalScore != null && <span className="pf-kpi-unit">/100</span>}</div>
          <div className="pf-kpi-label">Score moyen</div>
          <div className="pf-kpi-sub">Conviction du fonds</div>
        </div>
        <div className="pf-kpi">
          <div className="pf-kpi-num pf-kpi-num-deep">{stats!.avgBlindspotScore ?? '—'}{stats!.avgBlindspotScore != null && <span className="pf-kpi-unit">/100</span>}</div>
          <div className="pf-kpi-label">Risque biais</div>
          <div className="pf-kpi-sub">Vigilance critique moyen</div>
        </div>
      </section>

      {/* Velocite (12 mois) */}
      <section className="pf-section">
        <div className="pf-section-head">
          <div className="pf-section-kicker">
            <Picto name="marche" size={14} />
            <span>Vélocité</span>
          </div>
          <h2 className="pf-section-title">Dossiers instruits par mois</h2>
          <p className="pf-section-sub">
            Évolution sur les 12 derniers mois. La cadence d&apos;instruction est un indicateur
            de la profondeur de pipe et de la capacité analytique du fonds.
          </p>
        </div>
        <div className="pf-chart">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={stats!.velocity} margin={{ top: 10, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#f3eee5" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fontSize: 11, fill: '#6b6354', fontFamily: 'system-ui' }}
                axisLine={{ stroke: '#e7e0d2' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#948770', fontFamily: 'system-ui' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e7e0d2',
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(20, 17, 13, 0.08)',
                }}
                labelFormatter={formatMonth}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#a8541d"
                strokeWidth={2.5}
                dot={{ fill: '#a8541d', r: 3.5 }}
                activeDot={{ r: 5, fill: '#a8541d' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Funnel de conversion */}
      <section className="pf-section">
        <div className="pf-section-head">
          <div className="pf-section-kicker">
            <Picto name="pipeline" size={14} />
            <span>Conversion</span>
          </div>
          <h2 className="pf-section-title">Funnel d&apos;instruction</h2>
          <p className="pf-section-sub">
            Pour 100 dossiers déposés, combien arrivent à chaque étape. Calcul cumulatif :
            chaque dossier est compté dans tous les stades qu&apos;il a traversés.
          </p>
        </div>
        <div className="pf-funnel">
          {stats!.conversion.map((c, i) => {
            const stageColor = STAGE_COLORS[c.from] || '#948770';
            const isLast = i === stats!.conversion.length - 1;
            const finalColor = STAGE_COLORS[c.to] || '#948770';
            const finalCount = Math.round(c.total * c.rate / 100);
            return (
              <React.Fragment key={`${c.from}-${c.to}`}>
                <div className="pf-funnel-step" style={{ borderLeftColor: stageColor }}>
                  <div className="pf-funnel-step-meta">
                    <span className="pf-funnel-step-dot" style={{ backgroundColor: stageColor }} aria-hidden="true" />
                    <span className="pf-funnel-step-label">{STAGE_LABELS[c.from]}</span>
                  </div>
                  <div className="pf-funnel-step-count">{c.total}</div>
                </div>
                <div className="pf-funnel-link">
                  <span className="pf-funnel-link-line" aria-hidden="true" />
                  <span className="pf-funnel-link-rate">
                    <em>{c.rate}%</em> de conversion
                  </span>
                  <span className="pf-funnel-link-line" aria-hidden="true" />
                </div>
                {isLast && (
                  <div className="pf-funnel-step pf-funnel-step-final" style={{ borderLeftColor: finalColor }}>
                    <div className="pf-funnel-step-meta">
                      <span className="pf-funnel-step-dot" style={{ backgroundColor: finalColor }} aria-hidden="true" />
                      <span className="pf-funnel-step-label">{STAGE_LABELS[c.to]}</span>
                    </div>
                    <div className="pf-funnel-step-count">{finalCount}</div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* Repartition par stade */}
      <section className="pf-section">
        <div className="pf-section-head">
          <div className="pf-section-kicker">
            <Picto name="concurrence" size={14} />
            <span>État du portefeuille</span>
          </div>
          <h2 className="pf-section-title">Dossiers par stade actuel</h2>
          <p className="pf-section-sub">
            Répartition à date des dossiers du portefeuille. Permet d&apos;identifier les
            goulets d&apos;étranglement entre stades.
          </p>
        </div>
        <div className="pf-stages">
          {Object.entries(stats!.byStage).map(([stage, count]) => {
            const pct = stats!.total > 0 ? (count / stats!.total) * 100 : 0;
            return (
              <div className="pf-stage-row" key={stage}>
                <div className="pf-stage-label">
                  <span className="pf-stage-dot" style={{ background: STAGE_COLORS[stage] }} />
                  {STAGE_LABELS[stage]}
                </div>
                <div className="pf-stage-bar">
                  <div className="pf-stage-bar-fill" style={{
                    width: `${pct}%`,
                    background: STAGE_COLORS[stage],
                  }} />
                </div>
                <div className="pf-stage-count">{count}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Verdicts */}
      <section className="pf-section">
        <div className="pf-section-head">
          <div className="pf-section-kicker">
            <Picto name="verdict" size={14} />
            <span>Verdicts</span>
          </div>
          <h2 className="pf-section-title">Recommandations rendues</h2>
          <p className="pf-section-sub">
            Distribution des verdicts donnés par les analystes du fonds. La conviction reste
            une affaire humaine.
          </p>
        </div>
        <div className="pf-verdicts">
          {verdicts.map((v) => {
            const count = stats!.byVerdict[v] || 0;
            const pct = stats!.total > 0 ? Math.round((count / stats!.total) * 100) : 0;
            const companies = stats!.byVerdictCompanies?.[v] || [];
            return (
              <div className="pf-verdict" key={v} style={{ borderTopColor: VERDICT_COLORS[v] }}>
                <div className="pf-verdict-num" style={{ color: VERDICT_COLORS[v] }}>
                  {count}
                </div>
                <div className="pf-verdict-pct">{pct}%</div>
                <div className="pf-verdict-label">{VERDICT_LABELS[v]}</div>
                {/* Liste des entreprises de ce verdict, en sous-couche.
                    Permet au partner de voir d un coup d oeil quels
                    dossiers composent chaque categorie, sans avoir a
                    aller dans /history. Click ouvre le dossier. */}
                {companies.length > 0 && (
                  <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px dotted var(--hairline)',
                    fontSize: 11,
                    lineHeight: 1.6,
                    textAlign: 'left',
                  }}>
                    {companies.slice(0, 5).map((c) => (
                      <div
                        key={c.id}
                        style={{
                          marginBottom: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <CompanyLogo companyName={c.name} size={20} />
                        <a
                          href={`/?analysis=${c.id}`}
                          style={{
                            color: 'var(--ink-soft)',
                            textDecoration: 'none',
                            borderBottom: '1px dotted var(--muted-soft)',
                          }}
                        >
                          {c.name}
                        </a>
                      </div>
                    ))}
                    {companies.length > 5 && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>
                        et {companies.length - 5} autre{companies.length - 5 > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Top secteurs et pays */}
      <section className="pf-section pf-section-grid">
        <div>
          <div className="pf-section-head">
            <div className="pf-section-kicker">
              <Picto name="brevets" size={14} />
              <span>Secteurs</span>
            </div>
            <h2 className="pf-section-title">Top secteurs</h2>
          </div>
          {stats!.bySector.length === 0 ? (
            <p className="pf-empty">Aucun secteur renseigné.</p>
          ) : (
            <ul className="pf-list">
              {stats!.bySector.slice(0, 8).map((s) => (
                <li key={s.sector} className="pf-list-row" style={{ flexWrap: 'wrap' }}>
                  <span className="pf-list-label">{s.sector}</span>
                  <div className="pf-list-bar">
                    <div className="pf-list-bar-fill" style={{
                      width: `${(s.count / stats!.bySector[0].count) * 100}%`,
                    }} />
                  </div>
                  <span className="pf-list-count">{s.count}</span>
                  {/* Noms des entreprises de ce secteur, en sous-ligne.
                      Permet de scanner d un coup d oeil quels dossiers
                      composent chaque secteur. Click ouvre le dossier. */}
                  {s.companies && s.companies.length > 0 && (
                    <div style={{
                      flex: '1 0 100%',
                      marginTop: 4,
                      paddingLeft: 0,
                      fontSize: 11,
                      color: 'var(--muted)',
                      lineHeight: 1.5,
                    }}>
                      {s.companies.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && <span style={{ opacity: 0.4 }}> · </span>}
                          <a
                            href={`/?analysis=${c.id}`}
                            style={{
                              color: 'var(--ink-soft)',
                              textDecoration: 'none',
                              borderBottom: '1px dotted var(--muted-soft)',
                            }}
                          >
                            {c.name}
                          </a>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="pf-section-head">
            <div className="pf-section-kicker">
              <Picto name="macro" size={14} />
              <span>Géographie</span>
            </div>
            <h2 className="pf-section-title">Top pays</h2>
          </div>
          {stats!.byCountry.length === 0 ? (
            <p className="pf-empty">Aucun pays renseigné.</p>
          ) : (
            <ul className="pf-list">
              {stats!.byCountry.slice(0, 8).map((c) => (
                <li key={c.country} className="pf-list-row" style={{ flexWrap: 'wrap' }}>
                  <span className="pf-list-label">{c.country}</span>
                  <div className="pf-list-bar">
                    <div className="pf-list-bar-fill pf-list-bar-fill-amber" style={{
                      width: `${(c.count / stats!.byCountry[0].count) * 100}%`,
                    }} />
                  </div>
                  <span className="pf-list-count">{c.count}</span>
                  {c.companies && c.companies.length > 0 && (
                    <div style={{
                      flex: '1 0 100%',
                      marginTop: 4,
                      fontSize: 11,
                      color: 'var(--muted)',
                      lineHeight: 1.5,
                    }}>
                      {c.companies.map((co, i) => (
                        <span key={co.id}>
                          {i > 0 && <span style={{ opacity: 0.4 }}> · </span>}
                          <a
                            href={`/?analysis=${co.id}`}
                            style={{
                              color: 'var(--ink-soft)',
                              textDecoration: 'none',
                              borderBottom: '1px dotted var(--muted-soft)',
                            }}
                          >
                            {co.name}
                          </a>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Durees moyennes par stage */}
      <section className="pf-section">
        <div className="pf-section-head">
          <div className="pf-section-kicker">
            <Picto name="macro" size={14} />
            <span>Vitesse d&apos;instruction</span>
          </div>
          <h2 className="pf-section-title">Durée moyenne par stade</h2>
          <p className="pf-section-sub">
            Temps moyen passé dans chaque stade avant transition. Permet d&apos;identifier où
            le pipeline ralentit.
          </p>
        </div>
        <div className="pf-durations">
          {Object.entries(stats!.stageDurations).map(([stage, d]) => (
            <div className="pf-duration" key={stage}>
              <div className="pf-duration-stage" style={{ borderLeftColor: STAGE_COLORS[stage] }}>
                {STAGE_LABELS[stage]}
              </div>
              <div className="pf-duration-value">
                {d.avgDays != null ? (
                  <>
                    <span className="pf-duration-num">{d.avgDays}</span>
                    <span className="pf-duration-unit">jour{d.avgDays > 1 ? 's' : ''}</span>
                  </>
                ) : (
                  <span className="pf-duration-empty">—</span>
                )}
              </div>
              <div className="pf-duration-samples">
                {d.samples > 0 ? `n=${d.samples}` : 'aucune transition'}
              </div>
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      <style jsx>{`
        .portfolio {
          background: var(--paper);
          color: var(--ink);
          font-family: var(--serif);
          min-height: 100vh;
          padding-bottom: 80px;
        }
        .portfolio-empty {
          max-width: 480px;
          margin: 120px auto;
          text-align: center;
          padding: 0 24px;
        }
        .portfolio-empty h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .portfolio-empty p {
          color: var(--muted);
          margin-bottom: 24px;
        }

        .pf-intro {
          max-width: 1080px;
          margin: 0 auto 56px;
          padding: 0 40px;
        }
        .pf-kicker {
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
        .pf-kicker-dot {
          width: 6px;
          height: 6px;
          background: var(--accent);
          border-radius: 50%;
          display: inline-block;
        }
        .pf-title {
          font-family: var(--serif);
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.022em;
          margin-bottom: 24px;
        }
        .pf-title em {
          color: var(--accent);
          font-style: italic;
          font-weight: 500;
        }
        .pf-lede {
          font-size: 17px;
          line-height: 1.6;
          color: var(--ink-soft);
          max-width: 640px;
        }
        .pf-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
          padding: 14px 24px;
          background: var(--ink);
          color: var(--paper);
          font-family: var(--sans);
          font-size: 12px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 600;
          text-decoration: none;
          border-radius: 8px;
          transition: all var(--motion-base);
        }
        .pf-cta-primary:hover {
          background: var(--accent);
          transform: translateY(-1px);
          box-shadow: var(--shadow-warm);
        }
        .pf-cta-primary svg { transition: transform var(--motion-base); }
        .pf-cta-primary:hover svg { transform: translateX(3px); }

        .pf-link-trajectoires {
          display: inline-block;
          margin-top: 18px;
          font-family: var(--sans);
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--ocre-brule);
          text-decoration: none;
          border-bottom: 1px dotted var(--ocre-brule);
          padding-bottom: 2px;
          transition: all var(--motion-fast);
        }
        .pf-link-trajectoires:hover {
          color: var(--ink);
          border-bottom-color: var(--ink);
        }

        .pf-kpis {
          max-width: 1080px;
          margin: 0 auto 64px;
          padding: 0 40px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .pf-kpi {
          padding: 24px 24px 22px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 12px;
          transition: all var(--motion-base);
        }
        .pf-kpi:hover {
          border-color: var(--muted-soft);
          box-shadow: var(--shadow-2);
          transform: translateY(-2px);
        }
        .pf-kpi-num {
          font-family: var(--serif);
          font-size: 44px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.025em;
          margin-bottom: 14px;
          font-feature-settings: "lnum","tnum";
        }
        .pf-kpi-num-ink { color: var(--ink); }
        .pf-kpi-num-amber { color: var(--ocre-brule); }
        .pf-kpi-num-deep { color: var(--accent-deep); }
        .pf-kpi-num-green { color: var(--vert-foret); }
        .pf-kpi-unit {
          font-size: 18px;
          opacity: 0.5;
          margin-left: 2px;
        }
        .pf-kpi-label {
          font-family: var(--sans);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--ink);
          margin-bottom: 4px;
        }
        .pf-kpi-sub {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
        }

        .pf-section {
          max-width: 1080px;
          margin: 0 auto 64px;
          padding: 0 40px;
        }
        .pf-section-head {
          margin-bottom: 24px;
        }
        .pf-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
          margin-bottom: 12px;
        }
        .pf-section-title {
          font-family: var(--serif);
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.012em;
          margin-bottom: 8px;
          color: var(--ink);
        }
        .pf-section-sub {
          font-family: var(--serif);
          font-size: 15px;
          line-height: 1.55;
          color: var(--ink-soft);
          max-width: 720px;
        }
        .pf-section-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
        }

        .pf-chart {
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 12px;
          padding: 20px 16px 12px;
        }

        .pf-funnel {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 0;
          max-width: 720px;
        }
        .pf-funnel-step {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px 24px 20px 22px;
          background: var(--paper-accent);
          border: 1px solid var(--hairline);
          border-left-width: 3px;
          border-radius: 4px;
        }
        .pf-funnel-step-final {
          background: var(--paper);
          border-style: solid;
        }
        .pf-funnel-step-meta {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pf-funnel-step-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          opacity: 0.85;
        }
        .pf-funnel-step-label {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 500;
          color: var(--muted);
        }
        .pf-funnel-step-count {
          font-family: var(--serif);
          font-size: 28px;
          font-weight: 600;
          line-height: 1;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
        .pf-funnel-link {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 6px 0 6px 32px;
          height: 36px;
        }
        .pf-funnel-link-line {
          flex: 0 0 18px;
          height: 1px;
          background: var(--hairline);
        }
        .pf-funnel-link-line:last-child {
          flex: 1 1 auto;
        }
        .pf-funnel-link-rate {
          font-family: var(--serif);
          font-size: 13px;
          color: var(--muted);
          letter-spacing: 0.01em;
          white-space: nowrap;
        }
        .pf-funnel-link-rate em {
          font-style: italic;
          font-weight: 600;
          color: var(--ink-soft);
          margin-right: 4px;
        }

        .pf-stages {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 12px;
          padding: 22px 24px;
        }
        .pf-stage-row {
          display: grid;
          grid-template-columns: 160px 1fr 40px;
          align-items: center;
          gap: 14px;
        }
        .pf-stage-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--sans);
          font-size: 12.5px;
          color: var(--ink);
          font-weight: 500;
        }
        .pf-stage-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .pf-stage-bar {
          height: 8px;
          background: var(--hairline-soft);
          border-radius: 4px;
          overflow: hidden;
        }
        .pf-stage-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width var(--motion-slow);
        }
        .pf-stage-count {
          font-family: var(--serif);
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
          font-feature-settings: "lnum","tnum";
          text-align: right;
        }

        .pf-verdicts {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        .pf-verdict {
          padding: 24px 22px 20px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-top: 3px solid;
          border-radius: 0 0 10px 10px;
          transition: all var(--motion-base);
        }
        .pf-verdict:hover {
          box-shadow: var(--shadow-2);
          transform: translateY(-2px);
        }
        .pf-verdict-num {
          font-family: var(--serif);
          font-size: 38px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.025em;
          font-feature-settings: "lnum","tnum";
        }
        .pf-verdict-pct {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
          letter-spacing: 0.06em;
          margin-top: 6px;
          margin-bottom: 12px;
        }
        .pf-verdict-label {
          font-family: var(--serif);
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          line-height: 1.3;
        }

        .pf-list {
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 12px;
          padding: 14px 18px;
          list-style: none;
        }
        .pf-list-row {
          display: grid;
          grid-template-columns: 140px 1fr 36px;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid var(--hairline-soft);
        }
        .pf-list-row:last-child { border-bottom: none; }
        .pf-list-label {
          font-family: var(--serif);
          font-size: 13.5px;
          color: var(--ink);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pf-list-bar {
          height: 6px;
          background: var(--hairline-soft);
          border-radius: 3px;
          overflow: hidden;
        }
        .pf-list-bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 3px;
        }
        .pf-list-bar-fill-amber { background: var(--ocre-brule); }
        .pf-list-count {
          font-family: var(--serif);
          font-size: 14px;
          font-weight: 700;
          text-align: right;
          color: var(--ink);
          font-feature-settings: "lnum","tnum";
        }
        .pf-empty {
          font-family: var(--serif);
          font-size: 14px;
          color: var(--muted);
          font-style: italic;
          padding: 16px;
        }

        .pf-durations {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .pf-duration {
          padding: 18px 20px 16px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 10px;
        }
        .pf-duration-stage {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 600;
          color: var(--ink);
          padding-left: 10px;
          border-left: 3px solid;
          margin-bottom: 14px;
          line-height: 1.2;
        }
        .pf-duration-value {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 6px;
        }
        .pf-duration-num {
          font-family: var(--serif);
          font-size: 32px;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: -0.02em;
          line-height: 1;
          font-feature-settings: "lnum","tnum";
        }
        .pf-duration-unit {
          font-family: var(--sans);
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }
        .pf-duration-empty {
          font-family: var(--serif);
          font-size: 24px;
          color: var(--muted-soft);
        }
        .pf-duration-samples {
          font-family: var(--sans);
          font-size: 10.5px;
          color: var(--muted);
          letter-spacing: 0.04em;
        }

        @media (max-width: 900px) {
          .pf-intro { padding: 0 24px; margin-bottom: 40px; }
          .pf-kpis {
            grid-template-columns: 1fr 1fr;
            padding: 0 24px;
            margin-bottom: 48px;
          }
          .pf-section { padding: 0 24px; margin-bottom: 48px; }
          .pf-section-grid { grid-template-columns: 1fr; gap: 36px; }
          .pf-verdicts { grid-template-columns: 1fr 1fr; }
          .pf-funnel-step {
            padding: 16px 18px 16px 16px;
            gap: 16px;
          }
          .pf-funnel-step-count {
            font-size: 24px;
          }
          .pf-funnel-link {
            padding-left: 20px;
          }
          .pf-stage-row {
            grid-template-columns: 110px 1fr 32px;
            gap: 10px;
          }
          .pf-list-row {
            grid-template-columns: 100px 1fr 30px;
            gap: 10px;
          }
        }
        @media (max-width: 600px) {
          .pf-kpi-num { font-size: 36px; }
          .pf-kpi { padding: 18px 18px 16px; }
          .pf-verdicts { grid-template-columns: 1fr; }
          .pf-stages, .pf-list, .pf-chart { padding: 14px; }
          .pf-stage-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }
          .pf-stage-bar { width: 100%; }
        }
      `}</style>
    </main>
  );
}
