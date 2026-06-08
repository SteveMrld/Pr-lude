// ============================================================
// SET-CORPUS-OUTCOME
// ------------------------------------------------------------
// Ecrit ou met a jour la ligne analysis_outcomes pour un dossier
// corpus identifie par son nom de societe. Couvre l outcome
// qualitatif (exit/fail/flat/alive) et le quantum optionnel
// (multiple, IRR).
//
// L outcome vit dans analysis_outcomes, JAMAIS dans reference_
// dossiers. C est volontaire : l outcome peut etre enrichi
// automatiquement plus tard (pilier cycle de vie), la couche
// humaine reste manuelle. Les deux se rejoignent par jointure
// sur analysis_id quand on calibre.
//
// Le script resout company -> analysis_id via reference_dossiers
// (un seul match autorise par UNIQUE(company_name)).
//
// Usage :
//   npx tsx --env-file=.env.local scripts/set-corpus-outcome.ts \
//     --company "WeWork" --outcome fail --multiple 0.1 --irr -0.45
//   npx tsx --env-file=.env.local scripts/set-corpus-outcome.ts \
//     --company "Stripe" --outcome alive
// ============================================================

import { createClient } from '@supabase/supabase-js';

type MarketOutcome = 'alive' | 'exit' | 'fail' | 'flat';
const MARKET_OUTCOMES: MarketOutcome[] = ['alive', 'exit', 'fail', 'flat'];

// ============================================================
// PARSING ARGUMENTS
// ------------------------------------------------------------
// Parsing minimaliste --flag value, pas de dependance externe.
// Les flags non reconnus sont ignores avec un warning.
// ============================================================

interface Args {
  company: string | null;
  outcome: MarketOutcome | null;
  multiple: number | null;
  irr: number | null;
  observedAt: string | null;
  sourceNotes: string | null;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    company: null,
    outcome: null,
    multiple: null,
    irr: null,
    observedAt: null,
    sourceNotes: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--company') { out.company = next; i++; continue; }
    if (a === '--outcome') {
      if (!MARKET_OUTCOMES.includes(next as MarketOutcome)) {
        console.error(`--outcome doit etre l un de : ${MARKET_OUTCOMES.join(', ')} (recu : ${next})`);
        process.exit(1);
      }
      out.outcome = next as MarketOutcome;
      i++;
      continue;
    }
    if (a === '--multiple') {
      const n = parseFloat(next);
      if (!Number.isFinite(n)) {
        console.error(`--multiple doit etre numerique (recu : ${next})`);
        process.exit(1);
      }
      out.multiple = n;
      i++;
      continue;
    }
    if (a === '--irr') {
      const n = parseFloat(next);
      if (!Number.isFinite(n)) {
        console.error(`--irr doit etre numerique (recu : ${next})`);
        process.exit(1);
      }
      out.irr = n;
      i++;
      continue;
    }
    if (a === '--observed-at') { out.observedAt = next; i++; continue; }
    if (a === '--notes') { out.sourceNotes = next; i++; continue; }
    if (a.startsWith('--')) {
      console.warn(`Flag inconnu ignore : ${a}`);
    }
  }
  return out;
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
  if (!args.company) {
    console.error('Usage : --company "Nom" --outcome [exit|fail|flat|alive] [--multiple N] [--irr N] [--observed-at YYYY-MM-DD] [--notes "..."]');
    process.exit(1);
  }
  if (!args.outcome) {
    console.error('--outcome requis');
    process.exit(1);
  }

  const admin = getAdmin();

  // Resolution company -> analysis_id via reference_dossiers
  const { data: ref, error: refErr } = await admin
    .from('reference_dossiers')
    .select('id, analysis_id, company_name')
    .eq('company_name', args.company)
    .maybeSingle();
  if (refErr) {
    console.error('reference_dossiers lookup erreur :', refErr.message);
    process.exit(1);
  }
  if (!ref) {
    console.error(`Aucun reference_dossier pour company="${args.company}".`);
    console.error('Le dossier doit avoir ete ingere via scripts/ingest-jabrilia-corpus.ts avant la saisie outcome.');
    process.exit(1);
  }

  // Recupere user_id depuis la ligne analyses pour conserver la
  // coherence RLS de analysis_outcomes (user_id NOT NULL).
  const { data: analysisRow, error: anaErr } = await admin
    .from('analyses')
    .select('user_id')
    .eq('id', ref.analysis_id)
    .single();
  if (anaErr || !analysisRow) {
    console.error('analyses lookup erreur :', anaErr?.message || 'inconnu');
    process.exit(1);
  }

  const observedAt = args.observedAt || new Date().toISOString().slice(0, 10);
  const payload: Record<string, any> = {
    analysis_id: ref.analysis_id,
    user_id: analysisRow.user_id,
    market_outcome: args.outcome,
    observed_at: observedAt,
    source: 'manual-corpus',
  };
  if (args.multiple !== null) payload.multiple_at_exit = args.multiple;
  if (args.irr !== null) payload.irr = args.irr;
  if (args.sourceNotes) payload.source_notes = args.sourceNotes;

  const { data, error } = await admin
    .from('analysis_outcomes')
    .upsert(payload, { onConflict: 'analysis_id' })
    .select('*')
    .single();
  if (error) {
    console.error('analysis_outcomes upsert erreur :', error.message);
    process.exit(1);
  }

  console.log('Outcome ecrit pour', ref.company_name);
  console.log(`  analysis_id : ${ref.analysis_id}`);
  console.log(`  market      : ${data.market_outcome}`);
  console.log(`  observed_at : ${data.observed_at}`);
  if (data.multiple_at_exit !== null && data.multiple_at_exit !== undefined) {
    console.log(`  multiple    : ${data.multiple_at_exit}`);
  }
  if (data.irr !== null && data.irr !== undefined) {
    console.log(`  IRR         : ${data.irr}`);
  }
}

main().catch((e) => {
  console.error('Erreur fatale :', e?.message ?? e);
  process.exit(1);
});
