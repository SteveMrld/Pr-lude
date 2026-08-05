// ============================================================
// CONTROLEUR DE CORPUS
// ------------------------------------------------------------
// Evalue le catalogue de proprietes sur un ensemble de notes et rend un
// verdict par propriete, avec ce que la violation prouve.
//
// CE QU IL FAIT QUE LES TROIS OUTILS EXISTANTS NE FONT PAS
//
// Il conclut. `engine-stability` rend une dispersion, `replay-partial`
// rend un JSON, les fixtures rendent des attentes : les trois demandent
// une lecture pour qu on sache si quelque chose ne va pas, donc les
// trois depensent l attention qu ils devaient economiser. Ici un defaut
// s ecrit une fois comme propriete et se paie une fois : il est evalue
// sur toutes les notes, a chaque passage, sans qu on le relise.
//
// CE QU IL REFUSE DE MELANGER
//
// Une violation ne prouve pas la meme chose selon ce que la propriete
// lit, et confondre les trois cas ferait mesurer l etat des notes
// anciennes en croyant mesurer le produit.
//
// Une propriete de structure lit une sortie deterministe. Sur une note
// reassemblee par un rejeu, elle mesure le code d aujourd hui, et son
// taux est directement lisible.
//
// Une propriete de prose lit un texte produit par le modele. Elle
// mesure le code du jour ou le run a eu lieu, jamais celui
// d aujourd hui. Son taux global n a donc aucun sens : il est rendu
// segmente par empreinte de code, et le segment courant est le seul qui
// parle du produit. C est la meme regle que pour la variance : deux runs
// a des commits differents ne sont pas deux tirages du meme systeme.
//
// Une propriete d instrumentation lit ce que le run a depose sur
// lui-meme. Elle mesure la couche de persistance, et son taux bascule
// d un coup le jour ou le champ est ecrit.
//
// LE PLANCHER QU IL ANNONCE
//
// Une propriete non portee n est pas une propriete respectee. Le releve
// distingue les deux et imprime les deux : une propriete portee par
// zero note n a rien etabli, et la lire comme un succes est la faute que
// tout ce dispositif existe pour empecher.
// ============================================================

import { PROPRIETES, type Propriete, type Constat, type Famille } from './proprietes';
import { fingerprintStamp } from '../instrumentation/version-stamp';

export interface NoteControlee {
  /** Identifiant court, pour retrouver la note. */
  id: string;
  /** Ce qui la nomme pour un humain. */
  libelle: string;
  /** Le result_json. */
  note: any;
}

export interface ViolationRelevee {
  noteId: string;
  libelle: string;
  constats: Constat[];
}

export interface ReleveDePropriete {
  propriete: Propriete;
  /** Notes portant de quoi evaluer. */
  portee: number;
  /** Notes en violation. */
  violees: number;
  /** Taux, null quand la propriete n est portee par aucune note. */
  taux: number | null;
  violations: ViolationRelevee[];
  /** Pour les proprietes de prose : le taux par empreinte de code. */
  parSegment: Array<{ segment: string; portee: number; violees: number; runs: string[] }>;
}

export interface ReleveDeCorpus {
  notes: number;
  /** Notes reassemblees par un rejeu partiel, dont la prose est ancienne. */
  rejeux: number;
  releves: ReleveDePropriete[];
  /** Empreintes de code rencontrees, de la plus recente a la plus ancienne. */
  segments: string[];
  dureeMs: number;
}

/**
 * Empreinte du code qui a produit la prose d une note.
 *
 * `doctrineHash` couvre les prompts systeme et `enginesHash` les
 * modeles, temperatures et sources par moteur. Deux notes qui les
 * partagent ont rencontre le meme code, quel que soit leur sha. C est le
 * meme objet de comparaison que la conformite de relecture, et pour la
 * meme raison : un sha date le depot entier, documentation comprise.
 *
 * L empreinte se CALCULE et ne se lit pas. Le premier jet lisait
 * `versionStamp.enginesHash`, qui n existe pas : le stamp persiste porte
 * `engines` comme une table par moteur, et le hachage est produit par
 * `fingerprintStamp`. Le releve rendait donc des segments en points
 * d interrogation sans que rien n echoue, ce qui est exactement le
 * genre de mesure juste sur le mauvais support que la doctrine decrit.
 */
export function segmentDeCode(note: any): string {
  const s = note?.meta?.versionStamp;
  if (!s?.app || !s?.engines) return 'sans-empreinte';
  try {
    const f = fingerprintStamp(s);
    return `${String(f.doctrineHash).slice(0, 8)}/${String(f.enginesHash).slice(0, 8)}`;
  } catch {
    return 'empreinte-illisible';
  }
}

/** Vrai quand la note a ete reassemblee hors run par un rejeu partiel. */
export function estUnRejeu(note: any): boolean {
  return !!note?.meta?.rejeuPartiel;
}

/**
 * Evalue le catalogue sur un corpus.
 *
 * Pure : ne lit ni la base, ni le reseau, ni le disque. C est ce qui
 * la rend verrouillable par un test, et c est la raison pour laquelle
 * elle est exportee plutot qu enfouie dans la commande.
 */
