// ============================================================
// COMPARABLES ENGINE
// ------------------------------------------------------------
// Moteur de matching contre la base historical_companies.
// Repond a la question "ce dossier ressemble a quels cas
// passes du marche europeen ?".
//
// V1 : distance euclidienne ponderee sur 6 dimensions
// (founder, market, traction, deal, defensibility, risk),
// avec boost si meme secteur (Jaccard sectoriel simple).
//
// V2 (futur) : embeddings textuels deck/memo + distance
// sur features riches.
// ============================================================

import 'server-only';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// 6 dimensions PULSAR au format 0-100
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
}

// Une entree historique enrichie avec sa similarite calculee
export interface Comparable {
  id: string;
  name: string;
  country: string;
  sector: string;
  subSector: string | null;
  founded: number | null;
  outcome: string;
  exitType: string | null;
  features: {
    founder: number;
    market: number;
    traction: number;
    deal: number;
    defensibility: number;
    risk: number;
  };
  finalScore: number;
  signalsPositive: string | null;
  signalsNegative: string | null;
  // Score de similarite 0-100 (plus haut = plus similaire)
  similarity: number;
  // Match de secteur (boost dans le calcul)
  sectorMatch: 'exact' | 'related' | 'different';
}

export interface ComparablesResult {
  topComparables: Comparable[]; // top N classes par similarite desc
  outcomeDistribution: {
    success: number;
    medium: number;
    fail: number;
    active: number;
    total: number;
  };
  // Pattern dominant : si la majorite des comparables ont un meme outcome,
  // c est un signal directionnel. Sinon, le dossier est ambigu.
  dominantPattern: 'success-leaning' | 'fail-leaning' | 'mixed';
  // Cas le plus proche en succes et en echec : le narratif du fonds
  // doit pouvoir expliquer pourquoi le dossier va plutot du cote
  // success que fail.
  closestSuccess: Comparable | null;
  closestFailure: Comparable | null;
  // Similitudes-cles : phrases qui resument ce qui rapproche le
  // dossier de ses comparables (extrait des signals positifs/negatifs).
  diligenceQuestions: string[];
}

const POIDS_FEATURE = {
  founder: 0.20,
  market: 0.20,
  traction: 0.20,
  deal: 0.15,
  defensibility: 0.15,
  risk: 0.10,
};

/**
 * Calcule la distance euclidienne ponderee entre deux feature vectors.
 * Distance normalisee 0-1 (0 = identique, 1 = opposes).
 */
function weightedDistance(
  a: ComparableFeatures,
  b: { founder: number; market: number; traction: number; deal: number; defensibility: number; risk: number }
): number {
  const dims: Array<keyof typeof POIDS_FEATURE> = [
    'founder', 'market', 'traction', 'deal', 'defensibility', 'risk',
  ];
  let sumSquared = 0;
  let sumWeights = 0;
  dims.forEach((dim) => {
    const w = POIDS_FEATURE[dim];
    const diff = (a[dim] - b[dim]) / 100; // normalise sur [0,1]
    sumSquared += w * diff * diff;
    sumWeights += w;
  });
  // Racine ponderee, normalisee sur [0,1]
  return Math.sqrt(sumSquared / sumWeights);
}

/**
 * Match secteur : exact si meme texte (case-insensitive), related si
 * appartient a la meme grande famille, different sinon.
 */
function matchSector(target: string | null, ref: string): 'exact' | 'related' | 'different' {
  if (!target) return 'different';
  const t = target.toLowerCase().trim();
  const r = ref.toLowerCase().trim();
  if (t === r) return 'exact';
  // Familles sectorielles approchees pour les cas frequents.
  const FAMILIES: Record<string, string[]> = {
    fintech: ['fintech', 'insurtech', 'payment', 'banking', 'crypto'],
    saas: ['saas', 'enterprise automation', 'saas analytics', 'saas search', 'saas marketplace'],
    marketplace: ['marketplace', 'marketplace luxury', 'marketplace auto', 'e-commerce', 'e-commerce auto'],
    food: ['food delivery', 'foodtech', 'delivery', 'quick commerce'],
    consumer: ['consumer platform', 'streaming', 'gaming', 'fashiontech'],
    health: ['healthtech', 'biotech', 'medtech'],
    deeptech: ['agritech', 'iot', 'cloud', 'crypto hardware', 'web3 gaming'],
  };
  for (const family of Object.values(FAMILIES)) {
    const inFamilyT = family.some((kw) => t.includes(kw));
    const inFamilyR = family.some((kw) => r.includes(kw));
    if (inFamilyT && inFamilyR) return 'related';
  }
  return 'different';
}

/**
 * Trouve les comparables historiques les plus proches d un dossier.
 * @param features feature vector du dossier en cours
 * @param topN nombre de comparables a renvoyer (defaut 5)
 */
