// API : creation d une organisation lors de l onboarding.
// L user authentifie cree son org, devient automatiquement admin.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAuthEnabled } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: 'Auth desactivee' }, { status: 400 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
  }
  if (name.length > 120) {
    return NextResponse.json({ error: 'Nom trop long (max 120)' }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Empeche un user de creer plus d une org pour limiter les abus en MVP.
  // Plus tard on pourra autoriser N orgs avec selecteur.
  const { data: existing } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'Vous appartenez deja a une organisation' },
      { status: 409 },
    );
  }

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ name, owner_id: user.id })
    .select('id, name')
    .single();
  if (orgErr || !org) {
    console.error('Failed to create org:', orgErr);
    return NextResponse.json({ error: 'Creation echouee' }, { status: 500 });
  }

  const { error: memberErr } = await admin.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'admin',
  });
  if (memberErr) {
    console.error('Failed to create membership:', memberErr);
    // Cleanup pour eviter une org orpheline
    await admin.from('organizations').delete().eq('id', org.id);
    return NextResponse.json({ error: 'Creation echouee' }, { status: 500 });
  }

  return NextResponse.json({ id: org.id, name: org.name });
}
