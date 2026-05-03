-- ============================================================
-- PRELUDE - Migration mode solo
-- ------------------------------------------------------------
-- A executer une seule fois dans le SQL Editor de Supabase pour
-- activer le mode solo (un seul utilisateur, pas d auth requise).
--
-- Effet :
--   1. Retire la contrainte FK user_id -> auth.users(id) qui
--      empechait l insertion sans user authentifie.
--   2. La colonne user_id reste un UUID NOT NULL pour permettre
--      d activer le mode multi-user plus tard sans changement
--      de schema (il suffira de re-creer la FK).
-- ============================================================

ALTER TABLE public.analyses
  DROP CONSTRAINT IF EXISTS analyses_user_id_fkey;
