// ============================================================
// SCORE DE TRAJECTOIRE - MODULE D ALERTES HIERARCHISE
// ------------------------------------------------------------
// Classifie les transitions detectees entre deux snapshots du
// meme dossier en quatre crans d alerte, du plus critique au
// plus indicatif. Couche purement logique : produit les payloads
// TrajectoryAlert sans dispatcher sur un canal (mail, UI, digest).
// Les couches downstream (route handler, UI, scheduler) decident
// du routage selon le cran.
//
// La hierarchie suit la fiche conceptuelle validee
// (docs/patterns/score-trajectoire.md) avec l ajustement Steve :
// la transition sain vers attention ou alerte est classee cran 3
// (digest hebdomadaire) et non cran 4 (passif UI), parce que
// cette transition merite un signal actif et non un simple
// changement de couleur dans l interface.
//
// Cran 1 immediat : combinaison drapeau-rouge declenchee,
//   verdict global de fragilite degrade (sain vers alerte ou
//   drapeau-rouge, attention vers drapeau-rouge).
//
// Cran 2 immediat : score global en chute superieure ou egale
//   a 20 points, apparition d un nouveau pattern actif (newly
//   applicable) directement en alerte ou drapeau-rouge.
//
// Cran 3 digest hebdomadaire : pattern existant qui bascule de
//   sain vers attention ou alerte, score global en chute entre
//   10 et 20 points sans cran 1 ou 2 declenche, axe identitaire
//   (axis1) d un pattern actif qui downgrade.
//
// Cran 4 passif UI : variations sub-significatives, deltas de 5
//   points ou moins, transitions intra-niveau sain stable. Ne
//   fire que si aucune autre alerte n a ete declenchee, sinon le
//   signal est porte par les crans superieurs.
// ============================================================

import type {
  TrajectoryComparison,
} from './types';
import type { PatternVerdict } from '../fragility-structurelle/types';

// ============================================================
// TYPES
// ============================================================

/**
 * Niveau d alerte. 1 est le plus critique (notification immediate
 * partner + LP), 4 est le moins critique (passif UI sans
 * notification active).
 */
export type AlertCran = 1 | 2 | 3 | 4;

/**
 * Payload d une alerte de trajectoire. Le tag est l identifiant
 * programmatique pour deduplication et routage, la raison est la
 * formulation editoriale courte exposee au partner, les citations
 * sont les deltas factuels qui justifient l alerte, la
 * recommandation propose un geste partner sans le prescrire.
 */
export interface TrajectoryAlert {
  /** Cran d alerte 1 a 4. */
  cran: AlertCran;
  /** Identifiant programmatique stable pour deduplication. */
  tag: string;
  /** Raison editoriale en une phrase, voix Le Grand Continent. */
  raison: string;
  /** Citations factuelles des deltas concernes. Pour audit. */
  citations: string[];
  /** Recommandation editoriale courte, partner-readable. */
  recommandation: string;
}

// ============================================================
// HELPERS DE CLASSIFICATION
// ============================================================

/**
 * Determine si la transition d un verdict de fragilite globale
 * correspond a un downgrade critique declenchant le cran 1.
 * Cas critiques : sain vers alerte, sain vers drapeau-rouge,
 * attention vers drapeau-rouge. La sortie de la zone saine est
 * traitee aussi gravement que la bascule en drapeau-rouge depuis
 * une zone d attention.
 */
export function isCriticalFragilityDowngrade(
  from: PatternVerdict | null,
  to: PatternVerdict | null,
): boolean {
  if (!from || !to) return false;
  if (from === 'sain' && (to === 'alerte' || to === 'drapeau-rouge')) return true;
  if (from === 'attention' && to === 'drapeau-rouge') return true;
  return false;
}

// ============================================================
// EVALUATEUR PRINCIPAL
// ============================================================

/**
 * Calcule la liste hierarchisee d alertes pour une comparaison
 * de trajectoire. Une comparaison peut produire zero, une, ou
 * plusieurs alertes : chaque transition critique genere son
 * propre payload pour preserver l information factuelle (le
 * partner doit pouvoir auditer chaque signal independamment).
 *
 * Edge cases :
 *  - Si la comparaison ne porte aucune transition significative,
 *    la fonction retourne une alerte unique de cran 4 qui acte
 *    explicitement la stabilite (plutot qu un tableau vide qui
 *    serait ambigu pour l UI).
 *  - Si plusieurs signaux convergent sur le meme cran, ils sont
 *    tous remontes : par exemple une combinaison drapeau-rouge
 *    apparue plus un verdict global degrade donnent deux alertes
 *    de cran 1.
 *  - Si un cran superieur est declenche, le cran 3b (score chute
 *    entre 10 et 20 points) est supprime : son signal est porte
 *    par le cran 1 ou 2 deja remonte.
 */
