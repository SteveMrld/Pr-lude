/**
 * Moteur Benchmarks Prélude (Session 2/4).
 *
 * Role : positionner le dossier instruit contre les bornes externes consolidees
 * dans lib/benchmarks/. Sortie consommee par les moteurs Coherence financiere,
 * Macro, Pattern, Blindspot pour enrichir leur raisonnement.
 *
 * Implementation 100% TypeScript pur, ZERO appel LLM. La comparaison numerique
 * est deterministe, fiable, instantanee, et n a pas besoin de raisonnement
 * generatif. Les moteurs en aval auront leur propre LLM pour interpreter
 * ces chiffres en prose.
 */

import { normalizeFrText } from '../data/text-normalize';
import type {
  ExtractionOutput,
  FinancialDataExtraction,
  BenchmarkPositioning,
} from './types';
import {
  MEDIAN_VALUATIONS_US_2026_Q1,
  MEDIAN_VALUATIONS_AI_VS_NON_AI_2026_Q1,
  STEP_UP_MEDIAN_2026_Q1,
  YEARS_BETWEEN_ROUNDS_2026_Q1,
  AI_SHARE_OF_MARKET_2026_Q1,
  MIGHTY_50_SAMPLE,
  NOTABLE_EUROPEAN_ROUNDS_2025,
  classifyDeviation,
  type Stage,
} from '../benchmarks';

/**
 * Normalise une chaine de stage extrait du dossier vers un Stage canonique.
 * Tolerant aux formulations variees (Series A, série A, A round, etc.).
 */
function normalizeStage(rawStage: string | undefined): Stage | 'unknown' {
  if (!rawStage) return 'unknown';
  const s = rawStage.toLowerCase().trim();

  if (s.includes('pre-seed') || s.includes('preseed') || s.includes('pré-seed')) {
    return 'seed'; // on regroupe pre-seed avec seed pour les benchmarks
  }
  if (s.includes('seed') || s === 'amorçage' || s === 'amorcage') {
    return 'seed';
  }
  if (
    s.match(/\b(series|série|serie)\s*a\b/) ||
    s.match(/\ba\s*round\b/) ||
    s === 'a' ||
    s === 'série a' ||
    s === 'serie a'
  ) {
    return 'seriesA';
  }
  if (
    s.match(/\b(series|série|serie)\s*b\b/) ||
    s.match(/\bb\s*round\b/) ||
    s === 'b' ||
    s === 'série b'
  ) {
    return 'seriesB';
  }
  if (
    s.match(/\b(series|série|serie)\s*c\b/) ||
    s.match(/\bc\s*round\b/) ||
    s === 'c' ||
    s === 'série c'
  ) {
    return 'seriesC';
  }
  if (
    s.match(/\b(series|série|serie)\s*[d-z]\b/) ||
    s.includes('venture growth') ||
    s.includes('growth') ||
    s.includes('late stage')
  ) {
    return 'seriesDPlus';
  }
  return 'unknown';
}

/**
 * Detecte si le dossier est dans le secteur IA en se basant sur le secteur
 * extrait et le sub-sector. Tolerant a plusieurs formulations.
 */
function detectIsAi(extraction: ExtractionOutput): boolean {
  const haystack = normalizeFrText([
    extraction.sector,
    extraction.subSector,
    extraction.productDescription,
    extraction.marketPitch,
  ]
    .filter(Boolean)
    .join(' '));

  const aiKeywords = [
    'ai',
    'a.i.',
    'artificial intelligence',
    'intelligence artificielle',
    'machine learning',
    'ml ',
    'deep learning',
    'neural network',
    'genai',
    'generative ai',
    'llm',
    'foundation model',
    'transformer',
    'nlp',
    'computer vision',
  ];
  return aiKeywords.some((kw) => haystack.includes(kw));
}

/**
 * Detecte la region du dossier a partir du pays.
 * On considere Europe = UE + UK + EEE + Suisse.
 */
