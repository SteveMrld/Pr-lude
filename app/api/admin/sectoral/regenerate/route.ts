// ============================================================
// POST /api/admin/sectoral/regenerate
// ------------------------------------------------------------
// Endpoint super-admin pour declencher une regeneration de fiche
// sectorielle, soit complete (mode=full), soit dimension par
// dimension (mode=dimension). Le travail effectif est lance en
// background via fire-and-forget : la requete HTTP retourne 202
// Accepted des que le job est lance, sans attendre la fin de
// l appel LLM (qui peut prendre 30 a 60 secondes).
//
// Le suivi se fait par lecture de /api/admin/sectoral, qui
// recupere la derniere fiche persistee ainsi que le log recent.
//
// Auth : super-admin Prelude uniquement. Sinon 403.
//
// Body JSON :
//   {
//     "sector_slug": "logiciel-entreprise-horizontal",
//     "mode": "full" | "dimension",
//     "dimension": "intensite_capitalistique"  (requis si mode=dimension)
//   }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import { logException } from '@/lib/error-logger';
import {
  getLatestBriefForSector,
  persistSectoralBrief,
  regenerateSectoralBrief,
  regenerateDimension,
  type DimensionKey,
} from '@/lib/engines/sectoral-intelligence';
import {
  validateRegenerateRequest,
  mergeDimensionIntoNewBrief,
} from '@/lib/engines/sectoral-intelligence/admin-flow';

export const dynamic = 'force-dynamic';

interface RegenerateRequestBody {
  sector_slug?: unknown;
  mode?: unknown;
  dimension?: unknown;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isAdmin = await isSuperAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: RegenerateRequestBody;
  try {
    body = (await req.json()) as RegenerateRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateRegenerateRequest(body);
  if (validation.ok === false) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Fire-and-forget : on lance le job sans bloquer la reponse
  // HTTP. La traversee Anthropic prend entre 30 et 60 secondes en
  // mode complet, ce qui ferait timeout cote client si on awaitait.
  // Le client poll /api/admin/sectoral pour voir la nouvelle fiche
  // apparaitre dans le log et la table.
  const triggeredBy = user.email || user.id;
  if (validation.mode === 'full') {
    runFullRegenerationInBackground(validation.sector_slug, triggeredBy);
  } else if (validation.dimension) {
    runDimensionRegenerationInBackground(
      validation.sector_slug,
      validation.dimension,
      triggeredBy,
    );
  }

  return NextResponse.json(
    {
      accepted: true,
      sector_slug: validation.sector_slug,
      mode: validation.mode,
      dimension: validation.dimension,
      triggered_by: triggeredBy,
      triggered_at: new Date().toISOString(),
      message:
        'Regeneration lancee en arriere-plan. Suivez l avancement via la table et le log de la page admin.',
    },
    { status: 202 },
  );
}

// ------------------------------------------------------------
// JOBS BACKGROUND
// Les erreurs sont capturees dans error_logs (sans bloquer) et
// loggees console pour les developpeurs locaux. Aucune exception
// ne remonte a l event loop : un await orchestre l ensemble dans
// un try/catch global.
// ------------------------------------------------------------

function runFullRegenerationInBackground(sectorSlug: string, triggeredBy: string): void {
  const job = async () => {
    try {
      const previous = await getLatestBriefForSector(sectorSlug);
      const result = await regenerateSectoralBrief(sectorSlug, 'manual', {
        previousBrief: previous?.id ? { id: previous.id } : undefined,
      });

      if (result.status !== 'success' || !result.brief) {
        await logException(
          'admin.sectoral.regenerate.full',
          new Error(
            `Regeneration rejetee pour ${sectorSlug} : ${result.rejection_reason ?? 'motif inconnu'}`,
          ),
          {
            severity: result.status === 'rejected_data_missing' ? 'warning' : 'error',
            context: {
              sector_slug: sectorSlug,
              status: result.status,
              dimensions_missing: result.dimensions_missing,
              triggered_by: triggeredBy,
            },
          },
        );
        return;
      }

      await persistSectoralBrief(result.brief);
    } catch (err) {
      await logException('admin.sectoral.regenerate.full', err, {
        severity: 'error',
        context: { sector_slug: sectorSlug, triggered_by: triggeredBy },
      }).catch(() => {
        /* derniere ligne de defense, on n a plus rien a faire */
      });
    }
  };
  // Detache le job de la reponse HTTP. Aucune attente de
  // l appelant n est requise pour que la fiche se persiste.
  void job();
}

function runDimensionRegenerationInBackground(
  sectorSlug: string,
  dimension: DimensionKey,
  triggeredBy: string,
): void {
  const job = async () => {
    try {
      const previous = await getLatestBriefForSector(sectorSlug);
      if (!previous) {
        // Sans fiche precedente on ne peut pas reconstituer les
        // sept autres dimensions ; on bascule en regeneration
        // complete plutot que d ecrire une fiche tronquee.
        const fullResult = await regenerateSectoralBrief(sectorSlug, 'manual');
        if (fullResult.status === 'success' && fullResult.brief) {
          await persistSectoralBrief(fullResult.brief);
        } else {
          await logException(
            'admin.sectoral.regenerate.dimension',
            new Error(
              `Pas de fiche precedente pour ${sectorSlug}, fallback complete a echoue : ${fullResult.rejection_reason ?? 'motif inconnu'}`,
            ),
            {
              severity: 'error',
              context: {
                sector_slug: sectorSlug,
                dimension,
                triggered_by: triggeredBy,
                fallback_status: fullResult.status,
              },
            },
          );
        }
        return;
      }

      const dimensionResult = await regenerateDimension(sectorSlug, dimension);
      if (dimensionResult.status === 'error' || !dimensionResult.dimension) {
        await logException(
          'admin.sectoral.regenerate.dimension',
          new Error(
            `Echec regeneration ${dimension} sur ${sectorSlug} : ${dimensionResult.error_message ?? 'motif inconnu'}`,
          ),
          {
            severity: 'error',
            context: { sector_slug: sectorSlug, dimension, triggered_by: triggeredBy },
          },
        );
        return;
      }

      // Reconstruction de la fiche complete : on conserve les sept
      // autres dimensions de la fiche precedente et on substitue
      // celle qui vient d etre regeneree. Le merge est extrait
      // dans admin-flow.ts pour permettre des tests deterministes.
      const newBrief = mergeDimensionIntoNewBrief({
        previous,
        dimension,
        regenerated: dimensionResult.dimension,
        cost_usd: dimensionResult.cost_usd,
        duration_ms: dimensionResult.duration_ms,
      });

      await persistSectoralBrief(newBrief);
    } catch (err) {
      await logException('admin.sectoral.regenerate.dimension', err, {
        severity: 'error',
        context: { sector_slug: sectorSlug, dimension, triggered_by: triggeredBy },
      }).catch(() => {
        /* idem, derniere ligne de defense */
      });
    }
  };
  void job();
}
