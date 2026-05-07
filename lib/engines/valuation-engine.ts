// ============================================================
// VALUATION ENGINE - Calcul de fourchette pre-money
// ------------------------------------------------------------
// Produit une fourchette de valorisation pre-money plausible pour
// le dossier instruit, en croisant trois methodes :
//
//   1. Multiples sectoriels (si revenue/ARR/GMV disponibles)
//   2. Methode VC inverse (si IRR cible et exit attendu)
//   3. Berkus / Scorecard (si pre-revenue, seed)
//
// Le moteur retourne :
//   - Une fourchette consolidee min/central/max
//   - Le detail de chaque methode applicable avec son rationale
//   - L analyse de dilution sur le ticket propose
//   - Les warnings methodologiques
//
// CALCUL DETERMINISTE : pas d appel LLM. Le code lit les outputs
// Bloc 1 (extraction, market, financial coherence, team) et
// produit le resultat. Auditabilite totale, pas de variabilite
// stochastique.
//
// PRINCIPE EDITORIAL : le moteur ne pretend pas predire la
// valorisation que la startup negociera. Il donne au partner une
// fourchette basee sur ce que le marche fait dans des dossiers
// comparables, et le partner ajuste a la marge en fonction de
// signaux qualitatifs non chiffrables. Comme le score, c est un
// ancrage, pas une oracle.
// ============================================================

import {
  getSectorMultiples,
  normalizeAssetClass,
  normalizeStage,
  type ValuationStage,
  type SectorMultipleRange,
} from '@/lib/data/sector-benchmarks';
import type { ExtractionOutput, FinancialCoherenceOutput, FinancialDataExtraction, TeamAnalysisOutput, MarketAnalysisOutput } from '@/lib/engines/types';

/**
 * Resultat d une methode de valorisation individuelle. Plusieurs
 * methodes peuvent s appliquer simultanement (ex : multiples ET
 * VC method) et leurs ranges sont consolides en final range.
 */
export interface ValuationMethodResult {
  method: 'sector-multiples' | 'vc-method' | 'berkus' | 'scorecard';
  /** Nom lisible pour la note. */
  label: string;
  /** True si la methode a pu produire un resultat exploitable. */
  applicable: boolean;
  /** Si non applicable, pourquoi. */
  notApplicableReason?: string;
  /** La fourchette pre-money en euros, si applicable. */
  range?: { min: number; central: number; max: number };
  /** Inputs utilises par la methode (pour transparence). */
  inputs?: Record<string, string | number | null>;
  /** Note metier sur le resultat (assumptions, limites). */
  rationale?: string;
}

/**
 * Resultat global du moteur de valorisation. C est ce qu on stocke
 * dans result.valuation et qu on affiche dans la note PDF.
 */
export interface ValuationOutput {
  /** Fourchette consolidee pre-money en euros. */
  recommendedRange: {
    min: number;
    central: number;
    max: number;
  } | null;
  /** Niveau de fiabilite global de la fourchette. */
  confidence: 'high' | 'medium' | 'low';
  /** Resultat detaille de chacune des methodes. */
  methods: ValuationMethodResult[];
  /** Si un ticket est mentionne dans le pitch, analyse de dilution. */
  dilutionAnalysis?: {
    proposedTicket: number;
    dilutionAtMin: number; // %
    dilutionAtCentral: number;
    dilutionAtMax: number;
    /** Note explicative en clair pour la note. */
    rationale: string;
  } | null;
  /** Asset class normalisee (saas-b2b, fintech, deeptech, etc.). */
  assetClass: string;
  /** Stade normalise (seed, series-a, series-b, series-c-plus). */
  stage: ValuationStage;
  /** Phrase de synthese editoriale pour le partner. */
  synthesis: string;
  /** Avertissements methodologiques a remonter. */
  warnings: string[];
  /** Sources des benchmarks utilises. */
  benchmarkSources: string[];
}

interface ValuationInput {
  extraction: ExtractionOutput | null | undefined;
  /** Output du moteur cohérence financière (tests T1-T7). */
  financial: FinancialCoherenceOutput | null | undefined;
  /** Output du moteur d'extraction financière : c'est ICI que vivent les
   * projections revenue/EBITDA/marge brute en millions d'euros, dérivées
   * du BP. Le moteur valuation lit prioritairement ces données pour
   * peupler les multiples sectoriels. */
  financialData?: FinancialDataExtraction | null | undefined;
  team: TeamAnalysisOutput | null | undefined;
  market: MarketAnalysisOutput | null | undefined;
  /** Score equipe mecanique (0-100) calcule par score-calculator. */
  teamScore?: number;
  /** Score marche mecanique (0-100). */
  marketScore?: number;
}

/**
 * Point d entree principal. Calcule la fourchette de valorisation a
 * partir des outputs Bloc 1 et des scores mecaniques.
 */
