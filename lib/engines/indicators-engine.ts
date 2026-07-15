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
  computeBenchmarkFreshnessMonths,
  type IndicatorBenchmarkSet,
  type IndicatorThresholds,
} from '@/lib/data/indicator-benchmarks';
import { normalizeAssetClass, normalizeStage, type ValuationStage } from '@/lib/data/sector-benchmarks';
import type { ExtractionOutput, FinancialDataExtraction, FinancialCoherenceOutput } from '@/lib/engines/types';
import type { SaasMetricsExtraction } from '@/lib/engines/saas-metrics-engine';
import type { IndustrialMetricsExtraction } from '@/lib/engines/industrial-metrics-engine';
import type { RelevanceMatrix } from '@/lib/engines/relevance-matrix';

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
  key: 'burnMultiple' | 'ruleOf40' | 'ndr' | 'magicNumber' | 'paybackCac' | 'grossMargin' | 'revenuePerEmployee'
    | 'unitMargin' | 'commercialCycle' | 'orderBacklog' | 'workingCapitalRatio' | 'projectCapex' | 'industrialCapacity'
    | 'tenderWinRate';
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
  /** Annee du BP effectivement utilisee pour le calcul. Deterministe,
   *  derivee de l annee de reference du dossier et des annees
   *  disponibles dans la projection. null si l indicateur n a pas
   *  ete calculable (non-applicable, absent). */
  computedForYear?: number | null;
  /** True si l annee retenue est strictement posterieure a l annee de
   *  reference du dossier (calcul base sur du projete faute d actual
   *  disponible). Signal a exposer dans la note pour ne pas presenter
   *  un chiffre forward comme un etat de sante realise. */
  isForwardBase?: boolean;
}

/**
 * Output global du moteur indicateurs. Consomme par la note
 * d investissement (section 1.8) et potentiellement par
 * score-calculator pour ponderer la dimension Modele eco.
 */
