// ============================================================
// GET /api/cron/sectoral-regenerate
// ------------------------------------------------------------
// Cron quotidien : pour chaque secteur catalogue, si la derniere
// fiche est plus vieille que 90 jours, ajouter le secteur a la
// file de regeneration du jour. La file est traitee en cycle
// decale (max quatre secteurs par jour) pour amortir le cout LLM
// sur la semaine et permettre une intervention manuelle si une
// fiche sort anormale avant que la suivante ne parte.
//
// Chaque regeneration ecrit dans sectoral_briefs avec
// regeneration_trigger=cron. L echec d une regeneration n arrete
// pas la file : on logge dans error_logs et on passe au suivant.
// La reponse JSON resume les secteurs traites et le verdict de
// chaque regeneration.
//
// Authentification : Vercel Cron envoie le header
// Authorization: Bearer <CRON_SECRET>. Meme schema que les autres
// crons Prelude. En l absence de secret configure (dev local), on
// laisse passer pour permettre les triggers manuels.
//
// Pourquoi GET et pas POST : Vercel Cron ne supporte que GET. La
// route ne porte aucun corps, juste l effet de bord.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { logException } from '@/lib/error-logger';
import { isCronAuthorized } from '@/lib/cron/auth';
import { battreCron } from '@/lib/cron/heartbeat';
import {
  SECTORS,
  getLatestBriefForSector,
  persistSectoralBrief,
  regenerateSectoralBrief,
} from '@/lib/engines/sectoral-intelligence';
import {
  selectEligibleSectorsForRegeneration,
  type SectorRegenCandidate,
  type SelectedSector,
  DEFAULT_SECTOR_REGEN_THRESHOLD_DAYS,
} from '@/lib/cron/sectoral-regeneration-selector';

export const runtime = 'nodejs';
// La regeneration LLM par secteur prend 30 a 60 secondes, jusqu a
// quatre secteurs traites en serie : on reserve un budget generous.
export const maxDuration = 800;
export const dynamic = 'force-dynamic';


interface SectorRunResult {
  sectorSlug: string;
  status: 'success' | 'rejected_data_missing' | 'rejected_error' | 'persist_error';
  cost_usd?: number;
  duration_ms?: number;
  dimensions_missing?: string[];
  rejection_reason?: string;
  error_message?: string;
}

