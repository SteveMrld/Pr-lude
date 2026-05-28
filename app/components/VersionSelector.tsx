'use client';

// ============================================================
// VersionSelector
// ------------------------------------------------------------
// Dropdown qui liste les versions d une analyse et permet de basculer
// vers une version anterieure (consultation read-only). Place dans
// le header du dashboard a cote du badge workflow.
//
// N apparait que si le dossier a au moins 2 versions, sinon inutile.
// La derniere version (la plus recente) est consideree comme la version
// "live" : elle correspond au resultJson stocke en colonne sur analyses.
// Les versions anterieures sont chargees a la demande depuis
// analyses_versions.
//
// Le composant ne gere pas lui-meme l affichage de la version : il
// expose un callback onVersionChange(snapshotJson) qui laisse le
// parent (HomeClient) re-rendre l app avec la donnee historique.
// ============================================================

import React, { useEffect, useState, useRef } from 'react';

type VersionMeta = {
  id: string;
  versionNum: number;
  sourceFilename: string | null;
  pipelineDurationMs: number | null;
  createdAt: string;
  note: string | null;
};

type Props = {
  analysisId: string;
  currentVersionNum: number | null;
  onVersionChange: (snapshotJson: any | null, versionNum: number | null) => void;
};

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function VersionSelector({
  analysisId,
  currentVersionNum,
  onVersionChange,
}: Props) {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analyses/${analysisId}/versions`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setVersions(data?.versions || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

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

  // Pas de dropdown si 0 ou 1 version (rien a comparer)
  if (loading) return null;
  if (versions.length < 2) return null;

  const latestVersion = versions[0]?.versionNum;
  const isOnLatest = currentVersionNum === null || currentVersionNum === latestVersion;
  const displayedVersion = currentVersionNum ?? latestVersion;

  const switchTo = async (versionNum: number) => {
    setSwitching(true);
    try {
      // Si l utilisateur revient a la version la plus recente, on signale
      // au parent par null pour qu il restaure le resultJson live.
      if (versionNum === latestVersion) {
        onVersionChange(null, null);
        setOpen(false);
        return;
      }
      const res = await fetch(`/api/analyses/${analysisId}/versions/${versionNum}`);
      if (!res.ok) throw new Error('échec chargement version');
      const data = await res.json();
      if (data?.version?.snapshotJson) {
        onVersionChange(data.version.snapshotJson, versionNum);
        setOpen(false);
      }
    } catch (err) {
      console.error('switch version error:', err);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        title="Naviguer entre les versions de cette analyse"
        style={{
          padding: '6px 12px',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 500,
          background: isOnLatest ? 'transparent' : 'rgba(122,92,31,0.10)',
          color: isOnLatest ? 'var(--ink)' : '#7a5c1f',
          border: `1px solid ${isOnLatest ? 'var(--hairline)' : 'rgba(122,92,31,0.35)'}`,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>Version v{displayedVersion}</span>
        {!isOnLatest && (
          <span style={{ fontSize: 9, opacity: 0.85 }}>· historique</span>
        )}
        <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▴' : '▾'}</span>
      </button>

      {!isOnLatest && (
        <button
          type="button"
          onClick={() => switchTo(latestVersion)}
          style={{
            marginLeft: 6,
            padding: '6px 10px',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: 'transparent',
            color: 'var(--vert-foret, #1f7a3c)',
            border: '1px solid rgba(31,122,60,0.35)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ↺ Revenir à v{latestVersion}
        </button>
      )}

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          minWidth: 260,
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 50,
          padding: '6px 0',
        }}>
          <div style={{
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            padding: '8px 14px 4px',
            fontWeight: 500,
          }}>
            {versions.length} versions
          </div>
          {versions.map((v) => {
            const isLatest = v.versionNum === latestVersion;
            const isCurrent = v.versionNum === displayedVersion;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => switchTo(v.versionNum)}
                disabled={switching || isCurrent}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  width: '100%',
                  padding: '8px 14px',
                  background: isCurrent ? 'rgba(0,0,0,0.04)' : 'transparent',
                  border: 'none',
                  borderTop: '1px solid var(--hairline-soft, transparent)',
                  cursor: isCurrent ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  color: 'var(--ink)',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  width: '100%',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontWeight: 500 }}>
                    v{v.versionNum}
                    {isLatest && (
                      <span style={{
                        marginLeft: 8,
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--vert-foret, #1f7a3c)',
                        fontWeight: 500,
                      }}>
                        actuelle
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {formatDate(v.createdAt)}
                  </span>
                </div>
                {(v.sourceFilename || v.note) && (
                  <div style={{
                    fontSize: 10,
                    color: 'var(--muted)',
                    lineHeight: 1.4,
                  }}>
                    {v.sourceFilename}
                    {v.sourceFilename && v.note ? ' · ' : ''}
                    {v.note}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
