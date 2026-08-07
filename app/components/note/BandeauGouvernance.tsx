// ============================================================
// PRELUDE - BandeauGouvernance (note d instruction)
// ------------------------------------------------------------
// Bandeau d alerte en tete de note, affiche des qu un flag de conflit
// d interet de severite haute remonte, SELF_DEAL cap-table ou
// BOARD_INSIDER. Le partner doit le lire AVANT le verdict et la
// couverture editoriale : il conditionne sa posture de lecture.
//
// Les flags de severite moyenne, follow-on portfolio, ou faible,
// syndicate-regular, ne declenchent pas ce bandeau pour eviter le
// bruit ; ils restent accessibles dans la section gouvernance plus bas.
//
// PREMIERE EXTRACTION DU CHANTIER DE DECOUPAGE, 7 aout 2026.
//
// Le critere de coupe est la surface d entree et non la taille : ce
// composant prend une seule entree nommee, la liste des flags, la ou
// le parent lui donnait acces a l analyse entiere. C est ce qui fait
// la frontiere, et elle se lit dans la signature plutot que dans la
// position.
//
// Le bloc n a jamais porte de `className`, uniquement des styles en
// ligne, donc l extraction ne deplace aucune regle CSS. C est ce qui
// en fait la premiere : styled-jsx scopant au composant declarant, une
// extraction qui emporterait des regles demanderait de les deplacer
// avec elle, et il valait mieux ouvrir le lot sur le cas ou cette
// question ne se pose pas.
// ============================================================

'use client';

import React from 'react';

export interface BandeauGouvernanceProps {
  /**
   * Les flags du moteur de conflit d interet, tels que la note les
   * recoit. Le tri par severite est fait ici et non par l appelant,
   * parce que le seuil qui declenche le bandeau est une propriete du
   * bandeau et non de la note.
   */
  conflictOfInterest: unknown;
}

export function BandeauGouvernance({ conflictOfInterest }: BandeauGouvernanceProps): React.ReactElement | null {
  const flags = Array.isArray(conflictOfInterest) ? conflictOfInterest : [];
  const highSeverity = flags.filter((f: any) => f && (f.kind === 'self-deal' || f.kind === 'board-insider'));
  if (highSeverity.length === 0) return null;
  const byKind: Record<string, any[]> = { 'self-deal': [], 'board-insider': [] };
  for (const f of highSeverity) byKind[f.kind].push(f);
  return (
    <section
      aria-label="Alerte gouvernance"
      style={{
        margin: '12px 0 16px',
        padding: '14px 18px',
        borderLeft: '3px solid #7a2916',
        background: 'rgba(122, 41, 22, 0.05)',
        fontFamily: 'var(--serif)',
      }}
    >
      <div className="note-rubrique" style={{ color: '#7a2916', marginBottom: 8 }}>
        Alerte gouvernance · Conflit d&apos;intérêt détecté
      </div>
      {byKind['self-deal'].length > 0 && (
        <div style={{ marginBottom: byKind['board-insider'].length > 0 ? 10 : 0 }}>
          <div className="note-rubrique" style={{ marginBottom: 4 }}>Self-deal cap-table</div>
          {byKind['self-deal'].map((f: any, i: number) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.92 }}>{f.rationale}</p>
          ))}
        </div>
      )}
      {byKind['board-insider'].length > 0 && (
        <div>
          <div className="note-rubrique" style={{ marginBottom: 4 }}>Board insider</div>
          {byKind['board-insider'].map((f: any, i: number) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.92 }}>{f.rationale}</p>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, lineHeight: 1.6, marginTop: 10, marginBottom: 0, fontStyle: 'italic', opacity: 0.75 }}>
        La lecture qui suit doit être filtrée par la conscience de cette position d&apos;intérêt. Une décision d&apos;investissement engageant le fonds requiert ici une validation indépendante du comité.
      </p>
    </section>
  );
}

export default BandeauGouvernance;
