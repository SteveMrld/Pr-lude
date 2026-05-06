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

import { useEffect, useState, useCallback, useRef } from 'react';
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
  deposited: { bg: 'var(--hairline-soft)',     fg: 'var(--muted)',       border: 'var(--hairline)' },
  in_review: { bg: 'var(--ocre-brule-soft)',   fg: 'var(--ocre-brule)',  border: 'var(--ocre-brule)' },
  dd_field:  { bg: 'var(--accent-soft)',       fg: 'var(--accent)',      border: 'var(--accent)' },
  ic_review: { bg: 'var(--violet-rare-soft)',  fg: 'var(--violet-rare)', border: 'var(--violet-rare)' },
  signed:    { bg: 'var(--vert-foret-soft)',   fg: 'var(--vert-foret)',  border: 'var(--vert-foret)' },
  declined:  { bg: 'var(--warn-soft)',         fg: 'var(--warn)',        border: 'var(--warn)' },
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
            Persistance désactivée
          </div>
          <p style={{ marginBottom: 12 }}>
            La sauvegarde des analyses n&apos;est pas encore activée sur cette
            instance. Pour l&apos;activer, l&apos;administrateur doit :
          </p>
          <ol style={{ paddingLeft: 20, marginBottom: 12 }}>
            <li>Exécuter le script <code>supabase-persistence-schema.sql</code> dans le SQL Editor de Supabase</li>
            <li>Définir <code>ENABLE_PERSISTENCE=true</code> dans les variables d&apos;environnement Vercel</li>
            <li>Redéployer l&apos;application</li>
          </ol>
          <p style={{ opacity: 0.7 }}>
            En attendant, le pipeline d&apos;analyse reste pleinement fonctionnel.
            Les analyses ne sont simplement pas conservées entre sessions.
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 18,
            fontWeight: 600,
            fontFamily: 'var(--sans)',
          }}>
            <span style={{
              width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', display: 'inline-block',
            }} />
            <span>Vue de fonds · Historique</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(32px, 4.5vw, 44px)',
            fontWeight: 700,
            margin: 0,
            letterSpacing: '-0.022em',
            lineHeight: 1.05,
            color: 'var(--ink)',
          }}>
            Historique des analyses
          </h1>
        </div>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--paper)',
            background: 'var(--ink)',
            textDecoration: 'none',
            padding: '12px 22px',
            borderRadius: 8,
            border: '1px solid var(--ink)',
            transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: 'var(--sans)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(30, 58, 138, 0.20)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--ink)';
            e.currentTarget.style.borderColor = 'var(--ink)';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Nouvelle analyse →
        </Link>
      </div>

      {stats && stats.total > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14, marginBottom: 24,
        }}>
          <StatBox label="Total" value={stats.total} />
          <StatBox label="Investir" value={stats.byVerdict.investir || 0} accent="var(--vert-foret)" />
          <StatBox label="Conditions" value={stats.byVerdict['investir-conditions'] || 0} accent="var(--accent)" />
          <StatBox label="Approfondir" value={stats.byVerdict.approfondir || 0} accent="var(--ocre-brule)" />
          <StatBox label="Refuser" value={stats.byVerdict.refuser || 0} accent="var(--warn)" />
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
                  padding: '7px 14px',
                  fontSize: 10.5,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  background: isActive ? colors.fg : colors.bg,
                  color: isActive ? 'var(--paper)' : colors.fg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: count === 0 && !isActive ? 0.4 : 1,
                  transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {STAGE_LABELS[stage]}
                <span style={{ fontSize: 10.5, fontWeight: 700, opacity: isActive ? 0.95 : 0.85 }}>{count}</span>
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
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
        padding: 18,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 12,
      }}>
        <input
          type="text"
          placeholder="Rechercher une societe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 220px',
            padding: '10px 14px',
            fontSize: 13.5,
            border: '1px solid var(--hairline)',
            background: 'var(--paper)',
            color: 'var(--ink)',
            fontFamily: 'var(--serif)',
            borderRadius: 8,
            outline: 'none',
            transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--hairline)'; }}
        />
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            fontSize: 13.5,
            border: '1px solid var(--hairline)',
            background: 'var(--paper)',
            color: 'var(--ink)',
            fontFamily: 'var(--serif)',
            borderRadius: 8,
            cursor: 'pointer',
            outline: 'none',
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
        <div style={{
          padding: 60,
          textAlign: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
        }}>Chargement...</div>
      ) : analyses.length === 0 ? (
        <div style={{
          padding: 60,
          textAlign: 'center',
          background: 'var(--surface)',
          border: '2px dashed var(--hairline)',
          borderRadius: 12,
          fontSize: 15,
          color: 'var(--muted)',
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
        }}>
          {searchQuery || verdictFilter || stageFilter
            ? 'Aucune analyse ne correspond aux filtres.'
            : 'Aucune analyse sauvegardee pour le moment. Lance une analyse depuis l accueil.'}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        }}>
          {analyses.map((a, i) => (
            <AnalysisRow
              key={a.id}
              analysis={a}
              isLast={i === analyses.length - 1}
              onDelete={() => handleDelete(a.id, a.companyName)}
              onStageChanged={load}
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
      padding: '20px 22px 18px',
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
      borderRadius: 12,
      transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--muted-soft)';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.05)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--hairline)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'none';
    }}
    >
      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        marginBottom: 10,
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--serif)',
        fontSize: 32,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        color: accent || 'var(--accent)',
        fontFeatureSettings: '"lnum","tnum"',
      }}>
        {value}{suffix && <span style={{ fontSize: 16, opacity: 0.5, marginLeft: 2, fontWeight: 500 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function AnalysisRow({ analysis, isLast, onDelete, onStageChanged }: {
  analysis: AnalysisSummary;
  isLast: boolean;
  onDelete: () => void;
  onStageChanged: () => void;
}) {
  const date = new Date(analysis.createdAt);
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const verdictColors: Record<string, { bg: string; fg: string; border: string }> = {
    investir:               { bg: 'var(--vert-foret-soft)',  fg: 'var(--vert-foret)',  border: 'var(--vert-foret)' },
    'investir-conditions':  { bg: 'var(--accent-soft)',      fg: 'var(--accent)',      border: 'var(--accent)' },
    approfondir:            { bg: 'var(--ocre-brule-soft)',  fg: 'var(--ocre-brule)',  border: 'var(--ocre-brule)' },
    refuser:                { bg: 'var(--warn-soft)',        fg: 'var(--warn)',        border: 'var(--warn)' },
  };
  const verdictStyle = verdictColors[analysis.verdict] || { bg: 'var(--hairline-soft)', fg: 'var(--muted)', border: 'var(--hairline)' };

  const stage = analysis.workflowStage || 'in_review';

  return (
    <div
      style={{
        padding: '18px 22px',
        borderBottom: isLast ? 'none' : '1px solid var(--hairline-soft)',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr auto 1fr auto',
        gap: 14,
        alignItems: 'center',
        transition: 'background 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-accent)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16.5, fontWeight: 700, letterSpacing: '-0.005em', color: 'var(--ink)' }}>
            {analysis.companyName}
          </div>
          {analysis.versionsCount > 1 && (
            <span style={{
              fontFamily: 'var(--sans)',
              fontSize: 9.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              background: 'var(--hairline-soft)',
              color: 'var(--muted)',
              border: '1px solid var(--hairline)',
              borderRadius: 999,
              fontWeight: 600,
            }}>
              v{analysis.versionsCount}
            </span>
          )}
          {analysis.openCommentsCount > 0 && (
            <span
              title={`${analysis.openCommentsCount} commentaire${analysis.openCommentsCount > 1 ? 's' : ''} non resolu${analysis.openCommentsCount > 1 ? 's' : ''}`}
              style={{
                fontSize: 9.5,
                letterSpacing: '0.06em',
                padding: '3px 8px',
                background: 'var(--ocre-brule-soft)',
                color: 'var(--ocre-brule)',
                border: '1px solid var(--ocre-brule)',
                borderRadius: 999,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: 'var(--sans)',
              }}
            >
              ✎ {analysis.openCommentsCount}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--sans)', letterSpacing: '0.02em' }}>
          {[analysis.sector, analysis.country, analysis.yearFounded].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div>
        <span style={{
          padding: '5px 12px',
          fontSize: 10,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontWeight: 700,
          background: verdictStyle.bg,
          color: verdictStyle.fg,
          border: `1px solid ${verdictStyle.border}`,
          borderRadius: 999,
          fontFamily: 'var(--sans)',
          display: 'inline-block',
        }}>
          {analysis.verdict}
        </span>
      </div>
      <div>
        <InlineStageEditor
          analysisId={analysis.id}
          currentStage={stage}
          onChanged={onStageChanged}
        />
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
      <div style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--sans)' }}>
        {analysis.globalScore != null && (
          <div style={{ fontFamily: 'var(--sans)' }}>
            Score : <strong style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--serif)', fontSize: 14 }}>{Math.round(analysis.globalScore)}/100</strong>
          </div>
        )}
        {analysis.blindspotScore != null && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Vigilance : <strong style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>{Math.round(analysis.blindspotScore)}</strong>
          </div>
        )}
        <div style={{
          fontSize: 10.5,
          color: 'var(--muted-soft)',
          marginTop: 4,
          letterSpacing: '0.04em',
          fontFamily: 'var(--sans)',
        }}>{dateStr}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link
          href={`/?analysis=${analysis.id}`}
          style={{
            padding: '7px 14px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
            border: '1px solid var(--hairline)',
            background: 'var(--surface)',
            textDecoration: 'none',
            borderRadius: 8,
            fontFamily: 'var(--sans)',
            transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
            e.currentTarget.style.color = 'var(--paper)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--ink)';
            e.currentTarget.style.borderColor = 'var(--hairline)';
          }}
        >
          Ouvrir
        </Link>
        <button
          onClick={onDelete}
          aria-label="Supprimer l analyse"
          style={{
            padding: '7px 11px',
            fontSize: 14,
            color: 'var(--muted)',
            border: '1px solid var(--hairline)',
            background: 'var(--surface)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            borderRadius: 8,
            lineHeight: 1,
            transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--warn-soft)';
            e.currentTarget.style.color = 'var(--warn)';
            e.currentTarget.style.borderColor = 'var(--warn)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--muted)';
            e.currentTarget.style.borderColor = 'var(--hairline)';
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ============================================================
// InlineStageEditor
// ------------------------------------------------------------
// Badge de stade workflow cliquable, qui ouvre un menu pour faire
// passer le dossier d un stade a un autre sans avoir a quitter
// la liste de fonds. Au clic sur une option, on PATCH la route
// /api/analyses/[id]/status (qui poste aussi la notif Slack en
// best effort) et on appelle onChanged() pour que le parent
// rafraichisse la liste avec le nouveau stade.
//
// Outside-click ferme le menu. Loading state pendant le PATCH
// avec opacite reduite et texte Mise a jour.
// ============================================================
function InlineStageEditor({
  analysisId,
  currentStage,
  onChanged,
}: {
  analysisId: string;
  currentStage: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Outside click pour fermer le menu
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const colors = STAGE_COLORS[currentStage] || STAGE_COLORS.in_review;
  const label = STAGE_LABELS[currentStage] || currentStage;

  const handleSelect = async (newStage: string) => {
    if (newStage === currentStage) {
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
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setOpen(false);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Erreur');
    } finally {
      setUpdating(false);
    }
  };

  const stageOptions = ['deposited', 'in_review', 'dd_field', 'ic_review', 'signed', 'declined'];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        disabled={updating}
        style={{
          padding: '4px 10px',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 500,
          background: colors.bg,
          color: colors.fg,
          border: `1px solid ${colors.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          cursor: updating ? 'wait' : 'pointer',
          opacity: updating ? 0.6 : 1,
          fontFamily: 'inherit',
        }}
        title="Cliquer pour changer le stade d&apos;instruction"
      >
        <span style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: colors.fg,
          display: 'inline-block',
        }} />
        {updating ? 'Mise a jour...' : label}
        <span style={{ fontSize: 8, opacity: 0.7, marginLeft: 2 }}>▾</span>
      </button>

      {open && !updating && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 50,
          background: 'var(--paper, #faf6ed)',
          border: '1px solid var(--hairline)',
          minWidth: 160,
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        }}>
          {stageOptions.map((opt) => {
            const optColors = STAGE_COLORS[opt];
            const isCurrent = opt === currentStage;
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  background: isCurrent ? optColors.bg : 'transparent',
                  color: optColors.fg,
                  border: 'none',
                  borderBottom: '1px solid var(--hairline)',
                  cursor: 'pointer',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: optColors.fg,
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                {STAGE_LABELS[opt]}
                {isCurrent && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>actuel</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          fontSize: 10,
          color: 'var(--warn)',
          padding: '4px 8px',
          background: 'var(--warn-soft)',
          border: '1px solid var(--warn)',
          borderRadius: 6,
          whiteSpace: 'nowrap',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
