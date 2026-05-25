// ============================================================
// CALCUL MÉCANIQUE DU SCORE D'INSTRUCTION
// ------------------------------------------------------------
// Ce module est la source de vérité du scoring Prelude. Le score
// global et le verdict ne sont plus produits par l orchestrator
// LLM (qui souffrait d un biais de convergence : tous les dossiers
// APPROFONDIR donnaient ~52, tous les REFUSER ~22, etc., parce
// que le LLM calibrait ses dimensions sur le verdict qu il avait
// choisi). Ils sont calcules de maniere deterministe a partir
// des scores produits par les six moteurs Bloc 1 specialises,
// qui eux n ont aucune connaissance du verdict final.
//
// PRINCIPE DE SEPARATION
//
// Avant : un seul LLM produit verdict + score + dimensions, ce
//         qui revient a juger ET a produire les preuves chiffrees
//         du jugement. Convergence inevitable.
// Apres : le code calcule le score (deterministe, auditable, base
//         sur les moteurs Bloc 1 calibres sur les faits du dossier).
//         Le LLM orchestrator devient narrateur : il argumente le
//         verdict, ne le decide plus. Il peut signaler un desaccord
//         motive si son jugement structurel diverge fortement du
//         calcul mecanique.
//
// FORMULE
//
// scoreGlobal = clamp(
//     0.20 * scoreEquipe        // composite team-engine
//   + 0.22 * scoreMarche        // composite market-engine
//   + 0.15 * scoreMacro         // contraryclicalOpportunity.score
//   + 0.13 * scoreModeleEco     // financial-coherence.globalCoherenceScore
//   + 0.15 * scoreContrarien    // contrarian.globalContrarianScore
//   + 0.15 * scoreVigilance     // 100 - blindspot.globalBlindspotScore
//   , 0, 100)
//
// Les composites Equipe et Marche aggregent plusieurs sous-scores
// que le moteur produit (couverture systemique, anti-fragilite,
// transposition, obsession produit pour Equipe ; intensite besoin,
// defensibilite, signaux organiques pour Marche).
//
// SEUILS DE VERDICT
//
// score >= 75 : INVESTIR
// 60 <= score < 75 : INVESTIR AVEC CONDITIONS
// 45 <= score < 60 : APPROFONDIR
// score < 45 : REFUSER
//
// Ces seuils sont publics et auditables. Un partner peut tracer
// chaque point du score a sa source moteur.
// ============================================================

import type {
  TeamAnalysisOutput,
  MarketAnalysisOutput,
  MacroAnalysisOutput,
  BlindspotAnalysisOutput,
  ContrarianAnalysisOutput,
  FinancialCoherenceOutput,
  FinancialCoherenceArchetype,
} from './types';

export type Verdict = 'investir' | 'investir avec conditions' | 'approfondir' | 'refuser';

// ============================================================
// SEUILS DE DIVERGENCE ADAPTES A L ARCHETYPE
// ------------------------------------------------------------
// Le bandeau d alerte de divergence (UI) compare le score LLM au
// score mecanique. Un seuil universel etait trop sensible sur les
// dossiers non-SaaS : un dossier hardware ou biotech peut legitimement
// produire un ecart >15 points entre la lecture LLM (qui voit tous
// les outputs des moteurs) et le score mecanique (qui aggrege 6
// scores sources). On adapte le seuil a la couverture des tests
// applicables de l archetype :
//   - A SaaS pur, C marketplace, F consumer DTC : 7 tests applicables,
//     score mecanique pleinement instrumente. Seuil 15.
//   - B hardware, E B2G : 6 tests applicables (T2 LTV/CAC neutralise),
//     score mecanique legerement moins instrumente. Seuil 20.
//   - D biotech pre-approbation : 3 tests applicables seulement.
//     Score mecanique tres polarise, divergence LLM attendue. Seuil 25.
//   - unclassified : matrice non tranchee, 4 tests universels. Seuil 25.
//
// Le seuil 'assessorDisagreement' du LLM dans l orchestrator reste
// fixe a 12 points : il remonte tout desaccord motive dans la note,
// independamment de l archetype. Le bandeau visuel rouge n est
// declenche qu au-dela du seuil archetypal ci-dessous.
// ============================================================
export const DIVERGENCE_THRESHOLDS_BY_ARCHETYPE: Record<FinancialCoherenceArchetype, number> = {
  'A-saas-pur': 15,
  'C-marketplace': 15,
  'F-consumer-dtc': 15,
  'B-hardware-deeptech': 20,
  'E-b2g-defense': 20,
  'D-biotech-pre-approval': 25,
  'unclassified': 25,
};

