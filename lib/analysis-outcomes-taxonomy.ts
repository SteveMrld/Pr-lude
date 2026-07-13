// ============================================================
// TAXONOMIE D ISSUES DE MARCHE
// ------------------------------------------------------------
// Module pur (aucun I/O, aucun import server-only). Source de
// verite unique pour le type MarketOutcome, la liste des valeurs
// autorisees et le mapping vers le binaire de calibration.
//
// Historique. La taxonomie initiale ne distinguait que quatre
// etats (alive, exit, fail, flat). Le seul positif resolu etait
// exit (IPO/M&A). Une entreprise "vivante et en croissance
// plusieurs annees apres instruction" n avait pas d etat propre
// et forcait a choisir entre 'alive' (non resolu, ne compte pas)
// ou 'exit' (faux positif, complaisance). L enrichissement
// introduit alive_thriving pour capturer ce positif nuance.
//
// Taxonomie courante :
//   exit            positif fort, resolu, observed=1 (IPO / M&A)
//   alive_thriving  positif nuance, resolu, observed=1
//                   (societe active et en croissance saine
//                   plusieurs annees apres instruction, sans
//                   evenement de sortie)
//   fail            negatif, resolu, observed=0
//                   (depot de bilan, dissolution, shutdown)
//   alive_flat      neutre, non resolu, observed=null
//                   (societe active mais atone, sans croissance
//                   ni echec, exclue du discriminant)
//
// Etats legacy conserves pour retrocompatibilite :
//   alive  -> mappe null (traite comme alive_flat par prudence,
//             car l ambiguite d origine ne permet pas d affirmer
//             thriving)
//   flat   -> mappe null (equivalent semantique de alive_flat,
//             prefere alive_flat pour les nouvelles saisies)
//
// Cette taxonomie est verrouillee cote base par un CHECK sur
// analysis_outcomes.market_outcome ; les six valeurs listees ci
// dessous doivent rester alignees avec la migration SQL.
// ============================================================

export type MarketOutcome =
  | 'exit'
  | 'alive_thriving'
  | 'fail'
  | 'alive_flat'
  | 'alive'   // legacy
  | 'flat';   // legacy

export const MARKET_OUTCOME_VALUES: MarketOutcome[] = [
  'exit',
  'alive_thriving',
  'fail',
  'alive_flat',
  'alive',
  'flat',
];

// ============================================================
// Mapping issue -> binaire succes/echec pour la calibration
// ------------------------------------------------------------
// Contrat : les etats resolus (exit, alive_thriving, fail)
// alimentent le calcul discriminant. Les etats non resolus
// (alive_flat + legacy alive, flat) sont exclus.
// ============================================================

export function marketOutcomeToBinary(outcome: MarketOutcome): 0 | 1 | null {
  if (outcome === 'exit') return 1;
  if (outcome === 'alive_thriving') return 1;
  if (outcome === 'fail') return 0;
  // alive_flat + legacy alive, flat : non resolus
  return null;
}

export function isResolvedOutcome(outcome: MarketOutcome): boolean {
  return marketOutcomeToBinary(outcome) !== null;
}

// Sous-ensembles semantiques utiles a l UI et aux scripts.
export const RESOLVED_POSITIVE_OUTCOMES: MarketOutcome[] = ['exit', 'alive_thriving'];
export const RESOLVED_NEGATIVE_OUTCOMES: MarketOutcome[] = ['fail'];
export const UNRESOLVED_OUTCOMES: MarketOutcome[] = ['alive_flat', 'alive', 'flat'];
