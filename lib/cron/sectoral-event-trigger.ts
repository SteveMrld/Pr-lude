// ============================================================
// PRELUDE - Webhook event-trigger sectoriel, helpers purs
// ------------------------------------------------------------
// Logique pure utilisee par /api/sectoral/event-trigger. Extraite
// de la route handler pour permettre des tests deterministes
// sans monter de serveur Next ni mocker Supabase.
//
// Doctrine du webhook :
//   - Le token (env SECTORAL_EVENT_TOKEN) est distinct du
//     CRON_SECRET. Permet de declencher une regeneration ad hoc
//     depuis un script manuel sans contaminer les permissions du
//     cron principal. Si SECTORAL_EVENT_TOKEN n est pas configure,
//     l endpoint refuse en 503 (failure mode safe : pas
//     d ouverture par defaut).
//   - Le payload doit specifier event_type (texte court mais non
//     vide, classe d evenement comme "regulatory.act_adoption" ou
//     "macro.geopolitical_shock"), sector_slug (dans le catalogue),
//     et rationale (texte court qui justifie le declenchement).
//   - La rationale est obligatoire : un trigger event sans
//     justification ecrite n a pas sa place dans le journal. La
//     fiche regeneree heritera du rationale dans son metadata
//     pour audit posterieur.
// ============================================================

import { getSectorBySlug, SECTORS } from '../engines/sectoral-intelligence';

// ------------------------------------------------------------
// VALIDATION DU TOKEN
// ------------------------------------------------------------

export type TokenValidation =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/**
 * Valide un header Authorization contre le token sectoriel
 * evenementiel. Retourne 503 si le token n est pas configure cote
 * env (failure mode safe), 401 si le token fourni ne matche pas.
 */
export function validateEventToken(
  authHeader: string | null,
  configuredToken: string | undefined | null,
): TokenValidation {
  if (!configuredToken) {
    return {
      ok: false,
      status: 503,
      error:
        'SECTORAL_EVENT_TOKEN non configure cote serveur. L endpoint est desactive tant que la variable n est pas definie.',
    };
  }
  if (!authHeader || authHeader !== `Bearer ${configuredToken}`) {
    return { ok: false, status: 401, error: 'Token invalide ou absent.' };
  }
  return { ok: true };
}

// ------------------------------------------------------------
// VALIDATION DU PAYLOAD
// ------------------------------------------------------------

const RATIONALE_MIN_LENGTH = 20;
const RATIONALE_MAX_LENGTH = 2000;
const EVENT_TYPE_MIN_LENGTH = 3;
const EVENT_TYPE_MAX_LENGTH = 100;

export interface EventTriggerPayload {
  event_type?: unknown;
  sector_slug?: unknown;
  rationale?: unknown;
}

export interface NormalizedEventTrigger {
  event_type: string;
  sector_slug: string;
  rationale: string;
}

export type PayloadValidation =
  | { ok: true; value: NormalizedEventTrigger }
  | { ok: false; error: string };

export function validateEventPayload(body: EventTriggerPayload | null | undefined): PayloadValidation {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body JSON requis.' };
  }

  const { event_type, sector_slug, rationale } = body;

  if (typeof event_type !== 'string') {
    return { ok: false, error: 'event_type requis (texte court).' };
  }
  const trimmedEventType = event_type.trim();
  if (
    trimmedEventType.length < EVENT_TYPE_MIN_LENGTH ||
    trimmedEventType.length > EVENT_TYPE_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `event_type doit faire entre ${EVENT_TYPE_MIN_LENGTH} et ${EVENT_TYPE_MAX_LENGTH} caracteres.`,
    };
  }

  if (typeof sector_slug !== 'string' || !sector_slug.trim()) {
    return { ok: false, error: 'sector_slug requis.' };
  }
  if (!getSectorBySlug(sector_slug)) {
    return {
      ok: false,
      error: `Slug secteur inconnu : ${sector_slug}. Slugs valides : ${SECTORS.map((s) => s.slug).join(', ')}.`,
    };
  }

  if (typeof rationale !== 'string') {
    return {
      ok: false,
      error: `rationale requise (entre ${RATIONALE_MIN_LENGTH} et ${RATIONALE_MAX_LENGTH} caracteres).`,
    };
  }
  const trimmedRationale = rationale.trim();
  if (
    trimmedRationale.length < RATIONALE_MIN_LENGTH ||
    trimmedRationale.length > RATIONALE_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `rationale doit faire entre ${RATIONALE_MIN_LENGTH} et ${RATIONALE_MAX_LENGTH} caracteres. Une justification ecrite est obligatoire pour traceabilite.`,
    };
  }

  return {
    ok: true,
    value: {
      event_type: trimmedEventType,
      sector_slug,
      rationale: trimmedRationale,
    },
  };
}

// ------------------------------------------------------------
// CONSTANTES EXPOSEES POUR LES TESTS
// ------------------------------------------------------------

export const EVENT_VALIDATION_LIMITS = {
  RATIONALE_MIN_LENGTH,
  RATIONALE_MAX_LENGTH,
  EVENT_TYPE_MIN_LENGTH,
  EVENT_TYPE_MAX_LENGTH,
} as const;