/** Seuil de divergence par defaut quand l archetype n est pas connu
 *  (legacy / dossiers anterieurs au commit 5184213). Identique au
 *  comportement historique pour preserver la non-regression. */
export const DEFAULT_DIVERGENCE_THRESHOLD = 15;

/**
 * Poids des six dimensions dans le score global. Doivent sommer a 1.0
 * exactement. Calibres pour donner plus de poids aux dimensions qui
 * predisent le mieux le succes long terme dans le corpus historique
 * Prelude (Marche et Equipe representent 42% combine).
 */
export const DIMENSION_WEIGHTS = {
  team: 0.20,
  market: 0.22,
  macro: 0.15,
  financial: 0.13,
  contrarian: 0.15,
  vigilance: 0.15,
} as const;

/**
 * Seuils de verdict appliques au score mecanique. Entre les seuils,
 * le verdict est strictement determine. Un partner peut adapter ces
 * seuils en modifiant uniquement cette constante : tous les dossiers
 * passes peuvent etre recalcules.
 */
export const VERDICT_THRESHOLDS = {
  invest: 75,
  conditions: 60,
  investigate: 45,
} as const;

export interface DimensionBreakdown {
  /** Score brut sur 100 produit par le ou les moteurs. */
  score: number;
  /** Poids de la dimension dans le score global (somme = 1.0). */
  weight: number;
  /** Contribution arrondie au score global (score * weight). */
  contribution: number;
  /** Synthese textuelle des sous-scores qui composent ce score. */
  rationale: string;
  /** Sous-scores individuels qui ont nourri le composite (Equipe / Marche). */
  subScores?: Array<{ name: string; score: number; weight: number }>;
  /**
   * True si la dimension n a pas pu etre evaluee faute de donnees
   * (ex : modele economique sans business plan fourni). Le score affiche
   * est alors la valeur neutre 50 utilisee pour le calcul mais l UI doit
   * afficher un message explicite plutot que le chiffre nu, sinon le
   * partner croit que la dimension a ete vraiment notee.
   */
  notEvaluable?: boolean;
}

export interface MechanicalScoreResult {
  /** Score global sur 100, calcule a partir des dimensions. */
  globalScore: number;
  /** Verdict derive deterministe via les seuils. */
  verdict: Verdict;
  /** Archetype economique du dossier (issu de financial-coherence,
   *  passe au score-calculator pour transparence des rationales et
   *  adaptation du seuil de divergence affiche dans l UI). N affecte
   *  PAS le calcul du score lui-meme (ponderations strictement
   *  identiques peu importe l archetype). */
  archetype?: FinancialCoherenceArchetype;
  /** Seuil de divergence applicable a ce dossier, en points (15 / 20 /
   *  25). Lu par l UI pour adapter le bandeau d alerte rouge a la
   *  couverture des tests applicables de l archetype. */
  divergenceThreshold: number;
  /** Detail du calcul par dimension, expose dans l UI pour auditabilite. */
  dimensions: {
    team: DimensionBreakdown;
    market: DimensionBreakdown;
    macro: DimensionBreakdown;
    financial: DimensionBreakdown;
    contrarian: DimensionBreakdown;
    vigilance: DimensionBreakdown;
  };
  /** Formule lisible exposee a l UI. */
  formula: string;
  /** Seuils de verdict utilises, pour affichage et auditabilite. */
  thresholds: typeof VERDICT_THRESHOLDS;
}

/**
 * Calcule un score composite Equipe a partir des quatre sous-scores
 * du moteur team-engine. Pondere :
 *   - Couverture systemique 0.30 (la plus discriminante)
 *   - Anti-fragilite collective 0.25 (capacite a traverser les crises)
 *   - Transposition d experience 0.25 (founder-market fit applique)
 *   - Obsession produit 0.20 (intensite founder)
 */
