// ============================================================
// PRELUDE - Sectoral Intelligence Layer
// Sous-chantier 3 : initialisation des 13 fiches sectorielles
// ------------------------------------------------------------
// Lance regenerateSectoralBrief sur les 13 secteurs dans l ordre
// prescrit par Steve. Pour chaque fiche :
//   - log debut UTC, fin UTC, duree, cout reel, dimensions
//     data_missing, sources citees, echantillon de la fiche
//   - halte avec alerte si plus de 2 dimensions data_missing
//     (le regenerator rejette deja en interne au-dessus du
//     seuil 2, on capture le rejected_data_missing et on s arrete)
//   - persiste via persistSectoralBrief si succes
//
// Idempotence : si une fiche manual existe deja pour le secteur
// dans les 24h precedentes, on skip. Utile si le script est
// interrompu en milieu de batch et relance.
//
// Lancement :
//   npx tsx --env-file=.env.local scripts/init-sectoral-briefs.ts
//
// Variables requises :
//   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  SECTORS,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  regenerateSectoralBrief,
  persistSectoralBrief,
  getLatestBriefForSector,
  type SectoralBrief,
  type SectoralRegenerationResult,
  type DimensionKey,
} from '../lib/engines/sectoral-intelligence';

// ------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------

const ORDERED_SLUGS: string[] = [
  'logiciel-entreprise-horizontal',
  'ia-appliquee',
  'fintech',
  'sante-biotech',
  'climat-energie',
  'mobilite-logistique',
  'industrie-hardware',
  'agritech-foodtech',
  'commerce-marketplaces',
  'cybersecurite-defense',
  'crypto-blockchain',
  'proptech-construction',
  'education-future-of-work',
];

const OUTPUT_DIR = join(process.cwd(), 'scripts', 'sectoral-init-output');
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = join(OUTPUT_DIR, RUN_ID);

const MAX_DATA_MISSING_TOLERATED = 2;

// Seuil d idempotence : si une fiche manual existe deja datee de
// moins de SKIP_HOURS heures avant le lancement, on skip ce secteur.
const SKIP_HOURS = 24;

// ------------------------------------------------------------
// TYPES INTERNES DE REPORTING
// ------------------------------------------------------------

interface PerSectorReport {
  sector_slug: string;
  sector_label: string;
  started_at_utc: string;
  ended_at_utc: string;
  duration_ms: number;
  cost_usd: number;
  status: 'success' | 'rejected_data_missing' | 'rejected_error' | 'skipped_idempotent';
  dimensions_missing: DimensionKey[];
  total_sources_cited: number;
  brief_id?: string | null;
  rejection_reason?: string;
  error_message?: string;
  // Echantillon : score, confidence, premiere source par dimension.
  // Cap a 80 chars sur le titre/url pour rester lisible en log.
  sample?: Array<{
    dimension: DimensionKey;
    label: string;
    score: number | null;
    confidence: string;
    data_missing: boolean;
    first_source: { url: string; title: string } | null;
  }>;
  narrative_excerpt?: string;
}

interface RunReport {
  run_id: string;
  started_at_utc: string;
  ended_at_utc: string;
  duration_ms_total: number;
  cost_usd_total: number;
  per_sector: PerSectorReport[];
  distribution: {
    success_no_missing: number;
    success_with_missing: number;
    rejected: number;
    skipped_idempotent: number;
  };
  scores_per_dimension: Record<
    DimensionKey,
    { count: number; min: number | null; max: number | null; mean: number | null }
  >;
}

// ------------------------------------------------------------
// LOGGING HELPERS
// ------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function log(line: string): void {
  const stamp = nowIso();
  // eslint-disable-next-line no-console
  console.log(`[${stamp}] ${line}`);
}

function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true });
}

