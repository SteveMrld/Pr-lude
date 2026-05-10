// ============================================================
// CALIBRATION LLM REELLE - FRAGILITE STRUCTURELLE
// ------------------------------------------------------------
// Pour chaque pattern Phase 4, exerce trois corpus selectionnes
// dans la grille de reference :
//   - confirmed  : counter-archetype derive (verdict severe attendu)
//   - healthy    : counter-archetype sain (verdict sain attendu)
//   - borderline : cas mitige ou intermediaire (verdict
//                  attention ou alerte selon le pattern)
//
// Le script lance pattern.analyze en LLM reel sur les 21 cas,
// logge pour chaque run le verdict, le globalScore, les trois
// axes, le counter-archetype identifie et la duree, puis
// compare aux expectations doctrinales et signale les ecarts.
// Aucun ajustement de prompt dans ce passage : on collecte.
//
// Usage :
//   npx tsx --env-file=.env.local \
//     lib/engines/fragility-structurelle/calibration-llm.test.ts
//
// Variables d env :
//   ANTHROPIC_API_KEY (requis)
//   PARALLEL          (defaut 3)
//   ONLY=patternId    (optionnel : limite a un seul pattern)
//
// Sortie :
//   - logs detailles sur stdout
//   - dump JSON brut dans scripts/calibration-output/
//
// Note : ce fichier est un .test.ts par convention de nommage
// du repo, mais il appelle Claude en reel et n est PAS
// deterministe. Il ne doit pas etre inclus dans la suite tsx
// run-all-tests sans precaution (le run prendra plusieurs
// minutes et facturera des tokens).
// ============================================================

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Imports side-effect : auto-enregistrement des sept patterns
// dans le registry de l orchestrateur.
import './growth-subsidized-pattern';
import './infrastructure-hostage-pattern';
import './fixed-cost-trap-pattern';
import './regulatory-time-bomb-pattern';
import './commoditization-drift-pattern';
import './capital-structure-fragility-pattern';
import './scale-mirage-risk-pattern';

import { _getRegistryForTests } from './orchestrator';
import {
  PATTERN_IDS,
  PATTERN_LABELS,
  type PatternId,
  type PatternAnalysisOutput,
  type PatternInput,
  type PatternVerdict,
} from './types';
import {
  getDossier,
  type DossierId,
} from '../../../scripts/fixtures/reference-dossiers';
import {
  EXPECTATIONS,
  calibrationStatus,
} from '../../../scripts/fixtures/calibration-expectations';

// ============================================================
// SELECTION DES CORPUS : trio par pattern
// ------------------------------------------------------------
// Les dossiers sont reutilises depuis scripts/fixtures/reference-
// dossiers. Pour chaque pattern, on choisit dans la grille des
// dix dossiers les trois cas qui exercent le pattern : un
// confirmed canonique, un counter-archetype sain, et un cas
// borderline qui devrait remonter en attention ou alerte.
// ============================================================

type Role = 'confirmed' | 'healthy' | 'borderline';
const ROLES: Role[] = ['confirmed', 'healthy', 'borderline'];

