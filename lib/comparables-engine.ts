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

// 6 dimensions du scoring au format 0-100
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
  // Asset class detectee a partir du dossier en cours. Permet le hard
  // filter contre les comparables de classe incompatible (ex pas de
  // marketplace e-commerce pour un dossier hardware industriel).
  assetClass?: string | null;
  // V5 : bande de financement detectee a partir du tour annonce dans le
  // pitch deck. Sert de second hard filter pour eviter qu une seed soit
  // comparee a une licorne late stage.
  fundingBand?: 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c_plus' | 'late_ipo' | null;
  // V5 : sous-groupe sectoriel fin (ex social_video_media, ride_hailing,
  // foundation_models). Plus fin que sector et asset_class, sert de boost
  // de similarite, pas de hard filter.
  sectorSubgroup?: string | null;
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
  // Champs V3 enrichis
  region: string | null;            // Europe / US / Asia / Israel / NorthAmerica / Global
  euStatus: string | null;          // EU / Non-EU / Non-EU mixed
  stateInfluenceTag: string | null; // No / Potential / Probable / Yes/Probable
  dataQuality: string | null;       // High / Medium / Low
  primarySourceUrl: string | null;
  analystNote: string | null;
  // Champs V4 incremental hardware/industrial/deeptech
  assetClass: string | null;
  vcRelevanceScore: number | null;
  capitalIntensity: string | null;
  verticalV4: string | null;
  source2: string | null;
  whatMadeItWork: string | null;
  keyRisksLessons: string | null;
  // Champs V5 calibration funding et sub-secteur
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
  // V5 : tier de matching. 'stage_aligned' = passe les hard filters
  // asset_class + funding_band, utilisable pour le scoring de probabilite.
  // 'longitudinal' = passe asset_class mais pas funding_band, sert de
  // valeur narrative (trajectoire a scale, pattern d echec a long terme),
  // exclu du scoring de probabilite.
  matchTier: 'stage_aligned' | 'longitudinal';
}

/**
 * Conditions requises pour invoquer un comparable narratif vedette.
 * Si requires.asset_class est specifie, le dossier doit en faire partie.
 * Si requires.funding_band_min est specifie, le dossier doit avoir au
 * moins ce stade pour que le comparable soit pertinent (sinon Ynsect
 * sort sur n importe quelle seed et c est exactement le bug a corriger).
 */
export interface NarrativeSpecificity {
  tags: string[];
  requires: {
    asset_class?: string[];
    funding_band_min?: 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c_plus' | 'late_ipo';
    context?: string;
  };
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
  topComparables: Comparable[]; // top N classes par similarite desc, stage_aligned uniquement
  // V5 : bloc longitudinal separe. Comparables qui passent le hard filter
  // asset_class mais sont hors funding_band (ex Brut a scale, Likee, Rumble
  // pour un dossier social video media en seed). Valeur narrative seulement,
  // ne pondere pas le scoring de probabilite. La note d investissement les
  // presente explicitement comme "patterns longitudinaux a scale".
  topComparablesLongitudinal: Comparable[];
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
 * Match sub-sector via overlap de mots-cles. Retourne 0-1.
 * Ex : "Generative AI / LLM" vs "Foundation models" -> 0.6 (synonymes)
 *      "Generative AI" vs "Computer vision" -> 0.0 (rien en commun)
 *      "Foundation models" vs "Foundation models" -> 1.0 (exact)
 */
function matchSubSector(target: string | null, ref: string | null): number {
  if (!target || !ref) return 0;
  const t = target.toLowerCase().trim();
  const r = ref.toLowerCase().trim();
  if (t === r) return 1;

  // Synonymes courants pour eviter que 'LLM' et 'foundation models'
  // soient consideres comme orthogonaux alors qu ils designent la
  // meme realite produit.
  const SYNONYM_GROUPS: string[][] = [
    ['llm', 'foundation', 'generative', 'language', 'gpt', 'transformer', 'frontier'],
    ['data', 'analytics', 'mlops', 'lakehouse', 'platform', 'enterprise'],
    ['vision', 'computer'],
    ['payment', 'payments'],
    ['neobank', 'banking', 'banque', 'bank'],
    ['marketplace', 'place', 'plateforme'],
    ['delivery', 'commerce', 'quick'],
    ['streaming', 'music', 'video'],
    ['cyber', 'security', 'endpoint', 'xdr', 'siem'],
    ['mobility', 'ride', 'auto', 'vehicle'],
    ['health', 'medical', 'medtech'],
    ['gaming', 'game', 'mobile'],
    ['defense', 'autonomous', 'military'],
    ['chip', 'chips', 'semiconductor', 'semiconductors'],
  ];

  // Tokens significatifs (>2 chars, pas de mots vides)
  const STOP = new Set(['and', 'the', 'for', 'des', 'les', 'avec', 'sur']);
  const tokenize = (s: string) => s
    .split(/[\s\/\-,&\.]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w));

