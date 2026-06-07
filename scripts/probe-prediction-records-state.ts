// Sonde l etat reel des tables prediction_records et analysis_outcomes
// via le service role. Distingue trois cas :
//   - table absente : erreur PostgREST PGRST205 ou code 42P01
//   - table presente mais cache froid : PGRST002 ou message specifique
//   - table presente et OK : count retourne un nombre
//
// But : ecarter l hypothese "cache PostgREST" vs "table absente" sans
// avoir a relancer le DDL.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const envText = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
const env: Record<string, string> = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function probe(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`${table}: ERREUR`);
    console.log(`  code   : ${error.code ?? '-'}`);
    console.log(`  status : ${(error as any).status ?? '-'}`);
    console.log(`  hint   : ${error.hint ?? '-'}`);
    console.log(`  msg    : ${error.message}`);
  } else {
    console.log(`${table}: OK (${count} lignes)`);
  }
}

(async () => {
  await probe('prediction_records');
  await probe('analysis_outcomes');
  // table connue pour exister, pour comparer la signature d erreur
  await probe('analyses');
})();
