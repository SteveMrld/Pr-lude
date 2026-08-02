// ============================================================
// CAUSE DE NON-PRODUCTION
// ------------------------------------------------------------
// Un moteur qui ne produit pas doit dire pourquoi, et le dire dans
// une structure que personne n ait a interpreter.
//
// Le defaut ferme est un patron, pas un site. Deux occurrences
// etablies sur deux moteurs sans rapport, en trois briefs : le statut
// de moteur ou empty_output et skipped_not_applicable partageaient un
// canal, ferme au brief 21, et le motif de non-application des
// multiples sectoriels ou une neutralisation doctrinale et une plage
// inaccessible sortent par la meme phrase. Le recensement du brief 24
// en a trouve six au total. A chaque fois, un etat qui signifie
// « nous avons choisi de ne pas produire » et un etat qui signifie
// « nous n avons pas su produire » sortent par le meme canal, et le
// canal est lu comme le premier. Une panne se presente au lecteur
// comme une doctrine, donc elle ne remonte jamais, donc elle dure.
//
// Le champ ci-dessous repond a une seule question : pourquoi cette
// chose n a pas ete produite. Trois valeurs, exhaustives et
// exclusives.
//
//   doctrine : la matrice de pertinence, une regle du moteur ou une
//              calibration a decide que ce n etait pas applicable.
//              C est un resultat, pas un manque.
//   incident : quelque chose a echoue. Appel LLM, acces base, reseau,
//              defaut de lecture interne. Il y a quelque chose a
//              reparer, et le fait doit remonter.
//   absence  : la donnee n existe pas et personne n a echoue. Le deck
//              ne la porte pas, la source n en a pas, l exercice n est
//              pas documente.
//
// Deux regles sont inseparables de la forme et ne se negocient pas.
//
// 1. Le champ est obligatoire partout ou une non-production est
//    declaree, et il est porte par le type et non ajoute site par
//    site. Un champ optionnel serait rempli aux endroits qu on a en
//    tete le jour ou on l ecrit, et le patron reapparaitrait au
//    premier moteur ajoute ensuite.
//
// 2. Aucun consommateur en aval ne lit le message pour decider. La
//    prose reste et explique, le champ tranche. Lire la prose pour
//    decider est exactement ce que le brief 22 a condamne au
//    cartouche de la note, ou un detecteur reconstruisait par regex
//    une information que le calcul declarait deja.
// ============================================================

export type NonProductionCause = 'doctrine' | 'incident' | 'absence';

/**
 * Valeur portee par les sorties qui declarent une non-production.
 * `null` signifie que la chose a bien ete produite : le champ reste
 * present pour que le type oblige a se prononcer, dans un sens ou
 * dans l autre.
 */
export type NonProductionCauseOrNull = NonProductionCause | null;

/** Libelles courts, pour un rendu compact en dashboard. */
export const NON_PRODUCTION_LABELS: Record<NonProductionCause, string> = {
  doctrine: 'non applicable par doctrine',
  incident: 'incident technique',
  absence: 'donnee absente',
};

/**
 * True quand la cause designe quelque chose a reparer. Les
 * consommateurs qui veulent alerter n ont ainsi pas a enumerer les
 * valeurs, et l ajout d une quatrieme cause ne leur echapperait pas.
 */
export function isIncident(cause: NonProductionCauseOrNull): boolean {
  return cause === 'incident';
}

/**
 * True quand la non-production est un resultat et non un manque.
 * Sert aux rendus qui veulent taire les non-applicabilites
 * doctrinales sans taire les pannes.
 */
export function isDoctrinal(cause: NonProductionCauseOrNull): boolean {
  return cause === 'doctrine';
}