export function computeValuation(input: ValuationInput): ValuationOutput {
  // Mapping permissif : on accepte plusieurs sources possibles pour
  // l asset class (sector + subSector concatenes pour granularite max)
  // et pour le stade (fundraise.stage est le champ canonique).
  const ext: any = input.extraction;
  const assetClassRaw = ext
    ? `${ext.sector || ''} ${ext.subSector || ''}`.trim() || ext.sector
    : null;
  const stageRaw = ext?.fundraise?.stage || null;
  let assetClass = normalizeAssetClass(assetClassRaw);
  const stage = normalizeStage(stageRaw);

  // Detection automatique du cas 'profitable-mature' : si on est en
  // Series B+ et qu un EBITDA positif est extrait dans le pitch ou le
  // BP, c est la categorie pertinente. Les multiples EBITDA donnent
  // une fourchette plus precise que les multiples revenue sur ces
  // dossiers. La detection ne s active pas pour les cas SaaS pur ou
  // l EBITDA peut etre negatif tout en ayant des multiples ARR eleves.
  const ebitda = pickProjectionValue(input.financialData?.ebitdaProjection);
  const isLateStage = stage === 'series-b' || stage === 'series-c-plus';
  const isNonPureSaas = assetClass !== 'saas-b2b'
    && assetClass !== 'cybersecurity'
    && assetClass !== 'ai-generative';
  if (ebitda && ebitda > 0 && isLateStage && isNonPureSaas) {
    assetClass = 'profitable-mature';
  }

  // ---------- Methode 1 : multiples sectoriels
  const multiplesResult = computeBySectorMultiples(input, assetClass, stage);

  // ---------- Methode 2 : VC method inverse
  // Au seed pre-revenue, la VC inverse n est de toutes facons exclue
  // de la consolidation (poids 0). On la marque applicable=false des
  // l entree pour ne pas imprimer un rationnel saas-b2b decalibre
  // alors que la methode ne pese rien dans la fourchette finale.
  const isSeedPreRevenue = stage === 'seed' && !multiplesResult.applicable;
  const vcMethodResult = isSeedPreRevenue
    ? {
        method: 'vc-method' as const,
        label: 'Methode VC inverse',
        applicable: false,
        notApplicableReason: 'Methode reservee aux dossiers avec revenue exploitable. Au seed pre-revenue, la fourchette est ancree sur Berkus et Scorecard, qui valorisent l equipe et l opportunite avant traction commerciale, plutot que sur des exits sectoriels que la jeune entreprise n a pas encore les moyens de viser.',
      }
    : computeByVcMethod(input, assetClass, stage);

  // ---------- Methode 3 : Berkus / Scorecard (seed only)
  const berkusResult = stage === 'seed' ? computeByBerkus(input) : nonApplicableBerkus();
  const scorecardResult = stage === 'seed' ? computeByScorecard(input) : nonApplicableScorecard();

  const methods: ValuationMethodResult[] = [
    multiplesResult,
    vcMethodResult,
    berkusResult,
    scorecardResult,
  ];

  // ---------- Consolidation : moyenne ponderee des methodes applicables
  const applicableMethods = methods.filter((m) => m.applicable && m.range);
  const recommendedRange = consolidateRanges(applicableMethods, stage);

  // ---------- Confiance globale
  const confidence = determineConfidence(applicableMethods, assetClass, stage);

  // ---------- Analyse de dilution si ticket mentionne
  const ticket = parseTicketEur(input.extraction);
  const dilutionAnalysis = (recommendedRange && ticket)
    ? buildDilutionAnalysis(recommendedRange, ticket)
    : null;

  // ---------- Synthese editoriale
  const synthesis = buildSynthesis({
    recommendedRange,
    confidence,
    assetClass,
    stage,
    applicableMethods,
    dilutionAnalysis,
  });

  // ---------- Warnings
  const warnings = collectWarnings(input, applicableMethods, recommendedRange);

  return {
    recommendedRange,
    confidence,
    methods,
    dilutionAnalysis,
    assetClass,
    stage,
    synthesis,
    warnings,
    benchmarkSources: getBenchmarkSources(assetClass),
  };
}

// ============================================================
// METHODE 1 : MULTIPLES SECTORIELS
// ------------------------------------------------------------
// Si on a un revenue / ARR / GMV exploitable, on applique la plage
// de multiples du couple (asset-class, stade). On ajuste a la
// marge selon la qualite mesuree (team score eleve = plus pres du
// max, score faible = plus pres du min).
// ============================================================

function computeBySectorMultiples(
  input: ValuationInput,
  assetClass: string,
  stage: ValuationStage,
): ValuationMethodResult {
  const sector = getSectorMultiples(assetClass, stage);
  if (!sector) {
    return {
      method: 'sector-multiples',
      label: 'Multiples sectoriels',
      applicable: false,
      notApplicableReason: `Pas de plage de multiples definie pour ${assetClass} au stade ${stage}.`,
    };
  }

  const range = sector.range;
  const baseMetric = extractBaseMetric(input, range.multipleType);
  if (baseMetric === null) {
    return {
      method: 'sector-multiples',
      label: 'Multiples sectoriels',
      applicable: false,
      notApplicableReason: `Aucun ${range.multipleType.toUpperCase()} exploitable trouve dans le pitch ou le BP. La methode des multiples requiert une metrique de revenu mesurable.`,
    };
  }

  // Ajustement qualite : un score equipe + marche eleve pousse vers
  // le max de la plage, un score faible vers le min. L ajustement
  // est borne pour eviter de sortir de la plage benchmark.
  const qualitySignal = computeQualitySignal(input);
  // qualitySignal in [0, 1]. 0.5 = neutre.
  const min = baseMetric * range.min;
  const central = baseMetric * range.central;
  const max = baseMetric * range.max;
  const adjustedCentral = central + (max - central) * (qualitySignal - 0.5) * 0.6;

  return {
    method: 'sector-multiples',
    label: 'Multiples sectoriels',
    applicable: true,
    range: {
      min: Math.round(min),
      central: Math.round(adjustedCentral),
      max: Math.round(max),
    },
    inputs: {
      baseMetric,
      multipleType: range.multipleType,
      multipleRange: `${range.min}x - ${range.max}x`,
      assetClass,
      stage,
      qualitySignal: Math.round(qualitySignal * 100) / 100,
    },
    rationale: range.notes
      ? `Multiple ${range.multipleType.toUpperCase()} ${range.min}x-${range.max}x applique sur ${formatEur(baseMetric)} (${range.multipleType.toUpperCase()} declare). ${range.notes}`
      : `Multiple ${range.multipleType.toUpperCase()} ${range.min}x-${range.max}x applique sur ${formatEur(baseMetric)} (${range.multipleType.toUpperCase()} declare).`,
  };
}

