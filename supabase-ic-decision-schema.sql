-- ============================================================
-- PRELUDE IC DECISION SCHEMA
-- A executer dans le SQL Editor de Supabase, apres supabase-ic-votes-schema.sql.
-- Idempotent : peut etre rejoue sans casse.
--
-- Cree la table analyses_ic_decision qui materialise les champs
-- decisionnels du Pack IC page 3 : partner principal, date de comite,
-- resultat du vote consolide, conditions retenues. Une seule ligne par
-- analyse (PRIMARY KEY = analysis_id).
--
-- Distinct de analyses_ic_votes qui agrege les votes individuels :
-- ici on stocke le verdict final et la mise en forme officielle de la
-- decision telle qu elle figure au compte-rendu de comite.
-- ============================================================

create table if not exists public.analyses_ic_decision (
  analysis_id        uuid primary key,
  partner_principal  text,
  committee_date     date,
  vote_result        text,
  conditions         text,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null
);

-- Vote_result libre cote DB (pour ne pas bloquer une formulation
-- ad hoc), validation cote applicatif. Valeurs canoniques :
-- 'approuve', 'approuve-avec-conditions', 'reporte', 'refuse'.

create index if not exists idx_ic_decision_updated_at
  on public.analyses_ic_decision (updated_at desc);

-- Pas de RLS active : acces via service_role uniquement (Route Handler),
-- coherent avec analyses_ic_votes et prelude_jobs. Le filtrage par
-- organisation se fait au niveau applicatif.