function detectRegion(extraction: ExtractionOutput): 'US' | 'Europe' | 'Other' | 'unknown' {
  const country = (extraction.country || '').toLowerCase().trim();
  if (!country) return 'unknown';

  if (country.includes('united states') || country === 'us' || country === 'usa' || country.includes('états-unis') || country.includes('etats-unis')) {
    return 'US';
  }

  const europeanCountries = [
    'france',
    'germany',
    'allemagne',
    'united kingdom',
    'uk',
    'royaume-uni',
    'spain',
    'espagne',
    'italy',
    'italie',
    'netherlands',
    'pays-bas',
    'belgium',
    'belgique',
    'sweden',
    'suède',
    'suede',
    'denmark',
    'danemark',
    'finland',
    'finlande',
    'norway',
    'norvège',
    'norvege',
    'ireland',
    'irlande',
    'portugal',
    'austria',
    'autriche',
    'switzerland',
    'suisse',
    'poland',
    'pologne',
    'estonia',
    'estonie',
    'lithuania',
    'lituanie',
    'latvia',
    'lettonie',
    'czech',
    'tchèque',
    'tcheque',
    'greece',
    'grèce',
    'grece',
    'hungary',
    'hongrie',
    'romania',
    'roumanie',
    'bulgaria',
    'bulgarie',
    'slovakia',
    'slovaquie',
    'slovenia',
    'slovénie',
    'slovenie',
    'luxembourg',
    'malta',
    'malte',
    'cyprus',
    'chypre',
    'iceland',
    'islande',
  ];
  if (europeanCountries.some((c) => country.includes(c))) {
    return 'Europe';
  }
  return 'Other';
}

/**
 * Parse un montant de levée extrait du dossier vers un nombre en millions USD.
 * Tolerant a plusieurs formats : "10M€", "$5M", "5 millions", etc.
 *
 * Note: pour la conversion EUR -> USD, on utilise un taux conservateur de 1.07
 * (moyenne 2024-2026). Si le format est ambigu, on retourne null.
 */
function parseAmountToMillionsUsd(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/\s/g, '');

  // Detecte la devise (defaut USD si absent)
  const isEur = s.includes('€') || s.includes('eur');
  const conversionRate = isEur ? 1.07 : 1.0;

  // Cherche un nombre suivi optionnellement de M / K / B / millions / milliards
  const match = s.match(/(\d+(?:[.,]\d+)?)\s*(m|k|b|md|million|milliard|billion|thousand)?/);
  if (!match) return null;

  const num = parseFloat(match[1].replace(',', '.'));
  const unit = match[2] || '';

  let valueMillions: number;
  if (unit === 'k' || unit === 'thousand') {
    valueMillions = num / 1000;
  } else if (unit === 'b' || unit === 'md' || unit.includes('milliard') || unit === 'billion') {
    valueMillions = num * 1000;
  } else if (unit === 'm' || unit.includes('million')) {
    valueMillions = num;
  } else {
    // pas d unite : on assume millions par defaut si > 1, sinon on ne sait pas
    if (num >= 1 && num < 10000) {
      valueMillions = num;
    } else {
      return null;
    }
  }
  return valueMillions * conversionRate;
}

/**
 * Genere un resume textuel court du verdict de positionnement valorisation.
 */
function generateValuationSummary(
  dossierValue: number | null,
  benchmarkMedian: number | null,
  deviationPercent: number | null,
  verdict: BenchmarkPositioning['preMoney']['verdict'],
  benchmarkSegment: string,
): string {
  if (verdict === 'no_data' || dossierValue === null || benchmarkMedian === null) {
    return "Valorisation pre-money non extractible du dossier ou benchmark indisponible pour ce stade.";
  }
  const sign = (deviationPercent ?? 0) >= 0 ? '+' : '';
  switch (verdict) {
    case 'in_line':
      return `Valorisation pre-money de ${dossierValue.toFixed(1)}M$ alignee avec la mediane marche (${benchmarkMedian}M$, ${benchmarkSegment}, ecart ${sign}${(deviationPercent ?? 0).toFixed(0)}%).`;
    case 'above_market':
      return `Valorisation pre-money de ${dossierValue.toFixed(1)}M$ au-dessus de la mediane marche (${benchmarkMedian}M$, ${benchmarkSegment}, ecart ${sign}${(deviationPercent ?? 0).toFixed(0)}%). Justification a verifier dans le pricing.`;
    case 'below_market':
      return `Valorisation pre-money de ${dossierValue.toFixed(1)}M$ en-dessous de la mediane marche (${benchmarkMedian}M$, ${benchmarkSegment}, ecart ${(deviationPercent ?? 0).toFixed(0)}%). Opportunite de valorisation potentielle.`;
    case 'extreme_outlier':
      if ((deviationPercent ?? 0) > 0) {
        return `Valorisation pre-money de ${dossierValue.toFixed(1)}M$ tres significativement au-dessus de la mediane marche (${benchmarkMedian}M$, ${benchmarkSegment}, ecart ${sign}${(deviationPercent ?? 0).toFixed(0)}%). Outlier extreme : la valorisation doit etre justifiee par des metriques exceptionnelles.`;
      }
      return `Valorisation pre-money de ${dossierValue.toFixed(1)}M$ tres significativement en-dessous de la mediane marche (${benchmarkMedian}M$, ${benchmarkSegment}, ecart ${(deviationPercent ?? 0).toFixed(0)}%). Outlier extreme : verifier la sante du dossier ou opportunite reelle.`;
    default:
      return '';
  }
}

