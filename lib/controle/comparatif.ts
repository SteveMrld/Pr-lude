// ============================================================
// COMPARATIF DE DEUX ANALYSES DU MEME DOSSIER
// ------------------------------------------------------------
// Prend deux `result_json` du meme dossier et rend, champ par champ, ce
// qui a bouge, de combien, et si cela avait le droit de bouger.
//
// POURQUOI CE MODULE EXISTE
//
// Le controleur de corpus mesure une propriete sur cinquante-deux notes.
// Il ne compare jamais deux notes entre elles. Toutes nos relectures
// comparaient une note a ce que le code devrait produire, jamais a la
// precedente du meme dossier, et c est pourquoi les trois incoherences
// trouvees entre le 3 et le 6 aout 2026 l ont toutes ete par un lecteur
// humain qui se souvenait du run d avant : la pre-money opposee a la
// valeur d entreprise, le compte de noms propres passant de 90 a 123.
//
// Une note lue seule est toujours coherente avec elle-meme. Ce qui la
// contredit vit dans une autre note, et rien ne les mettait en presence.
//
// CE QUI DECIDE QU UN ECART EST UN DEFAUT
//
// Tout signaler rendrait deux cents lignes que personne ne lirait, ce
// qui est exactement l etat ou le validateur d assertions s etait mis.
// Le partage est donc pose avant de comparer, et il n est pas invente
// ici : `GRAPHE_DETERMINISTE`, dans `scripts/replay-partial`, declare
// quels champs sont calcules et ce que chacun lit, et un test de
// mutation le verrouille en modifiant chaque entree declaree pour
// verifier que la sortie change. S en servir plutot que d ecrire un
// second partage evite deux declarations de la meme chose qui divergent
// le jour ou l une bouge.
//
// Trois natures, et la troisieme est celle qu on oublie :
//
//   derive      le champ est calcule par du TypeScript a partir
//               d entrees nommees. A code constant ET a entrees
//               constantes, il ne peut pas bouger. S il bouge, c est un
//               defaut, sans appreciation a porter.
//   llm         le champ est une sortie de modele. Il bouge par nature,
//               et le signaler serait du bruit.
//   non-classe  le champ n est dans aucune des deux listes. Il est
//               imprime comme tel et jamais tu, faute de quoi le
//               comparatif donnerait l air de fermer un perimetre qu il
//               ne couvre pas.
//
// ET LA QUESTION QUI PASSE AVANT TOUTES
//
// Deux runs a des commits differents ne sont pas deux tirages du meme
// systeme. Le comparatif lit donc `commitSha` et `enginesHash` avant
// tout le reste, et quand ils different il degrade chaque anomalie en
// « explique par le code » : ce n est plus une variance, c est un diff.
// ============================================================

import { GRAPHE_DETERMINISTE, MOTEURS_LLM } from '../../scripts/replay-partial';
import { fingerprintStamp } from '../instrumentation/version-stamp';

export type NatureDeChamp = 'derive' | 'llm' | 'non-classe';

export type VerdictDEcart =
  /** Calcule, il a bouge, aucune de ses entrees n a bouge. Defaut. */
  | 'anomalie'
  /** Calcule, il a bouge, une entree declaree a bouge aussi. */
  | 'explique-par-entree'
  /** Le code a change entre les deux runs : c est un diff, pas une variance. */
  | 'explique-par-code'
  /** Sortie de modele : bouger est sa nature. */
  | 'libre'
  /** Hors des deux listes : le comparatif ne sait pas trancher. */
  | 'non-classe'
  /** Identique. */
  | 'stable';

export interface EcartDeChamp {
  champ: string;
  nature: NatureDeChamp;
  verdict: VerdictDEcart;
  /** Nombre de feuilles qui different. Zero quand le champ est stable. */
  feuillesDifferentes: number;
  /** Les chemins qui different, bornes pour rester lisibles. */
  exemples: string[];
  /** Entrees declarees du champ qui ont bouge. Vide pour un champ libre. */
  entreesQuiOntBouge: string[];
  /** Delta signe quand les deux valeurs sont des nombres. */
  delta?: number;
}

export interface EtatDuCode {
  shaA: string | null;
  shaB: string | null;
  enginesHashA: string | null;
  enginesHashB: string | null;
  /**
   * True quand les deux runs ont rencontre le meme code. L empreinte
   * prime sur le sha : un commit qui ne touche que `docs/` change le
   * second et pas la premiere, et c est la premiere qui dit ce qui s est
   * execute.
   */
  memeCode: boolean;
  /** Ce qui a fonde le verdict, pour qu il se relise. */
  motif: string;
}

export interface Comparatif {
  code: EtatDuCode;
  ecarts: EcartDeChamp[];
  anomalies: EcartDeChamp[];
  nonClasses: string[];
}

const MAX_EXEMPLES = 6;

/** Les entrees declarees de chaque champ calcule. */
const LIT: Record<string, string[]> = Object.fromEntries(
  GRAPHE_DETERMINISTE.map((g) => [g.moteur, g.lit]),
);