/**
 * Extrait une valeur usable d une projection financiere en millions
 * d EUR et la retourne en EUR bruts. Strategie : on prefere l annee
 * courante (revenue probablement realise ou pres de l etre), sinon la
 * derniere annee passee disponible, sinon la premiere annee future.
 *
 * Les projections financialData.{revenue,ebitda,grossMargin,fcf}
 * Projection viennent du moteur financial-extraction-engine, qui
 * stocke les valeurs en MILLIONS d EUR. On reconvertit en EUR pour
 * que le moteur valuation puisse appliquer les multiples sectoriels
 * (qui s appliquent sur des montants en EUR bruts).
 */
function pickProjectionValue(
  projection: Array<{ year: string; value: number; source: string }> | undefined,
  unitMultiplier = 1_000_000,
): number | null {
  if (!projection || projection.length === 0) return null;
  const currentYear = new Date().getFullYear();
  const parsed = projection
    .map((p) => ({ year: parseInt(String(p.year), 10), value: Number(p.value) }))
    .filter((p) => !isNaN(p.year) && !isNaN(p.value));
  if (parsed.length === 0) return null;

  const exact = parsed.find((p) => p.year === currentYear);
  if (exact) return exact.value * unitMultiplier;

  const past = parsed.filter((p) => p.year < currentYear).sort((a, b) => b.year - a.year)[0];
  if (past) return past.value * unitMultiplier;

  const future = parsed.filter((p) => p.year > currentYear).sort((a, b) => a.year - b.year)[0];
  if (future) return future.value * unitMultiplier;

  return null;
}

/**
 * Extrait la base metric appropriee pour le multiple type donne. Lit
 * en priorite financialData (projections issues du BP), avec fallback
 * sur extraction.traction si le BP est absent.
 */
function extractBaseMetric(
  input: ValuationInput,
  multipleType: 'arr' | 'revenue' | 'gmv' | 'ebitda',
): number | null {
  const ext: any = input.extraction;
  const fd = input.financialData;

  // ARR : on prend le revenue projete comme proxy d ARR pour les
  // modeles SaaS, sauf si une mention explicite d ARR est dans la
  // traction extraite du deck.
  if (multipleType === 'arr') {
    const fromBp = pickProjectionValue(fd?.revenueProjection);
    if (fromBp) return fromBp;
    const fromExt = ext?.traction?.revenue
      || ext?.traction?.metrics?.find?.((m: string) => /arr|recurring/i.test(m));
    return parseFinancialNumber(fromExt);
  }

  // REVENUE : projection du BP en priorite, sinon extraction
  if (multipleType === 'revenue') {
    const fromBp = pickProjectionValue(fd?.revenueProjection);
    if (fromBp) return fromBp;
    const fromExt = ext?.traction?.revenue;
    return parseFinancialNumber(fromExt);
  }

  // GMV : marketplace. Cherche dans traction.metrics les strings GMV.
  // Le BP n a pas de champ dedie GMV, donc fallback sur extraction.
  if (multipleType === 'gmv') {
    const tractionMetrics: string[] = ext?.traction?.metrics || [];
    const gmvLine = tractionMetrics.find((m) => /gmv|volume.*affaires/i.test(m));
    return parseFinancialNumber(gmvLine);
  }

  // EBITDA : projection du BP en priorite
  if (multipleType === 'ebitda') {
    return pickProjectionValue(fd?.ebitdaProjection);
  }

  return null;
}

/**
 * Parse permissif des metriques financieres : accepte string ou
 * number, normalise les formats euro / million / k. Retourne le
 * montant en euros, ou null si non parseable.
 */
function parseFinancialNumber(raw: any): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw !== 'string') return null;

  const s = raw.toLowerCase().replace(/\s/g, '').replace(',', '.');
  // Capture des nombres avec suffixes K / M / Md
  const match = s.match(/(\d+(?:\.\d+)?)\s*(md|m|k|b)?/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (isNaN(value) || value <= 0) return null;

  const suffix = match[2];
  if (suffix === 'md' || suffix === 'b') return value * 1_000_000_000;
  if (suffix === 'm') return value * 1_000_000;
  if (suffix === 'k') return value * 1_000;
  // Heuristique : si < 1000, on suppose que c est en millions (interpretation conservatrice)
  if (value < 1000) return value * 1_000_000;
  return value;
}

