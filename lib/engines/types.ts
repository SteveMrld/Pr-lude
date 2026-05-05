// Types partagés entre les sept moteurs de la plateforme

export interface ExtractionOutput {
  companyName: string;
  sector: string;
  subSector: string;
  geographicHub: string;
  country: string;
  yearFounded: number | null;
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
  // Clients nommes dans le deck : noms + entreprise + nature du lien (pilote, contrat,
  // partenariat). Sert au moteur reference-checks pour identifier les appels clients.
  clientsNamed?: Array<{
    name: string;
    company?: string;
    relationship?: string;
  }>;
  // Membres du board ou advisors mentionnes dans le deck.
  boardMembers?: Array<{
    name: string;
    role: string;
    affiliation?: string;
  }>;
  rawSummary: string;
}

// Sortie du moteur reference-checks : liste structuree des contacts a appeler
// pendant la due diligence terrain. Inspire des playbooks Golden Seeds et GCV.
export interface ReferenceChecksOutput {
  founderChecks: Array<{
    founderName: string;
    contactsToFind: Array<{
      type: 'superior' | 'peer' | 'subordinate';
      profile: string; // qui chercher : "ex-CTO d'une startup ou Boura a travaille avant fondation"
      hint: string; // indice pour le retrouver
    }>;
    keyQuestions: string[];
  }>;
  customerChecks: Array<{
    clientName: string;
    company?: string;
    contractStatus: 'unknown' | 'pilot' | 'contract' | 'announced';
    keyQuestions: string[];
  }>;
  boardChecks: Array<{
    memberName: string;
    role: string;
    affiliation?: string;
    keyQuestions: string[];
  }>;
  // 5e categorie : signaux faibles (traction organique, recrutement, presence
  // produit). Inspire des fonds debusqueurs d outsiders qui utilisent la data
  // pure pour detecter les pepites avant qu elles ne deviennent consensus.
  // Optionnel pour retro-compatibilite (UI peut ne pas l afficher).
  weakSignalsChecks?: Array<{
    signalType: 'github' | 'similarweb' | 'product_hunt' | 'hacker_news' | 'recruiting' | 'app_store';
    target: string; // ce qu il faut chercher (URL, handle, nom de produit)
    rationale: string; // pourquoi ce signal est pertinent pour ce dossier
    expectedFinding: string; // ce qu une traction reelle ressemblerait
  }>;
  redFlagsToProbe: string[]; // alertes specifiques sortantes des autres moteurs a verifier en DD
  priorityOrder: string[]; // ordre recommande des appels (qui d'abord, pourquoi)
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
  /**
   * Test critique de l ere IA generative : le founder maitrise-t-il les
   * outils IA modernes (Claude Code, Cursor, v0, Lovable, llm CLIs) avec
   * une vraie fluidite, comme un musicien manie son instrument ? La
   * fluidite IA est devenue un proxy mesurable de la velocite d execution.
   * Un founder qui vibe-code peut shipper en jours ce qui demandait des
   * mois a une equipe technique classique. A l inverse, un pedigree
   * canonique (Stanford, ex-Google, MIT) compte moins qu il y a 5 ans
   * si le founder n a pas integre ces nouveaux outils.
   *
   * Indices observables :
   *   - velocity : cadence de livraison documentee (commits, releases,
   *     posts blog, video demo)
   *   - openSourcePresence : projets perso, contributions, profil GitHub
   *   - stackFluency : aisance dans la description de son stack tech
   *     dans le pitch, mention explicite d outils modernes
   *   - delegationPattern : utilise-t-il des agents pour automatiser ops,
   *     marketing, support ?
   *   - solo_or_duo : tendance des AI-native founders a etre seuls ou
   *     en duo (signal de capacite a faire bcp avec peu)
   *
   * Optionnel pour retro-compatibilite. Quand absent, le rendu UI
   * affiche 'non instruit' plutot qu un score brut.
   */
  aiVelocity?: {
    score: number; // 0-100. 80+ = ai-native fluent, 50-80 = competent, <50 = old school
    verdict: 'ai_native' | 'ai_competent' | 'ai_distant';
    rationale: string; // 3-5 phrases explicitant le diagnostic
    evidence: string[]; // signaux observables qui appuient le score
    redFlags: string[]; // signaux d immobilisme (verbose code reviews, refus IA, equipe hyper-large)
    greenFlags: string[]; // signaux de fluidite (commits dense, demos rapides, stack moderne)
  };
  declaredVsVerified?: {
    alignmentScore: number;
    verifiedClaims: string[];
    unverifiableClaims: string[];
    discrepancies: string[];
  };
  redFlags: string[];
  greenFlags: string[];
  // Analyse founder-market fit par fondateur (Eisenmann 2020)
  founderMarketFit: Array<{
    name: string;
    role: string;
    overallFitScore: number; // 0-100
    /**
     * Distingue un score basé sur des données vs un score plancher d'incertitude.
     *   - 'evaluable'           : trajectoire suffisamment documentée pour scorer
     *   - 'partially-evaluable' : signaux partiels (par ex. nom retrouvé sans détails)
     *   - 'non-evaluable'       : aucune donnée vérifiable. Le score 0-15 est un
     *                             plancher de convention signalant l'impossibilité
     *                             d'instruire, pas une mauvaise note.
     * Le rendu UI doit afficher un libellé "Non instruit" plutôt qu'un chiffre brut
     * quand evaluability = 'non-evaluable'.
     */
    evaluability?: 'evaluable' | 'partially-evaluable' | 'non-evaluable';
    trajectorySummary: string; // narratif dense de la trajectoire
    fitSignals: string[]; // signaux positifs de founder-market fit
    fitGaps: string[]; // gaps de founder-market fit
    tacitExpertise: string; // expertise tacite asymétrique (ce que le fondateur sait que personne d'autre ne sait facilement)
    transposedExperiences: string[]; // expériences antérieures transposables
    redFlagsForRole: string[]; // red flags spécifiques pour son rôle
  }>;
  realData?: any[]; // FounderRealData[] - voir lib/data-fetchers/sources.ts
}

