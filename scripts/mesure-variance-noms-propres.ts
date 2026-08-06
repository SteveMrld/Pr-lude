// ============================================================
// D OU VIENT LA VARIANCE DU COMPTE DE NOMS PROPRES
// ------------------------------------------------------------
// Decompose, sur les dossiers analyses plusieurs fois, l ecart du
// nombre d alertes `unknown_name` entre deux runs. Zero appel au
// modele.
//
// POURQUOI CE RELEVE EXISTE
//
// L intuition naturelle est qu un dossier porte un nombre de noms
// propres, que ce nombre est une propriete du document, et qu il ne peut
// donc pas bouger d une analyse a l autre. Le compteur affiche en tete
// de note ne compte pas cela.
//
// `auditAssertions` recoit deux arguments et parcourt le premier :
// la SORTIE DES MOTEURS, c est-a-dire la prose que le modele vient
// d ecrire. Il signale les noms propres de cette prose qui ne figurent
// pas dans l ensemble autorise, construit par `buildAllowedNames` sur le
// second argument, l extraction. Le compte est donc un rapport entre
// deux objets qui bougent tous les deux, et aucun des deux n est le
// document.
//
// CE QUE LA MESURE SEPARE
//
// Trois causes possibles a un ecart, et elles n appellent pas la meme
// suite :
//
//   prose       le nom est ecrit dans un run et absent de l autre. Le
//               modele a change de vocabulaire. C est de la variance de
//               generation, elle est attendue.
//   autorise    le nom est ecrit dans les deux runs, signale dans l un
//               et pas dans l autre, parce que l extraction l a capte
//               d un cote et pas de l autre. C est de la variance
//               d extraction, et elle est plus grave : elle veut dire
//               que la meme phrase est jugee differemment selon un
//               ailleurs.
//   code        les deux runs ne partagent pas leur `commitSha`. Ce ne
//               sont alors pas deux tirages du meme systeme et l ecart
//               ne mesure pas une variance, il mesure un diff.
//
// CE QUE LA MESURE NE BORNE PAS
//
// La presence d un nom dans la prose de l autre run se teste sur le
// texte du JSON entier et non champ par champ, faute de pouvoir
// reconstituer le decoupage. Un nom present dans un champ trop court
// pour etre audite, moins de quarante caracteres, compte donc comme
// present alors que le detecteur ne l aurait jamais vu. La part
// « autorise » est ainsi majoree et la part « prose » minoree.
//
// Execution : npx tsx scripts/mesure-variance-noms-propres.ts
// ============================================================

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { buildAllowedNames } from '../lib/engines/assertion-validator';

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

async function sql(E: Record<string, string>, q: string): Promise<any[]> {
  const ref = (E.SUPABASE_URL || E.NEXT_PUBLIC_SUPABASE_URL).match(/^https:\/\/([a-z0-9]+)\./)![1];
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${E.SUPABASE_PAT}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

/** Le nom propre incrimine, tel que le message de l alerte le cite. */
function nomIncrimine(w: any): string | null {
  const m = String(w?.message ?? '').match(/"([^"]+)"/);
  return m ? m[1] : null;
}

interface Run {
  id: string;
  quand: string;
  sha: string | null;
  noms: Set<string>;
  alertes: number;
  allowed: Set<string>;
  proseBasse: string;
}

