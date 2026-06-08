// ============================================================
// SET-CORPUS-VERDICT
// ------------------------------------------------------------
// Ecrit la couche humaine d un dossier corpus : verdict partner
// ex-post, raisonnement, motifs taxonomies, deviations post-
// investissement. Passe la ligne reference_dossiers en statut
// 'complete'.
//
// La taxonomie des motifs est validee applicativement contre
// le vocabulaire controle. Un motif inconnu rejette l ensemble
// du run pour eviter l ecriture silencieuse d un motif faute
// de frappe.
//
// Usage :
//   npx tsx --env-file=.env.local scripts/set-corpus-verdict.ts \
//     --company "WeWork" \
//     --verdict "refuser" \
//     --reasoning "Modele growth-subsidized incompatible doctrine." \
//     --motifs unit_economics,signal_contrarien \
//     --deviations "Sortie chaotique 2024."
// ============================================================

import { createClient } from '@supabase/supabase-js';

// Vocabulaire controle. Duplique ici par discipline scripts/ :
// pas d import du store (qui marque 'server-only'). Le store
// reste la source de verite a long terme, ce script reproduit
// la liste a l identique. Si la liste evolue, les tests detectent
// le drift.
const DECISION_MOTIFS = [
  'equipe',
  'timing_marche',
  'unit_economics',
  'defensibilite',
  'signal_contrarien',
  'conviction_partner',
] as const;

type DecisionMotif = typeof DECISION_MOTIFS[number];

function isValidMotif(value: string): value is DecisionMotif {
  return (DECISION_MOTIFS as readonly string[]).includes(value);
}

// ============================================================
// PARSING ARGUMENTS
// ============================================================

interface Args {
  company: string | null;
  verdict: string | null;
  reasoning: string | null;
  motifsCsv: string | null;
  deviations: string | null;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    company: null,
    verdict: null,
    reasoning: null,
    motifsCsv: null,
    deviations: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--company') { out.company = next; i++; continue; }
    if (a === '--verdict') { out.verdict = next; i++; continue; }
    if (a === '--reasoning') { out.reasoning = next; i++; continue; }
    if (a === '--motifs') { out.motifsCsv = next; i++; continue; }
    if (a === '--deviations') { out.deviations = next; i++; continue; }
    if (a.startsWith('--')) {
      console.warn(`Flag inconnu ignore : ${a}`);
    }
  }
  return out;
}

function parseMotifs(csv: string): { accepted: DecisionMotif[]; rejected: string[] } {
  const accepted: DecisionMotif[] = [];
  const rejected: string[] = [];
  for (const raw of csv.split(',')) {
    const v = raw.trim();
    if (!v) continue;
    if (isValidMotif(v)) {
      if (!accepted.includes(v)) accepted.push(v);
    } else {
      rejected.push(v);
    }
  }
  return { accepted, rejected };
}

// ============================================================
// HELPERS
// ============================================================

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
    console.error('Lance avec --env-file=.env.local');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.company || !args.verdict) {
    console.error('Usage : --company "Nom" --verdict "..." [--reasoning "..."] [--motifs csv] [--deviations "..."]');
    console.error(`Motifs valides : ${DECISION_MOTIFS.join(', ')}`);
    process.exit(1);
  }

  let motifs: DecisionMotif[] = [];
  if (args.motifsCsv) {
    const parsed = parseMotifs(args.motifsCsv);
    if (parsed.rejected.length > 0) {
      console.error('Motif(s) inconnu(s) rejete(s) :', parsed.rejected.join(', '));
      console.error(`Vocabulaire controle : ${DECISION_MOTIFS.join(', ')}`);
      console.error('Aucune ecriture realisee. Corrige et relance.');
      process.exit(1);
    }
    motifs = parsed.accepted;
  }

  const admin = getAdmin();

  // Resolution company -> reference_dossier
  const { data: ref, error: refErr } = await admin
    .from('reference_dossiers')
    .select('id, analysis_id, company_name, ingestion_status')
    .eq('company_name', args.company)
    .maybeSingle();
  if (refErr) {
    console.error('reference_dossiers lookup erreur :', refErr.message);
    process.exit(1);
  }
  if (!ref) {
    console.error(`Aucun reference_dossier pour company="${args.company}".`);
    console.error('Le dossier doit avoir ete ingere via scripts/ingest-jabrilia-corpus.ts.');
    process.exit(1);
  }

  const patch: Record<string, any> = {
    partner_verdict: args.verdict,
    partner_reasoning: args.reasoning ?? null,
    decision_motifs: motifs.length > 0 ? motifs : null,
    post_investment_deviations: args.deviations ?? null,
    ingestion_status: 'complete',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('reference_dossiers')
    .update(patch)
    .eq('id', ref.id)
    .select('*')
    .single();
  if (error) {
    console.error('reference_dossiers update erreur :', error.message);
    process.exit(1);
  }

  console.log('Couche humaine ecrite pour', ref.company_name);
  console.log(`  reference_dossier : ${ref.id}`);
  console.log(`  analysis_id       : ${ref.analysis_id}`);
  console.log(`  verdict           : ${data.partner_verdict}`);
  console.log(`  motifs            : ${(data.decision_motifs || []).join(', ') || '(aucun)'}`);
  console.log(`  status            : ${data.ingestion_status}`);
  if (ref.ingestion_status !== 'complete') {
    console.log(`  (statut precedent : ${ref.ingestion_status} -> complete)`);
  }
}

main().catch((e) => {
  console.error('Erreur fatale :', e?.message ?? e);
  process.exit(1);
});
