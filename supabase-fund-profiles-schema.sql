-- ============================================================
-- PRELUDE FUND PROFILES SCHEMA
-- A executer dans le SQL Editor de Supabase, apres supabase-auth-schema.sql.
-- Idempotent : peut etre rejoue sans casse.
--
-- Cree la table fund_profiles qui stocke la these d investissement
-- d un fonds (sectors, geographies, tickets, stages). Utilisee par
-- le moteur de pre-scan Bloc 0 pour evaluer le thesis_fit d un
-- dossier entrant en fonction des criteres specifiques du fonds
-- plutot que des criteres generiques universels.
--
-- Un fund_profile = une organization. Si l org change de these, on
-- met a jour la ligne. On garde une trace updated_at + updated_by
-- pour l audit.
-- ============================================================

create table if not exists public.fund_profiles (
  -- Cle primaire = l org. Une org = un profil. Si l org change de
  -- these, on update la ligne plutot que de creer une nouvelle ligne.
  organization_id  uuid primary key references public.organizations(id) on delete cascade,

  -- THESES SECTORIELLES
  -- Liste des secteurs cibles (santé, mobilité, fintech, deeptech, etc.)
  -- Vide ou null = generaliste, pas de filtre sectoriel.
  sectors_focus    text[] not null default '{}',

  -- Liste des secteurs explicitement exclus (alcool, jeu, defense pour
  -- certains fonds, fossile, etc.). Si un dossier tombe dans cette
  -- liste, c est un knockout immediat.
  sectors_excluded text[] not null default '{}',

  -- THESES GEOGRAPHIQUES
  -- Liste des zones cibles (France, EU, US, UK, MENA, etc.)
  -- Vide ou null = pas de filtre geographique.
  geographies_focus    text[] not null default '{}',

  -- Liste des zones exclues si pertinent.
  geographies_excluded text[] not null default '{}',

  -- THESES TICKETS
  -- Montants min/max que le fonds peut investir, en euros.
  -- Permet de detecter les dossiers hors gamme (un fonds qui fait
  -- du 100k-1M ne va pas regarder une seed a 10M).
  ticket_min_eur   bigint,
  ticket_max_eur   bigint,

  -- THESES STADES
  -- Liste des stades cibles (pre-seed, seed, series-a, series-b,
  -- series-c, growth, etc.). Vide = tous stades.
  stages_focus     text[] not null default '{}',

  -- METADONNEES
  -- Notes libres du gestionnaire (these elaboree, criteres d exception,
  -- nuances que l IA ne capte pas seule). Le pre-scan peut lire ce
  -- champ pour adapter son jugement.
  notes            text,

  -- Audit
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null
);

create index if not exists idx_fund_profiles_updated on public.fund_profiles (updated_at desc);

-- Trigger pour mettre a jour updated_at automatiquement.
create or replace function public.set_fund_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fund_profiles_updated_at on public.fund_profiles;
create trigger trg_fund_profiles_updated_at
  before update on public.fund_profiles
  for each row execute function public.set_fund_profiles_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Un membre de l org peut lire le profil de son org.
-- Seul un admin de l org peut le modifier.
-- ============================================================
alter table public.fund_profiles enable row level security;

-- SELECT : tout membre de l org peut lire le profil de son org
drop policy if exists fund_profiles_select_member on public.fund_profiles;
create policy fund_profiles_select_member on public.fund_profiles
  for select
  using (
    exists (
      select 1 from public.organization_members
      where organization_members.organization_id = fund_profiles.organization_id
        and organization_members.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE : seul un admin de l org peut modifier
drop policy if exists fund_profiles_modify_admin on public.fund_profiles;
create policy fund_profiles_modify_admin on public.fund_profiles
  for all
  using (
    exists (
      select 1 from public.organization_members
      where organization_members.organization_id = fund_profiles.organization_id
        and organization_members.user_id = auth.uid()
        and organization_members.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.organization_members
      where organization_members.organization_id = fund_profiles.organization_id
        and organization_members.user_id = auth.uid()
        and organization_members.role = 'admin'
    )
  );

-- Super-admins Prelude (Steve + ops) : acces a tout pour support
drop policy if exists fund_profiles_super_admin on public.fund_profiles;
create policy fund_profiles_super_admin on public.fund_profiles
  for all
  using (
    exists (
      select 1 from public.prelude_super_admins
      where user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.prelude_super_admins
      where user_id = auth.uid()
    )
  );
