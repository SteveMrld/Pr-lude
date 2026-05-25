// ============================================================
// ARCHETYPE DE COHERENCE FINANCIERE - DERIVATION DETERMINISTE
// ------------------------------------------------------------
// Calcul cote code, sans appel LLM, de l archetype economique du
// dossier a partir de la matrice de pertinence. Conditionne quels
// tests de coherence financiere sont applicables et lesquels sont
// neutralises AVANT meme l envoi du prompt LLM.
//
// Doctrine. La classification archetypale etait deleguee au LLM
// dans le prompt systeme (six archetypes A a F). Cette delegation
// repetait le bug Platypus : re-classification locale par un
// classificateur dependant des libelles libres, au lieu d utiliser
// la source de verite unique deja arbitree dans computeRelevanceMatrix.
//
// Desormais l archetype est calcule deterministe depuis
// matrix.assetClass + matrix.productionChain + matrix.businessModel,
// et le gating des tests applicables est lui aussi deterministe.
// Le LLM ne voit dans son user prompt que les tests qu il doit
// reellement noter. Les tests neutralises sont construits cote
// code avec un rationale explicite, et ne participent pas au
// calcul du globalCoherenceScore (ni penalises ni bonifies).
//
// Garde-fou cas SaaS canonique. Un dossier archetype A (SaaS pur)
// a TOUS les tests applicables : comportement identique au flux
// historique, pas de regression sur la majorite du flux entrant.
// ============================================================

import type {
  FinancialCoherenceTest,
  FinancialCoherenceArchetype,
} from './types';
import type { RelevanceMatrix, BusinessModel, ProductionChain } from './relevance-matrix';

// ============================================================
// TYPES INTERNES
// ============================================================

export type TestId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';

/** Mapping entre testId canonique et cle de l output FinancialCoherence. */
export const TEST_ID_TO_KEY: Record<TestId, keyof import('./types').FinancialCoherenceOutput['tests']> = {
  T1: 'crosseHockeySuspecte',
  T2: 'ratioLtvCacImplicite',
  T3: 'margeBruteCoherente',
  T4: 'burnRateRunway',
  T5: 'incoherenceHeadcountCa',
  T6: 'unitEconomicsViables',
  T7: 'coherenceHypothesesMarche',
};

export const TEST_LABELS: Record<TestId, string> = {
  T1: 'Crosse de hockey suspecte',
  T2: 'Ratio LTV/CAC implicite',
  T3: 'Marge brute cohérente',
  T4: 'Burn rate vs runway',
  T5: 'Incohérence headcount/CA',
  T6: 'Unit economics viables',
  T7: 'Cohérence hypothèses marché',
};

// Ponderation par test pour le calcul du globalCoherenceScore. T1,
// T6, T7 sont doctrinalement les plus predictifs (croissance, unit
// economics, hypotheses marche) et portent un poids 1.5. Les autres
// portent 1. Identique a la pratique du LLM dans l ancien prompt.
const TEST_WEIGHTS: Record<TestId, number> = {
  T1: 1.5,
  T2: 1.0,
  T3: 1.0,
  T4: 1.0,
  T5: 1.0,
  T6: 1.5,
  T7: 1.5,
};

// ============================================================
// MAPPING ARCHETYPE -> TESTS APPLICABLES
// ------------------------------------------------------------
// La doctrine est articulee dans le rapport d audit pre-correction.
// On l ancre ici en TypeScript pour qu elle soit deterministe.
//
// Archetype A : SaaS pur (recurrent-saas ou consumer-subscription
//   sur pure-software). TOUS les tests applicables. C est le cas
//   canonique du pipeline : comportement historique preserve.
//
// Archetype B : hardware-physical, infrastructure-physical, ou
//   asset class defense / deeptech / industrial-hardware. T2
//   (LTV/CAC) neutralise : le modele est multi-stream B2B/B2G
//   long, pas de funnel marketing standard.
//
// Archetype C : marketplace. Tous les tests applicables, mais T2
//   est lu sur les deux cotes du marche (acquereurs ET fournisseurs).
//   Le LLM gere l adaptation dans son rationale.
//
// Archetype D : biotech pre-approbation (wet-biotech). T1, T2, T6
//   neutralises : revenue souvent nul 5-7 ans, pas de funnel, unit
//   economics post-approbation seulement.
//
// Archetype E : B2G / defense pure (contract-b2g). T2 neutralise :
//   cycle vente 12-36 mois, pas de CAC marketing classique.
//
// Archetype F : DTC consumer (unitary-sale + audience B2C). TOUS
//   les tests applicables. Comme A.
//
// Archetype unclassified : la matrice n a pas tranche (asset class
//   unclassified ou productionChain unknown). On garde uniquement
//   les tests universels (T1, T3, T4, T7). T2, T5, T6 sont marques
//   non-applicable avec rationale "classification a confirmer".
// ============================================================

