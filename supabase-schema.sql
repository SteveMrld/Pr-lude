-- Table prelude_jobs pour le store des jobs Prélude
-- À exécuter dans le SQL Editor de Supabase une seule fois

create table if not exists public.prelude_jobs (
  id text primary key,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  engine_states jsonb not null default '{}'::jsonb,
  files_received jsonb,
  result jsonb,
  error_message text
);

create index if not exists idx_prelude_jobs_updated_at on public.prelude_jobs (updated_at desc);
create index if not exists idx_prelude_jobs_status on public.prelude_jobs (status);

-- Désactiver RLS car on accède via service_role uniquement
alter table public.prelude_jobs disable row level security;
