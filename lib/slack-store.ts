// ============================================================
// SLACK STORE
// ------------------------------------------------------------
// Configuration Slack par organisation : webhook URL, channel,
// seuils d alertes, mention du partner principal. Plus une fonction
// notifier qui poste reellement les messages avec Block Kit.
//
// Un seul webhook par org pour l instant (suffit a la plupart des
// fonds qui ont un channel d instruction unique). Multi-channel
// envisageable plus tard si besoin (par geographie, par stage).
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { isPersistenceEnabled } from '@/lib/analysis-store';

// ============================================================
// TYPES
// ============================================================

export interface SlackConfig {
  organizationId: string;
  webhookUrl: string;
  channelName: string | null;
  defaultPartnerMention: string | null;
  alertThresholdScore: number;
  notifyOnCriticalVerdict: boolean;
  notifyOnHighBlindspot: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
}

export interface SlackConfigPublic {
  // Vue cote UI : on masque le webhook complet (preview seulement)
  // pour eviter d exposer le secret a chaque chargement de page.
  organizationId: string;
  webhookUrlMasked: string;
  channelName: string | null;
  defaultPartnerMention: string | null;
  alertThresholdScore: number;
  notifyOnCriticalVerdict: boolean;
  notifyOnHighBlindspot: boolean;
  enabled: boolean;
  hasWebhook: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
}

function maskWebhook(url: string): string {
  if (!url) return '';
  // Masque le token, garde le pattern reconnaissable
  // https://hooks.slack.com/services/T0XXX/B0YYY/abc123def456
  // -> https://hooks.slack.com/services/T0XXX/B0YYY/****
  const m = url.match(/^(https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+)\/(.+)$/);
  if (m) return `${m[1]}/****`;
  return url.slice(0, 28) + '****';
}

// ============================================================
// CRUD CONFIG
// ============================================================

export async function getSlackConfig(organizationId: string): Promise<SlackConfig | null> {
  if (!isPersistenceEnabled()) return null;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('organization_slack_config')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    organizationId: data.organization_id,
    webhookUrl: data.webhook_url,
    channelName: data.channel_name,
    defaultPartnerMention: data.default_partner_mention,
    alertThresholdScore: data.alert_threshold_score,
    notifyOnCriticalVerdict: data.notify_on_critical_verdict,
    notifyOnHighBlindspot: data.notify_on_high_blindspot,
    enabled: data.enabled,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastTestAt: data.last_test_at,
    lastTestOk: data.last_test_ok,
  };
}

export async function getSlackConfigPublic(organizationId: string): Promise<SlackConfigPublic | null> {
  const cfg = await getSlackConfig(organizationId);
  if (!cfg) return null;
  return {
    organizationId: cfg.organizationId,
    webhookUrlMasked: maskWebhook(cfg.webhookUrl),
    channelName: cfg.channelName,
    defaultPartnerMention: cfg.defaultPartnerMention,
    alertThresholdScore: cfg.alertThresholdScore,
    notifyOnCriticalVerdict: cfg.notifyOnCriticalVerdict,
    notifyOnHighBlindspot: cfg.notifyOnHighBlindspot,
    enabled: cfg.enabled,
    hasWebhook: !!cfg.webhookUrl,
    lastTestAt: cfg.lastTestAt,
    lastTestOk: cfg.lastTestOk,
  };
}

export async function upsertSlackConfig(params: {
  organizationId: string;
  webhookUrl: string;
  channelName?: string | null;
  defaultPartnerMention?: string | null;
  alertThresholdScore?: number;
  notifyOnCriticalVerdict?: boolean;
  notifyOnHighBlindspot?: boolean;
  enabled?: boolean;
  createdBy?: string | null;
}): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  // Validation basique du format webhook Slack
  if (!params.webhookUrl?.startsWith('https://hooks.slack.com/services/')) {
    return false;
  }
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('organization_slack_config')
    .upsert({
      organization_id: params.organizationId,
      webhook_url: params.webhookUrl,
      channel_name: params.channelName ?? null,
      default_partner_mention: params.defaultPartnerMention ?? null,
      alert_threshold_score: params.alertThresholdScore ?? 50,
      notify_on_critical_verdict: params.notifyOnCriticalVerdict ?? true,
      notify_on_high_blindspot: params.notifyOnHighBlindspot ?? true,
      enabled: params.enabled ?? true,
      created_by: params.createdBy ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' });
  if (error) {
    console.error('[slack-store] upsertSlackConfig erreur:', error);
    return false;
  }
  return true;
}

export async function deleteSlackConfig(organizationId: string): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('organization_slack_config')
    .delete()
    .eq('organization_id', organizationId);
  if (error) {
    console.error('[slack-store] deleteSlackConfig erreur:', error);
    return false;
  }
  return true;
}

