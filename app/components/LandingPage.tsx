'use client';

// ============================================================
// LANDING PAGE — page d'accueil publique de Prelude
// ------------------------------------------------------------
// Affichee aux visiteurs non connectes a la racine /.
// Voix editoriale : Le Grand Continent / The Atlantic. Phrases denses,
// pas de slogans, pas d emojis, palette papier creme et encre noire.
// Le seul accent couleur autorise est l ocre des autres pages.
//
// Le CTA principal renvoie vers /login pour declencher l acces a l app.
// Une demo animee se trouve sous la fold pour incarner ce que produit
// le pipeline sans avoir a se loguer.
// ============================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface DemoStage {
  /** Nom court du moteur, comme dans le pipeline reel */
  engine: string;
  /** Verbe d action a la 3e personne */
  action: string;
  /** Sortie textuelle simulee, en une ou deux lignes */
  output: string;
}

// Sequence simulee d une analyse. Reprend des libelles proches des
// vrais moteurs sans copier-coller pour ne pas exposer du contenu
// proprietaire. Affiche en boucle dans la fenetre demo.
const DEMO_STAGES: DemoStage[] = [
  { engine: 'Lecture du dossier',  action: 'Pitch deck ingere',          output: 'Dossier reconnu : 28 pages, modele financier en annexe Excel.' },
  { engine: 'Equipe',              action: 'Profils croisés',            output: 'Founder Market Fit : 78/100. Trois cofondateurs, antecedents corporate notables.' },
  { engine: 'Marche',              action: 'Taille adressable testee',   output: 'TAM revendique 12 Md€ verifie a 9.8 Md€. Croissance 14 % CAGR confirmee.' },
  { engine: 'Macro',               action: 'Contexte sectoriel',         output: 'Vent porteur : reglementation europeenne 2026 favorable. Cycle de financement actif.' },
  { engine: 'Extraction financiere', action: 'Modele decompose',         output: 'Revenue projection 8.2 M€ a horizon 2028. Marge brute 64 %, EBITDA positif Y3.' },
  { engine: 'Concurrence',         action: 'Map dressee',                output: 'Sept concurrents identifies dont deux serieux. Differentiation claire sur l axe technique.' },
  { engine: 'Brevets',             action: 'Propriete intellectuelle',   output: 'Trois brevets EPO actifs. Liberte d exploitation verifiee, pas de litige en cours.' },
  { engine: 'Risques',             action: 'Top 5 enjeux',               output: 'Risque cle : dependance a un fournisseur unique. Plan B mentionne, non chiffre.' },
  { engine: 'Blindspot',           action: 'Angles morts du fonds',      output: 'Dossier en zone de confort historique. Pas de signal de rejet structurel.' },
  { engine: 'Verdict',             action: 'Recommandation IC',          output: 'Investir avec conditions. Score global 71/100. Probabilite de succes 64 %.' },
];

const VERDICT_LINE = 'INVESTIR AVEC CONDITIONS · SCORE 71/100 · PROBABILITÉ DE SUCCÈS 64 %';

