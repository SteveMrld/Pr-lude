// ============================================================
// SLACK-DISPATCH
// ------------------------------------------------------------
// Helper partage pour declencher les notifications Slack apres
// persistance d une analyse. Extrait de app/api/analyses/route.ts
// pour pouvoir aussi etre appele depuis app/api/analyze/route.ts
// (persistence cote serveur).
//
// Toutes les notifications sont fire-and-forget : les erreurs sont
// loggees mais ne remontent jamais au client. Si l org n a pas de
// config Slack, no-op silencieux.
// ============================================================

import { notifyAnalysisComplete, notifyCriticalAlert } from './slack-store';
import { computeTopRisks } from './compute-top-risks';

export interface SlackDispatchInput {
  organizationId: string;
  analysisId: string;
  result: any;
  baseUrl: string;
}

/**
 * Declenche les notifications Slack pour une analyse fraichement
 * persistee. Envoie d abord la notification standard, puis une
 * alerte critique si le verdict est refuser ou le score de
 * vigilance critique est eleve.
 *
 * Les erreurs sont swallowed : Slack ne doit jamais bloquer le
 * pipeline ni la persistance. Si la config Slack n est pas
 * presente pour l org, no-op silencieux.
 */
export async function dispatchSlackNotifications(
  params: SlackDispatchInput,
): Promise<void> {
  try {
    const ext = params.result?.extraction || {};
    const reco = params.result?.finalRecommendation || {};
    const blindspot = params.result?.blindspotAnalysis || {};
    const topRisks = computeTopRisks(params.result, 3);

    const verdict = reco.verdict || 'approfondir';
    const globalScore = reco.computedScoreBreakdown?.finalComputedScore
      ?? reco.globalScore
      ?? null;

    // Notification standard : tous les dossiers
    await notifyAnalysisComplete({
      organizationId: params.organizationId,
      analysisId: params.analysisId,
      companyName: ext.companyName || 'Sans nom',
      sector: ext.sector || null,
      country: ext.country || null,
      verdict,
      globalScore: typeof globalScore === 'number' ? globalScore : null,
      successProbability: typeof reco.successProbability === 'number' ? reco.successProbability : null,
      failureProbability: typeof reco.failureProbability === 'number' ? reco.failureProbability : null,
      decisionDrivers: Array.isArray(reco.decisionDrivers) ? reco.decisionDrivers : [],
      topRisks,
      baseUrl: params.baseUrl,
    });

    // Alerte critique : verdict refuser ou score blindspot tres eleve.
    // Notification distincte pour permettre a l org de configurer
    // un canal Slack dedie aux alertes (ex : #ic-alerts) plutot
    // que de tout pousser dans un canal general.
    const blindspotScore = typeof blindspot.globalBlindspotScore === 'number'
      ? blindspot.globalBlindspotScore
      : 0;
    let alertReason: string | null = null;
    if (verdict === 'refuser') {
      alertReason = `Verdict d instruction *Refuser* avec un score global de ${globalScore ?? '—'}/100. Cette decision merite une revue collegiale rapide.`;
    } else if (blindspotScore >= 75) {
      alertReason = `Score de vigilance critique tres eleve (${blindspotScore}/100). Le dossier presente plusieurs patterns à risque intenses qui justifient une attention particuliere.`;
    }

    if (alertReason) {
      await notifyCriticalAlert({
        organizationId: params.organizationId,
        analysisId: params.analysisId,
        companyName: ext.companyName || 'Sans nom',
        verdict,
        reason: alertReason,
        baseUrl: params.baseUrl,
      });
    }
  } catch (err) {
    console.warn('[slack-dispatch] error :', err);
  }
}
