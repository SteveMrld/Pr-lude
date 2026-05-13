// ============================================================
// Tests deterministes des computations inter-sectorielles
// ------------------------------------------------------------
// Couvre les trois objets analytiques (convergences, divergences,
// patterns macro) avec les seuils exacts, plus les helpers de
// periode trimestrielle et l inventaire de completude. Aucun
// acces reseau, aucune dependance Supabase ni LLM.
//
// Execution :
//   tsx lib/engines/sectoral-intelligence/inter-sector-computations.test.ts
// ============================================================

import {
  computeInterSectoralAnalytics,
  computeConvergences,
  computeDivergences,
  computeMacroPatterns,
  computeCompleteness,
  formatPeriodQuarter,
  previousPeriodQuarter,
  isFirstDayOfQuarter,
  CONVERGENCE_PREV_GAP_THRESHOLD,
  CONVERGENCE_CURR_GAP_THRESHOLD,
  DIVERGENCE_PREV_GAP_THRESHOLD,
  DIVERGENCE_CURR_GAP_THRESHOLD,
  MACRO_PATTERN_DELTA_THRESHOLD,
  MACRO_PATTERN_MIN_SECTORS,
} from './inter-sector-computations';
import { DIMENSION_KEYS, SECTORS } from './types';
import type {
  DimensionKey,
  SectoralBrief,
  SectoralBriefDimensions,
  SectoralDimension,
} from './types';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  const eq = actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
  if (eq) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

// ============================================================
// FIXTURES
// ============================================================

function makeDimension(score: number | null, dataMissing = false): SectoralDimension {
  return {
    score: dataMissing ? null : score,
    definition_applied: 'def',
    sources_cited: dataMissing ? [] : [{ url: 'https://x', title: 't', accessed_at: '2026-01-01' }],
    confidence: dataMissing ? 'data_missing' : 'medium',
    data_missing: dataMissing,
  };
}

function makeBrief(
  slug: string,
  scores: Partial<Record<DimensionKey, number | null>>,
): SectoralBrief {
  const dims: Partial<SectoralBriefDimensions> = {};
  for (const k of DIMENSION_KEYS) {
    const s = scores[k];
    if (s === undefined) {
      dims[k] = makeDimension(50);
    } else if (s === null) {
      dims[k] = makeDimension(null, true);
    } else {
      dims[k] = makeDimension(s);
    }
  }
  return {
    id: `brief-${slug}`,
    sector_slug: slug,
    generated_at: '2026-04-01T00:00:00.000Z',
    dimensions: dims as SectoralBriefDimensions,
    narrative_summary: `Summary ${slug}`,
    regeneration_trigger: 'cron',
    supersedes_id: null,
    generation_metadata: {
      dimension_model: 'claude-sonnet-4-6',
      aggregator_model: 'claude-opus-4-7',
      prompt_version: 'v1',
      cost_usd: 0,
      duration_ms: 0,
      dimensions_regenerated: [...DIMENSION_KEYS],
    },
  };
}

// ============================================================
console.log('\n--- seuils doctrinaux ---');
// ============================================================

check('seuil convergence prev = 20', CONVERGENCE_PREV_GAP_THRESHOLD, 20);
check('seuil convergence curr = 10', CONVERGENCE_CURR_GAP_THRESHOLD, 10);
check('seuil divergence prev = 15', DIVERGENCE_PREV_GAP_THRESHOLD, 15);
check('seuil divergence curr = 30', DIVERGENCE_CURR_GAP_THRESHOLD, 30);
check('seuil macro delta = 10', MACRO_PATTERN_DELTA_THRESHOLD, 10);
check('seuil macro min sectors = 7', MACRO_PATTERN_MIN_SECTORS, 7);

// ============================================================
console.log('\n--- convergences : doctrine canonique ---');
// ============================================================

// Cas doctrinal : climat-energie et mobilite-logistique convergent
// sur tension_capital_talent (ecart 25 -> 6 entre T-1 et T).
const climatPrev = makeBrief('climat-energie', { tension_capital_talent: 35 });
const mobilitePrev = makeBrief('mobilite-logistique', { tension_capital_talent: 60 });
const climatCurr = makeBrief('climat-energie', { tension_capital_talent: 72 });
const mobiliteCurr = makeBrief('mobilite-logistique', { tension_capital_talent: 78 });

const convDoctrine = computeConvergences(
  new Map([
    ['climat-energie', climatCurr],
    ['mobilite-logistique', mobiliteCurr],
  ]),
  new Map([
    ['climat-energie', climatPrev],
    ['mobilite-logistique', mobilitePrev],
  ]),
  ['climat-energie', 'mobilite-logistique'],
);

