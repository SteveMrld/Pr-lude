'use client';

import { useState, useRef, useEffect } from 'react';
import InvestmentNoteView from './components/InvestmentNoteView';
import RadarDimensions from './components/RadarDimensions';
import GaugeProbability from './components/GaugeProbability';
import PipelineProgress from './components/PipelineProgress';
import PipelinePreview from './components/PipelinePreview';
import CompetitiveMatrix from './components/CompetitiveMatrix';
import { enrichProse, splitIntoParagraphs } from '@/lib/note-typography';
import {
  PictoSeal,
  PictoFlag,
  PictoCompass,
  PictoEye,
  PictoNet,
  PictoScale,
  PictoGlobe,
  PictoHourglass,
  PictoDocument,
  PictoTeam,
  PictoPyramid,
  PictoPhone,
  PictoSpiral,
  ENGINE_PICTOS,
} from './components/Pictos';

const ENGINES = [
  { id: 'extraction', name: 'Lecture du dossier', label: 'Structuration des informations du pitch deck' },
  { id: 'team', name: 'Équipe', label: 'Couverture systémique, anti-fragilité, transposition d\'expérience' },
  { id: 'market', name: 'Marché', label: 'Intensité du besoin, défensibilité, comparables internationaux' },
  { id: 'macro', name: 'Macro', label: 'Position cycle, géopolitique, fenêtre temporelle critique' },
  { id: 'financial-extraction', name: 'Extraction financière', label: 'Données financières du deck et du business plan' },
  { id: 'pattern', name: 'Pattern matching', label: 'Confrontation au corpus de cas instruits' },
  { id: 'causal', name: 'Retournement causal', label: 'Sept angles morts et questions à instruire' },
  { id: 'blindspot', name: 'Aveuglement collectif', label: 'Détection des dix patterns d\'erreur de jugement VC' },
  { id: 'contrarian', name: 'Singularités contrariennes', label: 'Détection des dix signaux qui justifient le pari à contre-courant' },
  { id: 'financial-coherence', name: 'Cohérence financière', label: 'Sept tests de cohérence des projections et unit economics' },
  { id: 'orchestrate', name: 'Orchestration', label: 'Synthèse, probabilités chiffrées, résolution dialectique' },
  { id: 'reference-checks', name: 'Reference checks', label: 'Plan d\'appels DD terrain : fondateurs, clients, gouvernance' },
];

const ARCHETYPE_LABELS: Record<string, string> = {
  'interpretive': 'Interprétatif',
  'depth': 'Profondeur d\'instruction',
  'capacity': 'Capacité opérationnelle',
  'cumulative-mid': 'Cumulé moyen terme',
  'cumulative-long': 'Cumulé long terme',
};

const BLINDSPOT_LABELS: Record<string, string> = {
  maturiteExecution: 'Maturité d\'exécution',
  intensiteBesoin: 'Intensité du besoin',
  distributionAcquise: 'Distribution acquise',
  antiFragilite: 'Anti-fragilité',
  coherenceNarrative: 'Cohérence narrative',
  signauxOrganiques: 'Signaux organiques',
  timingContracyclique: 'Timing contracyclique',
};

type EngineState = {
  status: 'idle' | 'running' | 'done' | 'error';
  startedAt?: number;
  completedAt?: number;
};

