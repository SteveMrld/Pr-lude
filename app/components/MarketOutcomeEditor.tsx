'use client';

// ============================================================
// MarketOutcomeEditor - issue de marche du dossier
// ------------------------------------------------------------
// Saisie manuelle de l etat reel du dossier dans le marche :
// vivant, sorti (IPO/M&A), echoue, ou stagne. C est l ingredient
// qui ferme la boucle prediction vs realite et permet a la
// couche de calibration de produire des metriques.
//
// La decision du fonds (invested/passed/...) est traitee
// ailleurs dans OutcomeTracking : ce sont deux choses
// distinctes, on les separe pour eviter la confusion entre
// "j ai investi" et "ca a fini par marcher".
// ============================================================

import { useEffect, useState } from 'react';
import SectionFallbackLine from './SectionFallbackLine';

type MarketOutcome = 'alive' | 'exit' | 'fail' | 'flat';

interface AnalysisOutcome {
  id: string;
  marketOutcome: MarketOutcome;
  observedAt: string;
  source: string;
  sourceUrl: string | null;
  sourceNotes: string | null;
}

const OUTCOME_LABELS: Record<MarketOutcome, string> = {
  alive: 'En vie',
  exit: 'Sortie (IPO / M&A)',
  fail: 'Échec (dissolution, dépôt de bilan)',
  flat: 'À plat (zombie)',
};

const OUTCOME_COLORS: Record<MarketOutcome, string> = {
  alive: 'var(--muted, #6e6c66)',
  exit: 'var(--vert-foret, #1f5f3f)',
  fail: 'var(--warn, #b14842)',
  flat: 'var(--ocre-brule, #b47832)',
};

