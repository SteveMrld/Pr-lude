-- ============================================================
-- PRELUDE COLLABORATION SCHEMA (chantier multi-utilisateurs)
-- A executer dans le SQL Editor de Supabase, apres
-- supabase-auth-schema.sql et supabase-byok-schema.sql.
-- Idempotent : peut etre rejoue sans casse.
--
-- Cree les tables qui transforment Prelude d un outil mono-utilisateur
-- en une infrastructure d instruction partagee dans un fonds :
--   - analyses_workflow_status : ou en est le dossier dans le rituel
--     d instruction (depose, en revue, DD terrain, IC, signe, refuse)
--   - analyses_workflow_history : trace de qui a fait avancer le stage
--   - analyses_versions : snapshots JSON complets des analyses, pour
--     comparer les notes apres un re-run sur deck v2 vs v1
--   - analyses_annotations : commentaires partages par section,
--     resolus ou non. Construit la memoire vivante du dossier.
--
-- Ajoute aussi organization_id sur la table analyses pour scoper
-- l acces a un fonds. Le filtrage par org se fait au niveau applicatif
-- via service_role (cf lib/analysis-store.ts), comme pour prelude_jobs.
-- ============================================================

-- ------------------------------------------------------------
-- ANALYSES : ajout de organization_id (nullable pour back-compat).
-- Les analyses creees en mode solo restent accessibles, leur org_id
-- reste null. Les nouvelles analyses creees en mode auth auront
-- systematiquement un org_id, et seront partagees entre membres.
-- ------------------------------------------------------------
alter table public.analyses
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_analyses_organization
  on public.analyses (organization_id, created_at desc);

create index if not exists idx_analyses_org_verdict
  on public.analyses (organization_id, verdict, created_at desc);

