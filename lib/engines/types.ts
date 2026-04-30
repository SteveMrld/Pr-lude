// Types partagés entre les sept moteurs de la plateforme

export interface ExtractionOutput {
  companyName: string;
  sector: string;
  subSector: string;
  geographicHub: string;
  country: string;
  yearFounded: number;
  founders: Array<{
    name: string;
    role: string;
    background: string;
  }>;
  marketPitch: string;
  productDescription: string;
  businessModel: string;
  traction: {
    metrics: string[];
    revenue?: string;
    growth?: string;
    customers?: string;
  };
  fundraise: {
    stage: string;
    amount: string;
    valuation?: string;
    leadInvestor?: string;
    coInvestors?: string[];
  };
  competitorsCited: string[];
  rawSummary: string;
}

export interface TeamAnalysisOutput {
  foundersCount: number;
  pedigreeCanonical: boolean;
  averageAge: 'young' | 'mid' | 'senior';
  sectorExperience: 'high' | 'medium' | 'low' | 'transversal';
  riskTaken: 'high' | 'medium' | 'low';
  systemicCoverage: {
    score: number;
    rationale: string;
    gaps: string[];
  };
  collectiveAntiFragility: {
    score: number;
    rationale: string;
  };
  experienceTransposition: {
    score: number;
    rationale: string;
    analogousSectors: string[];
  };
  founderObsession: {
    score: number;
    rationale: string;
  };
  declaredVsVerified?: {
    alignmentScore: number;
    verifiedClaims: string[];
    unverifiableClaims: string[];
    discrepancies: string[];
  };
  redFlags: string[];
  greenFlags: string[];
  realData?: any[]; // FounderRealData[] - voir lib/data-fetchers/sources.ts
}

export interface MarketAnalysisOutput {
  perceivedSize: 'massive' | 'large' | 'niche';
  realIntensity: 'extreme' | 'high' | 'medium';
  saturation: 'saturated' | 'fragmented' | 'emerging';
  organicSignals: {
    score: number;
    rationale: string;
    evidence: string[];
  };
  needIntensity: {
    score: number;
    rationale: string;
    gap: string;
  };
  defensibility: {
    score: number;
    moats: string[];
    vulnerabilities: string[];
  };
  internationalBenchmarks: Array<{
    name: string;
    geography: string;
    relevance: string;
  }>;
  competitiveDynamic: string;
  realData?: any;
}

export interface MacroAnalysisOutput {
  cyclePosition: 'pre-bascule' | 'bascule' | 'post-bascule' | 'mature';
  interestRateRegime: string;
  geopolitics: string;
  vcCapitalOnSegment: 'underweight' | 'balanced' | 'overweight';
  demandCycle: string;
  criticalTimingWindow: {
    exists: boolean;
    horizon?: string;
    rationale: string;
  };
  contraryclicalOpportunity: {
    score: number;
    rationale: string;
  };
  structuralTrends: string[];
  regulatoryEnvironment: string;
  realData?: any;
}

export interface PatternMatchingOutput {
  archetypeDominant: 'interpretive' | 'depth' | 'capacity' | 'cumulative-mid' | 'cumulative-long';
  archetypeRationale: string;
  comparables: Array<{
    caseId: string;
    name: string;
    year: number;
    proximity: number;
    structuralAnalogy: string;
    sharedPatterns: string[];
    divergences: string[];
  }>;
  matchingPatterns: string[];
  retrospectiveBenchmark: {
    averageScore: number;
    successRate: string;
    insights: string;
  };
  // Comparables internationaux étayés avec trajectoire chiffrée
  internationalBenchmarks: Array<{
    name: string;
    geography: 'US' | 'Asia' | 'Europe' | 'LatAm' | 'Africa' | 'Other';
    sector: string;
    foundedYear: number;
    initialBet: string; // pari stratégique pris au démarrage
    trajectory: Array<{ year: string; milestone: string; revenueOrFunding: string }>;
    outcome: 'success-public' | 'success-acquired' | 'survival-private' | 'failed' | 'pivot' | 'ongoing';
    finalValuation: string; // valuation à l'IPO/acquisition/faillite
    multipleAtExit: string; // ex: 1000x pour Series A
    keySuccessFactors: string[]; // pourquoi ça a marché (si succès)
    keyFailureFactors: string[]; // pourquoi ça a raté (si échec)
    relevanceToCurrentDeal: string; // ce que ça nous apprend sur le dossier en cours
  }>;
}

