// ============================================================
// LA TOILE RETROSPECTIVE : CE QU UN RUN A REELLEMENT FAIT
// ------------------------------------------------------------
// La toile existante rend une topologie et quatre etats de run vivant,
// idle, running, done, error, passes en prop. Elle ne dit rien d une
// note deja produite : elle ne sait ni pourquoi un moteur n a pas
// produit, ni combien de temps il a pris, ni lequel a eteint les
// suivants.
//
// Ce module derive tout cela d une note persistee, et rien n y est
// dessine a la main. Il ne fait aucun appel : la matiere existe deja
// dans `pipeline_engines_status`, qui est ecrit par le recorder a
// chaque run depuis la brique 3.
//
// QUATRE ETATS QUI NE SE VALENT PAS, ET C EST TOUT L INTERET. Un moteur
// qui n a pas produit peut l avoir fait pour quatre raisons qui
// appellent quatre reponses opposees, et les rendre du meme gris
// reviendrait a dire qu on ne sait pas laquelle. Le vocabulaire du
// recorder les distingue deja, il suffit de ne pas les aplatir :
//
//   `ok`                     -> abouti, le moteur a rendu son analyse
//   `skipped_not_applicable` -> ecarte par doctrine, la question ne se
//                               posait pas sur ce dossier. Ce n est pas
//                               un defaut et le recorder le dit en le
//                               tenant hors de GAP_STATUSES.
//   `failed`, `timeout`      -> tombe en incident, quelque chose a casse
//   `empty_output`           -> non conclusif, le moteur a repondu sans
//                               son champ minimal
//   `failed-upstream`        -> eteint par cascade, il n a jamais ete
//                               appele parce qu un amont manquait
//   `inconnu` ou absent      -> non instrumente, et ce n est pas une
//                               panne : une valeur par defaut ne peut
//                               pas appartenir au vocabulaire de
//                               l accusation.
//
// LA CASCADE SE DERIVE DES FAITS. Un moteur eteint ne porte pas le nom
// de celui qui l a eteint : le recorder ecrit `failed-upstream` et rien
// d autre. La cause se retrouve en descendant le graphe declare, celui
// que la topologie porte deja et qu un test verrouille, et en retenant
// ceux de ses ancetres qui ont reellement echoue. Elle n est donc jamais
// dessinee ni supposee, et un moteur ajoute demain a la topologie entre
// dans le calcul sans qu on y pense.
//
// LES CLEFS DU RECORDER NE SONT PAS CELLES DE LA TOPOLOGIE, et c est un
// piege qui rendrait une toile entierement vide sans rien signaler. Le
// recorder ecrit `financialData`, `patternMatching`,
// `fragiliteStructurelle` ; la topologie dit `financial-extraction`,
// `pattern`, `fragility-structurelle`. Le pont existe deja dans
// `ENGINE_TO_RESULT_KEY` et se lit a l envers plutot que de se recopier.
// ============================================================

import { ENGINE_TO_RESULT_KEY } from './result-mapping';

export type EtatNoeud =
  | 'abouti'
  | 'ecarte-doctrine'
  | 'incident'
  | 'non-conclusif'
  | 'eteint-cascade'
  | 'non-instrumente';

/**
 * Pourquoi la toile entiere est vide, quand elle l est.
 *
 * Les quatre cas ne se rendent pas du meme gris : le premier est une
 * lacune du dispositif, le deuxieme et le troisieme sont des faits du
 * dossier, et le quatrieme n est pas un vide mais la norme.
 */
export type EtatVide =
  | 'instrumentation-absente'
  | 'run-tombe-avant-instruction'
  | 'ecarte-au-prescan'
  | null;

export type NoeudRetrospectif = {
  id: string;
  etat: EtatNoeud;
  /** Duree observee, en millisecondes. Null quand rien n a ete mesure. */
  dureeMs: number | null;
  /**
   * Les moteurs dont l echec explique l extinction de celui-ci.
   * Vide sur tout etat autre que la cascade.
   */
  causeAmont: string[];
  /** Le statut brut du recorder, conserve pour l infobulle. */
  statutBrut: string | null;
};

