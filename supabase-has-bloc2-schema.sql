-- ============================================================
-- MIGRATION : flag has_bloc2 pour la liste d historique
-- ------------------------------------------------------------
-- Permet d afficher dans la liste d analyses lesquelles ont
-- deja eu leur DD approfondie (Bloc 2) et lesquelles attendent
-- encore. Sans ce flag, le partner doit ouvrir chaque dossier
-- pour savoir ou il en est, ce qui est de la friction inutile
-- quand on gere 5-10 dossiers en parallele.
--
-- Le flag est calcule a partir du result_json :
--   true si au moins un des outputs Bloc 2 est present :
--     - ledgerExtraction (grand livre)
--     - ddFinancial (audit financier)
--     - capTableExtraction (cap table)
--     - ddContractual (audit contractuel)
--     - ddTechnical (audit technique)
--
-- A executer une fois dans Supabase SQL Editor :
-- https://supabase.com/dashboard/project/pmcocfzpxugsftmaigil/sql/new
-- ============================================================

-- Colonne boolean avec default false (les anciens dossiers
-- restent a false jusqu au backfill ci-dessous)
alter table analyses
  add column if not exists has_bloc2 boolean default false;

-- Backfill : on parcourt les analyses existantes et on calcule
-- le flag a partir du result_json. L operateur ? teste la
-- presence d une cle dans un JSONB.
update analyses
set has_bloc2 = true
where has_bloc2 = false
  and result_json is not null
  and (
    result_json ? 'ledgerExtraction'
    or result_json ? 'ddFinancial'
    or result_json ? 'capTableExtraction'
    or result_json ? 'ddContractual'
    or result_json ? 'ddTechnical'
  );

-- Index pour acceler les filtres list par has_bloc2
create index if not exists idx_analyses_has_bloc2
  on analyses(has_bloc2)
  where has_bloc2 = true;

-- Verification : combien de dossiers ont la DD ?
-- select has_bloc2, count(*) from analyses group by has_bloc2;
