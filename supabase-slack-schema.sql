-- ============================================================
-- PRELUDE SLACK INTEGRATION SCHEMA
-- A executer dans le SQL Editor de Supabase, apres les blocs
-- precedents (auth, byok, collaboration).
-- Idempotent : peut etre rejoue sans casse.
--
-- Stocke la configuration Slack par organisation : webhook URL,
-- channel par defaut, niveau d alertes, mention du partner principal.
-- Une seule ligne par organization (cle primaire = organization_id).
--
-- Le webhook URL est sensible : il permet a quiconque le possede
-- de poster des messages dans le channel du fonds. RLS bloque
-- l acces direct cote client, l ecriture passe par service_role
-- via l API /api/slack/config.
-- ============================================================

create table if not exists public.organization_slack_config (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  webhook_url text not null,
  channel_name text,
  default_partner_mention text,
  alert_threshold_score integer default 50 check (alert_threshold_score between 0 and 100),
  notify_on_critical_verdict boolean not null default true,
  notify_on_high_blindspot boolean not null default true,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_test_at timestamptz,
  last_test_ok boolean
);

create index if not exists idx_org_slack_enabled
  on public.organization_slack_config (organization_id) where enabled = true;

alter table public.organization_slack_config enable row level security;

drop policy if exists "no_client_access_slack_config" on public.organization_slack_config;
create policy "no_client_access_slack_config"
  on public.organization_slack_config for all
  using (false);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_organization_slack_config_updated_at on public.organization_slack_config;
create trigger trg_organization_slack_config_updated_at
  before update on public.organization_slack_config
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Table de log des notifications envoyees pour audit / debug.
-- Permet de retrouver pourquoi tel dossier n a pas declenche
-- de notification, ou au contraire pourquoi une alerte s est
-- declenchee a tort. TTL implicite : 90 jours via index partiel
-- (purge a faire en cron plus tard si volume eleve).
-- ------------------------------------------------------------
create table if not exists public.slack_notifications_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  notification_type text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  http_status integer,
  error_message text,
  payload_summary jsonb,
  sent_at timestamptz not null default now()
);

create index if not exists idx_slack_log_org_recent
  on public.slack_notifications_log (organization_id, sent_at desc);

alter table public.slack_notifications_log enable row level security;

drop policy if exists "no_client_access_slack_log" on public.slack_notifications_log;
create policy "no_client_access_slack_log"
  on public.slack_notifications_log for all
  using (false);