const TRIO: Record<PatternId, Record<Role, DossierId>> = {
  // GSM : MoviePass est le pattern le plus pur de subvention de
  // croissance. Atlassian le counter-archetype canonique. Klarna
  // 2022 le borderline alerte (BNPL non rentable mais scale revenu).
  'growth-subsidized-model': {
    confirmed: 'moviepass-2017',
    healthy: 'atlassian-preipo-2015',
    borderline: 'klarna-2022',
  },
  // Infrastructure Hostage : Mistral confirme (NVIDIA + Azure +
  // Microsoft investisseur, triple captivite). Stripe sain (l infra
  // qu utilisent les autres). MoviePass borderline (captif des
  // chaines cinema sans deal commercial).
  'infrastructure-hostage': {
    confirmed: 'mistral-seriesB-2024',
    healthy: 'stripe-seriesE-2016',
    borderline: 'moviepass-2017',
  },
  // FCT : WeWork canonique. Atlassian asset-light. Ynsect borderline
  // alerte (capex industriel engage mais scale moindre que Northvolt).
  'fixed-cost-trap': {
    confirmed: 'wework-preipo-2019',
    healthy: 'atlassian-preipo-2015',
    borderline: 'ynsect-seriesD-2022',
  },
  // RTB : Klarna confirme (CFPB + CCD-2 imminents). Atlassian sain
  // (B2B SaaS hors regulation). Mistral borderline (AI Act adopte
  // 2024, obligations sur foundation models).
  'regulatory-time-bomb': {
    confirmed: 'klarna-2022',
    healthy: 'atlassian-preipo-2015',
    borderline: 'mistral-seriesB-2024',
  },
  // CD : Casper confirme (DTC matelas commoditise). Stripe sain
  // (switching cost API + Connect). Mistral borderline (open weight
  // expose a LLaMa Meta et Qwen).
  'commoditization-drift': {
    confirmed: 'casper-preipo-2019',
    healthy: 'stripe-seriesE-2016',
    borderline: 'mistral-seriesB-2024',
  },
  // CSF : Klarna confirme (down round 85%, preferences en cascade).
  // Atlassian sain (bootstrappe). Northvolt borderline (cap table 9 Md
  // leves cumules avec preferences elevees mais pas encore down round).
  'capital-structure-fragility': {
    confirmed: 'klarna-2022',
    healthy: 'atlassian-preipo-2015',
    borderline: 'northvolt-seriesE-2023',
  },
  // SMR : Northvolt canonique (gigafactory 8 Md USD, yield <50%).
  // Stripe sain (scale par API). Casper borderline (60 stores
  // retail, capex amenagement sans demande prouvee).
  'scale-mirage-risk': {
    confirmed: 'northvolt-seriesE-2023',
    healthy: 'stripe-seriesE-2016',
    borderline: 'casper-preipo-2019',
  },
};

// ============================================================
// EXECUTION D UN PATTERN SUR UN DOSSIER
// ============================================================

interface RunResult {
  patternId: PatternId;
  dossierId: DossierId;
  role: Role;
  durationMs: number;
  output: PatternAnalysisOutput | null;
  error: string | null;
}

async function runOne(patternId: PatternId, role: Role): Promise<RunResult> {
  const dossierId = TRIO[patternId][role];
  const dossier = getDossier(dossierId);
  const registry = _getRegistryForTests();
  const moduleP = registry[patternId];
  const t0 = Date.now();
  if (!moduleP) {
    return {
      patternId, dossierId, role, durationMs: 0, output: null,
      error: `Pattern ${patternId} non enregistre dans le registry (oubli d import side-effect ?)`,
    };
  }
  const input: PatternInput = {
    extraction: dossier.extraction,
    financialData: dossier.financialData,
    marketAnalysis: null,
    rawPitchText: null,
    fundNote: null,
  };
  try {
    const output = await moduleP.analyze(input);
    return { patternId, dossierId, role, durationMs: Date.now() - t0, output, error: null };
  } catch (err: any) {
    return {
      patternId, dossierId, role, durationMs: Date.now() - t0, output: null,
      error: err?.message ?? String(err),
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  parallel: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function consume(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, items.length) }, consume));
  return results;
}

// ============================================================
// EVALUATION : statut par run
// ------------------------------------------------------------
// Wrap autour de calibrationStatus pour gerer le cas globalScore
// null : si le gating axe central a force la non-applicabilite,
// le run est compatible avec une expectation 'non-applicable',
// sinon c est un mismatch a relever.
// ============================================================

type RunStatus = 'match' | 'close' | 'mismatch' | 'error';

function evaluateRun(r: RunResult): RunStatus {
  if (r.error) return 'error';
  const out = r.output!;
  const exp = EXPECTATIONS[r.patternId][r.dossierId];

  if (out.globalScore === null) {
    return exp.expectedVerdict === 'non-applicable' ? 'match' : 'mismatch';
  }
  return calibrationStatus(exp, out.verdict, out.globalScore);
}

// ============================================================
// LOGGING D UN RUN
// ============================================================

const STATUS_TAG: Record<RunStatus, string> = {
  match: 'MATCH',
  close: 'PROCHE',
  mismatch: 'ECART',
  error: 'ERREUR',
};

