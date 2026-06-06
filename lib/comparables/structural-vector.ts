// ============================================================
// VECTEUR STRUCTUREL UNIVERSEL DES COMPARABLES
// ------------------------------------------------------------
// Module pur (sans I/O ni keywords sectoriels) qui derive un
// vecteur structurel pour tout dossier ou comparable historique
// a partir de ses proprietes economiques.
//
// Le vecteur sert au moteur de comparables :
//   - hard gate sur economic_nature (industrial-hardware / deeptech /
//     software-pur / marketplace / services). Un candidat qui ne
//     partage pas cette nature peut etre pattern, jamais sectoriel.
//   - axes structurels (revenue model, capital intensity, sales cycle,
//     regulatory, reproducibility) ponderes fort dans le score.
//   - dimensions de marche multi-valuees ponderees plus bas
//     (mobilite passagers vs mobilite marchandises = ensembles
//     differents, pas un tag commun qui forcerait le match).
//   - bande de stade pour separer scoring du longitudinal.
//
// La derivation s appuie en priorite sur le perimetre deja calcule
// par relevance-matrix (assetClass, businessModel, productionChain).
// Aucune liste sectorielle codee en dur n est utilisee : le classifier
// raisonne sur les proprietes economiques universelles.
// ============================================================

export type EconomicNature =
  | 'industrial_hardware'  // fabrication d unites physiques vendues a l unite ou par projet
  | 'deeptech'             // recherche fondamentale + IP, cycle tres long
  | 'software_pure'        // SaaS, plateforme digitale, reproductibilite quasi infinie
  | 'marketplace'          // mise en relation, commissions sur GMV, two-sided
  | 'services'             // execution operationnelle B2B/B2C/B2G, marge sur temps
  | 'unknown';

export type RevenueModel =
  | 'unit_sale'        // vente d unites physiques ou de licences perpetuelles
  | 'subscription'     // abonnement recurrent (ARR/MRR)
  | 'commission'       // take rate sur transactions
  | 'license'          // licences logicielles ou IP
  | 'service_fee'      // facturation a l acte ou au projet
  | 'mixed'
  | 'unknown';

export type CapitalIntensity = 'low' | 'medium' | 'high' | 'very_high' | 'unknown';
export type SalesCycle = 'short' | 'medium' | 'long' | 'unknown';
export type RegulatoryExposure = 'low' | 'medium' | 'high' | 'unknown';
export type Reproducibility = 'asset_light' | 'asset_medium' | 'asset_heavy' | 'unknown';

export type FundingBand =
  | 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c_plus' | 'late_ipo' | 'unknown';

export interface StructuralVector {
  economicNature: EconomicNature;
  revenueModel: RevenueModel;
  capitalIntensity: CapitalIntensity;
  salesCycle: SalesCycle;
  regulatoryExposure: RegulatoryExposure;
  reproducibility: Reproducibility;
  // Tags orthogonaux multi-valuees du perimetre marche. Ex
  // ['passenger', 'maritime', 'b2c', 'eco_tourism']. La similarite
  // calcule un Jaccard sur ces ensembles, donc passenger != freight,
  // maritime != terrestre, b2c != b2b. Aucune liste sectorielle ici :
  // ce sont des attributs universels du dossier.
  marketDimensions: string[];
  fundingBand: FundingBand;
}

export interface MatchExplanation {
  matchedAxes: string[];      // axes ou les valeurs sont identiques
  divergentAxes: string[];    // axes ou les valeurs different (mais ne bloquent pas)
  gatedAxes: string[];        // axes qui font echouer le hard gate (similarity = 0)
  similarity: number;         // [0, 1]
  passesFloor: boolean;
  passesHardGate: boolean;
  // Tier du match. Trois etats utiles :
  //   sectoral_direct  : passe hard gate + plancher + bande de stade -> top du widget
  //   structural_pattern : passe hard gate + plancher mais hors bande de stade -> longitudinal
  //   rejected         : echec hard gate ou sous le plancher -> exclu du scoring
  matchTier: 'sectoral_direct' | 'structural_pattern' | 'rejected';
}

// ============================================================
// MATRICE DE PERTINENCE CENTRALISEE
// ------------------------------------------------------------
// Un seul jeu de poids et un seul plancher pour tout le moteur.
// Valeurs de depart, a ajuster apres un run reel. Les poids sont
// normalises a 1 sur la somme des axes evalues : un axe en
// unknown n est pas compte au denominateur.
// ============================================================