// ============================================================
// LOG
// ============================================================

async function logNotification(params: {
  organizationId: string;
  analysisId?: string | null;
  notificationType: string;
  status: 'sent' | 'failed' | 'skipped';
  httpStatus?: number;
  errorMessage?: string;
  payloadSummary?: any;
}): Promise<void> {
  if (!isPersistenceEnabled()) return;
  try {
    const admin = getSupabaseAdminClient();
    await admin.from('slack_notifications_log').insert({
      organization_id: params.organizationId,
      analysis_id: params.analysisId ?? null,
      notification_type: params.notificationType,
      status: params.status,
      http_status: params.httpStatus ?? null,
      error_message: params.errorMessage ?? null,
      payload_summary: params.payloadSummary ?? null,
    });
  } catch {
    // Le log ne doit jamais bloquer
  }
}

// ============================================================
// FORMATTERS
// ============================================================

const VERDICT_EMOJI: Record<string, string> = {
  'investir': '🟢',
  'investir avec conditions': '🟡',
  'approfondir': '🟠',
  'refuser': '🔴',
};

const VERDICT_LABEL: Record<string, string> = {
  'investir': 'Investir',
  'investir avec conditions': 'Investir avec conditions',
  'approfondir': 'Approfondir',
  'refuser': 'Refuser',
};

function buildAnalysisCompleteBlocks(params: {
  companyName: string;
  sector: string | null;
  country: string | null;
  verdict: string;
  globalScore: number | null;
  successProbability: number | null;
  failureProbability: number | null;
  decisionDrivers: string[];
  topRisks: Array<{ label: string; intensity: number }>;
  analysisUrl: string;
  partnerMention: string | null;
}): any[] {
  const verdictEmoji = VERDICT_EMOJI[params.verdict] || '⚪';
  const verdictLabel = VERDICT_LABEL[params.verdict] || params.verdict;
  const sectorLine = [params.sector, params.country].filter(Boolean).join(' · ');

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${verdictEmoji} ${params.companyName}`,
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*${verdictLabel}*${sectorLine ? ` · ${sectorLine}` : ''}`,
        },
      ],
    },
  ];

  // Section probabilites
  const probParts: string[] = [];
  if (params.globalScore !== null) probParts.push(`*Score* ${params.globalScore}/100`);
  if (params.successProbability !== null) probParts.push(`*Succes* ${params.successProbability}%`);
  if (params.failureProbability !== null) probParts.push(`*Echec* ${params.failureProbability}%`);
  if (probParts.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: probParts.join(' · ') },
    });
  }

  // Drivers
  if (params.decisionDrivers.length > 0) {
    const driversText = params.decisionDrivers
      .slice(0, 3)
      .map((d, i) => `${i + 1}. ${d}`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Facteurs decisifs*\n${driversText}` },
    });
  }

  // Risques
  if (params.topRisks.length > 0) {
    const risksText = params.topRisks
      .slice(0, 3)
      .map((r) => `• ${r.label} _(intensite ${r.intensity})_`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Risques critiques*\n${risksText}` },
    });
  }

  // CTA
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Ouvrir dans Prelude', emoji: true },
        url: params.analysisUrl,
        style: 'primary',
      },
    ],
  });

  // Mention partner si configure
  if (params.partnerMention) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `${params.partnerMention} pour validation` },
      ],
    });
  }

  return blocks;
}

