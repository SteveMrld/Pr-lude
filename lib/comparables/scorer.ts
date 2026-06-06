// ============================================================
// COMPARABLES SCORER - LOGIQUE PURE
// ------------------------------------------------------------
// Module sans I/O ni 'server-only'. Contient le scoring d un
// candidat, la projection de trajectoire, la dedup cross-block.
// Sert de spine partagee entre la route API server-side
// (comparables-engine.ts) et les suites de tests deterministes.
//
// Aucune liste de societes, aucun keyword sectoriel : tout est
// derive du vecteur structurel calcule en amont.
// ============================================================

import { dedupByCanonicalName } from '../comparables-dedup';
import {
  MATCHING_CONFIG,
  inferStructuralVectorFromAnalysis,
  inferStructuralVectorFromRow,
  scoreMatch,
  type FundingBand,
  type MatchExplanation,
  type StructuralVector,
} from './structural-vector';

// ============================================================
// TYPES PARTAGES
// ============================================================

export interface ComparableFeatures {
  founder: number;
  market: number;
  traction: number;
  deal: number;
  defensibility: number;
  risk: number;
  sector: string | null;
  subSector?: string | null;
  country?: string | null;
  structuralVector: StructuralVector;
  assetClass?: string | null;
  fundingBand?: FundingBand | null;
  sectorSubgroup?: string | null;
}

export interface NarrativeSpecificity {
  tags: string[];
  requires: {
    asset_class?: string[];
    funding_band_min?: 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c_plus' | 'late_ipo';
    context?: string;
  };
}

export interface Comparable {
  id: string;
  name: string;
  country: string;
  sector: string;
  subSector: string | null;
  founded: number | null;
  outcome: string;
  exitType: string | null;
  region: string | null;
  euStatus: string | null;
  stateInfluenceTag: string | null;
  dataQuality: string | null;
  primarySourceUrl: string | null;
  analystNote: string | null;
  assetClass: string | null;
  vcRelevanceScore: number | null;
  capitalIntensity: string | null;
  verticalV4: string | null;
  source2: string | null;
  whatMadeItWork: string | null;
  keyRisksLessons: string | null;
  fundingBand: string | null;
  sectorSubgroup: string | null;
  totalRaisedAmount: number | null;
  totalRaisedCurrency: string | null;
  totalRaisedAsOf: string | null;
  narrativeSpecificity: NarrativeSpecificity | null;
  features: {
    founder: number;
    market: number;
    traction: number;
    deal: number;
    defensibility: number;
    risk: number;
  };
  hasFeatureScores: boolean;
  finalScore: number;
  signalsPositive: string | null;
  signalsNegative: string | null;
  similarity: number;
  sectorMatch: 'exact' | 'related' | 'different';
  matchTier: 'stage_aligned' | 'longitudinal';
  matchExplanation: MatchExplanation;
}

export interface TrajectoryScenario {
  label: string;
  probability: number;
  multipleRange: string;
  multipleMedian: number;
  exampleCase: Comparable | null;
  narrative: string;
}

export interface ComparablesResult {
  topComparables: Comparable[];
  topComparablesLongitudinal: Comparable[];
  outcomeDistribution: {
    success: number;
    medium: number;
    fail: number;
    active: number;
    total: number;
  };
  trajectory: {
    optimistic: TrajectoryScenario;
    median: TrajectoryScenario;
    downside: TrajectoryScenario;
    expectedMultiple: number;
    narrative: string;
  };
  dominantPattern: 'success-leaning' | 'fail-leaning' | 'mixed';
  closestSuccess: Comparable | null;
  closestFailure: Comparable | null;
  diligenceQuestions: string[];
  corpusInsufficient: boolean;
  floorUsed: number;
}

// ============================================================
// SCORING UTILS
// ============================================================

function applyQualityWeighting(baseSimilarity: number, row: any): number {
  const qualityWeight = row.data_quality === 'High' ? 1.0
    : row.data_quality === 'Medium' ? 0.95
    : row.data_quality === 'Low' ? 0.85
    : 0.9;
  const vcScore = typeof row.vc_relevance_score === 'number' ? row.vc_relevance_score : 3;
  const vcBoost = vcScore >= 5 ? 1.05
    : vcScore >= 4 ? 1.02
    : vcScore >= 3 ? 1.0
    : 0.93;
  return Math.max(0, Math.min(1, baseSimilarity * qualityWeight * vcBoost));
}

