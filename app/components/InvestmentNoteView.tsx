'use client';

import React from 'react';
import { enrichProse, splitIntoParagraphs } from '@/lib/note-typography';
import HistoricalComparables from './HistoricalComparables';
import OutcomeTracking from './OutcomeTracking';
import PortfolioPositionChart from './PortfolioPositionChart';
import StructurationEntreeSection from './StructurationEntreeSection';
import { SectoralSpiderChart } from './sectoral';
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  SECTORS as SECTORAL_SECTORS,
} from '@/lib/engines/sectoral-intelligence/types';
import { computeValuation } from '@/lib/engines/valuation-engine';
import { computeIndicators } from '@/lib/engines/indicators-engine';
import { computeTopRisks } from '@/lib/compute-top-risks';
import {
  buildTrajectoryRenderContext,
  buildPatternDeltaAnnotation,
  type TrajectoryRenderContext,
  type PatternAnnotation,
} from '@/lib/trajectory-render';
import type { TrajectorySummary } from '@/lib/engines/trajectory';
import type { PatternId } from '@/lib/engines/fragility-structurelle/types';

/**
 * Formate un montant en EUR de maniere courte et lisible :
 *   1 234 -> "1k€", 1 234 000 -> "1,2M€", 1 234 567 890 -> "1,2Md€".
 * Utilise dans la section Fourchette de valorisation pour afficher
 * les bornes de la plage et les exits scenarios.
 */
function formatEurShort(value: number): string {
  if (!value || value <= 0) return 'n/a';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.', ',')}Md€`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M€`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k€`;
  return `${Math.round(value)}€`;
}

/**
 * Joint plusieurs morceaux par un separateur en filtrant les vides.
 * Evite les artefacts visuels du genre ', France' ou 'seed ·' quand
 * un des deux cotes du separateur est null/undefined/string vide.
 */
function joinNonEmpty(parts: (string | number | null | undefined)[], sep: string, fallback = '—'): string {
  const filtered = parts
    .filter(p => p !== null && p !== undefined && String(p).trim() !== '')
    .map(p => String(p).trim());
  if (filtered.length === 0) return fallback;
  return filtered.join(sep);
}

interface Props {
  result: any;
  /**
   * ID de l analyse en base. Permet de charger les comparables historiques
   * via /api/analyses/[id]/comparables. Si absent, la section comparables
   * n est pas affichee (cas typique : note generee en live avant sauvegarde).
   */
  analysisId?: string;
  /**
   * Mode compact : sections secondaires repliees par defaut, lecture rapide
   * pour partner presse. Le verdict, le score, la dialectique et les
   * conditions cles restent visibles. Pour export PDF, utiliser
   * compactMode={false} (defaut).
   */
  compactMode?: boolean;
  /**
   * Callback appele quand le partner clique sur le bandeau "Passer en DD
   * approfondie". Si fourni, le bandeau apparait en haut de la section
   * Bloc 2 de la note quand le verdict autorise la DD (different de
   * "refuser") et qu aucune section Data Room n a encore ete declenchee.
   * Si non fourni (cas export PDF par exemple), aucun bandeau interactif
   * n est affiche.
   */
  onDeepenDDClick?: () => void;
}

/**
 * Section repliable utilisee en mode compact. Utilise <details> natif HTML
 * pour rester accessible et leger. defaultOpen=false en compactMode,
 * defaultOpen=true sinon.
 */
