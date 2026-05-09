// ============================================================
// TrackSelector - Choix du parcours d analyse
// ------------------------------------------------------------
// Premier ecran de la plateforme apres authentification. Le
// partner choisit entre deux parcours :
//
//   - Early stage (seed, serie A) : pipeline historique de
//     Prelude, calibre sur les patterns d entree de cycle, lance
//     l ensemble des moteurs Bloc 1 plus Lecture du langage et
//     Pattern matching.
//
//   - Growth (serie B et au-dela) : parcours Phase 4, calibre
//     sur les patterns de fragilite structurelle, lance un
//     sous-ensemble des moteurs centre sur Fragilite structurelle,
//     Lecture du langage, Marche, Macro, Singularites
//     contrariennes et Financier. Skip les moteurs early stage
//     (Equipe early, Pattern matching early, Aveuglement early).
//
// Le choix est passe au reste de l app via un callback. Le state
// du track est gere par le parent (HomeClient) pour permettre un
// retour au selecteur via un bouton "changer de parcours".
// ============================================================

'use client';

import React from 'react';

export type AnalysisTrack = 'early' | 'growth';

interface TrackSelectorProps {
  onSelect: (track: AnalysisTrack) => void;
}

export function TrackSelector({ onSelect }: TrackSelectorProps) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, marginBottom: 12 }}>
          Quel dossier souhaitez-vous instruire ?
        </h2>
        <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6, maxWidth: 720, margin: '0 auto' }}>
          Prélude propose deux parcours d'instruction calibrés sur des stades
          de maturité distincts. Le choix du parcours détermine les moteurs
          d'analyse mobilisés et la structure de la note finale.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        <TrackCard
          label="Dossier early stage"
          subtitle="Seed · Série A"
          description="Lecture des dynamiques d'entrée de cycle : équipe, marché initial, pattern matching contre les archétypes de fondation, points aveugles du fondateur, retournement causal de la thèse, singularités contrariennes."
          engines="Quatorze moteurs analytiques"
          duration="≈ 90 secondes"
          accent="#3f4a2b"
          accentBg="#e8f1de"
          onClick={() => onSelect('early')}
        />
        <TrackCard
          label="Dossier growth"
          subtitle="Série B · C · D"
          description="Lecture des dynamiques de scale-up : fragilité structurelle sur sept patterns (croissance subventionnée, captivité infrastructure, coûts fixes, risque réglementaire, érosion de défensibilité, fragilité cap table, industrialisation prématurée), lecture du langage, marché mature, macro, singularités contrariennes."
          engines="Neuf moteurs analytiques"
          duration="≈ 60 secondes"
          accent="#7a5a1d"
          accentBg="#ede2c8"
          onClick={() => onSelect('growth')}
        />
      </div>

      <div style={{ marginTop: 32, textAlign: 'center', fontSize: 12, opacity: 0.55, lineHeight: 1.5 }}>
        Vous pourrez changer de parcours à tout moment avant le lancement de l'analyse.
      </div>
    </div>
  );
}

interface TrackCardProps {
  label: string;
  subtitle: string;
  description: string;
  engines: string;
  duration: string;
  accent: string;
  accentBg: string;
  onClick: () => void;
}

function TrackCard({ label, subtitle, description, engines, duration, accent, accentBg, onClick }: TrackCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        textAlign: 'left',
        width: '100%',
        padding: '28px 28px 24px',
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderLeft: `4px solid ${accent}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background-color 120ms ease, transform 120ms ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accentBg; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
    >
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 6, color: accent, fontWeight: 600 }}>
        {subtitle}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginBottom: 14, color: 'var(--ink)' }}>
        {label}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18, opacity: 0.85 }}>
        {description}
      </p>
      <div style={{ display: 'flex', gap: 18, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.55, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
        <span>{engines}</span>
        <span>·</span>
        <span>{duration}</span>
      </div>
    </button>
  );
}