const OUTCOME_DESCRIPTIONS: Record<MarketOutcome, string> = {
  alive:
    "La société opère sans événement de sortie ni de faillite. Statut non résolu : n'entre pas dans la calibration.",
  exit:
    "IPO, acquisition complète, ou tout événement de sortie qui matérialise une issue positive. Entre dans la calibration comme succès.",
  fail:
    "Dépôt de bilan, dissolution, shutdown. Issue négative. Entre dans la calibration comme échec.",
  flat:
    "Société qui opère sans croissance ni mort : zombie. Statut non résolu : n'entre pas dans la calibration.",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MarketOutcomeEditor({
  analysisId,
  printMode = false,
}: {
  analysisId: string;
  /** Rendu fige pour export PDF : jamais de spinner, ligne neutre a la place. */
  printMode?: boolean;
}) {
  const [outcome, setOutcome] = useState<AnalysisOutcome | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/analyses/${analysisId}/market-outcome`);
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setState('auth');
          return;
        }
        if (!res.ok) {
          setState('error');
          return;
        }
        const json = await res.json();
        setOutcome(json.outcome || null);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  if (state === 'auth') return null;
  // Rendu fige (printMode / export PDF) : jamais de spinner. L issue
  // marche est un elemet vivant (saisie dans le temps), donc en note
  // imprimee on rend la ligne neutre section 6.
  if (printMode && (state === 'loading' || state === 'error' || !outcome)) {
    return <SectionFallbackLine kind="suivi-reconciliation" />;
  }
  if (state === 'loading') {
    return <p className="moe-loading">Chargement de l&apos;issue marché...</p>;
  }
  if (state === 'error') {
    return <p className="moe-error">Lecture de l&apos;issue marché indisponible.</p>;
  }

  const handleSave = async (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const body = {
      marketOutcome: fd.get('marketOutcome'),
      observedAt: fd.get('observedAt'),
      sourceUrl: fd.get('sourceUrl') || null,
      sourceNotes: fd.get('sourceNotes') || null,
    };
    const res = await fetch(`/api/analyses/${analysisId}/market-outcome`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      setOutcome(json.outcome);
      setEditing(false);
    }
  };

  return (
    <div className="moe">
      <div className="moe-header">
        <h4 className="moe-title">Issue marché</h4>
        {!editing && (
          <button className="moe-link" onClick={() => setEditing(true)}>
            {outcome ? 'Modifier' : 'Saisir l\'issue'}
          </button>
        )}
      </div>

      {!editing && outcome && (
        <div className="moe-card">
          <div className="moe-row">
            <span
              className="moe-badge"
              style={{ backgroundColor: OUTCOME_COLORS[outcome.marketOutcome] }}
            >
              {OUTCOME_LABELS[outcome.marketOutcome]}
            </span>
            <span className="moe-date">observée le {formatDate(outcome.observedAt)}</span>
            <span className="moe-source">via {outcome.source}</span>
          </div>
          <p className="moe-desc">{OUTCOME_DESCRIPTIONS[outcome.marketOutcome]}</p>
          {outcome.sourceUrl && (
            <a href={outcome.sourceUrl} target="_blank" rel="noopener noreferrer" className="moe-link-out">
              Source ↗
            </a>
          )}
          {outcome.sourceNotes && <p className="moe-notes">{outcome.sourceNotes}</p>}
        </div>
      )}

      {!editing && !outcome && (
        <p className="moe-empty">
          Aucune issue marché enregistrée. Tant que le dossier reste dans cet état, il ne
          contribue pas à la calibration. Saisissez l&apos;issue dès qu&apos;un événement résolu
          (sortie ou échec) est connu.
        </p>
      )}

      {editing && (
        <form
          className="moe-form"
          onSubmit={(e) => { e.preventDefault(); handleSave(e.currentTarget); }}
        >
          <Form outcome={outcome} onCancel={() => setEditing(false)} />
        </form>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}

function Form({ outcome, onCancel }: { outcome: AnalysisOutcome | null; onCancel: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="moe-form-row">
        <label className="moe-label">
          Issue
          <select name="marketOutcome" defaultValue={outcome?.marketOutcome || 'alive'} required>
            <option value="alive">En vie</option>
            <option value="exit">Sortie (IPO / M&amp;A)</option>
            <option value="fail">Échec (dissolution, dépôt de bilan)</option>
            <option value="flat">À plat (zombie)</option>
          </select>
        </label>
        <label className="moe-label">
          Date d&apos;observation
          <input
            type="date"
            name="observedAt"
            defaultValue={outcome?.observedAt?.slice(0, 10) || today}
            required
          />
        </label>
      </div>
      <label className="moe-label">
        Source (URL)
        <input
          type="url"
          name="sourceUrl"
          placeholder="https://..."
          defaultValue={outcome?.sourceUrl || ''}
        />
      </label>
      <label className="moe-label">
        Notes
        <textarea
          name="sourceNotes"
          rows={3}
          placeholder="Contexte de l'observation, sources additionnelles..."
          defaultValue={outcome?.sourceNotes || ''}
        />
      </label>
      <div className="moe-actions">
        <button type="button" onClick={onCancel} className="moe-cancel">Annuler</button>
        <button type="submit" className="moe-submit">Enregistrer</button>
      </div>
      <style jsx>{formStyles}</style>
    </>
  );
}

const styles = `
  .moe {
    margin-bottom: 28px;
    padding: 20px 22px;
    background: var(--surface);
    border: 1px solid var(--hairline);
    border-radius: 10px;
  }
  .moe-loading, .moe-error {
    padding: 16px;
    color: var(--muted);
    font-style: italic;
    font-size: 13px;
  }
  .moe-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .moe-title {
    font-family: var(--serif);
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }
  .moe-link {
    background: none;
    border: none;
    color: var(--accent);
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }
  .moe-link:hover { text-decoration: underline; }
  .moe-empty {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.6;
    font-style: italic;
    margin: 0;
  }
  .moe-card {}
  .moe-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .moe-badge {
    color: white;
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .moe-date, .moe-source {
    font-size: 12px;
    color: var(--muted);
  }
  .moe-desc {
    margin: 6px 0 8px 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
  }
  .moe-link-out {
    display: inline-block;
    margin-top: 4px;
    font-size: 12px;
    color: var(--accent);
    text-decoration: none;
  }
  .moe-link-out:hover { text-decoration: underline; }
  .moe-notes {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--hairline);
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink);
  }
  .moe-form {
    padding: 14px;
    background: var(--paper);
    border: 1px solid var(--hairline);
    border-radius: 8px;
  }
`;

const formStyles = `
  .moe-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  @media (max-width: 600px) {
    .moe-form-row { grid-template-columns: 1fr; }
  }
  .moe-label {
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
  .moe-label input,
  .moe-label select,
  .moe-label textarea {
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
  .moe-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--hairline);
  }
  .moe-cancel {
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
  .moe-submit {
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
`;
