// ============================================================
// PRELUDE - Composant de rendu Bloc 3 (Structuration a l entree)
// ------------------------------------------------------------
// Rendu unique pour la section structuration, partage entre la note
// d instruction, le dashboard et le pack IC. Trois variantes de
// presentation (note, dashboard, ic) qui reutilisent le meme contenu
// mais avec une typographie et un layout coherents avec l existant
// de chaque vue.
// ============================================================

import React from 'react';
import type {
  StructurationEntreeOutput,
  StructurationSection,
} from '@/lib/engines/structuration-entree/types';

const RUBRIQUES: Array<{
  key: keyof Pick<StructurationEntreeOutput,
    'gouvernanceBoard'
    | 'clausesProtectrices'
    | 'tranchingMilestones'
    | 'preferenceLiquidationAntiDilution'
    | 'droitsInformationReporting'
    | 'cadrageScenariosSortie'>;
  letter: string;
  title: string;
}> = [
  { key: 'gouvernanceBoard', letter: 'a', title: 'Gouvernance et board' },
  { key: 'clausesProtectrices', letter: 'b', title: 'Clauses protectrices' },
  { key: 'tranchingMilestones', letter: 'c', title: 'Tranching et milestones' },
  { key: 'preferenceLiquidationAntiDilution', letter: 'd', title: 'Préférence de liquidation et anti-dilution' },
  { key: 'droitsInformationReporting', letter: 'e', title: 'Droits d information et reporting' },
  { key: 'cadrageScenariosSortie', letter: 'f', title: 'Cadrage des scénarios de sortie' },
];

const POSTURE_LABELS: Record<StructurationEntreeOutput['postureGenerale'], string> = {
  'protection-forte': 'Protection forte',
  'standard': 'Posture standard',
  'souple': 'Posture souple',
};

const POSTURE_COLORS: Record<StructurationEntreeOutput['postureGenerale'], string> = {
  'protection-forte': '#8a4a17',
  'standard': '#3f4a2b',
  'souple': '#506b3a',
};

type Variant = 'note' | 'dashboard' | 'ic';

interface Props {
  structuration: StructurationEntreeOutput;
  variant?: Variant;
}

export default function StructurationEntreeSection({
  structuration,
  variant = 'note',
}: Props) {
  const postureLabel = POSTURE_LABELS[structuration.postureGenerale] || 'Posture standard';
  const postureColor = POSTURE_COLORS[structuration.postureGenerale] || '#3f4a2b';

  if (variant === 'ic') {
    return (
      <div className="ic-block">
        <h3 className="ic-block-title">Structuration à l entrée</h3>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: postureColor, fontWeight: 600, marginBottom: 6 }}>
          {postureLabel}
        </div>
        {structuration.postureRationale && (
          <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0, marginBottom: 10 }}>{structuration.postureRationale}</p>
        )}
        {structuration.preambule && (
          <p style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>{structuration.preambule}</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {RUBRIQUES.map(({ key, letter, title }) => {
            const section = structuration[key] as StructurationSection;
            return (
              <RubriqueIc key={key} letter={letter} title={title} section={section} />
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
          Structuration à l entrée
        </h3>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: postureColor, fontWeight: 600, marginBottom: 4 }}>
          {postureLabel}
        </div>
        {structuration.postureRationale && (
          <p style={{ fontSize: 12, opacity: 0.78, marginTop: 0, marginBottom: 14 }}>{structuration.postureRationale}</p>
        )}
        {structuration.preambule && (
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>{structuration.preambule}</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {RUBRIQUES.map(({ key, letter, title }) => {
            const section = structuration[key] as StructurationSection;
            return (
              <RubriqueDashboard key={key} letter={letter} title={title} section={section} />
            );
          })}
        </div>
      </div>
    );
  }

  // Variant note (default) : prose dense, layout colonne
  return (
    <>
      <h3 className="note-h3">Structuration à l entrée</h3>
      <p className="note-paragraph" style={{ marginBottom: 8 }}>
        <strong style={{ color: postureColor }}>{postureLabel}.</strong>{' '}
        {structuration.postureRationale}
      </p>
      {structuration.preambule && (
        <p className="note-paragraph">{structuration.preambule}</p>
      )}
      {RUBRIQUES.map(({ key, letter, title }) => {
        const section = structuration[key] as StructurationSection;
        return (
          <RubriqueNote key={key} letter={letter} title={title} section={section} />
        );
      })}
    </>
  );
}

function RubriqueNote({ letter, title, section }: { letter: string; title: string; section: StructurationSection }) {
  return (
    <div style={{ marginTop: 16 }}>
      <h4 className="note-h4">{letter}. {title}</h4>
      {section.status === 'data-missing' ? (
        <p className="note-paragraph muted">
          Rubrique en données insuffisantes. {section.missingReason}
        </p>
      ) : (
        <>
          <p className="note-paragraph">{section.recommendation}</p>
          {section.anchors.length > 0 && (
            <p className="note-paragraph" style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              <em>Ancrages dans l analyse :</em> {section.anchors.join(' · ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function RubriqueDashboard({ letter, title, section }: { letter: string; title: string; section: StructurationSection }) {
  return (
    <div style={{ padding: 16, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65, marginBottom: 4 }}>
        Rubrique {letter}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--hairline)' }}>
        {title}
      </div>
      {section.status === 'data-missing' ? (
        <div style={{ fontSize: 12, opacity: 0.65, fontStyle: 'italic' }}>
          Données insuffisantes. {section.missingReason}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>{section.recommendation}</div>
          {section.anchors.length > 0 && (
            <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.5, paddingTop: 8, borderTop: '1px solid var(--hairline)' }}>
              <em>Ancrages :</em> {section.anchors.join(' · ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RubriqueIc({ letter, title, section }: { letter: string; title: string; section: StructurationSection }) {
  return (
    <div style={{ padding: 12, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 2 }}>
        {letter}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {section.status === 'data-missing' ? (
        <div style={{ fontSize: 11, opacity: 0.65, fontStyle: 'italic' }}>
          Données insuffisantes. {section.missingReason}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>{section.recommendation}</div>
          {section.anchors.length > 0 && (
            <div style={{ fontSize: 10.5, opacity: 0.72, lineHeight: 1.45 }}>
              <em>Ancrages :</em> {section.anchors.join(' · ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