export interface MarketAnalysisOutput {
  perceivedSize: 'massive' | 'large' | 'niche';
  realIntensity: 'extreme' | 'high' | 'medium';
  saturation: 'saturated' | 'fragmented' | 'emerging';
  /**
   * Chiffrage du marche TAM/SAM/SOM avec sources verifiees.
   *
   * IMPORTANT : ce bloc DOIT etre rempli quand le moteur a accès au
   * web search. Chaque chiffre doit etre :
   *   - soit issu d une source web verifiable (rapport analyste,
   *     presse spécialisée), avec la source nommée
   *   - soit issu du pitch deck, et explicitement labellisé "Pitch"
   *   - soit calculé à partir de chiffres sourcés, avec le calcul
   *     explicité
   *
   * Si aucun chiffre n est trouvable malgré les recherches, mettre
   * 'non chiffré' et expliquer pourquoi dans le rationale.
   *
   * Optionnel pour rétrocompatibilité (analyses anciennes).
   */
  marketSizing?: {
    // Total Addressable Market - taille totale du marché global
    tam: {
      value: string;          // ex. "47Mds$ d ici 2032" ou "non chiffré"
      timeframe: string;      // ex. "2032", "2025", "horizon 2030"
      source: string;         // ex. "Pitchbook Drone Industry Report 2024"
      confidence: 'high' | 'medium' | 'low';  // qualité de la source
    };
    // Serviceable Addressable Market - segment réellement adressable
    sam: {
      value: string;
      timeframe: string;
      source: string;
      methodology: string;    // ex. "TAM × % cargo BVLOS Europe"
    };
    // Serviceable Obtainable Market - part de marché capturable
    som: {
      value: string;
      timeframe: string;
      methodology: string;    // ex. "5% du SAM en 5 ans, hypothese aggressive"
    };
    // Synthèse narrative du sizing (3-5 phrases)
    sizingNarrative: string;
    // Comparaison avec le TAM cité dans le pitch (alignement ou écart)
    pitchAlignment: 'aligned' | 'overestimated' | 'underestimated' | 'pitch-not-cited';
    pitchAlignmentNote?: string;  // explication si écart
  };
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
    /**
     * Test critique de l ere IA generative : un solo founder equipe
     * de Cursor, Claude Code et autres outils vibe-coding pourrait-il
     * repliquer le produit en trois mois ? Si oui, la defensibilite
     * est nulle au sens classique : le produit est une fonctionnalite
     * qui sera commoditisee. Le verdict doit alors expliciter ce qui
     * empeche cette replication, en dehors du code lui-meme : donnees
     * proprietaires, network effects, distribution, profondeur
     * reglementaire, AI flywheel, ou apprentissage metier.
     *
     * Optionnel pour retro-compatibilite avec les analyses anterieures
     * a l introduction de ce check. Quand absent, le rendu UI peut
     * afficher 'non instruit'.
     */
    aiReplicability?: {
      verdict: 'high_risk' | 'medium_risk' | 'protected';
      // 'high_risk'  : un solo founder + Cursor en 3 mois reproduirait l essentiel
      // 'medium_risk': replicable techniquement mais d autres barrieres existent
      // 'protected'  : moats non reproductibles (regulation, data, distribution, etc.)
      timeToReplicate: string;     // ex 'moins de 3 mois', '6-12 mois', '18+ mois'
      reasoning: string;           // explication structuree (3-5 phrases)
      protectingFactors: string[]; // ce qui ralentit ou empeche la replication
      replicableComponents: string[]; // ce qui serait facilement repliquable
    };
  };
  internationalBenchmarks: Array<{
    name: string;
    geography: string;
    relevance: string;
  }>;
  /**
   * Business model AI-native : recalibrage des benchmarks classiques
   * pour les boites construites autour de modeles LLM tiers.
   *
   * Pourquoi ce bloc existe : les multiples ARR des boites AI-native
   * (Cursor 90x, Anthropic 60x) ne sont pas comparables aux multiples
   * SaaS classiques (Adyen 30x, Salesforce 12x). Trois fragilites
   * structurelles cachees :
   *
   *   1. La marge brute AI-native tourne a 50-65% au lieu de 80-90%
   *      pour le SaaS classique, parce que l API d Anthropic ou
   *      d OpenAI mange le COGS. Comparer un multiple AI a un multiple
   *      SaaS en valeur faciale est une erreur d evaluation.
   *
   *   2. La dependance aux LLM providers cree un risque de concentration
   *      rarement modelise. Que se passe-t-il si Anthropic double
   *      ses prix d API ? Si OpenAI bloque le compte ?
   *
   *   3. Le pari implicite est que le compute reste cher. Si DeepSeek
   *      ou les modeles open weight commoditisent l inference, les
   *      wrappers valent zero.
   *
   * Ce bloc est rempli uniquement si la boite est detectee comme
   * AI-native ou AI-dependent. Pour une boite SaaS classique, il
   * reste null.
   */
  aiBusinessModel?: {
    isAiNative: boolean; // produit construit autour d un LLM tiers
    isLlmWrapper: boolean; // wrapper fin sans valeur ajoutee structurelle
    classification: 'pure_wrapper' | 'ai_native_with_moats' | 'ai_augmented_classic' | 'not_applicable';
    grossMarginEstimate: string; // ex '55-60%', 'inferieure a 50%', 'inconnu'
    grossMarginRationale: string; // pourquoi cette estimation
    llmProviderConcentration: string; // ex 'Anthropic 70%, OpenAI 20%, internal 10%'
    aiTaxSensitivity: string; // qu arrive-t-il si Anthropic +50% prix
    commoditizationRisk: 'low' | 'medium' | 'high' | 'extreme';
    commoditizationReasoning: string; // pourquoi ce niveau
    multipleAdjustment: string; // narration : multiple a appliquer pour comparable equitable
    redFlags: string[]; // wrapper sans donnees, dependance unique fournisseur, etc.
    sustainableSignals: string[]; // RAG proprietaire, fine-tuning custom, vertical depth, etc.
  };
  competitiveDynamic: string;
  // Matrice concurrentielle binaire type Idinvest factsheet
  competitiveMatrix: {
    // Dimensions évaluées (8-12 max selon le secteur)
    dimensions: string[];
    // Players évalués : la startup analysée + ses concurrents directs
    players: Array<{
      name: string;
      isTargetCompany: boolean;
      // Pour chaque dimension dans le même ordre que dimensions[], une case présente (true) ou absente (false)
      coverage: boolean[];
    }>;
    // Synthèse : combien de dimensions distingue la startup de ses concurrents
    differentiationScore: number; // 0-100
    differentiationRationale: string;
  };
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
    /**
     * Statut actuel du comparable, hérité du corpus étendu si le cas y est référencé.
     * Permet au lecteur de calibrer la confiance du comparable :
     *   - 'confirmed'     : succès validé, comparable solide pour défendre une thèse
     *   - 'promising'     : forte traction mais pas encore prouvé, à citer avec calibrage
     *   - 'fragile'       : signaux mixtes, à citer comme avertissement
     *   - 'in-difficulty' : baisse / restructuration / faillite, à citer comme rappel critique
     *   - 'too-early'     : <3 ans, prudence, ne pas prendre comme garantie
     * Optionnel : si le comparable n'est pas dans le corpus étendu, ce champ est absent.
     */
    currentStatus?: 'confirmed' | 'promising' | 'fragile' | 'in-difficulty' | 'too-early';
    /**
     * Niveau de prudence à signaler au lecteur quand le comparable est cité.
     *   - 'reference-positive' : à utiliser comme exemple à suivre
     *   - 'cite-with-caveat'   : à citer mais avec nuance
     *   - 'cautionary-tale'    : à citer comme avertissement (cas Strate D)
     * Optionnel : permet d'orienter le ton de la prose.
     */
    cautionLevel?: 'reference-positive' | 'cite-with-caveat' | 'cautionary-tale';
  }>;
}

