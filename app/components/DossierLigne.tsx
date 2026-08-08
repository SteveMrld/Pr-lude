'use client';

// ============================================================
// LA LIGNE D UN DOSSIER, PARTAGEE PAR L ACCUEIL ET L HISTORIQUE
// ------------------------------------------------------------
// Les deux surfaces rendaient un dossier chacune a sa facon, une grille
// de cartes aerees sur l accueil et une grille de cinq colonnes sur
// l historique, avec deux tables de libelles et deux tables de couleurs.
// Elles avaient diverge du producteur toutes les deux, et pas de la
// meme facon. Une seule ligne pour les deux ferme cela par construction
// plutot que par vigilance : il n y a plus deux endroits ou l ecart peut
// naitre.
//
// CE QUE LA LIGNE MET DANS L ORDRE, ET POURQUOI CET ORDRE. Un partner
// qui ouvre sa liste cherche a savoir lesquels de ses dossiers demandent
// son attention, et il regarde trente lignes et non trois. La premiere
// ligne porte donc ce qui repond a cette question et rien d autre :
// l etat, le nom, le verdict, la reserve et le score. Tout ce qui sert
// une fois qu on s est arrete sur un dossier descend en seconde ligne,
// en encre discrete, le nom du fichier source en dernier. Il portait
// dix pixels et demi quand le verdict en portait dix, c est-a-dire que
// la conclusion etait plus petite que le nom du PDF qui l a nourrie.
//
// DEUX COULEURS. L encre et l ocre. Les cinq etats ne se distinguent pas
// par cinq teintes mais par deux canaux, un filet vertical en bord de
// ligne et l encre du libelle, l ocre etant reserve a ce qui demande
// quelque chose. La palette vit dans le vocabulaire, pas ici, parce que
// deux transcriptions de la meme intention divergent.
//
// CE QU ELLE NE FAIT PAS. Elle ne decide pas quoi afficher a cote
// d elle : l historique lui passe ses actions et son editeur de stade en
// enfants, l accueil ne lui passe rien. Une ligne qui connaitrait ses
// deux appelants redeviendrait deux lignes.
// ============================================================

import Link from 'next/link';
import {
  etatDuDossier,
  libelleEtat,
  presenterVerdict,
  classeVerdict,
  PRESENTATION_ETAT,
  PALETTE_ETAT,
  PALETTE_TON,
  nommerDossier,
} from '@/lib/note/vocabulaire-dossier';

export type DossierLigneProps = {
  id: string;
  companyName: string;
  verdict: string | null;
  globalScore: number | null;
  status: string | null;
  failedEnginesCount: number | null;
  reserves: { total: number; majeures: number } | null;
  sector?: string | null;
  country?: string | null;
  createdAtLabel?: string | null;
  /**
   * La date brute, utilisee seulement quand le nom est provisoire.
   *
   * DEUX LIGNES SANS NOM PEUVENT PORTER LE MEME FICHIER. Le releve du
   * 8 aout 2026 en donne le cas : deux runs tombes du meme
   * `Project Woodpecker_Info Memo.pdf`, le meme jour, rendus tous deux
   * « il y a 5j · Project Woodpecker_Info... ». Le nom tronque etant
   * identique et le fichier etant le meme, rien ne les separait. Ce qui
   * les distingue est l heure, et elle ne s affiche que la ou elle est
   * necessaire : la mettre partout alourdirait trente lignes pour en
   * sauver deux.
   */
  createdAtIso?: string | null;
  sourceFilename?: string | null;
  /** Rendu a droite de la ligne. L historique y met ses actions. */
  children?: React.ReactNode;
  /**
   * Rendu contre le nom. L historique y met ses compteurs de versions et
   * de commentaires, qui qualifient le dossier et non son run : les
   * mettre a droite avec les actions les aurait separes de ce qu ils
   * decrivent.
   */
  marqueurs?: React.ReactNode;
  /**
   * Rendu en seconde ligne, apres le nom du fichier. Tout ce qui
   * qualifie un dossier sans decider s il demande quelque chose y
   * descend : la vigilance, l etat de DD. Sur la premiere ligne, ces
   * grandeurs repoussaient le nom jusqu a le faire passer a la ligne.
   */
  metaSupplementaire?: React.ReactNode;
  /** Vrai sur la derniere ligne, pour ne pas doubler le filet du bloc. */
  derniere?: boolean;
};

