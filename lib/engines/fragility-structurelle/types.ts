// ============================================================
// FRAGILITE STRUCTURELLE - TYPES PARTAGES
// ------------------------------------------------------------
// Sept patterns du moteur Phase 4 partagent une signature
// commune : meme forme d input, meme forme d output, meme
// architecture en six couches anti-hallucination.
//
// Les patterns sont :
//   - growth-subsidized-model    (cousin Aveuglement Cash Burn)
//   - infrastructure-hostage     (nouveau)
//   - fixed-cost-trap            (cousin Aveuglement Couts Caches)
//   - regulatory-time-bomb       (nouveau)
//   - commoditization-drift      (extrait de Narrative Drift V0)
//   - capital-structure-fragility (cousin Aveuglement Cap Table)
//   - scale-mirage-risk          (cousin Aveuglement Maturite Execution)
//
// La doctrine complete est dans docs/patterns/. Cette interface
// est le contrat de code que chaque pattern doit honorer pour
// pouvoir etre orchestree par fragility-structurelle/orchestrator.
// ============================================================

import type { ExtractionOutput, FinancialDataExtraction, MarketAnalysisOutput } from '../types';
import type { SectoralContext } from '../sectoral-injection';

// ============================================================
// IDENTIFIANTS
// ============================================================

/**
 * Identifiants des sept patterns du moteur Fragilite Structurelle.
 * Ordre fixe : utilise pour les boucles deterministes et l UI.
 */
export const PATTERN_IDS = [
  'growth-subsidized-model',
  'infrastructure-hostage',
  'fixed-cost-trap',
  'regulatory-time-bomb',
  'commoditization-drift',
  'capital-structure-fragility',
  'scale-mirage-risk',
] as const;

export type PatternId = typeof PATTERN_IDS[number];

/**
 * Libelle editorial des patterns pour l UI et la note d instruction.
 * En francais sobre, sans jargon, calque sur le style "Lecture du
 * langage" qu on a retenu pour Narrative Drift.
 */
export const PATTERN_LABELS: Record<PatternId, string> = {
  'growth-subsidized-model': 'Croissance subventionnée',
  'infrastructure-hostage': 'Captivité infrastructure',
  'fixed-cost-trap': 'Coûts fixes incompressibles',
  'regulatory-time-bomb': 'Risque réglementaire daté',
  'commoditization-drift': 'Érosion de défensibilité',
  'capital-structure-fragility': 'Fragilité cap table',
  'scale-mirage-risk': 'Industrialisation prématurée',
};

// ============================================================
// VERDICTS
// ============================================================

/**
 * Niveaux de verdict alignes sur Narrative Drift pour homogeneite
 * UI : meme palette ocre graduee, meme logique de remontee.
 */
export type PatternVerdict = 'sain' | 'attention' | 'alerte' | 'drapeau-rouge' | 'non-applicable';

/**
 * Niveaux d applicabilite alignes sur la matrice de pertinence.
 * full = pattern actif a pleine intensite, weight 1
 * partial = pattern actif en lecture limitee, weight 0.3 a 0.7
 * weak-signal = pattern actif mais avec corpus insuffisant
 * not-applicable = pattern skippe par decision matrice
 */
export type PatternApplicability = 'full' | 'partial' | 'weak-signal' | 'not-applicable';

// ============================================================
// INPUT
// ============================================================

/**
 * Input commun aux sept patterns. Reproduit la signature de
 * NarrativeDriftInput pour homogeneite. Chaque pattern peut
 * ignorer les champs qui ne le concernent pas.
 *
 * Note : pas de champ pitchText dedie. Les patterns Phase 4
 * lisent l extraction et le BP, pas le texte brut du pitch.
 * C est une distinction importante avec Narrative Drift, qui
 * lui mesure le LANGAGE.
 */
export interface PatternInput {
  /** Output de l extraction primaire, source principale de tous les patterns. */
  extraction: ExtractionOutput;

  /** Donnees financieres extraites du BP, requises pour Growth Subsidized,
   *  Fixed Cost Trap, Capital Structure Fragility, Scale Mirage Risk. */
  financialData?: FinancialDataExtraction | null;

  /** Analyse de marche, requise pour Commoditization Drift et
   *  Regulatory Time Bomb. */
  marketAnalysis?: MarketAnalysisOutput | null;

  /** Texte brut du pitch deck, optionnel. Certains patterns y
   *  cherchent les claims explicites du fondateur. */
  rawPitchText?: string | null;

  /** Note dimensionnelle du fonds sur le secteur, optionnelle.
   *  Sert a calibrer les benchmarks sectoriels. */
  fundNote?: string | null;

  /** Contexte sectoriel Prelude resolu en amont par
   *  resolveSectoralContext. Injection hybride (resume editorial
   *  commun plus dimensions intensite capitalistique, cyclicite et
   *  tension capital-talent) consommee par chaque pattern selon la
   *  decision 6 de la fiche sectorielle. null quand la matrice
   *  sectorielle ne couvre pas le secteur du dossier ou que la
   *  fiche est perimee. */
  sectoralContext?: SectoralContext | null;

  /** Asset class normalise du dossier (matrix.assetClass). Sert au
   *  selecteur central d archetypes pour ne proposer au LLM que des
   *  archetypes proches sectoriellement. Fallback 'unclassified' si
   *  la matrice n a pas tranche. Voir lib/engines/archetype-selector. */
  assetClass?: string;
}

