'use client';

// ============================================================
// CommentsPanel
// ------------------------------------------------------------
// Volet lateral de commentaires partages entre membres du fonds.
// S ouvre depuis un bouton "Commentaires" dans le header de l analyse.
// Permet de commenter par section UI (synthese, equipe, marche...),
// de resoudre les commentaires sans les effacer, et de voir
// l historique de la discussion sur le dossier.
//
// Distinct du AnnotationBlock existant : celui-la est mono-utilisateur,
// stocke en colonne user_notes sur la table analyses, sert a la prise
// de notes personnelles du partner. Le CommentsPanel est multi-membres,
// stocke dans analyses_annotations, sert au dialogue d instruction
// dans le fonds.
// ============================================================

import React, { useEffect, useState, useRef, useCallback } from 'react';

const SECTION_LABELS: Record<string, string> = {
  synthesis: 'Synthèse',
  dimensions: 'Dimensions',
  team: 'Équipe',
  verified: 'Faits vérifiés',
  market: 'Marché',
  macro: 'Macro',
  financial: 'Financier',
  pattern: 'Pattern matching',
  aveuglement: 'Vigilance critique',
  singularite: 'Singularités',
  blindspots: 'Vigilance critique et singularités',
  risksplan: 'Risques et plan',
  refchecks: 'Reference checks',
  instruction: 'À instruire',
  'ic-pack': 'Pack IC',
  general: 'Général',
};

type Annotation = {
  id: string;
  sectionId: string;
  body: string;
  createdAt: string;
  createdBy: string;
  resolvedAt: string | null;
};

type Props = {
  analysisId: string;
  authEnabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
};

function formatRelative(iso: string): string {
  if (!iso) return '';
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return 'à l’instant';
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `il y a ${diffD}j`;
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function shortUserId(uuid: string | null): string {
  if (!uuid) return '—';
  return uuid.slice(0, 8);
}

export default function CommentsPanel({
  analysisId,
  authEnabled,
  isOpen,
  onClose,
  currentUserEmail,
}: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftSection, setDraftSection] = useState('general');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!analysisId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showResolved) params.set('includeResolved', 'true');
      const res = await fetch(`/api/analyses/${analysisId}/annotations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.annotations || []);
      }
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, [analysisId, showResolved]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const submit = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyses/${analysisId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: draftSection,
          body: draft.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Échec envoi');
      }
      const data = await res.json();
      if (data.annotation) {
        setAnnotations((prev) => [...prev, data.annotation]);
      }
      setDraft('');
    } catch (err: any) {
      setError(err?.message || 'Erreur');
    } finally {
      setPosting(false);
    }
  };

  const resolve = async (annotationId: string) => {
    try {
      const res = await fetch(`/api/analyses/${analysisId}/annotations/${annotationId}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === annotationId
              ? { ...a, resolvedAt: new Date().toISOString() }
              : a,
          ),
        );
      }
    } catch {
      // silencieux
    }
  };

  if (!isOpen) return null;

  const visible = showResolved ? annotations : annotations.filter((a) => !a.resolvedAt);
  const openCount = annotations.filter((a) => !a.resolvedAt).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 100%)',
          background: 'var(--paper)',
          borderLeft: '1px solid var(--hairline)',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--sans)',
        }}
      >
        <div style={{
          padding: '20px 24px 14px',
          borderBottom: '1px solid var(--hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: 4,
              fontWeight: 500,
            }}>
              Commentaires d&apos;instruction
            </div>
            <div style={{
              fontFamily: 'var(--serif)',
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--ink)',
            }}>
              {openCount} {openCount === 1 ? 'commentaire ouvert' : 'commentaires ouverts'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--hairline-soft, var(--hairline))',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 11,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            Afficher les commentaires résolus
          </label>
        </div>

        {/* Liste */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 24px',
        }}>
          {loading && (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '20px 0' }}>
              Chargement...
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div style={{
              fontSize: 13,
              color: 'var(--muted)',
              padding: '24px 0',
              lineHeight: 1.55,
            }}>
              Aucun commentaire pour ce dossier. Démarrez la discussion en ajoutant
              une remarque ci-dessous, optionnellement rattachée à une section
              précise de l&apos;analyse.
            </div>
          )}
          {visible.map((a) => {
            const sectionLabel = SECTION_LABELS[a.sectionId] || a.sectionId;
            const isResolved = !!a.resolvedAt;
            return (
              <div
                key={a.id}
                style={{
                  marginBottom: 14,
                  padding: '12px 14px',
                  background: isResolved ? 'rgba(0,0,0,0.02)' : 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  opacity: isResolved ? 0.65 : 1,
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 6,
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--ocre-brule, #7a5c1f)',
                    fontWeight: 500,
                    padding: '1px 6px',
                    background: 'rgba(122,92,31,0.08)',
                  }}>
                    {sectionLabel}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {formatRelative(a.createdAt)}
                  </span>
                </div>
                <div style={{
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: 'var(--ink)',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 8,
                }}>
                  {a.body}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 10,
                  color: 'var(--muted)',
                }}>
                  <span>Par {shortUserId(a.createdBy)}</span>
                  {!isResolved && authEnabled && (
                    <button
                      onClick={() => resolve(a.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--hairline)',
                        padding: '3px 8px',
                        fontSize: 10,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'var(--vert-foret, #1f7a3c)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Marquer résolu
                    </button>
                  )}
                  {isResolved && (
                    <span style={{ color: 'var(--vert-foret, #1f7a3c)' }}>
                      Résolu {formatRelative(a.resolvedAt!)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        {authEnabled ? (
          <div style={{
            borderTop: '1px solid var(--hairline)',
            padding: '14px 24px 18px',
            background: 'var(--surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                fontWeight: 500,
              }}>
                Section
              </span>
              <select
                value={draftSection}
                onChange={(e) => setDraftSection(e.target.value)}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  border: '1px solid var(--hairline)',
                  background: 'var(--paper)',
                  fontFamily: 'inherit',
                  color: 'var(--ink)',
                }}
              >
                {Object.entries(SECTION_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Votre remarque, question ou contre-argument..."
              rows={3}
              style={{
                width: '100%',
                fontSize: 13,
                padding: '10px 12px',
                border: '1px solid var(--hairline)',
                background: 'var(--paper)',
                fontFamily: 'inherit',
                color: 'var(--ink)',
                resize: 'vertical',
                marginBottom: 8,
                lineHeight: 1.5,
              }}
            />
            {error && (
              <div style={{ fontSize: 11, color: 'var(--rouge-anglais)', marginBottom: 8 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={submit}
                disabled={!draft.trim() || posting}
                style={{
                  padding: '7px 16px',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: draft.trim() && !posting ? 'var(--ink)' : 'var(--muted-soft, #cccccc)',
                  color: 'var(--paper)',
                  border: 'none',
                  cursor: draft.trim() && !posting ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                }}
              >
                {posting ? 'Envoi...' : 'Publier'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            borderTop: '1px solid var(--hairline)',
            padding: '14px 24px',
            background: 'var(--surface)',
            fontSize: 12,
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}>
            Les commentaires partagés nécessitent un compte fonds. Activez l&apos;auth
            pour permettre aux membres de votre fonds de commenter et résoudre.
          </div>
        )}
      </aside>
    </>
  );
}