export interface IndicatorsOutput {
  assetClass: string;
  /** Stade normalise. 'unknown' signale que le pitch n a pas livre un
   * libelle reconnu (cas frequent : 'bridge', 'tour intermediaire',
   * 'series B-1', extension de seed). Dans ce cas, les sept indicateurs
   * SaaS sont neutralises plutot que juges contre les seuils seed par
   * defaut. La note doit afficher 'classification a confirmer' au
   * partner plutot qu un score faux qui inspire une fausse confiance. */
  stage: ValuationStage | 'unknown';
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
 * Resout l annee de calcul d un indicateur a partir de l annee de
 * reference du dossier et des annees disponibles dans la projection.
 * Regle deterministe :
 *   1. Si refYear est dans la projection : retenue, isForward=false.
 *   2. Sinon, plus grande annee < refYear dans la projection :
 *      retenue, isForward=false (actual historique).
 *   3. Sinon, plus grande annee > refYear dans la projection :
 *      retenue, isForward=true (calcul sur du projete).
 *   4. Sinon, null : le moteur ne devine pas.
 *
 * Aucune lecture d horloge. La date systeme n intervient jamais.
 */
export interface YearResolution {
  year: number;
  isForward: boolean;
}
export function resolveYearForIndicator(
  projection: Array<{ year: string | number; value: number }> | undefined,
  refYear: number | null,
): YearResolution | null {
  if (refYear === null || !Number.isFinite(refYear)) return null;
  if (!Array.isArray(projection) || projection.length === 0) return null;
  const years = projection
    .map(p => parseInt(String(p.year), 10))
    .filter(y => Number.isFinite(y))
    .sort((a, b) => a - b);
  if (years.length === 0) return null;
  if (years.includes(refYear)) return { year: refYear, isForward: false };
  const historical = years.filter(y => y < refYear);
  if (historical.length > 0) return { year: historical[historical.length - 1], isForward: false };
  const forward = years.filter(y => y > refYear);
  if (forward.length > 0) return { year: forward[0], isForward: true };
  return null;
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
  benchmarks: IndicatorBenchmarkSet | null,
  refYear: number | null,
): IndicatorResult {
  const label = 'Burn multiple';
  const benchmark = benchmarks?.burnMultiple;
  if (!fd || !benchmark) {
    return {
      key: 'burnMultiple', label, value: null, unit: 'x',
      verdict: 'non-applicable',
      rationale: !benchmarks
        ? 'Benchmarks SaaS non applicables (asset class non reconnue ou stade non identifie). Indicateur neutralise pour eviter un verdict cale sur des seuils logiciels decales.'
        : 'Indicateur non applicable au couple asset-class / stage ou donnees BP absentes.',
      dataConfidence: 'absent',
      computedForYear: null,
      isForwardBase: false,
    };
  }

  const resolved = resolveYearForIndicator(fd.revenueProjection, refYear);
  if (!resolved) {
    return {
      key: 'burnMultiple', label, value: null, unit: benchmark.unit,
      verdict: 'non-applicable',
      rationale: refYear === null
        ? 'Annee de reference du dossier non derivable. Indicateur non calculable sans base temporelle validee, jamais devine sur l horloge systeme.'
        : 'Aucune annee de projection utilisable pour cet indicateur.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: null,
      isForwardBase: false,
    };
  }
  const targetYear = resolved.year;
  const newArr = computeYoYGrowthAbsolute(fd.revenueProjection, targetYear);

  // Burn proxy : -FCF si dispo, sinon -EBITDA, sinon (OPEX - revenue)
  let burn: number | null = null;
  const fcf = pickProjectionValueAtYear(fd.fcfProjection, targetYear);
  if (fcf != null && fcf < 0) burn = -fcf;
  if (burn == null) {
    const ebitda = pickProjectionValueAtYear(fd.ebitdaProjection, targetYear);
    if (ebitda != null && ebitda < 0) burn = -ebitda;
  }
  if (burn == null) {
    const opex = pickProjectionValueAtYear(fd.opexProjection, targetYear);
    const rev = pickProjectionValueAtYear(fd.revenueProjection, targetYear);
    if (opex != null && rev != null && opex > rev) burn = opex - rev;
  }

  if (newArr == null || newArr <= 0 || burn == null) {
    return {
      key: 'burnMultiple', label, value: null, unit: benchmark.unit,
      verdict: 'non-applicable',
      rationale: newArr == null
        ? `Croissance revenue annuelle non calculable depuis le BP (annee ${targetYear} ou precedente absente).`
        : newArr <= 0
        ? 'Croissance revenue annuelle nulle ou negative : le burn multiple n est pas calculable (division par zero).'
        : 'Burn (FCF, EBITDA ou OPEX - revenue) non extractible du BP.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: targetYear,
      isForwardBase: resolved.isForward,
    };
  }

  const value = burn / newArr;
  return {
    key: 'burnMultiple', label, value: roundTo(value, 2), unit: benchmark.unit,
    verdict: classifyValue(value, benchmark),
    rationale: `Burn ${formatEur(burn)} / Net New ARR ${formatEur(newArr)} = ${roundTo(value, 2)}x.`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
    computedForYear: targetYear,
    isForwardBase: resolved.isForward,
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
  benchmarks: IndicatorBenchmarkSet | null,
  refYear: number | null,
): IndicatorResult {
  const label = 'Rule of 40';
  const benchmark = benchmarks?.ruleOf40;
  if (!fd || !benchmark) {
    return {
      key: 'ruleOf40', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: !benchmarks
        ? 'Benchmarks SaaS non applicables (asset class non reconnue ou stade non identifie). Indicateur neutralise.'
        : 'Indicateur non applicable au couple asset-class / stage ou donnees BP absentes.',
      dataConfidence: 'absent',
      computedForYear: null,
      isForwardBase: false,
    };
  }

  const resolved = resolveYearForIndicator(fd.revenueProjection, refYear);
  if (!resolved) {
    return {
      key: 'ruleOf40', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: refYear === null
        ? 'Annee de reference du dossier non derivable. Indicateur non calculable sans base temporelle validee, jamais devine sur l horloge systeme.'
        : 'Aucune annee de projection utilisable pour cet indicateur.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: null,
      isForwardBase: false,
    };
  }
  const targetYear = resolved.year;
  const growth = computeYoYGrowth(fd.revenueProjection, targetYear);
  const revenue = pickProjectionValueAtYear(fd.revenueProjection, targetYear);
  let marginPct: number | null = null;
  let marginType = '';

  const fcf = pickProjectionValueAtYear(fd.fcfProjection, targetYear);
  if (fcf != null && revenue && revenue > 0) {
    marginPct = (fcf / revenue) * 100;
    marginType = 'FCF';
  }
  if (marginPct == null) {
    const ebitda = pickProjectionValueAtYear(fd.ebitdaProjection, targetYear);
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
        ? `Croissance YoY non calculable (annee ${targetYear} ou precedente absente du BP).`
        : 'Marge FCF ou EBITDA non extractible du BP.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: targetYear,
      isForwardBase: resolved.isForward,
    };
  }

  const value = growth + marginPct;
  return {
    key: 'ruleOf40', label, value: roundTo(value, 1), unit: '%',
    verdict: classifyValue(value, benchmark),
    rationale: `Croissance YoY ${roundTo(growth, 1)}% + Marge ${marginType} ${roundTo(marginPct, 1)}% = ${roundTo(value, 1)}%.`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
    computedForYear: targetYear,
    isForwardBase: resolved.isForward,
  };
}

/**
 * NDR : prioritise l output du moteur saas-metrics-engine (extraction
 * LLM dediee qui sait deduire NDR a partir de declarations
 * explicites, de cohortes, ou d une combinaison GRR plus expansion).
 * Fallback vers regex sur rawNotes si le moteur n a rien trouve, et
 * non-applicable si vraiment aucun signal.
 */
function computeNdr(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet | null,
  saasMetrics?: SaasMetricsExtraction | null,
): IndicatorResult {
  const label = 'NDR (Net Dollar Retention)';
  const benchmark = benchmarks?.ndr;
  if (!benchmark) {
    return {
      key: 'ndr', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: !benchmarks
        ? 'Benchmarks SaaS non applicables (asset class non reconnue ou stade non identifie). NDR neutralise.'
        : 'NDR non applicable a cet asset class. La metrique mesure la retention nette de revenus recurrents sur la base installee, pertinente uniquement pour les modeles SaaS, fintech recurrent, ou consumer subscriptions. Modele du dossier non concerne.',
      dataConfidence: 'absent',
    };
  }

  // Source 1 : moteur saas-metrics-engine (extraction LLM dediee).
  // C est la voie la plus fiable : le LLM a contextualise la donnee
  // et qualifie sa provenance (declared / cohorts / grr-expansion).
  const ret = saasMetrics?.retention;
  if (ret?.ndr != null) {
    let provenanceLabel: string;
    let confidence: 'high' | 'medium' | 'low';
    switch (ret.ndrProvenance) {
      case 'declared':
        provenanceLabel = 'declare explicitement dans le pitch ou le BP';
        confidence = 'high';
        break;
      case 'computed-from-cohorts':
        provenanceLabel = 'reconstruit a partir d un tableau de cohortes';
        confidence = 'high';
        break;
      case 'computed-from-grr-and-expansion':
        provenanceLabel = `calcule a partir de GRR ${ret.grr ?? '?'}% plus expansion ${ret.netExpansionRate ?? '?'}%`;
        confidence = 'medium';
        break;
      default:
        provenanceLabel = 'origine inconnue';
        confidence = 'low';
    }
    return {
      key: 'ndr', label, value: roundTo(ret.ndr, 1), unit: '%',
      verdict: classifyValue(ret.ndr, benchmark),
      rationale: `NDR ${roundTo(ret.ndr, 1)}% (${provenanceLabel}). ${ret.notes || ''}`.trim(),
      dataConfidence: confidence,
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  // Source 2 : fallback regex sur rawNotes du financial-extraction.
  // Voie historique, gardee pour resilience si le moteur LLM a echoue.
  const rawText = (fd?.rawNotes || '').toLowerCase();
  const ndrMatch = rawText.match(/ndr[^\d]*(\d+(?:[.,]\d+)?)\s*%/i)
    || rawText.match(/net\s*dollar\s*retention[^\d]*(\d+(?:[.,]\d+)?)\s*%/i)
    || rawText.match(/net\s*revenue\s*retention[^\d]*(\d+(?:[.,]\d+)?)\s*%/i);

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

/**
 * Magic Number : prioritise l output du moteur saas-metrics-engine
 * (extraction LLM dediee qui sait reperer une declaration explicite
 * ou reconstituer la metrique a partir de S&M annuel et new ARR).
 * Sans donnees structurees, retourne non-applicable.
 */
function computeMagicNumber(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet | null,
  saasMetrics?: SaasMetricsExtraction | null,
): IndicatorResult {
  const label = 'Magic Number';
  const benchmark = benchmarks?.magicNumber;
  if (!benchmark) {
    return {
      key: 'magicNumber', label, value: null, unit: 'x',
      verdict: 'non-applicable',
      rationale: !benchmarks
        ? 'Benchmarks SaaS non applicables (asset class non reconnue ou stade non identifie). Magic Number neutralise.'
        : 'Magic Number non applicable a cet asset class. La metrique mesure l efficacite du capital S&M dans la generation d ARR new, pertinente uniquement pour les modeles SaaS et software a vente recurrente. Modele du dossier non concerne.',
      dataConfidence: 'absent',
    };
  }

  // Source unique : moteur saas-metrics-engine. Le calcul du Magic
  // Number depuis le BP standard sans cohort ni S&M trimestriel est
  // trop fragile pour etre fait par regex. On delegue entierement.
  const se = saasMetrics?.salesEfficiency;
  if (se?.magicNumber != null) {
    let provenanceLabel: string;
    let confidence: 'high' | 'medium' | 'low';
    switch (se.magicNumberProvenance) {
      case 'declared':
        provenanceLabel = 'declare explicitement';
        confidence = 'high';
        break;
      case 'computed-from-quarterly-sm':
        provenanceLabel = 'calcule sur donnees trimestrielles';
        confidence = 'high';
        break;
      case 'computed-from-annual-sm':
        provenanceLabel = `calcule sur donnees annuelles (S&M ${se.annualSmYear || '?'} = ${se.annualSmSpend ?? '?'} M EUR, New ARR ${se.annualNewArrYear || '?'} = ${se.annualNewArr ?? '?'} M EUR)`;
        confidence = 'medium';
        break;
      default:
        provenanceLabel = 'origine inconnue';
        confidence = 'low';
    }
    return {
      key: 'magicNumber', label, value: roundTo(se.magicNumber, 2), unit: 'x',
      verdict: classifyValue(se.magicNumber, benchmark),
      rationale: `Magic Number ${roundTo(se.magicNumber, 2)}x (${provenanceLabel}). ${se.notes || ''}`.trim(),
      dataConfidence: confidence,
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  return {
    key: 'magicNumber', label, value: null, unit: 'x',
    verdict: 'non-applicable',
    rationale: 'Magic Number non calculable depuis le BP standard. Necessite S&M depense Q-1 et ARR new annualise du Q. Doit etre extrait du pitch ou demande au fondateur en DD.',
    dataConfidence: 'absent',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/**
 * Payback CAC = CAC effectif par customer / (ARPU mensuel × marge brute).
 *
 * Source 1 (prioritaire) : moteur saas-metrics-engine, qui extrait le
 * CAC declare ET sa base reelle (per-customer / per-lead / per-mql)
 * et calcule un CAC effectif par customer signe en corrigeant par le
 * taux de conversion. C est la voie qui evite les verdicts trompeurs
 * sur les dossiers ou le fondateur appelle CAC un Cost Per Lead.
 *
 * Source 2 (fallback) : unitEconomics.estimatedCAC du moteur
 * financial-extraction-engine, sans correction de basis. Voie
 * historique, conservee pour les BP qui declarent un CAC bien defini
 * dans leurs onglets metriques.
 */
function computePaybackCac(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet | null,
  saasMetrics?: SaasMetricsExtraction | null,
  acquisitionFunnel?: 'present' | 'b2b-sales-led' | 'absent' | 'unknown' | null,
): IndicatorResult {
  const label = 'Payback CAC';
  const benchmark = benchmarks?.paybackCac;
  if (!benchmark) {
    return {
      key: 'paybackCac', label, value: null, unit: 'mois',
      verdict: 'non-applicable',
      rationale: !benchmarks
        ? 'Benchmarks SaaS non applicables (asset class non reconnue ou stade non identifie). Payback CAC neutralise.'
        : 'Payback CAC non applicable a cet asset class. La metrique mesure la duree d amortissement du cout d acquisition d un client, pertinente uniquement pour les modeles a vente recurrente ou repetable. Modele du dossier non concerne.',
      dataConfidence: 'absent',
    };
  }

  // Si la matrice de pertinence dit que le funnel d acquisition est
  // absent (B2G appels d offres, projets uniques sans demarche
  // marketing), Payback CAC n est pas une metrique applicable meme si
  // un CAC apparent est present dans le BP. On ferme la porte.
  if (acquisitionFunnel === 'absent') {
    return {
      key: 'paybackCac', label, value: null, unit: 'mois',
      verdict: 'non-applicable',
      rationale: 'Payback CAC non applicable : le modele economique n implique pas d acquisition par funnel marketing mesurable (vente B2G par appels d offres, projets uniques negocies). La metrique pertinente pour ce modele est le cycle commercial moyen et le taux de gain sur appels d offre soumis.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  // Source 1 : moteur saas-metrics-engine. Le LLM a extrait CAC
  // declare, basis (per-customer / per-lead / per-mql / unclear),
  // CVR si present, ACV et marge brute si declares dans le pitch.
  // Le CAC effectif par customer est deja calcule cote moteur.
  const ue = saasMetrics?.unitEconomics;
  const llmEffectiveCac = ue?.effectiveCacPerCustomer ?? null;
  const llmAcv = ue?.declaredAcv ?? null;
  const llmGrossMarginPct = ue?.declaredGrossMarginPct ?? null;
  const cacBasis = ue?.declaredCacBasis ?? 'absent';
  const llmCorrectionApplied = (cacBasis === 'per-lead' && (ue?.leadToCustomerRate ?? 0) > 0)
    || (cacBasis === 'per-mql' && (ue?.mqlToCustomerRate ?? 0) > 0);

  // Source 2 : fallback financial-extraction. Si le LLM n a rien
  // trouve, on retombe sur les valeurs du BP.
  const fdCac = fd ? parseCurrencyToEur(fd.unitEconomics?.estimatedCAC) : null;
  const fdAcv = fd ? parseCurrencyToEur(fd.unitEconomics?.averageContractValue) : null;
  const fdGrossMarginPct = fd ? parsePercent(fd.unitEconomics?.grossMarginPerUnit) : null;

  // On combine en preferant le LLM. Pour ACV et marge, on prend la
  // premiere source non nulle entre LLM et BP.
  const cac = llmEffectiveCac ?? fdCac;
  const acv = llmAcv ?? fdAcv;
  const grossMarginPct = llmGrossMarginPct ?? fdGrossMarginPct;

  if (cac == null || acv == null || acv <= 0) {
    return {
      key: 'paybackCac', label, value: null, unit: 'mois',
      verdict: 'non-applicable',
      rationale: 'CAC ou ACV non communiques dans le pitch ni le BP. Doivent etre demandes en DD pour calculer le payback. Demander aussi le funnel de conversion (visites / leads / customers) pour qualifier la base reelle du CAC.',
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

  // Construction du rationale selon la voie utilisee. On signale
  // explicitement quand une correction CVR a ete appliquee (cas le
  // plus structurant pour la lecture VC) ou quand la basis est
  // restee unclear malgre l extraction (warning).
  let cacExplanation: string;
  if (llmEffectiveCac != null && llmCorrectionApplied) {
    const rate = cacBasis === 'per-lead' ? ue?.leadToCustomerRate : ue?.mqlToCustomerRate;
    cacExplanation = `CAC effectif ${formatEur(cac)} (CAC declare ${formatEur(ue?.declaredCac || 0)} corrige par taux de conversion ${cacBasis === 'per-lead' ? 'lead-to-customer' : 'MQL-to-customer'} ${rate}%)`;
  } else if (llmEffectiveCac != null && cacBasis === 'per-customer') {
    cacExplanation = `CAC ${formatEur(cac)} (declare par customer signe, pas de correction CVR necessaire)`;
  } else if (llmEffectiveCac != null && (cacBasis === 'per-lead' || cacBasis === 'per-mql')) {
    cacExplanation = `CAC ${formatEur(cac)} (declare ${cacBasis}, taux de conversion absent du dossier : valeur non corrigee, a verifier en DD)`;
  } else if (llmEffectiveCac != null && cacBasis === 'unclear') {
    cacExplanation = `CAC ${formatEur(cac)} (base de calcul ambigue : a clarifier en DD pour distinguer CAC reel et CPL)`;
  } else {
    cacExplanation = `CAC ${formatEur(cac)} (issu du BP)`;
  }

  // dataConfidence : high si LLM a extrait basis per-customer ou
  // correction effectivement appliquee. Medium si basis ambigue
  // ou marge brute non declaree. Sinon high par defaut sur le BP.
  let dataConfidence: 'high' | 'medium' | 'low';
  if (llmEffectiveCac != null) {
    if (cacBasis === 'per-customer' || llmCorrectionApplied) {
      dataConfidence = grossMarginPct != null ? 'high' : 'medium';
    } else if (cacBasis === 'unclear' || (cacBasis === 'per-lead' || cacBasis === 'per-mql')) {
      dataConfidence = 'medium';
    } else {
      dataConfidence = grossMarginPct != null ? 'high' : 'medium';
    }
  } else {
    dataConfidence = grossMarginPct != null ? 'high' : 'medium';
  }

  return {
    key: 'paybackCac', label, value: roundTo(value, 1), unit: 'mois',
    verdict: classifyValue(value, benchmark),
    rationale: `${cacExplanation} / (ACV ${formatEur(acv)} / 12 × marge brute ${grossMarginPct != null ? `${roundTo(grossMarginPct, 0)}%` : '50% proxy'}) = ${roundTo(value, 1)} mois.`,
    dataConfidence,
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
  benchmarks: IndicatorBenchmarkSet | null,
  refYear: number | null,
): IndicatorResult {
  const label = 'Marge brute';
  const benchmark = benchmarks?.grossMargin;
  if (!fd || !benchmark) {
    return {
      key: 'grossMargin', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: !benchmarks
        ? 'Benchmarks non applicables (asset class non reconnue ou stade non identifie). Marge brute neutralisee : sera evaluee qualitativement en DD selon le secteur reel du dossier.'
        : 'Indicateur non applicable ou donnees BP absentes.',
      dataConfidence: 'absent',
      computedForYear: null,
      isForwardBase: false,
    };
  }

  // Doctrine : si refYear est null, on ne devine pas via un fallback
  // moyenne. La marge brute devient non-applicable avec motif
  // explicite plus bas.
  const resolved = refYear !== null ? resolveYearForIndicator(fd.grossMarginProjection, refYear) : null;
  let targetYear: number | null = resolved?.year ?? null;
  let isForward = resolved?.isForward ?? false;
  let value: number | null = null;
  if (targetYear !== null) {
    value = pickProjectionValueAtYear(fd.grossMarginProjection, targetYear, 1);
  }
  if (value == null && refYear !== null) {
    // Fallback : moyenne des projections disponibles. Actif uniquement
    // quand refYear existe (on a alors une intention temporelle mais
    // pas de valeur precise a la date, la moyenne est un proxy).
    const values = (fd.grossMarginProjection || []).map((p) => p.value).filter((v) => !isNaN(v));
    if (values.length > 0) {
      value = values.reduce((a, b) => a + b, 0) / values.length;
      targetYear = null;
      isForward = false;
    }
  }
  if (value == null && refYear !== null) {
    // Fallback supplementaire : unitEconomics.grossMarginPerUnit
    value = parsePercent(fd.unitEconomics?.grossMarginPerUnit);
    targetYear = null;
    isForward = false;
  }

  if (value == null) {
    return {
      key: 'grossMargin', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: refYear === null
        ? 'Annee de reference du dossier non derivable, marge brute non calculable sans base temporelle validee.'
        : 'Marge brute non communiquee dans le BP. Donnee critique pour evaluer la viabilite unitaire : a demander en DD.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: null,
      isForwardBase: false,
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
    rationale: targetYear !== null
      ? `Marge brute ${roundTo(value, 1)}% pour l exercice ${targetYear}.${trajectoryNote}`
      : `Marge brute ${roundTo(value, 1)}% (moyenne des projections disponibles).${trajectoryNote}`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
    computedForYear: targetYear,
    isForwardBase: isForward,
  };
}

/**
 * Revenue per employee = revenue annee courante / headcount annee courante.
 */
function computeRevenuePerEmployee(
  fd: FinancialDataExtraction | null | undefined,
  benchmarks: IndicatorBenchmarkSet | null,
  refYear: number | null,
): IndicatorResult {
  const label = 'Revenue par employé';
  const benchmark = benchmarks?.revenuePerEmployee;
  if (!fd || !benchmark) {
    return {
      key: 'revenuePerEmployee', label, value: null, unit: 'EUR/FTE',
      verdict: 'non-applicable',
      rationale: !benchmarks
        ? 'Benchmarks non applicables (asset class non reconnue ou stade non identifié). Capital efficiency neutralisée.'
        : 'Indicateur non applicable ou données BP absentes.',
      dataConfidence: 'absent',
      computedForYear: null,
      isForwardBase: false,
    };
  }

  const resolved = resolveYearForIndicator(fd.revenueProjection, refYear);
  if (!resolved) {
    return {
      key: 'revenuePerEmployee', label, value: null, unit: 'EUR/FTE',
      verdict: 'non-applicable',
      rationale: refYear === null
        ? 'Année de référence du dossier non dérivable, capital efficiency non calculable sans base temporelle validée.'
        : 'Aucune année de projection revenue utilisable.',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: null,
      isForwardBase: false,
    };
  }
  const targetYear = resolved.year;
  const revenue = pickProjectionValueAtYear(fd.revenueProjection, targetYear);
  const headcount = pickProjectionValueAtYear(fd.headcount, targetYear, 1);

  if (revenue == null || headcount == null || headcount <= 0) {
    return {
      key: 'revenuePerEmployee', label, value: null, unit: 'EUR/FTE',
      verdict: 'non-applicable',
      rationale: revenue == null
        ? `Revenue ${targetYear} absent du BP.`
        : `Headcount ${targetYear} absent du BP. Donnée critique pour évaluer la capital efficiency.`,
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: targetYear,
      isForwardBase: resolved.isForward,
    };
  }

  const value = revenue / headcount;
  return {
    key: 'revenuePerEmployee', label, value: Math.round(value), unit: 'EUR/FTE',
    verdict: classifyValue(value, benchmark),
    rationale: `Revenue ${formatEur(revenue)} / ${headcount} ETP = ${formatEur(value)} par employé (exercice ${targetYear}).`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
    computedForYear: targetYear,
    isForwardBase: resolved.isForward,
  };
}

// ============================================================
// INDICATEURS INDUSTRIELS / PROJECT-BASED
// ------------------------------------------------------------
// Set de remplacement pour les modeles de fabrication-vente,
// projets par operations, ou contrats B2G. Les sept KPI SaaS
// canoniques (NDR, Magic Number, Payback CAC, Burn multiple
// SaaS, Rule of 40, Marge brute SaaS, Revenue per employe)
// ne s appliquent pas structurellement a ces dossiers.
//
// Indicateurs cibles :
//   - unitMargin            : marge brute par unite vendue
//   - commercialCycle       : duree moyenne du cycle commercial
//   - orderBacklog          : carnet de commandes vs revenue annuel
//   - workingCapitalRatio   : working capital / revenue
//   - projectCapex          : capex par projet en % du revenue projet
//   - industrialCapacity    : capacite industrielle annuelle
//   - tenderWinRate         : taux de gain sur appels d offres soumis
//
// V1 : la plupart de ces indicateurs ne sont pas extractibles
// automatiquement depuis le BP standard. On les retourne en
// non-applicable avec un rationnel "a demander en DD" qui guide
// le partner. Une iteration ulterieure pourra ajouter une
// extraction LLM dediee (industrial-metrics-engine) sur le pitch
// et le BP, comme on l a fait pour saas-metrics.
// ============================================================

const INDUSTRIAL_BENCHMARKS = {
  unitMargin: { best: 35, sain: 25, surveille: 15, direction: 'higher-is-better', unit: '%' } as IndicatorThresholds,
  // Cycle commercial moyen en mois. Lower-is-better : un cycle court
  // signe une demande structuree et un go-to-market predictible.
  commercialCycle: { best: 6, sain: 12, surveille: 24, direction: 'lower-is-better', unit: 'mois' } as IndicatorThresholds,
  // Carnet de commandes en multiple de revenue annualise. Plus de
  // visibilite = meilleur signal pour les modeles a cycle long.
  orderBacklog: { best: 2, sain: 1, surveille: 0.5, direction: 'higher-is-better', unit: 'x' } as IndicatorThresholds,
  // Working capital / revenue. Lower-is-better : moins de capital
  // immobilise = meilleur retour sur cash.
  workingCapitalRatio: { best: 0.15, sain: 0.30, surveille: 0.50, direction: 'lower-is-better', unit: 'ratio' } as IndicatorThresholds,
  // Capex par projet en pourcentage du revenue projet. Plus le ratio
  // est bas, mieux c est : on degage de la marge avant capex.
  projectCapex: { best: 30, sain: 50, surveille: 70, direction: 'lower-is-better', unit: '%' } as IndicatorThresholds,
  // Industrial capacity en unites par an. Pas de seuil unique : a
  // contextualiser au stade et a la complexite. On retourne le chiffre
  // brut sans verdict pour cette V1.
  // tenderWinRate : taux de gain sur appels d offres. Sain >25% sur
  // appels d offre publics (hors mission gagnee comme leader unique).
  tenderWinRate: { best: 40, sain: 25, surveille: 10, direction: 'higher-is-better', unit: '%' } as IndicatorThresholds,
};

/**
 * Marge brute par unite vendue. Tente d extraire depuis
 * unitEconomics.grossMarginPerUnit du BP, puis depuis l extraction
 * dediee industrial-metrics-engine. Si absent partout, retourne
 * non-applicable avec un rationnel qui demande la donnee en DD.
 */
function computeUnitMargin(
  fd: FinancialDataExtraction | null | undefined,
  im?: IndustrialMetricsExtraction | null,
): IndicatorResult {
  const label = 'Marge brute par unite';
  const benchmark = INDUSTRIAL_BENCHMARKS.unitMargin;

  // Priorite : extraction LLM dediee si presente, sinon fallback BP.
  let marginPct: number | null = null;
  let provenance: 'industrial-engine' | 'bp' | null = null;
  if (im?.unitGrossMarginPct != null && im.unitGrossMarginProvenance !== 'absent') {
    marginPct = im.unitGrossMarginPct;
    provenance = 'industrial-engine';
  } else {
    const fromBp = fd ? parsePercent(fd.unitEconomics?.grossMarginPerUnit) : null;
    if (fromBp != null) {
      marginPct = fromBp;
      provenance = 'bp';
    }
  }

  if (marginPct == null) {
    return {
      key: 'unitMargin', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: 'Marge brute par unite non communiquee dans le BP ni inferable du pitch. Critique pour les modeles a fabrication-vente : a extraire en DD (prix unitaire + cout direct par unite, hors overheads).',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  const sourceLabel = provenance === 'industrial-engine' ? 'pitch + BP' : 'BP';
  return {
    key: 'unitMargin', label, value: roundTo(marginPct, 1), unit: '%',
    verdict: classifyValue(marginPct, benchmark),
    rationale: `Marge brute par unite ${roundTo(marginPct, 1)}% (extraite du ${sourceLabel}).`,
    dataConfidence: 'high',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/**
 * Cycle commercial moyen en mois. Extrait par industrial-metrics-engine
 * si disponible, sinon non-applicable avec rationnel DD.
 */
function computeCommercialCycle(im?: IndustrialMetricsExtraction | null): IndicatorResult {
  const label = 'Cycle commercial';
  const benchmark = INDUSTRIAL_BENCHMARKS.commercialCycle;

  if (im?.commercialCycleMonths == null || im.commercialCycleProvenance === 'absent') {
    return {
      key: 'commercialCycle', label, value: null, unit: 'mois',
      verdict: 'non-applicable',
      rationale: 'Cycle commercial moyen non extractible du pitch ni du BP. Determinant pour les modeles a fabrication-vente et a projets : a demander en DD (du premier contact a la signature, hors phase de production).',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  return {
    key: 'commercialCycle', label, value: im.commercialCycleMonths, unit: 'mois',
    verdict: classifyValue(im.commercialCycleMonths, benchmark),
    rationale: `Cycle commercial moyen ${im.commercialCycleMonths} mois (provenance ${im.commercialCycleProvenance}).`,
    dataConfidence: im.commercialCycleProvenance === 'declared' ? 'high' : 'medium',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/**
 * Carnet de commandes en multiple de revenue annualise.
 */
function computeOrderBacklog(
  fd: FinancialDataExtraction | null | undefined,
  im: IndustrialMetricsExtraction | null | undefined,
  refYear: number | null,
): IndicatorResult {
  const label = 'Carnet de commandes';
  const benchmark = INDUSTRIAL_BENCHMARKS.orderBacklog;

  if (im?.orderBacklogEur == null || im.orderBacklogProvenance === 'absent') {
    return {
      key: 'orderBacklog', label, value: null, unit: 'x',
      verdict: 'non-applicable',
      rationale: 'Carnet de commandes non communique dans les documents fournis. Indicateur structurant de visibilite pour les modeles industriels : a demander en DD (somme des contrats signes ou commandes fermes / revenue annuel projete).',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: null,
      isForwardBase: false,
    };
  }

  const resolved = fd ? resolveYearForIndicator(fd.revenueProjection, refYear) : null;
  const revenue = resolved && fd ? pickProjectionValueAtYear(fd.revenueProjection, resolved.year) : null;
  if (revenue == null || revenue <= 0) {
    return {
      key: 'orderBacklog', label, value: null, unit: 'x',
      verdict: 'non-applicable',
      rationale: refYear === null
        ? `Carnet de commandes ${formatEur(im.orderBacklogEur)} extrait, mais annee de reference du dossier non derivable. Multiple non calculable sans base temporelle validee.`
        : `Carnet de commandes ${formatEur(im.orderBacklogEur)} extrait, mais revenue exercice ${resolved?.year ?? refYear} absent du BP.`,
      dataConfidence: 'medium',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: resolved?.year ?? null,
      isForwardBase: resolved?.isForward ?? false,
    };
  }

  const multiple = im.orderBacklogEur / revenue;
  return {
    key: 'orderBacklog', label, value: roundTo(multiple, 2), unit: 'x',
    verdict: classifyValue(multiple, benchmark),
    rationale: `Carnet de commandes ${formatEur(im.orderBacklogEur)} / revenue ${formatEur(revenue)} = ${roundTo(multiple, 2)}x annualise sur exercice ${resolved!.year} (provenance ${im.orderBacklogProvenance}).`,
    dataConfidence: im.orderBacklogProvenance === 'declared' ? 'high' : 'medium',
    benchmark: thresholdsToBenchmark(benchmark),
    computedForYear: resolved!.year,
    isForwardBase: resolved!.isForward,
  };
}

/**
 * Working capital ratio. Working capital / revenue annuel.
 */
function computeWorkingCapitalRatio(
  fd: FinancialDataExtraction | null | undefined,
  im: IndustrialMetricsExtraction | null | undefined,
  refYear: number | null,
): IndicatorResult {
  const label = 'Working capital ratio';
  const benchmark = INDUSTRIAL_BENCHMARKS.workingCapitalRatio;

  if (im?.workingCapitalEur == null || im.workingCapitalProvenance === 'absent') {
    return {
      key: 'workingCapitalRatio', label, value: null, unit: 'ratio',
      verdict: 'non-applicable',
      rationale: 'Working capital non extractible des documents. Critique pour les modeles industriels a cycle long : a demander en DD (besoin en fonds de roulement / revenue annuel).',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: null,
      isForwardBase: false,
    };
  }

  const resolved = fd ? resolveYearForIndicator(fd.revenueProjection, refYear) : null;
  const revenue = resolved && fd ? pickProjectionValueAtYear(fd.revenueProjection, resolved.year) : null;
  if (revenue == null || revenue <= 0) {
    return {
      key: 'workingCapitalRatio', label, value: null, unit: 'ratio',
      verdict: 'non-applicable',
      rationale: refYear === null
        ? `Working capital ${formatEur(im.workingCapitalEur)} extrait, mais annee de reference du dossier non derivable. Ratio non calculable sans base temporelle validee.`
        : `Working capital ${formatEur(im.workingCapitalEur)} extrait, mais revenue exercice ${resolved?.year ?? refYear} absent du BP.`,
      dataConfidence: 'medium',
      benchmark: thresholdsToBenchmark(benchmark),
      computedForYear: resolved?.year ?? null,
      isForwardBase: resolved?.isForward ?? false,
    };
  }

  const ratio = im.workingCapitalEur / revenue;
  return {
    key: 'workingCapitalRatio', label, value: roundTo(ratio, 2), unit: 'ratio',
    verdict: classifyValue(ratio, benchmark),
    rationale: `Working capital ${formatEur(im.workingCapitalEur)} / revenue ${formatEur(revenue)} = ${roundTo(ratio, 2)} (exercice ${resolved!.year}).`,
    dataConfidence: im.workingCapitalProvenance === 'declared' ? 'high' : 'medium',
    benchmark: thresholdsToBenchmark(benchmark),
    computedForYear: resolved!.year,
    isForwardBase: resolved!.isForward,
  };
}

/**
 * Capex par projet en pourcentage du revenue moyen par projet.
 */
function computeProjectCapex(im?: IndustrialMetricsExtraction | null): IndicatorResult {
  const label = 'Capex par projet';
  const benchmark = INDUSTRIAL_BENCHMARKS.projectCapex;

  if (im?.capexPerProjectEur == null || im.capexPerProjectProvenance === 'absent'
      || im.averageContractValueEur == null || im.averageContractValueProvenance === 'absent') {
    return {
      key: 'projectCapex', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: 'Capex par projet et / ou taille moyenne contrat non extraits. Indicateur d intensite capitalistique pour les modeles a SPV : a demander en DD (capex moyen par projet / revenue moyen par projet).',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  const ratioPct = (im.capexPerProjectEur / im.averageContractValueEur) * 100;
  return {
    key: 'projectCapex', label, value: roundTo(ratioPct, 1), unit: '%',
    verdict: classifyValue(ratioPct, benchmark),
    rationale: `Capex projet ${formatEur(im.capexPerProjectEur)} / contrat moyen ${formatEur(im.averageContractValueEur)} = ${roundTo(ratioPct, 1)}%.`,
    dataConfidence: 'medium',
    benchmark: thresholdsToBenchmark(benchmark),
  };
}

/**
 * Capacite industrielle annuelle (unites par an).
 */
function computeIndustrialCapacity(im?: IndustrialMetricsExtraction | null): IndicatorResult {
  const label = 'Capacite industrielle';
  if (im?.annualProductionCapacityUnits == null || im.annualProductionCapacityProvenance === 'absent') {
    return {
      key: 'industrialCapacity', label, value: null, unit: 'unites/an',
      verdict: 'non-applicable',
      rationale: 'Capacite industrielle non communiquee. Determinante pour les modeles a fabrication unitaire : a demander en DD (production maximale annuelle au stade actuel et trajectoire de scale-up).',
      dataConfidence: 'absent',
    };
  }
  return {
    key: 'industrialCapacity', label, value: im.annualProductionCapacityUnits, unit: 'unites/an',
    verdict: 'sain', // Pas de seuil par benchmark, on affiche la valeur sans verdict comparatif
    rationale: `Capacite ${im.annualProductionCapacityUnits} unites par an au stade actuel (provenance ${im.annualProductionCapacityProvenance}).`,
    dataConfidence: im.annualProductionCapacityProvenance === 'declared' ? 'high' : 'medium',
  };
}

/**
 * Taux de gain sur appels d offres soumis (B2G principalement).
 */
function computeTenderWinRate(im?: IndustrialMetricsExtraction | null): IndicatorResult {
  const label = 'Taux de gain appels d offres';
  const benchmark = INDUSTRIAL_BENCHMARKS.tenderWinRate;

  if (im?.tenderWinRatePct == null || im.tenderWinRateProvenance === 'absent') {
    return {
      key: 'tenderWinRate', label, value: null, unit: '%',
      verdict: 'non-applicable',
      rationale: 'Taux de gain sur appels d offres non communique. Critique pour les modeles B2G et project-based : a demander en DD (nombre d appels d offre gagnes / nombre soumis sur les 24 derniers mois).',
      dataConfidence: 'absent',
      benchmark: thresholdsToBenchmark(benchmark),
    };
  }

  return {
    key: 'tenderWinRate', label, value: roundTo(im.tenderWinRatePct, 1), unit: '%',
    verdict: classifyValue(im.tenderWinRatePct, benchmark),
    rationale: `Taux de gain ${roundTo(im.tenderWinRatePct, 1)}% sur appels d offres soumis (provenance ${im.tenderWinRateProvenance}).`,
    dataConfidence: im.tenderWinRateProvenance === 'declared' ? 'high' : 'medium',
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
  /** Output du moteur saas-metrics-engine, qui debloque NDR et Magic
   * Number sur les dossiers SaaS B2B. Optionnel : si absent, le
   * moteur retombe sur les fallbacks regex / non-applicable. */
  saasMetrics?: SaasMetricsExtraction | null | undefined;
  /** Output du moteur industrial-metrics-engine, qui debloque les
   * indicateurs industriels (cycle commercial, carnet de commandes,
   * working capital, capex projet, capacite industrielle, taux de
   * gain appels d offres). Optionnel : si absent, les indicateurs
   * industriels retombent sur leurs non-applicable rationalisees. */
  industrialMetrics?: IndustrialMetricsExtraction | null | undefined;
  /** Matrice de pertinence calculee en amont. Determine quel set
   * d indicateurs est pertinent (SaaS, industriel, hybride) selon
   * le modele economique du dossier. Si absente : comportement
   * legacy avec set SaaS canonique sur tous les dossiers. */
  relevanceMatrix?: RelevanceMatrix | null | undefined;
  /** Annee de reference du dossier, primitive partagee de
   * lib/analysis/reference-year.ts. Le moteur ne consulte JAMAIS
   * l horloge systeme. Si null, les indicateurs deviennent
   * non-applicable avec motif explicite, ils ne devinent pas. */
  referenceYear: number | null;
}

export function computeIndicators(input: IndicatorsInput): IndicatorsOutput {
  // Asset class : on lit en priorite matrix.assetClass, source de
  // verite arbitree dans computeRelevanceMatrix. Fallback sur la
  // classification locale uniquement si la matrice est absente.
  const ext: any = input.extraction;
  const matrixAssetClass = input.relevanceMatrix?.assetClass;
  const stageRaw = ext?.fundraise?.stage || null;
  let assetClass: string;
  if (matrixAssetClass) {
    assetClass = matrixAssetClass;
  } else {
    const assetClassRaw = ext
      ? `${ext.sector || ''} ${ext.subSector || ''}`.trim() || ext.sector
      : null;
    assetClass = normalizeAssetClass(assetClassRaw);
  }
  const stage = normalizeStage(stageRaw);

  // Doctrine : si l asset class ou le stade ne sont pas reconnus, on
  // neutralise les sept indicateurs SaaS plutot que de les juger contre
  // des seuils saas-b2b decales (cas Platypus Craft : dossier
  // industrial-hardware retombait en saas-b2b silencieux, ratios
  // industriels notes a l aune de standards logiciels). getIndicator
  // Benchmarks retourne null dans ce cas et les compute* basculent
  // automatiquement en non-applicable avec rationale explicite.
  const benchmarks = getIndicatorBenchmarks(assetClass, stage);
  const fd = input.financialData;
  const sm = input.saasMetrics;
  const im = input.industrialMetrics;
  const rm = input.relevanceMatrix;

  // Selection du set d indicateurs selon la matrice de pertinence.
  // Trois cas :
  //   1. Si la matrice indique un modele industriel (unitary-sale,
  //      project-based, contract-b2g) avec indicatorsIndustrial=full,
  //      on bascule sur le set industriel + revenue per employee
  //      qui reste pertinent.
  //   2. Si la matrice indique un modele recurrent (SaaS, consumer
  //      subscription) ou marketplace, on garde le set SaaS canonique
  //      avec eventuellement Payback CAC conditionne par le funnel.
  //   3. Si pas de matrice (compat retro) ou modele unknown, on
  //      garde le set SaaS canonique.
  const useIndustrialSet = rm?.verdicts.indicatorsIndustrial.applicable === 'full';
  const acquisitionFunnel = rm?.acquisitionFunnel ?? null;
  const refYear = input.referenceYear;

  let indicators: IndicatorResult[];
  if (useIndustrialSet) {
    // Set industriel : marge unite, cycle commercial, carnet de
    // commandes, working capital, capex par projet, capacite
    // industrielle, taux de gain appels d offres + revenue per
    // employee qui reste pertinent partout. Les six premiers
    // indicateurs sont desormais reellement calculables si le moteur
    // industrial-metrics-engine a tourne (depuis le pitch + BP).
    indicators = [
      computeUnitMargin(fd, im),
      computeCommercialCycle(im),
      computeOrderBacklog(fd, im, refYear),
      computeWorkingCapitalRatio(fd, im, refYear),
      computeProjectCapex(im),
      computeIndustrialCapacity(im),
      computeTenderWinRate(im),
      computeRevenuePerEmployee(fd, benchmarks, refYear),
    ];
  } else {
    // Set SaaS canonique. Payback CAC est conditionne par le funnel
    // d acquisition de la matrice : si funnel absent (B2G, projets
    // uniques), Payback est marque non-applicable explicitement.
    indicators = [
      computeBurnMultiple(fd, benchmarks, refYear),
      computeRuleOf40(fd, benchmarks, refYear),
      computeNdr(fd, benchmarks, sm),
      computeMagicNumber(fd, benchmarks, sm),
      computePaybackCac(fd, benchmarks, sm, acquisitionFunnel),
      computeGrossMargin(fd, benchmarks, refYear),
      computeRevenuePerEmployee(fd, benchmarks, refYear),
    ];
  }

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
  const synthesis = buildSynthesis(indicators, applicableCount, score, useIndustrialSet);

  // Warnings
  const warnings: string[] = [];
  // Signal explicite quand benchmarks ont ete neutralises faute d
  // ancrage sectoriel ou de stade : la note doit savoir que le score
  // d execution n est pas reellement ancre sur un comparable sectoriel.
  if (!benchmarks) {
    if (stage === 'unknown' && assetClass === 'unclassified') {
      warnings.push('Stade et asset class non identifies. Indicateurs neutralises : le moteur ne peut pas evaluer la sante economique sans benchmarks ancres. Demander au partner de clarifier le palier de levee et le secteur dominant avant de conclure.');
    } else if (stage === 'unknown') {
      warnings.push(`Stade non identifie (libelle pitch atypique : 'bridge', 'tour intermediaire', 'pre-B', etc.). Indicateurs neutralises plutot que juges contre des seuils seed par defaut. A confirmer avec le partner.`);
    } else if (assetClass === 'unclassified') {
      warnings.push(`Asset class non reconnue. Indicateurs SaaS neutralises pour eviter un verdict cale sur des seuils logiciels decales. Voir matrix.assetClass + matrix.productionChain pour le routage doctrinal des indicateurs en aval.`);
    } else {
      warnings.push(`Benchmarks indisponibles pour le couple (${assetClass}, ${stage}). Indicateurs neutralises.`);
    }
  } else if (applicableCount === 0) {
    warnings.push(useIndustrialSet
      ? 'Aucun indicateur industriel calculable : la plupart des indicateurs (carnet de commandes, cycle commercial, working capital, capex projet) requièrent une extraction LLM dédiée ou des données DD non présentes dans le BP standard.'
      : 'Aucun indicateur calculable : le BP fourni ne contient pas les données structurées nécessaires (revenue, marge brute, headcount, EBITDA, unit economics).');
  } else if (applicableCount <= 2) {
    warnings.push(`Seuls ${applicableCount} indicateurs applicables. Le score d execution est moins robuste qu une evaluation complete.`);
  }
  const naCount = indicators.filter((i) => i.verdict === 'non-applicable').length;
  if (naCount >= 5 && !useIndustrialSet && benchmarks) {
    warnings.push('La plupart des indicateurs sont non applicables faute de donnees structurees. Demander au fondateur un BP plus complet (revenue, marge brute, EBITDA, headcount, unit economics par segment).');
  }

  // Signal G2 : fraicheur du benchmark. Si le set d indicateurs utilise
  // a ete calibre il y a plus de 12 mois, on emet UN warning sobre. Le
  // partner doit savoir que les seuils ne sont pas alignes sur la photo
  // marche du trimestre courant, sans noyer la note dans des disclaimers.
  if (benchmarks && applicableCount > 0 && refYear !== null) {
    // Fraicheur benchmark ancree sur l annee de reference du dossier
    // (mi-annee conventionnelle), jamais sur l horloge du run. Sans
    // refYear, on n emet pas de warning fraicheur : mieux vaut se
    // taire que produire une chaine qui varie avec l horloge.
    const anchor = new Date(Date.UTC(refYear, 5, 28));
    const months = computeBenchmarkFreshnessMonths(benchmarks.asOf, anchor);
    if (months !== null && months > 12) {
      warnings.push(
        `Benchmarks indicateurs calibres il y a ${months} mois (asOf ${benchmarks.asOf}, sources OpenView / Bessemer / Pavilion / Atomico). A recroiser au prochain refresh annuel.`,
      );
    }
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

function buildSynthesis(indicators: IndicatorResult[], applicableCount: number, score: number, useIndustrialSet: boolean = false): string {
  if (applicableCount === 0) {
    return useIndustrialSet
      ? 'Aucun indicateur industriel calculable à partir du BP standard. Les indicateurs cibles pour ce modèle économique (marge unité, cycle commercial, carnet de commandes, working capital, capex par projet, capacité industrielle, taux de gain appels d offres) sont à extraire en DD ou via une itération ultérieure du moteur. Le BP SaaS classique n est pas le bon cadre d analyse pour ce dossier.'
      : 'Aucun indicateur applicable : le BP est trop incomplet pour évaluer la santé économique du dossier. Les sept indicateurs canoniques (Burn multiple, Rule of 40, NDR, Magic Number, Payback CAC, Marge brute, Revenue par employé) requièrent des données structurées absentes ici. Étape obligatoire en DD : récupérer un BP détaillé du fondateur.';
  }

  const best = indicators.filter((i) => i.verdict === 'best-in-class').length;
  const sain = indicators.filter((i) => i.verdict === 'sain').length;
  const surveille = indicators.filter((i) => i.verdict === 'a-surveiller').length;
  const rouge = indicators.filter((i) => i.verdict === 'rouge').length;

  const summary = `${best} best-in-class, ${sain} sain, ${surveille} a-surveiller, ${rouge} rouge sur ${applicableCount} indicateur${applicableCount > 1 ? 's' : ''} applicable${applicableCount > 1 ? 's' : ''}.`;

  if (applicableCount < 3) {
    const totalCount = indicators.length;
    const setLabel = useIndustrialSet ? 'industriels' : 'SaaS';
    return `${summary} Score d execution non calculable faute de donnees structurees suffisantes (${applicableCount}/${totalCount} indicateurs ${setLabel} applicables). Le moteur n affiche pas de jugement global sur cette base. ${useIndustrialSet ? 'Demander en DD : marge unite, cycle commercial, carnet de commandes, working capital, capex par projet.' : 'Demander au fondateur un BP plus complet (revenue YoY, marge brute, EBITDA, headcount, unit economics par segment) avant de conclure.'}`;
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
