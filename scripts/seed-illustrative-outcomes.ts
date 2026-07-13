// ============================================================
// PRELUDE - Seed illustratif des issues marché pour démo calibration
// ------------------------------------------------------------
// Objectif. Nourrir la boucle de calibration d un jeu d issues
// synthetiques etiquete ILLUSTRATIF, exclusivement pour la
// presentation investisseur. Ne remplace jamais des issues
// marche reelles : l upsert est conditionne au marqueur
// ILLUSTRATIVE_SOURCE, ce qui evite d ecraser des saisies
// manuelles legitimes portees par un partner sur un dossier
// donne (voir garde 'skip real outcome' plus bas).
//
// Perimetre du seed. Le plus grand segment de prediction_records
// partageant la meme empreinte de version stamp. Sur la base
// actuelle : 23 dossiers dans le segment principal.
//
// Correlation. L etat de chaque dossier (alive / exit / fail /
// flat) est derive du global_score de sa prediction, avec ~25%
// de bruit pour eviter une calibration parfaite qui serait
// suspecte. Graine deterministe pour reproductibilite et
// reversibilite : lancer le script plusieurs fois produit
// exactement les memes issues, aucun drift.
//
// Reversibilite. scripts/unseed-illustrative-outcomes.ts
// supprime uniquement les outcomes portant le marqueur
// ILLUSTRATIVE_SOURCE, laissant intactes les issues reelles.
//
// Immuabilite prediction_records. Le script ne touche QUE la
// table analysis_outcomes. prediction_records reste immuable
// par contrat (cf supabase-prediction-records-schema.sql:71-72).
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

// Marqueur canonique. Toute detection de mode illustratif dans
// l UI (banner CalibrationSummary) et toute suppression par
// unseed script s appuient sur cette chaine EXACTE.
export const ILLUSTRATIVE_SOURCE =
  'ILLUSTRATIF — données synthétiques de démonstration, non issues de résolutions marché réelles';

const ILLUSTRATIVE_NOTES = ILLUSTRATIVE_SOURCE;

// Graine deterministe. Change la graine pour regenerer un tirage
// different sans changer le protocole ; laisse-la stable pour
// obtenir toujours le meme seed apres relance.
const SEED = 20260712;

// Parametres de derivation. Ces valeurs sont documentees dans le
// commentaire de tete pour que le lecteur voie ce qui a calibre
// la difficulte de la demo.
const P_RESOLVED = 0.65;
const NOISE_RATIO = 0.25; // ~25% de cas discordants avec le score

// Mulberry32 : PRNG deterministe compact. Suffisant pour un tirage
// de 23 dossiers avec quelques rolls par dossier.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PredictionRow {
  id: string;
  analysis_id: string;
  user_id: string;
  global_score: number;
  captured_at: string;
  stamp_commit_sha: string | null;
  stamp_configs_hash: string | null;
  stamp_engines_hash: string | null;
  stamp_models_hash: string | null;
}

function fingerprintKey(r: PredictionRow): string {
  return [
    r.stamp_commit_sha ?? 'NULL',
    r.stamp_configs_hash ?? 'NULL',
    r.stamp_engines_hash ?? 'NULL',
    r.stamp_models_hash ?? 'NULL',
  ].join('|');
}