  const tTokens = tokenize(t);
  const rTokens = tokenize(r);
  if (tTokens.length === 0 || rTokens.length === 0) return 0;

  // Pour chaque token target, on cherche un match dans ref (direct ou via synonym)
  let matches = 0;
  for (const tok of tTokens) {
    if (rTokens.includes(tok)) {
      matches++;
      continue;
    }
    // Match via synonymes
    const groupOfT = SYNONYM_GROUPS.find((g) => g.some((s) => tok.includes(s) || s.includes(tok)));
    if (groupOfT) {
      const synonymHit = rTokens.some((rTok) =>
        groupOfT.some((s) => rTok.includes(s) || s.includes(rTok))
      );
      if (synonymHit) matches += 0.7; // match synonymique pondere moins fort
    }
  }

  const score = matches / Math.max(tTokens.length, rTokens.length);
  return Math.min(1, score);
}

/**
 * Match region : 1 si meme region, 0.5 si region voisine (Europe/UK,
 * US/Canada, Asia/Israel), 0 sinon. Sert de petit boost de
 * proximite culturelle/regulation.
 */
function matchRegion(target: string | null, ref: string | null): number {
  if (!target || !ref) return 0;
  const t = target.toLowerCase();
  const r = ref.toLowerCase();
  if (t === r) return 1;
  // France, UK, Germany, etc. -> Europe
  const isEurope = (s: string) => /europe|france|germany|uk|netherlands|sweden|spain|italy|belgium|finland|romania|lithuania/.test(s);
  const isUS = (s: string) => /^us$|united states|usa|america/.test(s);
  const isAsia = (s: string) => /asia|china|japan|korea|singapore/.test(s);
  if (isEurope(t) && isEurope(r)) return 0.7;
  if (isUS(t) && (r.includes('canada') || r.includes('northamerica'))) return 0.6;
  if (isAsia(t) && r.includes('israel')) return 0.3;
  return 0;
}

/**
 * Detecte la classe d actif d un dossier a partir de son secteur et
 * sub-sector. Retourne l une des valeurs :
 *   software_pure          : SaaS, AI, marketplace, fintech, consumer (Mistral, DeepL, Spotify)
 *   software_with_hardware : produit logiciel avec dependance hardware partielle (Wayve, Cursor)
 *   hardware_industrial    : construction, machinerie, vehicules, drones (Platypus, Joby, Anduril)
 *   infrastructure_physical: usines, batteries, gigafactory (Northvolt, Form Energy)
 *   deep_tech_research     : quantum, fusion, carbon capture (Pasqal, Helion)
 *   hardware_consumer      : wearables et hardware grand public (Oura, GoPro)
 *   unknown                : aucun signal exploitable (le hard filter
 *                            devient permissif, mais les comparables
 *                            sont scores au merite sectoriel pur).
 *
 * Cette fonction sert au hard filter dans findComparables : un dossier
 * hardware_industrial ne sera jamais matche avec un comparable
 * software_pure, meme si les patterns abstraits semblent similaires.
 *
 * Doctrine : pas de defaut silencieux vers software_pure. Un dossier
 * dont les keywords ne matchent rien ressort en 'unknown', signal
 * explicite que la classification a echoue. Voir bug Platypus Craft,
 * mai 2026 : vocabulaire FR nautique non couvert, retombait en
 * software_pure, ouvrait la porte a Zalando / Deezer / HelloFresh.
 */