export type ToileRetrospective = {
  noeuds: NoeudRetrospectif[];
  vide: EtatVide;
  /** Combien de noeuds de la topologie portent une mesure. */
  instrumentes: number;
  /**
   * Combien de moteurs etaient attendus sur ce parcours. Jamais le
   * nombre de mesures recues : un total derive du numerateur ne peut
   * pas signaler un manque.
   */
  total: number;
  /**
   * Faux quand le parcours n a pas ete enregistre. Le total est alors
   * celui de la topologie entiere, et la surface doit le dire plutot que
   * de laisser lire un denominateur exact.
   */
  parcoursConnu: boolean;
  /** Somme des durees mesurees, en millisecondes. */
  dureeTotaleMs: number;
};

const ETAT_PAR_STATUT: Record<string, EtatNoeud> = {
  ok: 'abouti',
  skipped_not_applicable: 'ecarte-doctrine',
  failed: 'incident',
  timeout: 'incident',
  empty_output: 'non-conclusif',
  'failed-upstream': 'eteint-cascade',
  inconnu: 'non-instrumente',
};

/**
 * La table du recorder vers la topologie, lue a l envers de celle qui
 * existe. Une seule definition, donc une seule chose a corriger.
 */
function clefRecorderVersTopologie(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [idTopologie, clefResultat] of Object.entries(ENGINE_TO_RESULT_KEY)) {
    out[String(clefResultat)] = idTopologie;
  }
  return out;
}

export type EntreeRecorder = { status?: string; durationMs?: number } | string | null | undefined;

/**
 * Normalise le releve du recorder en une table indexee par id de
 * topologie. Les clefs qu aucun noeud ne porte, `preScan`, `valuation`,
 * `indicators`, restent dehors : elles existent en production et ne sont
 * pas des noeuds de la toile.
 */
export function releveParNoeud(
  pipelineEnginesStatus: Record<string, EntreeRecorder> | null | undefined,
): Record<string, { statut: string; dureeMs: number | null }> {
  const pont = clefRecorderVersTopologie();
  const out: Record<string, { statut: string; dureeMs: number | null }> = {};
  if (!pipelineEnginesStatus || typeof pipelineEnginesStatus !== 'object') return out;
  for (const [clef, valeur] of Object.entries(pipelineEnginesStatus)) {
    const id = pont[clef] || clef;
    const statut = typeof valeur === 'string' ? valeur : String(valeur?.status ?? '');
    if (!statut) continue;
    const duree = typeof valeur === 'object' && valeur && typeof valeur.durationMs === 'number'
      ? valeur.durationMs
      : null;
    out[id] = { statut, dureeMs: duree };
  }
  return out;
}

/**
 * Les ancetres directs d un noeud dont l etat explique son extinction.
 *
 * On remonte d un cran seulement : un moteur eteint par cascade l est
 * par ses dependances immediates, et si celles-ci sont elles-memes
 * eteintes elles portent leur propre cause. Nommer l origine lointaine
 * ferait remonter la meme faute sur quinze noeuds et noierait celui qui
 * a reellement casse.
 */
function causesDirectes(
  deps: string[],
  etats: Record<string, EtatNoeud>,
): string[] {
  return deps.filter((d) => {
    const e = etats[d];
    return e === 'incident' || e === 'non-conclusif' || e === 'eteint-cascade' || e === 'non-instrumente';
  });
}

export type NoeudTopologie = { id: string; deps: string[] };

export type Parcours = 'early' | 'growth';

/**
 * Les moteurs que le parcours growth neutralise, lus dans la route.
 *
 * `team`, `pattern`, `blindspot` et `causal` y rendent une sortie de
 * neutralisation au lieu d appeler le modele. Ils sont donc attendus en
 * early et pas en growth, et c est cette difference qui fait le
 * denominateur.
 *
 * La liste tranche plutot qu elle ne constate, et elle se date pour
 * cette raison : le contenu d une neutralisation doctrinale ne se deduit
 * d aucune propriete observable, il se decide. Le verrou la confronte
 * neanmoins a la route, pour qu une cinquieme neutralisation ajoutee
 * demain fasse rougir plutot que de fausser un compte en silence.
 */
export const NEUTRALISES_EN_GROWTH = ['team', 'pattern', 'blindspot', 'causal'] as const;

