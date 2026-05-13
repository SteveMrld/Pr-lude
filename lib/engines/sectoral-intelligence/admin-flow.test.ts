// ============================================================
// Tests deterministes des helpers admin sectoriels
// ------------------------------------------------------------
// Couvre la validation des body POST de regeneration, l assemblage
// des SectorRow a partir de fiches Supabase, le merge surgical
// d une dimension regeneree dans une fiche precedente, et les
// helpers de formatage editorial.
//
// Aucun acces reseau, aucune dependance Supabase.
//
// Execution :
//   tsx lib/engines/sectoral-intelligence/admin-flow.test.ts
// ============================================================

import {
  validateRegenerateRequest,
  briefToSectorRow,
  emptySectorRow,
  countSourcesInDimensions,
  mergeDimensionIntoNewBrief,
  formatAge,
  formatCost,
  formatDuration,
} from './admin-flow';
import {
  DIMENSION_KEYS,
  SECTORS,
  getSectorBySlug,
  type DimensionKey,
  type SectoralBrief,
  type SectoralBriefDimensions,
  type SectoralDimension,
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

const NOW = new Date('2026-05-13T10:00:00Z');
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ============================================================
// FIXTURES
// ============================================================

function makeDimension(score: number | null, sourcesCount: number, dataMissing = false): SectoralDimension {
  return {
    score: dataMissing ? null : score,
    definition_applied: 'Definition de test pour la dimension.',
    sources_cited: dataMissing
      ? []
      : Array.from({ length: sourcesCount }, (_, i) => ({
          url: `https://example.org/source-${i}`,
          title: `Source ${i}`,
          accessed_at: '2026-05-12T10:00:00Z',
        })),
    confidence: dataMissing ? 'data_missing' : 'medium',
    data_missing: dataMissing,
    notes: 'Notes de test.',
  };
}

function makeFullDimensions(scoreOverrides: Partial<Record<DimensionKey, number>> = {}): SectoralBriefDimensions {
  const out: Partial<SectoralBriefDimensions> = {};
  for (const k of DIMENSION_KEYS) {
    out[k] = makeDimension(scoreOverrides[k] ?? 50, 2);
  }
  return out as SectoralBriefDimensions;
}

function makeBrief(overrides: Partial<SectoralBrief> = {}): SectoralBrief {
  return {
    id: 'brief-test-001',
    sector_slug: 'fintech',
    generated_at: new Date(NOW.getTime() - 30 * MS_PER_DAY).toISOString(),
    dimensions: makeFullDimensions(),
    narrative_summary: 'Resume editorial de test pour la fiche fintech.',
    regeneration_trigger: 'manual',
    supersedes_id: null,
    generation_metadata: {
      dimension_model: 'claude-sonnet-4-6',
      aggregator_model: 'claude-opus-4-7',
      prompt_version: 'v1',
      cost_usd: 0.42,
      duration_ms: 38000,
      dimensions_regenerated: [...DIMENSION_KEYS],
    },
    ...overrides,
  };
}

// ============================================================
console.log('\n--- validateRegenerateRequest ---');
// ============================================================

check(
  'rejet body absent',
  validateRegenerateRequest(null),
  { ok: false, error: 'Body JSON requis.' },
);

check(
  'rejet body vide',
  validateRegenerateRequest({}),
  { ok: false, error: 'Champ sector_slug requis.' },
);

const slugErr = validateRegenerateRequest({ sector_slug: 'inconnu', mode: 'full' });
checkTrue(
  'rejet slug secteur inconnu',
  slugErr.ok === false && slugErr.error.startsWith('Slug secteur inconnu'),
);

const modeErr = validateRegenerateRequest({ sector_slug: 'fintech' });
checkTrue(
  'rejet mode absent',
  modeErr.ok === false && modeErr.error.startsWith('Mode requis'),
);

const modeBadErr = validateRegenerateRequest({ sector_slug: 'fintech', mode: 'partial' });
checkTrue(
  'rejet mode invalide',
  modeBadErr.ok === false && modeBadErr.error.startsWith('Mode requis'),
);

const dimErr = validateRegenerateRequest({ sector_slug: 'fintech', mode: 'dimension' });
checkTrue(
  'rejet dimension absente quand mode=dimension',
  dimErr.ok === false && dimErr.error.startsWith('Dimension requise'),
);

const dimBadErr = validateRegenerateRequest({
  sector_slug: 'fintech',
  mode: 'dimension',
  dimension: 'inventee',
});
checkTrue(
  'rejet dimension invalide',
  dimBadErr.ok === false && dimBadErr.error.startsWith('Dimension requise'),
);

const fullOk = validateRegenerateRequest({ sector_slug: 'fintech', mode: 'full' });
checkTrue(
  'accepte full mode pour secteur valide',
  fullOk.ok === true && fullOk.sector_slug === 'fintech' && fullOk.mode === 'full' && fullOk.dimension === null,
);

const dimOk = validateRegenerateRequest({
  sector_slug: 'fintech',
  mode: 'dimension',
  dimension: 'pression_reglementaire',
});
checkTrue(
  'accepte dimension mode pour secteur+dimension valides',
  dimOk.ok === true &&
    dimOk.sector_slug === 'fintech' &&
    dimOk.mode === 'dimension' &&
    dimOk.dimension === 'pression_reglementaire',
);

// Ignore les champs etrangers, n echoue pas dessus
const extraOk = validateRegenerateRequest({
  sector_slug: 'fintech',
  mode: 'full',
  dimension: 'pression_reglementaire', // ignore en mode full
  evil: { injection: 'XYZ' },
} as any);
checkTrue('ignore champs etrangers en mode full', extraOk.ok === true);

// Type non-string
const numErr = validateRegenerateRequest({ sector_slug: 42 } as any);
checkTrue('rejet sector_slug non-string', numErr.ok === false);

// ============================================================
console.log('\n--- emptySectorRow ---');
// ============================================================

const fintech = getSectorBySlug('fintech')!;
const empty = emptySectorRow(fintech);

check('empty row : slug', empty.slug, 'fintech');
check('empty row : freshness perimee', empty.freshness, 'perimee');
check('empty row : age_days null', empty.age_days, null);
check('empty row : data_missing_count = 8', empty.data_missing_count, DIMENSION_KEYS.length);
check('empty row : total_sources_cited = 0', empty.total_sources_cited, 0);
check('empty row : tous les scores null', Object.values(empty.scores).every((v) => v === null), true);

// ============================================================
console.log('\n--- briefToSectorRow ---');
// ============================================================

const fresh = makeBrief({
  generated_at: new Date(NOW.getTime() - 5 * MS_PER_DAY).toISOString(),
});
const freshRow = briefToSectorRow(fintech, fresh, NOW);
check('brief frais : freshness a_jour', freshRow.freshness, 'a_jour');
check('brief frais : age_days 5', freshRow.age_days, 5);
check('brief frais : sources comptees correctement (8 dims x 2 sources)', freshRow.total_sources_cited, 16);
check('brief frais : aucun data_missing', freshRow.data_missing_count, 0);
check('brief frais : cost_usd remonte', freshRow.cost_usd, 0.42);

const old = makeBrief({
  generated_at: new Date(NOW.getTime() - 200 * MS_PER_DAY).toISOString(),
});
const oldRow = briefToSectorRow(fintech, old, NOW);
check('brief ancien : freshness perimee', oldRow.freshness, 'perimee');

const partialDims = makeFullDimensions();
partialDims.intensite_capitalistique = makeDimension(null, 0, true);
partialDims.cyclicite_macroeconomique = makeDimension(null, 0, true);
const partial = makeBrief({ dimensions: partialDims });
const partialRow = briefToSectorRow(fintech, partial, NOW);
check('brief partiel : data_missing_count 2', partialRow.data_missing_count, 2);
check(
  'brief partiel : sources hors dimensions data_missing (6 x 2 = 12)',
  partialRow.total_sources_cited,
  12,
);
check('brief partiel : score absent pour intensite', partialRow.scores.intensite_capitalistique, null);
check('brief partiel : score present pour pression', partialRow.scores.pression_reglementaire, 50);

// ============================================================
console.log('\n--- countSourcesInDimensions ---');
// ============================================================

check('countSources : null', countSourcesInDimensions(null), 0);
check('countSources : empty', countSourcesInDimensions({}), 0);
check(
  'countSources : trois dimensions, sources variees',
  countSourcesInDimensions({
    a: { sources_cited: [1, 2, 3] },
    b: { sources_cited: [] },
    c: { sources_cited: [1] },
  }),
  4,
);
check(
  'countSources : sources non-array ignorees',
  countSourcesInDimensions({
    a: { sources_cited: 'not-an-array' },
    b: { sources_cited: [1, 2] },
  }),
  2,
);

// ============================================================
console.log('\n--- mergeDimensionIntoNewBrief ---');
// ============================================================

const previous = makeBrief({ id: 'previous-id-123' });
const newDimension: SectoralDimension = {
  score: 88,
  definition_applied: 'Nouvelle definition appliquee.',
  sources_cited: [
    { url: 'https://new.org/1', title: 'Nouvelle source', accessed_at: '2026-05-13T10:00:00Z' },
  ],
  confidence: 'high',
  data_missing: false,
  notes: 'Notes regeneres.',
};

const fixedNow = new Date('2026-05-13T12:00:00Z');
const merged = mergeDimensionIntoNewBrief({
  previous,
  dimension: 'pression_reglementaire',
  regenerated: newDimension,
  cost_usd: 0.05,
  duration_ms: 4500,
  generatedAt: fixedNow,
});

check('merge : sector_slug copie', merged.sector_slug, previous.sector_slug);
check('merge : generated_at = passe en parametre', merged.generated_at, fixedNow.toISOString());
check('merge : trigger = manual', merged.regeneration_trigger, 'manual');
check('merge : supersedes_id = previous.id', merged.supersedes_id, 'previous-id-123');
check('merge : narrative_summary copie depuis previous', merged.narrative_summary, previous.narrative_summary);
check(
  'merge : pression_reglementaire remplacee par la nouvelle',
  merged.dimensions.pression_reglementaire.score,
  88,
);
check(
  'merge : autres dimensions inchangees (intensite copiee)',
  merged.dimensions.intensite_capitalistique.score,
  previous.dimensions.intensite_capitalistique.score,
);
check(
  'merge : autres dimensions inchangees (cyclicite copiee)',
  merged.dimensions.cyclicite_macroeconomique.score,
  previous.dimensions.cyclicite_macroeconomique.score,
);
check(
  'merge : metadata.dimensions_regenerated = [pression]',
  JSON.stringify(merged.generation_metadata.dimensions_regenerated),
  JSON.stringify(['pression_reglementaire']),
);
check('merge : metadata.cost_usd = cout du re-appel uniquement', merged.generation_metadata.cost_usd, 0.05);
check('merge : metadata.duration_ms = duree du re-appel uniquement', merged.generation_metadata.duration_ms, 4500);
check(
  'merge : prompt_version conservee depuis previous',
  merged.generation_metadata.prompt_version,
  previous.generation_metadata.prompt_version,
);

// Cas previous sans id (premiere fiche jamais persistee, edge case)
const previousNoId = makeBrief({ id: undefined });
const mergedNoId = mergeDimensionIntoNewBrief({
  previous: previousNoId,
  dimension: 'velocite_technologique',
  regenerated: newDimension,
  cost_usd: 0.01,
  duration_ms: 1000,
});
check('merge : supersedes_id null si previous sans id', mergedNoId.supersedes_id, null);

// ============================================================
console.log('\n--- formatAge ---');
// ============================================================

check('formatAge null', formatAge(null), '');
check('formatAge 0', formatAge(0), "il y a moins d'un jour");
check('formatAge 1', formatAge(1), 'il y a 1 jour');
check('formatAge 5', formatAge(5), 'il y a 5 jours');
check('formatAge 29', formatAge(29), 'il y a 29 jours');
check('formatAge 30 = environ 1 mois', formatAge(30), 'il y a environ 1 mois');
check('formatAge 60 = environ 2 mois', formatAge(60), 'il y a environ 2 mois');
check('formatAge 180 = environ 6 mois', formatAge(180), 'il y a environ 6 mois');

// ============================================================
console.log('\n--- formatCost ---');
// ============================================================

check('formatCost null', formatCost(null), '');
check('formatCost 0', formatCost(0), '0 $');
check('formatCost 0.005', formatCost(0.005), '< 0,01 $');
check('formatCost 0.42', formatCost(0.42), '0.42 $');
check('formatCost 12.5', formatCost(12.5), '12.50 $');

// ============================================================
console.log('\n--- formatDuration ---');
// ============================================================

check('formatDuration null', formatDuration(null), '');
check('formatDuration 500ms', formatDuration(500), '500 ms');
check('formatDuration 1000ms', formatDuration(1000), '1 s');
check('formatDuration 45s', formatDuration(45000), '45 s');
check('formatDuration 75s = 1min 15s', formatDuration(75000), '1 min 15 s');
check('formatDuration 130s = 2min 10s', formatDuration(130000), '2 min 10 s');

// ============================================================
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
