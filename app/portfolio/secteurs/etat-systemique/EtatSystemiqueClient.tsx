'use client';

// ============================================================
// CLIENT COMPONENT - ETAT SYSTEMIQUE DES SECTEURS
// ------------------------------------------------------------
// Mise en page editoriale Le Grand Continent : prose dense en
// trois sections (convergences, divergences, patterns macro)
// precedees du narrative_summary, suivies du bandeau methodologie
// (sources consultees, completude, metadata generation). Selecteur
// de periode en tete pour consulter les briefs historiques.
//
// Aucun import direct vers le module engine au runtime cote
// client : toutes les donnees arrivent en props depuis le Server
// Component parent. Seul un import type depuis le barrel
// client-safe est utilise (erase au compile, zero impact webpack).
// ============================================================

import * as React from 'react';
import Link from 'next/link';
import type {
  InterSectoralBrief,
  InterSectoralPeriodEntry,
  ConvergencePairWithInterpretation,
  DivergencePairWithInterpretation,
  MacroPatternWithInterpretation,
  DimensionKey,
} from '@/lib/engines/sectoral-intelligence/client';
import { DIMENSION_LABELS, SECTORS } from '@/lib/engines/sectoral-intelligence/client';

interface Props {
  brief: InterSectoralBrief | null;
  periods: InterSectoralPeriodEntry[];
  selectedPeriod: string | null;
  orgName: string;
  userEmail: string;
}

