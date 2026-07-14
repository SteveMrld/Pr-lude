// Repassage lecture seule de la brique 3 (label contre calcul) sur
// le corpus complet. Rend le tableau des declenchements avec assez
// de contexte pour classer chaque cas vraie contradiction ou faux
// positif.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { detectLabelCalculationContradictions } from '../lib/refutation/label-calculation-contradictions';

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
  const { data } = await s
    .from('analyses')
    .select('id, company_name, source_filename, as_of, created_at, result_json')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });
  const rows = (data || []).slice(0, 28);
  console.log(`Corpus : ${rows.length} dossiers`);
  console.log('='.repeat(200));
  let hits = 0;
  for (const r of rows) {
    const cs = detectLabelCalculationContradictions(r.result_json, {
      nowYear: 2026,
      asOf: r.as_of,
      sourceFilename: r.source_filename,
    });
    if (cs.length === 0) continue;
    hits++;
    console.log('');
    console.log('-'.repeat(200));
    console.log(`${r.company_name}  (${r.id})`);
    console.log(`  source_filename : ${r.source_filename}`);
    console.log(`  as_of           : ${r.as_of}`);
    console.log(`  created_at      : ${r.created_at?.slice(0, 10)}`);
    for (const c of cs) {
      console.log(`  ${c.indicatorKey.padEnd(20)} refYear=${c.dossierRefYear}  baseYear=${c.baseYearOfCalculation}  +${c.yearsForward}an`);
      console.log(`    label     : ${c.labelExcerpt}`);
      console.log(`    rationale : ${c.rationaleExcerpt}`);
    }
  }
  console.log('');
  console.log(`Declenchements : ${hits} / ${rows.length}`);
})();