export default function LandingPage() {
  // Index courant dans la sequence demo, avance automatiquement.
  const [stageIdx, setStageIdx] = useState(0);
  const [completed, setCompleted] = useState<DemoStage[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      setStageIdx((prev) => {
        const next = (prev + 1) % DEMO_STAGES.length;
        // Quand on revient au debut, on vide l historique pour relancer
        // l animation depuis zero, sinon on accumule l etape precedente.
        if (next === 0) {
          setCompleted([]);
        } else {
          setCompleted((c) => [...c, DEMO_STAGES[prev]]);
        }
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const currentStage = DEMO_STAGES[stageIdx];

  return (
    <main className="landing">
      {/* Bandeau de tete : marque + acces a l app pour les visiteurs deja
          identifies sur la machine. Pas de menu de navigation : on a une
          seule page pour le moment, le menu serait un bruit. */}
      <header className="landing-top">
        <div className="landing-brand">
          <span className="landing-brand-bar"></span>
          <span className="landing-brand-name">PRÉLUDE</span>
        </div>
        <Link href="/login" className="landing-top-link">
          Se connecter
        </Link>
      </header>

      {/* Hero typographique. Le titre n est pas un slogan ni une promesse
          mais une description courte de ce que fait Prelude. Le sous-titre
          situe le contexte editorial. */}
      <section className="landing-hero">
        <div className="landing-kicker">Plateforme d&apos;instruction · Capital-risque européen</div>
        <h1 className="landing-headline">
          Instruire un dossier d&apos;investissement
          <br />comme on lit un grand journal.
        </h1>
        <p className="landing-lede">
          Prélude est un moteur d&apos;instruction conçu pour les fonds qui
          considèrent qu&apos;un dossier mérite mieux qu&apos;un résumé en
          trois bullet points. Treize moteurs analytiques travaillent en
          parallèle sur chaque pitch deck, chaque modèle financier, chaque
          jeu de données. La synthèse produite tient en une note rédigée,
          un pack de comité, un verdict argumenté.
        </p>
        <div className="landing-cta">
          <Link href="/login" className="landing-cta-primary">
            Lancer une instruction
          </Link>
          <span className="landing-cta-meta">
            Lien magique par email · Aucun mot de passe
          </span>
        </div>
      </section>

      {/* Demo animee : reproduction stylisee du pipeline en boucle.
          Pas de capture d ecran ni de gif, tout en CSS pour rester leger
          et fluide quel que soit le viewport. */}
      <section className="landing-demo">
        <div className="landing-demo-frame">
          <div className="landing-demo-chrome">
            <span className="landing-demo-dot"></span>
            <span className="landing-demo-dot"></span>
            <span className="landing-demo-dot"></span>
            <span className="landing-demo-title">Pipeline d&apos;instruction · démonstration</span>
          </div>
          <div className="landing-demo-body">
            <div className="landing-demo-stages">
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
            <div className="landing-demo-verdict">
              <div className="demo-verdict-label">Verdict préliminaire</div>
              <div className="demo-verdict-line">{VERDICT_LINE}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trois piliers editoriaux. Pas une liste de features SaaS, plutot
          trois affirmations de fond sur ce que fait Prelude differemment.
          Voulu sec, sans verbe d action publicitaire. */}
      <section className="landing-pillars">
        <article className="pillar">
          <div className="pillar-num">01</div>
          <h2 className="pillar-title">L&apos;instruction prend le pas sur la decision rapide</h2>
          <p className="pillar-text">
            Treize moteurs scrutent un dossier sous des angles complementaires :
            equipe, marche, brevets, financiers, concurrence, blindspot du fonds.
            Aucun raccourci. Une reflexion par moteur, conservee, datée, signée.
          </p>
        </article>
        <article className="pillar">
          <div className="pillar-num">02</div>
          <h2 className="pillar-title">Le comité retrouve sa fonction de jugement</h2>
          <p className="pillar-text">
            Le pack IC tient en trois pages. Verdict, score, probabilité de succes.
            Vote en ligne par membre, consolidation immediate, conditions retenues
            inscrites au compte-rendu. Le rituel reprend la main, la machine s efface.
          </p>
        </article>
        <article className="pillar">
          <div className="pillar-num">03</div>
          <h2 className="pillar-title">La memoire du fonds devient un actif</h2>
          <p className="pillar-text">
            Chaque dossier reste consultable, versionne, commente. Les positions
            individuelles et collectives s archivent. Le fonds construit
            progressivement sa cartographie cognitive, ses biais structurels,
            ses zones de force.
          </p>
        </article>
      </section>

      {/* Citation editoriale. Met en mots la promesse sans la repeter sur
          le ton publicitaire. Inspire de la maxime que Prelude veut tenir
          face aux outils de productivite VC concurrents. */}
      <section className="landing-quote">
        <blockquote>
          <p>
            Un fonds n&apos;investit pas dans des entreprises. Il investit dans
            la qualite de ses propres jugements. Prélude est l&apos;outil qui
            preserve cette exigence quand le rythme de deals s&apos;accelere.
          </p>
        </blockquote>
      </section>

      {/* CTA final. Repete le geste central sans nouvelle promesse. */}
      <section className="landing-final">
        <h2 className="landing-final-title">Commencer une instruction</h2>
        <p className="landing-final-text">
          Deposez un pitch deck. Le pipeline demarre. Vous recevez en quelques minutes
          une note d&apos;investissement complete, un dossier d&apos;analyse navigable,
          un pack IC pret a circuler.
        </p>
        <Link href="/login" className="landing-cta-primary">
          Acceder a Prélude
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-line">
          PRÉLUDE · Le moteur d&apos;instruction des fonds de capital-risque
        </div>
        <div className="landing-footer-meta">
          Paris · 2026 · Confidentiel
        </div>
      </footer>

      <style jsx>{`
        .landing {
          background: var(--paper, #f7f0e6);
          color: var(--ink, #2a1f12);
          font-family: var(--serif, Georgia, 'Times New Roman', serif);
          min-height: 100vh;
        }
        .landing-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 22px 32px;
          border-bottom: 1px solid var(--hairline, rgba(40, 30, 20, 0.10));
        }
        .landing-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .landing-brand-bar {
          display: inline-block;
          width: 18px;
          height: 2px;
          background: var(--accent, #5a4a32);
        }
        .landing-brand-name {
          font-family: var(--serif, Georgia, serif);
          font-size: 13px;
          letter-spacing: 0.18em;
          color: var(--accent, #5a4a32);
          font-weight: 500;
        }
        .landing-top-link {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--ink, #2a1f12);
          text-decoration: none;
          padding: 6px 0;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s;
        }
        .landing-top-link:hover { border-bottom-color: var(--ink, #2a1f12); }

        .landing-hero {
          max-width: 920px;
          margin: 0 auto;
          padding: 80px 32px 60px;
        }
        .landing-kicker {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted, #7a6a52);
          margin-bottom: 28px;
        }
        .landing-headline {
          font-family: var(--serif, Georgia, serif);
          font-size: 56px;
          line-height: 1.08;
          letter-spacing: -0.012em;
          font-weight: 500;
          color: var(--ink, #2a1f12);
          margin: 0 0 30px;
          max-width: 820px;
        }
        .landing-lede {
          font-family: var(--serif, Georgia, serif);
          font-size: 19px;
          line-height: 1.6;
          color: var(--ink-soft, #4a3f30);
          max-width: 720px;
          margin: 0 0 40px;
        }
        .landing-cta {
          display: flex;
          align-items: center;
          gap: 22px;
          flex-wrap: wrap;
        }
        .landing-cta-primary {
          display: inline-block;
          padding: 14px 26px;
          background: var(--ink, #2a1f12);
          color: #f7f0e6;
          font-family: var(--sans, system-ui);
          font-size: 12px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 500;
          text-decoration: none;
          border: 1px solid var(--ink, #2a1f12);
          transition: opacity 0.15s;
        }
        .landing-cta-primary:hover { opacity: 0.88; }
        .landing-cta-meta {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--muted, #7a6a52);
        }

        .landing-demo {
          max-width: 920px;
          margin: 0 auto;
          padding: 0 32px 80px;
        }
        .landing-demo-frame {
          background: var(--surface, #faf5ec);
          border: 1px solid var(--hairline-strong, rgba(40, 30, 20, 0.18));
          box-shadow: 0 4px 32px rgba(40, 30, 20, 0.05);
        }
        .landing-demo-chrome {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          border-bottom: 1px solid var(--hairline, rgba(40, 30, 20, 0.10));
          background: rgba(196, 164, 132, 0.06);
        }
        .landing-demo-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(40, 30, 20, 0.18);
        }
        .landing-demo-title {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted, #7a6a52);
          margin-left: 12px;
        }
        .landing-demo-body {
          padding: 28px 32px 32px;
          font-family: var(--sans, system-ui);
        }
        .landing-demo-stages {
          min-height: 200px;
        }
        .demo-stage {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 4px 0;
          font-size: 13px;
          font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
          opacity: 0;
          animation: demoFade 0.35s ease forwards;
        }
        .demo-done {
          opacity: 0.45;
          color: var(--ink, #2a1f12);
        }
        .demo-active {
          opacity: 1;
          color: var(--ink, #2a1f12);
          font-weight: 500;
        }
        .demo-tick {
          width: 14px;
          color: #5a7a5a;
          flex-shrink: 0;
        }
        .demo-tick-pulse {
          color: var(--accent, #5a4a32);
          animation: demoPulse 1.4s ease-in-out infinite;
        }
        .demo-engine {
          letter-spacing: 0.04em;
          min-width: 180px;
          flex-shrink: 0;
        }
        .demo-action {
          color: var(--muted, #7a6a52);
          font-size: 12px;
        }
        .demo-output {
          margin-top: 18px;
          padding: 14px 16px;
          background: rgba(196, 164, 132, 0.08);
          border-left: 2px solid var(--accent, #5a4a32);
          font-family: var(--serif, Georgia, serif);
          font-size: 14px;
          line-height: 1.55;
          color: var(--ink-soft, #4a3f30);
          animation: demoFade 0.4s ease;
        }
        .landing-demo-verdict {
          margin-top: 26px;
          padding-top: 20px;
          border-top: 1px solid var(--hairline, rgba(40, 30, 20, 0.10));
        }
        .demo-verdict-label {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted, #7a6a52);
          margin-bottom: 8px;
        }
        .demo-verdict-line {
          font-family: var(--serif, Georgia, serif);
          font-size: 16px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: var(--ink, #2a1f12);
        }

        .landing-pillars {
          max-width: 1100px;
          margin: 0 auto;
          padding: 80px 32px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 48px;
          border-top: 1px solid var(--hairline, rgba(40, 30, 20, 0.10));
        }
        .pillar-num {
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--accent, #5a4a32);
          margin-bottom: 18px;
          font-weight: 500;
        }
        .pillar-title {
          font-family: var(--serif, Georgia, serif);
          font-size: 22px;
          font-weight: 500;
          line-height: 1.25;
          color: var(--ink, #2a1f12);
          margin: 0 0 16px;
        }
        .pillar-text {
          font-family: var(--serif, Georgia, serif);
          font-size: 15px;
          line-height: 1.6;
          color: var(--ink-soft, #4a3f30);
          margin: 0;
        }

        .landing-quote {
          max-width: 760px;
          margin: 0 auto;
          padding: 60px 32px 80px;
        }
        .landing-quote blockquote {
          margin: 0;
          padding: 0 0 0 28px;
          border-left: 3px solid var(--accent, #5a4a32);
        }
        .landing-quote p {
          font-family: var(--serif, Georgia, serif);
          font-size: 22px;
          line-height: 1.5;
          font-style: italic;
          color: var(--ink, #2a1f12);
          margin: 0;
        }

        .landing-final {
          max-width: 760px;
          margin: 0 auto;
          padding: 60px 32px 100px;
          text-align: center;
          border-top: 1px solid var(--hairline, rgba(40, 30, 20, 0.10));
        }
        .landing-final-title {
          font-family: var(--serif, Georgia, serif);
          font-size: 36px;
          font-weight: 500;
          color: var(--ink, #2a1f12);
          margin: 0 0 20px;
        }
        .landing-final-text {
          font-family: var(--serif, Georgia, serif);
          font-size: 17px;
          line-height: 1.6;
          color: var(--ink-soft, #4a3f30);
          margin: 0 auto 36px;
          max-width: 580px;
        }

        .landing-footer {
          padding: 32px;
          border-top: 1px solid var(--hairline, rgba(40, 30, 20, 0.10));
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          font-family: var(--sans, system-ui);
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
        }
        .landing-footer-line { color: var(--ink, #2a1f12); }
        .landing-footer-meta { color: var(--muted, #7a6a52); }

        @keyframes demoFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes demoPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        /* Tablette */
        @media (max-width: 900px) {
          .landing-hero { padding: 60px 24px 48px; }
          .landing-headline { font-size: 42px; }
          .landing-lede { font-size: 17px; }
          .landing-pillars {
            grid-template-columns: 1fr;
            gap: 40px;
            padding: 60px 24px;
          }
          .landing-quote p { font-size: 19px; }
        }

        /* Mobile */
        @media (max-width: 600px) {
          .landing-top { padding: 16px 20px; }
          .landing-hero { padding: 44px 20px 40px; }
          .landing-headline { font-size: 32px; line-height: 1.12; }
          .landing-lede { font-size: 16px; }
          .landing-cta { gap: 14px; flex-direction: column; align-items: flex-start; }
          .landing-demo { padding: 0 20px 60px; }
          .landing-demo-body { padding: 22px 20px 24px; }
          .demo-engine { min-width: 0; }
          .demo-stage { flex-wrap: wrap; }
          .landing-pillars { padding: 50px 20px; gap: 36px; }
          .pillar-title { font-size: 19px; }
          .landing-quote { padding: 40px 20px 60px; }
          .landing-quote p { font-size: 17px; }
          .landing-final { padding: 50px 20px 80px; }
          .landing-final-title { font-size: 28px; }
          .landing-final-text { font-size: 15px; }
          .landing-footer { padding: 22px 20px; flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </main>
  );
}