export const MATCHING_CONFIG = {
  weights: {
    // Axes structurels (poids fort) : ce qui fait reussir ou echouer
    // un dossier de meme nature economique.
    revenueModel: 0.20,
    capitalIntensity: 0.20,
    salesCycle: 0.15,
    regulatoryExposure: 0.10,
    reproducibility: 0.15,
    // Stade de financement : meme classe a +/- 1 bande
    fundingBand: 0.10,
    // Dimensions de marche : poids plus bas, multi-valuees
    marketDimensions: 0.10,
  },
  // Plancher de similarite. En dessous, le candidat ne peut pas
  // apparaitre dans le widget top 5 ni dans le bloc narratif scoring.
  // Valeur de depart, a calibrer apres un premier run.
  floor: 0.40,
  // Tolerance pour la bande de stade. ±1 = seed peut etre compare a
  // pre-seed et series A, pas au-dela. Hors de cette tolerance, le
  // candidat bascule en longitudinal (valeur narrative, hors scoring).
  fundingBandTolerance: 1,
};

const FUNDING_BAND_ORDER: FundingBand[] = [
  'pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus', 'late_ipo',
];

function fundingIndex(band: FundingBand): number {
  if (band === 'unknown') return -1;
  return FUNDING_BAND_ORDER.indexOf(band);
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// ============================================================
// HARD GATE
// ------------------------------------------------------------
// La nature economique est le filtre dur. Un industrial-hardware ne
// peut etre compare sectoriellement qu a un autre industrial-hardware.
// Si l une des deux natures est unknown, on laisse passer (mieux vaut
// un match indecis qu un rejet a priori), mais le scoring aval
// penalisera l absence d evidence.
// ============================================================

export function passesHardGate(
  target: StructuralVector,
  candidate: StructuralVector,
): { passes: boolean; reason: string } {
  if (target.economicNature === 'unknown' || candidate.economicNature === 'unknown') {
    return {
      passes: true,
      reason: 'economic_nature inconnue sur un des deux cotes, hard gate desactive',
    };
  }
  if (target.economicNature !== candidate.economicNature) {
    return {
      passes: false,
      reason: `economic_nature differente (cible ${target.economicNature}, candidat ${candidate.economicNature})`,
    };
  }
  return { passes: true, reason: `economic_nature partagee (${target.economicNature})` };
}

// ============================================================
// SCORING
// ============================================================

function scoreAxis(
  axisName: string,
  targetValue: string,
  candidateValue: string,
  weight: number,
): { weighted: number; weightUsed: number; matched: boolean; diverged: boolean; label: string } {
  if (targetValue === 'unknown' || candidateValue === 'unknown') {
    return { weighted: 0, weightUsed: 0, matched: false, diverged: false, label: '' };
  }
  if (targetValue === candidateValue) {
    return {
      weighted: weight,
      weightUsed: weight,
      matched: true,
      diverged: false,
      label: `${axisName}:${targetValue}`,
    };
  }
  return {
    weighted: 0,
    weightUsed: weight,
    matched: false,
    diverged: true,
    label: `${axisName}:${targetValue}≠${candidateValue}`,
  };
}

function scoreFundingBand(
  target: FundingBand,
  candidate: FundingBand,
  weight: number,
): { weighted: number; weightUsed: number; matched: boolean; diverged: boolean; label: string; distance: number } {
  const ti = fundingIndex(target);
  const ci = fundingIndex(candidate);
  if (ti < 0 || ci < 0) {
    return { weighted: 0, weightUsed: 0, matched: false, diverged: false, label: '', distance: -1 };
  }
  const distance = Math.abs(ti - ci);
  if (distance === 0) {
    return {
      weighted: weight, weightUsed: weight, matched: true, diverged: false,
      label: `fundingBand:${target}`, distance,
    };
  }
  if (distance <= MATCHING_CONFIG.fundingBandTolerance) {
    const proximity = 1 - distance / (MATCHING_CONFIG.fundingBandTolerance + 1);
    return {
      weighted: weight * proximity, weightUsed: weight, matched: false, diverged: false,
      label: `fundingBand:${target}~${candidate}`, distance,
    };
  }
  return {
    weighted: 0, weightUsed: weight, matched: false, diverged: true,
    label: `fundingBand:${target}≠${candidate}`, distance,
  };
}

function scoreMarketDimensions(
  target: string[],
  candidate: string[],
  weight: number,
): { weighted: number; weightUsed: number; matched: boolean; label: string } {
  const a = new Set((target || []).map(normalize).filter(Boolean));
  const b = new Set((candidate || []).map(normalize).filter(Boolean));
  if (a.size === 0 && b.size === 0) {
    return { weighted: 0, weightUsed: 0, matched: false, label: '' };
  }
  const inter = Array.from(a).filter((x) => b.has(x));
  const union = new Set<string>();
  a.forEach((x) => union.add(x));
  b.forEach((x) => union.add(x));
  if (union.size === 0) {
    return { weighted: 0, weightUsed: 0, matched: false, label: '' };
  }
  const jaccard = inter.length / union.size;
  if (inter.length === 0) {
    return {
      weighted: 0, weightUsed: weight, matched: false,
      label: `marketDimensions:no_overlap`,
    };
  }
  return {
    weighted: weight * jaccard, weightUsed: weight, matched: true,
    label: `marketDimensions:[${inter.join(',')}]`,
  };
}

export function scoreMatch(
  target: StructuralVector,
  candidate: StructuralVector,
): MatchExplanation {
  const gate = passesHardGate(target, candidate);
  const matchedAxes: string[] = [];
  const divergentAxes: string[] = [];
  const gatedAxes: string[] = gate.passes ? [] : [`hardGate:${gate.reason}`];

  const w = MATCHING_CONFIG.weights;
  let weightedSum = 0;
  let totalWeight = 0;

  const structuralAxes: Array<{ axis: keyof typeof w; t: string; c: string }> = [
    { axis: 'revenueModel', t: target.revenueModel, c: candidate.revenueModel },
    { axis: 'capitalIntensity', t: target.capitalIntensity, c: candidate.capitalIntensity },
    { axis: 'salesCycle', t: target.salesCycle, c: candidate.salesCycle },
    { axis: 'regulatoryExposure', t: target.regulatoryExposure, c: candidate.regulatoryExposure },
    { axis: 'reproducibility', t: target.reproducibility, c: candidate.reproducibility },
  ];

  for (const { axis, t, c } of structuralAxes) {
    const r = scoreAxis(axis, t, c, w[axis]);
    weightedSum += r.weighted;
    totalWeight += r.weightUsed;
    if (r.matched) matchedAxes.push(r.label);
    else if (r.diverged) divergentAxes.push(r.label);
  }

  const fb = scoreFundingBand(target.fundingBand, candidate.fundingBand, w.fundingBand);
  weightedSum += fb.weighted;
  totalWeight += fb.weightUsed;
  if (fb.matched) matchedAxes.push(fb.label);
  else if (fb.diverged) divergentAxes.push(fb.label);

  const md = scoreMarketDimensions(target.marketDimensions, candidate.marketDimensions, w.marketDimensions);
  weightedSum += md.weighted;
  totalWeight += md.weightUsed;
  if (md.matched) matchedAxes.push(md.label);

  const similarity = totalWeight > 0 ? weightedSum / totalWeight : 0;
  // Si le hard gate echoue, on plombe la similarity. La trace reste
  // dans gatedAxes pour l auto-explication.
  const effectiveSimilarity = gate.passes ? similarity : 0;
  const passesFloor = gate.passes && effectiveSimilarity >= MATCHING_CONFIG.floor;

  let matchTier: MatchExplanation['matchTier'];
  if (!gate.passes || !passesFloor) {
    matchTier = 'rejected';
  } else {
    // Bande de stade : si distance > tolerance, longitudinal.
    if (fb.distance > MATCHING_CONFIG.fundingBandTolerance && fb.distance >= 0) {
      matchTier = 'structural_pattern';
    } else {
      matchTier = 'sectoral_direct';
    }
  }

  return {
    matchedAxes,
    divergentAxes,
    gatedAxes,
    similarity: effectiveSimilarity,
    passesFloor,
    passesHardGate: gate.passes,
    matchTier,
  };
}

// ============================================================
// CLASSIFIER : DERIVATION DU VECTEUR DEPUIS LE PERIMETRE
// ------------------------------------------------------------
// Le classifier s appuie en priorite sur les champs deja calcules
// par relevance-matrix : assetClass, businessModel, productionChain,
// supplyChainExposure, geopoliticalExposure, digitalReproducibility,
// acquisitionFunnel. Ce sont des proprietes economiques universelles.
//
// En l absence de relevance-matrix (resultats anciens ou comparables
// du corpus historique), on retombe sur les heuristiques de
// classification universelles (revenue model lu dans business model
// extrait, intensite capitalistique lue dans capital_intensity).
//
// AUCUNE regle ne reference un secteur ou un nom de societe.
// ============================================================

interface RelevanceMatrixLite {
  assetClass?: string;
  businessModel?: string;
  productionChain?: string;
  supplyChainExposure?: string;
  geopoliticalExposure?: string;
  digitalReproducibility?: string;
  acquisitionFunnel?: string;
}

interface ExtractionLite {
  businessModel?: string;
  productDescription?: string;
  marketPitch?: string;
  rawSummary?: string;
  sector?: string;
  subSector?: string;
  traction?: { metrics?: string[]; revenue?: string; growth?: string };
  fundraise?: { stage?: string; amount?: string };
}

// ----------------------------------------------------------------
// Helper : convertit un texte libre en un sac de tokens normalises
// ----------------------------------------------------------------
function tokenize(text: string): string[] {
  return normalize(text || '')
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2);
}

