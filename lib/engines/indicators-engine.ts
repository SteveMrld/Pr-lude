// ============================================================
// INDICATORS ENGINE - Calcul des sept indicateurs deal type
// ------------------------------------------------------------
// Produit les sept KPI canoniques utilises pour evaluer la sante
// economique d un dossier VC :
//
//   1. Burn multiple (Sacks 2020) : Net Burn / Net New ARR
//   2. Rule of 40 : croissance ARR % + marge FCF/EBITDA %
//   3. NDR (Net Dollar Retention) : retention plus expansion
//   4. Magic Number : efficacite go-to-market
//   5. Payback CAC : duree d amortissement du cout d acquisition
//   6. Gross margin trajectory : niveau et evolution de la marge brute
//   7. Revenue per employee : capital efficiency
//
// Chaque indicateur est calcule a partir des outputs Bloc 1
// (extraction, financialData, financialCoherence) et confronte
// aux benchmarks par couple (asset-class, stage). Le verdict est
// l un de : best-in-class, sain, a-surveiller, rouge, ou
// non-applicable (donnee absente ou indicateur non pertinent au
// stade ou a l asset-class).
//
// CALCUL DETERMINISTE : pas d appel LLM. Le moteur lit la donnee
// structuree et produit le resultat. Auditable, instantane.
//
// PRINCIPE EDITORIAL : ce moteur ne juge pas le dossier en absolu,
// il le positionne par rapport a une distribution sectorielle
// connue. Un verdict rouge sur Burn Multiple peut etre defendable
// (acquisition de marche pre-monetisation), mais merite un drapeau
// dans la note d investissement. Le partner lit les sept verdicts
// ensemble, pas un par un.
// ============================================================

import {
  getIndicatorBenchmarks,
  classifyValue,
  type IndicatorBenchmarkSet,
  type IndicatorThresholds,
} from '@/lib/data/indicator-benchmarks';
import { normalizeAssetClass, normalizeStage, type ValuationStage } from '@/lib/data/sector-benchmarks';
import type { ExtractionOutput, FinancialDataExtraction, FinancialCoherenceOutput } from '@/lib/engines/types';

// ============================================================
// TYPES
// ============================================================

/**
 * Resultat detaille pour un indicateur. Les indicateurs non
 * applicables (donnee manquante ou hors scope sectoriel) ont un
 * status explicite plutot qu une valeur null sans contexte.
 */
export interface IndicatorResult {
  /** Identifiant technique de l indicateur. */
  key: 'burnMultiple' | 'ruleOf40' | 'ndr' | 'magicNumber' | 'paybackCac' | 'grossMargin' | 'revenuePerEmployee';
  /** Nom lisible pour la note. */
  label: string;
  /** Valeur calculee, en l unite de l indicateur. Null si non calculable. */
  value: number | null;
  /** Unite affichable (%, mois, x, EUR/FTE). */
  unit: string;
  /** Classification du dossier sur cet indicateur, ou non-applicable. */
  verdict: 'best-in-class' | 'sain' | 'a-surveiller' | 'rouge' | 'non-applicable';
  /** Si non-applicable, raison. Sinon, calcul ou observation. */
  rationale: string;
  /** Seuils du benchmark utilise (pour transparence dans la note). */
  benchmark?: {
    best: number;
    sain: number;
    surveille: number;
    direction: 'higher-is-better' | 'lower-is-better';
  };
  /** Source de la donnee : 'bp', 'pitch', 'inference', 'absent'. */
  dataConfidence: 'high' | 'medium' | 'low' | 'absent';
}

/**
 * Output global du moteur indicateurs. Consomme par la note
 * d investissement (section 1.8) et potentiellement par
 * score-calculator pour ponderer la dimension Modele eco.
 */
