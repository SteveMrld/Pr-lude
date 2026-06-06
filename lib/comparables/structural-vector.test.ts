// ============================================================
// Tests deterministes : moteur de comparables structurel universel
// ------------------------------------------------------------
// Verifie que la spine structurelle produit un voisinage pertinent
// pour quatre natures economiques distinctes : industrial hardware
// maritime (Platypus), SaaS recurrent, marketplace, deeptech. Pour
// chaque cas, on injecte un corpus synthetique qui melange
// comparables pertinents et bruit (mobilite delivery, voitures en
// ligne, cas longitudinaux), et on verifie que le moteur :
//   1. exclut le bruit du top 5 par hard gate ou plancher,
//   2. fait emerger le voisinage pertinent sans regle dediee,
//   3. dedoublonne et ne laisse pas un meme cas dans deux blocs,
//   4. justifie chaque match par les axes structurels.
//
// Les noms (SeaBubbles, NepTech, SeaGlider, SeaOwl, Take Eat Easy,
// Delivery Hero, Just Eat, Cazoo, Alice & Bob, Stripe, OpenAI,
// Mistral, Northvolt, etc.) n apparaissent que dans cette suite,
// jamais dans le code de production.
//
//   npx tsx lib/comparables/structural-vector.test.ts
// ============================================================