function logRun(r: RunResult): void {
  const dossier = getDossier(r.dossierId);
  const exp = EXPECTATIONS[r.patternId][r.dossierId];
  const status = evaluateRun(r);
  const durSec = (r.durationMs / 1000).toFixed(1);
  console.log('');
  console.log(`--- ${PATTERN_LABELS[r.patternId]} | ${r.role.toUpperCase()} | ${dossier.label} (${durSec}s) [${STATUS_TAG[status]}] ---`);
  if (r.error) {
    console.log(`  ERREUR        : ${r.error}`);
    return;
  }
  const out = r.output!;
  const score = out.globalScore === null ? 'null (gating)' : `${out.globalScore}`;
  const expectedRange = `${exp.expectedScoreRange[0]}-${exp.expectedScoreRange[1]}`;
  console.log(`  Verdict       : ${out.verdict} (attendu ${exp.expectedVerdict})`);
  console.log(`  Score global  : ${score} (range attendue ${expectedRange})`);
  console.log(`  Applicabilite : ${out.applicabilite}`);
  // Outputs partiels : un pattern peut omettre counterArchetype ou un axis
  // si le LLM a retourne un JSON incomplet. On log '(absent)' plutot que de
  // crasher tout le harnais (regression vue lors du run baseline du
  // 2026-05-10 sur un job CSF/SMR).
  const ca = out.counterArchetype;
  const counterStr = ca ? `${ca.closest} (${ca.direction})` : '(absent)';
  console.log(`  Counter-arch  : ${counterStr}`);
  logAxis(out.axis1, 'Axe 1');
  logAxis(out.axis2, 'Axe 2');
  logAxis(out.axis3, 'Axe 3');
  console.log(`  Reco DD       : ${truncate(out.recommandationDD, 200)}`);
  if (status === 'mismatch' || status === 'close') {
    console.log(`  ATTENDU       : ${exp.doctrineRationale}`);
  }
}

