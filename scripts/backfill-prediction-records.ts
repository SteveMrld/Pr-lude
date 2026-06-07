// ============================================================
// BACKFILL PREDICTION RECORDS
// ------------------------------------------------------------
// Cree un prediction_record pour chaque analyse historique deja
// persistee qui n en a pas encore. La brique reconciliation
// (commit a259c0d) ajoute le prediction record en fin de pipeline
// pour les runs futurs ; ce script remplit le passif pour que la
// calibration puisse demarrer avec une masse critique.
//
// Discipline :
//   - Idempotent strict : si un prediction_record existe deja
//     (peu importe son fingerprint), on skip.
//   - Stamp legacy explicite, fingerprint deterministe non
//     melangeable avec le segment courant : commitSha
//     'legacy-pre-a259c0d', configs/engines/models 'legacy'.
//     La segmentation SQL distingue le bloc historique du bloc
//     calibrable au premier coup d oeil.
//   - --dry-run par defaut : on liste ce qu on ferait sans
//     ecrire. --apply pour ecrire pour de vrai.
//   - Rapport markdown ecrit dans reports/backfill-prediction-records.md
//     avec compteurs par categorie + detail des echecs.
//
// Usage :
//   npx tsx --env-file=.env.local scripts/backfill-prediction-records.ts
//   npx tsx --env-file=.env.local scripts/backfill-prediction-records.ts --apply
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Note : on n importe pas lib/prediction-records-store.ts directement
// parce que ce module est marque 'server-only' (gate Next.js qui
// echoue en execution Node hors Next). On reproduit ici l ecriture
// brute via le client admin Supabase. La structure des colonnes est
// strictement alignee sur le store (mapping row -> objet est par
// ailleurs couvert par les tests de prediction-records-store.test.ts).

// ============================================================
// CONFIGURATION
// ============================================================

const LEGACY_COMMIT_SHA = 'legacy-pre-a259c0d';
const LEGACY_CONFIGS_HASH = 'legacy';
const LEGACY_ENGINES_HASH = 'legacy';
const LEGACY_MODELS_HASH = 'legacy';
const LEGACY_SCHEMA_VERSION = 'legacy-v1';

// Chemin de sortie du rapport (relatif au cwd au moment du lancement).
const REPORT_PATH = 'reports/backfill-prediction-records.md';

// ============================================================
// PARSING DES ARGUMENTS
// ============================================================

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY_RUN = !APPLY;
const VERBOSE = args.includes('--verbose');

// ============================================================
// HELPERS
// ============================================================

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
    console.error('Lance avec --env-file=.env.local :');
    console.error('  npx tsx --env-file=.env.local scripts/backfill-prediction-records.ts');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? (n as number) : null;
}

interface AnalysisRow {
  id: string;
  user_id: string;
  company_name: string;
  created_at: string;
  completed_at: string | null;
  status: string;
  verdict: string;
  global_score: number | null;
  result_json: any;
}

interface ReconstructedPayload {
  analysisId: string;
  userId: string;
  capturedAt: string;
  verdict: string;
  globalScore: number | null;
  successProbability: number | null;
  dimensions: {
    team: number | null;
    market: number | null;
    macro: number | null;
    financial: number | null;
    contrarian: number | null;
    vigilance: number | null;
  };
}

/**
 * Lit les six dimensions de façon defensive : mechanicalScore peut
 * etre soit a la racine du result_json (runs post-refonte score-
 * calculator), soit sous finalRecommendation (runs anciens), soit
 * absent (pipeline degrade). On retourne null par dimension si
 * indisponible.
 */
function extractDimensions(result: any): ReconstructedPayload['dimensions'] {
  const ms = result?.mechanicalScore || result?.finalRecommendation?.mechanicalScore || null;
  const d = ms?.dimensions || null;
  return {
    team: num(d?.team?.score),
    market: num(d?.market?.score),
    macro: num(d?.macro?.score),
    financial: num(d?.financial?.score),
    contrarian: num(d?.contrarian?.score),
    vigilance: num(d?.vigilance?.score),
  };
}

