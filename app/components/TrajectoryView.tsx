// ============================================================
// TrajectoryView - Onglet Trajectoire du dashboard analytique
// ------------------------------------------------------------
// Affiche l evolution d un dossier sur N analyses successives :
// resume global (tendance, score delta), comparison entre la
// premiere et la derniere analyse, transitions successives,
// combinaisons apparues / resolues / persistantes, top alertes.
//
// Fetch : GET /api/analyses/{id}/trajectory au montage.
// La couche persistence est geree cote API. Le composant est
// purement presentationnel.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import type {
  TrajectoryComparison,
  TrajectorySnapshot,
  TrajectorySummary,
} from '@/lib/engines/trajectory';
import SectionFallbackLine from './SectionFallbackLine';

interface TrajectoryViewProps {
  analysisId: string;
  /** Rendu fige pour export PDF : jamais de spinner, ligne neutre a la place. */
  printMode?: boolean;
}

const VERDICT_BG: Record<string, { bg: string; ink: string; label: string }> = {
  'amelioration': { bg: '#e8f1de', ink: '#3f4a2b', label: 'Amélioration' },
  'aggravation': { bg: '#dcc3a3', ink: '#7a2916', label: 'Aggravation' },
  'stabilisation': { bg: '#ede2c8', ink: '#7a5a1d', label: 'Stabilisation' },
  'volatilite': { bg: '#e8d4b1', ink: '#8a4a17', label: 'Volatilité (signaux contradictoires)' },
};

