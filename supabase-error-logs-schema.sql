-- ============================================================
-- PRELUDE - Schema monitoring d erreurs
-- ------------------------------------------------------------
-- Stocke chaque erreur capturee cote serveur (pipeline, API
-- routes, jobs). Permet de visualiser les patterns d echec en
-- prod, identifier les regressions, prioriser les correctifs.
--
-- A executer dans le SQL Editor de Supabase apres avoir applique
-- supabase-persistence-schema.sql.
--
-- RLS : seuls les super-admins peuvent lire la table. Le service-
-- role bypasse RLS pour les inserts depuis les routes API.
--
-- Idempotent : peut etre rejoue sans casse.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quand l erreur a eu lieu
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Niveau de severite. error : pipeline a echoue, action requise.
  -- warning : moteur non bloquant en echec, pipeline a continue.
  -- info : evenement notable mais pas une erreur (ex : fallback
  -- degrade pris). Permet de filtrer dans le dashboard.
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),

  -- Composant qui a leve l erreur. Convention :
  --   pipeline.<engine_id>     : un moteur Bloc 1 ou Bloc 2
  --   api.<route_path>         : une route API
  --   client.<page>            : erreur capturee cote client
  --   external.<service>       : service externe (Anthropic, Supabase)
  source TEXT NOT NULL,

  -- Message court de l erreur (1-2 lignes max)
  message TEXT NOT NULL,

  -- Stack trace ou details verbeux. Optionnel.
  stack TEXT,

  -- Contexte structure : analysis_id, user_id, file names, etc.
  -- Tout ce qui aide a reproduire ou contextualiser l erreur.
  context JSONB DEFAULT '{}'::jsonb,

  -- L organisation concernee, si identifiable. Permet de filtrer
  -- les erreurs par fonds dans le dashboard.
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- L user concerne, si identifiable.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- L analyse concernee, si la trace remonte a un dossier specifique.
  analysis_id UUID REFERENCES public.analyses(id) ON DELETE SET NULL
);

-- Index pour les queries du dashboard admin
CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at ON public.error_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs (severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON public.error_logs (source);
CREATE INDEX IF NOT EXISTS idx_error_logs_organization ON public.error_logs (organization_id);

-- RLS : seul un super-admin peut lire. Le service-role bypasse
-- pour les inserts depuis les routes API.
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS error_logs_super_admin_read ON public.error_logs;
CREATE POLICY error_logs_super_admin_read ON public.error_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.prelude_super_admins sa WHERE sa.user_id = auth.uid()
    )
  );

-- Pas de policy INSERT/UPDATE/DELETE : seul le service-role peut
-- ecrire (via getSupabaseAdminClient cote serveur).

-- Retention : on garde 90 jours par defaut. Job de purge peut etre
-- ajoute ulterieurement via pg_cron ou un endpoint admin.

COMMENT ON TABLE public.error_logs IS 'Monitoring des erreurs serveur Prelude. Lecture super-admin uniquement, ecriture service-role.';
