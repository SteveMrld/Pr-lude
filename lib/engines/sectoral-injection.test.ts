// ============================================================
// Tests deterministes de la couche d injection sectorielle
// ------------------------------------------------------------
// Couvre le mapping libre -> slug catalogue, le calcul de
// fraicheur (fresh / stale / expired), la resolution complete
// avec fetcher mockable, les quatre cas limites doctrinaux
// (multi-secteur, secteur non couvert, fiche obsolete >9 mois,
// fiche perimee >12 mois), et le rendu du bloc inject pour
// chacun des six moteurs sectoriels.
//
// Aucun appel reseau, aucune dependance Supabase : tous les
// fetchers passent par l option fetchBrief injectee.
//
// Execution : tsx lib/engines/sectoral-injection.test.ts
// ============================================================

import {
  detectSectorSlugs,
  computeFreshness,
  resolveSectoralContext,
  buildSectoralPromptBlock,
  STALE_THRESHOLD_DAYS,
  EXPIRED_THRESHOLD_DAYS,
  ENGINE_DIMENSION_MAP,
  type SectoralContext,
} from './sectoral-injection';
import type { ExtractionOutput } from './types';
import type {
  SectoralBrief,
  SectoralBriefDimensions,
  DimensionKey,
} from './sectoral-intelligence/types';
import { DIMENSION_KEYS } from './sectoral-intelligence/types';

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

function makeExtraction(overrides: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'Acme',
    sector: '',
    subSector: '',
    geographicHub: 'Paris',
    country: 'France',
    yearFounded: 2022,
    founders: [],
    marketPitch: '',
    productDescription: '',
    businessModel: '',
    traction: { metrics: [] },
    fundraise: { stage: 'Series A', amount: '10M' },
    competitorsCited: [],
    ...overrides,
  } as ExtractionOutput;
}