// ============================================================
// OUTPUT D UN AXE INDIVIDUEL
// ============================================================

/**
 * Chaque pattern produit trois axes scores. La structure d un axe
 * est commune : score, verdict, rationale, symetrie evidence
 * pro/contra, confidence. Identique a Narrative Drift.
 */
export interface PatternAxisAnalysis {
  /** Score 0-100, plus haut = plus de fragilite detectee */
  score: number;

  /** Verdict editorial calibre sur le score et la combinaison d evidences */
  verdict: PatternVerdict;

  /** Une a trois phrases editoriales qui justifient le score */
  rationale: string;

  /** Faits chiffres au charge du pattern, avec tags de source */
  evidencePro: string[];

  /** Faits chiffres qui mitigent le pattern, avec tags de source */
  evidenceContra: string[];

  /** Confiance dans l analyse, refletant la qualite des sources disponibles */
  confidence: number;
}

// ============================================================
// OUTPUT DU PATTERN
// ============================================================

/**
 * Sortie standardisee d un pattern. Tous les patterns produisent
 * cette structure, ce qui permet a l UI de les rendre uniformement
 * et a l orchestrateur de les agreger sans cas particulier.
 */
export interface PatternAnalysisOutput {
  /** Identifiant du pattern, utile pour le routage UI */
  patternId: PatternId;

  /** Applicabilite finale calculee par le pattern lui-meme,
   *  peut differer du verdict de la matrice si le pattern detecte
   *  un corpus insuffisant en cours d execution. */
  applicabilite: PatternApplicability;

  /** Rationale d applicabilite, explique ce qui a permis ou empeche
   *  l execution complete. Sert au partner pour comprendre le perimetre. */
  applicabiliteRationale: string;

  /** Score global du pattern, agrege des trois axes. 0-100.
   *  null si le gating axe central a force le pattern en non-applicable
   *  (axe identitaire neutralise, pas d agregation possible). */
  globalScore: number | null;

  /** Verdict global du pattern, derive du score global et des
   *  combinaisons d axes (un axe a 90 force globalement vers
   *  drapeau-rouge meme si les deux autres sont moderes). */
  verdict: PatternVerdict;

  /** Resume editorial du pattern en deux a quatre phrases. Sert
   *  d intro a la sous-section UI. */
  resumeEditorial: string;

  /** Trois axes argumentes. Toujours presents, meme si l un est
   *  marque non-applicable. Garantit la lisibilite UI homogene. */
  axis1: PatternAxisAnalysis;
  axis2: PatternAxisAnalysis;
  axis3: PatternAxisAnalysis;

  /** Counter-archetype le plus proche identifie par le pattern,
   *  avec direction (derive-confirmee = pattern realise dans le
   *  passe, trajectoire-saine = anti-pattern). */
  counterArchetype: {
    closest: string;
    direction: 'derive-confirmee' | 'trajectoire-saine' | 'non determine';
    rationale: string;
  };

  /** Recommandation DD specifique au pattern, en une phrase. Sert
   *  a orienter les questions du partner aux fondateurs et la
   *  scope de la DD legale ou financiere ulterieure. */
  recommandationDD: string;

  /** Marqueurs internes pour audit anti-hallucination. Liste des
   *  tags presents (pitch, bp, pacte, etc.) et des claims chiffres. */
  auditTrail: {
    sourceTags: string[];
    claimsChiffres: string[];
  };
}

// ============================================================
// OUTPUT DE L ORCHESTRATEUR
// ============================================================

/**
 * Sortie globale du moteur Fragilite Structurelle. Agrege les sept
 * patterns avec leur applicabilite, leur score, leur verdict.
 * Ajoute les combinaisons diagnostiques cross-patterns documentees
 * dans les fiches (trajectoire WeWork, signature Theranos
 * commercial, etc.).
 */
export interface FragiliteStructurelleAnalysisOutput {
  /** Sortie brute des sept patterns, indexee par PatternId.
   *  Un pattern non-applicable a un objet avec applicabilite =
   *  not-applicable et globalScore = null (gating axe central
   *  ou pre-check financialData manquant). */
  patterns: Record<PatternId, PatternAnalysisOutput | null>;

  /** Score global Fragilite Structurelle, 0-100. Agrege pondere
   *  des sept patterns selon leur applicabilite et leur weight
   *  matrice. Plus haut = plus de fragilite cumulee. */
  globalFragilityScore: number;

  /** Verdict global Fragilite Structurelle, derive du score global
   *  et de la presence de combinaisons diagnostiques fortes. */
  verdict: PatternVerdict;

  /** Resume editorial du moteur en trois a cinq phrases. Sert d intro
   *  a la grande sous-section UI Fragilite Structurelle. */
  resumeEditorial: string;

  /** Combinaisons diagnostiques detectees. Documentees dans les
   *  fiches patterns. Une combinaison declenchee est un signal
   *  fort qui doit remonter sur la couverture. */
  combinaisons: Array<{
    nom: string;
    patterns: PatternId[];
    rationale: string;
    severite: 'attention' | 'alerte' | 'drapeau-rouge';
  }>;

  /** Liste consolidee des recommandations DD issues de chaque
   *  pattern actif, deduplicees et priorisees. */
  recommandationsDD: string[];
}