function detectAssetClass(sector: string | null, subSector: string | null): string {
  const s = (sector || '').toLowerCase();
  const sub = (subSector || '').toLowerCase();
  const combined = `${s} ${sub}`;

  // Deep tech research : quantum, fusion, carbon
  if (/quantum|fusion|carbon capture|carbon removal|carbon transformation/.test(combined)) {
    return 'deep_tech_research';
  }
  // Infrastructure physique : usines, batteries grid
  if (/battery manufacturing|battery recycling|gigafactory|green steel|hydrogen|industrial decarbonization|materials/.test(combined)) {
    return 'infrastructure_physical';
  }
  // Hardware industriel : drones, defense, EV, eVTOL, robotics, aerospace, mobilite
  // FR ajoute : navire, navires, navale, nautique, nautisme, bateau,
  // bateaux, sous-marin, semi-submersible, chantier naval. Sans ces
  // keywords, un dossier Platypus Craft francophone ressortait en
  // software_pure et matchait Zalando / Deezer / HelloFresh.
  if (/drone|defense|counter-drone|evtol|aviation|aerospace|robot|humanoid|warehouse robotics|industrial automation|industrial robotics|mobility|automotive|ev \/|autonomous|maritime|ship|boat|submersible|nautical|naval|navale|navires?|nautique|nautisme|bateaux?|sous-marin|semi-submersible|chantier naval|shipyard|shipbuilding|additive manufacturing/.test(combined)) {
    return 'hardware_industrial';
  }
  // Hardware industriel : energy storage, hydrogen
  if (/energy storage|fleet/.test(combined)) {
    return 'hardware_industrial';
  }
  // Hardware consumer
  if (/wearable|consumer hardware/.test(combined)) {
    return 'hardware_consumer';
  }
  // Cybersecurity industriel / cyber-physical
  if (/cyber-physical|industrial cyber|industrial iot/.test(combined)) {
    return 'software_with_hardware';
  }
  // Signal software explicite : SaaS, AI, marketplace, fintech, etc.
  if (/saas|software|logiciel|enterprise software|cloud|api\b|platform|plateforme|marketplace|ai\b|llm|generative|fintech|payment|banking|adtech|edtech|proptech|healthtech|gaming|streaming|content|media|publishing|cybersecurity|cyber security/.test(combined)) {
    return 'software_pure';
  }
  // Aucun signal exploitable : classification indeterminee. Le hard
  // filter se desactive (target unknown -> on laisse passer) plutot
  // que de pretendre que c est du software par defaut.
  return 'unknown';
}

/**
 * Mapping de la classe d actif "matrice" (sector-benchmarks /
 * relevance-matrix) vers le vocabulaire "comparables historiques".
 * Permet a extractFeaturesFromAnalysis de lire matrix.assetClass
 * comme source de verite plutot que de re-classifier sur sector +
 * subSector. La matrice arbitre deja entre indice sectoriel et
 * productionChain (cf. deriveAssetClass dans relevance-matrix.ts).
 */
function mapMatrixAssetClassToComparable(matrixClass: string | null | undefined): string | null {
  if (!matrixClass) return null;
  switch (matrixClass) {
    case 'industrial-hardware':
      return 'hardware_industrial';
    case 'defense':
      return 'hardware_industrial';
    case 'climate-tech':
      // Climate-tech mixte : si la chaine est hardware physique
      // (eolien, panneaux, batteries), la classe pertinente est
      // infrastructure_physical. Sinon software cleantech. On choisit
      // infrastructure_physical par defaut car le mismatch
      // doctrinal le plus couteux est hardware climate compare a
      // SaaS climate (cas Northvolt vs SaaS carbon accounting).
      return 'infrastructure_physical';
    case 'deeptech':
      return 'deep_tech_research';
    case 'healthtech':
      // Healthtech couvre digital health (software) et medtech
      // dispositif (hardware). On laisse software_with_hardware qui
      // est le compromis le moins restrictif des deux registres.
      return 'software_with_hardware';
    case 'saas-b2b':
    case 'cybersecurity':
    case 'ai-generative':
    case 'fintech':
    case 'marketplace-b2c':
    case 'ecommerce-dtc':
    case 'adtech':
    case 'edtech':
    case 'proptech':
    case 'logistics':
    case 'mediatech':
    case 'sportstech':
    case 'services-b2b':
    case 'hospitality':
    case 'foodtech':
      return 'software_pure';
    case 'profitable-mature':
      // Multiples EBITDA : ne contraint pas la classe hardware/soft.
      // On laisse l indeterminisme et le filtre cle reste permissif.
      return null;
    case 'unclassified':
    default:
      return null;
  }
}

