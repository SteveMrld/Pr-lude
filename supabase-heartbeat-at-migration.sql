-- ============================================================
-- PRELUDE : promotion de progress.heartbeatAt en colonne
-- ------------------------------------------------------------
-- Le balayage des analyses coincees en 'running' mesurait
-- l immobilite d un run par analyses.updated_at. Cette colonne ne
-- mesure pas ce qu on lui demandait. Le trigger
-- analyses_updated_at_trigger, en BEFORE UPDATE, pose
-- NEW.updated_at = now() a chaque ecriture, quelle qu en soit
-- l origine : une migration de masse, une correction manuelle, une
-- reprise de champ sans rapport avec l execution. Toute ligne morte
-- redevient alors fraiche, et le cron cesse de la voir.
--
-- Le cas est constate et non suppose. Au 3 aout 2026, deux analyses
-- creees le 8 juin portent un updated_at au 2 aout 12:14:58.903697,
-- identique a la microseconde pour les deux : une ecriture de masse,
-- pas une activite. Leur progress->>'heartbeatAt' dit la verite,
-- 2026-06-08T04:24, soit deux mois plus tot.
--
-- La colonne heartbeat_at porte desormais cette seule chose : le
-- dernier signe de vie emis par le pipeline lui-meme. Personne
-- d autre ne l ecrit, et c est ce qui lui donne sa valeur.
--
-- Le backfill s execute trigger desactive. Sans cette precaution, la
-- migration commettrait a la ligne pres la faute qu elle corrige :
-- elle repasserait sur les cinquante-sept lignes de la table et
-- remettrait leur updated_at a l instant de son propre passage,
-- detruisant la derniere trace exploitable avant que la colonne ne
-- prenne le relais.
--
-- Application :
--   npx tsx scripts/apply-migration.ts supabase-heartbeat-at-migration.sql
-- ============================================================

BEGIN;

-- 1. La colonne, d abord nullable pour permettre le backfill.
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

-- 2. Backfill, trigger desactive. L ordre de COALESCE va du plus
--    informatif au moins informatif : le heartbeat que le pipeline a
--    reellement ecrit, sinon l instant ou le run a demarre, sinon
--    l instant de creation de la ligne. Les trois sont des signes de
--    vie ; aucun n est updated_at, qui n en est pas un.
--
--    Aucune ligne de la table ne porte un heartbeatAt illisible au
--    moment d ecrire cette migration (verifie : 51 valeurs presentes
--    sur 57 lignes, 0 non conforme au format ISO). Le CASE reste, non
--    par prudence rituelle, mais parce qu un cast qui echoue ferait
--    tomber la transaction entiere sur une seule ligne malformee.
ALTER TABLE public.analyses DISABLE TRIGGER analyses_updated_at_trigger;

UPDATE public.analyses
SET heartbeat_at = COALESCE(
  CASE
    WHEN progress->>'heartbeatAt' ~ '^\d{4}-\d{2}-\d{2}T'
      THEN (progress->>'heartbeatAt')::timestamptz
    ELSE NULL
  END,
  started_at,
  created_at
)
WHERE heartbeat_at IS NULL;

ALTER TABLE public.analyses ENABLE TRIGGER analyses_updated_at_trigger;

-- 3. NOT NULL avec defaut a l insertion.
--
--    NOT NULL n est pas cosmetique ici. Le balayage filtre par
--    heartbeat_at < seuil, et un NULL ne satisfait aucune comparaison :
--    une ligne sans heartbeat ne serait jamais balayee, donc resterait
--    'running' indefiniment. La colonne aurait remplace une panne
--    bruyante, la ligne balayee a tort, par une panne muette, la ligne
--    jamais balayee. C est le sens inverse de l erreur et il est pire.
--
--    Le DEFAULT ne s applique qu a l insertion, jamais a une UPDATE
--    qui ne nomme pas la colonne. Une future ecriture de masse
--    laissera donc heartbeat_at intact, ce qui est precisement la
--    propriete qui manquait a updated_at.
ALTER TABLE public.analyses
  ALTER COLUMN heartbeat_at SET DEFAULT now();

ALTER TABLE public.analyses
  ALTER COLUMN heartbeat_at SET NOT NULL;

-- 4. Index partiel : le balayage ne consulte que les lignes running.
CREATE INDEX IF NOT EXISTS idx_analyses_running_heartbeat
  ON public.analyses (heartbeat_at)
  WHERE status = 'running';

COMMENT ON COLUMN public.analyses.heartbeat_at IS
  'Dernier signe de vie emis par le pipeline. Ecrit uniquement par updateAnalysisProgress. Aucune autre ecriture ne doit toucher cette colonne : c est ce qui la distingue de updated_at, que le trigger analyses_updated_at_trigger remet a now() a chaque UPDATE et qui ne mesure donc pas l immobilite.';

COMMIT;
