-- ============================================================
-- PRELUDE - Brique 3 ingestion corpus Jabrilia
-- ------------------------------------------------------------
-- Cette migration prepare le terrain pour l ingestion du corpus
-- de dossiers historiques resolus (le sac Jabrilia, dossiers ou
-- l outcome marche est deja connu). Trois changements :
--
--   1) Colonnes provenance sur public.analyses : as_of (date du
--      deck recu) et frozen (booleen marquant un run sans
--      contact reseau, c est-a-dire web search coupe). Ces deux
--      colonnes permettent de filtrer les analyses corpus comme
--      un sous-bassin distinct du flux courant, sans melanger
--      les segments.
--
--   2) Colonnes outcome chiffre sur public.analysis_outcomes :
--      multiple_at_exit (numeric) et irr (numeric), tous deux
--      nullable. Elargissent l outcome au-dela du seul market_
--      outcome qualitatif pour rattacher un quantum economique
--      a un exit ou un fail. La table reste la source unique de
--      verite de l outcome, jamais duplique ailleurs.
--
--   3) Nouvelle table public.reference_dossiers. Stocke la
--      couche humaine associee a une analyse corpus : verdict
--      partner ex-post, raisonnement, motifs (vocabulaire
--      controle valide applicativement, pas en SQL pour rester
--      extensible sans migration), deviations post-investis-
--      sement. L outcome n est PAS dans cette table, il vit
--      dans analysis_outcomes et se lit par jointure sur
--      analysis_id.
--
-- A executer apres supabase-prediction-records-schema.sql.
-- ============================================================


-- ============================================================
-- 1. Colonnes provenance sur analyses
-- ------------------------------------------------------------
-- as_of : date a laquelle le deck a ete recu (provenance), non
-- contrainte d execution. Le mode frozen empeche les fuites par
-- web search, asOf est purement informatif et permet d ordonner
-- le corpus dans le temps.
--
-- frozen : true marque un run sans web search (corpus, replays
-- deterministes). false reste le defaut, ne change rien aux
-- runs courants. Le flag alimente le fingerprint via runMode
-- dans version-stamp pour que les re-runs corpus forment un
-- segment de calibration distinct.
-- ============================================================

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS as_of DATE,
  ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS analyses_frozen_idx
  ON public.analyses (frozen, as_of DESC)
  WHERE frozen = true;


-- ============================================================
-- 2. Colonnes outcome chiffre sur analysis_outcomes
-- ------------------------------------------------------------
-- multiple_at_exit : multiple realise sur exit (ex 3.2x). Nullable
-- parce que beaucoup d outcomes restent qualitatifs (fail sans
-- multiple, alive sans liquidite).
--
-- irr : taux de rendement interne au moment de l outcome. Nullable
-- pour les memes raisons. Les deux champs n entrent jamais dans la
-- contrainte d unicite UNIQUE(analysis_id) deja en place : on a
-- toujours au plus un outcome par dossier, eventuellement enrichi
-- de quantum.
-- ============================================================

ALTER TABLE public.analysis_outcomes
  ADD COLUMN IF NOT EXISTS multiple_at_exit NUMERIC,
  ADD COLUMN IF NOT EXISTS irr NUMERIC;


-- ============================================================
-- 3. reference_dossiers : couche humaine du corpus
-- ------------------------------------------------------------
-- Une ligne par dossier corpus, reliee a la ligne analyses
-- produite par le re-run frozen. Trois etats de remplissage :
--
--   pending_run        : ligne reservee, le pipeline n a pas
--                        encore tourne
--   run_complete       : pipeline OK, couche humaine vide
--   human_layer_pending : pipeline OK, en attente du verdict
--                        partner ex-post
--   complete           : verdict partner enregistre
--
-- Taxonomie des motifs (decision_motifs) : vocabulaire controle
-- valide applicativement, jamais en contrainte SQL. La liste
-- evoluera (ajout d un motif "saturation_geographique" par ex.)
-- sans migration cassante. La validation vit dans le store TS.
--
-- Motifs initiaux : equipe, timing_marche, unit_economics,
-- defensibilite, signal_contrarien, conviction_partner.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reference_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  source_pdf_filename TEXT NOT NULL,
  company_name TEXT NOT NULL,
  deck_received_at DATE NOT NULL,

  -- Couche humaine ex-post, remplie via scripts/set-corpus-verdict.ts
  partner_verdict TEXT,
  partner_reasoning TEXT,
  decision_motifs TEXT[],
  post_investment_deviations TEXT,

  -- Etat de remplissage. Vocabulaire controle minimal, en SQL
  -- parce qu il y a un nombre fini d etats et qu une faute de
  -- frappe doit etre rejetee a l ecriture.
  ingestion_status TEXT NOT NULL DEFAULT 'pending_run' CHECK (ingestion_status IN (
    'pending_run',
    'run_complete',
    'human_layer_pending',
    'complete'
  )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotence : un seul reference_dossier par analyse, et un
  -- seul par fichier source. La double clef permet au script
  -- d ingestion de skip sans deviner.
  UNIQUE(analysis_id),
  UNIQUE(source_pdf_filename)
);

CREATE INDEX IF NOT EXISTS reference_dossiers_company_idx
  ON public.reference_dossiers (company_name);

CREATE INDEX IF NOT EXISTS reference_dossiers_status_idx
  ON public.reference_dossiers (ingestion_status, deck_received_at DESC);


-- ============================================================
-- 4. RLS - alignee sur le reste du schema reconciliation
-- ------------------------------------------------------------
-- reference_dossiers n a pas de user_id. Le corpus est partage
-- au niveau de l organisation Prelude : on lit la propriete via
-- analyses.user_id par jointure. Pour l instant, RLS lecture
-- ouverte aux authenticated, ecriture reservee au service role.
-- A durcir si le corpus devient multi-tenant.
-- ============================================================

ALTER TABLE public.reference_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reference_dossiers_authenticated_select" ON public.reference_dossiers;
CREATE POLICY "reference_dossiers_authenticated_select" ON public.reference_dossiers
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "reference_dossiers_service_role_write" ON public.reference_dossiers;
CREATE POLICY "reference_dossiers_service_role_write" ON public.reference_dossiers
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- 5. Trigger updated_at automatique sur reference_dossiers
-- Reutilise la fonction touch_updated_at de
-- supabase-reconciliation-schema.sql.
-- ============================================================

DROP TRIGGER IF EXISTS reference_dossiers_touch ON public.reference_dossiers;
CREATE TRIGGER reference_dossiers_touch
  BEFORE UPDATE ON public.reference_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
