// ============================================================
// MESURE DE LA CAPTURE DES SOURCES SUR LE CORPUS PERSISTE
// ------------------------------------------------------------
// Repond a deux questions sur les runs deja produits, et a elles seules.
//
//   1. Combien de runs persistes portent une capture de sources ?
//      Attendu avant ce correctif : zero. La tracabilite arrivait de la
//      plateforme et le pipeline la detruisait au retour de callClaude ;
//      aucune URL n a jamais atteint le depot.
//
//   2. Combien d assertions de ces notes revendiquent une lecture
//      exterieure ? C est la mesure de ce qui tenait lieu de preuve : des
//      tags ecrits de memoire par le modele, sur instruction du prompt.
//
// CE QUE CETTE MESURE BORNE
//
// Elle compte des tags dans de la prose, donc elle porte sur un objet
// syntaxique avec un instrument syntaxique, ce qui est legitime ici :
// le tag EST une chaine, il n y a pas de jugement a rendre pour le
// reconnaitre. En revanche la classification « revendique une lecture
// exterieure » emprunte la fonction du module qu elle evalue. Les
// en-tetes distincts sont donc imprimes bruts a cote du compte, pour
// qu une lecture humaine puisse contredire la classification plutot que
// de la reconduire.
//
// La lecture des champs se fait par parcours de l objet persiste, jamais
// par expression reguliere sur le JSON brut : l echappement du JSON
// coupe les crochets et la mesure porterait sur le serialiseur.
//
// Usage : npx tsx scripts/mesure-capture-sources.ts [--limite=40]
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tagRevendiqueUneLectureExterne } from '../lib/engines/assertion-validator';

function env(): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of ['.env', '.env.local']) {
    const p = join(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const l of readFileSync(p, 'utf-8').split('\n')) {
      const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && m[2]) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return e;
}

function arg(nom: string, defaut: string): string {
  const a = process.argv.find((x) => x.startsWith(`--${nom}=`));
  return a ? a.slice(nom.length + 3) : defaut;
}

async function sql(E: Record<string, string>, q: string): Promise<any[]> {
  const ref = (E.SUPABASE_URL || E.NEXT_PUBLIC_SUPABASE_URL).match(/^https:\/\/([a-z0-9]+)\./)![1];
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${E.SUPABASE_PAT}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 400)}`);
  return JSON.parse(t);
}

/** Toutes les chaines assez longues pour porter une phrase. */
function chainesDe(noeud: unknown, acc: string[] = []): string[] {
  if (typeof noeud === 'string') {
    if (noeud.length >= 40) acc.push(noeud);
    return acc;
  }
  if (Array.isArray(noeud)) { for (const n of noeud) chainesDe(n, acc); return acc; }
  if (noeud && typeof noeud === 'object') {
    for (const v of Object.values(noeud as Record<string, unknown>)) chainesDe(v, acc);
  }
  return acc;
}

/** Les groupes de crochets d un texte, a toutes les profondeurs. */
function tagsDe(text: string): string[] {
  const g: string[] = [];
  const pile: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[') { pile.push(i); continue; }
    if (text[i] === ']' && pile.length > 0) g.push(text.slice(pile.pop()!, i + 1));
  }
  return g;
}

function enTete(tag: string): string {
  return tag.replace(/^\[|\]$/g, '').trim().split(/[\s:,]+/)[0]?.toLowerCase() ?? '';
}

async function main(): Promise<void> {
  const E = env();
  const limite = parseInt(arg('limite', '40'), 10);

  const rows = await sql(E,
    `select id, created_at, source_filename,
            result_json->'meta'->'sourceCapture' as capture,
            result_json->'meta'->'versionStamp'->>'commitSha' as sha,
            result_json as complet
     from public.analyses
     where result_json is not null
     order by created_at desc limit ${limite};`);

  console.log('MESURE DE LA CAPTURE DES SOURCES');
  console.log(`${rows.length} run(s) persiste(s) lus, du plus recent au plus ancien.\n`);

  let avecCapture = 0;
  let totalTags = 0;
  let totalExterieurs = 0;
  const enTetes = new Map<string, number>();
  const parRun: Array<{ id: string; nom: string; tags: number; ext: number; capture: boolean }> = [];

  for (const r of rows) {
    const aCapture = r.capture !== null && r.capture !== undefined;
    if (aCapture) avecCapture++;

    let tags = 0, ext = 0;
    for (const s of chainesDe(r.complet)) {
      for (const t of tagsDe(s)) {
        const tete = enTete(t);
        if (!tete) continue;
        tags++;
        enTetes.set(tete, (enTetes.get(tete) ?? 0) + 1);
        if (tagRevendiqueUneLectureExterne(t)) ext++;
      }
    }
    totalTags += tags;
    totalExterieurs += ext;
    parRun.push({
      id: String(r.id).slice(0, 8),
      nom: String(r.source_filename ?? '?').slice(0, 34),
      tags, ext, capture: aCapture,
    });
  }

  console.log('QUESTION 1 : combien de runs portent une capture de sources ?');
  console.log(`  ${avecCapture} sur ${rows.length}.`);
  if (avecCapture === 0) {
    console.log('  Aucune URL n a jamais atteint le depot : la plateforme la rendait,');
    console.log('  callClaude ne gardait que les blocs texte, le reste etait jete.\n');
  } else {
    console.log('');
  }

  console.log('QUESTION 2 : ce qui tenait lieu de preuve');
  console.log(`  ${totalTags} tags de provenance dans les notes persistees.`);
  console.log(`  ${totalExterieurs} revendiquent une lecture exterieure au dossier,`);
  console.log(`  soit ${totalTags > 0 ? Math.round((totalExterieurs / totalTags) * 100) : 0}%, et aucune n est adossee a une page capturee.\n`);

  console.log('EN-TETES DISTINCTS, BRUTS, PAR FREQUENCE');
  console.log('  (la classification ci-dessus emprunte la fonction du module evalue ;');
  console.log('   cette liste est la pour qu une lecture humaine puisse la contredire)');
  const tries = Array.from(enTetes.entries()).sort((a, b) => b[1] - a[1]);
  for (const [tete, n] of tries.slice(0, 30)) {
    console.log(`    ${String(n).padStart(6)}  ${tete}`);
  }
  if (tries.length > 30) console.log(`    ... et ${tries.length - 30} autres en-tetes`);

  console.log('\nDETAIL PAR RUN');
  for (const p of parRun) {
    console.log(`  ${p.id}  ${p.nom.padEnd(34)}  ${String(p.tags).padStart(5)} tags  ${String(p.ext).padStart(5)} exterieurs  capture ${p.capture ? 'oui' : 'non'}`);
  }
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