async function main(): Promise<void> {
  const E = env();
  const rows = await sql(E,
    `select id, created_at, source_filename, result_json::text as j
     from public.analyses where result_json is not null
     order by created_at asc;`);

  const parDossier = new Map<string, Run[]>();
  let sansAudit = 0;

  for (const r of rows) {
    let note: any;
    try { note = JSON.parse(r.j); } catch { continue; }
    const w = note?.assertionAudit?.warnings;
    const extraction = note?.extraction;
    if (!Array.isArray(w) || !extraction) { sansAudit++; continue; }

    const noms = new Set<string>();
    let alertes = 0;
    for (const x of w) {
      if (x?.category !== 'unknown_name') continue;
      alertes++;
      const n = nomIncrimine(x);
      if (n) noms.add(n.toLowerCase());
    }

    const dossier = String(r.source_filename ?? 'sans-nom');
    if (!parDossier.has(dossier)) parDossier.set(dossier, []);
    parDossier.get(dossier)!.push({
      id: String(r.id).slice(0, 8),
      quand: String(r.created_at).slice(0, 16).replace('T', ' '),
      sha: note?.meta?.versionStamp?.app?.commitSha ?? note?.versionStamp?.app?.commitSha ?? null,
      noms, alertes,
      allowed: buildAllowedNames(extraction as any),
      proseBasse: String(r.j).toLowerCase(),
    });
  }

  const multiples = Array.from(parDossier.entries()).filter(([, v]) => v.length >= 2);

  console.log('\n=== VARIANCE DU COMPTE DE NOMS PROPRES ===\n');
  console.log(`${rows.length} analyses lues, ${sansAudit} sans audit ou sans extraction persistee.`);
  console.log(`${multiples.length} dossiers analyses au moins deux fois.\n`);

  let paires = 0, pairesMemeSha = 0;
  const causes = { prose: 0, autorise: 0 };
  const exemplesAutorise: string[] = [];

  for (const [dossier, runs] of multiples) {
    console.log(`--- ${dossier}  (${runs.length} runs)`);
    for (const r of runs) {
      console.log(`    ${r.id}  ${r.quand}  sha=${(r.sha ?? 'absent').slice(0, 7)}  ` +
        `alertes=${String(r.alertes).padStart(3)}  noms distincts=${String(r.noms.size).padStart(3)}  ` +
        `autorises=${r.allowed.size}`);
    }
    for (let i = 1; i < runs.length; i++) {
      const a = runs[i - 1], b = runs[i];
      paires++;
      const memeSha = a.sha !== null && a.sha === b.sha;
      if (memeSha) pairesMemeSha++;

      // Les noms signales d un cote et pas de l autre, dans les deux sens.
      const ecarts: Array<[string, Run, Run]> = [];
      a.noms.forEach((n) => { if (!b.noms.has(n)) ecarts.push([n, a, b]); });
      b.noms.forEach((n) => { if (!a.noms.has(n)) ecarts.push([n, b, a]); });

      let prose = 0, autorise = 0;
      for (const [n, , absent] of ecarts) {
        // Present dans la prose de l autre run mais non signale : c est
        // l ensemble autorise qui a bouge, pas le vocabulaire.
        if (absent.proseBasse.includes(n)) {
          autorise++;
          if (exemplesAutorise.length < 12) exemplesAutorise.push(`${n} (${a.id}/${b.id})`);
        } else {
          prose++;
        }
      }
      causes.prose += prose;
      causes.autorise += autorise;

      const deltaAllowed = Array.from(a.allowed).filter((x) => !b.allowed.has(x)).length
        + Array.from(b.allowed).filter((x) => !a.allowed.has(x)).length;

      console.log(`    ${a.id} -> ${b.id} : ${a.alertes} puis ${b.alertes} alertes` +
        `   ecart de noms=${ecarts.length}  dont prose=${prose} autorise=${autorise}` +
        `   ensemble autorise : ${deltaAllowed} entrees differentes` +
        `   ${memeSha ? 'MEME CODE' : 'code different'}`);
    }
    console.log('');
  }

  console.log('=== SOLDE ===\n');
  console.log(`${paires} paires de runs consecutifs, dont ${pairesMemeSha} a commit constant.`);
  const t = causes.prose + causes.autorise;
  if (t > 0) {
    console.log(`${t} ecarts de nom au total :`);
    console.log(`  prose     ${String(causes.prose).padStart(4)}  (${(100 * causes.prose / t).toFixed(1)} %)  le modele a change de vocabulaire`);
    console.log(`  autorise  ${String(causes.autorise).padStart(4)}  (${(100 * causes.autorise / t).toFixed(1)} %)  le nom est ecrit des deux cotes, l extraction l a capte d un seul`);
  }
  if (exemplesAutorise.length) {
    console.log(`\nExemples de la seconde famille : ${exemplesAutorise.join(', ')}`);
  }
  console.log(`\nRappel de ce que la mesure ne borne pas : la presence dans l autre run se`);
  console.log(`teste sur le JSON entier, donc un nom loge dans un champ trop court pour`);
  console.log(`etre audite compte comme present. La part « autorise » est majoree.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
