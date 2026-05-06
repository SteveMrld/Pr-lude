-- ============================================================
-- PRELUDE - Extension fund_profiles : notes structurees par dimension
-- ------------------------------------------------------------
-- A executer dans le SQL Editor de Supabase, apres
-- supabase-fund-profiles-schema.sql.
--
-- Idempotent : ALTER TABLE ADD COLUMN IF NOT EXISTS.
--
-- CONTEXTE
-- Le champ notes (text) du fund_profile actuel est un fourre-tout
-- libre. Tres flexible mais peu structure : impossible pour les
-- moteurs Bloc 1 de retrouver une note specifique a leur dimension
-- (team, market, macro, financial). En pratique, les fonds ont des
-- nuances dimensionnelles distinctes :
--   - Equipe : prefere les fondateurs sectoriels vs les serial
--     entrepreneurs, tolere les solo founders ou pas, exige une
--     experience scaling, etc.
--   - Marche : aime les niches premium, evite les marches sature,
--     privilegie les leviers reglementaires, etc.
--   - Macro : timing contracyclique vs surf de tendance, sensibilite
--     a la geopolitique, exposition risques de change, etc.
--   - Financial : tolerance aux burns eleves, exigence de profitabi-
--     lite a horizon court vs long, multiples LTV/CAC cibles, etc.
--   - General : style decisionnel, contraintes ESG, exclusions
--     supplementaires non sectorielles, etc.
--
-- Ces nuances dimensionnelles meritent leur propre champ pour etre
-- injectees dans le user prompt du moteur correspondant uniquement.
-- L equipe-engine ne doit pas voir les notes financieres et vice
-- versa, sinon le contexte se dilue.
-- ============================================================

ALTER TABLE public.fund_profiles
  ADD COLUMN IF NOT EXISTS notes_team text,
  ADD COLUMN IF NOT EXISTS notes_market text,
  ADD COLUMN IF NOT EXISTS notes_macro text,
  ADD COLUMN IF NOT EXISTS notes_financial text,
  ADD COLUMN IF NOT EXISTS notes_general text;

COMMENT ON COLUMN public.fund_profiles.notes_team IS 'Nuances de la these sur la dimension equipe / fondateurs. Injecte dans le prompt du team-engine.';
COMMENT ON COLUMN public.fund_profiles.notes_market IS 'Nuances de la these sur la dimension marche / segment / clients. Injecte dans le prompt du market-engine.';
COMMENT ON COLUMN public.fund_profiles.notes_macro IS 'Nuances de la these sur la dimension macro / timing / geopolitique. Injecte dans le prompt du macro-engine.';
COMMENT ON COLUMN public.fund_profiles.notes_financial IS 'Nuances de la these sur la dimension financiere / unit economics / burn. Injecte dans le prompt du financial-coherence-engine.';
COMMENT ON COLUMN public.fund_profiles.notes_general IS 'Notes generales transverses (ESG, exclusions specifiques, style decisionnel). Injecte dans le prompt orchestrator final.';

-- Le champ notes existant est conserve pour compatibilite ascendante.
-- Si un fund profile a deja un champ notes rempli avant cette migra-
-- tion, il continue d alimenter le pre-scan. Les nouveaux champs
-- specialises sont prioritaires si renseignes.