/**
 * Calcule un signal qualite [0, 1] base sur les scores team et
 * market mecaniques. 0.5 = neutre, 1 = excellent (max benchmark),
 * 0 = faible (min benchmark).
 */
function computeQualitySignal(input: ValuationInput): number {
  const teamScore = input.teamScore ?? 50;
  const marketScore = input.marketScore ?? 50;
  // Moyenne ponderee : equipe compte plus que marche dans le pricing
  // de la valuation (les comparables sectoriels reflectent deja la
  // qualite de marche moyenne).
  const composite = (teamScore * 0.65 + marketScore * 0.35) / 100;
  return Math.max(0, Math.min(1, composite));
}

// ============================================================
// METHODE 2 : VC METHOD INVERSE
// ------------------------------------------------------------
// Logique : pour atteindre un IRR cible (par defaut 30%) sur un
// horizon (par defaut 6 ans), l exit doit valoir X. La valuation
// post-money plausible est donc exit / (1+IRR)^years. On en
// soustrait le ticket pour obtenir le pre-money.
//
// La valeur d exit est estimee a partir des comparables historiques
// du secteur (mediane des exits a ce stade).
// ============================================================

function computeByVcMethod(
  input: ValuationInput,
  assetClass: string,
  stage: ValuationStage,
): ValuationMethodResult {
  const targetIRR = 0.30; // 30% IRR cible classique VC
  const horizonYears = stage === 'seed' ? 7 : stage === 'series-a' ? 6 : stage === 'series-b' ? 5 : 4;

  // Exit values plausibles par stade et asset class (en EUR).
  // Calibre sur les exits observes 2020-2025. Le bear correspond au
  // 25e percentile des exits, base au 50e, bull au 75e.
  const exitScenarios = getExitScenarios(assetClass, stage);
  if (!exitScenarios) {
    return {
      method: 'vc-method',
      label: 'Methode VC inverse',
      applicable: false,
      notApplicableReason: `Pas de scenarios d exit calibres pour ${assetClass} au stade ${stage}.`,
    };
  }

  const ticket = parseTicketEur(input.extraction) || 0;
  const targetMultiple = Math.pow(1 + targetIRR, horizonYears);

  // Pour chaque scenario d exit, on calcule la post-money implicite
  // et on en deduit le pre-money en soustrayant le ticket.
  const postMin = exitScenarios.bear / targetMultiple;
  const postCentral = exitScenarios.base / targetMultiple;
  const postMax = exitScenarios.bull / targetMultiple;

  const preCentralRaw = postCentral - ticket;
  const preCentral = Math.max(0, preCentralRaw);

  // Detection : si le ticket excede trop largement la post-money cible,
  // la VC method calibree a IRR ${targetIRR*100}% sur ${horizonYears}
  // ans ne peut pas generer de pre-money plausible. Cas typique : late
  // stage avec gros ticket sur des exits modeles trop conservateurs.
  // Plutot que de pondre un central absurde et de polluer la
  // consolidation, on marque la methode non-applicable et on laisse
  // les multiples sectoriels prendre l ancrage.
  const isAbsurd = preCentral < 500_000
    || (ticket > 0 && preCentral < ticket * 0.30);
  if (isAbsurd) {
    return {
      method: 'vc-method',
      label: 'Methode VC inverse',
      applicable: false,
      notApplicableReason: `Le ticket propose (${formatEur(ticket)}) excede la post-money implicite (${formatEur(postCentral)}) necessaire pour atteindre IRR ${Math.round(targetIRR * 100)}% sur ${horizonYears} ans avec les exits calibres ${assetClass}. Soit le ticket est trop ambitieux, soit la these sous-jacente vise des exits superieurs aux medianes du segment.`,
    };
  }

  // Plancher structurel a 40% du central : si le bear scenario donne
  // une borne inferieure negative apres soustraction du ticket, on
  // retient un plancher prudent plutot que zero, qui n est pas
  // utilisable pour pricer.
  const preFloor = preCentral * 0.40;
  const preMin = Math.max(preFloor, postMin - ticket);
  const preMax = Math.max(preFloor, postMax - ticket);

  return {
    method: 'vc-method',
    label: 'Methode VC inverse',
    applicable: true,
    range: {
      min: Math.round(preMin),
      central: Math.round(preCentral),
      max: Math.round(preMax),
    },
    inputs: {
      targetIRR,
      horizonYears,
      exitScenarioBear: exitScenarios.bear,
      exitScenarioBase: exitScenarios.base,
      exitScenarioBull: exitScenarios.bull,
      targetMultiple: Math.round(targetMultiple * 10) / 10,
      ticket,
    },
    rationale: `IRR cible ${Math.round(targetIRR * 100)}% sur ${horizonYears} ans (multiple ${Math.round(targetMultiple * 10) / 10}x). Exits cibles : bear ${formatEur(exitScenarios.bear)}, base ${formatEur(exitScenarios.base)}, bull ${formatEur(exitScenarios.bull)}, calibres sur les exits observes 2020-2025 dans ${assetClass}.`,
  };
}

/**
 * Scenarios d exit par stade et asset-class. Calibre sur les exits
 * observes 2020-2025 (M&A + IPO). En euros.
 *
 * IMPORTANT : ces scenarios sont par definition incertains. Ils
 * servent d ancrage methodologique, pas de prediction.
 */