function reconstructPayload(row: AnalysisRow): ReconstructedPayload {
  const result = row.result_json || {};
  const reco = result.finalRecommendation || {};
  const ms = result.mechanicalScore || reco.mechanicalScore || {};

  const verdict = reco.verdict || row.verdict || 'approfondir';
  const globalScore = num(ms.globalScore) ?? num(reco.globalScore) ?? num(row.global_score);
  const successProbability = num(reco.successProbability);

  return {
    analysisId: row.id,
    userId: row.user_id,
    capturedAt: row.completed_at || row.created_at,
    verdict,
    globalScore,
    successProbability,
    dimensions: extractDimensions(result),
  };
}

function buildLegacyStamp(row: AnalysisRow): Record<string, any> {
  return {
    legacy: true,
    backfilledAt: new Date().toISOString(),
    sourceAnalysisId: row.id,
    originalRunAt: row.completed_at || row.created_at,
    commit: LEGACY_COMMIT_SHA,
    model: 'unknown-legacy',
    prompts: 'legacy',
    enginesHash: LEGACY_ENGINES_HASH,
    configHash: LEGACY_CONFIGS_HASH,
  };
}

/**
 * Insertion brute d un prediction_record legacy. Reproduit la
 * structure de colonnes de lib/prediction-records-store.ts sans
 * passer par le module (qui est gate 'server-only' Next.js et
 * casserait l execution Node hors Next).
 */
async function insertLegacyRow(
  admin: SupabaseClient,
  input: ReconstructedPayload & {
    legacyStamp: Record<string, any>;
    fingerprint: {
      commitSha: string | null;
      configsHash: string | null;
      enginesHash: string | null;
      modelsHash: string | null;
      inputsHash: string | null;
    };
  },
): Promise<{ id: string } | null> {
  const row = {
    analysis_id: input.analysisId,
    user_id: input.userId,
    captured_at: input.capturedAt,
    verdict: input.verdict,
    global_score: input.globalScore,
    success_probability: input.successProbability,
    dim_team: input.dimensions.team,
    dim_market: input.dimensions.market,
    dim_macro: input.dimensions.macro,
    dim_financial: input.dimensions.financial,
    dim_contrarian: input.dimensions.contrarian,
    dim_vigilance: input.dimensions.vigilance,
    version_stamp: input.legacyStamp,
    stamp_commit_sha: input.fingerprint.commitSha,
    stamp_configs_hash: input.fingerprint.configsHash,
    stamp_engines_hash: input.fingerprint.enginesHash,
    stamp_models_hash: input.fingerprint.modelsHash,
    stamp_inputs_hash: input.fingerprint.inputsHash,
    schema_version: LEGACY_SCHEMA_VERSION,
  };
  const { data, error } = await admin
    .from('prediction_records')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }
  return data;
}

function buildLegacyFingerprint(row: AnalysisRow) {
  return {
    commitSha: LEGACY_COMMIT_SHA,
    configsHash: LEGACY_CONFIGS_HASH,
    enginesHash: LEGACY_ENGINES_HASH,
    modelsHash: LEGACY_MODELS_HASH,
    // L inputs_hash est differencie par analysisId pour preserver
    // l unicite logique du tuple (deux records sur deux dossiers
    // distincts ne sont pas les memes inputs), tout en gardant un
    // prefixe 'legacy::' qui rend le segment legacy visible au
    // premier coup d oeil dans la table.
    inputsHash: `legacy::${row.id.slice(0, 12)}`,
  };
}

// ============================================================
// MAIN
// ============================================================

interface RunCounters {
  total: number;
  skipped_existing: number;
  inserted: number;
  failed: number;
  skipped_invalid: number;
}

interface Failure {
  analysisId: string;
  companyName: string;
  reason: string;
}

interface Skipped {
  analysisId: string;
  companyName: string;
  reason: string;
}

