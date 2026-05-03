// ============================================================
// Page /history - Liste des analyses passees
// ------------------------------------------------------------
// Affiche les analyses sauvegardees avec filtres, recherche
// et bouton de restoration. Style coherent avec le journal
// d instruction (palette papier creme, encre noire, bleu encre).
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
}

interface Stats {
  total: number;
  byVerdict: Record<string, number>;
  avgGlobalScore: number | null;
  avgBlindspotScore: number | null;
  lastAnalysisAt: string | null;
}

export default function HistoryPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (verdictFilter) params.set('verdict', verdictFilter);
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
  }, [verdictFilter, searchQuery]);

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

  // Persistence desactivee : message clair
  if (enabled === false) {
    return (
      <main style={{ padding: '40px 32px', maxWidth: 980, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, marginBottom: 16 }}>
          Historique des analyses
        </h1>
        <div style={{
          padding: 24, background: 'var(--surface-deep)', border: '1px solid var(--hairline)',
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
    <main style={{ padding: '32px 24px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, margin: 0 }}>
          Historique des analyses
        </h1>
        <Link href="/" style={{
          fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--ink)', textDecoration: 'none',
          padding: '8px 16px', border: '1px solid var(--ink)',
        }}>
          Nouvelle analyse →
        </Link>
      </div>

      {/* Stats compactes */}
      {stats && stats.total > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12, marginBottom: 24,
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

      {/* Barre de filtres */}
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

      {/* Tableau */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>Chargement...</div>
      ) : analyses.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', background: 'var(--surface)',
          border: '1px dashed var(--hairline)', fontSize: 14, opacity: 0.7,
        }}>
          {searchQuery || verdictFilter
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

  return (
    <div style={{
      padding: '16px 18px', borderBottom: isLast ? 'none' : '1px solid var(--hairline)',
      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 14,
      alignItems: 'center',
    }}>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, marginBottom: 2 }}>
          {analysis.companyName}
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
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {analysis.globalScore != null && (
          <div>Score : <strong style={{ color: 'var(--ink)' }}>{Math.round(analysis.globalScore)}/100</strong></div>
        )}
        {analysis.blindspotScore != null && (
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            Aveuglement : {Math.round(analysis.blindspotScore)}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{dateStr}</div>
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
            textTransform: 'uppercase', color: 'var(--rouge-anglais)',
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
