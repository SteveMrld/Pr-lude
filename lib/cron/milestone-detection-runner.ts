// ============================================================
// PRELUDE - Runner detection auto milestones (LLM + web_search)
// ------------------------------------------------------------
// Pour un dossier candidat (decision posee, eligible au scan), va
// chercher sur le web les evenements publics significatifs survenus
// depuis la decision, les classifie dans les 14 types de milestone
// codifies par le schema, propose un alignement these (driver/risque
// confirme ou contredit) et insere chaque evenement detecte comme
// milestone 'proposed' que le partner confirmera ou rejettera.
//
// La logique de dispatch (filtrage candidats, batching, retry) reste
// dans la route cron. Le runner se concentre sur l acte de scan
// individuel pour rester compose et testable de bout en bout en
// integration (avec ANTHROPIC_API_KEY reelle).
//
// Pourquoi proposed et pas confirmed direct :
//   Une hallucination du LLM, ou une homonymie de nom de societe, peut
//   produire un faux milestone. On refuse que ces faux entrent dans
//   l agregation de calibration du fonds. Le partner doit valider.
//   C est le compromis cle : on encaisse la friction au moment de la
//   confirmation pour preserver la propriete miroir de la doctrine.
//
// Dedup :
//   Avant d inserer, on charge les milestones existants du dossier
//   (confirmed et proposed, pas rejected) et on saute toute candidate
//   dont source_url match exactement OU dont le titre normalise
//   chevauche fortement un milestone deja present. Heuristique simple,
//   robuste aux paraphrases.
// ============================================================

import { callClaude } from '@/lib/engines/anthropic-client';
import {
  addMilestone,
  listMilestonesForDedup,
  type Decision,
} from '@/lib/reconciliation-store';
import { getAnalysis } from '@/lib/analysis-store';
import {
  parseDetectedEvents,
  dedupAgainstExisting,
  normalizeForDedup,
} from './milestone-detection-utils';

export interface DetectionContext {
  analysisId: string;
  userId: string;
  companyName: string;
  decision: Decision;
  decisionDate: string;
}

export interface DetectionRunResult {
  analysisId: string;
  status: 'ok' | 'skipped' | 'failed';
  detected: number;
  inserted: number;
  reason?: string;
}

const SYSTEM_PROMPT = `Tu es un détective de marché pour un fonds de venture capital. Pour la société analysée, ta tâche est de chercher sur le web tous les événements publics significatifs survenus depuis la décision du fonds, et de les structurer en milestones exploitables par l'outil de réconciliation prédiction vs réalité.

Voix : sobre, factuelle, en français sans em-dashes. Pas de spéculation, pas de mots émotionnels. Si tu n'es pas sûr, tu ne reportes pas. Mieux vaut zéro faux positif que dix faux.

Types d'événement codifiés (utilise exactement ces strings) :
- fundraise : nouvelle levée de fonds annoncée
- pivot : changement stratégique majeur de modèle ou de marché
- team_change : départ ou arrivée d'un dirigeant clé (founder, CEO, CTO, CFO)
- revenue_update : annonce publique d'un chiffre de revenu ou ARR
- metric_update : annonce d'une métrique clé non revenue (utilisateurs, contrats, GMV)
- churn : perte d'un client majeur reportée publiquement
- partnership : partenariat stratégique majeur signé
- product_launch : lancement d'un produit ou d'une fonctionnalité clé
- regulatory : événement réglementaire (agrément obtenu, sanction, certification)
- legal : litige, procédure judiciaire, dispute IP
- macro_shock : événement macro affectant directement la société (crise sectorielle, sanctions)
- exit : IPO, acquisition, rachat
- fail : dépôt de bilan, dissolution, liquidation
- other : autre événement significatif qui ne rentre dans aucune catégorie

Pour chaque milestone, propose un alignement avec la thèse initiale du fonds :
- confirms_driver : valide un driver positif identifié dans la prédiction
- confirms_risk : valide un risque identifié dans la prédiction (le risque s'est matérialisé)
- contradicts_driver : un driver positif annoncé ne se concrétise pas
- contradicts_risk : un risque annoncé ne se matérialise pas (bonne nouvelle relative)
- unforeseen_positive : événement positif non prévu par la prédiction
- unforeseen_negative : événement négatif non prévu par la prédiction

Si tu ne peux pas déterminer l'alignement avec certitude (manque de contexte sur les drivers/risques originaux), laisse null.

Impact qualitatif : positive, negative, neutral, mixed. Null si tu n'es pas sûr.

Format de sortie : JSON strict, un array d'objets. Aucun texte avant ou après. Aucun bloc markdown. Aucune balise. Schéma :

[
  {
    "date": "YYYY-MM-DD",
    "type": "fundraise",
    "title": "Titre court factuel sous 100 caractères",
    "description": "Description en 1 à 3 phrases en prose dense, sans em-dashes, factuelle",
    "impact": "positive",
    "thesisAlignment": "confirms_driver",
    "sourceUrl": "https://..."
  }
]

Si tu ne trouves aucun événement significatif, renvoie [].

Règles strictes :
1. Tous les milestones doivent avoir une URL source vérifiable.
2. La date doit être la date de l'événement public, pas la date de détection.
3. Pas plus de 5 milestones par scan : sélectionne les plus significatifs.
4. Si l'ambiguïté homonymique est forte (plusieurs sociétés du même nom), renvoie [] et stop.`;

