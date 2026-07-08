// ============================================================
// GET /api/cron/cleanup-stale-running
// ------------------------------------------------------------
// Cron toutes les quinze minutes qui balaie les analyses coincees
// en status='running' depuis plus de trente minutes et les bascule
// en 'failed'. Sans ce nettoyage, une pipeline qui meurt entre la
// creation de la ligne et la pose du statut terminal (timeout Vercel
// 800s, kill process au redeploy, deconnexion Supabase pendant
// markAnalysisFailed lui-meme) reste indefiniment en 'running' et
// pollue l Historique.
//
// AUTH DUALE : le CRON_SECRET reste la voie primaire, mais on
// accepte aussi les invocations dont le User-Agent commence par
// 'vercel-cron/' (Vercel signe systematiquement ses appels cron
// avec ce user-agent, cf docs Vercel Cron). Cette voie de secours
// evite le 401 silencieux quand l operateur a oublie de configurer
// CRON_SECRET dans les env vars du projet Vercel, cas de figure
// qui laisse toutes les analyses coincees se cumuler sans qu aucun
// log serveur ne le signale.
//
// La surface d attaque residuelle du fallback UA est nulle en
// pratique : un appel spoofe ne peut que declencher un balayage
// deja idempotent, il ne peut ni lire, ni supprimer, ni exposer
// de donnees. On ne descend pas plus bas en garantie de securite
// qu on ne montait en garantie de disponibilite.
//
// OBSERVABILITE : chaque invocation (autorisee ou refusee) est
// tracee dans la table error_logs avec severity 'info' ou 'error'.
// Sans cette trace, on ne pouvait pas distinguer "Vercel n a jamais
// appele le cron" de "Vercel a appele le cron mais l endpoint a
// refuse 401" ni de "l endpoint a tourne mais n a rien trouve".
// La serie temporelle des entrees info dans error_logs sert de
// heartbeat pour valider que le cron tourne bien a la frequence
// configuree dans vercel.json.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { isPersistenceEnabled, markStaleRunningAsFailed } from '@/lib/analysis-store';
import { logError } from '@/lib/error-logger';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DEFAULT_THRESHOLD_MINUTES = 30;
const VERCEL_CRON_UA_PREFIX = 'vercel-cron/';
const LOG_SOURCE = 'cron.cleanup-stale-running';

interface AuthResult {
  authorized: boolean;
  reason: string;
}

/**
 * Evalue l autorisation d une requete cron avec priorite au
 * CRON_SECRET puis fallback sur le user-agent Vercel. Retourne
 * une paire (autorise, raison lisible) pour que le log downstream
 * puisse tracer la cause exacte, ce qui evite les diagnostics a
 * l aveugle sur les 401.
 */
function evaluateAuth(req: NextRequest): AuthResult {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const userAgent = req.headers.get('user-agent') || '';
  const isVercelCron = userAgent.startsWith(VERCEL_CRON_UA_PREFIX);

  if (secret) {
    if (authHeader === `Bearer ${secret}`) {
      return { authorized: true, reason: 'CRON_SECRET valide' };
    }
    if (isVercelCron) {
      return {
        authorized: true,
        reason: 'CRON_SECRET defini mais header Authorization absent ou faux, invocation acceptee sur user-agent vercel-cron',
      };
    }
    return {
      authorized: false,
      reason: 'CRON_SECRET defini cote serveur, header Authorization absent ou incorrect cote appelant',
    };
  }

  if (isVercelCron) {
    return {
      authorized: true,
      reason: 'CRON_SECRET absent cote serveur, invocation acceptee sur user-agent vercel-cron',
    };
  }
  if (process.env.NODE_ENV !== 'production') {
    return { authorized: true, reason: 'CRON_SECRET absent, mode dev' };
  }
  return {
    authorized: false,
    reason: 'CRON_SECRET absent cote serveur en production et user-agent non vercel-cron',
  };
}

export async function GET(req: NextRequest) {
  const triggeredAt = new Date().toISOString();
  const userAgent = req.headers.get('user-agent') || '';
  const auth = evaluateAuth(req);

  // Trace durable de chaque invocation, quel qu en soit le sort.
  // Cette entree est le heartbeat qui prouve que Vercel appelle
  // bien le cron a la frequence attendue. Un trou dans cette serie
  // temporelle est le signal univoque que la programmation Vercel
  // ne tourne plus.
  await logError({
    severity: auth.authorized ? 'info' : 'error',
    source: LOG_SOURCE,
    message: auth.authorized
      ? `invocation autorisee (${auth.reason})`
      : `invocation refusee 401 (${auth.reason})`,
    context: {
      triggeredAt,
      userAgent,
      hasCronSecret: !!process.env.CRON_SECRET,
      hasAuthorizationHeader: !!req.headers.get('authorization'),
      authorized: auth.authorized,
    },
  });

  if (!auth.authorized) {
    return NextResponse.json(
      { error: 'unauthorized', reason: auth.reason },
      { status: 401 },
    );
  }

  if (!isPersistenceEnabled()) {
    await logError({
      severity: 'error',
      source: LOG_SOURCE,
      message: 'persistence desactivee : ENABLE_PERSISTENCE non true',
      context: { triggeredAt },
    });
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 503 });
  }

  const thresholdParam = req.nextUrl.searchParams.get('thresholdMinutes');
  const threshold = thresholdParam
    ? Math.max(5, Math.min(1440, Number.parseInt(thresholdParam, 10) || DEFAULT_THRESHOLD_MINUTES))
    : DEFAULT_THRESHOLD_MINUTES;

  const { swept, ids } = await markStaleRunningAsFailed(threshold);

  // Trace du resultat de balayage systematique, y compris quand
  // swept=0. Sans cette trace explicite d une passe reussie a vide,
  // on ne pouvait pas differencier "aucune ligne stale" de "handler
  // qui plante avant la sweep". Utile aussi pour piloter le seuil :
  // si swept>0 est frequent, c est que le pipeline plante souvent.
  await logError({
    severity: swept > 0 ? 'warning' : 'info',
    source: LOG_SOURCE,
    message:
      swept > 0
        ? `passage OK, ${swept} analyse(s) basculee(s) en failed (seuil ${threshold} min)`
        : `passage OK, aucune ligne stale (seuil ${threshold} min)`,
    context: { triggeredAt, threshold, swept, ids },
  });

  return NextResponse.json({
    triggeredAt,
    thresholdMinutes: threshold,
    sweptCount: swept,
    ids,
    authReason: auth.reason,
  });
}
