// ============================================================
// STYLE-CONSERVATION : aucune regle CSS perdue, dupliquee ou orpheline
// ------------------------------------------------------------
// Ecrit le 7 aout 2026 comme prealable au chantier de decoupage, avant
// la premiere extraction.
//
// POURQUOI CE CONTROLE EXISTE
//
// styled-jsx scope ses regles au composant qui les declare. Une section
// deplacee dans un composant enfant perd donc le style que le parent lui
// appliquait, et elle le perd en silence : pas d erreur, pas de test
// rouge, une note qui sort sans mise en forme. Le depot en porte la
// preuve empirique plutot que la supposition : quand SectoralRadar a ete
// extrait de InvestmentNoteView, ses deux classes ont du partir avec lui
// dans son propre bloc de style, et le bloc du parent n en porte plus
// aucune trace.
//
// Le harnais de comparaison HTML ne voit rien de ces deplacements,
// puisqu il compare des balises sans style. Sur cet axe precis il rend
// vert quoi qu on fasse aux regles, ce qui en fait une garde inerte.
//
// CE QUE CE CONTROLE COUVRE
//
// Trois fautes, qui sont les trois modes de defaillance d une
// extraction.
//
//   perdue     : une regle presente avant ne l est plus nulle part.
//   dupliquee  : une regle vit desormais dans deux composants, ce qui
//                la rend impossible a corriger en un endroit.
//   orpheline  : une regle reste chez un composant qui ne rend plus
//                l element qu elle vise. C est la faute silencieuse par
//                excellence, puisque le CSS reste present et inerte.
//
// CE QU IL NE COUVRE PAS, ET IL FAUT LE DIRE
//
// Il ne prouve pas que le navigateur rend a l identique. Une regle
// conservee, non dupliquee et rendue dans le bon composant peut encore
// s appliquer differemment si la cascade change, si une specificite est
// modifiee, ou si un selecteur descendant traverse desormais une
// frontiere de composant. Ce controle borne le deplacement de regles,
// pas la mise en forme resultante. La seule mesure du rendu reel reste
// une lecture humaine ou un rendu par Next, et ce controle ne la
// remplace pas.
//
// Usage :
//   npx tsx scripts/style-conservation.ts capture <fichier.json>
//   npx tsx scripts/style-conservation.ts comparer <avant.json>
// ============================================================

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Perimetre : la note et tout ce qui vit sous app/components/note.
 * Il se derive du disque et non d une liste ecrite a la main, faute de
 * quoi un composant extrait demain sortirait du controle sans que rien
 * ne le signale, ce qui est exactement la faute que le controle traque.
 */
function fichiersDuPerimetre(): string[] {
  const out = ['app/components/InvestmentNoteView.tsx'];
  const racines = ['app/components/note'];
  for (const r of racines) {
    let entrees: string[];
    try { entrees = readdirSync(r); } catch { continue; }
    for (const e of entrees) {
      const p = join(r, e);
      if (statSync(p).isDirectory()) {
        for (const f of readdirSync(p)) {
          if (f.endsWith('.tsx') && !f.includes('.test.')) out.push(join(p, f));
        }
      } else if (e.endsWith('.tsx') && !e.includes('.test.')) {
        out.push(p);
      }
    }
  }
  return out.sort();
}

/**
 * Blocs `<style jsx>{` ... `}</style>` d un fichier, avec le composant
 * qui les declare.
 *
 * La portee est le bloc et non le fichier, parce que styled-jsx scope
 * au composant declarant. Un meme fichier peut en porter plusieurs :
 * InvestmentNoteView.tsx en compte trois, dont deux appartiennent a des
 * composants auxiliaires definis au-dessus. Grouper par fichier faisait
 * lire `.note-h4` comme declaree deux fois en conflit alors que les deux
 * declarations vivent dans deux portees distinctes et ne se rencontrent
 * jamais. C etait un faux positif de ce controle, trouve le 7 aout 2026
 * en cherchant des divergences reelles.
 */