function mapMatchTier(
  tier: MatchExplanation['matchTier'],
): 'stage_aligned' | 'longitudinal' {
  return tier === 'sectoral_direct' ? 'stage_aligned' : 'longitudinal';
}

function deriveSectorMatch(
  target: StructuralVector,
  candidate: StructuralVector,
): 'exact' | 'related' | 'different' {
  if (target.economicNature === 'unknown' || candidate.economicNature === 'unknown') {
    return 'different';
  }
  if (target.economicNature !== candidate.economicNature) return 'different';
  const overlap = target.marketDimensions.filter(
    (d) => candidate.marketDimensions.includes(d),
  );
  return overlap.length > 0 ? 'exact' : 'related';
}

function buildComparableFromRow(
  row: any,
  expl: MatchExplanation,
  candidateVector: StructuralVector,
  targetVector: StructuralVector,
  similarity: number,
): Comparable {
  return {
    id: row.id || row.name,
    name: row.name,
    country: row.country || '',
    sector: row.sector || '',
    subSector: row.sub_sector || row.subsector || null,
    founded: row.founded || null,
    outcome: row.outcome || 'active',
    exitType: row.exit_type || null,
    region: row.region || null,
    euStatus: row.eu_status || null,
    stateInfluenceTag: row.state_influence_tag || null,
    dataQuality: row.data_quality || null,
    primarySourceUrl: row.primary_source_url || null,
    analystNote: row.analyst_note || null,
    assetClass: row.asset_class || null,
    vcRelevanceScore: row.vc_relevance_score ?? null,
    capitalIntensity: row.capital_intensity || null,
    verticalV4: row.vertical_v4 || null,
    source2: row.source_2 || null,
    whatMadeItWork: row.what_made_it_work || null,
    keyRisksLessons: row.key_risks_lessons || null,
    fundingBand: row.funding_band || null,
    sectorSubgroup: row.sector_subgroup || null,
    totalRaisedAmount: row.total_raised_amount ?? null,
    totalRaisedCurrency: row.total_raised_currency || null,
    totalRaisedAsOf: row.total_raised_as_of || null,
    narrativeSpecificity: row.narrative_specificity || null,
    features: {
      founder: row.founder_score || 0,
      market: row.market_score || 0,
      traction: row.traction_score || 0,
      deal: row.deal_score || 0,
      defensibility: row.defensibility_score || 0,
      risk: row.risk_score || 0,
    },
    hasFeatureScores:
      typeof row.founder_score === 'number' &&
      typeof row.market_score === 'number' &&
      typeof row.traction_score === 'number',
    finalScore: row.final_score || 0,
    signalsPositive: row.signals_positive || null,
    signalsNegative: row.signals_negative || null,
    similarity: Math.round(similarity * 100),
    sectorMatch: deriveSectorMatch(targetVector, candidateVector),
    matchTier: mapMatchTier(expl.matchTier),
    matchExplanation: expl,
  };
}

/**
 * Score chaque row du corpus contre le vecteur cible. Filtre les
 * rejets (hard gate, sous plancher), assemble dedup, trajectoire,
 * distribution outcomes. Pure : ne lit aucune base.
 */
