// API : creation d une organisation lors de l onboarding.
// L user authentifie cree son org, devient automatiquement admin.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAuthEnabled } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { logException } from '@/lib/error-logger';

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
      { error: 'Vous appartenez déjà à une organisation' },
      { status: 409 },
    );
  }

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ name, owner_id: user.id })
    .select('id, name')
    .single();
  if (orgErr || !org) {
    await logException('api.organizations.create-org', orgErr, {
      severity: 'error',
      userId: user.id,
      context: { name, phase: 'organization-insert' },
    });
    return NextResponse.json({ error: 'Creation echouee' }, { status: 500 });
  }

  const { error: memberErr } = await admin.from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'admin',
  });
  if (memberErr) {
    await logException('api.organizations.create-membership', memberErr, {
      severity: 'error',
      userId: user.id,
      organizationId: org.id,
      context: { phase: 'membership-insert', orgRolledBack: true },
    });
    // Cleanup pour eviter une org orpheline
    await admin.from('organizations').delete().eq('id', org.id);
    return NextResponse.json({ error: 'Creation echouee' }, { status: 500 });
  }

  return NextResponse.json({ id: org.id, name: org.name });
}

// ============================================================
// PATCH /api/organizations - renomme l organisation courante
// ------------------------------------------------------------
// Reserve aux admins de l org. Ne touche pas a owner_id ni aux
// memberships, modifie uniquement organizations.name.
// ============================================================
export async function PATCH(req: NextRequest) {
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

  // Recupere l org du user et verifie role admin
  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'Aucune organisation' }, { status: 404 });
  }
  if (membership.role !== 'admin') {
    return NextResponse.json(
      { error: 'Seul un admin peut renommer l organisation' },
      { status: 403 },
    );
  }

  const { data: updated, error } = await admin
    .from('organizations')
    .update({ name })
    .eq('id', membership.organization_id)
    .select('id, name')
    .single();
  if (error || !updated) {
    await logException('api.organizations.rename', error, {
      severity: 'error',
      userId: user.id,
      organizationId: membership.organization_id,
      context: { newName: name },
    });
    return NextResponse.json({ error: 'Mise a jour echouee' }, { status: 500 });
  }
  return NextResponse.json({ id: updated.id, name: updated.name });
}