function blocsDeStyle(src: string, fichier: string): Array<{ portee: string; css: string }> {
  const out: Array<{ portee: string; css: string }> = [];
  const marqueur = /<style\s+jsx(?:\s+global)?\s*>\{`/g;
  let m: RegExpExecArray | null;
  while ((m = marqueur.exec(src)) !== null) {
    const debut = m.index + m[0].length;
    const fin = src.indexOf('`}', debut);
    if (fin === -1) continue;
    // Le composant porteur est la derniere declaration de fonction
    // rencontree avant le bloc.
    const avant = src.slice(0, m.index);
    const noms = Array.from(avant.matchAll(/^(?:export\s+default\s+)?function\s+(\w+)/gm));
    const porteur = noms.length > 0 ? noms[noms.length - 1][1] : '(module)';
    out.push({ portee: `${fichier}::${porteur}`, css: src.slice(debut, fin) });
    marqueur.lastIndex = fin;
  }
  return out;
}

export interface Regle {
  /** Contexte d encadrement, `@media ...` ou chaine vide. */
  contexte: string;
  selecteur: string;
  /**
   * Declarations normalisees et TRIEES, jointes par `;`. Le tri sert la
   * comparaison de conservation, ou un reordonnancement sans changement
   * de valeur ne doit pas compter comme un ecart.
   */
  corps: string;
  /**
   * Les memes declarations dans l ORDRE DE LA SOURCE. Indispensable et
   * distinct du champ precedent : la cascade se decide par l ordre, et
   * `corps` l a detruit. Les confondre faisait annoncer la mauvaise
   * valeur gagnante sur `.action-list li`, ou `font-size: 14px` precede
   * `font-size: 12px` dans le meme bloc et ou c est 12px qui s applique.
   * Un controle qui repond a la question « laquelle s applique » et qui
   * y repond faux est pire que celui qui se tait.
   */
  ordreSource: string[];
}

