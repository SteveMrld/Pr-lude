'use client';

// ============================================================
// LA TOILE RETROSPECTIVE : PLANCHE D AUSCULTATION D UN RUN
// ------------------------------------------------------------
// Ce qu un acheteur doit voir en une image : Prelude est une chaine
// d instruction et non un prompt long. Vingt et un moteurs, leurs
// dependances reelles telles que le graphe les declare, l etat de
// chacun et le temps qu il a pris.
//
// TOUT EST DERIVE, RIEN N EST DESSINE. Les noeuds viennent de la
// topologie, les aretes de ses `deps`, les etats du releve du recorder,
// les durees de ses mesures, et la cause d une extinction du croisement
// des deux. Un moteur ajoute demain a la topologie apparait sans que ce
// fichier le sache.
//
// DEUX COULEURS. L encre et l ocre. Les six etats ne se distinguent pas
// par six teintes mais par le remplissage et le trait : un aplat pour
// l aboutissement, un contour plein pour l incident, un contour
// interrompu pour l extinction, un contour pale pour ce qui n a pas ete
// instrumente. L ocre marque ce qui a casse et ce qui s est eteint,
// c est-a-dire ce qu un lecteur doit aller voir ; l ecarte par doctrine
// reste a l encre, parce qu il n a rien coute et ne demande rien.
//
// AUCUNE ANIMATION. La toile vivante en aura une, sur les noeuds en
// cours ; celle-ci rend un fait accompli, et une pulsation sur un run
// termine serait un ornement. La seule transition est celle du survol.
// ============================================================

import { useMemo, useState } from 'react';
import {
  construireToileRetrospective,
  libelleDuree,
  type EtatNoeud,
  type NoeudRetrospectif,
  type EntreeRecorder,
} from '@/lib/pipeline-toile/retrospective';
import { layoutTopology } from '@/lib/pipeline-toile/layout';
import { GRAPHE_FLUX } from '@/lib/pipeline-toile/graphe-flux';

// LA TOILE DESSINE LE FLUX, PAS L ORDONNANCEMENT. Elle rendait
// `WAVE_BASED_TOPOLOGY`, dont les liens sont des barrieres de vague :
// chaque moteur d une vague y attend toute la precedente, meme sans en
// consommer la sortie. C etait une chronologie deguisee en graphe, et
// elle montrait que les moteurs se succedent la ou il faut montrer
// qu ils se passent leurs sorties. Le flux dit que Prelude lit un
// document puis que chaque moteur travaille sur ce que les precedents
// ont etabli, ce qui est ce qui le distingue d un prompt long.
//
// La cascade reste visible, mais dans les etats et non dans les fils :
// quand un moteur de porte tombe, ses avals sortent eteints et la toile
// le dit. Le lecteur voit la consequence sans qu on lui dessine le
// mecanisme.
const TOPOLOGIE = GRAPHE_FLUX.map(n => ({ id: n.id, deps: n.consomme }));

/**
 * Le libelle d un moteur, en francais de partner et non en identifiant.
 * La liste tranche plutot qu elle ne constate : un nom lisible ne se
 * derive d aucune propriete de l identifiant, il se decide.
 */
const LIBELLES: Record<string, string> = {
  extraction: 'Extraction',
  team: 'Equipe',
  market: 'Marche',
  macro: 'Macro',
  'financial-extraction': 'Donnees financieres',
  'saas-metrics': 'Metriques SaaS',
  'industrial-metrics': 'Metriques industrielles',
  benchmarks: 'Benchmarks',
  pattern: 'Pattern matching',
  blindspot: 'Aveuglement',
  contrarian: 'Contrarien',
  'financial-coherence': 'Coherence financiere',
  'tech-claim': 'Revendication tech',
  'execution-friction': 'Friction d execution',
  'narrative-drift': 'Derive narrative',
  causal: 'Retournement causal',
  'fragility-structurelle': 'Fragilite structurelle',
  'reference-checks': 'Appels de reference',
  orchestrate: 'Synthese finale',
};

type Traitement = {
  fond: string;
  trait: string;
  encre: string;
  pointille?: string;
  epaisseur: number;
  libelle: string;
};

/**
 * Six etats, deux couleurs. Le remplissage et le trait portent la
 * distinction que la teinte ne porte pas.
 */
const TRAITEMENT: Record<EtatNoeud, Traitement> = {
  abouti: {
    fond: 'var(--paper-accent)', trait: 'var(--hairline)', encre: 'var(--ink)',
    epaisseur: 1, libelle: 'abouti',
  },
  'ecarte-doctrine': {
    fond: 'transparent', trait: 'var(--hairline)', encre: 'var(--muted)',
    pointille: '2 3', epaisseur: 1, libelle: 'ecarte par doctrine',
  },
  incident: {
    fond: 'transparent', trait: 'var(--accent)', encre: 'var(--accent)',
    epaisseur: 2, libelle: 'tombe en incident',
  },
  'non-conclusif': {
    fond: 'transparent', trait: 'var(--accent-mid)', encre: 'var(--accent)',
    pointille: '5 3', epaisseur: 1.5, libelle: 'non conclusif',
  },
  'eteint-cascade': {
    fond: 'transparent', trait: 'var(--accent-mid)', encre: 'var(--muted)',
    pointille: '1 4', epaisseur: 1, libelle: 'eteint par cascade',
  },
  'non-instrumente': {
    fond: 'transparent', trait: 'var(--hairline-soft)', encre: 'var(--muted-soft)',
    epaisseur: 1, libelle: 'non instrumente',
  },
};

