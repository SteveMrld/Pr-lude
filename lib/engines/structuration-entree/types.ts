// ============================================================
// PRELUDE - Bloc 3 : recommandation de structuration a l entree
// ------------------------------------------------------------
// Types du moteur. Le moteur consomme le result_json d une analyse
// existante (Bloc 1, eventuellement enrichi Bloc 2) et produit une
// recommandation de structuration du term sheet en six rubriques.
//
// Principe central : chaque recommandation doit citer le signal
// precis de l analyse qui la motive. Pas de boilerplate generique.
// Le champ anchors materialise cette discipline : si la liste est
// vide, la rubrique sort en data-missing.
// ============================================================

/** Posture globale derivee du profil de risque et du verdict */
export type PostureGenerale =
  | 'protection-forte'
  | 'standard'
  | 'souple';

/**
 * Une rubrique de la recommandation. La recommendation est une
 * prose dense, anchors liste les signaux precis cites.
 */
export interface StructurationSection {
  /** Statut de la rubrique. data-missing si signaux insuffisants */
  status: 'applicable' | 'data-missing';
  /** Recommandation redigee en prose, voix Le Grand Continent. */
  recommendation: string;
  /** Citations explicites des elements de l analyse qui motivent
   *  cette recommandation : tel driver, tel risque (avec son
   *  intensite), telle condition, tel insight comparable. */
  anchors: string[];
  /** Si status = data-missing, raison sobre */
  missingReason?: string;
}

/** Six rubriques de la recommandation Bloc 3 */
export interface StructurationEntreeOutput {
  /** Posture globale derivee de l analyse */
  postureGenerale: PostureGenerale;
  /** Justification de la posture, 1-2 phrases */
  postureRationale: string;
  /** Preambule synthetique, 3-5 phrases voix Le Grand Continent */
  preambule: string;
  /** Rubrique a. Gouvernance et board */
  gouvernanceBoard: StructurationSection;
  /** Rubrique b. Clauses protectrices */
  clausesProtectrices: StructurationSection;
  /** Rubrique c. Tranching conditionne aux milestones */
  tranchingMilestones: StructurationSection;
  /** Rubrique d. Preference de liquidation et anti-dilution */
  preferenceLiquidationAntiDilution: StructurationSection;
  /** Rubrique e. Droits d information et reporting */
  droitsInformationReporting: StructurationSection;
  /** Rubrique f. Cadrage des scenarios de sortie a l entree */
  cadrageScenariosSortie: StructurationSection;
  /** Metadonnees pour audit */
  meta: {
    generatedAt: string;
    model: string;
    /** Quels signaux du result_json etaient disponibles. Permet
     *  au consommateur de comprendre pourquoi une rubrique sort
     *  en data-missing. */
    inputDigest: {
      hasFinalRecommendation: boolean;
      hasValuation: boolean;
      hasFragiliteStructurelle: boolean;
      hasNarrativeDrift: boolean;
      hasPatternMatching: boolean;
      hasIndicators: boolean;
      hasDecisionDrivers: boolean;
      hasKeyConditions: boolean;
    };
  };
}

/** Erreur typee pour signaler un input insuffisant en amont du LLM */
export class InsufficientInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientInputError';
  }
}
