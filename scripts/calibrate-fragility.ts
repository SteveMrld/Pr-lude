// ============================================================
// HARNAIS DE CALIBRATION FRAGILITE STRUCTURELLE
// ------------------------------------------------------------
// Lance les patterns selectionnes sur les 10 dossiers de reference,
// compare aux expectations doctrinales, produit un rapport markdown
// + un dump JSON brut pour audit.
//
// Usage :
//   npx tsx --env-file=.env.local scripts/calibrate-fragility.ts
//     [pattern1] [pattern2] ...
//
// Alias courts acceptes : growth, infra, fixed, regulatory, commod,
// captable, scale. Sans argument : tous les patterns enregistres.
//
// Concurrence : 4 dossiers en parallele pour ne pas saturer le rate
// limit Anthropic. Ajustable via PARALLEL=N en variable d env.
// ============================================================

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Import side-effect des modules patterns : auto-enregistrement dans
// le registry de l orchestrateur. On ne passe pas par l orchestrateur
// au moment du run (on appelle pattern.analyze directement) mais on
// reutilise le registry pour n exposer qu une selection coherente.
import '../lib/engines/fragility-structurelle/growth-subsidized-pattern';
import '../lib/engines/fragility-structurelle/infrastructure-hostage-pattern';
import '../lib/engines/fragility-structurelle/fixed-cost-trap-pattern';
import '../lib/engines/fragility-structurelle/regulatory-time-bomb-pattern';
import '../lib/engines/fragility-structurelle/commoditization-drift-pattern';
import '../lib/engines/fragility-structurelle/capital-structure-fragility-pattern';
import '../lib/engines/fragility-structurelle/scale-mirage-risk-pattern';

import { _getRegistryForTests } from '../lib/engines/fragility-structurelle/orchestrator';
import {
  PATTERN_IDS,
  PATTERN_LABELS,
  type PatternId,
  type PatternAnalysisOutput,
  type PatternInput,
  type PatternVerdict,
} from '../lib/engines/fragility-structurelle/types';
import {
  REFERENCE_DOSSIERS,
  type DossierId,
  type ReferenceDossier,
} from './fixtures/reference-dossiers';
import {
  EXPECTATIONS,
  calibrationStatus,
  verdictGap,
} from './fixtures/calibration-expectations';

// ============================================================
// CLI : selection des patterns
// ============================================================

const PATTERN_ALIASES: Record<string, PatternId> = {
  growth: 'growth-subsidized-model',
  infra: 'infrastructure-hostage',
  fixed: 'fixed-cost-trap',
  regulatory: 'regulatory-time-bomb',
  regul: 'regulatory-time-bomb',
  commod: 'commoditization-drift',
  captable: 'capital-structure-fragility',
  cap: 'capital-structure-fragility',
  scale: 'scale-mirage-risk',
  // alias par PatternId complet (passthrough)
  'growth-subsidized-model': 'growth-subsidized-model',
  'infrastructure-hostage': 'infrastructure-hostage',
  'fixed-cost-trap': 'fixed-cost-trap',
  'regulatory-time-bomb': 'regulatory-time-bomb',
  'commoditization-drift': 'commoditization-drift',
  'capital-structure-fragility': 'capital-structure-fragility',
  'scale-mirage-risk': 'scale-mirage-risk',
};

function resolvePatternsFromArgv(argv: string[]): PatternId[] {
  const args = argv.slice(2).filter((a) => !a.startsWith('--'));
  if (args.length === 0) return [...PATTERN_IDS];
  const resolved: PatternId[] = [];
  for (const a of args) {
    const mapped = PATTERN_ALIASES[a.toLowerCase()];
    if (!mapped) {
      console.error(`Argument pattern inconnu : ${a}. Aliases : ${Object.keys(PATTERN_ALIASES).join(', ')}`);
      process.exit(2);
    }
    if (!resolved.includes(mapped)) resolved.push(mapped);
  }
  return resolved;
}

// ============================================================
// EXECUTION CONCURRENTE LIMITEE
// ============================================================

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  parallel: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function consume(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(parallel, items.length) }, () => consume());
  await Promise.all(workers);
  return results;
}

// ============================================================
// LANCEMENT D UN PATTERN SUR UN DOSSIER
// ============================================================

