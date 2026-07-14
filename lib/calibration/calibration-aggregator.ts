import 'server-only';
import {
  listAllPredictionRecords,
  type PredictionRecord,
} from '../prediction-records-store';
import {
  listAnalysisOutcomes,
  marketOutcomeToBinary,
  type AnalysisOutcome,
} from '../analysis-outcomes-store';
import {
  computeCalibrationFromMixed,
  type CalibrationReport,
  type CalibrationInputMaybeResolved,
} from './calibration-metrics';
import {
  applyCorpusSelectionRule,
  type SelectionAudit,
  type SelectionCandidate,
} from './corpus-selection';

/**
 * Agregateur de calibration. Lit les predictions et les outcomes
 * du user, joint par analysis_id, retourne un rapport segmente
 * par version stamp.
 *
 * Conserve seulement le dernier record par analysis_id : si une
 * analyse a ete relancee N fois, c est la prediction la plus
 * recente qui compte (on ne fait pas voter les anciens runs).
 * Le record le plus recent est aussi celui qui porte le version
 * stamp pertinent pour la segmentation.
 */

export interface BuildCalibrationOptions {
  userId: string;
  minResolvedPerSegment?: number;
  bins?: number;
}

export interface CalibrationSummary extends CalibrationReport {
  /** Nombre total de predictions logguees pour ce user. */
  predictionsLogged: number;
  /** Nombre d analyses distinctes ayant au moins une prediction. */
  analysesWithPrediction: number;
  /** Nombre d outcomes saisis (alive + exit + fail + flat). */
  outcomesRecorded: number;
  /**
   * True si toutes les issues resolues (exit / fail) portent le
   * marqueur ILLUSTRATIF pose par scripts/seed-illustrative-outcomes.
   * Sert au CalibrationSummary UI pour afficher un bandeau
   * "demonstration sur jeu illustratif" en tete du rapport, aussi
   * bien en vue web qu en print. Faux si au moins une issue reelle
   * co-existe avec les issues illustratives : dans ce cas le
   * bandeau serait mensonger.
   */
  illustrativeMode: boolean;
  /**
   * Audit de la regle de selection deterministe applique aux
   * outcomes reels (non illustratifs) portant un prediction_record.
   * Le UI et les exports en salle de due diligence rendent ce audit
   * via renderAuditPlain pour prouver l honnetete de la selection.
   */
  selectionAudit: SelectionAudit;
}

// Marqueur canonique. Doit rester strictement identique a
// scripts/seed-illustrative-outcomes.ts. Un ecart de casse ou
// d encodage casserait la detection du mode illustratif sans
// erreur visible.
export const ILLUSTRATIVE_OUTCOME_SOURCE =
  'ILLUSTRATIF — données synthétiques de démonstration, non issues de résolutions marché réelles';

/**
 * Selectionne le record le plus recent par analysis_id. Les records
 * sont supposes deja tries du plus recent au plus ancien (cf
 * listAllPredictionRecords) ; on garde le premier vu pour chaque
 * analysis_id.
 */
function dedupeLatestPerAnalysis(records: PredictionRecord[]): PredictionRecord[] {
  const seen = new Set<string>();
  const out: PredictionRecord[] = [];
  for (const r of records) {
    if (seen.has(r.analysisId)) continue;
    seen.add(r.analysisId);
    out.push(r);
  }
  return out;
}

/**
 * Construit le rapport de calibration pour un user. Charge les
 * predictions et les outcomes en parallele, joint, applique la
 * segmentation par version stamp. Retourne un rapport conforme
 * a CalibrationReport plus un en-tete de comptes utiles a l UI.
 */
