// ============================================================
// Tests deterministes reference-dossiers-store
// ------------------------------------------------------------
// Couvre la couche pure : validation du vocabulaire controle des
// motifs et stabilite du type IngestionStatus. La couche Supabase
// (CRUD) est hors scope (necessite une base reelle).
//
//   npx tsx lib/reference-dossiers-store.test.ts
// ============================================================

// Note : on importe le vocabulaire depuis le sous-module pur (sans
// server-only) plutot que depuis le store complet, parce que tsx en
// CLI ne peut pas charger le module 'server-only' (qui throw en
// dehors d un contexte Next.js Server). Le store reexporte les memes
// symboles pour les call sites server-side.
import {
  DECISION_MOTIFS,
  INGESTION_STATUS_VALUES,
  isValidDecisionMotif,
  validateDecisionMotifs,
} from './reference-dossiers-vocabulary';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`FAIL : ${label}`);
  }
}

// ============================================================
// 1. Vocabulaire des motifs : presence des six motifs cibles
// ============================================================
{
  const expected = [
    'equipe',
    'timing_marche',
    'unit_economics',
    'defensibilite',
    'signal_contrarien',
    'conviction_partner',
  ];
  for (const m of expected) {
    check(`Motif "${m}" present dans DECISION_MOTIFS`, (DECISION_MOTIFS as string[]).includes(m));
  }
  check('DECISION_MOTIFS contient exactement 6 entrees', DECISION_MOTIFS.length === expected.length);
}

// ============================================================
// 2. isValidDecisionMotif accepte et rejette correctement
// ============================================================
{
  check('isValidDecisionMotif accepte "equipe"', isValidDecisionMotif('equipe'));
  check('isValidDecisionMotif accepte "conviction_partner"', isValidDecisionMotif('conviction_partner'));
  check('isValidDecisionMotif rejette "team"', !isValidDecisionMotif('team'));
  check('isValidDecisionMotif rejette ""', !isValidDecisionMotif(''));
  check('isValidDecisionMotif rejette "EQUIPE" (case-sensitive)', !isValidDecisionMotif('EQUIPE'));
}

// ============================================================
// 3. validateDecisionMotifs filtre, dedup, signale les rejetes
// ============================================================
{
  const r1 = validateDecisionMotifs(['equipe', 'unit_economics', 'team']);
  check('accept liste pure', r1.accepted.length === 2 && r1.accepted.includes('equipe') && r1.accepted.includes('unit_economics'));
  check('rejete les motifs inconnus', r1.rejected.length === 1 && r1.rejected[0] === 'team');

  const r2 = validateDecisionMotifs(['equipe', 'equipe', 'defensibilite']);
  check('dedup les doublons', r2.accepted.length === 2);

  const r3 = validateDecisionMotifs(['  timing_marche  ', '']);
  check('trim et ignore les vides', r3.accepted.length === 1 && r3.accepted[0] === 'timing_marche');

  const r4 = validateDecisionMotifs([]);
  check('liste vide -> accepted vide', r4.accepted.length === 0 && r4.rejected.length === 0);
}

// ============================================================
// 4. INGESTION_STATUS_VALUES : presence des quatre etats
// ============================================================
{
  const expected = ['pending_run', 'run_complete', 'human_layer_pending', 'complete'];
  for (const s of expected) {
    check(`Statut "${s}" present`, (INGESTION_STATUS_VALUES as string[]).includes(s));
  }
  check('INGESTION_STATUS_VALUES contient exactement 4 entrees', INGESTION_STATUS_VALUES.length === expected.length);
}

console.log(`\n=== reference-dossiers-store ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
