-- ============================================================
-- PRELUDE - Schema persistence Sectoral Intelligence Layer
-- ------------------------------------------------------------
-- Cree la table sectoral_briefs, support de la cartographie
-- sectorielle vivante du capital risque europeen. Chaque ligne
-- est une generation datee d une fiche sectorielle, structuree
-- autour de huit dimensions standardisees (intensite
-- capitalistique, pression reglementaire, velocite technologique,
-- concentration concurrentielle, cyclicite macroeconomique,
-- exposition geopolitique, tension capital-talent, vulnerabilite
-- narrative sectorielle).
--
-- L historique est conserve integralement sans suppression : la
-- comparaison T versus T-12 mois est l un des trois usages
-- prioritaires de la spider chart, et l archive elle-meme
-- constitue a terme un corpus exploitable.
--
-- A executer manuellement dans le SQL Editor de Supabase apres
-- validation produit. Ne s execute pas automatiquement dans la
-- pipeline de migration. Dependances minimales : aucune table
-- existante (sectoral_briefs est autonome).
-- ============================================================

-- Extension pg_trgm necessaire pour la recherche textuelle sur
-- narrative_summary. Idempotent.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- TABLE : sectoral_briefs
-- Chaque ligne est une generation datee d une fiche sectorielle.
-- Le champ dimensions JSONB porte huit entrees nominatives, une
-- par dimension standardisee. La structure attendue pour chaque
-- entree est la suivante :
--   {
--     "score": 0..100 ou null si data_missing,
--     "definition_applied": text (definition appliquee a la
--       generation, conservee pour audit doctrinal),
--     "sources_cited": [ { "url": text, "title": text,
--       "accessed_at": iso-date, "quote": text optionnel } ],
--     "confidence": "high" | "medium" | "low" | "data_missing"
--   }
-- Les huit cles attendues sont :
--   intensite_capitalistique, pression_reglementaire,
--   velocite_technologique, concentration_concurrentielle,
--   cyclicite_macroeconomique, exposition_geopolitique,
--   tension_capital_talent, vulnerabilite_narrative_sectorielle
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sectoral_briefs (
  -- Identifiants
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_slug text NOT NULL,

  -- Temporalite de la generation
  generated_at timestamptz NOT NULL DEFAULT now(),

  -- Huit dimensions standardisees, structure decrite ci-dessus
  dimensions jsonb NOT NULL,

  -- Resume editorial Le Grand Continent, ~1500 caracteres,
  -- injecte en tete de prompt pour tous les moteurs sectoriels.
  narrative_summary text NOT NULL,

  -- Mode de declenchement de la regeneration. cron = cycle
  -- trimestriel automatique, manual = admin trigger, event =
  -- regeneration evenementielle apres choc externe.
  regeneration_trigger text NOT NULL,

  -- Reference a la fiche precedente du meme secteur. Permet la
  -- comparaison T versus T-12 mois sans agregation cross-row.
  -- Null pour la premiere fiche d un secteur.
  supersedes_id uuid REFERENCES public.sectoral_briefs(id) ON DELETE SET NULL,

  -- Metadonnees de generation : modele LLM utilise, version du
  -- prompt, cout en dollars, duree, dimensions regenerees
  -- (utile pour les regenerations surgicales dimension-par-dimension).
  -- Structure attendue :
  --   {
  --     "model": "claude-opus-4-7" | "claude-sonnet-4-6",
  --     "prompt_version": text,
  --     "cost_usd": numeric,
  --     "duration_ms": integer,
  --     "dimensions_regenerated": [ text ] (huit si fiche
  --       complete, sous-ensemble si regeneration surgicale)
  --   }
  generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps systeme
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Garde-fou doctrinal : un trigger sain ne doit prendre que
  -- les trois valeurs prevues.
  CONSTRAINT sectoral_briefs_trigger_check
    CHECK (regeneration_trigger IN ('cron', 'manual', 'event'))
);

-- ------------------------------------------------------------
-- INDEX
-- L index composite (sector_slug, generated_at DESC) sert le
-- pattern de requete dominant : "donne-moi la derniere fiche du
-- secteur X" ou "donne-moi les N dernieres fiches du secteur X".
-- L index sur generated_at seul sert les requetes cross-sector
-- ("toutes les fiches generees au trimestre Q2 2026").
-- L index trigram sur narrative_summary permet une recherche
-- textuelle fuzzy ("quelles fiches mentionnent SVB").
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sectoral_briefs_sector_time_idx
  ON public.sectoral_briefs (sector_slug, generated_at DESC);

CREATE INDEX IF NOT EXISTS sectoral_briefs_generated_at_idx
  ON public.sectoral_briefs (generated_at DESC);

CREATE INDEX IF NOT EXISTS sectoral_briefs_narrative_trgm_idx
  ON public.sectoral_briefs USING GIN (narrative_summary gin_trgm_ops);

-- Index GIN sur dimensions pour les requetes du genre "toutes
-- les fiches ou la dimension pression_reglementaire depasse 70".
CREATE INDEX IF NOT EXISTS sectoral_briefs_dimensions_gin
  ON public.sectoral_briefs USING GIN (dimensions);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Acces direct client bloque. Les Route Handlers passent par
-- service_role, comme pour les autres tables Prelude.
-- ------------------------------------------------------------
ALTER TABLE public.sectoral_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_client_access_sectoral_briefs" ON public.sectoral_briefs;
CREATE POLICY "no_client_access_sectoral_briefs"
  ON public.sectoral_briefs FOR ALL
  USING (false);

-- ------------------------------------------------------------
-- VUE UTILITAIRE : derniere fiche par secteur
-- Vue materialisable en lecture frequente cote API pour eviter
-- de scanner sectoral_briefs entiere a chaque appel d injection
-- au pipeline. La vue retourne la derniere generation par
-- sector_slug en s appuyant sur l index composite.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.sectoral_briefs_latest AS
SELECT DISTINCT ON (sector_slug)
  id,
  sector_slug,
  generated_at,
  dimensions,
  narrative_summary,
  regeneration_trigger,
  supersedes_id,
  generation_metadata,
  created_at
FROM public.sectoral_briefs
ORDER BY sector_slug, generated_at DESC;

-- ------------------------------------------------------------
-- FONCTION UTILITAIRE : recuperer la fiche d il y a N mois
-- Sert l usage prioritaire "comparaison T versus T-12 mois" du
-- spider chart sans logique applicative.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sectoral_brief_at(
  p_sector_slug text,
  p_target_date timestamptz
)
RETURNS public.sectoral_briefs AS $$
  SELECT *
  FROM public.sectoral_briefs
  WHERE sector_slug = p_sector_slug
    AND generated_at <= p_target_date
  ORDER BY generated_at DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;