export interface CausalReversalOutput {
  blindspotsScores: {
    maturiteExecution: { score: number; lecture: string; alerte: boolean };
    intensiteBesoin: { score: number; lecture: string; alerte: boolean };
    distributionAcquise: { score: number; lecture: string; alerte: boolean };
    antiFragilite: { score: number; lecture: string; alerte: boolean };
    coherenceNarrative: { score: number; lecture: string; alerte: boolean };
    signauxOrganiques: { score: number; lecture: string; alerte: boolean };
    timingContracyclique: { score: number; lecture: string; alerte: boolean };
  };
  questionsToInvestigate: string[];
  recommendedOperators: Array<{
    profile: string;
    mission: string;
    estimatedDuration: string;
  }>;
  proxiesToCalculate: string[];
  reversalNarrative: string;
}

// Moteur 12 : Aveuglement collectif et angles morts (inspiré article Ynsect)
export interface BlindspotPattern {
  patternId: string;
  patternName: string;
  detected: boolean;
  intensity: number; // 0-100
  evidence: string;
  implication: string;
}

export interface BlindspotAnalysisOutput {
  patterns: {
    deplacementIndicateurSucces: BlindspotPattern; // P1: ratio levée/CA
    effetMeuteLegitimation: BlindspotPattern; // P2: investisseurs marqueurs
    inversionIndustrialisationValidation: BlindspotPattern; // P3: capex avant validation
    deniUnitEconomics: BlindspotPattern; // P4: confusion scale/seuil rentabilité
    ecartCoutPrixSubstitut: BlindspotPattern; // P5: ratio prix prod/marché
    opaciteProgressiveCommunication: BlindspotPattern; // P6: silence sur CA
    nonSuiviEffondrement: BlindspotPattern; // P7: levée malgré chute
    convergenceSignauxEchec: BlindspotPattern; // P8: densité signaux
    deresponsabilisationConsensus: BlindspotPattern; // P9: convergence excessive
    asymetrieFondateurStakeholders: BlindspotPattern; // P10: structures permettant rebond
  };
  globalBlindspotScore: number; // 0-100, plus haut = plus risqué
  alertesCritiques: string[];
  patternsHistoriques: Array<{
    case: string;
    similarity: number;
    outcome: 'failure' | 'survival' | 'success';
    keyLearning: string;
  }>;
  syntheseAveuglement: string;
  // Cartographie risques AIRARO en 3 axes
  riskMap: {
    strategicRisks: Array<{
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    operationalRisks: Array<{
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    financialRisks: Array<{
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };
}

// Moteur 13 : Singularités et signaux contrariens
export interface ContrarianSignal {
  signalId: string;
  signalName: string;
  detected: boolean;
  strength: number; // 0-100
  evidence: string;
  implication: string;
}

export interface ContrarianAnalysisOutput {
  signals: {
    trajectoireSinguliereFondateur: ContrarianSignal; // S1
    expertiseTaciteAsymetrique: ContrarianSignal; // S2
    marcheNonEncoreForme: ContrarianSignal; // S3: marché créé par produit
    refusFinancementSignalPositif: ContrarianSignal; // S4: thèse non-consensuelle
    qualiteExecutionVsRessources: ContrarianSignal; // S5: ratio frugalité
    convictionArticuleePrecise: ContrarianSignal; // S6: vérité non partagée
    defaillancesStructurellesEtablis: ContrarianSignal; // S7: opportunité durable
    patternHistoriqueContrarien: ContrarianSignal; // S8: cas où consensus s'est trompé
    persistanceResilienceDocumentee: ContrarianSignal; // S9: survivants
    dissonanceCreatrice: ContrarianSignal; // S10: dérangement créateur
  };
  globalContrarianScore: number; // 0-100, plus haut = plus contrarien justifié
  comparablesContrariens: Array<{
    name: string;
    sectorContext: string;
    initialConsensus: string;
    contrarianBet: string;
    outcome: string;
    multipleAtExit: string;
  }>;
  syntheseSingularite: string;
  recommandationContrarienne: string;
}

// Probabilités chiffrées par dimension dans la synthèse finale
export interface DimensionProbability {
  dimensionName: string;
  successProbability: number; // 0-100
  riskScore: number; // 0-100
  weight: number; // 0-1, pondération dans le score global
  rationale: string;
  keyDrivers: string[];
  keyRisks: string[];
}

// Données financières extraites (pitch deck + BP)
export interface FinancialDataExtraction {
  hasBP: boolean; // BP dispo ou pas
  fileSource: 'deck' | 'bp' | 'both' | 'none';
  // Trajectoire revenue (millions €)
  revenueProjection: Array<{ year: string; value: number; source: string }>;
  // Marges projetées
  grossMarginProjection: Array<{ year: string; value: number; source: string }>; // pct
  // EBITDA projeté
  ebitdaProjection: Array<{ year: string; value: number; source: string }>;
  // Free cash flow
  fcfProjection: Array<{ year: string; value: number; source: string }>;
  // Hypothèses unitaires
  unitEconomics: {
    estimatedCAC: string;
    estimatedLTV: string;
    estimatedLtvCacRatio: string;
    averageContractValue: string;
    grossMarginPerUnit: string;
  };
  // Hypothèses headcount
  headcount: Array<{ year: string; value: number; source: string }>;
  // Coûts opérationnels
  opexProjection: Array<{ year: string; value: number; source: string }>;
  // Tour actuel et runway
  currentRound: {
    amount: string;
    runwayMonths: string;
    monthlyBurn: string;
  };
  // Hypothèses marché
  marketAssumptions: {
    tamCited: string;
    samCited: string;
    targetMarketShare: string;
    targetCustomersByYearN: string;
  };
  // Données brutes / commentaires
  rawNotes: string;
}

// Moteur 14 : Cohérence financière (7 tests)
export interface FinancialCoherenceTest {
  testId: string;
  testName: string;
  passed: boolean;
  score: number; // 0-100
  evidence: string; // calcul ou observation factuelle
  benchmark: string; // standard sectoriel ou comparable
  implication: string;
}

export interface FinancialCoherenceOutput {
  hasFinancialData: boolean;
  dataSource: 'deck' | 'bp' | 'both' | 'none';
  tests: {
    crosseHockeySuspecte: FinancialCoherenceTest; // T1
    ratioLtvCacImplicite: FinancialCoherenceTest; // T2
    margeBruteCoherente: FinancialCoherenceTest; // T3
    burnRateRunway: FinancialCoherenceTest; // T4
    incoherenceHeadcountCa: FinancialCoherenceTest; // T5
    unitEconomicsViables: FinancialCoherenceTest; // T6
    coherenceHypothesesMarche: FinancialCoherenceTest; // T7
  };
  globalCoherenceScore: number; // 0-100
  alertesCritiques: string[];
  incoherenceDeckVsBP: string[]; // chiffres qui divergent entre les deux sources
  syntheseCoherence: string;
  recalculsEffectues: Array<{
    metric: string;
    declaredValue: string;
    recalculatedValue: string;
    discrepancy: string;
  }>;
}

export interface OrchestratedResult {
  meta: {
    filename: string;
    analyzedAt: string;
    durationMs: number;
    additionalFiles?: string[]; // BP, comptes, etc.
  };
  extraction: ExtractionOutput;
  financialData?: FinancialDataExtraction;
  team: TeamAnalysisOutput;
  market: MarketAnalysisOutput;
  macro: MacroAnalysisOutput;
  patternMatching: PatternMatchingOutput;
  causalReversal: CausalReversalOutput;
  blindspotAnalysis: BlindspotAnalysisOutput;
  contrarianAnalysis: ContrarianAnalysisOutput;
  financialCoherence?: FinancialCoherenceOutput;
  finalRecommendation: {
    verdict: 'investir' | 'investir avec conditions' | 'approfondir' | 'refuser';
    globalScore: number;
    successProbability: number; // 0-100, probabilité chiffrée explicite
    failureProbability: number; // 0-100
    investmentThreshold: {
      currentLevel: number; // 0-100
      thresholdToInvest: number; // ex 75
      thresholdToCondition: number; // ex 60
      thresholdToInvestigate: number; // ex 45
    };
    dimensionProbabilities: DimensionProbability[];
    blindspotsVsContrarian: {
      blindspotsWeight: number; // 0-100
      contrarianWeight: number; // 0-100
      tensionResolved: 'blindspots-dominate' | 'contrarian-justifies' | 'balanced-investigate';
      resolution: string;
    };
    argumentation: string;
    keyConditions: string[];
    decisionDrivers: string[]; // top 3-5 facteurs décisifs
    structuringPlan?: {
      shortTerm: Array<{ axis: string; action: string }>; // 0-3 mois
      mediumTerm: Array<{ axis: string; action: string }>; // 3-12 mois
      longTerm: Array<{ axis: string; action: string }>; // 12+ mois
    };
  };
}

// Step status pour le streaming UI
export type EngineStatus = 'idle' | 'running' | 'done' | 'error';

export interface EngineStep {
  name: string;
  status: EngineStatus;
  startedAt?: number;
  completedAt?: number;
  output?: any;
  error?: string;
}
