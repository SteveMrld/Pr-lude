'use client';

// ============================================================
// OutcomeTracking - Bloc E3 Reconciliation prediction vs reality
// ------------------------------------------------------------
// Compose deux blocs :
//   1) Decision finale du fonds (invested/passed/declined/waitlisted)
//      avec les conditions d entree si invested
//   2) Timeline des milestones post-decision avec ajout/suppression
//
// S affiche en bas de la note d investissement quand un analysisId
// est fourni. Si l auth ou la persistance ne sont pas activees, le
// composant ne se monte pas.
// ============================================================

import { useEffect, useState } from 'react';

interface RealizedOutcome {
  id: string;
  decision: 'invested' | 'passed' | 'declined' | 'waitlisted';
  decisionDate: string;
  decisionNotes: string | null;
  entryRoundType: string | null;
  entryRoundSizeEur: number | null;
  entryValuationEur: number | null;
  entryValuationBasis: 'pre_money' | 'post_money' | null;
  entryTicketSizeEur: number | null;
  entryOwnershipPct: number | null;
  entryLead: boolean | null;
  entryCoInvestors: string[] | null;
}

interface Milestone {
  id: string;
  milestoneDate: string;
  milestoneType: string;
  title: string;
  description: string | null;
  impact: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
  numericalValue: number | null;
  numericalUnit: string | null;
  thesisAlignment: string | null;
  sourceUrl: string | null;
}

const DECISION_LABELS: Record<string, string> = {
  invested: 'Investi',
  passed: 'Passé',
  declined: 'Décliné',
  waitlisted: 'Mis en attente',
};

const DECISION_COLORS: Record<string, string> = {
  invested: 'var(--vert-foret)',
  passed: 'var(--muted)',
  declined: 'var(--warn)',
  waitlisted: 'var(--ocre-brule)',
};

const MILESTONE_TYPES: Array<{ key: string; label: string }> = [
  { key: 'fundraise', label: 'Levée de fonds' },
  { key: 'pivot', label: 'Pivot stratégique' },
  { key: 'team_change', label: 'Changement équipe' },
  { key: 'revenue_update', label: 'Update revenu / ARR' },
  { key: 'metric_update', label: 'Update métrique clé' },
  { key: 'churn', label: 'Perte client clé' },
  { key: 'partnership', label: 'Partenariat majeur' },
  { key: 'product_launch', label: 'Lancement produit' },
  { key: 'regulatory', label: 'Événement réglementaire' },
  { key: 'legal', label: 'Litige / IP / gouvernance' },
  { key: 'macro_shock', label: 'Choc macro' },
  { key: 'exit', label: 'Exit (IPO / M&A)' },
  { key: 'fail', label: 'Faillite / dissolution' },
  { key: 'other', label: 'Autre' },
];

const ALIGNMENT_LABELS: Record<string, string> = {
  confirms_driver: 'Valide un driver positif identifié',
  confirms_risk: 'Valide un risque identifié',
  contradicts_driver: 'Un driver positif ne se matérialise pas',
  contradicts_risk: 'Un risque identifié ne se matérialise pas',
  unforeseen_positive: 'Événement positif non prévu',
  unforeseen_negative: 'Événement négatif non prévu',
};

const IMPACT_COLORS: Record<string, string> = {
  positive: 'var(--vert-foret)',
  negative: 'var(--warn)',
  mixed: 'var(--ocre-brule)',
  neutral: 'var(--muted)',
};

