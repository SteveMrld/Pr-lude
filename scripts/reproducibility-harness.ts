// ============================================================
// HARNAIS DE REPRODUCTIBILITE - Brique 1 fondation preuve
// ------------------------------------------------------------
// Relance un meme dossier N fois et capture, par run, les six
// scores de dimension (equipe, marche, macro, modele eco,
// contrariens, vigilance), le globalScore, le verdict, et la
// probabilite de succes. Calcule moyenne, ecart-type, min, max,
// etendue par metrique, trie les dimensions par amplitude de
// variance.
//
// Verifie aussi que le versionStamp est identique sur les N runs
// pour isoler la variance purement intrinseque au LLM, et non
// un changement d entree, de config ou de commit.
//
// Lecture seule sur le comportement d analyse : ne change
// aucune temperature, aucun seed, aucun prompt. Mesure brute.
//
// USAGE :
//   ANTHROPIC_API_KEY=... npx tsx scripts/reproducibility-harness.ts \
//     <chemin-pdf> [--runs=N] [--label=NOM]
//
// Le dossier Platypus accepte aussi le mode synthetique sans PDF :
//   npx tsx scripts/reproducibility-harness.ts --synthetic=platypus [--runs=N]
//
// Sortie : un JSON detaille dans scripts/audit-output/repro-*-detail.json
//          un resume lisible imprime en stdout
//
// NOTE PRATIQUE. Un run complet (~10 appels LLM dont 6+ Sonnet)
// coute environ 0,80 a 1,20 USD et dure 90-180 secondes. Pour
// valider le harnais, lancer N=2 ou 3 d abord. Avant de monter
// a N=10 ou 20, calibrer le budget.
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

// ============================================================
// Bootstrap env .env.local
// ============================================================
function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

// ============================================================
// Imports moteurs (apres bootstrap env)
// ============================================================
import { extractFromDeck } from '../lib/engines/extraction-engine';
import { extractFinancialData } from '../lib/engines/financial-extraction-engine';
import { computeRelevanceMatrix } from '../lib/engines/relevance-matrix';
import { normalizeAssetClass } from '../lib/data/sector-benchmarks';
import { analyzeTeam } from '../lib/engines/team-engine';
import { analyzeMarket } from '../lib/engines/market-engine';
import { analyzeMacro } from '../lib/engines/macro-engine';
import { matchPatterns } from '../lib/engines/pattern-engine';
import { performCausalReversal } from '../lib/engines/causal-engine';
import { analyzeBlindspots } from '../lib/engines/blindspot-engine';
import { analyzeContrarian } from '../lib/engines/contrarian-engine';
import { analyzeBenchmarks } from '../lib/engines/benchmark-engine';
import { analyzeFinancialCoherence } from '../lib/engines/financial-coherence-engine';
import { orchestrateFinalRecommendation } from '../lib/engines/orchestrator';
import { computeMechanicalScore } from '../lib/engines/score-calculator';
import {
  buildVersionStamp,
  sealVersionStamp,
  fingerprintStamp,
  diffStamps,
  type VersionStamp,
} from '../lib/instrumentation/version-stamp';
import type { ExtractionOutput } from '../lib/engines/types';

// ============================================================
// Parse CLI args
// ============================================================
const args = process.argv.slice(2);
let pdfPath: string | null = null;
let runs = 2;
let label = '';
let synthetic = '';

for (const a of args) {
  if (a.startsWith('--runs=')) runs = Math.max(1, parseInt(a.slice(7), 10));
  else if (a.startsWith('--label=')) label = a.slice(8);
  else if (a.startsWith('--synthetic=')) synthetic = a.slice(12);
  else if (!a.startsWith('--') && !pdfPath) pdfPath = a;
}

if (!pdfPath && !synthetic) {
  console.error('Usage :');
  console.error('  npx tsx scripts/reproducibility-harness.ts <chemin-pdf> [--runs=N] [--label=NOM]');
  console.error('  npx tsx scripts/reproducibility-harness.ts --synthetic=platypus [--runs=N]');
  process.exit(1);
}