check('convergence doctrinale detectee', convDoctrine.length, 1);
check(
  'convergence sur tension_capital_talent',
  convDoctrine[0]?.dimension,
  'tension_capital_talent',
);
check('ecart T-1 = 25', convDoctrine[0]?.delta_t_minus_1, 25);
check('ecart T = 6', convDoctrine[0]?.delta_t, 6);
check(
  'paire ordonnee alphabetiquement',
  JSON.stringify(convDoctrine[0]?.sectors),
  JSON.stringify(['climat-energie', 'mobilite-logistique']),
);

// ============================================================
console.log('\n--- convergences : bornes strictes ---');
// ============================================================

// Ecart prev = 20 EXACT : NON eligible (seuil strict).
const convAtPrev = computeConvergences(
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: 55 })],
  ]),
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: 70 })],
  ]),
  ['a', 'b'],
);
check('ecart prev = 20 pile non eligible (>20 strict)', convAtPrev.length, 0);

// Ecart prev = 21 : eligible si curr < 10.
const convAbovePrev = computeConvergences(
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: 55 })],
  ]),
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: 71 })],
  ]),
  ['a', 'b'],
);
check('ecart prev = 21 eligible', convAbovePrev.length, 1);

// Ecart curr = 10 EXACT : NON eligible (seuil strict).
const convAtCurr = computeConvergences(
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: 60 })],
  ]),
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: 75 })],
  ]),
  ['a', 'b'],
);
check('ecart curr = 10 pile non eligible (<10 strict)', convAtCurr.length, 0);

// ============================================================
console.log('\n--- convergences : data_missing exclut la paire ---');
// ============================================================

const convMissing = computeConvergences(
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: null })],
  ]),
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: 75 })],
  ]),
  ['a', 'b'],
);
check('paire avec data_missing exclue', convMissing.length, 0);

// ============================================================
console.log('\n--- divergences : doctrine canonique ---');
// ============================================================

// Cas doctrinal : logiciel-entreprise-horizontal et ia-appliquee
// divergent sur velocite_technologique (ecart 5 -> 40).
const divPrev = new Map([
  ['logiciel-entreprise-horizontal', makeBrief('logiciel-entreprise-horizontal', { velocite_technologique: 60 })],
  ['ia-appliquee', makeBrief('ia-appliquee', { velocite_technologique: 65 })],
]);
const divCurr = new Map([
  ['logiciel-entreprise-horizontal', makeBrief('logiciel-entreprise-horizontal', { velocite_technologique: 55 })],
  ['ia-appliquee', makeBrief('ia-appliquee', { velocite_technologique: 95 })],
]);

const divDoctrine = computeDivergences(divCurr, divPrev, [
  'logiciel-entreprise-horizontal',
  'ia-appliquee',
]);
check('divergence doctrinale detectee', divDoctrine.length, 1);
check(
  'divergence sur velocite_technologique',
  divDoctrine[0]?.dimension,
  'velocite_technologique',
);
check('ecart T-1 = 5', divDoctrine[0]?.delta_t_minus_1, 5);
check('ecart T = 40', divDoctrine[0]?.delta_t, 40);

// Bornes strictes
const divAtBorders = computeDivergences(
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 30 })],
    ['b', makeBrief('b', { intensite_capitalistique: 60 })],
  ]),
  new Map([
    ['a', makeBrief('a', { intensite_capitalistique: 50 })],
    ['b', makeBrief('b', { intensite_capitalistique: 65 })],
  ]),
  ['a', 'b'],
);
check('ecart T = 30 pile non eligible (>30 strict)', divAtBorders.length, 0);

// ============================================================
console.log('\n--- patterns macro : doctrine canonique ---');
// ============================================================

// Cas doctrinal : pression_reglementaire bouge a la hausse sur 9
// des 13 secteurs (AI Act + NIS2). Construit les 13 secteurs avec
// 9 qui bougent +12pts et 4 qui restent stables.
const slugs = SECTORS.map((s) => s.slug);
const macroUpSlugs = slugs.slice(0, 9);
const macroStableSlugs = slugs.slice(9);

const macroCurr = new Map<string, SectoralBrief>();
const macroPrev = new Map<string, SectoralBrief>();
for (const slug of macroUpSlugs) {
  macroPrev.set(slug, makeBrief(slug, { pression_reglementaire: 40 }));
  macroCurr.set(slug, makeBrief(slug, { pression_reglementaire: 52 }));
}
for (const slug of macroStableSlugs) {
  macroPrev.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
  macroCurr.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
}

