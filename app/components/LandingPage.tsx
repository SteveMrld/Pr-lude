'use client';

// ============================================================
// LANDING PAGE V2 — page d'accueil publique de Prelude
// ------------------------------------------------------------
// Voix editoriale : Le Grand Continent / The Atlantic / Le Monde
// Diplomatique. Typographie monumentale, accents rouge sang en
// marqueur fort (pas de couleurs SaaS), bandes de fond coloree
// pour rythmer la lecture, grands chiffres en serif pour les stats.
// ============================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface DemoStage {
  engine: string;
  action: string;
  output: string;
}

const DEMO_STAGES: DemoStage[] = [
  { engine: 'Lecture du dossier',     action: 'Pitch deck ingere',         output: 'Dossier reconnu : 28 pages, modele financier en annexe Excel.' },
  { engine: 'Equipe',                 action: 'Profils croisés',           output: 'Founder Market Fit : 78/100. Trois cofondateurs, antecedents corporate notables.' },
  { engine: 'Marche',                 action: 'Taille adressable testee',  output: 'TAM revendique 12 Md€ verifie a 9.8 Md€. Croissance 14 % CAGR confirmee.' },
  { engine: 'Macro',                  action: 'Contexte sectoriel',        output: 'Vent porteur : reglementation europeenne 2026 favorable. Cycle de financement actif.' },
  { engine: 'Extraction financiere',  action: 'Modele decompose',          output: 'Revenue projection 8.2 M€ a horizon 2028. Marge brute 64 %, EBITDA positif Y3.' },
  { engine: 'Concurrence',            action: 'Map dressee',               output: 'Sept concurrents identifies dont deux serieux. Differentiation claire sur l axe technique.' },
  { engine: 'Brevets',                action: 'Propriete intellectuelle',  output: 'Trois brevets EPO actifs. Liberte d exploitation verifiee, pas de litige en cours.' },
  { engine: 'Risques',                action: 'Top 5 enjeux',              output: 'Risque cle : dependance a un fournisseur unique. Plan B mentionne, non chiffre.' },
  { engine: 'Blindspot',              action: 'Angles morts du fonds',     output: 'Dossier en zone de confort historique. Pas de signal de rejet structurel.' },
  { engine: 'Verdict',                action: 'Recommandation IC',         output: 'Investir avec conditions. Score global 71/100. Probabilite de succes 64 %.' },
];

