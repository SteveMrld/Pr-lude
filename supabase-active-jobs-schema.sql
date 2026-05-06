-- ============================================================
-- PRELUDE - Schema active_jobs (rate limiting)
-- ------------------------------------------------------------
-- Suivi des pipelines /api/analyze en cours d execution par
-- organisation. Permet de plafonner le nombre de pipelines
-- simultanes par fonds, evitant qu un acteur malveillant ou un
-- bug client ne brule les credits Anthropic en lancant des
-- dizaines d analyses en parallele.
--
-- Le mecanisme :
--   1. Avant de lancer un pipeline, on compte les active_jobs
--      pour l org. Si >= MAX_CONCURRENT_JOBS (defaut 3), on
--      refuse avec 429.
--   2. On insere une ligne active_jobs au demarrage.
--   3. On supprime la ligne en fin de pipeline (succes ou echec).
--   4. Au demarrage de chaque appel, on purge les active_jobs
--      anciens (> 15 minutes) pour eviter qu un pipeline qui a
--      crash sans nettoyage ne bloque l org indefiniment.
--
-- A executer dans le SQL Editor de Supabase.
-- Idempotent : peut etre rejoue sans casse.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.active_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid,
  started_at timestamptz DEFAULT now() NOT NULL,
  pitch_deck_name text,
  CONSTRAINT active_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT active_jobs_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT active_jobs_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_active_jobs_org ON public.active_jobs (organization_id);
CREATE INDEX IF NOT EXISTS idx_active_jobs_started_at ON public.active_jobs (started_at);

ALTER TABLE public.active_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS active_jobs_member_read ON public.active_jobs;
CREATE POLICY active_jobs_member_read ON public.active_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = active_jobs.organization_id
        AND om.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.active_jobs IS 'Pipelines /api/analyze en cours par organisation. Sert au rate limiting et au monitoring temps reel.';