if (pdfPath && !existsSync(pdfPath)) {
  console.error(`PDF introuvable : ${pdfPath}`);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY manquante (env ou .env.local).');
  process.exit(1);
}

const outDir = join(process.cwd(), 'scripts', 'audit-output');
try { mkdirSync(outDir, { recursive: true }); } catch {}

const stem = pdfPath
  ? basename(pdfPath).replace(/\.[Pp][Dd][Ff]$/, '').replace(/[^a-zA-Z0-9-_]/g, '_')
  : `synth-${synthetic}`;
const tsStamp = new Date().toISOString().replace(/[:.]/g, '-');
const prefix = `repro-${stem}-${label ? label + '-' : ''}${tsStamp}`;

function save(name: string, payload: any) {
  const file = join(outDir, `${prefix}-${name}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`  -> ${file}`);
}

// ============================================================
// Extraction synthetique Platypus (reprise de
// scripts/validate-platypus-deterministic.ts) pour permettre
// de tourner le harnais sans avoir le PDF en local.
// ============================================================
function syntheticPlatypusExtraction(): ExtractionOutput {
  return {
    companyName: 'Platypus Craft',
    sector: 'Nautique',
    subSector: 'Construction navale innovante',
    country: 'France',
    geographicHub: 'Cote d Azur',
    yearFounded: 2022,
    founders: [
      {
        name: 'Test Fondateur',
        role: 'CEO et fondateur',
        background: 'Ingenieur mecanique, ancien architecte naval, dix ans dans les chantiers de plaisance',
      },
    ],
    marketPitch: `Platypus Craft concoit et fabrique en France des navires submersibles legers
      pour l exploration sous-marine cotiere et la decouverte du littoral mediterraneen et atlantique.
      Notre gamme combine semi-submersible bi-place a vision panoramique et foilboard motorise
      pour la mobilite douce de loisir. Nous adressons un marche du tourisme nautique experientiel
      encore peu structure mais en croissance reguliere.`,
    productDescription: `Navires semi-submersibles bi-place avec propulsion electrique marine.
      Coque composite, batterie lithium-ion, cockpit etanche transparent. Foilboard motorise pour
      la pratique recreative. Fabrication serie limitee dans notre chantier naval de Mediterranee.
      Composants electroniques embarques : navigation, gestion energetique, suivi temps reel via
      application mobile companion. R&D hardware en interne, propulsion marine electrique
      proprietaire. Fournisseurs francais pour la coque, batteries cellule sourcees en Europe.
      Soumis a certification Bureau Veritas et homologation pavillon francais.`,
    businessModel: `Vente unitaire des navires aux operateurs touristiques (clubs nautiques,
      bases de loisirs, hotels littoraux) et aux particuliers premium. Prix unitaire 80 a 150
      keur par navire selon configuration. Marge par bateau structurelle visee 30 pourcent
      apres industrialisation serie. Pas d abonnement, pas de SaaS dans le modele core.
      L application mobile est livree gratuite avec chaque navire vendu.`,
    traction: {
      metrics: ['12 unites vendues 2024', 'Carnet de commandes 25 unites pour 2025'],
      revenue: '1.5M EUR 2024',
      growth: 'Croissance 200 pourcent annuelle sur les 24 derniers mois',
      customers: 'Mix BtoB operateurs touristiques et BtoC particuliers premium',
    },
    fundraise: {
      stage: 'series-a',
      amount: '6M EUR',
      valuation: '20M EUR pre-money',
    },
    competitorsCited: ['Seabreacher', 'U-Boat Worx', 'Triton Submarines'],
    rawSummary: `Projet industriel maritime francais. Ingenierie hydrodynamique, propulsion
      electrique marine, electronique embarquee. Production sur chantier naval francais avec
      ligne d assemblage dediee aux semi-submersibles bi-place et foilboards motorises. Chaine
      de production entierement physique : coque composite moulee sur place, propulsion marine
      electrique developpee en interne, capteurs embarques. Objectif industriel : trois cents
      unites annuelles a horizon cinq ans avec capex outillage limite par site. Carnet de
      commandes solide. Marche du tourisme nautique experientiel en croissance, porte par la
      decarbonation. Concurrence directe tres limitee sur le segment des semi-submersibles
      legers. Equipe : cinq ingenieurs mecaniciens, deux ingenieurs electroniciens, trois
      profils chantier. Feuille de route : homologation Bureau Veritas 2025, certification
      CE marine S2 2025.`,
  } as ExtractionOutput;
}

// ============================================================
// Types
// ============================================================

interface RunSnapshot {
  runIndex: number;
  durationMs: number;
  verdict: string;
  globalScore: number;
  successProbability: number;
  // 6 dimensions canoniques de l orchestrateur
  dimensions: {
    equipe: number;
    marche: number;
    macro: number;
    modele_eco: number;
    contrariens: number;
    vigilance: number;
  };
  // Score mecanique calcule par le code a partir des moteurs Bloc 1.
  // Sert a separer la variance LLM (orchestrator) de la variance
  // amont (moteurs analytics).
  mechanicalScore: number;
  mechanicalVerdict: string;
  // Scores des moteurs analytics qui alimentent l orchestrator
  rawTeamScore: number;
  rawMarketScore: number;
  rawMacroScore: number;
  rawBlindspotsScore: number;
  rawContrarianScore: number;
  // Stamp pour audit
  stampFingerprint: string;
}

interface MetricStats {
  metric: string;
  values: number[];
  mean: number;
  std: number;
  min: number;
  max: number;
  range: number;
}

// ============================================================
// Stats
// ============================================================

function statsOf(values: number[]): Omit<MetricStats, 'metric'> {
  const n = values.length;
  const mean = n > 0 ? values.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n > 0
    ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1)
    : 0;
  const std = Math.sqrt(variance);
  const min = n > 0 ? Math.min(...values) : 0;
  const max = n > 0 ? Math.max(...values) : 0;
  return { values, mean, std, min, max, range: max - min };
}

function pickDimension(
  dims: any[],
  predicate: (name: string) => boolean,
): number {
  const found = (dims || []).find((d: any) => predicate((d.dimensionName || '').toLowerCase()));
  if (!found) return -1;
  const value = found.successProbability ?? found.score ?? found.value;
  return typeof value === 'number' ? value : -1;
}

// ============================================================
// Pipeline minimal pour un run
// ------------------------------------------------------------
// Reproduit la sequence du route /api/analyze juste assez pour
// arriver au verdict / globalScore / successProbability /
// dimensionProbabilities. Pas de DD (Bloc 2), pas de fragilite
// structurelle (necessite financialData complet + matrix +
// patterns calibrage long), pas de narrative drift (optionnel).
// ============================================================

async function runOnce(
  runIndex: number,
  extraction: ExtractionOutput,
  pdfBase64OrNull: string | null,
  totalRuns: number,
): Promise<{ snapshot: RunSnapshot; stamp: VersionStamp; raw: any }> {
  const t0 = Date.now();
  console.log(`\n--- RUN ${runIndex + 1}/${totalRuns} ---`);

  // 1. Matrix (deterministe)
  const assetClassRaw = `${extraction.sector || ''} ${extraction.subSector || ''}`.trim();
  const assetClass = normalizeAssetClass(assetClassRaw);
  const matrix = computeRelevanceMatrix(extraction, assetClass);

  // 2. Financial extraction (LLM si PDF dispo, sinon stub minimaliste)
  let financial: any = null;
  if (pdfBase64OrNull) {
    try {
      financial = await extractFinancialData(pdfBase64OrNull, null, extraction);
    } catch (e: any) {
      console.warn(`  [financial] echec : ${e.message}`);
      financial = null;
    }
  }

  // 3. Couche 1 - analytics core en parallele
  console.log('  [3/8] team + market + macro ...');
  const [team, market, macro] = await Promise.all([
    analyzeTeam(extraction).catch((e: any) => { console.warn(`  team echec: ${e.message}`); throw e; }),
    analyzeMarket(extraction, null, matrix, null).catch((e: any) => { console.warn(`  market echec: ${e.message}`); throw e; }),
    analyzeMacro(extraction, null, matrix, null).catch((e: any) => { console.warn(`  macro echec: ${e.message}`); throw e; }),
  ]);

  // 4. Couche 2 - pattern, causal, blindspot, contrarian
  console.log('  [4/8] pattern matching ...');
  const pattern = await matchPatterns(extraction, team, market, macro);
  console.log('  [5/8] causal + blindspot + contrarian ...');
  const [causal, blindspot, contrarian] = await Promise.all([
    performCausalReversal(extraction, team, market, macro, pattern),
    analyzeBlindspots(extraction, team, market, macro, null),
    analyzeContrarian(extraction, team, market, macro, null),
  ]);

  // 5. Benchmarks (deterministe)
  let benchmarks: any = null;
  try {
    benchmarks = await analyzeBenchmarks(extraction, financial);
  } catch (e: any) {
    console.warn(`  [benchmarks] echec : ${e.message}`);
    benchmarks = null;
  }

  // 6. Financial coherence (LLM, conditionne par financial)
  console.log('  [6/8] financial-coherence ...');
  let financialCoherence: any = null;
  if (financial) {
    try {
      financialCoherence = await analyzeFinancialCoherence(
        extraction, financial, market, benchmarks,
      );
    } catch (e: any) {
      console.warn(`  [financial-coherence] echec : ${e.message}`);
    }
  }

  // 7. Score mecanique (deterministe a partir des moteurs amont)
  console.log('  [7/8] mechanicalScore ...');
  const mechanical = computeMechanicalScore({
    team,
    market,
    macro,
    financial: financialCoherence,
    contrarian,
    blindspot,
  });

  // 8. Orchestrator (LLM final qui produit verdict / globalScore /
  // successProbability / dimensionProbabilities)
  console.log('  [8/8] orchestrator ...');
  const recommendation = await orchestrateFinalRecommendation(
    extraction,
    team,
    market,
    macro,
    pattern,
    causal,
    blindspot,
    contrarian,
    null,
    mechanical,
    null,
    null,
    null,
  );

  // Construire le version stamp pour ce run
  const stamp = sealVersionStamp(
    buildVersionStamp({
      inputs: {
        deckBase64: pdfBase64OrNull,
        deckBytes: pdfBase64OrNull ? Math.floor((pdfBase64OrNull.length * 3) / 4) : 0,
        pitchText: extraction.rawSummary || null,
        bpText: null,
        additionalFiles: [],
      },
    }),
    Date.now() - t0,
  );

  const dims = (recommendation as any).dimensionProbabilities || [];
  const snapshot: RunSnapshot = {
    runIndex,
    durationMs: Date.now() - t0,
    verdict: (recommendation as any).verdict || 'n/a',
    globalScore: (recommendation as any).globalScore ?? -1,
    successProbability: (recommendation as any).successProbability ?? -1,
    dimensions: {
      equipe: pickDimension(dims, (n) => n.includes('équipe') || n.includes('equipe') || n.includes('team')),
      marche: pickDimension(dims, (n) => n.includes('marché') || n.includes('marche') || n === 'market'),
      macro: pickDimension(dims, (n) => n.includes('macro') || n.includes('timing')),
      modele_eco: pickDimension(dims, (n) => n.includes('modèle') || n.includes('modele') || n.includes('économique') || n.includes('economique') || n.includes('financial')),
      contrariens: pickDimension(dims, (n) => n.includes('contrarien') || n.includes('singular')),
      vigilance: pickDimension(dims, (n) => n.includes('vigilance') || n.includes('risque') || n.includes('blindspot')),
    },
    mechanicalScore: mechanical.globalScore ?? -1,
    mechanicalVerdict: mechanical.verdict ?? 'n/a',
    rawTeamScore: team?.systemicCoverage?.score ?? -1,
    rawMarketScore: market?.needIntensity?.score ?? -1,
    rawMacroScore: (macro as any)?.compositeScore ?? (macro as any)?.globalScore ?? -1,
    rawBlindspotsScore: (blindspot as any)?.globalScore ?? -1,
    rawContrarianScore: (contrarian as any)?.globalScore ?? -1,
    stampFingerprint: fingerprintStamp(stamp).enginesHash,
  };

  console.log(
    `  RUN ${runIndex + 1} -> verdict=${snapshot.verdict} globalScore=${snapshot.globalScore} ` +
    `prob=${snapshot.successProbability} dims=[${Object.entries(snapshot.dimensions).map(([k, v]) => `${k}:${v}`).join(' ')}] ` +
    `mech=${snapshot.mechanicalScore}`,
  );

  return {
    snapshot,
    stamp,
    raw: { team, market, macro, pattern, causal, blindspot, contrarian, financialCoherence, mechanical, recommendation },
  };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(`\n=== HARNAIS REPRODUCTIBILITE ===`);
  console.log(`Source : ${pdfPath || `synthetic:${synthetic}`}`);
  console.log(`Runs : ${runs}`);
  console.log(`Label : ${label || '(aucun)'}`);
  console.log(`Sortie : ${outDir}/${prefix}-*.json`);

  let extraction: ExtractionOutput;
  let pdfBase64OrNull: string | null = null;

  if (pdfPath) {
    console.log(`\n[bootstrap] Lecture PDF + extraction (1 appel LLM, partage entre les runs)`);
    const buf = readFileSync(pdfPath);
    pdfBase64OrNull = buf.toString('base64');
    extraction = await extractFromDeck(pdfBase64OrNull);
    console.log(`  societe : ${extraction.companyName} | secteur : ${extraction.sector}/${extraction.subSector} | stage : ${extraction.fundraise?.stage}`);
  } else if (synthetic === 'platypus') {
    extraction = syntheticPlatypusExtraction();
    console.log(`\n[bootstrap] Extraction synthetique Platypus (deterministe, pas de variance amont)`);
  } else {
    console.error(`Mode synthetic inconnu : ${synthetic}. Utiliser --synthetic=platypus`);
    process.exit(1);
  }

  save('extraction', extraction);

  // Lance les N runs
  const snapshots: RunSnapshot[] = [];
  const stamps: VersionStamp[] = [];
  for (let i = 0; i < runs; i++) {
    try {
      const { snapshot, stamp, raw } = await runOnce(i, extraction, pdfBase64OrNull, runs);
      snapshots.push(snapshot);
      stamps.push(stamp);
      save(`run-${i + 1}`, raw);
    } catch (e: any) {
      console.error(`\nRUN ${i + 1} ECHEC : ${e.message}`);
      console.error(e.stack);
    }
  }

  if (snapshots.length === 0) {
    console.error(`\nAucun run reussi.`);
    process.exit(1);
  }

  // ============================================================
  // STATS PAR METRIQUE
  // ============================================================

  const metrics: MetricStats[] = [];
  const metricSpecs: Array<{ name: string; pick: (s: RunSnapshot) => number }> = [
    { name: 'globalScore',         pick: (s) => s.globalScore },
    { name: 'successProbability',  pick: (s) => s.successProbability },
    { name: 'mechanicalScore',     pick: (s) => s.mechanicalScore },
    { name: 'dim.equipe',          pick: (s) => s.dimensions.equipe },
    { name: 'dim.marche',          pick: (s) => s.dimensions.marche },
    { name: 'dim.macro',           pick: (s) => s.dimensions.macro },
    { name: 'dim.modele_eco',      pick: (s) => s.dimensions.modele_eco },
    { name: 'dim.contrariens',     pick: (s) => s.dimensions.contrariens },
    { name: 'dim.vigilance',       pick: (s) => s.dimensions.vigilance },
    { name: 'raw.team',            pick: (s) => s.rawTeamScore },
    { name: 'raw.market',          pick: (s) => s.rawMarketScore },
    { name: 'raw.macro',           pick: (s) => s.rawMacroScore },
    { name: 'raw.blindspots',      pick: (s) => s.rawBlindspotsScore },
    { name: 'raw.contrarian',      pick: (s) => s.rawContrarianScore },
  ];

  for (const spec of metricSpecs) {
    const values = snapshots.map(spec.pick).filter((v) => typeof v === 'number' && v >= 0);
    if (values.length === 0) continue;
    metrics.push({ metric: spec.name, ...statsOf(values) });
  }

  // Tri par etendue decroissante
  metrics.sort((a, b) => b.range - a.range);

  // ============================================================
  // VERIFICATION STAMP IDENTIQUE
  // ============================================================

  const stampDiffs: string[][] = [];
  for (let i = 1; i < stamps.length; i++) {
    stampDiffs.push(diffStamps(stamps[0], stamps[i]));
  }
  const allStampsIdentical = stampDiffs.every((d) => d.length === 0);

  // Verdict frequency
  const verdictCounts: Record<string, number> = {};
  for (const s of snapshots) {
    verdictCounts[s.verdict] = (verdictCounts[s.verdict] || 0) + 1;
  }

  // ============================================================
  // SORTIES
  // ============================================================

  const report = {
    meta: {
      source: pdfPath || `synthetic:${synthetic}`,
      label,
      runsRequested: runs,
      runsSucceeded: snapshots.length,
      generatedAt: new Date().toISOString(),
    },
    stampVerification: {
      allStampsIdentical,
      diffsPerPair: stampDiffs,
      firstStampFingerprint: fingerprintStamp(stamps[0]),
    },
    verdictDistribution: verdictCounts,
    snapshots,
    metrics,
  };

  save('detail', report);

  // Resume lisible
  console.log(`\n=== RESUME ${runs} RUNS ===\n`);
  console.log(`STAMP IDENTIQUE SUR ${stamps.length} RUNS : ${allStampsIdentical ? 'OUI' : 'NON'}`);
  if (!allStampsIdentical) {
    console.log(`Diffs detectes (variance non purement LLM) :`);
    stampDiffs.forEach((d, i) => {
      if (d.length > 0) console.log(`  pair[0,${i + 1}] : ${d.join(' | ')}`);
    });
  }
  console.log(`Commit SHA : ${stamps[0].app.commitSha || '(inconnu)'}`);
  console.log(`Modeles : primary=${stamps[0].models.primary} fast=${stamps[0].models.fast} temp=${stamps[0].models.defaultTemperature}\n`);

  console.log(`VERDICTS (frequence) :`);
  for (const [v, n] of Object.entries(verdictCounts)) {
    console.log(`  ${v.padEnd(28)} ${n}/${snapshots.length}`);
  }

  console.log(`\nVARIANCE PAR METRIQUE (triee par etendue decroissante) :`);
  console.log(`  ${'metric'.padEnd(22)} ${'mean'.padStart(7)} ${'std'.padStart(7)} ${'min'.padStart(5)} ${'max'.padStart(5)} ${'range'.padStart(6)}  values`);
  for (const m of metrics) {
    console.log(
      `  ${m.metric.padEnd(22)} ` +
      `${m.mean.toFixed(1).padStart(7)} ` +
      `${m.std.toFixed(2).padStart(7)} ` +
      `${m.min.toString().padStart(5)} ` +
      `${m.max.toString().padStart(5)} ` +
      `${m.range.toString().padStart(6)}  ` +
      `[${m.values.join(', ')}]`,
    );
  }

  console.log(`\nSORTIE : ${outDir}/${prefix}-detail.json`);
}

main().catch((e) => {
  console.error(`\nERREUR FATALE : ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
