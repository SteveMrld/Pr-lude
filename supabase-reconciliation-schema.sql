-- ============================================================
-- PRELUDE - Bloc E3 Reconciliation prediction vs reality
-- ------------------------------------------------------------
-- Le bloc E3 transforme Prelude en memoire d apprentissage du fonds.
-- A chaque dossier instruit, Prelude produit une prediction (verdict +
-- scores + comparables + trajectoire). Cette prediction est implicitement
-- figee dans le result_json de la table analyses, qui n est jamais reecrit.
--
-- Ce schema ajoute le suivi de la realite :
--   1) realized_outcomes : la decision finale du fonds + conditions
--      d entree (un par dossier max)
--   2) outcome_milestones : les evenements dates post-decision (leve a
--      X valo, pivot, IPO, fail, partnership, etc.) - plusieurs par dossier
--
-- A executer apres supabase-persistence-schema.sql.
-- RLS : un utilisateur ne voit que les outcomes des analyses qu il
-- possede. Les membres de la meme organisation peuvent voir les outcomes
-- des analyses partagees.
-- ============================================================

-- ============================================================
-- 1. realized_outcomes : la decision finale du fonds
-- ============================================================

CREATE TABLE IF NOT EXISTS public.realized_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Decision : invested / passed / declined / waitlisted
  decision TEXT NOT NULL CHECK (decision IN ('invested', 'passed', 'declined', 'waitlisted')),
  decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  decision_notes TEXT,

  -- Conditions d entree (uniquement si invested)
  entry_round_type TEXT,                  -- 'Pre-Seed', 'Seed', 'Series A', etc.
  entry_round_size_eur NUMERIC,           -- taille totale du tour en EUR
  entry_valuation_eur NUMERIC,            -- pre-money ou post-money selon convention
  entry_valuation_basis TEXT CHECK (entry_valuation_basis IN ('pre_money', 'post_money')),
  entry_ticket_size_eur NUMERIC,          -- ticket du fonds en EUR
  entry_ownership_pct NUMERIC,            -- pourcentage de capital obtenu

  -- Conditions deal
  entry_lead BOOLEAN,                     -- est-on lead du tour ?
  entry_co_investors TEXT[],              -- liste des co-investors

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Une seule decision par analyse (peut etre updated)
  UNIQUE(analysis_id)
);

CREATE INDEX IF NOT EXISTS realized_outcomes_user_idx
  ON public.realized_outcomes (user_id, decision_date DESC);

CREATE INDEX IF NOT EXISTS realized_outcomes_analysis_idx
  ON public.realized_outcomes (analysis_id);

CREATE INDEX IF NOT EXISTS realized_outcomes_decision_idx
  ON public.realized_outcomes (user_id, decision);


-- ============================================================
-- 2. outcome_milestones : les evenements post-decision
-- ============================================================

CREATE TABLE IF NOT EXISTS public.outcome_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Date de l evenement (peut etre passe ou futur pour des milestones planifies)
  milestone_date DATE NOT NULL,

  -- Type structure pour permettre l agregation
  milestone_type TEXT NOT NULL CHECK (milestone_type IN (
    'fundraise',          -- nouvelle levee
    'pivot',              -- pivot strategique
    'team_change',        -- depart/arrivee key (founder, exec)
    'revenue_update',     -- update CA / ARR
    'metric_update',      -- update metrique cle (utilisateurs, contrats, etc.)
    'churn',              -- perte client important
    'partnership',        -- partenariat majeur
    'product_launch',     -- lancement produit
    'regulatory',         -- evenement reglementaire (certification, agrement, sanction)
    'legal',              -- litige, IP, gouvernance
    'macro_shock',        -- evenement macro impactant
    'exit',               -- IPO, M&A
    'fail',               -- depot de bilan, dissolution
    'other'               -- autre
  )),

  -- Contenu
  title TEXT NOT NULL,                    -- titre court (60 chars max)
  description TEXT,                       -- description longue libre

  -- Impact qualitatif sur la these initiale
  impact TEXT CHECK (impact IN ('positive', 'negative', 'neutral', 'mixed')),

  -- Valeur quantitative optionnelle (pour revenue, valuation, headcount, etc.)
  numerical_value NUMERIC,
  numerical_unit TEXT,                    -- 'EUR', 'USD', 'pct', 'count', 'months', etc.

  -- Relation a la prediction initiale : ce milestone valide-t-il un
  -- driver positif ou un risque identifie au moment du verdict ?
  thesis_alignment TEXT CHECK (thesis_alignment IN (
    'confirms_driver',      -- valide un driver positif identifie
    'confirms_risk',        -- valide un risque identifie
    'contradicts_driver',   -- un driver positif ne se materialise pas
    'contradicts_risk',     -- un risque identifie ne se materialise pas
    'unforeseen_positive',  -- evenement positif non prevu
    'unforeseen_negative'   -- evenement negatif non prevu
  )),

  -- Source de l info (lien article, deck update, conversation, etc.)
  source_url TEXT,
  source_type TEXT,                       -- 'press', 'company_update', 'team_call', 'leaked', etc.

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outcome_milestones_analysis_idx
  ON public.outcome_milestones (analysis_id, milestone_date DESC);

CREATE INDEX IF NOT EXISTS outcome_milestones_user_date_idx
  ON public.outcome_milestones (user_id, milestone_date DESC);

CREATE INDEX IF NOT EXISTS outcome_milestones_type_idx
  ON public.outcome_milestones (user_id, milestone_type);

CREATE INDEX IF NOT EXISTS outcome_milestones_thesis_idx
  ON public.outcome_milestones (user_id, thesis_alignment)
  WHERE thesis_alignment IS NOT NULL;


-- ============================================================
-- 3. RLS : un user ne voit que ses propres outcomes
-- ============================================================

ALTER TABLE public.realized_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outcomes_owner_select" ON public.realized_outcomes;
CREATE POLICY "outcomes_owner_select" ON public.realized_outcomes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "outcomes_owner_insert" ON public.realized_outcomes;
CREATE POLICY "outcomes_owner_insert" ON public.realized_outcomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "outcomes_owner_update" ON public.realized_outcomes;
CREATE POLICY "outcomes_owner_update" ON public.realized_outcomes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "outcomes_owner_delete" ON public.realized_outcomes;
CREATE POLICY "outcomes_owner_delete" ON public.realized_outcomes
  FOR DELETE USING (auth.uid() = user_id);


DROP POLICY IF EXISTS "milestones_owner_select" ON public.outcome_milestones;
CREATE POLICY "milestones_owner_select" ON public.outcome_milestones
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "milestones_owner_insert" ON public.outcome_milestones;
CREATE POLICY "milestones_owner_insert" ON public.outcome_milestones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "milestones_owner_update" ON public.outcome_milestones;
CREATE POLICY "milestones_owner_update" ON public.outcome_milestones
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "milestones_owner_delete" ON public.outcome_milestones;
CREATE POLICY "milestones_owner_delete" ON public.outcome_milestones
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 4. Trigger pour updated_at automatique
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS realized_outcomes_touch ON public.realized_outcomes;
CREATE TRIGGER realized_outcomes_touch
  BEFORE UPDATE ON public.realized_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS outcome_milestones_touch ON public.outcome_milestones;
CREATE TRIGGER outcome_milestones_touch
  BEFORE UPDATE ON public.outcome_milestones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
