// ============================================================
// PRELUDE - Helpers de rendu trajectoire pour la note d instruction
// ------------------------------------------------------------
// Fonctions pures qui transforment une TrajectoryComparison ou une
// TrajectorySummary en chaines editoriales destinees a l UI. Aucun
// React, aucune dependance Supabase : les composants
// (InvestmentNoteView, HomeClient) consomment ces helpers pour
// produire leurs trois zones d annotation prioritaires :
//   1. en-tete de la section Fragilite Structurelle, ligne sobre
//      "Evolution depuis [date]" plus verdict actuel et precedent
//   2. en marge des cartes pattern, delta score discret type
//      "+12 vs 15 aout 2024" en typo plus petite
//   3. bandeau de top alerte trajectoire si une alerte cran 1 ou 2
//      est presente, formule comme un bandeau gouvernance avec
//      rationale editorial court
//
// Voix Le Grand Continent : prose dense, pas de listes a puces,
// pas d emojis, pas de jargon technique. Les helpers produisent
// des chaines pretes a injecter dans le rendu, l UI ajoute le
// style (typo plus petite, gris ocre, etc.).
// ============================================================

import type {
  TrajectoryComparison,
  TrajectorySummary,
  TrajectoryAlert,
  AlertCran,
} from './engines/trajectory';
import { evaluateTrajectoryAlerts } from './engines/trajectory';
import type { PatternId } from './engines/fragility-structurelle/types';

// ============================================================
// FORMATAGE DE DATES
// ============================================================

/**
 * Formate un timestamp ISO en date courte francaise type
 * "15 aout 2024". Retourne chaine vide pour entrees invalides.
 */
export function formatPreviousDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// ============================================================
// EXTRACTION DE LA COMPARAISON PERTINENTE
// ============================================================

/**
 * Recupere la comparaison la plus pertinente pour la note
 * d instruction : la transition entre la version precedente et
 * la version courante. Retourne null si moins de deux analyses
 * (pas de baseline trajectoire, le composant doit degrader
 * silencieusement). C est l antichambre de toutes les autres
 * fonctions du module.
 */
export function getLastComparison(
  summary: TrajectorySummary | null | undefined,
): TrajectoryComparison | null {
  if (!summary) return null;
  const list = summary.successiveComparisons;
  if (!list || list.length === 0) return null;
  return list[list.length - 1];
}

// ============================================================
// EN-TETE DE LA SECTION FRAGILITE STRUCTURELLE
// ============================================================

/**
 * Construit la ligne d en-tete affichee dans le bandeau verdict
 * de la section Fragilite Structurelle. Trois cas distincts :
 *  - verdict global de fragilite change : on cite la transition
 *  - verdict identique mais score qui a significativement bouge
 *    (>= 10 points en valeur absolue) : on cite le delta numerique
 *  - rien de significatif : on signale la stabilite explicitement
 * Retourne null si aucune comparaison exploitable (pas de
 * baseline ou date precedente illisible).
 */
export function buildTrajectoryHeader(
  comparison: TrajectoryComparison | null,
): string | null {
  if (!comparison) return null;
  const dateStr = formatPreviousDate(comparison.before.analyzedAt);
  if (!dateStr) return null;

  const fragFrom = comparison.before.fragiliteVerdict;
  const fragTo = comparison.after.fragiliteVerdict;

  // Cas 1 : verdict de fragilite globale en transition
  if (fragFrom && fragTo && fragFrom !== fragTo) {
    return `Évolution depuis le ${dateStr} : verdict global de fragilité passé de ${fragFrom} à ${fragTo}.`;
  }

  // Cas 2 : verdict maintenu mais score qui bouge significativement
  if (fragFrom && fragTo && comparison.fragiliteDelta) {
    const dlt = comparison.fragiliteDelta.delta;
    if (Math.abs(dlt) >= 10) {
      const sign = dlt > 0 ? '+' : '';
      return `Évolution depuis le ${dateStr} : verdict global maintenu ${fragTo}, score de fragilité ${sign}${dlt} points.`;
    }
  }

  // Cas 3 : trajectoire stable
  return `Évolution depuis le ${dateStr} : trajectoire stable, verdict global maintenu.`;
}

// ============================================================
// ANNOTATION DELTA POUR UNE CARTE PATTERN
// ============================================================

/**
 * Type discriminé des annotations possibles cote pattern. L UI
 * style chaque type differemment :
 *  - delta : typo plus petite, gris ocre, signe et points lisibles
 *  - newly-applicable : mention contextuelle en italique
 *  - newly-not-applicable : mention contextuelle en italique
 *  - maintained : libelle stable en gris discret
 */
export type PatternAnnotation =
  | { kind: 'delta'; text: string; date: string; direction: 'amelioration' | 'aggravation' | 'stable' }
  | { kind: 'newly-applicable'; text: string }
  | { kind: 'newly-not-applicable'; text: string }
  | { kind: 'maintained'; text: string; date: string };

/**
 * Construit l annotation delta a afficher sous une carte pattern.
 *
 * Cas newly-applicable : le pattern n etait pas applicable au
 * pre-screen precedent, il devient actif. Pas de delta numerique
 * (passer de null a 65 n est pas un delta), juste une mention
 * contextuelle avec le verdict d entree.
 *
 * Cas newly-not-applicable : le pattern etait actif et sort du
 * perimetre. Meme principe, mention contextuelle.
 *
 * Cas delta : le pattern etait applicable dans les deux snapshots,
 * on cite le delta de score avec la date precedente. Le sens
 * (amelioration ou aggravation) reste sous la responsabilite de
 * l UI qui module la couleur.
 *
 * Cas maintained : le pattern etait applicable des deux cotes, le
 * score est reste dans la zone de tolerance. On le signale
 * explicitement pour eviter qu une absence d annotation soit lue
 * comme un trou de donnees.
 *
 * Retourne null si le pattern n existe pas dans la comparaison
 * (cas patterns non applicables des deux cotes).
 */
