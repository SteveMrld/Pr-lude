-- ============================================================
-- PRELUDE - Schema persistence lecture inter-sectorielle
-- ------------------------------------------------------------
-- Cree la table inter_sectoral_briefs, sortie du sous-chantier
-- de lecture inter-sectorielle systemique. Chaque ligne est un
-- brief editorial trimestriel "Etat systemique des secteurs
-- Prelude", agregat des treize fiches sectorielles du trimestre,
-- structure autour de trois objets analytiques : convergences
-- (deux secteurs qui derivent simultanement sur meme dimension),
-- divergences (deux secteurs qui s ecartent brutalement),
-- patterns macro structurels (une dimension qui bouge sur plus
-- de la moitie des secteurs).
--
-- L historique est conserve integralement. A raison d un brief
-- trimestriel, l archive represente quatre lignes par an, soit
-- une chronologie systemique compacte mais doctrinalement riche
-- a partir de la deuxieme annee.
--
-- A executer manuellement dans le SQL Editor de Supabase apres
-- validation produit. Dependance : sectoral_briefs (les briefs
-- consommes sont references via sources_consulted).
-- ============================================================

-- ------------------------------------------------------------
-- TABLE : inter_sectoral_briefs
-- Une ligne par generation trimestrielle. Le format des trois
-- objets analytiques est decrit en commentaire ci-dessous.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inter_sectoral_briefs (
  -- Identifiants
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Temporalite de la generation
  generated_at timestamptz NOT NULL DEFAULT now(),

  -- Libelle de periode standardise au format ISO trimestriel
  -- (par exemple "2026-Q2"). Un brief par periode au maximum.
  period_quarter text NOT NULL UNIQUE,

  -- Convergences : liste structuree des paires de secteurs dont
  -- les scores se rapprochent significativement sur une meme
  -- dimension entre le trimestre precedent et le trimestre
  -- courant. Format attendu :
  --   [
  --     {
  --       "sectors": [ "climate-energie", "mobilite-logistique" ],
  --       "dimension": "tension_capital_talent",
  --       "delta_t_minus_1": 22,  // ecart au trimestre precedent
  --       "delta_t": 6,           // ecart au trimestre courant
  --       "interpretation": text  // lecture doctrinale courte
  --     },
  --     ...
  --   ]
  convergences jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Divergences : paires de secteurs qui s ecartent brutalement
  -- sur une meme dimension. Meme structure que convergences.
  divergences jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Patterns macro structurels : dimensions qui ont bouge de
  -- plus de dix points sur plus de la moitie des secteurs entre
  -- deux trimestres consecutifs. Format attendu :
  --   [
  --     {
  --       "dimension": "pression_reglementaire",
  --       "direction": "up" | "down",
  --       "average_delta": 14,
  --       "sectors_affected": [ slug1, slug2, ... ],
  --       "interpretation": text
  --     },
  --     ...
  --   ]
  macro_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Resume editorial Le Grand Continent, ~4000 a 6000 caracteres,
  -- structure en trois sections (une par objet analytique).
  -- C est l output principal expose au partner dans l onglet
  -- "Etat systemique des secteurs" du dashboard.
  narrative_summary text NOT NULL,

  -- Identifiants des fiches sectorielles consommees par la
  -- generation. Format :
  --   [
  --     { "sector_slug": text, "brief_id": uuid,
  --       "generated_at": iso-date }
  --   ]
  -- Treize entrees attendues par brief en regime normal, moins
  -- si certains secteurs n ont pas ete regenres au trimestre
  -- (cas degraded, signale explicitement dans le brief).
  sources_consulted jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Metadonnees de generation. Structure attendue :
  --   {
  --     "model": "claude-opus-4-7",
  --     "prompt_version": text,
  --     "cost_usd": numeric,
  --     "duration_ms": integer,
  --     "previous_brief_id": uuid (ref au trimestre precedent,
  --       null pour le premier brief)
  --   }
  generation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps systeme
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- INDEX
-- Le pattern de requete dominant est la consultation du brief
-- courant ("le dernier") ou d un brief precis par period_quarter
-- (selecteur de periode dans le dashboard). L index sur
-- generated_at DESC permet l agregation chronologique.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS inter_sectoral_briefs_period_idx
  ON public.inter_sectoral_briefs (period_quarter);

CREATE INDEX IF NOT EXISTS inter_sectoral_briefs_generated_at_idx
  ON public.inter_sectoral_briefs (generated_at DESC);

-- Index GIN sur les trois objets analytiques pour les requetes
-- du genre "tous les briefs qui mentionnent la dimension X comme
-- pattern macro".
CREATE INDEX IF NOT EXISTS inter_sectoral_briefs_convergences_gin
  ON public.inter_sectoral_briefs USING GIN (convergences);

CREATE INDEX IF NOT EXISTS inter_sectoral_briefs_divergences_gin
  ON public.inter_sectoral_briefs USING GIN (divergences);

CREATE INDEX IF NOT EXISTS inter_sectoral_briefs_macro_patterns_gin
  ON public.inter_sectoral_briefs USING GIN (macro_patterns);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Comme sectoral_briefs : acces client bloque, service_role
-- requis.
-- ------------------------------------------------------------
ALTER TABLE public.inter_sectoral_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_client_access_inter_sectoral_briefs" ON public.inter_sectoral_briefs;
CREATE POLICY "no_client_access_inter_sectoral_briefs"
  ON public.inter_sectoral_briefs FOR ALL
  USING (false);

-- ------------------------------------------------------------
-- VUE UTILITAIRE : dernier brief inter-sectoriel
-- Sert l onglet dashboard partner sans logique applicative.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.inter_sectoral_briefs_latest AS
SELECT *
FROM public.inter_sectoral_briefs
ORDER BY generated_at DESC
LIMIT 1;