async function main() {
  console.log('========================================================');
  console.log('BACKFILL PREDICTION RECORDS');
  console.log('========================================================');
  console.log(`Mode : ${APPLY ? 'APPLY (ecriture reelle)' : 'DRY-RUN (lecture seule)'}`);
  if (VERBOSE) console.log('Verbose : ON');
  console.log('');

  const admin = getAdmin();

  // 1. Charge toutes les analyses persistees. La table n a pas de
  // deleted_at : on filtre sur status='completed' parce qu une
  // analyse pending/failed n a pas de prediction utile a logger
  // (verdict approximatif ou degrade). Les dossiers shell sans
  // resultJson ne sont pas eligibles.
  const { data: analyses, error: listErr } = await admin
    .from('analyses')
    .select('id, user_id, company_name, created_at, completed_at, status, verdict, global_score, result_json')
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  if (listErr) {
    console.error('Erreur de lecture des analyses :', listErr);
    process.exit(1);
  }
  if (!analyses || analyses.length === 0) {
    console.log('Aucune analyse completed trouvee.');
    writeReport({
      counters: { total: 0, skipped_existing: 0, inserted: 0, failed: 0, skipped_invalid: 0 },
      failures: [],
      skipped: [],
    });
    return;
  }
  console.log(`${analyses.length} analyses completed a auditer.`);

  // 2. Charge en bulk les analysis_id qui ont deja un prediction_record
  // pour eviter N+1 selects. Idempotence : un seul record par dossier
  // suffit a skipper, peu importe son origine (backfill ou non).
  const { data: existingRows, error: existingErr } = await admin
    .from('prediction_records')
    .select('analysis_id');

  // Cas 1 : la table prediction_records n existe pas (schema pas
  // encore applique en production). C est attendu sur une instance
  // qui n a jamais merge la brique reconciliation cote SQL. On
  // signale clairement et on aborde proprement.
  // PGRST205 = table introuvable cote PostgREST.
  const tableMissing = existingErr
    && ((existingErr as any).code === 'PGRST205'
      || /Could not find the table/i.test(existingErr.message || ''));
  if (tableMissing) {
    console.error('');
    console.error('PREREQUIS NON REMPLI');
    console.error('--------------------');
    console.error('La table prediction_records n existe pas encore dans cette instance Supabase.');
    console.error('Applique d abord le schema dedie via le SQL Editor Supabase :');
    console.error('  cat supabase-prediction-records-schema.sql | pbcopy   (ou equivalent)');
    console.error('Colle dans https://app.supabase.com/project/<projet>/sql/new puis Run.');
    console.error('Une fois la table creee, relance ce script :');
    console.error('  npx tsx --env-file=.env.local scripts/backfill-prediction-records.ts');
    console.error('');
    writeReport({
      counters: {
        total: analyses.length,
        skipped_existing: 0,
        inserted: 0,
        failed: 0,
        skipped_invalid: 0,
      },
      failures: [],
      skipped: [],
      schemaMissing: true,
      candidatesPreview: (analyses as AnalysisRow[]).map((a) => ({
        analysisId: a.id,
        companyName: a.company_name,
        verdict: a.verdict,
        globalScore: num(a.global_score),
      })),
    });
    process.exit(2);
  }

  if (existingErr) {
    console.error('Erreur de lecture des prediction_records existants :', existingErr);
    process.exit(1);
  }
  const existingIds = new Set<string>((existingRows || []).map((r: any) => r.analysis_id));
  console.log(`${existingIds.size} prediction_records deja en base.`);
  console.log('');

  // 3. Iteration : skip si deja present, sinon reconstruction +
  // insertion (ou simulation en dry-run).
  const counters: RunCounters = {
    total: analyses.length,
    skipped_existing: 0,
    inserted: 0,
    failed: 0,
    skipped_invalid: 0,
  };
  const failures: Failure[] = [];
  const skipped: Skipped[] = [];

  for (const row of analyses as AnalysisRow[]) {
    const tag = `[${row.id.slice(0, 8)} ${row.company_name}]`;

    if (existingIds.has(row.id)) {
      counters.skipped_existing++;
      if (VERBOSE) console.log(`${tag} SKIP : record deja present`);
      continue;
    }

    // Validation minimale : il faut au minimum un verdict pour creer
    // un record utile. globalScore et successProbability peuvent etre
    // null sur les pipelines degrades, c est attendu et la calibration
    // exclura proprement les records sans successProbability.
    if (!row.verdict && !row.result_json?.finalRecommendation?.verdict) {
      counters.skipped_invalid++;
      skipped.push({
        analysisId: row.id,
        companyName: row.company_name,
        reason: 'aucun verdict ni en colonne ni dans result_json',
      });
      if (VERBOSE) console.log(`${tag} SKIP-INVALID : pas de verdict`);
      continue;
    }

    const payload = reconstructPayload(row);
    const stamp = buildLegacyStamp(row);
    const fingerprint = buildLegacyFingerprint(row);

    if (DRY_RUN) {
      counters.inserted++;
      if (VERBOSE) {
        console.log(`${tag} WOULD-INSERT`);
        console.log(`  verdict=${payload.verdict} score=${payload.globalScore} successProb=${payload.successProbability}`);
        console.log(`  dims=${JSON.stringify(payload.dimensions)}`);
      } else if (counters.inserted <= 5) {
        console.log(`${tag} WOULD-INSERT (verdict=${payload.verdict}, score=${payload.globalScore})`);
      }
      continue;
    }

    try {
      const inserted = await insertLegacyRow(admin, {
        ...payload,
        legacyStamp: stamp,
        fingerprint,
      });
      if (!inserted) {
        counters.failed++;
        failures.push({
          analysisId: row.id,
          companyName: row.company_name,
          reason: 'insertLegacyRow a retourne null (echec Supabase silencieux)',
        });
        if (VERBOSE) console.log(`${tag} FAIL : null return`);
      } else {
        counters.inserted++;
        if (VERBOSE || counters.inserted <= 5) {
          console.log(`${tag} INSERTED (verdict=${payload.verdict}, score=${payload.globalScore})`);
        }
      }
    } catch (err: any) {
      counters.failed++;
      failures.push({
        analysisId: row.id,
        companyName: row.company_name,
        reason: err?.message || String(err),
      });
      if (VERBOSE) console.log(`${tag} FAIL : ${err?.message}`);
    }
  }

  // 4. Resume
  console.log('');
  console.log('========================================================');
  console.log(`Total                 : ${counters.total}`);
  console.log(`Skipped (existing)    : ${counters.skipped_existing}`);
  console.log(`Skipped (invalid)     : ${counters.skipped_invalid}`);
  console.log(`${DRY_RUN ? 'Would insert' : 'Inserted'.padEnd(22)}  : ${counters.inserted}`);
  console.log(`Failed                : ${counters.failed}`);
  console.log('========================================================');

  writeReport({ counters, failures, skipped });

  if (DRY_RUN && counters.inserted > 0) {
    console.log('');
    console.log('Relance avec --apply pour ecrire pour de vrai.');
  }
}