export function buildPatternDeltaAnnotation(
  comparison: TrajectoryComparison | null,
  patternId: PatternId,
): PatternAnnotation | null {
  if (!comparison) return null;
  const d = comparison.patternsDeltas[patternId];
  if (!d) return null;

  const dateStr = formatPreviousDate(comparison.before.analyzedAt);

  // Transition newly-applicable
  if (d.verdictTransition.type === 'newly-applicable') {
    const to = d.verdictTransition.to;
    return {
      kind: 'newly-applicable',
      text: `Pattern nouvellement actif sur ce dossier, entrée directe en ${to}. Le pré-screen précédent le classait hors-scope.`,
    };
  }

  // Transition newly-not-applicable
  if (d.verdictTransition.type === 'newly-not-applicable') {
    return {
      kind: 'newly-not-applicable',
      text: `Pattern désormais non applicable. Le pré-screen actuel le retire du périmètre alors qu il était actif lors de l analyse précédente.`,
    };
  }

  // Delta numerique : pattern applicable des deux cotes
  if (d.scoreDelta) {
    if (d.scoreDelta.direction === 'stable') {
      return {
        kind: 'maintained',
        text: `Stable vs ${dateStr}`,
        date: dateStr,
      };
    }
    // Pour les patterns de Fragilite Structurelle, un score qui
    // monte signifie davantage de fragilite donc une aggravation
    // du dossier (et non une amelioration). On inverse la
    // semantique du champ `direction` pour que l UI puisse
    // moduler la couleur sans refaire l interpretation a chaque
    // carte. Le ScoreDelta brut reste neutre, c est la couche
    // editoriale qui sait ce qu un score qui monte veut dire.
    const interpretedDirection: 'amelioration' | 'aggravation' =
      d.scoreDelta.direction === 'amelioration' ? 'aggravation' : 'amelioration';
    const sign = d.scoreDelta.delta > 0 ? '+' : '';
    return {
      kind: 'delta',
      text: `${sign}${d.scoreDelta.delta} vs ${dateStr}`,
      date: dateStr,
      direction: interpretedDirection,
    };
  }

  return null;
}

// ============================================================
// BANDEAU DE TOP ALERTE TRAJECTOIRE
// ============================================================

/**
 * Structure du bandeau affiche en haut de note quand au moins
 * une alerte de cran 1 ou 2 est presente. Reprend la grammaire
 * du bandeau gouvernance conflit d interet : raison editoriale
 * en titre, recommandation en corps, citations factuelles en
 * pied pour audit.
 */
export interface TrajectoryBanner {
  cran: AlertCran;
  raison: string;
  recommandation: string;
  citations: string[];
  /** Nombre total d alertes de cran 1 ou 2 sur la trajectoire,
   *  utile a l UI pour signaler "plus une autre alerte critique"
   *  quand plusieurs convergent. */
  additionalCriticalCount: number;
}

/**
 * Construit le bandeau de top alerte trajectoire a partir d une
 * comparaison. Pipeline : evaluateTrajectoryAlerts puis tri par
 * cran croissant, garde l alerte la plus critique. Retourne null
 * si aucune alerte de cran 1 ou 2 n est detectee. Le bandeau ne
 * remonte pas les alertes de cran 3 (digest hebdomadaire) ni de
 * cran 4 (passif UI) parce qu elles ne meritent pas un bandeau
 * intrusif en haut de note.
 */
export function buildTrajectoryBanner(
  comparison: TrajectoryComparison | null,
): TrajectoryBanner | null {
  if (!comparison) return null;
  const alerts = evaluateTrajectoryAlerts(comparison);
  if (alerts.length === 0) return null;
  const critical = alerts.filter((a) => a.cran === 1 || a.cran === 2);
  if (critical.length === 0) return null;
  // Trier par cran croissant : cran 1 prioritaire
  critical.sort((a, b) => a.cran - b.cran);
  const top = critical[0];
  return {
    cran: top.cran,
    raison: top.raison,
    recommandation: top.recommandation,
    citations: top.citations,
    additionalCriticalCount: critical.length - 1,
  };
}

// ============================================================
// UTILITAIRE : RESUME COMPLET POUR LE COMPOSANT
// ============================================================

/**
 * Structure agrege qui prepare tout ce qu un composant UI a
 * besoin pour rendre les trois zones d annotation. Permet a
 * l UI d eviter de gerer null/undefined a chaque accès.
 */
export interface TrajectoryRenderContext {
  hasBaseline: boolean;
  comparison: TrajectoryComparison | null;
  header: string | null;
  banner: TrajectoryBanner | null;
  alerts: TrajectoryAlert[];
}

/**
 * Prepare le contexte de rendu trajectoire complet pour la note
 * d instruction. Si pas de comparaison exploitable, retourne un
 * contexte vide avec hasBaseline=false : le composant degrade
 * silencieusement.
 */
export function buildTrajectoryRenderContext(
  summary: TrajectorySummary | null | undefined,
): TrajectoryRenderContext {
  const comparison = getLastComparison(summary);
  if (!comparison) {
    return {
      hasBaseline: false,
      comparison: null,
      header: null,
      banner: null,
      alerts: [],
    };
  }
  const alerts = evaluateTrajectoryAlerts(comparison);
  return {
    hasBaseline: true,
    comparison,
    header: buildTrajectoryHeader(comparison),
    banner: buildTrajectoryBanner(comparison),
    alerts,
  };
}
