// ============================================================
// INGEST-JABRILIA-CORPUS
// ------------------------------------------------------------
// Script d ingestion du corpus de dossiers historiques resolus.
// Pour chaque PDF du dossier source, declenche un run frozen via
// la route /api/analyze locale, recupere l analysis_id produit,
// puis cree une ligne reference_dossiers en statut
// 'human_layer_pending' qui attendra la saisie partner ex-post.
//
// Discipline :
//   - --dry-run par defaut, --apply explicite pour ecrire pour
//     de vrai. Le dry-run liste les actions, n upload pas, ne
//     poste pas a /api/analyze.
//   - Idempotent : un dossier deja ingere (par source_pdf_filename
//     OU par company_name extrait du filename) est skip.
//   - Chemin par defaut : ~/jabrilia-corpus. Override en argument
//     positionnel : npx tsx scripts/ingest-jabrilia-corpus.ts /custom/path --apply
//   - Mode frozen impose : le re-run coupe le web search sur les
//     quatre moteurs concernes (team, market, financial-coherence,
//     macro) et entre dans le fingerprint via runMode pour former
//     un segment de calibration etanche.
//   - Pas de pipeline duplique : le script POST sur /api/analyze.
//     Le serveur Next doit donc tourner (npm run dev) au moment du
//     --apply. Configurable via env BASE_URL (defaut http://localhost:3000).
//
// Usage :
//   npx tsx --env-file=.env.local scripts/ingest-jabrilia-corpus.ts
//   npx tsx --env-file=.env.local scripts/ingest-jabrilia-corpus.ts --apply
//   npx tsx --env-file=.env.local scripts/ingest-jabrilia-corpus.ts /chemin/corpus --apply
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import {
  parseCliArgs,
  discoverPdfs,
  type PdfEntry,
} from './ingest-helpers';

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_CORPUS_PATH = join(homedir(), 'jabrilia-corpus');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BUCKET = 'dossier-uploads';
const OWNER_KEY = 'corpus-ingest';
const REPORT_PATH = 'reports/ingest-jabrilia-corpus.md';
// Pipeline /api/analyze prend 90 a 180s par dossier. 600s = marge
// large pour absorber les dossiers complexes ou la latence reseau.
const PIPELINE_TIMEOUT_MS = 600_000;

// ============================================================
// PARSING ARGUMENTS
// ============================================================

const cli = parseCliArgs(process.argv.slice(2));
const APPLY = cli.applyMode;
const DRY_RUN = !APPLY;
const VERBOSE = cli.verbose;
const CORPUS_PATH = cli.corpusPath || DEFAULT_CORPUS_PATH;

// ============================================================
// HELPERS
// ============================================================

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
    console.error('Lance avec --env-file=.env.local :');
    console.error('  npx tsx --env-file=.env.local scripts/ingest-jabrilia-corpus.ts');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned ? cleaned.slice(0, 120) : 'file';
}

// ============================================================
// IDEMPOTENCE - lookup reference_dossiers
// ============================================================

