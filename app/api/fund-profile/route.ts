// API : profil fonds d une organisation.
//   GET  /api/fund-profile  -> recupere le profil de l org courante (null si jamais configure)
//   PUT  /api/fund-profile  -> cree ou met a jour le profil de l org courante
//
// Lecture : tout membre de l org peut lire (pour visualiser la these).
// Ecriture : seul un admin de l org peut modifier.
//
// En mode auth desactivee (ENABLE_AUTH != 'true'), l API renvoie 400 :
// le profil fonds n a de sens que dans un contexte multi-tenant.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FundProfileRow {
  organization_id: string;
  sectors_focus: string[];
  sectors_excluded: string[];
  geographies_focus: string[];
  geographies_excluded: string[];
  ticket_min_eur: number | null;
  ticket_max_eur: number | null;
  stages_focus: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

function rowToProfile(row: FundProfileRow) {
  return {
    organizationId: row.organization_id,
    sectorsFocus: row.sectors_focus || [],
    sectorsExcluded: row.sectors_excluded || [],
    geographiesFocus: row.geographies_focus || [],
    geographiesExcluded: row.geographies_excluded || [],
    ticketMinEur: row.ticket_min_eur,
    ticketMaxEur: row.ticket_max_eur,
    stagesFocus: row.stages_focus || [],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'Le profil fonds requiert l authentification' },
      { status: 400 },
    );
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('fund_profiles')
    .select('*')
    .eq('organization_id', ctx.org.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    // Pas encore configure : on renvoie null pour que l UI ouvre l ecran
    // de saisie initiale.
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile: rowToProfile(data as FundProfileRow) });
}

export async function PUT(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: 'Le profil fonds requiert l authentification' },
      { status: 400 },
    );
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  if (ctx.org.role !== 'admin') {
    return NextResponse.json(
      { error: 'Seul un administrateur de l organisation peut modifier la these du fonds' },
      { status: 403 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 });
  }

  // Validation legere : on accepte des tableaux vides (fonds generaliste)
  // et des nombres null (pas de borne ticket). On force les types.
  const sectorsFocus = Array.isArray(body.sectorsFocus)
    ? body.sectorsFocus.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean)
    : [];
  const sectorsExcluded = Array.isArray(body.sectorsExcluded)
    ? body.sectorsExcluded.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean)
    : [];
  const geographiesFocus = Array.isArray(body.geographiesFocus)
    ? body.geographiesFocus.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean)
    : [];
  const geographiesExcluded = Array.isArray(body.geographiesExcluded)
    ? body.geographiesExcluded.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean)
    : [];
  const ticketMinEur = typeof body.ticketMinEur === 'number' && body.ticketMinEur > 0
    ? Math.round(body.ticketMinEur)
    : null;
  const ticketMaxEur = typeof body.ticketMaxEur === 'number' && body.ticketMaxEur > 0
    ? Math.round(body.ticketMaxEur)
    : null;
  const stagesFocus = Array.isArray(body.stagesFocus)
    ? body.stagesFocus.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean)
    : [];
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;

  // Coherence ticket : si min > max on rejette pour eviter une these
  // ininterpretable par le pre-scan.
  if (ticketMinEur !== null && ticketMaxEur !== null && ticketMinEur > ticketMaxEur) {
    return NextResponse.json(
      { error: 'Le ticket minimum ne peut pas etre superieur au ticket maximum' },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  const upsertPayload = {
    organization_id: ctx.org.id,
    sectors_focus: sectorsFocus,
    sectors_excluded: sectorsExcluded,
    geographies_focus: geographiesFocus,
    geographies_excluded: geographiesExcluded,
    ticket_min_eur: ticketMinEur,
    ticket_max_eur: ticketMaxEur,
    stages_focus: stagesFocus,
    notes,
    updated_by: ctx.user.id,
  };

  const { data, error } = await admin
    .from('fund_profiles')
    .upsert(upsertPayload, { onConflict: 'organization_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: rowToProfile(data as FundProfileRow) });
}
