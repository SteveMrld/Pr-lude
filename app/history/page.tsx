// ============================================================
// Page /history - Vue de fonds des analyses
// ------------------------------------------------------------
// Liste les analyses sauvegardees avec, pour chaque dossier :
//   - badge de stade workflow (depose, en instruction, DD terrain,
//     IC, signe, refuse) avec date relative de transition
//   - compteurs de versions et de commentaires non resolus
//   - filtres par verdict, par stade, recherche texte
//   - stats de fonds en haut (verdicts, score moyen, total)
//
// L objectif est de donner immediatement a un partner ou un membre
// du fonds une vue de pilotage : ou en sont mes 23 dossiers, lequel
// attend un retour, lequel est pret pour le comite.
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface AnalysisSummary {
  id: string;
  companyName: string;
  sector: string | null;
  subSector: string | null;
  country: string | null;
  yearFounded: number | null;
  roundType: string | null;
  roundAmountEur: number | null;
  verdict: string;
  globalScore: number | null;
  blindspotScore: number | null;
  contrarianScore: number | null;
  coherenceScore: number | null;
  createdAt: string;
  workflowStage: string | null;
  workflowStageUpdatedAt: string | null;
  versionsCount: number;
  openCommentsCount: number;
}

interface Stats {
  total: number;
  byVerdict: Record<string, number>;
  avgGlobalScore: number | null;
  avgBlindspotScore: number | null;
  lastAnalysisAt: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  deposited: 'Depose',
  in_review: 'En instruction',
  dd_field: 'DD terrain',
  ic_review: 'Pret pour IC',
  signed: 'Signe',
  declined: 'Refuse',
};

const STAGE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  deposited: { bg: 'rgba(120,120,120,0.08)', fg: '#5a5a5a', border: 'rgba(120,120,120,0.3)' },
  in_review: { bg: 'rgba(122,92,31,0.10)', fg: '#7a5c1f', border: 'rgba(122,92,31,0.35)' },
  dd_field: { bg: 'rgba(31,90,122,0.10)', fg: '#1f5a7a', border: 'rgba(31,90,122,0.35)' },
  ic_review: { bg: 'rgba(90,31,122,0.10)', fg: '#5a1f7a', border: 'rgba(90,31,122,0.35)' },
  signed: { bg: 'rgba(31,122,60,0.12)', fg: '#1f7a3c', border: 'rgba(31,122,60,0.40)' },
  declined: { bg: 'rgba(122,31,31,0.10)', fg: '#7a1f1f', border: 'rgba(122,31,31,0.35)' },
};

