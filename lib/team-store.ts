// ============================================================
// TEAM STORE
// ------------------------------------------------------------
// Gestion des membres d une organisation et des invitations.
//
// Membres : lecture, suppression, changement de role. Toutes les
// ecritures verifient en amont le role admin de l appelant cote
// Route Handler (le store fait confiance a son appelant).
//
// Invitations : creation par un admin, lecture, revocation,
// consommation a la connexion. Pas d envoi d email transactionnel
// pour le MVP : l invitation materialise un pre-droit d acces que
// l invite consomme a sa premiere arrivee sur /onboarding.
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';

export type OrgRole = 'admin' | 'member';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface OrgMember {
  userId: string;
  email: string | null;
  role: OrgRole;
  joinedAt: string;
}

export interface OrgInvitation {
  id: string;
  organizationId: string;
  emailDisplay: string;
  emailLc: string;
  role: OrgRole;
  status: InvitationStatus;
  invitedBy: string | null;
  invitedByEmail: string | null;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const lc = normalizeEmail(raw);
  if (!lc) return false;
  if (lc.length > 320) return false;
  return EMAIL_REGEX.test(lc);
}

// ------------------------------------------------------------
// MEMBRES
// ------------------------------------------------------------

export async function listOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('organization_members')
    .select('user_id, role, joined_at')
    .eq('organization_id', organizationId)
    .order('joined_at', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[team] listOrgMembers error:', error);
    return [];
  }

  // Enrichir avec emails (best effort, comme ic-votes-store).
  const emailMap = new Map<string, string>();
  for (const row of data) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(row.user_id);
      if (u?.user?.email) emailMap.set(row.user_id, u.user.email);
    } catch (err) {
      console.warn('[team] enrich email failed for', row.user_id, err);
    }
  }

  return data.map((row: any) => ({
    userId: row.user_id,
    email: emailMap.get(row.user_id) || null,
    role: row.role as OrgRole,
    joinedAt: row.joined_at,
  }));
}

export async function removeOrgMember(params: {
  organizationId: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('organization_members')
    .delete()
    .eq('organization_id', params.organizationId)
    .eq('user_id', params.userId);
  if (error) {
    console.error('[team] removeOrgMember error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateOrgMemberRole(params: {
  organizationId: string;
  userId: string;
  role: OrgRole;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('organization_members')
    .update({ role: params.role })
    .eq('organization_id', params.organizationId)
    .eq('user_id', params.userId);
  if (error) {
    console.error('[team] updateOrgMemberRole error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function countOrgAdmins(organizationId: string): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { count, error } = await admin
    .from('organization_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('role', 'admin');
  if (error) {
    console.warn('[team] countOrgAdmins error:', error);
    return 0;
  }
  return count || 0;
}

// ------------------------------------------------------------
// INVITATIONS
// ------------------------------------------------------------

export async function listOrgInvitations(
  organizationId: string,
  opts: { onlyPending?: boolean } = {},
): Promise<OrgInvitation[]> {
  const admin = getSupabaseAdminClient();
  let query = admin
    .from('organization_invitations')
    .select('id, organization_id, email_lc, email_display, role, status, invited_by, created_at, accepted_at, revoked_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (opts.onlyPending) {
    query = query.eq('status', 'pending');
  }
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.warn('[team] listOrgInvitations error:', error);
    return [];
  }

  // Enrichir avec l email de l inviteur (best effort).
  const inviterIds = Array.from(new Set(data.map((r: any) => r.invited_by).filter(Boolean)));
  const inviterEmails = new Map<string, string>();
  for (const uid of inviterIds) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) inviterEmails.set(uid, u.user.email);
    } catch (err) {
      // non fatal
    }
  }

  return data.map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    emailDisplay: row.email_display,
    emailLc: row.email_lc,
    role: row.role as OrgRole,
    status: row.status as InvitationStatus,
    invitedBy: row.invited_by,
    invitedByEmail: row.invited_by ? inviterEmails.get(row.invited_by) || null : null,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  }));
}

export async function listInvitationsForEmail(emailLc: string): Promise<OrgInvitation[]> {
  if (!emailLc) return [];
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('organization_invitations')
    .select('id, organization_id, email_lc, email_display, role, status, invited_by, created_at, accepted_at, revoked_at')
    .eq('email_lc', emailLc)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error || !data) {
    if (error) console.warn('[team] listInvitationsForEmail error:', error);
    return [];
  }

  // On joint le nom de l org pour pouvoir afficher Vous avez ete invite par X
  // a rejoindre [Eurazeo] sans round-trip supplementaire cote client.
  const orgIds = Array.from(new Set(data.map((r: any) => r.organization_id)));
  const orgNames = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await admin
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);
    for (const o of orgs || []) orgNames.set(o.id, o.name);
  }

  // Et les emails des inviteurs.
  const inviterIds = Array.from(new Set(data.map((r: any) => r.invited_by).filter(Boolean)));
  const inviterEmails = new Map<string, string>();
  for (const uid of inviterIds) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) inviterEmails.set(uid, u.user.email);
    } catch (err) {
      // non fatal
    }
  }

  return data.map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    emailDisplay: row.email_display,
    emailLc: row.email_lc,
    role: row.role as OrgRole,
    status: row.status as InvitationStatus,
    invitedBy: row.invited_by,
    invitedByEmail: row.invited_by ? inviterEmails.get(row.invited_by) || null : null,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    // Champ supplementaire injecte pour l affichage onboarding.
    organizationName: orgNames.get(row.organization_id) || null,
  }) as OrgInvitation & { organizationName: string | null });
}

