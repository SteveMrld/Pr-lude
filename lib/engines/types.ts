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

export interface OrchestratedResult {
  meta: {
    filename: string;
    analyzedAt: string;
    durationMs: number;
  };
  extraction: ExtractionOutput;
  team: TeamAnalysisOutput;
  market: MarketAnalysisOutput;
  macro: MacroAnalysisOutput;
  patternMatching: PatternMatchingOutput;
  causalReversal: CausalReversalOutput;
  blindspotAnalysis: BlindspotAnalysisOutput;
  contrarianAnalysis: ContrarianAnalysisOutput;
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