export function findComparablesFromCorpus(
  features: ComparableFeatures,
  rows: any[],
  topN: number = 5,
): ComparablesResult {
  const targetVector = features.structuralVector;

  const scored: Comparable[] = [];
  for (const row of rows) {
    const candidateVector = inferStructuralVectorFromRow({
      asset_class: row.asset_class,
      sector: row.sector,
      sub_sector: row.sub_sector,
      subsector: row.subsector,
      capital_intensity: row.capital_intensity,
      vertical_v4: row.vertical_v4,
      funding_band: row.funding_band,
      outcome: row.outcome,
    });
    const expl = scoreMatch(targetVector, candidateVector);
    if (expl.matchTier === 'rejected') continue;
    const similarity = applyQualityWeighting(expl.similarity, row);
    scored.push(buildComparableFromRow(row, expl, candidateVector, targetVector, similarity));
  }

  const stageAligned = scored.filter((c) => c.matchTier === 'stage_aligned')
    .sort((a, b) => b.similarity - a.similarity);
  const longitudinal = scored.filter((c) => c.matchTier === 'longitudinal')
    .sort((a, b) => b.similarity - a.similarity);

  const stageAlignedDedup = dedupByCanonicalName(stageAligned);
  const longitudinalDedup = dedupByCanonicalName(longitudinal);

  const stageNames = new Set(
    stageAlignedDedup.map((c) => c.name.toLowerCase().trim()),
  );
  const longitudinalUnique = longitudinalDedup.filter(
    (c) => !stageNames.has(c.name.toLowerCase().trim()),
  );

  const topComparables = stageAlignedDedup.slice(0, topN);
  const topComparablesLongitudinal = longitudinalUnique.slice(0, Math.min(3, topN));

  const outcomeDistribution = {
    success: 0, medium: 0, fail: 0, active: 0, total: topComparables.length,
  };
  topComparables.forEach((c) => {
    if (c.outcome?.startsWith('success')) outcomeDistribution.success++;
    else if (c.outcome === 'medium' || c.outcome === 'volatile_private') outcomeDistribution.medium++;
    else if (c.outcome?.startsWith('fail')) outcomeDistribution.fail++;
    else outcomeDistribution.active++;
  });

  let dominantPattern: 'success-leaning' | 'fail-leaning' | 'mixed' = 'mixed';
  if (outcomeDistribution.total > 0) {
    if (outcomeDistribution.success / outcomeDistribution.total > 0.5) {
      dominantPattern = 'success-leaning';
    } else if (outcomeDistribution.fail / outcomeDistribution.total > 0.3) {
      dominantPattern = 'fail-leaning';
    }
  }

  const successCases = stageAlignedDedup.filter((c) => c.outcome?.startsWith('success'));
  const failCases = stageAlignedDedup.filter((c) => c.outcome?.startsWith('fail'));
  const closestSuccess = successCases.length > 0 ? successCases[0] : null;
  const closestFailure = failCases.length > 0 ? failCases[0] : null;

  const diligenceQuestions: string[] = [];
  topComparables.forEach((c) => {
    if (c.signalsNegative) {
      const firstSentence = c.signalsNegative.split(/[,.]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
        diligenceQuestions.push(`Cas ${c.name} : ${firstSentence.toLowerCase()} ?`);
      }
    }
  });

  const trajectory = simulateTrajectory(topComparables);

  return {
    topComparables,
    topComparablesLongitudinal,
    outcomeDistribution,
    trajectory,
    dominantPattern,
    closestSuccess,
    closestFailure,
    diligenceQuestions: diligenceQuestions.slice(0, 5),
    corpusInsufficient: topComparables.length < topN,
    floorUsed: MATCHING_CONFIG.floor,
  };
}

// ============================================================
// EXTRACTION DEPUIS L ANALYSE
// ============================================================

export function extractFeaturesFromAnalysis(result: any): ComparableFeatures | null {
  if (!result) return null;
  const sector = result.extraction?.sector || null;
  if (!sector) return null;

  let founder = result.team?.systemicCoverage?.score;
  if (typeof founder !== 'number') {
    const teamScores = [
      result.team?.collectiveAntiFragility?.score,
      result.team?.experienceTransposition?.score,
      result.team?.founderObsession?.score,
    ].filter((v) => typeof v === 'number');
    founder = teamScores.length > 0
      ? teamScores.reduce((a: number, b: number) => a + b, 0) / teamScores.length
      : 50;
  }
  const market = typeof result.market?.needIntensity?.score === 'number'
    ? result.market.needIntensity.score : 50;
  const traction = typeof result.market?.organicSignals?.score === 'number'
    ? result.market.organicSignals.score : 50;
  let deal = 60;
  const verdict = result.benchmarks?.preMoney?.verdict;
  if (verdict === 'below_market') deal = 80;
  else if (verdict === 'in_line') deal = 70;
  else if (verdict === 'above_market') deal = 50;
  else if (verdict === 'extreme_outlier') deal = 30;
  const defensibility = typeof result.market?.defensibility?.score === 'number'
    ? result.market.defensibility.score : 50;
  let risk = 50;
  if (typeof result.finalRecommendation?.blindspotsVsContrarian?.blindspotsWeight === 'number') {
    risk = result.finalRecommendation.blindspotsVsContrarian.blindspotsWeight;
  } else if (typeof result.blindspotAnalysis?.globalScore === 'number') {
    risk = result.blindspotAnalysis.globalScore;
  }

  const structuralVector = inferStructuralVectorFromAnalysis(result);

  return {
    founder: Math.round(founder),
    market: Math.round(market),
    traction: Math.round(traction),
    deal: Math.round(deal),
    defensibility: Math.round(defensibility),
    risk: Math.round(risk),
    sector,
    subSector: result.extraction?.subSector || null,
    country: result.extraction?.country || null,
    structuralVector,
    assetClass: structuralVector.economicNature,
    fundingBand: structuralVector.fundingBand,
    sectorSubgroup: null,
  };
}