export function evaluateTrajectoryAlerts(
  comparison: TrajectoryComparison,
): TrajectoryAlert[] {
  const alerts: TrajectoryAlert[] = [];

  // ----------------------------------------------------------
  // CRAN 1 - immediat
  // ----------------------------------------------------------

  // 1a : combinaison drapeau-rouge nouvellement detectee
  for (const comb of comparison.combinaisonsApparues) {
    if (comb.severite === 'drapeau-rouge') {
      alerts.push({
        cran: 1,
        tag: 'combinaison-drapeau-rouge-apparue',
        raison: `Combinaison diagnostique drapeau-rouge nouvellement détectée : ${comb.nom}.`,
        citations: [`combinaison apparue : ${comb.nom} (sévérité drapeau-rouge)`],
        recommandation:
          'À instruire immédiatement avec le partner référent du dossier. Une combinaison drapeau-rouge croise plusieurs patterns de fragilité documentés et ne peut pas apparaître par bruit, sa détection appelle un examen ciblé sans attendre le prochain cycle de revue portfolio.',
      });
    }
  }

  // 1b : verdict global de fragilite en bascule critique
  const fragFrom = comparison.before.fragiliteVerdict;
  const fragTo = comparison.after.fragiliteVerdict;
  if (isCriticalFragilityDowngrade(fragFrom, fragTo)) {
    const citations: string[] = [`verdict global de fragilité : ${fragFrom} -> ${fragTo}`];
    if (comparison.fragiliteDelta) {
      citations.push(
        `score global de fragilité : ${comparison.fragiliteDelta.before} -> ${comparison.fragiliteDelta.after} (${comparison.fragiliteDelta.delta > 0 ? '+' : ''}${comparison.fragiliteDelta.delta} points)`,
      );
    }
    alerts.push({
      cran: 1,
      tag: 'fragilite-globale-downgrade-critique',
      raison: `Verdict global de fragilité dégradé de ${fragFrom} à ${fragTo}.`,
      citations,
      recommandation:
        'Le dossier sort de la zone saine ou bascule en drapeau-rouge sur la lecture globale de fragilité. Examen immédiat requis pour confirmer le diagnostic, identifier les patterns moteurs de la bascule, et décider de la suite (ré-instruction, sortie de portfolio, alerte LP).',
    });
  }

  // ----------------------------------------------------------
  // CRAN 2 - immediat
  // ----------------------------------------------------------

  // 2a : score global en chute >= 20 points
  if (comparison.globalScoreDelta.delta <= -20) {
    alerts.push({
      cran: 2,
      tag: 'score-global-chute-20',
      raison: `Score global en chute de ${Math.abs(comparison.globalScoreDelta.delta)} points sur la période.`,
      citations: [
        `score global : ${comparison.globalScoreDelta.before} -> ${comparison.globalScoreDelta.after} (${comparison.globalScoreDelta.delta} points)`,
      ],
      recommandation:
        'Chute significative du score mécanique sur la période. Identifier la ou les dimensions qui décrochent le plus dans la grille Bloc 1 et croiser avec la lecture qualitative pour distinguer un signal réel d une volatilité ponctuelle de l analyse.',
    });
  }

  // 2b : pattern newly-applicable directement en alerte ou drapeau-rouge
  for (const [patternId, delta] of Object.entries(comparison.patternsDeltas)) {
    if (!delta) continue;
    const t = delta.verdictTransition;
    if (t.type === 'newly-applicable' && (t.to === 'alerte' || t.to === 'drapeau-rouge')) {
      alerts.push({
        cran: 2,
        tag: 'pattern-nouveau-actif-critique',
        raison: `Le pattern ${patternId} s active sur ce dossier directement en ${t.to}.`,
        citations: [`pattern ${patternId} : non-applicable -> ${t.to}`],
        recommandation:
          'Un nouveau pattern de fragilité s active directement en zone critique. Comprendre pourquoi il était hors-scope avant (changement de stade d investissement, pivot de modèle, élargissement du périmètre d activité) et instruire le nouveau diagnostic au même niveau que les patterns historiquement actifs.',
      });
    }
  }

  // ----------------------------------------------------------
  // CRAN 3 - digest hebdomadaire
  // ----------------------------------------------------------

  const hasCriticalAlert = alerts.some((a) => a.cran === 1 || a.cran === 2);

  // 3a : pattern existant qui bascule de sain vers attention ou alerte
  for (const [patternId, delta] of Object.entries(comparison.patternsDeltas)) {
    if (!delta) continue;
    const t = delta.verdictTransition;
    if (t.from === 'sain' && (t.to === 'attention' || t.to === 'alerte')) {
      alerts.push({
        cran: 3,
        tag: 'pattern-sain-vers-non-sain',
        raison: `Le pattern ${patternId} bascule de sain à ${t.to}.`,
        citations: [`pattern ${patternId} : sain -> ${t.to}`],
        recommandation:
          'Un pattern jusque-là sain entre dans la zone d attention. La transition mérite d apparaître dans le digest hebdomadaire avec mention explicite plutôt qu un simple changement de couleur dans l UI, parce qu elle marque un déplacement doctrinal de la lecture du dossier.',
      });
    }
  }

  // 3b : score global en chute >= 10 points sans cran 1 ou 2 declenche
  if (
    !hasCriticalAlert &&
    comparison.globalScoreDelta.delta <= -10 &&
    comparison.globalScoreDelta.delta > -20
  ) {
    alerts.push({
      cran: 3,
      tag: 'score-global-chute-10',
      raison: `Score global en baisse de ${Math.abs(comparison.globalScoreDelta.delta)} points sans bascule critique en parallèle.`,
      citations: [
        `score global : ${comparison.globalScoreDelta.before} -> ${comparison.globalScoreDelta.after} (${comparison.globalScoreDelta.delta} points)`,
      ],
      recommandation:
        'Dégradation modérée du score mécanique sans bascule critique en parallèle. Surveiller la trajectoire sur l analyse suivante et examiner les dimensions qui contribuent le plus à la baisse.',
    });
  }

  // 3c : axe identitaire (axis1) d un pattern actif en downgrade
  for (const [patternId, delta] of Object.entries(comparison.patternsDeltas)) {
    if (!delta || !delta.axesDeltas) continue;
    const t = delta.axesDeltas.axis1.verdictTransition;
    if (t.type === 'downgraded') {
      alerts.push({
        cran: 3,
        tag: 'axe-identitaire-downgrade',
        raison: `Axe identitaire du pattern ${patternId} en dégradation : ${t.from} vers ${t.to}.`,
        citations: [`axe identitaire ${patternId} : ${t.from} -> ${t.to}`],
        recommandation:
          'L axe identitaire est le centre doctrinal du pattern, sa dégradation déplace le diagnostic plus profondément qu une variation périphérique. Drill-down sur le rationale de l axe pour comprendre ce que le moteur a vu différemment depuis l analyse précédente.',
      });
    }
  }

  // ----------------------------------------------------------
  // CRAN 4 - passif UI
  // ----------------------------------------------------------

  // Le cran 4 ne fire que si aucun autre signal n a ete remonte.
  // Une trajectoire stable produit malgre tout une alerte cran 4
  // pour signaler explicitement la stabilite (l UI consomme cette
  // alerte pour afficher le bandeau "rien a signaler").
  if (alerts.length === 0) {
    alerts.push({
      cran: 4,
      tag: 'variation-sub-significative',
      raison: 'Trajectoire stable, variations dans la zone de tolérance.',
      citations: [
        `score global : ${comparison.globalScoreDelta.before} -> ${comparison.globalScoreDelta.after} (${comparison.globalScoreDelta.delta > 0 ? '+' : ''}${comparison.globalScoreDelta.delta} points)`,
        `verdict global : ${comparison.verdictTransition.from} -> ${comparison.verdictTransition.to} (${comparison.verdictTransition.type})`,
      ],
      recommandation:
        'Pas de signal actif requis. La trajectoire reste lisible en couleur dans l UI à l ouverture du dossier sans notification dédiée.',
    });
  }

  return alerts;
}

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * Retourne le cran le plus critique present dans une liste
 * d alertes (la valeur numerique la plus basse, parce que cran 1
 * est le plus critique). Retourne null si la liste est vide.
 * Sert principalement au dispatching downstream : un dossier a
 * traiter immediatement si sa liste d alertes contient au moins
 * un cran 1.
 */
export function getHighestCran(alerts: TrajectoryAlert[]): AlertCran | null {
  if (alerts.length === 0) return null;
  return alerts.reduce<AlertCran>((min, a) => (a.cran < min ? a.cran : min), 4);
}

/**
 * Filtre une liste d alertes par cran. Sert au routage : le canal
 * email recoit les cran 1 et 2 immediatement, le digest
 * hebdomadaire agrege les cran 3, l UI affiche les cran 4 en
 * passif.
 */
export function filterAlertsByCran(
  alerts: TrajectoryAlert[],
  cran: AlertCran,
): TrajectoryAlert[] {
  return alerts.filter((a) => a.cran === cran);
}