// Treize moteurs nommes pour la cartographie visuelle. Reprise des
// engines du pipeline reel sans copier-coller la liste exacte.
const ENGINE_MAP = [
  '01 · Lecture',
  '02 · Equipe',
  '03 · Marche',
  '04 · Macro',
  '05 · Financiers',
  '06 · Concurrence',
  '07 · Brevets',
  '08 · Reglementaire',
  '09 · Risques',
  '10 · Blindspot',
  '11 · Argumentation',
  '12 · Verdict',
  '13 · Pack IC',
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
    <main className="landing">
      {/* Bandeau de tete sobre. Style FT/Atlantic : marque a gauche, lien a droite,
          fine ligne de separation. */}
      <header className="landing-top">
        <div className="landing-brand">
          <span className="landing-brand-bar"></span>
          <span className="landing-brand-name">PRÉLUDE</span>
        </div>
        <Link href="/login" className="landing-top-link">
          Se connecter →
        </Link>
      </header>

      {/* HERO avec typographie monumentale en background.
          Le mot PRÉLUDE est repete enorme en filigrane derriere le titre. */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">PRÉLUDE</div>
        <div className="hero-content">
          <div className="hero-kicker">
            <span className="kicker-dot"></span>
            <span>Capital-risque européen · Plateforme d&apos;instruction</span>
          </div>
          <h1 className="hero-headline">
            Instruire un dossier
            <br />
            <span className="headline-italic">d&apos;investissement</span>
            <br />
            <span className="headline-accent">comme on lit un grand journal.</span>
          </h1>
          <p className="hero-lede">
            <span className="dropcap">P</span>rélude est un moteur d&apos;instruction conçu pour les fonds qui considèrent
            qu&apos;un dossier mérite mieux qu&apos;un résumé en trois bullet points. Treize moteurs analytiques
            travaillent en parallèle sur chaque pitch deck, chaque modèle financier, chaque jeu de données.
            La synthèse produite tient en une note rédigée, un pack de comité, un verdict argumenté.
          </p>
          <div className="hero-cta">
            <Link href="/login" className="cta-primary">
              <span>Lancer une instruction</span>
              <span className="cta-arrow">→</span>
            </Link>
            <span className="cta-meta">Lien magique par email · Aucun mot de passe</span>
          </div>
        </div>
      </section>

      {/* BANDE DE STATS éditoriales. Trois grands chiffres serif, separes par
          de fines barres verticales. Style Atlantic / FT data spread. */}
      <section className="stats">
        <div className="stat">
          <div className="stat-number">13</div>
          <div className="stat-label">Moteurs analytiques</div>
          <div className="stat-detail">Equipe, marche, brevets, financiers, concurrence, risques, blindspot.</div>
        </div>
        <div className="stat-divider"></div>
        <div className="stat">
          <div className="stat-number">3<span className="stat-unit">min</span></div>
          <div className="stat-label">Temps d&apos;instruction</div>
          <div className="stat-detail">Du depot du pitch deck a la note d&apos;investissement consolidee.</div>
        </div>
        <div className="stat-divider"></div>
        <div className="stat">
          <div className="stat-number">100<span className="stat-unit">%</span></div>
          <div className="stat-label">Tracabilite</div>
          <div className="stat-detail">Chaque verdict est argumente, chaque source est citee, chaque vote est archive.</div>
        </div>
      </section>

      {/* DEMO ANIMEE du pipeline. Conserve de la V1 mais sur fond noir profond
          pour casser la monotonie du papier creme. */}
      <section className="demo-section">
        <div className="demo-section-label">DEMONSTRATION · INSTRUCTION EN TEMPS REEL</div>
        <div className="demo-frame">
          <div className="demo-chrome">
            <span className="demo-dot"></span>
            <span className="demo-dot"></span>
            <span className="demo-dot"></span>
            <span className="demo-title">prelude.investment-committee · live</span>
          </div>
          <div className="demo-body">
            <div className="demo-stages">
              {completed.map((s, i) => (
                <div key={`done-${i}`} className="demo-stage demo-done">
                  <span className="demo-tick">●</span>
                  <span className="demo-engine">{s.engine}</span>
                  <span className="demo-action">{s.action}</span>
                </div>
              ))}
              <div key={`active-${stageIdx}`} className="demo-stage demo-active">
                <span className="demo-tick demo-tick-pulse">◐</span>
                <span className="demo-engine">{currentStage.engine}</span>
                <span className="demo-action">{currentStage.action}</span>
              </div>
              <div className="demo-output">
                {currentStage.output}
              </div>
            </div>
            <div className="demo-verdict">
              <div className="demo-verdict-label">VERDICT PRELIMINAIRE</div>
              <div className="demo-verdict-value">
                <span className="verdict-tag verdict-tag-amber">INVESTIR AVEC CONDITIONS</span>
              </div>
              <div className="demo-verdict-stats">
                <span>Score global · <strong>71</strong>/100</span>
                <span className="vs-sep">·</span>
                <span>Probabilité de succès · <strong>64</strong>%</span>
                <span className="vs-sep">·</span>
                <span>Risque cle · dependance fournisseur</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CARTE TYPOGRAPHIQUE des 13 moteurs. Grille de tags style index de revue.
          Met le treize en avant comme architecture du produit. */}
      <section className="engines">
        <div className="engines-header">
          <div className="engines-numero">XIII</div>
          <h2 className="engines-title">
            Treize moteurs.
            <br />
            <span className="engines-italic">Une lecture exhaustive.</span>
          </h2>
        </div>
        <div className="engines-grid">
          {ENGINE_MAP.map((label) => (
            <div key={label} className="engine-tag">
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* TROIS PILIERS éditoriaux avec accents rouges en numérotation. */}
      <section className="pillars">
        <article className="pillar">
          <div className="pillar-marker">
            <span className="pillar-num-roman">I</span>
            <span className="pillar-num-text">Premier pilier</span>
          </div>
          <h2 className="pillar-title">
            L&apos;instruction prend le pas
            <br />
            sur la décision rapide.
          </h2>
          <p className="pillar-text">
            Treize moteurs scrutent un dossier sous des angles complementaires :
            equipe, marche, brevets, financiers, concurrence, blindspot du fonds.
            Aucun raccourci. Une reflexion par moteur, conservee, datee, signee.
          </p>
        </article>
        <article className="pillar">
          <div className="pillar-marker">
            <span className="pillar-num-roman">II</span>
            <span className="pillar-num-text">Deuxième pilier</span>
          </div>
          <h2 className="pillar-title">
            Le comité retrouve
            <br />
            sa fonction de jugement.
          </h2>
          <p className="pillar-text">
            Le pack IC tient en trois pages. Verdict, score, probabilite de succes.
            Vote en ligne par membre, consolidation immediate, conditions retenues
            inscrites au compte-rendu. Le rituel reprend la main, la machine s efface.
          </p>
        </article>
        <article className="pillar">
          <div className="pillar-marker">
            <span className="pillar-num-roman">III</span>
            <span className="pillar-num-text">Troisième pilier</span>
          </div>
          <h2 className="pillar-title">
            La mémoire du fonds
            <br />
            devient un actif.
          </h2>
          <p className="pillar-text">
            Chaque dossier reste consultable, versionne, commente. Les positions
            individuelles et collectives s archivent. Le fonds construit
            progressivement sa cartographie cognitive, ses biais structurels,
            ses zones de force.
          </p>
        </article>
      </section>

      {/* CITATION editoriale, fond ocre, grand guillemet rouge en filigrane. */}
      <section className="quote-section">
        <div className="quote-mark" aria-hidden="true">«</div>
        <blockquote className="quote">
          <p>
            Un fonds n&apos;investit pas dans des entreprises. Il investit dans
            la qualité de ses propres jugements. Prélude est l&apos;outil qui
            préserve cette exigence quand le rythme de deals s&apos;accélère.
          </p>
          <footer className="quote-attribution">— Note d&apos;intention, mai 2026</footer>
        </blockquote>
      </section>

      {/* CTA FINAL avec rappel de la voix editoriale. */}
      <section className="final">
        <div className="final-kicker">COMMENCER · UN PITCH DECK SUFFIT</div>
        <h2 className="final-title">Une analyse en quelques minutes.</h2>
        <p className="final-text">
          Deposez un pitch deck. Le pipeline demarre. Vous recevez en quelques minutes
          une note d&apos;investissement complete, un dossier d&apos;analyse navigable,
          un pack IC pret a circuler.
        </p>
        <Link href="/login" className="cta-primary cta-final">
          <span>Acceder a Prélude</span>
          <span className="cta-arrow">→</span>
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="footer-line">
          <span className="footer-brand">PRÉLUDE</span>
          <span className="footer-sep">·</span>
          <span>Le moteur d&apos;instruction des fonds de capital-risque</span>
        </div>
        <div className="footer-meta">Paris · 2026 · Confidentiel</div>
      </footer>

      <style jsx>{`
        /* ====================== TOKENS DE COULEUR ====================== */
        .landing {
          --paper: #f4ebdc;
          --paper-deep: #ebe0ce;
          --ink: #1a1410;
          --ink-soft: #3a2f24;
          --muted: #7a6a52;
          --hairline: rgba(26, 20, 16, 0.12);
          --hairline-strong: rgba(26, 20, 16, 0.22);
          --accent: #5a4a32;
          --rouge: #8c2818;        /* rouge sang style Le Monde Diplo */
          --rouge-soft: rgba(140, 40, 24, 0.10);
          --vert: #2d5a3d;         /* vert profond */
          --ambre: #b8721a;
          --noir-profond: #0d0a07;

          background: var(--paper);
          color: var(--ink);
          font-family: var(--serif, Georgia, 'Times New Roman', serif);
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* ====================== HEADER ====================== */
        .landing-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 22px 32px;
          border-bottom: 1px solid var(--hairline);
          position: relative;
          z-index: 10;
        }
        .landing-brand { display: flex; align-items: center; gap: 12px; }
        .landing-brand-bar {
          display: inline-block;
          width: 24px;
          height: 3px;
          background: var(--rouge);
        }
        .landing-brand-name {
          font-family: var(--serif, Georgia, serif);
          font-size: 15px;
          letter-spacing: 0.20em;
          color: var(--ink);
          font-weight: 600;
        }
        .landing-top-link {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink);
          text-decoration: none;
          padding: 4px 0;
          border-bottom: 1px solid var(--ink);
          transition: color 0.15s;
        }
        .landing-top-link:hover { color: var(--rouge); border-bottom-color: var(--rouge); }

        /* ====================== HERO ====================== */
        .hero {
          position: relative;
          padding: 100px 32px 80px;
          max-width: 1200px;
          margin: 0 auto;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: var(--serif, Georgia, serif);
          font-size: clamp(180px, 24vw, 360px);
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--ink);
          opacity: 0.04;
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
          z-index: 0;
        }
        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 920px;
        }
        .hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--rouge);
          margin-bottom: 32px;
          font-weight: 600;
        }
        .kicker-dot {
          width: 6px;
          height: 6px;
          background: var(--rouge);
          border-radius: 50%;
          display: inline-block;
        }
        .hero-headline {
          font-family: var(--serif, Georgia, serif);
          font-size: clamp(40px, 6.5vw, 76px);
          line-height: 1.02;
          letter-spacing: -0.018em;
          font-weight: 500;
          color: var(--ink);
          margin: 0 0 36px;
        }
        .headline-italic {
          font-style: italic;
          font-weight: 400;
        }
        .headline-accent {
          color: var(--rouge);
          font-weight: 500;
        }
        .hero-lede {
          font-family: var(--serif, Georgia, serif);
          font-size: 20px;
          line-height: 1.55;
          color: var(--ink-soft);
          max-width: 720px;
          margin: 0 0 44px;
        }
        .dropcap {
          float: left;
          font-family: var(--serif, Georgia, serif);
          font-size: 64px;
          line-height: 0.9;
          font-weight: 600;
          color: var(--rouge);
          padding-right: 12px;
          padding-top: 6px;
          margin-bottom: -4px;
        }
        .hero-cta {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 28px;
          background: var(--ink);
          color: var(--paper);
          font-family: var(--sans, system-ui);
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 600;
          text-decoration: none;
          border: 1px solid var(--ink);
          transition: background 0.18s, color 0.18s;
        }
        .cta-primary:hover {
          background: var(--rouge);
          border-color: var(--rouge);
        }
        .cta-arrow {
          transition: transform 0.18s;
        }
        .cta-primary:hover .cta-arrow {
          transform: translateX(4px);
        }
        .cta-meta {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--muted);
        }

        /* ====================== STATS ====================== */
        .stats {
          background: var(--paper-deep);
          border-top: 1px solid var(--hairline);
          border-bottom: 1px solid var(--hairline);
          padding: 60px 32px;
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr;
          gap: 32px;
          align-items: stretch;
          max-width: 1200px;
          margin: 0 auto;
        }
        .stat {
          padding: 0 8px;
        }
        .stat-number {
          font-family: var(--serif, Georgia, serif);
          font-size: 84px;
          line-height: 1;
          font-weight: 500;
          color: var(--rouge);
          margin-bottom: 14px;
          letter-spacing: -0.02em;
        }
        .stat-unit {
          font-size: 32px;
          color: var(--ink);
          margin-left: 4px;
          font-weight: 400;
        }
        .stat-label {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink);
          font-weight: 600;
          margin-bottom: 10px;
        }
        .stat-detail {
          font-family: var(--serif, Georgia, serif);
          font-size: 14px;
          line-height: 1.5;
          color: var(--ink-soft);
        }
        .stat-divider {
          width: 1px;
          background: var(--hairline-strong);
        }

        /* ====================== DEMO ====================== */
        .demo-section {
          padding: 100px 32px;
          background: var(--noir-profond);
          color: var(--paper);
        }
        .demo-section-label {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.18em;
          font-weight: 600;
          color: var(--rouge);
          text-align: center;
          margin-bottom: 36px;
          text-transform: uppercase;
        }
        .demo-frame {
          max-width: 920px;
          margin: 0 auto;
          background: #1a1410;
          border: 1px solid rgba(244, 235, 220, 0.12);
        }
        .demo-chrome {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(244, 235, 220, 0.10);
          background: rgba(244, 235, 220, 0.03);
        }
        .demo-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: rgba(244, 235, 220, 0.20);
        }
        .demo-dot:nth-child(1) { background: #c8443c; }
        .demo-dot:nth-child(2) { background: #d4a02c; }
        .demo-dot:nth-child(3) { background: #4a8a4a; }
        .demo-title {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.10em;
          color: rgba(244, 235, 220, 0.50);
          margin-left: 16px;
        }
        .demo-body {
          padding: 32px 36px 36px;
        }
        .demo-stages {
          min-height: 220px;
          font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
        }
        .demo-stage {
          display: flex;
          align-items: baseline;
          gap: 14px;
          padding: 4px 0;
          font-size: 13px;
          opacity: 0;
          animation: demoFade 0.35s ease forwards;
        }
        .demo-done {
          opacity: 0.40;
          color: var(--paper);
        }
        .demo-active {
          opacity: 1;
          color: var(--paper);
        }
        .demo-tick { width: 14px; flex-shrink: 0; color: #4a8a4a; }
        .demo-tick-pulse {
          color: var(--ambre);
          animation: demoPulse 1.4s ease-in-out infinite;
        }
        .demo-engine {
          letter-spacing: 0.04em;
          min-width: 200px;
          flex-shrink: 0;
        }
        .demo-action {
          color: rgba(244, 235, 220, 0.60);
          font-size: 12px;
        }
        .demo-output {
          margin-top: 22px;
          padding: 16px 20px;
          background: rgba(244, 235, 220, 0.05);
          border-left: 3px solid var(--ambre);
          font-family: var(--serif, Georgia, serif);
          font-size: 15px;
          line-height: 1.55;
          color: rgba(244, 235, 220, 0.85);
          animation: demoFade 0.4s ease;
        }
        .demo-verdict {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid rgba(244, 235, 220, 0.12);
        }
        .demo-verdict-label {
          font-family: var(--sans, system-ui);
          font-size: 10px;
          letter-spacing: 0.18em;
          color: var(--rouge);
          margin-bottom: 14px;
          font-weight: 600;
        }
        .verdict-tag {
          display: inline-block;
          padding: 8px 16px;
          font-family: var(--sans, system-ui);
          font-size: 12px;
          letter-spacing: 0.12em;
          font-weight: 600;
        }
        .verdict-tag-amber {
          background: var(--ambre);
          color: var(--noir-profond);
        }
        .demo-verdict-stats {
          margin-top: 18px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-family: var(--serif, Georgia, serif);
          font-size: 14px;
          color: rgba(244, 235, 220, 0.75);
        }
        .demo-verdict-stats strong {
          color: var(--paper);
          font-weight: 600;
        }
        .vs-sep { opacity: 0.4; }

        /* ====================== ENGINES MAP ====================== */
        .engines {
          padding: 100px 32px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .engines-header {
          display: flex;
          align-items: flex-start;
          gap: 40px;
          margin-bottom: 56px;
          flex-wrap: wrap;
        }
        .engines-numero {
          font-family: var(--serif, Georgia, serif);
          font-size: 120px;
          font-weight: 500;
          line-height: 0.9;
          color: var(--rouge);
          letter-spacing: 0.02em;
        }
        .engines-title {
          font-family: var(--serif, Georgia, serif);
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 500;
          line-height: 1.05;
          color: var(--ink);
          margin: 0;
          padding-top: 12px;
        }
        .engines-italic {
          font-style: italic;
          font-weight: 400;
          color: var(--ink-soft);
        }
        .engines-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0;
          border-top: 1px solid var(--hairline-strong);
          border-left: 1px solid var(--hairline-strong);
        }
        .engine-tag {
          padding: 22px 24px;
          font-family: var(--serif, Georgia, serif);
          font-size: 16px;
          color: var(--ink);
          border-right: 1px solid var(--hairline-strong);
          border-bottom: 1px solid var(--hairline-strong);
          transition: background 0.18s;
          background: var(--paper);
        }
        .engine-tag:hover {
          background: var(--rouge-soft);
          color: var(--rouge);
        }

        /* ====================== PILLARS ====================== */
        .pillars {
          padding: 100px 32px;
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 56px;
          background: var(--paper-deep);
          border-top: 1px solid var(--hairline);
          border-bottom: 1px solid var(--hairline);
        }
        .pillar {
          padding: 0;
        }
        .pillar-marker {
          display: flex;
          align-items: baseline;
          gap: 14px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid var(--rouge);
        }
        .pillar-num-roman {
          font-family: var(--serif, Georgia, serif);
          font-size: 38px;
          font-weight: 500;
          color: var(--rouge);
          line-height: 1;
        }
        .pillar-num-text {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
        }
        .pillar-title {
          font-family: var(--serif, Georgia, serif);
          font-size: 24px;
          font-weight: 500;
          line-height: 1.18;
          color: var(--ink);
          margin: 0 0 18px;
          letter-spacing: -0.005em;
        }
        .pillar-text {
          font-family: var(--serif, Georgia, serif);
          font-size: 15.5px;
          line-height: 1.65;
          color: var(--ink-soft);
          margin: 0;
        }

        /* ====================== QUOTE ====================== */
        .quote-section {
          position: relative;
          padding: 100px 32px;
          max-width: 880px;
          margin: 0 auto;
          overflow: hidden;
        }
        .quote-mark {
          position: absolute;
          top: 20px;
          left: 24px;
          font-family: var(--serif, Georgia, serif);
          font-size: 320px;
          font-weight: 600;
          color: var(--rouge);
          opacity: 0.10;
          line-height: 0.8;
          pointer-events: none;
          user-select: none;
        }
        .quote {
          position: relative;
          margin: 0;
          padding: 0;
          z-index: 1;
        }
        .quote p {
          font-family: var(--serif, Georgia, serif);
          font-size: 26px;
          line-height: 1.45;
          color: var(--ink);
          margin: 0 0 24px;
          font-weight: 400;
          letter-spacing: -0.005em;
        }
        .quote-attribution {
          font-family: var(--sans, system-ui);
          font-size: 12px;
          letter-spacing: 0.10em;
          color: var(--muted);
          font-weight: 600;
        }

        /* ====================== FINAL ====================== */
        .final {
          padding: 100px 32px;
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
          border-top: 1px solid var(--hairline);
        }
        .final-kicker {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.18em;
          color: var(--rouge);
          margin-bottom: 24px;
          font-weight: 600;
        }
        .final-title {
          font-family: var(--serif, Georgia, serif);
          font-size: clamp(32px, 5vw, 52px);
          font-weight: 500;
          line-height: 1.1;
          color: var(--ink);
          margin: 0 0 24px;
          letter-spacing: -0.012em;
        }
        .final-text {
          font-family: var(--serif, Georgia, serif);
          font-size: 17px;
          line-height: 1.6;
          color: var(--ink-soft);
          margin: 0 auto 40px;
          max-width: 560px;
        }
        .cta-final {
          margin: 0 auto;
        }

        /* ====================== FOOTER ====================== */
        .landing-footer {
          padding: 36px 32px;
          background: var(--noir-profond);
          color: var(--paper);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.10em;
        }
        .footer-line {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .footer-brand {
          color: var(--rouge);
          font-weight: 600;
          letter-spacing: 0.18em;
        }
        .footer-sep { opacity: 0.4; }
        .footer-meta {
          color: rgba(244, 235, 220, 0.55);
          text-transform: uppercase;
        }

        /* ====================== ANIMATIONS ====================== */
        @keyframes demoFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ====================== TABLET ====================== */
        @media (max-width: 900px) {
          .hero { padding: 70px 28px 60px; }
          .stats {
            grid-template-columns: 1fr;
            gap: 40px;
            padding: 50px 28px;
          }
          .stat-divider { width: auto; height: 1px; }
          .pillars {
            grid-template-columns: 1fr;
            gap: 50px;
            padding: 70px 28px;
          }
          .engines-numero { font-size: 80px; }
          .engines-grid { grid-template-columns: 1fr 1fr; }
          .quote-mark { font-size: 200px; }
        }

        /* ====================== MOBILE ====================== */
        @media (max-width: 600px) {
          .landing-top { padding: 16px 20px; }
          .landing-brand-name { font-size: 13px; letter-spacing: 0.16em; }
          .hero { padding: 50px 20px 50px; }
          .hero-headline { line-height: 1.05; }
          .hero-lede { font-size: 16.5px; }
          .dropcap { font-size: 50px; padding-right: 10px; }
          .hero-cta { gap: 16px; flex-direction: column; align-items: flex-start; }
          .cta-primary { width: 100%; justify-content: center; padding: 14px 20px; }
          .stats { padding: 40px 20px; gap: 32px; }
          .stat-number { font-size: 64px; }
          .demo-section { padding: 60px 20px; }
          .demo-body { padding: 22px 20px 24px; }
          .demo-stages { min-height: 180px; }
          .demo-engine { min-width: 0; font-size: 12px; }
          .demo-stage { flex-wrap: wrap; gap: 8px; }
          .demo-action { font-size: 11px; }
          .demo-verdict-stats { font-size: 13px; gap: 8px; }
          .engines { padding: 60px 20px; }
          .engines-header { gap: 20px; margin-bottom: 36px; }
          .engines-numero { font-size: 64px; }
          .engines-grid { grid-template-columns: 1fr; }
          .pillars { padding: 60px 20px; gap: 40px; }
          .quote-section { padding: 60px 20px; }
          .quote p { font-size: 19px; }
          .quote-mark { font-size: 140px; top: 0; }
          .final { padding: 60px 20px; }
          .final-text { font-size: 15px; }
          .landing-footer { padding: 24px 20px; flex-direction: column; align-items: flex-start; gap: 10px; }
        }
      `}</style>
    </main>
  );
}