function getExitScenarios(assetClass: string, stage: ValuationStage): { bear: number; base: number; bull: number } | null {
  // Exits typiques par asset class (medianes observees).
  // Source : Crunchbase exits 2020-2025, Atomico exits Europe.
  const baseExits: Record<string, number> = {
    'saas-b2b': 80_000_000,
    'fintech': 100_000_000,
    'marketplace-b2c': 150_000_000,
    'ecommerce-dtc': 60_000_000,
    'deeptech': 120_000_000,
    'cybersecurity': 200_000_000,
    'healthtech': 90_000_000,
    'climate-tech': 100_000_000,
    'defense': 250_000_000,
    'hospitality': 70_000_000,
    'ai-generative': 250_000_000,
    // Asset-classes ajoutees
    'adtech': 80_000_000,
    'foodtech': 70_000_000,
    'proptech': 80_000_000,
    'edtech': 60_000_000,
    'logistics': 90_000_000,
    'services-b2b': 50_000_000,
    'industrial-hardware': 70_000_000,
    'profitable-mature': 120_000_000,
    'mediatech': 80_000_000,
    'sportstech': 60_000_000,
  };
  const base = baseExits[assetClass];
  if (!base) return null;

  // Multiplicateurs par stade : plus on est tot, plus l ecart entre
  // bear et bull est grand (variance cumulee).
  const stageVariance: Record<ValuationStage, { bear: number; bull: number }> = {
    'seed': { bear: 0.2, bull: 5 },
    'series-a': { bear: 0.3, bull: 4 },
    'series-b': { bear: 0.4, bull: 3 },
    'series-c-plus': { bear: 0.5, bull: 2.5 },
  };
  const variance = stageVariance[stage];

  return {
    bear: Math.round(base * variance.bear),
    base,
    bull: Math.round(base * variance.bull),
  };
}

// ============================================================
// METHODE 3 : BERKUS (seed only, pre-revenue)
// ------------------------------------------------------------
// La methode Berkus plafonne la valuation pre-money a une somme de
// 5 facteurs qualitatifs valant chacun 0-500k$ historiquement.
// Adaptee a 2026 et au marche europeen : 0-700k EUR par facteur,
// total maximum 3.5M EUR.
//
// Les 5 facteurs sont mappes sur les outputs Bloc 1 :
//   1. Sound idea (basic value) : depend du score Vigilance critique inversé
//   2. Prototype / produit : depend du score Marche (defensibilite)
//   3. Quality team : depend du score Equipe
//   4. Strategic relationships : depend du score Macro / Contrariens
//   5. Product rollout / sales : depend de la presence d ARR / revenue
// ============================================================

function computeByBerkus(input: ValuationInput): ValuationMethodResult {
  const teamScore = input.teamScore ?? 50;
  const marketScore = input.marketScore ?? 50;

  // Chaque facteur vaut 0-700k EUR selon la qualite mesuree (0-100)
  const FACTOR_MAX = 700_000;
  const factor1 = (teamScore / 100) * FACTOR_MAX * 0.6 + (marketScore / 100) * FACTOR_MAX * 0.4;
  const factor2 = (marketScore / 100) * FACTOR_MAX;
  const factor3 = (teamScore / 100) * FACTOR_MAX;
  const factor4 = ((teamScore + marketScore) / 200) * FACTOR_MAX;
  const ext: any = input.extraction;
  const revenueFromBp = pickProjectionValue(input.financialData?.revenueProjection);
  const hasRevenue = (revenueFromBp != null && revenueFromBp > 0)
    || !!parseFinancialNumber(ext?.traction?.revenue);
  const factor5 = hasRevenue ? FACTOR_MAX * 0.7 : FACTOR_MAX * 0.2;

  const central = factor1 + factor2 + factor3 + factor4 + factor5;
  const min = central * 0.6;
  const max = central * 1.4;

  return {
    method: 'berkus',
    label: 'Methode Berkus',
    applicable: true,
    range: {
      min: Math.round(min),
      central: Math.round(central),
      max: Math.round(max),
    },
    inputs: {
      facteurIdee: Math.round(factor1),
      facteurPrototype: Math.round(factor2),
      facteurEquipe: Math.round(factor3),
      facteurRelationsStrategiques: Math.round(factor4),
      facteurProductRollout: Math.round(factor5),
    },
    rationale: 'Methode Berkus adaptee a 2026 europeen : plafond 3,5M EUR pre-money. Chaque facteur (idee, prototype, equipe, relations, rollout) note de 0 a 700k EUR selon les scores Bloc 1. Adapte aux dossiers seed pre-revenue ou faiblement revenue.',
  };
}

function nonApplicableBerkus(): ValuationMethodResult {
  return {
    method: 'berkus',
    label: 'Methode Berkus',
    applicable: false,
    notApplicableReason: 'La methode Berkus s applique uniquement au stade seed pre-revenue.',
  };
}

// ============================================================
// METHODE 4 : SCORECARD (Bill Payne, seed)
// ------------------------------------------------------------
// Compare a la mediane regionale des seed deals et applique des
// facteurs de qualite ponderes :
//   - Equipe : 30%
//   - Taille opportunite : 25%
//   - Produit / techno : 15%
//   - Concurrence : 10%
//   - Marketing / ventes : 10%
//   - Need for additional investment : 5%
//   - Other : 5%
// Mediane Europe seed 2024 : ~3.5M EUR pre-money.
// ============================================================

