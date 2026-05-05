// Helpers d auth : feature flag, recuperation de l utilisateur courant
// et de son organisation. Utilises par le middleware, les Server Components
// et les Route Handlers pour brancher la logique d acces.

import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Feature flag global. Si ENABLE_AUTH est false (ou absent), Prelude
 * fonctionne sans auth comme avant : ouvert au public, pas de notion d org.
 * Si true, toutes les routes hors landing/demo exigent un user + une org.
 *
 * Permet de deployer le code progressivement : on push, on configure
 * Supabase tranquillement, puis on flip ENABLE_AUTH=true sur Vercel.
 */
export function isAuthEnabled(): boolean {
  return process.env.ENABLE_AUTH === 'true';
}

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
}

export type OrgRole = 'admin' | 'member' | 'observer';

export interface CurrentOrganization {
  id: string;
  name: string;
  role: OrgRole;
}

/**
 * Un observateur a acces en lecture mais ne peut ni voter au comite,
 * ni modifier le stade d instruction, ni editer les notes ou commenter.
 * Les routes d ecriture sensibles doivent verifier canEdit(role) avant
 * de proceder.
 */
export function canEdit(role: OrgRole): boolean {
  return role === 'admin' || role === 'member';
}

/**
 * Seuls les admins gerent les membres, les invitations et les cles API.
 */
export function canAdminister(role: OrgRole): boolean {
  return role === 'admin';
}

/**
 * Recupere l utilisateur authentifie. Retourne null si pas de session.
 * A utiliser dans les Server Components et Route Handlers.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthEnabled()) return null;
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const meta = (user.user_metadata || {}) as Record<string, any>;
  return {
    id: user.id,
    email: user.email || '',
    displayName: typeof meta.display_name === 'string' ? meta.display_name : null,
  };
}

/**
 * Recupere l organisation courante de l utilisateur connecte.
 * Convention : un utilisateur peut appartenir a plusieurs orgs ; on prend
 * la plus recente (organization_members.joined_at desc) par defaut.
 * Plus tard on pourra ajouter un selecteur si un user appartient a plusieurs
 * fonds (cas marginal, conseiller / multi-fonds).
 */
export async function getCurrentOrganization(
  userId: string,
): Promise<CurrentOrganization | null> {
  if (!isAuthEnabled()) return null;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('organization_members')
    .select('role, joined_at, organizations:organization_id ( id, name )')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.organizations) return null;
  // Supabase typage relations : .organizations peut etre objet ou tableau
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    role: data.role as OrgRole,
  };
}

/**
 * Verifie si l utilisateur est super-admin Prelude (Steve + futurs ops).
 * Utilise pour debloquer l acces a un eventuel dashboard cross-orgs.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (!isAuthEnabled()) return false;
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('prelude_super_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Helper combine pour les Route Handlers : retourne {user, org} ou null
 * si la session est invalide ou si l user n a pas d org.
 */
export async function getAuthenticatedContext(): Promise<
  { user: CurrentUser; org: CurrentOrganization } | null
> {
  const user = await getCurrentUser();
  if (!user) return null;
  const org = await getCurrentOrganization(user.id);
  if (!org) return null;
  return { user, org };
}