// ============================================================
// RAPPORT MARKDOWN
// ============================================================

function writeReport(payload: {
  counters: RunCounters;
  failures: Failure[];
  skipped: Skipped[];
  schemaMissing?: boolean;
  candidatesPreview?: Array<{ analysisId: string; companyName: string; verdict: string; globalScore: number | null }>;
}): void {
  const { counters, failures, skipped, schemaMissing, candidatesPreview } = payload;

  const lines: string[] = [];
  lines.push(`# Backfill prediction_records, rapport d execution`);
  lines.push('');
  lines.push(`Date : ${new Date().toISOString()}`);
  lines.push(`Mode : ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  lines.push(`Brique source : commit a259c0d (insertion automatique post-markAnalysisCompleted)`);
  lines.push('');
  lines.push(`## Tampon de version legacy applique`);
  lines.push('');
  lines.push('Tous les records backfilles partagent un fingerprint distinct du segment courant :');
  lines.push('');
  lines.push('```');
  lines.push(`commitSha    : ${LEGACY_COMMIT_SHA}`);
  lines.push(`configsHash  : ${LEGACY_CONFIGS_HASH}`);
  lines.push(`enginesHash  : ${LEGACY_ENGINES_HASH}`);
  lines.push(`modelsHash   : ${LEGACY_MODELS_HASH}`);
  lines.push(`inputsHash   : legacy::<sourceAnalysisId-prefix>`);
  lines.push(`schemaVersion: ${LEGACY_SCHEMA_VERSION}`);
  lines.push('```');
  lines.push('');
  lines.push('La couche de calibration segmente sur (commitSha + configsHash + enginesHash + modelsHash) :');
  lines.push('le segment legacy est donc unique et ne se melangera jamais avec les segments produits par');
  lines.push('les runs courants ou futurs.');
  lines.push('');
  if (schemaMissing) {
    lines.push(`## Schema non encore applique`);
    lines.push('');
    lines.push('La table `public.prediction_records` n a pas ete trouvee dans le schema Supabase.');
    lines.push('Le backfill ne peut pas s executer tant que le schema dedie n est pas applique.');
    lines.push('');
    lines.push('Etapes pour debloquer :');
    lines.push('');
    lines.push('1. Ouvrir le SQL Editor du projet Supabase Prelude.');
    lines.push('2. Coller le contenu de `supabase-prediction-records-schema.sql` (cree par le commit a259c0d).');
    lines.push('3. Executer la requete : deux tables creees (`prediction_records`, `analysis_outcomes`),');
    lines.push('   plus les index, RLS et trigger updated_at.');
    lines.push('4. Relancer ce script en dry-run pour valider, puis avec --apply.');
    lines.push('');
    if (candidatesPreview && candidatesPreview.length > 0) {
      lines.push(`### Candidats au backfill (${candidatesPreview.length})`);
      lines.push('');
      lines.push('Les analyses suivantes seront eligibles dès que la table existera :');
      lines.push('');
      lines.push(`| analysis_id | societe | verdict | score |`);
      lines.push(`|---|---|---|---|`);
      for (const c of candidatesPreview) {
        lines.push(`| ${c.analysisId} | ${c.companyName} | ${c.verdict} | ${c.globalScore ?? '—'} |`);
      }
      lines.push('');
    }
  }
  lines.push(`## Compteurs`);
  lines.push('');
  lines.push(`| Categorie | Compte |`);
  lines.push(`|---|---|`);
  lines.push(`| Total analyses completed | ${counters.total} |`);
  lines.push(`| Skipped (record deja present) | ${counters.skipped_existing} |`);
  lines.push(`| Skipped (verdict absent, invalide) | ${counters.skipped_invalid} |`);
  lines.push(`| ${APPLY ? 'Insertes' : 'A inserer'} | ${counters.inserted} |`);
  lines.push(`| Echecs | ${counters.failed} |`);
  lines.push('');

  if (skipped.length > 0) {
    lines.push(`## Analyses skip pour invalidite`);
    lines.push('');
    lines.push(`| analysis_id | societe | raison |`);
    lines.push(`|---|---|---|`);
    for (const s of skipped) {
      lines.push(`| ${s.analysisId} | ${s.companyName} | ${s.reason} |`);
    }
    lines.push('');
  }

  if (failures.length > 0) {
    lines.push(`## Echecs d insertion`);
    lines.push('');
    lines.push(`| analysis_id | societe | raison |`);
    lines.push(`|---|---|---|`);
    for (const f of failures) {
      lines.push(`| ${f.analysisId} | ${f.companyName} | ${f.reason} |`);
    }
    lines.push('');
  }

  lines.push(`## Discipline`);
  lines.push('');
  lines.push('Script idempotent : relancable autant de fois que necessaire, jamais de doublon.');
  lines.push('Le filtre d entree est `status=completed` plus l absence d un record en base.');
  lines.push('Aucune analyse pending ou failed n est touchee : leur verdict est approximatif et');
  lines.push('elles ne meritent pas d entrer dans la calibration.');
  lines.push('');
  lines.push('La couche de calibration filtre elle-meme les records sans successProbability');
  lines.push('(cf calibration-aggregator.ts) : la majorite des records legacy auront');
  lines.push('successProbability=null parce que les anciens runs ne portaient pas ce champ.');
  lines.push('Ils restent visibles comme historique mais ne biaisent pas le Brier.');

  const fullPath = join(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, lines.join('\n') + '\n');
  console.log(`Rapport ecrit : ${REPORT_PATH}`);
}

// ============================================================
// ENTRY
// ============================================================

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