function hasAny(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((c) => tokens.has(c));
}

// ----------------------------------------------------------------
// Nature economique : derivation prioritaire depuis relevance-matrix.
// L axe de classification est productionChain x businessModel,
// les deux deja calcules par relevance-matrix sur des criteres
// generaux (chaine de production, modele de revenu).
// ----------------------------------------------------------------
function deriveEconomicNatureFromMatrix(matrix: RelevanceMatrixLite): EconomicNature {
  const pc = matrix.productionChain;
  const bm = matrix.businessModel;

  if (pc === 'hardware-physical' || pc === 'infrastructure-physical') {
    if (bm === 'marketplace') return 'marketplace';
    return 'industrial_hardware';
  }
  if (pc === 'wet-biotech') return 'deeptech';
  if (pc === 'pure-software') {
    if (bm === 'marketplace') return 'marketplace';
    if (bm === 'service-on-demand') return 'services';
    return 'software_pure';
  }
  if (pc === 'content-media') {
    if (bm === 'marketplace') return 'marketplace';
    return 'services';
  }
  if (pc === 'regulated-service') {
    if (bm === 'marketplace') return 'marketplace';
    return 'services';
  }

  if (bm === 'marketplace') return 'marketplace';
  if (bm === 'recurrent-saas' || bm === 'consumer-subscription') return 'software_pure';
  if (bm === 'unitary-sale' || bm === 'project-based') return 'industrial_hardware';
  if (bm === 'service-on-demand' || bm === 'contract-b2g') return 'services';

  return 'unknown';
}