export interface IndicatorsOutput {
  assetClass: string;
  stage: ValuationStage;
  indicators: IndicatorResult[];
  /** Score global d execution operationnelle, 0-100. Calcule a partir
   * des verdicts des indicateurs applicables. Best-in-class +20pts,
   * sain +10pts, a-surveiller -5pts, rouge -15pts, non-applicable
   * neutre. Borne dans [0, 100], ancre a 50 (neutre). */
  globalIndicatorScore: number;
  /** Synthese editoriale de l etat des indicateurs pour le partner. */
  synthesis: string;
  /** Avertissements methodologiques. */
  warnings: string[];
}

// ============================================================
// HELPERS DE CALCUL
// ============================================================

/**
 * Selectionne la valeur de l annee courante d une projection (ou la
 * plus proche disponible), exprimee en EUR (avec multiplicateur
 * applique : les projections sont en millions d EUR par convention
 * du moteur financial-extraction-engine).
 */
function pickProjectionValueAtYear(
  projection: Array<{ year: string; value: number; source: string }> | undefined,
  year: number,
  unitMultiplier = 1_000_000,
): number | null {
  if (!projection) return null;
  const found = projection.find((p) => parseInt(String(p.year), 10) === year);
  if (!found) return null;
  return found.value * unitMultiplier;
}

/**
 * Calcule la croissance YoY (annee N vs N-1) sur une projection,
 * en pourcentage. Renvoie null si l une des deux annees est absente.
 */
function computeYoYGrowth(
  projection: Array<{ year: string; value: number; source: string }> | undefined,
  yearN: number,
): number | null {
  const valueN = pickProjectionValueAtYear(projection, yearN);
  const valueNminus1 = pickProjectionValueAtYear(projection, yearN - 1);
  if (valueN == null || valueNminus1 == null || valueNminus1 === 0) return null;
  return ((valueN - valueNminus1) / Math.abs(valueNminus1)) * 100;
}

/**
 * Parse un montant en EUR depuis une string libre du type "500€",
 * "10 000€", "2.5M€", "non communiqué". Retourne null si non
 * parseable.
 */
function parseCurrencyToEur(s: string | null | undefined): number | null {
  if (!s) return null;
  const str = String(s).toLowerCase().replace(/\s/g, '');
  if (/non.{0,3}communiqu|n\/a|none|null/i.test(str)) return null;
  const match = str.match(/(\d+([.,]\d+)?)\s*(k|m|md|mds)?\s*(eur|€|\$|usd)?/i);
  if (!match) return null;
  let value = parseFloat(match[1].replace(',', '.'));
  const suffix = (match[3] || '').toLowerCase();
  if (suffix === 'k') value *= 1_000;
  else if (suffix === 'm') value *= 1_000_000;
  else if (suffix === 'md' || suffix === 'mds') value *= 1_000_000_000;
  return value;
}

/**
 * Parse un pourcentage depuis une string libre du type "70%",
 * "0.70", "70 pourcent". Retourne null si non parseable.
 */
function parsePercent(s: string | null | undefined): number | null {
  if (!s) return null;
  const str = String(s).toLowerCase().replace(/\s/g, '');
  if (/non.{0,3}communiqu|n\/a|none|null/i.test(str)) return null;
  const match = str.match(/(\d+([.,]\d+)?)\s*(%|pct|percent|pourcent)?/i);
  if (!match) return null;
  let value = parseFloat(match[1].replace(',', '.'));
  // Si pas de signe %, on suppose decimal (0.70 = 70%)
  if (!match[3] && value <= 1) value *= 100;
  return value;
}

// ============================================================
// CALCULATEURS PAR INDICATEUR
// ============================================================

/**
 * Burn multiple = Net Burn / Net New ARR (Sacks 2020).
 * Calcul : on prend la croissance revenue annee courante moins
 * annee precedente (= net new ARR proxy), et le burn = -EBITDA ou
 * -FCF si dispo, sinon |OPEX - Revenue|. Retourne |Burn| / NetNewARR.
 */