async function findExistingDossier(
  admin: ReturnType<typeof getAdmin>,
  pdf: PdfEntry,
): Promise<{ id: string; analysisId: string; status: string } | null> {
  const { data, error } = await admin
    .from('reference_dossiers')
    .select('id, analysis_id, ingestion_status, source_pdf_filename, company_name')
    .or(`source_pdf_filename.eq.${pdf.filename},company_name.eq.${pdf.companyName}`)
    .maybeSingle();
  if (error) {
    console.error('[ingest] findExisting error', error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    analysisId: data.analysis_id,
    status: data.ingestion_status,
  };
}

// ============================================================
// UPLOAD STORAGE
// ============================================================

async function uploadPdf(
  admin: ReturnType<typeof getAdmin>,
  pdf: PdfEntry,
  sessionId: string,
): Promise<{ storagePath: string; name: string; mimeType: string; size: number }> {
  const uid = randomUUID().slice(0, 8);
  const storagePath = `${OWNER_KEY}/${sessionId}/${uid}-${sanitizeFilename(pdf.filename)}`;
  const buffer = readFileSync(pdf.fullPath);
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
  if (error) {
    throw new Error(`storage-upload-failed ${pdf.filename} : ${error.message}`);
  }
  return {
    storagePath,
    name: pdf.filename,
    mimeType: 'application/pdf',
    size: pdf.size,
  };
}

// ============================================================
// POST /api/analyze + lecture SSE
// ============================================================

interface PipelineResult {
  analysisId: string;
  companyName: string;
}

async function runFrozenPipeline(
  fileRef: { storagePath: string; name: string; mimeType: string; size: number },
  asOf: string,
): Promise<PipelineResult> {
  const sessionId = fileRef.storagePath.split('/')[1];
  const body = {
    sessionId,
    ownerKey: OWNER_KEY,
    files: [fileRef],
    frozen: true,
    asOf,
  };
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PIPELINE_TIMEOUT_MS),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`pipeline-http ${res.status} : ${text.slice(0, 200)}`);
  }
  // SSE parse minimal : on accumule les chunks, on cherche les
  // blocs 'event: complete' avec leur 'data: {...json}'. Le payload
  // contient _persisted.id = analysis_id.
  let buffer = '';
  const decoder = new TextDecoder('utf-8');
  const reader = (res.body as any).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const ev of events) {
      const eventLine = ev.split('\n').find(l => l.startsWith('event:'));
      const dataLine = ev.split('\n').find(l => l.startsWith('data:'));
      if (!eventLine || !dataLine) continue;
      const evt = eventLine.replace(/^event:\s*/, '').trim();
      const raw = dataLine.replace(/^data:\s*/, '').trim();
      if (evt === 'complete') {
        let payload: any;
        try { payload = JSON.parse(raw); } catch { payload = null; }
        const analysisId = payload?._persisted?.id || payload?.meta?.analysisId || null;
        const extractedName = payload?.extraction?.companyName || payload?.meta?.companyName || null;
        if (!analysisId) throw new Error('complete event sans analysisId');
        return {
          analysisId,
          companyName: extractedName || '(nom non extrait)',
        };
      }
      if (evt === 'error') {
        throw new Error(`pipeline-error : ${raw.slice(0, 200)}`);
      }
    }
  }
  throw new Error('SSE stream coupe avant complete');
}

// ============================================================
// CREATION REFERENCE_DOSSIER
// ============================================================

async function createReferenceRow(
  admin: ReturnType<typeof getAdmin>,
  input: {
    analysisId: string;
    sourcePdfFilename: string;
    companyName: string;
    deckReceivedAt: string;
  },
): Promise<boolean> {
  const { error } = await admin.from('reference_dossiers').insert({
    analysis_id: input.analysisId,
    source_pdf_filename: input.sourcePdfFilename,
    company_name: input.companyName,
    deck_received_at: input.deckReceivedAt,
    ingestion_status: 'human_layer_pending',
  });
  if (error) {
    console.error('[ingest] reference_dossiers insert error', error);
    return false;
  }
  return true;
}

// ============================================================
// RAPPORT
// ============================================================

interface Counters {
  total: number;
  skippedExisting: number;
  wouldIngest: number;
  ingested: number;
  failed: number;
}

interface Failure {
  filename: string;
  reason: string;
}

interface Skipped {
  filename: string;
  reason: string;
}