/**
 * Ce que la reserve donne a lire, et le silence quand elle n a pas ete
 * relevee.
 *
 * NULL SE TAIT, ET CE SILENCE EST LE SEUL CHOIX HONNETE DISPONIBLE. Au
 * 8 aout 2026 le bulletin figure sur quatre lignes sur trente-neuf :
 * ecrire « reserves non relevees » sur les trente-cinq autres remplirait
 * la colonne d un aveu repete que personne ne lirait au bout de trois
 * lignes, et ecrire « aucune reserve » affirmerait une mesure qui n a
 * pas eu lieu. La ligne se tait donc, et c est le pied de liste qui
 * porte le compte des dossiers non releves, une fois, la ou il se lit.
 */
function marqueurDeReserve(
  reserves: { total: number; majeures: number } | null,
): { texte: string; encre: string; poids: number } | null {
  if (!reserves) return null;
  if (reserves.total === 0) {
    return { texte: 'sans reserve', encre: 'var(--muted-soft)', poids: 500 };
  }
  if (reserves.majeures > 0) {
    return {
      texte: `${reserves.total} reserves, ${reserves.majeures} majeure${reserves.majeures > 1 ? 's' : ''}`,
      encre: 'var(--accent)',
      poids: 700,
    };
  }
  return {
    texte: `${reserves.total} reserve${reserves.total > 1 ? 's' : ''}`,
    encre: 'var(--ink-soft)',
    poids: 600,
  };
}