export async function buildCalibrationSummary(
  opts: BuildCalibrationOptions,
): Promise<CalibrationSummary> {
  const [records, outcomes] = await Promise.all([
    listAllPredictionRecords({ userId: opts.userId }),
    listAnalysisOutcomes(opts.userId),
  ]);

  const latestByAnalysis = dedupeLatestPerAnalysis(records);
  const outcomeByAnalysis = new Map<string, AnalysisOutcome>();
  for (const o of outcomes) outcomeByAnalysis.set(o.analysisId, o);

  // Applique la regle de selection deterministe. Seuls les
  // outcomes reels (non illustratifs) portant un prediction_record
  // constituent les candidats. Le marqueur illustratif fabrique un
  // discriminant hors regle pour la demo, il est traite a part
  // dans les inputs. Voir doctrine dans corpus-selection.ts.
  const candidates: SelectionCandidate[] = [];
  for (const rec of latestByAnalysis) {
    const outcomeRow = outcomeByAnalysis.get(rec.analysisId);
    if (!outcomeRow) continue;
    if (outcomeRow.source === ILLUSTRATIVE_OUTCOME_SOURCE) continue;
    candidates.push({
      analysisId: rec.analysisId,
      companyName: null,
      marketOutcome: outcomeRow.marketOutcome,
      reliability: outcomeRow.reliability,
    });
  }
  const selectionAudit = applyCorpusSelectionRule(candidates);
  const includedAnalysisIds = new Set(
    selectionAudit.decisions.filter(d => d.included).map(d => d.analysisId),
  );

  // Convertit chaque prediction en input de calibration. La
  // probabilite predite est successProbability/100 (ramene en
  // [0, 1]). Si successProbability est null (pipeline degrade),
  // le record est exclu : on ne peut pas calibrer une prediction
  // qui n a pas de probabilite.
  //
  // Regle de selection appliquee : un outcome reel n alimente le
  // discriminant que si applyCorpusSelectionRule l a inclus. Un
  // outcome exclu (fiabilite moyenne ou manquante) laisse observed
  // a null, la prediction reste en base et visible mais ne compte
  // pas dans le calcul. Les outcomes illustratifs continuent
  // d alimenter le discriminant comme avant (mode demo).
  const inputs: CalibrationInputMaybeResolved[] = [];
  let predictionsConsidered = 0;
  for (const rec of latestByAnalysis) {
    if (rec.successProbability === null || rec.successProbability === undefined) {
      continue;
    }
    predictionsConsidered++;
    const predicted = Math.max(0, Math.min(1, rec.successProbability / 100));
    const outcomeRow = outcomeByAnalysis.get(rec.analysisId);
    let observed: 0 | 1 | null = null;
    if (outcomeRow) {
      if (outcomeRow.source === ILLUSTRATIVE_OUTCOME_SOURCE) {
        observed = marketOutcomeToBinary(outcomeRow.marketOutcome);
      } else if (includedAnalysisIds.has(rec.analysisId)) {
        observed = marketOutcomeToBinary(outcomeRow.marketOutcome);
      }
    }
    inputs.push({
      predicted,
      observed,
      stampFingerprint: {
        commitSha: rec.stampFingerprint.commitSha,
        configsHash: rec.stampFingerprint.configsHash,
        enginesHash: rec.stampFingerprint.enginesHash,
        modelsHash: rec.stampFingerprint.modelsHash,
      },
    });
  }

  const report = computeCalibrationFromMixed(inputs, {
    minResolvedPerSegment: opts.minResolvedPerSegment,
    bins: opts.bins,
  });

  // Detection du mode illustratif. On regarde uniquement les
  // outcomes resolus (exit / fail) puisque ce sont les seuls qui
  // alimentent effectivement la calibration : marquer alive / flat
  // comme illustratif n a pas d effet sur le rapport. Si au moins
  // un outcome resolu est reel (source differente du marqueur), on
  // sort du mode illustratif : le bandeau serait mensonger.
  const resolvedOutcomes = outcomes.filter(o => marketOutcomeToBinary(o.marketOutcome) !== null);
  const illustrativeMode =
    resolvedOutcomes.length > 0
    && resolvedOutcomes.every(o => o.source === ILLUSTRATIVE_OUTCOME_SOURCE);

  return {
    ...report,
    predictionsLogged: predictionsConsidered,
    analysesWithPrediction: latestByAnalysis.length,
    outcomesRecorded: outcomes.length,
    illustrativeMode,
    selectionAudit,
  };
}