const ARCHETYPE_APPLICABLE_TESTS: Record<FinancialCoherenceArchetype, TestId[]> = {
  'A-saas-pur': ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  'B-hardware-deeptech': ['T1', 'T3', 'T4', 'T5', 'T6', 'T7'],
  'C-marketplace': ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  'D-biotech-pre-approval': ['T3', 'T4', 'T7'],
  'E-b2g-defense': ['T1', 'T3', 'T4', 'T5', 'T6', 'T7'],
  'F-consumer-dtc': ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  'unclassified': ['T1', 'T3', 'T4', 'T7'],
};

const ARCHETYPE_LABELS: Record<FinancialCoherenceArchetype, string> = {
  'A-saas-pur': 'SaaS pur (logiciel B2B/B2C par abonnement)',
  'B-hardware-deeptech': 'Hardware industriel, deeptech, defense ou aerospatial',
  'C-marketplace': 'Marketplace ou plateforme a effet de reseau',
  'D-biotech-pre-approval': 'Biotech, medtech ou pharma pre-approbation',
  'E-b2g-defense': 'B2G, service public ou contrats defense purs',
  'F-consumer-dtc': 'E-commerce, consumer ou D2C',
  'unclassified': 'Classification non tranchee (asset class ou stade indetermine)',
};

// ============================================================
// CLASSIFICATION ARCHETYPALE DETERMINISTE
// ============================================================

/**
 * Determine l archetype economique du dossier a partir de la matrice
 * de pertinence. Source de verite unique : matrix.assetClass,
 * matrix.productionChain, matrix.businessModel.
 *
 * Quand la matrice est absente (legacy / tests unitaires), on
 * retourne 'unclassified' : le moteur applique alors uniquement les
 * tests universels (T1, T3, T4, T7) et remonte un warning explicite.
 */
