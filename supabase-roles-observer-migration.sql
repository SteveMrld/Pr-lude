-- ============================================================
-- PRELUDE ROLES MIGRATION : ajout du role 'observer'
-- A executer dans le SQL Editor de Supabase, apres supabase-auth-schema.sql.
-- Idempotent : peut etre rejoue sans casse.
--
-- Le role 'observer' donne acces en lecture aux dossiers, notes et
-- discussions du fonds, sans pouvoir voter au comite, modifier le
-- stade d instruction, ajouter des commentaires ou editer les notes.
-- Cas d usage : LP, comite consultatif, conseillers externes.
-- ============================================================

-- Drop l ancien check et le remplace pour autoriser observer.
alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('admin', 'member', 'observer'));

-- Idem pour les invitations.
alter table public.organization_invitations
  drop constraint if exists organization_invitations_role_check;

alter table public.organization_invitations
  add constraint organization_invitations_role_check
  check (role in ('admin', 'member', 'observer'));
