-- ============================================================
-- PRELUDE - Pilier preuve, brique reconciliation et calibration
-- ------------------------------------------------------------
-- Deux tables qui transforment les predictions en preuve dans le
-- temps :
--
--   1) prediction_records : cliche fige de ce que Prelude a predit
--      au moment ou une analyse est sauvegardee (verdict, score
--      global, probabilite de succes, six scores de dimension, plus
--      le version stamp complet qui rattache la prediction a la
--      version exacte du code, des configs et des moteurs LLM qui
--      l ont produite). Immuable : on ajoute, on ne reecrit jamais.
--
--   2) analysis_outcomes : issue de marche reelle d un dossier
--      (alive, exit, fail, flat) avec horodatage et source. Saisie
--      manuelle d abord, conçue pour etre enrichie ensuite par le
--      monitoring du pilier cycle de vie. Decouplee de
--      realized_outcomes qui capture la decision du fonds (invested
--      / passed / declined / waitlisted) : ce sont deux choses
--      distinctes, on ne les confond pas.
--
-- A executer apres supabase-persistence-schema.sql et
-- supabase-reconciliation-schema.sql.
-- ============================================================


-- ============================================================
-- 1. prediction_records : cliche immuable de chaque prediction
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prediction_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Capture brute de la prediction
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verdict TEXT NOT NULL,
  global_score NUMERIC,                    -- 0-100, peut etre null si degrade
  success_probability NUMERIC,             -- 0-100, peut etre null si degrade

  -- Six scores de dimension (cf score-calculator.ts).
  -- Tous nullable pour absorber les pipelines degrades.
  dim_team NUMERIC,
  dim_market NUMERIC,
  dim_macro NUMERIC,
  dim_financial NUMERIC,
  dim_contrarian NUMERIC,
  dim_vigilance NUMERIC,

  -- Version stamp complet (jsonb). Source de verite ultime pour
  -- rattacher cette prediction a la version exacte du code, des
  -- configs et des moteurs qui l ont produite. Voir
  -- lib/instrumentation/version-stamp.ts.
  version_stamp JSONB NOT NULL,

  -- Fingerprint extrait du version_stamp pour permettre la
  -- segmentation rapide en SQL sans rescanner le jsonb. Clef
  -- composite : commit + configs + engines + models. Deux records
  -- avec le meme fingerprint sont issus du meme instrument.
  stamp_commit_sha TEXT,
  stamp_configs_hash TEXT,
  stamp_engines_hash TEXT,
  stamp_models_hash TEXT,
  stamp_inputs_hash TEXT,

  -- Schema version du stamp lui-meme (cf VERSION_STAMP_SCHEMA).
  -- Permet aux consommateurs de gerer plusieurs schemas en parallele.
  schema_version TEXT NOT NULL,

  -- Pas de updated_at : on ne reecrit jamais un record. Si une
  -- analyse est relancee, c est un nouveau record.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prediction_records_analysis_idx
  ON public.prediction_records (analysis_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS prediction_records_user_idx
  ON public.prediction_records (user_id, captured_at DESC);

-- Index sur les composants du fingerprint pour permettre la
-- segmentation de calibration sans charger tout le bassin en memoire.
CREATE INDEX IF NOT EXISTS prediction_records_stamp_commit_idx
  ON public.prediction_records (stamp_commit_sha);

CREATE INDEX IF NOT EXISTS prediction_records_stamp_fingerprint_idx
  ON public.prediction_records (
    stamp_commit_sha,
    stamp_configs_hash,
    stamp_engines_hash,
    stamp_models_hash
  );


-- ============================================================
-- 2. analysis_outcomes : issue de marche reelle du dossier
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analysis_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Taxonomie simple et extensible. Quatre etats initiaux qui
  -- couvrent l espace observable : la societe vit (alive), elle
  -- a fait un evenement de sortie (exit), elle est morte (fail),
  -- elle vegete sans croissance ni mort (flat). De nouveaux etats
  -- peuvent etre ajoutes par migration sans casser les records
  -- existants : la couche de calibration n utilise pour le binaire
  -- succes/echec que les etats explicitement mappes.
  market_outcome TEXT NOT NULL CHECK (market_outcome IN (
    'alive',     -- la societe opere, pas d evenement de sortie ni de fail
    'exit',      -- IPO ou M&A complete (issue positive realisee)
    'fail',      -- depot de bilan, dissolution, shutdown (issue negative)
    'flat'       -- opere mais stagne (zombie : non penalise, non recompense)
  )),

  -- Date a laquelle l etat observe est entre en vigueur (pas la
  -- date de saisie). Permet de calibrer "issue connue a horizon T".
  observed_at DATE NOT NULL,

  -- Source de l observation : 'manual' pour saisie partner,
  -- 'monitoring' pour enrichissement automatique pilier cycle de vie.
  -- Champ libre extensible (on ne contraint pas la liste).
  source TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT,
  source_notes TEXT,

  -- Timestamps de la ligne (distinct de observed_at).
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un seul etat actif par dossier (peut etre upserte).
  UNIQUE(analysis_id)
);

CREATE INDEX IF NOT EXISTS analysis_outcomes_user_idx
  ON public.analysis_outcomes (user_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS analysis_outcomes_state_idx
  ON public.analysis_outcomes (user_id, market_outcome);


-- ============================================================
-- 3. RLS - alignee sur le reste du schema reconciliation
-- ============================================================

ALTER TABLE public.prediction_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prediction_records_owner_select" ON public.prediction_records;
CREATE POLICY "prediction_records_owner_select" ON public.prediction_records
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "prediction_records_owner_insert" ON public.prediction_records;
CREATE POLICY "prediction_records_owner_insert" ON public.prediction_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Pas de UPDATE policy : le record est immuable par contrat.
-- Pas de DELETE policy autre que la cascade analysis_id.

DROP POLICY IF EXISTS "analysis_outcomes_owner_select" ON public.analysis_outcomes;
CREATE POLICY "analysis_outcomes_owner_select" ON public.analysis_outcomes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "analysis_outcomes_owner_insert" ON public.analysis_outcomes;
CREATE POLICY "analysis_outcomes_owner_insert" ON public.analysis_outcomes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "analysis_outcomes_owner_update" ON public.analysis_outcomes;
CREATE POLICY "analysis_outcomes_owner_update" ON public.analysis_outcomes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "analysis_outcomes_owner_delete" ON public.analysis_outcomes;
CREATE POLICY "analysis_outcomes_owner_delete" ON public.analysis_outcomes
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 4. Trigger updated_at automatique sur analysis_outcomes.
-- Reutilise la fonction touch_updated_at definie dans
-- supabase-reconciliation-schema.sql.
-- ============================================================

DROP TRIGGER IF EXISTS analysis_outcomes_touch ON public.analysis_outcomes;
CREATE TRIGGER analysis_outcomes_touch
  BEFORE UPDATE ON public.analysis_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