function natureDe(champ: string): NatureDeChamp {
  if (LIT[champ]) return 'derive';
  if ((MOTEURS_LLM as readonly string[]).includes(champ)) return 'llm';
  return 'non-classe';
}

/**
 * Chemins des feuilles qui different entre deux valeurs.
 *
 * Le parcours descend dans les objets et les tableaux et s arrete a la
 * premiere valeur scalaire. Un tableau de longueurs differentes rend un
 * ecart par indice manquant, ce qui donne une magnitude et non un
 * booleen : c est le « de combien » que la lecture demande.
 */
export function feuillesQuiDifferent(a: unknown, b: unknown, prefixe = ''): string[] {
  if (a === b) return [];
  const scalaire = (x: unknown) => x === null || typeof x !== 'object';
  if (scalaire(a) || scalaire(b)) {
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [prefixe || '.'];
  }
  const out: string[] = [];
  if (Array.isArray(a) || Array.isArray(b)) {
    const ta = Array.isArray(a) ? a : [];
    const tb = Array.isArray(b) ? b : [];
    const n = Math.max(ta.length, tb.length);
    for (let i = 0; i < n; i++) out.push(...feuillesQuiDifferent(ta[i], tb[i], `${prefixe}[${i}]`));
    return out;
  }
  const oa = a as Record<string, unknown>;
  const ob = b as Record<string, unknown>;
  const clefs = new Set<string>();
  Object.keys(oa).forEach((k) => clefs.add(k));
  Object.keys(ob).forEach((k) => clefs.add(k));
  clefs.forEach((k) => {
    out.push(...feuillesQuiDifferent(oa[k], ob[k], prefixe ? `${prefixe}.${k}` : k));
  });
  return out;
}

/**
 * L empreinte de code d une analyse.
 *
 * L EMPREINTE SE CALCULE, ELLE NE SE LIT PAS
 *
 * La premiere version cherchait un champ `enginesHash` dans le stamp
 * persiste. Il n y en a pas, et le comparatif est donc sorti « empreinte
 * absente » sur les cinquante-quatre notes du corpus, se repliant en
 * silence sur le sha. La faute est celle du cachet preleve la ou la
 * valeur est declaree plutot que la ou elle est decidee : le stamp porte
 * les empreintes par moteur, et `fingerprintStamp` en derive
 * l `enginesHash`. Personne ne l ecrit dans la note, il se calcule.
 *
 * Le repli est conserve pour les notes anciennes dont le stamp est trop
 * pauvre pour que le calcul aboutisse, et il se declare.
 */
function stamp(note: any): { sha: string | null; engines: string | null } {
  const vs = note?.meta?.versionStamp ?? note?.versionStamp ?? null;
  if (!vs) return { sha: null, engines: null };
  let engines: string | null = null;
  try {
    if (vs.engines && vs.configs && vs.inputs && vs.models && vs.app) {
      engines = fingerprintStamp(vs).enginesHash;
    }
  } catch {
    engines = null;
  }
  return { sha: vs?.app?.commitSha ?? null, engines };
}

/**
 * Etat du code entre deux runs.
 *
 * La regle est celle de la discipline de conformite : une regle porte
 * sur ce qui produit le resultat, jamais sur ce qui date le depot. Quand
 * les deux empreintes de moteurs existent et coincident, le code est le
 * meme quel que soit le sha. Quand elles manquent, le sha sert de repli
 * et le motif le dit, pour que personne ne prenne l approximation pour
 * la mesure.
 */
export function comparerLeCode(a: any, b: any): EtatDuCode {
  const sa = stamp(a);
  const sb = stamp(b);
  let memeCode: boolean;
  let motif: string;
  if (sa.engines !== null && sb.engines !== null) {
    memeCode = sa.engines === sb.engines;
    motif = memeCode
      ? 'meme enginesHash : les deux runs ont rencontre le meme code'
      : 'enginesHash different : ce ne sont pas deux tirages du meme systeme';
  } else if (sa.sha !== null && sb.sha !== null) {
    memeCode = sa.sha === sb.sha;
    motif = `empreinte de moteurs absente d au moins un run, repli sur le sha (${memeCode ? 'identique' : 'different'}). `
      + 'Un sha date le depot entier, documentation comprise : il majore le changement.';
  } else {
    memeCode = false;
    motif = 'aucune empreinte lisible : le comparatif ne peut pas etablir que le code est le meme, donc il ne conclut a aucune anomalie';
  }
  return {
    shaA: sa.sha, shaB: sb.sha,
    enginesHashA: sa.engines, enginesHashB: sb.engines,
    memeCode, motif,
  };
}

/**
 * Compare deux analyses du meme dossier.
 *
 * `a` est le run ancien, `b` le recent. L ordre ne change aucun verdict,
 * il ne fixe que le signe des deltas.
 */
