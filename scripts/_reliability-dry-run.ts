// Phase 1 lecture seule. Lit les issues reelles et propose la
// valeur de reliability que parseReliabilityFromNotes attribuerait.
// Aucune ecriture.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseReliabilityFromNotes } from '../lib/calibration/corpus-selection';

const env = readFileSync('/home/steve/Pr-lude/.env.local', 'utf-8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ILLUSTRATIVE_SOURCE =
  'ILLUSTRATIF — données synthétiques de démonstration, non issues de résolutions marché réelles';

async function main() {
  const { data: outcomes, error } = await supabase
    .from('analysis_outcomes')
    .select('id, analysis_id, market_outcome, source, source_notes')
    .order('created_at', { ascending: true });
  if (error) { console.error(error); process.exit(1); }
  const real = (outcomes || []).filter(o => o.source !== ILLUSTRATIVE_SOURCE);

  const analysisIds = real.map(o => o.analysis_id);
  const { data: analyses } = await supabase
    .from('analyses')
    .select('id, company_name')
    .in('id', analysisIds);
  const nameById = new Map<string, string>();
  for (const a of analyses || []) nameById.set(a.id, a.company_name);

  console.log('id                                    | dossier                 | outcome         | source                        | reliability_parsed | note');
  console.log('-'.repeat(220));
  let nullCount = 0;
  for (const o of real) {
    const rel = parseReliabilityFromNotes(o.source_notes);
    if (rel === null) nullCount++;
    const idCol = o.id.padEnd(37);
    const name = (nameById.get(o.analysis_id) || '(?)').padEnd(23);
    const outcome = String(o.market_outcome).padEnd(15);
    const src = String(o.source || '').padEnd(29);
    const relCol = (rel || 'NULL').padEnd(18);
    const note = (o.source_notes || '').slice(0, 140).replace(/\n/g, ' ');
    console.log(`${idCol} | ${name} | ${outcome} | ${src} | ${relCol} | ${note}`);
  }
  console.log('');
  console.log(`Total reel: ${real.length}, resultats NULL au parse: ${nullCount}`);
}
main().catch(e => { console.error(e); process.exit(1); });
