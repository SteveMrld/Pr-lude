-- ============================================================
-- PRELUDE - Corrections Security Advisor Supabase
-- ------------------------------------------------------------
-- Migration idempotente qui adresse les quatre erreurs ROUGE du
-- Security Advisor :
--
--   1. public.prelude_jobs : "RLS Disabled in Public". Table
--      orpheline (le job-store legacy a ete supprime au commit
--      38845b6 ; plus aucun call site runtime ne lit ni n ecrit
--      cette table). ENABLE RLS sans policy referme l API
--      anon/authenticated ; le service role bypasse RLS donc
--      aucun consommateur ne casse, et personne ne peut plus
--      atteindre les jobs historiques via PostgREST.
--
--   2. public.analyses_stats : "Security Definer View". Vue
--      agregeant les compteurs verdict par user_id, lue par
--      getAnalysesStats() en mode solo via service role et en
--      mode multi-user via client server authentifie. Passer en
--      security_invoker = true propage la session JWT au moment
--      du select sur public.analyses, dont la policy
--      "Users see only their own analyses" filtre correctement.
--
--   3. public.sectoral_briefs_latest : "Security Definer View".
--      Lue exclusivement via service role (inter-sector-store et
--      app/api/admin/sectoral). security_invoker = true ne
--      change rien fonctionnellement parce que le service role
--      bypasse RLS, mais l API anon/authenticated cesse de voir
--      les briefs via la vue (la table sous-jacente bloque deja
--      avec USING(false)).
--
--   4. public.inter_sectoral_briefs_latest : meme cas que 3.
--
-- Le passage en security_invoker requiert PostgreSQL 15+, ce qui
-- est garanti sur Supabase.
--
-- Les 16 warnings et la suggestion ne sont PAS traites ici. Passe
-- de durcissement separee.
-- ============================================================

-- ------------------------------------------------------------
-- 1. prelude_jobs : table orpheline, RLS sans policy
-- ------------------------------------------------------------
-- Le job-store legacy a ete supprime (commit 38845b6). La table
-- subsiste avec ses lignes historiques. ENABLE RLS sans policy
-- ferme l API publique ; les operations service role (admin,
-- scripts) continuent de fonctionner par bypass.
ALTER TABLE public.prelude_jobs ENABLE ROW LEVEL SECURITY;

-- Defensif : si une policy avait ete ajoutee dans le passe, on la
-- nettoie pour garantir l etat "RLS active, zero policy = bloque
-- tout sauf service role".
DROP POLICY IF EXISTS "prelude_jobs_anon_read" ON public.prelude_jobs;
DROP POLICY IF EXISTS "prelude_jobs_authenticated_read" ON public.prelude_jobs;
DROP POLICY IF EXISTS "prelude_jobs_authenticated_all" ON public.prelude_jobs;

-- ------------------------------------------------------------
-- 2. Vues en security_invoker = true
-- ------------------------------------------------------------
-- Sans cette option, une vue declaree en public.* tourne avec les
-- droits du creator (postgres), ce qui contourne RLS sur les
-- tables sous-jacentes. security_invoker = true force la vue a
-- s executer avec les droits du caller.
ALTER VIEW public.analyses_stats SET (security_invoker = true);
ALTER VIEW public.sectoral_briefs_latest SET (security_invoker = true);
ALTER VIEW public.inter_sectoral_briefs_latest SET (security_invoker = true);

-- ------------------------------------------------------------
-- 3. Garantir RLS actif sur les tables sous-jacentes (idempotent)
-- ------------------------------------------------------------
-- Les schemas livres activent deja RLS sur ces tables, mais on
-- repete pour que cette migration tienne meme si une base
-- divergente etait deployee.
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectoral_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_sectoral_briefs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4. Recharger le cache PostgREST
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