/**
 * Verifie la compatibilite d asset class entre dossier et comparable.
 * Hard filter : retourne false si les classes sont incompatibles.
 *
 * Regles :
 *  - hardware_industrial est compatible avec hardware_industrial,
 *    infrastructure_physical, deep_tech_research, hardware_consumer
 *  - infrastructure_physical avec lui-meme + hardware_industrial + deep_tech
 *  - deep_tech_research avec lui-meme + hardware_industrial + infra physical
 *  - software_pure avec software_pure et software_with_hardware
 *  - software_with_hardware compatible large (peut etre compare avec tous)
 *
 * Le but est d eviter qu un dossier de construction navale soit compare
 * a une marketplace e-commerce, meme si les patterns transversaux semblent
 * similaires.
 */
function isAssetClassCompatible(target: string, ref: string | null): boolean {
  // Cible indeterminee : on ne dispose pas de signal pour filtrer,
  // on laisse passer et le scoring sectoriel / sub-sector / region
  // fait le tri. Comportement explicitement permissif, pas un
  // contournement silencieux.
  if (target === 'unknown') return true;
  if (!ref) return true; // legacy V3 sans asset_class : on laisse passer
  if (target === ref) return true;

  const HARD_GROUP = ['hardware_industrial', 'infrastructure_physical', 'deep_tech_research', 'hardware_consumer'];
  const SOFT_GROUP = ['software_pure', 'software_with_hardware'];

  if (HARD_GROUP.includes(target) && HARD_GROUP.includes(ref)) return true;
  if (SOFT_GROUP.includes(target) && SOFT_GROUP.includes(ref)) return true;
  // software_with_hardware peut etre compare avec hardware_industrial
  // (cas frontiere : Tesla, Apple, Rivian). Le pont est volontairement
  // restreint a cette paire : un dossier hardware_industrial pur ne
  // doit jamais matcher un software_pure (cas Zalando / Deezer /
  // HelloFresh contre Platypus Craft, mai 2026).
  if (target === 'software_with_hardware' && ref === 'hardware_industrial') return true;
  if (target === 'hardware_industrial' && ref === 'software_with_hardware') return true;

  return false;
}

// ============================================================
// V5 : FUNDING BAND
// ------------------------------------------------------------
// Bandes ordonnees du plus tot au plus tard. La distance entre deux
// bandes est leur ecart d index. On considere comme stage-aligned un
// comparable a +/- 1 bande (seed peut etre compare a pre-seed et
// series_a, mais pas series_b et au-dela).
// ============================================================

const FUNDING_BAND_ORDER: Array<NonNullable<ComparableFeatures['fundingBand']>> = [
  'pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus', 'late_ipo'
];

function fundingBandIndex(band: string | null | undefined): number {
  if (!band) return -1;
  const idx = FUNDING_BAND_ORDER.indexOf(band as any);
  return idx;
}