function computeByScorecard(input: ValuationInput): ValuationMethodResult {
  const REGIONAL_MEDIAN_SEED = 3_500_000; // EUR, Europe 2024
  const teamScore = input.teamScore ?? 50;
  const marketScore = input.marketScore ?? 50;

  // Conversion score (0-100) en facteur Scorecard (0.5x - 2.0x)
  const toFactor = (s: number) => 0.5 + (s / 100) * 1.5;
  const fEquipe = toFactor(teamScore);
  const fOpportunite = toFactor(marketScore);
  const fProduit = toFactor((teamScore + marketScore) / 2);
  const fConcurrence = toFactor(marketScore);
  const fMarketing = toFactor(teamScore * 0.7 + marketScore * 0.3);
  const fNeedAddInvest = 1.0; // neutre par defaut
  const fOther = 1.0;

  const compositeFactor =
    fEquipe * 0.30
    + fOpportunite * 0.25
    + fProduit * 0.15
    + fConcurrence * 0.10
    + fMarketing * 0.10
    + fNeedAddInvest * 0.05
    + fOther * 0.05;

  const central = REGIONAL_MEDIAN_SEED * compositeFactor;
  const min = central * 0.7;
  const max = central * 1.3;

  return {
    method: 'scorecard',
    label: 'Methode Scorecard (Bill Payne)',
    applicable: true,
    range: {
      min: Math.round(min),
      central: Math.round(central),
      max: Math.round(max),
    },
    inputs: {
      medianeSeedEurope: REGIONAL_MEDIAN_SEED,
      facteurEquipe: Math.round(fEquipe * 100) / 100,
      facteurOpportunite: Math.round(fOpportunite * 100) / 100,
      facteurProduit: Math.round(fProduit * 100) / 100,
      facteurConcurrence: Math.round(fConcurrence * 100) / 100,
      facteurMarketing: Math.round(fMarketing * 100) / 100,
      compositeFactor: Math.round(compositeFactor * 100) / 100,
    },
    rationale: `Mediane seed europeenne 2024 (${formatEur(REGIONAL_MEDIAN_SEED)}) ajustee par facteurs Scorecard : equipe ${Math.round(fEquipe * 100) / 100}x, opportunite ${Math.round(fOpportunite * 100) / 100}x, produit ${Math.round(fProduit * 100) / 100}x. Coefficient composite ${Math.round(compositeFactor * 100) / 100}x.`,
  };
}

function nonApplicableScorecard(): ValuationMethodResult {
  return {
    method: 'scorecard',
    label: 'Methode Scorecard (Bill Payne)',
    applicable: false,
    notApplicableReason: 'La methode Scorecard s applique uniquement au stade seed.',
  };
}

// ============================================================
// CONSOLIDATION ET HELPERS
// ============================================================

/**
 * Consolide les ranges des methodes applicables en une fourchette
 * unique exploitable pour pricer. Trois principes :
 *
 * 1. Ponderation par stade ET disponibilite du revenue. Au seed pre-
 *    revenue, on exclut VC inverse (sans projection de revenue ancree
 *    dans un BP, elle pond des bornes a 40M+ sans aucune assise
 *    empirique sur un dossier sans traction). Au Series A+ avec
 *    revenue, multiples sectoriels et VC inverse dominent ; Berkus et
 *    Scorecard ne sont plus pertinents (calibres pour le seed).
 *
 * 2. Bornes consolidees sur la dispersion entre centraux des methodes,
 *    pas sur l enveloppe des bornes propres de chaque methode. L
 *    incertitude reelle est l ecart entre les ancres respectives, par
 *    exemple Berkus dit 1,4M et Scorecard dit 4M donc l incertitude
 *    est entre 1,4 et 4, et pas entre la borne basse de Berkus (0,8) et
 *    la borne haute de Scorecard (5,2). Cette logique evite que
 *    chaque methode tire la fourchette consolidee a son extreme.
 *
 * 3. Garde-fous : plage minimale de +/- 20% autour du central pour
 *    signaler l incertitude qualitative incompressible (signaux non
 *    chiffrables : founder-market fit, momentum, contexte du tour).
 *    Plafond a central x [0.55, 1.80] pour interdire les fourchettes
 *    inutilisables pour pricer.
 */
