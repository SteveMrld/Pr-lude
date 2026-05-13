// ============================================================
// SECTEURS CLIENT - Vue grille des treize fiches sectorielles
// ------------------------------------------------------------
// Affiche en grille sobre les treize fiches sectorielles Prelude.
// Chaque carte porte le mini spider chart, le libelle du secteur,
// la date de la derniere generation et un lien vers la fiche
// complete (/portfolio/secteurs/[slug]). Les cartes sans fiche
// persistee (premier passage du regenerateur non encore lance)
// affichent une mention sobre.
//
// Voix editoriale Le Grand Continent, palette ocre brule sur
// creme strictement respectee.
// ============================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import { computeFreshness } from '@/lib/engines/sectoral-injection-pure';
import { SectoralSpiderChart, formatSectoralDate } from '@/app/components/sectoral';
import { PALETTE } from '@/lib/visuals/spiderweb';
import type { SectoralBrief } from '@/lib/engines/sectoral-intelligence/client';

export interface SectorListItem {
  slug: string;
  label: string;
  perimeter: string;
  brief: SectoralBrief | null;
}

interface Props {
  items: SectorListItem[];
  orgName: string;
  userEmail: string;
}

export default function SecteursClient({ items, orgName, userEmail }: Props): React.ReactElement {
  // Stats sommaires pour le bandeau d intro.
  const total = items.length;
  const generated = items.filter((i) => i.brief).length;
  const stale = items.filter((i) => {
    if (!i.brief) return false;
    const { freshness } = computeFreshness(i.brief.generated_at);
    return freshness === 'stale';
  }).length;

  return (
    <main className="sectoral-page">
      <header className="sectoral-page-header">
        <Link href="/portfolio" className="sectoral-back">
          ← Portefeuille
        </Link>
        <div className="sectoral-page-id">
          <div className="sectoral-org">{orgName}</div>
          <div className="sectoral-user">{userEmail}</div>
        </div>
      </header>

      <section className="sectoral-intro">
        <div className="sectoral-kicker">
          <span className="sectoral-kicker-dot"></span>
          <span>Sectoral Intelligence Layer · État du catalogue</span>
        </div>
        <h1 className="sectoral-title">
          Treize secteurs sous lecture <em>doctrinale et trimestrielle.</em>
        </h1>
        <p className="sectoral-lede">
          Vue d ensemble de la cartographie sectorielle Prelude. Chaque fiche
          est regeneree trimestriellement, citee, datee, lisible par tous les
          moteurs en injection hybride. Cliquer sur une carte pour deplier la
          fiche complete et activer la superposition ou la comparaison
          temporelle.
        </p>
        <div className="sectoral-stats">
          <span><strong>{generated}</strong> sur {total} fiches generees</span>
          {stale > 0 && (
            <span className="sectoral-stat-stale">
              <strong>{stale}</strong> obsoletes (regeneration recommandee)
            </span>
          )}
        </div>
      </section>

      <section className="sectoral-grid" data-testid="sectoral-grid">
        {items.map((item) => {
          const fresh = item.brief
            ? computeFreshness(item.brief.generated_at).freshness
            : null;
          return (
            <Link
              key={item.slug}
              href={`/portfolio/secteurs/${item.slug}`}
              className="sectoral-card"
              data-testid={`sectoral-card-${item.slug}`}
            >
              <div className="sectoral-card-inner">
                {item.brief ? (
                  <SectoralSpiderChart
                    brief={item.brief}
                    sectorLabel={item.label}
                    mode={fresh === 'stale' ? 'stale' : 'fresh'}
                    size={220}
                    subtitle={`Fiche du ${formatSectoralDate(item.brief.generated_at)}`}
                  />
                ) : (
                  <div className="sectoral-card-empty">
                    <div className="sectoral-card-empty-title">{item.label}</div>
                    <div className="sectoral-card-empty-perimeter">{item.perimeter}</div>
                    <div className="sectoral-card-empty-mention">
                      Aucune fiche persistee pour ce secteur. La premiere
                      generation est attendue au prochain cycle trimestriel.
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </section>

      <style jsx>{`
        .sectoral-page {
          background: ${PALETTE.cream};
          min-height: 100vh;
          padding: 24px 32px 80px;
          color: ${PALETTE.encre};
          font-family: var(--serif, Georgia, serif);
        }
        .sectoral-page-header {
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
        .sectoral-intro {
          max-width: 880px;
          margin: 0 auto 32px;
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
          margin-bottom: 12px;
        }
        .sectoral-kicker-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${PALETTE.ocreBrule};
        }
        .sectoral-title {
          font-size: 2.2rem;
          line-height: 1.2;
          font-weight: 600;
          margin: 0 0 16px;
          letter-spacing: -0.005em;
        }
        .sectoral-title em {
          color: ${PALETTE.ocreBrule};
          font-style: italic;
          font-weight: 500;
        }
        .sectoral-lede {
          font-size: 1.02rem;
          line-height: 1.65;
          color: ${PALETTE.sepia};
          max-width: 66ch;
          margin: 0 0 20px;
        }
        .sectoral-stats {
          font-family: var(--grotesque-condensed, sans-serif);
          font-size: 0.85rem;
          color: ${PALETTE.sepia};
          display: flex;
          gap: 24px;
        }
        .sectoral-stats strong {
          color: ${PALETTE.encre};
          font-weight: 700;
          margin-right: 4px;
        }
        .sectoral-stat-stale {
          color: ${PALETTE.ocreBrule};
        }
        .sectoral-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .sectoral-card {
          text-decoration: none;
          color: inherit;
          transition: transform 150ms ease-out;
        }
        .sectoral-card:hover {
          transform: translateY(-2px);
        }
        .sectoral-card-inner {
          height: 100%;
        }
        .sectoral-card-empty {
          padding: 24px;
          background: ${PALETTE.cream};
          border: 1px dashed ${PALETTE.ocreEteint};
          border-radius: 2px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sectoral-card-empty-title {
          font-size: 1rem;
          font-weight: 600;
          color: ${PALETTE.encre};
        }
        .sectoral-card-empty-perimeter {
          font-size: 0.85rem;
          color: ${PALETTE.sepia};
          line-height: 1.5;
          font-style: italic;
        }
        .sectoral-card-empty-mention {
          font-family: var(--grotesque-condensed, sans-serif);
          font-size: 0.78rem;
          color: ${PALETTE.ocreBrule};
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid ${PALETTE.ocreEteint};
        }
      `}</style>
    </main>
  );
}
