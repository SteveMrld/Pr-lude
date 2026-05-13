// ============================================================
// POST /api/sectoral/event-trigger
// ------------------------------------------------------------
// Webhook evenementiel : declenche la regeneration ad hoc d une
// fiche sectorielle suite a un choc externe (adoption d une loi,
// faillite emblematique, choc geopolitique). Exemples doctrinaux :
//   - AI Act adopte         -> ia-appliquee
//   - Faillite SVB           -> fintech
//   - Invasion d un pays
//     exportateur d intrants -> climat-energie + mobilite-logistique
//
// Authentification : token sectoriel evenementiel via header
// Authorization: Bearer <SECTORAL_EVENT_TOKEN>. Distinct du
// CRON_SECRET pour permettre des appels manuels sans contaminer
// les permissions du cron principal. Si la variable n est pas
// configuree cote serveur, l endpoint retourne 503 (failure mode
// safe : pas d ouverture par defaut).
//
// Payload JSON :
//   {
//     "event_type": "regulatory.act_adoption",
//     "sector_slug": "ia-appliquee",
//     "rationale": "EU AI Act publie au JOUE le 2026-05-12, ..."
//   }
//
// Comportement : la regeneration est lancee en arriere-plan via
// fire-and-forget. La requete HTTP retourne 202 Accepted des que
// le job est dispatche, sans attendre l appel LLM (qui peut
// prendre une minute). La nouvelle fiche apparait ensuite dans le
// log de la page admin avec regeneration_trigger=event.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { logException } from '@/lib/error-logger';
import {
  getLatestBriefForSector,
  persistSectoralBrief,
  regenerateSectoralBrief,
} from '@/lib/engines/sectoral-intelligence';
import {
  validateEventToken,
  validateEventPayload,
  type EventTriggerPayload,
} from '@/lib/cron/sectoral-event-trigger';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const tokenCheck = validateEventToken(
    req.headers.get('authorization'),
    process.env.SECTORAL_EVENT_TOKEN,
  );
  if (tokenCheck.ok === false) {
    return NextResponse.json({ error: tokenCheck.error }, { status: tokenCheck.status });
  }

  let body: EventTriggerPayload;
  try {
    body = (await req.json()) as EventTriggerPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateEventPayload(body);
  if (validation.ok === false) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { event_type, sector_slug, rationale } = validation.value;
  const triggeredAt = new Date();

  // Fire-and-forget : on lance le job sans bloquer la reponse
  // HTTP. Le client (script manuel, hook externe) recoit 202
  // immediatement et peut consulter le log admin pour voir la
  // nouvelle fiche apparaitre.
  runEventRegenerationInBackground(sector_slug, event_type, rationale);

  return NextResponse.json(
    {
      accepted: true,
      sector_slug,
      event_type,
      rationale_preview: rationale.slice(0, 120),
      triggered_at: triggeredAt.toISOString(),
      message:
        'Regeneration evenementielle lancee en arriere-plan. La nouvelle fiche apparaitra dans le journal admin avec trigger=event.',
    },
    { status: 202 },
  );
}

function runEventRegenerationInBackground(
  sectorSlug: string,
  eventType: string,
  rationale: string,
): void {
  const job = async () => {
    try {
      const previous = await getLatestBriefForSector(sectorSlug);

      const result = await regenerateSectoralBrief(sectorSlug, 'event', {
        previousBrief: previous?.id ? { id: previous.id } : undefined,
      });

      if (result.status !== 'success' || !result.brief) {
        await logException(
          'api.sectoral-event-trigger',
          new Error(
            `Regeneration event ${result.status} pour ${sectorSlug} : ${result.rejection_reason ?? 'motif inconnu'}`,
          ),
          {
            severity: result.status === 'rejected_data_missing' ? 'warning' : 'error',
            context: {
              sector_slug: sectorSlug,
              event_type: eventType,
              rationale: rationale.slice(0, 500),
              status: result.status,
              dimensions_missing: result.dimensions_missing,
            },
          },
        );
        return;
      }

      // Annote la fiche persistee avec event_type et rationale
      // dans la metadata pour audit. Les champs sont ajoutes en
      // sus de ceux generes par l orchestrateur, sans rompre la
      // forme attendue par les autres consommateurs.
      const briefWithEvent = {
        ...result.brief,
        generation_metadata: {
          ...result.brief.generation_metadata,
          event_type: eventType,
          rationale: rationale.slice(0, 2000),
        } as typeof result.brief.generation_metadata & {
          event_type: string;
          rationale: string;
        },
      };

      await persistSectoralBrief(briefWithEvent);
    } catch (err) {
      await logException('api.sectoral-event-trigger.unexpected', err, {
        severity: 'error',
        context: {
          sector_slug: sectorSlug,
          event_type: eventType,
          rationale: rationale.slice(0, 500),
        },
      }).catch(() => {
        /* derniere ligne de defense */
      });
    }
  };
  void job();
}
