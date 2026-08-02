-- ============================================================
-- PRELUDE - Provenance de l ancre temporelle (as_of_source)
-- ------------------------------------------------------------
-- La colonne as_of porte deux choses qui ne sont pas la meme :
-- une date de reception du dossier saisie par le partner, et une
-- date d ingestion de corpus posee par script. Les vingt-six
-- lignes qui portaient un as_of avant cette migration valent
-- toutes 2026-06-08, jour de l ingestion de la campagne, et non
-- une date propre a chaque dossier.
--
-- La regle de millesime du moteur de valorisation s ancrait
-- indifferemment sur les deux, ce qui attribuait a un memorandum
-- de 2017 une reception en juin 2026 et produisait neuf ans
-- d ecart entre l ancre et le millesime retenu.
--
-- On ne vide pas as_of : un champ vide serait indistinguable
-- d une donnee jamais collectee, et l information de campagne a
-- sa valeur pour la tracabilite de l ingestion. On la qualifie.
-- La branche 2 du moteur n accepte de s ancrer que sur
-- 'deck-receipt' ; 'corpus-ingestion' et NULL conduisent au refus
-- motive. Le comportement devient explicite au lieu d etre
-- silencieusement faux.
--
-- A executer dans le SQL Editor de Supabase.
-- Idempotent : peut etre rejoue sans casse.
-- ============================================================

alter table public.analyses
  add column if not exists as_of_source text;

alter table public.analyses
  drop constraint if exists analyses_as_of_source_check;

alter table public.analyses
  add constraint analyses_as_of_source_check
  check (as_of_source is null or as_of_source in ('deck-receipt', 'corpus-ingestion'));

-- Backfill. Toutes les lignes qui portent deja un as_of viennent de
-- l ingestion corpus : les analyses lancees depuis l interface n en
-- portaient aucun, l interface ne collectant pas ce champ avant le
-- present chantier. La condition sur as_of_source rend le backfill
-- rejouable sans ecraser une valeur posee depuis.
update public.analyses
   set as_of_source = 'corpus-ingestion'
 where as_of is not null
   and as_of_source is null;

comment on column public.analyses.as_of_source is
  'Provenance de as_of : deck-receipt (saisie partner en page d entree) ou corpus-ingestion (constante de campagne). Seul deck-receipt peut ancrer la regle de millesime du moteur de valorisation.';
