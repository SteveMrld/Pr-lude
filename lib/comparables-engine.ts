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
  // Champs V3 PULSAR
  region: string | null;            // Europe / US / Asia / Israel / NorthAmerica / Global
  euStatus: string | null;          // EU / Non-EU / Non-EU mixed
  stateInfluenceTag: string | null; // No / Potential / Probable / Yes/Probable
  dataQuality: string | null;       // High / Medium / Low
  primarySourceUrl: string | null;
  analystNote: string | null;
  features: {
    founder: number;
    market: number;
    traction: number;
    deal: number;
    defensibility: number;
    risk: number;
  };
  // Indique si les 6 features ont des donnees reelles (true) ou
  // sont des fallbacks par defaut (false). Quand false, le matching
  // sur ce comparable est moins fiable et doit etre montre comme tel.
  hasFeatureScores: boolean;
  finalScore: number;
  signalsPositive: string | null;
  signalsNegative: string | null;
  // Score de similarite 0-100 (plus haut = plus similaire)
  similarity: number;
  // Match de secteur (boost dans le calcul)
  sectorMatch: 'exact' | 'related' | 'different';
}

// Un scenario de trajectoire projete a partir d une tranche d outcomes.
// Les multiples sont des bornes heuristiques par classe d outcome :
//   success           : 5x - 25x (cas IPO et exit majeur)
//   success_private   : 2x - 10x (cas late private au peak valuation)
//   success_exit      : 2x - 8x (cas M&A solide)
//   medium            : 1x - 3x (sortie tepid ou pas de sortie)
//   volatile_private  : 0.5x - 4x (suit le sort du marche)
//   active            : indetermine (1x conservatif)
//   fail_weak_exit    : 0.1x - 0.5x (M&A distresse)
//   fail / fail_uncertain : 0x - 0.3x
// Ce sont des bornes indicatives, pas des estimations cas par cas.
export interface TrajectoryScenario {
  label: string; // 'optimistic' | 'median' | 'downside'
  // Probabilite calculee comme proportion du top N qui tombe dans cette tranche
  probability: number; // 0-100
  // Multiple borne sur l investissement. Format chaine '5x - 15x'.
  multipleRange: string;
  // Multiple median pour calculs aval (esperance)
  multipleMedian: number;
  // Cas exemple : le comparable le plus similaire dans cette tranche.
  // null si la tranche est vide dans le top N.
  exampleCase: Comparable | null;
  // Phrase editoriale courte qui contextualise le scenario.
  narrative: string;
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
  // Trajectoires projetees a partir de la distribution des outcomes
  // des comparables. Trois scenarios : optimistic, median, downside.
  trajectory: {
    optimistic: TrajectoryScenario;
    median: TrajectoryScenario;
    downside: TrajectoryScenario;
    // Esperance de multiple ponderee par les probabilites des 3 scenarios.
    // C est le seul chiffre 'consolide' qu on doit interpreter avec
    // beaucoup de prudence : les multiples bornes par tranche d outcome
    // sont des heuristiques, pas des donnees observees au cas par cas.
    expectedMultiple: number;
    // Texte editorial qui resume le pari implicite du dossier.
    narrative: string;
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
    fintech: ['fintech', 'insurtech', 'payment', 'banking', 'crypto', 'crypto/fintech'],
    saas: ['saas', 'enterprise software', 'enterprise automation', 'saas analytics', 'saas search', 'saas marketplace', 'saas/ai', 'saas/e-commerce'],
    marketplace: ['marketplace', 'marketplace luxury', 'marketplace auto', 'e-commerce', 'e-commerce auto', 'e-commerce/cloud', 'consumer/platform'],
    food: ['food delivery', 'foodtech', 'delivery', 'quick commerce', 'food/mobility', 'mobility/food'],
    consumer: ['consumer platform', 'consumer', 'streaming', 'gaming', 'fashiontech', 'gaming/e-commerce/fintech', 'web3/gaming'],
    health: ['healthtech', 'biotech', 'medtech'],
    deeptech: ['agritech', 'iot', 'cloud', 'crypto hardware', 'web3 gaming', 'quantum'],
    ai: ['ai', 'ai/data', 'ai/defense', 'ai/consumer', 'ai/mobility', 'ai/semiconductors', 'cybersecurity/ai', 'saas/ai', 'mobility/ai'],
    cybersecurity: ['cybersecurity', 'cybersecurity/ai', 'cybersecurity/crypto'],
    mobility: ['mobility', 'mobility/ai', 'mobility/food', 'mobility/fintech', 'mobility/ecommerce', 'greentech/mobility'],
    greentech: ['greentech', 'greentech/mobility'],
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
 * @param regionFilter filtre par region (null = global). Valeurs :
 *   'Europe' | 'US' | 'NorthAmerica' | 'Asia' | 'Israel'
 */
export async function findComparables(
  features: ComparableFeatures,
  topN: number = 5,
  regionFilter: string | null = null,
): Promise<ComparablesResult | null> {
  const supabase = getAdmin();
  if (!supabase) return null;

  let query = supabase.from('historical_companies').select('*');
  if (regionFilter) {
    query = query.eq('region', regionFilter);
  }
  const { data: rows, error } = await query;

  if (error || !rows) {
    console.error('[comparables] fetch error', error);
    return null;
  }

  // Calcul similarite pour chaque ligne. V3 : la majorite des lignes
  // n ont pas de scores 6 dimensions. Strategie :
  //  - Si la ligne a des scores : matching numerique habituel
  //  - Sinon : fallback sur le matching sectoriel uniquement
  // Le boost data_quality intervient en post : High = 1.0, Medium = 0.85,
  // Low = 0.65. C est un poids de confiance, pas un boost de similarite.
  const scored = rows.map((row: any) => {
    const sectorMatch = matchSector(features.sector, row.sector);
    // Bonus sectoriel : 30% de boost si exact, 15% si related
    const sectorBoost = sectorMatch === 'exact' ? 0.30 : sectorMatch === 'related' ? 0.15 : 0;

    // Detecte si la ligne a des features reelles (V1) ou non (V3)
    const hasFeatureScores =
      typeof row.founder_score === 'number' &&
      typeof row.market_score === 'number' &&
      typeof row.traction_score === 'number';

    let similarity: number;
    if (hasFeatureScores) {
      const dist = weightedDistance(features, {
        founder: row.founder_score || 50,
        market: row.market_score || 50,
        traction: row.traction_score || 50,
        deal: row.deal_score || 50,
        defensibility: row.defensibility_score || 50,
        risk: row.risk_score || 50,
      });
      similarity = Math.max(0, Math.min(1, (1 - dist) + sectorBoost * (1 - dist)));
    } else {
      // Fallback V3 : pas de scores numeriques. La similarite vient
      // exclusivement du match sectoriel. Base 50% si meme secteur,
      // 35% si secteur voisin, 15% sinon. Nettement plus bas que les
      // matches V1 avec scores : c est volontaire pour que les V1
      // remontent quand ils existent.
      if (sectorMatch === 'exact') similarity = 0.50;
      else if (sectorMatch === 'related') similarity = 0.35;
      else similarity = 0.15;
    }

    // Pondération data_quality : decote la similarite des lignes Low.
    const qualityWeight = row.data_quality === 'High' ? 1.0
      : row.data_quality === 'Medium' ? 0.92
      : row.data_quality === 'Low' ? 0.78
      : 0.85;
    similarity = similarity * qualityWeight;

    const comparable: Comparable = {
      id: row.id,
      name: row.name,
      country: row.country,
      sector: row.sector,
      subSector: row.sub_sector || row.subsector,
      founded: row.founded,
      outcome: row.outcome,
      exitType: row.exit_type,
      region: row.region,
      euStatus: row.eu_status,
      stateInfluenceTag: row.state_influence_tag,
      dataQuality: row.data_quality,
      primarySourceUrl: row.primary_source_url,
      analystNote: row.analyst_note,
      features: {
        founder: row.founder_score || 0,
        market: row.market_score || 0,
        traction: row.traction_score || 0,
        deal: row.deal_score || 0,
        defensibility: row.defensibility_score || 0,
        risk: row.risk_score || 0,
      },
      hasFeatureScores,
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

  // Trajectoire projetee a partir du top N
  const trajectory = simulateTrajectory(topComparables);

  return {
    topComparables,
    outcomeDistribution,
    trajectory,
    dominantPattern,
    closestSuccess,
    closestFailure,
    diligenceQuestions: diligenceQuestions.slice(0, 5),
  };
}

// ============================================================
// SIMULATE TRAJECTORY
// ------------------------------------------------------------
// Construit trois scenarios optimistic / median / downside a partir
// de la distribution des outcomes du top N comparables. Chaque
// scenario est associe a :
//   - une probabilite (proportion du top N dans la tranche)
//   - un range de multiple (borne heuristique par tranche d outcome)
//   - un cas exemple (le plus similaire dans la tranche)
//   - une phrase editoriale qui resume le pari implicite
// ============================================================

// Multiples bornes par classe d outcome. Heuristiques inferees des
// donnees publiques d exit europeennes 2010-2024. A sourcer avant
// usage investisseur strict.
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
  if (outcome.startsWith('success')) return 'optimistic';
  if (outcome === 'medium' || outcome === 'volatile_private' || outcome === 'active') return 'median';
  return 'downside';
}

function simulateTrajectory(topComparables: Comparable[]): ComparablesResult['trajectory'] {
  const n = topComparables.length || 1;

  // Repartition du top N par classe de trajectoire
  const buckets: Record<'optimistic' | 'median' | 'downside', Comparable[]> = {
    optimistic: [],
    median: [],
    downside: [],
  };
  topComparables.forEach((c) => {
    buckets[classifyTrajectory(c.outcome)].push(c);
  });

  // Pour chaque bucket : probabilite, range multiple agrege, exemple
  const buildScenario = (
    label: 'optimistic' | 'median' | 'downside',
    items: Comparable[],
  ): TrajectoryScenario => {
    const probability = Math.round((items.length / n) * 100);
    if (items.length === 0) {
      // Bucket vide : on prend les bornes par defaut de la classe pour
      // que le narrative reste lisible meme avec une probabilite nulle.
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
    // Multiples agregees : on prend le min low, le max high, et la moyenne des medians
    const lows = items.map((c) => getMultiple(c.outcome).low);
    const highs = items.map((c) => getMultiple(c.outcome).high);
    const medians = items.map((c) => getMultiple(c.outcome).median);
    const lowAgg = Math.min(...lows);
    const highAgg = Math.max(...highs);
    const medianAgg = medians.reduce((a, b) => a + b, 0) / medians.length;
    // Cas exemple : le plus similaire dans le bucket
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

  // Esperance ponderee : E[multiple] = sum(prob_i * median_i) / 100
  const expectedMultiple = Math.round((
    (optimistic.probability / 100) * optimistic.multipleMedian +
    (median.probability / 100) * median.multipleMedian +
    (downside.probability / 100) * downside.multipleMedian
  ) * 100) / 100;

  // Narrative consolide : pari implicite du dossier
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
  let sector = result.extraction?.sector || null;
  if (!sector) return null;

  // Normalisation sectorielle : la pipeline produit parfois des labels
  // verbeux comme "IA / Generative AI / Large Language Models" qui ne
  // matchent pas la table V3 ("AI"). On normalise vers les categories
  // V3 quand la chaine contient des mots-cles distinctifs.
  const sectorLower = sector.toLowerCase();
  if (/\b(ia|ai|llm|generative|machine learning|foundation model)\b/.test(sectorLower)) {
    sector = 'AI';
  } else if (/\b(fintech|payment|banking|insurance|insurtech|crypto)\b/.test(sectorLower)) {
    sector = 'Fintech';
  } else if (/\b(saas|enterprise software|cloud|automation)\b/.test(sectorLower)) {
    sector = 'SaaS';
  } else if (/\b(cybersecurity|cyber|security)\b/.test(sectorLower)) {
    sector = 'Cybersecurity';
  } else if (/\b(marketplace|e-?commerce|retail)\b/.test(sectorLower)) {
    sector = 'Marketplace';
  } else if (/\b(mobility|delivery|transport|automotive)\b/.test(sectorLower)) {
    sector = 'Mobility';
  } else if (/\b(health|medical|biotech|pharma)\b/.test(sectorLower)) {
    sector = 'Healthtech';
  } else if (/\b(greentech|cleantech|climate|energy)\b/.test(sectorLower)) {
    sector = 'Greentech';
  } else if (/\b(quantum)\b/.test(sectorLower)) {
    sector = 'Quantum';
  }

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