export function deriveArchetype(matrix: RelevanceMatrix | null | undefined): {
  archetype: FinancialCoherenceArchetype;
  rationale: string;
} {
  if (!matrix) {
    return {
      archetype: 'unclassified',
      rationale: 'Matrice de pertinence absente : classification archetypale impossible. Tests universels uniquement (T1, T3, T4, T7).',
    };
  }

  const { assetClass, productionChain, businessModel } = matrix;

  // Cas frontiere structurel : la matrice elle-meme n a pas tranche.
  // On preserve l incertitude explicite au lieu de simuler un archetype.
  if (assetClass === 'unclassified' || productionChain === 'unknown') {
    return {
      archetype: 'unclassified',
      rationale: `Matrice non tranchee (assetClass=${assetClass}, productionChain=${productionChain}). Tests SaaS-centriques (T2, T5, T6) neutralises faute d ancrage doctrinal.`,
    };
  }

  // Archetype D : biotech humide. Production chain wet-biotech est
  // le marqueur structurel : R&D paillasse, essais cliniques, pas
  // de revenue commercial pendant 5-7 ans pour les programmes
  // therapeutiques. Prioritaire sur les autres car le seul archetype
  // ou T1 (croissance) est doctrinalement neutralise.
  if (productionChain === 'wet-biotech') {
    return {
      archetype: 'D-biotech-pre-approval',
      rationale: `productionChain=wet-biotech : R&D paillasse, essais cliniques. Croissance revenue non pertinente pre-approbation, unit economics et LTV/CAC neutralises jusqu a commercialisation. Reste applicable : T3 (marge post-approbation), T4 (runway clinique), T7 (taille marche conditionnelle).`,
    };
  }

  // Archetype E : B2G / defense pure. businessModel=contract-b2g est
  // le marqueur structurel. Les vraies metriques sont concentration
  // clients gouvernementaux, taux de gain appels d offres, cycle de
  // vente long. T2 LTV/CAC n a pas de sens en sales-led B2G.
  if (businessModel === 'contract-b2g') {
    return {
      archetype: 'E-b2g-defense',
      rationale: `businessModel=contract-b2g : ventes sur appels d offres publics, cycle 12-36 mois. T2 LTV/CAC neutralise : pas de funnel marketing standard. T1 ajuste a la trajectoire B2G lente.`,
    };
  }

  // Archetype B : hardware / deeptech / defense (asset class). Tous
  // les modeles a chaine physique entrent ici, plus les dossiers
  // dont l asset class flagge un hardware industriel meme si la
  // production chain est dual (hardware + software embarque).
  const isHardwareChain = productionChain === 'hardware-physical'
    || productionChain === 'infrastructure-physical';
  const isHardwareAsset = assetClass === 'industrial-hardware'
    || assetClass === 'defense'
    || assetClass === 'deeptech';
  if (isHardwareChain || isHardwareAsset) {
    return {
      archetype: 'B-hardware-deeptech',
      rationale: `${isHardwareChain ? `productionChain=${productionChain}` : `assetClass=${assetClass}`} : fabrication ou infrastructure physique, multi-stream B2B/B2G. T2 LTV/CAC neutralise : pas de funnel marketing standard sur un constructeur naval, un equipementier aerospatial ou un industriel defense. T6 (unit economics par unite produite) prioritaire.`,
    };
  }

  // Archetype C : marketplace pure.
  if (businessModel === 'marketplace') {
    return {
      archetype: 'C-marketplace',
      rationale: `businessModel=marketplace : LTV/CAC lu sur les deux cotes du marche (acquereurs et fournisseurs), T7 lu en densite de marche plutot que part de marche. Tous les tests applicables avec lecture polymorphe.`,
    };
  }

  // Archetype A : SaaS pur recurrent ou consumer-subscription sur
  // pure-software. C est le cas canonique : tous les tests
  // applicables, comportement historique preserve. CRITIQUE pour
  // la non-regression du flux courant.
  if (productionChain === 'pure-software'
    && (businessModel === 'recurrent-saas' || businessModel === 'consumer-subscription')) {
    return {
      archetype: 'A-saas-pur',
      rationale: `productionChain=pure-software + businessModel=${businessModel} : SaaS canonique. Tous les tests T1-T7 applicables avec seuils SaaS standard. Comportement historique du moteur preserve.`,
    };
  }

  // Archetype F : DTC consumer. unitary-sale combine a une audience
  // explicitement B2C. Le moteur lui-meme detecte l audience via la
  // matrice (macroSensitivityFactors contient 'consommation
  // discretionnaire' typiquement, et businessModel arbitre).
  if (businessModel === 'unitary-sale'
    && (matrix.macroSensitivityFactors.includes('consommation discretionnaire')
      || matrix.macroSensitivityFactors.includes('dependance volume B2C')
      || matrix.macroSensitivityFactors.includes('exposition consumer'))) {
    return {
      archetype: 'F-consumer-dtc',
      rationale: `businessModel=unitary-sale + signaux B2C explicites : DTC consumer. Tous les tests T1-T7 applicables avec seuils consumer (CAC critique, marge brute 30-50%).`,
    };
  }

  // Cas service-on-demand, marketplace hybride, hybrid, unitary-sale
  // B2B sans signal consumer : pas de match clair. On preserve
  // l incertitude.
  return {
    archetype: 'unclassified',
    rationale: `Combinaison non couverte (productionChain=${productionChain}, businessModel=${businessModel}, assetClass=${assetClass}). Tests SaaS-centriques neutralises faute d ancrage doctrinal.`,
  };
}

/**
 * Retourne la liste des testId applicables pour un archetype donne.
 */
export function getApplicableTests(archetype: FinancialCoherenceArchetype): TestId[] {
  return ARCHETYPE_APPLICABLE_TESTS[archetype];
}

/**
 * Retourne le libelle long de l archetype, utilisable en prompt LLM
 * et en synthese editoriale.
 */
export function getArchetypeLabel(archetype: FinancialCoherenceArchetype): string {
  return ARCHETYPE_LABELS[archetype];
}

// ============================================================
// CONSTRUCTION DES STUBS DE TESTS NON APPLICABLES
// ============================================================