export function comparerAnalyses(a: any, b: any): Comparatif {
  const code = comparerLeCode(a, b);

  const champs = new Set<string>();
  Object.keys(a ?? {}).forEach((k) => champs.add(k));
  Object.keys(b ?? {}).forEach((k) => champs.add(k));

  // Quelles sections ont bouge, pour decider si un champ calcule qui a
  // bouge est explique par son entree ou non.
  const aBouge = new Map<string, boolean>();
  champs.forEach((c) => {
    aBouge.set(c, feuillesQuiDifferent(a?.[c], b?.[c]).length > 0);
  });

  const ecarts: EcartDeChamp[] = [];
  champs.forEach((champ) => {
    const feuilles = feuillesQuiDifferent(a?.[champ], b?.[champ]);
    const nature = natureDe(champ);
    const entrees = (LIT[champ] ?? []).filter((e) => aBouge.get(e) === true);

    let verdict: VerdictDEcart;
    if (feuilles.length === 0) {
      verdict = 'stable';
    } else if (nature === 'llm') {
      verdict = 'libre';
    } else if (nature === 'non-classe') {
      verdict = 'non-classe';
    } else if (!code.memeCode) {
      // Le code a bouge : l ecart mesure un diff et non une variance, et
      // aucune lecture ne peut faire la part des deux.
      verdict = 'explique-par-code';
    } else if (entrees.length > 0) {
      verdict = 'explique-par-entree';
    } else {
      verdict = 'anomalie';
    }

    const va = a?.[champ];
    const vb = b?.[champ];
    const delta = (typeof va === 'number' && typeof vb === 'number') ? vb - va : undefined;

    ecarts.push({
      champ, nature, verdict,
      feuillesDifferentes: feuilles.length,
      exemples: feuilles.slice(0, MAX_EXEMPLES),
      entreesQuiOntBouge: entrees,
      ...(delta === undefined ? {} : { delta }),
    });
  });

  ecarts.sort((x, y) => y.feuillesDifferentes - x.feuillesDifferentes);

  return {
    code,
    ecarts,
    anomalies: ecarts.filter((e) => e.verdict === 'anomalie'),
    nonClasses: ecarts.filter((e) => e.verdict === 'non-classe').map((e) => e.champ),
  };
}

/**
 * Rendu lisible d un comparatif.
 *
 * Ne rend pas les champs stables ni les champs libres : ils sont
 * comptes en une ligne. Ce qui se lit est l anomalie, l explique, et le
 * non-classe, dans cet ordre.
 */
export function rendreComparatif(c: Comparatif, titre = ''): string {
  const l: string[] = [];
  if (titre) l.push(titre);
  l.push(`code : ${c.code.motif}`);
  l.push(`  sha ${(c.code.shaA ?? 'absent').slice(0, 7)} -> ${(c.code.shaB ?? 'absent').slice(0, 7)}`
    + `   enginesHash ${(c.code.enginesHashA ?? 'absent').slice(0, 10)} -> ${(c.code.enginesHashB ?? 'absent').slice(0, 10)}`);
  l.push('');

  const par = (v: VerdictDEcart) => c.ecarts.filter((e) => e.verdict === v);

  const anomalies = par('anomalie');
  if (anomalies.length === 0) {
    l.push(c.code.memeCode
      ? 'AUCUNE ANOMALIE : aucun champ calcule n a bouge sans qu une de ses entrees bouge.'
      : 'AUCUNE ANOMALIE POSSIBLE : le code a change, donc rien ne se lit comme une variance.');
  } else {
    l.push(`${anomalies.length} ANOMALIE(S) : champ calcule, code constant, entrees constantes, sortie differente.`);
    for (const e of anomalies) {
      l.push(`  ${e.champ}  ${e.feuillesDifferentes} feuille(s)${e.delta !== undefined ? `  delta ${e.delta > 0 ? '+' : ''}${e.delta}` : ''}`);
      for (const x of e.exemples) l.push(`      ${x}`);
    }
  }
  l.push('');

  const expliques = [...par('explique-par-entree'), ...par('explique-par-code')];
  if (expliques.length) {
    l.push(`${expliques.length} ecart(s) explique(s) :`);
    for (const e of expliques) {
      const par2 = e.verdict === 'explique-par-code'
        ? 'le code a change'
        : `entree(s) qui ont bouge : ${e.entreesQuiOntBouge.join(', ')}`;
      l.push(`  ${e.champ}  ${e.feuillesDifferentes} feuille(s)   ${par2}`);
    }
    l.push('');
  }

  if (c.nonClasses.length) {
    l.push(`${c.nonClasses.length} champ(s) NON CLASSES, ni calcules ni sortie de modele au sens du graphe.`);
    l.push('Le comparatif ne tranche pas dessus, et il le dit plutot que de les taire :');
    for (const e of par('non-classe')) {
      l.push(`  ${e.champ}  ${e.feuillesDifferentes} feuille(s)${e.delta !== undefined ? `  delta ${e.delta > 0 ? '+' : ''}${e.delta}` : ''}`);
    }
    l.push('');
  }

  const stables = par('stable').length;
  const libres = par('libre').length;
  l.push(`${stables} champ(s) identiques, ${libres} champ(s) de modele qui ont bouge (attendu, non detaille).`);
  return l.join('\n');
}
