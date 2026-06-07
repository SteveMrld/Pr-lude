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
}

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

  // Convertit chaque prediction en input de calibration. La
  // probabilite predite est successProbability/100 (ramene en
  // [0, 1]). Si successProbability est null (pipeline degrade),
  // le record est exclu : on ne peut pas calibrer une prediction
  // qui n a pas de probabilite.
  const inputs: CalibrationInputMaybeResolved[] = [];
  let predictionsConsidered = 0;
  for (const rec of latestByAnalysis) {
    if (rec.successProbability === null || rec.successProbability === undefined) {
      continue;
    }
    predictionsConsidered++;
    const predicted = Math.max(0, Math.min(1, rec.successProbability / 100));
    const outcomeRow = outcomeByAnalysis.get(rec.analysisId);
    const observed = outcomeRow ? marketOutcomeToBinary(outcomeRow.marketOutcome) : null;
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

  return {
    ...report,
    predictionsLogged: predictionsConsidered,
    analysesWithPrediction: latestByAnalysis.length,
    outcomesRecorded: outcomes.length,
  };
}
