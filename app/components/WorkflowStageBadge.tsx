'use client';

// ============================================================
// WorkflowStageBadge
// ------------------------------------------------------------
// Dropdown de changement de stade d instruction d un dossier.
// Place dans le header du dashboard analytique, a cote du nom
// de la societe et du verdict.
//
// Etats supportes : depose, en instruction, DD terrain, IC, signe, refuse.
// Affiche "qui a change le stade et quand" en sous-titre.
//
// Side-effect-free quand authEnabled=false : affiche le stage actuel
// en lecture seule, sans dropdown ouvrable. Le mode solo n a pas
// de notion de transition entre membres du fonds.
// ============================================================

import React, { useEffect, useState, useRef } from 'react';

const STAGE_LABELS: Record<string, string> = {
  deposited: 'Déposé',
  in_review: 'En instruction',
  dd_field: 'DD terrain',
  ic_review: 'Prêt pour IC',
  signed: 'Signé',
  declined: 'Refusé',
};

// Palette identite : muted gris, ocre mi-ton, ocre porteur, encre, vert, rouge.
// La progression visuelle va du sobre vers le decisif : gris (entree) ->
// ocre clair (lecture) -> ocre fort (DD) -> encre (pret IC) -> vert (signe).
const STAGE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  deposited: { bg: 'var(--hairline-soft)',     fg: 'var(--muted)',       border: 'var(--hairline)' },
  in_review: { bg: 'var(--paper-warm)',        fg: 'var(--accent-mid)',  border: 'var(--accent-mid)' },
  dd_field:  { bg: 'var(--accent-soft)',       fg: 'var(--accent)',      border: 'var(--accent)' },
  ic_review: { bg: 'var(--paper-accent)',      fg: 'var(--ink)',         border: 'var(--ink)' },
  signed:    { bg: 'var(--vert-foret-soft)',   fg: 'var(--vert-foret)',  border: 'var(--vert-foret)' },
  declined:  { bg: 'var(--warn-soft)',         fg: 'var(--warn)',        border: 'var(--warn)' },
};

const STAGE_ORDER = ['deposited', 'in_review', 'dd_field', 'ic_review', 'signed', 'declined'];

type Props = {
  analysisId: string;
  authEnabled: boolean;
};

type StatusData = {
  stage: string;
  updatedAt: string;
  updatedBy: string | null;
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

export default function WorkflowStageBadge({ analysisId, authEnabled }: Props) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Charger le stage actuel
  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analyses/${analysisId}/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.status) {
          setStatus({
            stage: data.status.stage,
            updatedAt: data.status.updatedAt,
            updatedBy: data.status.updatedBy,
          });
        }
      })
      .catch(() => {
        // Silencieux : si pas de persistance, on n affiche rien
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  // Fermer le dropdown si clic en dehors
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const changeStage = async (newStage: string) => {
    if (!authEnabled) return;
    if (newStage === status?.stage) {
      setOpen(false);
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyses/${analysisId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Échec du changement de stade');
      }
      const data = await res.json().catch(() => ({}));
      setStatus({
        stage: newStage,
        updatedAt: new Date().toISOString(),
        updatedBy: status?.updatedBy ?? null,
      });
      // Signale a la section OutcomeTracking de la note qu une decision
      // vient d etre auto-creee : elle refetch et affiche sa banniere
      // "decision deduite, precisez les conditions".
      if (data?.outcomeAutoCreated && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('prelude:outcome-auto-created', {
          detail: { analysisId, stage: newStage },
        }));
      }
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Erreur');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return null;
  if (!status) return null; // Pas de persistance ou analyse non sauvegardee

  const colors = STAGE_COLORS[status.stage] || STAGE_COLORS.in_review;
  const label = STAGE_LABELS[status.stage] || status.stage;
  const canEdit = authEnabled;

  return (
    <div
      ref={dropdownRef}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        onClick={() => canEdit && setOpen(!open)}
        disabled={!canEdit || updating}
        title={canEdit ? 'Cliquez pour changer le stade' : 'Le changement de stade nécessite un compte fonds'}
        style={{
          padding: '6px 14px',
          fontSize: 10.5,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontWeight: 600,
          background: colors.bg,
          color: colors.fg,
          border: `1px solid ${colors.border}`,
          borderRadius: 999,
          cursor: canEdit ? 'pointer' : 'default',
          fontFamily: 'var(--sans)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          opacity: updating ? 0.6 : 1,
          transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: colors.fg,
          display: 'inline-block',
        }} />
        <span>{label}</span>
        {canEdit && (
          <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>
            {open ? '▴' : '▾'}
          </span>
        )}
      </button>

      {status.updatedAt && (
        <div style={{
          fontSize: 10,
          color: 'var(--muted)',
          marginTop: 4,
          letterSpacing: 0,
          textTransform: 'none',
        }}>
          {formatRelative(status.updatedAt)}
        </div>
      )}

      {open && canEdit && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          minWidth: 200,
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 50,
          padding: '4px 0',
        }}>
          <div style={{
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            padding: '8px 14px 4px',
            fontWeight: 500,
          }}>
            Changer le stade
          </div>
          {STAGE_ORDER.map((stage) => {
            const c = STAGE_COLORS[stage];
            const isCurrent = stage === status.stage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => changeStage(stage)}
                disabled={updating || isCurrent}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 14px',
                  background: isCurrent ? 'rgba(0,0,0,0.04)' : 'transparent',
                  border: 'none',
                  cursor: isCurrent ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  color: 'var(--ink)',
                  textAlign: 'left',
                  opacity: isCurrent ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) (e.target as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) (e.target as HTMLElement).style.background = 'transparent';
                }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: c.fg,
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <span>{STAGE_LABELS[stage]}</span>
                {isCurrent && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>actuel</span>
                )}
              </button>
            );
          })}
          {error && (
            <div style={{
              padding: '8px 14px',
              fontSize: 11,
              color: 'var(--warn)',
              borderTop: '1px solid var(--hairline)',
              background: 'var(--warn-soft)',
            }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