function consolidateRanges(
  methods: ValuationMethodResult[],
  stage: ValuationStage,
): { min: number; central: number; max: number } | null {
  const valid = methods.filter((m) => m.applicable && m.range);
  if (valid.length === 0) return null;

  // Disponibilite du revenue : on detecte via l applicabilite de
  // sector-multiples qui requiert un ARR ou revenue exploitable.
  const hasRevenue = valid.some((m) => m.method === 'sector-multiples');

  const weights: Record<string, number> = (() => {
    if (stage === 'seed') {
      // Seed pre-revenue : Scorecard et Berkus, VC inverse exclu.
      // Seed avec revenue : multiples sectoriels prennent l ancrage
      // empirique, Berkus et Scorecard restent en complement.
      if (hasRevenue) {
        return {
          'sector-multiples': 0.50,
          'scorecard': 0.30,
          'berkus': 0.20,
          'vc-method': 0,
        };
      }
      return {
        'scorecard': 0.60,
        'berkus': 0.40,
        'sector-multiples': 0,
        'vc-method': 0,
      };
    }
    // Series A et au-dela : multiples sectoriels dominent, VC inverse
    // complemente, Berkus et Scorecard sortent du jeu.
    if (stage === 'series-a') {
      return {
        'sector-multiples': 0.65,
        'vc-method': 0.35,
        'berkus': 0,
        'scorecard': 0,
      };
    }
    // Series B+
    return {
      'sector-multiples': 0.75,
      'vc-method': 0.25,
      'berkus': 0,
      'scorecard': 0,
    };
  })();

  const eligible = valid.filter((m) => (weights[m.method] || 0) > 0);
  if (eligible.length === 0) return null;

  let totalWeight = 0;
  let weightedCentral = 0;
  const centrals: number[] = [];

  for (const m of eligible) {
    const w = weights[m.method] || 0;
    totalWeight += w;
    weightedCentral += m.range!.central * w;
    centrals.push(m.range!.central);
  }

  const central = weightedCentral / totalWeight;

  // Garde-fous d incertitude. ENVELOPPE_MAX : les bornes ne sortent
  // jamais de central x [0.55, 1.80] meme si les methodes divergent
  // beaucoup. ENVELOPPE_MIN : les bornes garantissent au minimum +/-
  // 20% autour du central, meme si les methodes convergent tres etroit.
  const ENVELOPPE_MAX_DOWN = 0.55;
  const ENVELOPPE_MAX_UP = 1.80;
  const ENVELOPPE_MIN_DOWN = 0.80;
  const ENVELOPPE_MIN_UP = 1.20;

  let min: number, max: number;
  if (eligible.length === 1) {
    // Methode unique : on resserre ses bornes propres dans le plafond
    // de plausibilite, sinon une seule methode au range tres large
    // (typiquement VC inverse seul) sortirait une fourchette inutile.
    const m = eligible[0];
    min = Math.max(m.range!.min, central * ENVELOPPE_MAX_DOWN);
    max = Math.min(m.range!.max, central * ENVELOPPE_MAX_UP);
  } else {
    // Plusieurs methodes : la dispersion entre leurs centraux est l
    // ancrage de l incertitude.
    const minCentral = Math.min(...centrals);
    const maxCentral = Math.max(...centrals);
    min = Math.max(minCentral, central * ENVELOPPE_MAX_DOWN);
    max = Math.min(maxCentral, central * ENVELOPPE_MAX_UP);
  }

  // Plage minimale d incertitude : on garantit toujours +/- 20% autour
  // du central, sauf si les bornes plafond sont deja plus serrees.
  if (min > central * ENVELOPPE_MIN_DOWN) min = central * ENVELOPPE_MIN_DOWN;
  if (max < central * ENVELOPPE_MIN_UP) max = central * ENVELOPPE_MIN_UP;

  return {
    min: Math.round(min),
    central: Math.round(central),
    max: Math.round(max),
  };
}

function determineConfidence(
  methods: ValuationMethodResult[],
  assetClass: string,
  stage: ValuationStage,
): 'high' | 'medium' | 'low' {
  const applicableCount = methods.filter((m) => m.applicable).length;
  const sector = getSectorMultiples(assetClass, stage);
  const sectorConfidence = sector?.range.confidence;

  if (applicableCount >= 2 && sectorConfidence === 'high') return 'high';
  if (applicableCount >= 1 && sectorConfidence !== 'low') return 'medium';
  return 'low';
}

function parseTicketEur(extraction: ExtractionOutput | null | undefined): number | null {
  if (!extraction) return null;
  const ext: any = extraction;
  // Le ticket est range dans extraction.fundraise.amount sous forme
  // de string ('3M EUR', '5M$', '500k EUR'...). On parse de maniere
  // permissive.
  const candidates = [
    ext.fundraise?.amount,
    ext.roundAmount,
    ext.roundAmountEur,
  ];
  for (const c of candidates) {
    const v = parseFinancialNumber(c);
    if (v && v > 0) return v;
  }
  return null;
}

function buildDilutionAnalysis(
  range: { min: number; central: number; max: number },
  ticket: number,
): {
  proposedTicket: number;
  dilutionAtMin: number;
  dilutionAtCentral: number;
  dilutionAtMax: number;
  rationale: string;
} {
  // Dilution = ticket / (pre + ticket)
  const dMin = (ticket / (range.min + ticket)) * 100;
  const dCentral = (ticket / (range.central + ticket)) * 100;
  const dMax = (ticket / (range.max + ticket)) * 100;

  return {
    proposedTicket: ticket,
    dilutionAtMin: Math.round(dMin * 10) / 10,
    dilutionAtCentral: Math.round(dCentral * 10) / 10,
    dilutionAtMax: Math.round(dMax * 10) / 10,
    rationale: `Sur le ticket annonce ${formatEur(ticket)}, la dilution oscille entre ${Math.round(dMax * 10) / 10}% (valo haute ${formatEur(range.max)}) et ${Math.round(dMin * 10) / 10}% (valo basse ${formatEur(range.min)}). Point central : ${Math.round(dCentral * 10) / 10}% sur ${formatEur(range.central)} pre-money.`,
  };
}

