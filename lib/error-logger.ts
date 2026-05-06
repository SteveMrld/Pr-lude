// ============================================================
// MONITORING D ERREURS PRELUDE
// ------------------------------------------------------------
// Module unifie pour capturer les erreurs serveur dans la table
// error_logs Supabase. Remplace progressivement les console.warn
// console.error eparpilles dans le code par des logs structures.
//
// Triple sortie :
//   1. Console serveur (Vercel logs, garde la trace immediate)
//   2. Insert Supabase si la table existe (dashboard et alerting)
//   3. Pas d echec si Supabase down (fail open, ne pas casser le
//      pipeline a cause du logging)
//
// Convention : utiliser logError pour les erreurs bloquantes,
// logWarning pour les moteurs non-bloquants en echec, logInfo pour
// les evenements notables (fallback degrade pris, etc.).
//
// Le logger est volontairement tolerant : si la table error_logs
// n a pas ete creee en prod, les inserts echouent silencieusement
// (try/catch) et on ne perd que la persistence, pas la trace
// console. Permet de deployer le code avant la migration SQL.
// ============================================================

import { getSupabaseAdminClient } from './supabase/server';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorLogEntry {
  severity: ErrorSeverity;
  /**
   * Composant qui a leve l erreur. Convention :
   *   pipeline.<engine_id>     : un moteur Bloc 1 ou Bloc 2
   *   api.<route_path>         : une route API
   *   client.<page>            : erreur capturee cote client
   *   external.<service>       : service externe (Anthropic, Supabase)
   */
  source: string;
  /** Message court (1-2 lignes max) */
  message: string;
  /** Stack trace optionnelle */
  stack?: string;
  /** Contexte structure : analysis_id, user_id, file names, etc. */
  context?: Record<string, any>;
  /** L organisation concernee, si identifiable */
  organizationId?: string | null;
  /** L user concerne, si identifiable */
  userId?: string | null;
  /** L analyse concernee, si la trace remonte a un dossier */
  analysisId?: string | null;
}

/**
 * Insert en base + log console. Tolerant aux echecs Supabase
 * (fail open). Asynchrone, n attend pas l insert si appele dans
 * un contexte non-await (fire-and-forget).
 */
export async function logError(entry: ErrorLogEntry): Promise<void> {
  const consolePrefix = `[${entry.severity}][${entry.source}]`;
  const consoleMethod = entry.severity === 'error' ? console.error : entry.severity === 'warning' ? console.warn : console.info;
  consoleMethod(`${consolePrefix} ${entry.message}${entry.stack ? '\n' + entry.stack : ''}`);

  // Persistence non bloquante. Si Supabase down ou table absente,
  // on perd l entree mais on ne fait pas planter le caller.
  try {
    const admin = getSupabaseAdminClient();
    await admin.from('error_logs').insert({
      severity: entry.severity,
      source: entry.source,
      message: entry.message.slice(0, 2000), // garde-fou taille
      stack: entry.stack ? entry.stack.slice(0, 8000) : null,
      context: entry.context || {},
      organization_id: entry.organizationId || null,
      user_id: entry.userId || null,
      analysis_id: entry.analysisId || null,
    });
  } catch (err: any) {
    // Silencieux : ne pas cascader le probleme. La trace console
    // a deja ete posee plus haut, c est suffisant pour le debug.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[logger] failed to persist error log:', err?.message);
    }
  }
}

/**
 * Helper pour logger une exception capturee. Extrait automatiquement
 * message et stack depuis l objet Error.
 */
export async function logException(
  source: string,
  err: any,
  options: {
    severity?: ErrorSeverity;
    context?: Record<string, any>;
    organizationId?: string | null;
    userId?: string | null;
    analysisId?: string | null;
  } = {},
): Promise<void> {
  const message = err?.message || (typeof err === 'string' ? err : 'unknown error');
  const stack = err?.stack || undefined;
  await logError({
    severity: options.severity || 'error',
    source,
    message,
    stack,
    context: options.context,
    organizationId: options.organizationId,
    userId: options.userId,
    analysisId: options.analysisId,
  });
}

/**
 * Wrapper fire-and-forget pour les contextes ou on ne veut pas
 * await. Utilise si l erreur ne doit pas faire attendre le caller
 * (ex: dans un .catch d un Promise.all).
 */
export function logExceptionAsync(
  source: string,
  err: any,
  options?: Parameters<typeof logException>[2],
): void {
  // Fire and forget. La promise rejetee est swallowed par le
  // try/catch interne de logError, donc safe.
  void logException(source, err, options);
}
