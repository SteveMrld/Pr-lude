// ============================================================
// PRELUDE - CartoucheRefutation (note d instruction)
// ------------------------------------------------------------
// Points de vigilance internes leves par la couche de refutation.
// Trois familles agregees : contradictions chiffrees, verdict contre
// signal, libelle contre base de calcul. Purement additif, calcule au
// rendu a partir du result_json, aucun score modifie, aucun snapshot
// reecrit. Silencieux si aucune contradiction n est detectee.
//
// PLACEMENT, et il porte une these. Le cartouche vient entre la section
// Projet propose, fin du bloc factuel, et la section Thesis
// d investissement, debut du bloc argumentatif. Le lecteur voit d abord
// le verdict et la carte d identite, prend connaissance des faits, puis
// rencontre les points de vigilance juste avant d entrer dans
// l argumentaire. C est le pivot ou il bascule du fait vers l analyse,
// moment ou une posture critique calibree est la plus utile. Le
// cartouche n a jamais precede le jugement, et l extraction ne change
// pas cet ordre.
//
// Extrait de InvestmentNoteView le 7 aout 2026, lot 2 du chantier de
// decoupage.
//
// VERIFICATION SUR CAS CONSTRUIT, ce qui est plus faible qu une preuve
// de corpus et doit se dire. Aucune des cinquante-six notes rendues ne
// declenche de contradiction : c est un zero de corpus et non un zero
// d instrument, le harnais pouvant parfaitement l exercer puisque
// `aggregateRefutations` est une fonction pure du result_json. Le cas a
// donc ete fabrique en greffant les deux fixtures de refutation du
// depot sur une note reelle, et l avant-apres a ete rendu sur lui.
// ============================================================

'use client';

import React from 'react';
import { aggregateRefutations } from '@/lib/refutation/aggregator';

export interface CartoucheRefutationProps {
  /** Le result_json entier : la couche de refutation le parcourt en
   *  totalite, cherchant des contradictions entre sorties de moteurs
   *  differents. C est l un des rares blocs dont la surface d entree
   *  EST l analyse entiere, et cela se justifie plutot que de se
   *  contourner : reduire l entree reviendrait a decider a sa place ou
   *  les contradictions peuvent vivre. */
  result: any;
  sourceFilename?: string | null;
  asOf?: string | null;
}

export function CartoucheRefutation({ result, sourceFilename, asOf }: CartoucheRefutationProps): React.ReactElement | null {
const refutations = aggregateRefutations(result, {
    sourceFilename: sourceFilename ?? null,
    asOf: asOf ?? null,
  });
  if (refutations.length === 0) return null;
  const familyLabels: Record<string, string> = {
    'numeric': 'Chiffres divergents',
    'verdict-signal': 'Verdict contre signal',
    'label-calc': 'Libellé contre base de calcul',
  };
  return (
    <section
      aria-label="Points de vigilance internes"
      style={{
        margin: '12px 0 16px',
        padding: '14px 18px',
        borderLeft: '3px solid #6b5b3a',
        background: 'rgba(107, 91, 58, 0.05)',
        fontFamily: 'var(--serif)',
      }}
    >
      <div  className="note-rubrique" style={{ color: '#6b5b3a', marginBottom: 8 }}>
        Points de vigilance internes · {refutations.length} contradiction{refutations.length > 1 ? 's' : ''} détectée{refutations.length > 1 ? 's' : ''}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.55, margin: 0, marginBottom: 10, fontStyle: 'italic', opacity: 0.75 }}>
        Le pipeline signale ici des tensions entre plusieurs éléments du dossier, relevés automatiquement. Ce ne sont pas des verdicts, ce sont des points à interroger en lecture.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {refutations.map((rf, i) => (
          <li key={i} style={{ marginBottom: i < refutations.length - 1 ? 12 : 0, paddingBottom: i < refutations.length - 1 ? 12 : 0, borderBottom: i < refutations.length - 1 ? '1px dashed rgba(107, 91, 58, 0.25)' : 'none' }}>
            <div  className="note-rubrique" style={{ color: '#6b5b3a', marginBottom: 4, opacity: 0.85 }}>
              {familyLabels[rf.family] || rf.family}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>Ce qui est affirmé :</span> {rf.claim}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>Ce qui le contredit :</span> {rf.contradiction}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>
              <span style={{ fontWeight: 600 }}>Nature de la tension :</span> {rf.tension}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
      
}

export default CartoucheRefutation;