export function buildFeaturesFromVector(
  vector: StructuralVector,
  meta: { sector?: string; subSector?: string | null; country?: string | null } = {},
): ComparableFeatures {
  return {
    founder: 50,
    market: 50,
    traction: 50,
    deal: 60,
    defensibility: 50,
    risk: 50,
    sector: meta.sector || vector.economicNature,
    subSector: meta.subSector || null,
    country: meta.country || null,
    structuralVector: vector,
    assetClass: vector.economicNature,
    fundingBand: vector.fundingBand,
    sectorSubgroup: null,
  };
}

// ============================================================
// TRAJECTORY (heuristiques par classe d outcome)
// ============================================================

const MULTIPLE_RANGES: Record<string, { low: number; high: number; median: number }> = {
  success:           { low: 5,    high: 25,  median: 12 },
  success_private:   { low: 2,    high: 10,  median: 5 },
  success_exit:      { low: 2,    high: 8,   median: 4 },
  medium:            { low: 1,    high: 3,   median: 1.5 },
  volatile_private:  { low: 0.5,  high: 4,   median: 2 },
  active:            { low: 1,    high: 1,   median: 1 },
  fail_weak_exit:    { low: 0.1,  high: 0.5, median: 0.25 },
  fail:              { low: 0,    high: 0.3, median: 0.1 },
  fail_uncertain:    { low: 0,    high: 0.3, median: 0.1 },
};

function getMultiple(outcome: string) {
  return MULTIPLE_RANGES[outcome] || { low: 0, high: 1, median: 0.5 };
}

function classifyTrajectory(outcome: string): 'optimistic' | 'median' | 'downside' {
  if (outcome === 'success') return 'optimistic';
  if (outcome?.startsWith('success')) return 'optimistic';
  if (outcome === 'medium' || outcome === 'volatile_private' || outcome === 'active') return 'median';
  return 'downside';
}

