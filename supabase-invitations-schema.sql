-- ============================================================
-- PRELUDE INVITATIONS SCHEMA
-- A executer dans le SQL Editor de Supabase, apres supabase-auth-schema.sql.
-- Idempotent : peut etre rejoue sans casse.
--
-- Cree la table organization_invitations qui permet a un admin d inviter
-- un email dans son organisation. L invitation est consommee a la
-- prochaine connexion de l email invite (cf /onboarding).
-- Pas d envoi d email transactionnel pour l instant : l admin previent son
-- collegue via le canal de son choix (Slack, email perso). L invitation
-- materialise simplement le pre-droit d acces.
-- ============================================================

create table if not exists public.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Email en lowercase pour le matching exact a la connexion. On stocke
  -- aussi l email tel qu il a ete saisi pour l affichage (preserve casse).
  email_lc        text not null,
  email_display   text not null,
  role            text not null default 'member' check (role in ('admin', 'member')),
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id) on delete set null,
  revoked_at      timestamptz,
  revoked_by      uuid references auth.users(id) on delete set null
);

-- Une seule invitation pending a la fois pour un (org, email) donne.
-- Les invitations accepted/revoked s accumulent comme historique, sans contrainte.
create unique index if not exists uniq_pending_invitation_per_email
  on public.organization_invitations (organization_id, email_lc)
  where status = 'pending';

create index if not exists idx_invitations_email_lc
  on public.organization_invitations (email_lc);

create index if not exists idx_invitations_org
  on public.organization_invitations (organization_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.organization_invitations enable row level security;

-- Un admin de l organisation peut lire toutes les invitations de son org.
drop policy if exists "admins_can_read_org_invitations" on public.organization_invitations;
create policy "admins_can_read_org_invitations"
  on public.organization_invitations for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_invitations.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

-- Un user peut lire les invitations qui pointent vers son propre email
-- (utile pour afficher "Vous avez ete invite par X" a l arrivee sur l onboarding).
-- Le matching se fait email_lc = lower(auth.jwt()->>'email').
drop policy if exists "users_can_read_their_own_invitations" on public.organization_invitations;
create policy "users_can_read_their_own_invitations"
  on public.organization_invitations for select
  using (
    email_lc = lower(coalesce(auth.jwt()->>'email', ''))
  );

-- Pas de policies insert/update/delete : toutes les ecritures passent par
-- les Route Handlers en service_role, qui appliquent les regles metier
-- (verification du role admin, validation de l email, etc.).