export default function EtatSystemiqueClient({
  brief,
  periods,
  selectedPeriod,
  orgName,
  userEmail,
}: Props) {
  const onPeriodChange = (newPeriod: string) => {
    // Navigation simple : on recharge la page avec le parametre
    // query. Le Server Component refetche le brief, le selecteur
    // de periode reste synchrone avec l URL.
    if (newPeriod) {
      window.location.href = `/portfolio/secteurs/etat-systemique?period=${encodeURIComponent(newPeriod)}`;
    } else {
      window.location.href = '/portfolio/secteurs/etat-systemique';
    }
  };

  return (
    <main className="es-main">
      <header className="es-header">
        <div className="es-eyebrow-row">
          <div className="es-eyebrow">Dashboard · {orgName}</div>
          <nav className="es-nav">
            <Link href="/portfolio/secteurs" className="es-nav-link">
              Treize secteurs
            </Link>
            <span className="es-nav-active">État systémique</span>
          </nav>
        </div>
        <h1 className="es-title">État systémique des secteurs Prélude</h1>
        <p className="es-lede">
          Lecture trimestrielle agrégée des treize fiches sectorielles.
          Trois objets analytiques structurent la sortie : convergences
          (secteurs qui se rapprochent sur une dimension), divergences
          (secteurs qui s&apos;écartent brutalement), et patterns macro
          structurels (dimensions qui bougent sur la majorité des
          secteurs). Sources auditables, calculs déterministes,
          interprétation éditoriale Le Grand Continent.
        </p>

        <PeriodSelector
          periods={periods}
          selectedPeriod={selectedPeriod}
          onChange={onPeriodChange}
        />
      </header>

      {!brief ? (
        <section className="es-empty">
          <h2 className="es-empty-title">Aucun brief disponible pour cette période.</h2>
          <p className="es-empty-body">
            Le brief inter-sectoriel se génère automatiquement le premier
            jour de chaque trimestre civil. Un super-admin Prélude peut
            également déclencher manuellement la régénération depuis
            l&apos;administration. Connecté en : {userEmail}.
          </p>
        </section>
      ) : (
        <BriefView brief={brief} />
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

// ============================================================
// SELECTEUR DE PERIODE
// ============================================================

function PeriodSelector({
  periods,
  selectedPeriod,
  onChange,
}: {
  periods: InterSectoralPeriodEntry[];
  selectedPeriod: string | null;
  onChange: (p: string) => void;
}) {
  if (periods.length === 0) {
    return null;
  }
  return (
    <div className="es-period-row">
      <label className="es-period-label">Période</label>
      <select
        className="es-period-select"
        value={selectedPeriod ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {periods.map((p) => (
          <option key={p.id} value={p.period_quarter}>
            {p.period_quarter} ({formatGeneratedAt(p.generated_at)})
          </option>
        ))}
      </select>
      <style jsx>{periodStyles}</style>
    </div>
  );
}

// ============================================================
// AFFICHAGE PRINCIPAL DU BRIEF
// ============================================================

function BriefView({ brief }: { brief: InterSectoralBrief }) {
  return (
    <article className="bv">
      <div className="bv-meta-row">
        <div className="bv-period">{brief.period_quarter}</div>
        <div className="bv-generated">
          Genere le {formatGeneratedAt(brief.generated_at)}
        </div>
      </div>

      {brief.data_completeness && hasGaps(brief.data_completeness) && (
        <DataCompletenessBanner completeness={brief.data_completeness} />
      )}

      <section className="bv-section bv-narrative">
        <h2 className="bv-section-title">Synthese editoriale</h2>
        <ProseBlock text={brief.narrative_summary} />
      </section>

      <section className="bv-section">
        <h2 className="bv-section-title">Convergences sectorielles</h2>
        <p className="bv-section-lede">
          Paires de secteurs dont les scores se rapprochent
          significativement sur une meme dimension entre le trimestre
          precedent et le trimestre courant.
        </p>
        {brief.convergences.length === 0 ? (
          <p className="bv-empty">
            Aucune convergence detectee ce trimestre. Les seuils
            doctrinaux (ecart precedent superieur a vingt points,
            ecart courant inferieur a dix points) ne sont franchis sur
            aucune paire.
          </p>
        ) : (
          <ul className="bv-list">
            {brief.convergences.map((c, i) => (
              <ConvergenceItem key={`${c.dimension}-${c.sectors[0]}-${c.sectors[1]}-${i}`} item={c} />
            ))}
          </ul>
        )}
      </section>

      <section className="bv-section">
        <h2 className="bv-section-title">Divergences sectorielles</h2>
        <p className="bv-section-lede">
          Paires de secteurs qui s ecartent brutalement sur une meme
          dimension entre deux trimestres consecutifs.
        </p>
        {brief.divergences.length === 0 ? (
          <p className="bv-empty">
            Aucune divergence detectee ce trimestre. Les seuils
            doctrinaux (ecart precedent inferieur a quinze points,
            ecart courant superieur a trente points) ne sont franchis
            sur aucune paire.
          </p>
        ) : (
          <ul className="bv-list">
            {brief.divergences.map((d, i) => (
              <DivergenceItem key={`${d.dimension}-${d.sectors[0]}-${d.sectors[1]}-${i}`} item={d} />
            ))}
          </ul>
        )}
      </section>

      <section className="bv-section">
        <h2 className="bv-section-title">Patterns macro structurels</h2>
        <p className="bv-section-lede">
          Dimensions qui ont bouge de plus de dix points dans la meme
          direction sur plus de la moitie des treize secteurs entre
          deux trimestres consecutifs.
        </p>
        {brief.macro_patterns.length === 0 ? (
          <p className="bv-empty">
            Aucun pattern macro detecte ce trimestre. Aucune dimension
            ne traverse l ecosysteme de maniere systemique a la
            granularite des seuils doctrinaux.
          </p>
        ) : (
          <ul className="bv-list">
            {brief.macro_patterns.map((p, i) => (
              <MacroPatternItem key={`${p.dimension}-${p.direction}-${i}`} item={p} />
            ))}
          </ul>
        )}
      </section>

      <MethodologyFooter brief={brief} />

      <style jsx>{briefStyles}</style>
    </article>
  );
}

function ConvergenceItem({ item }: { item: ConvergencePairWithInterpretation }) {
  return (
    <li className="bv-item">
      <header className="bv-item-head">
        <span className="bv-item-pair">
          {sectorLabel(item.sectors[0])} et {sectorLabel(item.sectors[1])}
        </span>
        <span className="bv-item-dim">{DIMENSION_LABELS[item.dimension as DimensionKey]}</span>
      </header>
      <div className="bv-item-numbers">
        Ecart trimestre precedent : {item.delta_t_minus_1} points. Ecart
        trimestre courant : {item.delta_t} points. Resserrement de{' '}
        {item.delta_t_minus_1 - item.delta_t} points.
      </div>
      {item.interpretation && (
        <p className="bv-item-interp">{item.interpretation}</p>
      )}
      <style jsx>{itemStyles}</style>
    </li>
  );
}

function DivergenceItem({ item }: { item: DivergencePairWithInterpretation }) {
  return (
    <li className="bv-item">
      <header className="bv-item-head">
        <span className="bv-item-pair">
          {sectorLabel(item.sectors[0])} et {sectorLabel(item.sectors[1])}
        </span>
        <span className="bv-item-dim">{DIMENSION_LABELS[item.dimension as DimensionKey]}</span>
      </header>
      <div className="bv-item-numbers">
        Ecart trimestre precedent : {item.delta_t_minus_1} points. Ecart
        trimestre courant : {item.delta_t} points. Rupture de{' '}
        {item.delta_t - item.delta_t_minus_1} points.
      </div>
      {item.interpretation && (
        <p className="bv-item-interp">{item.interpretation}</p>
      )}
      <style jsx>{itemStyles}</style>
    </li>
  );
}

function MacroPatternItem({ item }: { item: MacroPatternWithInterpretation }) {
  return (
    <li className="bv-item">
      <header className="bv-item-head">
        <span className="bv-item-pair">
          {DIMENSION_LABELS[item.dimension as DimensionKey]}
        </span>
        <span className={`bv-item-direction bv-item-direction-${item.direction}`}>
          {item.direction === 'up' ? 'Haussiere' : 'Baissiere'} · delta moyen{' '}
          {item.average_delta > 0 ? '+' : ''}
          {item.average_delta} pts
        </span>
      </header>
      <div className="bv-item-numbers">
        {item.sectors_affected.length} secteurs concernes :{' '}
        {item.sectors_affected.map(sectorLabel).join(', ')}.
      </div>
      {item.interpretation && (
        <p className="bv-item-interp">{item.interpretation}</p>
      )}
      <style jsx>{itemStyles}</style>
    </li>
  );
}

// ============================================================
// BANDEAUX SECONDAIRES
// ============================================================

function DataCompletenessBanner({ completeness }: { completeness: NonNullable<InterSectoralBrief['data_completeness']> }) {
  return (
    <div className="bv-banner">
      <div className="bv-banner-title">Périmètre dégradé</div>
      <p className="bv-banner-body">
        Le brief a été généré avec des données incomplètes. Les paires
        impliquant les secteurs sans fiche ne sont pas évaluables et
        sont silencieusement exclues des calculs déterministes.
      </p>
      <ul className="bv-banner-list">
        {completeness.missing_at_t.length > 0 && (
          <li>
            Secteurs sans fiche au trimestre courant :{' '}
            {completeness.missing_at_t.map(sectorLabel).join(', ')}.
          </li>
        )}
        {completeness.missing_at_t_minus_1.length > 0 && (
          <li>
            Secteurs sans fiche au trimestre précédent (non comparables) :{' '}
            {completeness.missing_at_t_minus_1.map(sectorLabel).join(', ')}.
          </li>
        )}
        {completeness.missing_both.length > 0 && (
          <li>
            Secteurs absents des deux trimestres :{' '}
            {completeness.missing_both.map(sectorLabel).join(', ')}.
          </li>
        )}
      </ul>
      <style jsx>{bannerStyles}</style>
    </div>
  );
}

function MethodologyFooter({ brief }: { brief: InterSectoralBrief }) {
  return (
    <footer className="bv-footer">
      <h3 className="bv-footer-title">Note méthodologique</h3>
      <p>
        Brief genere par le modele {brief.generation_metadata.model}{' '}
        (version de prompt {brief.generation_metadata.prompt_version}).{' '}
        Cout estime : {formatCost(brief.generation_metadata.cost_usd)}.{' '}
        Duree de generation :{' '}
        {formatDuration(brief.generation_metadata.duration_ms)}. Sources
        consultees : {brief.sources_consulted.length} fiches sectorielles.
      </p>
      <details className="bv-footer-details">
        <summary>Sources detaillees</summary>
        <ul>
          {brief.sources_consulted.map((s) => (
            <li key={s.sector_slug}>
              {sectorLabel(s.sector_slug)} · fiche du{' '}
              {formatGeneratedAt(s.generated_at)}
              {s.brief_id ? ` · ${s.brief_id.slice(0, 8)}` : ''}
            </li>
          ))}
        </ul>
      </details>
      <style jsx>{footerStyles}</style>
    </footer>
  );
}

// ============================================================
// PROSE FORMATTER
// ------------------------------------------------------------
// Le narrative_summary du LLM peut contenir des paragraphes
// separes par double saut de ligne. On rend chaque paragraphe en
// <p> pour une typographie editoriale propre, sans dependre d un
// markdown parser.
// ============================================================

function ProseBlock({ text }: { text: string }) {
  const paragraphs = (text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return <p className="bv-prose-empty">Pas de synthese editoriale dans ce brief.</p>;
  }
  return (
    <div className="bv-prose">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <style jsx>{proseStyles}</style>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function sectorLabel(slug: string): string {
  return SECTORS.find((s) => s.slug === slug)?.label ?? slug;
}

function formatGeneratedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
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

function hasGaps(c: NonNullable<InterSectoralBrief['data_completeness']>): boolean {
  return (
    c.missing_at_t.length > 0 ||
    c.missing_at_t_minus_1.length > 0 ||
    c.missing_both.length > 0
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = `
  .es-main {
    max-width: 920px;
    margin: 0 auto;
    padding: 40px 24px 80px;
    font-family: var(--serif);
    color: var(--ink);
  }
  .es-header {
    padding-bottom: 28px;
    border-bottom: 2px solid var(--hairline-strong);
    margin-bottom: 36px;
  }
  .es-eyebrow-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .es-eyebrow {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
  }
  .es-nav {
    display: flex;
    gap: 18px;
    font-family: var(--sans);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .es-nav-link {
    color: var(--muted);
    text-decoration: none;
    transition: color var(--motion-fast);
  }
  .es-nav-link:hover { color: var(--ink); }
  .es-nav-active {
    color: var(--ink);
    font-weight: 600;
  }
  .es-title {
    font-size: 34px;
    font-weight: 500;
    line-height: 1.15;
    color: var(--ink);
    margin: 0 0 14px;
  }
  .es-lede {
    font-size: 15px;
    line-height: 1.6;
    color: var(--ink-soft);
    max-width: 720px;
    margin: 0 0 24px;
  }
  .es-empty {
    padding: 32px 28px;
    background: var(--surface);
    border: 1px solid var(--hairline);
  }
  .es-empty-title {
    font-size: 18px;
    font-weight: 500;
    margin: 0 0 12px;
    color: var(--ink);
  }
  .es-empty-body {
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0;
  }
`;

const periodStyles = `
  .es-period-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .es-period-label {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
  .es-period-select {
    padding: 8px 12px;
    border: 1px solid var(--hairline);
    background: var(--surface);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 13px;
    border-radius: 4px;
    cursor: pointer;
  }
`;

const briefStyles = `
  .bv {
    background: var(--surface);
    padding: 32px 32px 40px;
    border: 1px solid var(--hairline);
  }
  .bv-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--hairline);
  }
  .bv-period {
    font-family: var(--mono);
    font-size: 14px;
    color: var(--accent);
    letter-spacing: 0.08em;
  }
  .bv-generated {
    font-family: var(--sans);
    font-size: 12px;
    color: var(--muted);
  }
  .bv-section {
    margin-bottom: 36px;
  }
  .bv-section:last-of-type {
    margin-bottom: 24px;
  }
  .bv-section-title {
    font-size: 20px;
    font-weight: 500;
    color: var(--ink);
    margin: 0 0 10px;
    line-height: 1.2;
  }
  .bv-section-lede {
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--muted);
    margin: 0 0 18px;
    font-style: italic;
    max-width: 640px;
  }
  .bv-narrative .bv-section-title {
    margin-bottom: 16px;
  }
  .bv-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bv-empty {
    font-style: italic;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.55;
    margin: 0;
  }
`;

const itemStyles = `
  .bv-item {
    padding: 16px 18px;
    background: var(--paper-accent);
    border-left: 2px solid var(--hairline);
  }
  .bv-item-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .bv-item-pair {
    font-family: var(--serif);
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
  }
  .bv-item-dim {
    font-family: var(--sans);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
  }
  .bv-item-direction {
    font-family: var(--sans);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .bv-item-direction-up { color: var(--rouge-anglais, #a23b2c); }
  .bv-item-direction-down { color: #2f6f3e; }
  .bv-item-numbers {
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin-bottom: 8px;
  }
  .bv-item-interp {
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink);
    margin: 0;
  }
`;

const bannerStyles = `
  .bv-banner {
    padding: 14px 18px;
    background: #fbf3e3;
    border-left: 3px solid var(--ocre-brule, #a6691a);
    margin-bottom: 28px;
  }
  .bv-banner-title {
    font-family: var(--sans);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ocre-brule, #a6691a);
    font-weight: 700;
    margin-bottom: 8px;
  }
  .bv-banner-body {
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
    margin: 0 0 8px;
  }
  .bv-banner-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--ink-soft);
  }
`;

const footerStyles = `
  .bv-footer {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid var(--hairline);
    font-family: var(--sans);
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.55;
  }
  .bv-footer-title {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
    margin: 0 0 8px;
  }
  .bv-footer p { margin: 0 0 12px; }
  .bv-footer-details summary {
    cursor: pointer;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .bv-footer-details ul {
    margin: 12px 0 0;
    padding-left: 18px;
    font-family: var(--mono);
    font-size: 10.5px;
  }
`;

const proseStyles = `
  .bv-prose p {
    font-size: 15.5px;
    line-height: 1.7;
    color: var(--ink);
    margin: 0 0 14px;
  }
  .bv-prose p:last-child { margin-bottom: 0; }
  .bv-prose-empty {
    font-style: italic;
    color: var(--muted);
    font-size: 14px;
    margin: 0;
  }
`;