function formatRelative(iso: string): string {
  if (!iso) return '';
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return 'a l instant';
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

export default function HistoryPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (verdictFilter) params.set('verdict', verdictFilter);
      if (stageFilter) params.set('workflow_stage', stageFilter);
      if (searchQuery) params.set('q', searchQuery);
      const res = await fetch(`/api/analyses/list?${params.toString()}`);
      const data = await res.json();
      setEnabled(data.enabled);
      setAnalyses(data.analyses || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Erreur chargement historique :', err);
    } finally {
      setLoading(false);
    }
  }, [verdictFilter, stageFilter, searchQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer definitivement l analyse de ${name} ?`)) return;
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        load();
      } else {
        alert('Suppression echouee');
      }
    } catch {
      alert('Erreur reseau');
    }
  };

  // Repartition par stade workflow pour les pastilles
  const stageBreakdown = analyses.reduce((acc, a) => {
    const stage = a.workflowStage || 'in_review';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (enabled === false) {
    return (
      <main style={{ padding: '40px 32px', maxWidth: 980, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, marginBottom: 16 }}>
          Historique des analyses
        </h1>
        <div style={{
          padding: 24, background: 'var(--surface-deep, var(--surface))', border: '1px solid var(--hairline)',
          fontSize: 14, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
            Persistence desactivee
          </div>
          <p style={{ marginBottom: 12 }}>
            La sauvegarde des analyses n est pas encore activee sur cette
            instance. Pour l activer, l administrateur doit :
          </p>
          <ol style={{ paddingLeft: 20, marginBottom: 12 }}>
            <li>Executer le script <code>supabase-persistence-schema.sql</code> dans le SQL Editor de Supabase</li>
            <li>Definir <code>ENABLE_PERSISTENCE=true</code> dans les variables d environnement Vercel</li>
            <li>Redeployer l application</li>
          </ol>
          <p style={{ opacity: 0.7 }}>
            En attendant, le pipeline d analyse reste pleinement fonctionnel.
            Les analyses ne sont simplement pas conservees entre sessions.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '32px 24px 80px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 6,
            fontWeight: 500,
          }}>
            Vue de fonds
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
            Historique des analyses
          </h1>
        </div>
        <Link href="/" style={{
          fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--ink)', textDecoration: 'none',
          padding: '8px 16px', border: '1px solid var(--ink)',
        }}>
          Nouvelle analyse →
        </Link>
      </div>

      {stats && stats.total > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, marginBottom: 16,
        }}>
          <StatBox label="Total" value={stats.total} />
          <StatBox label="Investir" value={stats.byVerdict.investir || 0} accent="#2d4a2d" />
          <StatBox label="Conditions" value={stats.byVerdict['investir-conditions'] || 0} accent="#5d4216" />
          <StatBox label="Approfondir" value={stats.byVerdict.approfondir || 0} accent="#a8732e" />
          <StatBox label="Refuser" value={stats.byVerdict.refuser || 0} accent="#8b2e1f" />
          {stats.avgGlobalScore != null && (
            <StatBox label="Score moyen" value={Math.round(stats.avgGlobalScore)} suffix="/100" />
          )}
        </div>
      )}

      {/* Repartition par stade workflow : pastilles cliquables filtre */}
      {!loading && analyses.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            fontWeight: 500,
            marginRight: 4,
          }}>
            Stades
          </span>
          {(['in_review', 'dd_field', 'ic_review', 'signed', 'declined'] as const).map((stage) => {
            const count = stageBreakdown[stage] || 0;
            const colors = STAGE_COLORS[stage];
            const isActive = stageFilter === stage;
            return (
              <button
                key={stage}
                onClick={() => setStageFilter(isActive ? '' : stage)}
                style={{
                  padding: '5px 11px',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                  background: isActive ? colors.fg : colors.bg,
                  color: isActive ? 'var(--paper)' : colors.fg,
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: count === 0 && !isActive ? 0.4 : 1,
                }}
              >
                {STAGE_LABELS[stage]}
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>{count}</span>
              </button>
            );
          })}
          {stageFilter && (
            <button
              onClick={() => setStageFilter('')}
              style={{
                padding: '5px 9px',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: 'transparent',
                color: 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Effacer
            </button>
          )}
        </div>
      )}

      <div style={{
        display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap',
        padding: 14, background: 'var(--surface)', border: '1px solid var(--hairline)',
      }}>
        <input
          type="text"
          placeholder="Rechercher une societe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 220px', padding: '8px 12px', fontSize: 13,
            border: '1px solid var(--hairline)', background: 'var(--paper)',
            color: 'var(--ink)', fontFamily: 'inherit',
          }}
        />
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          style={{
            padding: '8px 12px', fontSize: 13,
            border: '1px solid var(--hairline)', background: 'var(--paper)',
            color: 'var(--ink)', fontFamily: 'inherit',
          }}
        >
          <option value="">Tous verdicts</option>
          <option value="investir">Investir</option>
          <option value="investir-conditions">Investir avec conditions</option>
          <option value="approfondir">Approfondir</option>
          <option value="refuser">Refuser</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>Chargement...</div>
      ) : analyses.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', background: 'var(--surface)',
          border: '1px dashed var(--hairline)', fontSize: 14, opacity: 0.7,
        }}>
          {searchQuery || verdictFilter || stageFilter
            ? 'Aucune analyse ne correspond aux filtres.'
            : 'Aucune analyse sauvegardee pour le moment. Lance une analyse depuis l accueil.'}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)' }}>
          {analyses.map((a, i) => (
            <AnalysisRow
              key={a.id}
              analysis={a}
              isLast={i === analyses.length - 1}
              onDelete={() => handleDelete(a.id, a.companyName)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function StatBox({ label, value, suffix, accent }: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: string;
}) {
  return (
    <div style={{
      padding: 12, background: 'var(--surface)', border: '1px solid var(--hairline)',
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--muted)', marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500,
        color: accent || 'var(--ink)',
      }}>
        {value}{suffix}
      </div>
    </div>
  );
}

function AnalysisRow({ analysis, isLast, onDelete }: {
  analysis: AnalysisSummary;
  isLast: boolean;
  onDelete: () => void;
}) {
  const date = new Date(analysis.createdAt);
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const verdictColors: Record<string, { bg: string; fg: string }> = {
    investir: { bg: '#cfe5cf', fg: '#2d4a2d' },
    'investir-conditions': { bg: '#f3e3c8', fg: '#5d4216' },
    approfondir: { bg: '#f3e3c8', fg: '#a8732e' },
    refuser: { bg: '#f4dccf', fg: '#8b2e1f' },
  };
  const verdictStyle = verdictColors[analysis.verdict] || { bg: '#e8e3d6', fg: '#555049' };

  const stage = analysis.workflowStage || 'in_review';
  const stageColor = STAGE_COLORS[stage] || STAGE_COLORS.in_review;
  const stageLabel = STAGE_LABELS[stage] || stage;

  return (
    <div style={{
      padding: '16px 18px', borderBottom: isLast ? 'none' : '1px solid var(--hairline)',
      display: 'grid', gridTemplateColumns: '2fr 1fr auto 1fr auto', gap: 14,
      alignItems: 'center',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>
            {analysis.companyName}
          </div>
          {analysis.versionsCount > 1 && (
            <span style={{
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '2px 6px',
              background: 'rgba(0,0,0,0.04)',
              color: 'var(--muted)',
              border: '1px solid var(--hairline)',
              fontWeight: 500,
            }}>
              v{analysis.versionsCount}
            </span>
          )}
          {analysis.openCommentsCount > 0 && (
            <span
              title={`${analysis.openCommentsCount} commentaire${analysis.openCommentsCount > 1 ? 's' : ''} non resolu${analysis.openCommentsCount > 1 ? 's' : ''}`}
              style={{
                fontSize: 9,
                letterSpacing: '0.06em',
                padding: '2px 6px',
                background: 'rgba(122,92,31,0.10)',
                color: '#7a5c1f',
                border: '1px solid rgba(122,92,31,0.35)',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              ✎ {analysis.openCommentsCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {[analysis.sector, analysis.country, analysis.yearFounded].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div>
        <span style={{
          padding: '4px 10px', fontSize: 10, letterSpacing: '0.08em',
          textTransform: 'uppercase', fontWeight: 600,
          background: verdictStyle.bg, color: verdictStyle.fg,
        }}>
          {analysis.verdict}
        </span>
      </div>
      <div>
        <div style={{
          padding: '4px 10px',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 500,
          background: stageColor.bg,
          color: stageColor.fg,
          border: `1px solid ${stageColor.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: stageColor.fg,
            display: 'inline-block',
          }} />
          {stageLabel}
        </div>
        {analysis.workflowStageUpdatedAt && (
          <div style={{
            fontSize: 9,
            color: 'var(--muted)',
            marginTop: 3,
            letterSpacing: 0,
            textTransform: 'none',
          }}>
            {formatRelative(analysis.workflowStageUpdatedAt)}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {analysis.globalScore != null && (
          <div>Score : <strong style={{ color: 'var(--ink)' }}>{Math.round(analysis.globalScore)}/100</strong></div>
        )}
        {analysis.blindspotScore != null && (
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            Aveuglement : {Math.round(analysis.blindspotScore)}
          </div>
        )}
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{dateStr}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Link
          href={`/?analysis=${analysis.id}`}
          style={{
            padding: '6px 10px', fontSize: 11, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--ink)',
            border: '1px solid var(--ink)', textDecoration: 'none',
          }}
        >
          Ouvrir
        </Link>
        <button
          onClick={onDelete}
          style={{
            padding: '6px 10px', fontSize: 11, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--rouge-anglais, #7a1f1f)',
            border: '1px solid var(--hairline)', background: 'transparent',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
