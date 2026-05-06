'use client';

// ============================================================
// REFERENCE CALL NOTES PANEL
// ------------------------------------------------------------
// Permet aux membres editeurs d un fonds de saisir leurs notes
// d appels de reference une fois les calls passes, et d obtenir
// une synthese agregee par LLM (signaux convergents, divergences,
// red flags confirmes, conviction emergente).
//
// L UI est volontairement compacte et mobile-friendly : un toggle
// pour la saisie d une nouvelle note, une liste depliable des
// notes existantes, et un panneau synthese qui se met a jour a
// chaque ajout.
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ----- Types alignes avec lib/reference-call-notes-store ----

type CallCategory =
  | 'founder_superior'
  | 'founder_peer'
  | 'founder_subordinate'
  | 'customer'
  | 'board_advisor'
  | 'weak_signal'
  | 'other';

const CALL_CATEGORY_LABELS: Record<CallCategory, string> = {
  founder_superior: 'Ancien superieur du fondateur',
  founder_peer: 'Ancien pair du fondateur',
  founder_subordinate: 'Ancien subordonne du fondateur',
  customer: 'Client / utilisateur cle',
  board_advisor: 'Board / advisor',
  weak_signal: 'Verification signal faible',
  other: 'Autre interlocuteur',
};

const CATEGORY_ORDER: CallCategory[] = [
  'founder_superior',
  'founder_peer',
  'founder_subordinate',
  'customer',
  'board_advisor',
  'weak_signal',
  'other',
];

type OverallTone =
  | 'tres_positif'
  | 'positif'
  | 'mitige'
  | 'negatif'
  | 'tres_negatif'
  | 'non_concluant';

const OVERALL_TONE_LABELS: Record<OverallTone, string> = {
  tres_positif: 'Tres positif',
  positif: 'Positif',
  mitige: 'Mitige',
  negatif: 'Negatif',
  tres_negatif: 'Tres negatif',
  non_concluant: 'Non concluant',
};