function buildUserPrompt(ctx: DetectionContext, predictionContext: string): string {
  const decisionLabels: Record<Decision, string> = {
    invested: 'investi dans la société',
    passed: 'passé sur le tour (intéressé mais sans suite)',
    declined: 'refusé le dossier',
    waitlisted: "mis en liste d'attente",
  };
  return `Société analysée : ${ctx.companyName}
Décision du fonds : ${decisionLabels[ctx.decision]}, prise le ${ctx.decisionDate}
Aujourd'hui : ${new Date().toISOString().slice(0, 10)}

${predictionContext}

Cherche sur le web tous les événements publics significatifs survenus depuis ${ctx.decisionDate} concernant ${ctx.companyName}. Privilégie les sources de qualité (presse business, communiqués officiels, registres légaux). Si plusieurs sociétés peuvent porter ce nom, vérifie le contexte sectoriel avant de reporter.

Renvoie le JSON.`;
}

/**
 * Construit le contexte de prediction (drivers / risques / verdict) a
 * partir du result_json de l analyse. Reste tolerant aux schemas
 * incomplets : si finalRecommendation manque, on retourne un contexte
 * minimal et le LLM laissera thesisAlignment null.
 */
function buildPredictionContext(resultJson: any): string {
  const fr = resultJson?.finalRecommendation;
  if (!fr) return "Contexte prédiction Prelude indisponible : alignement thèse laissé à null.";

  const parts: string[] = [];
  if (fr.verdict || fr.recommendation) {
    parts.push(`Verdict initial : ${fr.verdict || fr.recommendation}`);
  }
  if (typeof fr.successProbability === 'number') {
    parts.push(`Probabilité de succès prédite : ${Math.round(fr.successProbability)}%`);
  }
  if (Array.isArray(fr.decisionDrivers) && fr.decisionDrivers.length > 0) {
    parts.push(`Drivers identifiés à l'instruction :\n- ${fr.decisionDrivers.slice(0, 5).join('\n- ')}`);
  }
  if (Array.isArray(fr.keyConditions) && fr.keyConditions.length > 0) {
    parts.push(`Conditions clés :\n- ${fr.keyConditions.slice(0, 5).join('\n- ')}`);
  }
  if (Array.isArray(fr.dimensionProbabilities) && fr.dimensionProbabilities.length > 0) {
    const risks: string[] = [];
    for (const d of fr.dimensionProbabilities) {
      if (Array.isArray(d.keyRisks)) {
        for (const r of d.keyRisks.slice(0, 2)) risks.push(`${d.dimensionName} : ${r}`);
      }
    }
    if (risks.length > 0) {
      parts.push(`Risques identifiés à l'instruction :\n- ${risks.slice(0, 8).join('\n- ')}`);
    }
  }
  return parts.join('\n\n');
}

/**
 * Execute la detection auto pour un dossier candidat. Retourne le
 * compte d evenements detectes par le LLM et inseres en base, plus
 * un statut explicite pour le log cron.
 *
 * En l absence d ANTHROPIC_API_KEY, ou si web_search n est pas active
 * (ENABLE_WEB_SEARCH=true), renvoie skipped avec une raison lisible.
 */
export async function runMilestoneDetection(ctx: DetectionContext): Promise<DetectionRunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      analysisId: ctx.analysisId, status: 'skipped', detected: 0, inserted: 0,
      reason: 'anthropic-key-missing',
    };
  }
  if (process.env.ENABLE_WEB_SEARCH !== 'true') {
    return {
      analysisId: ctx.analysisId, status: 'skipped', detected: 0, inserted: 0,
      reason: 'web-search-disabled',
    };
  }

  const analysis = await getAnalysis(ctx.analysisId);
  if (!analysis) {
    return {
      analysisId: ctx.analysisId, status: 'failed', detected: 0, inserted: 0,
      reason: 'analysis-not-found',
    };
  }

  const predictionContext = buildPredictionContext(analysis.resultJson);
  let raw: string;
  try {
    raw = await callClaude(
      SYSTEM_PROMPT,
      buildUserPrompt(ctx, predictionContext),
      3000,
      undefined,
      { enableWebSearch: true, maxWebSearches: 5 },
    );
  } catch (err: any) {
    return {
      analysisId: ctx.analysisId, status: 'failed', detected: 0, inserted: 0,
      reason: `llm-error: ${err?.message || err}`,
    };
  }

  const detected = parseDetectedEvents(raw);
  if (detected.length === 0) {
    return { analysisId: ctx.analysisId, status: 'ok', detected: 0, inserted: 0 };
  }

  const existing = await listMilestonesForDedup(ctx.analysisId);
  const candidates = dedupAgainstExisting(detected, existing);

  let inserted = 0;
  for (const ev of candidates) {
    const created = await addMilestone({
      analysisId: ctx.analysisId,
      userId: ctx.userId,
      milestoneDate: ev.date,
      milestoneType: ev.type,
      title: ev.title,
      description: ev.description || null,
      impact: ev.impact,
      thesisAlignment: ev.thesisAlignment,
      sourceUrl: ev.sourceUrl,
      sourceType: 'auto_web',
      sourceKind: 'auto_detected',
      detectionStatus: 'proposed',
    });
    if (created) inserted++;
  }

  return {
    analysisId: ctx.analysisId,
    status: 'ok',
    detected: detected.length,
    inserted,
  };
}

// Re-export des helpers purs pour faciliter l import depuis le code
// applicatif. Les tests deterministes utilisent directement le module
// milestone-detection-utils pour eviter de tirer server-only.
export { parseDetectedEvents, dedupAgainstExisting, normalizeForDedup };