/**
 * Genere un resume textuel court du verdict de positionnement deal size.
 */
function generateDealSizeSummary(
  dossierValue: number | null,
  benchmarkMedian: number | null,
  deviationPercent: number | null,
  verdict: BenchmarkPositioning['dealSize']['verdict'],
): string {
  if (verdict === 'no_data' || dossierValue === null || benchmarkMedian === null) {
    return "Montant du tour non extractible du dossier ou benchmark indisponible.";
  }
  const sign = (deviationPercent ?? 0) >= 0 ? '+' : '';
  const absDev = Math.abs(deviationPercent ?? 0).toFixed(0);
  switch (verdict) {
    case 'in_line':
      return `Tour de ${dossierValue.toFixed(1)}M$ aligne avec la taille mediane marche (${benchmarkMedian}M$, ecart ${sign}${(deviationPercent ?? 0).toFixed(0)}%).`;
    case 'above_market':
      return `Tour de ${dossierValue.toFixed(1)}M$ superieur a la taille mediane marche (${benchmarkMedian}M$, +${absDev}%). Capitalisation forte qui doit correspondre a un plan de deploiement ambitieux.`;
    case 'below_market':
      return `Tour de ${dossierValue.toFixed(1)}M$ inferieur a la taille mediane marche (${benchmarkMedian}M$, -${absDev}%). Tour conservateur, runway a verifier.`;
    case 'extreme_outlier':
      return `Tour de ${dossierValue.toFixed(1)}M$ extremement different de la taille mediane marche (${benchmarkMedian}M$, ${sign}${(deviationPercent ?? 0).toFixed(0)}%).`;
    default:
      return '';
  }
}

/**
 * Selectionne 3 comparables europeens pertinents si le dossier est europeen.
 * Heuristique simple basee sur le sector.
 */
function pickEuropeanComparables(
  extraction: ExtractionOutput,
): BenchmarkPositioning['europeanComparables'] {
  const sector = normalizeFrText(extraction.sector);
  const subSector = normalizeFrText(extraction.subSector);
  const haystack = `${sector} ${subSector}`;

  const matches = MIGHTY_50_SAMPLE.filter((comp) => {
    const compSector = normalizeFrText(comp.sector);
    return compSector.split(/[/\s]+/).some((token) => token.length > 3 && haystack.includes(token));
  });

  // Si on n a pas 3 matches sectoriels, on complete avec quelques references generiques
  const top: typeof MIGHTY_50_SAMPLE[number][] = matches.slice(0, 3);
  if (top.length < 3) {
    const generic: typeof MIGHTY_50_SAMPLE[number][] = MIGHTY_50_SAMPLE.filter((c) => !top.includes(c)).slice(0, 3 - top.length);
    top.push(...generic);
  }

  return top.map((c) => ({
    name: c.name,
    sector: c.sector,
    relevance: c.notes || `Comparable europeen ${c.country} dans le secteur ${c.sector}.`,
  }));
}

/**
 * Fonction principale du moteur Benchmarks.
 * Prend l extraction + les donnees financieres et produit un BenchmarkPositioning.
 */