function FoldableSection({
  title,
  defaultOpen,
  children,
  count,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <details open={defaultOpen} style={{ margin: '14px 0' }} className="prelude-fold">
      <summary style={{
        cursor: 'pointer',
        fontFamily: 'var(--serif)',
        fontSize: 14,
        fontWeight: 600,
        padding: '12px 14px',
        background: 'var(--accent-soft)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: '0 8px 8px 0',
        listStyle: 'none',
        userSelect: 'none',
        outline: 'none',
        transition: 'all var(--motion-base)',
        color: 'var(--ink)',
      }}>
        <span className="prelude-fold-arrow" style={{
          marginRight: 10,
          fontSize: 12,
          color: 'var(--accent)',
          display: 'inline-block',
          transition: 'transform var(--motion-base)',
          fontWeight: 700,
        }}>▸</span>
        {title}
        {count !== undefined && (
          <span style={{ marginLeft: 10, fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>({count})</span>
        )}
        <span style={{
          float: 'right',
          fontSize: 10,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          fontWeight: 600,
          marginTop: 4,
          fontFamily: 'var(--sans)',
        }}>Replié en lecture rapide</span>
      </summary>
      <div style={{ paddingTop: 14 }}>
        {children}
      </div>
      <style jsx>{`
        .prelude-fold[open] :global(.prelude-fold-arrow),
        details[open] > summary > .prelude-fold-arrow {
          transform: rotate(90deg);
        }
        :global(.prelude-fold[open]) > summary > :global(.prelude-fold-arrow) {
          transform: rotate(90deg);
        }
        :global(details.prelude-fold[open]) > summary {
          background: var(--accent-soft);
        }
        :global(details.prelude-fold) > summary:hover {
          filter: brightness(0.97);
        }
        :global(details.prelude-fold) > summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </details>
  );
}

/**
 * Wrapper d'une section de note. En mode compact avec collapseInCompact=true,
 * la section devient pliable avec defaultOpen=false. Sinon rendu normal.
 * Permet d'eviter la duplication du contenu pour les modes lecture rapide
 * vs lecture complete.
 */
function NoteSectionWrapper({
  number,
  title,
  compactMode,
  collapseInCompact,
  sectionId,
  children,
}: {
  number: string;
  title: string;
  compactMode: boolean;
  collapseInCompact: boolean;
  sectionId?: string;
  children: React.ReactNode;
}) {
  // En mode compact ET section listee comme collapsible, on rend en details
  if (compactMode && collapseInCompact) {
    return (
      <section className="note-section" id={sectionId} style={{ marginBottom: 24 }}>
        <details>
          <summary style={{
            cursor: 'pointer',
            listStyle: 'none',
            userSelect: 'none',
            padding: '6px 0',
          }}>
            <h2 className="note-section-title" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, margin: 0 }}>
              <span style={{ fontSize: 13, opacity: 0.55, fontWeight: 400 }}>▸</span>
              <span className="note-section-num">{number}</span> {title}
              <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 400, fontFamily: 'inherit', marginLeft: 12 }}>(développer)</span>
            </h2>
          </summary>
          <div style={{ paddingTop: 14 }}>
            {children}
          </div>
        </details>
      </section>
    );
  }
  // Mode complet ou non collapsible : rendu identique a l existant
  return (
    <section className="note-section" id={sectionId}>
      <h2 className="note-section-title">
        <span className="note-section-num">{number}</span> {title}
      </h2>
      {children}
    </section>
  );
}

// ============================================================
// NoteSectoralMethodBlock
// ------------------------------------------------------------
// Mini SectoralSpiderChart inject en tete de la section
// methodologique de la note. Le libelle pose le secteur primaire
// et la date de la fiche, en sous-titre les secteurs secondaires
// s ils existent. Lien cliquable vers la fiche complete dans le
// dashboard partner (/portfolio/secteurs/[slug]). Les quatre cas
// limites doctrinaux sont relayes au composant SectoralSpiderChart
// via la prop mode. Pour les modes sans rendu graphique (unknown,
// expired, no_brief), une mention textuelle sobre tient lieu de
// trace methodologique.
// ============================================================
function NoteSectoralMethodBlock({
  sectoral,
}: {
  sectoral: import('@/lib/engines/sectoral-injection').SectoralContext | null | undefined;
}) {
  // Pas de contexte du tout : on n affiche rien, le pipeline a
  // tourne sans resolution sectorielle (cas legacy ou erreur en
  // amont).
  if (!sectoral) return null;

  // Mode unknown_sector : mention textuelle, pas de chart.
  if (sectoral.mode === 'unknown_sector') {
    return (
      <div className="note-sectoral-method" data-testid="note-sectoral-unknown">
        <p className="note-sectoral-method-mention">
          Secteur emergent non couvert par la matrice sectorielle Prelude. La
          lecture sectorielle a ete suspendue pour ce dossier ; l analyse s
          appuie sur le seul contenu du pitch et sur la doctrine generale
          des moteurs.
        </p>
      </div>
    );
  }

  // Mode expired : fiche perimee, mention explicite.
  if (sectoral.mode === 'expired') {
    return (
      <div className="note-sectoral-method" data-testid="note-sectoral-expired">
        <p className="note-sectoral-method-mention">
          {sectoral.methodologyNote}
        </p>
      </div>
    );
  }

  // Mode no_brief : secteur reconnu mais aucune fiche persistee.
  if (sectoral.mode === 'no_brief') {
    return (
      <div className="note-sectoral-method" data-testid="note-sectoral-no-brief">
        <p className="note-sectoral-method-mention">
          {sectoral.methodologyNote}
        </p>
      </div>
    );
  }

  // Mode applied (fresh ou stale) : on rend le mini chart.
  const primary = sectoral.primary;
  if (!primary) return null;

  const SECTORS = SECTORAL_SECTORS;
  const sectorLabel =
    SECTORS.find((s) => s.slug === primary.brief.sector_slug)?.label
    ?? primary.brief.sector_slug;

  const secondaryLabels = sectoral.secondaries
    .map((s) =>
      SECTORS.find((sd) => sd.slug === s.brief.sector_slug)?.label
      ?? s.brief.sector_slug,
    )
    .filter(Boolean);

  const subtitle = secondaryLabels.length > 0
    ? `Secteurs secondaires : ${secondaryLabels.join(' et ')}`
    : undefined;

  const mode: import('./sectoral').SectoralRenderMode = primary.freshness === 'stale'
    ? 'stale'
    : 'fresh';

  return (
    <div className="note-sectoral-method" data-testid="note-sectoral-applied">
      <SectoralSpiderChart
        brief={primary.brief}
        sectorLabel={`Secteur primaire : ${sectorLabel}`}
        mode={mode}
        size={150}
        subtitle={subtitle}
        href={`/portfolio/secteurs/${primary.brief.sector_slug}`}
      />
      <style jsx>{`
        .note-sectoral-method {
          margin: 16px 0 20px;
          display: flex;
          justify-content: center;
        }
        .note-sectoral-method-mention {
          font-family: var(--serif, Georgia, serif);
          font-size: 0.88rem;
          line-height: 1.55;
          color: var(--ink-secondary, #475569);
          font-style: italic;
          margin: 0;
          padding: 12px 16px;
          background: #fef7f4;
          border-left: 3px solid #9C5A2A;
          max-width: 760px;
        }
      `}</style>
    </div>
  );
}

// ============================================================
// NoteSectoralAnnex
// ------------------------------------------------------------
// Annexe exhaustive en fin de note. Liste les huit dimensions de
// la fiche sectorielle avec leur score, leur definition appliquee
// et les sources citees par le LLM regenerateur. Sert l audit
// doctrinal. Sur les modes degrades (unknown, expired, no_brief),
// l annexe est omise : la mention dans la section methode suffit.
// ============================================================
function NoteSectoralAnnex({
  sectoral,
}: {
  sectoral: import('@/lib/engines/sectoral-injection').SectoralContext | null | undefined;
}) {
  if (!sectoral || sectoral.mode !== 'applied' || !sectoral.primary) return null;

  const SECTORS = SECTORAL_SECTORS;
  const primary = sectoral.primary;
  const sectorLabel =
    SECTORS.find((s) => s.slug === primary.brief.sector_slug)?.label
    ?? primary.brief.sector_slug;

  const dateLabel = (() => {
    try {
      return new Date(primary.brief.generated_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return primary.brief.generated_at;
    }
  })();

  return (
    <section
      className="note-sectoral-annex"
      id="engine-section-sectoral-annex"
      data-testid="note-sectoral-annex"
    >
      <h4 className="note-h4">Annexe sectorielle</h4>
      <p className="note-sectoral-annex-intro">
        Lecture exhaustive de la fiche {sectorLabel} (générée le {dateLabel}) qui
        a encadré l&apos;analyse de ce dossier. Huit dimensions standardisées, leurs
        scores chiffrés, la définition doctrinale appliquée au moment de la
        génération et les sources citées par le LLM régénérateur.
      </p>
      <ol className="note-sectoral-annex-list">
        {DIMENSION_KEYS.map((key) => {
          const d = primary.brief.dimensions[key];
          const score = d?.data_missing
            ? 'donnée insuffisante'
            : typeof d?.score === 'number'
              ? `${d.score}/100`
              : 'non chiffré';
          return (
            <li key={key}>
              <div className="note-sectoral-annex-head">
                <strong>{DIMENSION_LABELS[key]}</strong>
                <span className="note-sectoral-annex-score">{score}</span>
              </div>
              {d?.definition_applied && (
                <p className="note-sectoral-annex-def">{d.definition_applied}</p>
              )}
              {d?.notes && <p className="note-sectoral-annex-notes">{d.notes}</p>}
              {d?.sources_cited && d.sources_cited.length > 0 && (
                <ul className="note-sectoral-annex-sources">
                  {d.sources_cited.slice(0, 4).map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.title || s.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <style jsx>{`
        .note-sectoral-annex {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #C8A988;
        }
        .note-h4 {
          font-family: var(--serif, Georgia, serif);
          font-size: 1rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #2B2B2B;
          margin: 0 0 12px;
        }
        .note-sectoral-annex-intro {
          font-family: var(--serif, Georgia, serif);
          font-size: 0.92rem;
          line-height: 1.65;
          color: #2B2B2B;
          margin: 0 0 16px;
        }
        .note-sectoral-annex-list {
          list-style: decimal;
          padding-left: 24px;
          margin: 0;
          font-family: var(--serif, Georgia, serif);
        }
        .note-sectoral-annex-list > li {
          margin-bottom: 16px;
        }
        .note-sectoral-annex-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 4px;
        }
        .note-sectoral-annex-head strong {
          font-weight: 600;
          font-size: 0.96rem;
        }
        .note-sectoral-annex-score {
          font-family: var(--grotesque-condensed, sans-serif);
          font-size: 0.85rem;
          color: #6B5841;
        }
        .note-sectoral-annex-def {
          font-size: 0.88rem;
          line-height: 1.55;
          margin: 4px 0;
          color: #2B2B2B;
        }
        .note-sectoral-annex-notes {
          font-size: 0.85rem;
          line-height: 1.5;
          margin: 4px 0;
          color: #6B5841;
          font-style: italic;
        }
        .note-sectoral-annex-sources {
          list-style: none;
          padding-left: 0;
          margin: 6px 0 0;
          font-size: 0.82rem;
        }
        .note-sectoral-annex-sources li {
          margin-bottom: 2px;
        }
        .note-sectoral-annex-sources a {
          color: #9C5A2A;
          text-decoration: none;
          border-bottom: 1px dotted #C8A988;
        }
        .note-sectoral-annex-sources a:hover {
          color: #2B2B2B;
          border-bottom-color: #2B2B2B;
        }
      `}</style>
    </section>
  );
}

export default function InvestmentNoteView({ result, analysisId, compactMode = false, onDeepenDDClick }: Props) {
  const r = result;
  const e = r.extraction || {};
  const t = r.team || {};
  const m = r.market || {};
  const macro = r.macro || {};
  const fc = r.financialCoherence;
  const fd = r.financialData;
  const tcc = r.techClaimCoherence;
  const efr = r.executionFriction;
  const ddf = r.ddFinancial;
  const ddc = r.ddContractual;
  const ba = r.blindspotAnalysis;
  const ca = r.contrarianAnalysis;
  const pm = r.patternMatching;
  const nd = r.narrativeDrift;
  const ndVerdict = r.relevanceMatrix?.verdicts?.narrativeDrift;
  const fs = r.fragiliteStructurelle;
  const fsVerdicts = r.relevanceMatrix?.verdicts?.fragiliteStructurelle;
  const sectoral = (r as any).sectoralContext as
    | import('@/lib/engines/sectoral-injection').SectoralContext
    | null
    | undefined;
  const reco = r.finalRecommendation || {};
  const dateAnalyzed = new Date(r.meta?.analyzedAt || Date.now()).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  // Fallback de re-calcul du moteur valuation pour les analyses anterieures
  // au deploiement de la section 1.7. Le moteur est deterministe et ne fait
  // aucun appel LLM, on peut donc le rejouer cote client a la volee a partir
  // des outputs Bloc 1 deja persistes en base. Resultat identique a un
  // recalcul serveur, instantane, et la section 1.7 apparait correctement
  // dans toutes les anciennes notes sans avoir a regenerer le pipeline.
  const valuation = React.useMemo(() => {
    if (r.valuation) return r.valuation;
    if (!r.extraction) return null;
    try {
      const teamScore = reco?.dimensionProbabilities?.team
        ?? reco?.mechanicalScore?.dimensions?.team?.score
        ?? r.mechanicalScore?.dimensions?.team?.score
        ?? 50;
      const marketScore = reco?.dimensionProbabilities?.market
        ?? reco?.mechanicalScore?.dimensions?.market?.score
        ?? r.mechanicalScore?.dimensions?.market?.score
        ?? 50;
      return computeValuation({
        extraction: r.extraction,
        financial: r.financialCoherence,
        financialData: r.financialData,
        team: r.team,
        market: r.market,
        teamScore,
        marketScore,
      });
    } catch (err) {
      console.warn('[InvestmentNoteView] recompute valuation failed:', err);
      return null;
    }
  }, [r]);

  // Meme logique pour le moteur indicators (section 1.8). Calcul
  // deterministe, peut etre rejoue cote client si le resultJson
  // persiste ne contient pas d indicators (analyses anterieures au
  // deploiement). Lit financialData, extraction, et saasMetrics pour
  // que NDR et Magic Number soient calcules quand les donnees
  // d extraction LLM dediee sont disponibles.
  const indicators = React.useMemo(() => {
    if (r.indicators) return r.indicators;
    if (!r.extraction) return null;
    try {
      return computeIndicators({
        extraction: r.extraction,
        financial: r.financialCoherence,
        financialData: r.financialData,
        saasMetrics: r.saasMetrics,
        industrialMetrics: r.industrialMetrics,
        relevanceMatrix: r.relevanceMatrix,
      });
    } catch (err) {
      console.warn('[InvestmentNoteView] recompute indicators failed:', err);
      return null;
    }
  }, [r]);

  // ============================================================
  // CONTEXTE TRAJECTOIRE
  // ------------------------------------------------------------
  // Si l analyse est persistee (analysisId fourni), on charge
  // /api/analyses/[id]/trajectory pour comparer la version
  // courante a la version precedente. Le contexte sert a trois
  // zones d annotation : bandeau de top alerte (cran 1 ou 2),
  // en-tete de la section Fragilite, deltas en marge des cartes
  // pattern. Si aucune baseline n existe (premiere analyse, pas
  // de version anterieure), le contexte reste vide et le
  // composant degrade silencieusement (aucune annotation).
  // ============================================================
  const [trajectoryCtx, setTrajectoryCtx] = React.useState<TrajectoryRenderContext>(() => ({
    hasBaseline: false,
    comparison: null,
    header: null,
    banner: null,
    alerts: [],
  }));

  React.useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/analyses/${analysisId}/trajectory`);
        if (!res.ok) return;
        const body = await res.json();
        const summary: TrajectorySummary | undefined = body?.summary;
        if (cancelled) return;
        setTrajectoryCtx(buildTrajectoryRenderContext(summary ?? null));
      } catch (err) {
        // Degradation silencieuse : pas de baseline si l API echoue.
        console.warn('[InvestmentNoteView] trajectory fetch failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  // Helper pour extraire la première phrase d'un paragraphe long. Utilisé pour
  // les pull quotes : on veut une phrase impactante, pas un paragraphe entier.
  const firstSentence = (s: string | undefined, maxLen: number = 220): string => {
    if (!s) return '';
    const trimmed = s.trim();
    // Cherche la première séparation en .,!,? suivie d'un espace ou fin de chaîne
    const match = trimmed.match(/^[^.!?]+[.!?](?=\s|$)/);
    const candidate = match ? match[0] : trimmed;
    if (candidate.length <= maxLen) return candidate;
    // Si trop long, tronque proprement au dernier espace avant maxLen
    const truncated = candidate.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > maxLen * 0.7 ? truncated.slice(0, lastSpace) : truncated) + '…';
  };

  return (
    <div className="investment-note">
      {/* TABLE DES MATIERES FLOTTANTE
          Sticky a droite sur desktop, donne une vue d ensemble des
          sections de la note et permet le saut direct via ancres. Cachee
          sur mobile (largeur insuffisante). Les ancres correspondent aux
          ids engine-section-X poses sur les h3 ou sections principales,
          partages avec le bandeau pipeline pour que clic du bandeau et
          clic de la TOC scrollent vers le meme endroit. */}
      <nav className="note-toc" aria-label="Table des matières de la note">
        <div className="note-toc-label">Sommaire</div>
        <ol className="note-toc-list">
          <li><a href="#engine-section-prescan" className="note-toc-link note-toc-link-cover">Couverture</a></li>
          <li><a href="#engine-section-extraction" className="note-toc-link">1. Société</a></li>
          <li><a href="#engine-section-team" className="note-toc-link note-toc-sub">Équipe dirigeante</a></li>
          <li><a href="#engine-section-financial-extraction" className="note-toc-link note-toc-sub">Profil financier</a></li>
          <li><a href="#engine-section-market" className="note-toc-link note-toc-sub">Opportunité de marché</a></li>
          <li><a href="#section-2" className="note-toc-link">2. Projet proposé</a></li>
          <li><a href="#section-3" className="note-toc-link">3. Thèse d&apos;investissement</a></li>
          <li><a href="#engine-section-orchestrate" className="note-toc-link note-toc-sub">Recommandation</a></li>
          <li><a href="#engine-section-contrarian" className="note-toc-link note-toc-sub">Plaidoyer en faveur</a></li>
          <li><a href="#engine-section-blindspot" className="note-toc-link note-toc-sub">Plaidoyer contre</a></li>
          <li><a href="#engine-section-orchestrate-resolution" className="note-toc-link note-toc-sub">Résolution dialectique</a></li>
          <li><a href="#engine-section-narrative-drift" className="note-toc-link note-toc-sub">Lecture du langage</a></li>
          <li><a href="#engine-section-macro" className="note-toc-link note-toc-sub">Contexte macro</a></li>
          <li><a href="#engine-section-blindspot-risks" className="note-toc-link note-toc-sub">Cartographie des risques</a></li>
          <li><a href="#engine-section-fragility-structurelle" className="note-toc-link note-toc-sub">Lecture de la fragilité structurelle</a></li>
          <li><a href="#engine-section-financial-coherence" className="note-toc-link note-toc-sub">Examen financier</a></li>
          <li><a href="#engine-section-tech-claim" className="note-toc-link note-toc-sub">Cohérence tech</a></li>
          <li><a href="#engine-section-execution-friction" className="note-toc-link note-toc-sub">Friction d&apos;exécution</a></li>
          <li><a href="#engine-section-pattern" className="note-toc-link note-toc-sub">Comparables</a></li>
          <li><a href="#engine-section-reference-checks" className="note-toc-link note-toc-sub">Plan d&apos;appels DD</a></li>
          <li><a href="#section-4" className="note-toc-link">4. Modalités</a></li>
          <li><a href="#section-5" className="note-toc-link">5. Comparables historiques</a></li>
          <li><a href="#section-6" className="note-toc-link">6. Suivi &amp; réconciliation</a></li>
        </ol>
      </nav>

      {/* Bandeau Lecture rapide : indique sans ambiguite que des sections
          sont repliees. Cliquable pour basculer immediatement, ou simple
          marqueur statique si pas de handler fourni. */}
      {compactMode && (
        <div style={{
          marginBottom: 16,
          padding: '10px 16px',
          fontFamily: 'var(--sans)',
          fontSize: 11.5,
          letterSpacing: '0.05em',
          color: 'var(--accent)',
          background: 'var(--accent-soft)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: '0 8px 8px 0',
        }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
            Lecture rapide
          </span>
          <span style={{ color: 'var(--ink-soft)', marginLeft: 10, fontFamily: 'var(--serif)' }}>
            Sections secondaires repliées. Verdict, score et conditions clés visibles.
          </span>
        </div>
      )}

      {/* En-tête de note */}
      <div className="note-header">
        <div className="note-header-left">
          <div className="note-brand">PRÉLUDE</div>
          <div className="note-title">Note d&apos;instruction</div>
        </div>
        <div className="note-header-right">
          <div className="note-date">{dateAnalyzed}</div>
          <div className="note-classification">CONFIDENTIEL · COMITÉ D&apos;INVESTISSEMENT</div>
        </div>
      </div>

      {/* ============================================================
          BANDEAU ALERTE GOUVERNANCE
          ------------------------------------------------------------
          S affiche en tete de note des qu un flag conflit d interet
          de severite haute remonte (SELF_DEAL cap-table ou
          BOARD_INSIDER). Le partner doit lire ce bandeau AVANT le
          verdict et la couverture editoriale : il conditionne sa
          posture de lecture. Les flags de severite moyenne (follow-on
          portfolio) ou faible (syndicate-regular) ne declenchent pas
          le bandeau d en-tete pour eviter le bruit, ils restent
          accessibles dans la section gouvernance plus bas.
          ============================================================ */}
      {(() => {
        const flags = Array.isArray(r.conflictOfInterest) ? r.conflictOfInterest : [];
        const highSeverity = flags.filter((f: any) => f && (f.kind === 'self-deal' || f.kind === 'board-insider'));
        if (highSeverity.length === 0) return null;
        const byKind: Record<string, any[]> = { 'self-deal': [], 'board-insider': [] };
        for (const f of highSeverity) byKind[f.kind].push(f);
        return (
          <section
            aria-label="Alerte gouvernance"
            style={{
              margin: '12px 0 16px',
              padding: '14px 18px',
              borderLeft: '3px solid #7a2916',
              background: 'rgba(122, 41, 22, 0.05)',
              fontFamily: 'var(--serif)',
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a2916', fontWeight: 600, marginBottom: 8 }}>
              Alerte gouvernance · Conflit d&apos;intérêt détecté
            </div>
            {byKind['self-deal'].length > 0 && (
              <div style={{ marginBottom: byKind['board-insider'].length > 0 ? 10 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Self-deal cap-table</div>
                {byKind['self-deal'].map((f: any, i: number) => (
                  <p key={i} style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.92 }}>{f.rationale}</p>
                ))}
              </div>
            )}
            {byKind['board-insider'].length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Board insider</div>
                {byKind['board-insider'].map((f: any, i: number) => (
                  <p key={i} style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.92 }}>{f.rationale}</p>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, lineHeight: 1.6, marginTop: 10, marginBottom: 0, fontStyle: 'italic', opacity: 0.75 }}>
              La lecture qui suit doit être filtrée par la conscience de cette position d&apos;intérêt. Une décision d&apos;investissement engageant le fonds requiert ici une validation indépendante du comité.
            </p>
          </section>
        );
      })()}

      {/* ============================================================
          BANDEAU ALERTE TRAJECTOIRE
          ------------------------------------------------------------
          S affiche en tete de note quand au moins une alerte de
          cran 1 ou 2 a ete declenchee sur la transition entre la
          version precedente et la version courante. Meme grammaire
          que le bandeau gouvernance ci-dessus : raison editoriale
          courte, recommandation, citations factuelles pour audit.
          Les alertes de cran 3 (digest hebdomadaire) et 4 (passif
          UI) ne remontent pas dans ce bandeau, elles vivent dans
          les annotations en marge des sections concernees.
          ============================================================ */}
      {trajectoryCtx.banner && (() => {
        const b = trajectoryCtx.banner!;
        const palette = b.cran === 1
          ? { ink: '#7a2916', bg: 'rgba(122, 41, 22, 0.05)' }
          : { ink: '#8a4a17', bg: 'rgba(138, 74, 23, 0.05)' };
        return (
          <section
            aria-label="Alerte trajectoire"
            style={{
              margin: '12px 0 16px',
              padding: '14px 18px',
              borderLeft: `3px solid ${palette.ink}`,
              background: palette.bg,
              fontFamily: 'var(--serif)',
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.ink, fontWeight: 600, marginBottom: 8 }}>
              Alerte trajectoire · Cran {b.cran}
              {b.additionalCriticalCount > 0 && (
                <span style={{ marginLeft: 8, opacity: 0.7, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  plus {b.additionalCriticalCount} autre{b.additionalCriticalCount > 1 ? 's' : ''} alerte{b.additionalCriticalCount > 1 ? 's' : ''} critique{b.additionalCriticalCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.55, margin: 0, marginBottom: 6 }}>
              {b.raison}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.92 }}>
              {b.recommandation}
            </p>
            {b.citations.length > 0 && (
              <p style={{ fontSize: 12, lineHeight: 1.55, marginTop: 8, marginBottom: 0, fontStyle: 'italic', opacity: 0.7 }}>
                {b.citations.join(' · ')}
              </p>
            )}
          </section>
        );
      })()}

      {/* ============================================================
          PAGE DE COUVERTURE EDITORIALE
          ------------------------------------------------------------
          Equivalent de la page 1 d un memo de fonds VC : tout ce qui
          permet a un partner de prendre une decision provisoire en 30
          secondes avant d ouvrir l analyse detaillee. Trois zones :
          1. Bandeau verdict (verdict, score, probabilites, deal type)
          2. Identite condensee (entreprise, secteur, geographie, tour)
          3. Trois colonnes : drivers decisifs, risques majeurs, action

          La note detaillee qui suit reste inchangee : la couverture
          est un ajout, pas une refonte. L utilisateur qui veut creuser
          a tout le materiel apres la couverture, comme avant.
          ============================================================ */}
      {(() => {
        const verdict = (reco.verdict || '').toLowerCase();
        const verdictLabels: Record<string, string> = {
          investir: 'Investir',
          'investir-conditions': 'Investir avec conditions',
          approfondir: 'Approfondir',
          refuser: 'Refuser',
        };
        const verdictTone: Record<string, string> = {
          investir: 'cover-verdict-tone-go',
          'investir-conditions': 'cover-verdict-tone-conditional',
          approfondir: 'cover-verdict-tone-watch',
          refuser: 'cover-verdict-tone-decline',
        };
        const globalScore = reco.computedScoreBreakdown?.finalComputedScore
          ?? reco.globalScore
          ?? null;
        // Guard contre les analyses tres anciennes ou corrompues qui n ont
        // ni verdict ni score : dans ce cas on n affiche pas la couverture
        // pour eviter d offrir un cartouche vide. Le partner verra
        // directement la section 1 Societe sans page de couverture, ce
        // qui est preferable a une couverture degenerée. La condition
        // est large : il suffit d avoir soit un verdict soit un score
        // pour que la couverture s affiche.
        if (!reco.verdict && globalScore === null) {
          return null;
        }
        const successProb = typeof reco.successProbability === 'number'
          ? reco.successProbability
          : null;
        const failureProb = typeof reco.failureProbability === 'number'
          ? reco.failureProbability
          : null;
        const drivers = Array.isArray(reco.decisionDrivers) ? reco.decisionDrivers.slice(0, 3) : [];
        const topRisks = computeTopRisks(r, 3);
        const conditions = Array.isArray(reco.conditionsCles)
          ? reco.conditionsCles.slice(0, 3)
          : (Array.isArray(reco.conditions) ? reco.conditions.slice(0, 3) : []);
        const actionText = verdict === 'refuser'
          ? 'Communiquer le refus à la startup, archiver le dossier dans le pipeline avec la motivation principale.'
          : verdict === 'investir' || verdict === 'investir-conditions'
            ? 'Préparer le passage en data room et le Bloc 2 (DD approfondie). Ouvrir les références terrain en parallèle.'
            : 'Cadrer les questions ouvertes avec la startup avant de réinstruire. Approfondir les zones grises identifiées dans la cartographie des risques.';

        return (
          <section className="note-cover" id="engine-section-prescan">
            {/* Bandeau verdict */}
            <div className={`note-cover-verdict ${verdictTone[verdict] || ''}`}>
              <div className="note-cover-verdict-eyebrow">Verdict d&apos;instruction</div>
              <div className="note-cover-verdict-label">
                {verdictLabels[verdict] || (reco.verdict || 'Sans verdict').toUpperCase()}
              </div>
              <div className="note-cover-verdict-stats">
                {globalScore !== null && (
                  <div className="note-cover-stat">
                    <div className="note-cover-stat-num">{globalScore}<span>/100</span></div>
                    <div className="note-cover-stat-label">Score global</div>
                  </div>
                )}
                {successProb !== null && (
                  <div className="note-cover-stat">
                    <div className="note-cover-stat-num">{successProb}<span>%</span></div>
                    <div className="note-cover-stat-label">Probabilité succès</div>
                  </div>
                )}
                {failureProb !== null && (
                  <div className="note-cover-stat">
                    <div className="note-cover-stat-num">{failureProb}<span>%</span></div>
                    <div className="note-cover-stat-label">Probabilité échec</div>
                  </div>
                )}
              </div>
            </div>

            {/* Identite condensee : six lignes denses */}
            <div className="note-cover-identity">
              <dl className="note-cover-identity-grid">
                <div className="note-cover-identity-item">
                  <dt>Entité</dt>
                  <dd>{e.companyName || 'Non renseigné'}</dd>
                </div>
                <div className="note-cover-identity-item">
                  <dt>Secteur</dt>
                  <dd>{joinNonEmpty([e.sector, e.subSector], ' · ')}</dd>
                </div>
                <div className="note-cover-identity-item">
                  <dt>Géographie</dt>
                  <dd>{joinNonEmpty([e.geographicHub, e.country], ', ')}</dd>
                </div>
                <div className="note-cover-identity-item">
                  <dt>Tour</dt>
                  <dd>{e.fundraise?.stage || 'Non renseigné'}</dd>
                </div>
                <div className="note-cover-identity-item">
                  <dt>Montant</dt>
                  <dd>{e.fundraise?.amount || 'Non renseigné'}</dd>
                </div>
                <div className="note-cover-identity-item">
                  <dt>Activité</dt>
                  <dd>{e.productDescription || 'Non renseigné'}</dd>
                </div>
              </dl>
            </div>

            {/* Trois colonnes : drivers, risques, action */}
            <div className="note-cover-trio">
              <div className="note-cover-trio-col">
                <div className="note-cover-trio-label">Drivers décisifs</div>
                {drivers.length > 0 ? (
                  <ol className="note-cover-trio-list">
                    {drivers.map((d: string, i: number) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ol>
                ) : (
                  <div className="note-cover-trio-empty">À documenter dans la thèse d&apos;investissement.</div>
                )}
              </div>
              <div className="note-cover-trio-col">
                <div className="note-cover-trio-label">Risques majeurs</div>
                {topRisks.length > 0 ? (
                  <ol className="note-cover-trio-list">
                    {topRisks.map((risk, i) => (
                      <li key={i}>
                        <span className="note-cover-trio-risk-name">{risk.label}</span>
                        <span className="note-cover-trio-risk-intensity"> · intensité {risk.intensity}/100</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="note-cover-trio-empty">Pas de pattern à risque détecté à intensité critique.</div>
                )}
              </div>
              <div className="note-cover-trio-col">
                <div className="note-cover-trio-label">Action proposée</div>
                <p className="note-cover-trio-action">{actionText}</p>
                {conditions.length > 0 && (
                  <>
                    <div className="note-cover-trio-action-sub">Conditions clés avant signature</div>
                    <ul className="note-cover-trio-conditions">
                      {conditions.slice(0, 2).map((c: any, i: number) => (
                        <li key={i}>{typeof c === 'string' ? c : (c?.condition || c?.label || '')}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="note-cover-footer">
              <span>
                Lecture détaillée ci-dessous · 6 sections principales
                {r.meta?.durationMs && ` · analysée en ${Math.round(r.meta.durationMs / 1000)}s`}
              </span>
              <a href="#section-3" className="note-cover-jump">Aller à la thèse d&apos;investissement →</a>
            </div>
          </section>
        );
      })()}

      {/* Bloc 1 - Société */}
      <section className="note-section" id="engine-section-extraction">
        <h2 className="note-section-title"><span className="note-section-num">1.</span> Société</h2>

        <table className="note-table">
          <tbody>
            <tr>
              <td className="note-label">Company</td>
              <td className="note-value bold">{e.companyName || '—'}</td>
            </tr>
            <tr>
              <td className="note-label">Sector</td>
              <td className="note-value">{joinNonEmpty([e.sector, e.subSector], ' · ')}</td>
            </tr>
            <tr>
              <td className="note-label">Activity</td>
              <td className="note-value">{e.productDescription || '—'}</td>
            </tr>
            <tr>
              <td className="note-label">Geography</td>
              <td className="note-value">{joinNonEmpty([e.geographicHub, e.country], ', ')}</td>
            </tr>
            <tr>
              <td className="note-label">Deal type</td>
              <td className="note-value">{joinNonEmpty([e.fundraise?.stage, e.fundraise?.amount || (e.fundraise?.stage ? 'montant non précisé' : null)], ' · ', 'non renseigné')}</td>
            </tr>
            <tr>
              <td className="note-label">Deal context</td>
              <td className="note-value">{e.marketPitch || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* ============================================================
            BLOC 1 - NOTE D INSTRUCTION (screening / deal qualification)
            ============================================================ */}
        <div className="block-marker block-marker-instruction">
          <div className="block-marker-tag">Bloc 1</div>
          <div className="block-marker-title">Note d&apos;instruction</div>
          <div className="block-marker-sub">Screening initial et deal qualification &middot; Lecture en 5 minutes</div>
        </div>

        <h3 className="note-h3">Historique</h3>
        {compactMode ? (
          <details>
            <summary style={{
              cursor: 'pointer',
              fontFamily: 'var(--serif, Georgia, serif)',
              fontSize: 13,
              fontStyle: 'italic',
              opacity: 0.75,
              padding: '4px 0',
              listStyle: 'none',
              userSelect: 'none',
            }}>
              <span style={{ marginRight: 6, fontSize: 10 }}>▸</span>
              Afficher la trajectoire de l&apos;entreprise
            </summary>
            <p className="note-paragraph" style={{ marginTop: 8 }}>{enrichProse(e.rawSummary) || '—'}</p>
          </details>
        ) : (
          <p className="note-paragraph">{enrichProse(e.rawSummary) || '—'}</p>
        )}

        <h3 className="note-h3" id="engine-section-team">Équipe dirigeante</h3>
        {(() => {
          // Filtre les fondateurs artefacts. Le moteur Team peut occasionnellement
          // generer des entrees corrompues issues du parsing (ex: name='1.',
          // role='Shareholder (role exact inconnu)') quand le pitch deck contient
          // des numerotations en debut de ligne. On filtre ces artefacts.
          const isValidFounder = (f: any): boolean => {
            const name = (f?.name || '').trim();
            if (!name) return false;
            // Rejette les noms qui commencent par un chiffre, un point, un slash
            if (/^[\d./\\]/.test(name)) return false;
            // Rejette les noms suspectement courts (1-2 caracteres)
            if (name.length < 3) return false;
            return true;
          };
          const fmfList = (t.founderMarketFit || []).filter(isValidFounder);
          const founderList = (e.founders || []).filter(isValidFounder);
          const hasAny = fmfList.length > 0 || founderList.length > 0;
          if (!hasAny) {
            return <p className="note-paragraph">Données fondateurs non disponibles.</p>;
          }
          return (
            <div>
              {fmfList.map((f: any, i: number) => {
                // Distinction critique : score "non instruit" vs score reel.
                // Quand evaluability === 'non-evaluable', le score est un plancher
                // de convention (5-15) qui signale l'impossibilite d'instruire,
                // PAS une mauvaise note. On affiche un libelle explicite pour eviter
                // que le lecteur lise '5/100' comme un mauvais profil.
                const nonEvaluable = f.evaluability === 'non-evaluable';
                const partiallyEvaluable = f.evaluability === 'partially-evaluable';
                return (
                  <div key={i} className={`founder-block ${nonEvaluable ? 'founder-block-uneval' : ''}`}>
                    <div className="founder-header">
                      <span className="founder-name">{f.name}</span>
                      <span className="founder-role">/ {f.role}</span>
                      {nonEvaluable ? (
                        <span className="founder-fit founder-fit-uneval" title="Score non instruit faute de données vérifiables - n'est pas un mauvais score, c'est l'absence d'instruction possible">
                          NON INSTRUIT
                        </span>
                      ) : partiallyEvaluable ? (
                        <span className="founder-fit founder-fit-partial" title="Instruction partielle - score à calibrer prudemment">
                          FMF {f.overallFitScore}/100 · Partiel
                        </span>
                      ) : (
                        <span className="founder-fit">FMF {f.overallFitScore}/100</span>
                      )}
                    </div>
                    <div className="founder-text"><strong>EXPERIENCE :</strong> {f.trajectorySummary}</div>
                    {f.tacitExpertise && (
                      <div className="founder-text"><strong>EXPERTISE TACITE :</strong> {f.tacitExpertise}</div>
                    )}
                    {f.fitSignals?.length > 0 && (
                      <div className="founder-text"><strong>SIGNAUX POSITIFS :</strong> {f.fitSignals.join(' · ')}</div>
                    )}
                  </div>
                );
              })}
              {fmfList.length === 0 && founderList.map((f: any, i: number) => (
                <div key={i} className="founder-block">
                  <div className="founder-header">
                    <span className="founder-name">{f.name}</span>
                    <span className="founder-role">/ {f.role}</span>
                  </div>
                  <div className="founder-text"><strong>EXPERIENCE :</strong> {f.background}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* AI VELOCITY - introduit en reponse a l ere IA generative.
            Mesure la fluidite des fondateurs avec les outils IA modernes
            (Cursor, Claude Code, v0). Verdict colore selon la couleur
            semantique : vert ai_native, ocre ai_competent, rouge ai_distant.
            Affiche evidence, redFlags et greenFlags structures. */}
        {t.aiVelocity && (
          <div className="ai-velocity" data-verdict={t.aiVelocity.verdict}>
            <div className="ai-velocity-header">
              <span className="ai-velocity-kicker">Vélocité IA</span>
              <span className="ai-velocity-verdict">
                {t.aiVelocity.verdict === 'ai_native' && 'AI-native'}
                {t.aiVelocity.verdict === 'ai_competent' && 'AI-competent'}
                {t.aiVelocity.verdict === 'ai_distant' && 'AI-distant'}
              </span>
              <span className="ai-velocity-score">{t.aiVelocity.score}/100</span>
            </div>
            <p className="note-paragraph ai-velocity-rationale">
              {enrichProse(t.aiVelocity.rationale)}
            </p>
            {t.aiVelocity.greenFlags?.length > 0 && (
              <div className="ai-velocity-block">
                <div className="ai-velocity-block-label ai-velocity-block-label-pos">
                  Signaux de fluidité
                </div>
                <ul className="ai-velocity-list">
                  {t.aiVelocity.greenFlags.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {t.aiVelocity.redFlags?.length > 0 && (
              <div className="ai-velocity-block">
                <div className="ai-velocity-block-label ai-velocity-block-label-warn">
                  Signaux d&apos;immobilisme
                </div>
                <ul className="ai-velocity-list ai-velocity-list-warn">
                  {t.aiVelocity.redFlags.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {t.aiVelocity.evidence?.length > 0 && (
              <div className="ai-velocity-block">
                <div className="ai-velocity-block-label">Indices observables</div>
                <ul className="ai-velocity-list ai-velocity-list-muted">
                  {t.aiVelocity.evidence.map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {fd && fd.revenueProjection?.length > 0 && (
          <>
            <h3 className="note-h3" id="engine-section-financial-extraction">Profil financier</h3>
            <table className="note-financials-table">
              <thead>
                <tr>
                  <th></th>
                  {(fd.revenueProjection || []).map((r: any, i: number) => <th key={i}>{r.year}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">CA (M€)</td>
                  {(fd.revenueProjection || []).map((r: any, i: number) => <td key={i}>{r.value}</td>)}
                </tr>
                {fd.grossMarginProjection?.length > 0 && (
                  <tr>
                    <td className="row-label">Marge brute (%)</td>
                    {(fd.grossMarginProjection || []).map((r: any, i: number) => <td key={i}>{r.value}</td>)}
                  </tr>
                )}
                {fd.ebitdaProjection?.length > 0 && (
                  <tr>
                    <td className="row-label">EBITDA (M€)</td>
                    {(fd.ebitdaProjection || []).map((r: any, i: number) => <td key={i}>{r.value}</td>)}
                  </tr>
                )}
                {fd.fcfProjection?.length > 0 && (
                  <tr>
                    <td className="row-label">Free Cash Flow (M€)</td>
                    {(fd.fcfProjection || []).map((r: any, i: number) => <td key={i}>{r.value}</td>)}
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* Bloc 2 - Project description (collapsible en mode compact) */}
      <NoteSectionWrapper number="2." title="Projet proposé" compactMode={compactMode} collapseInCompact={true} sectionId="section-2">
        <h3 className="note-h3">Produit</h3>
        <p className="note-paragraph">{enrichProse(e.productDescription) || '—'}</p>

        <h3 className="note-h3">Modèle économique</h3>
        <p className="note-paragraph">{enrichProse(e.businessModel) || '—'}</p>

        {fd?.unitEconomics && (fd.unitEconomics.estimatedCAC !== '' || fd.unitEconomics.averageContractValue !== '') && (
          <>
            <h3 className="note-h3">Hypothèses économiques</h3>
            <table className="note-table">
              <tbody>
                {fd.unitEconomics.averageContractValue && (
                  <tr><td className="note-label">ACV</td><td className="note-value">{fd.unitEconomics.averageContractValue}</td></tr>
                )}
                {fd.unitEconomics.estimatedCAC && (
                  <tr><td className="note-label">CAC estimé</td><td className="note-value">{fd.unitEconomics.estimatedCAC}</td></tr>
                )}
                {fd.unitEconomics.estimatedLTV && (
                  <tr><td className="note-label">LTV estimé</td><td className="note-value">{fd.unitEconomics.estimatedLTV}</td></tr>
                )}
                {fd.unitEconomics.estimatedLtvCacRatio && (
                  <tr><td className="note-label">Ratio LTV/CAC</td><td className="note-value">{fd.unitEconomics.estimatedLtvCacRatio}</td></tr>
                )}
                {fd.unitEconomics.grossMarginPerUnit && (
                  <tr><td className="note-label">Marge brute / unité</td><td className="note-value">{fd.unitEconomics.grossMarginPerUnit}</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        <h3 className="note-h3" id="engine-section-market">Opportunité de marché</h3>
        <p className="note-paragraph">{enrichProse(m.needIntensity?.rationale) || '—'}</p>
        {m.defensibility?.moats?.length > 0 && (
          <p className="note-paragraph"><strong>Moats identifiés :</strong> {m.defensibility.moats.join(' · ')}</p>
        )}

        {/* TEST AI REPLICABILITY - introduit en reponse a l ere IA generative.
            Pose la question : un solo founder + Cursor + Claude Code pourrait-il
            repliquer le produit en quelques mois ? Si oui, le verdict de
            defensibilite doit etre agressivement sceptique. Affiche un bandeau
            colore par verdict (rouge si high_risk, ambre si medium_risk, vert
            si protected) avec le reasoning et la liste des facteurs protecteurs. */}
        {m.defensibility?.aiReplicability && (
          <div className="ai-replicability" data-verdict={m.defensibility.aiReplicability.verdict}>
            <div className="ai-replicability-header">
              <span className="ai-replicability-kicker">Test de réplicabilité IA</span>
              <span className="ai-replicability-verdict">
                {m.defensibility.aiReplicability.verdict === 'high_risk' && 'Risque élevé'}
                {m.defensibility.aiReplicability.verdict === 'medium_risk' && 'Risque modéré'}
                {m.defensibility.aiReplicability.verdict === 'protected' && 'Protégé'}
              </span>
              <span className="ai-replicability-time">{m.defensibility.aiReplicability.timeToReplicate}</span>
            </div>
            <p className="note-paragraph ai-replicability-reasoning">
              {enrichProse(m.defensibility.aiReplicability.reasoning)}
            </p>
            {m.defensibility.aiReplicability.protectingFactors?.length > 0 && (
              <div className="ai-replicability-factors">
                <div className="ai-replicability-factors-label">Facteurs protecteurs</div>
                <ul className="ai-replicability-list">
                  {m.defensibility.aiReplicability.protectingFactors.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {m.defensibility.aiReplicability.replicableComponents?.length > 0 && (
              <div className="ai-replicability-factors">
                <div className="ai-replicability-factors-label ai-replicability-factors-label-warn">
                  Composants triviaux à répliquer
                </div>
                <ul className="ai-replicability-list ai-replicability-list-warn">
                  {m.defensibility.aiReplicability.replicableComponents.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* MARKET SIZING - bloc TAM/SAM/SOM avec sources verifiees.
            Ne s affiche que si le moteur Marche a effectivement rempli
            marketSizing (introduit en Niveau 2.A v2). Pour les analyses
            anciennes, le bloc reste invisible (retrocompatibilite). */}
        {m.marketSizing && (
          <>
            <h3 className="note-h3">Dimensionnement du marché</h3>
            {m.marketSizing.sizingNarrative && (
              <p className="note-paragraph">{enrichProse(m.marketSizing.sizingNarrative)}</p>
            )}
            <table className="note-table">
              <tbody>
                {m.marketSizing.tam && (
                  <tr>
                    <td className="note-label">
                      TAM
                      {m.marketSizing.tam.confidence && (
                        <span className="sizing-confidence" data-conf={m.marketSizing.tam.confidence}>
                          {m.marketSizing.tam.confidence === 'high' ? '●' : m.marketSizing.tam.confidence === 'medium' ? '◐' : '○'}
                        </span>
                      )}
                    </td>
                    <td className="note-value">
                      <strong>{m.marketSizing.tam.value}</strong>
                      {m.marketSizing.tam.timeframe && <span className="sizing-meta"> · {m.marketSizing.tam.timeframe}</span>}
                      {m.marketSizing.tam.source && <div className="sizing-source">Source : {m.marketSizing.tam.source}</div>}
                    </td>
                  </tr>
                )}
                {m.marketSizing.sam && (
                  <tr>
                    <td className="note-label">SAM</td>
                    <td className="note-value">
                      <strong>{m.marketSizing.sam.value}</strong>
                      {m.marketSizing.sam.timeframe && <span className="sizing-meta"> · {m.marketSizing.sam.timeframe}</span>}
                      {m.marketSizing.sam.source && <div className="sizing-source">Source : {m.marketSizing.sam.source}</div>}
                      {m.marketSizing.sam.methodology && <div className="sizing-source">Méthode : {m.marketSizing.sam.methodology}</div>}
                    </td>
                  </tr>
                )}
                {m.marketSizing.som && (
                  <tr>
                    <td className="note-label">SOM</td>
                    <td className="note-value">
                      <strong>{m.marketSizing.som.value}</strong>
                      {m.marketSizing.som.timeframe && <span className="sizing-meta"> · {m.marketSizing.som.timeframe}</span>}
                      {m.marketSizing.som.methodology && <div className="sizing-source">Méthode : {m.marketSizing.som.methodology}</div>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Alignement vs pitch : signal de rigueur du founder */}
            {m.marketSizing.pitchAlignment && m.marketSizing.pitchAlignment !== 'aligned' && (
              <div className={`pitch-alignment pitch-alignment-${m.marketSizing.pitchAlignment}`}>
                <span className="pitch-alignment-label">Alignement pitch :</span>
                <span className="pitch-alignment-value">
                  {m.marketSizing.pitchAlignment === 'overestimated' && 'Pitch surestime le marché'}
                  {m.marketSizing.pitchAlignment === 'underestimated' && 'Pitch sous-estime le marché'}
                  {m.marketSizing.pitchAlignment === 'pitch-not-cited' && 'Pitch ne cite pas de TAM'}
                </span>
                {m.marketSizing.pitchAlignmentNote && (
                  <div className="pitch-alignment-note">{enrichProse(m.marketSizing.pitchAlignmentNote)}</div>
                )}
              </div>
            )}
          </>
        )}

        {/* AI BUSINESS MODEL - Recalibrage des benchmarks classiques pour
            les boites construites autour d un LLM tiers. Trois fragilites
            structurelles cachees : marges AI-native, dependance LLM provider,
            risque de commoditisation. Le bloc ne s affiche que pour les
            boites detectees comme AI-native (classification != not_applicable). */}
        {m.aiBusinessModel && m.aiBusinessModel.classification !== 'not_applicable' && (
          <div className="ai-business" data-classification={m.aiBusinessModel.classification}>
            <div className="ai-business-header">
              <span className="ai-business-kicker">Modèle économique AI-native</span>
              <span className="ai-business-classification">
                {m.aiBusinessModel.classification === 'pure_wrapper' && 'Pur wrapper'}
                {m.aiBusinessModel.classification === 'ai_native_with_moats' && 'AI-native avec moats'}
                {m.aiBusinessModel.classification === 'ai_augmented_classic' && 'SaaS augmenté IA'}
              </span>
              <span className="ai-business-risk" data-risk={m.aiBusinessModel.commoditizationRisk}>
                Commoditisation : {m.aiBusinessModel.commoditizationRisk === 'low' ? 'faible'
                  : m.aiBusinessModel.commoditizationRisk === 'medium' ? 'modérée'
                  : m.aiBusinessModel.commoditizationRisk === 'high' ? 'élevée'
                  : 'extrême'}
              </span>
            </div>

            <div className="ai-business-grid">
              <div className="ai-business-cell">
                <div className="ai-business-cell-label">Marge brute estimée</div>
                <div className="ai-business-cell-value">{m.aiBusinessModel.grossMarginEstimate}</div>
                <div className="ai-business-cell-rationale">{m.aiBusinessModel.grossMarginRationale}</div>
              </div>
              <div className="ai-business-cell">
                <div className="ai-business-cell-label">Concentration LLM</div>
                <div className="ai-business-cell-value">{m.aiBusinessModel.llmProviderConcentration}</div>
              </div>
            </div>

            {m.aiBusinessModel.aiTaxSensitivity && (
              <div className="ai-business-block">
                <div className="ai-business-block-label">Sensibilité au choc tarifaire LLM</div>
                <p className="ai-business-block-text">{enrichProse(m.aiBusinessModel.aiTaxSensitivity)}</p>
              </div>
            )}

            {m.aiBusinessModel.commoditizationReasoning && (
              <div className="ai-business-block">
                <div className="ai-business-block-label">Risque de commoditisation</div>
                <p className="ai-business-block-text">{enrichProse(m.aiBusinessModel.commoditizationReasoning)}</p>
              </div>
            )}

            {m.aiBusinessModel.multipleAdjustment && (
              <div className="ai-business-block ai-business-block-emphasis">
                <div className="ai-business-block-label">Ajustement de multiple</div>
                <p className="ai-business-block-text">{enrichProse(m.aiBusinessModel.multipleAdjustment)}</p>
              </div>
            )}

            {m.aiBusinessModel.sustainableSignals?.length > 0 && (
              <div className="ai-business-block">
                <div className="ai-business-block-label ai-business-block-label-pos">
                  Signaux de soutenabilité
                </div>
                <ul className="ai-business-list">
                  {m.aiBusinessModel.sustainableSignals.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {m.aiBusinessModel.redFlags?.length > 0 && (
              <div className="ai-business-block">
                <div className="ai-business-block-label ai-business-block-label-warn">
                  Signaux d&apos;alerte
                </div>
                <ul className="ai-business-list ai-business-list-warn">
                  {m.aiBusinessModel.redFlags.map((f: string, i: number) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </NoteSectionWrapper>

      {/* Bloc 3 - Due diligence */}
      <section className="note-section" id="section-3">
        <h2 className="note-section-title"><span className="note-section-num">3.</span> Thèse d&apos;investissement</h2>

        <div className="dd-meta">
          <span className="dd-meta-bullet" aria-hidden="true">●</span>
          <span className="dd-meta-text">{dateAnalyzed.toUpperCase()}</span>
          <span className="dd-meta-sep" aria-hidden="true">·</span>
          <span className="dd-meta-text">Note préliminaire IC</span>
        </div>

        <h3 className="note-h3" id="engine-section-orchestrate">Recommandation</h3>
        <div className="verdict-box">
          {/* Verdict comme titre principal du bloc, pas comme une ligne
              parmi d autres. C est la conclusion narrative de l instruction
              Bloc 1, elle merite un traitement typographique distinct. */}
          <div className="verdict-headline">
            <div className="verdict-headline-label">Verdict de l&apos;instruction préalable</div>
            <div className="verdict-headline-value">{reco.verdict || '—'}</div>
          </div>

          {/* BLOC 1 : SCORE D ATTRACTIVITE STRUCTURELLE
              Le partner doit comprendre que ce chiffre est la note d
              attractivite ponderee sur six dimensions, et que c est lui
              qui determine le verdict via les seuils 45/60/75. La jauge
              visuelle vient juste apres pour matérialiser la position. */}
          <div className="verdict-block">
            <div className="verdict-block-head">
              <span className="verdict-block-num" aria-hidden="true">1</span>
              <span className="verdict-block-title">Score d&apos;attractivité structurelle</span>
              <span className="verdict-block-figure">
                {reco.globalScore || 0}
                <span style={{ fontSize: 14, opacity: 0.45, fontWeight: 400, marginLeft: 2 }}>/100</span>
              </span>
            </div>
            {typeof reco.globalScore === 'number' && (
              <div className="score-thresholds">
                <div className="score-thresholds-track">
                  <div className="zone zone-refuser" style={{ width: '45%' }} title="Refuser : score &lt; 45" />
                  <div className="zone zone-approfondir" style={{ width: '15%' }} title="Approfondir : 45-60" />
                  <div className="zone zone-conditions" style={{ width: '15%' }} title="Investir avec conditions : 60-75" />
                  <div className="zone zone-investir" style={{ width: '25%' }} title="Investir : 75+" />
                  <div
                    className="score-marker"
                    style={{ left: `${Math.min(100, Math.max(0, reco.globalScore))}%` }}
                    aria-label={`Score actuel : ${reco.globalScore} sur 100`}
                  />
                </div>
                <div className="score-thresholds-labels">
                  <span className="lbl lbl-refuser">Refuser</span>
                  <span className="lbl lbl-approfondir">Approfondir</span>
                  <span className="lbl lbl-conditions">Conditions</span>
                  <span className="lbl lbl-investir">Investir</span>
                </div>
                <div className="score-thresholds-axis">
                  <span>0</span>
                  <span style={{ flex: '0 0 auto', position: 'absolute', left: '45%', transform: 'translateX(-50%)' }}>45</span>
                  <span style={{ flex: '0 0 auto', position: 'absolute', left: '60%', transform: 'translateX(-50%)' }}>60</span>
                  <span style={{ flex: '0 0 auto', position: 'absolute', left: '75%', transform: 'translateX(-50%)' }}>75</span>
                  <span>100</span>
                </div>
              </div>
            )}
            <div className="verdict-block-legend">
              Note pondérée sur six dimensions (équipe 0,20 ; marché 0,22 ; macro 0,15 ; modèle économique 0,13 ; singularités contrariennes 0,15 ; vigilance critique inversée 0,15). Verdict dérivé déterministe : moins de 45 = refuser, 45 à 59 = approfondir, 60 à 74 = investir avec conditions, 75 et plus = investir. Score calculé par le code à partir des moteurs Bloc 1, indépendamment du jugement narratif.
            </div>
          </div>

          {/* DECOMPOSITION DETAILLEE DU SCORE
              Expose la formule mecanique : pour chaque dimension, le score
              brut produit par le moteur Bloc 1, le poids applique, et la
              contribution au score global. Les sous-scores composites
              Equipe (couverture systemique, anti-fragilite, transposition,
              obsession produit) et Marche (intensite besoin, defensibilite,
              signaux organiques) sont detailles. Garantie d auditabilite :
              le partner peut tracer chaque point du score a sa source. */}
          {reco.computedScoreBreakdown?.mechanicalDimensions && (() => {
            const md = reco.computedScoreBreakdown.mechanicalDimensions as any;
            const rows: Array<{ key: string; label: string; dim: any }> = [
              { key: 'team', label: 'Équipe', dim: md.team },
              { key: 'market', label: 'Marché', dim: md.market },
              { key: 'macro', label: 'Macro', dim: md.macro },
              { key: 'financial', label: 'Modèle économique', dim: md.financial },
              { key: 'contrarian', label: 'Singularités contrariennes', dim: md.contrarian },
              { key: 'vigilance', label: 'Vigilance critique', dim: md.vigilance },
            ];
            return (
              <div className="score-decomposition" style={{
                marginTop: 18,
                padding: '18px 20px',
                background: 'var(--surface, rgba(0,0,0,0.025))',
                border: '1px solid var(--hairline)',
                borderRadius: 4,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft)', marginBottom: 4 }}>
                  Décomposition du score
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 12px 0', lineHeight: 1.55 }}>
                  Le score global est la somme pondérée des six dimensions Bloc 1, calculées indépendamment par chaque moteur sur les faits du dossier. Aucun ajustement narratif au moment de la synthèse.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)' }}>Dimension</th>
                      <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)' }}>Score</th>
                      <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)' }}>Poids</th>
                      <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)' }}>Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <React.Fragment key={r.key}>
                        <tr style={{ borderBottom: '1px solid var(--hairline-soft, rgba(0,0,0,0.06))' }}>
                          <td style={{ padding: '8px 0', fontWeight: 500 }}>{r.label}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'var(--serif)', fontVariantNumeric: 'tabular-nums' }}>
                            {r.dim?.score ?? '?'}<span style={{ color: 'var(--ink-soft)' }}>/100</span>
                          </td>
                          <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                            {((r.dim?.weight ?? 0) * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--serif)', fontVariantNumeric: 'tabular-nums' }}>
                            +{(r.dim?.contribution ?? 0).toFixed(1)}
                          </td>
                        </tr>
                        {Array.isArray(r.dim?.subScores) && r.dim.subScores.length > 0 && (
                          <tr>
                            <td colSpan={4} style={{ padding: '0 0 10px 14px', fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.55, fontStyle: 'italic' }}>
                              {r.dim.subScores.map((s: any, idx: number) => (
                                <span key={idx}>
                                  {s.name} {s.score}/100 (poids {(s.weight * 100).toFixed(0)}%){idx < r.dim.subScores.length - 1 ? ' · ' : ''}
                                </span>
                              ))}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    <tr style={{ borderTop: '2px solid var(--ink)' }}>
                      <td style={{ padding: '10px 0 4px 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 11 }}>Score global</td>
                      <td colSpan={2} />
                      <td style={{ padding: '10px 0 4px 0', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--serif)', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                        {reco.globalScore}<span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 400 }}>/100</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-soft, rgba(0,0,0,0.04))', borderRadius: 3, fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                  <strong style={{ color: 'var(--ink)' }}>Verdict dérivé.</strong> Refuser sous 45. Approfondir entre 45 et 59. Investir avec conditions entre 60 et 74. Investir au-delà de 75. Le verdict <strong style={{ color: 'var(--ink)' }}>{(reco.verdict || '').toUpperCase()}</strong> découle strictement de ces seuils, sans intervention narrative possible.
                </div>
              </div>
          );
          })()}

          {/* DESACCORD MOTIVE DE L ANALYSTE
              Affiche en alerte editoriale quand le moteur d orchestration
              (LLM narrateur) a estime que son jugement structurel diverge
              fortement du calcul mecanique. Le partner peut alors lire le
              rationale du desaccord avant de conclure : c est le canal
              qui permet a la qualite subjective (founder-market fit
              exceptionnel, fenetre macro extreme non chiffrable) de
              remonter au-dessus des chiffres deterministes, sans pour
              autant les ecraser. Le score affiche reste le score
              mecanique. */}
          {reco.assessorDisagreement?.present && (
            <div className="verdict-block" style={{ borderLeft: '3px solid var(--ocre-brule)', paddingLeft: 14, marginTop: 12 }}>
              <div className="verdict-block-head">
                <span className="verdict-block-title" style={{ color: 'var(--ocre-brule)' }}>
                  Désaccord motivé de l&apos;analyste
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.92 }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  Le calcul mécanique des dimensions donne <strong>{reco.assessorDisagreement.mechanicalVerdict}</strong> à {reco.assessorDisagreement.mechanicalScore}/100. Le moteur d&apos;orchestration aurait calibré le dossier à <strong>{reco.assessorDisagreement.llmVerdict}</strong> à {reco.assessorDisagreement.llmScoreSuggestion}/100 si on lui avait laissé le choix, soit un écart de {reco.assessorDisagreement.scoreDelta > 0 ? '+' : ''}{reco.assessorDisagreement.scoreDelta} points.
                </p>
                <p style={{ margin: 0, fontStyle: 'italic' }}>
                  {reco.assessorDisagreement.rationale}
                </p>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, fontStyle: 'normal' }}>
                  Le score affiché reste le calcul mécanique déterministe. Cette alerte est un signal qualitatif à intégrer à la décision, pas un override.
                </div>
              </div>
            </div>
          )}

          {/* BLOC 1.5 : DECOMPOSITION DU SCORE PAR DIMENSION
              Auditabilite totale demandee par les partners : qui veut
              comprendre d ou vient le 47/100 doit pouvoir tracer chaque
              point a sa source moteur. Cette section affiche les six
              dimensions, leur score brut, leur poids dans la formule, et
              leur contribution finale au score global. Les sous-scores
              Equipe et Marche sont detailles parce que ce sont les seules
              dimensions composites (les autres viennent d un seul moteur). */}
          {reco.computedScoreBreakdown?.mechanicalDimensions && (
            <div className="verdict-block" style={{ marginTop: 14 }}>
              <div className="verdict-block-head">
                <span className="verdict-block-num" aria-hidden="true">1.5</span>
                <span className="verdict-block-title">Décomposition du score par dimension</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 8 }}>
                {(['team', 'market', 'macro', 'financial', 'contrarian', 'vigilance'] as const).map((key) => {
                  const dim: any = (reco.computedScoreBreakdown as any).mechanicalDimensions[key];
                  const labels: Record<string, string> = {
                    team: 'Équipe',
                    market: 'Marché',
                    macro: 'Macro / timing',
                    financial: 'Modèle économique',
                    contrarian: 'Singularités contrariennes',
                    vigilance: 'Vigilance critique (inversée)',
                  };
                  return (
                    <div key={key} style={{ borderLeft: `2px solid ${dim.notEvaluable ? 'var(--ocre-brule)' : 'var(--hairline)'}`, paddingLeft: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500 }}>{labels[key]}</span>
                        <span style={{ fontSize: 11, opacity: 0.55 }}>poids {Math.round(dim.weight * 100)}%</span>
                      </div>
                      {dim.notEvaluable ? (
                        <>
                          <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 2 }}>
                            <span style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, color: 'var(--ocre-brule)', fontStyle: 'italic' }}>Non évaluable</span>
                            <span style={{ fontSize: 11, opacity: 0.65 }}>valeur neutre 50 utilisée</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7, lineHeight: 1.5, fontStyle: 'italic' }}>
                            Données insuffisantes pour évaluer cette dimension. Le calcul global utilise une valeur neutre de 50 pour ne pas pénaliser le dossier.
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 2 }}>
                            <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>{dim.score}<span style={{ fontSize: 11, opacity: 0.5 }}>/100</span></span>
                            <span style={{ fontSize: 11, opacity: 0.65 }}>contribution {dim.contribution.toFixed(1)} pts</span>
                          </div>
                          {Array.isArray(dim.subScores) && dim.subScores.length > 0 && (
                            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7, lineHeight: 1.5 }}>
                              {dim.subScores.map((s: any, i: number) => (
                                <span key={i}>
                                  {i > 0 && ' · '}
                                  {s.name} {s.score}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="verdict-block-legend" style={{ marginTop: 10 }}>
                Formule : score = somme des (score_dimension × poids). Les six dimensions et leurs poids sont stables dans le temps. Les seuils de verdict sont 45 / 60 / 75. Un partner qui souhaite recalibrer la formule peut le faire en modifiant les poids dans le code, sans changer la nature des scores produits par les moteurs Bloc 1.
              </div>
            </div>
          )}

          {/* BLOC 1.6 : POSITIONNEMENT DANS LE PORTFOLIO
              Courbe de densite des scores du portfolio avec marker sur le
              score du dossier en cours. Le score absolu (47/100) est utile
              mais le score relatif au portfolio (65e percentile) est ce qui
              aide a arbitrer en IC. Le partner voit immediatement si le
              dossier est dans le top, le median, ou le bottom de ses
              instructions. La courbe ne s affiche que si l analyse est en
              base et a un score global numerique. */}
          {typeof reco.globalScore === 'number' && (
            <div className="verdict-block" style={{ marginTop: 14 }}>
              <div className="verdict-block-head">
                <span className="verdict-block-num" aria-hidden="true">1.6</span>
                <span className="verdict-block-title">Positionnement dans le portfolio</span>
              </div>
              <PortfolioPositionChart currentScore={reco.globalScore} printMode={false} />
            </div>
          )}

          {/* PERIMETRE D ANALYSE
              Affiche les criteres structurels detectes du dossier (asset
              class, modele business, chaine de production, expositions)
              et le verdict de pertinence par moteur ou sous-bloc (full /
              partial / none) avec le rationale. Rend transparent au
              partner le polymorphisme applique : pourquoi tel moteur a
              tourne, pourquoi tel autre s est declare non applicable.
              Cache si la matrice est absente (anciennes analyses non
              re-instruites apres deploiement du polymorphisme). */}
          {r.relevanceMatrix && (
            <div className="verdict-block" style={{ marginTop: 14 }}>
              <div className="verdict-block-head">
                <span className="verdict-block-num" aria-hidden="true">1.6b</span>
                <span className="verdict-block-title">Périmètre d&apos;analyse</span>
              </div>
              <div style={{ marginTop: 10, fontSize: '0.92rem', color: '#444', lineHeight: 1.5 }}>
                Moteurs activés selon le profil structurel du dossier. La matrice de pertinence sélectionne le cadre d&apos;analyse adapté au modèle économique avant de lancer chaque moteur.
              </div>

              {/* Critères structurels détectés */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#777', marginBottom: 8 }}>
                  Critères structurels
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 24px', fontSize: '0.9rem' }}>
                  {[
                    { label: 'Asset class', value: r.relevanceMatrix.assetClass },
                    { label: 'Modèle business', value: r.relevanceMatrix.businessModel },
                    { label: 'Chaîne de production', value: r.relevanceMatrix.productionChain },
                    { label: 'Funnel d\'acquisition', value: r.relevanceMatrix.acquisitionFunnel },
                    {
                      label: 'Exposition supply chain',
                      value: r.relevanceMatrix.supplyChainExposureFactors?.length > 0
                        ? `${r.relevanceMatrix.supplyChainExposure} (${r.relevanceMatrix.supplyChainExposureFactors.join(', ')})`
                        : r.relevanceMatrix.supplyChainExposure,
                    },
                    {
                      label: 'Exposition géopolitique',
                      value: r.relevanceMatrix.geopoliticalExposureFactors?.length > 0
                        ? `${r.relevanceMatrix.geopoliticalExposure} (${r.relevanceMatrix.geopoliticalExposureFactors.join(', ')})`
                        : r.relevanceMatrix.geopoliticalExposure,
                    },
                    {
                      label: 'Sensibilité macro',
                      value: r.relevanceMatrix.macroSensitivityFactors?.length > 0
                        ? `${r.relevanceMatrix.macroSensitivity} (${r.relevanceMatrix.macroSensitivityFactors.join(', ')})`
                        : r.relevanceMatrix.macroSensitivity,
                    },
                    {
                      label: 'Reproductibilité numérique',
                      value: r.relevanceMatrix.digitalReproducibilityFactors?.length > 0
                        ? `${r.relevanceMatrix.digitalReproducibility} (${r.relevanceMatrix.digitalReproducibilityFactors.join(', ')})`
                        : r.relevanceMatrix.digitalReproducibility,
                    },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ color: '#666', flexShrink: 0, minWidth: 160, fontSize: '0.82rem' }}>{row.label}</span>
                      <span style={{ color: '#1a1a1a' }}>{row.value || 'non applicable'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verdicts par moteur */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#777', marginBottom: 8 }}>
                  Verdict par moteur
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Lecture géopolitique', verdict: r.relevanceMatrix.verdicts?.macroGeopolitical },
                    { label: 'Lecture cyclique et conjoncture', verdict: r.relevanceMatrix.verdicts?.macroCyclical },
                    { label: 'Reproductibilité par IA', verdict: r.relevanceMatrix.verdicts?.marketAiReplicability },
                    { label: 'Modèle économique AI-native', verdict: r.relevanceMatrix.verdicts?.marketAiBusinessModel },
                    { label: 'Indicateurs SaaS canoniques', verdict: r.relevanceMatrix.verdicts?.indicatorsSaas },
                    { label: 'Indicateurs industriels', verdict: r.relevanceMatrix.verdicts?.indicatorsIndustrial },
                    { label: 'Métriques de rétention (NDR, Magic Number)', verdict: r.relevanceMatrix.verdicts?.saasMetricsRetention },
                    { label: 'Unit economics (CAC, CVR, Payback)', verdict: r.relevanceMatrix.verdicts?.saasMetricsUnitEconomics },
                  ].filter((row) => row.verdict).map((row, i) => {
                    const v = row.verdict!;
                    const color = v.applicable === 'full' ? '#0a7c2f'
                      : v.applicable === 'partial' ? '#a36b00'
                      : '#888';
                    const bg = v.applicable === 'full' ? '#e6f3ea'
                      : v.applicable === 'partial' ? '#faf2e0'
                      : '#f0f0f0';
                    const labelText = v.applicable === 'full' ? 'Activé'
                      : v.applicable === 'partial' ? 'Partiel'
                      : 'Non applicable';
                    return (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: '0.9rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color,
                            backgroundColor: bg,
                            padding: '3px 8px',
                            borderRadius: 3,
                            flexShrink: 0,
                            minWidth: 90,
                            textAlign: 'center',
                          }}
                        >
                          {labelText}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, color: '#1a1a1a' }}>{row.label}</div>
                          <div style={{ color: '#555', fontSize: '0.85rem', marginTop: 2 }}>{v.rationale}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 14, fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>
                Lecture. Le polymorphisme évite d&apos;imposer un cadre d&apos;analyse SaaS générique aux dossiers dont le modèle économique relève d&apos;une autre nature (fabrication unitaire, projet long, services réglementés). Les moteurs marqués non applicable n&apos;ont pas tourné sur ce dossier ; les moteurs partiels ont scopé leur réponse aux composantes pertinentes du dossier.
              </div>
            </div>
          )}

          {/* BLOC 1.7 : FOURCHETTE DE VALORISATION
              Resultat du moteur valuation-engine (calcul deterministe).
              Affiche la fourchette pre-money plausible, le detail des
              methodes utilisees (multiples sectoriels, VC method, Berkus,
              Scorecard), l analyse de dilution sur le ticket propose, et
              les warnings methodologiques. Si aucune methode n est
              applicable (cas extreme : dossier sans BP, sans secteur
              identifie, sans ticket), la section explique pourquoi. */}
          {valuation && (
            <div className="verdict-block" style={{ marginTop: 14 }}>
              <div className="verdict-block-head">
                <span className="verdict-block-num" aria-hidden="true">1.7</span>
                <span className="verdict-block-title">Fourchette de valorisation</span>
                {valuation.recommendedRange && (
                  <span className="verdict-block-figure" style={{ fontSize: 22 }}>
                    {formatEurShort(valuation.recommendedRange.central)}
                  </span>
                )}
              </div>

              {/* Synthese editoriale */}
              <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 14, color: 'var(--ink-soft)' }}>
                {valuation.synthesis}
              </div>

              {/* Barre visuelle de la fourchette */}
              {valuation.recommendedRange && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginBottom: 4,
                    fontFamily: 'var(--sans)',
                  }}>
                    <span>Plancher</span>
                    <span>Central</span>
                    <span>Plafond</span>
                  </div>
                  <div style={{
                    position: 'relative',
                    height: 36,
                    background: 'var(--ocre-brule-soft)',
                    borderLeft: '2px solid var(--ocre-brule)',
                    borderRight: '2px solid var(--ocre-brule)',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: 'var(--ocre-brule)',
                      transform: 'translateX(-50%)',
                    }} />
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                    fontFamily: 'var(--serif)',
                    fontWeight: 500,
                    marginTop: 4,
                  }}>
                    <span>{formatEurShort(valuation.recommendedRange.min)}</span>
                    <span style={{ color: 'var(--ocre-brule)' }}>{formatEurShort(valuation.recommendedRange.central)}</span>
                    <span>{formatEurShort(valuation.recommendedRange.max)}</span>
                  </div>
                </div>
              )}

              {/* Analyse de dilution */}
              {valuation.dilutionAnalysis && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--surface-soft)',
                  borderLeft: '2px solid var(--accent)',
                  marginBottom: 14,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                }}>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    marginBottom: 4,
                  }}>
                    Analyse de dilution sur ticket {formatEurShort(valuation.dilutionAnalysis.proposedTicket)}
                  </div>
                  <div>
                    Sur valo basse {formatEurShort(valuation.recommendedRange?.min || 0)} : <strong>{valuation.dilutionAnalysis.dilutionAtMin}%</strong>.{' '}
                    Sur valo centrale {formatEurShort(valuation.recommendedRange?.central || 0)} : <strong>{valuation.dilutionAnalysis.dilutionAtCentral}%</strong>.{' '}
                    Sur valo haute {formatEurShort(valuation.recommendedRange?.max || 0)} : <strong>{valuation.dilutionAnalysis.dilutionAtMax}%</strong>.
                  </div>
                </div>
              )}

              {/* Detail des methodes appliquees */}
              <div style={{ marginTop: 8 }}>
                <div style={{
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  marginBottom: 6,
                }}>
                  Méthodes appliquées
                </div>
                {valuation.methods.map((m: any, i: number) => (
                  <div key={m.method} style={{
                    paddingLeft: 12,
                    borderLeft: m.applicable ? '2px solid var(--ocre-brule)' : '2px dashed var(--hairline)',
                    marginBottom: 8,
                    opacity: m.applicable ? 1 : 0.55,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500 }}>{m.label}</span>
                      {m.applicable && m.range && (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {formatEurShort(m.range.min)} <span style={{ opacity: 0.5 }}>·</span> <strong style={{ color: 'var(--ocre-brule)' }}>{formatEurShort(m.range.central)}</strong> <span style={{ opacity: 0.5 }}>·</span> {formatEurShort(m.range.max)}
                        </span>
                      )}
                    </div>
                    {m.applicable && m.rationale && (
                      <div style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--ink-soft)', marginTop: 2 }}>
                        {m.rationale}
                      </div>
                    )}
                    {!m.applicable && m.notApplicableReason && (
                      <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>
                        {m.notApplicableReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Warnings methodologiques */}
              {valuation.warnings && valuation.warnings.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'var(--ocre-brule)',
                    marginBottom: 4,
                  }}>
                    Avertissements
                  </div>
                  <ul style={{ paddingLeft: 16, fontSize: 11.5, lineHeight: 1.55, margin: 0, color: 'var(--ink-soft)' }}>
                    {valuation.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="verdict-block-legend" style={{ marginTop: 12 }}>
                Sources de benchmarks utilisées : {valuation.benchmarkSources.join(', ')}. Les fourchettes sont indicatives, calibrées sur les transactions européennes 2023-2025. Le pricing réel dépend de signaux qualitatifs non chiffrables (founder-market fit, momentum compétitif, contexte du tour).
              </div>
            </div>
          )}

          {/* BLOC 1.8 : INDICATEURS DEAL TYPE
              Sept indicateurs canoniques (Burn multiple, Rule of 40, NDR,
              Magic Number, Payback CAC, Marge brute, Revenue par employe)
              calcules deterministiquement a partir de financialData et
              confrontes aux benchmarks sectoriels par stade. Chaque
              indicateur a un verdict (best-in-class, sain, a-surveiller,
              rouge, non-applicable) et un score global d execution
              operationnelle 0-100. */}
          {indicators && (
            <div className="verdict-block" style={{ marginTop: 14 }}>
              <div className="verdict-block-head">
                <span className="verdict-block-num" aria-hidden="true">1.8</span>
                <span className="verdict-block-title">Indicateurs deal type</span>
                {indicators.indicators.filter((i: any) => i.verdict !== 'non-applicable').length >= 3 ? (
                  <span className="verdict-block-figure" style={{ fontSize: 22 }}>
                    {indicators.globalIndicatorScore}
                    <span style={{ fontSize: 13, opacity: 0.6 }}>/100</span>
                  </span>
                ) : (
                  <span className="verdict-block-figure" style={{ fontSize: 14, opacity: 0.6, fontFamily: 'var(--sans)' }}>
                    {indicators.indicators.filter((i: any) => i.verdict !== 'non-applicable').length}/7 calculables
                  </span>
                )}
              </div>

              {/* Synthese editoriale */}
              <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 14, color: 'var(--ink-soft)' }}>
                {indicators.synthesis}
              </div>

              {/* Tableau des indicateurs applicables */}
              {indicators.indicators.filter((i: any) => i.verdict !== 'non-applicable').length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    marginBottom: 8,
                  }}>
                    Indicateurs calculés
                  </div>
                  {indicators.indicators
                    .filter((i: any) => i.verdict !== 'non-applicable')
                    .map((ind: any) => {
                      const verdictColor =
                        ind.verdict === 'best-in-class' ? '#1e7a3d' :
                        ind.verdict === 'sain' ? '#3a7a4a' :
                        ind.verdict === 'a-surveiller' ? 'var(--ocre-brule)' :
                        ind.verdict === 'rouge' ? '#a73d2c' : 'var(--muted)';
                      const verdictLabel =
                        ind.verdict === 'best-in-class' ? 'best-in-class' :
                        ind.verdict === 'sain' ? 'sain' :
                        ind.verdict === 'a-surveiller' ? 'à surveiller' :
                        ind.verdict === 'rouge' ? 'rouge' : '';
                      return (
                        <div key={ind.key} style={{
                          paddingLeft: 12,
                          borderLeft: `3px solid ${verdictColor}`,
                          marginBottom: 8,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500 }}>{ind.label}</span>
                            <span style={{ fontSize: 12, fontFamily: 'var(--sans)' }}>
                              <strong style={{ color: verdictColor, fontSize: 14 }}>
                                {ind.value != null ? `${ind.value}` : 'n/a'}
                              </strong>
                              <span style={{ opacity: 0.7, marginLeft: 4 }}>{ind.unit}</span>
                              <span style={{
                                marginLeft: 12,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                fontSize: 10,
                                color: verdictColor,
                                fontWeight: 600,
                              }}>{verdictLabel}</span>
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                            {ind.rationale}
                          </div>
                          {ind.benchmark && (
                            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--sans)' }}>
                              Benchmark : best {ind.benchmark.direction === 'higher-is-better' ? '≥' : '≤'} {ind.benchmark.best}{ind.unit} · sain {ind.benchmark.direction === 'higher-is-better' ? '≥' : '≤'} {ind.benchmark.sain}{ind.unit} · à surveiller {ind.benchmark.direction === 'higher-is-better' ? '≥' : '≤'} {ind.benchmark.surveille}{ind.unit}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Indicateurs non applicables, regroupes en bas */}
              {indicators.indicators.filter((i: any) => i.verdict === 'non-applicable').length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    marginBottom: 6,
                  }}>
                    Non applicables ou non extractibles
                  </div>
                  {indicators.indicators
                    .filter((i: any) => i.verdict === 'non-applicable')
                    .map((ind: any) => (
                      <div key={ind.key} style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)', marginBottom: 4 }}>
                        <strong style={{ fontFamily: 'var(--serif)', color: 'var(--ink-soft)' }}>{ind.label} :</strong> {ind.rationale}
                      </div>
                    ))}
                </div>
              )}

              {/* Warnings */}
              {indicators.warnings && indicators.warnings.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'var(--ocre-brule)',
                    marginBottom: 4,
                  }}>
                    Avertissements
                  </div>
                  <ul style={{ paddingLeft: 16, fontSize: 11.5, lineHeight: 1.55, margin: 0, color: 'var(--ink-soft)' }}>
                    {indicators.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="verdict-block-legend" style={{ marginTop: 12 }}>
                Sources des benchmarks : OpenView SaaS Benchmarks 2024, Bessemer State of the Cloud 2024, Pavilion B2B SaaS Benchmarks 2024, ChartMogul Churn Benchmarks 2024, David Sacks Burn Multiple 2020. Calibration européenne 2024-2025. Indicateurs déterministes calculés à partir du BP, sans appel LLM.
              </div>
            </div>
          )}

          {/* BLOC 2 : PROBABILITE DE SUCCES
              Distincte du score : reflète la confiance dans la these face
              aux signaux contradictoires (blindspots vs contrariens). Le
              partner doit comprendre que ces deux chiffres ne mesurent
              pas la meme chose. Mini-barre succes/echec en bicolore. */}
          {typeof reco.successProbability === 'number' && (
            <div className="verdict-block">
              <div className="verdict-block-head">
                <span className="verdict-block-num" aria-hidden="true">2</span>
                <span className="verdict-block-title">Probabilité de succès</span>
                <span className="verdict-block-figure">
                  {reco.successProbability}
                  <span style={{ fontSize: 14, opacity: 0.45, fontWeight: 400, marginLeft: 2 }}>%</span>
                </span>
              </div>
              <div className="success-failure-bar">
                <div className="sf-success" style={{ width: `${reco.successProbability}%` }}>
                  <span>{reco.successProbability}% succès</span>
                </div>
                <div className="sf-failure" style={{ width: `${100 - reco.successProbability}%` }}>
                  <span>{100 - reco.successProbability}% échec</span>
                </div>
              </div>
              <div className="verdict-block-legend">
                Estimation bayésienne de retour positif sur l&apos;investissement. Distincte du score : intègre l&apos;incertitude résiduelle face aux signaux contradictoires (blindspots versus contrariens). Plus pessimiste que le score quand la dialectique reste non tranchée.
              </div>
            </div>
          )}

          {/* LECTURE - Synthèse narrative qui relie les deux chiffres et
              indique la suite logique (DD approfondie, refus, etc.).
              Texte adapté selon le verdict. */}
          <div className="verdict-reading">
            <div className="verdict-reading-label">Lecture</div>
            <div className="verdict-reading-text">
              {reco.verdict === 'investir' && (
                <>L&apos;instruction conclut à un go franc. Le passage en DD approfondie sert à confirmer les hypothèses structurantes et formaliser les conditions de la term sheet.</>
              )}
              {reco.verdict === 'investir avec conditions' && (
                <>L&apos;instruction conclut à un go conditionné. Les conditions clés énumérées plus loin doivent être vérifiées ou négociées lors de la DD approfondie avant signature.</>
              )}
              {reco.verdict === 'approfondir' && (
                <>L&apos;instruction Bloc 1 ne tranche pas. Le score positionne le dossier en zone d&apos;instruction approfondie ; la probabilité de succès signale que les signaux contradictoires ne sont pas levés. La DD Bloc 2 (data room) doit cristalliser l&apos;arbitrage.</>
              )}
              {reco.verdict === 'refuser' && (
                <>L&apos;instruction conclut au refus. Les drapeaux rouges structurels ne sont pas compensés par les signaux contrariens. Pas de DD approfondie justifiée à ce stade.</>
              )}
            </div>
          </div>
        </div>

        {/* Argumentation reco - prose dense decoupee en paragraphes
            courts (3 phrases) avec chiffres-cles mis en valeur. */}
        <div style={{ marginTop: 18 }}>
          {splitIntoParagraphs(reco.argumentation, 3).map((p, i) => (
            <p key={i} className="note-paragraph">{enrichProse(p)}</p>
          ))}
        </div>

        {/* Pull quote 1 : extrait de l'argumentation du verdict, mis en
            exergue comme dans un article FT. Utilise la première phrase si
            assez impactante, sinon la résolution dialectique. */}
        {reco.argumentation && firstSentence(reco.argumentation, 200).length > 50 && (
          <blockquote className="pull-quote">
            <span className="pull-quote-mark" aria-hidden="true">«</span>
            {firstSentence(reco.argumentation, 200)}
            <span className="pull-quote-mark" aria-hidden="true">»</span>
          </blockquote>
        )}

        {/* Sous-section The case for : ce qui rend ce dossier potentiellement
            exceptionnel. Consomme syntheseSingularite + signaux contrariens
            haute force + comparables contrariens. C est le cote 'thesis' du
            memo IC dialectique. */}
        {(ca?.syntheseSingularite || (ca?.signals && Object.values(ca.signals).some((s: any) => s?.detected && s.strength >= 60))) && (
          <>
            <h3 className="note-h3" id="engine-section-contrarian">Plaidoyer en faveur</h3>
            {ca.syntheseSingularite && (
              <>{splitIntoParagraphs(ca.syntheseSingularite, 3).map((p, i) => (
                <p key={i} className="note-paragraph">{enrichProse(p)}</p>
              ))}</>
            )}
            {ca.signals && Object.values(ca.signals).filter((s: any) => s?.detected && s.strength >= 60).length > 0 && (
              <>
                <h4 className="note-h4">Signaux contrariens identifiés</h4>
                <ul className="risk-list">
                  {Object.values(ca.signals)
                    .filter((s: any) => s?.detected && s.strength >= 60)
                    .map((s: any, i: number) => (
                      <li key={i}>
                        <span className="signal-score-pill signal-score-contrarian">{s.strength}</span>
                        <strong>{s.signalName}.</strong> {s.evidence}
                      </li>
                    ))}
                </ul>
              </>
            )}
            {ca.comparablesContrariens?.length > 0 && (
              <>
                <h4 className="note-h4">Comparables contrariens</h4>
                <p className="comparable-scope-note">
                  Comparables retenus pour la similarité d&apos;asset class avec le dossier en cours (nature business, modèle économique, intensité capitalistique). Si aucune analogie sectorielle directe n&apos;est trouvée dans le corpus, le moteur le signale dans la recommandation plutôt que de forcer une comparaison.
                </p>
                {ca.comparablesContrariens.map((c: any, i: number) => {
                  const acm = c.assetClassMatch;
                  const alignmentLabel = acm?.alignment === 'high' ? 'Asset class : alignement fort'
                    : acm?.alignment === 'medium' ? 'Asset class : alignement partiel'
                    : acm?.alignment === 'low' ? 'Asset class : alignement faible'
                    : null;
                  return (
                    <div key={i} className="benchmark-block">
                      <div className="benchmark-header">
                        <span className="benchmark-name">{c.name}</span>
                        <span className="benchmark-geo">{c.outcome} {c.multipleAtExit && `· ${c.multipleAtExit}`}</span>
                      </div>
                      {c.sectorContext && (
                        <div className="benchmark-sector">{c.sectorContext}</div>
                      )}
                      {alignmentLabel && (
                        <div className={`asset-class-tag asset-class-${acm.alignment}`}>
                          {alignmentLabel}{acm.rationale ? ` · ${acm.rationale}` : ''}
                        </div>
                      )}
                      <div className="benchmark-bet"><strong>Consensus initial :</strong> {c.initialConsensus}</div>
                      <div className="benchmark-relevance"><strong>Pari contrarien :</strong> {c.contrarianBet}</div>
                    </div>
                  );
                })}
              </>
            )}
            {ca.recommandationContrarienne && (
              <blockquote className="pull-quote pull-quote-contrarian">
                <span className="pull-quote-mark" aria-hidden="true">«</span>
                {ca.recommandationContrarienne}
                <span className="pull-quote-mark" aria-hidden="true">»</span>
                <cite className="pull-quote-cite">Recommandation contrarienne</cite>
              </blockquote>
            )}
          </>
        )}

        {/* Sous-section The case against : ce qui menace structurellement la
            these. Consomme syntheseAveuglement + patterns haute intensite +
            patterns historiques (Theranos, Ynsect, etc.) + alertes critiques. */}
        {(ba?.syntheseAveuglement || (ba?.patterns && Object.values(ba.patterns).some((p: any) => p?.detected && p.intensity >= 60))) && (
          <>
            <h3 className="note-h3" id="engine-section-blindspot">Plaidoyer contre</h3>
            {ba.syntheseAveuglement && (
              <>{splitIntoParagraphs(ba.syntheseAveuglement, 3).map((p, i) => (
                <p key={i} className="note-paragraph">{enrichProse(p)}</p>
              ))}</>
            )}

            {/* Pull quote 3 : si un pattern historique converge fortement
                (similarité >= 70%), on l'extrait en exergue. C'est le moment
                où l'analyse compare le dossier à un échec célèbre. */}
            {ba.patternsHistoriques?.length > 0 && (() => {
              const topPattern = [...(ba.patternsHistoriques || [])].sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0))[0];
              if (topPattern && topPattern.similarity >= 70) {
                return (
                  <blockquote className="pull-quote pull-quote-blindspot">
                    <span className="pull-quote-mark" aria-hidden="true">«</span>
                    Ce dossier reproduit le pattern <strong>{topPattern.case}</strong> ({topPattern.outcome}) avec une proximité structurelle de {topPattern.similarity}%.
                    <span className="pull-quote-mark" aria-hidden="true">»</span>
                    {topPattern.lessonLearned && (
                      <cite className="pull-quote-cite">{topPattern.lessonLearned}</cite>
                    )}
                  </blockquote>
                );
              }
              return null;
            })()}
            {ba.patterns && Object.values(ba.patterns).filter((p: any) => p?.detected && p.intensity >= 60).length > 0 && (
              <>
                <h4 className="note-h4">Patterns à risque détectés</h4>
                <ul className="risk-list">
                  {Object.values(ba.patterns)
                    .filter((p: any) => p?.detected && p.intensity >= 60)
                    .map((p: any, i: number) => (
                      <li key={i}>
                        <span className="signal-score-pill signal-score-blindspot">{p.intensity}</span>
                        <strong>{p.patternName}.</strong> {p.evidence}
                      </li>
                    ))}
                </ul>
              </>
            )}
            {ba.patternsHistoriques?.length > 0 && (
              <>
                <h4 className="note-h4">Patterns historiques convergents</h4>
                <ul className="risk-list">
                  {ba.patternsHistoriques.map((p: any, i: number) => (
                    <li key={i}>
                      <span className="signal-score-pill signal-score-blindspot">{p.similarity}</span>
                      <strong>{p.case}.</strong> {p.outcome}
                      {p.lessonLearned && <>. {p.lessonLearned}</>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {ba.alertesCritiques?.length > 0 && (
              <div className="alert-box">
                <strong>Alertes critiques :</strong>
                <ul>{ba.alertesCritiques.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
          </>
        )}

        {/* Sous-section Dialectical resolution : qui l emporte entre signaux
            d aveuglement et singularites contrariennes, et pourquoi. C est
            le moment central du raisonnement IC. */}
        {reco.blindspotsVsContrarian?.resolution && (
          <>
            <h3 className="note-h3" id="engine-section-orchestrate-resolution">Résolution dialectique</h3>
            <div className="verdict-box" style={{ marginBottom: 12 }}>
              <div className="verdict-line">
                <span className="verdict-label">Poids de la vigilance</span>
                <span className="verdict-value">{reco.blindspotsVsContrarian.blindspotsWeight}/100</span>
              </div>
              <div className="verdict-line">
                <span className="verdict-label">Poids contrarien</span>
                <span className="verdict-value">{reco.blindspotsVsContrarian.contrarianWeight}/100</span>
              </div>
              <div className="verdict-line">
                <span className="verdict-label">Tension résolue</span>
                <span className="verdict-value">{reco.blindspotsVsContrarian.tensionResolved}</span>
              </div>
            </div>
            {splitIntoParagraphs(reco.blindspotsVsContrarian.resolution, 3).map((p, i) => (
              <p key={i} className="note-paragraph">{enrichProse(p)}</p>
            ))}
          </>
        )}

        {/* Sous-section Lecture du langage : moteur transversal de derive
            narrative. Mesure le glissement concret/abstrait du discours.
            Le bloc s affiche systematiquement des qu un verdict de matrice
            existe (meme non-applicable, pour la transparence du
            perimetre d analyse). En sain, le ton est rassurant ; en
            drapeau-rouge, l encart sert d alerte avant la cartographie
            des risques. */}
        {(nd || ndVerdict) && (
          <>
            <h3 className="note-h3" id="engine-section-narrative-drift">Lecture du langage</h3>

            {/* Cas 1 : matrice declare none (pas de corpus exploitable
                ou stade trop precoce sans corpus minimal). On affiche
                un encart court qui explique pourquoi. */}
            {!nd && ndVerdict && ndVerdict.applicable === 'none' && (
              <p className="note-paragraph" style={{ opacity: 0.75 }}>
                <em>Non applicable.</em> {ndVerdict.rationale}
              </p>
            )}

            {/* Cas 2 : moteur lance mais pas de payload (echec LLM
                non-bloquant cote pipeline). Transparence pour le
                partner : on dit que la lecture n a pas pu etre produite. */}
            {!nd && ndVerdict && ndVerdict.applicable !== 'none' && (
              <p className="note-paragraph" style={{ opacity: 0.75 }}>
                Lecture du langage indisponible pour ce dossier (incident transitoire). La matrice de pertinence avait pourtant retenu le moteur : {ndVerdict.rationale.toLowerCase()}
              </p>
            )}

            {/* Cas 3 : le moteur a produit son analyse. On la rend dans
                l ordre de lecture editoriale : verdict global, puis les
                trois axes argumentes, puis le counter-archetype, puis la
                recommandation DD. */}
            {nd && (
              <>
                {/* Bandeau verdict global. Tonalites alignees sur l encre
                    ocre Prelude, pas de SaaS, pas d emoji. */}
                {(() => {
                  const verdictColor: Record<string, { bg: string; ink: string; label: string }> = {
                    'sain': { bg: '#f1ead8', ink: '#3f4a2b', label: 'Sain' },
                    'attention': { bg: '#ede2c8', ink: '#7a5a1d', label: 'Attention' },
                    'alerte': { bg: '#e8d4b1', ink: '#8a4a17', label: 'Alerte' },
                    'drapeau-rouge': { bg: '#dcc3a3', ink: '#7a2916', label: 'Drapeau rouge' },
                  };
                  const v = verdictColor[nd.verdict] || verdictColor['attention'];
                  return (
                    <div className="verdict-box" style={{ marginBottom: 12, background: v.bg, borderColor: v.ink + '33' }}>
                      <div className="verdict-line">
                        <span className="verdict-label">Verdict global</span>
                        <span className="verdict-value" style={{ color: v.ink, fontWeight: 600 }}>{v.label}</span>
                      </div>
                      <div className="verdict-line">
                        <span className="verdict-label">Score de dérive</span>
                        <span className="verdict-value" style={{ color: v.ink, fontWeight: 600 }}>{nd.globalDriftScore}/100</span>
                      </div>
                      <div className="verdict-line">
                        <span className="verdict-label">Champ d&apos;application</span>
                        <span className="verdict-value">{nd.applicabilite === 'full' ? 'Complet' : nd.applicabilite === 'partial' ? 'Partiel' : nd.applicabilite === 'weak-signal' ? 'Signal faible' : '—'}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Phrase de cadrage : rationale de l applicabilite, dit
                    au partner d ou le moteur tire ses conclusions. */}
                <p className="note-paragraph" style={{ fontStyle: 'italic', opacity: 0.85 }}>
                  {nd.applicabiliteRationale}
                </p>

                {/* Tableau des metriques lexicales objectives : ces
                    chiffres sont calcules mecaniquement par la taxonomie,
                    pas par le LLM. Ils servent d ancrage anti-hallucination. */}
                <table className="note-table" style={{ marginTop: 8, marginBottom: 12 }}>
                  <tbody>
                    <tr>
                      <td className="note-label">Densité concrète</td>
                      <td className="note-value">{nd.metriquesLexicales.densiteConcrete.toFixed(1)} mots/1000 <span style={{ opacity: 0.55, fontSize: 11 }}>(sain ≥ 30, alerte &lt; 15)</span></td>
                    </tr>
                    <tr>
                      <td className="note-label">Ratio abstrait/concret</td>
                      <td className="note-value">{nd.metriquesLexicales.ratioAbstraitConcret.toFixed(2)} <span style={{ opacity: 0.55, fontSize: 11 }}>(sain &lt; 0,3, drapeau rouge &gt; 2)</span></td>
                    </tr>
                    <tr>
                      <td className="note-label">Score d&apos;opacité</td>
                      <td className="note-value">{nd.metriquesLexicales.opaciteScore.toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td className="note-label">Corpus analysé</td>
                      <td className="note-value">{nd.metriquesLexicales.totalWordsAnalyses} mots</td>
                    </tr>
                    {nd.metriquesLexicales.topAbstractWords?.length > 0 && (
                      <tr>
                        <td className="note-label">Top abstraits</td>
                        <td className="note-value">{nd.metriquesLexicales.topAbstractWords.slice(0, 5).map((w: any) => `${w.word} (${w.count}x)`).join(', ')}</td>
                      </tr>
                    )}
                    {nd.metriquesLexicales.topConcreteWords?.length > 0 && (
                      <tr>
                        <td className="note-label">Top concrets</td>
                        <td className="note-value">{nd.metriquesLexicales.topConcreteWords.slice(0, 5).map((w: any) => `${w.word} (${w.count}x)`).join(', ')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Trois axes : glissement indicateurs, opacite progressive,
                    narrative premium collapse. Chacun avec son verdict
                    propre, son rationale et la symetrie evidence pro/contra. */}
                {([
                  { key: 'glissementIndicateurs', label: 'Glissement des indicateurs', data: nd.glissementIndicateurs },
                  { key: 'opaciteProgressive', label: 'Opacité progressive', data: nd.opaciteProgressive },
                  { key: 'narrativePremiumCollapse', label: 'Décalage récit / fondamentaux', data: nd.narrativePremiumCollapse },
                ] as const).map((axis) => {
                  const a = axis.data;
                  if (!a || a.verdict === 'non-applicable') {
                    return (
                      <div key={axis.key} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: '2px solid rgba(168, 116, 58, 0.2)' }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{axis.label}</div>
                        <div style={{ opacity: 0.6, fontSize: 13, marginTop: 4 }}>Non applicable sur ce dossier (corpus ou baseline insuffisant).</div>
                      </div>
                    );
                  }
                  const verdictTone: Record<string, string> = {
                    'sain': '#3f4a2b',
                    'attention': '#7a5a1d',
                    'alerte': '#8a4a17',
                    'drapeau-rouge': '#7a2916',
                  };
                  const tone = verdictTone[a.verdict] || '#3f4a2b';
                  return (
                    <div key={axis.key} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: `2px solid ${tone}55` }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{axis.label}</div>
                        <div style={{ fontSize: 12, color: tone, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{a.verdict.replace('-', ' ')}</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>{a.score}/100 · confiance {a.confidence}/100</div>
                      </div>
                      <p className="note-paragraph" style={{ marginTop: 6, marginBottom: 6 }}>{enrichProse(a.rationale)}</p>
                      {a.evidencePro?.length > 0 && (
                        <div style={{ fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500, color: tone }}>À charge : </span>
                          <span>{a.evidencePro.join(' ')}</span>
                        </div>
                      )}
                      {a.evidenceContra?.length > 0 && (
                        <div style={{ fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500, opacity: 0.75 }}>Au contraire : </span>
                          <span style={{ opacity: 0.85 }}>{a.evidenceContra.join(' ')}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Counter-archetype : nom de la boite la plus proche
                    par profil narratif. Sert au partner pour situer le
                    dossier dans une trajectoire historique. */}
                {nd.counterArchetype?.closest && nd.counterArchetype.closest !== 'non determine' && (
                  <p className="note-paragraph" style={{ marginTop: 8 }}>
                    <strong>Archétype de pattern le plus proche :</strong> {nd.counterArchetype.closest}
                    {nd.counterArchetype.direction === 'derive-confirmee' ? ' (trajectoire de dérive confirmée)' : ' (trajectoire saine)'}
                    {nd.counterArchetype.rationale ? '. ' + nd.counterArchetype.rationale : '.'}
                  </p>
                )}

                {/* Trajectoire si baseline anterieur : delta entre la
                    derniere analyse et celle-ci. Utile pour la
                    re-evaluation periodique. */}
                {nd.trajectory && (
                  <p className="note-paragraph">
                    <strong>Trajectoire :</strong> {nd.trajectory.interpretation}. {nd.trajectory.rationale}
                  </p>
                )}

                {/* Recommandation DD : ce que le partner doit aller
                    chercher en priorite pour confirmer ou infirmer la
                    lecture du langage. */}
                {nd.recommandationDD && (
                  <p className="note-paragraph" style={{ marginTop: 8, padding: 10, background: 'rgba(168, 116, 58, 0.06)', borderLeft: '2px solid rgba(168, 116, 58, 0.4)' }}>
                    <strong>À investiguer :</strong> {nd.recommandationDD}
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* Sous-section Macro context : cadrage du marche dans lequel le dossier
            s inscrit. */}
        {(macro?.cyclePosition || macro?.structuralTrends?.length > 0 || macro?.regulatoryEnvironment) && (
          <>
            <h3 className="note-h3" id="engine-section-macro">Contexte macro</h3>
            <table className="note-table">
              <tbody>
                {macro.cyclePosition && (
                  <tr>
                    <td className="note-label">Cycle position</td>
                    <td className="note-value">{macro.cyclePosition}</td>
                  </tr>
                )}
                {macro.vcCapitalOnSegment && (
                  <tr>
                    <td className="note-label">VC capital on segment</td>
                    <td className="note-value">{macro.vcCapitalOnSegment}</td>
                  </tr>
                )}
                {macro.criticalTimingWindow?.exists && (
                  <tr>
                    <td className="note-label">Critical timing window</td>
                    <td className="note-value">{macro.criticalTimingWindow.horizon || ''} · {macro.criticalTimingWindow.rationale || ''}</td>
                  </tr>
                )}
                {typeof macro.contraryclicalOpportunity?.score === 'number' && (
                  <tr>
                    <td className="note-label">Contracyclical opportunity</td>
                    <td className="note-value">{macro.contraryclicalOpportunity.score}/100 · {macro.contraryclicalOpportunity.rationale || ''}</td>
                  </tr>
                )}
                {macro.geopolitics && (
                  <tr>
                    <td className="note-label">Geopolitics</td>
                    <td className="note-value">{macro.geopolitics}</td>
                  </tr>
                )}
                {macro.interestRateRegime && (
                  <tr>
                    <td className="note-label">Interest rate regime</td>
                    <td className="note-value">{macro.interestRateRegime}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {macro.structuralTrends?.length > 0 && (
              <>
                <h4 className="note-h4">Tendances structurelles</h4>
                <ul className="risk-list">
                  {(macro.structuralTrends || []).map((t: string, i: number) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </>
            )}
            {macro.regulatoryEnvironment && (
              <>
                <h4 className="note-h4">Environnement réglementaire</h4>
                {splitIntoParagraphs(macro.regulatoryEnvironment, 3).map((p, i) => (
                  <p key={i} className="note-paragraph">{enrichProse(p)}</p>
                ))}
              </>
            )}
          </>
        )}

        {ba?.riskMap && (
          <>
            <h3 className="note-h3" id="engine-section-blindspot-risks">Cartographie des risques</h3>
            <h4 className="note-h4">Risques stratégiques</h4>
            {(ba.riskMap.strategicRisks || []).length === 0 ? <p className="note-paragraph muted">Aucun risque stratégique identifié.</p> : (
              <ul className="risk-list">
                {(ba.riskMap.strategicRisks || []).map((r: any, i: number) => (
                  <li key={i}>
                    <span className={`risk-sev sev-${r.severity}`}>{r.severity}</span>
                    <strong>{r.title}.</strong> {r.description}
                  </li>
                ))}
              </ul>
            )}
            <h4 className="note-h4">Risques opérationnels</h4>
            {(ba.riskMap.operationalRisks || []).length === 0 ? <p className="note-paragraph muted">Aucun risque opérationnel identifié.</p> : (
              <ul className="risk-list">
                {(ba.riskMap.operationalRisks || []).map((r: any, i: number) => (
                  <li key={i}>
                    <span className={`risk-sev sev-${r.severity}`}>{r.severity}</span>
                    <strong>{r.title}.</strong> {r.description}
                  </li>
                ))}
              </ul>
            )}
            <h4 className="note-h4">Risques financiers</h4>
            {(ba.riskMap.financialRisks || []).length === 0 ? <p className="note-paragraph muted">Aucun risque financier identifié.</p> : (
              <ul className="risk-list">
                {(ba.riskMap.financialRisks || []).map((r: any, i: number) => (
                  <li key={i}>
                    <span className={`risk-sev sev-${r.severity}`}>{r.severity}</span>
                    <strong>{r.title}.</strong> {r.description}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* Sous-section Lecture de la fragilite structurelle : moteur
            Bloc Phase 4 qui agrege les sept patterns (croissance
            subventionnee, captivite infrastructure, couts fixes
            incompressibles, risque reglementaire date, erosion de
            defensibilite, fragilite cap table, industrialisation
            prematuree). Placement doctrinal : juste apres la
            cartographie des risques operationnels et financiers. La
            cartographie expose les risques visibles, la lecture
            Fragilite Structurelle expose les risques structurels
            latents que la cartographie ne capture pas par construction. */}
        {(fs || fsVerdicts) && (
          <>
            <h3 className="note-h3" id="engine-section-fragility-structurelle">Lecture de la fragilité structurelle</h3>

            {/* En-tete de trajectoire : si une analyse precedente
                existe, on affiche une ligne sobre qui resume la
                transition (verdict actuel vs precedent, ou delta de
                score si verdict maintenu). Le composant degrade
                silencieusement sans baseline. */}
            {trajectoryCtx.header && (
              <p
                className="note-paragraph"
                style={{
                  fontSize: 13,
                  fontStyle: 'italic',
                  opacity: 0.78,
                  marginTop: -4,
                  marginBottom: 12,
                  color: 'var(--ocre-brule, #8a4a17)',
                }}
              >
                {trajectoryCtx.header}
              </p>
            )}

            {/* Cas 1 : matrice declare tous patterns non applicables.
                Affichage sobre pour la transparence du perimetre. */}
            {!fs && fsVerdicts && Object.values(fsVerdicts).every((v: any) => v.applicable === 'none') && (
              <p className="note-paragraph" style={{ opacity: 0.75 }}>
                <em>Non applicable.</em> Aucun des sept patterns Phase 4 ne s&apos;applique à ce dossier selon la matrice de pertinence (stade et profil sectoriel hors-scope).
              </p>
            )}

            {/* Cas 2 : moteur lance mais payload null (echec global). */}
            {!fs && fsVerdicts && Object.values(fsVerdicts).some((v: any) => v.applicable !== 'none') && (
              <p className="note-paragraph" style={{ opacity: 0.75 }}>
                Lecture de fragilité structurelle indisponible pour ce dossier (incident transitoire). Au moins un pattern était pourtant retenu par la matrice. Relancer l&apos;analyse pour reproduire.
              </p>
            )}

            {/* Cas 3 : moteur a produit son agregation. */}
            {fs && (
              <>
                {/* Bandeau verdict global. Palette ocre alignee sur Lecture
                    du langage pour homogeneite visuelle. */}
                {(() => {
                  const verdictColor: Record<string, { bg: string; ink: string; label: string }> = {
                    'sain': { bg: '#f1ead8', ink: '#3f4a2b', label: 'Sain' },
                    'attention': { bg: '#ede2c8', ink: '#7a5a1d', label: 'Attention' },
                    'alerte': { bg: '#e8d4b1', ink: '#8a4a17', label: 'Alerte' },
                    'drapeau-rouge': { bg: '#dcc3a3', ink: '#7a2916', label: 'Drapeau rouge' },
                    'non-applicable': { bg: '#f5f0e3', ink: '#666', label: 'Non applicable' },
                  };
                  const v = verdictColor[fs.verdict] || verdictColor['attention'];
                  return (
                    <div className="verdict-box" style={{ marginBottom: 12, background: v.bg, borderColor: v.ink + '33' }}>
                      <div className="verdict-line">
                        <span className="verdict-label">Verdict global</span>
                        <span className="verdict-value" style={{ color: v.ink, fontWeight: 600 }}>{v.label}</span>
                      </div>
                      <div className="verdict-line">
                        <span className="verdict-label">Score de fragilité</span>
                        <span className="verdict-value" style={{ color: v.ink, fontWeight: 600 }}>{fs.globalFragilityScore}/100</span>
                      </div>
                      <div className="verdict-line">
                        <span className="verdict-label">Patterns actifs</span>
                        <span className="verdict-value">{Object.values(fs.patterns).filter((p: any) => p && p.applicabilite !== 'not-applicable').length} sur 7</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Resume editorial du moteur. Sert d entree de lecture. */}
                <p className="note-paragraph">{enrichProse(fs.resumeEditorial)}</p>

                {/* Convergences detectees : combinaisons cross-pattern
                    documentees (Trajectoire WeWork, Pattern Britishvolt,
                    Pattern Northvolt, Wrapper sans differenciation, etc.). */}
                {fs.combinaisons && fs.combinaisons.length > 0 && (
                  <div style={{ marginTop: 12, marginBottom: 14, padding: 14, borderLeft: '3px solid var(--ocre-brule, #8a4a17)', background: 'rgba(138, 74, 23, 0.06)' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8, color: 'var(--ocre-brule, #8a4a17)', fontWeight: 600 }}>
                      Convergences détectées
                    </div>
                    {fs.combinaisons.map((comb: any, i: number) => (
                      <div key={i} style={{ marginBottom: i < fs.combinaisons.length - 1 ? 10 : 0 }}>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                          {comb.nom}
                          <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7, fontWeight: 400, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {comb.severite.replace('-', ' ')}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, lineHeight: 1.55, margin: 0, opacity: 0.9 }}>{comb.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Liste des sept patterns. Patterns avec score >= 35 en
                    carte detaillee, patterns sains en ligne courte,
                    patterns non applicables en mention discrete. */}
                <div style={{ marginTop: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 10 }}>Sept patterns Phase 4</div>
                  {(['growth-subsidized-model', 'infrastructure-hostage', 'fixed-cost-trap', 'regulatory-time-bomb', 'commoditization-drift', 'capital-structure-fragility', 'scale-mirage-risk'] as const).map((patternId) => {
                    const p = fs.patterns?.[patternId];
                    const labels: Record<string, string> = {
                      'growth-subsidized-model': 'Croissance subventionnée',
                      'infrastructure-hostage': 'Captivité infrastructure',
                      'fixed-cost-trap': 'Coûts fixes incompressibles',
                      'regulatory-time-bomb': 'Risque réglementaire daté',
                      'commoditization-drift': 'Érosion de défensibilité',
                      'capital-structure-fragility': 'Fragilité cap table',
                      'scale-mirage-risk': 'Industrialisation prématurée',
                    };
                    const label = labels[patternId] ?? patternId;

                    // Annotation trajectoire pour ce pattern. Null si pas de
                    // baseline ou pattern absent de la comparaison.
                    const annotation: PatternAnnotation | null = buildPatternDeltaAnnotation(
                      trajectoryCtx.comparison,
                      patternId as PatternId,
                    );

                    if (!p || p.applicabilite === 'not-applicable') {
                      // Cas newly-not-applicable : le pattern etait actif
                      // dans l analyse precedente et sort du perimetre. On
                      // surcharge la mention par defaut avec un texte
                      // contextuel.
                      if (annotation && annotation.kind === 'newly-not-applicable') {
                        return (
                          <div key={patternId} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13, opacity: 0.7 }}>
                            <span>{label}</span>
                            <span style={{ fontStyle: 'italic', color: 'var(--ocre-brule, #8a4a17)', fontSize: 12, maxWidth: '70%', textAlign: 'right' }}>{annotation.text}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={patternId} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13, opacity: 0.55 }}>
                          <span>{label}</span>
                          <span style={{ fontStyle: 'italic' }}>{p?.applicabiliteRationale?.slice(0, 80) || 'non applicable'}</span>
                        </div>
                      );
                    }

                    const verdictTone: Record<string, string> = {
                      'sain': '#3f4a2b',
                      'attention': '#7a5a1d',
                      'alerte': '#8a4a17',
                      'drapeau-rouge': '#7a2916',
                    };
                    const tone = verdictTone[p.verdict] || '#3f4a2b';

                    // Patterns avec score modere/eleve : carte detaillee
                    if (p.globalScore >= 35) {
                      return (
                        <div key={patternId} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: `2px solid ${tone}55` }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                            <div style={{ fontSize: 11, color: tone, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.verdict.replace('-', ' ')}</div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>{p.globalScore}/100</div>
                          </div>
                          {p.resumeEditorial && (
                            <p className="note-paragraph" style={{ marginTop: 6, marginBottom: 6 }}>{enrichProse(p.resumeEditorial)}</p>
                          )}
                          {p.counterArchetype?.closest && p.counterArchetype.closest !== 'non determine' && (
                            <div style={{ fontSize: 13, marginBottom: 4, opacity: 0.85 }}>
                              <span style={{ fontWeight: 500 }}>Archétype de pattern proche :</span> {p.counterArchetype.closest}
                              {p.counterArchetype.direction === 'derive-confirmee' ? ' (trajectoire de dérive confirmée)' : ' (trajectoire saine)'}
                            </div>
                          )}
                          {p.recommandationDD && (
                            <div style={{ fontSize: 13, opacity: 0.85, fontStyle: 'italic' }}>
                              {p.recommandationDD}
                            </div>
                          )}
                          {/* Annotation delta trajectoire. Discrete, en
                              gris ocre, sous la recommandation DD pour ne
                              pas concurrencer l information principale. */}
                          {annotation && (
                            <div style={{
                              fontSize: 11,
                              marginTop: 6,
                              opacity: 0.75,
                              color: annotation.kind === 'delta'
                                ? (annotation.direction === 'aggravation' ? '#8a4a17' : '#3f4a2b')
                                : '#8a4a17',
                              fontStyle: annotation.kind === 'delta' || annotation.kind === 'maintained' ? 'normal' : 'italic',
                            }}>
                              {annotation.text}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Patterns sains : ligne courte
                    return (
                      <div key={patternId} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13 }}>
                        <span>{label}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ color: tone, fontWeight: 500 }}>
                            {p.verdict.replace('-', ' ')} · {p.globalScore}/100
                          </span>
                          {annotation && (annotation.kind === 'delta' || annotation.kind === 'maintained') && (
                            <span style={{
                              fontSize: 11,
                              opacity: 0.7,
                              color: annotation.kind === 'delta' && annotation.direction === 'aggravation' ? '#8a4a17' : 'inherit',
                            }}>
                              {annotation.text}
                            </span>
                          )}
                          {annotation && annotation.kind === 'newly-applicable' && (
                            <span style={{ fontSize: 11, opacity: 0.75, color: '#8a4a17', fontStyle: 'italic' }}>
                              nouvellement actif
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Recommandations DD consolidees en encart final. */}
                {fs.recommandationsDD && fs.recommandationsDD.length > 0 && (
                  <div style={{ marginTop: 8, padding: 12, background: 'rgba(168, 116, 58, 0.06)', borderLeft: '2px solid rgba(168, 116, 58, 0.4)' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8, fontWeight: 600 }}>À investiguer en DD</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                      {fs.recommandationsDD.map((reco: string, i: number) => (
                        <li key={i} style={{ marginBottom: 4 }}>{reco}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {m?.competitiveMatrix?.dimensions?.length > 0 && (
          <>
            <h3 className="note-h3" id="engine-section-market-positioning">Positionnement concurrentiel</h3>
            <div className="matrix-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th></th>
                    {(m.competitiveMatrix.dimensions || []).map((d: string, i: number) => (
                      <th key={i} className="matrix-dim">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(m.competitiveMatrix.players || []).map((p: any, i: number) => (
                    <tr key={i} className={p.isTargetCompany ? 'target' : ''}>
                      <td className="matrix-player">{p.name}</td>
                      {(p.coverage || []).map((c: boolean, j: number) => (
                        <td key={j} className={c ? 'cov-yes' : 'cov-no'}>{c ? '√' : '×'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note-paragraph"><strong>Différenciation :</strong> {enrichProse(m.competitiveMatrix.differentiationRationale)}</p>
          </>
        )}

        {fc?.hasFinancialData && (
          <>
            <h3 className="note-h3" id="engine-section-financial-coherence">Examen financier</h3>
            {splitIntoParagraphs(fc.syntheseCoherence, 3).map((p, i) => (
              <p key={i} className="note-paragraph">{enrichProse(p)}</p>
            ))}
            {fc.alertesCritiques?.length > 0 && (
              <div className="alert-box">
                <strong>Alertes critiques :</strong>
                <ul>{(fc.alertesCritiques || []).map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
          </>
        )}


        {tcc?.triggered && (
          <>
            <h3 className="note-h3" id="engine-section-tech-claim">Cohérence de la revendication technologique</h3>
            {splitIntoParagraphs(tcc.synthesis, 3).map((p: string, i: number) => (
              <p key={i} className="note-paragraph">{enrichProse(p)}</p>
            ))}
            <div className="tech-claim-tests">
              <div className="tech-claim-row">
                <div className="tech-claim-test-name">Budget vs équipe</div>
                <div className={`tech-claim-test-score ${tcc.tests.budgetVsTeam.passed ? 'pass' : 'fail'}`}>
                  {tcc.tests.budgetVsTeam.score}/100
                </div>
                <div className="tech-claim-test-obs">{tcc.tests.budgetVsTeam.observation}</div>
              </div>
              <div className="tech-claim-row">
                <div className="tech-claim-test-name">Traçabilité de l&apos;actif</div>
                <div className={`tech-claim-test-score ${tcc.tests.assetTraceability.passed ? 'pass' : 'fail'}`}>
                  {tcc.tests.assetTraceability.score}/100
                </div>
                <div className="tech-claim-test-obs">{tcc.tests.assetTraceability.observation}</div>
              </div>
              <div className="tech-claim-row">
                <div className="tech-claim-test-name">Contre-factuel (pari sans la tech)</div>
                <div className={`tech-claim-test-score ${tcc.tests.counterFactual.passed ? 'fail' : 'pass'}`}>
                  {tcc.tests.counterFactual.score}/100
                </div>
                <div className="tech-claim-test-obs">{tcc.tests.counterFactual.observation}</div>
              </div>
            </div>
            <div className={`tech-claim-verdict tech-claim-verdict-${tcc.verdict}`}>
              <strong>Verdict :</strong>{' '}
              {tcc.verdict === 'tech_credible' && 'Revendication technologique crédible. Actif précis, équipe cohérente, le pari ne tient pas sans la tech.'}
              {tcc.verdict === 'tech_partially_substantiated' && 'Revendication partiellement étayée. Quelques signaux concrets mais l’audit reste à approfondir.'}
              {tcc.verdict === 'tech_storytelling' && 'Revendication tech relevant principalement de l’habillage commercial. Le pari tient sur ses bases éditoriales / commerciales / opérationnelles, pas sur la tech.'}
            </div>
            {tcc.questionsToInstruct?.length > 0 && (
              <div className="tech-claim-questions">
                <strong>Questions à instruire en DD :</strong>
                <ul>{tcc.questionsToInstruct.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>
              </div>
            )}
          </>
        )}

        {efr?.triggered && (efr.axes?.length || 0) > 0 && (
          <>
            <h3 className="note-h3" id="engine-section-execution-friction">Friction d&apos;exécution commerciale et industrielle</h3>
            {splitIntoParagraphs(efr.synthesis, 3).map((p: string, i: number) => (
              <p key={i} className="note-paragraph">{enrichProse(p)}</p>
            ))}
            <div className="exec-friction-axes">
              {(efr.axes || []).map((a: any, i: number) => {
                const axisLabels: Record<string, string> = {
                  'go_to_market': 'Go-to-market commercial',
                  'transactional_finance': 'Financement transactionnel',
                  'industrialization': 'Industrialisation',
                  'supply_chain_geopolitics': 'Supply chain et géopolitique',
                  'tech_adoption_ecosystem': 'Adoption technologique et écosystème',
                  'product_regulation': 'Régulation produit et certification',
                  'institutional_referencing': 'Référencement client institutionnel',
                  'rare_technical_talent': 'Talent technique rare',
                };
                const score = typeof a.score === 'number' ? a.score : 0;
                const intensityClass = score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';
                return (
                  <div key={i} className={`exec-friction-row exec-friction-${intensityClass}`}>
                    <div className="exec-friction-axis-name">{axisLabels[a.axis] || a.axis}</div>
                    <div className="exec-friction-score">{score}/100</div>
                    <div className="exec-friction-detail">
                      <div className="exec-friction-evidence">{a.evidence}</div>
                      <div className="exec-friction-implication">{a.implication}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`exec-friction-verdict exec-friction-verdict-${efr.verdict}`}>
              <strong>Verdict :</strong>{' '}
              {efr.verdict === 'friction_low' && 'Friction d\u2019ex\u00e9cution faible. Path commercial direct, calendrier classique.'}
              {efr.verdict === 'friction_medium' && 'Friction d\u2019ex\u00e9cution mod\u00e9r\u00e9e. Un goulot identifi\u00e9 ou cycles longs ; calendrier 24-36 mois.'}
              {efr.verdict === 'friction_high' && 'Friction d\u2019ex\u00e9cution \u00e9lev\u00e9e. Plusieurs frictions concomitantes ; calendrier 36-48 mois et capital patient requis.'}
              {efr.verdict === 'friction_structural' && 'Friction d\u2019ex\u00e9cution structurelle. Profil deeptech / B2G / industriel cumulant friction sur plusieurs axes ; calendrier long, capital patient et partenariats industriels requis. Caract\u00e9ristique du business \u00e0 int\u00e9grer dans la th\u00e8se.'}
            </div>
            {efr.questionsToInstruct?.length > 0 && (
              <div className="exec-friction-questions">
                <strong>Questions à instruire en DD :</strong>
                <ul>{efr.questionsToInstruct.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>
              </div>
            )}
          </>
        )}

        <h3 className="note-h3">Facteurs décisifs</h3>
        {reco.decisionDrivers?.length > 0 ? (
          <ol className="ordered-list">
            {(reco.decisionDrivers || []).map((d: string, i: number) => <li key={i}>{d}</li>)}
          </ol>
        ) : <p className="note-paragraph muted">Décision drivers non disponibles.</p>}

        {pm?.internationalBenchmarks?.length > 0 && (
          <>
            <h3 className="note-h3" id="engine-section-pattern">Comparables et précédents</h3>
            <p className="comparable-scope-note">
              Ces comparables internationaux sont retenus pour la pertinence d&apos;asset class avec le dossier (nature business, modèle économique, intensité capitalistique). Les comparables d&apos;archétype d&apos;instruction (proximité de pattern sans similarité sectorielle) sont identifiés séparément plus loin dans la note.
            </p>
            {(pm.internationalBenchmarks || []).map((b: any, i: number) => {
              // Mapping cautionLevel -> classe + libelle pour le badge
              const cautionConfig: Record<string, { cls: string; label: string }> = {
                'reference-positive': { cls: 'caution-positive', label: 'Référence positive' },
                'cite-with-caveat': { cls: 'caution-caveat', label: 'À nuancer' },
                'cautionary-tale': { cls: 'caution-tale', label: 'Avertissement' },
              };
              const statusConfig: Record<string, { cls: string; label: string }> = {
                confirmed: { cls: 'status-confirmed', label: 'Statut : confirmé' },
                promising: { cls: 'status-promising', label: 'Statut : prometteur' },
                fragile: { cls: 'status-fragile', label: 'Statut : fragile' },
                'in-difficulty': { cls: 'status-difficulty', label: 'Statut : en difficulté' },
                'too-early': { cls: 'status-too-early', label: 'Statut : trop tôt' },
              };
              const caution = b.cautionLevel ? cautionConfig[b.cautionLevel] : null;
              const status = b.currentStatus ? statusConfig[b.currentStatus] : null;
              const acm = b.assetClassMatch;
              const alignmentLabel = acm?.alignment === 'high' ? 'Asset class : alignement fort'
                : acm?.alignment === 'medium' ? 'Asset class : alignement partiel'
                : acm?.alignment === 'low' ? 'Asset class : alignement faible · comparable de pattern'
                : null;
              return (
                <div key={i} className={`benchmark-block ${caution ? caution.cls : ''}`}>
                  <div className="benchmark-header">
                    <span className="benchmark-name">{b.name}</span>
                    <span className="benchmark-geo">{b.geography} · {b.foundedYear} · {b.outcome}</span>
                  </div>
                  {(caution || status) && (
                    <div className="benchmark-badges">
                      {caution && <span className={`benchmark-badge ${caution.cls}`}>{caution.label}</span>}
                      {status && <span className={`benchmark-badge ${status.cls}`}>{status.label}</span>}
                    </div>
                  )}
                  {alignmentLabel && (
                    <div className={`asset-class-tag asset-class-${acm.alignment}`}>
                      {alignmentLabel}{acm.rationale ? ` · ${acm.rationale}` : ''}
                    </div>
                  )}
                  <div className="benchmark-bet"><strong>Pari initial :</strong> {b.initialBet}</div>
                  <div className="benchmark-relevance"><strong>Pertinence :</strong> {b.relevanceToCurrentDeal}</div>
                </div>
              );
            })}
          </>
        )}
      </section>

      {/* Bloc 4 - Transaction features (collapsible en mode compact) */}
      <NoteSectionWrapper number="4." title="Modalités de la transaction" compactMode={compactMode} collapseInCompact={true} sectionId="section-4">
        <table className="note-table">
          <tbody>
            <tr>
              <td className="note-label">Stage</td>
              <td className="note-value">{e.fundraise?.stage || '—'}</td>
            </tr>
            <tr>
              <td className="note-label">Nominal</td>
              <td className="note-value">{e.fundraise?.amount || '—'}</td>
            </tr>
            <tr>
              <td className="note-label">Valuation</td>
              <td className="note-value">{e.fundraise?.valuation || 'non précisée'}</td>
            </tr>
            <tr>
              <td className="note-label">Lead investor</td>
              <td className="note-value">{e.fundraise?.leadInvestor || 'non précisé'}</td>
            </tr>
            {fd?.currentRound?.runwayMonths && fd.currentRound.runwayMonths !== 'non précisé' && (
              <tr>
                <td className="note-label">Runway projeté</td>
                <td className="note-value">{fd.currentRound.runwayMonths} mois</td>
              </tr>
            )}
          </tbody>
        </table>

        {reco.keyConditions?.length > 0 && (
          <>
            <h3 className="note-h3">Conditions clés avant signature</h3>
            <ol className="ordered-list">
              {(reco.keyConditions || []).map((c: string, i: number) => <li key={i}>{c}</li>)}
            </ol>
          </>
        )}

        {reco.structuringPlan && (
          <>
            <h3 className="note-h3">Plan de structuration</h3>
            <h4 className="note-h4">Court terme · 0-3 mois</h4>
            {(reco.structuringPlan.shortTerm || []).length === 0 ? <p className="note-paragraph muted">Aucune action court terme.</p> : (
              <ul className="action-list">
                {(reco.structuringPlan.shortTerm || []).map((a: any, i: number) => (
                  <li key={i}><span className="action-axis">{a.axis}</span>{a.action}</li>
                ))}
              </ul>
            )}
            <h4 className="note-h4">Moyen terme · 3-12 mois</h4>
            {(reco.structuringPlan.mediumTerm || []).length === 0 ? <p className="note-paragraph muted">Aucune action moyen terme.</p> : (
              <ul className="action-list">
                {(reco.structuringPlan.mediumTerm || []).map((a: any, i: number) => (
                  <li key={i}><span className="action-axis">{a.axis}</span>{a.action}</li>
                ))}
              </ul>
            )}
            <h4 className="note-h4">Long terme · 12+ mois</h4>
            {(reco.structuringPlan.longTerm || []).length === 0 ? <p className="note-paragraph muted">Aucune action long terme.</p> : (
              <ul className="action-list">
                {(reco.structuringPlan.longTerm || []).map((a: any, i: number) => (
                  <li key={i}><span className="action-axis">{a.axis}</span>{a.action}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {(r as any).structurationEntree && (
          <StructurationEntreeSection
            structuration={(r as any).structurationEntree}
            variant="note"
          />
        )}

        {/* ============================================================
            REFERENCE CHECKS STRUCTURES
            ------------------------------------------------------------
            Section issue du moteur reference-checks-engine (Bloc 1).
            Avant cette refonte, ces donnees etaient consultables seulement
            dans le Pack IC mais absentes de la note d instruction. Or le
            partner qui lit la note a besoin de savoir quels appels DD
            terrain mener avant le comite : qui appeler, quoi demander,
            dans quel ordre. C est l action concrete qui suit la lecture.
            S affiche uniquement si le moteur a produit des donnees
            (skip silencieux sinon).
            ============================================================ */}
        {(() => {
          const refchecks = (r as any).referenceChecks;
          if (!refchecks) return null;
          const founderCount = (refchecks.founderChecks || []).length;
          const customerCount = (refchecks.customerChecks || []).length;
          const boardCount = (refchecks.boardChecks || []).length;
          const weakSignalsCount = (refchecks.weakSignalsChecks || []).length;
          const totalCalls = founderCount + customerCount + boardCount;
          if (totalCalls === 0 && weakSignalsCount === 0) return null;
          const priorityOrder = (refchecks.priorityOrder || []).slice(0, 3);
          const redFlags = (refchecks.redFlagsToProbe || []).slice(0, 5);
          return (
            <>
              <h3 className="note-h3" id="engine-section-reference-checks">Plan d&apos;appels DD terrain</h3>
              <p className="note-paragraph muted">
                Plan d&apos;instruction terrain généré à partir des outputs Bloc 1. {totalCalls > 0 && `${totalCalls} interlocuteur${totalCalls > 1 ? 's' : ''} à contacter`}{totalCalls > 0 && weakSignalsCount > 0 ? ', ' : ''}{weakSignalsCount > 0 && `${weakSignalsCount} signal${weakSignalsCount > 1 ? 'aux' : ''} faible${weakSignalsCount > 1 ? 's' : ''} à vérifier en data`}. Couvre fondateurs, clients, gouvernance et traction indépendante.
              </p>

              {priorityOrder.length > 0 && (
                <div className="refcheck-priority">
                  <div className="refcheck-priority-label">Ordre prioritaire</div>
                  <ol className="refcheck-priority-list">
                    {priorityOrder.map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                </div>
              )}

              {founderCount > 0 && (
                <div className="refcheck-block">
                  <div className="refcheck-block-head">
                    <span className="refcheck-block-tag">Fondateurs</span>
                    <span className="refcheck-block-count">{founderCount} profil{founderCount > 1 ? 's' : ''}</span>
                  </div>
                  {(refchecks.founderChecks || []).map((f: any, i: number) => (
                    <div key={i} className="refcheck-item">
                      <div className="refcheck-item-name">{f.founderName}</div>
                      {(f.contactsToFind || []).length > 0 && (
                        <div className="refcheck-item-detail">
                          <span className="refcheck-item-detail-label">Contacts à trouver : </span>
                          {(f.contactsToFind || []).map((c: any, j: number) => (
                            <span key={j}>{c.profile}{j < (f.contactsToFind || []).length - 1 ? ', ' : ''}</span>
                          ))}
                        </div>
                      )}
                      {(f.keyQuestions || []).length > 0 && (
                        <ul className="refcheck-questions">
                          {(f.keyQuestions || []).slice(0, 3).map((q: string, j: number) => (
                            <li key={j}>{q}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {customerCount > 0 && (
                <div className="refcheck-block">
                  <div className="refcheck-block-head">
                    <span className="refcheck-block-tag">Clients</span>
                    <span className="refcheck-block-count">{customerCount} à appeler</span>
                  </div>
                  {(refchecks.customerChecks || []).map((c: any, i: number) => (
                    <div key={i} className="refcheck-item">
                      <div className="refcheck-item-name">
                        {c.clientName}
                        {c.company && <span className="refcheck-item-name-company"> · {c.company}</span>}
                        <span className={`refcheck-status refcheck-status-${c.contractStatus || 'unknown'}`}>{c.contractStatus || 'unknown'}</span>
                      </div>
                      {(c.keyQuestions || []).length > 0 && (
                        <ul className="refcheck-questions">
                          {(c.keyQuestions || []).slice(0, 3).map((q: string, j: number) => (
                            <li key={j}>{q}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {boardCount > 0 && (
                <div className="refcheck-block">
                  <div className="refcheck-block-head">
                    <span className="refcheck-block-tag">Gouvernance</span>
                    <span className="refcheck-block-count">{boardCount} membre{boardCount > 1 ? 's' : ''}</span>
                  </div>
                  {(refchecks.boardChecks || []).map((b: any, i: number) => (
                    <div key={i} className="refcheck-item">
                      <div className="refcheck-item-name">
                        {b.memberName}
                        <span className="refcheck-item-name-company"> · {b.role}</span>
                        {b.affiliation && <span className="refcheck-item-name-company"> · {b.affiliation}</span>}
                      </div>
                      {(b.keyQuestions || []).length > 0 && (
                        <ul className="refcheck-questions">
                          {(b.keyQuestions || []).slice(0, 2).map((q: string, j: number) => (
                            <li key={j}>{q}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {weakSignalsCount > 0 && (
                <div className="refcheck-block">
                  <div className="refcheck-block-head">
                    <span className="refcheck-block-tag">Signaux faibles</span>
                    <span className="refcheck-block-count">{weakSignalsCount} à vérifier en data</span>
                  </div>
                  {(refchecks.weakSignalsChecks || []).map((w: any, i: number) => (
                    <div key={i} className="refcheck-item">
                      <div className="refcheck-item-name">
                        <span className="refcheck-item-name-company">{w.signalType}</span> · {w.target}
                      </div>
                      <div className="refcheck-item-detail">{w.rationale}</div>
                      <div className="refcheck-item-detail muted">Marqueur attendu : {w.expectedFinding}</div>
                    </div>
                  ))}
                </div>
              )}

              {redFlags.length > 0 && (
                <div className="refcheck-redflags">
                  <div className="refcheck-redflags-label">Drapeaux rouges à creuser</div>
                  <ul className="refcheck-redflags-list">
                    {redFlags.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          );
        })()}

        {/* ============================================================
            BLOC 2 - DATA ROOM (DD approfondie)
            S affiche uniquement si au moins un module DD a tourne :
            DD financiere (BP vs grand livre), DD contractuelle (clauses
            sensibles), et a venir : DD technique (repo GitHub) + ref
            checks structures.
            ============================================================ */}
        {/* BANDEAU PASSER EN DD APPROFONDIE
            Apparait quand toutes les conditions sont reunies :
              - Le partner a un onDeepenDDClick (capacite de declencher)
              - L analyse est sauvegardee (analysisId present)
              - Le verdict de l instruction prealable autorise la DD
                (different de "refuser")
              - Aucune section Bloc 2 n est encore triggered
            Si une section Bloc 2 est deja la, le bandeau disparait
            naturellement et on passe directement aux sections Data
            Room. Le partner peut toujours redeposer des documents
            complementaires ulterieurement (la route /dd-deepen est
            idempotente et capitalise sur les sorties precedentes). */}
        {(() => {
          const hasBloc2 = ddf?.triggered || ddc?.triggered || (r as any).ddTechnical?.triggered;
          const verdict = reco?.verdict;
          const canDeepen = !!onDeepenDDClick && !!analysisId &&
            verdict && verdict !== 'refuser' && !hasBloc2;
          if (!canDeepen) return null;
          return (
            <div className="dd-deepen-banner">
              <div className="dd-deepen-banner-tag">Étape suivante</div>
              <div className="dd-deepen-banner-title">Passer en DD approfondie</div>
              <div className="dd-deepen-banner-desc">
                L&apos;instruction Bloc 1 conclut à un verdict <strong>{verdict}</strong>. Le passage en DD approfondie active les moteurs Data Room sur les documents transmis par la startup : grand livre comptable, pacte d&apos;actionnaires, statuts, cap table, contrats clients principaux, dossier technique. La note s&apos;enrichira sans recalculer le Bloc 1 déjà produit.
              </div>
              <button className="btn btn-primary dd-deepen-banner-btn" onClick={onDeepenDDClick}>
                Ouvrir la zone d&apos;upload Data Room &rarr;
              </button>
            </div>
          );
        })()}

        {(ddf?.triggered || ddc?.triggered || (r as any).ddTechnical?.triggered) && (
          <div className="block-marker block-marker-dataroom">
            <div className="block-marker-tag">Bloc 2</div>
            <div className="block-marker-title">Data Room</div>
            <div className="block-marker-sub">Due diligence approfondie &middot; Lecture pour comité d&apos;investissement</div>
          </div>
        )}

        {ddf?.triggered && (
          <>
            <h3 className="note-h3" id="engine-section-dd-financial">Data Room · DD financière</h3>
            <p className="note-paragraph muted">
              Période du grand livre : {ddf.ledgerPeriod.start || 'n.a.'} au {ddf.ledgerPeriod.end || 'n.a.'}.
              {' '}Score global de l&apos;audit : {ddf.globalScore}/100.
            </p>
            {splitIntoParagraphs(ddf.synthesis, 3).map((p: string, i: number) => (
              <p key={i} className="note-paragraph">{enrichProse(p)}</p>
            ))}
            <div className="dd-tests">
              {[
                { key: 'revenueGap', label: 'Écart CA déclaré vs CA réel' },
                { key: 'grossMarginGap', label: 'Marge brute projetée vs réelle' },
                { key: 'burnRateGap', label: 'Burn rate déclaré vs réel' },
                { key: 'headcountGap', label: 'Headcount vs charges salariales' },
                { key: 'clientConcentration', label: 'Concentration client réelle' },
                { key: 'growthTrajectory', label: 'Trajectoire récente vs BP' },
                { key: 'offBalanceVsNarrative', label: 'Engagements hors bilan vs narratif' },
              ].map((row) => {
                const t = ddf.tests[row.key];
                if (!t) return null;
                return (
                  <div key={row.key} className={`dd-test-row dd-test-${t.severity}`}>
                    <div className="dd-test-header">
                      <span className="dd-test-id">{t.testId}</span>
                      <span className="dd-test-label">{row.label}</span>
                      <span className={`dd-test-pill dd-test-pill-${t.severity}`}>
                        {t.severity === 'aligned' && 'Aligné'}
                        {t.severity === 'attention' && 'Attention'}
                        {t.severity === 'alert' && 'Alerte'}
                        {t.severity === 'red_flag' && 'Red flag'}
                        {t.severity === 'not_assessable' && 'Non évaluable'}
                      </span>
                    </div>
                    <div className="dd-test-values">
                      <div className="dd-test-bp"><strong>BP / Pitch</strong>{' '}{t.bpValue}</div>
                      <div className="dd-test-real"><strong>Réel</strong>{' '}{t.realValue}</div>
                    </div>
                    <div className="dd-test-evidence">{t.evidence}</div>
                    {t.ddQuestion && (
                      <div className="dd-test-question"><strong>Question DD :</strong>{' '}{t.ddQuestion}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={`dd-verdict dd-verdict-${ddf.verdict}`}>
              <strong>Verdict :</strong>{' '}
              {ddf.verdict === 'dd_aligned' && 'BP et réalité comptable alignés. Confirmer en DD le maintien sur les exercices à venir.'}
              {ddf.verdict === 'dd_partial_alignment' && 'Alignement partiel. Une à deux zones d\u2019écart sectoriel à documenter avant comité d\u2019investissement.'}
              {ddf.verdict === 'dd_significant_gaps' && 'Écarts significatifs sur plusieurs postes. Investigation DD approfondie requise avant toute décision.'}
              {ddf.verdict === 'dd_red_flags' && 'Red flags identifiés. Le BP présente des décalages structurels avec la réalité comptable qui exigent clarification immédiate.'}
            </div>
            {ddf.questionsToInstruct?.length > 0 && (
              <div className="dd-questions">
                <strong>Questions DD prioritaires :</strong>
                <ol>{ddf.questionsToInstruct.map((q: string, i: number) => <li key={i}>{q}</li>)}</ol>
              </div>
            )}
          </>
        )}

        {ddc?.triggered && (
          <>
            <h3 className="note-h3" id="engine-section-dd-contractual">Data Room · DD contractuelle</h3>
            <div className="ddc-disclaimer">
              {(ddc.disclaimers || []).map((d: string, i: number) => (
                <div key={i} className="ddc-disclaimer-line">{d}</div>
              ))}
            </div>
            <p className="note-paragraph muted">
              Documents analysés :
              {ddc.documentsAnalyzed.shareholdersAgreement && ` pacte (${ddc.documentsAnalyzed.shareholdersAgreement.name})`}
              {ddc.documentsAnalyzed.statutes && `${ddc.documentsAnalyzed.shareholdersAgreement ? ', ' : ' '}statuts (${ddc.documentsAnalyzed.statutes.name})`}
              {(ddc.documentsAnalyzed.clientContracts?.length || 0) > 0 && `, ${ddc.documentsAnalyzed.clientContracts.filter((c: any) => c.analyzed).length} contrat${ddc.documentsAnalyzed.clientContracts.filter((c: any) => c.analyzed).length > 1 ? 's' : ''} client`}
              {' '}. Score global : {ddc.globalScore}/100.
            </p>
            {splitIntoParagraphs(ddc.synthesis, 3).map((p: string, i: number) => (
              <p key={i} className="note-paragraph">{enrichProse(p)}</p>
            ))}

            {ddc.capTableSummary && (
              <>
                <h4 className="note-h4">Cap table à date</h4>
                <div className="ddc-cap-summary">
                  <div className="ddc-cap-row"><span>Fondateurs cumulés</span><strong>{ddc.capTableSummary.founderPercentage.toFixed(1)}%</strong></div>
                  <div className="ddc-cap-row"><span>Investisseurs cumulés</span><strong>{ddc.capTableSummary.investorPercentage.toFixed(1)}%</strong></div>
                  <div className="ddc-cap-row"><span>Pool d&apos;options</span><strong>{ddc.capTableSummary.optionPoolPercentage.toFixed(1)}%</strong></div>
                  <div className="ddc-cap-row"><span>Allocation employés</span><strong>{ddc.capTableSummary.employeeAllocatedPercentage.toFixed(1)}%</strong></div>
                  {ddc.capTableSummary.topInvestor && (
                    <div className="ddc-cap-row"><span>Top investisseur</span><strong>{ddc.capTableSummary.topInvestor.name} ({ddc.capTableSummary.topInvestor.percentage.toFixed(1)}%)</strong></div>
                  )}
                </div>
                {(ddc.capTableSummary.keyFlags?.length || 0) > 0 && (
                  <ul className="ddc-cap-flags">
                    {ddc.capTableSummary.keyFlags.map((m: string, i: number) => <li key={i}>{m}</li>)}
                  </ul>
                )}
              </>
            )}

            {(ddc.clauses?.length || 0) > 0 && (
              <>
                <h4 className="note-h4">Cartographie des clauses sensibles</h4>
                <div className="ddc-clauses">
                  {ddc.clauses.map((c: any, i: number) => (
                    <div key={i} className={`ddc-clause-row ddc-clause-${c.severity}`}>
                      <div className="ddc-clause-header">
                        <span className="ddc-clause-label">{c.clauseLabel}</span>
                        <span className={`ddc-clause-pill ddc-clause-pill-${c.severity}`}>
                          {c.severity === 'standard' && 'Standard'}
                          {c.severity === 'attention' && 'Attention'}
                          {c.severity === 'non_standard' && 'Non standard'}
                          {c.severity === 'red_flag' && 'Red flag'}
                          {c.severity === 'not_found' && 'Non trouvée'}
                        </span>
                      </div>
                      {c.citation && (
                        <div className="ddc-clause-citation">{c.citation}</div>
                      )}
                      <div className="ddc-clause-meta">
                        {c.reference && <span><strong>Ref :</strong> {c.reference}</span>}
                        <span><strong>Source :</strong> {c.source}</span>
                      </div>
                      {c.marketComparison && (
                        <div className="ddc-clause-market"><strong>Marché :</strong> {c.marketComparison}</div>
                      )}
                      {c.implication && (
                        <div className="ddc-clause-implication">{c.implication}</div>
                      )}
                      {c.ddQuestion && (
                        <div className="ddc-clause-question"><strong>Question DD :</strong> {c.ddQuestion}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {(ddc.clientContractFlags?.length || 0) > 0 && (
              <>
                <h4 className="note-h4">Flags contrats clients</h4>
                <div className="ddc-flags">
                  {ddc.clientContractFlags.map((f: any, i: number) => (
                    <div key={i} className={`ddc-flag-row ddc-flag-${f.severity}`}>
                      <div className="ddc-flag-header">
                        <span className="ddc-flag-type">{f.flagType.replace(/_/g, ' ')}</span>
                        <span className="ddc-flag-contract">{f.contractName}</span>
                        <span className={`ddc-clause-pill ddc-clause-pill-${f.severity}`}>
                          {f.severity === 'standard' && 'Standard'}
                          {f.severity === 'attention' && 'Attention'}
                          {f.severity === 'non_standard' && 'Non standard'}
                          {f.severity === 'red_flag' && 'Red flag'}
                        </span>
                      </div>
                      {f.citation && <div className="ddc-clause-citation">{f.citation}</div>}
                      {f.reference && <div className="ddc-clause-meta"><strong>Ref :</strong> {f.reference}</div>}
                      {f.implication && <div className="ddc-clause-implication">{f.implication}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className={`ddc-verdict ddc-verdict-${ddc.verdict}`}>
              <strong>Verdict :</strong>{' '}
              {ddc.verdict === 'contractual_aligned' && 'Profil contractuel aligné sur les standards VC français. Confirmer en DD juridique auprès de l\u2019avocat.'}
              {ddc.verdict === 'contractual_attention' && 'Quelques points d\u2019attention identifiés. Investigation ciblée auprès de l\u2019avocat M&A recommandée.'}
              {ddc.verdict === 'contractual_significant_gaps' && 'Plusieurs clauses non standards identifiées. DD juridique approfondie requise avant comité d\u2019investissement.'}
              {ddc.verdict === 'contractual_red_flags' && 'Red flags contractuels identifiés. Clarification urgente auprès de l\u2019avocat M&A et négociation potentielle avant décision.'}
            </div>
            {ddc.questionsToInstruct?.length > 0 && (
              <div className="dd-questions">
                <strong>Questions DD prioritaires :</strong>
                <ol>{ddc.questionsToInstruct.map((q: string, i: number) => <li key={i}>{q}</li>)}</ol>
              </div>
            )}
          </>
        )}

        {/* MODULE 3 DD TECHNIQUE
            Lecture du dossier technique fourni par la startup,
            calque sur GCV Investor DD Checklist sections 4/6/7/8.
            Dix tests structures avec citation mot pour mot. Ne
            s affiche que si triggered (au moins un document
            technique fourni ET fetch reussi). Sinon on peut afficher
            un bandeau d explication minimal si reasonNotTriggered
            est present. */}
        {(() => {
          const ddt = (r as any).ddTechnical;
          if (!ddt) return null;
          if (!ddt.triggered) {
            // Si la raison est explicite (URL fournie sans docs ou
            // erreur LLM), on l affiche en bandeau pour le partner.
            // Sinon on ne pollue pas la note.
            if (ddt.reasonNotTriggered) {
              return null; // silencieux : pas de doc technique, on ne mentionne rien
            }
            return null;
          }
          const tests: any[] = Array.isArray(ddt.tests) ? ddt.tests : [];
          return (
            <>
              <h3 className="note-h3" id="engine-section-dd-tech">Data Room · DD technique</h3>
              <p className="note-paragraph muted">
                Audit du dossier technique transmis par la startup, aligné sur les sections 4 (Technology/Product), 6 (Intellectual Property), 7 (Information Technology) et 8 (Data Protection) de la GCV Investor Due Diligence Checklist.
                {' '}{(ddt.documentsAnalyzed || []).length > 0 && (
                  <>Documents analysés : {ddt.documentsAnalyzed.map((d: any) => d.name).join(', ')}.{' '}</>
                )}
                Score global de l&apos;audit : {ddt.globalScore}/100.
                {' '}Taux de zones non documentées : {ddt.underDocumentationRate}%.
              </p>

              {/* Disclaimers obligatoires */}
              {Array.isArray(ddt.disclaimers) && ddt.disclaimers.length > 0 && (
                <div className="ddc-disclaimer">
                  {ddt.disclaimers.map((d: string, i: number) => (
                    <div key={i} className="ddc-disclaimer-line">{d}</div>
                  ))}
                </div>
              )}

              {/* Synthese editoriale rule-based */}
              {ddt.synthesis && splitIntoParagraphs(ddt.synthesis, 3).map((p: string, i: number) => (
                <p key={i} className="note-paragraph">{p}</p>
              ))}

              {/* Dix tests, meme markup que ddf et ddc pour heriter
                  des styles dd-tests / dd-test-row / dd-test-{severity} */}
              <div className="dd-tests">
                {tests.map((t: any, i: number) => {
                  if (!t) return null;
                  return (
                    <div key={i} className={`dd-test-row dd-test-${t.severity}`}>
                      <div className="dd-test-header">
                        <span className="dd-test-id">{t.testId}</span>
                        <span className="dd-test-label">{t.testLabel}</span>
                        <span className={`dd-test-pill dd-test-pill-${t.severity}`}>
                          {t.severity === 'aligned' && 'Aligné'}
                          {t.severity === 'attention' && 'Attention'}
                          {t.severity === 'alert' && 'Alerte'}
                          {t.severity === 'red_flag' && 'Red flag'}
                          {t.severity === 'non_documented' && 'Non documenté'}
                        </span>
                      </div>
                      {/* Citation mot pour mot (facon ddc) si presente */}
                      {t.citation && (
                        <div className="ddc-clause-citation">
                          {t.citation}
                        </div>
                      )}
                      {t.source && (
                        <div className="ddc-clause-meta"><strong>Source :</strong> {t.source}</div>
                      )}
                      <div className="dd-test-values">
                        <div><strong>Observation</strong>{t.observation}</div>
                        <div><strong>Standard attendu</strong>{t.benchmark}</div>
                      </div>
                      {t.implication && (
                        <div className="dd-test-evidence"><strong style={{ fontFamily: 'inherit', fontSize: 'inherit', textTransform: 'none', letterSpacing: 0 }}>Implication : </strong>{t.implication}</div>
                      )}
                      {t.ddQuestion && (
                        <div className="dd-test-question"><strong>Question DD</strong>{t.ddQuestion}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={`dd-verdict dd-verdict-${ddt.verdict}`}>
                <strong>Verdict :</strong>{' '}
                {ddt.verdict === 'tech_strong' && 'Discipline technique élevée. Le dossier transmis couvre les dimensions clés avec un niveau de détail satisfaisant. Confirmer en entretien CTO et audit externe ciblé.'}
                {ddt.verdict === 'tech_solid' && 'Dossier technique correct avec quelques zones d\u2019ombre mineures. Investigation ciblée auprès du CTO sur les points d\u2019attention identifiés.'}
                {ddt.verdict === 'tech_partial' && 'Signaux mixtes. Plusieurs dimensions sont solides, d\u2019autres incomplètes. DD technique externe recommandée sur les axes en alerte.'}
                {ddt.verdict === 'tech_concerns' && 'Plusieurs alertes sur la maintenabilité, la sécurité ou l\u2019ownership du code. Documenter les zones rouges auprès du CTO et de l\u2019avocat IP avant comité d\u2019investissement.'}
                {ddt.verdict === 'tech_red_flags' && 'Red flags structurels identifiés (ownership du code non sécurisé, non conformité RGPD, sécurité critique absente, ou pratique IP problématique). Clarification urgente requise et expert externe à mandater.'}
                {ddt.verdict === 'tech_under_documented' && 'Le dossier technique transmis est trop léger pour conclure. Plus de la moitié des dimensions clés ne sont pas adressées. Demander un complément de documentation à la startup avant de poursuivre l\u2019instruction.'}
                {ddt.verdict === 'not_applicable' && 'Audit non réalisé.'}
              </div>

              {ddt.questionsToInstruct?.length > 0 && (
                <div className="dd-questions">
                  <strong>Questions DD prioritaires :</strong>
                  <ol>{ddt.questionsToInstruct.map((q: string, i: number) => <li key={i}>{q}</li>)}</ol>
                </div>
              )}
            </>
          );
        })()}
      </NoteSectionWrapper>

      {/* SECTION COMPARABLES HISTORIQUES - Memoire institutionnelle factuelle.
          Compare le dossier en cours aux startups documentees du corpus
          historique (success, medium, fail, active). Repond a la question :
          ce dossier ressemble a quels cas passes du marche ?
          Ne s'affiche que si analysisId est fourni (la note doit etre
          sauvegardee en base pour pouvoir etre rapprochee). */}
      {analysisId && (
        <NoteSectionWrapper number="5." title="Comparables historiques" compactMode={compactMode} collapseInCompact={true} sectionId="section-5">
          <p className="note-section-intro">
            Rapprochement avec un corpus de startups documentées au moment de leur tour qualifiant.
            Le matching s&apos;appuie sur six dimensions (founder, market, traction, deal,
            defensibility, risk), pondère un boost sectoriel et applique un hard filter
            par classe d&apos;actif (hardware industriel, deeptech, software pur).
          </p>
          <HistoricalComparables analysisId={analysisId} />
        </NoteSectionWrapper>
      )}

      {/* SECTION RECONCILIATION PREDICTION VS REALITY (Bloc E3)
          Permet d enregistrer la decision finale du fonds (invested/passed/
          declined/waitlisted) et d ajouter au fil du temps les milestones
          observes (levee, pivot, exit, fail). C est la matiere brute qui,
          accumulee sur 30+ dossiers, permettra a Prelude de cartographier
          ses biais structurels et d apprendre. */}
      {analysisId && (
        <NoteSectionWrapper number="6." title="Suivi & réconciliation" compactMode={compactMode} collapseInCompact={true} sectionId="section-6">
          <p className="note-section-intro">
            Trace de ce qui s&apos;est réellement passé après la décision. Une mémoire
            institutionnelle d&apos;apprentissage qui, accumulée dossier après dossier,
            permettra de réconcilier ce que Prélude prédisait avec ce que les marchés
            ont validé ou contredit.
          </p>
          <OutcomeTracking analysisId={analysisId} />
        </NoteSectionWrapper>
      )}

      {/* SECTION SOURCES & METHODOLOGY - Documentation des références externes
          consolidées par les moteurs Prélude. Montre la rigueur méthodologique
          de la note. Le mini SectoralSpiderChart en tête expose la fiche
          sectorielle qui a effectivement encadré la lecture du dossier, avec
          lien vers la fiche complète et mention des secteurs secondaires si
          le dossier est multi-sectoriel. */}
      <section className="note-sources" id="engine-section-sources">
        <h4 className="note-h4">Sources et méthodologie</h4>
        <NoteSectoralMethodBlock sectoral={sectoral} />
        <p className="note-sources-intro">
          Cette note s'appuie sur l'analyse du dossier déposé et sur un corpus de bornes externes consolidées trimestriellement.
        </p>
        <ol className="note-sources-list">
          <li>
            <strong>PitchBook-NVCA Venture Monitor Q1 2026.</strong>
            <span className="note-sources-detail"> Médianes pré-money par stade, séparation IA vs non-IA, concentration extrême du capital US (top 5 deals = 73,2%), step-up médian, fundraising bifurqué.</span>
          </li>
          <li>
            <strong>Atomico State of European Tech 2025.</strong>
            <span className="note-sources-detail"> Profondeur du marché européen (44 Md$ annuels vs 267 Md$ US Q1 2026), allocation pension funds VC (0,009% AUM Europe vs 0,028% US), Mighty 50 (comparables européens), pipeline réglementaire EU 2026.</span>
          </li>
          <li>
            <strong>Bain Global Private Equity Report 2025.</strong>
            <span className="note-sources-detail"> Liquidité LP (distributions to NAV 2024 = 11%, plus bas niveau en 10+ ans), gap fundraising entre top et bottom quartile (53 points), multiples buyout EBITDA.</span>
          </li>
          <li>
            <strong>Correlation Ventures &amp; Cambridge Associates.</strong>
            <span className="note-sources-detail"> Loi de puissance des retours VC (65% des deals en 0-1x, 4% en 10x+), benchmarks de TRI et TVPI par quartile de fond, persistance Kaplan-Schoar.</span>
          </li>
        </ol>
      </section>

      {/* ANNEXE SECTORIELLE - Exhaustif des huit dimensions de la fiche
          sectorielle qui a encadre l analyse, avec score, definition
          appliquee et sources citees par le LLM regenerateur. Affichee
          en fin de note pour ne pas alourdir la lecture principale,
          mais accessible pour audit doctrinal. */}
      <NoteSectoralAnnex sectoral={sectoral} />

      <div className="note-footer">
        <div>Note préparée par Prélude · Plateforme d'instruction VC européenne</div>
        <div>Document confidentiel · Usage strictement interne au Comité d'Investissement</div>
      </div>

      <style jsx>{`
        /* ============================================================
           PRELUDE - Investment Note - Direction visuelle C
           Inspiration : Financial Times, Bloomberg, The Economist online
           Phases : C1 fondations · C2 mise en scene · C3 couleur affinee
           ============================================================ */

        .investment-note {
          /* PALETTE EDITORIALE - alignee sur le design system global
             (app/globals.css). Le composant gardait historiquement sa
             propre palette creme var(--paper) / ink var(--ink), mais la refonte
             design imposait un alignement complet. Variables locales
             reproduisant les tokens globaux pour ne pas avoir a renommer
             toutes les references --paper / --ink dans le composant. */

          --paper: #ffffff;
          --paper-accent: #f6f8fb;
          --paper-warm: #fef7f4;
          --ink: #0f172a;
          --ink-secondary: #475569;
          --ink-tertiary: #64748b;
          --ink-quaternary: #94a3b8;
          --hairline: #e2e8f0;
          --hairline-soft: #f1f5f9;

          --accent-marque: #1e3a8a;
          --accent-marque-soft: #eff6ff;

          --semantic-critical: #b91c1c;
          --semantic-critical-soft: #fef2f2;
          --semantic-warning: #b45309;
          --semantic-warning-soft: #fffbeb;
          --semantic-positive: #15803d;
          --semantic-positive-soft: #f0fdf4;

          max-width: 920px;
          margin: 0 auto;
          padding: 56px 64px;
          background: var(--paper);
          color: var(--ink);
          font-family: var(--serif);
          font-size: 15px;
          line-height: 1.7;
          font-feature-settings: "kern", "liga", "onum";
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* HEADER - Style "nameplate" de journal premium :
           PRELUDE en grand, dateline et classification en petits caractères
           sans-serif uppercase, filet horizontal de séparation. */
        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--ink);
          margin-bottom: 48px;
          position: relative;
        }
        .note-header::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--ink);
          opacity: 0.4;
        }
        .note-brand {
          font-family: var(--serif);
          font-size: 30px;
          font-weight: 700;
          letter-spacing: 0.16em;
          line-height: 1;
          color: var(--accent-marque);
        }
        .note-title {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-top: 8px;
        }
        .note-header-right {
          text-align: right;
        }
        .note-date {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 500;
          color: var(--ink);
          letter-spacing: 0.04em;
        }
        .note-classification {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          letter-spacing: 0.18em;
          color: #8a8478;
          margin-top: 4px;
          text-transform: uppercase;
          font-weight: 500;
        }

        /* TABLE DES MATIERES FLOTTANTE
           Sticky a droite sur desktop, position fixed pour rester
           accessible quel que soit le scroll. Cachee sous 1280px de
           large : pas assez de place sur tablette/mobile. */
        .note-toc {
          position: fixed;
          top: 96px;
          right: 24px;
          width: 220px;
          max-height: calc(100vh - 140px);
          overflow-y: auto;
          padding: 18px 16px;
          background: var(--paper);
          border: 1px solid var(--hairline);
          font-family: var(--sans);
          z-index: 30;
        }
        .note-toc-label {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--hairline);
        }
        .note-toc-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .note-toc-list li {
          margin: 0;
        }
        .note-toc-link {
          display: block;
          padding: 4px 0;
          font-family: var(--serif);
          font-size: 13px;
          color: var(--ink-soft);
          text-decoration: none;
          line-height: 1.35;
          transition: color 0.15s ease;
          border-left: 2px solid transparent;
          padding-left: 10px;
          margin-left: -10px;
        }
        .note-toc-link:hover {
          color: var(--accent);
          border-left-color: var(--accent);
        }
        .note-toc-link-cover {
          font-style: italic;
          color: var(--accent);
          font-weight: 500;
          margin-bottom: 4px;
        }
        .note-toc-sub {
          font-size: 12px;
          color: var(--muted);
          padding-left: 22px;
          margin-left: -10px;
        }

        @media (max-width: 1280px) {
          .note-toc {
            display: none;
          }
        }

        /* En mode print (export PDF), on cache la TOC flottante :
           position fixed produit un overlay sur chaque page imprimee,
           illisible sur PDF. Le PDF a sa propre table des matieres
           generee par Puppeteer via les headings de la note. */
        @media print {
          .note-toc {
            display: none !important;
          }
          /* Page de couverture commence sur sa propre page pour un
             rendu memo classique : verdict en page 1, analyse en
             page 2 et suivantes. */
          .note-cover {
            page-break-after: always;
            break-after: page;
          }
        }

        /* PAGE DE COUVERTURE EDITORIALE
           Page 1 du memo : verdict, score, identite, drivers, risques,
           action. Le partner doit pouvoir prendre une decision provisoire
           en 30 secondes avant de scroller dans le detail. */
        .note-cover {
          margin: 0 0 80px 0;
          padding: 0;
        }

        /* Bandeau verdict : la zone qui domine la page */
        .note-cover-verdict {
          padding: 36px 40px 32px;
          margin-bottom: 28px;
          border: 1px solid var(--hairline);
          border-left: 5px solid var(--ink);
          background: var(--paper);
          position: relative;
        }
        .note-cover-verdict-tone-go { border-left-color: rgb(21, 128, 61); }
        .note-cover-verdict-tone-conditional { border-left-color: rgb(180, 95, 30); }
        .note-cover-verdict-tone-watch { border-left-color: rgb(94, 75, 41); }
        .note-cover-verdict-tone-decline { border-left-color: rgb(155, 28, 28); }

        .note-cover-verdict-eyebrow {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
          margin-bottom: 14px;
        }
        .note-cover-verdict-label {
          font-family: var(--serif);
          font-size: 44px;
          font-weight: 600;
          line-height: 1.05;
          color: var(--ink);
          letter-spacing: -0.02em;
          margin-bottom: 26px;
        }
        .note-cover-verdict-stats {
          display: flex;
          gap: 56px;
          flex-wrap: wrap;
        }
        .note-cover-stat-num {
          font-family: var(--serif);
          font-size: 36px;
          font-weight: 600;
          line-height: 1;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }
        .note-cover-stat-num span {
          font-size: 17px;
          font-weight: 400;
          color: var(--muted);
          margin-left: 2px;
        }
        .note-cover-stat-label {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          margin-top: 6px;
          font-weight: 500;
        }

        /* Identite condensee : grille de six lignes */
        .note-cover-identity {
          margin-bottom: 28px;
          padding: 24px 30px;
          background: var(--paper-accent);
          border: 1px solid var(--hairline);
        }
        .note-cover-identity-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px 40px;
          margin: 0;
        }
        .note-cover-identity-item dt {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
          font-weight: 500;
        }
        .note-cover-identity-item dd {
          font-family: var(--serif);
          font-size: 16px;
          color: var(--ink);
          margin: 0;
          line-height: 1.4;
        }

        /* Trois colonnes : drivers, risques, action */
        .note-cover-trio {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 28px;
          margin-bottom: 24px;
        }
        .note-cover-trio-col {
          padding: 22px 24px;
          background: var(--paper);
          border-top: 2px solid var(--ink);
        }
        .note-cover-trio-label {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 14px;
          font-weight: 600;
        }
        .note-cover-trio-list {
          margin: 0;
          padding-left: 18px;
          list-style: decimal;
          font-family: var(--serif);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink-soft);
        }
        .note-cover-trio-list li {
          margin-bottom: 9px;
        }
        .note-cover-trio-list li:last-child {
          margin-bottom: 0;
        }
        .note-cover-trio-risk-name {
          color: var(--ink);
        }
        .note-cover-trio-risk-intensity {
          color: var(--muted);
          font-style: italic;
          font-size: 12.5px;
        }
        .note-cover-trio-empty {
          font-family: var(--serif);
          font-style: italic;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .note-cover-trio-action {
          font-family: var(--serif);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink);
          margin: 0 0 14px 0;
        }
        .note-cover-trio-action-sub {
          font-family: var(--sans);
          font-size: 9.5px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
          margin-bottom: 6px;
        }
        .note-cover-trio-conditions {
          margin: 0;
          padding-left: 16px;
          font-family: var(--serif);
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--ink-soft);
          list-style: square;
        }

        /* Footer : ancre vers la suite */
        .note-cover-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0 0;
          border-top: 1px solid var(--hairline);
          font-family: var(--serif);
          font-size: 12.5px;
          color: var(--muted);
          font-style: italic;
        }
        .note-cover-jump {
          color: var(--accent);
          text-decoration: none;
          font-style: normal;
          font-weight: 500;
        }
        .note-cover-jump:hover {
          text-decoration: underline;
        }

        @media (max-width: 900px) {
          .note-cover-verdict {
            padding: 26px 24px 22px;
          }
          .note-cover-verdict-label {
            font-size: 32px;
          }
          .note-cover-verdict-stats {
            gap: 28px;
          }
          .note-cover-stat-num {
            font-size: 28px;
          }
          .note-cover-identity {
            padding: 20px 22px;
          }
          .note-cover-identity-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .note-cover-trio {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        /* SECTIONS - Numérotation grand format en serif italique, titre en
           serif affirmé. Pas de fond noir : on remplace par un trait haut
           fin et une numérotation qui descend dans la marge. */
        .note-section {
          margin-bottom: 64px;
          position: relative;
        }
        .note-section-title {
          font-family: var(--serif);
          font-size: 32px;
          font-weight: 600;
          line-height: 1.15;
          letter-spacing: -0.015em;
          padding: 0 0 14px 0;
          margin: 0 0 32px 0;
          background: transparent;
          color: var(--ink);
          border-bottom: 1px solid var(--ink);
          position: relative;
        }
        .note-section-num {
          font-family: var(--serif);
          font-size: 28px;
          font-weight: 400;
          font-style: italic;
          color: var(--ink-quaternary);
          margin-right: 14px;
          font-feature-settings: "lnum";
        }

        /* H3 - Sous-section. Style "kicker" éditorial : trait court à gauche,
           titre serif gras, espace généreux. */
        /* H3 - Sous-section. Style "kicker" éditorial : un filet horizontal
           court au-dessus du titre, titre serif gras, espace généreux.
           Quand un H3 suit immédiatement un autre H3 (sans contenu intermédiaire),
           on évite le double filet via :first-of-type. */
        .note-h3 {
          font-family: var(--serif);
          font-size: 21px;
          font-weight: 600;
          line-height: 1.25;
          margin-top: 56px;
          margin-bottom: 20px;
          padding-bottom: 0;
          padding-top: 16px;
          padding-left: 0;
          border-bottom: none;
          border-left: none;
          border-top: 1px solid var(--ink);
          letter-spacing: -0.01em;
          position: relative;
        }
        /* Le premier H3 d'une section n'a pas de filet (la section a deja son
           propre titre H2 avec filet de separation). */
        .note-section > .note-h3:first-of-type {
          margin-top: 32px;
          padding-top: 0;
          border-top: none;
        }

        /* H4 - Label de groupe. Style sans-serif uppercase tracking large,
           contrasté avec les serifs des H2/H3. C'est la signature éditoriale
           classique des publications économiques premium. */
        .note-h4 {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          font-size: 10.5px;
          font-weight: 700;
          margin-top: 28px;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--ink-tertiary);
        }

        /* PARAGRAPHES - Refonte pour aération maximale.
           
           Le passage d'une note dense à un livrable d'IC lisible exige :
           - Plus d'espace inter-paragraphes (16->24px)
           - Plus de leading inter-lignes (1.7->1.75)
           - Pas de justification sur paragraphes longs (la justification
             produit des "rivières" qui rendent les blocs encore plus denses)
           - Pas de hyphens auto (idem, casse le rythme visuel)
           
           Le plus important : limiter la largeur de colonne (max-width 68ch
           ~ 680px) pour respecter le confort de lecture optimal de 60-75
           caracteres par ligne (regle typographique standard).
        */
        .note-paragraph {
          margin: 0 0 22px 0;
          line-height: 1.78;
          font-size: 15.5px;
          color: var(--ink);
          text-align: left;
          hyphens: manual;
          max-width: 68ch;
          letter-spacing: 0.005em;
        }
        .note-paragraph:last-child {
          margin-bottom: 0;
        }
        .note-paragraph.muted {
          opacity: 0.55;
          font-style: italic;
        }
        
        /* PARAGRAPHE LARGE - Pour les zones de fond sombre (recommandation
           finale, résolution dialectique) ou les zones où le paragraphe
           doit s'étendre (encadrés, alertes). */
        .note-paragraph-wide {
          max-width: none;
        }
        
        /* PARAGRAPHE SUR FOND SOMBRE - Le bloc bleu encre de la
           recommandation finale necessite plus d aération encore parce que
           le contraste fort fatigue plus vite l œil. On augmente le leading
           a 1.85 et le margin a 28px pour vraiment respirer. */
        .note-paragraph-dark {
          margin: 0 0 28px 0;
          line-height: 1.85;
          font-size: 15.5px;
          color: #f4ede0;
          text-align: left;
          hyphens: manual;
          max-width: 72ch;
          letter-spacing: 0.005em;
        }
        .note-paragraph-dark:last-child {
          margin-bottom: 0;
        }
        
        /* CHIFFRE-CLÉ - Met en valeur les nombres importants dans la prose
           (montants EUR, ratios, pourcentages, scores). Pas de couleur
           agressive : juste un fond legerement contraste, une typo en
           feature lining-nums pour des chiffres alignes typographiquement,
           et un peu de poids. Le but est que l œil les attrape sans qu ils
           hurlent. */
        .num-key {
          font-feature-settings: "lnum", "tnum";
          font-weight: 600;
          padding: 1px 5px;
          background: rgba(58, 75, 110, 0.08);
          border-radius: 2px;
          white-space: nowrap;
        }
        /* Variante sur fond sombre */
        .note-paragraph-dark .num-key {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }
        
        /* ACCROCHE DE PARAGRAPHE - Premiere phrase courte qui donne le
           thesis du paragraphe, en small-caps pour creer une accroche
           visuelle sans tomber dans le bullet point. Style The Atlantic. */
        .lede {
          font-variant-caps: all-small-caps;
          letter-spacing: 0.04em;
          font-weight: 600;
          color: var(--ink);
          margin-right: 0.3em;
        }
        .note-paragraph-dark .lede {
          color: #f4ede0;
        }

        /* DROP CAP - Lettrine sur le premier paragraphe qui suit immédiatement
           un H3. Style FT/Economist : capitale grande, alignée sur 3 lignes,
           en serif gras. */
        .note-h3 + .note-paragraph::first-letter {
          font-family: var(--serif);
          font-size: 52px;
          font-weight: 700;
          line-height: 0.85;
          float: left;
          margin: 6px 10px 0 0;
          color: var(--ink);
        }

        /* PULL QUOTES - Phrase clé extraite du flow narratif et mise en
           exergue. Style FT/Economist : grande typo serif italique, guillemets
           typographiques surdimensionnés en gris clair, pas de bordures.
           La typo parle d'elle-même.

           Trois variantes selon le contexte :
           - Defaut : neutre, encre noire
           - .pull-quote-contrarian : accent bleu/vert pour case for
           - .pull-quote-blindspot : accent rouge sourd pour case against */
        .pull-quote {
          font-family: var(--serif);
          font-size: 22px;
          font-style: italic;
          font-weight: 400;
          line-height: 1.45;
          letter-spacing: -0.005em;
          color: var(--ink);
          margin: 32px 40px 32px 40px;
          padding: 8px 0;
          text-align: center;
          position: relative;
          border-top: 1px solid var(--ink);
          border-bottom: 1px solid var(--ink);
          padding-top: 28px;
          padding-bottom: 28px;
        }
        .pull-quote-mark {
          font-family: var(--serif);
          font-style: normal;
          font-size: 32px;
          font-weight: 400;
          color: var(--ink-quaternary);
          margin: 0 6px;
          vertical-align: -4px;
          line-height: 1;
        }
        .pull-quote-cite {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          font-style: normal;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-top: 18px;
        }
        .pull-quote-cite::before {
          content: '— ';
        }
        .pull-quote-contrarian {
          color: var(--semantic-positive);
          border-top-color: var(--semantic-positive);
          border-bottom-color: var(--semantic-positive);
        }
        .pull-quote-contrarian .pull-quote-mark {
          color: rgba(45, 74, 45, 0.5);
        }
        .pull-quote-blindspot {
          color: var(--semantic-critical);
          border-top-color: var(--semantic-critical);
          border-bottom-color: var(--semantic-critical);
        }
        .pull-quote-blindspot .pull-quote-mark {
          color: rgba(107, 26, 26, 0.5);
        }
        .pull-quote strong {
          font-style: italic;
          font-weight: 700;
        }

        /* TABLES - Style "data table" éditoriale : pas de bordures externes,
           hairlines internes très fines, label en sans-serif uppercase. */
        .note-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 22px;
          border-top: 1px solid var(--ink);
          border-bottom: 1px solid var(--ink);
        }
        .note-table td {
          padding: 12px 14px;
          border: none;
          border-bottom: 1px solid var(--hairline);
          vertical-align: top;
        }
        .note-table tr:last-child td {
          border-bottom: none;
        }
        .note-label {
          width: 30%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 600;
          background: transparent;
          color: var(--ink-tertiary);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .note-value {
          font-family: var(--serif);
          font-size: 14px;
          color: var(--ink);
          line-height: 1.55;
        }
        .note-value.bold {
          font-weight: 600;
        }

        /* MARKET SIZING - styles dedies au bloc TAM/SAM/SOM.
           Conception : table classique mais avec une mention discrete
           de la source en sous-ligne, et un indicateur de confiance
           type pastille.
           
           Le but est que le lecteur voie d un coup d œil :
             1. Le chiffre (gros, en gras)
             2. Le timeframe (gris, leger)
             3. La source (encore plus discret, en italique)
             4. La confiance (petit point colore) */
        .sizing-confidence {
          display: inline-block;
          margin-left: 6px;
          font-size: 10px;
          line-height: 1;
          vertical-align: middle;
        }
        .sizing-confidence[data-conf="high"]   { color: var(--semantic-positive); }
        .sizing-confidence[data-conf="medium"] { color: #a8732e; }
        .sizing-confidence[data-conf="low"]    { color: #8b2e1f; }
        
        .sizing-meta {
          color: var(--ink-tertiary);
          font-size: 12.5px;
          font-weight: 400;
        }
        .sizing-source {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          color: var(--ink-tertiary);
          font-style: italic;
          margin-top: 3px;
          letter-spacing: 0.01em;
        }
        
        /* PITCH ALIGNMENT - encadre discret qui signale les ecarts
           entre le TAM cite dans le pitch et le TAM verifie web.
           Code couleur :
             overestimated -> ocre attenue (pas alarmiste mais signal clair)
             underestimated -> vert sombre (rare, signal positif)
             pitch-not-cited -> gris ardoise (manque de rigueur founder) */
        .pitch-alignment {
          margin-top: 16px;
          padding: 10px 14px;
          border-left: 3px solid var(--ink-tertiary);
          background: #f4f0e6;
          font-size: 13px;
          line-height: 1.55;
        }
        .pitch-alignment-overestimated {
          border-left-color: #a8732e;
          background: #f7eedc;
        }
        .pitch-alignment-underestimated {
          border-left-color: var(--semantic-positive);
          background: #e8f0e8;
        }
        .pitch-alignment-pitch-not-cited {
          border-left-color: var(--ink-tertiary);
          background: #ede9de;
        }
        .pitch-alignment-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-right: 8px;
        }
        .pitch-alignment-value {
          font-weight: 600;
          color: var(--ink);
        }
        .pitch-alignment-note {
          margin-top: 6px;
          color: var(--ink);
        }

        /* TABLE FINANCIALS - Tableau à colonnes pour les projections.
           Style FT : header foncé, chiffres alignés à droite, lining numerals,
           hairlines internes seulement. */
        .note-financials-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 22px;
          font-size: 13px;
          border-top: 1px solid var(--ink);
          border-bottom: 1px solid var(--ink);
        }
        .note-financials-table th, .note-financials-table td {
          padding: 10px 12px;
          border: none;
          border-bottom: 1px solid var(--hairline);
          text-align: right;
          font-feature-settings: "lnum", "tnum";
        }
        .note-financials-table tr:last-child td {
          border-bottom: none;
        }
        .note-financials-table th {
          background: transparent;
          color: var(--ink);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--ink);
        }
        .note-financials-table .row-label {
          text-align: left;
          background: transparent;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          width: 28%;
        }
        .founder-block {
          margin-bottom: 22px;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--hairline);
        }
        .founder-block:last-child {
          border-bottom: none;
        }
        .founder-header {
          display: flex;
          gap: 10px;
          align-items: baseline;
          margin-bottom: 10px;
        }
        .founder-name {
          font-family: var(--serif);
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.005em;
        }
        .founder-role {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          color: var(--ink-tertiary);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .founder-fit {
          margin-left: auto;
          font-family: var(--serif);
          font-size: 13px;
          font-weight: 600;
          padding: 3px 10px;
          background: var(--ink);
          color: var(--paper);
          letter-spacing: 0.02em;
          font-feature-settings: "lnum";
        }
        /* Variantes pour signaler le degre d'instruction du score :
           non-instruit (donnees absentes) et partiel (donnees fragmentees).
           Ces variantes evitent que le lecteur lise un score plancher
           comme un mauvais profil. */
        .founder-fit-uneval {
          background: #5a564e;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .founder-fit-partial {
          background: #a8732e;
          font-size: 12px;
        }
        /* Le bloc fondateur non-instruit est legerement attenue pour
           signaler visuellement que ce n est pas un profil mauvais
           mais un profil non-instruit. */
        .founder-block-uneval {
          background: #f4f0e6;
          padding: 14px 16px;
          margin-bottom: 22px;
          border-left: 3px solid #5a564e;
        }
        .founder-text {
          font-size: 14px;
          margin-bottom: 6px;
          line-height: 1.65;
          color: var(--ink);
        }
        .founder-text strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-right: 6px;
        }

        /* VERDICT BOX - Boîte de récap chiffres clés. Style sobre fond crème
           clair, hairlines fines, typo de chiffres "lining numerals" pour
           alignement vertical parfait. */
        .verdict-box {
          background: var(--paper-accent);
          border: none;
          padding: 22px 26px;
          margin-bottom: 16px;
          border-top: 1px solid var(--ink);
          border-bottom: 1px solid var(--ink);
        }

        /* VERDICT HEADLINE - Verdict comme titre du bloc, ton fort.
           Le partner doit voir d abord la conclusion narrative, puis
           comprendre les chiffres qui la sous-tendent. */
        .verdict-headline {
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(29, 28, 26, 0.15);
          margin-bottom: 22px;
        }
        .verdict-headline-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          font-weight: 600;
          margin-bottom: 6px;
        }
        .verdict-headline-value {
          font-family: var(--serif);
          font-size: 36px;
          font-weight: 600;
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: var(--ink);
          text-transform: capitalize;
        }

        /* VERDICT BLOCK - Bloc semantique pour score d attractivite ou
           probabilite de succes. Numerote (1, 2) pour souligner la
           cascade narrative de la lecture. Tete avec numero, titre, et
           chiffre aligne a droite. */
        .verdict-block {
          margin-bottom: 22px;
        }
        .verdict-block-head {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 12px;
        }
        .verdict-block-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border: 1px solid var(--ink);
          border-radius: 50%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: var(--ink);
          flex: 0 0 auto;
          line-height: 1;
        }
        .verdict-block-title {
          flex: 1;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          font-weight: 600;
        }
        .verdict-block-figure {
          font-family: var(--serif);
          font-size: 30px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--ink);
          font-feature-settings: "lnum";
        }
        .verdict-block-legend {
          margin-top: 12px;
          font-family: var(--serif);
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--ink-soft);
          font-style: italic;
        }
        .verdict-block-audit {
          color: var(--ink);
          font-style: normal;
          font-weight: 500;
        }

        /* SUCCESS/FAILURE BAR - Barre bicolore qui materialise le partage
           probabilite succes / probabilite echec. Plus lisible qu un
           chiffre isole, et complementaire de la jauge demi-cercle du
           dashboard. */
        .success-failure-bar {
          display: flex;
          height: 28px;
          border: 1px solid var(--ink);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
        }
        .success-failure-bar .sf-success {
          background: var(--ink);
          color: var(--paper, #fffaf0);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
        }
        .success-failure-bar .sf-failure {
          background: transparent;
          color: var(--ink);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
        }
        .success-failure-bar .sf-success span,
        .success-failure-bar .sf-failure span {
          padding: 0 8px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* VERDICT READING - Synthèse narrative qui relie les deux chiffres
           et propose la suite logique. Texte adapte au verdict. Style
           sobre, italic, ressort de l ensemble par sa position
           terminale. */
        .verdict-reading {
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid rgba(29, 28, 26, 0.15);
        }
        .verdict-reading-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          font-weight: 600;
          margin-bottom: 6px;
        }
        .verdict-reading-text {
          font-family: var(--serif);
          font-size: 14px;
          line-height: 1.6;
          color: var(--ink);
        }

        .verdict-line {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 8px 0;
          border-bottom: 1px solid rgba(29, 28, 26, 0.1);
        }
        .verdict-line:last-child {
          border-bottom: none;
        }
        .verdict-line:last-child {
          border-bottom: none;
        }
        .verdict-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          font-weight: 500;
        }
        .verdict-value {
          font-family: var(--serif);
          font-size: 16px;
          font-weight: 600;
          text-transform: capitalize;
          color: var(--ink);
          font-feature-settings: "lnum";
        }
        .verdict-value.big {
          font-size: 32px;
          font-weight: 600;
          font-feature-settings: "lnum";
          text-transform: none;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .verdict-line.feature {
          padding: 14px 0;
          align-items: baseline;
        }

        /* Polish 3 : barre de seuils visuelle. Le score s affiche comme une
           position sur l axe REFUSER / APPROFONDIR / CONDITIONS / INVESTIR. */
        .score-thresholds {
          margin: 18px 0 8px;
          padding: 0 4px;
        }
        .score-thresholds-track {
          position: relative;
          display: flex;
          height: 14px;
          margin-bottom: 8px;
          border: 1px solid rgba(0,0,0,0.12);
        }
        .score-thresholds-track .zone {
          height: 100%;
        }
        .zone-refuser {
          background: linear-gradient(90deg, var(--semantic-critical-soft) 0%, var(--semantic-critical-soft) 100%);
        }
        .zone-approfondir {
          background: linear-gradient(90deg, var(--semantic-warning-soft) 0%, var(--semantic-warning-soft) 100%);
        }
        .zone-conditions {
          background: linear-gradient(90deg, #e8efe8 0%, #e8efe8 100%);
        }
        .zone-investir {
          background: linear-gradient(90deg, var(--semantic-positive-soft) 0%, var(--semantic-positive-soft) 100%);
        }
        .score-marker {
          position: absolute;
          top: -4px;
          width: 3px;
          height: 22px;
          background: #1a1a1a;
          transform: translateX(-50%);
          box-shadow: 0 0 0 2px rgba(255,255,255,0.9);
        }
        .score-thresholds-labels {
          display: grid;
          grid-template-columns: 45fr 15fr 15fr 25fr;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 600;
          color: #555;
          margin-bottom: 4px;
        }
        .score-thresholds-labels .lbl {
          text-align: center;
          padding: 0 4px;
        }
        .lbl-refuser { color: var(--semantic-critical); }
        .lbl-approfondir { color: #6b4d2c; }
        .lbl-conditions { color: var(--semantic-positive); }
        .lbl-investir { color: #1f3a1f; }
        .score-thresholds-axis {
          position: relative;
          height: 14px;
          font-size: 10px;
          color: #888;
          font-feature-settings: "lnum";
          display: flex;
          justify-content: space-between;
        }

        .risk-list {
          padding-left: 0;
          list-style: none;
          margin-bottom: 22px;
        }
        .risk-list li {
          padding: 16px 20px;
          margin-bottom: 10px;
          background: var(--paper-accent);
          border-left: 3px solid var(--ink);
          font-size: 14px;
          line-height: 1.65;
          color: var(--ink);
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        .risk-list li strong {
          font-weight: 600;
        }

        /* SIGNAL SCORE PILL - Big number stylé pour les patterns/signaux.
           Affichage en serif gras 22px, dans une "pastille" carrée à gauche du li.
           Couleur sourde rouge pour blindspot, vert pour contrarian. */
        .signal-score-pill {
          flex: 0 0 auto;
          font-family: var(--serif);
          font-size: 24px;
          font-weight: 700;
          font-feature-settings: "lnum";
          line-height: 1;
          padding: 8px 12px;
          min-width: 56px;
          text-align: center;
          letter-spacing: -0.02em;
          align-self: stretch;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .signal-score-blindspot {
          background: var(--semantic-critical);
          color: var(--paper);
        }
        .signal-score-contrarian {
          background: var(--semantic-positive);
          color: var(--paper);
        }
        .risk-sev {
          display: inline-block;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 9px;
          margin-right: 10px;
          font-weight: 700;
          border-radius: 3px;
          vertical-align: 1px;
        }
        .sev-low {
          background: #e8efe8;
          color: #1f3a1f;
          border: 1px solid #cfd8cf;
        }
        .sev-medium {
          background: var(--semantic-warning-soft);
          color: var(--semantic-warning);
          border: 1px solid #ead9b3;
        }
        .sev-high {
          background: #fce0cc;
          color: #6b2f0e;
          border: 1px solid #f0b896;
        }
        .sev-critical {
          background: var(--semantic-critical-soft);
          color: #5e0f0f;
          border: 1px solid #e89696;
        }
        .matrix-wrap {
          overflow-x: auto;
          margin-bottom: 12px;
        }
        /* MATRIX - Tableau de positionnement compétitif. Hairlines internes,
           pas de fond noir sur les en-têtes (on garde la légèreté éditoriale). */
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          border-top: 1px solid var(--ink);
          border-bottom: 1px solid var(--ink);
        }
        .matrix-table th, .matrix-table td {
          padding: 8px 10px;
          border: none;
          border-bottom: 1px solid var(--hairline);
          border-right: 1px solid var(--hairline);
          text-align: center;
        }
        .matrix-table th:last-child, .matrix-table td:last-child {
          border-right: none;
        }
        .matrix-table tr:last-child td {
          border-bottom: none;
        }
        .matrix-dim {
          background: transparent;
          color: var(--ink);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 700;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--ink) !important;
        }
        .matrix-player {
          text-align: left !important;
          background: transparent;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--ink-tertiary);
        }
        .matrix-table tr.target .matrix-player {
          background: var(--ink);
          color: var(--paper);
          font-family: var(--serif);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0;
          text-transform: none;
        }
        .matrix-table tr.target td {
          background: var(--paper-accent);
        }
        .cov-yes { color: #1f3a1f; font-weight: 700; font-size: 14px; }
        .cov-no { color: var(--semantic-critical); font-size: 14px; }

        /* ALERT BOX - Encart d'alertes critiques. Style "callout" éditorial :
           bordure gauche épaisse rouge sourd, fond crème un peu plus saturé. */
        .alert-box {
          padding: 18px 22px;
          background: var(--paper-warm);
          border: none;
          border-left: 4px solid var(--semantic-critical);
          margin-bottom: 18px;
          font-size: 13px;
          line-height: 1.65;
        }
        .alert-box strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--semantic-critical);
          display: block;
          margin-bottom: 8px;
        }
        .alert-box ul {
          margin: 0;
          padding-left: 18px;
          color: var(--ink);
        }
        .alert-box ul li {
          margin-bottom: 6px;
        }

        /* TECH CLAIM COHERENCE - Section dediee a l audit de la
           revendication technologique. Trois lignes de tests + verdict +
           questions DD. */
        .tech-claim-tests {
          margin: 16px 0 20px;
          border: 1px solid var(--hairline);
          border-radius: 4px;
          overflow: hidden;
        }
        .tech-claim-row {
          display: grid;
          grid-template-columns: 200px 80px 1fr;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--hairline-soft);
          font-size: 13px;
          line-height: 1.55;
        }
        .tech-claim-row:last-child { border-bottom: none; }
        .tech-claim-test-name {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--ink-soft);
        }
        .tech-claim-test-score {
          font-family: var(--serif);
          font-size: 16px;
          font-weight: 700;
          text-align: center;
          padding: 4px 10px;
          border-radius: 12px;
          letter-spacing: 0.02em;
        }
        .tech-claim-test-score.pass {
          color: var(--vert-foret, #1f5f3f);
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.08));
        }
        .tech-claim-test-score.fail {
          color: var(--warn, #b14842);
          background: rgba(177, 72, 66, 0.08);
        }
        .tech-claim-test-obs {
          color: var(--ink-soft);
          font-style: italic;
        }
        .tech-claim-verdict {
          padding: 14px 18px;
          margin: 16px 0 14px;
          border-radius: 4px;
          font-size: 13.5px;
          line-height: 1.6;
          border-left: 4px solid;
        }
        .tech-claim-verdict strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-right: 6px;
        }
        .tech-claim-verdict-tech_credible {
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.06));
          border-color: var(--vert-foret, #1f5f3f);
          color: var(--ink);
        }
        .tech-claim-verdict-tech_partially_substantiated {
          background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.08));
          border-color: var(--ocre-brule, #b47832);
          color: var(--ink);
        }
        .tech-claim-verdict-tech_storytelling {
          background: rgba(177, 72, 66, 0.06);
          border-color: var(--warn, #b14842);
          color: var(--ink);
        }
        .tech-claim-questions {
          padding: 14px 18px;
          background: var(--paper-accent, var(--surface));
          border-radius: 4px;
          margin-bottom: 18px;
          font-size: 13px;
          line-height: 1.65;
        }
        .tech-claim-questions strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-soft);
          display: block;
          margin-bottom: 8px;
        }
        .tech-claim-questions ul {
          margin: 0;
          padding-left: 18px;
        }
        .tech-claim-questions ul li { margin-bottom: 6px; }

        @media (max-width: 700px) {
          .tech-claim-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }
        }

        /* EXECUTION FRICTION - Section dediee a la friction
           commerciale et industrielle. Huit axes notes, ton descriptif
           et neutre. Code couleur uniquement sur intensite (low/medium/high)
           sans connotation valeur. */
        .exec-friction-axes {
          margin: 16px 0 20px;
          border: 1px solid var(--hairline);
          border-radius: 4px;
          overflow: hidden;
        }
        .exec-friction-row {
          display: grid;
          grid-template-columns: 220px 70px 1fr;
          align-items: start;
          gap: 14px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--hairline-soft);
          font-size: 13px;
          line-height: 1.55;
        }
        .exec-friction-row:last-child { border-bottom: none; }
        .exec-friction-axis-name {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--ink-soft);
        }
        .exec-friction-score {
          font-family: var(--serif);
          font-size: 16px;
          font-weight: 700;
          text-align: center;
          padding: 4px 10px;
          border-radius: 12px;
          letter-spacing: 0.02em;
          color: var(--ink-soft);
          background: var(--paper-accent, var(--surface));
        }
        .exec-friction-low .exec-friction-score {
          color: var(--vert-foret, #1f5f3f);
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.08));
        }
        .exec-friction-medium .exec-friction-score {
          color: var(--ocre-brule, #b47832);
          background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.08));
        }
        .exec-friction-high .exec-friction-score {
          color: var(--warn, #b14842);
          background: rgba(177, 72, 66, 0.08);
        }
        .exec-friction-evidence {
          color: var(--ink);
          margin-bottom: 6px;
        }
        .exec-friction-implication {
          color: var(--ink-soft);
          font-style: italic;
        }
        .exec-friction-verdict {
          padding: 14px 18px;
          margin: 16px 0 14px;
          border-radius: 4px;
          font-size: 13.5px;
          line-height: 1.6;
          border-left: 4px solid;
        }
        .exec-friction-verdict strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-right: 6px;
        }
        .exec-friction-verdict-friction_low {
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.06));
          border-color: var(--vert-foret, #1f5f3f);
          color: var(--ink);
        }
        .exec-friction-verdict-friction_medium {
          background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.06));
          border-color: var(--ocre-brule, #b47832);
          color: var(--ink);
        }
        .exec-friction-verdict-friction_high {
          background: rgba(177, 72, 66, 0.05);
          border-color: var(--warn, #b14842);
          color: var(--ink);
        }
        .exec-friction-verdict-friction_structural {
          background: var(--paper-accent, var(--surface));
          border-color: var(--ink-tertiary, #6b6b6b);
          color: var(--ink);
        }
        .exec-friction-questions {
          padding: 14px 18px;
          background: var(--paper-accent, var(--surface));
          border-radius: 4px;
          margin-bottom: 18px;
          font-size: 13px;
          line-height: 1.65;
        }
        .exec-friction-questions strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-soft);
          display: block;
          margin-bottom: 8px;
        }
        .exec-friction-questions ul {
          margin: 0;
          padding-left: 18px;
        }
        .exec-friction-questions ul li { margin-bottom: 6px; }

        @media (max-width: 700px) {
          .exec-friction-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }
        }

        /* DD FINANCIER - Section Data Room. Confrontation BP projete
           vs realite comptable. Sept tests cote a cote, severity en
           code couleur (aligned vert / attention ocre / alert rouge anglais
           / red_flag rouge profond), evidence chiffree, question DD. */
        .dd-tests {
          margin: 16px 0 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .dd-test-row {
          border: 1px solid var(--hairline);
          border-left: 4px solid var(--hairline);
          border-radius: 4px;
          padding: 14px 16px;
          background: var(--surface);
          font-size: 13px;
          line-height: 1.55;
        }
        .dd-test-aligned { border-left-color: var(--vert-foret, #1f5f3f); }
        .dd-test-attention { border-left-color: var(--ocre-brule, #b47832); }
        .dd-test-alert { border-left-color: var(--warn, #b14842); }
        .dd-test-red_flag { border-left-color: #7a2520; background: rgba(122, 37, 32, 0.04); }
        .dd-test-not_assessable { border-left-color: var(--ink-tertiary, #6b6b6b); }
        .dd-test-non_documented { border-left-color: var(--ink-tertiary, #6b6b6b); background: rgba(107, 107, 107, 0.03); }

        .dd-test-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .dd-test-id {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          font-weight: 700;
          color: var(--ink-soft);
          background: var(--paper-accent, var(--surface));
          padding: 2px 8px;
          border-radius: 10px;
        }
        .dd-test-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--ink);
          flex: 1;
        }
        .dd-test-pill {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 11px;
          font-size: 10.5px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: 0.04em;
          font-weight: 600;
        }
        .dd-test-pill-aligned {
          color: var(--vert-foret, #1f5f3f);
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.08));
        }
        .dd-test-pill-attention {
          color: var(--ocre-brule, #b47832);
          background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.08));
        }
        .dd-test-pill-alert {
          color: var(--warn, #b14842);
          background: rgba(177, 72, 66, 0.08);
        }
        .dd-test-pill-red_flag {
          color: #fff;
          background: #7a2520;
        }
        .dd-test-pill-not_assessable {
          color: var(--ink-soft);
          background: var(--paper-accent, var(--surface));
        }
        .dd-test-pill-non_documented {
          color: var(--ink-soft);
          background: var(--paper-accent, var(--surface));
          font-style: italic;
        }

        .dd-test-values {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 8px;
          font-size: 13px;
          padding: 10px 12px;
          background: var(--paper-accent, var(--surface));
          border-radius: 4px;
        }
        .dd-test-values strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-soft);
          display: block;
          margin-bottom: 3px;
          font-weight: 700;
        }
        .dd-test-evidence {
          font-size: 13px;
          color: var(--ink);
          margin-bottom: 8px;
        }
        .dd-test-question {
          font-size: 12.5px;
          color: var(--ink-soft);
          font-style: italic;
          padding-top: 6px;
          border-top: 1px dotted var(--hairline-soft);
        }
        .dd-test-question strong {
          font-style: normal;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink);
          margin-right: 4px;
        }

        .dd-verdict {
          padding: 14px 18px;
          margin: 16px 0 14px;
          border-radius: 4px;
          font-size: 13.5px;
          line-height: 1.6;
          border-left: 4px solid;
        }
        .dd-verdict strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-right: 6px;
        }
        .dd-verdict-dd_aligned {
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.06));
          border-color: var(--vert-foret, #1f5f3f);
          color: var(--ink);
        }
        .dd-verdict-dd_partial_alignment {
          background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.06));
          border-color: var(--ocre-brule, #b47832);
          color: var(--ink);
        }
        .dd-verdict-dd_significant_gaps {
          background: rgba(177, 72, 66, 0.06);
          border-color: var(--warn, #b14842);
          color: var(--ink);
        }
        .dd-verdict-dd_red_flags {
          background: rgba(122, 37, 32, 0.07);
          border-color: #7a2520;
          color: var(--ink);
        }

        /* DD TECHNIQUE - verdicts module 3.
           Sept niveaux paralleles aux verdicts ddf/ddc, avec un
           code couleur identique pour faciliter la lecture
           transverse Bloc 2. tech_under_documented utilise un
           registre neutre car ce n est pas un red flag, juste un
           dossier insuffisant a juger. */
        .dd-verdict-tech_strong {
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.06));
          border-color: var(--vert-foret, #1f5f3f);
          color: var(--ink);
        }
        .dd-verdict-tech_solid {
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.04));
          border-color: var(--vert-foret, #1f5f3f);
          color: var(--ink);
        }
        .dd-verdict-tech_partial {
          background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.06));
          border-color: var(--ocre-brule, #b47832);
          color: var(--ink);
        }
        .dd-verdict-tech_concerns {
          background: rgba(177, 72, 66, 0.06);
          border-color: var(--warn, #b14842);
          color: var(--ink);
        }
        .dd-verdict-tech_red_flags {
          background: rgba(122, 37, 32, 0.07);
          border-color: #7a2520;
          color: var(--ink);
        }
        .dd-verdict-tech_under_documented {
          background: var(--paper-accent, var(--surface));
          border-color: var(--ink-tertiary, #6b6b6b);
          color: var(--ink);
        }
        .dd-verdict-not_applicable {
          background: var(--paper-accent, var(--surface));
          border-color: var(--ink-tertiary, #6b6b6b);
          color: var(--ink-soft);
        }

        /* DD DEEPEN BANNER - Bandeau Passer en DD approfondie.
           Apparait dans la note quand le verdict Bloc 1 autorise la
           DD (different de refuser) et qu aucune section Data Room
           n est encore triggered. Visuellement marque comme une
           transition de phase, pas comme un simple bouton : tag
           uppercase, titre, description, bouton primaire. */
        .dd-deepen-banner {
          margin: 24px 0 28px;
          padding: 22px 24px;
          border: 1px solid var(--accent, #1a2e4a);
          border-left: 4px solid var(--accent, #1a2e4a);
          background: var(--paper, #fffaf0);
          border-radius: 4px;
        }
        .dd-deepen-banner-tag {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--accent, #1a2e4a);
          margin-bottom: 8px;
        }
        .dd-deepen-banner-title {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 600;
          line-height: 1.25;
          color: var(--ink);
          margin-bottom: 10px;
        }
        .dd-deepen-banner-desc {
          font-size: 14px;
          line-height: 1.6;
          color: var(--ink);
          margin-bottom: 16px;
        }
        .dd-deepen-banner-btn {
          margin-top: 4px;
        }

        .dd-questions {
          padding: 14px 18px;
          background: var(--paper-accent, var(--surface));
          border-radius: 4px;
          margin-bottom: 18px;
          font-size: 13px;
          line-height: 1.65;
        }
        .dd-questions strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-soft);
          display: block;
          margin-bottom: 8px;
        }
        .dd-questions ol {
          margin: 0;
          padding-left: 20px;
        }
        .dd-questions ol li {
          margin-bottom: 8px;
          padding-left: 4px;
        }

        @media (max-width: 700px) {
          .dd-test-values { grid-template-columns: 1fr; }
        }

        /* DD CONTRACTUEL - Section Data Room contractuelle.
           Cartographie des clauses sensibles avec citation exacte
           mot pour mot. */
        .ddc-disclaimer {
          background: var(--paper-accent, var(--surface));
          border-left: 3px solid var(--ink-tertiary, #6b6b6b);
          padding: 10px 14px;
          margin: 8px 0 16px;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--ink-soft);
          font-style: italic;
        }
        .ddc-disclaimer-line {
          margin-bottom: 4px;
        }
        .ddc-disclaimer-line:last-child { margin-bottom: 0; }

        .ddc-cap-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
          margin: 12px 0 16px;
          padding: 14px 18px;
          background: var(--paper-accent, var(--surface));
          border-radius: 4px;
          font-size: 13px;
        }
        .ddc-cap-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dotted var(--hairline-soft);
        }
        .ddc-cap-row span {
          color: var(--ink-soft);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11.5px;
          letter-spacing: 0.04em;
        }
        .ddc-cap-row strong {
          font-variant-numeric: tabular-nums;
          color: var(--ink);
        }
        .ddc-cap-flags {
          margin: 8px 0 16px;
          padding-left: 22px;
          font-size: 12.5px;
          color: var(--ink-soft);
        }
        .ddc-cap-flags li { margin-bottom: 4px; }

        .ddc-clauses {
          margin: 14px 0 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ddc-clause-row {
          border: 1px solid var(--hairline);
          border-left: 4px solid var(--hairline);
          border-radius: 4px;
          padding: 14px 16px;
          background: var(--surface);
          font-size: 13px;
          line-height: 1.55;
        }
        .ddc-clause-standard { border-left-color: var(--vert-foret, #1f5f3f); }
        .ddc-clause-attention { border-left-color: var(--ocre-brule, #b47832); }
        .ddc-clause-non_standard { border-left-color: var(--warn, #b14842); }
        .ddc-clause-red_flag { border-left-color: #7a2520; background: rgba(122, 37, 32, 0.04); }
        .ddc-clause-not_found { border-left-color: var(--ink-tertiary, #6b6b6b); opacity: 0.75; }

        .ddc-clause-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .ddc-clause-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--ink);
          flex: 1;
        }
        .ddc-clause-pill {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 11px;
          font-size: 10.5px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: 0.04em;
          font-weight: 600;
        }
        .ddc-clause-pill-standard {
          color: var(--vert-foret, #1f5f3f);
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.08));
        }
        .ddc-clause-pill-attention {
          color: var(--ocre-brule, #b47832);
          background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.08));
        }
        .ddc-clause-pill-non_standard {
          color: var(--warn, #b14842);
          background: rgba(177, 72, 66, 0.08);
        }
        .ddc-clause-pill-red_flag {
          color: #fff;
          background: #7a2520;
        }
        .ddc-clause-pill-not_found {
          color: var(--ink-soft);
          background: var(--paper-accent, var(--surface));
        }
        .ddc-clause-citation {
          font-family: var(--serif);
          font-size: 13.5px;
          color: var(--ink);
          padding: 10px 14px;
          margin: 6px 0;
          background: var(--paper-accent, var(--surface));
          border-left: 2px solid var(--ink-tertiary, #6b6b6b);
          font-style: italic;
        }
        .ddc-clause-meta {
          font-size: 11.5px;
          color: var(--ink-soft);
          margin: 4px 0;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ddc-clause-meta strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .ddc-clause-market {
          font-size: 12.5px;
          color: var(--ink);
          margin: 6px 0;
        }
        .ddc-clause-market strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-soft);
          margin-right: 4px;
        }
        .ddc-clause-implication {
          font-size: 12.5px;
          color: var(--ink);
          margin: 6px 0;
        }
        .ddc-clause-question {
          font-size: 12.5px;
          color: var(--ink-soft);
          font-style: italic;
          padding-top: 8px;
          margin-top: 6px;
          border-top: 1px dotted var(--hairline-soft);
        }
        .ddc-clause-question strong {
          font-style: normal;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink);
          margin-right: 4px;
        }

        .ddc-flags {
          margin: 14px 0 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ddc-flag-row {
          border: 1px solid var(--hairline);
          border-left: 4px solid var(--hairline);
          border-radius: 4px;
          padding: 12px 14px;
          background: var(--surface);
          font-size: 12.5px;
        }
        .ddc-flag-standard { border-left-color: var(--vert-foret, #1f5f3f); }
        .ddc-flag-attention { border-left-color: var(--ocre-brule, #b47832); }
        .ddc-flag-non_standard { border-left-color: var(--warn, #b14842); }
        .ddc-flag-red_flag { border-left-color: #7a2520; background: rgba(122, 37, 32, 0.04); }
        .ddc-flag-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
          flex-wrap: wrap;
        }
        .ddc-flag-type {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--ink);
        }
        .ddc-flag-contract {
          font-size: 11.5px;
          color: var(--ink-soft);
          font-style: italic;
          flex: 1;
        }

        .ddc-verdict {
          padding: 14px 18px;
          margin: 16px 0 14px;
          border-radius: 4px;
          font-size: 13.5px;
          line-height: 1.6;
          border-left: 4px solid;
        }
        .ddc-verdict strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-right: 6px;
        }
        .ddc-verdict-contractual_aligned {
          background: var(--vert-foret-soft, rgba(31, 95, 63, 0.06));
          border-color: var(--vert-foret, #1f5f3f);
          color: var(--ink);
        }
        .ddc-verdict-contractual_attention {
          background: var(--ocre-brule-soft, rgba(180, 120, 50, 0.06));
          border-color: var(--ocre-brule, #b47832);
          color: var(--ink);
        }
        .ddc-verdict-contractual_significant_gaps {
          background: rgba(177, 72, 66, 0.06);
          border-color: var(--warn, #b14842);
          color: var(--ink);
        }
        .ddc-verdict-contractual_red_flags {
          background: rgba(122, 37, 32, 0.07);
          border-color: #7a2520;
          color: var(--ink);
        }

        @media (max-width: 700px) {
          .ddc-cap-summary { grid-template-columns: 1fr; }
        }

        /* BLOCK MARKERS - Separateurs visuels entre Bloc 1 (Note
           d instruction / screening) et Bloc 2 (Data Room / DD
           approfondie). Le partner senior doit voir d un coup d oeil
           ou il est dans la note. Page break PDF avant le Bloc 2
           pour qu il demarre sur une page nouvelle a l export. */
        .block-marker {
          margin: 18px 0 30px;
          padding: 22px 28px;
          background: linear-gradient(135deg, #16213a 0%, #1f2d4a 100%);
          color: #fafaf6;
          border-radius: 6px;
          position: relative;
          overflow: hidden;
        }
        .block-marker-instruction {
          background: linear-gradient(135deg, #16213a 0%, #243352 100%);
        }
        .block-marker-dataroom {
          background: linear-gradient(135deg, #4a3320 0%, #5e4128 100%);
          margin-top: 60px;
          /* Page break en mode print pour que le Bloc 2 commence sur
             une nouvelle page a l export PDF. */
          page-break-before: always;
        }
        .block-marker-tag {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.55);
          margin-bottom: 6px;
        }
        .block-marker-title {
          font-family: var(--serif);
          font-size: 26px;
          font-weight: 600;
          color: #fafaf6;
          letter-spacing: -0.01em;
          line-height: 1.2;
          margin-bottom: 4px;
        }
        .block-marker-sub {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 12px;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.78);
          font-style: italic;
        }

        @media print {
          .block-marker-dataroom {
            page-break-before: always !important;
            break-before: page !important;
          }
        }

        /* ORDERED LIST - Listes numérotées style éditorial. */
        .ordered-list {
          padding-left: 24px;
          margin: 14px 0 22px;
        }
        .ordered-list li {
          margin-bottom: 10px;
          font-size: 14px;
          line-height: 1.65;
          padding-left: 6px;
        }
        .ordered-list li::marker {
          font-family: var(--serif);
          font-weight: 600;
          color: var(--ink-tertiary);
        }

        /* BENCHMARK BLOCK - Encarts pour les comparables. Style "sidebar"
           éditorial : fond crème légèrement saturé, hairline gauche, espacement
           généreux.
           Le bloc change de couleur selon cautionLevel pour signaler
           visuellement la nature du comparable cite : reference positive
           (bleu encre), a nuancer (ocre brule), avertissement (rouge anglais).
           Le lecteur sait du premier coup d oeil si on cite un succes ou
           un cas d ecole d echec. */
        .benchmark-block {
          margin-bottom: 18px;
          padding: 16px 20px;
          background: var(--paper-accent);
          border-left: 3px solid var(--ink);
        }

        /* COMPARABLE SCOPE NOTE - Preambule explicatif au-dessus des
           sections comparables, qui indique au lecteur si les comparables
           qui suivent sont sectoriels ou de pattern. Style sobre italic
           hairline, ne distrait pas du contenu mais le contextualise. */
        .comparable-scope-note {
          font-family: var(--serif);
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--ink-soft);
          font-style: italic;
          margin-top: -8px;
          margin-bottom: 18px;
          padding: 10px 14px;
          background: rgba(29, 28, 26, 0.03);
          border-left: 2px solid var(--hairline);
        }

        /* ASSET CLASS TAG - Tag visuel par carte de comparable indiquant
           le degre d alignement asset class (high / medium / low). En
           low, signale explicitement qu il s agit d un comparable de
           pattern et non sectoriel. */
        .asset-class-tag {
          margin-bottom: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10.5px;
          line-height: 1.5;
          letter-spacing: 0.04em;
          padding: 5px 10px;
          border-radius: 2px;
          font-weight: 500;
        }
        .asset-class-tag.asset-class-high {
          background: rgba(59, 122, 90, 0.10);
          color: #2d5a44;
          border-left: 2px solid #3b7a5a;
        }
        .asset-class-tag.asset-class-medium {
          background: rgba(122, 92, 31, 0.08);
          color: #5a4a32;
          border-left: 2px solid #7a5c1f;
        }
        .asset-class-tag.asset-class-low {
          background: rgba(139, 46, 31, 0.08);
          color: #6a3525;
          border-left: 2px solid #8b2e1f;
          font-weight: 600;
        }

        /* BENCHMARK SECTOR - Petit label sous le header qui rappelle le
           secteur du comparable, pour que le lecteur identifie tout de
           suite l asset class du comparable. */
        .benchmark-sector {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          color: var(--ink-tertiary);
          letter-spacing: 0.06em;
          margin-bottom: 8px;
          font-style: italic;
        }

        .benchmark-block.caution-positive {
          background: var(--paper-accent);
          border-left-color: var(--accent-marque);
        }
        .benchmark-block.caution-caveat {
          background: #f3e3c8;
          border-left-color: #a8732e;
        }
        .benchmark-block.caution-tale {
          background: #f4dccf;
          border-left-color: #8b2e1f;
        }
        .benchmark-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 10px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .benchmark-name {
          font-family: var(--serif);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.005em;
        }
        .benchmark-geo {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          color: var(--ink-tertiary);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 600;
        }
        /* Bloc badges sous le header : caution level + statut. Disposes
           horizontalement, tres compact, lecture rapide. */
        .benchmark-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .benchmark-badge {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 8px;
        }
        .benchmark-badge.caution-positive {
          background: var(--accent-marque);
          color: var(--paper);
        }
        .benchmark-badge.caution-caveat {
          background: #a8732e;
          color: var(--paper);
        }
        .benchmark-badge.caution-tale {
          background: #8b2e1f;
          color: var(--paper);
        }
        .benchmark-badge.status-confirmed {
          background: #2d4a2e;
          color: var(--paper);
        }
        .benchmark-badge.status-promising {
          background: #3a5378;
          color: var(--paper);
        }
        .benchmark-badge.status-fragile {
          background: #8a7a3c;
          color: var(--paper);
        }
        .benchmark-badge.status-difficulty {
          background: var(--semantic-critical);
          color: var(--paper);
        }
        .benchmark-badge.status-too-early {
          background: #5a564e;
          color: var(--paper);
        }
        .benchmark-bet, .benchmark-relevance {
          font-size: 14px;
          margin-bottom: 8px;
          line-height: 1.65;
          color: var(--ink);
        }
        .benchmark-bet strong, .benchmark-relevance strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-right: 6px;
        }

        /* ACTION LIST - Liste d'actions du structuring plan. */
        .action-list {
          list-style: none;
          padding-left: 0;
          margin: 8px 0 18px;
        }
        .action-list li {
          padding: 12px 0;
          border-bottom: 1px solid var(--hairline);
          font-size: 14px;
          line-height: 1.55;
          font-size: 12px;
          line-height: 1.5;
        }
        .action-list li:last-child { border-bottom: none; }
        .action-axis {
          display: inline-block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          background: var(--ink);
          color: var(--paper);
          padding: 3px 10px;
          margin-right: 12px;
          font-weight: 700;
        }

        /* REFERENCE CHECKS - Plan d appels DD terrain
           Section dense en bas de la note pour donner au partner
           le plan de DD direct exploitable, classe par categorie. */
        .refcheck-priority {
          margin: 16px 0 24px;
          padding: 14px 18px;
          background: var(--paper-accent);
          border-left: 3px solid var(--accent);
        }
        .refcheck-priority-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
          margin-bottom: 8px;
        }
        .refcheck-priority-list {
          margin: 0;
          padding-left: 18px;
          font-family: var(--serif);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink);
        }
        .refcheck-priority-list li {
          margin-bottom: 4px;
        }
        .refcheck-block {
          margin: 20px 0 24px;
        }
        .refcheck-block-head {
          display: flex;
          align-items: baseline;
          gap: 14px;
          padding-bottom: 8px;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--hairline);
        }
        .refcheck-block-tag {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 600;
        }
        .refcheck-block-count {
          font-family: var(--serif);
          font-size: 12.5px;
          font-style: italic;
          color: var(--muted);
        }
        .refcheck-item {
          padding: 12px 0 14px;
          border-bottom: 1px solid var(--hairline);
        }
        .refcheck-item:last-child {
          border-bottom: none;
        }
        .refcheck-item-name {
          font-family: var(--serif);
          font-size: 14.5px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 6px;
        }
        .refcheck-item-name-company {
          font-weight: 400;
          font-style: italic;
          color: var(--muted);
        }
        .refcheck-item-detail {
          font-family: var(--serif);
          font-size: 13px;
          color: var(--ink-soft);
          line-height: 1.5;
          margin-bottom: 6px;
        }
        .refcheck-item-detail.muted {
          color: var(--muted);
          font-style: italic;
        }
        .refcheck-item-detail-label {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
        }
        .refcheck-questions {
          margin: 6px 0 0;
          padding-left: 18px;
          font-family: var(--serif);
          font-size: 13px;
          line-height: 1.55;
          color: var(--ink-soft);
        }
        .refcheck-questions li {
          margin-bottom: 3px;
        }
        .refcheck-status {
          margin-left: 10px;
          font-family: var(--sans);
          font-size: 9.5px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 2px;
        }
        .refcheck-status-unknown { background: var(--hairline); color: var(--muted); }
        .refcheck-status-pilot { background: rgba(180, 95, 30, 0.15); color: rgb(180, 95, 30); }
        .refcheck-status-contract { background: rgba(21, 128, 61, 0.15); color: rgb(21, 128, 61); }
        .refcheck-status-announced { background: rgba(94, 75, 41, 0.15); color: rgb(94, 75, 41); }
        .refcheck-redflags {
          margin: 24px 0;
          padding: 18px 22px;
          background: var(--rouge-anglais-soft);
          border-left: 3px solid var(--rouge-anglais);
        }
        .refcheck-redflags-label {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--rouge-anglais);
          font-weight: 600;
          margin-bottom: 10px;
        }
        .refcheck-redflags-list {
          margin: 0;
          padding-left: 18px;
          font-family: var(--serif);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink);
        }
        .refcheck-redflags-list li {
          margin-bottom: 5px;
        }

        /* DATELINE - Date d'analyse stylée comme une dateline d'article presse.
           Format : ● 1 MAI 2026 · NOTE PRELIMINAIRE IC
           Bullet rouge sourd type "live news", date en uppercase letter-spacing
           large, separateur en gris discret. */
        .dd-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-bottom: 26px;
        }
        .dd-meta-bullet {
          color: var(--semantic-critical);
          font-size: 9px;
          line-height: 1;
        }
        .dd-meta-sep {
          color: var(--ink-quaternary);
          font-size: 11px;
          margin: 0 2px;
        }
        .dd-meta-text {
          color: var(--ink-tertiary);
        }

        /* SECTION SOURCES & METHODOLOGY - Documentation des references
           externes consolidees. Style "endnote" classique de publication
           economique. Filet horizontal, typo plus petite, espacement sobre. */
        .note-sources {
          margin-top: 64px;
          padding-top: 32px;
          border-top: 1px solid var(--ink);
        }
        .note-sources .note-h4 {
          margin-top: 0;
          margin-bottom: 14px;
        }
        .note-sources-intro {
          font-family: var(--serif);
          font-size: 13px;
          font-style: italic;
          color: var(--ink-tertiary);
          line-height: 1.65;
          margin: 0 0 18px 0;
        }
        .note-sources-list {
          list-style: none;
          padding-left: 0;
          margin: 0;
          counter-reset: source;
        }
        .note-sources-list li {
          position: relative;
          padding-left: 32px;
          margin-bottom: 12px;
          font-size: 12px;
          line-height: 1.6;
          counter-increment: source;
        }
        .note-sources-list li::before {
          content: counter(source);
          position: absolute;
          left: 0;
          top: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--paper);
          background: var(--ink);
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-feature-settings: "lnum";
        }
        .note-sources-list li strong {
          font-family: var(--serif);
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: -0.005em;
        }
        .note-sources-detail {
          color: var(--ink-secondary);
        }

        /* COLOPHON - Footer stylé comme un colophon d'article. Filet horizontal,
           texte centré en sans-serif uppercase, deux lignes courtes. */
        .note-footer {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid rgba(29, 28, 26, 0.4);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          font-weight: 500;
          color: var(--ink-tertiary);
          text-align: center;
          line-height: 1.8;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        @media print {
          .investment-note {
            padding: 0;
            max-width: 100%;
            background: #fff;
          }
          .note-section-title {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
