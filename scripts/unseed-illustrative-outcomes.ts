// ============================================================
// PRELUDE - Retrait des issues illustratives seedees pour la demo
// ------------------------------------------------------------
// Symmetrique de seed-illustrative-outcomes.ts. Supprime
// uniquement les analysis_outcomes portant le marqueur exact
// ILLUSTRATIF, sans jamais toucher aux saisies reelles. Permet
// de revenir a l etat vide proprement apres la presentation
// investisseur.
//
// prediction_records n est jamais touchee.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('/home/steve/Pr-lude/.env.local', 'utf-8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes dans .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// Doit rester strictement identique au marqueur du seed script,
// sous peine de ne pas retrouver les issues a supprimer.
export const ILLUSTRATIVE_SOURCE =
  'ILLUSTRATIF — données synthétiques de démonstration, non issues de résolutions marché réelles';

async function main() {
  const { data: matches, error: fetchErr } = await supabase
    .from('analysis_outcomes')
    .select('id, analysis_id, source')
    .eq('source', ILLUSTRATIVE_SOURCE);
  if (fetchErr) throw fetchErr;

  const count = (matches || []).length;
  if (count === 0) {
    console.log('Aucune issue illustrative en base. Rien a supprimer.');
    return;
  }
  console.log(`Issues illustratives detectees : ${count}`);

  const { error: delErr, count: deleted } = await supabase
    .from('analysis_outcomes')
    .delete({ count: 'exact' })
    .eq('source', ILLUSTRATIVE_SOURCE);
  if (delErr) throw delErr;

  console.log(`Suppressions effectuees : ${deleted ?? count}`);
  console.log('Les issues reelles (source differente du marqueur ILLUSTRATIF) sont intactes.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