function normaliserDeclarations(corps: string): string {
  return corps
    .split(';')
    .map(d => d.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .sort()
    .join(';');
}

/**
 * Extrait les regles d un bloc de style. Gere un niveau d encadrement,
 * ce qui couvre `@media` et `@supports` ; le bloc de la note n en porte
 * pas d autre, et un encadrement non reconnu leve plutot que d etre
 * ignore, parce qu une regle silencieusement non lue rendrait le
 * controle vert sur un sous-ensemble.
 */
export function extraireRegles(bloc: string): Regle[] {
  const regles: Regle[] = [];
  const sansCommentaires = bloc.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  let contexte = '';
  while (i < sansCommentaires.length) {
    const ouvre = sansCommentaires.indexOf('{', i);
    if (ouvre === -1) break;
    const tete = sansCommentaires.slice(i, ouvre).trim();
    // Fin d un encadrement : la tete est vide et on rencontre `}`.
    const ferme = trouverFermeture(sansCommentaires, ouvre);
    if (ferme === -1) break;
    const corps = sansCommentaires.slice(ouvre + 1, ferme);
    if (tete.startsWith('@')) {
      if (contexte) throw new Error(`encadrement imbrique non gere : ${tete}`);
      for (const r of extraireRegles(corps)) {
        regles.push({ ...r, contexte: tete.replace(/\s+/g, ' ') });
      }
    } else if (tete) {
      for (const sel of tete.split(',')) {
        const s = sel.replace(/\s+/g, ' ').trim();
        if (s) regles.push({
          contexte, selecteur: s,
          corps: normaliserDeclarations(corps),
          ordreSource: corps.split(';').map(d => d.replace(/\s+/g, ' ').trim()).filter(Boolean),
        });
      }
    }
    i = ferme + 1;
  }
  return regles;
}

function trouverFermeture(s: string, ouvre: number): number {
  let profondeur = 0;
  for (let i = ouvre; i < s.length; i++) {
    if (s[i] === '{') profondeur++;
    else if (s[i] === '}') { profondeur--; if (profondeur === 0) return i; }
  }
  return -1;
}

/** Les classes citees en `className` d un fichier, litteraux compris. */
function classesRendues(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of Array.from(src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g))) {
    const brut = m[1] ?? m[2] ?? m[3] ?? '';
    for (const c of brut.split(/[\s${}?:'"()|&]+/)) {
      const t = c.trim();
      if (t && /^[a-zA-Z][\w-]*$/.test(t)) out.add(t);
    }
  }
  return out;
}

/** Les classes qu un selecteur vise. */
function classesDuSelecteur(sel: string): string[] {
  return Array.from(sel.matchAll(/\.([a-zA-Z][\w-]*)/g)).map(m => m[1]);
}

export interface Divergence {
  portee: string;
  selecteur: string;
  contexte: string;
  propriete: string;
  /** Valeurs successives dans l ordre de la source. */
  valeurs: string[];
  /** Celle qui s applique : la derniere a specificite egale. */
  appliquee: string;
  /** Celles qui ne s appliquent pas, et qui sont donc le piege. */
  inatteignables: string[];
}

/**
 * Relation parent-enfant entre fichiers du perimetre, derivee des
 * imports et non declaree a la main.
 *
 * C est le seul axe ou une meme regle dans deux portees signifie
 * quelque chose. Entre un parent et un composant qu il rend, elle
 * signale une regle recopiee au lieu d etre deplacee, ce qui la rend
 * impossible a corriger en un endroit. Entre deux composants sans
 * rapport, c est une homonymie : deux `.section-title` qui ne se
 * rencontrent jamais, puisque styled-jsx les scope chacun au sien.
 * Compter la seconde comme la premiere ferait du bruit a chaque
 * extraction, et une divergence reelle s y noierait.
 */
function relationsParentEnfant(
  fichiers: string[],
  lire: (f: string) => string,
): Record<string, string[]> {
  const rel: Record<string, string[]> = {};
  for (const f of fichiers) {
    const src = lire(f);
    const enfants: string[] = [];
    for (const autre of fichiers) {
      if (autre === f) continue;
      const base = autre.split('/').pop()!.replace(/\.tsx$/, '');
      if (new RegExp(`from\\s+['"\`][^'"\`]*${base}['"\`]`).test(src)) enfants.push(autre);
    }
    rel[f] = enfants;
  }
  return rel;
}

/** Deux portees sont-elles en relation de rendu, dans un sens ou dans l autre. */
function enRelation(a: string, b: string, rel: Record<string, string[]>): boolean {
  const fa = a.split('::')[0], fb = b.split('::')[0];
  if (fa === fb) return true;
  return (rel[fa] || []).includes(fb) || (rel[fb] || []).includes(fa);
}

export interface Releve {
  fichiers: string[];
  portees: string[];
  relations: Record<string, string[]>;
  /** clef `contexte|selecteur|corps` -> portees qui la portent. */
  regles: Record<string, string[]>;
  /** Regles dont aucune classe visee n est rendue par leur fichier. */
  orphelines: Array<{ fichier: string; selecteur: string; contexte: string }>;
  /** Meme propriete declaree plusieurs fois pour un meme selecteur dans
   *  une meme portee, avec des valeurs qui different. */
  divergences: Divergence[];
}

/**
 * Divergences au sein d une portee. Ce n est pas la repetition d un
 * selecteur qui compte, une regle groupee suivie d une regle specifique
 * etant une superposition normale et voulue. Ce qui compte est qu une
 * meme PROPRIETE recoive deux valeurs differentes pour le meme
 * selecteur : l une s applique, les autres sont inatteignables, et une
 * declaration inatteignable qui porte une valeur differente est un
 * piege pour le prochain lecteur, qui la modifiera en croyant agir.
 *
 * A specificite egale, la derniere de la source gagne. Le controle le
 * dit plutot que de signaler seulement qu il y a conflit, faute de quoi
 * le prochain lecteur refait l arbitrage a la main.
 */
function divergencesDeLaPortee(
  portee: string,
  regles: Array<Regle & { ordre: number }>,
): Divergence[] {
  const parCle = new Map<string, Array<{ prop: string; val: string; ordre: number }>>();
  // L ordre global est le couple (rang de la regle, rang de la
  // declaration dans la regle). Le second terme est ce qui manquait.
  for (const r of regles) {
    let rang = 0;
    for (const decl of r.ordreSource) {
      const i = decl.indexOf(':');
      if (i === -1) continue;
      const prop = decl.slice(0, i).trim();
      const val = decl.slice(i + 1).trim();
      const cle = `${r.contexte}|${r.selecteur}|${prop}`;
      if (!parCle.has(cle)) parCle.set(cle, []);
      parCle.get(cle)!.push({ prop, val, ordre: r.ordre * 10000 + rang });
      rang++;
    }
  }
  const out: Divergence[] = [];
  for (const [cle, decls] of Array.from(parCle.entries())) {
    const valeursDistinctes = Array.from(new Set(decls.map(d => d.val)));
    if (valeursDistinctes.length < 2) continue;
    const tries = decls.slice().sort((a, b) => a.ordre - b.ordre);
    const [contexte, selecteur, propriete] = cle.split('|');
    const appliquee = tries[tries.length - 1].val;
    out.push({
      portee, selecteur, contexte, propriete,
      valeurs: tries.map(d => d.val),
      appliquee,
      inatteignables: tries.slice(0, -1).map(d => d.val).filter(v => v !== appliquee),
    });
  }
  return out;
}

/**
 * Sources en memoire, pour que le controle s eprouve par sa propre
 * porte de production plutot que par une copie de sa logique. Absent en
 * usage normal : le perimetre et les contenus viennent alors du disque.
 */
export type Sources = Record<string, string>;

export function relever(sources?: Sources): Releve {
  const fichiers = sources ? Object.keys(sources).sort() : fichiersDuPerimetre();
  const lire = (f: string) => (sources ? sources[f] : readFileSync(f, 'utf-8'));
  const regles: Record<string, string[]> = {};
  const orphelines: Releve['orphelines'] = [];
  const divergences: Divergence[] = [];
  const portees: string[] = [];
  for (const f of fichiers) {
    const src = lire(f);
    const rendues = classesRendues(src);
    for (const bloc of blocsDeStyle(src, f)) {
      portees.push(bloc.portee);
      const dansLaPortee: Array<Regle & { ordre: number }> = [];
      let ordre = 0;
      for (const r of extraireRegles(bloc.css)) {
        dansLaPortee.push({ ...r, ordre: ordre++ });
        const clef = `${r.contexte}|${r.selecteur}|${r.corps}`;
        (regles[clef] ||= []).push(bloc.portee);
        const visees = classesDuSelecteur(r.selecteur);
        // Un selecteur sans classe (balise nue, :root, *) n est pas
        // rattachable a un fichier : il sort du controle d orphelinat
        // plutot que d y entrer par defaut.
        if (visees.length > 0 && !visees.some(c => rendues.has(c))) {
          orphelines.push({ fichier: f, selecteur: r.selecteur, contexte: r.contexte });
        }
      }
      divergences.push(...divergencesDeLaPortee(bloc.portee, dansLaPortee));
    }
  }
  return { fichiers, portees, relations: relationsParentEnfant(fichiers, lire), regles, orphelines, divergences };
}

function capture(sortie: string) {
  const r = relever();
  writeFileSync(sortie, JSON.stringify(r, null, 1));
  const n = Object.keys(r.regles).length;
  const dupes = Object.values(r.regles).filter(v => v.length > 1).length;
  console.log(`${r.fichiers.length} fichiers, ${r.portees.length} portees, ${n} regles distinctes`);
  console.log(`${dupes} regle(s) portee(s) par plus d une portee`);
  console.log(`${r.orphelines.length} regle(s) dont aucune classe visee n est rendue par leur fichier`);
  console.log(`${r.divergences.length} declaration(s) inatteignable(s) : meme propriete, meme selecteur, valeurs differentes`);
  for (const d of r.divergences) {
    console.log(`  ${d.selecteur} { ${d.propriete} }  dans ${d.portee}`);
    console.log(`     s applique : ${d.appliquee}`);
    console.log(`     inatteignable(s) : ${d.inatteignables.join(' | ')}`);
  }
  console.log(`Releve ecrit dans ${sortie}`);
}

function comparer(avant: string) {
  const a: Releve = JSON.parse(readFileSync(avant, 'utf-8'));
  const b = relever();
  const ecarts: string[] = [];
  // Signalees a part et sans faire echouer : ce sont des faits, pas des
  // fautes, et les taire ferait croire le perimetre plus propre qu il
  // n est.
  const homonymies: string[] = [];

  const clefs = Array.from(new Set([...Object.keys(a.regles), ...Object.keys(b.regles)]));
  for (const c of clefs) {
    const [ctx, sel] = c.split('|');
    const av = a.regles[c], ap = b.regles[c];
    const ou = ctx ? `${sel} dans ${ctx}` : sel;
    if (!ap) { ecarts.push(`PERDUE      ${ou}  (etait dans ${av.join(', ')})`); continue; }
    if (!av) { ecarts.push(`APPARUE     ${ou}  (${ap.join(', ')})`); continue; }
    if (ap.length > av.length) {
      // La duplication ne compte que le long de la relation de rendu.
      // Deux portees sans rapport portant la meme regle sont des
      // homonymes qui ne se rencontrent jamais : les signaler comme une
      // faute ferait du bruit a chaque extraction et noierait le seul
      // cas qui signifie quelque chose.
      const enRel = ap.some((x: string, i: number) => ap.some((y: string, j: number) => i < j && enRelation(x, y, b.relations)));
      if (enRel) {
        ecarts.push(`DUPLIQUEE   ${ou}  (${av.length} -> ${ap.length} portees en relation : ${ap.join(', ')})`);
      } else {
        homonymies.push(`homonymie  ${ou}  (${ap.map((x: string) => x.split('::').pop()).join(', ')})`);
      }
    }
  }

  const avOrph = new Set(a.orphelines.map(o => `${o.fichier}|${o.contexte}|${o.selecteur}`));
  for (const o of b.orphelines) {
    const k = `${o.fichier}|${o.contexte}|${o.selecteur}`;
    if (!avOrph.has(k)) ecarts.push(`ORPHELINE   ${o.selecteur}  reste dans ${o.fichier} qui ne rend plus la classe`);
  }

  const avDiv = new Set((a.divergences ?? []).map(d => `${d.portee}|${d.contexte}|${d.selecteur}|${d.propriete}`));
  for (const d of b.divergences) {
    const k = `${d.portee}|${d.contexte}|${d.selecteur}|${d.propriete}`;
    if (!avDiv.has(k)) {
      ecarts.push(`DIVERGENTE  ${d.selecteur} { ${d.propriete} } dans ${d.portee} : `
        + `${d.appliquee} s applique, ${d.inatteignables.join(' | ')} inatteignable(s)`);
    }
  }

  const nAvant = Object.keys(a.regles).length;
  const nApres = Object.keys(b.regles).length;
  console.log(`${nAvant} regles avant, ${nApres} apres, ${ecarts.length} ecart(s)`);
  for (const e of ecarts) console.log(`  ${e}`);
  if (homonymies.length > 0) {
    console.log(`${homonymies.length} homonymie(s), signalee(s) sans faire echouer :`);
    for (const h of homonymies) console.log(`  ${h}`);
  }
  if (ecarts.length === 0) {
    console.log('Aucune regle perdue, dupliquee ni orphelinee.');
    console.log('Rappel : ce controle ne prouve pas que le navigateur rend a l identique.');
  }
  process.exit(ecarts.length > 0 ? 1 : 0);
}

// Le bloc de commande ne s execute que si le module est le point
// d entree. Sans cette garde, importer `relever` depuis un test lance
// la commande et fait sortir le processus avant la premiere assertion.
if (require.main === module) {
  const [mode, arg] = process.argv.slice(2);
  if (mode === 'capture' && arg) capture(arg);
  else if (mode === 'comparer' && arg) comparer(arg);
  else {
    console.log('usage: style-conservation.ts capture <fichier.json> | comparer <fichier.json>');
    process.exit(2);
  }
}
