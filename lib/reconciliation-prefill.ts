// ============================================================
// PRELUDE - Pre-fill d outcome a partir d une transition Kanban
// ------------------------------------------------------------
// Fonctions pures qui derivent un brouillon d outcome (decision +
// conditions d entree) a partir d un stage Kanban et du result_json
// de l analyse. Pas de dependance Supabase ni LLM : testables en
// standalone.
//
// L objectif est de capturer la decision la ou le partner est deja
// (le dropdown Kanban) sans lui demander une saisie de plus. Le
// resultat est un brouillon avec source='kanban_auto' que la UI
// signale en banniere "decision deduite, precisez les conditions".
// Si la decision est deja saisie pour le dossier, on ne touche a
// rien (le manuel l emporte toujours).
// ============================================================

import type {
  Decision,
  RealizedOutcomeInput,
} from './reconciliation-store';

/**
 * Mapping deterministe stage Kanban -> decision realisee :
 *   signed   -> invested (tour ferme, capital deploye)
 *   declined -> passed (interesse sans suite OU refus, on garde la
 *               sous-classification floue : le partner distinguera
 *               passed/declined dans le formulaire si besoin. Par
 *               defaut on remplit 'passed' parce que la majorite
 *               des declined Kanban sont des "interesses mais non
 *               retenus" plutot que des refus categoriels)
 * Aucun autre stage ne declenche d auto-create : 'deposited',
 * 'in_review', 'dd_field', 'ic_review' sont des stages intermediaires.
 */
export function deriveDecisionFromStage(stage: string): Decision | null {
  if (stage === 'signed') return 'invested';
  if (stage === 'declined') return 'passed';
  return null;
}

/**
 * Parse une chaine libre representant un montant en EUR vers un
 * nombre. Tolerant aux formats francais et anglais : "5M EUR",
 * "12 millions €", "$10M", "500k", "1.5 milliard". Retourne null
 * en cas d ambiguite (nombre nu < 100k EUR, pas d unite ni de
 * separateur de milliers).
 *
 * Heuristique : on extrait le premier nombre, on regarde si une
 * unite (k, m, b, millions, milliards) suit dans une fenetre courte.
 * Si pas d unite et nombre >= 100k, on suppose deja en EUR brut.
 */
export function parseEurAmount(s: string | null | undefined): number | null {
  if (!s || typeof s !== 'string') return null;
  const cleaned = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ');
  // Match nombre + unite optionnelle immediatement apres ou separee d un espace
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(milliards?|millions?|m\b|b\b|k\b)?/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = match[2] || '';
  if (/^milliards?$|^b$/.test(unit)) return Math.round(n * 1_000_000_000);
  if (/^millions?$|^m$/.test(unit)) return Math.round(n * 1_000_000);
  if (/^k$/.test(unit)) return Math.round(n * 1_000);
  // Pas d unite : seulement si le nombre est suffisamment gros pour
  // etre plausiblement un montant en EUR brut (au moins 100k).
  if (n >= 100_000) return Math.round(n);
  return null;
}

/**
 * Detecte pre-money / post-money dans une chaine libre. Retourne
 * null si non trouve (le partner precisera au formulaire).
 */
export function parseValuationBasis(s: string | null | undefined): 'pre_money' | 'post_money' | null {
  if (!s || typeof s !== 'string') return null;
  const low = s.toLowerCase();
  if (/\bpost[-\s]?money\b|postmoney/.test(low)) return 'post_money';
  if (/\bpre[-\s]?money\b|premoney/.test(low)) return 'pre_money';
  return null;
}

/**
 * Mapping stage techno -> label humain pour entry_round_type.
 * Renvoie une string lisible par un partner, qui sert de proposition
 * dans le formulaire (le partner peut la modifier).
 */
export function humanizeRoundType(stage: string | null | undefined): string | null {
  if (!stage || typeof stage !== 'string') return null;
  const map: Record<string, string> = {
    'pre-seed': 'Pre-Seed',
    'seed': 'Seed',
    'series-A-early': 'Series A',
    'series-A-late': 'Series A',
    'series-B': 'Series B',
    'series-C': 'Series C',
    'series-D': 'Series D',
    'growth': 'Growth',
    'pre-IPO': 'Pre-IPO',
  };
  if (map[stage]) return map[stage];
  // Stage inconnu : on retourne tel quel apres trim, le partner
  // ajustera. Pas de fail-by-default sur un futur stage non mappe.
  const trimmed = stage.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Construit le payload upsertOutcome a partir d un stage Kanban
 * terminal et du result_json de l analyse. Retourne null si le
 * stage ne declenche pas d auto-create (intermediaire) ou si le
 * mapping echoue.
 *
 * Le payload est volontairement minimal : on remplit ce qu on peut
 * extraire avec confiance (round type, montant, valo si parseables)
 * et on laisse le reste a null. Le partner complete ou corrige.
 */
export function buildKanbanOutcomePrefill(
  analysisId: string,
  userId: string,
  stage: string,
  resultJson: any,
): RealizedOutcomeInput | null {
  const decision = deriveDecisionFromStage(stage);
  if (!decision) return null;

  const fundraise = resultJson?.extraction?.fundraise || {};
  const stageStr = typeof fundraise.stage === 'string' ? fundraise.stage : null;
  const amountStr = typeof fundraise.amount === 'string' ? fundraise.amount : null;
  const valuationStr = typeof fundraise.valuation === 'string' ? fundraise.valuation : null;

  const entryRoundType = humanizeRoundType(stageStr);
  const entryRoundSizeEur = parseEurAmount(amountStr);
  const entryValuationEur = parseEurAmount(valuationStr);
  const entryValuationBasis = parseValuationBasis(valuationStr);

  return {
    analysisId,
    userId,
    decision,
    source: 'kanban_auto',
    entryRoundType,
    entryRoundSizeEur,
    entryValuationEur,
    entryValuationBasis,
    // Les autres champs (ticket, ownership, lead, co-investors) ne
    // sont pas extractibles depuis le dossier : ils proviennent de
    // la negotiation post-decision. Laisses a null.
  };
}
