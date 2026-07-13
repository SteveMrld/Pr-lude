// ============================================================
// Tests deterministes des composants spider chart sectoriels
// ------------------------------------------------------------
// Couvre les helpers editoriaux (paragraphes convergences /
// divergences / evolutions, formats date), le mapping
// briefToSpiderData utilise par les trois composants, et les
// invariants de gating sur les cas limites. Pas de pixel-perfect
// sur le SVG : on verifie la presence des elements attendus
// (polygone primaire, polygone secondaire pour overlay/temporal,
// branche pointillee pour data_missing). La couche React elle-meme
// est testee par les invariants des helpers qu elle consomme.
//
// Execution : tsx app/components/sectoral/sectoral-components.test.ts
// ============================================================

import {
  buildOverlayEditorial,
  buildTemporalEditorial,
  computeDimensionDiffs,
  computeTemporalMoves,
  formatSectoralDate,
  CONVERGENCE_THRESHOLD,
  DIVERGENCE_THRESHOLD,
  TEMPORAL_DELTA_THRESHOLD,
} from './editorial-helpers';
import { briefToSpiderData } from './SectoralSpiderChart';
import { renderSpiderChart } from '../../../lib/visuals/spiderweb';
import type {
  SectoralBrief,
  SectoralBriefDimensions,
  DimensionKey,
} from '../../../lib/engines/sectoral-intelligence/types';
import { DIMENSION_KEYS } from '../../../lib/engines/sectoral-intelligence/types';

