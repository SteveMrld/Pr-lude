// ============================================================
// MESURE DE REPRODUCTIBILITE - mode leger
// ------------------------------------------------------------
// Brief #19 phase 2. Repond a une seule question : le meme dossier
// rend-il le meme verdict deux fois de suite.
//
// CE QUE LE HARNAIS FAIT
//
// Il rejoue N fois la seule notation, sur une extraction figee, et
// mesure la dispersion des six scores de dimension, du score global
// et du verdict. Il ne relance pas les vingt et un moteurs : il
// relance les six qui alimentent computeMechanicalScore, et rien
// d autre.
//
//   team, market, macro          -> dimensions equipe, marche, macro
//   contrarian, blindspot        -> dimensions contrariens, vigilance
//   financialCoherence           -> dimension modele economique
//
// Sont volontairement absents parce qu ils n entrent dans aucune
// dimension : prescan, extraction, extraction financiere, saas et
// industrial metrics, pattern, causal, reference-checks, narrative
// drift, tech-claim, friction d execution, les sept patterns de
// fragilite, et la synthese finale. La synthese est le retrait le
// plus important : depuis 19bb99a le verdict est derive des seuils
// par du code, pas par le LLM. La garder ajouterait un appel Sonnet
// et une couche de variance par-dessus celle qu on mesure.
//
// LES ENTREES SONT STRICTEMENT CONSTANTES
//
// Tout ce qui n est pas le moteur mesure vient d un run existant
// lu en base et figé pour les N iterations : extraction, matrice de
// pertinence, donnees financieres, benchmarks, et les sorties team
// market macro telles qu elles alimentent les moteurs aval. Aucun
// moteur n est chaine sur la sortie fraiche d un autre. Chaque
// assesseur voit donc exactement le meme prompt a chaque iteration,
// et sa dispersion est la sienne, pas celle de son amont.
//
// Les quatre moteurs qui savent chercher sur le web tournent en
// mode frozen (EngineRunOptions.frozen), ce qui eteint le web
// search en dur. C est la seule facon d avoir une entree constante.
//
// CE QUE LE HARNAIS NE MESURE PAS, ET QU IL FAUT SAVOIR
//
// Residu non controle : team, market et macro font leur propre
// collecte de donnees reelles (OpenAlex, registres, World Bank)
// avant l appel LLM, hors du mode frozen. Ces fetchers sont bornes
// par un timeout de 8s et peuvent rendre autre chose d une
// iteration a l autre. Une part de la dispersion des trois
// premieres dimensions peut donc venir du reseau et non du
// sampling. Le brief interdit de toucher aux moteurs, donc on le
// declare au lieu de le corriger.
//
// AUCUNE ECRITURE. Lecture Supabase pour recuperer le run de
// reference, tout le reste en memoire, rien de persiste.
//
// USAGE
//   npx tsx scripts/measure-reproducibility.ts [--n=20] [--run=2517a288]
//                                              [--concurrency=2] [--json]
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================
// Bootstrap env avant tout import de moteur : anthropic-client
// lit ANTHROPIC_API_KEY a la construction du client.
// ============================================================
function loadEnvFile(name: string) {
  const p = join(process.cwd(), name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile('.env');
loadEnvFile('.env.local');

import { createClient } from '@supabase/supabase-js';
import { analyzeTeam } from '../lib/engines/team-engine';
import { analyzeMarket } from '../lib/engines/market-engine';
import { analyzeMacro } from '../lib/engines/macro-engine';
import { analyzeContrarian } from '../lib/engines/contrarian-engine';
import { analyzeBlindspots } from '../lib/engines/blindspot-engine';
import { analyzeFinancialCoherence } from '../lib/engines/financial-coherence-engine';
import {
  computeMechanicalScore,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  DIMENSION_WEIGHTS,
  VERDICT_THRESHOLDS,
  INSUFFICIENT_BASIS_VERDICT,
  type DimensionKey,
} from '../lib/engines/score-calculator';
import { newMeasure, type LlmMeasure } from '../lib/engines/engine-budget';

// ============================================================
// TARIFS. Sonnet 4.6 (MODEL dans anthropic-client) : 3 USD par
// million de tokens d entree, 15 par million de sortie. Le cache
// n intervient pas ici : chaque iteration reconstruit un prompt
// identique mais les fenetres de cache de cinq minutes ne sont pas
// garanties d une iteration a l autre, et callClaudeWithUsage ne
// separe pas le cache dans le puits de mesure. Le cout affiche est
// donc un plafond, jamais une sous-estimation.
// ============================================================
const USD_PER_INPUT_TOKEN = 3 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 15 / 1_000_000;

// ============================================================
// CLI
// ============================================================
const args = process.argv.slice(2);
function argVal(name: string, dflt: string): string {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
}
const N = Math.max(1, parseInt(argVal('n', '20'), 10));
const RUN_PREFIX = argVal('run', '2517a288');
const CONCURRENCY = Math.max(1, parseInt(argVal('concurrency', '2'), 10));
const AS_JSON = args.includes('--json');

// ============================================================
// Lecture du run de reference. Lecture seule, service role.
// ============================================================
async function loadFrozenRun(prefix: string) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  let key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  // Tolere un caractere parasite en tete du JWT, deja rencontre sur ce .env.
  if (key && !key.startsWith('eyJ') && key.slice(1).startsWith('eyJ')) key = key.slice(1);
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.');

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('analyses')
    .select('id, company_name, created_at, result_json')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(`Lecture analyses : ${error.message}`);

  const row: any = (data ?? []).find((r: any) => String(r.id).startsWith(prefix));
  if (!row) throw new Error(`Aucun run dont l id commence par ${prefix}.`);

  const rj = row.result_json ?? {};
  const missing = ['extraction', 'team', 'market', 'macro', 'financialData', 'relevanceMatrix']
    .filter((k) => !rj[k] || Object.keys(rj[k]).length === 0);
  if (missing.length > 0) {
    throw new Error(
      `Le run ${String(row.id).slice(0, 8)} n a pas de socle exploitable. Racines vides : ${missing.join(', ')}. `
      + 'Choisir un run complet avec --run=<prefixe>.',
    );
  }

  return {
    id: String(row.id),
    companyName: row.company_name,
    createdAt: row.created_at,
    extraction: rj.extraction,
    team: rj.team,
    market: rj.market,
    macro: rj.macro,
    financialData: rj.financialData,
    benchmarks: rj.benchmarks ?? null,
    relevanceMatrix: rj.relevanceMatrix ?? null,
    referenceScore: rj.mechanicalScore?.globalScore ?? null,
    referenceVerdict: rj.mechanicalScore?.verdict ?? null,
  };
}

type Frozen = Awaited<ReturnType<typeof loadFrozenRun>>;

// ============================================================
// UNE ITERATION
// ------------------------------------------------------------
// Les six moteurs partent en parallele : sans chainage, il n y a
// aucune dependance entre eux. Un moteur qui tombe rend null, ce
// que computeMechanicalScore lit comme une dimension non evaluee.
// L echec est enregistre, pas avale.
// ============================================================
interface DimObs {
  score: number | null;
  evaluated: boolean;
  cause?: string;
}

interface Iteration {
  index: number;
  durationMs: number;
  dims: Record<DimensionKey, DimObs>;
  globalScore: number | null;
  verdict: string | null;
  scoreStatus: string;
  evaluatedWeight: number;
  engineErrors: string[];
  measures: Record<string, LlmMeasure>;
}

const FROZEN_RUN = { frozen: true } as const;

async function runIteration(index: number, f: Frozen): Promise<Iteration> {
  const t0 = Date.now();
  const errors: string[] = [];
  const measures: Record<string, LlmMeasure> = {
    team: newMeasure(),
    market: newMeasure(),
    macro: newMeasure(),
    contrarian: newMeasure(),
    blindspot: newMeasure(),
    financialCoherence: newMeasure(),
  };

  const guard = async <T>(name: string, p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (e: any) {
      errors.push(`${name}: ${e?.message ?? String(e)}`);
      return null;
    }
  };

  const [team, market, macro, contrarian, blindspot, financial] = await Promise.all([
    guard('team', analyzeTeam(f.extraction, undefined, null, FROZEN_RUN, measures.team)),
    guard('market', analyzeMarket(f.extraction, null, f.relevanceMatrix, null, FROZEN_RUN, measures.market)),
    guard('macro', analyzeMacro(f.extraction, null, f.relevanceMatrix, null, FROZEN_RUN, measures.macro)),
    // contrarian et blindspot recoivent le team/market/macro FIGES du run
    // de reference, pas ceux que cette iteration vient de produire. C est
    // ce qui isole leur variance propre de celle de leur amont.
    guard('contrarian', analyzeContrarian(f.extraction, f.team, f.market, f.macro, null, measures.contrarian)),
    guard('blindspot', analyzeBlindspots(f.extraction, f.team, f.market, f.macro, null, measures.blindspot)),
    guard('financialCoherence', analyzeFinancialCoherence(
      f.extraction, f.financialData, f.market, f.benchmarks, null,
      f.relevanceMatrix, FROZEN_RUN, measures.financialCoherence,
    )),
  ]);

  const mech = computeMechanicalScore({
    team: team as any,
    market: market as any,
    macro: macro as any,
    financial: financial as any,
    contrarian: contrarian as any,
    blindspot: blindspot as any,
  });

  const dims = {} as Record<DimensionKey, DimObs>;
  let evaluatedWeight = 0;
  for (const k of DIMENSION_KEYS) {
    const d: any = mech.dimensions[k];
    const evaluated = !!d?.evaluated;
    if (evaluated) evaluatedWeight += DIMENSION_WEIGHTS[k];
    dims[k] = {
      score: evaluated ? d.score : null,
      evaluated,
      cause: evaluated ? undefined : d?.evaluationCause,
    };
  }

  return {
    index,
    durationMs: Date.now() - t0,
    dims,
    globalScore: mech.globalScore,
    verdict: mech.verdict,
    scoreStatus: mech.scoreStatus,
    evaluatedWeight,
    engineErrors: errors,
    measures,
  };
}

// ============================================================
// STATISTIQUES
// ------------------------------------------------------------
// Ecart-type d echantillon, n-1 au denominateur. Sur N=20 il a un
// sens ; sous N=10 c est l etendue qu il faut lire, pas lui.
// ============================================================
function stats(values: number[]) {
  const n = values.length;
  if (n === 0) return { n: 0, min: null, max: null, range: null, mean: null, std: null };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1
    ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
    : 0;
  return {
    n,
    min: Math.min(...values),
    max: Math.max(...values),
    range: Math.max(...values) - Math.min(...values),
    mean,
    std: Math.sqrt(variance),
  };
}

/** Seuils de verdict strictement contenus dans l intervalle observe.
 *  Un seuil franchi entre deux runs veut dire que le meme dossier a
 *  change de recommandation sans que rien du dossier ait bouge. */
function thresholdsCrossed(min: number, max: number): Array<{ name: string; value: number }> {
  return Object.entries(VERDICT_THRESHOLDS)
    .map(([name, value]) => ({ name, value: value as number }))
    .filter((t) => t.value > min && t.value <= max);
}

const VERDICT_OF_THRESHOLD: Record<string, string> = {
  invest: 'investir (>= 75)',
  conditions: 'investir avec conditions (>= 60)',
  investigate: 'approfondir (>= 45)',
};

function fmt(v: number | null, digits = 1): string {
  return v === null ? '-' : v.toFixed(digits);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY manquante (.env ou .env.local).');
    process.exit(1);
  }

  console.log('\n=== MESURE DE REPRODUCTIBILITE, MODE LEGER ===\n');
  const frozen = await loadFrozenRun(RUN_PREFIX);
  console.log(`Extraction figee   : run ${frozen.id.slice(0, 8)} (${frozen.companyName}), ${String(frozen.createdAt).slice(0, 16)}`);
  console.log(`Reference du run   : score ${frozen.referenceScore ?? '-'}, verdict ${frozen.referenceVerdict ?? '-'}`);
  console.log(`Iterations         : ${N} (concurrence ${CONCURRENCY})`);
  console.log('Moteurs rejoues    : team, market, macro, contrarian, blindspot, financialCoherence');
  console.log('Web search         : coupe (mode frozen) sur les quatre moteurs qui le portent\n');

  const iterations: Iteration[] = [];
  let launched = 0;
  const runNext = async (): Promise<void> => {
    while (launched < N) {
      const i = launched++;
      const it = await runIteration(i, frozen);
      iterations.push(it);
      const dimsLine = DIMENSION_KEYS
        .map((k) => `${k.slice(0, 4)}=${it.dims[k].evaluated ? it.dims[k].score : 'na'}`)
        .join(' ');
      console.log(
        `  iter ${String(it.index + 1).padStart(2)}/${N}  ${(it.durationMs / 1000).toFixed(0).padStart(3)}s  `
        + `global=${it.globalScore ?? 'null'} verdict=${it.verdict ?? it.scoreStatus}  ${dimsLine}`
        + (it.engineErrors.length ? `  [echecs: ${it.engineErrors.length}]` : ''),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, N) }, () => runNext()));
  iterations.sort((a, b) => a.index - b.index);

  // ----------------------------------------------------------
  // Tableau par dimension
  // ----------------------------------------------------------
  console.log('\n--- VARIANCE PAR DIMENSION ---');
  console.log(
    `  ${'dimension'.padEnd(20)} ${'poids'.padStart(6)} ${'evaluee'.padStart(8)} `
    + `${'min'.padStart(6)} ${'max'.padStart(6)} ${'ecart'.padStart(6)} ${'ecart-type'.padStart(11)}`,
  );

  const perDim: Record<string, any> = {};
  for (const k of DIMENSION_KEYS) {
    const evaluatedRuns = iterations.filter((it) => it.dims[k].evaluated);
    const s = stats(evaluatedRuns.map((it) => it.dims[k].score as number));
    perDim[k] = { ...s, evaluatedRuns: evaluatedRuns.length, totalRuns: iterations.length };
    console.log(
      `  ${DIMENSION_LABELS[k].padEnd(20)} ${DIMENSION_WEIGHTS[k].toFixed(2).padStart(6)} `
      + `${`${evaluatedRuns.length}/${iterations.length}`.padStart(8)} `
      + `${fmt(s.min, 0).padStart(6)} ${fmt(s.max, 0).padStart(6)} `
      + `${fmt(s.range, 0).padStart(6)} ${fmt(s.std, 2).padStart(11)}`,
    );
    // Une dimension non evaluee sur une partie des runs seulement est un
    // fait de reproductibilite a part entiere : le socle du score change
    // d un run a l autre. On le nomme au lieu de le noyer dans le n.
    if (evaluatedRuns.length !== iterations.length) {
      const causes = new Set(
        iterations.filter((it) => !it.dims[k].evaluated).map((it) => it.dims[k].cause ?? 'inconnue'),
      );
      console.log(`  ${''.padEnd(20)} non evaluee sur ${iterations.length - evaluatedRuns.length} run(s), cause(s) : ${Array.from(causes).join(', ')}`);
    }
  }

  // ----------------------------------------------------------
  // Score global
  // ----------------------------------------------------------
  const computed = iterations.filter((it) => typeof it.globalScore === 'number');
  const gs = stats(computed.map((it) => it.globalScore as number));
  console.log('\n--- SCORE GLOBAL ---');
  console.log(
    `  ${'score global'.padEnd(20)} ${''.padStart(6)} ${`${computed.length}/${iterations.length}`.padStart(8)} `
    + `${fmt(gs.min, 0).padStart(6)} ${fmt(gs.max, 0).padStart(6)} `
    + `${fmt(gs.range, 0).padStart(6)} ${fmt(gs.std, 2).padStart(11)}`,
  );
  const insufficient = iterations.filter((it) => it.scoreStatus === 'insufficient-basis');
  if (insufficient.length > 0) {
    console.log(`  socle insuffisant sur ${insufficient.length}/${iterations.length} run(s) : ni score ni verdict produit.`);
  }
  const weights = new Set(iterations.map((it) => it.evaluatedWeight.toFixed(2)));
  if (weights.size > 1) {
    console.log(`  assiette du score variable entre runs : poids cumules observes ${Array.from(weights).join(', ')}.`);
  }

  // ----------------------------------------------------------
  // LA LIGNE CRITIQUE
  // ----------------------------------------------------------
  console.log('\n--- VERDICT ---');
  const verdictCounts = new Map<string, number>();
  for (const it of iterations) {
    const v = it.verdict ?? INSUFFICIENT_BASIS_VERDICT;
    verdictCounts.set(v, (verdictCounts.get(v) ?? 0) + 1);
  }
  for (const [v, c] of Array.from(verdictCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.padEnd(28)} ${c}/${iterations.length}`);
  }

  const constant = verdictCounts.size === 1;
  const crossings = gs.min !== null && gs.max !== null ? thresholdsCrossed(gs.min, gs.max) : [];
  // Nombre de transitions reelles entre runs consecutifs : deux runs
  // voisins qui ne rendent pas le meme verdict.
  let transitions = 0;
  for (let i = 1; i < iterations.length; i++) {
    const a = iterations[i - 1].verdict ?? INSUFFICIENT_BASIS_VERDICT;
    const b = iterations[i].verdict ?? INSUFFICIENT_BASIS_VERDICT;
    if (a !== b) transitions++;
  }

  console.log('');
  if (constant) {
    console.log(`  VERDICT CONSTANT sur ${iterations.length} iterations : ${Array.from(verdictCounts.keys())[0]}.`);
    if (gs.min !== null && gs.max !== null) {
      const nearest = Object.entries(VERDICT_THRESHOLDS)
        .map(([name, value]) => ({ name, value: value as number }))
        .map((t) => ({ ...t, dist: Math.min(Math.abs(gs.min! - t.value), Math.abs(gs.max! - t.value)) }))
        .sort((a, b) => a.dist - b.dist)[0];
      console.log(`  Marge au seuil le plus proche (${nearest.name} = ${nearest.value}) : ${nearest.dist.toFixed(1)} point(s).`);
    }
  } else {
    console.log(`  VERDICT NON CONSTANT : ${verdictCounts.size} verdicts distincts, ${transitions} transition(s) entre runs consecutifs.`);
  }
  if (crossings.length > 0) {
    console.log(`  Seuils franchis dans l intervalle [${fmt(gs.min, 1)}, ${fmt(gs.max, 1)}] :`);
    for (const t of crossings) {
      console.log(`    ${t.value} -> bascule ${VERDICT_OF_THRESHOLD[t.name] ?? t.name}`);
    }
  } else if (gs.min !== null) {
    console.log('  Aucun seuil de verdict franchi par l intervalle du score global.');
  }

  // ----------------------------------------------------------
  // Cout
  // ----------------------------------------------------------
  let calls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const it of iterations) {
    for (const m of Object.values(it.measures)) {
      calls += m.calls;
      inputTokens += m.inputTokens;
      outputTokens += m.outputTokens;
    }
  }
  const usd = inputTokens * USD_PER_INPUT_TOKEN + outputTokens * USD_PER_OUTPUT_TOKEN;
  const wall = iterations.reduce((a, it) => a + it.durationMs, 0);
  console.log('\n--- COUT ---');
  console.log(`  Appels LLM aboutis  : ${calls} (${iterations.length} iterations x 6 moteurs attendus)`);
  console.log(`  Tokens entree       : ${inputTokens.toLocaleString('fr-FR')}`);
  console.log(`  Tokens sortie       : ${outputTokens.toLocaleString('fr-FR')}`);
  console.log(`  Cout Sonnet 4.6     : ~${usd.toFixed(2)} USD (3 / 15 USD par million, cache non deduit)`);
  console.log(`  Cout par iteration  : ~${(usd / Math.max(1, iterations.length)).toFixed(3)} USD`);
  console.log(`  Temps moteur cumule : ${(wall / 1000 / 60).toFixed(1)} min`);

  const allErrors = iterations.flatMap((it) => it.engineErrors);
  if (allErrors.length > 0) {
    console.log(`\n--- ECHECS MOTEUR (${allErrors.length}) ---`);
    const byMsg = new Map<string, number>();
    for (const e of allErrors) byMsg.set(e, (byMsg.get(e) ?? 0) + 1);
    for (const [msg, c] of Array.from(byMsg.entries())) console.log(`  x${c} ${msg}`);
  }

  if (AS_JSON) {
    console.log('\n--- JSON ---');
    console.log(JSON.stringify({
      frozenRun: frozen.id,
      iterations: iterations.map((it) => ({
        index: it.index,
        globalScore: it.globalScore,
        verdict: it.verdict,
        scoreStatus: it.scoreStatus,
        dims: it.dims,
        durationMs: it.durationMs,
        engineErrors: it.engineErrors,
      })),
      perDimension: perDim,
      globalScore: gs,
      verdictDistribution: Object.fromEntries(verdictCounts),
      verdictConstant: constant,
      thresholdsCrossed: crossings,
      cost: { calls, inputTokens, outputTokens, usd },
    }, null, 2));
  }

  console.log('');
}

main().catch((e) => {
  console.error(`\nERREUR : ${e?.message ?? e}`);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