function formatEur(v: number | null): string {
  if (v === null) return '';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M €`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k €`;
  return `${v} €`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OutcomeTracking({ analysisId }: { analysisId: string }) {
  const [outcome, setOutcome] = useState<RealizedOutcome | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDecision, setEditingDecision] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);

  // Charge les deux en parallele
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [oRes, mRes] = await Promise.all([
          fetch(`/api/analyses/${analysisId}/outcome`),
          fetch(`/api/analyses/${analysisId}/milestones`),
        ]);
        if (cancelled) return;
        if (oRes.status === 403 || oRes.status === 401) {
          setError('auth-required');
          setLoading(false);
          return;
        }
        if (!oRes.ok || !mRes.ok) {
          setError('load-failed');
          setLoading(false);
          return;
        }
        const oJson = await oRes.json();
        const mJson = await mRes.json();
        if (cancelled) return;
        setOutcome(oJson.outcome || null);
        setMilestones(mJson.milestones || []);
        setError(null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('network-error');
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [analysisId]);

  // Si auth desactivee, on ne montre meme pas le bloc
  if (error === 'auth-required') return null;

  const handleSaveDecision = async (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const body: any = {
      decision: fd.get('decision'),
      decisionDate: fd.get('decisionDate'),
      decisionNotes: fd.get('decisionNotes') || null,
    };
    if (body.decision === 'invested') {
      body.entryRoundType = fd.get('entryRoundType') || null;
      body.entryRoundSizeEur = fd.get('entryRoundSizeEur') || null;
      body.entryValuationEur = fd.get('entryValuationEur') || null;
      body.entryValuationBasis = fd.get('entryValuationBasis') || null;
      body.entryTicketSizeEur = fd.get('entryTicketSizeEur') || null;
      body.entryOwnershipPct = fd.get('entryOwnershipPct') || null;
      body.entryLead = fd.get('entryLead') === 'on';
    }
    const res = await fetch(`/api/analyses/${analysisId}/outcome`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      setOutcome(json.outcome);
      setEditingDecision(false);
    }
  };

  const handleAddMilestone = async (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const body: any = {
      milestoneDate: fd.get('milestoneDate'),
      milestoneType: fd.get('milestoneType'),
      title: fd.get('title'),
      description: fd.get('description') || null,
      impact: fd.get('impact') || null,
      numericalValue: fd.get('numericalValue') || null,
      numericalUnit: fd.get('numericalUnit') || null,
      thesisAlignment: fd.get('thesisAlignment') || null,
      sourceUrl: fd.get('sourceUrl') || null,
    };
    const res = await fetch(`/api/analyses/${analysisId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      setMilestones([json.milestone, ...milestones]);
      form.reset();
      setAddingMilestone(false);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('Supprimer ce milestone ?')) return;
    const res = await fetch(`/api/analyses/${analysisId}/milestones/${milestoneId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setMilestones(milestones.filter((m) => m.id !== milestoneId));
    }
  };

  if (loading) {
    return <div className="ot-loading">Chargement du suivi...</div>;
  }

  return (
    <div className="ot">
      {/* DECISION FINALE */}
      <div className="ot-block">
        <div className="ot-block-header">
          <h3 className="ot-block-title">Décision du fonds</h3>
          {!editingDecision && (
            <button className="ot-button-link" onClick={() => setEditingDecision(true)}>
              {outcome ? 'Modifier' : 'Enregistrer une décision'}
            </button>
          )}
        </div>

        {!editingDecision && outcome && (
          <div className="ot-decision-card">
            <div className="ot-decision-row">
              <span
                className="ot-decision-badge"
                style={{ backgroundColor: DECISION_COLORS[outcome.decision] }}
              >
                {DECISION_LABELS[outcome.decision]}
              </span>
              <span className="ot-decision-date">{formatDate(outcome.decisionDate)}</span>
            </div>
            {outcome.decision === 'invested' && (
              <div className="ot-entry-grid">
                {outcome.entryRoundType && <div><dt>Tour</dt><dd>{outcome.entryRoundType}</dd></div>}
                {outcome.entryValuationEur !== null && (
                  <div>
                    <dt>Valo {outcome.entryValuationBasis === 'post_money' ? 'post' : 'pre'}</dt>
                    <dd>{formatEur(outcome.entryValuationEur)}</dd>
                  </div>
                )}
                {outcome.entryRoundSizeEur !== null && (
                  <div><dt>Taille du tour</dt><dd>{formatEur(outcome.entryRoundSizeEur)}</dd></div>
                )}
                {outcome.entryTicketSizeEur !== null && (
                  <div><dt>Ticket fonds</dt><dd>{formatEur(outcome.entryTicketSizeEur)}</dd></div>
                )}
                {outcome.entryOwnershipPct !== null && (
                  <div><dt>Ownership</dt><dd>{outcome.entryOwnershipPct}%</dd></div>
                )}
                {outcome.entryLead !== null && (
                  <div><dt>Lead</dt><dd>{outcome.entryLead ? 'Oui' : 'Non'}</dd></div>
                )}
              </div>
            )}
            {outcome.decisionNotes && (
              <p className="ot-decision-notes">{outcome.decisionNotes}</p>
            )}
          </div>
        )}

        {!editingDecision && !outcome && (
          <p className="ot-empty">
            Aucune décision enregistrée. La réconciliation entre prédiction et réalité
            commence par marquer ce dossier comme investi, passé, décliné ou en attente.
          </p>
        )}

        {editingDecision && (
          <form
            className="ot-form"
            onSubmit={(e) => { e.preventDefault(); handleSaveDecision(e.currentTarget); }}
          >
            <DecisionForm outcome={outcome} onCancel={() => setEditingDecision(false)} />
          </form>
        )}
      </div>

      {/* MILESTONES */}
      <div className="ot-block">
        <div className="ot-block-header">
          <h3 className="ot-block-title">Trajectoire réelle</h3>
          {!addingMilestone && (
            <button className="ot-button-link" onClick={() => setAddingMilestone(true)}>
              + Ajouter un événement
            </button>
          )}
        </div>

        {addingMilestone && (
          <form
            className="ot-form ot-form-milestone"
            onSubmit={(e) => { e.preventDefault(); handleAddMilestone(e.currentTarget); }}
          >
            <MilestoneForm onCancel={() => setAddingMilestone(false)} />
          </form>
        )}

        {milestones.length === 0 && !addingMilestone && (
          <p className="ot-empty">
            Aucun événement enregistré. Note ici les levées de fonds, pivots, lancements,
            churns, exits ou tout signal qui valide ou contredit la thèse initiale.
          </p>
        )}

        {milestones.length > 0 && (
          <ul className="ot-milestone-list">
            {milestones.map((m) => (
              <li key={m.id} className="ot-milestone">
                <div className="ot-milestone-date">{formatDate(m.milestoneDate)}</div>
                <div className="ot-milestone-content">
                  <div className="ot-milestone-header">
                    <span className="ot-milestone-type">
                      {MILESTONE_TYPES.find((t) => t.key === m.milestoneType)?.label || m.milestoneType}
                    </span>
                    {m.impact && (
                      <span
                        className="ot-milestone-impact"
                        style={{ color: IMPACT_COLORS[m.impact] }}
                      >
                        ●
                      </span>
                    )}
                  </div>
                  <div className="ot-milestone-title">{m.title}</div>
                  {m.description && <p className="ot-milestone-desc">{m.description}</p>}
                  {m.numericalValue !== null && (
                    <div className="ot-milestone-metric">
                      {m.numericalValue.toLocaleString('fr-FR')} {m.numericalUnit}
                    </div>
                  )}
                  {m.thesisAlignment && (
                    <div className="ot-milestone-alignment">
                      {ALIGNMENT_LABELS[m.thesisAlignment]}
                    </div>
                  )}
                  {m.sourceUrl && (
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ot-milestone-source"
                    >
                      Source ↗
                    </a>
                  )}
                </div>
                <button
                  className="ot-milestone-delete"
                  onClick={() => handleDeleteMilestone(m.id)}
                  title="Supprimer"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .ot { margin-top: 32px; }
        .ot-loading {
          padding: 16px;
          color: var(--muted);
          font-style: italic;
          font-size: 13px;
        }
        .ot-block {
          margin-bottom: 28px;
          padding: 20px 22px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 10px;
        }
        .ot-block-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .ot-block-title {
          font-family: var(--serif);
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .ot-button-link {
          background: none;
          border: none;
          color: var(--accent);
          font-family: var(--sans);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }
        .ot-button-link:hover { text-decoration: underline; }

        .ot-empty {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
          font-style: italic;
          margin: 0;
        }

        .ot-decision-card {}
        .ot-decision-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .ot-decision-badge {
          color: white;
          font-family: var(--sans);
          font-size: 11px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .ot-decision-date {
          font-size: 12px;
          color: var(--muted);
        }
        .ot-entry-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px 16px;
          margin-bottom: 10px;
        }
        .ot-entry-grid > div {}
        .ot-entry-grid dt {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0;
        }
        .ot-entry-grid dd {
          font-family: var(--serif);
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
          margin: 2px 0 0 0;
          font-feature-settings: "lnum","tnum";
        }
        .ot-decision-notes {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--hairline);
          font-size: 13px;
          line-height: 1.5;
          color: var(--ink);
        }

        .ot-milestone-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .ot-milestone {
          display: grid;
          grid-template-columns: 100px 1fr 24px;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .ot-milestone:last-child { border-bottom: none; }
        .ot-milestone-date {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          padding-top: 2px;
        }
        .ot-milestone-content { min-width: 0; }
        .ot-milestone-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .ot-milestone-type {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--muted);
        }
        .ot-milestone-impact { font-size: 10px; }
        .ot-milestone-title {
          font-family: var(--serif);
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
          line-height: 1.4;
        }
        .ot-milestone-desc {
          font-size: 13px;
          line-height: 1.5;
          color: var(--ink-soft);
          margin: 4px 0 0 0;
        }
        .ot-milestone-metric {
          margin-top: 4px;
          font-family: var(--serif);
          font-size: 14px;
          font-weight: 700;
          color: var(--accent);
          font-feature-settings: "lnum","tnum";
        }
        .ot-milestone-alignment {
          margin-top: 4px;
          font-size: 11px;
          font-style: italic;
          color: var(--muted);
        }
        .ot-milestone-source {
          display: inline-block;
          margin-top: 4px;
          font-size: 11px;
          color: var(--accent);
          text-decoration: none;
        }
        .ot-milestone-source:hover { text-decoration: underline; }
        .ot-milestone-delete {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ot-milestone-delete:hover { color: var(--warn); }

        .ot-form {
          padding: 14px;
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 8px;
          margin-bottom: 14px;
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Sous-composants form
// ============================================================

function DecisionForm({
  outcome,
  onCancel,
}: {
  outcome: RealizedOutcome | null;
  onCancel: () => void;
}) {
  const [decision, setDecision] = useState(outcome?.decision || 'passed');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="otf-row">
        <label className="otf-label">
          Décision
          <select
            name="decision"
            defaultValue={outcome?.decision || 'passed'}
            onChange={(e) => setDecision(e.target.value as any)}
          >
            <option value="invested">Investi</option>
            <option value="passed">Passé (intérêt mais pas de suite)</option>
            <option value="declined">Décliné (refusé)</option>
            <option value="waitlisted">Mis en attente</option>
          </select>
        </label>
        <label className="otf-label">
          Date
          <input
            type="date"
            name="decisionDate"
            defaultValue={outcome?.decisionDate?.slice(0, 10) || today}
          />
        </label>
      </div>

      {decision === 'invested' && (
        <div className="otf-fieldset">
          <div className="otf-fieldset-label">Conditions d&apos;entrée</div>
          <div className="otf-row">
            <label className="otf-label">
              Tour
              <input
                type="text"
                name="entryRoundType"
                placeholder="Seed, Series A, etc."
                defaultValue={outcome?.entryRoundType || ''}
              />
            </label>
            <label className="otf-label">
              Taille du tour (EUR)
              <input
                type="number"
                name="entryRoundSizeEur"
                placeholder="5000000"
                defaultValue={outcome?.entryRoundSizeEur || ''}
              />
            </label>
          </div>
          <div className="otf-row">
            <label className="otf-label">
              Valorisation (EUR)
              <input
                type="number"
                name="entryValuationEur"
                placeholder="20000000"
                defaultValue={outcome?.entryValuationEur || ''}
              />
            </label>
            <label className="otf-label">
              Type de valo
              <select
                name="entryValuationBasis"
                defaultValue={outcome?.entryValuationBasis || 'pre_money'}
              >
                <option value="pre_money">Pre-money</option>
                <option value="post_money">Post-money</option>
              </select>
            </label>
          </div>
          <div className="otf-row">
            <label className="otf-label">
              Ticket du fonds (EUR)
              <input
                type="number"
                name="entryTicketSizeEur"
                placeholder="500000"
                defaultValue={outcome?.entryTicketSizeEur || ''}
              />
            </label>
            <label className="otf-label">
              Ownership (%)
              <input
                type="number"
                name="entryOwnershipPct"
                step="0.1"
                placeholder="2.5"
                defaultValue={outcome?.entryOwnershipPct || ''}
              />
            </label>
          </div>
          <label className="otf-checkbox">
            <input
              type="checkbox"
              name="entryLead"
              defaultChecked={outcome?.entryLead || false}
            />
            Le fonds est lead du tour
          </label>
        </div>
      )}

      <label className="otf-label">
        Notes
        <textarea
          name="decisionNotes"
          rows={3}
          placeholder="Contexte de la décision, conditions négociées, etc."
          defaultValue={outcome?.decisionNotes || ''}
        />
      </label>

      <div className="otf-actions">
        <button type="button" onClick={onCancel} className="otf-cancel">Annuler</button>
        <button type="submit" className="otf-submit">Enregistrer</button>
      </div>

      <style jsx>{`
        .otf-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        @media (max-width: 600px) {
          .otf-row { grid-template-columns: 1fr; }
        }
        .otf-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .otf-label input,
        .otf-label select,
        .otf-label textarea {
          padding: 8px 10px;
          border: 1px solid var(--hairline);
          border-radius: 6px;
          font-family: var(--sans);
          font-size: 14px;
          font-weight: normal;
          color: var(--ink);
          background: var(--paper);
          text-transform: none;
          letter-spacing: normal;
        }
        .otf-label input:focus,
        .otf-label select:focus,
        .otf-label textarea:focus {
          outline: none;
          border-color: var(--accent);
        }
        .otf-fieldset {
          padding: 12px;
          background: var(--paper-accent);
          border: 1px solid var(--hairline);
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .otf-fieldset-label {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--ink);
          margin-bottom: 10px;
        }
        .otf-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--ink);
        }
        .otf-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--hairline);
        }
        .otf-cancel {
          padding: 8px 16px;
          background: none;
          border: 1px solid var(--hairline);
          border-radius: 6px;
          color: var(--muted);
          font-family: var(--sans);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .otf-submit {
          padding: 8px 16px;
          background: var(--accent);
          border: 1px solid var(--accent);
          border-radius: 6px;
          color: var(--paper);
          font-family: var(--sans);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .otf-submit:hover { opacity: 0.9; }
      `}</style>
    </>
  );
}

function MilestoneForm({ onCancel }: { onCancel: () => void }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="otf-row">
        <label className="otf-label">
          Date
          <input type="date" name="milestoneDate" defaultValue={today} required />
        </label>
        <label className="otf-label">
          Type d&apos;événement
          <select name="milestoneType" defaultValue="fundraise" required>
            {MILESTONE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="otf-label">
        Titre
        <input
          type="text"
          name="title"
          placeholder="Ex Series A 12M EUR menée par Sequoia"
          required
          maxLength={200}
        />
      </label>

      <label className="otf-label">
        Description
        <textarea
          name="description"
          rows={3}
          placeholder="Contexte, chiffres, sources..."
        />
      </label>

      <div className="otf-row">
        <label className="otf-label">
          Valeur numérique (optionnel)
          <input
            type="number"
            name="numericalValue"
            placeholder="12000000"
            step="any"
          />
        </label>
        <label className="otf-label">
          Unité
          <input
            type="text"
            name="numericalUnit"
            placeholder="EUR, USD, %, count..."
          />
        </label>
      </div>

      <label className="otf-label">
        Impact qualitatif
        <select name="impact" defaultValue="">
          <option value="">— non spécifié —</option>
          <option value="positive">Positif</option>
          <option value="negative">Négatif</option>
          <option value="mixed">Mixte</option>
          <option value="neutral">Neutre</option>
        </select>
      </label>

      <label className="otf-label">
        Lien à la thèse initiale
        <select name="thesisAlignment" defaultValue="">
          <option value="">— non spécifié —</option>
          <option value="confirms_driver">Valide un driver positif identifié</option>
          <option value="confirms_risk">Valide un risque identifié</option>
          <option value="contradicts_driver">Un driver positif ne se matérialise pas</option>
          <option value="contradicts_risk">Un risque identifié ne se matérialise pas</option>
          <option value="unforeseen_positive">Événement positif non prévu</option>
          <option value="unforeseen_negative">Événement négatif non prévu</option>
        </select>
      </label>

      <label className="otf-label">
        Source (URL)
        <input
          type="url"
          name="sourceUrl"
          placeholder="https://..."
        />
      </label>

      <div className="otf-actions">
        <button type="button" onClick={onCancel} className="otf-cancel">Annuler</button>
        <button type="submit" className="otf-submit">Ajouter</button>
      </div>

      <style jsx>{`
        .otf-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        @media (max-width: 600px) {
          .otf-row { grid-template-columns: 1fr; }
        }
        .otf-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .otf-label input,
        .otf-label select,
        .otf-label textarea {
          padding: 8px 10px;
          border: 1px solid var(--hairline);
          border-radius: 6px;
          font-family: var(--sans);
          font-size: 14px;
          font-weight: normal;
          color: var(--ink);
          background: var(--paper);
          text-transform: none;
          letter-spacing: normal;
        }
        .otf-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--hairline);
        }
        .otf-cancel {
          padding: 8px 16px;
          background: none;
          border: 1px solid var(--hairline);
          border-radius: 6px;
          color: var(--muted);
          font-family: var(--sans);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .otf-submit {
          padding: 8px 16px;
          background: var(--accent);
          border: 1px solid var(--accent);
          border-radius: 6px;
          color: var(--paper);
          font-family: var(--sans);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
