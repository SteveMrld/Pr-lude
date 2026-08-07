// ============================================================
// NOTE-SNAPSHOT : empreinte du HTML rendu de la note d instruction
// ------------------------------------------------------------
// Ecrit le 7 aout 2026 comme garde du chantier de decoupage. Le
// decoupage de InvestmentNoteView deplace des centaines de lignes de
// JSX d un fichier vers des composants enfants, et la seule question
// qui compte est de savoir si la note rendue est identique avant et
// apres. Une suite de tests verte ne repond pas a cette question :
// aucun test du depot ne rend la note entiere.
//
// CE QUE CE HARNAIS COUVRE, ET CE QU IL NE COUVRE PAS
//
// Il couvre le HTML rendu, pas les valeurs. Le composant est rendu
// par renderToStaticMarkup sur le result_json persiste de chaque
// note du corpus, et c est la chaine de balises produite qui est
// hachee. Une section deplacee dans un enfant qui rendrait le meme
// texte dans une balise differente serait donc vue, la ou une
// comparaison de valeurs ne verrait rien.
//
// Il ne couvre pas ce que le navigateur fait ensuite. useEffect ne
// tourne pas en rendu serveur, donc tout composant qui charge ses
// donnees en effet rend son etat initial et non son etat final ; la
// comparaison est juste, puisque les deux cotes rendent le meme etat
// initial, mais elle ne dit rien de l etat charge. Elle ne couvre pas
// davantage la mise en forme : styled-jsx hors du compilateur Next
// n injecte pas ses classes de portee, donc le style rendu ici n est
// pas le style rendu en production. C est precisement le point que le
// premier lot deplace, et il faut le dire plutot que le laisser
// croire couvert.
//
// Usage, et le --tsconfig n est pas facultatif :
//   npx tsx --tsconfig tsconfig.harness.json scripts/note-snapshot.ts capture <dir>
//   npx tsx --tsconfig tsconfig.harness.json scripts/note-snapshot.ts comparer <avant> <apres>
//
// Sans lui, cinquante notes sur cinquante-sept echouent sur « React is
// not defined » : le projet compile en jsx=preserve parce que Next
// applique sa propre transformation, et plusieurs composants utilisent
// donc JSX sans importer React. C est un defaut du harnais et non de la
// note, et il est ecrit ici plutot que retenu, parce qu une capture
// partielle rendrait une comparaison verte sur un sous-ensemble.
// ============================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import InvestmentNoteView from '../app/components/InvestmentNoteView';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of ['.env', '.env.local']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

async function fetchNotes(): Promise<Array<{ id: string; company_name: string; result_json: any }>> {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente');
  const out: any[] = [];
  // Pagination : le corpus depasse la limite par defaut de PostgREST,
  // et une capture silencieusement tronquee rendrait une comparaison
  // verte sur un sous-ensemble.
  for (let offset = 0; ; offset += 20) {
    const r = await fetch(
      `${url}/rest/v1/analyses?select=id,company_name,result_json&result_json=not.is.null`
      + `&order=created_at.asc&limit=20&offset=${offset}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!r.ok) throw new Error(`lecture corpus: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 20) break;
  }
  return out;
}

/**
 * Rend une note et retourne son HTML, ou la description de l echec.
 * Un echec n est pas silencieux : il devient une empreinte a lui seul,
 * de sorte qu une note qui cessait de se rendre apres une extraction
 * se voie comme une divergence et non comme une absence.
 */
function rendre(result: any): { html: string; erreur: string | null } {
  try {
    const html = renderToStaticMarkup(
      React.createElement(InvestmentNoteView as any, { result, printMode: true }),
    );
    return { html, erreur: null };
  } catch (e: any) {
    return { html: '', erreur: String(e?.message ?? e).slice(0, 400) };
  }
}

function empreinte(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

async function capture(dir: string) {
  mkdirSync(dir, { recursive: true });
  const notes = await fetchNotes();
  console.log(`${notes.length} notes portant un result_json`);
  const index: Record<string, { nom: string; hash: string; octets: number; erreur: string | null }> = {};
  let rendues = 0, echecs = 0;
  for (const n of notes) {
    const { html, erreur } = rendre(n.result_json);
    if (erreur) { echecs++; } else { rendues++; }
    index[n.id] = {
      nom: n.company_name,
      hash: empreinte(erreur ? `ERREUR:${erreur}` : html),
      octets: html.length,
      erreur,
    };
    writeFileSync(join(dir, `${n.id}.html`), erreur ? `ERREUR: ${erreur}` : html);
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 1));
  console.log(`${rendues} rendues, ${echecs} en echec. Empreintes dans ${dir}/index.json`);
  if (echecs > 0) {
    console.log('Les echecs sont captures comme empreintes : ils comptent comme un etat,');
    console.log('donc une note qui cesse de se rendre apres extraction sera vue.');
  }
}

function comparer(avant: string, apres: string) {
  const a = JSON.parse(readFileSync(join(avant, 'index.json'), 'utf-8'));
  const b = JSON.parse(readFileSync(join(apres, 'index.json'), 'utf-8'));
  const ids = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  const diff: string[] = [];
  for (const id of ids) {
    if (!a[id]) { diff.push(`AJOUTEE   ${id} ${b[id].nom}`); continue; }
    if (!b[id]) { diff.push(`DISPARUE  ${id} ${a[id].nom}`); continue; }
    if (a[id].hash !== b[id].hash) {
      diff.push(`DIFFERE   ${a[id].nom} (${a[id].octets} -> ${b[id].octets} octets)`);
    }
  }
  console.log(`${ids.length} notes comparees, ${diff.length} divergence(s)`);
  for (const d of diff) console.log(`  ${d}`);
  if (diff.length > 0) {
    console.log('\nPour lire une divergence :');
    console.log(`  diff <(npx html-beautify ${avant}/<id>.html) <(npx html-beautify ${apres}/<id>.html)`);
  }
  process.exit(diff.length > 0 ? 1 : 0);
}

const [mode, arg1, arg2] = process.argv.slice(2);
if (mode === 'capture' && arg1) {
  capture(arg1).catch(e => { console.error(String(e?.message ?? e)); process.exit(2); });
} else if (mode === 'comparer' && arg1 && arg2) {
  comparer(arg1, arg2);
} else {
  console.log('usage: note-snapshot.ts capture <dir> | comparer <avant> <apres>');
  process.exit(2);
}
