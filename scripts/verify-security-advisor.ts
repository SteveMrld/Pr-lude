// Verifie via la Management API que :
//   1. prelude_jobs a RLS active (rowsecurity = true)
//   2. analyses_stats, sectoral_briefs_latest,
//      inter_sectoral_briefs_latest ont security_invoker = true
//   3. les tables sous-jacentes ont RLS active

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

async function runQuery(ref: string, pat: string, sql: string): Promise<any> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

(async () => {
  const env = loadEnv();
  const ref = extractRef(env.SUPABASE_URL);
  const pat = env.SUPABASE_PAT;

  console.log('=== RLS sur tables ===');
  const rls = await runQuery(ref, pat, `
    SELECT schemaname, tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('prelude_jobs', 'analyses', 'sectoral_briefs', 'inter_sectoral_briefs')
    ORDER BY tablename;
  `);
  console.table(rls);

  console.log('\n=== Options des vues (reloptions) ===');
  const views = await runQuery(ref, pat, `
    SELECT c.relname AS view_name, c.reloptions
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND c.relname IN ('analyses_stats', 'sectoral_briefs_latest', 'inter_sectoral_briefs_latest')
    ORDER BY c.relname;
  `);
  console.table(views);

  console.log('\n=== Policies sur prelude_jobs ===');
  const pol = await runQuery(ref, pat, `
    SELECT polname, polcmd
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'prelude_jobs';
  `);
  console.table(pol);
})();