export async function GET(req: NextRequest) {
  // Battement d invocation, ecrit avant la garde d autorisation : c est
  // son absence totale qui a etabli la panne des crons du 3 aout 2026,
  // et son absence sur les cinq autres qui l a rendue indetectable
  // pendant huit semaines.
  const autorise = isCronAuthorized(req);
  await battreCron({
    source: 'cron.sectoral-regenerate',
    autorisee: autorise,
    motif: autorise ? 'garde passee' : 'garde refusee',
    userAgent: req.headers.get('user-agent'),
    aUnEnTeteAutorisation: !!req.headers.get('authorization'),
  });

  if (!autorise) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const triggeredAt = new Date();

  // 1. Construit la liste plate des candidats : un par secteur
  //    catalogue, avec la date du dernier brief persiste (ou null).
  //    Lectures parallelisees pour limiter la latence avant le job.
  let candidates: SectorRegenCandidate[];
  try {
    candidates = await Promise.all(
      SECTORS.map(async (s) => {
        const latest = await getLatestBriefForSector(s.slug);
        return {
          sectorSlug: s.slug,
          latestGeneratedAt: latest?.generated_at ?? null,
        };
      }),
    );
  } catch (err: any) {
    await logException('cron.sectoral-regenerate', err, {
      severity: 'error',
      context: { phase: 'fetch-candidates' },
    });
    return NextResponse.json(
      { error: 'fetch-candidates failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }

  // 2. Selectionne les eligibles via la doctrine 90 jours, max 4.
  const eligible = selectEligibleSectorsForRegeneration(candidates, triggeredAt);

  // 3. Traite la file en serie. Une regeneration echouante ne
  //    bloque pas les suivantes : on capture l erreur, on logge,
  //    on continue. Permet a un cron quotidien de tenir la
  //    cadence meme si Anthropic vacille sur un secteur donne.
  const results: SectorRunResult[] = [];
  for (const sel of eligible) {
    const r = await runOneSector(sel);
    results.push(r);
  }

  // Verdict de la passe. C est ce qui distingue « je tourne et je n ai
  // rien a faire » de « je suis mort », les deux se lisant pareil dans
  // la table quand seule l invocation est tracee. Le 5 aout 2026, la
  // question « la couche sectorielle echoue-t-elle en silence » n a pu
  // etre tranchee qu en lisant le seuil du selecteur dans le code :
  // quatre-vingt-dix jours contre quatre-vingt-quatre ecoules, donc
  // rien d eligible. Ce verdict-la donne la reponse en une requete.
  const prochaineEcheance = candidates
    .map((c) => c.latestGeneratedAt ? new Date(c.latestGeneratedAt).getTime() : 0)
    .filter((t) => t > 0)
    .sort((a, b) => a - b)[0];
  await battreCron({
    source: 'cron.sectoral-regenerate',
    autorisee: true,
    motif: 'passe terminee',
    verdict: eligible.length === 0
      ? `aucun secteur eligible sur ${candidates.length} du catalogue, seuil de ${DEFAULT_SECTOR_REGEN_THRESHOLD_DAYS} jours non atteint`
      : `${eligible.length} eligible(s) sur ${candidates.length}, ${results.length} traite(s)`,
    contexte: {
      catalogSize: candidates.length,
      eligibleCount: eligible.length,
      processedCount: results.length,
      seuilJours: DEFAULT_SECTOR_REGEN_THRESHOLD_DAYS,
      ficheLaPlusAncienne: prochaineEcheance ? new Date(prochaineEcheance).toISOString() : null,
    },
  });

  return NextResponse.json({
    triggered_at: triggeredAt.toISOString(),
    catalog_size: candidates.length,
    eligible_count: eligible.length,
    processed_count: results.length,
    results,
  });
}

async function runOneSector(sel: SelectedSector): Promise<SectorRunResult> {
  const sectorSlug = sel.sectorSlug;
  try {
    // On chaine la nouvelle fiche avec la precedente (supersedes_id)
    // si elle existe. Le selecteur a deja confirme l eligibilite,
    // on ne refait pas le check ici.
    const previous = sel.latestGeneratedAt
      ? await getLatestBriefForSector(sectorSlug)
      : null;

    const result = await regenerateSectoralBrief(sectorSlug, 'cron', {
      previousBrief: previous?.id ? { id: previous.id } : undefined,
    });

    if (result.status === 'success' && result.brief) {
      try {
        await persistSectoralBrief(result.brief);
      } catch (persistErr: any) {
        await logException('cron.sectoral-regenerate.persist', persistErr, {
          severity: 'error',
          context: {
            sector_slug: sectorSlug,
            cost_usd: result.cost_usd,
            duration_ms: result.duration_ms,
          },
        });
        return {
          sectorSlug,
          status: 'persist_error',
          cost_usd: result.cost_usd,
          duration_ms: result.duration_ms,
          error_message: persistErr?.message || String(persistErr),
        };
      }

      return {
        sectorSlug,
        status: 'success',
        cost_usd: result.cost_usd,
        duration_ms: result.duration_ms,
      };
    }

    // Rejet doctrinal : on logge en warning (pas en error) parce
    // que c est un comportement attendu du regenerator quand les
    // donnees manquent. Le cron continue sur les autres secteurs.
    const severity = result.status === 'rejected_data_missing' ? 'warning' : 'error';
    await logException(
      'cron.sectoral-regenerate',
      new Error(
        `Regeneration ${result.status} pour ${sectorSlug} : ${result.rejection_reason ?? 'motif inconnu'}`,
      ),
      {
        severity,
        context: {
          sector_slug: sectorSlug,
          status: result.status,
          dimensions_missing: result.dimensions_missing,
          cost_usd: result.cost_usd,
          duration_ms: result.duration_ms,
        },
      },
    );

    return {
      sectorSlug,
      status: result.status,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      dimensions_missing: result.dimensions_missing,
      rejection_reason: result.rejection_reason,
      error_message: result.error_message,
    };
  } catch (err: any) {
    await logException('cron.sectoral-regenerate.unexpected', err, {
      severity: 'error',
      context: { sector_slug: sectorSlug },
    });
    return {
      sectorSlug,
      status: 'rejected_error',
      error_message: err?.message || String(err),
    };
  }
}