export async function findComparables(
  features: ComparableFeatures,
  topN: number = 5,
): Promise<ComparablesResult | null> {
  const supabase = getAdmin();
  if (!supabase) return null;

  const { data: rows, error } = await supabase
    .from('historical_companies')
    .select('*');

  if (error || !rows) {
    console.error('[comparables] fetch error', error);
    return null;
  }

  // Calcul similarite pour chaque ligne
  const scored = rows.map((row: any) => {
    const sectorMatch = matchSector(features.sector, row.sector);
    // Bonus sectoriel : 30% de boost si exact, 15% si related
    const sectorBoost = sectorMatch === 'exact' ? 0.30 : sectorMatch === 'related' ? 0.15 : 0;

    const dist = weightedDistance(features, {
      founder: row.founder_score || 50,
      market: row.market_score || 50,
      traction: row.traction_score || 50,
      deal: row.deal_score || 50,
      defensibility: row.defensibility_score || 50,
      risk: row.risk_score || 50,
    });
    // Distance brute 0-1, similarite = 1 - dist + boost, capee a 1
    const similarity = Math.max(0, Math.min(1, (1 - dist) + sectorBoost * (1 - dist)));

    const comparable: Comparable = {
      id: row.id,
      name: row.name,
      country: row.country,
      sector: row.sector,
      subSector: row.sub_sector,
      founded: row.founded,
      outcome: row.outcome,
      exitType: row.exit_type,
      features: {
        founder: row.founder_score || 0,
        market: row.market_score || 0,
        traction: row.traction_score || 0,
        deal: row.deal_score || 0,
        defensibility: row.defensibility_score || 0,
        risk: row.risk_score || 0,
      },
      finalScore: row.final_score || 0,
      signalsPositive: row.signals_positive,
      signalsNegative: row.signals_negative,
      similarity: Math.round(similarity * 100),
      sectorMatch,
    };
    return comparable;
  });

  // Tri par similarite desc, on garde le topN
  scored.sort((a, b) => b.similarity - a.similarity);
  const topComparables = scored.slice(0, topN);

  // Distribution des outcomes sur le topN
  const outcomeDistribution = {
    success: 0, medium: 0, fail: 0, active: 0, total: topComparables.length,
  };
  topComparables.forEach((c) => {
    if (c.outcome.startsWith('success')) outcomeDistribution.success++;
    else if (c.outcome === 'medium' || c.outcome === 'volatile_private') outcomeDistribution.medium++;
    else if (c.outcome.startsWith('fail')) outcomeDistribution.fail++;
    else outcomeDistribution.active++;
  });

  // Pattern dominant : si > 50% success, success-leaning. Si > 30% fail, fail-leaning.
  // Sinon mixed.
  let dominantPattern: 'success-leaning' | 'fail-leaning' | 'mixed' = 'mixed';
  if (outcomeDistribution.success / outcomeDistribution.total > 0.5) {
    dominantPattern = 'success-leaning';
  } else if (outcomeDistribution.fail / outcomeDistribution.total > 0.3) {
    dominantPattern = 'fail-leaning';
  }

  // Cas le plus proche en succes et en echec sur l ensemble
  const successCases = scored.filter((c) => c.outcome.startsWith('success'));
  const failCases = scored.filter((c) => c.outcome.startsWith('fail'));
  const closestSuccess = successCases.length > 0 ? successCases[0] : null;
  const closestFailure = failCases.length > 0 ? failCases[0] : null;

  // Diligence questions : on extrait les signals_negative des comparables
  // les plus proches pour suggerer des points a verifier en DD.
  const diligenceQuestions: string[] = [];
  topComparables.forEach((c) => {
    if (c.signalsNegative) {
      // On prend la premiere phrase comme question implicite
      const firstSentence = c.signalsNegative.split(/[,.]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
        diligenceQuestions.push(`Cas ${c.name} : ${firstSentence.toLowerCase()} ?`);
      }
    }
  });

  return {
    topComparables,
    outcomeDistribution,
    dominantPattern,
    closestSuccess,
    closestFailure,
    diligenceQuestions: diligenceQuestions.slice(0, 5),
  };
}

/**
 * Extrait un feature vector PULSAR a partir d un OrchestratedResult Prelude.
 * Mapping V1 :
 *   - founder       : team.systemicCoverage.score (couverture exec)
 *                     fallback : moyenne scores team
 *   - market        : market.needIntensity.score
 *   - traction      : market.organicSignals.score (proxy : signaux organiques
 *                     de demande)
 *   - deal          : derive de benchmarks.preMoney.verdict (in_line=70,
 *                     above=50, extreme_outlier=30, below=80)
 *                     fallback : 60 (median)
 *   - defensibility : market.defensibility.score
 *   - risk          : finalRecommendation.blindspotsContrarian.blindspotsWeight
 *                     ou blindspotScore. Plus haut = plus risque.
 *
 * Retourne null si les champs minimums (sector, founder, market) sont
 * indisponibles.
 */
export function extractFeaturesFromAnalysis(result: any): ComparableFeatures | null {
  if (!result) return null;
  const sector = result.extraction?.sector || null;
  if (!sector) return null;

  // Founder : couverture systemique de l equipe ou moyenne signaux
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
    ? result.market.needIntensity.score
    : 50;

  const traction = typeof result.market?.organicSignals?.score === 'number'
    ? result.market.organicSignals.score
    : 50;

  // Deal : derive des benchmarks
  let deal = 60;
  const verdict = result.benchmarks?.preMoney?.verdict;
  if (verdict === 'below_market') deal = 80;
  else if (verdict === 'in_line') deal = 70;
  else if (verdict === 'above_market') deal = 50;
  else if (verdict === 'extreme_outlier') deal = 30;

  const defensibility = typeof result.market?.defensibility?.score === 'number'
    ? result.market.defensibility.score
    : 50;

  // Risk : utilise blindspot score (plus haut = plus de risques caches)
  let risk = 50;
  if (typeof result.finalRecommendation?.blindspotsVsContrarian?.blindspotsWeight === 'number') {
    risk = result.finalRecommendation.blindspotsVsContrarian.blindspotsWeight;
  } else if (typeof result.blindspotAnalysis?.globalScore === 'number') {
    risk = result.blindspotAnalysis.globalScore;
  }

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
  };
}