interface ReferenceCallNote {
  id: string;
  analysisId: string;
  authorId: string;
  authorEmail: string | null;
  callCategory: CallCategory;
  contactName: string;
  contactRole: string | null;
  contactCompany: string | null;
  relatedSubject: string | null;
  callDate: string | null;
  durationMinutes: number | null;
  rawNotes: string;
  overallTone: OverallTone | null;
  ratingCompetence: number | null;
  ratingIntegrity: number | null;
  ratingLeadership: number | null;
  ratingWouldWorkAgain: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AggregatedSignal {
  theme: string;
  polarity: 'positif' | 'negatif' | 'mitige';
  convergence: number;
  summary: string;
  evidence: string[];
  implication: string;
}

interface ReferenceAggregationOutput {
  executiveSummary: string;
  convergentSignals: AggregatedSignal[];
  divergences: { theme: string; positions: string[]; interpretation: string }[];
  confirmedRedFlags: { flag: string; sources: string[]; severity: 'mineure' | 'moderee' | 'critique' }[];
  remainingGaps: string[];
  emergentConviction: {
    level: 'forte_positive' | 'plutot_positive' | 'partagee' | 'plutot_negative' | 'forte_negative' | 'insuffisante';
    rationale: string;
  };
}

const CONVICTION_LABELS: Record<ReferenceAggregationOutput['emergentConviction']['level'], string> = {
  forte_positive: 'Conviction positive forte',
  plutot_positive: 'Conviction plutot positive',
  partagee: 'Conviction partagee',
  plutot_negative: 'Conviction plutot negative',
  forte_negative: 'Conviction negative forte',
  insuffisante: 'Conviction insuffisante (pas assez de notes)',
};

const CONVICTION_TONE_CLASS: Record<ReferenceAggregationOutput['emergentConviction']['level'], string> = {
  forte_positive: 'ref-conviction-strong-pos',
  plutot_positive: 'ref-conviction-soft-pos',
  partagee: 'ref-conviction-mixed',
  plutot_negative: 'ref-conviction-soft-neg',
  forte_negative: 'ref-conviction-strong-neg',
  insuffisante: 'ref-conviction-mixed',
};

// ----- Composant principal -----

export interface ReferenceCallNotesPanelProps {
  analysisId: string;
  /** Si false, le composant n affiche que la lecture (pas le formulaire). */
  canEdit: boolean;
  /** Plan d appels genere en amont (pour aider la saisie : suggestions). */
  plan?: {
    founderChecks?: any[];
    customerChecks?: any[];
    boardChecks?: any[];
  };
}

export default function ReferenceCallNotesPanel({
  analysisId,
  canEdit,
  plan,
}: ReferenceCallNotesPanelProps) {
  const [notes, setNotes] = useState<ReferenceCallNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [aggregation, setAggregation] = useState<ReferenceAggregationOutput | null>(null);
  const [aggregationLoading, setAggregationLoading] = useState(false);
  const [aggregationGeneratedAt, setAggregationGeneratedAt] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/analyses/${analysisId}/reference-call-notes`);
      const j = await r.json();
      if (j?.notes) setNotes(j.notes);
    } catch (err) {
      console.error('[ReferenceCallNotes] fetch notes failed:', err);
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  const fetchAggregation = useCallback(async (force = false) => {
    setAggregationLoading(true);
    try {
      const r = await fetch(`/api/analyses/${analysisId}/reference-aggregation`, {
        method: force ? 'POST' : 'GET',
      });
      const j = await r.json();
      if (j?.aggregation) {
        setAggregation(j.aggregation);
        setAggregationGeneratedAt(j.generatedAt || null);
      }
    } catch (err) {
      console.error('[ReferenceCallNotes] fetch aggregation failed:', err);
    } finally {
      setAggregationLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Chargement initial de l agregation seulement si on a au moins 1 note.
  useEffect(() => {
    if (notes.length > 0 && !aggregation) {
      fetchAggregation(false);
    }
  }, [notes.length, aggregation, fetchAggregation]);

  const groupedNotes = useMemo(() => {
    const map = new Map<CallCategory, ReferenceCallNote[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const n of notes) {
      const arr = map.get(n.callCategory) || [];
      arr.push(n);
      map.set(n.callCategory, arr);
    }
    return map;
  }, [notes]);

  const handleSubmit = async (formData: NoteFormData) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const isEdit = editingId !== null;
      const url = isEdit
        ? `/api/analyses/${analysisId}/reference-call-notes/${editingId}`
        : `/api/analyses/${analysisId}/reference-call-notes`;
      const method = isEdit ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const j = await r.json();
      if (!r.ok || j?.error) {
        setErrorMsg(j?.error || 'Echec sauvegarde');
        return;
      }
      setShowForm(false);
      setEditingId(null);
      await fetchNotes();
      // Invalider la synthese affichee : on attend que le user
      // clique sur "Mettre a jour la synthese" pour rejouer le LLM.
      setAggregation(null);
      setAggregationGeneratedAt(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur reseau');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Supprimer cette note ?')) return;
    try {
      const r = await fetch(`/api/analyses/${analysisId}/reference-call-notes/${noteId}`, {
        method: 'DELETE',
      });
      if (r.ok) {
        await fetchNotes();
        setAggregation(null);
        setAggregationGeneratedAt(null);
      }
    } catch (err) {
      console.error('[ReferenceCallNotes] delete failed:', err);
    }
  };

  const editingNote = editingId ? notes.find(n => n.id === editingId) : null;

  return (
    <div className="ref-calls-panel">
      <div className="ref-calls-header">
        <div>
          <h3 className="ref-calls-title">Notes des appels de reference</h3>
          <p className="ref-calls-subtitle">
            {notes.length === 0
              ? 'Aucune note saisie. Apres chaque call, ajoute-la ici pour alimenter la synthese.'
              : `${notes.length} note${notes.length > 1 ? 's' : ''} saisie${notes.length > 1 ? 's' : ''}.`}
          </p>
        </div>
        {canEdit && !showForm && (
          <button
            type="button"
            className="ref-calls-btn-primary"
            onClick={() => { setShowForm(true); setEditingId(null); }}
          >
            + Ajouter un appel
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <NoteForm
          initial={editingNote}
          submitting={submitting}
          errorMsg={errorMsg}
          plan={plan}
          onCancel={() => { setShowForm(false); setEditingId(null); setErrorMsg(null); }}
          onSubmit={handleSubmit}
        />
      )}

      {/* Synthese aggregee */}
      {notes.length > 0 && (
        <div className="ref-calls-synthesis">
          <div className="ref-calls-synthesis-head">
            <h4 className="ref-calls-synthesis-title">Synthese DD reference</h4>
            <button
              type="button"
              className="ref-calls-btn-ghost"
              disabled={aggregationLoading}
              onClick={() => fetchAggregation(true)}
            >
              {aggregationLoading
                ? 'Generation en cours...'
                : aggregation
                  ? 'Mettre a jour la synthese'
                  : 'Generer la synthese'}
            </button>
          </div>
          {aggregation && (
            <AggregationView
              aggregation={aggregation}
              generatedAt={aggregationGeneratedAt}
              notesCount={notes.length}
            />
          )}
          {!aggregation && !aggregationLoading && (
            <p className="ref-calls-synthesis-empty">
              {notes.length < 3
                ? `Saisis au moins 2-3 notes supplementaires pour activer une synthese pertinente.`
                : `Clique sur "Generer la synthese" pour obtenir l agregation des notes.`}
            </p>
          )}
        </div>
      )}

      {/* Liste des notes */}
      {!loading && notes.length > 0 && (
        <div className="ref-calls-list">
          {Array.from(groupedNotes.entries())
            .filter(([, arr]) => arr.length > 0)
            .map(([cat, arr]) => (
              <div key={cat} className="ref-calls-group">
                <h5 className="ref-calls-group-title">
                  {CALL_CATEGORY_LABELS[cat]}
                  <span className="ref-calls-group-count"> · {arr.length}</span>
                </h5>
                <div className="ref-calls-group-items">
                  {arr.map(n => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      canEdit={canEdit}
                      onEdit={() => { setEditingId(n.id); setShowForm(true); }}
                      onDelete={() => handleDelete(n.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {loading && <p className="ref-calls-loading">Chargement des notes...</p>}
    </div>
  );
}

// ----- Sous-composants -----

interface NoteFormData {
  callCategory: CallCategory;
  contactName: string;
  contactRole?: string | null;
  contactCompany?: string | null;
  relatedSubject?: string | null;
  callDate?: string | null;
  durationMinutes?: number | null;
  rawNotes: string;
  overallTone?: OverallTone | null;
  ratingCompetence?: number | null;
  ratingIntegrity?: number | null;
  ratingLeadership?: number | null;
  ratingWouldWorkAgain?: number | null;
}

function NoteForm({
  initial,
  submitting,
  errorMsg,
  plan: _plan,
  onCancel,
  onSubmit,
}: {
  initial: ReferenceCallNote | null | undefined;
  submitting: boolean;
  errorMsg: string | null;
  plan?: ReferenceCallNotesPanelProps['plan'];
  onCancel: () => void;
  onSubmit: (data: NoteFormData) => void;
}) {
  const [callCategory, setCallCategory] = useState<CallCategory>(initial?.callCategory || 'founder_superior');
  const [contactName, setContactName] = useState(initial?.contactName || '');
  const [contactRole, setContactRole] = useState(initial?.contactRole || '');
  const [contactCompany, setContactCompany] = useState(initial?.contactCompany || '');
  const [relatedSubject, setRelatedSubject] = useState(initial?.relatedSubject || '');
  const [callDate, setCallDate] = useState(initial?.callDate || '');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(initial?.durationMinutes || '');
  const [rawNotes, setRawNotes] = useState(initial?.rawNotes || '');
  const [overallTone, setOverallTone] = useState<OverallTone | ''>(initial?.overallTone || '');
  const [ratingCompetence, setRatingCompetence] = useState<number | ''>(initial?.ratingCompetence || '');
  const [ratingIntegrity, setRatingIntegrity] = useState<number | ''>(initial?.ratingIntegrity || '');
  const [ratingLeadership, setRatingLeadership] = useState<number | ''>(initial?.ratingLeadership || '');
  const [ratingWouldWorkAgain, setRatingWouldWorkAgain] = useState<number | ''>(initial?.ratingWouldWorkAgain || '');

  // Les ratings ne sont pertinents que pour les calls portant sur un fondateur.
  const isFounderCall =
    callCategory === 'founder_superior'
    || callCategory === 'founder_peer'
    || callCategory === 'founder_subordinate';

  const handleSubmit = () => {
    if (!contactName.trim() || !rawNotes.trim()) return;
    onSubmit({
      callCategory,
      contactName: contactName.trim(),
      contactRole: contactRole.trim() || null,
      contactCompany: contactCompany.trim() || null,
      relatedSubject: relatedSubject.trim() || null,
      callDate: callDate || null,
      durationMinutes: durationMinutes === '' ? null : Number(durationMinutes),
      rawNotes: rawNotes.trim(),
      overallTone: overallTone === '' ? null : overallTone,
      ratingCompetence: ratingCompetence === '' ? null : Number(ratingCompetence),
      ratingIntegrity: ratingIntegrity === '' ? null : Number(ratingIntegrity),
      ratingLeadership: ratingLeadership === '' ? null : Number(ratingLeadership),
      ratingWouldWorkAgain: ratingWouldWorkAgain === '' ? null : Number(ratingWouldWorkAgain),
    });
  };

  return (
    <div className="ref-calls-form">
      <h4 className="ref-calls-form-title">{initial ? 'Modifier la note' : 'Nouvel appel de reference'}</h4>

      <div className="ref-calls-form-grid">
        <label className="ref-calls-field">
          <span>Categorie d appel *</span>
          <select value={callCategory} onChange={e => setCallCategory(e.target.value as CallCategory)}>
            {CATEGORY_ORDER.map(cat => (
              <option key={cat} value={cat}>{CALL_CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </label>

        <label className="ref-calls-field">
          <span>Date du call</span>
          <input type="date" value={callDate} onChange={e => setCallDate(e.target.value)} />
        </label>

        <label className="ref-calls-field">
          <span>Nom de l interlocuteur *</span>
          <input
            type="text"
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            placeholder="Ex: Jane Doe"
          />
        </label>

        <label className="ref-calls-field">
          <span>Role / titre</span>
          <input
            type="text"
            value={contactRole}
            onChange={e => setContactRole(e.target.value)}
            placeholder="Ex: Head of Engineering"
          />
        </label>

        <label className="ref-calls-field">
          <span>Entreprise actuelle</span>
          <input
            type="text"
            value={contactCompany}
            onChange={e => setContactCompany(e.target.value)}
            placeholder="Ex: Stripe"
          />
        </label>

        <label className="ref-calls-field">
          <span>Concerne (qui ?)</span>
          <input
            type="text"
            value={relatedSubject}
            onChange={e => setRelatedSubject(e.target.value)}
            placeholder="Ex: nom du fondateur ou du client objet"
          />
        </label>

        <label className="ref-calls-field">
          <span>Duree (min)</span>
          <input
            type="number"
            min="1"
            max="240"
            value={durationMinutes}
            onChange={e => setDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="30"
          />
        </label>

        <label className="ref-calls-field">
          <span>Tonalite generale</span>
          <select value={overallTone} onChange={e => setOverallTone(e.target.value as OverallTone | '')}>
            <option value="">Non specifie</option>
            {Object.entries(OVERALL_TONE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      {isFounderCall && (
        <div className="ref-calls-ratings">
          <div className="ref-calls-ratings-label">Evaluations rapides du fondateur (1-5, optionnel)</div>
          <div className="ref-calls-ratings-grid">
            <RatingInput label="Competence" value={ratingCompetence} onChange={setRatingCompetence} />
            <RatingInput label="Integrite" value={ratingIntegrity} onChange={setRatingIntegrity} />
            <RatingInput label="Leadership" value={ratingLeadership} onChange={setRatingLeadership} />
            <RatingInput label="Travaillerais a nouveau" value={ratingWouldWorkAgain} onChange={setRatingWouldWorkAgain} />
          </div>
        </div>
      )}

      <label className="ref-calls-field-full">
        <span>Notes brutes du call * (au moins 200 caracteres conseille)</span>
        <textarea
          value={rawNotes}
          onChange={e => setRawNotes(e.target.value)}
          rows={8}
          placeholder="Ce que l interlocuteur a dit, le ton, les anecdotes precises, les nuances. Plus tu es factuel et detaille, plus la synthese aggregee sera pertinente."
        />
      </label>

      {errorMsg && <div className="ref-calls-error">Erreur : {errorMsg}</div>}

      <div className="ref-calls-form-actions">
        <button
          type="button"
          className="ref-calls-btn-ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Annuler
        </button>
        <button
          type="button"
          className="ref-calls-btn-primary"
          onClick={handleSubmit}
          disabled={submitting || !contactName.trim() || !rawNotes.trim()}
        >
          {submitting ? 'Sauvegarde...' : initial ? 'Mettre a jour' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}

function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | '';
  onChange: (v: number | '') => void;
}) {
  return (
    <label className="ref-calls-rating">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}>
        <option value="">-</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
    </label>
  );
}

function NoteCard({
  note,
  canEdit,
  onEdit,
  onDelete,
}: {
  note: ReferenceCallNote;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = note.callDate ? new Date(note.callDate).toLocaleDateString('fr-FR') : null;
  return (
    <div className="ref-calls-note">
      <div className="ref-calls-note-head" onClick={() => setExpanded(!expanded)}>
        <div className="ref-calls-note-title">
          <strong>{note.contactName}</strong>
          {note.contactRole && <span className="ref-calls-note-role"> · {note.contactRole}</span>}
          {note.contactCompany && <span className="ref-calls-note-company"> @ {note.contactCompany}</span>}
        </div>
        <div className="ref-calls-note-meta">
          {note.overallTone && <span className={`ref-calls-tone ref-calls-tone-${note.overallTone}`}>{OVERALL_TONE_LABELS[note.overallTone]}</span>}
          {date && <span className="ref-calls-note-date">{date}</span>}
          <span className="ref-calls-note-toggle">{expanded ? '−' : '+'}</span>
        </div>
      </div>
      {expanded && (
        <div className="ref-calls-note-body">
          {note.relatedSubject && (
            <p className="ref-calls-note-subject">Concerne : <em>{note.relatedSubject}</em></p>
          )}
          {(note.ratingCompetence || note.ratingIntegrity || note.ratingLeadership || note.ratingWouldWorkAgain) && (
            <div className="ref-calls-note-ratings">
              {note.ratingCompetence && <span>Competence {note.ratingCompetence}/5</span>}
              {note.ratingIntegrity && <span>Integrite {note.ratingIntegrity}/5</span>}
              {note.ratingLeadership && <span>Leadership {note.ratingLeadership}/5</span>}
              {note.ratingWouldWorkAgain && <span>Re-emploi {note.ratingWouldWorkAgain}/5</span>}
            </div>
          )}
          <div className="ref-calls-note-raw">
            {note.rawNotes.split(/\n+/).map((line, i) => <p key={i}>{line}</p>)}
          </div>
          {note.authorEmail && (
            <p className="ref-calls-note-author">
              Saisi par {note.authorEmail}
              {note.durationMinutes && ` · ${note.durationMinutes} min`}
            </p>
          )}
          {canEdit && (
            <div className="ref-calls-note-actions">
              <button type="button" className="ref-calls-btn-link" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                Modifier
              </button>
              <button type="button" className="ref-calls-btn-link ref-calls-btn-link-danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AggregationView({
  aggregation,
  generatedAt,
  notesCount,
}: {
  aggregation: ReferenceAggregationOutput;
  generatedAt: string | null;
  notesCount: number;
}) {
  const generatedAtFormatted = generatedAt ? new Date(generatedAt).toLocaleString('fr-FR') : null;
  const convictionClass = CONVICTION_TONE_CLASS[aggregation.emergentConviction.level];

  return (
    <div className="ref-calls-aggregation">
      <div className={`ref-calls-conviction ${convictionClass}`}>
        <div className="ref-calls-conviction-label">{CONVICTION_LABELS[aggregation.emergentConviction.level]}</div>
        <p className="ref-calls-conviction-rationale">{aggregation.emergentConviction.rationale}</p>
      </div>

      {aggregation.executiveSummary && (
        <div className="ref-calls-section">
          <h5 className="ref-calls-section-title">Synthese executive</h5>
          <p className="ref-calls-exec-summary">{aggregation.executiveSummary}</p>
        </div>
      )}

      {aggregation.convergentSignals?.length > 0 && (
        <div className="ref-calls-section">
          <h5 className="ref-calls-section-title">Signaux convergents</h5>
          <div className="ref-calls-signals">
            {aggregation.convergentSignals.map((s, i) => (
              <div key={i} className={`ref-calls-signal ref-calls-signal-${s.polarity}`}>
                <div className="ref-calls-signal-head">
                  <strong>{s.theme}</strong>
                  <span className="ref-calls-signal-conv">{s.convergence} interlocuteur{s.convergence > 1 ? 's' : ''} convergent{s.convergence > 1 ? 's' : ''}</span>
                </div>
                <p className="ref-calls-signal-summary">{s.summary}</p>
                {s.evidence?.length > 0 && (
                  <ul className="ref-calls-signal-evidence">
                    {s.evidence.map((e, j) => <li key={j}>« {e} »</li>)}
                  </ul>
                )}
                <p className="ref-calls-signal-impl"><em>Implication :</em> {s.implication}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {aggregation.divergences?.length > 0 && (
        <div className="ref-calls-section">
          <h5 className="ref-calls-section-title">Divergences entre interlocuteurs</h5>
          <div className="ref-calls-divergences">
            {aggregation.divergences.map((d, i) => (
              <div key={i} className="ref-calls-divergence">
                <strong>{d.theme}</strong>
                <ul>
                  {d.positions.map((p, j) => <li key={j}>{p}</li>)}
                </ul>
                <p className="ref-calls-divergence-interp"><em>Interpretation :</em> {d.interpretation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {aggregation.confirmedRedFlags?.length > 0 && (
        <div className="ref-calls-section">
          <h5 className="ref-calls-section-title">Red flags confirmes par 2+ sources</h5>
          <div className="ref-calls-redflags">
            {aggregation.confirmedRedFlags.map((rf, i) => (
              <div key={i} className={`ref-calls-redflag ref-calls-redflag-${rf.severity}`}>
                <div className="ref-calls-redflag-head">
                  <strong>{rf.flag}</strong>
                  <span className="ref-calls-redflag-severity">{rf.severity}</span>
                </div>
                <p className="ref-calls-redflag-sources">Sources : {rf.sources.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {aggregation.remainingGaps?.length > 0 && (
        <div className="ref-calls-section">
          <h5 className="ref-calls-section-title">Lacunes : appels a complementer</h5>
          <ul className="ref-calls-gaps">
            {aggregation.remainingGaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}

      {generatedAtFormatted && (
        <p className="ref-calls-aggregation-meta">
          Synthese generee le {generatedAtFormatted} a partir de {notesCount} note{notesCount > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );
}