-- ------------------------------------------------------------
-- ANALYSES_WORKFLOW_STATUS : ou en est le dossier.
-- Une seule ligne par analyse. Mise a jour in-place, l historique
-- est trace dans analyses_workflow_history.
--
-- Stages :
--   deposited  : le pitch deck vient d arriver, pas encore instruit
--   in_review  : Prelude a tourne, instruction analytique en cours
--   dd_field   : DD terrain en cours (appels reference, site visit)
--   ic_review  : pret a presenter au comite d investissement
--   signed     : terme sheet signe, deal closed
--   declined   : refuse (avec ou sans conditions sur retour ulterieur)
-- ------------------------------------------------------------
create table if not exists public.analyses_workflow_status (
  analysis_id uuid primary key references public.analyses(id) on delete cascade,
  stage text not null default 'in_review' check (stage in (
    'deposited', 'in_review', 'dd_field', 'ic_review', 'signed', 'declined'
  )),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_analyses_workflow_status_stage
  on public.analyses_workflow_status (stage, updated_at desc);

-- ------------------------------------------------------------
-- ANALYSES_WORKFLOW_HISTORY : trace de chaque transition.
-- Permet de repondre : qui a marque ce dossier comme refuse
-- et avec quelle motivation. Utile pour le rapport semestriel
-- de discipline d instruction du fonds.
-- ------------------------------------------------------------
create table if not exists public.analyses_workflow_history (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  comment text
);

create index if not exists idx_analyses_workflow_history_analysis
  on public.analyses_workflow_history (analysis_id, changed_at desc);

-- ------------------------------------------------------------
-- ANALYSES_VERSIONS : snapshots JSON complets.
-- Quand un fondateur envoie un nouveau deck et qu on re-run le
-- pipeline, on garde la version precedente pour comparer.
-- Cout estime : ~200 KB par snapshot. Pour un fonds qui instruit
-- 500 dossiers/an avec 1.5 versions en moyenne, c est 150 MB/an,
-- largement gerable par Supabase Free.
--
-- version_num est croissant a partir de 1. La derniere version
-- correspond aussi au resultJson stocke en colonne sur analyses
-- (duplication assumee pour simplifier les lectures dashboard).
-- ------------------------------------------------------------
create table if not exists public.analyses_versions (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  version_num integer not null,
  snapshot_json jsonb not null,
  source_filename text,
  pipeline_duration_ms integer,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  note text,
  unique (analysis_id, version_num)
);

create index if not exists idx_analyses_versions_analysis
  on public.analyses_versions (analysis_id, version_num desc);

-- ------------------------------------------------------------
-- ANALYSES_ANNOTATIONS : commentaires partages.
-- section_id correspond a un identifiant logique de section UI :
--   synthesis, dimensions, team, verified, market, macro,
--   financial, pattern, aveuglement, singularite, blindspots,
--   risksplan, refchecks, instruction, ic-pack
-- paragraph_anchor (optionnel) permet plus tard d ancrer un
-- commentaire a un paragraphe precis (ex 'argumentation-p3').
--
-- resolved_at + resolved_by : marquer un commentaire comme adresse,
-- pour ne pas l afficher dans la vue active. Permet a un partner
-- de cocher "j ai pris en compte cette remarque" sans effacer.
-- ------------------------------------------------------------
create table if not exists public.analyses_annotations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  section_id text not null,
  paragraph_anchor text,
  body text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_analyses_annotations_analysis
  on public.analyses_annotations (analysis_id, section_id, created_at desc);

create index if not exists idx_analyses_annotations_open
  on public.analyses_annotations (analysis_id) where resolved_at is null;

-- ------------------------------------------------------------
-- RLS : on suit le pattern des autres tables Prelude.
-- L acces direct cote client browser est bloque ; les Route
-- Handlers passent par le service_role et appliquent le filtrage
-- par organization_id au niveau applicatif (cf middleware + auth helpers).
-- ------------------------------------------------------------

alter table public.analyses_workflow_status enable row level security;
alter table public.analyses_workflow_history enable row level security;
alter table public.analyses_versions enable row level security;
alter table public.analyses_annotations enable row level security;

drop policy if exists "no_client_access_workflow_status" on public.analyses_workflow_status;
create policy "no_client_access_workflow_status"
  on public.analyses_workflow_status for all
  using (false);

drop policy if exists "no_client_access_workflow_history" on public.analyses_workflow_history;
create policy "no_client_access_workflow_history"
  on public.analyses_workflow_history for all
  using (false);

drop policy if exists "no_client_access_versions" on public.analyses_versions;
create policy "no_client_access_versions"
  on public.analyses_versions for all
  using (false);

drop policy if exists "no_client_access_annotations" on public.analyses_annotations;
create policy "no_client_access_annotations"
  on public.analyses_annotations for all
  using (false);

-- ------------------------------------------------------------
-- Trigger updated_at automatique sur workflow_status.
-- Reutilise la fonction set_updated_at definie dans byok-schema.
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_analyses_workflow_status_updated_at on public.analyses_workflow_status;
create trigger trg_analyses_workflow_status_updated_at
  before update on public.analyses_workflow_status
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- BACKFILL : pour chaque analyse existante, on cree une entree
-- workflow_status par defaut a in_review, et une version v1 qui
-- contient le result_json actuel comme snapshot historique.
-- Idempotent : on ne backfille que ce qui n existe pas deja.
-- ------------------------------------------------------------

insert into public.analyses_workflow_status (analysis_id, stage)
select a.id, 'in_review'
from public.analyses a
left join public.analyses_workflow_status w on w.analysis_id = a.id
where w.analysis_id is null;

insert into public.analyses_versions (
  analysis_id, version_num, snapshot_json, source_filename,
  pipeline_duration_ms, created_at, note
)
select
  a.id,
  1,
  a.result_json,
  a.source_filename,
  a.pipeline_duration_ms,
  a.created_at,
  'Version initiale (backfill)'
from public.analyses a
left join public.analyses_versions v
  on v.analysis_id = a.id and v.version_num = 1
where v.id is null
  and a.result_json is not null;
