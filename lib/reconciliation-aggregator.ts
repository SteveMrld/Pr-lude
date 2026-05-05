import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Decision, MilestoneType, MilestoneImpact, ThesisAlignment } from './reconciliation-store';

/**
 * Bloc E3.3 - Reconciliation prediction vs reality (aggregator)
 * --------------------------------------------------
 * Agrege au niveau dossier ET au niveau portfolio les outcomes realises
 * et les milestones pour produire une vue de reconciliation entre ce
 * que Prelude predisait (dimensionProbabilities, drivers, risques) et
 * ce qui s est reellement passe.
 *
 * Niveau Dossier : pour chaque analyse, on liste les drivers et risques
 * predits par dimension, on liste les milestones realises avec leur
 * thesis_alignment, et on calcule un score de qualite de la prediction
 * sur ce dossier specifique.
 *
 * Niveau Portfolio : sur tous les dossiers du user qui ont un outcome
 * ET au moins un milestone, on agrege par dimension pour identifier
 * les patterns systemiques de prediction du fonds. Seuil active a 30
 * dossiers (en dessous, le signal statistique est trop faible pour
 * etre concluant).
 *
 * Toutes les operations passent par le service-role pour bypasser RLS,
 * mais filtrent toujours par user_id explicitement pour garantir
 * l isolation entre comptes.
 */

export const PORTFOLIO_RECONCILIATION_THRESHOLD = 30;

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// Types
// ============================================================

export interface DimensionPrediction {
  dimensionName: string;
  successProbability: number; // 0-100
  riskScore: number;          // 0-100
  weight: number;             // 0-1
  keyDrivers: string[];
  keyRisks: string[];
}

export interface MilestoneSummary {
  id: string;
  date: string;
  type: MilestoneType;
  title: string;
  description: string | null;
  impact: MilestoneImpact | null;
  thesisAlignment: ThesisAlignment | null;
}

export interface ReconciliationStats {
  totalMilestones: number;
  confirmsDriver: number;
  confirmsRisk: number;
  contradictsDriver: number;
  contradictsRisk: number;
  unforeseenPositive: number;
  unforeseenNegative: number;
  // Net score : (confirms_driver + contradicts_risk) - (contradicts_driver + confirms_risk)
  // Positif = la these s est confirmee. Negatif = la these s est inversee.
  netThesisScore: number;
  // Qualite qualitative de la prediction sur ce dossier
  predictionQuality: 'strong' | 'mixed' | 'weak' | 'insufficient_data';
}

export interface DossierReconciliation {
  analysisId: string;
  companyName: string;
  analyzedAt: string;
  // Decision realisee (null si pas encore decidee)
  decision: Decision | null;
  decisionDate: string | null;
  decisionNotes: string | null;
  // Prediction Prelude
  predictionSummary: {
    successProbability: number;
    failureProbability: number;
    verdict: string; // INVESTIR / APPROFONDIR / REFUSER
    dimensions: DimensionPrediction[];
    decisionDrivers: string[]; // top 3-5
    keyConditions: string[];
  };
  // Realite observee
  realizedMilestones: MilestoneSummary[];
  reconciliationStats: ReconciliationStats;
}

export interface DimensionPortfolioPerformance {
  dimensionName: string;
  // Moyenne des successProbability predites pour cette dimension
  averagePredictedSuccess: number;
  // Pour cette dimension, agregat des thesis alignments
  confirmedDrivers: number;
  confirmedRisks: number;
  contradictedDrivers: number;
  contradictedRisks: number;
  // Net score agrege
  netThesisScore: number;
  // Indice de calibration : a quel point les predictions de cette
  // dimension sont confirmees ou contredites par la realite. Calcule
  // sur les dossiers ou cette dimension a au moins un milestone aligne.
  predictionAccuracy: 'high' | 'medium' | 'low' | 'insufficient_data';
}

