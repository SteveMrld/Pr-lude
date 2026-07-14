// ============================================================
// REFUTATION LAYER, agregateur des trois familles
// ------------------------------------------------------------
// Module pur, aucune I/O. Appelle les trois detecteurs
// (numeric-contradictions, verdict-signal-contradictions,
// label-calculation-contradictions) et retourne une liste
// consolidee de contradictions dans un format editorial commun,
// pret a etre rendu dans le cartouche de la note d instruction.
//
// L agregateur ne pondere pas, ne trie pas par gravite, ne
// modifie aucun score. Il traduit chaque contradiction detectee
// en un triptyque lisible par un investisseur : ce qui est
// affirme, ce qui le contredit, la nature de la tension. Le
// ton reste factuel, jamais alarmiste.
// ============================================================

import { detectNumericContradictions, type NumericContradiction } from './numeric-contradictions';
import {
  detectVerdictSignalContradictions,
  type VerdictSignalContradiction,
} from './verdict-signal-contradictions';
import {
  detectLabelCalculationContradictions,
  type LabelCalculationContradiction,
} from './label-calculation-contradictions';

export type RefutationFamily = 'numeric' | 'verdict-signal' | 'label-calc';

export interface AggregatedRefutation {
  family: RefutationFamily;
  /** Identifiant technique pour deduplication et tracing. */
  ruleId: string;
  /** Enonce court de ce qui est affirme dans le dossier. */
  claim: string;
  /** Enonce court de ce qui contredit l affirmation. */
  contradiction: string;
  /** Nature editoriale de la tension, une phrase. */
  tension: string;
  /** Trace source pour audit (chemins ou champs concernes). */
  source: string;
}

export interface AggregateOptions {
  nowYear?: number;
  refYearOverride?: number;
  asOf?: string | null;
  sourceFilename?: string | null;
}

function normalizeNumeric(c: NumericContradiction): AggregatedRefutation {
  const periodLabel = c.qualifier ? `${c.period}${c.qualifier}` : c.period;
  const unit = c.unit === 'keur' ? 'k€' : c.unit === 'percentage_points' ? 'pts' : '';
  const leftSource = c.left.sourceTag ? `${c.left.location} (${c.left.sourceTag})` : c.left.location;
  const rightSource = c.right.sourceTag ? `${c.right.location} (${c.right.sourceTag})` : c.right.location;
  return {
    family: 'numeric',
    ruleId: `numeric:${c.kind}:${c.metric}:${periodLabel}`,
    claim: `${c.metric} ${periodLabel} : ${c.left.value}${unit} d apres ${leftSource}`,
    contradiction: `Meme grandeur : ${c.right.value}${unit} d apres ${rightSource}`,
    tension: `Deux valeurs divergentes pour la meme grandeur sur la meme periode, ecart ${c.absoluteDelta}${unit}.`,
    source: `refutation.numeric.${c.kind}`,
  };
}

function normalizeVerdictSignal(c: VerdictSignalContradiction): AggregatedRefutation {
  const shortSource = c.verdict.source.split('.').pop() || c.verdict.source;
  const signalsStr = c.signals
    .map(s => {
      if (s.kind === 'long-term-retention') return `retention pluri annuelle documentee (${s.observed})`;
      if (s.kind === 'enterprise-base') return `base grands comptes installee (${s.observed})`;
      if (s.kind === 'company-age') return `anciennete significative (${s.observed})`;
      if (s.kind === 'long-tenure-clients') return `adherence longue des clients (${s.observed})`;
      return s.observed;
    })
    .join(', ');
  return {
    family: 'verdict-signal',
    ruleId: `verdict-signal:${c.ruleId}`,
    claim: `Verdict de reproductibilite ${c.verdict.value} (${shortSource}) : le produit serait facile a repliquer.`,
    contradiction: `Le dossier documente ${c.signals.length} marqueurs de moat non technique : ${signalsStr}.`,
    tension: 'Le code est peut etre reproductible, mais la duree d installation commerciale et la base de grands comptes constituent une barriere non code que le verdict ignore.',
    source: `refutation.verdict-signal.${c.ruleId}`,
  };
}

function normalizeLabelCalc(c: LabelCalculationContradiction): AggregatedRefutation {
  return {
    family: 'label-calc',
    ruleId: `label-calc:${c.indicatorKey}`,
    claim: `${c.indicatorLabel} presente sans qualification temporelle.`,
    contradiction: `Le calcul repose sur ${c.baseYearOfCalculation}, soit ${c.yearsForward} an${c.yearsForward > 1 ? 's' : ''} apres l annee de reference ${c.dossierRefYear} du dossier.`,
    tension: 'Un chiffre projete presente sans etiquette forward peut etre lu comme un resultat realise, ce qui fausse la lecture de la sante economique.',
    source: `refutation.label-calc.${c.indicatorKey}`,
  };
}

/**
 * Agrege les trois familles de refutation. Retourne une liste plate,
 * ordre stable : numeric, puis verdict-signal, puis label-calc.
 */
export function aggregateRefutations(
  resultJson: any,
  opts: AggregateOptions = {},
): AggregatedRefutation[] {
  if (!resultJson || typeof resultJson !== 'object') return [];

  const numeric = detectNumericContradictions(resultJson).map(normalizeNumeric);
  const verdictSignal = detectVerdictSignalContradictions(resultJson, {
    nowYear: opts.nowYear,
  }).map(normalizeVerdictSignal);
  const labelCalc = detectLabelCalculationContradictions(resultJson, {
    nowYear: opts.nowYear,
    refYearOverride: opts.refYearOverride,
    asOf: opts.asOf,
    sourceFilename: opts.sourceFilename,
  }).map(normalizeLabelCalc);

  return [...numeric, ...verdictSignal, ...labelCalc];
}