// ----------------------------------------------------------------
// Fallback : derivation depuis texte libre. Pas de listes de
// secteurs ; uniquement des proprietes economiques (revenue
// recurrent vs unitaire, asset light vs heavy).
// ----------------------------------------------------------------
const REVENUE_TOKENS = {
  unit_sale: ['unite', 'units', 'unit', 'a l unite', 'per unit', 'manufactured', 'fabricated', 'vente', 'produit fini', 'finished product', 'shipbuild', 'shipyard', 'manufacturing'],
  subscription: ['saas', 'abonnement', 'subscription', 'recurring', 'arr', 'mrr', 'churn', 'expansion revenue'],
  commission: ['marketplace', 'commission', 'take rate', 'gmv', 'two sided', 'two-sided', 'plateforme c2c', 'place de marche'],
  license: ['license', 'licence', 'royalty', 'royalties', 'patent licensing', 'ip licensing'],
  service_fee: ['service fee', 'fee', 'consulting', 'conseil', 'agency', 'projet', 'project based', 'sow', 'time and materials'],
};

const CAPEX_HIGH_TOKENS = ['capex', 'gigafactory', 'usine', 'factory', 'manufacturing line', 'chantier', 'facility', 'fleet', 'plant', 'foundry'];
const CAPEX_LIGHT_TOKENS = ['asset light', 'asset-light', 'pure software', 'saas only', 'digital only'];

