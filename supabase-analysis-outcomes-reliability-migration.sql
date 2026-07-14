-- ============================================================
-- MIGRATION - Ajout du champ reliability sur analysis_outcomes
-- ------------------------------------------------------------
-- Formalise le niveau de fiabilite jusqu ici en texte libre dans
-- source_notes. Trois valeurs discretes controlees par CHECK :
--   haute   : temoignage direct ou source primaire verifiable
--   bonne   : source publique fiable, registres, presse, comptes
--   moyenne : proxy d etat, inference plausible non confirmee
--
-- null autorise pendant la periode transitoire pour ne pas
-- casser les ecritures existantes qui ne renseignent pas encore
-- le champ. La regle de selection deterministe
-- (lib/calibration/corpus-selection.ts) traite null comme
-- reliability-missing, donc exclusion du discriminant, ce qui est
-- le comportement conservatif attendu.
--
-- Idempotent : si la colonne existe deja, l ADD COLUMN echoue
-- silencieusement grace au IF NOT EXISTS. Meme logique sur la
-- contrainte via DROP puis ADD.
-- ============================================================

ALTER TABLE public.analysis_outcomes
  ADD COLUMN IF NOT EXISTS reliability text;

DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.analysis_outcomes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%reliability%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.analysis_outcomes DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.analysis_outcomes
  ADD CONSTRAINT analysis_outcomes_reliability_check
  CHECK (reliability IS NULL OR reliability IN ('haute', 'bonne', 'moyenne'));

NOTIFY pgrst, 'reload schema';
