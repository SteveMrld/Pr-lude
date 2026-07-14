// Verifie sans reanalyser TOLSON ce que le cartouche afficherait.
// Lecture seule sur le result_json existant, appel de aggregator.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { aggregateRefutations } from '../lib/refutation/aggregator';

const env = readFileSync('/home/steve/Pr-lude/.env.local', 'utf-8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const s = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

(async () => {
  const id = 'bb8e6d7f-0dbc-4009-8343-49a72c9c41b6';
  const { data } = await s.from('analyses').select('company_name, source_filename, as_of, result_json').eq('id', id).single();
  const refs = aggregateRefutations(data?.result_json, {
    sourceFilename: data?.source_filename,
    asOf: (data as any)?.as_of,
    nowYear: 2026,
  });
  console.log(`TOLSON (${data?.company_name}) : ${refs.length} contradiction${refs.length > 1 ? 's' : ''}`);
  console.log('');
  const familyLabels: Record<string, string> = {
    'numeric': 'Chiffres divergents',
    'verdict-signal': 'Verdict contre signal',
    'label-calc': 'Libelle contre base de calcul',
  };
  for (const rf of refs) {
    console.log(`[${familyLabels[rf.family] || rf.family}]`);
    console.log(`  ce qui est affirme  : ${rf.claim}`);
    console.log(`  ce qui le contredit : ${rf.contradiction}`);
    console.log(`  nature de la tension: ${rf.tension}`);
    console.log('');
  }
})();