function writeSectorArtifact(slug: string, payload: unknown): void {
  const path = join(RUN_DIR, `${slug}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
}

function writeRunReport(report: RunReport): void {
  const path = join(RUN_DIR, '_run-report.json');
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
}

// ------------------------------------------------------------
// CONSTRUCTION DE L ECHANTILLON
// ------------------------------------------------------------

function buildSample(brief: SectoralBrief): PerSectorReport['sample'] {
  return DIMENSION_KEYS.map((k) => {
    const d = brief.dimensions[k];
    const first = d.sources_cited[0];
    return {
      dimension: k,
      label: DIMENSION_LABELS[k],
      score: d.score,
      confidence: d.confidence,
      data_missing: d.data_missing,
      first_source: first
        ? { url: first.url.slice(0, 120), title: first.title.slice(0, 120) }
        : null,
    };
  });
}

// ------------------------------------------------------------
// AGGREGATION FINALE
// ------------------------------------------------------------

function emptyScoresPerDimension(): RunReport['scores_per_dimension'] {
  const acc = {} as RunReport['scores_per_dimension'];
  for (const k of DIMENSION_KEYS) {
    acc[k] = { count: 0, min: null, max: null, mean: null };
  }
  return acc;
}

function aggregateDistribution(per: PerSectorReport[]): RunReport['distribution'] {
  return per.reduce(
    (acc, r) => {
      if (r.status === 'success') {
        if (r.dimensions_missing.length === 0) acc.success_no_missing += 1;
        else acc.success_with_missing += 1;
      } else if (r.status === 'skipped_idempotent') {
        acc.skipped_idempotent += 1;
      } else {
        acc.rejected += 1;
      }
      return acc;
    },
    {
      success_no_missing: 0,
      success_with_missing: 0,
      rejected: 0,
      skipped_idempotent: 0,
    },
  );
}

function aggregateScoresPerDimension(
  briefs: SectoralBrief[],
): RunReport['scores_per_dimension'] {
  const acc = emptyScoresPerDimension();
  for (const k of DIMENSION_KEYS) {
    const scores = briefs
      .map((b) => b.dimensions[k]?.score)
      .filter((s): s is number => typeof s === 'number');
    if (scores.length === 0) continue;
    const sum = scores.reduce((s, v) => s + v, 0);
    acc[k] = {
      count: scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
      mean: Math.round((sum / scores.length) * 10) / 10,
    };
  }
  return acc;
}

// ------------------------------------------------------------
// IDEMPOTENCE
// ------------------------------------------------------------

async function isRecentManualBriefPresent(slug: string): Promise<boolean> {
  try {
    const latest = await getLatestBriefForSector(slug);
    if (!latest) return false;
    if (latest.regeneration_trigger !== 'manual') return false;
    const ageMs = Date.now() - new Date(latest.generated_at).getTime();
    return ageMs < SKIP_HOURS * 3600 * 1000;
  } catch (err) {
    log(`avertissement : lookup idempotence ${slug} a echoue, on procede : ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ------------------------------------------------------------
// BOUCLE PRINCIPALE
// ------------------------------------------------------------

async function processSector(slug: string): Promise<{
  report: PerSectorReport;
  brief: SectoralBrief | null;
  halt: boolean;
}> {
  const sector = SECTORS.find((s) => s.slug === slug);
  if (!sector) {
    return {
      report: {
        sector_slug: slug,
        sector_label: slug,
        started_at_utc: nowIso(),
        ended_at_utc: nowIso(),
        duration_ms: 0,
        cost_usd: 0,
        status: 'rejected_error',
        dimensions_missing: [],
        total_sources_cited: 0,
        rejection_reason: `Slug inconnu ${slug}, absent du catalogue SECTORS.`,
      },
      brief: null,
      halt: true,
    };
  }

  if (await isRecentManualBriefPresent(slug)) {
    log(`${sector.label} : fiche manual recente detectee (< ${SKIP_HOURS}h), skip idempotent`);
    return {
      report: {
        sector_slug: slug,
        sector_label: sector.label,
        started_at_utc: nowIso(),
        ended_at_utc: nowIso(),
        duration_ms: 0,
        cost_usd: 0,
        status: 'skipped_idempotent',
        dimensions_missing: [],
        total_sources_cited: 0,
      },
      brief: null,
      halt: false,
    };
  }

  const startedAt = nowIso();
  const startMs = Date.now();
  log(`${sector.label} : debut regeneration LLM`);

  let result: SectoralRegenerationResult;
  try {
    result = await regenerateSectoralBrief(slug, 'manual');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const endedAt = nowIso();
    log(`${sector.label} : exception non geree ${message}`);
    return {
      report: {
        sector_slug: slug,
        sector_label: sector.label,
        started_at_utc: startedAt,
        ended_at_utc: endedAt,
        duration_ms: Date.now() - startMs,
        cost_usd: 0,
        status: 'rejected_error',
        dimensions_missing: [],
        total_sources_cited: 0,
        rejection_reason: 'Exception non capturee par le regenerator.',
        error_message: message,
      },
      brief: null,
      halt: true,
    };
  }

  const endedAt = nowIso();

  if (result.status !== 'success' || !result.brief) {
    log(
      `${sector.label} : ${result.status} (${result.dimensions_missing.length} dimensions data_missing, cout ${result.cost_usd.toFixed(4)} USD)`,
    );
    const halt =
      result.status === 'rejected_data_missing' &&
      result.dimensions_missing.length > MAX_DATA_MISSING_TOLERATED;
    return {
      report: {
        sector_slug: slug,
        sector_label: sector.label,
        started_at_utc: startedAt,
        ended_at_utc: endedAt,
        duration_ms: result.duration_ms,
        cost_usd: result.cost_usd,
        status: result.status,
        dimensions_missing: result.dimensions_missing,
        total_sources_cited: result.total_sources_cited,
        rejection_reason: result.rejection_reason,
        error_message: result.error_message,
      },
      brief: null,
      halt,
    };
  }

  // Succes. On persiste.
  let briefPersisted: SectoralBrief | null = null;
  try {
    briefPersisted = await persistSectoralBrief(result.brief);
    log(
      `${sector.label} : persiste id=${briefPersisted.id} cout=${result.cost_usd.toFixed(4)} USD duree=${(result.duration_ms / 1000).toFixed(1)}s sources=${result.total_sources_cited} missing=${result.dimensions_missing.length}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`${sector.label} : echec persistence ${message}`);
    return {
      report: {
        sector_slug: slug,
        sector_label: sector.label,
        started_at_utc: startedAt,
        ended_at_utc: endedAt,
        duration_ms: result.duration_ms,
        cost_usd: result.cost_usd,
        status: 'rejected_error',
        dimensions_missing: result.dimensions_missing,
        total_sources_cited: result.total_sources_cited,
        rejection_reason: 'Echec persistence Supabase apres generation reussie.',
        error_message: message,
        sample: buildSample(result.brief),
        narrative_excerpt: result.brief.narrative_summary.slice(0, 400),
      },
      brief: result.brief,
      halt: true,
    };
  }

  return {
    report: {
      sector_slug: slug,
      sector_label: sector.label,
      started_at_utc: startedAt,
      ended_at_utc: endedAt,
      duration_ms: result.duration_ms,
      cost_usd: result.cost_usd,
      status: 'success',
      dimensions_missing: result.dimensions_missing,
      total_sources_cited: result.total_sources_cited,
      brief_id: briefPersisted.id ?? null,
      sample: buildSample(briefPersisted),
      narrative_excerpt: briefPersisted.narrative_summary.slice(0, 400),
    },
    brief: briefPersisted,
    halt:
      result.dimensions_missing.length > MAX_DATA_MISSING_TOLERATED,
  };
}

async function main(): Promise<void> {
  ensureOutputDir();
  log(`run_id=${RUN_ID}, output=${RUN_DIR}`);
  log(`Pre-flight env : ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ? 'present' : 'MANQUANTE'}, SUPABASE_URL=${process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'MANQUANTE'}, SUPABASE_SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MANQUANTE'}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    log('ANTHROPIC_API_KEY manquante, abandon.');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    log('Credentials Supabase manquantes, abandon (les fiches ne pourraient pas etre persistees).');
    process.exit(1);
  }

  const startRunIso = nowIso();
  const startRunMs = Date.now();

  const reports: PerSectorReport[] = [];
  const briefs: SectoralBrief[] = [];

  for (const slug of ORDERED_SLUGS) {
    const { report, brief, halt } = await processSector(slug);
    reports.push(report);
    if (brief) briefs.push(brief);
    writeSectorArtifact(slug, { report, brief });

    if (halt) {
      log(`HALTE : ${slug} a declenche un arret. Ecriture du rapport partiel et exit.`);
      const partial: RunReport = {
        run_id: RUN_ID,
        started_at_utc: startRunIso,
        ended_at_utc: nowIso(),
        duration_ms_total: Date.now() - startRunMs,
        cost_usd_total: reports.reduce((s, r) => s + r.cost_usd, 0),
        per_sector: reports,
        distribution: aggregateDistribution(reports),
        scores_per_dimension: aggregateScoresPerDimension(briefs),
      };
      writeRunReport(partial);
      // eslint-disable-next-line no-console
      console.log('\n=== HALTE PARTIELLE ===');
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(partial, null, 2));
      process.exit(2);
    }
  }

  const finalReport: RunReport = {
    run_id: RUN_ID,
    started_at_utc: startRunIso,
    ended_at_utc: nowIso(),
    duration_ms_total: Date.now() - startRunMs,
    cost_usd_total: reports.reduce((s, r) => s + r.cost_usd, 0),
    per_sector: reports,
    distribution: aggregateDistribution(reports),
    scores_per_dimension: aggregateScoresPerDimension(briefs),
  };
  writeRunReport(finalReport);

  log('=== RAPPORT SYNTHESE ===');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(finalReport, null, 2));
}

main().catch((err) => {
  log(`Erreur fatale : ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
