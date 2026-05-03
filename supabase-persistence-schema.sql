-- ============================================================
-- PRELUDE - Schema persistence des analyses
-- ------------------------------------------------------------
-- Stocke chaque analyse complete produite par le pipeline
-- (12 moteurs + recommandation finale + scoring) avec metadonnees
-- pour permettre :
--   - Recherche par societe / secteur / verdict / date
--   - Restauration d une analyse passee dans l UI
--   - Statistiques sur les patterns de verdicts
--   - Base de travail pour les niveaux superieurs (RAG, feedback,
--     Discovery Engine VC)
--
-- A executer dans le SQL Editor de Supabase apres avoir applique
-- supabase-auth-schema.sql.
--
-- RLS : chaque utilisateur ne voit que ses propres analyses.
-- Le service-role bypasse RLS pour les jobs systeme.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analyses (
  -- Identifiants
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metadonnees rapides (pour requeter sans charger result_json)
  company_name TEXT NOT NULL,
  sector TEXT,
  sub_sector TEXT,
  country TEXT,
  geographic_hub TEXT,
  year_founded INTEGER,
  round_type TEXT,                        -- Series A, Seed, Pre-Series A, etc.
  round_amount_eur NUMERIC,               -- montant declare en EUR (si extrait)

  -- Verdict + scoring (extraits pour requete rapide)
  verdict TEXT NOT NULL,                  -- 'investir' | 'investir-conditions' | 'approfondir' | 'refuser'
  verdict_confidence NUMERIC,             -- 0-100
  global_score NUMERIC,                   -- 0-100
  blindspot_score NUMERIC,                -- score d aveuglement
  contrarian_score NUMERIC,               -- score singularites contrariennes
  coherence_score NUMERIC,                -- score coherence financiere

  -- Le payload complet de la pipeline (12 moteurs + recommandation finale)
  -- Stocke en JSONB pour requete et indexation possibles a l avenir
  result_json JSONB NOT NULL,

  -- Snapshot du pitch deck source (texte extrait, pas le PDF brut)
  -- Permet de re-traiter une analyse sans re-uploader le deck
  source_text TEXT,
  source_filename TEXT,
  source_pages INTEGER,

  -- Timing pipeline (pour debug et stats perfs)
  pipeline_duration_ms INTEGER,
  pipeline_engines_status JSONB,          -- { team: 'ok', market: 'fallback', ... }

  -- Notes utilisateur libres (pour annotations rapides)
  user_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEX
-- ------------------------------------------------------------
-- Optimises pour les patterns de requete previsibles :
--   1) Liste des analyses d un user, ordonnees par date
--   2) Recherche par nom de societe (autocomplete)
--   3) Filtre par verdict + secteur (vue stats)
-- ============================================================

CREATE INDEX IF NOT EXISTS analyses_user_created_idx
  ON public.analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analyses_company_idx
  ON public.analyses (user_id, company_name);

CREATE INDEX IF NOT EXISTS analyses_verdict_sector_idx
  ON public.analyses (user_id, verdict, sector);

-- Index GIN sur result_json pour requetes JSONB futures (Niveau 2+)
CREATE INDEX IF NOT EXISTS analyses_result_gin_idx
  ON public.analyses USING GIN (result_json);

-- ============================================================
-- TRIGGER updated_at automatique
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS analyses_updated_at_trigger ON public.analyses;
CREATE TRIGGER analyses_updated_at_trigger
  BEFORE UPDATE ON public.analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_analyses_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- Chaque utilisateur ne voit/modifie que ses propres analyses.
-- Le service-role (jobs systeme, admin) bypasse ces regles.
-- ============================================================

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their own analyses"
  ON public.analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own analyses"
  ON public.analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own analyses"
  ON public.analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own analyses"
  ON public.analyses FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- VUE AGREGEE - statistiques par utilisateur
-- ------------------------------------------------------------
-- Permet a l UI de presenter rapidement des compteurs
-- (nb d analyses, repartition verdicts, secteurs principaux).
-- ============================================================

CREATE OR REPLACE VIEW public.analyses_stats AS
SELECT
  user_id,
  COUNT(*)::INTEGER AS total_count,
  COUNT(*) FILTER (WHERE verdict = 'investir')::INTEGER AS verdict_investir_count,
  COUNT(*) FILTER (WHERE verdict = 'investir-conditions')::INTEGER AS verdict_conditions_count,
  COUNT(*) FILTER (WHERE verdict = 'approfondir')::INTEGER AS verdict_approfondir_count,
  COUNT(*) FILTER (WHERE verdict = 'refuser')::INTEGER AS verdict_refuser_count,
  AVG(global_score) AS avg_global_score,
  AVG(blindspot_score) AS avg_blindspot_score,
  MAX(created_at) AS last_analysis_at
FROM public.analyses
GROUP BY user_id;
