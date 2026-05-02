-- ============================================================
-- PRELUDE AUTH SCHEMA (commit 2a)
-- A executer dans le SQL Editor de Supabase, apres supabase-schema.sql.
-- Idempotent : peut etre rejoue sans casse.
--
-- Cree les tables organizations + organization_members + prelude_super_admins
-- et ajoute la colonne organization_id sur prelude_jobs (nullable pour
-- compat avec les jobs existants generes avant l auth).
-- ============================================================

-- ------------------------------------------------------------
-- ORGANIZATIONS : un fonds = une organisation.
-- ------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  -- owner_id : l utilisateur qui a cree l org. Garde meme si il quitte
  -- (on ne supprime pas l org automatiquement). Voir membres pour les acces.
  owner_id    uuid references auth.users(id) on delete set null
);

create index if not exists idx_organizations_owner on public.organizations (owner_id);

-- ------------------------------------------------------------
-- ORGANIZATION_MEMBERS : N-N entre users et orgs avec role.
-- Un user peut appartenir a plusieurs orgs (cas conseiller multi-fonds).
-- ------------------------------------------------------------
create table if not exists public.organization_members (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             text not null default 'member' check (role in ('admin', 'member')),
  joined_at        timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists idx_org_members_user on public.organization_members (user_id);
create index if not exists idx_org_members_org on public.organization_members (organization_id);

-- ------------------------------------------------------------
-- PRELUDE_SUPER_ADMINS : Steve + futurs ops Prelude.
-- Acces croise a toutes les orgs pour support et debug.
-- ------------------------------------------------------------
create table if not exists public.prelude_super_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  added_at    timestamptz not null default now(),
  added_by    uuid references auth.users(id) on delete set null,
  notes       text
);

-- ------------------------------------------------------------
-- PRELUDE_JOBS : ajout de organization_id pour scoper les analyses.
-- Nullable pour ne pas casser les jobs existants. Les nouveaux jobs
-- crees apres activation d ENABLE_AUTH auront systematiquement un org_id.
-- ------------------------------------------------------------
alter table public.prelude_jobs
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_prelude_jobs_organization on public.prelude_jobs (organization_id);

-- ------------------------------------------------------------
-- RLS : on garde RLS desactive sur prelude_jobs car on accede via
-- service_role uniquement (cf lib/job-store.ts). Le filtrage par org
-- se fait au niveau applicatif dans les Route Handlers.
--
-- Pour organizations et organization_members, on active RLS car ces
-- tables seront lues par le client Supabase cote browser (selecteur d org,
-- nom de l org dans le header).
-- ------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.prelude_super_admins enable row level security;

-- Un user peut lire les orgs dont il est membre.
drop policy if exists "members_can_read_their_orgs" on public.organizations;
create policy "members_can_read_their_orgs"
  on public.organizations for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

-- Un user peut lire ses propres memberships.
drop policy if exists "users_can_read_their_memberships" on public.organization_members;
create policy "users_can_read_their_memberships"
  on public.organization_members for select
  using (user_id = auth.uid());

-- Un admin de l org peut lire tous les memberships de son org.
drop policy if exists "admins_can_read_org_memberships" on public.organization_members;
create policy "admins_can_read_org_memberships"
  on public.organization_members for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

-- Personne ne lit directement la table super_admins cote client.
-- L API admin l interroge via service_role.
drop policy if exists "no_client_read_super_admins" on public.prelude_super_admins;
create policy "no_client_read_super_admins"
  on public.prelude_super_admins for select
  using (false);

-- ------------------------------------------------------------
-- COMMENT BOOTSTRAPPER STEVE COMME SUPER-ADMIN
-- Apres avoir cree son compte via le magic link sur /login :
--   1. Aller dans Authentication > Users sur Supabase
--   2. Copier l UUID du user
--   3. Executer : insert into public.prelude_super_admins (user_id, notes)
--                 values ('<uuid>', 'Steve - Founder');
-- ------------------------------------------------------------
