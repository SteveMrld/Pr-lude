-- ============================================================
-- MIGRATION - Enrichissement taxonomie analysis_outcomes v2
-- ------------------------------------------------------------
-- Ajoute deux etats resolus a la contrainte CHECK sur
-- analysis_outcomes.market_outcome :
--   alive_thriving : societe active et en croissance saine
--                    plusieurs annees apres instruction, resolu
--                    positif (observed = 1). Complementaire de
--                    exit qui reste reserve aux IPO/M&A.
--   alive_flat     : societe active mais atone, sans croissance
--                    ni echec, non resolu (observed = null),
--                    exclu du discriminant tout en etant tracable.
--
-- Les etats legacy 'alive' et 'flat' restent acceptes par la
-- contrainte pour ne casser aucune ligne existante ni aucun code
-- qui les ecrirait encore. Le mapping runtime, defini dans
-- lib/analysis-outcomes-taxonomy.ts, les traite comme non resolus
-- (equivalent semantique de alive_flat par prudence).
--
-- Aucune ligne existante ne bascule automatiquement d etat : les
-- 5 fail deja saisis restent fail, aucune reencodage de fond.
--
-- Idempotent : si la contrainte a deja les six valeurs, l update
-- est un no-op fonctionnel.
-- ============================================================

DO $$
DECLARE
  cname text;
BEGIN
  -- Retrouve dynamiquement le nom de la contrainte CHECK sur
  -- market_outcome (nom genere par Postgres, non fige a la
  -- creation).
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.analysis_outcomes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%market_outcome%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.analysis_outcomes DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.analysis_outcomes
  ADD CONSTRAINT analysis_outcomes_market_outcome_check
  CHECK (market_outcome IN (
    'exit',
    'alive_thriving',
    'fail',
    'alive_flat',
    'alive',
    'flat'
  ));

-- Notifie PostgREST pour rafraichir son cache de contraintes.
NOTIFY pgrst, 'reload schema';
