// ============================================================
// APPLY-MIGRATION : execute un fichier SQL via la Management API
// ------------------------------------------------------------
// Endpoint : POST https://api.supabase.com/v1/projects/{ref}/database/query
// Auth     : Bearer <SUPABASE_PAT> (Personal Access Token Supabase)
//
// Lit le fichier .sql passe en argument, POST son contenu integral
// a la Management API, affiche la reponse. Le DDL part directement
// depuis le disque vers l API en HTTPS, sans intermediaire clipboard
// ni SQL Editor, ce qui elimine la classe entiere du probleme de
// troncature observe sur les fichiers > 5 Ko.
//
// Le project ref est derive de SUPABASE_URL.
//
// Apres execution, lance automatiquement un NOTIFY pgrst, 'reload
// schema' pour rafraichir le cache PostgREST.
//
// Usage :
//   npx tsx scripts/apply-migration.ts <chemin/vers/migration.sql>
//
// Exemple :
//   npx tsx scripts/apply-migration.ts supabase-prediction-records-schema.sql
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnv(): Record<string, string> {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
  const env: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function extractRef(supabaseUrl: string): string {
  const m = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!m) throw new Error(`Impossible d extraire le ref depuis SUPABASE_URL=${supabaseUrl}`);
  return m[1];
}

async function runQuery(ref: string, pat: string, sql: string): Promise<{ ok: boolean; status: number; body: any }> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, body };
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage : npx tsx scripts/apply-migration.ts <fichier.sql>');
    process.exit(1);
  }

  const env = loadEnv();
  const supabaseUrl = env.SUPABASE_URL;
  const pat = env.SUPABASE_PAT;
  if (!supabaseUrl) { console.error('SUPABASE_URL absent de .env.local'); process.exit(1); }
  if (!pat) {
    console.error('SUPABASE_PAT absent de .env.local.');
    console.error('Lance d abord : npx tsx scripts/setkey-supabase-pat.ts');
    process.exit(1);
  }

  const ref = extractRef(supabaseUrl);
  const sql = readFileSync(file, 'utf-8');
  const bytes = Buffer.byteLength(sql, 'utf-8');

  console.log(`Projet  : ${ref}`);
  console.log(`Fichier : ${file}`);
  console.log(`Taille  : ${bytes} octets`);
  console.log(`Envoi vers https://api.supabase.com/v1/projects/${ref}/database/query ...`);

  const result = await runQuery(ref, pat, sql);

  console.log(`\nReponse HTTP : ${result.status}`);
  console.log('Corps        :');
  console.log(typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2));

  if (!result.ok) {
    console.error('\nMigration ECHEC.');
    process.exit(1);
  }

  console.log('\nMigration appliquee. Reload du schema cache PostgREST...');
  const reload = await runQuery(ref, pat, "SELECT pg_notify('pgrst', 'reload schema');");
  console.log(`Reload HTTP : ${reload.status}`);
  if (!reload.ok) {
    console.warn('Reload NOTIFY a echoue mais la migration est passee. Forcer un restart API depuis le dashboard si necessaire.');
  } else {
    console.log('Reload demande. Cache PostgREST devrait etre rafraichi sous 30 secondes.');
  }
}

main().catch((e) => {
  console.error('Erreur fatale :', e?.message ?? e);
  process.exit(1);
});