function computeTeamScore(team: TeamAnalysisOutput | null | undefined): {
  score: number;
  subScores: Array<{ name: string; score: number; weight: number }>;
  rationale: string;
} {
  if (!team) {
    return {
      score: 50,
      subScores: [],
      rationale: 'Donnees Equipe indisponibles, score neutre 50.',
    };
  }
  const systemic = team.systemicCoverage?.score ?? 50;
  const antifragility = team.collectiveAntiFragility?.score ?? 50;
  const transposition = team.experienceTransposition?.score ?? 50;
  const obsession = team.founderObsession?.score ?? 50;
  const score = Math.round(
    systemic * 0.30 +
    antifragility * 0.25 +
    transposition * 0.25 +
    obsession * 0.20,
  );
  return {
    score,
    subScores: [
      { name: 'Couverture systemique', score: systemic, weight: 0.30 },
      { name: 'Anti-fragilite collective', score: antifragility, weight: 0.25 },
      { name: 'Transposition d experience', score: transposition, weight: 0.25 },
      { name: 'Obsession produit', score: obsession, weight: 0.20 },
    ],
    rationale: `Composite des quatre sous-scores de l equipe : couverture systemique ${systemic}, anti-fragilite ${antifragility}, transposition ${transposition}, obsession ${obsession}.`,
  };
}

/**
 * Calcule un score composite Marche a partir des trois sous-scores
 * du moteur market-engine. Pondere :
 *   - Intensite besoin 0.45 (le pain point est central)
 *   - Defensibilite 0.35 (les moats determinent la durabilite)
 *   - Signaux organiques 0.20 (proxy de traction bottom-up)
 */
function computeMarketScore(market: MarketAnalysisOutput | null | undefined): {
  score: number;
  subScores: Array<{ name: string; score: number; weight: number }>;
  rationale: string;
} {
  if (!market) {
    return {
      score: 50,
      subScores: [],
      rationale: 'Donnees Marche indisponibles, score neutre 50.',
    };
  }
  const intensity = market.needIntensity?.score ?? 50;
  const defensibility = market.defensibility?.score ?? 50;
  const organic = market.organicSignals?.score ?? 50;
  const score = Math.round(
    intensity * 0.45 +
    defensibility * 0.35 +
    organic * 0.20,
  );
  return {
    score,
    subScores: [
      { name: 'Intensite du besoin', score: intensity, weight: 0.45 },
      { name: 'Defensibilite', score: defensibility, weight: 0.35 },
      { name: 'Signaux organiques', score: organic, weight: 0.20 },
    ],
    rationale: `Composite des trois sous-scores du marche : intensite besoin ${intensity}, defensibilite ${defensibility}, signaux organiques ${organic}.`,
  };
}

/**
 * Derive le verdict du score selon les seuils stricts.
 */
export function deriveVerdict(score: number): Verdict {
  if (score >= VERDICT_THRESHOLDS.invest) return 'investir';
  if (score >= VERDICT_THRESHOLDS.conditions) return 'investir avec conditions';
  if (score >= VERDICT_THRESHOLDS.investigate) return 'approfondir';
  return 'refuser';
}

/**
 * Fonction principale : calcule le score mecanique a partir des sorties
 * des moteurs Bloc 1. Retourne un MechanicalScoreResult complet expose
 * tel quel a l UI pour auditabilite.
 */