interface RunOutcome {
  patternId: PatternId;
  dossierId: DossierId;
  durationMs: number;
  output: PatternAnalysisOutput | null;
  error: string | null;
}

async function runPatternOnDossier(
  patternId: PatternId,
  dossier: ReferenceDossier,
): Promise<RunOutcome> {
  const registry = _getRegistryForTests();
  const moduleP = registry[patternId];
  if (!moduleP) {
    return {
      patternId,
      dossierId: dossier.id,
      durationMs: 0,
      output: null,
      error: `Pattern ${patternId} absent du registry (oubli d import ?)`,
    };
  }

  const input: PatternInput = {
    extraction: dossier.extraction,
    financialData: dossier.financialData,
    marketAnalysis: null,
    rawPitchText: null,
    fundNote: null,
  };

  const t0 = Date.now();
  try {
    const output = await moduleP.analyze(input);
    return {
      patternId,
      dossierId: dossier.id,
      durationMs: Date.now() - t0,
      output,
      error: null,
    };
  } catch (err: any) {
    return {
      patternId,
      dossierId: dossier.id,
      durationMs: Date.now() - t0,
      output: null,
      error: err?.message ?? String(err),
    };
  }
}

// ============================================================
// FORMATAGE DU RAPPORT MARKDOWN
// ============================================================

const VERDICT_BADGE: Record<PatternVerdict, string> = {
  'sain': 'sain',
  'attention': 'attention',
  'alerte': 'alerte',
  'drapeau-rouge': 'drapeau-rouge',
  'non-applicable': 'n/a',
};