function logAxis(axis: PatternAnalysisOutput['axis1'] | undefined, label: string): void {
  if (!axis) {
    console.log(`  ${label} (absent)`);
    return;
  }
  console.log(`  ${label} ${axis.verdict} ${axis.score}/100 : ${truncate(axis.rationale, 200)}`);
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '(vide)';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// ============================================================
// SYNTHESE DE FIN
// ============================================================

interface Counters {
  match: number;
  close: number;
  mismatch: number;
  error: number;
}

function tally(results: RunResult[]): Counters {
  const c: Counters = { match: 0, close: 0, mismatch: 0, error: 0 };
  for (const r of results) c[evaluateRun(r)]++;
  return c;
}

function buildSummary(results: RunResult[], totalSec: number): string {
  const c = tally(results);
  const total = results.length;
  const pct = (n: number) => total ? `${((n / total) * 100).toFixed(0)}%` : '0%';
  const lines: string[] = [];
  lines.push('');
  lines.push('============================================================');
  lines.push('SYNTHESE DE CALIBRATION LLM');
  lines.push('============================================================');
  lines.push(`Total runs    : ${total}`);
  lines.push(`Duree totale  : ${totalSec.toFixed(1)} s`);
  lines.push(`MATCH         : ${c.match} (${pct(c.match)})`);
  lines.push(`PROCHE        : ${c.close}`);
  lines.push(`ECART         : ${c.mismatch}`);
  lines.push(`ERREUR        : ${c.error}`);
  lines.push('');

  // Ecarts groupes par pattern pour faciliter le triage. On itere
  // sur PATTERN_IDS plutot que sur les cles d une Map pour rester
  // compatible avec target es5 (pas de --downlevelIteration).
  const ecartsParPattern: Partial<Record<PatternId, RunResult[]>> = {};
  for (const r of results) {
    const status = evaluateRun(r);
    if (status === 'mismatch' || status === 'error') {
      const arr = ecartsParPattern[r.patternId] ?? [];
      arr.push(r);
      ecartsParPattern[r.patternId] = arr;
    }
  }

  const patternsAvecEcart = PATTERN_IDS.filter((p) => ecartsParPattern[p] && ecartsParPattern[p]!.length > 0);
  if (patternsAvecEcart.length > 0) {
    lines.push('Patterns avec decalages a traiter en passage separe :');
    for (const patternId of patternsAvecEcart) {
      const runs = ecartsParPattern[patternId]!;
      lines.push('');
      lines.push(`* ${patternId} (${PATTERN_LABELS[patternId]})`);
      for (const r of runs) {
        if (r.error) {
          lines.push(`    [ERREUR] ${r.role} ${r.dossierId} : ${r.error}`);
          continue;
        }
        const exp = EXPECTATIONS[r.patternId][r.dossierId];
        const out = r.output!;
        const score = out.globalScore === null ? 'null' : `${out.globalScore}`;
        lines.push(`    [ECART] ${r.role} ${r.dossierId} : ${out.verdict} ${score} ` +
          `vs attendu ${exp.expectedVerdict} ${exp.expectedScoreRange[0]}-${exp.expectedScoreRange[1]}`);
      }
    }
  } else {
    lines.push('Aucun ecart : la grille de calibration est tenue. (Note : MATCH ne signifie pas absence de bruit, lire les rationales axe par axe.)');
  }

  return lines.join('\n');
}

// ============================================================
// DUMP JSON
// ============================================================

function dumpJSON(results: RunResult[], startedAt: number, endedAt: number): string {
  const outDir = join(process.cwd(), 'scripts', 'calibration-output');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date(endedAt).toISOString().replace(/[:.]/g, '-');
  const outPath = join(outDir, `calibration-llm-trio-${stamp}.json`);
  const dump = {
    startedAt: new Date(startedAt).toISOString(),
    durationSeconds: (endedAt - startedAt) / 1000,
    summary: tally(results),
    runs: results.map((r) => ({
      patternId: r.patternId,
      dossierId: r.dossierId,
      role: r.role,
      durationMs: r.durationMs,
      status: evaluateRun(r),
      error: r.error,
      expected: EXPECTATIONS[r.patternId][r.dossierId],
      output: r.output,
    })),
  };
  writeFileSync(outPath, JSON.stringify(dump, null, 2));
  return outPath;
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY requise. Lance avec --env-file=.env.local ou export ANTHROPIC_API_KEY=...');
    process.exit(2);
  }

  const parallel = Math.max(1, parseInt(process.env.PARALLEL ?? '3', 10));
  const onlyPattern = (process.env.ONLY ?? '').trim() as PatternId | '';

  const patternsToRun: PatternId[] = onlyPattern
    ? PATTERN_IDS.filter((p) => p === onlyPattern)
    : [...PATTERN_IDS];
  if (onlyPattern && patternsToRun.length === 0) {
    console.error(`Pattern inconnu : ${onlyPattern}. Valeurs : ${PATTERN_IDS.join(', ')}`);
    process.exit(2);
  }

  // Construction des 21 jobs (ou 3 si ONLY)
  const jobs: Array<{ patternId: PatternId; role: Role }> = [];
  for (const patternId of patternsToRun) {
    for (const role of ROLES) jobs.push({ patternId, role });
  }

  console.log('');
  console.log('============================================================');
  console.log('CALIBRATION LLM REELLE - FRAGILITE STRUCTURELLE');
  console.log('============================================================');
  console.log(`Patterns      : ${patternsToRun.length} (${patternsToRun.join(', ')})`);
  console.log(`Runs prevus   : ${jobs.length}`);
  console.log(`Concurrence   : ${parallel}`);
  console.log(`Heure depart  : ${new Date().toISOString()}`);

  const tStart = Date.now();
  const results = await mapWithConcurrency(jobs, async (j) => {
    const r = await runOne(j.patternId, j.role);
    // logRun est best-effort : un crash de logging ne doit pas remonter
    // une erreur au mapWithConcurrency, qui annulerait toute la calibration
    // et perdrait le dump final.
    try {
      logRun(r);
    } catch (logErr: any) {
      console.error(`[harness] logRun crash sur ${j.patternId}/${j.role} : ${logErr?.message ?? logErr}`);
    }
    return r;
  }, parallel);
  const tEnd = Date.now();

  const summary = buildSummary(results, (tEnd - tStart) / 1000);
  console.log(summary);

  const dumpPath = dumpJSON(results, tStart, tEnd);
  console.log('');
  console.log(`Dump JSON : ${dumpPath}`);
  console.log('');

  // Le script ne fait jamais exit non-zero sur ecart : Steve a
  // explicitement demande de collecter les decalages, pas de
  // valider. Seules les erreurs d execution remontent en exit 1.
  const c = tally(results);
  process.exit(c.error > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Echec fatal calibration :', err);
  process.exit(1);
});