export async function analyzeBenchmarks(
  extraction: ExtractionOutput,
  financialData: FinancialDataExtraction | null,
): Promise<BenchmarkPositioning> {
  const stage = normalizeStage(extraction.fundraise?.stage);
  const isAi = detectIsAi(extraction);
  const region = detectRegion(extraction);
  const warnings: string[] = [];

  // 1. Parsing montant pre-money et taille du tour
  const dossierPreMoney = parseAmountToMillionsUsd(extraction.fundraise?.valuation);
  const dossierDealSize = parseAmountToMillionsUsd(
    financialData?.currentRound?.amount || extraction.fundraise?.amount,
  );

  if (dossierPreMoney === null) {
    warnings.push('Pre-money non extractible du dossier.');
  }
  if (dossierDealSize === null) {
    warnings.push('Montant du tour non extractible du dossier.');
  }

  // 2. Selection du benchmark approprie
  let preMoneyBenchmark: number | null = null;
  let dealSizeBenchmark: number | null = null;
  let benchmarkSegment = 'US toutes verticales Q1 2026';

  if (stage !== 'unknown') {
    if (isAi) {
      preMoneyBenchmark = MEDIAN_VALUATIONS_AI_VS_NON_AI_2026_Q1[stage].preMoneyMedianMillionsUsd.ai;
      benchmarkSegment = `US ${stage} IA Q1 2026`;
    } else {
      preMoneyBenchmark = MEDIAN_VALUATIONS_AI_VS_NON_AI_2026_Q1[stage].preMoneyMedianMillionsUsd.nonAi;
      benchmarkSegment = `US ${stage} non-IA Q1 2026`;
    }
    dealSizeBenchmark = MEDIAN_VALUATIONS_US_2026_Q1[stage].dealSizeMedianMillionsUsd;
  } else {
    warnings.push('Stade du tour non identifiable. Benchmarks de positionnement indisponibles.');
  }

  // Warning specifique Europe vs US
  if (region === 'Europe') {
    warnings.push(
      "Dossier europeen compare aux benchmarks US (PitchBook). Le marche europeen est structurellement ~6x plus petit annuellement (Atomico SoET 2025). Privilegier les comparables europeens listes ci-dessous.",
    );
  }

  // 3. Calcul des deviations et verdicts
  const preMoneyDeviation =
    dossierPreMoney !== null && preMoneyBenchmark !== null
      ? ((dossierPreMoney - preMoneyBenchmark) / preMoneyBenchmark) * 100
      : null;
  const preMoneyVerdict =
    dossierPreMoney !== null && preMoneyBenchmark !== null
      ? classifyDeviation(dossierPreMoney, preMoneyBenchmark)
      : ('no_data' as const);

  const dealSizeDeviation =
    dossierDealSize !== null && dealSizeBenchmark !== null
      ? ((dossierDealSize - dealSizeBenchmark) / dealSizeBenchmark) * 100
      : null;
  const dealSizeVerdict =
    dossierDealSize !== null && dealSizeBenchmark !== null
      ? classifyDeviation(dossierDealSize, dealSizeBenchmark)
      : ('no_data' as const);

  // 4. Construction des notes de contexte marche
  const marketNotes: string[] = [];
  if (isAi) {
    marketNotes.push(
      `Le secteur IA capte ${AI_SHARE_OF_MARKET_2026_Q1.shareOfDealValuePercent}% du capital VC US Q1 2026 (PitchBook).`,
    );
    marketNotes.push(
      `Step-up median IA: ${STEP_UP_MEDIAN_2026_Q1.ai}x (vs ${STEP_UP_MEDIAN_2026_Q1.nonAi}x non-IA).`,
    );
    marketNotes.push(
      `Temps median entre tours IA: ${YEARS_BETWEEN_ROUNDS_2026_Q1.ai} ans (vs ${YEARS_BETWEEN_ROUNDS_2026_Q1.nonAi} ans non-IA). Pression FOMO documentee.`,
    );
  } else {
    marketNotes.push(
      `Step-up median non-IA: ${STEP_UP_MEDIAN_2026_Q1.nonAi}x. Temps median entre tours: ${YEARS_BETWEEN_ROUNDS_2026_Q1.nonAi} ans.`,
    );
  }

  // 5. Selection des comparables europeens si applicable
  const europeanComparables =
    region === 'Europe' ? pickEuropeanComparables(extraction) : undefined;

  // 6. Citations
  const citations = [
    {
      sourceId: 'PITCHBOOK_NVCA_Q1_2026',
      name: 'PitchBook-NVCA Venture Monitor Q1 2026',
      asOf: '2026-03-31',
    },
  ];
  if (region === 'Europe') {
    citations.push({
      sourceId: 'ATOMICO_SOET_2025',
      name: 'State of European Tech 2025 (Atomico)',
      asOf: '2025-09-30',
    });
  }

  return {
    stage,
    isAi,
    region,
    preMoney: {
      dossierValueMillionsUsd: dossierPreMoney,
      benchmarkMedianMillionsUsd: preMoneyBenchmark,
      benchmarkSegment,
      deviationPercent: preMoneyDeviation,
      verdict: preMoneyVerdict,
      summary: generateValuationSummary(
        dossierPreMoney,
        preMoneyBenchmark,
        preMoneyDeviation,
        preMoneyVerdict,
        benchmarkSegment,
      ),
    },
    dealSize: {
      dossierValueMillionsUsd: dossierDealSize,
      benchmarkMedianMillionsUsd: dealSizeBenchmark,
      deviationPercent: dealSizeDeviation,
      verdict: dealSizeVerdict,
      summary: generateDealSizeSummary(
        dossierDealSize,
        dealSizeBenchmark,
        dealSizeDeviation,
        dealSizeVerdict,
      ),
    },
    marketContext: {
      aiShareOfDealValuePercent: isAi ? AI_SHARE_OF_MARKET_2026_Q1.shareOfDealValuePercent : undefined,
      medianStepUp: isAi ? STEP_UP_MEDIAN_2026_Q1.ai : STEP_UP_MEDIAN_2026_Q1.nonAi,
      yearsBetweenRounds: isAi ? YEARS_BETWEEN_ROUNDS_2026_Q1.ai : YEARS_BETWEEN_ROUNDS_2026_Q1.nonAi,
      notes: marketNotes,
    },
    europeanComparables,
    citations,
    warnings,
  };
}
