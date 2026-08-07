// ============================================================
// PRELUDE - EnTeteDeNote (note d instruction)
// ------------------------------------------------------------
// Bandeau de tete du document : marque, nature du document, date
// d analyse et mention de classification.
//
// La mention de classification n est pas decorative. Avec le pied de
// note, elle est la seule chose dans le document qui dise au lecteur ce
// qu il a le droit d en faire, et elle est la premiere ligne qu il
// rencontre. Les deux se repondent, et c est une raison de les avoir
// extraits l un apres l autre plutot que dispersement.
//
// Extrait de InvestmentNoteView le 7 aout 2026, lot 2 du chantier de
// decoupage.
//
// SURFACE D ENTREE : une seule valeur, la date deja formatee par le
// parent. Le formatage reste chez lui parce qu il depend de la locale
// du document entier et non de ce bandeau ; deplacer un `toLocaleDate`
// dans un composant de presentation en ferait une decision locale la ou
// c est une propriete de la note.
//
// STYLE : les sept regles partent avec le bloc. Le mode analyser les a
// declarees propres, zero partagee, et la verification a porte en outre
// sur l encadrement : aucune ne vit sous un `@media`, ce qui aurait
// demande de deplacer le contexte avec elle.
// ============================================================

'use client';

import React from 'react';

export interface EnTeteDeNoteProps {
  /** Date d analyse, deja formatee par le parent. */
  dateAnalyzed: string;
}

export function EnTeteDeNote({ dateAnalyzed }: EnTeteDeNoteProps): React.ReactElement {
  return (
  <div className="note-header">
    <div className="note-header-left">
      <div className="note-brand">PRÉLUDE</div>
      <div className="note-title">Note d&apos;instruction</div>
      <style jsx>{`
        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--ink);
          margin-bottom: 48px;
          position: relative;
        }
        .note-header::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--ink);
          opacity: 0.4;
        }
        .note-header-right {
          text-align: right;
        }
        .note-brand {
          font-family: var(--serif);
          font-size: 30px;
          font-weight: 700;
          letter-spacing: 0.16em;
          line-height: 1;
          color: var(--accent-marque);
        }
        .note-title {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-top: 8px;
        }
        .note-date {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 500;
          color: var(--ink);
          letter-spacing: 0.04em;
        }
        .note-classification {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9px;
          letter-spacing: 0.18em;
          color: #8a8478;
          margin-top: 4px;
          text-transform: uppercase;
          font-weight: 500;
        }
      `}</style>
    </div>
    <div className="note-header-right">
      <div className="note-date">{dateAnalyzed}</div>
      <div className="note-classification">CONFIDENTIEL · COMITÉ D&apos;INVESTISSEMENT</div>
    </div>
  </div>
  );
}

export default EnTeteDeNote;
