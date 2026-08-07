// ============================================================
// PRELUDE - PiedDeNote (note d instruction)
// ------------------------------------------------------------
// Pied de la note d instruction : mention de provenance de la
// plateforme et rappel de confidentialite. Le second n est pas
// decoratif, il est la seule mention dans le document qui dit au
// lecteur ce qu il a le droit d en faire.
//
// Extrait de InvestmentNoteView le 7 aout 2026, lot 2 du chantier de
// decoupage. Aucune entree : le bloc ne depend d aucune donnee du
// dossier, ce qui en fait la coupe la plus nette du lot. Un composant
// sans entree n a pas de surface, donc pas de frontiere a discuter.
//
// LA REGLE PART AVEC LUI, ET C EST LE POINT
//
// styled-jsx scope au composant declarant : laisser `.note-footer`
// dans le parent aurait retire tout son style a ce bloc, en silence.
// La regle a donc ete deplacee ici a l identique, et le controle de
// conservation verifie qu elle n a ete ni perdue ni recopiee.
// `.note-footer` etait autonome, une seule regle et un seul usage dans
// tout le fichier, ce qui est la raison pour laquelle ce bloc a ete
// choisi comme premier deplacement de style du chantier.
// ============================================================

'use client';

import React from 'react';

export function PiedDeNote(): React.ReactElement {
  return (
    <div className="note-footer">
      <div>Note préparée par Prélude · Plateforme d&apos;instruction VC européenne</div>
      <div>Document confidentiel · Usage strictement interne au Comité d&apos;Investissement</div>
      <style jsx>{`
        .note-footer {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid rgba(29, 28, 26, 0.4);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 9.5px;
          font-weight: 500;
          color: var(--ink-tertiary);
          text-align: center;
          line-height: 1.8;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}

export default PiedDeNote;
