'use client';

// ============================================================
// RECENT ANALYSES - dossiers recents sur l accueil
// ------------------------------------------------------------
// Affiche les quatre derniers dossiers analyses du fonds, sous le
// hero depot. Donne au partner une accroche de continuite : il
// peut reprendre un dossier en cours d instruction au lieu de
// recommencer a zero a chaque session.
//
// Lecture seule, GET /api/analyses/list?limit=4. Si la persistence
// est desactivee ou si l utilisateur n a aucun dossier, le composant
// ne rend rien (etat vide propre, pas de placeholder bruyant). Chaque
// carte pointe sur /dossiers/[id], l URL canonique de Phase 3.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RecentAnalysis {
  id: string;
  companyName: string;
  sector: string | null;
  verdict: string;
  globalScore: number | null;
  createdAt: string;
}

const VERDICT_LABELS: Record<string, string> = {
  investir: 'Investir',
  'investir-conditions': 'Investir avec conditions',
  approfondir: 'Approfondir',
  refuser: 'Refuser',
};

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 60) return `il y a ${Math.max(1, diffMin)} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `il y a ${diffD}j`;
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

export default function RecentAnalyses() {
  const [analyses, setAnalyses] = useState<RecentAnalysis[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analyses/list?limit=4')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.enabled) return;
        const list = Array.isArray(data.analyses) ? data.analyses : [];
        setAnalyses(list.slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setAnalyses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (analyses === null) return null;
  if (analyses.length === 0) return null;

  return (
    <section className="recents" aria-labelledby="recents-title">
      <div className="recents-head">
        <div className="recents-kicker">
          <span className="recents-kicker-dot" aria-hidden="true" />
          <span>Dossiers recents</span>
        </div>
        <h2 id="recents-title" className="recents-title">Reprendre un dossier</h2>
        <Link href="/history" className="recents-link" prefetch={false}>
          Voir l historique complet →
        </Link>
      </div>
      <div className="recents-grid">
        {analyses.map((a) => (
          <Link
            key={a.id}
            href={`/dossiers/${a.id}`}
            className="recents-card"
            prefetch={false}
          >
            <div className="recents-card-meta">
              {a.sector && <span className="recents-card-sector">{a.sector}</span>}
              <span className="recents-card-date">{formatRelative(a.createdAt)}</span>
            </div>
            <h3 className="recents-card-name">{a.companyName}</h3>
            <div className="recents-card-foot">
              {a.globalScore != null && (
                <span className="recents-card-score">{a.globalScore}<span>/100</span></span>
              )}
              <span className={`recents-card-verdict verdict-${a.verdict}`}>
                {VERDICT_LABELS[a.verdict] || a.verdict}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