export default function DossierLigne(props: DossierLigneProps) {
  const etat = etatDuDossier(props.status);
  const presentationEtat = PRESENTATION_ETAT[etat];
  const paletteEtat = PALETTE_ETAT[etat];
  const verdict = presenterVerdict(props.verdict);
  const paletteVerdict = PALETTE_TON[verdict.ton];
  const reserve = marqueurDeReserve(props.reserves);

  // UN DOSSIER ECARTE PORTE LE MEME FAIT DANS DEUX CHAMPS, son statut
  // valant knockout et son verdict not_recommended. La suppression se
  // decide en comparant les libelles plutot qu en nommant ce cas : deux
  // champs qui diraient demain la meme chose seraient traites sans
  // qu on y pense.
  const libelle = libelleEtat(etat, props.failedEnginesCount);
  const verdictRedondant = verdict.libelle === libelle;

  // Un dossier clos recule. Il ne disparait pas, il cesse de reclamer.
  const clos = etat === 'ecarte-prescan';

  // Le nom se resout avant tout : un dossier tombe portait encore le
  // libelle d attente de l extraction, qui contredisait sa propre
  // pastille.
  const identite = nommerDossier(props.companyName, props.sourceFilename);

  // Sur un nom provisoire, la date passe a l heure pres : c est la seule
  // chose qui distingue deux runs tombes du meme document.
  const dateLisible = (() => {
    if (!identite.provisoire || !props.createdAtIso) return props.createdAtLabel;
    const d = new Date(props.createdAtIso);
    if (Number.isNaN(d.getTime())) return props.createdAtLabel;
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  })();

  const meta = [props.sector, props.country, dateLisible]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto auto auto',
        alignItems: 'center',
        gap: 12,
        padding: '9px 16px 9px 0',
        borderBottom: props.derniere ? 'none' : '1px solid var(--hairline-soft)',
        opacity: clos ? 0.72 : 1,
        transition: 'background 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-accent)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Le filet d etat. Trois pixels, en bord de ligne, sans libelle :
          il se lit en balayant la colonne de gauche sans rien lire. */}
      <div
        aria-hidden="true"
        style={{
          width: 3,
          alignSelf: 'stretch',
          background: paletteEtat.filet,
          borderRadius: 2,
          marginRight: 12,
        }}
      />

      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 9,
          // LES MARQUEURS PASSENT A LA LIGNE PLUTOT QUE DE COMPRIMER LE
          // NOM OU DE CHEVAUCHER LE VERDICT. En `nowrap`, une ligne
          // chargee, nom plus etat plus lacunes plus bouton de reprises,
          // debordait sa colonne et passait sous la pastille de verdict.
          // Le repli coute une seconde ligne sur les rares dossiers
          // concernes, ce qui est moins cher qu un chevauchement.
          flexWrap: 'wrap',
          rowGap: 3,
          minWidth: 0,
        }}>
          <Link
            href={`/dossiers/${props.id}`}
            prefetch={false}
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.005em',
              color: 'var(--ink)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '22ch',
              // Le nom garde un plancher. Sans lui, les marqueurs de la
              // ligne, dont le bouton de reprises, le comprimaient
              // jusqu a « I.. » : c est le seul element porteur d une
              // ellipse, donc c est lui qui absorbait tout le manque.
              // Le nom ne se comprime plus du tout : ce sont les
              // marqueurs qui cedent, puisqu ils peuvent passer a la
              // ligne et que lui ne le peut pas sans devenir illisible.
              flexShrink: 0,
              // Un nom provisoire se lit comme un nom, en italique : il
              // identifie la ligne sans pretendre etre celui de la
              // societe, que personne n a extrait.
              fontStyle: identite.provisoire ? 'italic' : 'normal',
            }}
            title={identite.provisoire ? 'Nom de societe non extrait, le fichier source tient lieu d identifiant' : undefined}
          >
            {identite.nom}
          </Link>
          {presentationEtat.visible && (
            <span
              data-role="etat"
              title={props.status || undefined}
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 10,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: paletteEtat.encre,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {libelle}
            </span>
          )}
          {identite.provisoire && (
            // UNE LIGNE DONT LE NOM N A PAS PU ETRE ETABLI LE DECLARE.
            // Le nom du fichier tient lieu d identifiant et il en a
            // l apparence : sans cette mention, un lecteur le prendrait
            // pour une societe qui s appellerait ainsi. La declaration
            // est visible plutot que logee dans une infobulle, parce
            // qu une reserve qui demande de survoler n est pas une
            // reserve. Les dix lignes concernees sont des runs qui n ont
            // jamais atteint l extraction, et non des noms perdus.
            <span
              data-role="nom-provisoire"
              title="Le pipeline n a jamais atteint l extraction sur ce dossier : aucun nom de societe n a ete produit."
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 9.5,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'var(--muted-soft)',
                whiteSpace: 'nowrap',
              }}
            >
              nom non extrait
            </span>
          )}
          {props.marqueurs}
        </div>
        <div
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 10.5,
            color: 'var(--muted)',
            letterSpacing: '0.02em',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta}
          {props.sourceFilename && (
            // Le nom du fichier compte presque pas. Il reste lisible pour
            // distinguer deux runs d une meme entite nourris par deux
            // documents, et il passe en dernier, dans l encre la plus
            // pale de la ligne.
            <span style={{ color: 'var(--muted-soft)' }}>
              {meta ? ' · ' : ''}{props.sourceFilename}
            </span>
          )}
          {props.metaSupplementaire}
        </div>
      </div>

      <div style={{ justifySelf: 'end' }}>
        {!verdictRedondant && (
          <span
            data-role="verdict"
            className={classeVerdict(props.verdict)}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              fontWeight: 700,
              background: paletteVerdict.fond,
              color: paletteVerdict.encre,
              border: `1px solid ${paletteVerdict.bordure}`,
              borderRadius: 999,
              fontFamily: 'var(--sans)',
              display: 'inline-block',
              whiteSpace: 'nowrap',
            }}
          >
            {verdict.libelle}
          </span>
        )}
      </div>

      <div
        data-role="reserve"
        style={{
          justifySelf: 'end',
          fontFamily: 'var(--sans)',
          fontSize: 10.5,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          minWidth: 88,
          textAlign: 'right',
          color: reserve ? reserve.encre : 'transparent',
          fontWeight: reserve ? reserve.poids : 400,
        }}
      >
        {reserve ? reserve.texte : ''}
      </div>

      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ textAlign: 'right', minWidth: 66 }}>
          {props.globalScore != null ? (
            <span
              data-role="score"
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {Math.round(props.globalScore)}
              <span style={{ fontSize: 10.5, color: 'var(--muted-soft)', fontWeight: 500 }}>/100</span>
            </span>
          ) : (
            // Une case vide est indiscernable d une colonne qui n a pas
            // fini de charger. Onze dossiers sur trente-neuf n ont pas de
            // score, et cela se dit.
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--muted-soft)' }}>
              sans score
            </span>
          )}
        </div>
        {props.children}
      </div>
    </div>
  );
}