function buildReport(
  outcomes: RunOutcome[],
  patternsRun: PatternId[],
  startedAt: Date,
  totalDurationMs: number,
): string {
  const lines: string[] = [];
  lines.push(`# Rapport de calibration - Fragilite Structurelle`);
  lines.push('');
  lines.push(`Date : ${startedAt.toISOString()}`);
  lines.push(`Patterns lances : ${patternsRun.map((p) => PATTERN_LABELS[p]).join(', ')}`);
  lines.push(`Dossiers : ${REFERENCE_DOSSIERS.map((d) => d.label).join(', ')}`);
  lines.push(`Duree totale : ${(totalDurationMs / 1000).toFixed(1)} s`);
  lines.push('');

  // ---- Synthese par pattern ----
  for (const patternId of patternsRun) {
    lines.push(`## Pattern : ${PATTERN_LABELS[patternId]} (${patternId})`);
    lines.push('');
    lines.push('| Dossier | Verdict attendu | Verdict obtenu | Score (range) | Statut | Applicabilite |');
    lines.push('|---|---|---|---|---|---|');

    for (const dossier of REFERENCE_DOSSIERS) {
      const outcome = outcomes.find((o) => o.patternId === patternId && o.dossierId === dossier.id);
      const expectation = EXPECTATIONS[patternId]?.[dossier.id];

      if (!outcome) {
        lines.push(`| ${dossier.label} | - | (non execute) | - | - | - |`);
        continue;
      }

      if (outcome.error) {
        lines.push(`| ${dossier.label} | ${VERDICT_BADGE[expectation?.expectedVerdict ?? 'sain']} | ERREUR | - | mismatch | - |`);
        continue;
      }

      const out = outcome.output!;
      const status = expectation
        ? calibrationStatus(expectation, out.verdict, out.globalScore)
        : 'mismatch';
      const expectedStr = expectation
        ? `${VERDICT_BADGE[expectation.expectedVerdict]}`
        : '?';
      const rangeStr = expectation
        ? `${out.globalScore} (${expectation.expectedScoreRange[0]}-${expectation.expectedScoreRange[1]})`
        : `${out.globalScore}`;
      const statusBadge = status === 'match' ? 'MATCH' : status === 'close' ? 'PROCHE' : 'ECART';
      lines.push(`| ${dossier.label} | ${expectedStr} | ${VERDICT_BADGE[out.verdict]} | ${rangeStr} | ${statusBadge} | ${out.applicabilite} |`);
    }
    lines.push('');

    // Resume editorial par dossier
    lines.push(`### Resumes editoriaux et rationales`);
    lines.push('');
    for (const dossier of REFERENCE_DOSSIERS) {
      const outcome = outcomes.find((o) => o.patternId === patternId && o.dossierId === dossier.id);
      if (!outcome || !outcome.output) {
        if (outcome?.error) {
          lines.push(`#### ${dossier.label}`);
          lines.push(`Erreur : ${outcome.error}`);
          lines.push('');
        }
        continue;
      }
      const out = outcome.output;
      const expectation = EXPECTATIONS[patternId]?.[dossier.id];
      lines.push(`#### ${dossier.label}`);
      lines.push('');
      lines.push(`Score global ${out.globalScore}/100, verdict ${out.verdict}, applicabilite ${out.applicabilite}.`);
      lines.push('');
      if (expectation) {
        lines.push(`> Doctrine attendue : ${expectation.doctrineRationale}`);
        lines.push('');
      }
      lines.push(`Resume LLM : ${out.resumeEditorial}`);
      lines.push('');
      lines.push(`Counter-archetype : ${out.counterArchetype.closest} (${out.counterArchetype.direction}). ${out.counterArchetype.rationale}`);
      lines.push('');
      lines.push(`Recommandation DD : ${out.recommandationDD}`);
      lines.push('');
      lines.push(`Axe 1 : ${out.axis1.verdict} ${out.axis1.score}. ${out.axis1.rationale}`);
      if (out.axis1.evidencePro.length) lines.push(`  Pro : ${out.axis1.evidencePro.slice(0, 3).join(' | ')}`);
      if (out.axis1.evidenceContra.length) lines.push(`  Contra : ${out.axis1.evidenceContra.slice(0, 3).join(' | ')}`);
      lines.push('');
      lines.push(`Axe 2 : ${out.axis2.verdict} ${out.axis2.score}. ${out.axis2.rationale}`);
      if (out.axis2.evidencePro.length) lines.push(`  Pro : ${out.axis2.evidencePro.slice(0, 3).join(' | ')}`);
      if (out.axis2.evidenceContra.length) lines.push(`  Contra : ${out.axis2.evidenceContra.slice(0, 3).join(' | ')}`);
      lines.push('');
      lines.push(`Axe 3 : ${out.axis3.verdict} ${out.axis3.score}. ${out.axis3.rationale}`);
      if (out.axis3.evidencePro.length) lines.push(`  Pro : ${out.axis3.evidencePro.slice(0, 3).join(' | ')}`);
      if (out.axis3.evidenceContra.length) lines.push(`  Contra : ${out.axis3.evidenceContra.slice(0, 3).join(' | ')}`);
      lines.push('');
      lines.push(`Audit : ${out.auditTrail.sourceTags.join(', ') || '(aucun tag detecte)'} | ${out.auditTrail.claimsChiffres.length} claims chiffres`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // ---- Synthese aggregee ----
  lines.push(`## Synthese de calibration`);
  lines.push('');
  let nMatch = 0, nClose = 0, nMismatch = 0, nError = 0;
  for (const outcome of outcomes) {
    if (outcome.error) { nError++; continue; }
    const expectation = EXPECTATIONS[outcome.patternId]?.[outcome.dossierId];
    if (!expectation) continue;
    const status = calibrationStatus(expectation, outcome.output!.verdict, outcome.output!.globalScore);
    if (status === 'match') nMatch++;
    else if (status === 'close') nClose++;
    else nMismatch++;
  }
  const total = nMatch + nClose + nMismatch + nError;
  lines.push(`Total : ${total} runs`);
  lines.push(`MATCH (verdict exact ou score in-range) : ${nMatch} (${total ? ((nMatch / total) * 100).toFixed(0) : 0}%)`);
  lines.push(`PROCHE (verdict adjacent) : ${nClose}`);
  lines.push(`ECART (verdict gap >= 2) : ${nMismatch}`);
  lines.push(`ERREUR : ${nError}`);
  lines.push('');

  if (nMismatch > 0) {
    lines.push(`### Ecarts a investiguer`);
    lines.push('');
    for (const outcome of outcomes) {
      if (outcome.error || !outcome.output) continue;
      const expectation = EXPECTATIONS[outcome.patternId]?.[outcome.dossierId];
      if (!expectation) continue;
      const status = calibrationStatus(expectation, outcome.output.verdict, outcome.output.globalScore);
      if (status !== 'mismatch') continue;
      const dossierLabel = REFERENCE_DOSSIERS.find((d) => d.id === outcome.dossierId)?.label ?? outcome.dossierId;
      const gap = verdictGap(expectation.expectedVerdict, outcome.output.verdict);
      lines.push(`- ${PATTERN_LABELS[outcome.patternId]} sur ${dossierLabel} : attendu ${expectation.expectedVerdict} (${expectation.expectedScoreRange[0]}-${expectation.expectedScoreRange[1]}), obtenu ${outcome.output.verdict} ${outcome.output.globalScore}, gap verdict ${gap}.`);
      lines.push(`  Doctrine : ${expectation.doctrineRationale}`);
      lines.push(`  LLM : ${outcome.output.resumeEditorial}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  const patternsRun = resolvePatternsFromArgv(process.argv);
  const parallel = Number(process.env.PARALLEL ?? 4);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY absente. Lance avec : npx tsx --env-file=.env.local scripts/calibrate-fragility.ts');
    process.exit(1);
  }

  const registry = _getRegistryForTests();
  const missing = patternsRun.filter((p) => !registry[p]);
  if (missing.length) {
    console.error(`Patterns absents du registry : ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n=== Calibration Fragilite Structurelle ===`);
  console.log(`Patterns : ${patternsRun.join(', ')}`);
  console.log(`Dossiers : ${REFERENCE_DOSSIERS.map((d) => d.id).join(', ')}`);
  console.log(`Concurrence : ${parallel}`);
  console.log(`Total runs : ${patternsRun.length * REFERENCE_DOSSIERS.length}`);
  console.log('');

  const startedAt = new Date();
  const t0 = Date.now();

  // On serie pattern par pattern. Au sein d un pattern, on parallele
  // sur les dossiers a hauteur de PARALLEL. Empile rate-limit gentiment.
  const allOutcomes: RunOutcome[] = [];
  for (const patternId of patternsRun) {
    console.log(`\n--- Pattern : ${PATTERN_LABELS[patternId]} ---`);
    const outcomes = await mapWithConcurrency(
      REFERENCE_DOSSIERS,
      async (dossier) => {
        const t = Date.now();
        process.stdout.write(`  start  ${dossier.id} ...`);
        const outcome = await runPatternOnDossier(patternId, dossier);
        const ms = Date.now() - t;
        if (outcome.error) {
          console.log(` ERREUR (${ms}ms) : ${outcome.error.slice(0, 80)}`);
        } else {
          const expectation = EXPECTATIONS[patternId]?.[dossier.id];
          const status = expectation
            ? calibrationStatus(expectation, outcome.output!.verdict, outcome.output!.globalScore)
            : 'mismatch';
          const tag = status === 'match' ? 'MATCH' : status === 'close' ? 'PROCHE' : 'ECART';
          console.log(` ${tag} (${ms}ms) verdict=${outcome.output!.verdict} score=${outcome.output!.globalScore} app=${outcome.output!.applicabilite}`);
        }
        return outcome;
      },
      parallel,
    );
    allOutcomes.push(...outcomes);
  }

  const totalDurationMs = Date.now() - t0;

  // Output : rapport markdown + dump JSON
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const baseName = `calibration-${patternsRun.length === PATTERN_IDS.length ? 'all' : patternsRun.join('+')}-${stamp}`;
  const outDir = join(process.cwd(), 'scripts', 'calibration-output');
  mkdirSync(outDir, { recursive: true });

  const reportPath = join(outDir, `${baseName}.md`);
  const dumpPath = join(outDir, `${baseName}.json`);

  const report = buildReport(allOutcomes, patternsRun, startedAt, totalDurationMs);
  writeFileSync(reportPath, report, 'utf8');
  writeFileSync(dumpPath, JSON.stringify({
    startedAt: startedAt.toISOString(),
    durationMs: totalDurationMs,
    patternsRun,
    outcomes: allOutcomes,
  }, null, 2), 'utf8');

  console.log(`\n=== Calibration terminee ===`);
  console.log(`Rapport : ${reportPath}`);
  console.log(`Dump JSON : ${dumpPath}`);
}

main().catch((err) => {
  console.error('FATAL :', err);
  process.exit(1);
});