function buildCriticalAlertBlocks(params: {
  companyName: string;
  verdict: string;
  reason: string;
  analysisUrl: string;
  partnerMention: string | null;
}): any[] {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚨 Alerte critique · ${params.companyName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: params.reason },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Voir l analyse', emoji: true },
          url: params.analysisUrl,
        },
      ],
    },
  ];
  if (params.partnerMention) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: params.partnerMention }],
    });
  }
  return blocks;
}

// ============================================================
// NOTIFIERS
// ============================================================

async function postToSlack(webhookUrl: string, body: any): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: txt.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || 'fetch failed' };
  }
}

/**
 * Notification standard quand une analyse vient d etre complete.
 * Envoyee inconditionnellement si la config existe et enabled=true.
 */
export async function notifyAnalysisComplete(params: {
  organizationId: string;
  analysisId: string;
  companyName: string;
  sector: string | null;
  country: string | null;
  verdict: string;
  globalScore: number | null;
  successProbability: number | null;
  failureProbability: number | null;
  decisionDrivers: string[];
  topRisks: Array<{ label: string; intensity: number }>;
  baseUrl: string;
}): Promise<boolean> {
  const cfg = await getSlackConfig(params.organizationId);
  if (!cfg || !cfg.enabled) {
    await logNotification({
      organizationId: params.organizationId,
      analysisId: params.analysisId,
      notificationType: 'analysis-complete',
      status: 'skipped',
      payloadSummary: { reason: cfg ? 'disabled' : 'no-config' },
    });
    return false;
  }

  const analysisUrl = `${params.baseUrl}/?analysis=${params.analysisId}`;

  const blocks = buildAnalysisCompleteBlocks({
    companyName: params.companyName,
    sector: params.sector,
    country: params.country,
    verdict: params.verdict,
    globalScore: params.globalScore,
    successProbability: params.successProbability,
    failureProbability: params.failureProbability,
    decisionDrivers: params.decisionDrivers,
    topRisks: params.topRisks,
    analysisUrl,
    partnerMention: cfg.defaultPartnerMention,
  });

  const result = await postToSlack(cfg.webhookUrl, {
    text: `Analyse complete : ${params.companyName} · ${VERDICT_LABEL[params.verdict] || params.verdict}`,
    blocks,
  });

  await logNotification({
    organizationId: params.organizationId,
    analysisId: params.analysisId,
    notificationType: 'analysis-complete',
    status: result.ok ? 'sent' : 'failed',
    httpStatus: result.status,
    errorMessage: result.error,
    payloadSummary: { companyName: params.companyName, verdict: params.verdict },
  });

  return result.ok;
}

/**
 * Alerte critique : verdict tres negatif ou pattern d aveuglement
 * intense. Envoyee en plus du message standard, pour escalation
 * dans le channel.
 */
export async function notifyCriticalAlert(params: {
  organizationId: string;
  analysisId: string;
  companyName: string;
  verdict: string;
  reason: string;
  baseUrl: string;
}): Promise<boolean> {
  const cfg = await getSlackConfig(params.organizationId);
  if (!cfg || !cfg.enabled) return false;

  const analysisUrl = `${params.baseUrl}/?analysis=${params.analysisId}`;

  const blocks = buildCriticalAlertBlocks({
    companyName: params.companyName,
    verdict: params.verdict,
    reason: params.reason,
    analysisUrl,
    partnerMention: cfg.defaultPartnerMention,
  });

  const result = await postToSlack(cfg.webhookUrl, {
    text: `🚨 Alerte critique · ${params.companyName}`,
    blocks,
  });

  await logNotification({
    organizationId: params.organizationId,
    analysisId: params.analysisId,
    notificationType: 'critical-alert',
    status: result.ok ? 'sent' : 'failed',
    httpStatus: result.status,
    errorMessage: result.error,
    payloadSummary: { companyName: params.companyName, reason: params.reason },
  });

  return result.ok;
}

/**
 * Test du webhook : envoie un message de test, met a jour
 * last_test_at / last_test_ok dans la config.
 */
