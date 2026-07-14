// Repassage lecture seule de la brique 2 (verdict contre signal)
// sur le corpus complet des dossiers en base. Rend un tableau
// classe : declenchement, signaux, valeur du verdict, extrait
// rationale + apercu clients / metriques.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { detectVerdictSignalContradictions } from '../lib/refutation/verdict-signal-contradictions';

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
    .select('id, company_name, result_json, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });
  const rows = (data || []).slice(0, 28);
  console.log(`Corpus scanned : ${rows.length} dossiers`);
  console.log('='.repeat(200));
  let hits = 0;
  const details: any[] = [];
  for (const r of rows) {
    const contradictions = detectVerdictSignalContradictions(r.result_json, { nowYear: 2026 });
    if (contradictions.length === 0) continue;
    hits++;
    const c = contradictions[0];
    const extraction = r.result_json?.extraction || {};
    const trac = extraction?.traction || {};
    details.push({
      id: r.id,
      name: r.company_name,
      verdictSource: c.verdict.source,
      verdictValue: c.verdict.value,
      verdictExcerpt: c.verdict.excerpt,
      signals: c.signals,
      customers: trac.customers,
      metricsSample: (trac.metrics || []).slice(0, 3),
      yearFounded: extraction.yearFounded,
    });
  }
  console.log(`Declenchements : ${hits} / ${rows.length}`);
  console.log('');
  for (const d of details) {
    console.log('-'.repeat(200));
    console.log(`${d.name}  (${d.id})`);
    console.log(`  verdict     : ${d.verdictValue}  source=${d.verdictSource}`);
    console.log(`  rationale   : ${d.verdictExcerpt}`);
    console.log(`  yearFounded : ${d.yearFounded}`);
    console.log(`  customers   : ${(d.customers || '').slice(0, 140)}`);
    console.log(`  metrics[0-3]: ${d.metricsSample.join(' | ').slice(0, 200)}`);
    console.log(`  signaux (${d.signals.length}) :`);
    for (const sig of d.signals) console.log(`    - ${sig.kind}  ${sig.observed}  (src=${sig.source})`);
  }
})();
