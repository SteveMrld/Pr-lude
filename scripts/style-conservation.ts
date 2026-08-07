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

/** Contenu des blocs `<style jsx>{` ... `}</style>` d un fichier. */
function blocsDeStyle(src: string): string[] {
  const out: string[] = [];
  const marqueur = /<style\s+jsx(?:\s+global)?\s*>\{`/g;
  let m: RegExpExecArray | null;
  while ((m = marqueur.exec(src)) !== null) {
    const debut = m.index + m[0].length;
    const fin = src.indexOf('`}', debut);
    if (fin === -1) continue;
    out.push(src.slice(debut, fin));
    marqueur.lastIndex = fin;
  }
  return out;
}

export interface Regle {
  /** Contexte d encadrement, `@media ...` ou chaine vide. */
  contexte: string;
  selecteur: string;
  /** Declarations normalisees et triees, jointes par `;`. */
  corps: string;
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
        if (s) regles.push({ contexte, selecteur: s, corps: normaliserDeclarations(corps) });
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

export interface Releve {
  fichiers: string[];
  /** clef `contexte|selecteur|corps` -> fichiers qui la portent. */
  regles: Record<string, string[]>;
  /** Regles dont aucune classe visee n est rendue par leur fichier. */
  orphelines: Array<{ fichier: string; selecteur: string; contexte: string }>;
}

export function relever(): Releve {
  const fichiers = fichiersDuPerimetre();
  const regles: Record<string, string[]> = {};
  const orphelines: Releve['orphelines'] = [];
  for (const f of fichiers) {
    const src = readFileSync(f, 'utf-8');
    const rendues = classesRendues(src);
    for (const bloc of blocsDeStyle(src)) {
      for (const r of extraireRegles(bloc)) {
        const clef = `${r.contexte}|${r.selecteur}|${r.corps}`;
        (regles[clef] ||= []).push(f);
        const visees = classesDuSelecteur(r.selecteur);
        // Un selecteur sans classe (balise nue, :root, *) n est pas
        // rattachable a un fichier : il sort du controle d orphelinat
        // plutot que d y entrer par defaut.
        if (visees.length > 0 && !visees.some(c => rendues.has(c))) {
          orphelines.push({ fichier: f, selecteur: r.selecteur, contexte: r.contexte });
        }
      }
    }
  }
  return { fichiers, regles, orphelines };
}

function capture(sortie: string) {
  const r = relever();
  writeFileSync(sortie, JSON.stringify(r, null, 1));
  const n = Object.keys(r.regles).length;
  const dupes = Object.values(r.regles).filter(v => v.length > 1).length;
  console.log(`${r.fichiers.length} fichiers, ${n} regles distinctes, ${dupes} portees par plus d un fichier`);
  console.log(`${r.orphelines.length} regle(s) dont aucune classe visee n est rendue par leur fichier`);
  console.log(`Releve ecrit dans ${sortie}`);
}

function comparer(avant: string) {
  const a: Releve = JSON.parse(readFileSync(avant, 'utf-8'));
  const b = relever();
  const ecarts: string[] = [];

  const clefs = Array.from(new Set([...Object.keys(a.regles), ...Object.keys(b.regles)]));
  for (const c of clefs) {
    const [ctx, sel] = c.split('|');
    const av = a.regles[c], ap = b.regles[c];
    const ou = ctx ? `${sel} dans ${ctx}` : sel;
    if (!ap) { ecarts.push(`PERDUE      ${ou}  (etait dans ${av.join(', ')})`); continue; }
    if (!av) { ecarts.push(`APPARUE     ${ou}  (${ap.join(', ')})`); continue; }
    if (ap.length > av.length) {
      ecarts.push(`DUPLIQUEE   ${ou}  (${av.length} -> ${ap.length} fichiers : ${ap.join(', ')})`);
    }
  }

  const avOrph = new Set(a.orphelines.map(o => `${o.fichier}|${o.contexte}|${o.selecteur}`));
  for (const o of b.orphelines) {
    const k = `${o.fichier}|${o.contexte}|${o.selecteur}`;
    if (!avOrph.has(k)) ecarts.push(`ORPHELINE   ${o.selecteur}  reste dans ${o.fichier} qui ne rend plus la classe`);
  }

  const nAvant = Object.keys(a.regles).length;
  const nApres = Object.keys(b.regles).length;
  console.log(`${nAvant} regles avant, ${nApres} apres, ${ecarts.length} ecart(s)`);
  for (const e of ecarts) console.log(`  ${e}`);
  if (ecarts.length === 0) {
    console.log('Aucune regle perdue, dupliquee ni orphelinee.');
    console.log('Rappel : ce controle ne prouve pas que le navigateur rend a l identique.');
  }
  process.exit(ecarts.length > 0 ? 1 : 0);
}

const [mode, arg] = process.argv.slice(2);
if (mode === 'capture' && arg) capture(arg);
else if (mode === 'comparer' && arg) comparer(arg);
else {
  console.log('usage: style-conservation.ts capture <fichier.json> | comparer <fichier.json>');
  process.exit(2);
}