export async function createInvitation(params: {
  organizationId: string;
  emailRaw: string;
  role: OrgRole;
  invitedBy: string;
}): Promise<{ ok: boolean; invitation?: OrgInvitation; error?: string }> {
  if (!isValidEmail(params.emailRaw)) {
    return { ok: false, error: 'Email invalide' };
  }
  if (params.role !== 'admin' && params.role !== 'member') {
    return { ok: false, error: 'Role invalide' };
  }

  const emailLc = normalizeEmail(params.emailRaw);
  const emailDisplay = params.emailRaw.trim();
  const admin = getSupabaseAdminClient();

  // Verifier qu un membre actif avec cet email n existe pas deja dans l org.
  // L API listUsers est paginee : on ne va pas au-dela de 200 pour un MVP,
  // largement suffisant pour des fonds de quelques dizaines de personnes.
  const listResp: any = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users: Array<{ id: string; email?: string | null }> = listResp?.data?.users || listResp?.users || [];
  const matchingUser = users.find(
    (u) => (u.email || '').toLowerCase() === emailLc,
  );
  if (matchingUser) {
    const { data: existingMember } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', params.organizationId)
      .eq('user_id', matchingUser.id)
      .maybeSingle();
    if (existingMember) {
      return { ok: false, error: 'Cet email est deja membre de l organisation' };
    }
  }

  const { data, error } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: params.organizationId,
      email_lc: emailLc,
      email_display: emailDisplay,
      role: params.role,
      invited_by: params.invitedBy,
    })
    .select('id, organization_id, email_lc, email_display, role, status, invited_by, created_at, accepted_at, revoked_at')
    .single();

  if (error || !data) {
    // Code 23505 = unique violation, l invitation pending existe deja.
    if (error?.code === '23505') {
      return { ok: false, error: 'Une invitation est deja en attente pour cet email' };
    }
    console.error('[team] createInvitation error:', error);
    return { ok: false, error: error?.message || 'Echec creation' };
  }

  return {
    ok: true,
    invitation: {
      id: data.id,
      organizationId: data.organization_id,
      emailDisplay: data.email_display,
      emailLc: data.email_lc,
      role: data.role as OrgRole,
      status: data.status as InvitationStatus,
      invitedBy: data.invited_by,
      invitedByEmail: null,
      createdAt: data.created_at,
      acceptedAt: data.accepted_at,
      revokedAt: data.revoked_at,
    },
  };
}

export async function revokeInvitation(params: {
  invitationId: string;
  organizationId: string;
  revokedBy: string;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('organization_invitations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: params.revokedBy,
    })
    .eq('id', params.invitationId)
    .eq('organization_id', params.organizationId)
    .eq('status', 'pending');
  if (error) {
    console.error('[team] revokeInvitation error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Consomme une invitation pending : l accepte et cree le membership.
 * Verifie que l email de l invitation correspond bien a l email de l user.
 * Idempotent : si deja membre, no-op et marque l invitation accepted.
 */
export async function acceptInvitation(params: {
  invitationId: string;
  userId: string;
  userEmail: string;
}): Promise<{ ok: boolean; organizationId?: string; error?: string }> {
  const admin = getSupabaseAdminClient();
  const userEmailLc = normalizeEmail(params.userEmail);

  const { data: inv, error: invErr } = await admin
    .from('organization_invitations')
    .select('id, organization_id, email_lc, role, status')
    .eq('id', params.invitationId)
    .maybeSingle();
  if (invErr || !inv) {
    return { ok: false, error: 'Invitation introuvable' };
  }
  if (inv.status !== 'pending') {
    return { ok: false, error: 'Invitation deja consommee ou revoquee' };
  }
  if (inv.email_lc !== userEmailLc) {
    return { ok: false, error: 'Cette invitation ne vous est pas destinee' };
  }

  // Cree le membership si pas deja present.
  const { data: existing } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', inv.organization_id)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (!existing) {
    const { error: memberErr } = await admin.from('organization_members').insert({
      organization_id: inv.organization_id,
      user_id: params.userId,
      role: inv.role,
    });
    if (memberErr) {
      console.error('[team] acceptInvitation membership error:', memberErr);
      return { ok: false, error: 'Echec creation du membership' };
    }
  }

  const { error: updErr } = await admin
    .from('organization_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: params.userId,
    })
    .eq('id', params.invitationId);
  if (updErr) {
    console.warn('[team] acceptInvitation update status error (non-fatal):', updErr);
  }

  return { ok: true, organizationId: inv.organization_id };
}
