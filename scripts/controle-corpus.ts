// ============================================================
// CONTROLE DU CORPUS PERSISTE
// ------------------------------------------------------------
// Evalue le catalogue de proprietes sur toutes les notes persistees et
// rend un verdict. Zero appel au modele, quelques centaines de
// millisecondes, aucun euro.
//
// C est le premier des trois dispositifs decides le 5 aout 2026, et il
// vient avant le banc de moteurs pour une raison d ordre de grandeur :
// un run coute trois a quatre dollars et demi et dix minutes, une passe
// de banc environ deux dollars et trois minutes, et ce controle cent
// soixante-seize millisecondes et rien. Trois ordres de grandeur
// separent la lecture du corpus deja produit de la production d une
// note de plus.
//
// Il est aussi le seul des trois a etre retroactif. Un defaut trouve
// dans une note devient une propriete, et la propriete rend
// immediatement le nombre de notes touchees parmi les cinquante-deux
// deja persistees. L observation devient un taux, ce qui est la question
// qui n est jamais posee aujourd hui.
//
// USAGE
//   npx tsx scripts/controle-corpus.ts
//   npx tsx scripts/controle-corpus.ts --detail
//   npx tsx scripts/controle-corpus.ts --limite=10 --detail
//
// Sortie 0 quand aucune propriete n est en defaut, 1 sinon.
// ============================================================

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { controler, formater, type NoteControlee } from '../lib/controle/controleur';

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

function arg(nom: string, defaut = ''): string {
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
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

async function main(): Promise<void> {
  const E = env();
  const limite = arg('limite') ? ` limit ${parseInt(arg('limite'), 10)}` : '';
  const rows = await sql(E,
    `select id, created_at, source_filename, result_json::text as j
     from public.analyses where result_json is not null
     order by created_at desc${limite};`);

  const corpus: NoteControlee[] = [];
  for (const r of rows) {
    try {
      corpus.push({
        id: String(r.id).slice(0, 8),
        libelle: `${String(r.created_at).slice(0, 10)} ${String(r.source_filename ?? '?').slice(0, 34)}`,
        note: JSON.parse(r.j),
      });
    } catch {
      // Une note illisible se signale plutot que de disparaitre du
      // denominateur : un corpus ou l on compte moins de notes qu il
      // n en existe rend un taux qui n est pas celui du produit.
      console.error(`Note ${String(r.id).slice(0, 8)} illisible, exclue du releve.`);
    }
  }

  const releve = controler(corpus);
  console.log(formater(releve, { detail: arg('detail', 'absent') !== 'absent' || process.argv.includes('--detail') }));

  const dir = join(process.cwd(), 'scripts', 'audit-output');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const f = join(dir, 'controle-corpus.json');
  writeFileSync(f, JSON.stringify({
    notes: releve.notes,
    rejeux: releve.rejeux,
    segments: releve.segments,
    dureeMs: releve.dureeMs,
    releves: releve.releves.map((x) => ({
      id: x.propriete.id,
      enonce: x.propriete.enonce,
      famille: x.propriete.famille,
      origine: x.propriete.origine,
      eprouvee: x.propriete.eprouvee,
      portee: x.portee,
      violees: x.violees,
      taux: x.taux,
      parSegment: x.parSegment,
      violations: x.violations,
    })),
  }, null, 2));
  console.log(`\nReleve : ${f}`);

  process.exit(releve.releves.some((x) => x.violees > 0) ? 1 : 0);
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
