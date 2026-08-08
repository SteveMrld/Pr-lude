'use client';

// ============================================================
// RECENT ANALYSES - dossiers recents sur l accueil
// ------------------------------------------------------------
// Les derniers dossiers du fonds, sous le hero depot, pour qu un
// partner reprenne une instruction au lieu de recommencer a zero.
//
// C ETAIT UNE GRILLE DE QUATRE CARTES AEREES, ET CE N EST PLUS UNE
// GRILLE. Un fonds regarde trente dossiers et non trois : les cartes
// occupaient la hauteur d une page pour quatre dossiers, et aucune ne
// portait l etat du run ni la reserve de fiabilite, c est-a-dire les
// deux choses qui disent si un dossier demande quelque chose. La ligne
// vit desormais dans DossierLigne, partagee avec l historique, parce
// que deux surfaces qui rendent le meme objet chacune a sa facon
// divergent, et que les deux avaient diverge.
//
// Lecture seule. Si la persistence est desactivee ou si l utilisateur
// n a aucun dossier, le composant ne rend rien : un etat vide propre
// plutot qu un placeholder bruyant.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DossierLigne from './DossierLigne';

interface RecentAnalysis {
  id: string;
  companyName: string;
  sector: string | null;
  country: string | null;
  verdict: string;
  globalScore: number | null;
  createdAt: string;
  status: string | null;
  failedEnginesCount: number | null;
  reserves: { total: number; majeures: number } | null;
  sourceFilename: string | null;
}

/**
 * Six lignes et non quatre cartes.
 *
 * Un fonds regarde trente dossiers et non trois, donc la densite vaut
 * mieux que l espace : quatre cartes aerees occupaient la hauteur d une
 * page pour quatre dossiers dont aucun ne portait son etat. Six lignes
 * tiennent dans le tiers de cette hauteur, portent l etat, la reserve et
 * le score, et laissent la place au reste de l accueil.
 */
const LIGNES_ACCUEIL = 6;

// LA TABLE DE LIBELLES ET LA CLASSE CSS VIVAIENT ICI, ET LES DEUX
// DIVERGEAIENT DU PRODUCTEUR. La table connaissait `investir-
// conditions`, orthographe qu aucun moteur n ecrit, si bien que les
// douze dossiers portant `investir avec conditions` s affichaient avec
// leur chaine brute, en minuscules. Et la classe se fabriquait en
// interpolant le verdict, donc une valeur a espaces se decoupait en
// plusieurs classes dont la premiere pouvait en atteindre une qui
// existe : releve du style calcule sur la page vivante, `investir avec
// conditions` et `investir` rendaient la meme encre et le meme fond.
// Un oui conditionnel se peignait comme un oui franc.
//
// Les deux descendent maintenant de `lib/note/vocabulaire-dossier`.

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
    fetch(`/api/analyses/list?limit=${LIGNES_ACCUEIL}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.enabled) return;
        const list = Array.isArray(data.analyses) ? data.analyses : [];
        setAnalyses(list.slice(0, LIGNES_ACCUEIL));
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
      <div className="recents-liste">
        {analyses.map((a, i) => (
          <DossierLigne
            key={a.id}
            id={a.id}
            companyName={a.companyName}
            verdict={a.verdict}
            globalScore={a.globalScore}
            status={a.status}
            failedEnginesCount={a.failedEnginesCount}
            reserves={a.reserves}
            sector={a.sector}
            country={a.country}
            createdAtLabel={formatRelative(a.createdAt)}
            sourceFilename={a.sourceFilename}
            derniere={i === analyses.length - 1}
          />
        ))}
      </div>
      {/* LE COMPTE DES DOSSIERS SANS RELEVE SE DIT UNE FOIS, ICI. Le
          bulletin de fiabilite n existe que sur les runs recents, et la
          ligne se tait quand il manque plutot que de repeter un aveu que
          personne ne lirait. Le taire partout ferait lire ce silence
          comme une absence de reserve ; il se dit donc au pied de la
          liste, une seule fois, et il descend des donnees plutot que
          d etre une phrase ecrite a la main. */}
      {analyses.some((a) => !a.reserves) && (
        <p className="recents-note">
          Reserve de fiabilite relevee sur {analyses.filter((a) => a.reserves).length} de ces{' '}
          {analyses.length} dossiers. Les autres sont anterieurs au releve, et leur silence ne dit
          pas qu ils sont sans reserve.
        </p>
      )}
    </section>
  );
}
