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
} from '@/lib/cron/sectoral-regeneration-selector';

export const runtime = 'nodejs';
// La regeneration LLM par secteur prend 30 a 60 secondes, jusqu a
// quatre secteurs traites en serie : on reserve un budget generous.
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // En l absence de secret configure, on autorise pour permettre
    // les triggers manuels en dev. Sur Vercel Pro, le secret doit
    // etre defini : sans lui, n importe qui peut declencher le job.
    return process.env.NODE_ENV !== 'production';
  }
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

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
  if (!isAuthorized(req)) {
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