let pass = 0, fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(
      `  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
    fail++;
  }
}

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

// ============================================================
// FIXTURES
// ============================================================

function makeDim(score: number | null) {
  return {
    score,
    definition_applied: 'Definition appliquee de test.',
    sources_cited: score === null ? [] : [
      { url: 'https://example.org', title: 'Source test', accessed_at: '2026-05-01T12:00:00Z' },
    ],
    confidence: (score === null ? 'data_missing' : 'high') as any,
    data_missing: score === null,
    notes: score === null ? undefined : `Note ${score}.`,
  };
}

function makeBrief(slug: string, opts: {
  generatedAt?: string;
  dimensions?: Partial<Record<DimensionKey, number | null>>;
} = {}): SectoralBrief {
  const dims: SectoralBriefDimensions = {} as any;
  for (const key of DIMENSION_KEYS) {
    const score = opts.dimensions && key in opts.dimensions
      ? opts.dimensions[key]!
      : 50;
    dims[key] = makeDim(score) as any;
  }
  return {
    sector_slug: slug,
    generated_at: opts.generatedAt ?? '2026-04-01T12:00:00Z',
    dimensions: dims,
    narrative_summary: `Resume editorial sobre du secteur ${slug}.`,
    regeneration_trigger: 'cron',
    supersedes_id: null,
    generation_metadata: {
      dimension_model: 'claude-sonnet-4-6',
      aggregator_model: 'claude-opus-4-7',
      prompt_version: 'v0.0.1',
      cost_usd: 1.5,
      duration_ms: 60000,
      dimensions_regenerated: [...DIMENSION_KEYS],
    },
  };
}

// ============================================================
// TEST 1 : seuils doctrinaux
// ============================================================

console.log('\n=== Test 1 : seuils doctrinaux ===');
{
  check('CONVERGENCE_THRESHOLD = 10', CONVERGENCE_THRESHOLD, 10);
  check('DIVERGENCE_THRESHOLD = 30', DIVERGENCE_THRESHOLD, 30);
  check('TEMPORAL_DELTA_THRESHOLD = 10', TEMPORAL_DELTA_THRESHOLD, 10);
}

// ============================================================
// TEST 2 : formatSectoralDate
// ============================================================

console.log('\n=== Test 2 : formatSectoralDate ===');
{
  const formatted = formatSectoralDate('2026-04-01T12:00:00Z');
  checkTrue('contient 2026', /2026/.test(formatted));
  checkTrue('contient avril', /avril/i.test(formatted));

  check('null -> date inconnue', formatSectoralDate(null), 'date inconnue');
  check('undefined -> date inconnue', formatSectoralDate(undefined), 'date inconnue');
}

// ============================================================
// TEST 3 : computeDimensionDiffs
// ============================================================

console.log('\n=== Test 3 : computeDimensionDiffs ===');
{
  const primary = makeBrief('fintech', {
    dimensions: { intensite_capitalistique: 40, pression_reglementaire: 70 },
  });
  const secondary = makeBrief('crypto-blockchain', {
    dimensions: { intensite_capitalistique: 45, pression_reglementaire: 80 },
  });
  const diffs = computeDimensionDiffs(primary, secondary);
  check('huit dimensions retournees', diffs.length, 8);
  const intensity = diffs.find((d) => d.key === 'intensite_capitalistique')!;
  check('delta intensite 5', intensity.delta, 5);
  const reg = diffs.find((d) => d.key === 'pression_reglementaire')!;
  check('delta reglementation 10', reg.delta, 10);
}

// ============================================================
// TEST 4 : buildOverlayEditorial (convergences)
// ============================================================

console.log('\n=== Test 4 : overlay editorial convergences ===');
{
  // Tous les scores proches : doit mentionner convergence.
  const primary = makeBrief('fintech', {
    dimensions: {
      intensite_capitalistique: 50,
      pression_reglementaire: 60,
      velocite_technologique: 55,
      concentration_concurrentielle: 50,
      cyclicite_macroeconomique: 50,
      exposition_geopolitique: 50,
      tension_capital_talent: 50,
      vulnerabilite_narrative_sectorielle: 50,
    },
  });
  const secondary = makeBrief('logiciel-entreprise-horizontal', {
    dimensions: {
      intensite_capitalistique: 52,
      pression_reglementaire: 58,
      velocite_technologique: 53,
      concentration_concurrentielle: 48,
      cyclicite_macroeconomique: 52,
      exposition_geopolitique: 50,
      tension_capital_talent: 50,
      vulnerabilite_narrative_sectorielle: 50,
    },
  });
  const text = buildOverlayEditorial(primary, secondary, {
    primaryLabel: 'Fintech',
    secondaryLabel: 'Logiciel d entreprise',
  });
  checkTrue('mentionne convergent', /convergent|convergence/i.test(text));
  checkTrue('ne mentionne pas divergences', !/divergences/i.test(text));
}

// ============================================================
// TEST 5 : buildOverlayEditorial (divergences)
// ============================================================

console.log('\n=== Test 5 : overlay editorial divergences ===');
{
  const primary = makeBrief('climat-energie', {
    dimensions: {
      intensite_capitalistique: 90,
      cyclicite_macroeconomique: 70,
      vulnerabilite_narrative_sectorielle: 30,
      pression_reglementaire: 50,
      velocite_technologique: 50,
      concentration_concurrentielle: 50,
      exposition_geopolitique: 50,
      tension_capital_talent: 50,
    },
  });
  const secondary = makeBrief('logiciel-entreprise-horizontal', {
    dimensions: {
      intensite_capitalistique: 30,
      cyclicite_macroeconomique: 25,
      vulnerabilite_narrative_sectorielle: 70,
      pression_reglementaire: 50,
      velocite_technologique: 50,
      concentration_concurrentielle: 50,
      exposition_geopolitique: 50,
      tension_capital_talent: 50,
    },
  });
  const text = buildOverlayEditorial(primary, secondary, {
    primaryLabel: 'Climat',
    secondaryLabel: 'Logiciel',
  });
  checkTrue('mentionne divergences', /divergence|divergences/i.test(text));
  checkTrue('nomme l intensite capitalistique', /intensité capitalistique/i.test(text));
  checkTrue('nomme Climat ou Logiciel', /Climat|Logiciel/.test(text));
}

// ============================================================
// TEST 6 : computeTemporalMoves
// ============================================================

console.log('\n=== Test 6 : computeTemporalMoves ===');
{
  const current = makeBrief('ia-appliquee', {
    generatedAt: '2026-05-01T00:00:00Z',
    dimensions: {
      velocite_technologique: 90,
      vulnerabilite_narrative_sectorielle: 80,
      intensite_capitalistique: 50,
    },
  });
  const previous = makeBrief('ia-appliquee', {
    generatedAt: '2025-05-01T00:00:00Z',
    dimensions: {
      velocite_technologique: 70,
      vulnerabilite_narrative_sectorielle: 60,
      intensite_capitalistique: 50,
    },
  });
  const moves = computeTemporalMoves(current, previous);
  const velocite = moves.find((m) => m.key === 'velocite_technologique')!;
  check('delta velocite +20', velocite.delta, 20);
  checkTrue('velocite attendue', velocite.expected);
  const intensite = moves.find((m) => m.key === 'intensite_capitalistique')!;
  check('delta intensite 0', intensite.delta, 0);
  checkTrue('intensite non attendue (stable)', !intensite.expected);
}

// ============================================================
// TEST 7 : buildTemporalEditorial avec mouvement
// ============================================================

console.log('\n=== Test 7 : temporal editorial mouvement ===');
{
  const current = makeBrief('ia-appliquee', {
    dimensions: {
      velocite_technologique: 90,
      intensite_capitalistique: 75,
      cyclicite_macroeconomique: 50,
      vulnerabilite_narrative_sectorielle: 50,
      concentration_concurrentielle: 50,
      pression_reglementaire: 50,
      exposition_geopolitique: 50,
      tension_capital_talent: 50,
    },
  });
  const previous = makeBrief('ia-appliquee', {
    generatedAt: '2025-05-01T00:00:00Z',
    dimensions: {
      velocite_technologique: 70,
      intensite_capitalistique: 50,
      cyclicite_macroeconomique: 50,
      vulnerabilite_narrative_sectorielle: 50,
      concentration_concurrentielle: 50,
      pression_reglementaire: 50,
      exposition_geopolitique: 50,
      tension_capital_talent: 50,
    },
  });
  const text = buildTemporalEditorial(current, previous, {
    sectorLabel: 'IA appliquee',
  });
  checkTrue('mentionne velocite (attendue)', /vélocité/i.test(text));
  checkTrue('mentionne intensite (surprenante)', /intensité/i.test(text));
  checkTrue('marque evolutions inattendues', /inattendue/i.test(text));
  checkTrue('marque evolutions attendues', /attendue/i.test(text));
}

// ============================================================
// TEST 8 : buildTemporalEditorial avec stabilite
// ============================================================

console.log('\n=== Test 8 : temporal editorial stable ===');
{
  const same = makeBrief('fintech');
  const text = buildTemporalEditorial(same, same, { sectorLabel: 'Fintech' });
  checkTrue('mention stabilite', /stable|aucune dimension/i.test(text));
}

// ============================================================
// TEST 9 : briefToSpiderData
// ============================================================

console.log('\n=== Test 9 : briefToSpiderData mapping ===');
{
  const brief = makeBrief('fintech', {
    dimensions: {
      intensite_capitalistique: 65,
      vulnerabilite_narrative_sectorielle: null, // data_missing
    },
  });
  const data = briefToSpiderData(brief, { title: 'Fintech', subtitle: 'sub' });
  check('huit dimensions', data.dimensions.length, 8);
  check('title preserve', data.title, 'Fintech');
  check('subtitle preserve', data.subtitle, 'sub');
  check('score primaire 65', data.dimensions[0].score, 65);
  // vulnerabilite_narrative_sectorielle est la huitieme dimension dans DIMENSION_KEYS
  const lastIdx = DIMENSION_KEYS.indexOf('vulnerabilite_narrative_sectorielle');
  check('data_missing -> null', data.dimensions[lastIdx].score, null);
}

// ============================================================
// TEST 10 : renderSpiderChart pour les trois modes
// ============================================================

console.log('\n=== Test 10 : renderSpiderChart SVG par mode ===');
{
  const primary = makeBrief('fintech');
  const secondary = makeBrief('crypto-blockchain');
  const dimensions = briefToSpiderData(primary).dimensions;
  const secDimensions = briefToSpiderData(secondary).dimensions;

  // Mode single : exactement un polygone.
  const single = renderSpiderChart({ dimensions }, { mode: 'single', size: 480 });
  const singlePolygons = (single.match(/<polygon /g) || []).length;
  check('single : un polygone', singlePolygons, 1);

  // Mode overlay : deux polygones (secondaire en ocre eteint, primaire en ocre brule).
  const overlay = renderSpiderChart(
    { dimensions },
    { mode: 'overlay', secondary: { dimensions: secDimensions }, size: 480 },
  );
  const overlayPolygons = (overlay.match(/<polygon /g) || []).length;
  check('overlay : deux polygones', overlayPolygons, 2);
  checkTrue('overlay contient ocre eteint', /#C8A988/i.test(overlay));

  // Mode temporal : deux polygones, le secondaire en pointille (dasharray).
  const temporal = renderSpiderChart(
    { dimensions },
    { mode: 'temporal', secondary: { dimensions: secDimensions }, size: 480 },
  );
  checkTrue('temporal contient stroke-dasharray', /stroke-dasharray/.test(temporal));
}

// ============================================================
// TEST 11 : data_missing rendue en branche pointillee
// ============================================================

console.log('\n=== Test 11 : data_missing branch ===');
{
  const brief = makeBrief('crypto-blockchain', {
    dimensions: { exposition_geopolitique: null },
  });
  const data = briefToSpiderData(brief);
  const svg = renderSpiderChart(data, { mode: 'single', size: 480 });
  // Regle doctrinale : un axe non evaluable est neutralise a
  // mi-echelle avec style distinct (pointille grise, marque n/e)
  // et exclu du calcul d aire du polygone principal. Le polygone
  // continue d etre trace sur les axes presents, sans effondrement
  // vers zero sur l axe manquant.
  checkTrue('polygone d aire trace sur axes presents', /<polygon /.test(svg));
  checkTrue('trait radial pointille marquant la neutralisation', /stroke-dasharray="1 4"/.test(svg));
  checkTrue('marque n/e presente pour l axe non evaluable', />n\/e</.test(svg));
}

// ============================================================
// TEST 12 : overlay editorial avec data_missing exclu
// ============================================================

console.log('\n=== Test 12 : data_missing exclu de l editorial ===');
{
  const primary = makeBrief('fintech', { dimensions: { intensite_capitalistique: null } });
  const secondary = makeBrief('crypto-blockchain', { dimensions: { intensite_capitalistique: 50 } });
  const text = buildOverlayEditorial(primary, secondary, {
    primaryLabel: 'Fintech',
    secondaryLabel: 'Crypto',
  });
  // Intensite est null cote primary -> exclu. Les autres sept dimensions
  // sont egales a 50, donc convergence sur les sept restantes.
  checkTrue('mentionne convergence', /convergent|convergence/i.test(text));
  checkTrue('ne nomme pas intensite (exclue car data_missing)', !/intensité capitalistique/i.test(text));
}

// ============================================================
// TEST 13 : invariants de geometrie SVG
// ============================================================

console.log('\n=== Test 13 : invariants SVG ===');
{
  const brief = makeBrief('fintech');
  const svg = renderSpiderChart(briefToSpiderData(brief), { mode: 'single', size: 150 });
  checkTrue('svg viewBox 150', /viewBox="0 0 150 150"/.test(svg));
  checkTrue('svg width 150', /width="150"/.test(svg));
  // Les huit axes du polygone reguliers produisent huit labels de texte
  // (un par dimension). Le SVG contient aussi du texte titre/legende
  // mais ici on n a ni titre ni subtitle, juste les huit axes plus
  // les graduations chiffrees.
  const textCount = (svg.match(/<text /g) || []).length;
  checkTrue('au moins huit elements text', textCount >= 8);
}

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