/**
 * Construit un test marque notApplicable=true pour un testId donne et
 * un archetype donne. Le score est fige a 50 (proxy neutre) pour ne
 * pas casser les consommateurs aval qui lisent .score, mais
 * notApplicable=true signale au calcul du globalCoherenceScore qu il
 * doit etre exclu de la moyenne. passed=true pour ne pas faire
 * chuter le compteur "X/N tests passes" affiche dans l UI.
 *
 * Le rationale est specifique a l archetype et au test pour rester
 * pedagogique en note d investissement.
 */
export function buildNotApplicableTestStub(
  testId: TestId,
  archetype: FinancialCoherenceArchetype,
): FinancialCoherenceTest {
  const reason = buildNotApplicableReason(testId, archetype);
  return {
    testId,
    testName: TEST_LABELS[testId],
    passed: true,
    score: 50,
    evidence: `Test non applicable au modele ${getArchetypeLabel(archetype)} : ${reason}`,
    benchmark: 'N/A',
    implication: 'Test neutralise cote code, ne participe pas au score global. Voir les tests applicables pour la lecture financiere.',
    notApplicable: true,
  };
}

function buildNotApplicableReason(testId: TestId, archetype: FinancialCoherenceArchetype): string {
  switch (archetype) {
    case 'B-hardware-deeptech':
      if (testId === 'T2') return 'LTV/CAC n est pas pertinent sur un modele hardware multi-stream B2B/B2G. Les vraies unit economics sont mesurees sur la marge brute par unite produite (T6) et la rentabilite par contrat (T7).';
      break;
    case 'D-biotech-pre-approval':
      if (testId === 'T1') return 'Trajectoire de croissance non pertinente avant commercialisation. Revenue typiquement nul ou symbolique pendant 5 a 7 ans.';
      if (testId === 'T2') return 'LTV/CAC inapplicable avant approbation reglementaire. Pas de marche commercial donc pas de funnel d acquisition.';
      if (testId === 'T5') return 'Ratio CA / employe non pertinent en phase pre-clinique. Focus sur les depenses R&D par programme et le runway jusqu au prochain milestone.';
      if (testId === 'T6') return 'Unit economics ne se materialisent qu apres approbation reglementaire. Phase actuelle = depenses R&D, pas de marge unitaire commerciale.';
      break;
    case 'E-b2g-defense':
      if (testId === 'T2') return 'Cycle de vente B2G 12-36 mois sur appels d offres publics. Pas de CAC marketing classique. La vraie metrique est le taux de gain sur appels d offres soumis.';
      break;
    case 'unclassified':
      if (testId === 'T2') return 'Classification economique non tranchee par la matrice. LTV/CAC neutralise plutot que calcule sur des seuils SaaS par defaut. A confirmer en DD apres clarification du modele.';
      if (testId === 'T5') return 'Classification economique non tranchee par la matrice. Seuils CA / employe non determinables sans archetype. A confirmer en DD.';
      if (testId === 'T6') return 'Classification economique non tranchee par la matrice. Lecture unit economics neutralisee. A confirmer en DD apres clarification du modele.';
      break;
    default:
      break;
  }
  return `Test neutralise pour cet archetype.`;
}

// ============================================================
// CALCUL DU SCORE SUR LES TESTS APPLICABLES UNIQUEMENT
// ============================================================

/**
 * Calcule le globalCoherenceScore comme moyenne ponderee des tests
 * APPLICABLES uniquement. Les tests notApplicable=true sont exclus
 * de la moyenne (ni penalises ni bonifies). Sur un dossier SaaS
 * canonique (archetype A) ou tous les tests sont applicables, le
 * resultat est identique au calcul historique du LLM (moyenne
 * ponderee classique).
 *
 * Si aucun test applicable n a de score exploitable (cas degenere),
 * retourne 0 et laisse les consommateurs aval (score-calculator)
 * decider de la neutralisation globale.
 */
export function computeGlobalCoherenceScore(
  tests: Record<string, FinancialCoherenceTest>,
  applicableTests: TestId[],
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const testId of applicableTests) {
    const key = TEST_ID_TO_KEY[testId];
    const test = tests[key];
    if (!test || test.notApplicable) continue;
    const weight = TEST_WEIGHTS[testId];
    weightedSum += test.score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

// Re-export type for convenience
export type { BusinessModel, ProductionChain };
