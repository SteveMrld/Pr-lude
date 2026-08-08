'use client';

// ============================================================
// UN DOSSIER, SON DERNIER RUN EN TETE ET SES REPRISES REPLIEES
// ------------------------------------------------------------
// Un partner cherche un dossier, pas une execution. Huit runs d In
// Haircare sont un dossier avec huit instructions, et c est ce qui se
// lit : la derniere en tete, les precedentes sous un repli.
//
// CE QUE LE REPLI PORTE, ET POURQUOI IL NE REPETE PAS LA TETE. Les runs
// d un meme dossier partagent leur nom, leur secteur et leur pays ; ce
// qui les distingue est la date, le verdict, le score et le parcours.
// Le repli ne porte donc que cela, en une ligne par instruction, ce qui
// rend visible d un coup d oeil qu un dossier a ete rejoue et que le
// verdict a bouge. Cette derniere information remonte en tete, sur le
// bouton lui-meme, parce qu elle doit se voir sans deplier.
//
// LE PARCOURS MANQUE, ET CE N EST PAS UN OUBLI D AFFICHAGE. Il est un
// parametre de la requete d analyse, lu a l entree de la route pour
// decider quels moteurs tournent, et il n est ecrit nulle part : absent
// des soixante-six lignes du corpus, et non derivable sur les
// quarante et une qui ne portent pas de releve de moteurs. La colonne du
// repli reste donc vide plutot que de se remplir d une valeur devinee,
// et le fait est remonte.
// ============================================================

import { useState } from 'react';
import { presenterVerdict, PALETTE_TON } from '@/lib/note/vocabulaire-dossier';

export type ReprisePropos = {
  id: string;
  createdAtLabel: string;
  verdict: string | null;
  globalScore: number | null;
  parcours: string | null;
};

export type DossierGroupeProps = {
  /**
   * Rend la ligne de tete. Elle recoit le bouton de repli a poser parmi
   * ses marqueurs.
   *
   * L enveloppe passe par une fonction de rendu plutot que par un objet
   * de proprietes : la ligne de tete de l historique porte ses actions,
   * son editeur de stade et ses compteurs, tous en JSX, et les faire
   * transiter par un objet aurait demande de les demonter puis de les
   * remonter. Ce qui appartient a l appelant reste chez lui.
   */
  rendreTete: (boutonReprises: React.ReactNode) => React.ReactNode;
  reprises: ReprisePropos[];
  verdictABouge: boolean;
  derniere?: boolean;
};

export default function DossierGroupe(props: DossierGroupeProps) {
  const [ouvert, setOuvert] = useState(false);
  const n = props.reprises.length;

  return (
    <div style={{ borderBottom: props.derniere ? 'none' : '1px solid var(--hairline-soft)' }}>
      {props.rendreTete(
        n > 0 ? (
              <button
                type="button"
                onClick={() => setOuvert(v => !v)}
                aria-expanded={ouvert}
                data-role="reprises"
                title={`${n + 1} instructions de ce dossier`}
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 9.5,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  // LE VERDICT QUI A BOUGE SE VOIT SANS DEPLIER, et c est
                  // la seule raison pour laquelle ce bouton porte l ocre :
                  // un dossier rejoue dont l avis n a pas change ne
                  // demande rien.
                  color: props.verdictABouge ? 'var(--accent)' : 'var(--muted)',
                  border: `1px solid ${props.verdictABouge ? 'var(--accent)' : 'var(--hairline)'}`,
                  background: 'transparent',
                }}
              >
                {n} reprise{n > 1 ? 's' : ''}{props.verdictABouge ? ' · verdict change' : ''}
                <span aria-hidden="true" style={{ marginLeft: 5 }}>{ouvert ? '▴' : '▾'}</span>
              </button>
        ) : null,
      )}

      {ouvert && n > 0 && (
        <div
          data-role="repli"
          style={{
            paddingLeft: 15,
            marginLeft: 18,
            borderLeft: '1px solid var(--hairline)',
            marginBottom: 8,
          }}
        >
          {props.reprises.map((r) => {
            const v = presenterVerdict(r.verdict);
            const palette = PALETTE_TON[v.ton];
            return (
              <div
                key={r.id}
                style={{
                  display: 'grid',
                  // Les colonnes se serrent a gauche plutot que de
                  // s etaler. La colonne du parcours etant vide tant
                  // qu il n est pas persiste, une repartition en `1fr`
                  // poussait le verdict et le score aux deux bords et
                  // cassait la lecture d une sous-liste.
                  gridTemplateColumns: '108px 186px 92px minmax(0, 1fr)',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '5px 16px 5px 0',
                  fontFamily: 'var(--sans)',
                  fontSize: 11,
                  color: 'var(--muted)',
                }}
              >
                <span style={{ color: 'var(--ink-soft)' }}>{r.createdAtLabel}</span>
                <span style={{ color: palette.encre, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {v.libelle}
                </span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {r.globalScore != null
                    ? <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{Math.round(r.globalScore)}<span style={{ color: 'var(--muted-soft)', fontWeight: 500 }}>/100</span></strong>
                    : <span style={{ color: 'var(--muted-soft)' }}>sans score</span>}
                </span>
                <span style={{ color: 'var(--muted-soft)', paddingLeft: 14 }}>
                  {/* Vide tant que le parcours n est pas persiste : la
                      route le lit a l entree et ne l ecrit jamais. La
                      colonne reste plutot que de disparaitre, pour que
                      son arrivee ne redispose pas la sous-liste. */}
                  {r.parcours || ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