function computeBurnMultiple(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet,
): IndicatorResult {
  const label = 'Burn multiple';
  const benchmark = benchmarks.burnMultiple;
  if (!fd || !benchmark) {
    return {
      key: 'burnMultiple', label, value: null, unit: 'x',
      verdict: 'non-applicable',
      rationale: 'Indicateur non applicable au couple asset-class / stage ou donnees BP absentes.',
      dataConfidence: 'absent',
    };
  }

  const currentYear = new Date().getFullYear();
  const newArr = computeYoYGrowthAbsolute(fd.revenueProjection, currentYear);

  // Burn proxy : -FCF si dispo, sinon -EBITDA, sinon (OPEX - revenue)
  let burn: number | null = null;
  const fcf = pickProjectionValueAtYear(fd.fcfProjection, currentYear);
  if (fcf != null && fcf < 0) burn = -fcf;
  if (burn == null) {
    const ebitda = pickProjectionValueAtYear(fd.ebitdaProjection, currentYear);
    if (ebitda != null && ebitda < 0) burn = -ebitda;
  }
  if (burn == null) {
    const opex = pickProjectionValueAtYear(fd.opexProjection, currentYear);
    const rev = pickProjectionValueAtYear(fd.revenueProjection, currentYear);
    if (opex != null && rev != null && opex > rev) burn = opex - rev;
  }

  if (newArr == null || newArr <= 0 || burn == null) {
    return {
      key: 'burnMultiple', label, value: null, unit: benchmark.unit,
      verdict: 'non-applicable',
      rationale: newArr == null
        ? 'Croissance revenue annuelle non calculable depuis le BP (annee courante ou precedente absente).'
        : newArr <= 0
        ? 'Croissance revenue annuelle nulle ou negative : le burn multiple n est pas calculable (division par zero).'
        : 'Burn (FCF, EBITDA ou OPEX - revenue) non extractible du BP.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  const value = burn / newArr;
  return {
    key: 'burnMultiple', label, value: roundTo(value, 2), unit: benchmark.unit,
    verdict: classifyValue(value, benchmark),
    rationale: `Burn ${formatEur(burn)} / Net New ARR ${formatEur(newArr)} = ${roundTo(value, 2)}x.`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/** Variante de computeYoYGrowth qui retourne le delta absolu (en EUR), pas le pct. */
function computeYoYGrowthAbsolute(
  projection: Array<{ year: string; value: number; source: string }> | undefined,
  yearN: number,
): number | null {
  const valueN = pickProjectionValueAtYear(projection, yearN);
  const valueNminus1 = pickProjectionValueAtYear(projection, yearN - 1);
  if (valueN == null || valueNminus1 == null) return null;
  return valueN - valueNminus1;
}

/**
 * Rule of 40 = croissance ARR YoY % + marge FCF % (ou EBITDA si FCF absent).
 * SaaS B2B sain >40, top quartile >60.
 */
function computeRuleOf40(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet,
): IndicatorResult {
  const label = 'Rule of 40';
  const benchmark = benchmarks.ruleOf40;
  if (!fd || !benchmark) {
    return {
      key: 'ruleOf40', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: 'Indicateur non applicable au couple asset-class / stage ou donnees BP absentes.',
      dataConfidence: 'absent',
    };
  }

  const currentYear = new Date().getFullYear();
  const growth = computeYoYGrowth(fd.revenueProjection, currentYear);
  const revenue = pickProjectionValueAtYear(fd.revenueProjection, currentYear);
  let marginPct: number | null = null;
  let marginType = '';

  const fcf = pickProjectionValueAtYear(fd.fcfProjection, currentYear);
  if (fcf != null && revenue && revenue > 0) {
    marginPct = (fcf / revenue) * 100;
    marginType = 'FCF';
  }
  if (marginPct == null) {
    const ebitda = pickProjectionValueAtYear(fd.ebitdaProjection, currentYear);
    if (ebitda != null && revenue && revenue > 0) {
      marginPct = (ebitda / revenue) * 100;
      marginType = 'EBITDA';
    }
  }

  if (growth == null || marginPct == null) {
    return {
      key: 'ruleOf40', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: growth == null
        ? 'Croissance YoY non calculable (annee courante ou precedente absente du BP).'
        : 'Marge FCF ou EBITDA non extractible du BP.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  const value = growth + marginPct;
  return {
    key: 'ruleOf40', label, value: roundTo(value, 1), unit: '%',
    verdict: classifyValue(value, benchmark),
    rationale: `Croissance YoY ${roundTo(growth, 1)}% + Marge ${marginType} ${roundTo(marginPct, 1)}% = ${roundTo(value, 1)}%.`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/**
 * NDR : non calculable depuis le BP standard. On essaie d extraire
 * une mention explicite dans le pitch (champ rawNotes ou
 * unitEconomics), sinon non-applicable.
 */
function computeNdr(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet,
): IndicatorResult {
  const label = 'NDR (Net Dollar Retention)';
  const benchmark = benchmarks.ndr;
  if (!benchmark) {
    return {
      key: 'ndr', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: 'NDR non pertinent pour ce type de modele (ecommerce-dtc, marketplace-b2c, mediatech sans recurrence).',
      dataConfidence: 'absent',
    };
  }

  // Recherche de mention NDR explicite dans rawNotes
  const rawText = (fd?.rawNotes || '').toLowerCase();
  const ndrMatch = rawText.match(/ndr[^\d]*(\d+(?:[.,]\d+)?)\s*%/i)
    || rawText.match(/net\s*dollar\s*retention[^\d]*(\d+(?:[.,]\d+)?)\s*%/i);

  if (!ndrMatch) {
    return {
      key: 'ndr', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: 'NDR non communique dans le BP. Doit etre demande au fondateur en DD : (ARR debut + expansion - churn - downgrade) / ARR debut.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  const value = parseFloat(ndrMatch[1].replace(',', '.'));
  return {
    key: 'ndr', label, value: roundTo(value, 1), unit: '%',
    verdict: classifyValue(value, benchmark),
    rationale: `NDR declare ${roundTo(value, 1)}% (cite dans rawNotes du BP). Verifier methodologie de calcul en DD.`,
    dataConfidence: 'medium',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/** Magic Number : non calculable sans S&M trimestriel. Non-applicable par defaut. */
function computeMagicNumber(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet,
): IndicatorResult {
  const label = 'Magic Number';
  const benchmark = benchmarks.magicNumber;
  if (!benchmark) {
    return {
      key: 'magicNumber', label, value: null, unit: 'x',
      verdict: 'non-applicable',
      rationale: 'Magic Number non pertinent au stade ou a l asset-class (necessite S&M trimestriel et ARR new annualise).',
      dataConfidence: 'absent',
    };
  }
  return {
    key: 'magicNumber', label, value: null, unit: 'x',
    verdict: 'non-applicable',
    rationale: 'Magic Number non calculable depuis le BP standard. Necessite S&M dépensé Q-1 et ARR new annualise du Q. Doit etre extrait du pitch ou demande au fondateur en DD.',
    dataConfidence: 'absent',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/**
 * Payback CAC = CAC / (ARPU mensuel × marge brute).
 * Lit unitEconomics du BP : CAC, ACV, marge brute par unite.
 */
function computePaybackCac(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet,
): IndicatorResult {
  const label = 'Payback CAC';
  const benchmark = benchmarks.paybackCac;
  if (!fd || !benchmark) {
    return {
      key: 'paybackCac', label, value: null, unit: 'mois',
      verdict: 'non-applicable',
      rationale: 'Indicateur non applicable ou donnees BP absentes.',
      dataConfidence: 'absent',
    };
  }

  const cac = parseCurrencyToEur(fd.unitEconomics?.estimatedCAC);
  const acv = parseCurrencyToEur(fd.unitEconomics?.averageContractValue);
  const grossMarginPct = parsePercent(fd.unitEconomics?.grossMarginPerUnit);

  if (cac == null || acv == null || acv <= 0) {
    return {
      key: 'paybackCac', label, value: null, unit: 'mois',
      verdict: 'non-applicable',
      rationale: 'CAC ou ACV non communiques dans le BP. Doivent etre demandes en DD pour calculer le payback.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  // Si marge brute non communiquee, on prend 0.5 par defaut comme proxy
  // mais on flag dataConfidence en medium plutot que high.
  const marginFraction = grossMarginPct != null ? grossMarginPct / 100 : 0.5;
  const monthlyArpu = acv / 12;
  const monthlyContribution = monthlyArpu * marginFraction;
  if (monthlyContribution <= 0) {
    return {
      key: 'paybackCac', label, value: null, unit: 'mois',
      verdict: 'non-applicable',
      rationale: 'Contribution unitaire mensuelle nulle ou negative : payback non calculable.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }
  const value = cac / monthlyContribution;
  return {
    key: 'paybackCac', label, value: roundTo(value, 1), unit: 'mois',
    verdict: classifyValue(value, benchmark),
    rationale: `CAC ${formatEur(cac)} / (ACV ${formatEur(acv)} / 12 × marge brute ${grossMarginPct != null ? `${roundTo(grossMarginPct, 0)}%` : '50% proxy'}) = ${roundTo(value, 1)} mois.`,
    dataConfidence: grossMarginPct != null ? 'high' : 'medium',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/**
 * Gross margin : niveau et trajectoire. On prend la valeur de l annee
 * courante de grossMarginProjection. Si plusieurs annees disponibles,
 * on regarde la trajectoire (amelioration ou degradation).
 */
function computeGrossMargin(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet,
): IndicatorResult {
  const label = 'Marge brute';
  const benchmark = benchmarks.grossMargin;
  if (!fd || !benchmark) {
    return {
      key: 'grossMargin', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: 'Indicateur non applicable ou donnees BP absentes.',
      dataConfidence: 'absent',
    };
  }

  const currentYear = new Date().getFullYear();
  let value = pickProjectionValueAtYear(fd.grossMarginProjection, currentYear, 1);
  if (value == null) {
    // Fallback : moyenne des projections disponibles
    const values = (fd.grossMarginProjection || []).map((p) => p.value).filter((v) => !isNaN(v));
    if (values.length > 0) value = values.reduce((a, b) => a + b, 0) / values.length;
  }
  if (value == null) {
    // Fallback supplementaire : unitEconomics.grossMarginPerUnit
    value = parsePercent(fd.unitEconomics?.grossMarginPerUnit);
  }

  if (value == null) {
    return {
      key: 'grossMargin', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: 'Marge brute non communiquee dans le BP. Donnee critique pour evaluer la viabilite unitaire : a demander en DD.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  // Trajectoire : si plusieurs annees disponibles, on regarde si la
  // serie est croissante, decroissante ou stable.
  const sortedProj = (fd.grossMarginProjection || [])
    .slice()
    .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
  let trajectoryNote = '';
  if (sortedProj.length >= 2) {
    const first = sortedProj[0].value;
    const last = sortedProj[sortedProj.length - 1].value;
    const delta = last - first;
    if (delta > 5) trajectoryNote = ` Trajectoire en amelioration (+${roundTo(delta, 0)} pts entre ${sortedProj[0].year} et ${sortedProj[sortedProj.length - 1].year}).`;
    else if (delta < -5) trajectoryNote = ` Trajectoire en degradation (${roundTo(delta, 0)} pts entre ${sortedProj[0].year} et ${sortedProj[sortedProj.length - 1].year}).`;
    else trajectoryNote = ` Trajectoire stable.`;
  }

  return {
    key: 'grossMargin', label, value: roundTo(value, 1), unit: '%',
    verdict: classifyValue(value, benchmark),
    rationale: `Marge brute ${roundTo(value, 1)}% pour l annee courante.${trajectoryNote}`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/**
 * Revenue per employee = revenue annee courante / headcount annee courante.
 */
function computeRevenuePerEmployee(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet,
): IndicatorResult {
  const label = 'Revenue par employe';
  const benchmark = benchmarks.revenuePerEmployee;
  if (!fd || !benchmark) {
    return {
      key: 'revenuePerEmployee', label, value: null, unit: 'EUR/FTE',
      verdict: 'non-applicable',
      rationale: 'Indicateur non applicable ou donnees BP absentes.',
      dataConfidence: 'absent',
    };
  }

  const currentYear = new Date().getFullYear();
  const revenue = pickProjectionValueAtYear(fd.revenueProjection, currentYear);
  const headcount = pickProjectionValueAtYear(fd.headcount, currentYear, 1);

  if (revenue == null || headcount == null || headcount <= 0) {
    return {
      key: 'revenuePerEmployee', label, value: null, unit: 'EUR/FTE',
      verdict: 'non-applicable',
      rationale: revenue == null
        ? 'Revenue annee courante absent du BP.'
        : 'Headcount annee courante absent du BP. Donnee critique pour evaluer la capital efficiency.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  const value = revenue / headcount;
  return {
    key: 'revenuePerEmployee', label, value: Math.round(value), unit: 'EUR/FTE',
    verdict: classifyValue(value, benchmark),
    rationale: `Revenue ${formatEur(revenue)} / ${headcount} ETP = ${formatEur(value)} par employe.`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

// ============================================================
// HELPERS
// ============================================================

function thresholdsToBenchmark(t: IndicatorThresholds): IndicatorResult['benchmark'] {
  return {
    best: t.best,
    sain: t.sain,
    surveille: t.surveille,
    direction: t.direction,
  };
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function formatEur(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace('.', ',')}M€`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k€`;
  return `${Math.round(value)}€`;
}

// ============================================================
// POINT D ENTREE PRINCIPAL
// ============================================================

interface IndicatorsInput {
  extraction: ExtractionOutput | null | undefined;
  financial: FinancialCoherenceOutput | null | undefined;
  financialData?: FinancialDataExtraction | null | undefined;
}

export function computeIndicators(input: IndicatorsInput): IndicatorsOutput {
  const ext: any = input.extraction;
  const assetClassRaw = ext
    ? `${ext.sector || ''} ${ext.subSector || ''}`.trim() || ext.sector
    : null;
  const stageRaw = ext?.fundraise?.stage || null;
  const assetClass = normalizeAssetClass(assetClassRaw);
  const stage = normalizeStage(stageRaw);

  const benchmarks = getIndicatorBenchmarks(assetClass, stage);
  const fd = input.financialData;

  const indicators: IndicatorResult[] = [
    computeBurnMultiple(fd, benchmarks),
    computeRuleOf40(fd, benchmarks),
    computeNdr(fd, benchmarks),
    computeMagicNumber(fd, benchmarks),
    computePaybackCac(fd, benchmarks),
    computeGrossMargin(fd, benchmarks),
    computeRevenuePerEmployee(fd, benchmarks),
  ];

  // Score global d execution operationnelle. Ancre a 50 (neutre).
  // Best-in-class +20, sain +10, surveille -5, rouge -15. NA neutre.
  // Si moins de 3 indicateurs applicables, le score reste a 50 : il
  // n est pas honnete d afficher un score positif eleve sur 1 ou 2
  // indicateurs, ca cree une dissonance avec le verdict global du
  // dossier. Le partner doit comprendre que le moteur ne peut pas
  // juger sans donnees structurees suffisantes.
  let score = 50;
  let applicableCount = 0;
  for (const ind of indicators) {
    if (ind.verdict === 'non-applicable') continue;
    applicableCount++;
    if (ind.verdict === 'best-in-class') score += 20;
    else if (ind.verdict === 'sain') score += 10;
    else if (ind.verdict === 'a-surveiller') score -= 5;
    else if (ind.verdict === 'rouge') score -= 15;
  }
  if (applicableCount < 3) {
    score = 50;
  } else if (applicableCount > 4) {
    // Normalisation : on plafonne le delta proportionnellement quand
    // beaucoup d indicateurs sont applicables (sinon on saturerait vite).
    const ratio = 4 / applicableCount;
    score = 50 + (score - 50) * ratio;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Synthese editoriale
  const synthesis = buildSynthesis(indicators, applicableCount, score);

  // Warnings
  const warnings: string[] = [];
  if (applicableCount === 0) {
    warnings.push('Aucun indicateur calculable : le BP fourni ne contient pas les donnees structurees necessaires (revenue, marge brute, headcount, EBITDA, unit economics).');
  } else if (applicableCount <= 2) {
    warnings.push(`Seuls ${applicableCount} indicateurs applicables. Le score d execution est moins robuste qu une evaluation complete.`);
  }
  const naCount = indicators.filter((i) => i.verdict === 'non-applicable').length;
  if (naCount >= 5) {
    warnings.push('La plupart des indicateurs sont non applicables faute de donnees structurees. Demander au fondateur un BP plus complet (revenue, marge brute, EBITDA, headcount, unit economics par segment).');
  }

  return {
    assetClass,
    stage,
    indicators,
    globalIndicatorScore: score,
    synthesis,
    warnings,
  };
}

function buildSynthesis(indicators: IndicatorResult[], applicableCount: number, score: number): string {
  if (applicableCount === 0) {
    return 'Aucun indicateur applicable : le BP est trop incomplet pour evaluer la sante economique du dossier. Les sept indicateurs canoniques (Burn multiple, Rule of 40, NDR, Magic Number, Payback CAC, Marge brute, Revenue par employe) requierent des donnees structurees absentes ici. Etape obligatoire en DD : recuperer un BP detaille du fondateur.';
  }

  const best = indicators.filter((i) => i.verdict === 'best-in-class').length;
  const sain = indicators.filter((i) => i.verdict === 'sain').length;
  const surveille = indicators.filter((i) => i.verdict === 'a-surveiller').length;
  const rouge = indicators.filter((i) => i.verdict === 'rouge').length;

  const summary = `${best} best-in-class, ${sain} sain, ${surveille} a-surveiller, ${rouge} rouge sur ${applicableCount} indicateur${applicableCount > 1 ? 's' : ''} applicable${applicableCount > 1 ? 's' : ''}.`;

  if (applicableCount < 3) {
    return `${summary} Score d execution non calculable faute de donnees structurees suffisantes (${applicableCount}/7 indicateurs applicables). Le moteur n affiche pas de jugement global sur cette base. Demander au fondateur un BP plus complet (revenue YoY, marge brute, EBITDA, headcount, unit economics par segment) avant de conclure.`;
  }

  let lecture = '';
  if (score >= 75) {
    lecture = 'Le profil d execution operationnel est solide : la majorite des indicateurs disponibles sont au-dessus des standards sectoriels. La sante economique est un facteur positif clair pour ce dossier.';
  } else if (score >= 60) {
    lecture = 'Le profil d execution est sain dans l ensemble : pas de drapeau rouge majeur, meme si quelques indicateurs meritent un suivi en DD pour confirmer la trajectoire.';
  } else if (score >= 40) {
    lecture = 'Le profil d execution est mitige : plusieurs indicateurs sortent des standards sectoriels. Le partner doit comprendre le narratif de redressement avant de proceder.';
  } else {
    lecture = 'Le profil d execution est preoccupant : la majorite des indicateurs disponibles sont sous les standards sectoriels. Le dossier necessite une refonte structurelle des unit economics avant d etre venture-backable.';
  }

  return `${summary} Score d execution global ${score}/100. ${lecture}`;
}