const macroDoctrine = computeMacroPatterns(macroCurr, macroPrev, slugs);
check('pattern macro detecte', macroDoctrine.length, 1);
check('pattern sur pression_reglementaire', macroDoctrine[0]?.dimension, 'pression_reglementaire');
check('direction up', macroDoctrine[0]?.direction, 'up');
check('average_delta = 12', macroDoctrine[0]?.average_delta, 12);
check('9 secteurs affectes', macroDoctrine[0]?.sectors_affected.length, 9);

// ============================================================
console.log('\n--- patterns macro : seuil minimum strict ---');
// ============================================================

// 6 secteurs bougent : SOUS le seuil (min 7).
const macroCurr2 = new Map<string, SectoralBrief>();
const macroPrev2 = new Map<string, SectoralBrief>();
for (const slug of slugs.slice(0, 6)) {
  macroPrev2.set(slug, makeBrief(slug, { pression_reglementaire: 40 }));
  macroCurr2.set(slug, makeBrief(slug, { pression_reglementaire: 55 }));
}
for (const slug of slugs.slice(6)) {
  macroPrev2.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
  macroCurr2.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
}

const macro6 = computeMacroPatterns(macroCurr2, macroPrev2, slugs);
check('6 secteurs : sous le seuil', macro6.length, 0);

// 7 secteurs : exactement au seuil (>=7 inclusif).
const macroCurr3 = new Map<string, SectoralBrief>();
const macroPrev3 = new Map<string, SectoralBrief>();
for (const slug of slugs.slice(0, 7)) {
  macroPrev3.set(slug, makeBrief(slug, { pression_reglementaire: 40 }));
  macroCurr3.set(slug, makeBrief(slug, { pression_reglementaire: 55 }));
}
for (const slug of slugs.slice(7)) {
  macroPrev3.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
  macroCurr3.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
}
const macro7 = computeMacroPatterns(macroCurr3, macroPrev3, slugs);
check('7 secteurs : pile au seuil, eligible', macro7.length, 1);

// ============================================================
console.log('\n--- patterns macro : delta seuil strict ---');
// ============================================================

// 7 secteurs bougent de exactement 10pts : NON eligible (>10 strict).
const macroCurr4 = new Map<string, SectoralBrief>();
const macroPrev4 = new Map<string, SectoralBrief>();
for (const slug of slugs.slice(0, 7)) {
  macroPrev4.set(slug, makeBrief(slug, { pression_reglementaire: 40 }));
  macroCurr4.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
}
for (const slug of slugs.slice(7)) {
  macroPrev4.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
  macroCurr4.set(slug, makeBrief(slug, { pression_reglementaire: 50 }));
}
const macroAt10 = computeMacroPatterns(macroCurr4, macroPrev4, slugs);
check('delta = 10 pile non eligible (>10 strict)', macroAt10.length, 0);

// ============================================================
console.log('\n--- patterns macro : direction down ---');
// ============================================================

const macroCurr5 = new Map<string, SectoralBrief>();
const macroPrev5 = new Map<string, SectoralBrief>();
for (const slug of slugs.slice(0, 8)) {
  macroPrev5.set(slug, makeBrief(slug, { vulnerabilite_narrative_sectorielle: 70 }));
  macroCurr5.set(slug, makeBrief(slug, { vulnerabilite_narrative_sectorielle: 55 }));
}
for (const slug of slugs.slice(8)) {
  macroPrev5.set(slug, makeBrief(slug, { vulnerabilite_narrative_sectorielle: 50 }));
  macroCurr5.set(slug, makeBrief(slug, { vulnerabilite_narrative_sectorielle: 50 }));
}
const macroDown = computeMacroPatterns(macroCurr5, macroPrev5, slugs);
check('pattern baissier detecte', macroDown.length, 1);
check('direction down', macroDown[0]?.direction, 'down');
check('average_delta = -15', macroDown[0]?.average_delta, -15);

// ============================================================
console.log('\n--- completude ---');
// ============================================================

const completenessCase = computeCompleteness(
  new Map([
    ['fintech', makeBrief('fintech', {})],
    ['ia-appliquee', makeBrief('ia-appliquee', {})],
    ['climat-energie', makeBrief('climat-energie', {})],
  ]),
  new Map([
    ['fintech', makeBrief('fintech', {})],
    ['climat-energie', makeBrief('climat-energie', {})],
    ['mobilite-logistique', makeBrief('mobilite-logistique', {})],
  ]),
);
check(
  'comparable = secteurs presents aux deux trimestres',
  JSON.stringify(completenessCase.comparable),
  JSON.stringify(['climat-energie', 'fintech']),
);
check(
  'missing_at_t_minus_1 = secteurs presents a T sans T-1',
  JSON.stringify(completenessCase.missing_at_t_minus_1),
  JSON.stringify(['ia-appliquee']),
);
check(
  'missing_at_t = secteurs presents a T-1 sans T',
  JSON.stringify(completenessCase.missing_at_t),
  JSON.stringify(['mobilite-logistique']),
);
checkTrue(
  'missing_both inclut tous les autres slugs catalogue',
  completenessCase.missing_both.length === SECTORS.length - 4,
);

