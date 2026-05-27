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
  passed: 'Passé',
  declined: 'Refusé',
  waitlisted: "En liste d'attente",
};

const ALIGNMENT_LABEL: Record<string, string> = {
  confirms_driver: 'Driver confirmé',
  confirms_risk: 'Risque confirmé',
  contradicts_driver: 'Driver contredit',
  contradicts_risk: 'Risque contredit',
  unforeseen_positive: 'Imprévu positif',
  unforeseen_negative: 'Imprévu négatif',
};

const ACCURACY_LABEL: Record<string, string> = {
  high: 'Forte',
  medium: 'Modérée',
  low: 'Faible',
  insufficient_data: 'Données insuffisantes',
};

const QUALITY_LABEL: Record<string, string> = {
  strong: 'Thèse confirmée',
  mixed: 'Thèse mixte',
  weak: 'Thèse contredite',
  insufficient_data: 'Données insuffisantes',
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
          <h1 className="reco-title">Réconciliation</h1>
          <p className="reco-sub">
            Confronter ce que Prelude prédisait avec ce qui s'est réellement passé.
            {' '}{orgName} · {userEmail}
          </p>
        </div>
        <div className="reco-back">
          <Link href="/">Retour à l'accueil</Link>
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
  const totalDecisions =
    portfolio.byDecision.invested
    + portfolio.byDecision.passed
    + portfolio.byDecision.declined
    + portfolio.byDecision.waitlisted;

  // Compose la phrase de distribution des decisions en prose, plutot
  // qu en colonne. Skip les zeros pour eviter la mention triviale.
  const distributionPhrase = (() => {
    if (totalDecisions === 0) return null;
    const parts: string[] = [];
    if (portfolio.byDecision.invested > 0) {
      parts.push(`${portfolio.byDecision.invested} ${portfolio.byDecision.invested > 1 ? 'investis' : 'investi'}`);
    }
    if (portfolio.byDecision.passed > 0) {
      parts.push(`${portfolio.byDecision.passed} ${portfolio.byDecision.passed > 1 ? 'passés' : 'passé'}`);
    }
    if (portfolio.byDecision.declined > 0) {
      parts.push(`${portfolio.byDecision.declined} ${portfolio.byDecision.declined > 1 ? 'refusés' : 'refusé'}`);
    }
    if (portfolio.byDecision.waitlisted > 0) {
      parts.push(`${portfolio.byDecision.waitlisted} en attente`);
    }
    return parts.join(', ');
  })();

  return (
    <div className="pane">
      <p className="progress-narrative">{portfolio.progressNarrative}</p>

      {portfolio.thresholdMet && portfolio.systemicPatterns.length > 0 && (
        <section className="patterns-section">
          <h2 className="section-title">Lecture du miroir</h2>
          {portfolio.systemicPatterns.map((p, i) => (
            <p key={i} className="pattern-paragraph">{p}</p>
          ))}
        </section>
      )}

      {portfolio.thresholdMet && portfolio.systemicPatterns.length === 0 && (
        <section className="patterns-section">
          <h2 className="section-title">Lecture du miroir</h2>
          <p className="pattern-paragraph">
            Sur les {portfolio.totalDossiersWithReconciliation} dossiers réconciliés, aucun pattern
            structurel ne se dégage. La prédiction du fonds se confirme sans biais systématique
            visible sur cet échantillon. Cela ne dit pas que l'instruction est parfaite : cela dit
            qu'il n'y a pas d'écart cumulé assez net pour faire signal. Continuez à alimenter la
            réconciliation, et les angles morts apparaîtront s'ils existent.
          </p>
        </section>
      )}

      {distributionPhrase && (
        <section className="distribution-section">
          <h3 className="distribution-title">Distribution des décisions</h3>
          <p className="distribution-prose">
            Sur les {totalDecisions} {totalDecisions > 1 ? 'dossiers' : 'dossier'} décid{totalDecisions > 1 ? 'és' : 'é'} : {distributionPhrase}.
          </p>
        </section>
      )}

      {portfolio.thresholdMet && portfolio.byDimension.length > 0 && (
        <details className="dimensions-annex">
          <summary>Détail chiffré par dimension</summary>
          <ul className="dimensions-list">
            {portfolio.byDimension.map((d, i) => (
              <li key={i} className="dimension-line">
                <span className="dim-name">{d.dimensionName}</span>
                <span className="dim-sep"> · </span>
                <span className="dim-stats">
                  succès prédit moyen {d.averagePredictedSuccess} pour cent,
                  drivers confirmés {d.confirmedDrivers} contre {d.contradictedDrivers} contredits,
                  risques confirmés {d.confirmedRisks} contre {d.contradictedRisks} contredits,
                  calibration {ACCURACY_LABEL[d.predictionAccuracy] || d.predictionAccuracy}
                </span>
              </li>
            ))}
          </ul>
          <p className="annex-note">
            Les nombres ci-dessus sont l'ossature des paragraphes du miroir, jamais l'inverse.
            Ils ne se lisent pas comme un dashboard : ils permettent de remonter au cas par cas
            quand un constat de prose mérite vérification.
          </p>
        </details>
      )}

      <style jsx>{`
        .pane {
          font-size: 15px;
          line-height: 1.7;
          color: #1d1d1f;
          max-width: 760px;
        }
        .progress-narrative {
          margin: 0 0 32px 0;
          padding: 22px 26px;
          background: #f6f3ec;
          border-left: 3px solid #b47832;
          border-radius: 0 4px 4px 0;
          font-size: 15px;
          line-height: 1.75;
          color: #2a2a26;
        }
        .patterns-section {
          margin-top: 36px;
        }
        .section-title {
          font-family: var(--serif);
          font-size: 22px;
          color: #16213a;
          margin: 0 0 18px;
          font-weight: 600;
          letter-spacing: -0.005em;
        }
        .pattern-paragraph {
          margin: 0 0 22px 0;
          font-size: 15px;
          line-height: 1.75;
          color: #1d1d1f;
        }
        .pattern-paragraph:first-of-type::before {
          content: '';
          display: block;
          width: 28px;
          border-top: 1px solid #1f5f3f;
          margin-bottom: 14px;
        }
        .distribution-section {
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid #e6e3dd;
        }
        .distribution-title {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: #8a8780;
          margin: 0 0 6px;
          font-weight: 600;
        }
        .distribution-prose {
          margin: 0;
          font-size: 14.5px;
          line-height: 1.7;
          color: #2a2a26;
        }
        .dimensions-annex {
          margin-top: 32px;
          padding-top: 18px;
          border-top: 1px solid #e6e3dd;
        }
        .dimensions-annex summary {
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: #8a8780;
          font-weight: 600;
          margin-bottom: 12px;
          list-style: none;
        }
        .dimensions-annex summary::-webkit-details-marker { display: none; }
        .dimensions-annex summary::before {
          content: '▸';
          display: inline-block;
          margin-right: 8px;
          color: #b47832;
          font-size: 10px;
          transition: transform 200ms;
        }
        .dimensions-annex[open] summary::before {
          transform: rotate(90deg);
        }
        .dimensions-list {
          list-style: none;
          padding: 0;
          margin: 0 0 14px;
        }
        .dimension-line {
          padding: 6px 0;
          font-size: 13.5px;
          line-height: 1.55;
          color: #2a2a26;
        }
        .dim-name {
          font-weight: 600;
          color: #16213a;
        }
        .dim-sep { color: #b47832; }
        .dim-stats { color: #4a4a44; }
        .annex-note {
          font-size: 12.5px;
          color: #8a8780;
          font-style: italic;
          line-height: 1.6;
          margin: 14px 0 0;
        }

        @media (max-width: 700px) {
          .progress-narrative {
            padding: 18px 20px;
            font-size: 14.5px;
          }
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
          <option value="">Sélectionnez un dossier...</option>
          {dossiersList.map((d) => (
            <option key={d.id} value={d.id}>
              {d.companyName} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="loading">Chargement de la réconciliation...</p>}
      {error && <p className="error">Erreur : {error}</p>}

      {dossierData && (
        <DossierDetails data={dossierData} />
      )}

      {!loading && !error && !dossierData && selectedDossierId === null && (
        <p className="empty">Sélectionnez un dossier dans la liste ci-dessus pour afficher sa réconciliation.</p>
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
          Analysé le {new Date(data.analyzedAt).toLocaleDateString('fr-FR')}
          {data.decision && (
            <>
              {' · '}Décision : {VERDICT_LABEL[data.decision]}
              {data.decisionDate && ` (${new Date(data.decisionDate).toLocaleDateString('fr-FR')})`}
            </>
          )}
        </div>
      </header>

      <h3 className="d-section-title">Prédiction Prelude</h3>
      <div className="prediction-summary">
        <div className="prob-block">
          <div className="prob-num">{Math.round(data.predictionSummary.successProbability)}%</div>
          <div className="prob-label">Probabilité de succès</div>
        </div>
        <div className="verdict-block">
          <div className="verdict-label">Verdict</div>
          <div className="verdict-text">{data.predictionSummary.verdict}</div>
        </div>
      </div>

      {data.predictionSummary.decisionDrivers.length > 0 && (
        <>
          <h4 className="d-h4">Drivers de décision</h4>
          <ul className="d-list">
            {data.predictionSummary.decisionDrivers.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </>
      )}

      {data.predictionSummary.dimensions.length > 0 && (
        <>
          <h4 className="d-h4">Prédictions par dimension</h4>
          <table className="d-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th className="num">Succès</th>
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

      <h3 className="d-section-title">Réalité observée</h3>

      {data.realizedMilestones.length === 0 ? (
        <p className="empty-soft">Aucun milestone enregistré pour ce dossier.</p>
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

      <h3 className="d-section-title">Réconciliation prédiction vs réalité</h3>

      <div className={`quality-verdict quality-${stats.predictionQuality}`}>
        <strong>Qualité de la prédiction sur ce dossier :</strong>{' '}
        {QUALITY_LABEL[stats.predictionQuality]}
        {stats.predictionQuality === 'strong' && " La thèse initiale s'est confirmée dans la réalité, les drivers et risques identifiés à l'instruction se sont avérés pertinents."}
        {stats.predictionQuality === 'mixed' && " La réalité confirme partiellement la thèse initiale. Certains drivers se sont concrétisés, certains risques se sont matérialisés, d'autres ont été contredits."}
        {stats.predictionQuality === 'weak' && " La réalité contredit la thèse initiale. Les drivers ne se sont pas concrétisés ou les risques anticipés ne se sont pas matérialisés. Cas d'apprentissage utile pour la calibration future."}
        {stats.predictionQuality === 'insufficient_data' && " Trop peu de milestones enregistrés pour conclure sur la qualité de la prédiction. Enregistrer davantage d'événements post-décision permettra une réconciliation robuste."}
      </div>

      {stats.totalMilestones > 0 && (
        <p className="d-reco-prose">
          Sur les {stats.totalMilestones} milestone{stats.totalMilestones > 1 ? 's' : ''} réconcilié{stats.totalMilestones > 1 ? 's' : ''},
          {stats.confirmsDriver > 0 && ` ${stats.confirmsDriver} ${stats.confirmsDriver > 1 ? 'confirment' : 'confirme'} un driver positif identifié à l'instruction,`}
          {stats.contradictsDriver > 0 && ` ${stats.contradictsDriver} ${stats.contradictsDriver > 1 ? 'contredisent' : 'contredit'} un driver positif annoncé,`}
          {stats.confirmsRisk > 0 && ` ${stats.confirmsRisk} ${stats.confirmsRisk > 1 ? 'valident' : 'valide'} un risque identifié,`}
          {stats.contradictsRisk > 0 && ` ${stats.contradictsRisk} ${stats.contradictsRisk > 1 ? 'démontrent' : 'démontre'} qu'un risque alerté ne se matérialise pas,`}
          {stats.unforeseenPositive > 0 && ` ${stats.unforeseenPositive} ${stats.unforeseenPositive > 1 ? 'sont des surprises positives' : 'est une surprise positive'} non anticipées,`}
          {stats.unforeseenNegative > 0 && ` ${stats.unforeseenNegative} ${stats.unforeseenNegative > 1 ? 'sont des chocs négatifs' : 'est un choc négatif'} non anticipé${stats.unforeseenNegative > 1 ? 's' : ''} à l'instruction,`}
          {' '}sur la base des milestones confirmés par le partner.
        </p>
      )}

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
        .d-reco-prose {
          margin: 14px 0 0;
          font-size: 14px;
          line-height: 1.7;
          color: #2a2a26;
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
        }
      `}</style>
    </div>
  );
}