const SALES_LONG_TOKENS = ['enterprise sales', 'rfp', 'procurement', 'project based', 'long cycle', 'tender', 'appel d offres', 'contrat pluriannuel', 'design-in', 'qualification'];
const SALES_SHORT_TOKENS = ['self serve', 'self-serve', 'plg', 'product led growth', 'instant signup', 'self service', 'free trial'];

const REGULATED_TOKENS = ['certified', 'certification', 'easa', 'faa', 'ce mark', 'fda', 'ema', 'gxp', 'acpr', 'amf', 'regulated', 'reglementaire', 'compliance', 'agrement'];

function inferRevenueModel(matrix: RelevanceMatrixLite | undefined, extraction: ExtractionLite | undefined): RevenueModel {
  if (matrix) {
    if (matrix.businessModel === 'recurrent-saas' || matrix.businessModel === 'consumer-subscription') return 'subscription';
    if (matrix.businessModel === 'marketplace') return 'commission';
    if (matrix.businessModel === 'unitary-sale') return 'unit_sale';
    if (matrix.businessModel === 'service-on-demand' || matrix.businessModel === 'contract-b2g') return 'service_fee';
    if (matrix.businessModel === 'project-based') return 'service_fee';
    if (matrix.businessModel === 'hybrid') return 'mixed';
  }
  if (!extraction) return 'unknown';
  const text = `${extraction.businessModel || ''} ${extraction.productDescription || ''} ${extraction.marketPitch || ''} ${(extraction.traction?.metrics || []).join(' ')} ${extraction.traction?.revenue || ''}`;
  const tokens = new Set(tokenize(text));
  for (const [model, kws] of Object.entries(REVENUE_TOKENS)) {
    if (hasAny(tokens, kws.flatMap((k) => k.split(/\s+/)))) {
      return model as RevenueModel;
    }
  }
  return 'unknown';
}

function inferCapitalIntensity(matrix: RelevanceMatrixLite | undefined, extraction: ExtractionLite | undefined): CapitalIntensity {
  if (matrix) {
    if (matrix.productionChain === 'infrastructure-physical') return 'very_high';
    if (matrix.productionChain === 'hardware-physical') return 'high';
    if (matrix.productionChain === 'wet-biotech') return 'very_high';
    if (matrix.productionChain === 'pure-software') return 'low';
    if (matrix.productionChain === 'content-media') return 'medium';
    if (matrix.productionChain === 'regulated-service') return 'medium';
  }
  if (!extraction) return 'unknown';
  const text = `${extraction.productDescription || ''} ${extraction.marketPitch || ''} ${extraction.businessModel || ''}`;
  const tokens = new Set(tokenize(text));
  if (hasAny(tokens, CAPEX_HIGH_TOKENS.flatMap((k) => k.split(/\s+/)))) return 'high';
  if (hasAny(tokens, CAPEX_LIGHT_TOKENS.flatMap((k) => k.split(/\s+/)))) return 'low';
  return 'unknown';
}

function inferSalesCycle(matrix: RelevanceMatrixLite | undefined, extraction: ExtractionLite | undefined): SalesCycle {
  if (matrix) {
    if (matrix.businessModel === 'project-based' || matrix.businessModel === 'contract-b2g') return 'long';
    if (matrix.businessModel === 'unitary-sale') return 'long';
    if (matrix.businessModel === 'consumer-subscription' || matrix.businessModel === 'marketplace') return 'short';
    if (matrix.acquisitionFunnel === 'b2b-sales-led') return 'long';
    if (matrix.acquisitionFunnel === 'present') return 'short';
  }
  if (!extraction) return 'unknown';
  const text = `${extraction.businessModel || ''} ${extraction.productDescription || ''} ${(extraction.traction?.metrics || []).join(' ')}`;
  const tokens = new Set(tokenize(text));
  if (hasAny(tokens, SALES_LONG_TOKENS.flatMap((k) => k.split(/\s+/)))) return 'long';
  if (hasAny(tokens, SALES_SHORT_TOKENS.flatMap((k) => k.split(/\s+/)))) return 'short';
  return 'unknown';
}