export interface CausalReversalOutput {
  /**
   * Pour chaque dimension : score 0-100 + lecture narrative + alerte booléenne.
   *
   * IMPORTANT - Le champ 'evaluability' :
   * Distingue un score informé d'un score d'incertitude par défaut de données.
   *   - 'evaluable'           : score basé sur des signaux réels (déclarés ou vérifiés)
   *   - 'partially-evaluable' : signaux partiels, score à calibrer prudemment
   *   - 'non-evaluable'       : data manquante critique. Le score est plancher
   *                             par convention (typiquement 0-15) mais ne reflète
   *                             pas la qualité réelle - il signale que l'instruction
   *                             n'a pas pu être faite. Le lecteur doit comprendre :
   *                             "non testé, pas mauvais".
   * Optionnel pour rétrocompatibilité ; si absent, supposé 'evaluable'.
   */
  blindspotsScores: {
    maturiteExecution: { score: number; lecture: string; alerte: boolean; evaluability?: 'evaluable' | 'partially-evaluable' | 'non-evaluable' };
    intensiteBesoin: { score: number; lecture: string; alerte: boolean; evaluability?: 'evaluable' | 'partially-evaluable' | 'non-evaluable' };
    distributionAcquise: { score: number; lecture: string; alerte: boolean; evaluability?: 'evaluable' | 'partially-evaluable' | 'non-evaluable' };
    antiFragilite: { score: number; lecture: string; alerte: boolean; evaluability?: 'evaluable' | 'partially-evaluable' | 'non-evaluable' };
    coherenceNarrative: { score: number; lecture: string; alerte: boolean; evaluability?: 'evaluable' | 'partially-evaluable' | 'non-evaluable' };
    signauxOrganiques: { score: number; lecture: string; alerte: boolean; evaluability?: 'evaluable' | 'partially-evaluable' | 'non-evaluable' };
    timingContracyclique: { score: number; lecture: string; alerte: boolean; evaluability?: 'evaluable' | 'partially-evaluable' | 'non-evaluable' };
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

// ============================================================
// Moteur Tech Claim Coherence
// ------------------------------------------------------------
// Audite les revendications technologiques d un dossier qui n est
// pas necessairement IA. Se declenche si le pitch flèche un budget
// significatif sur "tech / produit / R&D / optimisation" ou si il
// revendique un moat technologique. Trois tests :
//   T1 budget vs equipe : combien d ingenieurs le budget paie sur
//      la duree, est-ce coherent avec l equipe annoncee ?
//   T2 tracabilite de l actif : le claim decrit-il un actif precis
//      (algo, brevet, dataset, infra mesurable) ou reste-t-il
//      abstrait (brique technologique innovante) ?
//   T3 contre-factuel : si on retire la revendication tech, le pari
//      commercial tient-il debout sur ses propres jambes ?
//
// Empeche que des dossiers consumer / media / services qui claim
// "plateforme proprietaire" sans actif sortent du moteur sans que
// la note d investissement ait teste cette revendication.
// ============================================================

export interface TechClaimTest {
  score: number; // 0-100
  passed: boolean;
  observation: string;
  implication: string;
}

export interface TechClaimCoherenceOutput {
  // Si triggered = false, le dossier ne revendique pas de moat tech
  // significatif. Les autres champs restent presents mais le rendu UI
  // peut masquer la section.
  triggered: boolean;
  triggers: {
    budgetAllocationDetected: {
      detected: boolean;
      percentage: number | null; // % de la levee fleche tech, null si non detecte
      amountEur: number | null;  // montant absolu correspondant
      evidence: string;          // citation du pitch
    };
    moatClaimDetected: {
      detected: boolean;
      keywords: string[];        // mots-cles qui ont declenche
      evidence: string;          // citation du pitch
    };
  };
  // Synthese du claim tel qu il apparait dans le pitch
  claimSummary: string;
  // Trois tests
  tests: {
    budgetVsTeam: TechClaimTest;       // T1 deterministe
    assetTraceability: TechClaimTest;  // T2 LLM
    counterFactual: TechClaimTest;     // T3 LLM
  };
  globalScore: number; // 0-100
  // tech_credible : actif precis + equipe coherente + pari ne tient
  //                 pas sans la tech (ie la tech est le moat)
  // tech_partially_substantiated : revendication partielle mais avec
  //                                 quelques signaux concrets
  // tech_storytelling : revendication abstraite, equipe ne soutient
  //                     pas, le pari tient sans la tech (ie la tech
  //                     est de l habillage commercial)
  // not_applicable : pas de revendication tech significative dans le
  //                  pitch, le test ne s applique pas
  verdict: 'tech_credible' | 'tech_partially_substantiated' | 'tech_storytelling' | 'not_applicable';
  questionsToInstruct: string[]; // 3-5 questions a poser en DD
  synthesis: string; // paragraphe editorial 3-4 phrases
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
  // Audit de la revendication technologique du dossier (Niveau 5.A).
  // Se declenche quand le pitch revendique un moat tech ou flèche un
  // budget significatif sur la tech. Optionnel : peut etre null si le
  // moteur n a pas tourne ou si le dossier n a aucune revendication
  // tech a tester.
  techClaimCoherence?: TechClaimCoherenceOutput | null;
  // Audit consolide des assertions (Niveau 2.B). Liste les noms propres
  // non sourcees, les conversions de devise non taggees, les annees
  // inventees detectees dans tous les outputs des moteurs. Sert a
  // l UI pour afficher un bandeau d alerte sur le rapport et a la
  // due diligence pour identifier les points a verifier en priorite.
  assertionAudit?: {
    totalWarnings: number;
    byEngine: Record<string, number>; // ex { 'team': 3, 'market': 1 }
    byCategory: Record<string, number>; // ex { 'unknown_name': 2, 'invented_date': 2 }
    bySeverity: Record<string, number>;
    warnings: Array<{
      engine: string;
      category: 'unknown_name' | 'currency_mismatch' | 'invented_date' | 'unsupported_claim';
      severity: 'critical' | 'warning' | 'info';
      field: string;
      message: string;
      excerpt: string;
    }>;
  };
  finalRecommendation: {
    verdict: 'investir' | 'investir avec conditions' | 'approfondir' | 'refuser';
    globalScore: number;
    // Score recalcule mecaniquement a partir des dimensions ponderees et
    // de la tension blindspots/contrarian. Expose pour traçabilite : si
    // globalScore (jugement LLM) et computedScoreBreakdown.weightedScore
    // (calcul mecanique) divergent de plus de 15 points, cela signale
    // que le LLM a fait un saut de jugement non auditable.
    computedScoreBreakdown?: {
      weightedDimensionScore: number; // 0-100, somme ponderee des 6 dimensions
      blindspotsContrarianAdjustment: number; // ajustement -25 a +15 selon tension
      finalComputedScore: number; // 0-100, score mecanique final
      llmScore: number; // copie de globalScore pour diff visible
      delta: number; // computed - llm
      auditNote: string; // explication de l ecart si > 15 points
      formula: string; // formule textuelle exacte appliquee
    };
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

// Sortie du moteur Benchmarks : positionnement chiffre du dossier vs marche.
// Calcul deterministe en TypeScript pur (pas d appel LLM). Les moteurs en aval
// (Coherence financiere, Macro, Pattern) consomment cette sortie pour
// enrichir leur raisonnement.
export interface BenchmarkPositioning {
  stage: 'seed' | 'seriesA' | 'seriesB' | 'seriesC' | 'seriesDPlus' | 'unknown';
  isAi: boolean;
  region: 'US' | 'Europe' | 'Other' | 'unknown';

  // Positionnement valorisation pre-money
  preMoney: {
    dossierValueMillionsUsd: number | null; // null si non extractible
    benchmarkMedianMillionsUsd: number | null;
    benchmarkSegment: string; // ex: "US Series A IA Q1 2026"
    deviationPercent: number | null;
    verdict: 'below_market' | 'in_line' | 'above_market' | 'extreme_outlier' | 'no_data';
    summary: string; // 1-2 phrases naturelles
  };

  // Positionnement taille du tour
  dealSize: {
    dossierValueMillionsUsd: number | null;
    benchmarkMedianMillionsUsd: number | null;
    deviationPercent: number | null;
    verdict: 'below_market' | 'in_line' | 'above_market' | 'extreme_outlier' | 'no_data';
    summary: string;
  };

  // Donnees marche pertinentes pour le contexte
  marketContext: {
    aiShareOfDealValuePercent?: number;
    medianStepUp?: number;
    yearsBetweenRounds?: number;
    notes: string[];
  };

  // Comparables europeens suggeres si dossier europeen
  europeanComparables?: Array<{
    name: string;
    sector: string;
    relevance: string;
  }>;

  // Citations des sources utilisees pour traçabilite dans la note
  citations: Array<{
    sourceId: string;
    name: string;
    asOf: string;
  }>;

  // Warnings et limitations
  warnings: string[];
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