export interface PortfolioReconciliation {
  thresholdMet: boolean;
  threshold: number;
  totalDossiersAnalyzed: number;
  totalDossiersWithDecision: number;
  totalDossiersWithReconciliation: number;
  // Distribution decisions
  byDecision: Record<Decision, number>;
  // Aggregat global des thesis alignments sur tous les milestones
  globalAlignmentBreakdown: {
    confirmsDriver: number;
    confirmsRisk: number;
    contradictsDriver: number;
    contradictsRisk: number;
    unforeseenPositive: number;
    unforeseenNegative: number;
    total: number;
  };
  // Performance par dimension
  byDimension: DimensionPortfolioPerformance[];
  // Patterns systemiques detectes (en langage naturel)
  systemicPatterns: string[];
}

// ============================================================
// Helpers
// ============================================================

function classifyPredictionQuality(stats: Omit<ReconciliationStats, 'predictionQuality'>): ReconciliationStats['predictionQuality'] {
  if (stats.totalMilestones < 2) return 'insufficient_data';
  // netThesisScore : positif = these confirmee, negatif = these contredite
  // On normalise par totalMilestones pour avoir un ratio
  const ratio = stats.netThesisScore / stats.totalMilestones;
  if (ratio >= 0.4) return 'strong';
  if (ratio >= 0) return 'mixed';
  return 'weak';
}

function computeReconciliationStats(milestones: MilestoneSummary[]): ReconciliationStats {
  let confirmsDriver = 0;
  let confirmsRisk = 0;
  let contradictsDriver = 0;
  let contradictsRisk = 0;
  let unforeseenPositive = 0;
  let unforeseenNegative = 0;

  for (const m of milestones) {
    switch (m.thesisAlignment) {
      case 'confirms_driver': confirmsDriver++; break;
      case 'confirms_risk': confirmsRisk++; break;
      case 'contradicts_driver': contradictsDriver++; break;
      case 'contradicts_risk': contradictsRisk++; break;
      case 'unforeseen_positive': unforeseenPositive++; break;
      case 'unforeseen_negative': unforeseenNegative++; break;
    }
  }

  // Net these score : la these s est-elle confirmee ?
  // Confirmer un driver positif = +1 (bonne prediction)
  // Contredire un risque (le risque ne s est pas materialise) = +1 (bonne prediction)
  // Contredire un driver (le driver ne s est pas concretise) = -1 (mauvaise prediction)
  // Confirmer un risque (le risque s est materialise) = +1 (bonne prediction du risque !)
  // unforeseen positive = 0 (Prelude n a pas vu venir le succes mais c est un succes)
  // unforeseen negative = -1 (Prelude n a pas vu le risque qui s est materialise)
  const netThesisScore = confirmsDriver + confirmsRisk - contradictsDriver - contradictsRisk + (unforeseenPositive * 0.5) - unforeseenNegative;

  const totalMilestones = milestones.length;
  const base = {
    totalMilestones,
    confirmsDriver,
    confirmsRisk,
    contradictsDriver,
    contradictsRisk,
    unforeseenPositive,
    unforeseenNegative,
    netThesisScore,
  };
  return {
    ...base,
    predictionQuality: classifyPredictionQuality(base),
  };
}

// ============================================================
// Niveau Dossier
// ============================================================