/**
 * Detecte la funding_band d un dossier a partir de son tour annonce
 * et du montant leve. La regle :
 *   - On parse le stage en priorite (seed, series A, etc.). Le LLM
 *     retourne typiquement "seed", "Series A", "Pre-Seed", etc.
 *   - Si le stage est ambigu, on tombe sur le montant. < 1.5M = pre_seed,
 *     1.5-5M = seed, 5-20M = series_a, 20-60M = series_b, 60-200M =
 *     series_c_plus, > 200M = late_ipo.
 *   - Devise : on assume EUR par defaut. Conversion grossiere USD = EUR
 *     pour ces ordres de grandeur (le bucket est insensible aux 10-15%
 *     d ecart de change).
 *
 * Retourne null si on ne peut rien inferer. Dans ce cas, le moteur
 * desactive le hard filter funding_band pour ce dossier (legacy).
 */
function detectFundingBand(
  stageStr: string | null | undefined,
  amountStr: string | null | undefined,
): NonNullable<ComparableFeatures['fundingBand']> | null {
  // 1. Parse stage en priorite
  if (stageStr) {
    const s = stageStr.toLowerCase().trim();
    if (/pre[\s-]?seed|preseed/.test(s)) return 'pre_seed';
    if (/seed/.test(s) && !/series/.test(s)) return 'seed';
    if (/series\s*a\b/.test(s)) return 'series_a';
    if (/series\s*b\b/.test(s)) return 'series_b';
    if (/series\s*c\b/.test(s)) return 'series_c_plus';
    if (/series\s*d|series\s*e|growth|late|pre[\s-]?ipo|ipo/.test(s)) return 'late_ipo';
  }

  // 2. Fallback sur montant. Parse rough : extrait un nombre + unite.
  if (amountStr) {
    const a = amountStr.toLowerCase().replace(/[\s,]/g, '');
    // Match patterns : 1.5m€, 1.5m, 15m, 100k, 1bn, 1md, etc.
    const num = a.match(/([\d.]+)\s*(k|m|md|bn|b)?\s*(€|eur|\$|usd|gbp|£)?/);
    if (num) {
      let value = parseFloat(num[1]);
      const unit = (num[2] || '').toLowerCase();
      if (unit === 'k') value = value / 1000;       // M
      else if (unit === 'md' || unit === 'bn' || unit === 'b') value = value * 1000;
      // sinon assume M par defaut

      if (value < 1.5) return 'pre_seed';
      if (value < 5) return 'seed';
      if (value < 20) return 'series_a';
      if (value < 60) return 'series_b';
      if (value < 200) return 'series_c_plus';
      return 'late_ipo';
    }
  }

  return null;
}

/**
 * Verifie la compatibilite de funding_band entre dossier et comparable.
 * Tier 'stage_aligned' : meme bande +/- 1.
 * Tier 'longitudinal'  : passe l asset_class mais hors fenetre funding.
 * Si une des deux valeurs est null, on traite comme stage_aligned
 * (legacy : l absence de donnee ne doit pas exclure les comparables qu
 * on a deja patiemment scores).
 */
function classifyFundingMatch(
  target: string | null | undefined,
  ref: string | null | undefined,
): 'stage_aligned' | 'longitudinal' {
  const ti = fundingBandIndex(target);
  const ri = fundingBandIndex(ref);
  if (ti < 0 || ri < 0) return 'stage_aligned'; // legacy
  if (Math.abs(ti - ri) <= 1) return 'stage_aligned';
  return 'longitudinal';
}

/**
 * Detecte le sector_subgroup a partir du sector / sub_sector / pitch.
 * Retourne null si rien ne matche. Le subgroup sert de boost de
 * similarite, pas de hard filter.
 */