export function TrajectoryView({ analysisId, printMode = false }: TrajectoryViewProps) {
  const [summary, setSummary] = useState<TrajectorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/analyses/${analysisId}/trajectory`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSummary(data.summary ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [analysisId]);

  // Rendu fige (printMode / export PDF) : jamais de spinner ni de
  // message d erreur brut. Ligne neutre trajectoire a la place, quel
  // que soit l etat interne. Doctrine "aucun etat non resolu au
  // rendu fige" partagee avec les cinq autres composants async.
  if (printMode && (loading || error)) {
    return <SectionFallbackLine kind="trajectory" marginTop={12} marginBottom={12} />;
  }
  if (loading) {
    return (
      <div className="tv-loading" style={{ padding: '28px 32px', fontSize: 13, opacity: 0.65 }}>
        Chargement de la trajectoire du dossier...
      </div>
    );
  }

  if (error) {
    return (
      <div className="tv-error" style={{ padding: '28px 32px' }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
          Trajectoire
        </h3>
        <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ocre-brule, #a04040)', fontSize: 13 }}>
          Lecture indisponible : {error}.
        </div>
      </div>
    );
  }

  if (!summary || summary.totalAnalyses === 0) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
          Trajectoire
        </h3>
        <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)', fontSize: 13 }}>
          Aucune analyse persistée pour ce dossier.
        </div>
      </div>
    );
  }

  if (summary.totalAnalyses === 1) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
          Trajectoire
        </h3>
        <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)', fontSize: 13, lineHeight: 1.55 }}>
          Une seule analyse au dossier. La trajectoire devient calculable
          à partir de la deuxième analyse. Relancer le pipeline sur le
          dossier (deck v2 ou actualisation) pour générer une seconde version
          et observer l&apos;évolution.
        </div>
      </div>
    );
  }

  // 2+ analyses : on a une comparison globale
  const overall = summary.overallComparison!;
  const tendance = summary.tendanceGlobale!;
  const tone = VERDICT_BG[tendance];

  return (
    <div style={{ padding: '28px 32px' }}>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 16 }}>
        Trajectoire du dossier
      </h3>

      {/* Bandeau verdict global */}
      <div style={{ marginBottom: 24, padding: '16px 20px', background: tone.bg, borderLeft: `3px solid ${tone.ink}` }}>
        <div style={{ display: 'flex', gap: 32, alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: tone.ink }}>Tendance globale </span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6, color: tone.ink }}>{tone.label}</span>
          </div>
          <div>
            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: tone.ink }}>Période </span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6, color: tone.ink }}>{summary.totalDays} j</span>
          </div>
          <div>
            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: tone.ink }}>Analyses </span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6, color: tone.ink }}>{summary.totalAnalyses}</span>
          </div>
          <div>
            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: tone.ink }}>Score </span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6, color: tone.ink }}>
              {overall.before.globalScore} → {overall.after.globalScore}
              <span style={{ fontSize: 14, opacity: 0.75, marginLeft: 6 }}>
                ({overall.globalScoreDelta.delta >= 0 ? '+' : ''}{overall.globalScoreDelta.delta})
              </span>
            </span>
          </div>
        </div>
        <p style={{ fontSize: 13, margin: 0, fontStyle: 'italic', color: tone.ink, opacity: 0.9, lineHeight: 1.55 }}>
          {overall.syntheseTrajectoire}
        </p>
      </div>

      {/* Top alertes */}
      {overall.topAlertesTrajectoire.length > 0 && (
        <div style={{ marginBottom: 24, padding: 16, borderLeft: '3px solid var(--ocre-brule, #8a4a17)', background: 'rgba(138, 74, 23, 0.06)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 10, color: 'var(--ocre-brule, #8a4a17)', fontWeight: 600 }}>
            Top alertes de trajectoire
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
            {overall.topAlertesTrajectoire.map((a, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Combinaisons */}
      {(overall.combinaisonsApparues.length > 0 || overall.combinaisonsResolues.length > 0 || overall.combinaisonsPersistantes.length > 0) && (
        <div style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {overall.combinaisonsApparues.length > 0 && (
            <div style={{ padding: 14, border: '1px solid var(--hairline)', borderLeft: '3px solid #7a2916' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8, fontWeight: 600 }}>Apparues</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                {overall.combinaisonsApparues.map((c, i) => (
                  <li key={i}>
                    <strong style={{ fontWeight: 500 }}>{c.nom}</strong>
                    <span style={{ opacity: 0.7, marginLeft: 6, fontSize: 11, textTransform: 'uppercase' }}>{c.severite.replace('-', ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {overall.combinaisonsResolues.length > 0 && (
            <div style={{ padding: 14, border: '1px solid var(--hairline)', borderLeft: '3px solid #3f4a2b' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8, fontWeight: 600 }}>Résolues</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                {overall.combinaisonsResolues.map((c, i) => (
                  <li key={i}>
                    <strong style={{ fontWeight: 500 }}>{c.nom}</strong>
                    <span style={{ opacity: 0.7, marginLeft: 6, fontSize: 11, textTransform: 'uppercase' }}>{c.severite.replace('-', ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {overall.combinaisonsPersistantes.length > 0 && (
            <div style={{ padding: 14, border: '1px solid var(--hairline)', borderLeft: '3px solid #7a5a1d' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8, fontWeight: 600 }}>Persistantes</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                {overall.combinaisonsPersistantes.map((c, i) => (
                  <li key={i}>
                    <strong style={{ fontWeight: 500 }}>{c.nom}</strong>
                    <span style={{ opacity: 0.7, marginLeft: 6, fontSize: 11, textTransform: 'uppercase' }}>{c.severite.replace('-', ' ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Transitions successives */}
      {summary.successiveComparisons.length > 1 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 12 }}>
            Transitions successives ({summary.successiveComparisons.length})
          </div>
          {summary.successiveComparisons.map((c, i) => (
            <TransitionCard key={i} comparison={c} index={i} />
          ))}
        </div>
      )}

      {/* Snapshots de reference */}
      <div style={{ marginTop: 24, fontSize: 12, opacity: 0.6 }}>
        Première analyse : {new Date(summary.firstSnapshot!.analyzedAt).toLocaleString('fr-FR')} ·
        Dernière : {new Date(summary.lastSnapshot!.analyzedAt).toLocaleString('fr-FR')}
      </div>
    </div>
  );
}

function TransitionCard({ comparison: c, index }: { comparison: TrajectoryComparison; index: number }) {
  const tone = VERDICT_BG[c.trajectoireGlobale];
  return (
    <div style={{ marginBottom: 14, padding: 14, border: '1px solid var(--hairline)', borderLeft: `3px solid ${tone.ink}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
          Transition #{index + 1}
        </div>
        <div style={{ fontSize: 11, color: tone.ink, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {tone.label}
        </div>
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        {new Date(c.before.analyzedAt).toLocaleDateString('fr-FR')} → {new Date(c.after.analyzedAt).toLocaleDateString('fr-FR')}
        <span style={{ marginLeft: 8 }}>· {c.daysBetween} j ·</span>
        <span style={{ marginLeft: 8 }}>
          Score {c.before.globalScore} → {c.after.globalScore} ({c.globalScoreDelta.delta >= 0 ? '+' : ''}{c.globalScoreDelta.delta})
        </span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>{c.syntheseTrajectoire}</p>
    </div>
  );
}