const VIDES: Record<string, { titre: string; corps: string }> = {
  'instrumentation-absente': {
    titre: 'Aucun releve de moteurs sur ce run',
    corps: 'Le dossier a ete instruit avant que le releve par moteur n existe. Ce vide est une lacune du dispositif et ne dit rien de la societe.',
  },
  'run-tombe-avant-instruction': {
    titre: 'Le pipeline est tombe avant d instruire',
    corps: 'Aucun moteur n a depose de mesure. Le dossier n a pas ete evalue, ce qui n est pas la meme chose qu une evaluation defavorable.',
  },
  'ecarte-au-prescan': {
    titre: 'Dossier ecarte au pre-scan',
    corps: 'Le pipeline complet n a pas ete lance : c est une decision de la regle de pre-scan et non un incident. Rien n a casse.',
  },
};

export type ToileRetrospectiveProps = {
  pipelineEnginesStatus: Record<string, EntreeRecorder> | null | undefined;
  statutDuRun: string | null | undefined;
  /**
   * Le parcours du run, quand il a ete enregistre. Il commande le
   * denominateur : le growth neutralise quatre moteurs, qui ne sont donc
   * pas attendus. Absent sur les runs anterieurs au 8 aout 2026, ou il
   * etait lu a l entree de la route et jamais persiste.
   */
  parcours?: 'early' | 'growth' | null;
};

