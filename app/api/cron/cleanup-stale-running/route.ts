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
// AUTH : Bearer CRON_SECRET en comparaison stricte, refus en
// production quand le secret est absent. Meme convention que les
// cinq autres crons.
//
// Cette route a porte, du 27 juillet au 3 aout 2026, une auth duale
// qui acceptait aussi tout appel dont le User-Agent commencait par
// 'vercel-cron/'. Elle a ete retiree, et la justification qui
// l accompagnait avec elle, parce que cette justification etait
// fausse sur les deux points ou elle rassurait.
//
// Elle soutenait qu un appel spoofe ne peut que declencher un
// balayage deja idempotent, incapable de lire, de supprimer ou
// d exposer. Le balayage n est pas idempotent : son seuil arrivait
// par la query string, borne en bas a cinq minutes, quand le
// pipeline declare maxDuration = 800, soit treize minutes et vingt
// secondes, et n ecrit son progress qu aux transitions de moteur,
// certains annonces a cent vingt secondes. Un appel a
// ?thresholdMinutes=5 basculait donc en 'failed' des analyses
// vivantes, avec un completed_at pose et un error_message qui
// impute la panne a un timeout Vercel jamais survenu. Rien ne
// ramene de 'failed' vers 'running'. L exactitude du reste de la
// phrase, ni lire ni supprimer ni exposer, ne compensait pas :
// elle donnait au lecteur la confiance de ne pas verifier le seul
// terme qui etait faux.
//
// Elle supposait ensuite que le silence du cron venait d un 401,
// donc d un CRON_SECRET mal configure. La cause reelle etait le
// middleware d authentification, dont le matcher couvrait
// /api/cron/* et redirigeait les six taches en 307 vers /login,
// sans jamais atteindre aucun handler. Le rapport qui a motive
// l auth duale portait pourtant deja la preuve qui l infirme : il
// notait qu error_logs ne contenait aucune entree pour aucun des
// six crons. Un 401 en aurait laisse une, puisque le log ci-dessous
// precede la garde. Zero trace ne designe pas une garde qui refuse,
// mais une requete qui n arrive pas.
//
// Un en-tete que l appelant choisit librement n est pas une preuve
// d identite, et une voie de secours ouverte pour compenser un
// diagnostic errone laisse une porte ouverte apres que le
// diagnostic a ete corrige.
//
// OBSERVABILITE : chaque invocation (autorisee ou refusee) est
// tracee dans la table error_logs avec severity 'info' ou 'error'.
// Sans cette trace, on ne pouvait pas distinguer "Vercel n a jamais
// appele le cron" de "Vercel a appele le cron mais l endpoint a
// refuse 401" ni de "l endpoint a tourne mais n a rien trouve".
// La serie temporelle des entrees info dans error_logs sert de
// heartbeat pour valider que le cron tourne bien a la frequence
// configuree dans vercel.json.
//
// Ce log a fait son travail : c est son absence totale, sur toute
// la vie de la table, qui a permis d etablir que le handler n avait
// jamais ete atteint plutot que d avoir refuse. Il se paie d un
// canal d ecriture accessible a un anonyme, qui peut faire grossir
// error_logs a raison d une ligne par requete refusee. On l accepte
// parce que la panne qu il rend visible est muette par nature,
// alors qu une table qui grossit se voit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  isPersistenceEnabled,
  markStaleRunningAsFailed,
  STALE_SWEEP_THRESHOLD_MINUTES,
} from '@/lib/analysis-store';
import { evaluateCronAuth } from '@/lib/cron/auth';
import { logError } from '@/lib/error-logger';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Le seuil d immobilite et la garde d authentification vivent tous
// deux hors de ce fichier, dans lib/analysis-store.ts et
// lib/cron/auth.ts. Ce n est pas un rangement : un route.ts de Next
// ne peut exporter que ses handlers, donc tout ce qui reste ici est
// hors d atteinte d un test, et ce qui echappe aux tests derive. La
// garde de cette route avait diverge des cinq autres, et le seuil
// s etait laisse piloter par la query string.
const LOG_SOURCE = 'cron.cleanup-stale-running';

export async function GET(req: NextRequest) {
  const triggeredAt = new Date().toISOString();
  const userAgent = req.headers.get('user-agent') || '';
  const auth = evaluateCronAuth(req);

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

  // Le seuil ne se lit plus depuis la query string. Un balayage qui
  // ecrit un statut terminal irreversible ne prend pas ses bornes de
  // son appelant.
  const threshold = STALE_SWEEP_THRESHOLD_MINUTES;

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
