'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  PortfolioReconciliation,
  DossierReconciliation,
} from '@/lib/reconciliation-aggregator';

interface DossierListItem {
  id: string;
  companyName: string;
  createdAt: string;
}

interface Props {
  portfolio: PortfolioReconciliation;
  dossiersList: DossierListItem[];
  orgName: string;
  userEmail: string;
}

type Tab = 'portfolio' | 'dossier';

const VERDICT_LABEL: Record<string, string> = {
  invested: 'Investi',
  passed: 'Passe',
  declined: 'Refuse',
  waitlisted: 'En liste d attente',
};

const ALIGNMENT_LABEL: Record<string, string> = {
  confirms_driver: 'Driver confirme',
  confirms_risk: 'Risque confirme',
  contradicts_driver: 'Driver contredit',
  contradicts_risk: 'Risque contredit',
  unforeseen_positive: 'Imprevu positif',
  unforeseen_negative: 'Imprevu negatif',
};

const ACCURACY_LABEL: Record<string, string> = {
  high: 'Forte',
  medium: 'Moderee',
  low: 'Faible',
  insufficient_data: 'Donnees insuffisantes',
};

const QUALITY_LABEL: Record<string, string> = {
  strong: 'These confirmee',
  mixed: 'These mixte',
  weak: 'These contredite',
  insufficient_data: 'Donnees insuffisantes',
};