function inferRegulatoryExposure(matrix: RelevanceMatrixLite | undefined, extraction: ExtractionLite | undefined): RegulatoryExposure {
  if (matrix) {
    if (matrix.geopoliticalExposure === 'high') return 'high';
    if (matrix.geopoliticalExposure === 'medium') return 'medium';
    if (matrix.geopoliticalExposure === 'low') return 'low';
  }
  if (!extraction) return 'unknown';
  const text = `${extraction.businessModel || ''} ${extraction.productDescription || ''} ${extraction.marketPitch || ''}`;
  const tokens = new Set(tokenize(text));
  if (hasAny(tokens, REGULATED_TOKENS.flatMap((k) => k.split(/\s+/)))) return 'high';
  return 'unknown';
}

function inferReproducibility(matrix: RelevanceMatrixLite | undefined, extraction: ExtractionLite | undefined): Reproducibility {
  if (matrix) {
    if (matrix.digitalReproducibility === 'high') return 'asset_light';
    if (matrix.digitalReproducibility === 'medium') return 'asset_medium';
    if (matrix.digitalReproducibility === 'low') return 'asset_heavy';
    if (matrix.productionChain === 'hardware-physical' || matrix.productionChain === 'infrastructure-physical') return 'asset_heavy';
    if (matrix.productionChain === 'pure-software') return 'asset_light';
    if (matrix.productionChain === 'wet-biotech') return 'asset_heavy';
  }
  if (!extraction) return 'unknown';
  const ci = inferCapitalIntensity(matrix, extraction);
  if (ci === 'very_high' || ci === 'high') return 'asset_heavy';
  if (ci === 'low') return 'asset_light';
  return 'unknown';
}

// ----------------------------------------------------------------
// Dimensions de marche : tags orthogonaux extraits du pitch.
// Pas de liste sectorielle ; on extrait des attributs universels
// (usager final, environnement physique, type d acheteur).
// ----------------------------------------------------------------
const USER_TYPE_TOKENS: Record<string, string[]> = {
  passenger: ['passenger', 'passagers', 'passager', 'tourist', 'touriste', 'voyageur', 'people', 'leisure'],
  freight: ['freight', 'cargo', 'goods', 'marchandise', 'marchandises', 'logistics', 'logistique', 'parcel'],
  professional: ['professional', 'enterprise', 'business client', 'b2b', 'corporate', 'industrial buyer'],
  consumer: ['consumer', 'b2c', 'd2c', 'dtc', 'household'],
};

const ENVIRONMENT_TOKENS: Record<string, string[]> = {
  maritime: ['maritime', 'marine', 'naval', 'navale', 'navire', 'bateau', 'sea', 'ocean', 'offshore', 'nautique', 'submersible'],
  aerial: ['aerial', 'aviation', 'aerospace', 'aeronautique', 'flight', 'drone', 'evtol', 'aircraft'],
  terrestrial: ['terrestrial', 'road', 'automotive', 'truck', 'rail', 'urban', 'street', 'ground'],
  space: ['space', 'satellite', 'orbital', 'spacecraft'],
  digital: ['digital', 'cloud', 'online', 'web', 'mobile app'],
};

const PURPOSE_TOKENS: Record<string, string[]> = {
  eco_tourism: ['eco', 'ecotourism', 'ecotourisme', 'tourism', 'tourisme', 'leisure'],
  defense: ['defense', 'defence', 'military', 'militaire', 'armee'],
  energy: ['energy', 'energie', 'renewable', 'hydrogen', 'battery'],
  health: ['health', 'medical', 'clinical', 'patient'],
  finance: ['finance', 'banking', 'payment', 'lending', 'insurance'],
};

function extractMarketDimensions(extraction: ExtractionLite | undefined): string[] {
  if (!extraction) return [];
  const text = `${extraction.sector || ''} ${extraction.subSector || ''} ${extraction.productDescription || ''} ${extraction.marketPitch || ''} ${extraction.rawSummary || ''} ${(extraction.traction?.metrics || []).join(' ')}`;
  const tokens = new Set(tokenize(text));
  const found: Set<string> = new Set();
  for (const [tag, kws] of Object.entries(USER_TYPE_TOKENS)) {
    if (hasAny(tokens, kws)) found.add(tag);
  }
  for (const [tag, kws] of Object.entries(ENVIRONMENT_TOKENS)) {
    if (hasAny(tokens, kws)) found.add(tag);
  }
  for (const [tag, kws] of Object.entries(PURPOSE_TOKENS)) {
    if (hasAny(tokens, kws)) found.add(tag);
  }
  return Array.from(found);
}

