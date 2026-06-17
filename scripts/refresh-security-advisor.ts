// Rafraichit et affiche les errors du Security Advisor Supabase
// via la Management API. Endpoint /v1/projects/{ref}/database/lint
// si disponible. Sinon, deuxieme tentative via /database/lints.

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
  if (!m) throw new Error('SUPABASE_URL invalide');
  return m[1];
}

async function tryEndpoint(url: string, pat: string): Promise<{ status: number; body: any }> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
  const text = await r.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { status: r.status, body };
}

(async () => {
  const env = loadEnv();
  const ref = extractRef(env.SUPABASE_URL);
  const pat = env.SUPABASE_PAT;

  const candidates = [
    `https://api.supabase.com/v1/projects/${ref}/database/lints?level=ERROR`,
    `https://api.supabase.com/v1/projects/${ref}/database/lint`,
    `https://api.supabase.com/v1/projects/${ref}/advisor/security`,
  ];

  for (const url of candidates) {
    console.log(`\n=== ${url} ===`);
    const r = await tryEndpoint(url, pat);
    console.log(`HTTP ${r.status}`);
    if (r.status === 200) {
      console.log(JSON.stringify(r.body, null, 2).slice(0, 4000));
      break;
    } else {
      console.log(typeof r.body === 'string' ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 200));
    }
  }
})();
