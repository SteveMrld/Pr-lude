// ============================================================
// Garde d authentification des taches planifiees
// ------------------------------------------------------------
// Point de passage unique des six crons declares dans vercel.json.
//
// La garde etait auparavant recopiee dans chacune des six routes,
// sous le nom isAuthorized, avec le meme corps a quelques mots de
// commentaire pres. Une seule a diverge, cleanup-stale-running, en
// acceptant tout appel dont le User-Agent commencait par
// 'vercel-cron/', y compris quand CRON_SECRET etait configure et le
// header Authorization absent. Un en-tete que l appelant choisit
// librement n est pas une preuve d identite, et cette route ecrit un
// statut terminal irreversible.
//
// La divergence a tenu une semaine sans se voir, parce qu il n y
// avait rien a voir : chaque copie etait localement coherente. Le
// module existe pour qu il n y ait plus de copie a comparer, et non
// pour economiser des lignes.
//
// Regle : Bearer strict quand le secret est configure, refus en
// production quand il ne l est pas, tolerance hors production pour
// permettre les declenchements manuels en developpement.
// ============================================================

import type { NextRequest } from 'next/server';

export interface CronAuthResult {
  authorized: boolean;
  /**
   * Raison lisible du sort reserve a la requete. Existe pour que les
   * routes qui tracent leurs invocations puissent distinguer un
   * secret absent d un secret errone. Sans cette distinction, un 401
   * ne dit pas s il faut configurer une variable ou la corriger.
   */
  reason: string;
}

export function evaluateCronAuth(req: NextRequest): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';

  if (secret) {
    if (authHeader === `Bearer ${secret}`) {
      return { authorized: true, reason: 'CRON_SECRET valide' };
    }
    return {
      authorized: false,
      reason: 'CRON_SECRET defini cote serveur, header Authorization absent ou incorrect cote appelant',
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return { authorized: true, reason: 'CRON_SECRET absent, mode dev' };
  }
  return {
    authorized: false,
    reason: 'CRON_SECRET absent cote serveur en production',
  };
}

/**
 * Forme booleenne, pour les cinq routes qui ne tracent pas encore
 * leurs invocations et n ont donc pas d usage de la raison.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  return evaluateCronAuth(req).authorized;
}
