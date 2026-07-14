// Phase 3. Retro remplit reliability sur les issues reelles a
// partir de parseReliabilityFromNotes, avec override explicite
// et trace pour les notes ambigues.
//
// Un seul override doctrinal a ce jour :
//   Annajah Motors : la note dit "Fiabilite moyenne a haute", le
//   parse matche "moyenne" par le premier groupe. La source est
//   presse plus registres publics plus brevets deposes, categorie
//   source publique fiable, donc reliability = 'bonne' par
//   doctrine du module. Override trace ici et dans le commit.
//
// Dry run par defaut, --apply pour ecrire.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parseReliabilityFromNotes, type Reliability } from '../lib/calibration/corpus-selection';

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
const APPLY = process.argv.includes('--apply');

// Override explicite avec justification, une entree par outcome.id
const OVERRIDES: Record<string, { value: Reliability; justification: string }> = {
  '0f46dee8-c857-4271-b30b-bcbd5da4f661': {
    value: 'bonne',
    justification: 'Annajah Motors, note originelle "moyenne a haute" ambigue, source presse + registres publics + brevets deposes = source publique fiable, doctrine v2 tranche pour bonne.',
  },
};

async function main() {
  const { data: outcomes, error } = await supabase
    .from('analysis_outcomes')
    .select('id, analysis_id, market_outcome, source, source_notes, reliability')
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

  console.log(APPLY ? 'MODE APPLY' : 'MODE DRY RUN');
  console.log('='.repeat(160));
  const rows: { id: string; name: string; parsed: Reliability | null; final: Reliability | null; source: string }[] = [];
  for (const o of real) {
    const parsed = parseReliabilityFromNotes(o.source_notes);
    const override = OVERRIDES[o.id];
    const final = override ? override.value : parsed;
    const src = override ? `OVERRIDE (${override.justification.slice(0, 60)}...)` : 'PARSE';
    rows.push({ id: o.id, name: nameById.get(o.analysis_id) || '(?)', parsed, final, source: src });
    const cur = o.reliability || 'NULL';
    console.log(`  ${(o.id).padEnd(37)} | ${(nameById.get(o.analysis_id) || '(?)').padEnd(23)} | parse=${(parsed || 'NULL').padEnd(8)} | final=${(final || 'NULL').padEnd(8)} | actuel=${cur.padEnd(6)} | ${src}`);
  }

  const nullFinal = rows.filter(r => r.final === null);
  if (nullFinal.length > 0) {
    console.error('\nSTOP : lignes sans reliability finale, remplir explicitement avant apply.');
    for (const r of nullFinal) console.error(`  ${r.id} ${r.name}`);
    process.exit(2);
  }

  if (!APPLY) {
    console.log('\nDry run. Relancer avec --apply pour ecrire.');
    return;
  }

  console.log('\nEcriture en base...');
  let updated = 0;
  for (const r of rows) {
    const { error } = await supabase
      .from('analysis_outcomes')
      .update({ reliability: r.final })
      .eq('id', r.id);
    if (error) { console.error(`  [ECHEC] ${r.id} ${r.name} : ${error.message}`); process.exit(1); }
    updated++;
    console.log(`  [OK] ${r.name.padEnd(23)} reliability=${r.final}`);
  }

  // Verification finale
  const { data: check } = await supabase
    .from('analysis_outcomes')
    .select('id, reliability')
    .in('id', rows.map(r => r.id));
  console.log('\nVerification apres ecriture :');
  const nullAfter = (check || []).filter((r: any) => r.reliability === null);
  console.log(`  ${updated} lignes mises a jour, ${nullAfter.length} restent NULL.`);
  if (nullAfter.length > 0) { console.error('  Anomalie, sortie en erreur.'); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
