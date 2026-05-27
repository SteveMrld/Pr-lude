-- ============================================================
-- PRELUDE - Migration : tracabilite source reconciliation
-- ------------------------------------------------------------
-- A executer dans le SQL Editor de Supabase. Idempotente (ADD
-- COLUMN IF NOT EXISTS partout, defaults non bloquants pour les
-- lignes existantes). Reversible : voir bloc DOWN en fin de fichier.
--
-- Objectif :
--   1. realized_outcomes.source : distinguer une decision saisie
--      manuellement d une decision deduite automatiquement de la
--      transition Kanban (signed -> invested, declined -> passed).
--      Permet a l UI d afficher une banniere "decision deduite,
--      precisez les conditions" et au partner de savoir ce qui
--      reste a confirmer.
--
--   2. outcome_milestones.source_kind : distinguer milestones
--      saisis a la main de milestones proposes par la detection
--      web automatique (cron 6/12 mois + opportuniste).
--
--   3. outcome_milestones.detection_status : cycle de vie des
--      milestones proposes par la detection automatique :
--        'confirmed' -> entre dans le calcul d agregation
--        'proposed'  -> en attente de confirmation par le partner
--        'rejected'  -> rejete par le partner, ignore par l agregat
--      Le defaut 'confirmed' garantit que les milestones existants
--      saisis a la main avant la migration restent comptes.
--
--   4. Index partiel pour filtrer rapidement les milestones
--      proposes en attente de confirmation par user.
-- ============================================================

-- ============================================================
-- 1. realized_outcomes : source de la decision
-- ============================================================
ALTER TABLE public.realized_outcomes
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'kanban_auto'));

-- ============================================================
-- 2. outcome_milestones : source et statut de detection
-- ============================================================
ALTER TABLE public.outcome_milestones
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN ('manual', 'auto_detected'));

ALTER TABLE public.outcome_milestones
  ADD COLUMN IF NOT EXISTS detection_status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (detection_status IN ('confirmed', 'proposed', 'rejected'));

-- ============================================================
-- 3. Index partiel : milestones proposes en attente par user
-- ------------------------------------------------------------
-- Partiel parce qu en regime, la majorite des milestones sont en
-- 'confirmed' (etat terminal). On indexe uniquement le sous-ensemble
-- 'proposed' qui correspond au flux a traiter par le partner.
-- ============================================================
CREATE INDEX IF NOT EXISTS outcome_milestones_proposed_idx
  ON public.outcome_milestones (user_id, created_at DESC)
  WHERE detection_status = 'proposed';

-- ============================================================
-- DOWN (rollback manuel, non execute automatiquement)
-- ------------------------------------------------------------
-- Pour annuler cette migration :
--
--   DROP INDEX IF EXISTS public.outcome_milestones_proposed_idx;
--   ALTER TABLE public.outcome_milestones
--     DROP COLUMN IF EXISTS source_kind,
--     DROP COLUMN IF EXISTS detection_status;
--   ALTER TABLE public.realized_outcomes
--     DROP COLUMN IF EXISTS source;
--
-- Aucune perte de donnees fonctionnelles : les colonnes ajoutees
-- sont des metadonnees de tracabilite. Les outcomes et milestones
-- eux-memes restent intacts.
-- ============================================================