export default function ToileRetrospective(props: ToileRetrospectiveProps) {
  const [survole, setSurvole] = useState<string | null>(null);

  const toile = useMemo(
    () => construireToileRetrospective(
      TOPOLOGIE,
      props.pipelineEnginesStatus,
      props.statutDuRun,
      props.parcours,
    ),
    [props.pipelineEnginesStatus, props.statutDuRun, props.parcours],
  );

  const layout = useMemo(
    () => layoutTopology(TOPOLOGIE, { layerSpacing: 196, nodeSpacing: 50, marginX: 26, marginY: 26, nodeWidth: 150 }),
    [],
  );

  const parId = useMemo(() => {
    const m: Record<string, NoeudRetrospectif> = {};
    for (const n of toile.noeuds) m[n.id] = n;
    return m;
  }, [toile]);

  if (toile.vide) {
    const v = VIDES[toile.vide];
    return (
      <section style={{ padding: '22px 0' }}>
        <div style={{
          border: '1px solid var(--hairline)',
          borderLeft: '3px solid var(--accent-mid)',
          background: 'var(--surface)',
          padding: '18px 22px',
          maxWidth: '62ch',
        }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
            {v.titre}
          </div>
          <p style={{ fontFamily: 'var(--sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--muted)', margin: 0 }}>
            {v.corps}
          </p>
        </div>
      </section>
    );
  }

  const L = 150;
  const H = 34;
  const etatsPresents = Array.from(new Set(toile.noeuds.map(n => n.etat)));

  return (
    <section style={{ padding: '6px 0 18px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 18,
        flexWrap: 'wrap',
        marginBottom: 14,
      }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.03em' }}>
          {/* LE DENOMINATEUR SE LIT AVEC LE RESULTAT. Une toile ou la
              moitie des noeuds n a pas ete relevee ne doit pas se lire
              comme une chaine a moitie tombee. */}
          <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{toile.instrumentes}</strong>
          {' '}moteurs releves sur {toile.total} attendus
          {/* LE DENOMINATEUR DIT D OU IL VIENT. Sans parcours enregistre
              il est celui de la topologie entiere, et un moteur
              neutralise par doctrine y compte comme non mesure : le
              lecteur doit pouvoir faire la difference. */}
          {!toile.parcoursConnu && (
            <span style={{ color: 'var(--muted-soft)' }}> (parcours non enregistre)</span>
          )}
          {toile.dureeTotaleMs > 0 && (
            <> &middot; <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{libelleDuree(toile.dureeTotaleMs)}</strong> de calcul cumule</>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--muted)' }}>
          {/* La legende ne montre que les etats presents : enumerer les
              six sur une toile qui n en porte que deux ferait chercher
              quatre choses absentes. */}
          {etatsPresents.map((e) => {
            const t = TRAITEMENT[e];
            return (
              <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="11" aria-hidden="true">
                  <rect x="0.75" y="0.75" width="14.5" height="9.5" rx="2"
                    fill={t.fond} stroke={t.trait} strokeWidth={t.epaisseur}
                    strokeDasharray={t.pointille} />
                </svg>
                {t.libelle}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`Chaine d instruction : ${toile.instrumentes} moteurs releves sur ${toile.total}`}
          style={{ display: 'block', minWidth: layout.width }}
        >
          {layout.edges.map((e) => {
            const a = layout.nodes.find(n => n.id === e.from);
            const b = layout.nodes.find(n => n.id === e.to);
            if (!a || !b) return null;
            const x1 = a.x + L / 2;
            const x2 = b.x - L / 2;
            const dx = Math.max(24, (x2 - x1) * 0.5);
            // UNE ARETE QUI MENE A UN MOTEUR ETEINT SE DESSINE ETEINTE.
            // Elle ne porte pas de couleur propre : elle prend celle de
            // ce qu elle alimente, ce qui rend la cascade lisible en
            // suivant le trait plutot qu en lisant les libelles.
            const cible = parId[e.to];
            const morte = cible && (cible.etat === 'eteint-cascade' || cible.etat === 'non-instrumente');
            const implique = survole && (e.from === survole || e.to === survole);
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M ${x1} ${a.y} C ${x1 + dx} ${a.y}, ${x2 - dx} ${b.y}, ${x2} ${b.y}`}
                fill="none"
                stroke={implique ? 'var(--accent)' : 'var(--hairline)'}
                strokeWidth={implique ? 1.6 : 1}
                strokeDasharray={morte ? '2 4' : undefined}
                opacity={morte ? 0.5 : 1}
              />
            );
          })}

          {layout.nodes.map((n) => {
            const r = parId[n.id];
            const t = TRAITEMENT[r ? r.etat : 'non-instrumente'];
            const duree = r ? libelleDuree(r.dureeMs) : '';
            const cause = r && r.causeAmont.length
              ? `Eteint : ${r.causeAmont.map(c => LIBELLES[c] || c).join(', ')} n a pas produit.`
              : '';
            return (
              <g
                key={n.id}
                onMouseEnter={() => setSurvole(n.id)}
                onMouseLeave={() => setSurvole(null)}
                style={{ cursor: 'default' }}
              >
                <title>
                  {`${LIBELLES[n.id] || n.id} — ${t.libelle}${duree ? ` — ${duree}` : ''}${cause ? `\n${cause}` : ''}${
                    GRAPHE_FLUX.find(x => x.id === n.id)?.entreesNonEtablies
                      ? '\nEntrees non etablies : son appel n est pas lisible depuis la route, donc aucun fil ne lui est invente.'
                      : ''
                  }`}
                </title>
                <rect
                  x={n.x - L / 2} y={n.y - H / 2} width={L} height={H} rx={3}
                  fill={t.fond}
                  stroke={survole === n.id ? 'var(--accent)' : t.trait}
                  strokeWidth={survole === n.id ? 2 : t.epaisseur}
                  strokeDasharray={survole === n.id ? undefined : t.pointille}
                />
                <text
                  x={n.x - L / 2 + 10} y={n.y + (duree ? -1 : 4)}
                  fontFamily="var(--serif)" fontSize="12.5" fontWeight={600}
                  fill={t.encre}
                >
                  {LIBELLES[n.id] || n.id}
                </text>
                {duree && (
                  <text
                    x={n.x - L / 2 + 10} y={n.y + 11}
                    fontFamily="var(--sans)" fontSize="9" fill="var(--muted-soft)"
                    letterSpacing="0.04em"
                  >
                    {duree}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* LA CASCADE SE DIT AUSSI EN TOUTES LETTRES. Le trait interrompu
          la montre, la phrase la nomme : un lecteur qui imprime la page
          garde la seconde. */}
      {(() => {
        const eteints = toile.noeuds.filter(n => n.etat === 'eteint-cascade' && n.causeAmont.length);
        const tombes = toile.noeuds.filter(n => n.etat === 'incident');
        if (!eteints.length && !tombes.length) return null;
        return (
          <p style={{
            fontFamily: 'var(--sans)', fontSize: 12, lineHeight: 1.6, color: 'var(--muted)',
            marginTop: 12, maxWidth: '78ch',
          }}>
            {tombes.length > 0 && (
              <>
                <strong style={{ color: 'var(--ink)' }}>
                  {tombes.map(n => LIBELLES[n.id] || n.id).join(', ')}
                </strong>
                {tombes.length > 1 ? ' sont tombes en incident. ' : ' est tombe en incident. '}
              </>
            )}
            {eteints.length > 0 && (
              <>
                {eteints.length} moteur{eteints.length > 1 ? 's' : ''} en aval {eteints.length > 1 ? 'se sont eteints' : 's est eteint'} faute
                d entree, et non par un defaut propre :{' '}
                {eteints.slice(0, 4).map(n => LIBELLES[n.id] || n.id).join(', ')}
                {eteints.length > 4 ? `, et ${eteints.length - 4} autres.` : '.'}
              </>
            )}
          </p>
        );
      })()}
    </section>
  );
}