async function main() {
  // 1. Charge tous les prediction_records exploitables (verdict +
  //    scores + version_stamp renseignes), tries du plus recent au
  //    plus ancien pour dedupliquer par analysis_id.
  const { data: allPreds, error } = await supabase
    .from('prediction_records')
    .select('id, analysis_id, user_id, global_score, captured_at, stamp_commit_sha, stamp_configs_hash, stamp_engines_hash, stamp_models_hash')
    .not('verdict', 'is', null)
    .not('global_score', 'is', null)
    .not('success_probability', 'is', null)
    .not('version_stamp', 'is', null)
    .order('captured_at', { ascending: false });
  if (error) throw error;
  if (!allPreds || allPreds.length === 0) {
    console.error('Aucun prediction_record exploitable');
    process.exit(1);
  }
  const rows = allPreds as PredictionRow[];

  // 2. Dedupe par analysis_id, garde la prediction la plus recente.
  //    Coherent avec le comportement du calibration aggregator qui
  //    ne compte qu une prediction par analyse.
  const perAnalysis = new Map<string, PredictionRow>();
  for (const r of rows) {
    if (!perAnalysis.has(r.analysis_id)) perAnalysis.set(r.analysis_id, r);
  }

  // 3. Regroupe par fingerprint de version stamp et cherche le plus
  //    grand segment.
  const groups = new Map<string, PredictionRow[]>();
  for (const r of Array.from(perAnalysis.values())) {
    const k = fingerprintKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const sortedSegments = Array.from(groups.values()).sort((a, b) => b.length - a.length);
  const largest = sortedSegments[0];
  console.log(`Segments detectes : ${sortedSegments.length} (tailles : ${sortedSegments.map(s => s.length).join(', ')})`);
  console.log(`Segment cible : ${largest.length} predictions`);

  // Trie stable par analysis_id pour que le tirage rng soit
  // reproductible independamment de l ordre retourne par la DB.
  largest.sort((a, b) => a.analysis_id.localeCompare(b.analysis_id));

  // 4. Charge les outcomes existants du segment pour respecter les
  //    saisies reelles. Une issue reelle deja saisie n est jamais
  //    ecrasee par le seed illustratif.
  const analysisIds = largest.map(r => r.analysis_id);
  const { data: existingOutcomes } = await supabase
    .from('analysis_outcomes')
    .select('analysis_id, source')
    .in('analysis_id', analysisIds);
  const existingBySource = new Map<string, string>();
  for (const o of existingOutcomes || []) {
    existingBySource.set(o.analysis_id, o.source);
  }

  // 5. Tire les issues pour chaque dossier a partir du global_score.
  //    Formule : proba d issue positive = 0.15 + 0.7 * (score/100),
  //    donc 0.15 pour score=0 et 0.85 pour score=100. Un roll bruit
  //    de NOISE_RATIO inverse le signe pour simuler les cas
  //    discordants. Un second roll decide resolved / unresolved.
  const rng = mulberry32(SEED);
  const now = Date.now();

  interface OutcomePayload {
    analysis_id: string;
    user_id: string;
    market_outcome: 'alive' | 'exit' | 'fail' | 'flat';
    observed_at: string;
    source: string;
    source_notes: string;
    action: 'insert' | 'update' | 'skip-real';
  }

  const payloads: OutcomePayload[] = [];
  const counts = { alive: 0, exit: 0, fail: 0, flat: 0 };

  for (const p of largest) {
    // Detection issue reelle : source existante differente du marqueur
    // illustratif = saisie legitime, on ne l ecrase pas.
    const existingSrc = existingBySource.get(p.analysis_id);
    if (existingSrc && existingSrc !== ILLUSTRATIVE_SOURCE) {
      payloads.push({
        analysis_id: p.analysis_id,
        user_id: p.user_id,
        market_outcome: 'alive',
        observed_at: '1970-01-01',
        source: existingSrc,
        source_notes: '',
        action: 'skip-real',
      });
      continue;
    }

    const score = Math.max(0, Math.min(100, p.global_score ?? 50));
    const rBase = rng();
    const rNoise = rng();
    const rResolved = rng();
    const rDate = rng();

    const pPositive = 0.15 + 0.70 * (score / 100);
    let isPositive = rBase < pPositive;
    // Bruit : ~25% de retournement de signe pour eviter la
    // calibration parfaite qui serait suspecte a l oeil du partner.
    if (rNoise < NOISE_RATIO) isPositive = !isPositive;
    const isResolved = rResolved < P_RESOLVED;

    let outcome: OutcomePayload['market_outcome'];
    if (isResolved && isPositive) outcome = 'exit';
    else if (isResolved && !isPositive) outcome = 'fail';
    else if (!isResolved && isPositive) outcome = 'alive';
    else outcome = 'flat';
    counts[outcome]++;

    // observed_at : capturedAt + 60..540 jours, plafonne a today.
    // Simule un horizon de resolution plausible pour un VC.
    const capturedMs = new Date(p.captured_at).getTime();
    const days = 60 + Math.floor(rDate * 480);
    const observedMs = Math.min(capturedMs + days * 86_400_000, now);
    const observedAt = new Date(observedMs).toISOString().slice(0, 10);

    payloads.push({
      analysis_id: p.analysis_id,
      user_id: p.user_id,
      market_outcome: outcome,
      observed_at: observedAt,
      source: ILLUSTRATIVE_SOURCE,
      source_notes: ILLUSTRATIVE_NOTES,
      action: existingSrc === ILLUSTRATIVE_SOURCE ? 'update' : 'insert',
    });
  }

  const resolved = counts.exit + counts.fail;
  const skipped = payloads.filter(p => p.action === 'skip-real').length;
  console.log(`Distribution issues illustratives : alive=${counts.alive}, exit=${counts.exit}, fail=${counts.fail}, flat=${counts.flat}`);
  console.log(`Resolus (exit + fail) : ${resolved} (seuil calibration = 10)`);
  console.log(`Saisies reelles conservees (non ecrasees) : ${skipped}`);

  // 6. Upsert. On applique l onConflict analysis_id du schema.
  //    Chaque upsert est independant, on log les erreurs sans
  //    interrompre le batch (idempotence).
  let inserted = 0, updated = 0, failed = 0;
  for (const p of payloads) {
    if (p.action === 'skip-real') continue;
    const { error: upErr } = await supabase
      .from('analysis_outcomes')
      .upsert({
        analysis_id: p.analysis_id,
        user_id: p.user_id,
        market_outcome: p.market_outcome,
        observed_at: p.observed_at,
        source: p.source,
        source_url: null,
        source_notes: p.source_notes,
      }, { onConflict: 'analysis_id' });
    if (upErr) {
      console.error(`Upsert error for ${p.analysis_id}:`, upErr.message || upErr);
      failed++;
    } else {
      if (p.action === 'insert') inserted++;
      else updated++;
    }
  }
  console.log(`Upserts : ${inserted} inserts, ${updated} updates, ${failed} echecs`);

  // 7. Verifie que le seuil est franchi et que la calibration
  //    produira un resultat sur ce segment.
  if (resolved < 10) {
    console.warn(`AVERTISSEMENT : ${resolved} resolus sous le seuil de 10. Le segment restera "insufficient-data".`);
  } else {
    console.log(`OK : ${resolved} resolus depassent le seuil de 10. La calibration sera calculable.`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