export async function getDossierReconciliation(
  analysisId: string,
  userId: string
): Promise<DossierReconciliation | null> {
  const admin = getAdmin();
  if (!admin) return null;

  // 1. Charger l analyse complete (incluant result_json) en filtrant
  //    explicitement par user_id pour eviter les acces croises.
  const { data: analysis, error: analysisError } = await admin
    .from('analyses')
    .select('id, user_id, company_name, created_at, result_json')
    .eq('id', analysisId)
    .eq('user_id', userId)
    .maybeSingle();

  if (analysisError || !analysis) return null;

  const result = analysis.result_json as any;
  const finalReco = result?.finalRecommendation;
  if (!finalReco) {
    // Pas de finalRecommendation : analyse incomplete ou en erreur,
    // on ne peut pas reconcilier
    return null;
  }

  const dimensions: DimensionPrediction[] = Array.isArray(finalReco.dimensionProbabilities)
    ? finalReco.dimensionProbabilities.map((d: any) => ({
        dimensionName: d.dimensionName || '?',
        successProbability: typeof d.successProbability === 'number' ? d.successProbability : 0,
        riskScore: typeof d.riskScore === 'number' ? d.riskScore : 0,
        weight: typeof d.weight === 'number' ? d.weight : 0,
        keyDrivers: Array.isArray(d.keyDrivers) ? d.keyDrivers : [],
        keyRisks: Array.isArray(d.keyRisks) ? d.keyRisks : [],
      }))
    : [];

  // 2. Charger l outcome
  const { data: outcome } = await admin
    .from('realized_outcomes')
    .select('decision, decision_date, decision_notes')
    .eq('analysis_id', analysisId)
    .eq('user_id', userId)
    .maybeSingle();

  // 3. Charger les milestones
  const { data: milestonesRaw } = await admin
    .from('outcome_milestones')
    .select('id, milestone_date, milestone_type, title, description, impact, thesis_alignment')
    .eq('analysis_id', analysisId)
    .eq('user_id', userId)
    .order('milestone_date', { ascending: true });

  const realizedMilestones: MilestoneSummary[] = (milestonesRaw || []).map((m: any) => ({
    id: m.id,
    date: m.milestone_date,
    type: m.milestone_type as MilestoneType,
    title: m.title,
    description: m.description,
    impact: m.impact as MilestoneImpact | null,
    thesisAlignment: m.thesis_alignment as ThesisAlignment | null,
  }));

  const stats = computeReconciliationStats(realizedMilestones);

  return {
    analysisId: analysis.id,
    companyName: analysis.company_name,
    analyzedAt: analysis.created_at,
    decision: outcome?.decision as Decision | null ?? null,
    decisionDate: outcome?.decision_date ?? null,
    decisionNotes: outcome?.decision_notes ?? null,
    predictionSummary: {
      successProbability: typeof finalReco.successProbability === 'number' ? finalReco.successProbability : 0,
      failureProbability: typeof finalReco.failureProbability === 'number' ? finalReco.failureProbability : 0,
      verdict: finalReco.verdict || finalReco.recommendation || '?',
      dimensions,
      decisionDrivers: Array.isArray(finalReco.decisionDrivers) ? finalReco.decisionDrivers : [],
      keyConditions: Array.isArray(finalReco.keyConditions) ? finalReco.keyConditions : [],
    },
    realizedMilestones,
    reconciliationStats: stats,
  };
}

// ============================================================
// Niveau Portfolio
// ============================================================

function classifyDimensionAccuracy(perf: Omit<DimensionPortfolioPerformance, 'predictionAccuracy'>): DimensionPortfolioPerformance['predictionAccuracy'] {
  const total = perf.confirmedDrivers + perf.confirmedRisks + perf.contradictedDrivers + perf.contradictedRisks;
  if (total < 5) return 'insufficient_data';
  const correctRatio = (perf.confirmedDrivers + perf.confirmedRisks) / total;
  if (correctRatio >= 0.65) return 'high';
  if (correctRatio >= 0.45) return 'medium';
  return 'low';
}

