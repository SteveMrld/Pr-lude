'use client';

// ============================================================
// LANDING PAGE V3 — refonte complete
// ------------------------------------------------------------
// Direction visuelle : editorial moderne sobre, palette bleu nuit
// + creme. Reference Linear / Stripe Docs / The Browser Company.
// Coherence totale avec le HomeClient existant : meme palette
// (--accent bleu encre, --paper creme), meme typographie (serif
// editorial pour les titres, sans-serif pour la voix UI), memes
// composants visuels (filets fins, dropcaps, italique).
//
// Pas de rouge agressif. Le bleu nuit --accent (#1a2e4a) suffit
// comme couleur d identite. Pictos custom Prelude pour les sections.
// ============================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Picto, type PictoName } from './Picto';

interface DemoStage {
  engine: string;
  picto: PictoName;
  action: string;
  output: string;
}

const DEMO_STAGES: DemoStage[] = [
  { engine: 'Lecture du dossier',     picto: 'lecture',       action: 'Pitch deck ingéré',         output: 'Dossier reconnu : 28 pages, modèle financier en annexe Excel.' },
  { engine: 'Équipe',                 picto: 'equipe',        action: 'Profils croisés',           output: 'Founder Market Fit : 78/100. Trois cofondateurs, antécédents corporate notables.' },
  { engine: 'Marché',                 picto: 'marche',        action: 'Taille adressable testée',  output: 'TAM revendiqué 12 Md€ vérifié à 9,8 Md€. Croissance 14 % CAGR confirmée.' },
  { engine: 'Macro',                  picto: 'macro',         action: 'Contexte sectoriel',        output: 'Vent porteur : réglementation européenne 2026 favorable.' },
  { engine: 'Extraction financière',  picto: 'financiers',    action: 'Modèle décomposé',          output: 'Revenue projection 8,2 M€ à horizon 2028. EBITDA positif Y3.' },
  { engine: 'Concurrence',            picto: 'concurrence',   action: 'Cartographie dressée',      output: 'Sept concurrents identifiés dont deux sérieux. Différenciation technique claire.' },
  { engine: 'Brevets',                picto: 'brevets',       action: 'Propriété intellectuelle',  output: 'Trois brevets EPO actifs. Liberté d\u2019exploitation vérifiée.' },
  { engine: 'Risques',                picto: 'risques',       action: 'Top 5 enjeux',              output: 'Risque clé : dépendance fournisseur unique. Plan B mentionné, non chiffré.' },
  { engine: 'Blindspot',              picto: 'blindspot',     action: 'Angles morts du fonds',     output: 'Dossier en zone de confort historique. Pas de signal de rejet structurel.' },
  { engine: 'Verdict',                picto: 'verdict',       action: 'Recommandation IC',         output: 'Investir avec conditions. Score 71/100. Probabilité de succès 64 %.' },
];

// Quatorze moteurs Bloc 1 et cartographie en trois blocs.
// Bloc 0 : pre-scan Haiku, dix tests de qualification rapide.
// Bloc 1 : note d instruction, quatorze moteurs Sonnet.
// Bloc 2 : Data Room approfondie, cinq moteurs declenches sur demande.
const ENGINE_MAP: Array<{ num: string; name: string; picto: PictoName; desc: string }> = [
  { num: '01', name: 'Lecture',         picto: 'lecture',        desc: 'Ingestion et structuration du pitch deck' },
  { num: '02', name: 'Équipe',          picto: 'equipe',         desc: 'Founder Market Fit et antécédents' },
  { num: '03', name: 'Marché',          picto: 'marche',         desc: 'Taille adressable et croissance' },
  { num: '04', name: 'Macro',           picto: 'macro',          desc: 'Contexte sectoriel et réglementation' },
  { num: '05', name: 'Financiers',      picto: 'financiers',     desc: 'Décomposition du modèle et unit economics' },
  { num: '06', name: 'Pattern',         picto: 'concurrence',    desc: 'Confrontation au corpus de cas instruits' },
  { num: '07', name: 'Causal',          picto: 'brevets',        desc: 'Retournement causal et angles morts' },
  { num: '08', name: 'Blindspot',       picto: 'blindspot',      desc: 'Aveuglement collectif du capital-risque' },
  { num: '09', name: 'Contrarian',      picto: 'argumentation',  desc: 'Singularités contrariennes du dossier' },
  { num: '10', name: 'Cohérence',       picto: 'reglementaire',  desc: 'Cohérence financière et tests sectoriels' },
  { num: '11', name: 'Tech claim',      picto: 'risques',        desc: 'Cohérence des revendications technologiques' },
  { num: '12', name: 'Friction',        picto: 'macro',          desc: 'Friction d\u2019exécution commerciale et industrielle' },
  { num: '13', name: 'Orchestration',   picto: 'verdict',        desc: 'Synthèse, score auditable, dialectique' },
  { num: '14', name: 'Référence',       picto: 'pack-ic',        desc: 'Plan d\u2019appels DD et grille post-call' },
];