export default function ReconciliationClient({
  portfolio,
  dossiersList,
  orgName,
  userEmail,
}: Props) {
  const [tab, setTab] = useState<Tab>('portfolio');
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [dossierData, setDossierData] = useState<DossierReconciliation | null>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);

  async function loadDossier(id: string) {
    setLoadingDossier(true);
    setDossierError(null);
    try {
      const res = await fetch(`/api/reconciliation/dossier/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'fetch-failed');
      }
      const json = await res.json();
      setDossierData(json.reconciliation);
    } catch (e: any) {
      setDossierError(e.message || 'Erreur de chargement');
      setDossierData(null);
    } finally {
      setLoadingDossier(false);
    }
  }

  function selectDossier(id: string) {
    setSelectedDossierId(id);
    loadDossier(id);
  }

  return (
    <div className="reco-page">
      <header className="reco-header">
        <div>
          <h1 className="reco-title">Reconciliation</h1>
          <p className="reco-sub">
            Confronter ce que Prelude predisait avec ce qui s est reellement passe.
            {' '}{orgName} · {userEmail}
          </p>
        </div>
        <div className="reco-back">
          <Link href="/">Retour a l accueil</Link>
        </div>
      </header>

      <div className="reco-tabs">
        <button
          className={`reco-tab ${tab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setTab('portfolio')}
        >
          Portfolio
        </button>
        <button
          className={`reco-tab ${tab === 'dossier' ? 'active' : ''}`}
          onClick={() => setTab('dossier')}
        >
          Dossier
        </button>
      </div>

      {tab === 'portfolio' && (
        <PortfolioPane portfolio={portfolio} />
      )}

      {tab === 'dossier' && (
        <DossierPane
          dossiersList={dossiersList}
          selectedDossierId={selectedDossierId}
          dossierData={dossierData}
          loading={loadingDossier}
          error={dossierError}
          onSelect={selectDossier}
        />
      )}

      <style jsx>{`
        .reco-page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 22px 60px;
          font-family: var(--serif);
          color: #1d1d1f;
        }
        .reco-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
          margin-bottom: 28px;
          padding-bottom: 18px;
          border-bottom: 1px solid #e6e3dd;
        }
        .reco-title {
          font-family: var(--serif);
          font-size: 30px;
          margin: 0 0 4px;
          color: #16213a;
          letter-spacing: -0.01em;
        }
        .reco-sub {
          font-size: 13.5px;
          color: #6e6c66;
          margin: 0;
        }
        .reco-back {
          font-size: 13px;
        }
        .reco-back :global(a) {
          color: #6e6c66;
          text-decoration: none;
          border-bottom: 1px solid #d9d4cb;
        }
        .reco-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 22px;
          border-bottom: 1px solid #e6e3dd;
        }
        .reco-tab {
          background: transparent;
          border: none;
          padding: 10px 18px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 600;
          color: #8a8780;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .reco-tab.active {
          color: #16213a;
          border-bottom-color: #16213a;
        }
        .reco-tab:hover { color: #16213a; }
      `}</style>
    </div>
  );
}

// ============================================================
// Pane Portfolio
// ============================================================

function PortfolioPane({ portfolio }: { portfolio: PortfolioReconciliation }) {
  const ga = portfolio.globalAlignmentBreakdown;

  return (
    <div className="pane">
      <div className="banner">
        <div className="banner-stats">
          <div className="stat">
            <div className="stat-num">{portfolio.totalDossiersAnalyzed}</div>
            <div className="stat-label">Dossiers analyses</div>
          </div>
          <div className="stat">
            <div className="stat-num">{portfolio.totalDossiersWithDecision}</div>
            <div className="stat-label">Avec decision</div>
          </div>
          <div className="stat">
            <div className="stat-num">{portfolio.totalDossiersWithReconciliation}</div>
            <div className="stat-label">Reconciliables (decision + milestones)</div>
          </div>
        </div>
        {!portfolio.thresholdMet && (
          <div className="threshold-warning">
            La reconciliation portfolio est exposee a partir de {portfolio.threshold} dossiers reconciliables. Vous etes a {portfolio.totalDossiersWithReconciliation}/{portfolio.threshold}. Les agreges ci-dessous sont presentes a titre indicatif et n ont pas encore la robustesse statistique requise pour identifier des patterns systemiques fiables.
          </div>
        )}
      </div>

      <h2 className="section-title">Distribution des decisions</h2>
      <table className="table">
        <thead>
          <tr><th>Decision</th><th className="num">Nombre</th></tr>
        </thead>
        <tbody>
          <tr><td>Investi</td><td className="num">{portfolio.byDecision.invested}</td></tr>
          <tr><td>Passe</td><td className="num">{portfolio.byDecision.passed}</td></tr>
          <tr><td>Refuse</td><td className="num">{portfolio.byDecision.declined}</td></tr>
          <tr><td>En liste d attente</td><td className="num">{portfolio.byDecision.waitlisted}</td></tr>
        </tbody>
      </table>

      <h2 className="section-title">Alignement global des theses</h2>
      <p className="section-sub">
        Sur l ensemble des milestones enregistres avec un alignement de these.
      </p>
      <table className="table">
        <thead>
          <tr><th>Categorie</th><th className="num">Nombre</th><th className="num">Part</th></tr>
        </thead>
        <tbody>
          {(['confirmsDriver', 'confirmsRisk', 'contradictsDriver', 'contradictsRisk', 'unforeseenPositive', 'unforeseenNegative'] as const).map((k) => {
            const count = ga[k];
            const pct = ga.total > 0 ? Math.round((count / ga.total) * 100) : 0;
            const labelKey = k.replace(/([A-Z])/g, '_$1').toLowerCase();
            return (
              <tr key={k}>
                <td>{ALIGNMENT_LABEL[labelKey] || k}</td>
                <td className="num">{count}</td>
                <td className="num">{pct}%</td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td>Total milestones alignes</td>
            <td className="num">{ga.total}</td>
            <td className="num">100%</td>
          </tr>
        </tbody>
      </table>

      <h2 className="section-title">Performance de prediction par dimension</h2>
      <p className="section-sub">
        Pour chaque dimension : moyenne des probabilites de succes predites, puis nombre de drivers et risques confirmes ou contredits par les milestones realises.
      </p>
      {portfolio.byDimension.length === 0 ? (
        <p className="empty">Aucune dimension disponible pour le moment.</p>
      ) : (
        <table className="table table-wide">
          <thead>
            <tr>
              <th>Dimension</th>
              <th className="num">Succes predit moyen</th>
              <th className="num">Drivers confirmes</th>
              <th className="num">Drivers contredits</th>
              <th className="num">Risques confirmes</th>
              <th className="num">Risques contredits</th>
              <th>Calibration</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.byDimension.map((d, i) => (
              <tr key={i}>
                <td className="dim-name">{d.dimensionName}</td>
                <td className="num">{d.averagePredictedSuccess}%</td>
                <td className="num pos">{d.confirmedDrivers}</td>
                <td className="num neg">{d.contradictedDrivers}</td>
                <td className="num pos">{d.confirmedRisks}</td>
                <td className="num neg">{d.contradictedRisks}</td>
                <td>
                  <span className={`pill pill-${d.predictionAccuracy}`}>
                    {ACCURACY_LABEL[d.predictionAccuracy] || d.predictionAccuracy}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {portfolio.systemicPatterns.length > 0 && (
        <>
          <h2 className="section-title">Patterns systemiques detectes</h2>
          <ul className="patterns-list">
            {portfolio.systemicPatterns.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}

      <style jsx>{`
        .pane { font-size: 14px; line-height: 1.55; }
        .banner {
          background: #f6f3ec;
          border: 1px solid #e6e3dd;
          border-radius: 6px;
          padding: 22px 24px;
          margin-bottom: 28px;
        }
        .banner-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 16px;
        }
        .stat-num {
          font-family: var(--serif);
          font-size: 30px;
          font-weight: 600;
          color: #16213a;
          line-height: 1.1;
        }
        .stat-label {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8780;
          margin-top: 4px;
        }
        .threshold-warning {
          padding: 12px 14px;
          background: rgba(180, 120, 50, 0.06);
          border-left: 3px solid #b47832;
          border-radius: 3px;
          font-size: 13px;
          color: #5e4b30;
          line-height: 1.55;
        }
        .section-title {
          font-family: var(--serif);
          font-size: 20px;
          color: #16213a;
          margin: 32px 0 6px;
          font-weight: 600;
        }
        .section-sub {
          font-size: 13px;
          color: #6e6c66;
          margin: 0 0 14px;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin: 4px 0 18px;
          font-size: 13.5px;
        }
        .table th, .table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #e6e3dd;
        }
        .table th {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8780;
          font-weight: 600;
          background: #fafaf6;
        }
        .table .num { text-align: right; font-variant-numeric: tabular-nums; }
        .table .pos { color: #1f5f3f; }
        .table .neg { color: #b14842; }
        .table .dim-name { font-weight: 600; }
        .total-row { font-weight: 600; background: #fafaf6; }
        .pill {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 11px;
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: 0.04em;
        }
        .pill-high { color: #1f5f3f; background: rgba(31, 95, 63, 0.08); }
        .pill-medium { color: #b47832; background: rgba(180, 120, 50, 0.08); }
        .pill-low { color: #b14842; background: rgba(177, 72, 66, 0.08); }
        .pill-insufficient_data { color: #6e6c66; background: #efece5; }
        .empty { color: #8a8780; font-style: italic; }
        .patterns-list {
          padding-left: 20px;
          margin: 6px 0 18px;
        }
        .patterns-list li {
          margin-bottom: 10px;
          font-size: 14px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Pane Dossier
// ============================================================

function DossierPane({
  dossiersList,
  selectedDossierId,
  dossierData,
  loading,
  error,
  onSelect,
}: {
  dossiersList: DossierListItem[];
  selectedDossierId: string | null;
  dossierData: DossierReconciliation | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="pane-dossier">
      <div className="selector">
        <label htmlFor="dossier-select" className="selector-label">Choisir un dossier</label>
        <select
          id="dossier-select"
          value={selectedDossierId || ''}
          onChange={(e) => e.target.value && onSelect(e.target.value)}
        >
          <option value="">Selectionnez un dossier...</option>
          {dossiersList.map((d) => (
            <option key={d.id} value={d.id}>
              {d.companyName} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="loading">Chargement de la reconciliation...</p>}
      {error && <p className="error">Erreur : {error}</p>}

      {dossierData && (
        <DossierDetails data={dossierData} />
      )}

      {!loading && !error && !dossierData && selectedDossierId === null && (
        <p className="empty">Selectionnez un dossier dans la liste ci-dessus pour afficher sa reconciliation.</p>
      )}

      <style jsx>{`
        .pane-dossier { font-size: 14px; }
        .selector {
          margin-bottom: 24px;
          background: #f6f3ec;
          border: 1px solid #e6e3dd;
          border-radius: 6px;
          padding: 16px 20px;
        }
        .selector-label {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8780;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .selector select {
          width: 100%;
          padding: 8px 10px;
          font-size: 14px;
          border: 1px solid #d9d4cb;
          border-radius: 4px;
          background: #fff;
        }
        .loading { color: #8a8780; font-style: italic; }
        .error { color: #b14842; }
        .empty { color: #8a8780; font-style: italic; padding: 24px 0; }
      `}</style>
    </div>
  );
}

function DossierDetails({ data }: { data: DossierReconciliation }) {
  const stats = data.reconciliationStats;

  return (
    <div className="dossier-details">
      <header className="d-header">
        <h2 className="d-title">{data.companyName}</h2>
        <div className="d-meta">
          Analyse le {new Date(data.analyzedAt).toLocaleDateString('fr-FR')}
          {data.decision && (
            <>
              {' · '}Decision : {VERDICT_LABEL[data.decision]}
              {data.decisionDate && ` (${new Date(data.decisionDate).toLocaleDateString('fr-FR')})`}
            </>
          )}
        </div>
      </header>

      <h3 className="d-section-title">Prediction Prelude</h3>
      <div className="prediction-summary">
        <div className="prob-block">
          <div className="prob-num">{Math.round(data.predictionSummary.successProbability)}%</div>
          <div className="prob-label">Probabilite de succes</div>
        </div>
        <div className="verdict-block">
          <div className="verdict-label">Verdict</div>
          <div className="verdict-text">{data.predictionSummary.verdict}</div>
        </div>
      </div>

      {data.predictionSummary.decisionDrivers.length > 0 && (
        <>
          <h4 className="d-h4">Drivers de decision</h4>
          <ul className="d-list">
            {data.predictionSummary.decisionDrivers.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </>
      )}

      {data.predictionSummary.dimensions.length > 0 && (
        <>
          <h4 className="d-h4">Predictions par dimension</h4>
          <table className="d-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th className="num">Succes</th>
                <th className="num">Risque</th>
                <th>Drivers</th>
                <th>Risques</th>
              </tr>
            </thead>
            <tbody>
              {data.predictionSummary.dimensions.map((d, i) => (
                <tr key={i}>
                  <td className="dim-name">{d.dimensionName}</td>
                  <td className="num">{Math.round(d.successProbability)}%</td>
                  <td className="num">{Math.round(d.riskScore)}/100</td>
                  <td className="kv-list">
                    {d.keyDrivers.length > 0 ? (
                      <ul>{d.keyDrivers.slice(0, 3).map((dr, j) => <li key={j}>{dr}</li>)}</ul>
                    ) : <em>aucun</em>}
                  </td>
                  <td className="kv-list">
                    {d.keyRisks.length > 0 ? (
                      <ul>{d.keyRisks.slice(0, 3).map((rk, j) => <li key={j}>{rk}</li>)}</ul>
                    ) : <em>aucun</em>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 className="d-section-title">Realite observee</h3>

      {data.realizedMilestones.length === 0 ? (
        <p className="empty-soft">Aucun milestone enregistre pour ce dossier.</p>
      ) : (
        <>
          <h4 className="d-h4">Milestones ({data.realizedMilestones.length})</h4>
          <ul className="milestones-list">
            {data.realizedMilestones.map((m) => (
              <li key={m.id} className="milestone">
                <div className="m-date">{new Date(m.date).toLocaleDateString('fr-FR')}</div>
                <div className="m-content">
                  <div className="m-title">{m.title}</div>
                  {m.description && <div className="m-desc">{m.description}</div>}
                  <div className="m-tags">
                    <span className="m-type">{m.type}</span>
                    {m.thesisAlignment && (
                      <span className={`m-align m-align-${m.thesisAlignment}`}>
                        {ALIGNMENT_LABEL[m.thesisAlignment] || m.thesisAlignment}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="d-section-title">Reconciliation prediction vs realite</h3>
      <div className="reco-stats">
        <div className="rs-block">
          <div className="rs-num">{stats.totalMilestones}</div>
          <div className="rs-label">Milestones totaux</div>
        </div>
        <div className="rs-block pos">
          <div className="rs-num">{stats.confirmsDriver}</div>
          <div className="rs-label">Drivers confirmes</div>
        </div>
        <div className="rs-block pos">
          <div className="rs-num">{stats.confirmsRisk}</div>
          <div className="rs-label">Risques confirmes</div>
        </div>
        <div className="rs-block neg">
          <div className="rs-num">{stats.contradictsDriver}</div>
          <div className="rs-label">Drivers contredits</div>
        </div>
        <div className="rs-block neg">
          <div className="rs-num">{stats.contradictsRisk}</div>
          <div className="rs-label">Risques contredits</div>
        </div>
        <div className="rs-block">
          <div className="rs-num">{stats.unforeseenPositive}</div>
          <div className="rs-label">Imprevus positifs</div>
        </div>
        <div className="rs-block">
          <div className="rs-num">{stats.unforeseenNegative}</div>
          <div className="rs-label">Imprevus negatifs</div>
        </div>
      </div>

      <div className={`quality-verdict quality-${stats.predictionQuality}`}>
        <strong>Qualite de la prediction sur ce dossier :</strong>{' '}
        {QUALITY_LABEL[stats.predictionQuality]}
        {stats.predictionQuality === 'strong' && ' La these initiale s est confirmee dans la realite, les drivers et risques identifies a l instruction se sont averes pertinents.'}
        {stats.predictionQuality === 'mixed' && ' La realite confirme partiellement la these initiale. Certains drivers se sont concretises, certains risques se sont materialises, d autres ont ete contredits.'}
        {stats.predictionQuality === 'weak' && ' La realite contredit la these initiale. Les drivers ne se sont pas concretises ou les risques anticipes ne se sont pas materialises. Cas d apprentissage utile pour la calibration future.'}
        {stats.predictionQuality === 'insufficient_data' && ' Trop peu de milestones enregistres pour conclure sur la qualite de la prediction. Enregistrer davantage d evenements post-decision permettra une reconciliation robuste.'}
      </div>

      <style jsx>{`
        .dossier-details { font-size: 14px; line-height: 1.55; }
        .d-header {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e6e3dd;
        }
        .d-title {
          font-family: var(--serif);
          font-size: 26px;
          color: #16213a;
          margin: 0 0 4px;
          font-weight: 600;
        }
        .d-meta {
          font-size: 13px;
          color: #6e6c66;
        }
        .d-section-title {
          font-family: var(--serif);
          font-size: 19px;
          color: #16213a;
          margin: 28px 0 10px;
          font-weight: 600;
        }
        .d-h4 {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8780;
          margin: 16px 0 8px;
          font-weight: 600;
        }
        .prediction-summary {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 18px;
          margin-bottom: 18px;
        }
        .prob-block, .verdict-block {
          padding: 16px 18px;
          background: #f6f3ec;
          border-radius: 6px;
        }
        .prob-num {
          font-family: var(--serif);
          font-size: 36px;
          font-weight: 600;
          color: #16213a;
          line-height: 1;
        }
        .prob-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8780;
          margin-top: 6px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .verdict-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8780;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          margin-bottom: 6px;
        }
        .verdict-text {
          font-size: 18px;
          color: #16213a;
          font-weight: 600;
        }
        .d-list { padding-left: 20px; margin: 6px 0 14px; }
        .d-list li { margin-bottom: 6px; }
        .d-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0 18px;
          font-size: 13px;
        }
        .d-table th, .d-table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #e6e3dd;
          vertical-align: top;
        }
        .d-table th {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8a8780;
          font-weight: 600;
          background: #fafaf6;
        }
        .d-table .num { text-align: right; font-variant-numeric: tabular-nums; }
        .d-table .dim-name { font-weight: 600; width: 16%; }
        .kv-list { width: 30%; }
        .kv-list ul { padding-left: 16px; margin: 0; }
        .kv-list li { margin-bottom: 3px; font-size: 12.5px; }
        .kv-list em { color: #8a8780; font-size: 12.5px; }
        .milestones-list {
          list-style: none;
          padding: 0;
          margin: 8px 0 18px;
        }
        .milestone {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 16px;
          padding: 12px 0;
          border-bottom: 1px solid #f0ede5;
        }
        .m-date {
          font-size: 12.5px;
          color: #8a8780;
          font-variant-numeric: tabular-nums;
        }
        .m-title { font-weight: 600; margin-bottom: 4px; }
        .m-desc { font-size: 13px; color: #6e6c66; margin-bottom: 6px; }
        .m-tags { display: flex; gap: 8px; flex-wrap: wrap; }
        .m-type, .m-align {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 11px;
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #efece5;
          color: #6e6c66;
        }
        .m-align-confirms_driver, .m-align-contradicts_risk { color: #1f5f3f; background: rgba(31, 95, 63, 0.08); }
        .m-align-confirms_risk { color: #b47832; background: rgba(180, 120, 50, 0.08); }
        .m-align-contradicts_driver, .m-align-unforeseen_negative { color: #b14842; background: rgba(177, 72, 66, 0.08); }
        .m-align-unforeseen_positive { color: #1f5f3f; background: rgba(31, 95, 63, 0.06); }
        .reco-stats {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 10px;
          margin: 10px 0 22px;
        }
        .rs-block {
          background: #f6f3ec;
          border-radius: 6px;
          padding: 12px;
          text-align: center;
        }
        .rs-num {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 600;
          color: #16213a;
        }
        .rs-block.pos .rs-num { color: #1f5f3f; }
        .rs-block.neg .rs-num { color: #b14842; }
        .rs-label {
          font-size: 9.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #8a8780;
          margin-top: 4px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .quality-verdict {
          padding: 14px 18px;
          margin: 14px 0;
          border-radius: 4px;
          font-size: 13.5px;
          line-height: 1.6;
          border-left: 4px solid;
        }
        .quality-verdict strong {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-right: 6px;
        }
        .quality-strong { background: rgba(31, 95, 63, 0.06); border-color: #1f5f3f; }
        .quality-mixed { background: rgba(180, 120, 50, 0.06); border-color: #b47832; }
        .quality-weak { background: rgba(177, 72, 66, 0.06); border-color: #b14842; }
        .quality-insufficient_data { background: #f6f3ec; border-color: #6e6c66; }
        .empty-soft { color: #8a8780; font-style: italic; padding: 8px 0; }

        @media (max-width: 800px) {
          .prediction-summary { grid-template-columns: 1fr; }
          .reco-stats { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