function detectSystemicPatterns(byDimension: DimensionPortfolioPerformance[], totalReconciled: number): string[] {
  const patterns: string[] = [];
  if (totalReconciled < 10) return patterns;

  // Pattern 1 : dimensions ou la prediction sous-performe systematiquement
  const lowAccuracyDims = byDimension.filter((d) => d.predictionAccuracy === 'low');
  if (lowAccuracyDims.length > 0) {
    patterns.push(
      `Sous-performance de prediction observee sur ${lowAccuracyDims.length} dimension${lowAccuracyDims.length > 1 ? 's' : ''} : ${lowAccuracyDims.map((d) => d.dimensionName).join(', ')}. Les drivers ou risques annonces sur ces dimensions ne se confirment pas suffisamment dans la realite portfolio.`
    );
  }

  // Pattern 2 : dimensions ou les risques sont systematiquement sous-evalues
  const underestimatedRiskDims = byDimension.filter((d) => d.contradictedDrivers > d.confirmedDrivers && d.confirmedDrivers + d.contradictedDrivers >= 3);
  if (underestimatedRiskDims.length > 0) {
    patterns.push(
      `Drivers sur-evalues a la prediction sur ${underestimatedRiskDims.length} dimension${underestimatedRiskDims.length > 1 ? 's' : ''} : ${underestimatedRiskDims.map((d) => d.dimensionName).join(', ')}. Les drivers identifies a l instruction sont plus souvent contredits que confirmes par les milestones realises.`
    );
  }

  // Pattern 3 : dimensions ou les risques predits sont rarement confirmes (ie le moteur est trop alarmiste)
  const overcautiousDims = byDimension.filter((d) => d.contradictedRisks > d.confirmedRisks * 2 && d.confirmedRisks + d.contradictedRisks >= 3);
  if (overcautiousDims.length > 0) {
    patterns.push(
      `Risques sur-evalues a la prediction sur ${overcautiousDims.length} dimension${overcautiousDims.length > 1 ? 's' : ''} : ${overcautiousDims.map((d) => d.dimensionName).join(', ')}. Les risques alertes a l instruction sont plus souvent contredits qu il ne se materialisent. Le moteur peut etre calibre comme trop alarmiste sur cet axe.`
    );
  }

  return patterns;
}