export async function testSlackWebhook(organizationId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getSlackConfig(organizationId);
  if (!cfg) return { ok: false, error: 'no-config' };

  const result = await postToSlack(cfg.webhookUrl, {
    text: 'Test de connexion Prelude',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '✓ Webhook Prelude actif', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'La configuration Slack de votre fonds est operationnelle. Les analyses completes et les alertes critiques arriveront dans ce channel.',
        },
      },
    ],
  });

  // Mettre a jour le statut de test
  try {
    const admin = getSupabaseAdminClient();
    await admin
      .from('organization_slack_config')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: result.ok,
      })
      .eq('organization_id', organizationId);
  } catch {
    // Best effort
  }

  return { ok: result.ok, error: result.error };
}

// ============================================================
// NOTIFICATION : changement de stade workflow
// ------------------------------------------------------------
// Quand un membre du fonds fait passer un dossier de in_review a
// dd_field, ou de dd_field a ic_review, ou signe enfin un dossier,
// on poste un message dans le channel pour que toute l equipe sache
// ou en sont les dossiers, sans avoir a venir consulter Prelude.
//
// C est cette boucle (action dans Prelude -> notif Slack) qui rend
// le pilotage de fonds vivant : un partner voit en temps reel que
// le dossier qu il a refile en DD avance, qu un dossier signe doit
// etre passe en suivi, etc.
// ============================================================

const STAGE_LABEL_FR: Record<string, string> = {
  deposited: 'Depose',
  in_review: 'En instruction',
  dd_field: 'DD terrain',
  ic_review: 'Pret pour IC',
  signed: 'Signe',
  declined: 'Refuse',
};

const STAGE_EMOJI: Record<string, string> = {
  deposited: '📥',
  in_review: '🔍',
  dd_field: '🌍',
  ic_review: '🎯',
  signed: '✅',
  declined: '⛔',
};

export async function notifyWorkflowStageChange(params: {
  organizationId: string;
  analysisId: string;
  companyName: string;
  fromStage: string | null;
  toStage: string;
  changedByDisplay: string | null;
  comment: string | null;
  baseUrl: string;
}): Promise<boolean> {
  const cfg = await getSlackConfig(params.organizationId);
  if (!cfg || !cfg.enabled) {
    await logNotification({
      organizationId: params.organizationId,
      analysisId: params.analysisId,
      notificationType: 'workflow-stage-change',
      status: 'skipped',
      payloadSummary: { reason: cfg ? 'disabled' : 'no-config' },
    });
    return false;
  }

  const analysisUrl = `${params.baseUrl}/?analysis=${params.analysisId}`;
  const fromLabel = params.fromStage ? STAGE_LABEL_FR[params.fromStage] || params.fromStage : 'nouveau dossier';
  const toLabel = STAGE_LABEL_FR[params.toStage] || params.toStage;
  const toEmoji = STAGE_EMOJI[params.toStage] || '•';

  const headerText = `${toEmoji} ${params.companyName} -> ${toLabel}`;
  const transitionLine = params.fromStage
    ? `*Transition :* ${fromLabel} → ${toLabel}`
    : `*Stade :* ${toLabel}`;
  const byLine = params.changedByDisplay ? `*Par :* ${params.changedByDisplay}` : null;
  const commentLine = params.comment ? `_« ${params.comment.slice(0, 280)} »_` : null;

  const sectionLines = [transitionLine, byLine, commentLine].filter(Boolean) as string[];

  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerText, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: sectionLines.join('\n') },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Ouvrir le dossier', emoji: true },
          url: analysisUrl,
        },
      ],
    },
  ];

  const result = await postToSlack(cfg.webhookUrl, {
    text: `${params.companyName} -> ${toLabel}`,
    blocks,
  });

  await logNotification({
    organizationId: params.organizationId,
    analysisId: params.analysisId,
    notificationType: 'workflow-stage-change',
    status: result.ok ? 'sent' : 'failed',
    httpStatus: result.status,
    errorMessage: result.error,
    payloadSummary: {
      companyName: params.companyName,
      fromStage: params.fromStage,
      toStage: params.toStage,
    },
  });

  return result.ok;
}

