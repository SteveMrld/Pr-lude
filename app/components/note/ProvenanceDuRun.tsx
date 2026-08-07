// ============================================================
// PRELUDE - ProvenanceDuRun (note d instruction)
// ------------------------------------------------------------
// Cartouche de provenance en pied de note. Rend explicite quel run a
// produit le document que le partner a sous les yeux : identifiant
// d analyse, sha du commit, date, score et statut.
//
// Ce n est pas un ornement de tracabilite. La regle de conformite du
// depot dit qu un run se compare par son empreinte de code et non par
// son sha, et que le sha n en est qu une approximation commode ; ce
// cartouche est l endroit ou cette approximation est rendue lisible a
// quelqu un qui n ouvrira jamais le version stamp.
//
// Extrait de InvestmentNoteView le 7 aout 2026, lot 2 du chantier de
// decoupage.
//
// SURFACE D ENTREE : cinq valeurs nommees, deja calculees par le
// parent. Aucune n est reconstruite ici, et c est voulu : un cartouche
// de provenance qui recalculerait ce qu il rapporte cesserait d etre un
// releve pour devenir une seconde source, ce qui est exactement la
// faute que la doctrine du cachet lu au mauvais endroit decrit.
//
// STYLE : les sept regles du cartouche partent avec lui. L analyse
// prealable les a toutes declarees propres au bloc, y compris `.mono`,
// qui n est utilisee nulle part ailleurs dans le parent et dont la
// regle est de toute facon un descendant de `.note-run-provenance-row`.
// ============================================================

'use client';

import React from 'react';

export interface ProvenanceDuRunProps {
  analysisId?: string | null;
  commitShaCourt: string | null;
  analyzedAtIso: string | null;
  score: number | null;
  statut: string;
}

export function ProvenanceDuRun({
  analysisId, commitShaCourt, analyzedAtIso, score, statut,
}: ProvenanceDuRunProps): React.ReactElement {
  return (
    <div className="note-run-provenance" aria-label="Provenance du run">
      <div className="note-run-provenance-title">Provenance du run</div>
      <dl className="note-run-provenance-list">
        <div className="note-run-provenance-row">
          <dt>analysisId</dt>
          <dd className="mono">{analysisId || '\u2014'}</dd>
        </div>
        <div className="note-run-provenance-row">
          <dt>commitSha</dt>
          <dd className="mono">{commitShaCourt || '\u2014'}</dd>
        </div>
        <div className="note-run-provenance-row">
          <dt>analyzedAt</dt>
          <dd className="mono">{analyzedAtIso || '\u2014'}</dd>
        </div>
        <div className="note-run-provenance-row">
          <dt>score</dt>
          <dd className="mono">{score != null ? `${score}/100` : '\u2014'}</dd>
        </div>
        <div className="note-run-provenance-row">
          <dt>status</dt>
          <dd className="mono">{statut}</dd>
        </div>
      </dl>
      <style jsx>{`
        .note-run-provenance {
          margin-top: 40px;
          padding: 14px 18px;
          background: var(--hairline-soft);
          border: 1px solid var(--hairline);
          border-radius: 6px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .note-run-provenance-title {
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-tertiary);
          margin-bottom: 8px;
        }
        .note-run-provenance-list {
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 4px;
        }
        .note-run-provenance-row {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 12px;
          font-size: 11px;
          line-height: 1.5;
        }
        .note-run-provenance-row dt {
          font-weight: 500;
          color: var(--ink-tertiary);
          letter-spacing: 0.04em;
        }
        .note-run-provenance-row dd {
          margin: 0;
          color: var(--ink);
        }
        .note-run-provenance-row .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10.5px;
          letter-spacing: 0;
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}

export default ProvenanceDuRun;