// ----------------------------------------------------------------
// Funding band : derivation depuis stage et amount (reutilise la
// meme logique que comparables-engine pour ne pas diverger).
// ----------------------------------------------------------------
function inferFundingBand(extraction: ExtractionLite | undefined): FundingBand {
  if (!extraction || !extraction.fundraise) return 'unknown';
  const stageStr = extraction.fundraise.stage || '';
  const amountStr = extraction.fundraise.amount || '';
  if (stageStr) {
    const s = stageStr.toLowerCase().trim();
    if (/pre[\s-]?seed|preseed/.test(s)) return 'pre_seed';
    if (/seed/.test(s) && !/series/.test(s)) return 'seed';
    if (/series\s*a\b/.test(s)) return 'series_a';
    if (/series\s*b\b/.test(s)) return 'series_b';
    if (/series\s*c\b/.test(s)) return 'series_c_plus';
    if (/series\s*d|series\s*e|growth|late|pre[\s-]?ipo|ipo/.test(s)) return 'late_ipo';
  }
  if (amountStr) {
    const a = amountStr.toLowerCase().replace(/[\s,]/g, '');
    const num = a.match(/([\d.]+)\s*(k|m|md|bn|b)?/);
    if (num) {
      let value = parseFloat(num[1]);
      const unit = (num[2] || '').toLowerCase();
      if (unit === 'k') value = value / 1000;
      else if (unit === 'md' || unit === 'bn' || unit === 'b') value = value * 1000;
      if (value < 1.5) return 'pre_seed';
      if (value < 5) return 'seed';
      if (value < 20) return 'series_a';
      if (value < 60) return 'series_b';
      if (value < 200) return 'series_c_plus';
      return 'late_ipo';
    }
  }
  return 'unknown';
}

export function inferStructuralVectorFromAnalysis(result: any): StructuralVector {
  const matrix: RelevanceMatrixLite | undefined = result?.relevanceMatrix;
  const extraction: ExtractionLite | undefined = result?.extraction;

  const economicNature = matrix
    ? deriveEconomicNatureFromMatrix(matrix)
    : 'unknown';

  return {
    economicNature,
    revenueModel: inferRevenueModel(matrix, extraction),
    capitalIntensity: inferCapitalIntensity(matrix, extraction),
    salesCycle: inferSalesCycle(matrix, extraction),
    regulatoryExposure: inferRegulatoryExposure(matrix, extraction),
    reproducibility: inferReproducibility(matrix, extraction),
    marketDimensions: extractMarketDimensions(extraction),
    fundingBand: inferFundingBand(extraction),
  };
}

// ----------------------------------------------------------------
// Classifier inverse : dérive le vecteur depuis une ligne du
// corpus historique. On lit asset_class, sector, subsector,
// capital_intensity, vertical_v4 — champs deja persistes. Aucune
// liste de noms de societes, aucune liste sectorielle hardcodee.
// ----------------------------------------------------------------
interface ComparableRowLite {
  asset_class?: string | null;
  sector?: string | null;
  sub_sector?: string | null;
  subsector?: string | null;
  capital_intensity?: string | null;
  vertical_v4?: string | null;
  funding_band?: string | null;
  outcome?: string | null;
}

function deriveEconomicNatureFromRow(row: ComparableRowLite): EconomicNature {
  const ac = (row.asset_class || '').toLowerCase();
  const sectorText = normalize(`${row.sector || ''} ${row.sub_sector || row.subsector || ''} ${row.vertical_v4 || ''}`);
  const tokens = new Set(tokenize(sectorText));

  // Marketplace est detectable par sa structure economique (commission
  // sur GMV) — visible dans le sector/vertical sous la forme du mot lui-meme.
  if (hasAny(tokens, ['marketplace', 'place'])) {
    return 'marketplace';
  }

  if (ac === 'hardware_industrial' || ac === 'infrastructure_physical' || ac === 'hardware_consumer') {
    return 'industrial_hardware';
  }
  if (ac === 'deep_tech_research') return 'deeptech';
  if (ac === 'software_pure' || ac === 'software_with_hardware') {
    // Sub-distinction marketplace vs services pour les rows software :
    // si vertical mentionne delivery/aggregator/two-sided, c est un marketplace.
    if (hasAny(tokens, ['delivery', 'aggregator', 'two', 'sided', 'platform'])) {
      return 'marketplace';
    }
    return 'software_pure';
  }

  // Sans asset_class fiable, on tente sur tokens du secteur.
  if (hasAny(tokens, ['delivery', 'food', 'aggregator'])) return 'marketplace';
  if (hasAny(tokens, ['naval', 'maritime', 'automotive', 'aerospace', 'manufacturing', 'industrial', 'hardware'])) return 'industrial_hardware';
  if (hasAny(tokens, ['biotech', 'medtech', 'quantum', 'fusion'])) return 'deeptech';
  if (hasAny(tokens, ['saas', 'software', 'platform'])) return 'software_pure';

  return 'unknown';
}