function detectSectorSubgroup(
  sector: string | null,
  subSector: string | null,
  rawText?: string | null,
): string | null {
  const combined = `${sector || ''} ${subSector || ''} ${rawText || ''}`.toLowerCase();

  // Media social video (vs media generique)
  if (/social video|video social|media video|popmed|short[\s-]?form video/.test(combined)) {
    return 'social_video_media';
  }
  // Foundation models / LLMs
  if (/foundation model|llm|large language model|generative ai|gen[\s-]?ai/.test(combined)) {
    return 'foundation_models';
  }
  // Quantum hardware
  if (/quantum/.test(combined)) {
    return 'quantum_hardware';
  }
  // eVTOL aviation
  if (/evtol|electric vertical|electric aviation|urban air mobility/.test(combined)) {
    return 'evtol_aviation';
  }
  // Battery cell manufacturing
  if (/battery cell|gigafactory|cell manufacturing|battery manufacturing/.test(combined)) {
    return 'battery_cell_manufacturing';
  }
  // OEM auto (vs ride hailing)
  if (/oem|automaker|car manufacturer|automotive manufacturer|electric vehicle manufacturer/.test(combined)) {
    return 'oem_auto';
  }
  // Ride hailing / VTC
  if (/ride[\s-]?hailing|vtc|carpooling|ride[\s-]?sharing/.test(combined)) {
    return 'ride_hailing';
  }
  // Alternative protein / insectes
  if (/alternative protein|plant[\s-]?based protein|insect protein|cellular agriculture/.test(combined)) {
    return 'alternative_protein';
  }
  // Real estate tech
  if (/real estate tech|proptech|coworking|flex office/.test(combined)) {
    return 'real_estate_tech';
  }
  // Humanoid robotics
  if (/humanoid|humanoid robot/.test(combined)) {
    return 'humanoid_robotics';
  }
  // Warehouse robotics
  if (/warehouse robot|fulfillment robot|logistics automation/.test(combined)) {
    return 'warehouse_robotics';
  }

  return null;
}

/**
 * Verifie si le dossier satisfait les conditions narrative_specificity
 * d un comparable vedette. Si le comparable n a pas de narrative_specificity,
 * il passe librement (comportement V4). Si il en a, le dossier doit
 * matcher l asset_class et avoir au moins le funding_band_min requis.
 *
 * Empeche que Ynsect ne sorte sur une seed media social, ou que WeWork
 * ne sorte sur une fintech B2B.
 */
