'use client';

import { useState, useRef } from 'react';

const ENGINES = [
  { id: 'extraction', name: 'Moteur 1 · Extraction', label: 'Lecture du pitch deck et structuration des données' },
  { id: 'team', name: 'Moteur 2 · Équipe', label: 'Couverture systémique, anti-fragilité, transposition d\'expérience' },
  { id: 'market', name: 'Moteur 3 · Marché', label: 'Intensité du besoin, défensibilité, comparables internationaux' },
  { id: 'macro', name: 'Moteur 4 · Macro', label: 'Position cycle, géopolitique, fenêtre temporelle critique' },
  { id: 'pattern', name: 'Moteur 5 · Pattern matching', label: 'Confrontation au corpus de cas instruits' },
  { id: 'causal', name: 'Moteur 6 · Retournement causal', label: 'Sept angles morts et questions à instruire' },
  { id: 'blindspot', name: 'Moteur 7 · Aveuglement collectif', label: 'Détection des dix patterns d\'erreur de jugement VC' },
  { id: 'contrarian', name: 'Moteur 8 · Singularités contrariennes', label: 'Détection des dix signaux qui justifient le pari à contre-courant' },
  { id: 'orchestrate', name: 'Moteur 9 · Orchestration', label: 'Synthèse, probabilités chiffrées, résolution dialectique' },
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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [engineStates, setEngineStates] = useState<Record<string, EngineState>>(
    Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }]))
  );
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('synthesis');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(f: File | null) {
    if (!f) return;
    if (!f.type.includes('pdf')) { setError('Le fichier doit être un PDF'); return; }
    if (f.size > 32 * 1024 * 1024) { setError('Le fichier dépasse 32 Mo'); return; }
    setFile(f);
    setError(null);
    setResult(null);
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setEngineStates(Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }])));

    try {
      const formData = new FormData();
      formData.append('pitchdeck', file);

      const response = await fetch('/api/analyze', { method: 'POST', body: formData });

      if (!response.ok || !response.body) {
        const errBody = await response.text();
        throw new Error(errBody || 'Erreur réseau');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;
          const lines = event.split('\n');
          let eventType = '';
          let dataStr = '';
          for (const line of lines) {
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
            } else if (eventType === 'error') {
              setError(data.message);
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'Erreur réseau');
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setFile(null);
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
          <div className="brand-meta">Plateforme d'instruction · Sept moteurs interconnectés</div>
        </div>
      </header>

      <main className="main">
        {!result && !analyzing && (
          <>
            <h1 className="page-title">Le moteur d'instruction.</h1>
            <p className="page-subtitle">
              Déposez un pitch deck. Sept moteurs interconnectés analysent le dossier en pipeline :
              extraction structurée, équipe, marché, lecture macro, pattern matching contre 32 cas historiques,
              retournement causal des sept angles morts, recommandation finale stratifiée.
            </p>

            {!file ? (
              <div className={`upload-box ${dragging ? 'dragging' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0]); }}>
                <div className="upload-icon">▤</div>
                <div className="upload-label">Déposer un pitch deck</div>
                <div className="upload-hint">Format PDF · 32 Mo maximum · Cliquer ou glisser-déposer</div>
                <input ref={inputRef} type="file" accept="application/pdf,.pdf"
                  className="upload-input"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)} />
              </div>
            ) : (
              <>
                <div className="file-info">
                  <div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} Mo</div>
                  </div>
                  <button className="btn" onClick={reset}>Changer</button>
                </div>
                <div className="cta-row">
                  <button className="btn btn-primary" onClick={analyze}>Lancer le pipeline →</button>
                </div>
              </>
            )}

            {error && <div className="error-box"><div className="error-title">Erreur</div><div>{error}</div></div>}
          </>
        )}

        {analyzing && (
          <div className="pipeline">
            <div className="pipeline-head">
              <div className="pipeline-title">Pipeline en cours d'exécution</div>
              <div className="pipeline-sub">Neuf moteurs travaillent en parallèle ou en cascade selon les dépendances.</div>
            </div>
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

              <div className="reco-arg">{result.finalRecommendation?.argumentation}</div>

              {/* Tension dialectique blindspots/contrarian */}
              {result.finalRecommendation?.blindspotsVsContrarian && (
                <div style={{ marginTop: 24, padding: '20px 24px', background: 'rgba(255,255,255,0.06)', borderLeft: '2px solid rgba(255,255,255,0.4)' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
                    Résolution dialectique · Aveuglement vs Singularité
                  </div>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
                    <div>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>Poids aveuglement : </span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{result.finalRecommendation.blindspotsVsContrarian.blindspotsWeight}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>Poids singularité : </span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{result.finalRecommendation.blindspotsVsContrarian.contrarianWeight}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.9 }}>
                    {result.finalRecommendation.blindspotsVsContrarian.resolution}
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
                    {result.finalRecommendation.decisionDrivers.map((d: string, i: number) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}

              {result.finalRecommendation?.keyConditions?.length > 0 && (
                <div className="reco-conditions">
                  <h4>Conditions clés</h4>
                  <ul>{result.finalRecommendation.keyConditions.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </div>

            {/* Tabs navigation */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', marginBottom: 16 }}>
              <div className="tabs">
                {[
                  { id: 'synthesis', label: 'Synthèse' },
                  { id: 'dimensions', label: 'Dimensions chiffrées' },
                  { id: 'blindspots', label: 'Angles morts' },
                  { id: 'aveuglement', label: 'Aveuglement' },
                  { id: 'singularite', label: 'Singularités' },
                  { id: 'team', label: 'Équipe' },
                  { id: 'verified', label: 'Données vérifiées' },
                  { id: 'market', label: 'Marché' },
                  { id: 'macro', label: 'Macro' },
                  { id: 'pattern', label: 'Pattern matching' },
                  { id: 'instruction', label: 'À instruire' },
                ].map(t => (
                  <div key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                    {t.label}
                  </div>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'synthesis' && (
                <div style={{ padding: '28px 32px' }}>
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
                        <div className="kv-val">{result.extraction?.yearFounded}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'dimensions' && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 18 }}>
                    Probabilités de succès par dimension
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {(result.finalRecommendation?.dimensionProbabilities || []).map((dim: any, i: number) => (
                      <div key={i} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{dim.dimensionName}</div>
                          <div style={{ fontSize: 11, opacity: 0.6 }}>poids {Math.round(dim.weight * 100)}%</div>
                        </div>
                        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Succès</div>
                            <div style={{ fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1.1 }}>
                              {dim.successProbability}<span style={{ fontSize: 14, opacity: 0.6 }}>%</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Risque</div>
                            <div style={{ fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1.1, opacity: 0.85 }}>
                              {dim.riskScore}<span style={{ fontSize: 14, opacity: 0.6 }}>/100</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', marginBottom: 12 }}>
                          <div style={{
                            height: '100%',
                            width: `${dim.successProbability}%`,
                            background: dim.successProbability >= 65 ? 'var(--ink)' : dim.successProbability >= 45 ? '#888' : '#ccc',
                          }} />
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 10, opacity: 0.85 }}>{dim.rationale}</div>
                        {dim.keyDrivers?.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 4 }}>Drivers</div>
                            <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                              {dim.keyDrivers.map((d: string, j: number) => <li key={j}>{d}</li>)}
                            </ul>
                          </div>
                        )}
                        {dim.keyRisks?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 4 }}>Risques</div>
                            <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                              {dim.keyRisks.map((r: string, j: number) => <li key={j}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'blindspots' && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                    Sept angles morts du métier VC européen
                  </h3>
                  <div className="blindspots-grid">
                    {Object.entries(result.causalReversal?.blindspotsScores || {}).map(([key, val]: [string, any]) => (
                      <div key={key} className={`bs-card ${val.alerte ? 'alerte' : ''}`}>
                        {val.alerte && <span className="bs-alerte-tag">Alerte</span>}
                        <div className="bs-name">{BLINDSPOT_LABELS[key] || key}</div>
                        <div className="bs-score">{val.score}<span style={{ fontSize: 13, color: 'var(--muted)' }}>/100</span></div>
                        <div className="bs-bar-track">
                          <div className={`bs-bar-fill ${getBarClass(val.score)}`} style={{ width: `${val.score}%` }} />
                        </div>
                        <div className="bs-lecture">{val.lecture}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'aveuglement' && result.blindspotAnalysis && (
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
                        Patterns détectés : {Object.values(result.blindspotAnalysis.patterns).filter((p: any) => p.detected).length}/10
                      </div>
                    </div>
                    <p style={{ fontSize: 14, margin: 0 }}>{result.blindspotAnalysis.syntheseAveuglement}</p>
                  </div>

                  {result.blindspotAnalysis.alertesCritiques?.length > 0 && (
                    <div style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid #c4a484', background: '#faf3ec' }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, color: '#7c4d2c' }}>Alertes critiques</div>
                      <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                        {result.blindspotAnalysis.alertesCritiques.map((a: string, i: number) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                    {Object.values(result.blindspotAnalysis.patterns).map((p: any, i: number) => (
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
                        {result.blindspotAnalysis.patternsHistoriques.map((c: any, i: number) => (
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

              {activeTab === 'singularite' && result.contrarianAnalysis && (
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
                        Signaux détectés : {Object.values(result.contrarianAnalysis.signals).filter((s: any) => s.detected).length}/10
                      </div>
                    </div>
                    <p style={{ fontSize: 14, margin: '0 0 10px 0' }}>{result.contrarianAnalysis.syntheseSingularite}</p>
                    <p style={{ fontSize: 13, margin: 0, fontStyle: 'italic', opacity: 0.85 }}>
                      <strong style={{ fontStyle: 'normal' }}>Recommandation contrarienne :</strong> {result.contrarianAnalysis.recommandationContrarienne}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                    {Object.values(result.contrarianAnalysis.signals).map((s: any, i: number) => (
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
                        {result.contrarianAnalysis.comparablesContrariens.map((c: any, i: number) => (
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

              {activeTab === 'team' && (
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
                </div>
              )}

              {activeTab === 'verified' && (
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

              {activeTab === 'market' && (
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

                  <h3>Dynamique compétitive</h3>
                  <p>{result.market?.competitiveDynamic}</p>
                </div>
              )}

              {activeTab === 'macro' && (
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

              {activeTab === 'pattern' && (
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

                  <h3>Benchmark rétrospectif</h3>
                  <p><strong>Score moyen des comparables :</strong> {result.patternMatching?.retrospectiveBenchmark?.averageScore}/100</p>
                  <p>{result.patternMatching?.retrospectiveBenchmark?.successRate}</p>
                  <p>{result.patternMatching?.retrospectiveBenchmark?.insights}</p>
                </div>
              )}

              {activeTab === 'instruction' && (
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

            <div className="reset-row">
              <button className="btn" onClick={reset}>Analyser un nouveau dossier</button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