export default function HomeClient({
  userEmail,
  orgName,
  authEnabled = false,
}: {
  userEmail?: string;
  orgName?: string;
  authEnabled?: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [engineStates, setEngineStates] = useState<Record<string, EngineState>>(
    Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }]))
  );
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('synthesis');
  const [viewMode, setViewMode] = useState<'dashboard' | 'note'>('dashboard');
  const [printMode, setPrintMode] = useState(false); // quand true, toutes les sections rendues simultanement pour export PDF complet
  // Note d investissement : mode compact (lecture rapide) vs mode complet
  // (lecture exhaustive). Persistance via localStorage. Le mode compact replie
  // les sections 2 et 4 par defaut. Le mode print force compactNoteMode=false
  // pour que l export PDF reste complet.
  const [compactNoteMode, setCompactNoteMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('prelude_compact_note') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('prelude_compact_note', String(compactNoteMode));
    } catch {}
  }, [compactNoteMode]);
  // Persistence : ID de l analyse sauvegardee (pour bouton "voir dans l historique")
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  // Pipeline timing : pour mesurer la duree d execution et la stocker en metadonnees
  const [pipelineStartTime, setPipelineStartTime] = useState<number | null>(null);
  // Etat de chargement d une analyse passee depuis ?analysis=ID
  const [loadingPastAnalysis, setLoadingPastAnalysis] = useState(false);

  // Charge automatiquement une analyse passee si l URL contient ?analysis=ID.
  // Permet d arriver depuis /history -> bouton "Ouvrir" et restaurer la note.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const analysisId = url.searchParams.get('analysis');
    if (!analysisId) return;

    setLoadingPastAnalysis(true);
    fetch(`/api/analyses/${analysisId}`)
      .then((res) => {
        if (!res.ok) throw new Error('not-found');
        return res.json();
      })
      .then((data) => {
        if (data?.analysis?.resultJson) {
          setResult(data.analysis.resultJson);
          setSavedAnalysisId(analysisId);
        }
      })
      .catch(() => {
        setError('Analyse introuvable ou non accessible.');
      })
      .finally(() => {
        setLoadingPastAnalysis(false);
      });
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelect(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(newFiles)) {
      const lower = f.name.toLowerCase();
      const isPdf = f.type.includes('pdf') || lower.endsWith('.pdf');
      const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
      if (!isPdf && !isExcel) {
        rejected.push(f.name);
        continue;
      }
      if (f.size > 32 * 1024 * 1024) {
        rejected.push(f.name + ' (dépasse 32 Mo)');
        continue;
      }
      accepted.push(f);
    }
    if (rejected.length > 0) {
      setError('Fichiers refusés : ' + rejected.join(', ') + '. Formats acceptés : PDF, XLSX, XLS, CSV.');
    } else {
      setError(null);
    }
    setFiles(prev => [...prev, ...accepted]);
    setResult(null);
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResult(null);
  }


  async function analyze() {
    if (files.length === 0) return;
    const hasPdf = files.some(f => f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf'));
    if (!hasPdf) {
      setError('Au moins un fichier PDF (pitch deck) est requis');
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSavedAnalysisId(null);
    setPipelineStartTime(Date.now());
    setEngineStates(Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }])));

    // Wake Lock : empeche l'ecran de dormir pendant le pipeline.
    // Non bloquant : si le navigateur ne supporte pas ou refuse, on continue.
    let wakeLock: any = null;
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch (_e) {
      // Wake Lock non disponible : on continue sans
    }

    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append('files', f);
      }

      const response = await fetch('/api/analyze', { method: 'POST', body: formData });

      if (!response.ok || !response.body) {
        const errBody = await response.text();
        throw new Error(errBody || 'Erreur reseau');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedTerminal = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;
          const evtLines = event.split('\n');
          let eventType = '';
          let dataStr = '';
          for (const line of evtLines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!eventType || !dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (eventType === 'engine-start') {
              setEngineStates(prev => ({
                ...prev,
                [data.engine]: { status: 'running', startedAt: Date.now() }
              }));
            } else if (eventType === 'engine-done') {
              setEngineStates(prev => ({
                ...prev,
                [data.engine]: { ...prev[data.engine], status: 'done', completedAt: Date.now() }
              }));
            } else if (eventType === 'complete') {
              setResult(data);
              receivedTerminal = true;

              // Sauvegarde automatique en arriere-plan si la persistence est
              // activee. Non-bloquant : si la sauvegarde echoue (persistence
              // off, user non auth, base down), l analyse reste affichee
              // normalement a l ecran. La persistence est une fonctionnalite
              // additive, jamais un point critique du pipeline.
              const sourceFilename = files[0]?.name || null;
              const pipelineDurationMs = pipelineStartTime ? Date.now() - pipelineStartTime : null;
              fetch('/api/analyses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  result: data,
                  sourceFilename,
                  pipelineDurationMs,
                }),
              })
                .then((res) => res.json())
                .then((saved) => {
                  if (saved?.saved && saved?.id) {
                    setSavedAnalysisId(saved.id);
                  }
                })
                .catch(() => {
                  // silencieux : la persistence n est pas critique
                });
            } else if (eventType === 'error') {
              setError(data.message);
              receivedTerminal = true;
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }

      // Stream termine sans event complete ni error : probable timeout serveur
      if (!receivedTerminal) {
        throw new Error('Le pipeline s\'est interrompu avant la fin (probable timeout serveur). Recharge la page et réessaie. Si le problème persiste, le pipeline prend trop de temps et il faut réduire la charge.');
      }
    } catch (e: any) {
      setError(e.message || 'Erreur reseau');
    } finally {
      setAnalyzing(false);
      // Release Wake Lock
      if (wakeLock) {
        try { await wakeLock.release(); } catch (_e) {}
      }
    }
  }


  function reset() {
    setFiles([]);
    setResult(null);
    setError(null);
    setEngineStates(Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }])));
    setActiveTab('synthesis');
    if (inputRef.current) inputRef.current.value = '';
  }

  function getBarClass(score: number) {
    if (score < 35) return 'warn';
    if (score >= 70) return 'good';
    return '';
  }

  function formatDuration(ms: number) {
    return (ms / 1000).toFixed(1) + 's';
  }

  return (
    <>
      <header className="header">
        <div>
          <div className="brand">Prélude</div>
          <div className="brand-meta">Plateforme d'instruction VC · Analyse rigoureuse en pipeline</div>
        </div>
        {authEnabled && orgName && (
          <div className="header-identity">
            <div className="header-org">{orgName}</div>
            {userEmail && <div className="header-user">{userEmail}</div>}
            <div className="header-actions">
              <a className="header-action" href="/settings">Réglages</a>
              <button
                className="header-action"
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  window.location.href = '/login';
                }}
                aria-label="Se déconnecter"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="main">
        {/* Bandeau de progression du pipeline en sticky en haut.
            S'affiche pendant le run (analyzing=true) ET reste visible
            une fois le pipeline termine pour permettre de cliquer sur
            un moteur et scroller vers la section correspondante du
            dashboard. Inspire du flow Meegle. */}
        {(analyzing || result) && (
          <PipelineProgress
            engines={ENGINES}
            states={engineStates}
            analyzing={analyzing}
            elapsedMs={pipelineStartTime ? Date.now() - pipelineStartTime : undefined}
            onEngineClick={(engineId) => {
              // Scroll vers l'ancre du moteur si elle existe dans le dashboard
              const target = document.getElementById(`engine-section-${engineId}`);
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          />
        )}

        {!result && !analyzing && (
          <>
            {/* HERO - refonte sobre :
                - Un seul titre fort, ton editorial Le Grand Continent
                - Sous-titre dense en une seule phrase
                - UN SEUL CTA vers la zone de depot
                - Preview animee du pipeline juste en dessous (wow effect
                  sans charger la home)
                Pas de logos clients (Prelude est en early stage), pas
                d emojis, pas de tone fun corporate americain. */}
            <section className="landing-hero">
              <div className="hero-rule" aria-hidden="true"></div>
              <div className="page-kicker">
                <span className="page-kicker-bullet" aria-hidden="true"></span>
                <span>Prélude — Depuis 2026</span>
              </div>
              <h1 className="page-title">
                <span className="page-title-line">Instruire un dossier</span>
                <span className="page-title-line page-title-emph">comme on instruit une affaire.</span>
              </h1>
              <p className="page-subtitle">
                Sonder l&apos;équipe, auditer le marché, tester la cohérence des unit economics, cartographier les angles morts.
                Chaque étape d&apos;une due diligence partner-grade, avant le comité d&apos;investissement.
              </p>
              <div className="hero-cta-row" style={{ justifyContent: 'flex-start' }}>
                <a href="#commencer" className="btn btn-primary">Lancer une instruction →</a>
              </div>

              {/* Preview animée du pipeline : illustration concrète de
                  ce que produit Prélude. Boucle en ~10s. */}
              <PipelinePreview />
            </section>

            {/* SECTION 2 - Le problème */}
            <section className="landing-section">
              <div className="landing-h2-block">
                <div className="landing-h2-num">I.</div>
                <h2 className="landing-h2">Pourquoi Prélude existe.</h2>
              </div>
              <div className="landing-prose">
                <p className="landing-prose-lead">
                  Le métier du capital-risque souffre d&apos;angles morts structurels. Les fonds font face à un déficit chronique de capital patient, à des biais de pedigree hérités, et à des cadres macroéconomiques distincts qui appellent une instruction propre.
                </p>
                <p>
                  Les outils d&apos;analyse existants ont été conçus pour le marché américain. Ils transposent mécaniquement des grilles SaaS, des seuils de croissance et des comparables qui ne s&apos;appliquent ni à un industriel deeptech français, ni à un éditeur SaaS allemand, ni à un acteur défense scandinave, ni d&apos;ailleurs à un fonds family-office moyen-oriental.
                </p>
                <p>
                  Prélude est conçu autour d&apos;une méthode d&apos;instruction qui distingue le diagnostic chiffré, la lecture critique, la lecture dialectique et la décision. Une logique applicable à tout dossier, calibrée sur les sources et patterns européens consolidés (Atomico, EU-INC, pipeline réglementaire EU 2026) sans s&apos;y limiter.
                </p>
              </div>
            </section>

            {/* SECTION 3 - Ce que fait Prélude (les 12 dimensions) */}
            <section className="landing-section" id="methode">
              <div className="landing-h2-block">
                <div className="landing-h2-num">II.</div>
                <h2 className="landing-h2">Douze dimensions d'analyse, en pipeline.</h2>
              </div>
              <p className="landing-section-intro">
                Chaque dossier traverse douze étapes d'analyse interconnectées. Certaines extraient les données brutes, d'autres confrontent au corpus de cas, d'autres encore débusquent les biais de jugement systémiques du métier.
              </p>
              <ol className="dimensions-grid">
                {[
                  { id: 'extraction', num: '01', name: 'Lecture du dossier', desc: 'Structuration des informations du pitch deck, identification des fondateurs, du modèle, des projections.' },
                  { id: 'team', num: '02', name: 'Équipe', desc: "Couverture systémique de l'équipe, anti-fragilité, transposition d'expérience sectorielle." },
                  { id: 'market', num: '03', name: 'Marché', desc: 'Intensité du besoin, défensibilité, comparables internationaux.' },
                  { id: 'macro', num: '04', name: 'Macro', desc: 'Position dans le cycle, géopolitique, fenêtre temporelle critique, capital VC sur le segment.' },
                  { id: 'financial-extraction', num: '05', name: 'Extraction financière', desc: 'Données financières du deck et du business plan, projections, hypothèses sous-jacentes.' },
                  { id: 'pattern', num: '06', name: 'Pattern matching', desc: 'Confrontation au corpus de cas instruits historiques, identification des trajectoires comparables.' },
                  { id: 'causal', num: '07', name: 'Retournement causal', desc: 'Sept angles morts du métier VC et questions critiques à instruire en due diligence.' },
                  { id: 'blindspot', num: '08', name: 'Aveuglement collectif', desc: "Détection des dix patterns d'erreur de jugement systémique du métier (Theranos, WeWork, Ynsect)." },
                  { id: 'contrarian', num: '09', name: 'Singularités contrariennes', desc: 'Détection des dix signaux qui justifient le pari à contre-courant (Wiz, Stripe, Deepmind).' },
                  { id: 'financial-coherence', num: '10', name: 'Cohérence financière', desc: 'Sept tests de cohérence des projections et unit economics, calibrés selon le business model.' },
                  { id: 'orchestrate', num: '11', name: 'Orchestration', desc: "Synthèse, probabilités chiffrées par dimension, résolution dialectique de la tension d'investissement." },
                  { id: 'reference-checks', num: '12', name: 'Reference checks', desc: "Plan d'appels DD terrain : fondateurs, clients, gouvernance, signaux faibles à vérifier." },
                ].map((d) => {
                  const Picto = ENGINE_PICTOS[d.id as keyof typeof ENGINE_PICTOS];
                  return (
                    <li className="dim-card" key={d.id}>
                      <div className="dim-card-head">
                        <div className="dim-num">{d.num}</div>
                        <div className="dim-picto" aria-hidden="true">{Picto && <Picto />}</div>
                      </div>
                      <div className="dim-name">{d.name}</div>
                      <div className="dim-desc">{d.desc}</div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* SECTION 4 - Pour qui */}
            <section className="landing-section">
              <div className="landing-h2-block">
                <div className="landing-h2-num">III.</div>
                <h2 className="landing-h2">Pensé pour les comités d&apos;investissement exigeants.</h2>
              </div>
              <div className="landing-prose">
                <p>
                  Prélude s'adresse aux fonds early-stage et growth-stage qui instruisent en moyenne 200 à 500 dossiers par an et n'en transforment qu'une poignée. Le goulot d'étranglement n'est pas l'accès au deal flow, c'est la qualité et la profondeur de l'instruction.
                </p>
                <p>
                  La plateforme est calibrée pour la rigueur européenne sans s&apos;y limiter : sources consolidées trimestriellement (Atomico, PitchBook, Bain, Correlation Ventures), pipeline réglementaire EU 2026 (28e régime, AI Development Act, Quantum Act), comparables européens 2024-2026 (Helsing, Mistral, NScale, Quantum-Systems), méthode applicable à tout dossier mondial.
                </p>
              </div>
            </section>

            {/* SECTION 5 - Le livrable */}
            <section className="landing-section">
              <div className="landing-h2-block">
                <div className="landing-h2-num">IV.</div>
                <h2 className="landing-h2">Une note d'investissement IC-ready en quelques minutes.</h2>
              </div>
              <p className="landing-section-intro">
                En sortie de pipeline, Prélude produit une note d'instruction structurée comme un memo de partner senior : argumentaire dialectique, scores chiffrés, conditions actionnables.
              </p>
              <div className="deliverable-grid">
                <div className="deliverable-block">
                  <div className="deliverable-num">1.</div>
                  <div className="deliverable-name">Company &amp; Project</div>
                  <div className="deliverable-desc">Synthèse du dossier, executive staff, projections financières, modèle économique.</div>
                </div>
                <div className="deliverable-block">
                  <div className="deliverable-num">2.</div>
                  <div className="deliverable-name">Investment Thesis</div>
                  <div className="deliverable-desc">Verdict, score chiffré, probabilité de succès. The case for, the case against, dialectical resolution.</div>
                </div>
                <div className="deliverable-block">
                  <div className="deliverable-num">3.</div>
                  <div className="deliverable-name">Risk &amp; Comparables</div>
                  <div className="deliverable-desc">Strategic, operational, financial risks. Competitive positioning. Comparables historiques internationaux.</div>
                </div>
                <div className="deliverable-block">
                  <div className="deliverable-num">4.</div>
                  <div className="deliverable-name">Transaction &amp; Conditions</div>
                  <div className="deliverable-desc">Stage, nominal, valuation. Conditions clés actionnables, plan de structuring 0-3 / 3-12 / 12+ mois.</div>
                </div>
              </div>
            </section>

            {/* SECTION 6 - Méthode et sources */}
            <section className="landing-section">
              <div className="landing-h2-block">
                <div className="landing-h2-num">V.</div>
                <h2 className="landing-h2">Quatre sources externes, consolidées trimestriellement.</h2>
              </div>
              <p className="landing-section-intro">
                La rigueur méthodologique de Prélude repose sur un corpus externe consolidé chaque trimestre, qui sert de borne calibrée pour tous les jugements quantitatifs.
              </p>
              <ol className="sources-grid">
                <li className="source-card">
                  <div className="source-num">01</div>
                  <div className="source-name">PitchBook-NVCA</div>
                  <div className="source-edition">Venture Monitor Q1 2026</div>
                  <div className="source-desc">Médianes pré-money par stade, séparation IA vs non-IA, concentration extrême du capital US, step-up médian.</div>
                </li>
                <li className="source-card">
                  <div className="source-num">02</div>
                  <div className="source-name">Atomico</div>
                  <div className="source-edition">State of European Tech 2025</div>
                  <div className="source-desc">Profondeur du marché européen, allocation pension funds VC, Mighty 50, pipeline réglementaire EU 2026.</div>
                </li>
                <li className="source-card">
                  <div className="source-num">03</div>
                  <div className="source-name">Bain &amp; Company</div>
                  <div className="source-edition">Global Private Equity Report 2025</div>
                  <div className="source-desc">Liquidité LP, distributions to NAV, gap fundraising entre top et bottom quartile, multiples buyout EBITDA.</div>
                </li>
                <li className="source-card">
                  <div className="source-num">04</div>
                  <div className="source-name">Correlation &amp; Cambridge</div>
                  <div className="source-edition">Power-law VC returns</div>
                  <div className="source-desc">Loi de puissance des retours VC, benchmarks TRI et TVPI par quartile, persistance Kaplan-Schoar.</div>
                </li>
              </ol>
            </section>

            {/* SECTION 7 - CTA upload */}
            <section className="landing-section landing-cta-section" id="commencer">
              <div className="landing-h2-block">
                <div className="landing-h2-num">VI.</div>
                <h2 className="landing-h2">Commencer l'instruction.</h2>
              </div>
              <p className="landing-section-intro">
                Déposez un dossier d'investissement complet : pitch deck PDF, business plan Excel ou CSV, et tout autre document utile. Le pipeline démarre immédiatement.
              </p>

              {files.length === 0 ? (
                <div className={`upload-box ${dragging ? 'dragging' : ''}`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFilesSelect(e.dataTransfer.files); }}>
                  <div className="upload-icon">▤</div>
                  <div className="upload-label">Déposer un dossier d'investissement</div>
                  <div className="upload-hint">PDF (deck), XLSX/CSV (BP), 32 Mo max par fichier · Cliquer ou glisser-déposer · Plusieurs fichiers acceptés</div>
                  <input ref={inputRef} type="file" multiple accept="application/pdf,.pdf,.xlsx,.xls,.csv"
                    className="upload-input"
                    onChange={(e) => handleFilesSelect(e.target.files)} />
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    {files.map((f, i) => {
                      const lower = f.name.toLowerCase();
                      const isPdf = f.type.includes('pdf') || lower.endsWith('.pdf');
                      const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
                      const nature = lower.includes('business plan') || lower.includes('bp ') || lower.includes('financial') || isExcel
                        ? 'Business Plan'
                        : (lower.includes('pitch') || lower.includes('deck') || lower.includes('teaser') || isPdf ? 'Pitch Deck' : 'Document');
                      return (
                        <div key={i} className="file-info" style={{ marginBottom: 8 }}>
                          <div>
                            <div className="file-name">{f.name}</div>
                            <div className="file-size">{(f.size / 1024 / 1024).toFixed(2)} Mo · <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, opacity: 0.7 }}>{nature}</span></div>
                          </div>
                          <button className="btn" onClick={() => removeFile(i)}>Retirer</button>
                        </div>
                      );
                    })}
                    <button className="btn" style={{ marginTop: 8 }} onClick={() => inputRef.current?.click()}>+ Ajouter un fichier</button>
                    <input ref={inputRef} type="file" multiple accept="application/pdf,.pdf,.xlsx,.xls,.csv"
                      style={{ display: 'none' }}
                      onChange={(e) => { handleFilesSelect(e.target.files); if (inputRef.current) inputRef.current.value = ''; }} />
                  </div>
                  <div className="cta-row">
                    <button className="btn btn-primary" onClick={analyze}>Lancer le pipeline →</button>
                  </div>
                </>
              )}

              {error && <div className="error-box"><div className="error-title">Erreur</div><div>{error}</div></div>}
            </section>

            {/* COLOPHON FOOTER */}
            <footer className="landing-footer">
              <div className="landing-footer-line">Prélude · Le moteur d&apos;instruction des fonds de capital-risque</div>
              <div className="landing-footer-line muted">Document confidentiel · Usage strictement interne au Comité d'Investissement</div>
            </footer>
          </>
        )}

        {analyzing && (
          <div className="pipeline">
            <div className="pipeline-head">
              <div className="pipeline-title">Pipeline en cours d'exécution</div>
              <div className="pipeline-sub">Onze moteurs travaillent en parallèle ou en cascade selon les dépendances. Suivi en temps réel dans le bandeau ci-dessus.</div>
            </div>
            <div style={{ padding: '12px 18px', background: '#faf3ec', border: '1px solid #c4a484', marginBottom: 16, fontSize: 12, lineHeight: 1.5 }}>
              <strong>Sur mobile :</strong> ne verrouille pas l'écran et ne change pas d'application pendant les 3-4 minutes du pipeline.
              La connexion au serveur se coupe si le téléphone passe en veille. Pose le téléphone à plat avec l'écran allumé.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('prelude_active_job');
                    localStorage.removeItem('prelude_active_job_started_at');
                  } catch (e) {}
                  setAnalyzing(false);
                  setFiles([]);
                  setEngineStates(Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }])));
                }}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  background: 'transparent',
                  border: '1px solid var(--ink)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'var(--ink)',
                }}>
                Annuler et recommencer
              </button>
            </div>
            {/* Vue detaillee verticale conservee en complement du bandeau sticky.
                Le bandeau donne la vue de flux ; cette liste donne le detail
                avec sous-titres explicatifs. Utile pour les utilisateurs qui
                veulent comprendre ce que fait chaque moteur. */}
            {ENGINES.map((engine, idx) => {
              const state = engineStates[engine.id];
              const duration = state.completedAt && state.startedAt
                ? formatDuration(state.completedAt - state.startedAt) : null;
              return (
                <div key={engine.id} className="engine-row">
                  <div className={`engine-status ${state.status}`}>
                    {state.status === 'idle' && (idx + 1)}
                    {state.status === 'running' && '·'}
                    {state.status === 'done' && '✓'}
                    {state.status === 'error' && '✕'}
                  </div>
                  <div>
                    <div className="engine-name">{engine.name}</div>
                    <div className="engine-label">{engine.label}</div>
                  </div>
                  <div className="engine-time">{duration || ''}</div>
                </div>
              );
            })}
          </div>
        )}

        {result && (
          <>
            {/* Toggle de vue : Dashboard vs Note d'investissement, plus bouton export */}
            <div className="view-toggle-row" style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => setViewMode('dashboard')}
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: viewMode === 'dashboard' ? 'var(--ink)' : 'transparent',
                  color: viewMode === 'dashboard' ? '#fefefe' : 'var(--ink)',
                  border: '1px solid var(--ink)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                Dashboard analytique
              </button>
              <button
                onClick={() => setViewMode('note')}
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: viewMode === 'note' ? 'var(--ink)' : 'transparent',
                  color: viewMode === 'note' ? '#fefefe' : 'var(--ink)',
                  border: '1px solid var(--ink)',
                  borderLeft: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                Note d&apos;investissement
              </button>

              {/* Toggle Lecture rapide / Lecture complete - visible uniquement
                  en vue note. La lecture rapide replie les sections 2 (Proposed
                  Project) et 4 (Transaction Features) par defaut. La preference
                  est persistee via localStorage. L export PDF reste TOUJOURS
                  complet, independant de ce toggle. */}
              {viewMode === 'note' && (
                <div style={{ display: 'flex', marginLeft: 6 }}>
                  <button
                    onClick={() => setCompactNoteMode(true)}
                    title="Replie les sections secondaires (Proposed Project, Transaction Features). Verdict, score et conditions cles restent visibles."
                    style={{
                      padding: '8px 14px',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      background: compactNoteMode ? '#5a4a32' : 'transparent',
                      color: compactNoteMode ? '#fefefe' : 'var(--ink)',
                      border: '1px solid #5a4a32',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>
                    Lecture rapide
                  </button>
                  <button
                    onClick={() => setCompactNoteMode(false)}
                    title="Affiche toutes les sections de la note depliees."
                    style={{
                      padding: '8px 14px',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      background: !compactNoteMode ? '#5a4a32' : 'transparent',
                      color: !compactNoteMode ? '#fefefe' : 'var(--ink)',
                      border: '1px solid #5a4a32',
                      borderLeft: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>
                    Lecture complète
                  </button>
                </div>
              )}
              {/* Bouton export PDF : active printMode qui rend toutes les sections
                  (dashboard analytique + note d investissement) simultanement,
                  puis envoie le HTML rendu a la route serveur /api/export-pdf
                  qui genere le PDF avec Puppeteer. Plus fiable que window.print()
                  qui produit des PDF corrompus selon le navigateur (Chrome desktop
                  generait des fichiers 0 octets, Android coupait au bout de 4 pages). */}
              <button
                onClick={async () => {
                  setPrintMode(true);
                  // Attendre que React rende toutes les sections en printMode
                  await new Promise((r) => setTimeout(r, 800));

                  try {
                    // Recuperer le HTML rendu de la zone de contenu principale
                    const mainEl = document.querySelector('.dashboard-content') || document.querySelector('main');
                    if (!mainEl) {
                      throw new Error('Zone de contenu non trouvee');
                    }
                    const html = mainEl.outerHTML;

                    // Recuperer tous les styles : <style> inline + feuilles externes
                    const styleSheets = Array.from(document.styleSheets);
                    const cssRules: string[] = [];
                    for (const sheet of styleSheets) {
                      try {
                        const rules = sheet.cssRules || sheet.rules;
                        if (rules) {
                          for (let i = 0; i < rules.length; i++) {
                            cssRules.push(rules[i].cssText);
                          }
                        }
                      } catch {
                        // CORS sur certaines feuilles externes : on ignore
                      }
                    }
                    const css = cssRules.join('\n');

                    // Appel a la route serveur
                    const companyName = result?.extraction?.companyName || 'analyse';
                    const fileName = `prelude-${String(companyName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

                    const res = await fetch('/api/export-pdf', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        html,
                        css,
                        title: `Prelude · ${companyName}`,
                        fileName,
                      }),
                    });

                    if (!res.ok) {
                      const errorData = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
                      throw new Error(errorData.error || `HTTP ${res.status}`);
                    }

                    // Telecharger le PDF
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err: any) {
                    console.error('Export PDF echec:', err);
                    alert('Echec export PDF : ' + (err?.message || 'erreur inconnue'));
                  } finally {
                    setPrintMode(false);
                  }
                }}
                title="Exporter le dashboard analytique complet et la note d investissement en PDF"
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  color: 'var(--ink)',
                  border: '1px solid var(--ink)',
                  marginLeft: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                ⤓ Exporter en PDF
              </button>
              {/* Lien vers l historique des analyses sauvegardees + indicateur
                  visuel discret quand l analyse en cours a ete persistee */}
              <a
                href="/history"
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  color: 'var(--ink)',
                  border: '1px solid var(--ink)',
                  marginLeft: 8,
                  textDecoration: 'none',
                  fontFamily: 'inherit',
                }}
                title="Voir l historique des analyses"
              >
                Historique
              </a>
              {savedAnalysisId && (
                <span style={{
                  marginLeft: 12,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--vert-foret)',
                  alignSelf: 'center',
                }}>
                  ✓ Sauvegardée
                </span>
              )}
            </div>

            {/* NIVEAU 3.A : Bloc d annotation utilisateur.
                Apparait uniquement quand l analyse est sauvegardee
                (savedAnalysisId existe). Permet a l utilisateur d ajouter
                des notes libres qui seront stockees et reutilisees comme
                contexte d apprentissage sur les futurs dossiers du meme
                secteur. */}
            {savedAnalysisId && (
              <AnnotationBlock analysisId={savedAnalysisId} />
            )}

            {/* En mode normal: bascule selon viewMode. En mode print: rend dashboard + note en cascade. */}
            {(viewMode === 'note' && !printMode) ? (
              <InvestmentNoteView result={result} compactMode={compactNoteMode} />
            ) : (
              <>
            {/* Bandeau audit des assertions : signale les noms / dates / devises
                non sources detectes mecaniquement dans les outputs des moteurs.
                Si > 5 warnings, encadre rouge ; sinon encadre ambre discret. */}
            {result.assertionAudit && result.assertionAudit.totalWarnings > 0 && (
              <div style={{
                marginBottom: 18, padding: '12px 16px',
                background: result.assertionAudit.totalWarnings > 5
                  ? 'rgba(220, 80, 60, 0.10)'
                  : 'rgba(220, 160, 60, 0.08)',
                border: result.assertionAudit.totalWarnings > 5
                  ? '1px solid rgba(220, 80, 60, 0.35)'
                  : '1px solid rgba(220, 160, 60, 0.30)',
                borderRadius: 4,
                fontSize: 12,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 }}>
                  Audit des assertions · {result.assertionAudit.totalWarnings} point{result.assertionAudit.totalWarnings > 1 ? 's' : ''} à vérifier
                </div>
                <div style={{ opacity: 0.9, lineHeight: 1.55 }}>
                  {result.assertionAudit.byCategory.unknown_name ? (
                    <span style={{ marginRight: 14 }}>
                      <strong>{result.assertionAudit.byCategory.unknown_name}</strong> nom{result.assertionAudit.byCategory.unknown_name > 1 ? 's' : ''} propre{result.assertionAudit.byCategory.unknown_name > 1 ? 's' : ''} non sourcé{result.assertionAudit.byCategory.unknown_name > 1 ? 's' : ''} dans le pitch
                    </span>
                  ) : null}
                  {result.assertionAudit.byCategory.currency_mismatch ? (
                    <span style={{ marginRight: 14 }}>
                      <strong>{result.assertionAudit.byCategory.currency_mismatch}</strong> conversion{result.assertionAudit.byCategory.currency_mismatch > 1 ? 's' : ''} de devise non explicitée{result.assertionAudit.byCategory.currency_mismatch > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {result.assertionAudit.byCategory.invented_date ? (
                    <span style={{ marginRight: 14 }}>
                      <strong>{result.assertionAudit.byCategory.invented_date}</strong> date{result.assertionAudit.byCategory.invented_date > 1 ? 's' : ''} sans correspondance pitch
                    </span>
                  ) : null}
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 11, opacity: 0.7 }}>Voir le détail</summary>
                  <div style={{ marginTop: 10, paddingLeft: 8, borderLeft: '2px solid rgba(255,255,255,0.15)' }}>
                    {result.assertionAudit.warnings.slice(0, 12).map((w: any, i: number) => (
                      <div key={i} style={{ marginBottom: 10, fontSize: 11, lineHeight: 1.5 }}>
                        <div style={{ opacity: 0.5, fontSize: 10 }}>
                          {w.engine} · {w.field}
                        </div>
                        <div style={{ opacity: 0.9 }}>{w.message}</div>
                        {w.excerpt && (
                          <div style={{ marginTop: 4, fontStyle: 'italic', opacity: 0.6 }}>
                            « …{w.excerpt}… »
                          </div>
                        )}
                      </div>
                    ))}
                    {result.assertionAudit.warnings.length > 12 && (
                      <div style={{ fontSize: 10, opacity: 0.6 }}>
                        … et {result.assertionAudit.warnings.length - 12} autre{result.assertionAudit.warnings.length - 12 > 1 ? 's' : ''}.
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* Recommandation hero enrichie */}
            <div className="reco-card">
              <div className="small-caps" style={{ opacity: 0.7, marginBottom: 8 }}>Recommandation finale du pipeline</div>
              <div className="reco-verdict">{result.finalRecommendation?.verdict || '—'}</div>

              {/* Probabilités chiffrées success/failure */}
              {result.finalRecommendation?.successProbability !== undefined && (
                <div style={{ display: 'flex', gap: 32, marginTop: 20, marginBottom: 24, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Probabilité de succès</div>
                    <div style={{ fontSize: 42, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1 }}>
                      {result.finalRecommendation.successProbability}<span style={{ fontSize: 20, opacity: 0.7 }}>%</span>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Probabilité d'échec</div>
                    <div style={{ fontSize: 42, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1, opacity: 0.85 }}>
                      {result.finalRecommendation.failureProbability}<span style={{ fontSize: 20, opacity: 0.7 }}>%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Jauge avec seuils */}
              {result.finalRecommendation?.investmentThreshold && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
                    Score global · Seuils de décision
                  </div>
                  <div style={{ position: 'relative', height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    {/* Seuils marqués */}
                    {[
                      { v: result.finalRecommendation.investmentThreshold.thresholdToInvestigate, label: 'Approfondir' },
                      { v: result.finalRecommendation.investmentThreshold.thresholdToCondition, label: 'Conditions' },
                      { v: result.finalRecommendation.investmentThreshold.thresholdToInvest, label: 'Investir' },
                    ].map((t, i) => (
                      <div key={i} style={{
                        position: 'absolute', left: `${t.v}%`, top: 0, height: '100%',
                        borderLeft: '1px dashed rgba(255,255,255,0.3)',
                      }}>
                        <div style={{ position: 'absolute', top: -16, left: 4, fontSize: 10, opacity: 0.6 }}>
                          {t.v}
                        </div>
                      </div>
                    ))}
                    {/* Niveau actuel */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${result.finalRecommendation.investmentThreshold.currentLevel || result.finalRecommendation.globalScore}%`,
                      background: 'rgba(255,255,255,0.25)',
                    }} />
                    {/* Pointer */}
                    <div style={{
                      position: 'absolute',
                      left: `${result.finalRecommendation.investmentThreshold.currentLevel || result.finalRecommendation.globalScore}%`,
                      top: 0, height: '100%', width: 3, background: '#fff',
                      transform: 'translateX(-1px)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.5, marginTop: 6 }}>
                    <span>0</span><span>50</span><span>100</span>
                  </div>
                </div>
              )}

              <div className="reco-score">
                <div className="reco-score-num">{result.finalRecommendation?.globalScore || 0}</div>
                <div className="reco-score-label">Score global / 100</div>
              </div>

              {/* Score auditable : delta entre jugement LLM et calcul mecanique
                  des dimensions ponderees + ajustement blindspots/contrarian.
                  Si delta > 15 points, bandeau d alerte de divergence. */}
              {result.finalRecommendation?.computedScoreBreakdown && (
                <div style={{
                  marginTop: 18, padding: '14px 16px',
                  background: Math.abs(result.finalRecommendation.computedScoreBreakdown.delta) > 15
                    ? 'rgba(220, 80, 60, 0.10)'
                    : 'rgba(255,255,255,0.04)',
                  border: Math.abs(result.finalRecommendation.computedScoreBreakdown.delta) > 15
                    ? '1px solid rgba(220, 80, 60, 0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  fontSize: 12,
                }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
                    Audit du score · jugement LLM vs calcul mécanique
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Score LLM</div>
                      <div style={{ fontSize: 22, fontFamily: 'var(--serif)' }}>{result.finalRecommendation.computedScoreBreakdown.llmScore}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Score mécanique</div>
                      <div style={{ fontSize: 22, fontFamily: 'var(--serif)' }}>{result.finalRecommendation.computedScoreBreakdown.finalComputedScore}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Écart</div>
                      <div style={{
                        fontSize: 22, fontFamily: 'var(--serif)',
                        color: Math.abs(result.finalRecommendation.computedScoreBreakdown.delta) > 15 ? '#e88a7e' : 'inherit',
                      }}>
                        {result.finalRecommendation.computedScoreBreakdown.delta > 0 ? '+' : ''}
                        {result.finalRecommendation.computedScoreBreakdown.delta}
                      </div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Dimensions pondérées</div>
                      <div style={{ fontSize: 14 }}>{result.finalRecommendation.computedScoreBreakdown.weightedDimensionScore}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Ajustement blindspots / contrarian</div>
                      <div style={{ fontSize: 14 }}>
                        {result.finalRecommendation.computedScoreBreakdown.blindspotsContrarianAdjustment > 0 ? '+' : ''}
                        {result.finalRecommendation.computedScoreBreakdown.blindspotsContrarianAdjustment}
                      </div>
                    </div>
                  </div>
                  <div style={{ opacity: 0.85, lineHeight: 1.5 }}>
                    {result.finalRecommendation.computedScoreBreakdown.auditNote}
                  </div>
                </div>
              )}

              {/* Recommandation finale - prose dense decoupee en paragraphes
                  courts (3 phrases chacun) avec chiffres mis en valeur.
                  Sans cette refonte, la prose etait un mur de 12 lignes
                  illisible sur mobile et peu engageant en general. */}
              <div className="reco-arg-aerated">
                {splitIntoParagraphs(result.finalRecommendation?.argumentation, 3).map((p, i) => (
                  <p key={i} className="reco-arg-para">{enrichProse(p)}</p>
                ))}
              </div>

              {/* Top 3 risques critiques - hierarchisation : on remonte
                  les patterns d aveuglement haute intensite + alertes
                  critiques pour qu un VC voie l essentiel sans deplier
                  10 sections. Sur UP&CHARGE le 6,3:1 prix/substitut etait
                  noye page 4 ; ce bloc le remonte au-dessus du fold. */}
              {(() => {
                const topRisks: Array<{ label: string; intensity: number; evidence: string }> = [];
                // 1. Patterns d aveuglement haute intensite (>= 70)
                const patterns = result.blindspotAnalysis?.patterns || {};
                Object.values(patterns).forEach((p: any) => {
                  if (p?.detected && (p.intensity || 0) >= 70) {
                    topRisks.push({
                      label: p.patternName || 'Pattern d aveuglement',
                      intensity: p.intensity || 0,
                      evidence: (p.evidence || '').slice(0, 220),
                    });
                  }
                });
                // 2. Alertes critiques bruts si pas assez de patterns
                if (topRisks.length < 3) {
                  const alertes = result.blindspotAnalysis?.alertesCritiques || [];
                  for (const a of alertes.slice(0, 3 - topRisks.length)) {
                    topRisks.push({
                      label: 'Alerte critique',
                      intensity: 80,
                      evidence: typeof a === 'string' ? a.slice(0, 220) : '',
                    });
                  }
                }
                // Tri par intensite decroissante, top 3
                topRisks.sort((a, b) => b.intensity - a.intensity);
                const top = topRisks.slice(0, 3);
                if (top.length === 0) return null;
                return (
                  <div style={{
                    marginTop: 24, padding: '20px 24px',
                    background: 'rgba(220, 80, 60, 0.06)',
                    borderLeft: '2px solid rgba(220, 80, 60, 0.5)',
                  }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, marginBottom: 14 }}>
                      Risques critiques · Top {top.length}
                    </div>
                    {top.map((r, i) => (
                      <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < top.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>{r.label}</span>
                          <span style={{ fontSize: 11, opacity: 0.7 }}>intensité {r.intensity}/100</span>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.55, opacity: 0.88 }}>
                          {r.evidence}{r.evidence.length >= 220 ? '…' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Tension dialectique blindspots/contrarian - prose decoupee
                  en paragraphes courts pour respiration visuelle */}
              {result.finalRecommendation?.blindspotsVsContrarian && (
                <div style={{ marginTop: 28, padding: '24px 28px', background: 'rgba(255,255,255,0.06)', borderLeft: '2px solid rgba(255,255,255,0.4)' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 14 }}>
                    Résolution dialectique · Aveuglement vs Singularité
                  </div>
                  <div style={{ display: 'flex', gap: 28, marginBottom: 18 }}>
                    <div>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>Poids aveuglement : </span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{result.finalRecommendation.blindspotsVsContrarian.blindspotsWeight}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>Poids singularité : </span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{result.finalRecommendation.blindspotsVsContrarian.contrarianWeight}</span>
                    </div>
                  </div>
                  <div className="reco-dialectique-aerated">
                    {splitIntoParagraphs(result.finalRecommendation.blindspotsVsContrarian.resolution, 3).map((p, i) => (
                      <p key={i} className="reco-arg-para">{enrichProse(p)}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision drivers */}
              {result.finalRecommendation?.decisionDrivers?.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 10 }}>
                    Facteurs décisifs
                  </div>
                  <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
                    {(result.finalRecommendation.decisionDrivers || []).map((d: string, i: number) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}

              {result.finalRecommendation?.keyConditions?.length > 0 && (
                <div className="reco-conditions">
                  <h4>Conditions clés</h4>
                  <ul>{(result.finalRecommendation.keyConditions || []).map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </div>

            {/* Dashboard navigation - sidebar sticky desktop, dropdown mobile.
                Les 14 dimensions d analyse sont regroupees en 4 sections
                semantiques pour clarifier la hierarchie de lecture :
                  1. Diagnostic chiffre  : la matiere brute du dossier
                  2. Lecture critique    : confrontation aux corpus de cas
                  3. Lecture dialectique : aveuglement vs singularite
                  4. Decision            : plan d action et points a instruire */}
            {(() => {
              const tabGroups = [
                {
                  label: 'Diagnostic chiffré',
                  tabs: [
                    { id: 'synthesis', label: 'Synthèse' },
                    { id: 'dimensions', label: 'Dimensions chiffrées' },
                    { id: 'team', label: 'Équipe' },
                    { id: 'verified', label: 'Données vérifiées' },
                    { id: 'market', label: 'Marché' },
                    { id: 'macro', label: 'Macro' },
                  ],
                },
                {
                  label: 'Lecture critique',
                  tabs: [
                    { id: 'financial', label: 'Cohérence financière' },
                    { id: 'pattern', label: 'Pattern matching' },
                  ],
                },
                {
                  label: 'Lecture dialectique',
                  tabs: [
                    { id: 'aveuglement', label: 'Aveuglement' },
                    { id: 'singularite', label: 'Singularités' },
                    { id: 'blindspots', label: 'Angles morts' },
                  ],
                },
                {
                  label: 'Décision',
                  tabs: [
                    { id: 'risksplan', label: 'Risques & Plan' },
                    { id: 'refchecks', label: 'Reference checks' },
                    { id: 'instruction', label: 'À instruire' },
                  ],
                },
              ];
              const currentGroup = tabGroups.find(g => g.tabs.some(t => t.id === activeTab));

              return (
                <div className="dashboard-grid">
                  {/* SIDEBAR DESKTOP : navigation verticale sticky */}
                  <aside className="dashboard-sidebar" aria-label="Sections d analyse">
                    {tabGroups.map(group => (
                      <div className="sidebar-group" key={group.label}>
                        <div className="sidebar-group-label">{group.label}</div>
                        {group.tabs.map(t => (
                          <button
                            key={t.id}
                            className={`sidebar-tab ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(t.id)}
                            aria-current={activeTab === t.id ? 'page' : undefined}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </aside>

                  {/* CONTENU : panneaux conditionnels */}
                  <div className="dashboard-content">
                    {/* MOBILE NAV : dropdown natif au-dessus du contenu, visible < 1024px */}
                    <div className="dashboard-mobile-nav">
                      <div className="dashboard-mobile-context">
                        {currentGroup?.label || ''}
                      </div>
                      <select
                        className="dashboard-mobile-select"
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value)}
                        aria-label="Naviguer entre les sections d analyse"
                      >
                        {tabGroups.map(group => (
                          <optgroup key={group.label} label={group.label}>
                            {group.tabs.map(t => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Tab content */}
              {(activeTab === 'synthesis' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  {/* Bloc visuel : jauge probabilite + radar 6 dimensions */}
                  {(result.finalRecommendation?.successProbability != null || (result.finalRecommendation?.dimensionProbabilities || []).length > 0) && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: 24,
                      marginBottom: 32,
                      padding: '24px 0',
                      borderBottom: '1px solid var(--hairline)',
                      alignItems: 'center',
                    }}>
                      {result.finalRecommendation?.successProbability != null && (
                        <div style={{ textAlign: 'center' }}>
                          <GaugeProbability
                            successProbability={result.finalRecommendation.successProbability}
                            failureProbability={result.finalRecommendation?.failureProbability}
                            size={260}
                          />
                          {result.finalRecommendation?.verdict && (
                            <div style={{
                              marginTop: 4,
                              fontSize: 11,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              opacity: 0.6,
                            }}>
                              Verdict · <strong style={{ fontWeight: 500, opacity: 0.95 }}>{result.finalRecommendation.verdict}</strong>
                            </div>
                          )}
                        </div>
                      )}
                      {(result.finalRecommendation?.dimensionProbabilities || []).length > 0 && (
                        <div>
                          <div style={{
                            fontSize: 10,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            opacity: 0.55,
                            marginBottom: 4,
                            textAlign: 'center',
                          }}>
                            Probabilités par dimension
                          </div>
                          <RadarDimensions
                            dimensions={result.finalRecommendation.dimensionProbabilities}
                            verdict={result.finalRecommendation?.verdict}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="archetype-badge">
                    Archétype dominant · {ARCHETYPE_LABELS[result.patternMatching?.archetypeDominant] || result.patternMatching?.archetypeDominant}
                  </div>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 10 }}>
                    Société identifiée : {result.extraction?.companyName}
                  </h3>
                  <p style={{ marginBottom: 18 }}>
                    {result.extraction?.rawSummary}
                  </p>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, marginTop: 24, marginBottom: 10 }}>
                    Narratif de retournement causal
                  </h3>
                  <p>{result.causalReversal?.reversalNarrative}</p>
                  <div style={{ marginTop: 24 }}>
                    <div className="kv-grid">
                      <div className="kv-item">
                        <div className="kv-key">Secteur</div>
                        <div className="kv-val">{result.extraction?.sector} / {result.extraction?.subSector}</div>
                      </div>
                      <div className="kv-item">
                        <div className="kv-key">Géographie</div>
                        <div className="kv-val">{result.extraction?.geographicHub}, {result.extraction?.country}</div>
                      </div>
                      <div className="kv-item">
                        <div className="kv-key">Tour</div>
                        <div className="kv-val">{result.extraction?.fundraise?.stage} · {result.extraction?.fundraise?.amount}</div>
                      </div>
                      <div className="kv-item">
                        <div className="kv-key">Année fondation</div>
                        <div className="kv-val">{result.extraction?.yearFounded && result.extraction.yearFounded > 0 ? result.extraction.yearFounded : 'non renseigné'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(activeTab === 'dimensions' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 18 }}>
                    Probabilités de succès par dimension
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {(result.finalRecommendation?.dimensionProbabilities || [])
                      .filter((dim: any) => dim && typeof dim === 'object')
                      .map((dim: any, i: number) => (
                      <div key={i} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{dim?.dimensionName ?? '—'}</div>
                          <div style={{ fontSize: 11, opacity: 0.6 }}>poids {Math.round((dim?.weight ?? 0) * 100)}%</div>
                        </div>
                        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Succès</div>
                            <div style={{ fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1.1 }}>
                              {dim?.successProbability ?? '—'}<span style={{ fontSize: 14, opacity: 0.6 }}>%</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Risque</div>
                            <div style={{ fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1.1, opacity: 0.85 }}>
                              {dim?.riskScore ?? '—'}<span style={{ fontSize: 14, opacity: 0.6 }}>/100</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', marginBottom: 12 }}>
                          <div style={{
                            height: '100%',
                            width: `${dim?.successProbability ?? 0}%`,
                            background: (dim?.successProbability ?? 0) >= 65 ? 'var(--ink)' : (dim?.successProbability ?? 0) >= 45 ? '#888' : '#ccc',
                          }} />
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 10, opacity: 0.85 }}>{dim?.rationale ?? ''}</div>
                        {dim.keyDrivers?.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 4 }}>Drivers</div>
                            <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                              {(dim.keyDrivers || []).map((d: string, j: number) => <li key={j}>{d}</li>)}
                            </ul>
                          </div>
                        )}
                        {dim.keyRisks?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 4 }}>Risques</div>
                            <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                              {(dim.keyRisks || []).map((r: string, j: number) => <li key={j}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === 'financial' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Cohérence financière · Sept tests structurés
                  </h3>

                  {(!result.financialCoherence || !result.financialCoherence.hasFinancialData) ? (
                    <div style={{ padding: '20px 24px', background: '#faf3ec', border: '1px solid #c4a484', marginBottom: 20 }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7c4d2c', marginBottom: 6 }}>Données financières insuffisantes</div>
                      <p style={{ fontSize: 14, margin: 0 }}>
                        Aucun business plan exploitable n'a été fourni avec ce dossier. La cohérence financière ne peut pas être testée en l'état.
                        Demander au fondateur un BP structuré au format Excel ou CSV avant de poursuivre l'instruction.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 20, padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)' }}>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Score global cohérence </span>
                            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6 }}>{result.financialCoherence.globalCoherenceScore}/100</span>
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Source : {result.financialCoherence.dataSource === 'both' ? 'Pitch deck + Business plan' : result.financialCoherence.dataSource === 'bp' ? 'Business plan' : 'Pitch deck uniquement'}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Tests passés : {Object.values(result.financialCoherence.tests || {}).filter((t: any) => t?.passed).length}/7
                          </div>
                        </div>
                        <p style={{ fontSize: 14, margin: 0 }}>{result.financialCoherence.syntheseCoherence}</p>
                      </div>

                      {result.financialCoherence.alertesCritiques?.length > 0 && (
                        <div style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid #c4a484', background: '#faf3ec' }}>
                          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, color: '#7c4d2c' }}>Alertes critiques</div>
                          <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                            {(result.financialCoherence.alertesCritiques || []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 24 }}>
                        {Object.values(result.financialCoherence.tests || {})
                          .filter((t: any) => t && typeof t === 'object')
                          .map((t: any, i: number) => (
                          <div key={i} style={{
                            padding: 16,
                            border: '1px solid var(--hairline)',
                            background: 'var(--surface)',
                            borderLeft: t?.passed ? '3px solid #3a5a3a' : '3px solid #a04040',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                                {t?.testId} · {t?.testName}
                              </div>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{t?.score ?? '—'}/100</div>
                            </div>
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', marginBottom: 10 }}>
                              <div style={{
                                height: '100%',
                                width: `${t?.score ?? 0}%`,
                                background: (t?.score ?? 0) >= 70 ? '#3a5a3a' : (t?.score ?? 0) >= 40 ? '#888' : '#a04040',
                              }} />
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                              <strong style={{ fontWeight: 500 }}>Calcul / observation :</strong> {t.evidence}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
                              <strong style={{ fontWeight: 500 }}>Benchmark :</strong> {t.benchmark}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              <strong style={{ fontWeight: 500 }}>Implication :</strong> {t.implication}
                            </div>
                          </div>
                        ))}
                      </div>

                      {result.financialCoherence.recalculsEffectues?.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                          <h4 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Recalculs effectués</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                            {(result.financialCoherence.recalculsEffectues || []).map((r: any, i: number) => (
                              <div key={i} style={{ padding: 14, border: '1px solid var(--hairline)' }}>
                                <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{r.metric}</div>
                                <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                                  <div>
                                    <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Déclaré</div>
                                    <div style={{ fontSize: 14 }}>{r.declaredValue}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recalculé</div>
                                    <div style={{ fontSize: 14 }}>{r.recalculatedValue}</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.8 }}>{r.discrepancy}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.financialCoherence.incoherenceDeckVsBP?.length > 0 && (
                        <div>
                          <h4 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Incohérences entre pitch deck et business plan</h4>
                          <ul style={{ paddingLeft: 18, lineHeight: 1.6, fontSize: 13 }}>
                            {(result.financialCoherence.incoherenceDeckVsBP || []).map((inc: string, i: number) => <li key={i}>{inc}</li>)}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {(activeTab === 'risksplan' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Cartographie des risques · Trois axes
                  </h3>
                  <p style={{ fontSize: 13, opacity: 0.8, marginTop: -4, marginBottom: 18 }}>
                    Évaluation préliminaire structurée selon le cadre conseil M&A : risques stratégiques, opérationnels, financiers.
                  </p>

                  {result.blindspotAnalysis?.riskMap ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 32 }}>
                      {[
                        { key: 'strategicRisks', title: 'Risques stratégiques', color: '#1F2D3D' },
                        { key: 'operationalRisks', title: 'Risques opérationnels', color: '#3a5a3a' },
                        { key: 'financialRisks', title: 'Risques financiers', color: '#a04040' },
                      ].map(cat => {
                        const risks = result.blindspotAnalysis.riskMap[cat.key] || [];
                        return (
                          <div key={cat.key} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${cat.color}` }}>
                              {cat.title}
                            </div>
                            {risks.length === 0 ? (
                              <div style={{ fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>Aucun risque identifié dans cette catégorie</div>
                            ) : (
                              <div>
                                {risks.map((r: any, i: number) => {
                                  const sevColor = r.severity === 'critical' ? '#a04040' : r.severity === 'high' ? '#c4a484' : r.severity === 'medium' ? '#888' : '#bbb';
                                  return (
                                    <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < risks.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                                        <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                                        <div style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: sevColor, fontWeight: 600 }}>{r.severity}</div>
                                      </div>
                                      <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>{r.description}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 32, padding: 16, background: 'var(--surface-deep)', border: '1px solid var(--hairline)' }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Pas de cartographie générée</div>
                      <div>Le moteur Aveuglement n&apos;a pas produit de cartographie pour ce dossier. Les risques détectés sont disponibles dans l&apos;onglet « Aveuglement » sous forme de patterns (P1 à P10) avec evidence et implication par pattern.</div>
                    </div>
                  )}

                  {result.finalRecommendation?.structuringPlan ? (
                    <>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                        Plan de chantiers de structuration
                      </h3>
                      <p style={{ fontSize: 13, opacity: 0.8, marginTop: -4, marginBottom: 18 }}>
                        Trois horizons d'action structurants si la décision est d'investir avec conditions ou d'approfondir.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                        {[
                          { key: 'shortTerm', title: 'Court terme · 0-3 mois', subtitle: 'Pré-requis et clarté' },
                          { key: 'mediumTerm', title: 'Moyen terme · 3-12 mois', subtitle: 'Structuration & développement' },
                          { key: 'longTerm', title: 'Long terme · 12+ mois', subtitle: 'Maturité & vision groupe' },
                        ].map(horizon => {
                          const actions = result.finalRecommendation.structuringPlan[horizon.key] || [];
                          return (
                            <div key={horizon.key} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>{horizon.title}</div>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--hairline)' }}>
                                {horizon.subtitle}
                              </div>
                              {actions.length === 0 ? (
                                <div style={{ fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>Aucune action sur cet horizon</div>
                              ) : (
                                <div>
                                  {actions.map((a: any, i: number) => (
                                    <div key={i} style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: 'var(--ink)', marginBottom: 3 }}>
                                        {a.axis}
                                      </div>
                                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{a.action}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, opacity: 0.6, fontStyle: 'italic' }}>
                      Plan de chantiers non applicable pour ce verdict (réservé aux verdicts "investir avec conditions" et "approfondir").
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'blindspots' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                    Sept angles morts du métier VC européen
                  </h3>
                  <div className="blindspots-grid">
                    {Object.entries(result.causalReversal?.blindspotsScores || {})
                      .filter(([, val]: [string, any]) => val && typeof val === 'object')
                      .map(([key, val]: [string, any]) => (
                      <div key={key} className={`bs-card ${val?.alerte ? 'alerte' : ''}`}>
                        {val?.alerte && <span className="bs-alerte-tag">Alerte</span>}
                        <div className="bs-name">{BLINDSPOT_LABELS[key] || key}</div>
                        <div className="bs-score">{val?.score ?? '—'}<span style={{ fontSize: 13, color: 'var(--muted)' }}>/100</span></div>
                        <div className="bs-bar-track">
                          <div className={`bs-bar-fill ${getBarClass(val?.score ?? 0)}`} style={{ width: `${val?.score ?? 0}%` }} />
                        </div>
                        <div className="bs-lecture">{val?.lecture}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === 'aveuglement' || printMode) && result.blindspotAnalysis && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Aveuglement collectif · Dix patterns d'erreur de jugement VC
                  </h3>
                  <div style={{ marginBottom: 20, padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)' }}>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Score global aveuglement </span>
                        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6 }}>{result.blindspotAnalysis.globalBlindspotScore}/100</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Patterns détectés : {Object.values(result.blindspotAnalysis.patterns || {}).filter((p: any) => p?.detected).length}/10
                      </div>
                    </div>
                    <p style={{ fontSize: 14, margin: 0 }}>{result.blindspotAnalysis.syntheseAveuglement}</p>
                  </div>

                  {result.blindspotAnalysis.alertesCritiques?.length > 0 && (
                    <div style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid #c4a484', background: '#faf3ec' }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, color: '#7c4d2c' }}>Alertes critiques</div>
                      <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                        {(result.blindspotAnalysis.alertesCritiques || []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                    {Object.values(result.blindspotAnalysis.patterns || {}).map((p: any, i: number) => (
                      <div key={i} style={{
                        padding: 16,
                        border: '1px solid var(--hairline)',
                        background: p.detected ? 'var(--surface)' : 'transparent',
                        opacity: p.detected ? 1 : 0.55,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                            {p.patternId} · {p.patternName}
                          </div>
                          {p.detected && (
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{p.intensity}</div>
                          )}
                        </div>
                        {p.detected ? (
                          <>
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', marginBottom: 10 }}>
                              <div style={{
                                height: '100%',
                                width: `${p.intensity}%`,
                                background: p.intensity >= 70 ? '#a04040' : p.intensity >= 40 ? '#888' : '#bbb',
                              }} />
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                              <strong style={{ fontWeight: 500 }}>Evidence :</strong> {p.evidence}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              <strong style={{ fontWeight: 500 }}>Implication :</strong> {p.implication}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 11, opacity: 0.6, fontStyle: 'italic' }}>Pattern non détecté</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {result.blindspotAnalysis.patternsHistoriques?.length > 0 && (
                    <div>
                      <h4 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Patterns historiques comparables</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                        {(result.blindspotAnalysis.patternsHistoriques || []).map((c: any, i: number) => (
                          <div key={i} style={{ padding: 14, border: '1px solid var(--hairline)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>{c.case}</div>
                              <div style={{ fontSize: 11, opacity: 0.6 }}>{c.similarity}%</div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {c.outcome === 'failure' ? 'Échec' : c.outcome === 'survival' ? 'Survie' : 'Succès'}
                            </div>
                            <div style={{ fontSize: 12 }}>{c.keyLearning}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'singularite' || printMode) && result.contrarianAnalysis && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Singularités contrariennes · Dix signaux qui justifient le pari
                  </h3>
                  <div style={{ marginBottom: 20, padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)' }}>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Score global contrarien </span>
                        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6 }}>{result.contrarianAnalysis.globalContrarianScore}/100</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Signaux détectés : {Object.values(result.contrarianAnalysis.signals || {}).filter((s: any) => s?.detected).length}/10
                      </div>
                    </div>
                    <p style={{ fontSize: 14, margin: '0 0 10px 0' }}>{result.contrarianAnalysis.syntheseSingularite}</p>
                    <p style={{ fontSize: 13, margin: 0, fontStyle: 'italic', opacity: 0.85 }}>
                      <strong style={{ fontStyle: 'normal' }}>Recommandation contrarienne :</strong> {result.contrarianAnalysis.recommandationContrarienne}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                    {Object.values(result.contrarianAnalysis.signals || {}).map((s: any, i: number) => (
                      <div key={i} style={{
                        padding: 16,
                        border: '1px solid var(--hairline)',
                        background: s.detected ? 'var(--surface)' : 'transparent',
                        opacity: s.detected ? 1 : 0.55,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                            {s.signalId} · {s.signalName}
                          </div>
                          {s.detected && (
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{s.strength}</div>
                          )}
                        </div>
                        {s.detected ? (
                          <>
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', marginBottom: 10 }}>
                              <div style={{
                                height: '100%',
                                width: `${s.strength}%`,
                                background: s.strength >= 70 ? '#3a5a3a' : s.strength >= 40 ? '#888' : '#bbb',
                              }} />
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                              <strong style={{ fontWeight: 500 }}>Evidence :</strong> {s.evidence}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              <strong style={{ fontWeight: 500 }}>Implication :</strong> {s.implication}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 11, opacity: 0.6, fontStyle: 'italic' }}>Signal non détecté</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {result.contrarianAnalysis.comparablesContrariens?.length > 0 && (
                    <div>
                      <h4 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 12 }}>
                        Comparables contrariens · Cas où le consensus s'est trompé
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                        {(result.contrarianAnalysis.comparablesContrariens || []).map((c: any, i: number) => (
                          <div key={i} style={{ padding: 16, border: '1px solid var(--hairline)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{c.name}</div>
                              <div style={{ fontSize: 11, opacity: 0.6 }}>{c.multipleAtExit}</div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {c.sectorContext}
                            </div>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>
                              <strong style={{ fontWeight: 500 }}>Consensus initial :</strong> {c.initialConsensus}
                            </div>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>
                              <strong style={{ fontWeight: 500 }}>Pari contrarien :</strong> {c.contrarianBet}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>
                              <strong style={{ fontWeight: 500 }}>Outcome :</strong> {c.outcome}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'team' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <div className="kv-grid" style={{ marginBottom: 22 }}>
                    <div className="kv-item">
                      <div className="kv-key">Couverture systémique</div>
                      <div className="kv-val serif">{result.team?.systemicCoverage?.score}/100</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Anti-fragilité collective</div>
                      <div className="kv-val serif">{result.team?.collectiveAntiFragility?.score}/100</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Transposition d'expérience</div>
                      <div className="kv-val serif">{result.team?.experienceTransposition?.score}/100</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Obsession produit</div>
                      <div className="kv-val serif">{result.team?.founderObsession?.score}/100</div>
                    </div>
                  </div>

                  <h3>Couverture systémique de l'équipe</h3>
                  <p>{result.team?.systemicCoverage?.rationale}</p>
                  {result.team?.systemicCoverage?.gaps?.length > 0 && (
                    <p style={{ marginTop: 6 }}><strong>Gaps identifiés :</strong> {result.team.systemicCoverage.gaps.join(' · ')}</p>
                  )}

                  <h3>Anti-fragilité collective</h3>
                  <p>{result.team?.collectiveAntiFragility?.rationale}</p>

                  <h3>Transposition d'expérience</h3>
                  <p>{result.team?.experienceTransposition?.rationale}</p>
                  {result.team?.experienceTransposition?.analogousSectors?.length > 0 && (
                    <p style={{ marginTop: 6 }}><strong>Secteurs analogues :</strong> {result.team.experienceTransposition.analogousSectors.join(' · ')}</p>
                  )}

                  <div className="flags-row">
                    <div className="flag-col green">
                      <div className="flag-title green">Green flags</div>
                      <ul className="flag-list">
                        {(result.team?.greenFlags || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                    <div className="flag-col red">
                      <div className="flag-title red">Red flags</div>
                      <ul className="flag-list">
                        {(result.team?.redFlags || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  </div>

                  {result.team?.founderMarketFit?.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 32 }}>Founder-Market Fit · Évaluation par fondateur</h3>
                      <p style={{ fontSize: 13, opacity: 0.8, marginTop: -6, marginBottom: 16 }}>
                        Cadre Eisenmann (2020). Pour chaque fondateur : trajectoire, signaux positifs, gaps, expertise tacite asymétrique, expériences transposables.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
                        {(result.team.founderMarketFit || []).map((f: any, i: number) => (
                          <div key={i} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{f.name}</div>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>{f.overallFitScore}<span style={{ fontSize: 12, opacity: 0.6 }}>/100</span></div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.role}</div>
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', marginBottom: 14 }}>
                              <div style={{
                                height: '100%',
                                width: `${f.overallFitScore}%`,
                                background: f.overallFitScore >= 70 ? '#3a5a3a' : f.overallFitScore >= 45 ? '#888' : '#a04040',
                              }} />
                            </div>
                            <div style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>{f.trajectorySummary}</div>

                            {f.tacitExpertise && (
                              <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(0,0,0,0.03)', fontSize: 12 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Expertise tacite asymétrique</div>
                                <div>{f.tacitExpertise}</div>
                              </div>
                            )}

                            {f.fitSignals?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4, color: '#3a5a3a' }}>Signaux positifs</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {(f.fitSignals || []).map((s: string, j: number) => <li key={j}>{s}</li>)}
                                </ul>
                              </div>
                            )}

                            {f.fitGaps?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4, color: '#a04040' }}>Gaps identifiés</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {(f.fitGaps || []).map((g: string, j: number) => <li key={j}>{g}</li>)}
                                </ul>
                              </div>
                            )}

                            {f.transposedExperiences?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Expériences transposables</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {(f.transposedExperiences || []).map((e: string, j: number) => <li key={j}>{e}</li>)}
                                </ul>
                              </div>
                            )}

                            {f.redFlagsForRole?.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4, color: '#a04040' }}>Red flags pour le rôle</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {(f.redFlagsForRole || []).map((r: string, j: number) => <li key={j}>{r}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {(activeTab === 'verified' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Données vérifiées par sources publiques
                  </h3>
                  <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>
                    Le moteur d'équipe interroge OpenAlex, GitHub, Wikipedia et arXiv en temps réel pour confronter
                    les données déclarées par le pitch deck à des faits vérifiables. Les chiffres ci-dessous proviennent
                    directement de ces sources, ils ne sont pas générés par IA.
                  </p>

                  {(result.team?.realData || []).length === 0 && (
                    <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                      Aucune donnée vérifiée récupérée pour cette analyse.
                    </p>
                  )}

                  {(result.team?.realData || []).map((rd: any, i: number) => (
                    <div key={i} style={{ marginBottom: 28, paddingBottom: 22, borderBottom: '1px solid var(--hairline)' }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, marginBottom: 6 }}>
                        ● {rd.name}
                      </h3>
                      <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12 }}>
                        Sources interrogées : {rd.sourcesQueried.join(', ')} ·
                        {' '}Sources avec résultats : <strong>{rd.sourcesFound.length > 0 ? rd.sourcesFound.join(', ') : 'aucune'}</strong>
                      </p>

                      <div className="kv-grid" style={{ marginBottom: 14 }}>
                        <div className="kv-item">
                          <div className="kv-key">Score scientifique (objectif)</div>
                          <div className="kv-val serif">{rd.objectiveScores?.scientific_signature || 0}/100</div>
                        </div>
                        <div className="kv-item">
                          <div className="kv-key">Score technique (objectif)</div>
                          <div className="kv-val serif">{rd.objectiveScores?.technical_signature || 0}/100</div>
                        </div>
                        <div className="kv-item">
                          <div className="kv-key">Présence publique</div>
                          <div className="kv-val serif">{rd.objectiveScores?.public_presence || 0}/100</div>
                        </div>
                        <div className="kv-item">
                          <div className="kv-key">Activité récente</div>
                          <div className="kv-val serif">{rd.objectiveScores?.recent_activity || 0}/100</div>
                        </div>
                      </div>

                      {rd.openalex && (
                        <div style={{ padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>OpenAlex (publications académiques)</div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                            <strong>{rd.verifiableFacts.openalex_pubs}</strong> publications · h-index <strong>{rd.verifiableFacts.openalex_h_index}</strong> · <strong>{rd.verifiableFacts.openalex_citations.toLocaleString()}</strong> citations<br />
                            Institution(s) : {rd.verifiableFacts.openalex_institutions.join(' / ') || 'non renseigné'}
                          </div>
                          {rd.recentPublications && rd.recentPublications.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>
                              <div style={{ fontWeight: 500, marginBottom: 4 }}>Publications récentes :</div>
                              {rd.recentPublications.map((p: any, j: number) => (
                                <div key={j} style={{ paddingLeft: 12, position: 'relative', marginBottom: 3 }}>
                                  <span style={{ position: 'absolute', left: 0 }}>·</span>
                                  {p.title} ({p.year}, {p.cited_by} cit.)
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {rd.github && (
                        <div style={{ padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>GitHub (présence technique)</div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                            <strong>@{rd.verifiableFacts.github_login}</strong> · <strong>{rd.verifiableFacts.github_followers.toLocaleString()}</strong> followers · <strong>{rd.verifiableFacts.github_repos}</strong> repos publics
                            {rd.github.bio && <><br/><em>"{rd.github.bio}"</em></>}
                          </div>
                          {rd.topRepos && rd.topRepos.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>
                              <div style={{ fontWeight: 500, marginBottom: 4 }}>Top repos :</div>
                              {rd.topRepos.map((r: any, j: number) => (
                                <div key={j} style={{ paddingLeft: 12, position: 'relative', marginBottom: 3 }}>
                                  <span style={{ position: 'absolute', left: 0 }}>·</span>
                                  <strong>{r.name}</strong> ({r.stars.toLocaleString()}★, {r.language || '?'})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {rd.wikipedia && (
                        <div style={{ padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>Wikipedia ({rd.wikipedia.lang})</div>
                          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>{rd.wikipedia.title}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                            {rd.wikipedia.extract.slice(0, 300)}...
                          </div>
                        </div>
                      )}

                      {rd.arxivRecent && rd.arxivRecent.length > 0 && (
                        <div style={{ padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>arXiv (preprints récents)</div>
                          {rd.arxivRecent.map((p: any, j: number) => (
                            <div key={j} style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 4, paddingLeft: 12, position: 'relative', lineHeight: 1.5 }}>
                              <span style={{ position: 'absolute', left: 0 }}>·</span>
                              {p.title.slice(0, 100)} ({p.published})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {result.team?.declaredVsVerified && (
                    <div style={{ marginTop: 22 }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, marginBottom: 10 }}>
                        Croisement déclaré vs vérifié
                      </h3>
                      <div className="kv-item" style={{ marginBottom: 14 }}>
                        <div className="kv-key">Score d'alignement déclaré/vérifié</div>
                        <div className="kv-val serif">{result.team.declaredVsVerified.alignmentScore}/100</div>
                      </div>
                      {result.team.declaredVsVerified.verifiedClaims?.length > 0 && (
                        <div className="flag-col green" style={{ marginBottom: 10 }}>
                          <div className="flag-title green">Affirmations vérifiées</div>
                          <ul className="flag-list">
                            {result.team.declaredVsVerified.verifiedClaims.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {result.team.declaredVsVerified.unverifiableClaims?.length > 0 && (
                        <div style={{ padding: '14px 16px', background: 'rgba(140, 109, 44, 0.04)', borderLeft: '3px solid var(--signal)', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--signal)', marginBottom: 8, fontWeight: 500 }}>Non vérifiables</div>
                          <ul className="flag-list">
                            {result.team.declaredVsVerified.unverifiableClaims.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {result.team.declaredVsVerified.discrepancies?.length > 0 && (
                        <div className="flag-col red">
                          <div className="flag-title red">Écarts identifiés</div>
                          <ul className="flag-list">
                            {result.team.declaredVsVerified.discrepancies.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'market' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <div className="kv-grid" style={{ marginBottom: 22 }}>
                    <div className="kv-item">
                      <div className="kv-key">Taille perçue</div>
                      <div className="kv-val serif" style={{ textTransform: 'capitalize' }}>{result.market?.perceivedSize}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Intensité réelle</div>
                      <div className="kv-val serif" style={{ textTransform: 'capitalize' }}>{result.market?.realIntensity}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Saturation</div>
                      <div className="kv-val serif" style={{ textTransform: 'capitalize' }}>{result.market?.saturation}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Défensibilité</div>
                      <div className="kv-val serif">{result.market?.defensibility?.score}/100</div>
                    </div>
                  </div>

                  <h3>Intensité du besoin</h3>
                  <p>{result.market?.needIntensity?.rationale}</p>
                  {result.market?.needIntensity?.gap && (
                    <p style={{ marginTop: 6 }}><strong>Gap :</strong> {result.market.needIntensity.gap}</p>
                  )}

                  <h3>Signaux organiques</h3>
                  <p>{result.market?.organicSignals?.rationale}</p>
                  <p><strong>Score :</strong> {result.market?.organicSignals?.score}/100</p>

                  <h3>Défensibilité</h3>
                  <div className="flags-row">
                    <div className="flag-col green">
                      <div className="flag-title green">Moats</div>
                      <ul className="flag-list">
                        {(result.market?.defensibility?.moats || []).map((m: string, i: number) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                    <div className="flag-col red">
                      <div className="flag-title red">Vulnérabilités</div>
                      <ul className="flag-list">
                        {(result.market?.defensibility?.vulnerabilities || []).map((v: string, i: number) => <li key={i}>{v}</li>)}
                      </ul>
                    </div>
                  </div>

                  <h3>Comparables internationaux</h3>
                  {(result.market?.internationalBenchmarks || []).map((b: any, i: number) => (
                    <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--hairline)' }}>
                      <strong>{b.name}</strong> · {b.geography} · {b.relevance}
                    </div>
                  ))}

                  {result.market?.competitiveMatrix?.dimensions?.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 32 }}>Matrice concurrentielle</h3>
                      <p style={{ fontSize: 13, opacity: 0.8, marginTop: -6, marginBottom: 14 }}>
                        Évaluation binaire de la couverture fonctionnelle de la société analysée vs ses concurrents directs sur les dimensions critiques du secteur.
                      </p>
                      <div style={{ marginBottom: 16 }}>
                        <CompetitiveMatrix
                          dimensions={result.market.competitiveMatrix.dimensions || []}
                          players={result.market.competitiveMatrix.players || []}
                          differentiationScore={result.market.competitiveMatrix.differentiationScore}
                        />
                      </div>
                      <div style={{ padding: '14px 16px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)', marginBottom: 8 }}>
                        <p style={{ fontSize: 13, margin: 0 }}>{result.market.competitiveMatrix.differentiationRationale}</p>
                      </div>
                    </>
                  )}

                  <h3 style={{ marginTop: 32 }}>Dynamique compétitive</h3>
                  <p>{result.market?.competitiveDynamic}</p>
                </div>
              )}

              {(activeTab === 'macro' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <div className="kv-grid" style={{ marginBottom: 22 }}>
                    <div className="kv-item">
                      <div className="kv-key">Position cycle</div>
                      <div className="kv-val">{result.macro?.cyclePosition}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Capital VC sur segment</div>
                      <div className="kv-val">{result.macro?.vcCapitalOnSegment}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Régime de taux</div>
                      <div className="kv-val">{result.macro?.interestRateRegime}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Géopolitique</div>
                      <div className="kv-val">{result.macro?.geopolitics}</div>
                    </div>
                  </div>

                  <h3>Fenêtre temporelle critique</h3>
                  <p><strong>{result.macro?.criticalTimingWindow?.exists ? 'OUI' : 'Non'}</strong>
                    {result.macro?.criticalTimingWindow?.horizon && ` · Horizon : ${result.macro.criticalTimingWindow.horizon}`}</p>
                  <p>{result.macro?.criticalTimingWindow?.rationale}</p>

                  <h3>Opportunité contracyclique</h3>
                  <p><strong>Score : {result.macro?.contraryclicalOpportunity?.score}/100</strong></p>
                  <p>{result.macro?.contraryclicalOpportunity?.rationale}</p>

                  <h3>Tendances structurelles</h3>
                  <ul className="flag-list">
                    {(result.macro?.structuralTrends || []).map((t: string, i: number) => <li key={i}>{t}</li>)}
                  </ul>

                  <h3>Environnement réglementaire</h3>
                  <p>{result.macro?.regulatoryEnvironment}</p>

                  <h3>Cycle de demande</h3>
                  <p>{result.macro?.demandCycle}</p>
                </div>
              )}

              {(activeTab === 'pattern' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <div className="archetype-badge">
                    {ARCHETYPE_LABELS[result.patternMatching?.archetypeDominant]}
                  </div>
                  <p>{result.patternMatching?.archetypeRationale}</p>

                  <h3>Comparables historiques du corpus</h3>
                  {(result.patternMatching?.comparables || []).map((c: any, i: number) => (
                    <div className="comp-row" key={i}>
                      <div>
                        <span className="comp-name">{c.name}</span>
                        <span className="comp-year">{c.year}</span>
                        <div className="comp-reason">{c.structuralAnalogy}</div>
                        {c.divergences?.length > 0 && (
                          <div className="comp-reason" style={{ marginTop: 6, fontStyle: 'italic' }}>
                            <strong>Divergences :</strong> {c.divergences.join(' · ')}
                          </div>
                        )}
                        {c.sharedPatterns?.length > 0 && (
                          <div className="comp-patterns">
                            {c.sharedPatterns.map((p: string, j: number) => <span key={j} className="pattern-pill">{p}</span>)}
                          </div>
                        )}
                      </div>
                      <div className="comp-prox">Proximité {c.proximity}%</div>
                    </div>
                  ))}

                  <h3>Patterns transversaux identifiés</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(result.patternMatching?.matchingPatterns || []).map((p: string, i: number) => (
                      <span key={i} className="pattern-pill" style={{ fontSize: 12, padding: '4px 12px' }}>{p}</span>
                    ))}
                  </div>

                  {result.patternMatching?.internationalBenchmarks?.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 32 }}>Comparables internationaux étayés</h3>
                      <p style={{ fontSize: 13, opacity: 0.8, marginTop: -6, marginBottom: 16 }}>
                        Trois cas internationaux dont la trajectoire éclaire le dossier en cours, avec données chiffrées et facteurs clés.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                        {(result.patternMatching.internationalBenchmarks || []).map((b: any, i: number) => (
                          <div key={i} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>{b.name}</div>
                              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b.geography}</div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {b.sector} · fondé en {b.foundedYear}
                            </div>
                            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(0,0,0,0.03)', fontSize: 13 }}>
                              <strong style={{ fontWeight: 500 }}>Pari initial :</strong> {b.initialBet}
                            </div>
                            {b.trajectory?.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>Trajectoire chiffrée</div>
                                {b.trajectory.map((t: any, j: number) => (
                                  <div key={j} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 12 }}>
                                    <div style={{ minWidth: 50, fontFamily: 'var(--serif)', fontWeight: 500 }}>{t.year}</div>
                                    <div style={{ flex: 1 }}>
                                      <div>{t.milestone}</div>
                                      <div style={{ opacity: 0.7, fontSize: 11 }}>{t.revenueOrFunding}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ marginBottom: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                              <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Outcome</div>
                                  <div style={{ fontSize: 13 }}>{b.outcome}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Valuation finale</div>
                                  <div style={{ fontSize: 13 }}>{b.finalValuation}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Multiple exit</div>
                                  <div style={{ fontSize: 13 }}>{b.multipleAtExit}</div>
                                </div>
                              </div>
                            </div>
                            {b.keySuccessFactors?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Facteurs de succès</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {b.keySuccessFactors.map((f: string, j: number) => <li key={j}>{f}</li>)}
                                </ul>
                              </div>
                            )}
                            {b.keyFailureFactors?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Facteurs d'échec</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {b.keyFailureFactors.map((f: string, j: number) => <li key={j}>{f}</li>)}
                                </ul>
                              </div>
                            )}
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)', fontSize: 12, fontStyle: 'italic', opacity: 0.85 }}>
                              <strong style={{ fontWeight: 500, fontStyle: 'normal' }}>Pertinence pour ce dossier :</strong> {b.relevanceToCurrentDeal}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <h3 style={{ marginTop: 32 }}>Benchmark rétrospectif</h3>
                  <p><strong>Score moyen des comparables :</strong> {result.patternMatching?.retrospectiveBenchmark?.averageScore}/100</p>
                  <p>{result.patternMatching?.retrospectiveBenchmark?.successRate}</p>
                  <p>{result.patternMatching?.retrospectiveBenchmark?.insights}</p>
                </div>
              )}

              {(activeTab === 'refchecks' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  {!result.referenceChecks ? (
                    <p style={{ opacity: 0.7, fontStyle: 'italic' }}>
                      Reference checks non disponibles pour ce dossier.
                    </p>
                  ) : (
                    <>
                      <p style={{ marginTop: 0, marginBottom: 18, fontSize: 13, opacity: 0.75 }}>
                        Plan d&apos;appels de due diligence terrain. Liste structurée des contacts à appeler, profils à identifier, et questions-types pour valider l&apos;équipe, les clients et la gouvernance.
                      </p>

                      {(result.referenceChecks.priorityOrder || []).length > 0 && (
                        <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)', marginBottom: 28 }}>
                          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>
                            Ordre de priorité recommandé
                          </div>
                          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                            {(result.referenceChecks.priorityOrder || []).map((p: string, i: number) => (
                              <li key={i} style={{ marginBottom: 4 }}>{p}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {(result.referenceChecks.founderChecks || []).length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                            Appels fondateurs
                          </h3>
                          {(result.referenceChecks.founderChecks || []).map((fc: any, i: number) => (
                            <div key={i} style={{ marginBottom: 22, padding: '16px 18px', border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, marginBottom: 12 }}>
                                {fc.founderName}
                              </div>
                              {(fc.contactsToFind || []).length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 6 }}>
                                    Contacts à identifier
                                  </div>
                                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                    {(fc.contactsToFind || []).map((c: any, j: number) => (
                                      <li key={j} style={{ marginBottom: 4 }}>
                                        <strong style={{ fontWeight: 500, textTransform: 'capitalize' }}>{c.type}</strong> · {c.profile}
                                        {c.hint && <span style={{ display: 'block', fontSize: 12, opacity: 0.65, marginTop: 2 }}>↳ {c.hint}</span>}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(fc.keyQuestions || []).length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 6 }}>
                                    Questions clés
                                  </div>
                                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                    {(fc.keyQuestions || []).map((q: string, j: number) => <li key={j}>{q}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {(result.referenceChecks.customerChecks || []).length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                            Appels clients
                          </h3>
                          {(result.referenceChecks.customerChecks || []).map((cc: any, i: number) => (
                            <div key={i} style={{ marginBottom: 18, padding: '14px 18px', border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>
                                  {cc.clientName}{cc.company ? <span style={{ fontWeight: 400, opacity: 0.7 }}> · {cc.company}</span> : null}
                                </div>
                                {cc.contractStatus && (
                                  <span style={{
                                    fontSize: 10,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    padding: '2px 8px',
                                    background: cc.contractStatus === 'contract' ? 'rgba(26,77,46,0.12)' : cc.contractStatus === 'pilot' ? 'rgba(122,92,31,0.12)' : 'rgba(0,0,0,0.06)',
                                    color: cc.contractStatus === 'contract' ? '#1a4d2e' : cc.contractStatus === 'pilot' ? '#7a5c1f' : 'inherit',
                                  }}>
                                    {cc.contractStatus}
                                  </span>
                                )}
                              </div>
                              {(cc.keyQuestions || []).length > 0 && (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                  {(cc.keyQuestions || []).map((q: string, j: number) => <li key={j}>{q}</li>)}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {(result.referenceChecks.boardChecks || []).length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                            Appels gouvernance
                          </h3>
                          {(result.referenceChecks.boardChecks || []).map((bc: any, i: number) => (
                            <div key={i} style={{ marginBottom: 18, padding: '14px 18px', border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                                {bc.memberName}
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                                {bc.role}{bc.affiliation ? ' · ' + bc.affiliation : ''}
                              </div>
                              {(bc.keyQuestions || []).length > 0 && (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                  {(bc.keyQuestions || []).map((q: string, j: number) => <li key={j}>{q}</li>)}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {(result.referenceChecks.redFlagsToProbe || []).length > 0 && (
                        <div style={{ padding: '16px 18px', background: 'rgba(122,31,31,0.05)', borderLeft: '3px solid #7a1f1f' }}>
                          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a1f1f', marginBottom: 8, fontWeight: 500 }}>
                            Red flags à sonder en priorité
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                            {(result.referenceChecks.redFlagsToProbe || []).map((r: string, i: number) => (
                              <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {(activeTab === 'instruction' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3>Questions à instruire avant décision</h3>
                  <ol className="questions-list" style={{ marginTop: 12 }}>
                    {(result.causalReversal?.questionsToInvestigate || []).map((q: string, i: number) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>

                  <h3>Opérateurs lift-the-hood recommandés</h3>
                  <div className="op-list" style={{ marginTop: 12 }}>
                    {(result.causalReversal?.recommendedOperators || []).map((o: any, i: number) => (
                      <div className="op-card" key={i}>
                        <div className="op-profil">{o.profile}</div>
                        <div className="op-mission">{o.mission}</div>
                        <div className="op-duration">Durée estimée : {o.estimatedDuration}</div>
                      </div>
                    ))}
                  </div>

                  <h3>Proxies à calculer</h3>
                  <ul className="flag-list">
                    {(result.causalReversal?.proxiesToCalculate || []).map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
                  </div>
                </div>
              );
            })()}
              </>
            )}

            {/* En mode print, on rend aussi la note d investissement apres le dashboard
                pour que l export PDF contienne TOUT (dashboard analytique + note).
                compactMode={false} explicite pour garantir que l export PDF est complet
                meme si l utilisateur consultait en mode lecture rapide. */}
            {printMode && (
              <div style={{ pageBreakBefore: 'always', marginTop: 48 }}>
                <InvestmentNoteView result={result} compactMode={false} />
              </div>
            )}

            <div className="reset-row" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={reset}>Analyser un nouveau dossier</button>
              <button
                className="btn"
                onClick={() => {
                  setPrintMode(true);
                  setTimeout(() => {
                    window.print();
                    setTimeout(() => setPrintMode(false), 500);
                  }, 400);
                }}
                title="Exporter le dashboard analytique complet et la note d investissement en PDF">
                ⤓ Exporter en PDF
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}

// ============================================================
// NIVEAU 3.A : COMPOSANT BLOC D ANNOTATION
// ------------------------------------------------------------
// Champ texte libre permettant a l utilisateur d annoter une analyse.
// Les annotations sont stockees dans Supabase via PATCH /api/analyses/[id]
// et seront automatiquement injectees dans le prompt de finalRecommendation
// pour les futurs dossiers du meme secteur.
//
// Comportement :
//   - Charge les notes existantes au mount (si analyse passee)
//   - Save manuel via bouton (pas d auto-save pour eviter les ecrits
//     intempestifs pendant que l utilisateur reflechit)
//   - Indicateur visuel de l etat : draft / saving / saved
// ============================================================
function AnnotationBlock({ analysisId }: { analysisId: string }) {
  const [notes, setNotes] = useState<string>('');
  const [originalNotes, setOriginalNotes] = useState<string>('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [expanded, setExpanded] = useState(false);

  // Charge les notes existantes (si l analyse a deja ete annotee)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analyses/${analysisId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        const existing = data?.analysis?.userNotes || '';
        setNotes(existing);
        setOriginalNotes(existing);
      })
      .catch(() => { /* silencieux */ });
    return () => { cancelled = true; };
  }, [analysisId]);

  const hasChanges = notes !== originalNotes;

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/analyses/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNotes: notes }),
      });
      if (res.ok) {
        setSaveState('saved');
        setOriginalNotes(notes);
        setTimeout(() => setSaveState('idle'), 2000);
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div style={{
      margin: '20px 0',
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
      padding: expanded ? '20px 24px' : '14px 20px',
      transition: 'padding 0.15s',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          fontWeight: 600,
        }}>
          {expanded ? '▾' : '▸'} Annotations & feedback
          {originalNotes && !expanded && (
            <span style={{ marginLeft: 8, opacity: 0.7, textTransform: 'none', letterSpacing: 0 }}>
              · annotée
            </span>
          )}
        </div>
        {!expanded && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            Cliquer pour annoter
          </span>
        )}
      </div>

      {expanded && (
        <>
          <div style={{
            fontSize: 12.5,
            color: 'var(--muted)',
            lineHeight: 1.55,
            marginTop: 10,
            marginBottom: 12,
          }}>
            Annote librement cette analyse : ce que le moteur a bien capté, ce qu&apos;il a sous-estimé,
            les comparables qui te semblent justes ou faux, ta thèse personnelle. Tes annotations sont
            réutilisées comme contexte d&apos;apprentissage pour les futurs dossiers du même secteur.
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex. Le moteur a sous-estimé le founder-market fit. Le pattern Helsing est juste mais trop appuyé. La traction réelle est probablement meilleure que les zéro ARR/NRR documentés."
            rows={5}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              fontFamily: 'inherit',
              border: '1px solid var(--hairline)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              resize: 'vertical',
              lineHeight: 1.55,
            }}
          />
          <div style={{
            marginTop: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {saveState === 'saving' && 'Sauvegarde...'}
              {saveState === 'saved' && <span style={{ color: 'var(--vert-foret)' }}>✓ Annotation sauvegardée</span>}
              {saveState === 'error' && <span style={{ color: 'var(--rouge-anglais)' }}>⨯ Erreur de sauvegarde</span>}
              {saveState === 'idle' && hasChanges && <span style={{ opacity: 0.7 }}>Modifications non sauvegardées</span>}
              {saveState === 'idle' && !hasChanges && <span style={{ opacity: 0.5 }}>{notes.length} caractères</span>}
            </div>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saveState === 'saving'}
              style={{
                padding: '7px 18px',
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: hasChanges ? 'var(--ink)' : 'transparent',
                color: hasChanges ? 'var(--paper)' : 'var(--muted)',
                border: '1px solid ' + (hasChanges ? 'var(--ink)' : 'var(--hairline)'),
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Sauvegarder
            </button>
          </div>
        </>
      )}
    </div>
  );
}
