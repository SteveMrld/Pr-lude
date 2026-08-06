// ============================================================
// COMPARER DEUX ANALYSES DU MEME DOSSIER
// ------------------------------------------------------------
// Applique `lib/controle/comparatif` aux analyses persistees. Zero
// appel au modele.
//
// Sans argument : compare les runs consecutifs de tout dossier analyse
// au moins deux fois. Avec `--dossier=<fragment>`, se restreint.
//
// Execution : npx tsx scripts/comparer-notes.ts [--dossier=Hello]
// ============================================================

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { comparerAnalyses, rendreComparatif } from '../lib/controle/comparatif';

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

async function main(): Promise<void> {
  const E = env();
  const filtre = (process.argv.find((x) => x.startsWith('--dossier=')) ?? '').slice(10);

  const rows = await sql(E,
    `select id, created_at, source_filename, result_json::text as j
     from public.analyses where result_json is not null order by created_at asc;`);

  const parDossier = new Map<string, Array<{ id: string; quand: string; note: any }>>();
  for (const r of rows) {
    const nom = String(r.source_filename ?? 'sans-nom');
    if (filtre && !nom.toLowerCase().includes(filtre.toLowerCase())) continue;
    let note: any;
    try { note = JSON.parse(r.j); } catch { continue; }
    if (!parDossier.has(nom)) parDossier.set(nom, []);
    parDossier.get(nom)!.push({
      id: String(r.id).slice(0, 8),
      quand: String(r.created_at).slice(0, 16).replace('T', ' '),
      note,
    });
  }

  let totalAnomalies = 0, paires = 0, pairesMemeCode = 0;
  Array.from(parDossier.entries()).filter(([, v]) => v.length >= 2).forEach(([nom, runs]) => {
    console.log(`\n${'='.repeat(72)}\n${nom}  (${runs.length} runs)\n${'='.repeat(72)}`);
    for (let i = 1; i < runs.length; i++) {
      const a = runs[i - 1], b = runs[i];
      paires++;
      const c = comparerAnalyses(a.note, b.note);
      totalAnomalies += c.anomalies.length;
      if (c.code.memeCode) pairesMemeCode++;
      console.log('\n' + rendreComparatif(c, `--- ${a.id} (${a.quand})  ->  ${b.id} (${b.quand})`));
    }
  });

  console.log(`\n${'='.repeat(72)}`);
  console.log(`${paires} paires comparees, ${totalAnomalies} anomalie(s) au total.`);
  console.log('');
  // CE QUE CE SOLDE BORNE, ET CE QU IL NE BORNE PAS
  //
  // Une anomalie ne peut se prononcer que sur une paire a code
  // constant : ailleurs, l ecart mesure un diff. Le nombre d anomalies
  // ne dit donc rien du tout sur les autres paires, et un zero se lirait
  // a tort comme une couverture. Le denominateur reel est imprime a cote
  // pour que personne ne fasse cette lecture.
  console.log(`${pairesMemeCode} paire(s) sur ${paires} partagent leur empreinte de moteurs.`);
  console.log(`Le verdict d anomalie ne porte que sur celles-la : sur les ${paires - pairesMemeCode} autres,`);
  console.log(`le comparatif ne borne rien, puisqu un ecart y mesure un changement de code.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