export function simulateTrajectory(topComparables: Comparable[]): ComparablesResult['trajectory'] {
  const n = topComparables.length || 1;

  const buckets: Record<'optimistic' | 'median' | 'downside', Comparable[]> = {
    optimistic: [],
    median: [],
    downside: [],
  };
  topComparables.forEach((c) => {
    buckets[classifyTrajectory(c.outcome)].push(c);
  });

  const buildScenario = (
    label: 'optimistic' | 'median' | 'downside',
    items: Comparable[],
  ): TrajectoryScenario => {
    const probability = Math.round((items.length / n) * 100);
    if (items.length === 0) {
      const defaults = {
        optimistic: { low: 5, high: 25, median: 12 },
        median: { low: 1, high: 3, median: 1.5 },
        downside: { low: 0, high: 0.3, median: 0.1 },
      }[label];
      return {
        label,
        probability,
        multipleRange: `${formatMult(defaults.low)} - ${formatMult(defaults.high)}`,
        multipleMedian: defaults.median,
        exampleCase: null,
        narrative: {
          optimistic: 'Aucun cas comparable n a produit ce type de trajectoire dans le top 5. Pour suivre cette voie, le dossier doit s ecarter du pattern qu il presente actuellement.',
          median: 'Aucun cas comparable mitige ou actif dans le top 5. Les outcomes intermediaires sont peu represents par les voisins du dossier.',
          downside: 'Aucun cas d echec dans le top 5. Le pattern observe ne ressemble pas aux profils d echec du corpus, mais l absence de cas similaire en bas de courbe ne signifie pas que le risque est nul.',
        }[label],
      };
    }
    const lows = items.map((c) => getMultiple(c.outcome).low);
    const highs = items.map((c) => getMultiple(c.outcome).high);
    const medians = items.map((c) => getMultiple(c.outcome).median);
    const lowAgg = Math.min(...lows);
    const highAgg = Math.max(...highs);
    const medianAgg = medians.reduce((a, b) => a + b, 0) / medians.length;
    const example = items[0];

    let narrative = '';
    if (label === 'optimistic') {
      narrative = `Dans le scenario optimiste, le dossier suit la trajectoire de ${example.name} et de ${items.length - 1} autre${items.length > 2 ? 's' : ''} cas similaire${items.length > 2 ? 's' : ''} : exit qualifiant ou valorisation late stage soutenue. ${probability}% du top 5 se trouve dans cette tranche.`;
    } else if (label === 'median') {
      narrative = `Le scenario median reproduit la trajectoire de ${example.name} : croissance reelle mais sortie tepid, valorisation comprimee, ou maintien en private sans liquidation. ${probability}% du top 5 se trouve dans cette tranche.`;
    } else {
      narrative = `Dans le scenario downside, le dossier croise les difficultes que ${example.name} a rencontrees : ${(example.signalsNegative || '').split(/[,.]/)[0]?.toLowerCase().trim() || 'unit economics non prouves'}. ${probability}% du top 5 se trouve dans cette tranche.`;
    }

    return {
      label,
      probability,
      multipleRange: `${formatMult(lowAgg)} - ${formatMult(highAgg)}`,
      multipleMedian: Math.round(medianAgg * 100) / 100,
      exampleCase: example,
      narrative,
    };
  };

  const optimistic = buildScenario('optimistic', buckets.optimistic);
  const median = buildScenario('median', buckets.median);
  const downside = buildScenario('downside', buckets.downside);

  const expectedMultiple = Math.round((
    (optimistic.probability / 100) * optimistic.multipleMedian +
    (median.probability / 100) * median.multipleMedian +
    (downside.probability / 100) * downside.multipleMedian
  ) * 100) / 100;

  let narrative = '';
  if (optimistic.probability >= 60) {
    narrative = `Le dossier presente un pattern aligne avec des trajectoires de succes (${optimistic.probability}% du top 5). L esperance de multiple ponderee s etablit autour de ${formatMult(expectedMultiple)}, soutenue par les exits comparables. Le pari implicite : reproduire la dynamique d execution observee chez les cas references.`;
  } else if (downside.probability >= 30) {
    narrative = `Le pattern observe combine ${optimistic.probability}% de cas de succes et ${downside.probability}% de cas d echec dans le top 5. L esperance de multiple ponderee tombe a ${formatMult(expectedMultiple)}, ce qui signale un dossier ambigu : le verdict depend de variables propres au dossier que les comparables ne capturent pas.`;
  } else {
    narrative = `Le dossier se range majoritairement dans des trajectoires intermediaires (${median.probability}% du top 5). L esperance de multiple ponderee, ${formatMult(expectedMultiple)}, reflete une distribution sans cluster fort. C est un profil ou la sortie depend largement de la qualite d execution post-investissement.`;
  }

  return { optimistic, median, downside, expectedMultiple, narrative };
}

function formatMult(n: number): string {
  if (n < 1) return n.toFixed(2).replace(/\.?0+$/, '') + 'x';
  return Math.round(n * 10) / 10 + 'x';
}

// ============================================================
// SCORING UN CANDIDAT UNIQUE (utile aux consommateurs hors widget)
// ============================================================

export function scoreSingleCandidate(
  targetVector: StructuralVector,
  row: any,
): { explanation: MatchExplanation; similarityPct: number; tier: 'stage_aligned' | 'longitudinal' | 'rejected' } {
  const candidateVector = inferStructuralVectorFromRow({
    asset_class: row.asset_class,
    sector: row.sector,
    sub_sector: row.sub_sector,
    subsector: row.subsector,
    capital_intensity: row.capital_intensity,
    vertical_v4: row.vertical_v4,
    funding_band: row.funding_band,
    outcome: row.outcome,
  });
  const expl = scoreMatch(targetVector, candidateVector);
  if (expl.matchTier === 'rejected') {
    return { explanation: expl, similarityPct: 0, tier: 'rejected' };
  }
  const similarity = applyQualityWeighting(expl.similarity, row);
  return {
    explanation: expl,
    similarityPct: Math.round(similarity * 100),
    tier: mapMatchTier(expl.matchTier),
  };
}