export default function LandingPage() {
  const [stageIdx, setStageIdx] = useState(0);
  const [completed, setCompleted] = useState<DemoStage[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      setStageIdx((prev) => {
        const next = (prev + 1) % DEMO_STAGES.length;
        if (next === 0) setCompleted([]);
        else setCompleted((c) => [...c, DEMO_STAGES[prev]]);
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const currentStage = DEMO_STAGES[stageIdx];

  return (
    <main className="lp">
      {/* HEADER éditorial coherent avec celui du HomeClient (.header). */}
      <header className="lp-header">
        <div className="lp-brand-block">
          <div className="lp-brand-line">
            <span className="lp-brand">PRÉLUDE</span>
            <span className="lp-brand-sep">·</span>
            <span className="lp-brand-tagline">Plateforme d&apos;instruction VC</span>
          </div>
          <div className="lp-brand-meta">DEPUIS 2026 · CONFIDENTIEL</div>
        </div>
        <Link href="/login" className="lp-header-link">
          Se connecter
          <Picto name="arrow-right" size={14} />
        </Link>
      </header>

      {/* HERO editorial. Reprend la grammaire du hero HomeClient
          (kicker avec point, titre noir massif, italique bleu nuit,
          dropcap) mais elargi pour un visiteur public. */}
      <section className="lp-hero">
        <div className="lp-hero-kicker">
          <span className="lp-kicker-dot"></span>
          <span>Capital-risque européen · Instruction rigoureuse</span>
        </div>
        <h1 className="lp-hero-title">
          Instruire un dossier
          <br />
          <em>comme on instruit une affaire.</em>
        </h1>
        <div className="lp-hero-lede">
          <p>
            <span className="lp-dropcap">P</span>
            rélude est un moteur d&apos;instruction conçu pour les fonds qui
            considèrent qu&apos;un dossier mérite mieux qu&apos;un résumé en
            trois bullet points. Quatorze moteurs analytiques travaillent en
            parallèle sur chaque pitch deck, chaque modèle financier, chaque
            jeu de données. La synthèse produite tient en une note rédigée,
            un pack de comité, un verdict argumenté.
          </p>
        </div>
        <div className="lp-hero-cta">
          <Link href="/login" className="lp-cta-primary">
            <span>Lancer une instruction</span>
            <Picto name="arrow-right" size={16} />
          </Link>
          <span className="lp-cta-meta">Lien magique par email · Aucun mot de passe</span>
        </div>
      </section>

      {/* BANDE DE STATS sobres. Style FT/Atlantic, pas de couleur tape-a-l-oeil. */}
      <section className="lp-stats">
        <div className="lp-stat">
          <div className="lp-stat-num">14</div>
          <div className="lp-stat-label">Moteurs analytiques</div>
          <div className="lp-stat-detail">Équipe, marché, macro, financiers, pattern, blindspot, contrarien, cohérence, exécution.</div>
        </div>
        <div className="lp-stat-divider"></div>
        <div className="lp-stat">
          <div className="lp-stat-num">3<span className="lp-stat-unit">min</span></div>
          <div className="lp-stat-label">Temps d&apos;instruction</div>
          <div className="lp-stat-detail">Du dépôt du pitch deck à la note d&apos;investissement consolidée.</div>
        </div>
        <div className="lp-stat-divider"></div>
        <div className="lp-stat">
          <div className="lp-stat-num">100<span className="lp-stat-unit">%</span></div>
          <div className="lp-stat-label">Traçabilité</div>
          <div className="lp-stat-detail">Chaque verdict est argumenté, chaque source citée, chaque vote archivé.</div>
        </div>
      </section>

      {/* DEMO ANIMEE. Carte editoriale claire (pas fond noir cette fois,
          on reste dans la palette papier creme pour ne pas casser la
          coherence avec le reste de l app). */}
      <section className="lp-demo-section">
        <div className="lp-section-head">
          <div className="lp-section-kicker">
            <span className="lp-kicker-dot"></span>
            Démonstration
          </div>
          <h2 className="lp-section-title">
            Une instruction <em>en temps réel.</em>
          </h2>
        </div>

        <div className="lp-demo-frame">
          <div className="lp-demo-chrome">
            <span className="lp-demo-dot"></span>
            <span className="lp-demo-dot"></span>
            <span className="lp-demo-dot"></span>
            <span className="lp-demo-chrome-title">prelude.investment-committee · live</span>
          </div>
          <div className="lp-demo-body">
            <div className="lp-demo-stages">
              {completed.map((s, i) => (
                <div key={`done-${i}`} className="lp-demo-stage lp-demo-done">
                  <span className="lp-demo-picto"><Picto name={s.picto} size={18} /></span>
                  <span className="lp-demo-engine">{s.engine}</span>
                  <span className="lp-demo-action">{s.action}</span>
                  <span className="lp-demo-tick"><Picto name="check" size={14} /></span>
                </div>
              ))}
              <div key={`active-${stageIdx}`} className="lp-demo-stage lp-demo-active">
                <span className="lp-demo-picto lp-demo-picto-pulse"><Picto name={currentStage.picto} size={18} /></span>
                <span className="lp-demo-engine">{currentStage.engine}</span>
                <span className="lp-demo-action">{currentStage.action}</span>
                <span className="lp-demo-spinner" />
              </div>
              <div className="lp-demo-output">
                <span className="lp-demo-output-quote">›</span>
                {currentStage.output}
              </div>
            </div>
            <div className="lp-demo-verdict">
              <div className="lp-demo-verdict-label">Verdict préliminaire</div>
              <div className="lp-demo-verdict-row">
                <span className="lp-demo-verdict-tag">Investir avec conditions</span>
                <span className="lp-demo-verdict-stats">
                  <span><strong>71</strong>/100</span>
                  <span className="lp-vs-sep">·</span>
                  <span>P(succès) <strong>64</strong>%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CARTOGRAPHIE des 14 moteurs Bloc 1 avec pictos. */}
      <section className="lp-engines">
        <div className="lp-section-head">
          <div className="lp-section-kicker">
            <span className="lp-kicker-dot"></span>
            Architecture
          </div>
          <h2 className="lp-section-title">
            Quatorze moteurs.
            <br />
            <em>Une lecture exhaustive.</em>
          </h2>
        </div>
        <div className="lp-engines-grid">
          {ENGINE_MAP.map((e) => (
            <div key={e.num} className="lp-engine-card">
              <div className="lp-engine-head">
                <span className="lp-engine-picto"><Picto name={e.picto} size={22} /></span>
                <span className="lp-engine-num">{e.num}</span>
              </div>
              <div className="lp-engine-name">{e.name}</div>
              <div className="lp-engine-desc">{e.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TROIS PILIERS éditoriaux avec pictos. */}
      <section className="lp-pillars">
        <div className="lp-section-head">
          <div className="lp-section-kicker">
            <span className="lp-kicker-dot"></span>
            Manifeste
          </div>
          <h2 className="lp-section-title">
            Trois principes
            <br />
            <em>qui nous tiennent.</em>
          </h2>
        </div>
        <div className="lp-pillars-grid">
          <article className="lp-pillar">
            <div className="lp-pillar-picto"><Picto name="pillar-rigueur" size={32} strokeWidth={1.5} /></div>
            <div className="lp-pillar-num">I</div>
            <h3 className="lp-pillar-title">L&apos;instruction prend le pas sur la décision rapide.</h3>
            <p className="lp-pillar-text">
              Quatorze moteurs scrutent un dossier sous des angles complémentaires.
              Aucun raccourci. Une réflexion par moteur, conservée, datée, signée.
            </p>
          </article>
          <article className="lp-pillar">
            <div className="lp-pillar-picto"><Picto name="pillar-comite" size={32} strokeWidth={1.5} /></div>
            <div className="lp-pillar-num">II</div>
            <h3 className="lp-pillar-title">Le comité retrouve sa fonction de jugement.</h3>
            <p className="lp-pillar-text">
              Le pack IC tient en trois pages. Verdict, score, probabilité de succès.
              Vote en ligne, consolidation immédiate, conditions retenues archivées.
            </p>
          </article>
          <article className="lp-pillar">
            <div className="lp-pillar-picto"><Picto name="pillar-memoire" size={32} strokeWidth={1.5} /></div>
            <div className="lp-pillar-num">III</div>
            <h3 className="lp-pillar-title">La mémoire du fonds devient un actif.</h3>
            <p className="lp-pillar-text">
              Chaque dossier reste consultable, versionné, commenté. Le fonds
              construit progressivement sa cartographie cognitive et ses zones de force.
            </p>
          </article>
        </div>
      </section>

      {/* CITATION éditoriale en filigrane. */}
      <section className="lp-quote-section">
        <blockquote className="lp-quote">
          <div className="lp-quote-mark" aria-hidden="true">«</div>
          <p>
            Un fonds n&apos;investit pas dans des entreprises. Il investit dans
            la qualité de ses propres jugements. Prélude est l&apos;outil qui
            préserve cette exigence quand le rythme de deals s&apos;accélère.
          </p>
          <footer className="lp-quote-attr">Note d&apos;intention · Mai 2026</footer>
        </blockquote>
      </section>

      {/* CTA FINAL. */}
      <section className="lp-final">
        <div className="lp-final-kicker">
          <span className="lp-kicker-dot"></span>
          Commencer
        </div>
        <h2 className="lp-final-title">
          Une analyse en quelques minutes.
        </h2>
        <p className="lp-final-text">
          Déposez un pitch deck. Le pipeline démarre. Vous recevez en quelques
          minutes une note d&apos;investissement complète, un dossier d&apos;analyse
          navigable, un pack IC prêt à circuler.
        </p>
        <Link href="/login" className="lp-cta-primary lp-cta-final">
          <span>Accéder à Prélude</span>
          <Picto name="arrow-right" size={16} />
        </Link>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-line">
          <span className="lp-footer-brand">PRÉLUDE</span>
          <span className="lp-footer-sep">·</span>
          <span>Le moteur d&apos;instruction des fonds de capital-risque</span>
        </div>
        <div className="lp-footer-meta">Paris · 2026 · Confidentiel</div>
      </footer>

      <style jsx>{`
        .lp {
          background: var(--paper);
          color: var(--ink);
          font-family: var(--serif);
          min-height: 100vh;
        }

        /* ============ HEADER ============ */
        .lp-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding: 22px 40px 18px;
          border-bottom: 1px solid var(--ink);
          position: relative;
        }
        .lp-header::after {
          content: '';
          position: absolute;
          bottom: -4px; left: 0; right: 0;
          height: 1px;
          background: var(--ink);
          opacity: 0.4;
        }
        .lp-brand-block {}
        .lp-brand-line { display: flex; align-items: baseline; gap: 8px; }
        .lp-brand {
          font-family: var(--serif);
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 0.16em;
          line-height: 1;
          color: var(--accent);
          text-transform: uppercase;
        }
        .lp-brand-sep { color: var(--muted); }
        .lp-brand-tagline {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          font-weight: 500;
          letter-spacing: 0.04em;
        }
        .lp-brand-meta {
          font-family: var(--sans);
          font-size: 10px;
          font-weight: 500;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin-top: 8px;
        }
        .lp-header-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--sans);
          font-size: 11px;
          font-weight: 500;
          color: var(--ink);
          text-decoration: none;
          padding: 8px 14px;
          border: 1px solid var(--hairline);
          border-radius: var(--radius-pill);
          transition: all var(--motion-fast);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .lp-header-link:hover {
          background: var(--accent);
          color: var(--paper);
          border-color: var(--accent);
        }

        /* ============ HERO ============ */
        .lp-hero {
          max-width: 1080px;
          margin: 0 auto;
          padding: 96px 40px 72px;
        }
        .lp-hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 36px;
          font-weight: 600;
        }
        .lp-kicker-dot {
          width: 6px; height: 6px;
          background: var(--accent);
          border-radius: 50%;
          display: inline-block;
        }
        .lp-hero-title {
          font-family: var(--serif);
          font-size: clamp(44px, 7vw, 86px);
          line-height: 1.02;
          letter-spacing: -0.022em;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 36px;
        }
        .lp-hero-title em {
          font-style: italic;
          font-weight: 400;
          color: var(--accent);
        }
        .lp-hero-lede {
          max-width: 720px;
          margin: 0 0 44px;
        }
        .lp-hero-lede p {
          font-family: var(--serif);
          font-size: 19px;
          line-height: 1.65;
          color: var(--ink-soft);
        }
        .lp-dropcap {
          float: left;
          font-family: var(--serif);
          font-size: 64px;
          line-height: 0.85;
          font-weight: 700;
          color: var(--accent);
          padding-right: 12px;
          padding-top: 8px;
          margin-bottom: -4px;
        }
        .lp-hero-cta {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .lp-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 28px;
          background: var(--ink);
          color: var(--paper);
          font-family: var(--sans);
          font-size: 13px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 600;
          text-decoration: none;
          transition: all var(--motion-base);
        }
        .lp-cta-primary:hover {
          background: var(--accent);
          transform: translateY(-1px);
          box-shadow: var(--shadow-blue);
        }
        .lp-cta-meta {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--muted);
        }

        /* ============ STATS ============ */
        .lp-stats {
          background: var(--paper-accent);
          border-top: 1px solid var(--hairline);
          border-bottom: 1px solid var(--hairline);
          padding: 64px 40px;
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr;
          gap: 36px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .lp-stat {}
        .lp-stat-num {
          font-family: var(--serif);
          font-size: 88px;
          line-height: 1;
          font-weight: 700;
          color: var(--accent);
          margin-bottom: 16px;
          letter-spacing: -0.025em;
        }
        .lp-stat-unit {
          font-size: 32px;
          color: var(--ink-soft);
          margin-left: 4px;
          font-weight: 500;
        }
        .lp-stat-label {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink);
          font-weight: 600;
          margin-bottom: 10px;
        }
        .lp-stat-detail {
          font-family: var(--serif);
          font-size: 15px;
          line-height: 1.55;
          color: var(--ink-soft);
        }
        .lp-stat-divider {
          width: 1px;
          background: var(--hairline);
        }

        /* ============ SECTION HEAD ============ */
        .lp-section-head {
          max-width: 760px;
          margin-bottom: 56px;
        }
        .lp-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 20px;
          font-weight: 600;
        }
        .lp-section-title {
          font-family: var(--serif);
          font-size: clamp(32px, 4.5vw, 54px);
          line-height: 1.05;
          letter-spacing: -0.018em;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .lp-section-title em {
          font-style: italic;
          font-weight: 400;
          color: var(--accent);
        }

        /* ============ DEMO ============ */
        .lp-demo-section {
          padding: 96px 40px;
          max-width: 1080px;
          margin: 0 auto;
        }
        .lp-demo-frame {
          background: var(--surface);
          border: 1px solid var(--hairline);
          box-shadow: var(--shadow-3);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .lp-demo-chrome {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 12px 18px;
          border-bottom: 1px solid var(--hairline);
          background: var(--paper);
        }
        .lp-demo-dot {
          width: 9px; height: 9px;
          border-radius: 50%;
          background: var(--hairline);
        }
        .lp-demo-chrome-title {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--muted);
          margin-left: 14px;
          letter-spacing: 0.04em;
        }
        .lp-demo-body {
          padding: 32px 36px 36px;
        }
        .lp-demo-stages {
          min-height: 240px;
        }
        .lp-demo-stage {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 8px 0;
          font-size: 13px;
          font-family: var(--sans);
          opacity: 0;
          animation: lpFade 0.35s ease forwards;
          transition: opacity var(--motion-base);
        }
        .lp-demo-done { opacity: 0.45; }
        .lp-demo-active {
          opacity: 1;
          color: var(--ink);
          font-weight: 500;
        }
        .lp-demo-picto {
          color: var(--muted);
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .lp-demo-active .lp-demo-picto { color: var(--accent); }
        .lp-demo-picto-pulse {
          animation: lpPulse 1.4s ease-in-out infinite;
        }
        .lp-demo-engine {
          letter-spacing: 0.02em;
          min-width: 200px;
          flex-shrink: 0;
          font-weight: 500;
        }
        .lp-demo-action {
          color: var(--muted);
          font-size: 12px;
          flex: 1;
        }
        .lp-demo-tick {
          color: var(--good);
          flex-shrink: 0;
        }
        .lp-demo-spinner {
          width: 12px; height: 12px;
          border: 1.5px solid var(--hairline);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: lpSpin 0.8s linear infinite;
          flex-shrink: 0;
        }
        .lp-demo-output {
          margin-top: 20px;
          padding: 16px 20px;
          background: var(--accent-soft);
          border-left: 3px solid var(--accent);
          font-family: var(--serif);
          font-size: 15px;
          line-height: 1.55;
          color: var(--ink);
          animation: lpFade 0.4s ease;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .lp-demo-output-quote {
          color: var(--accent);
          font-weight: 600;
          font-size: 18px;
          line-height: 1;
          margin-top: 2px;
        }
        .lp-demo-verdict {
          margin-top: 28px;
          padding-top: 22px;
          border-top: 1px solid var(--hairline);
        }
        .lp-demo-verdict-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 12px;
          font-weight: 600;
        }
        .lp-demo-verdict-row {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }
        .lp-demo-verdict-tag {
          padding: 8px 14px;
          background: var(--accent);
          color: var(--paper);
          font-family: var(--sans);
          font-size: 12px;
          letter-spacing: 0.06em;
          font-weight: 600;
          border-radius: var(--radius-pill);
        }
        .lp-demo-verdict-stats {
          display: flex;
          gap: 12px;
          font-family: var(--serif);
          font-size: 15px;
          color: var(--ink-soft);
        }
        .lp-demo-verdict-stats strong {
          color: var(--accent);
          font-weight: 700;
        }
        .lp-vs-sep { opacity: 0.4; }

        /* ============ ENGINES MAP ============ */
        .lp-engines {
          padding: 96px 40px;
          max-width: 1280px;
          margin: 0 auto;
          background: var(--paper-accent);
          border-top: 1px solid var(--hairline);
          border-bottom: 1px solid var(--hairline);
        }
        .lp-engines-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 1px;
          background: var(--hairline);
          border: 1px solid var(--hairline);
        }
        .lp-engine-card {
          padding: 24px 22px 22px;
          background: var(--surface);
          transition: all var(--motion-base);
          cursor: default;
        }
        .lp-engine-card:hover {
          background: var(--paper);
          transform: translateY(-2px);
        }
        .lp-engine-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .lp-engine-picto {
          color: var(--accent);
          width: 32px; height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .lp-engine-num {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--muted);
          letter-spacing: 0.08em;
          font-weight: 600;
        }
        .lp-engine-name {
          font-family: var(--serif);
          font-size: 20px;
          font-weight: 700;
          color: var(--ink);
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }
        .lp-engine-desc {
          font-family: var(--serif);
          font-size: 13.5px;
          line-height: 1.5;
          color: var(--ink-soft);
        }

        /* ============ PILLARS ============ */
        .lp-pillars {
          padding: 96px 40px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .lp-pillars-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 56px;
        }
        .lp-pillar {
          padding: 32px 0 0;
          border-top: 2px solid var(--ink);
          position: relative;
        }
        .lp-pillar-picto {
          color: var(--accent);
          margin-bottom: 24px;
        }
        .lp-pillar-num {
          position: absolute;
          top: -3px;
          right: 0;
          font-family: var(--serif);
          font-size: 16px;
          font-weight: 600;
          color: var(--accent);
          background: var(--paper);
          padding-left: 10px;
          letter-spacing: 0.08em;
        }
        .lp-pillar-title {
          font-family: var(--serif);
          font-size: 24px;
          font-weight: 700;
          line-height: 1.2;
          color: var(--ink);
          margin: 0 0 18px;
          letter-spacing: -0.012em;
        }
        .lp-pillar-text {
          font-family: var(--serif);
          font-size: 15.5px;
          line-height: 1.65;
          color: var(--ink-soft);
          margin: 0;
        }

        /* ============ QUOTE ============ */
        .lp-quote-section {
          padding: 96px 40px;
          max-width: 880px;
          margin: 0 auto;
          background: var(--paper-accent);
          border-top: 1px solid var(--hairline);
          border-bottom: 1px solid var(--hairline);
        }
        .lp-quote {
          margin: 0;
          padding: 0;
          position: relative;
        }
        .lp-quote-mark {
          font-family: var(--serif);
          font-size: 96px;
          font-weight: 700;
          color: var(--accent);
          line-height: 0.6;
          margin-bottom: 16px;
          opacity: 0.6;
        }
        .lp-quote p {
          font-family: var(--serif);
          font-size: clamp(20px, 2.5vw, 28px);
          line-height: 1.45;
          color: var(--ink);
          margin: 0 0 28px;
          font-style: italic;
          font-weight: 400;
          letter-spacing: -0.005em;
        }
        .lp-quote-attr {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
        }

        /* ============ FINAL ============ */
        .lp-final {
          padding: 96px 40px 80px;
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
        }
        .lp-final-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
          margin-bottom: 24px;
          justify-content: center;
        }
        .lp-final-title {
          font-family: var(--serif);
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 700;
          line-height: 1.08;
          color: var(--ink);
          margin: 0 0 24px;
          letter-spacing: -0.02em;
        }
        .lp-final-text {
          font-family: var(--serif);
          font-size: 17px;
          line-height: 1.6;
          color: var(--ink-soft);
          margin: 0 auto 36px;
          max-width: 580px;
        }
        .lp-cta-final {
          margin: 0 auto;
        }

        /* ============ FOOTER ============ */
        .lp-footer {
          padding: 32px 40px;
          background: var(--accent-deep);
          color: var(--paper);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.10em;
        }
        .lp-footer-line {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .lp-footer-brand {
          color: var(--paper);
          font-weight: 700;
          letter-spacing: 0.18em;
        }
        .lp-footer-sep { opacity: 0.4; }
        .lp-footer-meta {
          color: rgba(251, 250, 247, 0.5);
          text-transform: uppercase;
        }

        /* ============ ANIMATIONS ============ */
        @keyframes lpFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lpPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes lpSpin {
          to { transform: rotate(360deg); }
        }

        /* ============ RESPONSIVE ============ */
        @media (max-width: 900px) {
          .lp-header { padding: 18px 24px 14px; flex-wrap: wrap; gap: 12px; }
          .lp-hero { padding: 64px 24px 56px; }
          .lp-stats {
            grid-template-columns: 1fr;
            gap: 36px;
            padding: 48px 24px;
          }
          .lp-stat-divider { width: auto; height: 1px; }
          .lp-stat-num { font-size: 64px; }
          .lp-demo-section { padding: 64px 24px; }
          .lp-engines { padding: 64px 24px; }
          .lp-engines-grid { grid-template-columns: 1fr 1fr; }
          .lp-pillars { padding: 64px 24px; }
          .lp-pillars-grid { grid-template-columns: 1fr; gap: 44px; }
          .lp-quote-section { padding: 64px 24px; }
          .lp-final { padding: 64px 24px; }
        }
        @media (max-width: 600px) {
          .lp-header { padding: 16px 20px; }
          .lp-brand { font-size: 22px; letter-spacing: 0.14em; }
          .lp-brand-tagline { display: none; }
          .lp-hero { padding: 48px 20px 48px; }
          .lp-hero-lede p { font-size: 17px; }
          .lp-dropcap { font-size: 50px; padding-right: 10px; }
          .lp-hero-cta { gap: 16px; flex-direction: column; align-items: stretch; }
          .lp-cta-primary { justify-content: center; padding: 14px 22px; }
          .lp-cta-meta { text-align: center; }
          .lp-stats { padding: 36px 20px; }
          .lp-stat-num { font-size: 56px; }
          .lp-demo-section { padding: 48px 20px; }
          .lp-demo-body { padding: 22px 20px 24px; }
          .lp-demo-engine { min-width: 0; font-size: 12.5px; }
          .lp-demo-stage { flex-wrap: wrap; gap: 10px; }
          .lp-demo-action { font-size: 11.5px; flex: 1 1 100%; padding-left: 38px; }
          .lp-demo-verdict-stats { font-size: 13px; }
          .lp-engines { padding: 48px 20px; }
          .lp-engines-grid { grid-template-columns: 1fr; }
          .lp-engine-card { padding: 20px 18px; }
          .lp-pillars { padding: 48px 20px; }
          .lp-pillars-grid { gap: 36px; }
          .lp-pillar-title { font-size: 20px; }
          .lp-quote-section { padding: 48px 20px; }
          .lp-quote-mark { font-size: 72px; }
          .lp-quote p { font-size: 18px; }
          .lp-final { padding: 56px 20px 64px; }
          .lp-footer { padding: 24px 20px; flex-direction: column; align-items: flex-start; gap: 10px; }
          .lp-section-head { margin-bottom: 36px; }
        }
      `}</style>
    </main>
  );
}
