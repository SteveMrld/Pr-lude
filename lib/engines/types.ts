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
  finalRecommendation: {
    verdict: 'investir' | 'investir avec conditions' | 'approfondir' | 'refuser';
    globalScore: number;
    argumentation: string;
    keyConditions: string[];
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