export function computeMechanicalScore(input: {
  team: TeamAnalysisOutput | null | undefined;
  market: MarketAnalysisOutput | null | undefined;
  macro: MacroAnalysisOutput | null | undefined;
  financial: FinancialCoherenceOutput | null | undefined;
  contrarian: ContrarianAnalysisOutput | null | undefined;
  blindspot: BlindspotAnalysisOutput | null | undefined;
}): MechanicalScoreResult {
  const teamComposite = computeTeamScore(input.team);
  const marketComposite = computeMarketScore(input.market);

  const macroScore = input.macro?.contraryclicalOpportunity?.score ?? 50;

  // CAS PARTICULIER : modele economique non evaluable.
  // Le moteur Coherence financiere retourne globalCoherenceScore=0 quand
  // aucun business plan exploitable n a ete fourni (hasFinancialData=false
  // ou dataSource='none'). Si on traitait ce 0 comme un score reel, on
  // penaliserait injustement de 6.5 points le score global (poids 0.13 x
  // ecart de 50 par rapport a la valeur neutre), ce qui peut faire basculer
  // un APPROFONDIR (47) en REFUSER (44) a un point pres du seuil. Bug
  // observe sur le dossier Platypus Craft post-refonte.
  //
  // Solution : si la dimension n est pas evaluable, on utilise la valeur
  // neutre 50 (ni penalise, ni bonifie) et on flagge la dimension comme
  // non evaluable pour que l UI affiche un encart explicite plutot qu un
  // chiffre trompeur. Le partner voit que le score global est calcule
  // sans cette dimension et peut demander le BP au fondateur avant
  // decision finale.
  const financialEvaluable = !!(
    input.financial
    && input.financial.hasFinancialData !== false
    && input.financial.dataSource !== 'none'
    && (input.financial.globalCoherenceScore ?? 0) > 0
  );
  const financialScore = financialEvaluable
    ? input.financial!.globalCoherenceScore!
    : 50;

  const contrarianScore = input.contrarian?.globalContrarianScore ?? 50;
  // Vigilance est inversee : un fort score blindspot = beaucoup de patterns
  // critiques detectes = score de risque maitrise faible. On inverse pour
  // que le composite global soit dans le sens "plus c est haut, mieux c est".
  const vigilanceRaw = input.blindspot?.globalBlindspotScore ?? 50;
  const vigilanceScore = Math.max(0, Math.min(100, 100 - vigilanceRaw));

  const dimensions = {
    team: {
      score: teamComposite.score,
      weight: DIMENSION_WEIGHTS.team,
      contribution: Math.round(teamComposite.score * DIMENSION_WEIGHTS.team * 100) / 100,
      rationale: teamComposite.rationale,
      subScores: teamComposite.subScores,
    },
    market: {
      score: marketComposite.score,
      weight: DIMENSION_WEIGHTS.market,
      contribution: Math.round(marketComposite.score * DIMENSION_WEIGHTS.market * 100) / 100,
      rationale: marketComposite.rationale,
      subScores: marketComposite.subScores,
    },
    macro: {
      score: macroScore,
      weight: DIMENSION_WEIGHTS.macro,
      contribution: Math.round(macroScore * DIMENSION_WEIGHTS.macro * 100) / 100,
      rationale: `Score d opportunite contracyclique ${macroScore} produit par le moteur macro a partir du regime de taux, de la geopolitique et de la capitalisation VC sur le segment.`,
    },
    financial: {
      score: financialScore,
      weight: DIMENSION_WEIGHTS.financial,
      contribution: Math.round(financialScore * DIMENSION_WEIGHTS.financial * 100) / 100,
      rationale: financialEvaluable
        ? buildFinancialRationale(financialScore, input.financial)
        : `Modele economique non evaluable : aucun business plan exploitable fourni avec ce dossier (dataSource='${input.financial?.dataSource ?? 'none'}'). Valeur neutre 50 utilisee dans le calcul global pour ne pas penaliser ni bonifier injustement la dimension. Demander le BP au fondateur avant decision finale.`,
      notEvaluable: !financialEvaluable,
    },
    contrarian: {
      score: contrarianScore,
      weight: DIMENSION_WEIGHTS.contrarian,
      contribution: Math.round(contrarianScore * DIMENSION_WEIGHTS.contrarian * 100) / 100,
      rationale: `Score contrarien ${contrarianScore} produit par le moteur Singularités contrariennes sur les dix signaux S1-S10.`,
    },
    vigilance: {
      score: vigilanceScore,
      weight: DIMENSION_WEIGHTS.vigilance,
      contribution: Math.round(vigilanceScore * DIMENSION_WEIGHTS.vigilance * 100) / 100,
      rationale: `Score de risque maitrise ${vigilanceScore} (inverse du globalBlindspotScore ${vigilanceRaw} produit par le moteur Vigilance critique sur les dix patterns P1-P10).`,
    },
  };

  const rawSum =
    dimensions.team.contribution +
    dimensions.market.contribution +
    dimensions.macro.contribution +
    dimensions.financial.contribution +
    dimensions.contrarian.contribution +
    dimensions.vigilance.contribution;

  const globalScore = Math.max(0, Math.min(100, Math.round(rawSum)));
  const verdict = deriveVerdict(globalScore);

  // Archetype passe au resultat pour transparence dans l UI (rationale
  // de la dimension Financial, adaptation du seuil de divergence visuel).
  // N affecte PAS le calcul du score lui-meme : les ponderations restent
  // strictement identiques peu importe l archetype, le score d un dossier
  // SaaS canonique reste exactement ce qu il etait.
  const archetype = input.financial?.archetype;
  const divergenceThreshold = archetype
    ? DIVERGENCE_THRESHOLDS_BY_ARCHETYPE[archetype]
    : DEFAULT_DIVERGENCE_THRESHOLD;

  return {
    globalScore,
    verdict,
    archetype,
    divergenceThreshold,
    dimensions,
    formula: `score = 0.20 * Equipe + 0.22 * Marche + 0.15 * Macro + 0.13 * Modele economique + 0.15 * Contrariens + 0.15 * Vigilance (inversee). Verdict derive : <45 = refuser, 45-59 = approfondir, 60-74 = investir avec conditions, >=75 = investir.`,
    thresholds: VERDICT_THRESHOLDS,
  };
}