function buildSynthesis(args: {
  recommendedRange: { min: number; central: number; max: number } | null;
  confidence: string;
  assetClass: string;
  stage: ValuationStage;
  applicableMethods: ValuationMethodResult[];
  dilutionAnalysis: any;
}): string {
  if (!args.recommendedRange) {
    return 'La fourchette de valorisation ne peut pas etre etablie : aucune des methodes (multiples, VC inverse, Berkus, Scorecard) ne dispose des inputs necessaires. Demander a la startup le BP, l ARR ou le revenue declare avant de relancer le calcul.';
  }
  const { min, central, max } = args.recommendedRange;
  const sourcesLabel = args.applicableMethods.map((m) => m.label).join(', ');
  const confidenceLabel = args.confidence === 'high' ? 'eleve'
    : args.confidence === 'medium' ? 'modere'
    : 'faible';

  let synth = `La fourchette pre-money plausible se situe entre ${formatEur(min)} et ${formatEur(max)}, avec un point central de ${formatEur(central)}. Niveau de fiabilite ${confidenceLabel}, base sur ${args.applicableMethods.length} methode${args.applicableMethods.length > 1 ? 's' : ''} applicable${args.applicableMethods.length > 1 ? 's' : ''} (${sourcesLabel}).`;

  if (args.dilutionAnalysis) {
    synth += ` Sur le ticket propose, la dilution s etablit entre ${args.dilutionAnalysis.dilutionAtMax}% (valo haute) et ${args.dilutionAnalysis.dilutionAtMin}% (valo basse).`;
  }

  return synth;
}

function collectWarnings(
  input: ValuationInput,
  applicableMethods: ValuationMethodResult[],
  range: any,
): string[] {
  const warnings: string[] = [];

  if (!range) {
    warnings.push('Fourchette non calculee : inputs insuffisants. Le partner doit collecter le BP / l ARR avant de proceder a la negociation.');
    return warnings;
  }

  if (applicableMethods.length === 1) {
    warnings.push('Une seule methode applicable. La fourchette est moins robuste qu une consolidation a 2-3 methodes. Considerer comme indicative.');
  }

  if (range.max / range.min > 4) {
    warnings.push(`La fourchette est tres large (rapport max/min ${Math.round(range.max / range.min * 10) / 10}). Le pricing depend fortement de signaux qualitatifs non chiffrables.`);
  }

  // Le warning "aucun BP" se base maintenant sur la presence reelle
  // d une projection revenue dans financialData (issue du moteur
  // financial-extraction-engine), pas sur le flag hasFinancialData
  // de financialCoherence qui ne capture pas la meme realite.
  const hasUsableBp = !!input.financialData?.hasBP
    && (input.financialData.revenueProjection || []).length > 0;
  if (!hasUsableBp) {
    warnings.push('Aucun BP ou pas de donnees financieres exploitables. Les multiples sectoriels n ont pas pu etre appliques. La fourchette est basee uniquement sur les methodes qualitatives (Berkus / Scorecard ou VC inverse).');
  }

  return warnings;
}

function getBenchmarkSources(assetClass: string): string[] {
  const sources: Record<string, string[]> = {
    'saas-b2b': ['Bessemer Cloud Index 2024', 'OpenView SaaS Benchmarks 2024', 'Atomico State of European Tech 2024-2025'],
    'fintech': ['Carta State of Private Markets Q4 2024', 'FT Partners 2024', 'Atomico 2025'],
    'marketplace-b2c': ['Atomico 2025', 'Crunchbase 2024'],
    'ecommerce-dtc': ['Carta 2024', 'Atomico 2024'],
    'deeptech': ['Atomico Deeptech 2024', 'KfW Capital 2024'],
    'cybersecurity': ['Momentum Cyber 2024', 'Atomico 2024'],
    'healthtech': ['Rock Health 2024', 'Atomico Healthtech 2024'],
    'climate-tech': ['Sightline Climate 2024', 'Atomico Climate 2024'],
    'defense': ['SVB Defense Tech 2024', 'NATO Innovation Fund'],
    'hospitality': ['Skift 2024', 'Atomico Travel 2024'],
    'ai-generative': ['CB Insights 2024', 'Crunchbase AI 2024'],
    // Asset-classes ajoutees
    'adtech': ['LUMA Partners 2024', 'eMarketer 2024'],
    'foodtech': ['AgFunder 2024', 'Atomico Foodtech 2024'],
    'proptech': ['RECNet 2024', 'Atomico 2024'],
    'edtech': ['HolonIQ Edtech 2024', 'Atomico 2024'],
    'logistics': ['Pitchbook Logistics 2024', 'Atomico 2024'],
    'services-b2b': ['SaaS Capital 2024', 'Equiteq 2024'],
    'industrial-hardware': ['KfW Capital 2024', 'BPI France 2024'],
    'profitable-mature': ['Argos Index Q4 2024', 'S&P Global SME 2024'],
    'mediatech': ['Atomico Content 2024', 'Drake Star Gaming 2024'],
    'sportstech': ['Drake Star Sportstech 2024'],
  };
  return sources[assetClass] || ['Sources sectorielles publiques 2024-2025'];
}

function formatEur(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.', ',')}Md€`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M€`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k€`;
  return `${value}€`;
}