function makeDimension(score: number | null, opts: Partial<SectoralBriefDimensions[DimensionKey]> = {}) {
  return {
    score,
    definition_applied: 'Definition appliquee de test, sobre et auditable.',
    sources_cited: score === null ? [] : [
      { url: 'https://example.org/source', title: 'Source de test', accessed_at: '2026-05-01T12:00:00Z' },
    ],
    confidence: (score === null ? 'data_missing' : 'high') as any,
    data_missing: score === null,
    notes: score === null ? undefined : `Note editoriale calibree, score ${score}.`,
    ...opts,
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
    dims[key] = makeDimension(score) as any;
  }
  return {
    sector_slug: slug,
    generated_at: opts.generatedAt ?? '2026-04-01T12:00:00Z',
    dimensions: dims,
    narrative_summary: `Resume editorial sobre du secteur ${slug}, voix Le Grand Continent, pose le recit dominant du secteur au moment de l analyse.`,
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
// TEST 1 : mapping libre -> slug catalogue
// ============================================================

console.log('\n=== Test 1 : mapping secteur libre -> slug ===');

{
  // Cas fintech / insurtech : insurtech doit prendre la priorite si
  // present (ordre des matchers) mais retombe sur fintech via keyword.
  const fintech = detectSectorSlugs(makeExtraction({ sector: 'Fintech', subSector: 'Banking' }));
  checkTrue('fintech detecte', fintech.includes('fintech'));

  const insurtech = detectSectorSlugs(makeExtraction({ sector: 'Insurtech' }));
  checkTrue('insurtech detecte comme fintech', insurtech.includes('fintech'));

  // IA appliquee prioritaire sur SaaS quand IA en sous-secteur.
  const aiSaas = detectSectorSlugs(makeExtraction({
    sector: 'SaaS',
    subSector: 'IA generative B2B',
  }));
  checkTrue('IA detecte sur sous-secteur', aiSaas.includes('ia-appliquee'));

  // Cybersecurite-defense prioritaire sur industrie/hardware pour drone militaire.
  const defense = detectSectorSlugs(makeExtraction({
    sector: 'Defense',
    subSector: 'drone militaire',
  }));
  checkTrue('defense detecte sur defense + drone militaire', defense.includes('cybersecurite-defense'));

  // Sante.
  const sante = detectSectorSlugs(makeExtraction({ sector: 'Sante', subSector: 'biotech' }));
  checkTrue('sante-biotech detecte', sante.includes('sante-biotech'));

  // Climat-energie.
  const climat = detectSectorSlugs(makeExtraction({
    sector: 'Climate',
    subSector: 'hydrogen batterie',
  }));
  checkTrue('climat-energie detecte', climat.includes('climat-energie'));

  // Logiciel d entreprise horizontal en filet de secours.
  const saas = detectSectorSlugs(makeExtraction({ sector: 'SaaS B2B', subSector: 'CRM' }));
  checkTrue('logiciel-entreprise-horizontal detecte sur SaaS B2B CRM', saas.includes('logiciel-entreprise-horizontal'));

  // Secteur inconnu : aucun match doit etre retourne.
  const unknown = detectSectorSlugs(makeExtraction({
    sector: 'Neurotechnologie commerciale',
    subSector: 'BCI implants',
  }));
  check('secteur emergent non couvert -> tableau vide', unknown.length, 0);

  // Multi-secteur : fintech + proptech.
  const multi = detectSectorSlugs(makeExtraction({
    sector: 'Fintech',
    subSector: 'Proptech embedded finance',
  }));
  checkTrue('multi-secteur fintech detecte', multi.includes('fintech'));
  checkTrue('multi-secteur proptech detecte', multi.includes('proptech-construction'));
}

// ============================================================
// TEST 2 : computeFreshness
// ============================================================

console.log('\n=== Test 2 : computeFreshness ===');

{
  const now = new Date('2026-05-13T00:00:00Z');

  // Fiche generee il y a 30 jours : fresh.
  const fresh = computeFreshness('2026-04-13T00:00:00Z', now);
  check('fresh status', fresh.freshness, 'fresh');
  check('fresh age en jours', fresh.ageDays, 30);

  // Fiche generee il y a 280 jours : stale (>270 mais <360).
  const staleDate = new Date(now.getTime() - 280 * 24 * 60 * 60 * 1000).toISOString();
  const stale = computeFreshness(staleDate, now);
  check('stale status', stale.freshness, 'stale');

  // Fiche generee il y a 400 jours : expired.
  const expiredDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();
  const expired = computeFreshness(expiredDate, now);
  check('expired status', expired.freshness, 'expired');

  // Seuils doctrinaux explicites.
  check('STALE_THRESHOLD_DAYS = 270', STALE_THRESHOLD_DAYS, 270);
  check('EXPIRED_THRESHOLD_DAYS = 360', EXPIRED_THRESHOLD_DAYS, 360);
}

// ============================================================
// TEST 3 : resolveSectoralContext en mode applied
// ============================================================

(async () => {
  console.log('\n=== Test 3 : resolveSectoralContext mode applied ===');

  {
    const now = new Date('2026-05-13T00:00:00Z');
    const brief = makeBrief('fintech', { generatedAt: '2026-04-01T00:00:00Z' });
    const ctx = await resolveSectoralContext(
      makeExtraction({ sector: 'Fintech', subSector: 'paiement' }),
      {
        fetchBrief: async (slug) => (slug === 'fintech' ? brief : null),
        now,
      },
    );

    check('mode applied', ctx.mode, 'applied');
    checkTrue('primary present', ctx.primary !== null);
    check('primary slug', ctx.primary?.brief.sector_slug ?? '?', 'fintech');
    check('primary freshness', ctx.primary?.freshness ?? '?', 'fresh');
    check('aucun secondaire', ctx.secondaries.length, 0);
    checkTrue('methodologyNote pose la date', /2026-04-01/.test(ctx.methodologyNote));
  }

  // ============================================================
  // TEST 4 : multi-secteur, primary + secondaires
  // ============================================================

  console.log('\n=== Test 4 : multi-secteur (primary + secondaires) ===');

  {
    const now = new Date('2026-05-13T00:00:00Z');
    const fintechBrief = makeBrief('fintech', { generatedAt: '2026-04-01T00:00:00Z' });
    const proptechBrief = makeBrief('proptech-construction', { generatedAt: '2026-04-10T00:00:00Z' });

    const ctx = await resolveSectoralContext(
      makeExtraction({
        sector: 'Fintech',
        subSector: 'Proptech embedded finance',
      }),
      {
        fetchBrief: async (slug) => {
          if (slug === 'fintech') return fintechBrief;
          if (slug === 'proptech-construction') return proptechBrief;
          return null;
        },
        now,
      },
    );

    check('mode applied', ctx.mode, 'applied');
    check('primary slug fintech', ctx.primary?.brief.sector_slug ?? '?', 'fintech');
    check('1 secondaire', ctx.secondaries.length, 1);
    check('secondaire proptech', ctx.secondaries[0]?.brief.sector_slug ?? '?', 'proptech-construction');
    checkTrue('methodologyNote mentionne secondaires', /secondaire/.test(ctx.methodologyNote.toLowerCase()));
  }

  // ============================================================
  // TEST 5 : secteur emergent non couvert
  // ============================================================

  console.log('\n=== Test 5 : secteur non couvert ===');

  {
    const ctx = await resolveSectoralContext(
      makeExtraction({
        sector: 'Neurotechnologie commerciale',
        subSector: 'BCI implants',
      }),
      { fetchBrief: async () => null, now: new Date('2026-05-13T00:00:00Z') },
    );

    check('mode unknown_sector', ctx.mode, 'unknown_sector');
    check('primary null', ctx.primary, null);
    check('aucun slug detecte', ctx.detectedSlugs.length, 0);
    checkTrue(
      'methodologyNote explicite l absence',
      /secteur emergent|ne fait pas encore l objet/i.test(ctx.methodologyNote),
    );

    const block = buildSectoralPromptBlock(ctx, 'macro');
    check('aucun bloc inject en mode unknown', block, '');
  }

  // ============================================================
  // TEST 6 : fiche obsolete (stale, 9-12 mois) -> applied avec warning
  // ============================================================

  console.log('\n=== Test 6 : fiche obsolete (stale) ===');

  {
    const now = new Date('2026-05-13T00:00:00Z');
    // Genere 280 jours en arriere : stale.
    const staleDate = new Date(now.getTime() - 280 * 24 * 60 * 60 * 1000).toISOString();
    const brief = makeBrief('fintech', { generatedAt: staleDate });
    const ctx = await resolveSectoralContext(
      makeExtraction({ sector: 'Fintech' }),
      { fetchBrief: async (slug) => (slug === 'fintech' ? brief : null), now },
    );

    check('mode applied stale', ctx.mode, 'applied');
    check('primary freshness stale', ctx.primary?.freshness ?? '?', 'stale');
    checkTrue('methodologyNote mentionne neuf mois', /neuf mois/.test(ctx.methodologyNote));

    const block = buildSectoralPromptBlock(ctx, 'macro');
    checkTrue('bloc inject contient warning stale', /Avertissement.*neuf mois/.test(block));
  }

  // ============================================================
  // TEST 7 : fiche perimee (>12 mois) -> injection desactivee
  // ============================================================

  console.log('\n=== Test 7 : fiche perimee (>12 mois) ===');

  {
    const now = new Date('2026-05-13T00:00:00Z');
    const expiredDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const brief = makeBrief('fintech', { generatedAt: expiredDate });
    const ctx = await resolveSectoralContext(
      makeExtraction({ sector: 'Fintech' }),
      { fetchBrief: async (slug) => (slug === 'fintech' ? brief : null), now },
    );

    check('mode expired', ctx.mode, 'expired');
    check('primary null sur expired', ctx.primary, null);
    checkTrue(
      'methodologyNote mentionne le seuil 12 mois',
      /douze mois|12 mois/i.test(ctx.methodologyNote),
    );

    const block = buildSectoralPromptBlock(ctx, 'macro');
    check('aucun bloc inject en mode expired', block, '');
  }

  // ============================================================
  // TEST 8 : aucune fiche persistee pour le secteur (no_brief)
  // ============================================================

  console.log('\n=== Test 8 : pas de fiche persistee ===');

  {
    const ctx = await resolveSectoralContext(
      makeExtraction({ sector: 'Fintech' }),
      {
        fetchBrief: async () => null,
        now: new Date('2026-05-13T00:00:00Z'),
      },
    );

    check('mode no_brief', ctx.mode, 'no_brief');
    check('primary null', ctx.primary, null);
    checkTrue('detectedSlugs non vide', ctx.detectedSlugs.length > 0);
    checkTrue(
      'methodologyNote mentionne l absence de fiche',
      /aucune fiche|prochaine regeneration/i.test(ctx.methodologyNote),
    );
  }

  // ============================================================
  // TEST 9 : robustesse face a un fetchBrief qui throw
  // ============================================================

  console.log('\n=== Test 9 : fetchBrief throw sur primary ===');

  {
    const ctx = await resolveSectoralContext(
      makeExtraction({ sector: 'Fintech' }),
      {
        fetchBrief: async () => { throw new Error('supabase down'); },
        now: new Date('2026-05-13T00:00:00Z'),
      },
    );

    check('mode no_brief sur erreur primary', ctx.mode, 'no_brief');
  }

  // ============================================================
  // TEST 10 : mapping doctrinal dimensions par moteur
  // ============================================================

  console.log('\n=== Test 10 : mapping doctrinal ENGINE_DIMENSION_MAP ===');

  {
    check(
      'macro = cyclicite + geopolitique + reglementaire',
      ENGINE_DIMENSION_MAP.macro.join(','),
      'cyclicite_macroeconomique,exposition_geopolitique,pression_reglementaire',
    );
    check(
      'blindspot = concentration + velocite',
      ENGINE_DIMENSION_MAP.blindspot.join(','),
      'concentration_concurrentielle,velocite_technologique',
    );
    check(
      'contrarian = velocite + concentration + intensite',
      ENGINE_DIMENSION_MAP.contrarian.join(','),
      'velocite_technologique,concentration_concurrentielle,intensite_capitalistique',
    );
    check(
      'market = concentration',
      ENGINE_DIMENSION_MAP.market.join(','),
      'concentration_concurrentielle',
    );
    check(
      'fragility = intensite + cyclicite + tension capital-talent',
      ENGINE_DIMENSION_MAP['fragility-structurelle'].join(','),
      'intensite_capitalistique,cyclicite_macroeconomique,tension_capital_talent',
    );
    check(
      'narrative-drift = vulnerabilite narrative',
      ENGINE_DIMENSION_MAP['narrative-drift'].join(','),
      'vulnerabilite_narrative_sectorielle',
    );
  }

  // ============================================================
  // TEST 11 : buildSectoralPromptBlock par moteur, mode applied
  // ============================================================

  console.log('\n=== Test 11 : rendu du bloc par moteur ===');

  {
    const brief = makeBrief('ia-appliquee', {
      generatedAt: '2026-04-15T00:00:00Z',
      dimensions: {
        intensite_capitalistique: 70,
        cyclicite_macroeconomique: 65,
        tension_capital_talent: 80,
        velocite_technologique: 90,
        concentration_concurrentielle: 60,
        pression_reglementaire: 55,
        exposition_geopolitique: 50,
        vulnerabilite_narrative_sectorielle: 85,
      },
    });
    const ctx: SectoralContext = {
      mode: 'applied',
      cause: null,
      detectedSlugs: ['ia-appliquee'],
      primary: { slug: brief.sector_slug, brief, freshness: 'fresh', ageDays: 28 },
      secondaries: [],
      methodologyNote: 'Secteur primaire IA appliquee, fiche du 2026-04-15.',
    };

    // Macro doit injecter cyclicite, geopolitique, reglementaire.
    const macroBlock = buildSectoralPromptBlock(ctx, 'macro');
    checkTrue('macro mentionne Cyclicite', /Cyclicité/.test(macroBlock));
    checkTrue('macro mentionne Exposition geopolitique', /Exposition géopolitique/.test(macroBlock));
    checkTrue('macro mentionne Pression reglementaire', /Pression réglementaire/.test(macroBlock));
    checkTrue('macro ne mentionne pas Vulnerabilite narrative', !/Vulnérabilité narrative/.test(macroBlock));

    // Blindspot doit injecter concentration et velocite.
    const blindspotBlock = buildSectoralPromptBlock(ctx, 'blindspot');
    checkTrue('blindspot mentionne Concentration', /Concentration concurrentielle/.test(blindspotBlock));
    checkTrue('blindspot mentionne Velocite', /Vélocité technologique/.test(blindspotBlock));

    // Contrarian doit injecter velocite, concentration, intensite.
    const contrarianBlock = buildSectoralPromptBlock(ctx, 'contrarian');
    checkTrue('contrarian mentionne Intensite capitalistique', /Intensité capitalistique/.test(contrarianBlock));

    // Market doit injecter concentration + resume narratif commun.
    const marketBlock = buildSectoralPromptBlock(ctx, 'market');
    checkTrue('market mentionne Concentration', /Concentration concurrentielle/.test(marketBlock));
    checkTrue('market porte le resume editorial', /Resume editorial sectoriel/.test(marketBlock));

    // Fragility doit mentionner les patterns Phase 4 actives.
    const fragilityBlock = buildSectoralPromptBlock(ctx, 'fragility-structurelle');
    checkTrue('fragility mentionne Fixed Cost Trap (intensite 70)', /Fixed Cost Trap/.test(fragilityBlock));
    checkTrue('fragility mentionne Capital Structure Fragility (intensite+cyclicite hauts)', /Capital Structure Fragility/.test(fragilityBlock));
    checkTrue('fragility mentionne Execution Friction (tension 80)', /Execution Friction/.test(fragilityBlock));

    // Narrative drift doit injecter vulnerabilite narrative.
    const narrativeBlock = buildSectoralPromptBlock(ctx, 'narrative-drift');
    checkTrue('narrative-drift mentionne Vulnerabilite narrative', /Vulnérabilité narrative/.test(narrativeBlock));
    checkTrue('narrative-drift porte le resume editorial', /Resume editorial sectoriel/.test(narrativeBlock));
  }

  // ============================================================
  // TEST 12 : bloc inject avec dimension data_missing
  // ============================================================

  console.log('\n=== Test 12 : dimension data_missing rendue honnetement ===');

  {
    const brief = makeBrief('crypto-blockchain', {
      generatedAt: '2026-04-01T00:00:00Z',
      dimensions: {
        exposition_geopolitique: null, // data_missing
      },
    });
    const ctx: SectoralContext = {
      mode: 'applied',
      cause: null,
      detectedSlugs: ['crypto-blockchain'],
      primary: { slug: brief.sector_slug, brief, freshness: 'fresh', ageDays: 42 },
      secondaries: [],
      methodologyNote: '',
    };
    const block = buildSectoralPromptBlock(ctx, 'macro');
    checkTrue(
      'data_missing rendu comme donnee insuffisante',
      /donnee insuffisante/.test(block),
    );
  }

  // ============================================================
  // TEST 13 : encart secondaire injecte sous primary
  // ============================================================

  console.log('\n=== Test 13 : encart secondaires dans le bloc inject ===');

  {
    const primary = makeBrief('fintech', { generatedAt: '2026-04-01T00:00:00Z' });
    const secondary = makeBrief('proptech-construction', { generatedAt: '2026-04-15T00:00:00Z' });
    const ctx: SectoralContext = {
      mode: 'applied',
      cause: null,
      detectedSlugs: ['fintech', 'proptech-construction'],
      primary: { slug: primary.sector_slug, brief: primary, freshness: 'fresh', ageDays: 42 },
      secondaries: [{ slug: secondary.sector_slug, brief: secondary, freshness: 'fresh', ageDays: 28 }],
      methodologyNote: '',
    };
    const block = buildSectoralPromptBlock(ctx, 'macro');
    checkTrue('bloc mentionne Secteurs secondaires', /Secteurs secondaires/.test(block));
    checkTrue(
      'bloc mentionne le label proptech',
      /Proptech/.test(block),
    );
  }

  // ============================================================
  // TEST 14 : context null ou mode != applied ne produit aucun bloc
  // ============================================================

  console.log('\n=== Test 14 : context null/desactive -> bloc vide ===');

  {
    check('null context', buildSectoralPromptBlock(null, 'macro'), '');
    check('undefined context', buildSectoralPromptBlock(undefined, 'macro'), '');
    const unknownCtx: SectoralContext = {
      mode: 'unknown_sector',
      cause: 'absence',
      detectedSlugs: [],
      primary: null,
      secondaries: [],
      methodologyNote: '',
    };
    check('unknown_sector', buildSectoralPromptBlock(unknownCtx, 'macro'), '');
  }

  // ============================================================
  console.log('\n=== Test 15 : la classe d actif arbitre le secteur primaire ===');
  // ------------------------------------------------------------
  // Le defaut ferme : le secteur primaire etait decide par l ordre de
  // declaration de SLUG_MATCHERS, le premier matcher qui touche
  // gagnant quelle que soit la force du signal. Cas mesure en corpus,
  // dossier ecommerce-dtc de soins capillaires vendus en direct : le
  // subSector touche le mot-cle 'soins' de sante-biotech, declare en
  // quatrieme position, quand commerce-marketplaces est douzieme. Les
  // six moteurs sectoriels recevaient donc la fiche sante en primaire
  // et la fiche commerce en secondaire, sur un dossier que la matrice
  // de pertinence avait deja classe ecommerce-dtc.
  // ============================================================

  {
    const inHaircare = makeExtraction({
      sector: 'E-commerce',
      subSector: 'Soins capillaires / Beaute holistique pour cheveux textures',
      productDescription: 'Complements alimentaires en cures, soins topiques hydratants et fortifiants, routines beaute en packs.',
    });

    // Comportement historique, conserve quand aucune classe d actif
    // n arbitre : le balayage decide seul et se trompe de primaire.
    const sansArbitre = detectSectorSlugs(inHaircare);
    check('sans arbitre, le primaire reste sante-biotech', sansArbitre[0], 'sante-biotech');

    const avecArbitre = detectSectorSlugs(inHaircare, 'ecommerce-dtc');
    check('avec la classe d actif, le primaire devient commerce', avecArbitre[0], 'commerce-marketplaces');
    checkTrue(
      'le secteur sante subsiste en secondaire, il n est pas efface',
      avecArbitre.includes('sante-biotech'),
    );
    checkTrue('aucun doublon dans la liste', new Set(avecArbitre).size === avecArbitre.length);
    checkTrue('au plus trois secteurs', avecArbitre.length <= 3);
  }

  {
    // Une classe d actif qui ne designe aucun secteur du catalogue
    // laisse le balayage decider, comme avant. La table affirme ce
    // qu elle sait, pas plus.
    const dossier = makeExtraction({ sector: 'Sante', subSector: 'biotech' });
    check('unclassified ne force rien', detectSectorSlugs(dossier, 'unclassified')[0], 'sante-biotech');
    check('classe absente de la table ne force rien', detectSectorSlugs(dossier, 'profitable-mature')[0], 'sante-biotech');
    check('classe nulle ne force rien', detectSectorSlugs(dossier, null)[0], 'sante-biotech');
  }

  {
    // Le primaire impose s applique meme quand le balayage ne l aurait
    // jamais trouve : un dossier dont le vocabulaire ne touche aucun
    // mot-cle commerce mais que la matrice classe ecommerce-dtc.
    const muet = makeExtraction({
      sector: 'Beaute',
      subSector: 'Cosmetique solide',
      productDescription: 'Savons et shampoings solides fabriques en France.',
    });
    const slugs = detectSectorSlugs(muet, 'ecommerce-dtc');
    check('le primaire impose apparait meme sans hit de balayage', slugs[0], 'commerce-marketplaces');
  }

  {
    // Resolution complete : la fiche chargee est celle du secteur
    // arbitre, pas celle du premier matcher.
    const fetched: string[] = [];
    const ctx = await resolveSectoralContext(
      makeExtraction({
        sector: 'E-commerce',
        subSector: 'Soins capillaires',
        productDescription: 'Soins et complements pour cheveux textures.',
      }),
      {
        assetClass: 'ecommerce-dtc',
        now: new Date('2026-05-13T00:00:00Z'),
        fetchBrief: async (slug: string) => {
          fetched.push(slug);
          return makeBrief(slug, { generatedAt: '2026-04-01T00:00:00Z' });
        },
      },
    );
    check('mode applied', ctx.mode, 'applied');
    check('fiche primaire chargee sur le secteur arbitre', ctx.primary?.brief.sector_slug ?? '?', 'commerce-marketplaces');
    check('le premier fetch porte sur le secteur arbitre', fetched[0], 'commerce-marketplaces');

    // Le slug se lit en propre, sans deballer la fiche transportee.
    // Il rendait undefined avant que SectoralPrimary ne le porte.
    check('primary.slug est renseigne', ctx.primary?.slug ?? '?', 'commerce-marketplaces');
    checkTrue(
      'primary.slug ne peut pas diverger de la fiche chargee',
      ctx.primary?.slug === ctx.primary?.brief.sector_slug,
    );
    checkTrue(
      'chaque secondaire porte aussi son slug',
      ctx.secondaries.every((s) => s.slug === s.brief.sector_slug),
    );
    checkTrue(
      'la note methodologique nomme le secteur arbitre',
      /Commerce|commerce/.test(ctx.methodologyNote),
    );
    checkTrue(
      'sante reste en secondaire',
      ctx.secondaries.some((s) => s.brief.sector_slug === 'sante-biotech'),
    );
  }

  // ============================================================
  // FIN
  // ============================================================

  console.log(`\n${pass}/${pass + fail} tests passes`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur non rattrapee dans la suite de tests :', err);
  process.exit(1);
});