// ============================================================
// HELPERS - RATIONALE EDITORIAL DE LA DIMENSION FINANCIAL
// ============================================================

const ARCHETYPE_SHORT_LABEL: Record<FinancialCoherenceArchetype, string> = {
  'A-saas-pur': 'SaaS pur',
  'B-hardware-deeptech': 'hardware ou deeptech',
  'C-marketplace': 'marketplace',
  'D-biotech-pre-approval': 'biotech pre-approbation',
  'E-b2g-defense': 'B2G ou defense',
  'F-consumer-dtc': 'consumer DTC',
  'unclassified': 'non classifie',
};

/**
 * Construit un rationale editorial pour la dimension Financial qui
 * dit la verite sur la couverture reelle des tests applicables.
 * Avant ce fix le texte mentionnait systematiquement "sept tests
 * structures T1-T7" meme quand l archetype en neutralisait certains
 * (cas hardware : T2 neutralise ; cas biotech : T1, T2, T5, T6
 * neutralises). Desormais le rationale enonce le nombre exact de
 * tests appliques et l archetype detecte, pour que le partner sache
 * sur quelle base le score a ete calcule.
 */
function buildFinancialRationale(
  score: number,
  financial: FinancialCoherenceOutput | null | undefined,
): string {
  if (!financial) {
    return `Score de coherence financiere ${score} aggrege sur les sept tests structures (T1-T7) du moteur Cohérence financière.`;
  }
  const archetype = financial.archetype;
  const applicable = financial.applicableTests;
  if (!archetype || !applicable || applicable.length === 0) {
    // Compatibilite ascendante : si l output Coherence ne porte pas
    // encore archetype / applicableTests (analyses anterieures au
    // commit 5184213), on retombe sur le texte historique pour ne
    // pas casser l affichage des dossiers deja persistes.
    return `Score de coherence financiere ${score} aggrege sur les sept tests structures (T1-T7) du moteur Cohérence financière.`;
  }
  const total = 7;
  const n = applicable.length;
  const neutralized: string[] = [];
  for (const t of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']) {
    if (!applicable.includes(t)) neutralized.push(t);
  }
  const label = ARCHETYPE_SHORT_LABEL[archetype];
  if (n === total) {
    return `Score de coherence financiere ${score} aggrege sur les sept tests structures (T1-T7) du moteur Cohérence financière. Archetype detecte : ${label}, tous les tests applicables.`;
  }
  const neutralizedLabel = neutralized.length === 1
    ? `${neutralized[0]} neutralise`
    : `${neutralized.join(', ')} neutralises`;
  return `Score de coherence financiere ${score} calcule sur ${n} tests applicables (sur ${total} doctrinaux) du moteur Cohérence financière. Archetype detecte : ${label}, ${neutralizedLabel} cote code car non pertinent pour ce modele economique.`;
}
