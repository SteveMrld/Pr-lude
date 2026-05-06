// ============================================================
// RATE LIMITING DES PIPELINES /api/analyze
// ------------------------------------------------------------
// Plafonne le nombre de pipelines simultanes par organisation
// via la table active_jobs Supabase. Evite qu un acteur mal-
// veillant ou un bug client ne brule les credits Anthropic.
//
// Interface :
//   acquireJobSlot(orgId, userId, pitchDeckName) -> jobId | null
//     Retourne un jobId si l org a encore une place. null si
//     la limite est atteinte (le caller doit alors retourner 429).
//   releaseJobSlot(jobId) -> void
//     A appeler dans un finally pour liberer la place a la fin
//     du pipeline, succes ou echec.
//
// Comportement defensif :
//   - Si la table active_jobs n existe pas (migration non
//     appliquee), acquireJobSlot retourne un jobId sentinel et
//     ne plafonne rien. Permet de deployer le code avant la
//     migration sans bloquer le service.
//   - Si Supabase est down, on log et on laisse passer (fail
//     open). Le rate limiting est preferable mais pas critique.
//   - Cleanup automatique : avant chaque tentative d acquire,
//     on purge les jobs > MAX_JOB_AGE_MS pour eviter qu un
//     pipeline qui a crash ne bloque indefiniment.
// ============================================================

import { getSupabaseAdminClient } from './supabase/server';
import { logException } from './error-logger';

/** Max pipelines simultanes par organisation. Configurable via env. */
const MAX_CONCURRENT_JOBS_PER_ORG = parseInt(process.env.MAX_CONCURRENT_JOBS_PER_ORG || '3', 10);

/**
 * Age maximal d un job avant purge automatique. Au-dela, on considere
 * que le pipeline a crashed sans nettoyage et on libere la place.
 * 15 minutes est large pour un pipeline normal qui prend 5 min, et
 * conservateur pour absorber les pipelines complexes a 8-10 min.
 */
const MAX_JOB_AGE_MS = 15 * 60 * 1000;

const SENTINEL_NO_TABLE = 'sentinel-no-active-jobs-table';

export interface AcquireSlotResult {
  jobId: string | null;
  /**
   * Quand jobId est null, indique pourquoi. 'limit-reached' = l org a
   * deja MAX_CONCURRENT_JOBS_PER_ORG pipelines en cours. 'error' =
   * Supabase indisponible (mais le caller peut decider de laisser
   * passer en mode degrade).
   */
  reason?: 'limit-reached' | 'error';
  currentCount?: number;
  maxAllowed?: number;
}

/**
 * Tente de reserver un slot pour un nouveau pipeline. Retourne un
 * jobId si la place est disponible, ou null avec le motif sinon.
 */
export async function acquireJobSlot(
  organizationId: string,
  userId: string | null,
  pitchDeckName: string | null,
): Promise<AcquireSlotResult> {
  try {
    const admin = getSupabaseAdminClient();

    // Etape 1 : purge des jobs anciens. Si un pipeline a crashed
    // sans cleanup, le row reste indefiniment et bloque la place.
    // On purge a chaque appel pour rester self-healing.
    const cutoff = new Date(Date.now() - MAX_JOB_AGE_MS).toISOString();
    await admin
      .from('active_jobs')
      .delete()
      .eq('organization_id', organizationId)
      .lt('started_at', cutoff);

    // Etape 2 : compte les jobs actifs pour l org.
    const { count, error: countErr } = await admin
      .from('active_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (countErr) {
      // Table absente (migration non appliquee) ou autre erreur SQL.
      // Fail-open : on laisse passer en retournant un sentinel pour
      // que releaseJobSlot sache qu il n y a rien a nettoyer.
      const isTableMissing = countErr.message?.toLowerCase().includes('does not exist')
        || countErr.message?.toLowerCase().includes('relation')
        || countErr.code === '42P01';
      if (isTableMissing) {
        return { jobId: SENTINEL_NO_TABLE };
      }
      logException('lib.rate-limit.acquire', countErr, {
        severity: 'warning',
        organizationId,
        context: { phase: 'count-check' },
      });
      return { jobId: SENTINEL_NO_TABLE, reason: 'error' };
    }

    const currentCount = count || 0;
    if (currentCount >= MAX_CONCURRENT_JOBS_PER_ORG) {
      return {
        jobId: null,
        reason: 'limit-reached',
        currentCount,
        maxAllowed: MAX_CONCURRENT_JOBS_PER_ORG,
      };
    }

    // Etape 3 : insere le nouveau job actif.
    const { data: inserted, error: insertErr } = await admin
      .from('active_jobs')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        pitch_deck_name: pitchDeckName,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      // Si l insert echoue, on laisse passer plutot que de bloquer.
      // Le risque est qu un fonds depasse temporairement la limite,
      // ce qui est moins grave que de refuser un pipeline legitime.
      logException('lib.rate-limit.acquire', insertErr, {
        severity: 'warning',
        organizationId,
        context: { phase: 'insert-active-job' },
      });
      return { jobId: SENTINEL_NO_TABLE, reason: 'error' };
    }

    return { jobId: inserted.id };
  } catch (err: any) {
    logException('lib.rate-limit.acquire', err, {
      severity: 'warning',
      organizationId,
      context: { phase: 'unexpected-error' },
    });
    return { jobId: SENTINEL_NO_TABLE, reason: 'error' };
  }
}

/**
 * Libere un slot a la fin du pipeline. A appeler dans un finally
 * pour garantir le cleanup meme si le pipeline a echoue. Tolere
 * les sentinels (cas migration non appliquee).
 */
export async function releaseJobSlot(jobId: string | null): Promise<void> {
  if (!jobId || jobId === SENTINEL_NO_TABLE) return;
  try {
    const admin = getSupabaseAdminClient();
    await admin.from('active_jobs').delete().eq('id', jobId);
  } catch (err: any) {
    // Cleanup au pire des cas par la purge MAX_JOB_AGE_MS au prochain
    // acquire. On log mais on n echoue pas.
    logException('lib.rate-limit.release', err, {
      severity: 'warning',
      context: { jobId },
    });
  }
}