function deriveRevenueModelFromRow(row: ComparableRowLite, economicNature: EconomicNature): RevenueModel {
  switch (economicNature) {
    case 'industrial_hardware': return 'unit_sale';
    case 'software_pure': return 'subscription';
    case 'marketplace': return 'commission';
    case 'services': return 'service_fee';
    case 'deeptech': return 'mixed';
    default: return 'unknown';
  }
}

function deriveCapitalIntensityFromRow(row: ComparableRowLite): CapitalIntensity {
  const ci = (row.capital_intensity || '').toLowerCase();
  if (/very/.test(ci) && /high/.test(ci)) return 'very_high';
  if (/high/.test(ci)) return 'high';
  if (/medium/.test(ci)) return 'medium';
  if (/low/.test(ci)) return 'low';
  return 'unknown';
}

function deriveSalesCycleFromRow(row: ComparableRowLite, economicNature: EconomicNature): SalesCycle {
  if (economicNature === 'industrial_hardware') return 'long';
  if (economicNature === 'deeptech') return 'long';
  if (economicNature === 'software_pure') return 'short';
  if (economicNature === 'marketplace') return 'short';
  if (economicNature === 'services') return 'medium';
  return 'unknown';
}

function deriveReproducibilityFromRow(row: ComparableRowLite, economicNature: EconomicNature): Reproducibility {
  if (economicNature === 'industrial_hardware') return 'asset_heavy';
  if (economicNature === 'deeptech') return 'asset_heavy';
  if (economicNature === 'software_pure') return 'asset_light';
  if (economicNature === 'marketplace') return 'asset_light';
  if (economicNature === 'services') return 'asset_medium';
  return 'unknown';
}

function deriveFundingBandFromRow(row: ComparableRowLite): FundingBand {
  const fb = (row.funding_band || '').toLowerCase().trim();
  if (fb === 'pre_seed' || fb === 'seed' || fb === 'series_a' || fb === 'series_b'
      || fb === 'series_c_plus' || fb === 'late_ipo') return fb as FundingBand;
  return 'unknown';
}

function deriveMarketDimensionsFromRow(row: ComparableRowLite): string[] {
  const text = `${row.sector || ''} ${row.sub_sector || row.subsector || ''} ${row.vertical_v4 || ''}`;
  const tokens = new Set(tokenize(text));
  const found: Set<string> = new Set();
  for (const [tag, kws] of Object.entries(USER_TYPE_TOKENS)) {
    if (hasAny(tokens, kws)) found.add(tag);
  }
  for (const [tag, kws] of Object.entries(ENVIRONMENT_TOKENS)) {
    if (hasAny(tokens, kws)) found.add(tag);
  }
  for (const [tag, kws] of Object.entries(PURPOSE_TOKENS)) {
    if (hasAny(tokens, kws)) found.add(tag);
  }
  return Array.from(found);
}

export function inferStructuralVectorFromRow(row: ComparableRowLite): StructuralVector {
  const economicNature = deriveEconomicNatureFromRow(row);
  return {
    economicNature,
    revenueModel: deriveRevenueModelFromRow(row, economicNature),
    capitalIntensity: deriveCapitalIntensityFromRow(row),
    salesCycle: deriveSalesCycleFromRow(row, economicNature),
    regulatoryExposure: 'unknown',
    reproducibility: deriveReproducibilityFromRow(row, economicNature),
    marketDimensions: deriveMarketDimensionsFromRow(row),
    fundingBand: deriveFundingBandFromRow(row),
  };
}