function writeReport(opts: {
  counters: Counters;
  failures: Failure[];
  skipped: Skipped[];
  ingested: PipelineResult[];
  corpusPath: string;
  mode: 'DRY-RUN' | 'APPLY';
}) {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  const lines: string[] = [];
  lines.push('# Ingestion corpus Jabrilia, rapport d execution');
  lines.push('');
  lines.push(`Date : ${new Date().toISOString()}`);
  lines.push(`Mode : ${opts.mode}`);
  lines.push(`Chemin source : ${opts.corpusPath}`);
  lines.push(`Endpoint pipeline : ${BASE_URL}/api/analyze (frozen=true)`);
  lines.push('');
  lines.push('## Compteurs');
  lines.push('');
  lines.push('| Categorie | Compte |');
  lines.push('|---|---|');
  lines.push(`| Total PDFs decouverts | ${opts.counters.total} |`);
  lines.push(`| Skipped (deja ingere) | ${opts.counters.skippedExisting} |`);
  if (opts.mode === 'DRY-RUN') {
    lines.push(`| A ingerer | ${opts.counters.wouldIngest} |`);
  } else {
    lines.push(`| Ingere | ${opts.counters.ingested} |`);
  }
  lines.push(`| Echecs | ${opts.counters.failed} |`);
  lines.push('');
  if (opts.skipped.length > 0) {
    lines.push('## Dossiers skippes (idempotence)');
    lines.push('');
    for (const s of opts.skipped) {
      lines.push(`- ${s.filename} : ${s.reason}`);
    }
    lines.push('');
  }
  if (opts.ingested.length > 0) {
    lines.push('## Dossiers ingeres');
    lines.push('');
    lines.push('| Filename | Company | analysis_id |');
    lines.push('|---|---|---|');
    for (const r of opts.ingested) {
      lines.push(`| ${r.companyName} | ${r.analysisId} | ${r.analysisId} |`);
    }
    lines.push('');
  }
  if (opts.failures.length > 0) {
    lines.push('## Echecs');
    lines.push('');
    for (const f of opts.failures) {
      lines.push(`- ${f.filename} : ${f.reason}`);
    }
    lines.push('');
  }
  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf-8');
  console.log(`\nRapport ecrit : ${REPORT_PATH}`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('========================================================');
  console.log('INGESTION CORPUS JABRILIA');
  console.log('========================================================');
  console.log(`Mode : ${DRY_RUN ? 'DRY-RUN (lecture seule)' : 'APPLY (ecriture reelle)'}`);
  console.log(`Chemin : ${CORPUS_PATH}`);
  if (APPLY) {
    console.log(`Endpoint : ${BASE_URL}/api/analyze`);
  }
  console.log('');

  const admin = getAdmin();
  const pdfs = discoverPdfs(CORPUS_PATH);
  console.log(`${pdfs.length} PDF(s) decouvert(s).\n`);

  const counters: Counters = {
    total: pdfs.length,
    skippedExisting: 0,
    wouldIngest: 0,
    ingested: 0,
    failed: 0,
  };
  const failures: Failure[] = [];
  const skipped: Skipped[] = [];
  const ingested: PipelineResult[] = [];

  for (const pdf of pdfs) {
    const existing = await findExistingDossier(admin, pdf);
    if (existing) {
      counters.skippedExisting++;
      const reason = `deja en base (analysis_id=${existing.analysisId}, statut=${existing.status})`;
      skipped.push({ filename: pdf.filename, reason });
      console.log(`[${pdf.filename}] SKIP : ${reason}`);
      continue;
    }

    if (DRY_RUN) {
      counters.wouldIngest++;
      console.log(`[${pdf.filename}] WOULD-INGEST (company=${pdf.companyName}, as_of=${pdf.deckReceivedAt})`);
      continue;
    }

    // Apply : upload Storage, POST pipeline, ecriture reference_dossier.
    const sessionId = randomUUID();
    try {
      console.log(`[${pdf.filename}] upload Storage...`);
      const fileRef = await uploadPdf(admin, pdf, sessionId);

      console.log(`[${pdf.filename}] pipeline frozen (90-180s attendu)...`);
      const result = await runFrozenPipeline(fileRef, pdf.deckReceivedAt);

      console.log(`[${pdf.filename}] creation reference_dossier...`);
      // Si l extraction du pipeline a donne un meilleur nom, on l utilise
      // pour la company_name persistee. Le filename reste la clef d
      // idempotence.
      const finalCompanyName = result.companyName && result.companyName !== '(nom non extrait)'
        ? result.companyName
        : pdf.companyName;
      const created = await createReferenceRow(admin, {
        analysisId: result.analysisId,
        sourcePdfFilename: pdf.filename,
        companyName: finalCompanyName,
        deckReceivedAt: pdf.deckReceivedAt,
      });
      if (!created) {
        throw new Error('reference_dossiers insert echec (voir logs)');
      }
      counters.ingested++;
      ingested.push({ analysisId: result.analysisId, companyName: finalCompanyName });
      console.log(`[${pdf.filename}] INGESTED analysis_id=${result.analysisId} company=${finalCompanyName}`);
    } catch (err: any) {
      counters.failed++;
      const reason = err?.message || String(err);
      failures.push({ filename: pdf.filename, reason });
      console.error(`[${pdf.filename}] FAILED : ${reason}`);
      if (VERBOSE) console.error(err);
    }
  }

  console.log('\n========================================================');
  console.log(`Total                 : ${counters.total}`);
  console.log(`Skipped (existing)    : ${counters.skippedExisting}`);
  if (DRY_RUN) {
    console.log(`Would ingest          : ${counters.wouldIngest}`);
  } else {
    console.log(`Ingested              : ${counters.ingested}`);
  }
  console.log(`Failed                : ${counters.failed}`);
  console.log('========================================================');

  writeReport({
    counters,
    failures,
    skipped,
    ingested,
    corpusPath: CORPUS_PATH,
    mode: DRY_RUN ? 'DRY-RUN' : 'APPLY',
  });

  if (DRY_RUN) {
    console.log('\nRelance avec --apply pour ingerer pour de vrai.');
  }

  process.exit(counters.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Erreur fatale :', e?.message ?? e);
  process.exit(1);
});