// ============================================================
// NOTIFICATION : quorum IC atteint
// ------------------------------------------------------------
// Quand le X-ieme membre du comite vote sur un dossier (par
// defaut X=3), on poste un message dans le canal pour signaler
// que le comite s est tenu et donner le breakdown des positions.
// Notifie une seule fois par dossier : on regarde dans
// slack_notifications_log si on a deja envoye une notif de type
// ic-quorum-reached, et si oui on s abstient.
//
// C est ce qui boucle l experience comite : les membres votent
// depuis le Pack IC, le canal apprend automatiquement que la
// decision est prise, le partner principal sait qu il peut
// passer le dossier en signe ou refuse.
// ============================================================

const IC_VOTE_LABEL_FR: Record<string, string> = {
  'investir': 'Investir',
  'investir-conditions': 'Investir avec conditions',
  'approfondir': 'Approfondir',
  'refuser': 'Refuser',
};

async function hasNotifiedIcQuorum(
  organizationId: string,
  analysisId: string,
): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  try {
    const admin = getSupabaseAdminClient();
    const { count } = await admin
      .from('slack_notifications_log')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('analysis_id', analysisId)
      .eq('notification_type', 'ic-quorum-reached')
      .eq('status', 'sent');
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

export async function notifyIcVoteQuorum(params: {
  organizationId: string;
  analysisId: string;
  companyName: string;
  votes: Array<{ userEmail: string | null; voteOption: string }>;
  baseUrl: string;
  quorumThreshold: number;
}): Promise<boolean> {
  // Anti-doublon : si on a deja notifie pour ce dossier, on s arrete
  if (await hasNotifiedIcQuorum(params.organizationId, params.analysisId)) {
    return false;
  }

  const cfg = await getSlackConfig(params.organizationId);
  if (!cfg || !cfg.enabled) {
    await logNotification({
      organizationId: params.organizationId,
      analysisId: params.analysisId,
      notificationType: 'ic-quorum-reached',
      status: 'skipped',
      payloadSummary: { reason: cfg ? 'disabled' : 'no-config' },
    });
    return false;
  }

  // Aggrege les votes par option (counts), trie du plus vote au moins vote
  const counts: Record<string, number> = {};
  params.votes.forEach((v) => {
    counts[v.voteOption] = (counts[v.voteOption] || 0) + 1;
  });

  const sortedEntries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const breakdownLines = sortedEntries.map(([opt, count]) => {
    const label = IC_VOTE_LABEL_FR[opt] || opt;
    return `• ${count} vote${count > 1 ? 's' : ''} *${label}*`;
  });

  // Position dominante : option avec le plus de votes (s il y a egalite,
  // on prend la premiere apres tri, c est arbitraire mais coherent).
  const [topOption, topCount] = sortedEntries[0] || [null, 0];
  const isUnanimous = sortedEntries.length === 1;
  const dominantLabel = topOption ? (IC_VOTE_LABEL_FR[topOption] || topOption) : null;

  const consensusLine = isUnanimous && dominantLabel
    ? `*Position unanime :* ${dominantLabel}`
    : dominantLabel
    ? `*Position dominante :* ${dominantLabel} (${topCount}/${params.votes.length})`
    : '';

  const analysisUrl = `${params.baseUrl}/?analysis=${params.analysisId}`;

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🎯 ${params.companyName} · Quorum IC atteint`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${params.votes.length} membres* du comite se sont prononces.${consensusLine ? '\n\n' + consensusLine : ''}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: breakdownLines.join('\n'),
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Voir les votes', emoji: true },
          url: analysisUrl,
        },
      ],
    },
  ];

  const result = await postToSlack(cfg.webhookUrl, {
    text: `${params.companyName} · Quorum IC atteint (${params.votes.length} votes)`,
    blocks,
  });

  await logNotification({
    organizationId: params.organizationId,
    analysisId: params.analysisId,
    notificationType: 'ic-quorum-reached',
    status: result.ok ? 'sent' : 'failed',
    httpStatus: result.status,
    errorMessage: result.error,
    payloadSummary: {
      companyName: params.companyName,
      votesCount: params.votes.length,
      breakdown: counts,
      dominantOption: topOption,
    },
  });

  return result.ok;
}