/**
 * Les moteurs attendus sur un parcours.
 *
 * LE DENOMINATEUR EST CE QUI EST ATTENDU, JAMAIS CE QUI A REPONDU. Un
 * rapport dont le total se calcule sur ce qui a repondu est toujours
 * complet, et il rassure d autant plus qu il est faux. Le pre-scan tient
 * deja cette forme avec `totalTests = attendus.length`.
 *
 * Le parcours peut etre inconnu, et il l est sur les runs anterieurs au
 * 8 aout 2026 : il etait lu a l entree de la route et jamais persiste.
 * Le repli est alors le total declare, qui se trompe dans le sens qui
 * montre un manque plutot que dans celui qui le cache.
 */
export function moteursAttendus(
  topologie: NoeudTopologie[],
  parcours: Parcours | null | undefined,
): { ids: string[]; parcoursConnu: boolean } {
  if (parcours !== 'growth' && parcours !== 'early') {
    return { ids: topologie.map(n => n.id), parcoursConnu: false };
  }
  if (parcours === 'early') return { ids: topologie.map(n => n.id), parcoursConnu: true };
  const hors = new Set<string>(NEUTRALISES_EN_GROWTH as readonly string[]);
  return { ids: topologie.map(n => n.id).filter(id => !hors.has(id)), parcoursConnu: true };
}

/**
 * Construit la toile retrospective d une note.
 *
 * `statutDuRun` sert uniquement a distinguer les vides entre eux : un
 * run tombe avant d instruire et un dossier ecarte au pre-scan rendent
 * tous deux zero noeud mesure, et ce sont deux faits opposes.
 */
export function construireToileRetrospective(
  topologie: NoeudTopologie[],
  pipelineEnginesStatus: Record<string, EntreeRecorder> | null | undefined,
  statutDuRun: string | null | undefined,
  parcours?: Parcours | null,
): ToileRetrospective {
  const attendus = moteursAttendus(topologie, parcours);
  const attendusSet = new Set(attendus.ids);
  const releve = releveParNoeud(pipelineEnginesStatus);

  const etats: Record<string, EtatNoeud> = {};
  for (const n of topologie) {
    const r = releve[n.id];
    etats[n.id] = r ? (ETAT_PAR_STATUT[r.statut] || 'non-instrumente') : 'non-instrumente';
  }

  const noeuds: NoeudRetrospectif[] = topologie.map((n) => {
    const r = releve[n.id];
    const etat = etats[n.id];
    return {
      id: n.id,
      etat,
      dureeMs: r && r.dureeMs != null && r.dureeMs > 0 ? r.dureeMs : null,
      causeAmont: etat === 'eteint-cascade' ? causesDirectes(n.deps, etats) : [],
      statutBrut: r ? r.statut : null,
    };
  });

  // Le numerateur ne compte que des moteurs attendus : un moteur hors
  // parcours qui aurait depose une mesure ne doit pas gonfler le
  // rapport au-dela de son propre denominateur.
  const instrumentes = noeuds.filter(
    x => x.etat !== 'non-instrumente' && attendusSet.has(x.id),
  ).length;
  const dureeTotaleMs = noeuds.reduce((s, x) => s + (x.dureeMs || 0), 0);

  // LE VIDE SE QUALIFIE, IL NE SE CONSTATE PAS. Zero noeud mesure a
  // trois causes qui appellent trois reponses, et la quatrieme
  // situation, le releve partiel, n est pas un vide du tout : c est
  // l etat courant de quarante et une notes sur soixante-six.
  let vide: EtatVide = null;
  if (instrumentes === 0) {
    if (statutDuRun === 'knockout') vide = 'ecarte-au-prescan';
    else if (statutDuRun === 'failed') vide = 'run-tombe-avant-instruction';
    else vide = 'instrumentation-absente';
  }

  return {
    noeuds, vide, instrumentes,
    total: attendus.ids.length,
    parcoursConnu: attendus.parcoursConnu,
    dureeTotaleMs,
  };
}

/** Libelle court d une duree, pour un noeud de quelques centimetres. */
export function libelleDuree(ms: number | null): string {
  if (ms == null || ms <= 0) return '';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  const m = Math.floor(s / 60);
  const reste = Math.round(s - m * 60);
  return `${m} min ${String(reste).padStart(2, '0')}`;
}