// ============================================================
console.log('\n--- helpers de periode trimestrielle ---');
// ============================================================

check('Q1 = janvier', formatPeriodQuarter(new Date('2026-01-15T00:00:00Z')), '2026-Q1');
check('Q1 = mars', formatPeriodQuarter(new Date('2026-03-31T23:00:00Z')), '2026-Q1');
check('Q2 = avril', formatPeriodQuarter(new Date('2026-04-01T08:00:00Z')), '2026-Q2');
check('Q2 = juin', formatPeriodQuarter(new Date('2026-06-30T12:00:00Z')), '2026-Q2');
check('Q3 = juillet', formatPeriodQuarter(new Date('2026-07-15T00:00:00Z')), '2026-Q3');
check('Q4 = octobre', formatPeriodQuarter(new Date('2026-10-01T00:00:00Z')), '2026-Q4');
check('Q4 = decembre', formatPeriodQuarter(new Date('2026-12-31T23:59:59Z')), '2026-Q4');

check('previous Q2 = Q1 meme annee', previousPeriodQuarter('2026-Q2'), '2026-Q1');
check('previous Q1 = Q4 annee precedente', previousPeriodQuarter('2026-Q1'), '2025-Q4');
check('previous Q4 = Q3', previousPeriodQuarter('2026-Q4'), '2026-Q3');

let threw = false;
try {
  previousPeriodQuarter('mauvais-format');
} catch {
  threw = true;
}
checkTrue('previousPeriodQuarter throw sur format invalide', threw);

// isFirstDayOfQuarter
check(
  '1er janvier eligible',
  isFirstDayOfQuarter(new Date('2026-01-01T08:00:00Z')),
  true,
);
check(
  '1er avril eligible',
  isFirstDayOfQuarter(new Date('2026-04-01T08:00:00Z')),
  true,
);
check(
  '1er juillet eligible',
  isFirstDayOfQuarter(new Date('2026-07-01T08:00:00Z')),
  true,
);
check(
  '1er octobre eligible',
  isFirstDayOfQuarter(new Date('2026-10-01T08:00:00Z')),
  true,
);
check(
  '2 janvier non eligible',
  isFirstDayOfQuarter(new Date('2026-01-02T08:00:00Z')),
  false,
);
check(
  '1er fevrier non eligible',
  isFirstDayOfQuarter(new Date('2026-02-01T08:00:00Z')),
  false,
);
check(
  '1er mai non eligible',
  isFirstDayOfQuarter(new Date('2026-05-01T08:00:00Z')),
  false,
);

// ============================================================
console.log('\n--- INTEGRATION : computeInterSectoralAnalytics ---');
// ============================================================

const integrationCurr = [climatCurr, mobiliteCurr];
const integrationPrev = [climatPrev, mobilitePrev];
const integrationOutput = computeInterSectoralAnalytics(integrationCurr, integrationPrev);

check(
  'integration : convergence detectee',
  integrationOutput.convergences.length,
  1,
);
checkTrue(
  'integration : completeness rapporte les missing',
  integrationOutput.completeness.missing_both.length === SECTORS.length - 2,
);
check(
  'integration : 2 secteurs comparables',
  integrationOutput.completeness.comparable.length,
  2,
);

// ============================================================
console.log('\n--- ordre stable (determinisme) ---');
// ============================================================

const stableCurr = new Map<string, SectoralBrief>();
const stablePrev = new Map<string, SectoralBrief>();
for (const slug of ['fintech', 'ia-appliquee', 'climat-energie']) {
  stablePrev.set(slug, makeBrief(slug, { intensite_capitalistique: 30 }));
  stableCurr.set(slug, makeBrief(slug, { intensite_capitalistique: 70 }));
}
const conv1 = computeConvergences(stableCurr, stablePrev, ['fintech', 'ia-appliquee', 'climat-energie']);
const conv2 = computeConvergences(stableCurr, stablePrev, ['fintech', 'ia-appliquee', 'climat-energie']);
check(
  'ordre stable entre deux executions',
  JSON.stringify(conv1),
  JSON.stringify(conv2),
);

// ============================================================
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