export async function getPortfolioReconciliation(userId: string): Promise<PortfolioReconciliation> {
  const admin = getAdmin();
  const empty: PortfolioReconciliation = {
    thresholdMet: false,
    threshold: PORTFOLIO_RECONCILIATION_THRESHOLD,
    totalDossiersAnalyzed: 0,
    totalDossiersWithDecision: 0,
    totalDossiersWithReconciliation: 0,
    byDecision: { invested: 0, passed: 0, declined: 0, waitlisted: 0 },
    globalAlignmentBreakdown: {
      confirmsDriver: 0, confirmsRisk: 0,
      contradictsDriver: 0, contradictsRisk: 0,
      unforeseenPositive: 0, unforeseenNegative: 0,
      total: 0,
    },
    byDimension: [],
    systemicPatterns: [],
  };
  if (!admin) return empty;

  // 1. Compter les dossiers analyses
  const { count: totalAnalyses } = await admin
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  // 2. Charger toutes les analyses avec leur result_json (champ
  //    finalRecommendation.dimensionProbabilities) et leurs outcomes
  const { data: analyses } = await admin
    .from('analyses')
    .select('id, company_name, result_json')
    .eq('user_id', userId);

  // 3. Charger tous les outcomes
  const { data: outcomes } = await admin
    .from('realized_outcomes')
    .select('analysis_id, decision')
    .eq('user_id', userId);

  // 4. Charger tous les milestones avec leur thesis_alignment
  const { data: milestones } = await admin
    .from('outcome_milestones')
    .select('analysis_id, thesis_alignment')
    .eq('user_id', userId);

  // 5. Construire l index outcomes
  const outcomeByAnalysisId = new Map<string, Decision>();
  const byDecision: Record<Decision, number> = { invested: 0, passed: 0, declined: 0, waitlisted: 0 };
  (outcomes || []).forEach((o: any) => {
    if (o.decision in byDecision) {
      outcomeByAnalysisId.set(o.analysis_id, o.decision as Decision);
      byDecision[o.decision as Decision]++;
    }
  });

  // 6. Construire l index milestones par analysis
  const milestonesByAnalysisId = new Map<string, ThesisAlignment[]>();
  const globalAlignment = {
    confirmsDriver: 0, confirmsRisk: 0,
    contradictsDriver: 0, contradictsRisk: 0,
    unforeseenPositive: 0, unforeseenNegative: 0,
    total: 0,
  };
  (milestones || []).forEach((m: any) => {
    const align = m.thesis_alignment as ThesisAlignment | null;
    if (!align) return;
    const arr = milestonesByAnalysisId.get(m.analysis_id) || [];
    arr.push(align);
    milestonesByAnalysisId.set(m.analysis_id, arr);
    globalAlignment.total++;
    switch (align) {
      case 'confirms_driver': globalAlignment.confirmsDriver++; break;
      case 'confirms_risk': globalAlignment.confirmsRisk++; break;
      case 'contradicts_driver': globalAlignment.contradictsDriver++; break;
      case 'contradicts_risk': globalAlignment.contradictsRisk++; break;
      case 'unforeseen_positive': globalAlignment.unforeseenPositive++; break;
      case 'unforeseen_negative': globalAlignment.unforeseenNegative++; break;
    }
  });

  // 7. Identifier les dossiers reconciliables : outcome ET milestones
  const reconciledIds = new Set<string>();
  outcomeByAnalysisId.forEach((_decision, id) => {
    if (milestonesByAnalysisId.has(id)) reconciledIds.add(id);
  });

  // 8. Agreger par dimension : pour chaque dimension du finalRecommendation,
  //    on compte les drivers/risques predits et on les croise avec les
  //    milestones thesis_alignments du meme dossier
  const dimMap = new Map<string, {
    successProbabilities: number[];
    confirmedDrivers: number;
    confirmedRisks: number;
    contradictedDrivers: number;
    contradictedRisks: number;
  }>();

  (analyses || []).forEach((a: any) => {
    const finalReco = a.result_json?.finalRecommendation;
    if (!finalReco?.dimensionProbabilities) return;

    const milestonesForDossier = milestonesByAnalysisId.get(a.id) || [];

    finalReco.dimensionProbabilities.forEach((d: any) => {
      const name = d.dimensionName || '?';
      const cur = dimMap.get(name) || {
        successProbabilities: [],
        confirmedDrivers: 0, confirmedRisks: 0,
        contradictedDrivers: 0, contradictedRisks: 0,
      };
      if (typeof d.successProbability === 'number') {
        cur.successProbabilities.push(d.successProbability);
      }
      // Distribution naive : on attribue les milestones d un dossier
      // proportionnellement a toutes les dimensions du dossier. C est
      // une heuristique : a terme on pourrait tagger chaque milestone
      // a une dimension specifique. Pour l instant on agrege.
      milestonesForDossier.forEach((align) => {
        switch (align) {
          case 'confirms_driver': cur.confirmedDrivers++; break;
          case 'confirms_risk': cur.confirmedRisks++; break;
          case 'contradicts_driver': cur.contradictedDrivers++; break;
          case 'contradicts_risk': cur.contradictedRisks++; break;
        }
      });
      dimMap.set(name, cur);
    });
  });

  const byDimension: DimensionPortfolioPerformance[] = Array.from(dimMap.entries()).map(([name, agg]) => {
    const avgSuccess = agg.successProbabilities.length
      ? agg.successProbabilities.reduce((s, v) => s + v, 0) / agg.successProbabilities.length
      : 0;
    const netScore = agg.confirmedDrivers + agg.confirmedRisks - agg.contradictedDrivers - agg.contradictedRisks;
    const base = {
      dimensionName: name,
      averagePredictedSuccess: Math.round(avgSuccess),
      confirmedDrivers: agg.confirmedDrivers,
      confirmedRisks: agg.confirmedRisks,
      contradictedDrivers: agg.contradictedDrivers,
      contradictedRisks: agg.contradictedRisks,
      netThesisScore: netScore,
    };
    return {
      ...base,
      predictionAccuracy: classifyDimensionAccuracy(base),
    };
  });

  const totalDossiersWithDecision = outcomeByAnalysisId.size;
  const totalDossiersWithReconciliation = reconciledIds.size;
  const thresholdMet = totalDossiersWithReconciliation >= PORTFOLIO_RECONCILIATION_THRESHOLD;

  return {
    thresholdMet,
    threshold: PORTFOLIO_RECONCILIATION_THRESHOLD,
    totalDossiersAnalyzed: totalAnalyses || 0,
    totalDossiersWithDecision,
    totalDossiersWithReconciliation,
    byDecision,
    globalAlignmentBreakdown: globalAlignment,
    byDimension,
    systemicPatterns: detectSystemicPatterns(byDimension, totalDossiersWithReconciliation),
  };
}