import {
  MATCHING_CONFIG,
  inferStructuralVectorFromRow,
  scoreMatch,
  type StructuralVector,
  type FundingBand,
} from './structural-vector';
import {
  buildFeaturesFromVector,
  findComparablesFromCorpus,
} from './scorer';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL : ${label}`);
  }
}

// ============================================================
// Helpers de construction de vecteurs
// ============================================================
function vector(overrides: Partial<StructuralVector>): StructuralVector {
  return {
    economicNature: 'unknown',
    revenueModel: 'unknown',
    capitalIntensity: 'unknown',
    salesCycle: 'unknown',
    regulatoryExposure: 'unknown',
    reproducibility: 'unknown',
    marketDimensions: [],
    fundingBand: 'unknown',
    ...overrides,
  };
}

// ============================================================
// 1. PLATYPUS - hardware industriel maritime passagers
// ============================================================
console.log('\n=== Cas 1 : Platypus - hardware industriel maritime ===');

const platypusVector: StructuralVector = {
  economicNature: 'industrial_hardware',
  revenueModel: 'unit_sale',
  capitalIntensity: 'high',
  salesCycle: 'long',
  regulatoryExposure: 'high',
  reproducibility: 'asset_heavy',
  marketDimensions: ['passenger', 'maritime', 'eco_tourism', 'consumer'],
  fundingBand: 'series_a',
};

const platypusFeatures = buildFeaturesFromVector(platypusVector, {
  sector: 'Nautique',
  subSector: 'Semi-submersible bi-place',
  country: 'France',
});

// Corpus synthetique : melange voisinage pertinent et bruit
const platypusCorpus = [
  // --- VOISINAGE PERTINENT (hardware industriel maritime passagers) ---
  {
    id: 'r1', name: 'SeaBubbles', country: 'France',
    sector: 'Mobility', sub_sector: 'Electric watercraft',
    asset_class: 'hardware_industrial', capital_intensity: 'High',
    vertical_v4: 'Maritime passenger transport',
    funding_band: 'series_a', outcome: 'volatile_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  {
    id: 'r2', name: 'NepTech', country: 'France',
    sector: 'Nautique', sub_sector: 'Hybrid passenger boat',
    asset_class: 'hardware_industrial', capital_intensity: 'High',
    vertical_v4: 'Maritime passenger leisure',
    funding_band: 'seed', outcome: 'active',
    data_quality: 'Medium', vc_relevance_score: 4,
  },
  {
    id: 'r3', name: 'SeaGlider Regent', country: 'US',
    sector: 'Aerospace', sub_sector: 'Maritime hydrofoil passenger',
    asset_class: 'hardware_industrial', capital_intensity: 'High',
    vertical_v4: 'Maritime passenger transport',
    funding_band: 'series_b', outcome: 'active',
    data_quality: 'High', vc_relevance_score: 5,
  },
  {
    id: 'r4', name: 'SeaOwl', country: 'France',
    sector: 'Maritime services', sub_sector: 'Naval offshore',
    asset_class: 'hardware_industrial', capital_intensity: 'High',
    vertical_v4: 'Maritime professional offshore',
    funding_band: 'series_a', outcome: 'success_private',
    data_quality: 'Medium', vc_relevance_score: 3,
  },
  // --- BRUIT QUI DOIT SORTIR DU TOP : food delivery (mobility tag bias) ---
  {
    id: 'b1', name: 'Take Eat Easy', country: 'Belgium',
    sector: 'Mobility', sub_sector: 'Food delivery',
    asset_class: 'software_pure', capital_intensity: 'Low',
    vertical_v4: 'Food delivery marketplace',
    funding_band: 'series_a', outcome: 'fail',
    data_quality: 'High', vc_relevance_score: 4,
  },
  {
    id: 'b2', name: 'Delivery Hero', country: 'Germany',
    sector: 'Mobility', sub_sector: 'Food delivery',
    asset_class: 'software_pure', capital_intensity: 'Medium',
    vertical_v4: 'Food delivery aggregator',
    funding_band: 'late_ipo', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  {
    id: 'b3', name: 'Just Eat', country: 'UK',
    sector: 'Mobility', sub_sector: 'Food delivery',
    asset_class: 'software_pure', capital_intensity: 'Medium',
    vertical_v4: 'Food delivery aggregator',
    funding_band: 'late_ipo', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  // --- BRUIT : vente de voitures en ligne ---
  {
    id: 'b4', name: 'Cazoo', country: 'UK',
    sector: 'Mobility', sub_sector: 'Online car sales',
    asset_class: 'software_pure', capital_intensity: 'Medium',
    vertical_v4: 'Automotive e-commerce',
    funding_band: 'late_ipo', outcome: 'fail',
    data_quality: 'High', vc_relevance_score: 4,
  },
  // --- BRUIT : quantique (deep tech, doublon volontaire pour test dedup) ---
  {
    id: 'b5', name: 'Alice & Bob', country: 'France',
    sector: 'Quantum', sub_sector: 'Quantum computing',
    asset_class: 'deep_tech_research', capital_intensity: 'High',
    vertical_v4: 'Quantum hardware',
    funding_band: 'series_a', outcome: 'active',
    data_quality: 'High', vc_relevance_score: 5,
  },
  {
    id: 'b5b', name: 'Alice & Bob SAS', country: 'France',
    sector: 'Quantum', sub_sector: 'Quantum computing',
    asset_class: 'deep_tech_research', capital_intensity: 'High',
    vertical_v4: 'Quantum hardware',
    funding_band: 'series_a', outcome: 'active',
    data_quality: 'High', vc_relevance_score: 5,
  },
  // --- BRUIT : SaaS B2B generique ---
  {
    id: 'b6', name: 'OVHcloud', country: 'France',
    sector: 'SaaS', sub_sector: 'Cloud infrastructure',
    asset_class: 'software_pure', capital_intensity: 'Medium',
    vertical_v4: 'Cloud B2B',
    funding_band: 'late_ipo', outcome: 'success',
    data_quality: 'High', vc_relevance_score: 4,
  },
];

const platypusResult = findComparablesFromCorpus(platypusFeatures, platypusCorpus, 5);

check(
  'Platypus : food delivery exclu du top 5 (Take Eat Easy)',
  !platypusResult.topComparables.some((c) => c.name === 'Take Eat Easy'),
);
check(
  'Platypus : food delivery exclu du top 5 (Delivery Hero)',
  !platypusResult.topComparables.some((c) => c.name === 'Delivery Hero'),
);
check(
  'Platypus : food delivery exclu du top 5 (Just Eat)',
  !platypusResult.topComparables.some((c) => c.name === 'Just Eat'),
);
check(
  'Platypus : vente de voitures en ligne exclue (Cazoo)',
  !platypusResult.topComparables.some((c) => c.name === 'Cazoo'),
);
check(
  'Platypus : SaaS cloud exclu (OVHcloud)',
  !platypusResult.topComparables.some((c) => c.name === 'OVHcloud'),
);
check(
  'Platypus : quantum hors top 5 (Alice & Bob)',
  !platypusResult.topComparables.some((c) => c.name.toLowerCase().includes('alice')),
);

// Voisinage attendu : au moins deux des quatre cas maritimes sortent
const platypusNames = platypusResult.topComparables.map((c) => c.name);
const maritimeFound = ['SeaBubbles', 'NepTech', 'SeaGlider Regent', 'SeaOwl']
  .filter((n) => platypusNames.includes(n)).length;
check(
  `Platypus : voisinage maritime emerge spontanement (≥2 sur 4, observe ${maritimeFound})`,
  maritimeFound >= 2,
);

// Dedup : meme apres Alice & Bob doublon, le top ne contient pas deux
// fois la meme entite canonique
const platypusCanonical = new Set(
  platypusResult.topComparables.map((c) => c.name.toLowerCase().replace(/\s+sas$/, '')),
);
check(
  'Platypus : dedup canonique (pas deux variantes Alice & Bob)',
  platypusCanonical.size === platypusResult.topComparables.length,
);

// Pas de comparable au seul motif d un tag commun (mobility)
const mobilityOnly = platypusResult.topComparables.filter((c) =>
  ['Take Eat Easy', 'Delivery Hero', 'Just Eat', 'Cazoo'].includes(c.name)
);
check(
  'Platypus : aucun comparable retenu sur le seul tag mobility',
  mobilityOnly.length === 0,
);

// Auto-explication : chaque match retient au moins un axe structurel
const allExplained = platypusResult.topComparables.every(
  (c) => c.matchExplanation.matchedAxes.length > 0,
);
check(
  'Platypus : chaque match justifie par au moins un axe structurel',
  allExplained,
);

// Cross-block dedup : pas de doublon entre stage_aligned et longitudinal
const stageNamesPlatypus = new Set(platypusResult.topComparables.map((c) => c.name));
const crossPlatypus = platypusResult.topComparablesLongitudinal.filter(
  (c) => stageNamesPlatypus.has(c.name),
);
check(
  'Platypus : pas de doublon entre top scoring et longitudinal',
  crossPlatypus.length === 0,
);

console.log(`Top Platypus : ${platypusNames.join(', ')}`);
console.log(`Longitudinal : ${platypusResult.topComparablesLongitudinal.map((c) => c.name).join(', ') || '(vide)'}`);

// ============================================================
// 2. SaaS B2B recurrent - voisinage SaaS, exclure hardware
// ============================================================
console.log('\n=== Cas 2 : SaaS B2B recurrent ===');

const saasVector: StructuralVector = {
  economicNature: 'software_pure',
  revenueModel: 'subscription',
  capitalIntensity: 'low',
  salesCycle: 'long',
  regulatoryExposure: 'low',
  reproducibility: 'asset_light',
  marketDimensions: ['professional'],
  fundingBand: 'series_b',
};

const saasFeatures = buildFeaturesFromVector(saasVector, {
  sector: 'SaaS', subSector: 'Workflow automation B2B', country: 'France',
});

const saasCorpus = [
  // Voisinage attendu
  {
    id: 's1', name: 'Aircall', country: 'France',
    sector: 'SaaS', sub_sector: 'Communications B2B',
    asset_class: 'software_pure', capital_intensity: 'Low',
    funding_band: 'series_c_plus', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  {
    id: 's2', name: 'PayFit', country: 'France',
    sector: 'SaaS', sub_sector: 'Payroll B2B',
    asset_class: 'software_pure', capital_intensity: 'Low',
    funding_band: 'series_b', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  {
    id: 's3', name: 'Spendesk', country: 'France',
    sector: 'SaaS', sub_sector: 'Finance automation B2B',
    asset_class: 'software_pure', capital_intensity: 'Low',
    funding_band: 'series_c_plus', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 5,
  },
  // Bruit : hardware industriel maritime (ne doit pas matcher)
  {
    id: 'sn1', name: 'SeaBubbles', country: 'France',
    sector: 'Mobility', sub_sector: 'Electric watercraft',
    asset_class: 'hardware_industrial', capital_intensity: 'High',
    funding_band: 'series_a', outcome: 'volatile_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  // Bruit : marketplace food
  {
    id: 'sn2', name: 'Just Eat', country: 'UK',
    sector: 'Mobility', sub_sector: 'Food delivery',
    asset_class: 'software_pure', capital_intensity: 'Medium',
    vertical_v4: 'Food delivery aggregator',
    funding_band: 'late_ipo', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  // Bruit : deeptech quantum
  {
    id: 'sn3', name: 'Pasqal', country: 'France',
    sector: 'Quantum', sub_sector: 'Quantum computing',
    asset_class: 'deep_tech_research', capital_intensity: 'High',
    funding_band: 'series_b', outcome: 'active',
    data_quality: 'High', vc_relevance_score: 5,
  },
];

const saasResult = findComparablesFromCorpus(saasFeatures, saasCorpus, 5);
const saasNames = saasResult.topComparables.map((c) => c.name);

check(
  'SaaS : hardware maritime exclu (SeaBubbles)',
  !saasNames.includes('SeaBubbles'),
);
check(
  'SaaS : marketplace food exclu (Just Eat)',
  !saasNames.includes('Just Eat'),
);
check(
  'SaaS : deeptech quantique exclu (Pasqal)',
  !saasNames.includes('Pasqal'),
);
check(
  'SaaS : voisinage SaaS B2B emerge (≥2 sur 3)',
  ['Aircall', 'PayFit', 'Spendesk'].filter((n) => saasNames.includes(n)).length >= 2,
);
console.log(`Top SaaS : ${saasNames.join(', ')}`);

// ============================================================
// 3. Marketplace - voisinage marketplace, exclure SaaS et hardware
// ============================================================
console.log('\n=== Cas 3 : Marketplace consumer ===');

const marketplaceVector: StructuralVector = {
  economicNature: 'marketplace',
  revenueModel: 'commission',
  capitalIntensity: 'low',
  salesCycle: 'short',
  regulatoryExposure: 'low',
  reproducibility: 'asset_light',
  marketDimensions: ['consumer'],
  fundingBand: 'series_b',
};

const marketplaceFeatures = buildFeaturesFromVector(marketplaceVector, {
  sector: 'Marketplace', subSector: 'C2C consumer goods', country: 'France',
});

const marketplaceCorpus = [
  // Voisinage attendu : marketplaces
  {
    id: 'm1', name: 'Vinted', country: 'Lithuania',
    sector: 'Marketplace', sub_sector: 'C2C fashion',
    asset_class: 'software_pure', capital_intensity: 'Low',
    vertical_v4: 'Marketplace C2C fashion',
    funding_band: 'series_c_plus', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 5,
  },
  {
    id: 'm2', name: 'ManoMano', country: 'France',
    sector: 'Marketplace', sub_sector: 'B2C DIY',
    asset_class: 'software_pure', capital_intensity: 'Low',
    vertical_v4: 'Marketplace B2C DIY',
    funding_band: 'series_c_plus', outcome: 'volatile_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  // Bruit : SaaS pur (meme economic_nature parente mais pas marketplace)
  {
    id: 'mn1', name: 'PayFit', country: 'France',
    sector: 'SaaS', sub_sector: 'Payroll B2B',
    asset_class: 'software_pure', capital_intensity: 'Low',
    funding_band: 'series_b', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  // Bruit : hardware
  {
    id: 'mn2', name: 'Northvolt', country: 'Sweden',
    sector: 'Battery manufacturing', sub_sector: 'Battery cells',
    asset_class: 'infrastructure_physical', capital_intensity: 'Very High',
    funding_band: 'late_ipo', outcome: 'fail',
    data_quality: 'High', vc_relevance_score: 5,
  },
];

const marketplaceResult = findComparablesFromCorpus(marketplaceFeatures, marketplaceCorpus, 5);
const marketplaceNames = marketplaceResult.topComparables.map((c) => c.name);

check(
  'Marketplace : SaaS pur exclu (PayFit)',
  !marketplaceNames.includes('PayFit'),
);
check(
  'Marketplace : hardware infra exclu (Northvolt)',
  !marketplaceNames.includes('Northvolt'),
);
check(
  'Marketplace : voisinage marketplace emerge',
  ['Vinted', 'ManoMano'].some((n) => marketplaceNames.includes(n)),
);
console.log(`Top Marketplace : ${marketplaceNames.join(', ')}`);

// ============================================================
// 4. Deeptech quantique - voisinage deeptech, exclure SaaS et marketplace
// ============================================================
console.log('\n=== Cas 4 : Deeptech quantique ===');

const deeptechVector: StructuralVector = {
  economicNature: 'deeptech',
  revenueModel: 'mixed',
  capitalIntensity: 'very_high',
  salesCycle: 'long',
  regulatoryExposure: 'medium',
  reproducibility: 'asset_heavy',
  marketDimensions: ['professional'],
  fundingBand: 'series_b',
};

const deeptechFeatures = buildFeaturesFromVector(deeptechVector, {
  sector: 'Quantum', subSector: 'Quantum computing hardware', country: 'France',
});

const deeptechCorpus = [
  // Voisinage attendu : quantique
  {
    id: 'd1', name: 'Pasqal', country: 'France',
    sector: 'Quantum', sub_sector: 'Quantum computing',
    asset_class: 'deep_tech_research', capital_intensity: 'High',
    funding_band: 'series_b', outcome: 'active',
    data_quality: 'High', vc_relevance_score: 5,
  },
  {
    id: 'd2', name: 'IQM', country: 'Finland',
    sector: 'Quantum', sub_sector: 'Quantum computing',
    asset_class: 'deep_tech_research', capital_intensity: 'High',
    funding_band: 'series_b', outcome: 'active',
    data_quality: 'High', vc_relevance_score: 5,
  },
  // Bruit : SaaS (ne doit pas matcher quoique fundingBand identique)
  {
    id: 'dn1', name: 'PayFit', country: 'France',
    sector: 'SaaS', sub_sector: 'Payroll B2B',
    asset_class: 'software_pure', capital_intensity: 'Low',
    funding_band: 'series_b', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 4,
  },
  // Bruit : marketplace
  {
    id: 'dn2', name: 'Vinted', country: 'Lithuania',
    sector: 'Marketplace', sub_sector: 'C2C fashion',
    asset_class: 'software_pure', capital_intensity: 'Low',
    vertical_v4: 'Marketplace C2C fashion',
    funding_band: 'series_c_plus', outcome: 'success_private',
    data_quality: 'High', vc_relevance_score: 5,
  },
];

const deeptechResult = findComparablesFromCorpus(deeptechFeatures, deeptechCorpus, 5);
const deeptechNames = deeptechResult.topComparables.map((c) => c.name);

check(
  'Deeptech : SaaS exclu malgre meme funding_band (PayFit)',
  !deeptechNames.includes('PayFit'),
);
check(
  'Deeptech : marketplace exclu (Vinted)',
  !deeptechNames.includes('Vinted'),
);
check(
  'Deeptech : voisinage quantique emerge',
  ['Pasqal', 'IQM'].some((n) => deeptechNames.includes(n)),
);
console.log(`Top Deeptech : ${deeptechNames.join(', ')}`);

// ============================================================
// 5. Invariants generaux du moteur
// ============================================================
console.log('\n=== Invariants generaux ===');

// Hard gate : un industrial_hardware vs software_pure doit etre rejected
{
  const a = vector({ economicNature: 'industrial_hardware', revenueModel: 'unit_sale',
    capitalIntensity: 'high', reproducibility: 'asset_heavy', fundingBand: 'series_a' });
  const b = vector({ economicNature: 'software_pure', revenueModel: 'subscription',
    capitalIntensity: 'low', reproducibility: 'asset_light', fundingBand: 'series_a' });
  const expl = scoreMatch(a, b);
  check(
    'Invariant : industrial_hardware vs software_pure rejete par hard gate',
    expl.matchTier === 'rejected' && expl.similarity === 0,
  );
}

// Hard gate : meme nature mais axes structurels divergents -> pertinence faible
{
  const a = vector({ economicNature: 'software_pure', revenueModel: 'subscription',
    capitalIntensity: 'low', reproducibility: 'asset_light', salesCycle: 'long',
    fundingBand: 'series_a' });
  const b = vector({ economicNature: 'software_pure', revenueModel: 'commission',
    capitalIntensity: 'medium', reproducibility: 'asset_light', salesCycle: 'short',
    fundingBand: 'late_ipo' });
  const expl = scoreMatch(a, b);
  check(
    'Invariant : meme nature mais axes divergents -> similarity sous plancher',
    expl.similarity < MATCHING_CONFIG.floor,
  );
}

// Funding band : meme nature + axes alignes mais bande lointaine -> longitudinal
{
  const a = vector({ economicNature: 'software_pure', revenueModel: 'subscription',
    capitalIntensity: 'low', reproducibility: 'asset_light', salesCycle: 'long',
    regulatoryExposure: 'low', marketDimensions: ['professional'],
    fundingBand: 'seed' });
  const b = vector({ economicNature: 'software_pure', revenueModel: 'subscription',
    capitalIntensity: 'low', reproducibility: 'asset_light', salesCycle: 'long',
    regulatoryExposure: 'low', marketDimensions: ['professional'],
    fundingBand: 'late_ipo' });
  const expl = scoreMatch(a, b);
  check(
    'Invariant : meme nature, bande tres eloignee -> tier structural_pattern',
    expl.matchTier === 'structural_pattern',
  );
}

// MarketDimensions : passenger vs freight ne fusionnent pas
{
  const a = vector({ economicNature: 'industrial_hardware', revenueModel: 'unit_sale',
    capitalIntensity: 'high', reproducibility: 'asset_heavy', salesCycle: 'long',
    regulatoryExposure: 'high', marketDimensions: ['passenger', 'maritime'],
    fundingBand: 'series_a' });
  const b = vector({ economicNature: 'industrial_hardware', revenueModel: 'unit_sale',
    capitalIntensity: 'high', reproducibility: 'asset_heavy', salesCycle: 'long',
    regulatoryExposure: 'high', marketDimensions: ['freight', 'maritime'],
    fundingBand: 'series_a' });
  const exp = scoreMatch(a, b);
  // Inter = {maritime} sur union {passenger, freight, maritime} = 1/3.
  // Pas de fusion automatique passenger ~ freight.
  check(
    'Invariant : passenger et freight ne fusionnent pas',
    exp.matchedAxes.some((l) => l.includes('marketDimensions:[maritime]')),
  );
}

// Inferer un vecteur depuis une row : food delivery -> marketplace
{
  const v = inferStructuralVectorFromRow({
    sector: 'Mobility', sub_sector: 'Food delivery',
    asset_class: 'software_pure',
    vertical_v4: 'Food delivery aggregator',
  });
  check(
    'Inferer : food delivery row classee marketplace (pas industrial_hardware)',
    v.economicNature === 'marketplace',
  );
}

// Inferer : sans asset_class, secteur 'naval' -> industrial_hardware
{
  const v = inferStructuralVectorFromRow({
    sector: 'Naval maritime', sub_sector: 'Boat manufacturing',
  });
  check(
    'Inferer : naval sans asset_class classe industrial_hardware',
    v.economicNature === 'industrial_hardware',
  );
}

// Hard gate symetrique
{
  const a = vector({ economicNature: 'marketplace' });
  const b = vector({ economicNature: 'industrial_hardware' });
  const exp1 = scoreMatch(a, b);
  const exp2 = scoreMatch(b, a);
  check(
    'Invariant : hard gate symetrique',
    exp1.matchTier === 'rejected' && exp2.matchTier === 'rejected',
  );
}

console.log(`\n=== structural-vector ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