export function controler(
  corpus: NoteControlee[],
  catalogue: Propriete[] = PROPRIETES,
): ReleveDeCorpus {
  const t0 = Date.now();
  const segments = new Set<string>();
  let rejeux = 0;
  for (const c of corpus) {
    segments.add(segmentDeCode(c.note));
    if (estUnRejeu(c.note)) rejeux++;
  }

  const releves: ReleveDePropriete[] = catalogue.map((p) => {
    let portee = 0;
    let violees = 0;
    const violations: ViolationRelevee[] = [];
    const parSegment = new Map<string, { portee: number; violees: number; runs: string[] }>();

    for (const c of corpus) {
      let applicable = false;
      try { applicable = !!p.porte(c.note); } catch { applicable = false; }
      if (!applicable) continue;
      portee++;

      const seg = segmentDeCode(c.note);
      const s = parSegment.get(seg) ?? { portee: 0, violees: 0, runs: [] };
      s.portee++;

      let constats: Constat[] = [];
      // Une propriete qui leve est un defaut de la propriete, pas de la
      // note. Elle ne compte pas comme violation, faute de quoi un bug
      // du controleur se lirait comme un defaut du produit.
      try { constats = p.constats(c.note) ?? []; } catch { constats = []; }
      if (constats.length > 0) {
        violees++;
        s.violees++;
        s.runs.push(c.id);
        violations.push({ noteId: c.id, libelle: c.libelle, constats });
      }
      parSegment.set(seg, s);
    }

    return {
      propriete: p,
      portee,
      violees,
      taux: portee > 0 ? violees / portee : null,
      violations,
      parSegment: Array.from(parSegment.entries())
        .map(([segment, v]) => ({ segment, ...v }))
        .sort((a, b) => b.portee - a.portee),
    };
  });

  return {
    notes: corpus.length,
    rejeux,
    releves,
    segments: Array.from(segments),
    dureeMs: Date.now() - t0,
  };
}

/** Ce que la violation d une propriete de cette famille etablit. */
export function portee(famille: Famille): string {
  switch (famille) {
    case 'structure':
      return 'sortie deterministe : la violation porte sur le code actuel';
    case 'prose':
      return 'texte du modele : la violation porte sur le code du run, a lire par segment';
    case 'instrumentation':
      return 'trace du run sur lui-meme : la violation porte sur la persistance';
  }
}

/**
 * Rend le releve en texte, pour la commande.
 *
 * Le format est celui d un verdict et non d un tableau a interpreter :
 * chaque ligne dit conforme ou non, et une propriete non portee le dit
 * explicitement plutot que de se lire comme conforme.
 */
export function formater(r: ReleveDeCorpus, options?: { detail?: boolean }): string {
  const L: string[] = [];
  L.push(`CONTROLE DE CORPUS — ${r.notes} note(s), ${r.dureeMs} ms, zero appel au modele.`);
  if (r.rejeux > 0) {
    L.push(`${r.rejeux} note(s) reassemblee(s) par rejeu : leurs sections deterministes viennent du code actuel, leur prose du run d origine.`);
  }
  L.push(`${r.segments.length} empreinte(s) de code dans le corpus.`);
  L.push('');

  const nonPortees = r.releves.filter((x) => x.portee === 0);
  const conformes = r.releves.filter((x) => x.portee > 0 && x.violees === 0);
  const violees = r.releves.filter((x) => x.violees > 0);

  L.push(`${violees.length} propriete(s) en defaut, ${conformes.length} conforme(s), ${nonPortees.length} non portee(s).`);
  L.push('');

  for (const x of violees) {
    const pct = Math.round((x.taux ?? 0) * 100);
    L.push(`EN DEFAUT  ${x.propriete.id}`);
    L.push(`  ${x.propriete.enonce}`);
    L.push(`  ${x.violees}/${x.portee} notes, ${pct}%  —  ${portee(x.propriete.famille)}`);
    if (x.propriete.famille === 'prose' && x.parSegment.length > 1) {
      L.push('  par empreinte de code, le segment courant etant le seul qui parle du produit :');
      for (const s of x.parSegment) L.push(`    ${s.segment}  ${s.violees}/${s.portee}`);
    }
    if (options?.detail) {
      for (const v of x.violations.slice(0, 6)) {
        L.push(`    ${v.noteId}  ${v.libelle}`);
        for (const c of v.constats.slice(0, 3)) L.push(`        ${c.ou} — ${c.extrait.replace(/\s+/g, ' ').slice(0, 150)}`);
      }
      if (x.violations.length > 6) L.push(`    ... et ${x.violations.length - 6} note(s) de plus`);
    }
    L.push('');
  }

  for (const x of conformes) {
    L.push(`conforme   ${x.propriete.id}  ${x.portee}/${x.portee}`);
  }
  for (const x of nonPortees) {
    L.push(`NON PORTEE ${x.propriete.id}  aucune note ne porte de quoi evaluer : rien n est etabli`);
  }
  return L.join('\n');
}