function passesNarrativeSpecificity(
  spec: NarrativeSpecificity | null,
  targetAssetClass: string,
  targetFundingBand: string | null | undefined,
): boolean {
  if (!spec || !spec.requires) return true; // pas de garde-fou : libre

  const req = spec.requires;

  // Filtre asset_class
  if (req.asset_class && req.asset_class.length > 0) {
    if (!req.asset_class.includes(targetAssetClass)) return false;
  }

  // Filtre funding_band minimum
  if (req.funding_band_min) {
    const minIdx = fundingBandIndex(req.funding_band_min);
    const targetIdx = fundingBandIndex(targetFundingBand);
    // Si le dossier n a pas de funding_band, on est strict : on filtre
    // (mieux vaut pas invoquer un comparable specifique sans donnee).
    if (targetIdx < 0) return false;
    if (targetIdx < minIdx) return false;
  }

  return true;
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

  // Determine la region effective du dossier pour le boost
  // regional. On utilise le pays s il est dispo, sinon rien.
  const dossierRegion = features.country || null;

  // Detecte la classe d actif du dossier en cours. C est ce qui declenche
  // le hard filter contre les comparables incompatibles. Un dossier de
  // construction navale (hardware industrial) ne sera jamais matche avec
  // une marketplace e-commerce (software pure), meme si les patterns
  // transversaux semblent similaires.
  const targetAssetClass = features.assetClass
    || detectAssetClass(features.sector, features.subSector || null);

  // V5 : funding_band cible. Si features.fundingBand est null, le hard
  // filter funding est desactive (legacy). Note : la separation
  // stage_aligned vs longitudinal n a de sens que si on connait la bande
  // du dossier en cours, sinon on retombe sur le comportement V4.
  const targetFundingBand = features.fundingBand || null;

  // V5 : sector_subgroup cible. Boost de similarite si match.
  const targetSectorSubgroup = features.sectorSubgroup || null;

  // Calcul similarite pour chaque ligne. V3 : la majorite des lignes
  // n ont pas de scores 6 dimensions. Strategie :
  //  - Hard filter prealable : si asset_class incompatible, exclu d office
  //  - V5 : narrative_specificity filtre sur les vedettes
  //  - V5 : funding_band classifie en stage_aligned ou longitudinal
  //  - Si la ligne a des scores numeriques : matching ponderee
  //  - Sinon : fallback sur match sectoriel + sub-sector + region
  // Le boost data_quality intervient en post : High = 1.0, Medium = 0.92,
  // Low = 0.78. Le boost vc_relevance_score est applique en queue : 5 -> +5%
  // pour que les comparables VC-grade remontent prioritairement quand le
  // matching est ex-aequo.
  const scoredAll = rows.map((row: any) => {
    // HARD FILTER asset_class : on calcule la compatibilite mais on ne filtre pas
    // encore. Si incompatible, similarity sera plombe a 0 plus bas.
    const compatibleClass = isAssetClassCompatible(targetAssetClass, row.asset_class || null);

    // V5 : narrative_specificity. Si le comparable a un tag de specificite
    // narrative et que le dossier ne satisfait pas les conditions, on l ecarte
    // (similarity 0). Empeche Ynsect / WeWork / Theranos de sortir hors contexte.
    const narrativeSpec: NarrativeSpecificity | null = row.narrative_specificity || null;
    const passesNarrative = passesNarrativeSpecificity(
      narrativeSpec,
      targetAssetClass,
      targetFundingBand,
    );

    // V5 : tier funding_band. stage_aligned = +/- 1 bande. longitudinal sinon.
    const matchTier = classifyFundingMatch(targetFundingBand, row.funding_band || null);

    const sectorMatch = matchSector(features.sector, row.sector);
    const sectorBoost = sectorMatch === 'exact' ? 0.30 : sectorMatch === 'related' ? 0.15 : 0;

    const subSectorScore = matchSubSector(
      features.subSector || null,
      row.subsector || row.sub_sector || null,
    );

    // V5 : sector_subgroup boost. Si les deux subgroups matchent, on
    // ajoute un petit bonus de similarite (eviter qu un foundation_models
    // soit noye dans les SaaS AI generiques).
    const subgroupMatch = targetSectorSubgroup
      && row.sector_subgroup
      && targetSectorSubgroup === row.sector_subgroup
      ? 1 : 0;

    const regionScore = matchRegion(dossierRegion, row.region || row.country || null);

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
      similarity += subSectorScore * 0.05;
      similarity += regionScore * 0.03;
      similarity += subgroupMatch * 0.08; // V5 : boost subgroup
    } else {
      let base: number;
      if (sectorMatch === 'exact') base = 0.30;
      else if (sectorMatch === 'related') base = 0.20;
      else base = 0.05;
      similarity = base + (subSectorScore * 0.30) + (regionScore * 0.10);
      similarity += subgroupMatch * 0.15; // V5 : boost subgroup (fallback plus genereux)
    }

    // Pondération data_quality
    const qualityWeight = row.data_quality === 'High' ? 1.0
      : row.data_quality === 'Medium' ? 0.92
      : row.data_quality === 'Low' ? 0.78
      : 0.85;
    similarity = similarity * qualityWeight;

    // Boost vc_relevance_score : prioritise les comparables VC-grade
    // (5 = 1.05x boost, 4 = 1.02x, 3 = 1.0x, en dessous penalite douce).
    const vcScore = typeof row.vc_relevance_score === 'number' ? row.vc_relevance_score : 3;
    const vcBoost = vcScore >= 5 ? 1.05
      : vcScore >= 4 ? 1.02
      : vcScore >= 3 ? 1.0
      : 0.92;
    similarity = similarity * vcBoost;

    // HARD FILTERS appliques en dernier : si asset class incompatible OU
    // narrative_specificity non satisfaite, on plombe la similarity a 0
    // pour que la ligne disparaisse des deux blocs.
    if (!compatibleClass || !passesNarrative) {
      similarity = 0;
    }

    similarity = Math.max(0, Math.min(1, similarity));

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
      assetClass: row.asset_class,
      vcRelevanceScore: row.vc_relevance_score,
      capitalIntensity: row.capital_intensity,
      verticalV4: row.vertical_v4,
      source2: row.source_2,
      whatMadeItWork: row.what_made_it_work,
      keyRisksLessons: row.key_risks_lessons,
      fundingBand: row.funding_band || null,
      sectorSubgroup: row.sector_subgroup || null,
      totalRaisedAmount: row.total_raised_amount || null,
      totalRaisedCurrency: row.total_raised_currency || null,
      totalRaisedAsOf: row.total_raised_as_of || null,
      narrativeSpecificity: narrativeSpec,
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
      matchTier,
    };
    return comparable;
  });

  // On exclut les lignes a similarity 0 (filtre asset_class + narrative)
  const scored = scoredAll.filter((c) => c.similarity > 0);

  // V5 : separation en deux blocs.
  // - stage_aligned : utilise pour le scoring de probabilite et la
  //   trajectoire. C est le bloc qui calibre le verdict.
  // - longitudinal : valeur narrative seulement (ex Brut a scale, Likee,
  //   Rumble pour un dossier seed). Affiche dans la note d investissement
  //   sous une rubrique distincte.
  const stageAligned = scored.filter((c) => c.matchTier === 'stage_aligned');
  const longitudinal = scored.filter((c) => c.matchTier === 'longitudinal');

  stageAligned.sort((a, b) => b.similarity - a.similarity);
  longitudinal.sort((a, b) => b.similarity - a.similarity);

  const topComparables = stageAligned.slice(0, topN);
  const topComparablesLongitudinal = longitudinal.slice(0, Math.min(3, topN));

  // Distribution des outcomes sur le topN stage_aligned uniquement
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
  // Sinon mixed. Calcule sur stage_aligned uniquement.
  let dominantPattern: 'success-leaning' | 'fail-leaning' | 'mixed' = 'mixed';
  if (outcomeDistribution.total > 0) {
    if (outcomeDistribution.success / outcomeDistribution.total > 0.5) {
      dominantPattern = 'success-leaning';
    } else if (outcomeDistribution.fail / outcomeDistribution.total > 0.3) {
      dominantPattern = 'fail-leaning';
    }
  }

  // Cas le plus proche en succes et en echec sur stage_aligned uniquement
  const successCases = stageAligned.filter((c) => c.outcome.startsWith('success'));
  const failCases = stageAligned.filter((c) => c.outcome.startsWith('fail'));
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
    topComparablesLongitudinal,
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
 * Extrait un feature vector corpus historique a partir d un OrchestratedResult Prelude.
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
  } else if (/\b(media|entertainment|video social|content|publisher|publishing|press)\b/.test(sectorLower)) {
    // V5 : ajout du secteur Media. Couvre social video, content, edition.
    // Le sector_subgroup affinera (social_video_media vs publishing).
    sector = 'Media';
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

  // V5 : detection funding_band depuis l extraction (stage + amount).
  const fundingBand = detectFundingBand(
    result.extraction?.fundraise?.stage || null,
    result.extraction?.fundraise?.amount || null,
  );

  // V5 : detection sector_subgroup. On lit le rawSummary en plus du sector
  // / subSector pour capturer les indices vocabulaires (PopMed, social video,
  // foundation models, etc.).
  const sectorSubgroup = detectSectorSubgroup(
    sector,
    result.extraction?.subSector || null,
    result.extraction?.rawSummary || null,
  );

  // Source de verite : la matrice de pertinence arbitre l asset class
  // a partir du productionChain detecte sur le texte complet du
  // dossier. On lit cette valeur en priorite, on retombe sur la
  // classification locale uniquement quand la matrice est absente
  // (anciens resultats sans matrice persistee). Voir bug Platypus
  // Craft, mai 2026 : la classification locale sur sector + subSector
  // ratait le vocabulaire FR nautique et retombait en software_pure,
  // ce qui ouvrait la porte a Zalando / Deezer / HelloFresh.
  const matrixAssetClass = mapMatrixAssetClassToComparable(
    result.relevanceMatrix?.assetClass,
  );
  const resolvedAssetClass = matrixAssetClass
    || detectAssetClass(sector, result.extraction?.subSector || null);

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
    assetClass: resolvedAssetClass,
    fundingBand,
    sectorSubgroup,
  };
}
