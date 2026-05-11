-- ============================================================
-- PRELUDE - Schema persistence trajectoire denormalisee
-- ------------------------------------------------------------
-- Cree la table trajectory_snapshots, vue denormalisee
-- d analyses_versions optimisee pour les requetes de monitoring
-- portfolio. La table principale analyses_versions reste la
-- source de verite archivale (payload JSON complet, ~200 Ko par
-- version). trajectory_snapshots stocke en colonnes typees les
-- scores et verdicts qui servent aux requetes recurrentes :
--   - Liste des dossiers d un fonds avec leur score actuel
--   - Filtrage par delta de score (chute >= 10 points sur 12 mois)
--   - Detection de combinaisons drapeau-rouge nouvellement apparues
--   - Trajectoire d un dossier sur N versions
--
-- L atomicite entre l ecriture d une version et l ecriture de son
-- snapshot trajectoire est garantie par un trigger AFTER INSERT
-- qui execute la projection dans la meme transaction Postgres.
-- Aucune fenetre d incoherence possible entre les deux tables :
-- soit la version et son snapshot sont commit ensemble, soit
-- aucun des deux.
--
-- A executer dans le SQL Editor de Supabase apres
-- supabase-collaboration-schema.sql (dependance : analyses_versions).
-- ============================================================

-- ------------------------------------------------------------
-- TABLE : trajectory_snapshots
-- Chaque ligne est la vue denormalisee d une analyses_versions.
-- La duplication d information avec analyses_versions est assumee :
-- elle debloque les requetes portfolio en evitant N deserialisations
-- de blobs JSON.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trajectory_snapshots (
  -- Identifiants
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.analyses_versions(id) ON DELETE CASCADE,
  version_num integer NOT NULL,

  -- Denormalisation pour requetes portfolio sans jointure
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,

  -- Quand la version a ete creee (= analyzedAt cote TypeScript)
  analyzed_at timestamptz NOT NULL,

  -- Score et verdict globaux du moteur Bloc 1
  global_score numeric NOT NULL,
  verdict text NOT NULL,

  -- Scores des six dimensions Bloc 1
  dim_team numeric,
  dim_market numeric,
  dim_macro numeric,
  dim_financial numeric,
  dim_contrarian numeric,
  dim_vigilance numeric,

  -- Score Fragilite Structurelle (null si moteur non applicable)
  fragilite_score numeric,
  fragilite_verdict text,

  -- Score Narrative Drift (Lecture du langage)
  narrative_drift_score numeric,
  narrative_drift_verdict text,

  -- Patterns Phase 4 en JSONB compact : pour chaque pattern present
  -- dans le payload, son score, verdict, applicabilite. Format :
  --   { "growth-subsidized-model": { "globalScore": 45,
  --     "verdict": "attention", "applicabilite": "full" }, ... }
  -- Stockage compact : ~2 Ko par snapshot vs 200 Ko par version
  -- complete.
  patterns_json jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Combinaisons diagnostiques detectees a l instant T. Format :
  --   [ { "nom": "Trajectoire WeWork", "severite": "drapeau-rouge" }, ... ]
  combinaisons_json jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Une seule ligne snapshot par version (unicite forte)
  UNIQUE (version_id)
);

-- ------------------------------------------------------------
-- INDEX
-- Optimises pour les patterns de requete portfolio :
--   1) Trajectoire complete d un dossier (chain par analysis_id)
--   2) Vue portfolio d un user (toutes les analyses) avec filtres
--      sur scores ou verdicts
--   3) Recherche par company_name (dossier ré-instruit après
--      suppression et ré-upload)
--   4) Filtrage rapide par verdict pour les requetes de monitoring
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS trajectory_snapshots_analysis_idx
  ON public.trajectory_snapshots (analysis_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS trajectory_snapshots_user_idx
  ON public.trajectory_snapshots (user_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS trajectory_snapshots_company_idx
  ON public.trajectory_snapshots (user_id, company_name, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS trajectory_snapshots_verdict_idx
  ON public.trajectory_snapshots (user_id, verdict);

CREATE INDEX IF NOT EXISTS trajectory_snapshots_fragilite_idx
  ON public.trajectory_snapshots (user_id, fragilite_verdict)
  WHERE fragilite_verdict IS NOT NULL;

-- Index GIN sur patterns_json et combinaisons_json pour requetes
-- du genre "tous les snapshots qui contiennent la combinaison
-- Trajectoire WeWork".
CREATE INDEX IF NOT EXISTS trajectory_snapshots_patterns_gin
  ON public.trajectory_snapshots USING GIN (patterns_json);

CREATE INDEX IF NOT EXISTS trajectory_snapshots_combinaisons_gin
  ON public.trajectory_snapshots USING GIN (combinaisons_json);

-- ------------------------------------------------------------
-- FONCTION DE WRITE ATOMIQUE
-- Trigger AFTER INSERT sur analyses_versions. La fonction extrait
-- du snapshot_json (payload analyse complet) les champs typees
-- necessaires aux requetes portfolio et insere la ligne
-- correspondante dans trajectory_snapshots. La transaction parent
-- garantit l atomicite : si l insertion dans analyses_versions
-- reussit, l insertion dans trajectory_snapshots est commit avec
-- elle ; en cas d echec de la projection, l insertion source est
-- rollback.
--
-- L extraction tolere des payloads partiels ou des formats
-- historiques (versions anciennes sans champs Phase 4). Les
-- valeurs absentes sont stockees NULL plutot que d echouer.
-- Si le globalScore ne peut pas etre extrait, la ligne snapshot
-- est silencieusement omise (la version source est conservee
-- intacte). C est le cas degraded : on prefere une version sans
-- son snapshot a un echec global de la pipeline.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_trajectory_snapshot_from_version()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_company_name text;
  v_global_score numeric;
  v_verdict text;
  v_team numeric;
  v_market numeric;
  v_macro numeric;
  v_financial numeric;
  v_contrarian numeric;
  v_vigilance numeric;
  v_fragilite_score numeric;
  v_fragilite_verdict text;
  v_nd_score numeric;
  v_nd_verdict text;
  v_patterns jsonb;
  v_combinaisons jsonb;
BEGIN
  -- Recupere user_id et company_name depuis analyses
  SELECT user_id, company_name INTO v_user_id, v_company_name
  FROM public.analyses
  WHERE id = NEW.analysis_id;

  IF v_user_id IS NULL OR v_company_name IS NULL THEN
    -- Analyse parente non trouvee : on ne peut pas projeter sans
    -- contexte. Cas degraded, on n insere pas. La version est
    -- conservee, le snapshot pourra etre backfille plus tard.
    RETURN NEW;
  END IF;

  -- Extraction du score global avec fallback multi-chemin
  v_global_score := COALESCE(
    NULLIF(NEW.snapshot_json->'mechanicalScore'->>'globalScore', '')::numeric,
    NULLIF(NEW.snapshot_json->'finalRecommendation'->>'globalScore', '')::numeric,
    NULLIF(NEW.snapshot_json->>'globalScore', '')::numeric
  );

  IF v_global_score IS NULL THEN
    -- Pas de score exploitable : pas de snapshot. La version reste
    -- archive complete, exploitable manuellement.
    RETURN NEW;
  END IF;

  v_verdict := COALESCE(
    NEW.snapshot_json->'mechanicalScore'->>'verdict',
    NEW.snapshot_json->'finalRecommendation'->>'verdict',
    NEW.snapshot_json->>'verdict',
    'approfondir'
  );

  -- Dimensions Bloc 1
  v_team := COALESCE(NULLIF(NEW.snapshot_json->'mechanicalScore'->'dimensions'->'team'->>'score', '')::numeric, v_global_score);
  v_market := COALESCE(NULLIF(NEW.snapshot_json->'mechanicalScore'->'dimensions'->'market'->>'score', '')::numeric, v_global_score);
  v_macro := COALESCE(NULLIF(NEW.snapshot_json->'mechanicalScore'->'dimensions'->'macro'->>'score', '')::numeric, v_global_score);
  v_financial := COALESCE(NULLIF(NEW.snapshot_json->'mechanicalScore'->'dimensions'->'financial'->>'score', '')::numeric, v_global_score);
  v_contrarian := COALESCE(NULLIF(NEW.snapshot_json->'mechanicalScore'->'dimensions'->'contrarian'->>'score', '')::numeric, v_global_score);
  v_vigilance := COALESCE(NULLIF(NEW.snapshot_json->'mechanicalScore'->'dimensions'->'vigilance'->>'score', '')::numeric, v_global_score);

  -- Fragilite Structurelle (Phase 4)
  v_fragilite_score := NULLIF(NEW.snapshot_json->'fragiliteStructurelle'->>'globalFragilityScore', '')::numeric;
  v_fragilite_verdict := NEW.snapshot_json->'fragiliteStructurelle'->>'verdict';

  -- Narrative Drift (Lecture du langage)
  v_nd_score := NULLIF(NEW.snapshot_json->'narrativeDrift'->>'globalDriftScore', '')::numeric;
  v_nd_verdict := NEW.snapshot_json->'narrativeDrift'->>'verdict';

  -- Patterns Phase 4 : on stocke tel quel (le format jsonb permet
  -- des requetes ulterieures par pattern_id sans pre-typer chaque
  -- pattern en colonne). La granularite axe-par-axe se logera
  -- dans ce meme champ a l etape suivante.
  v_patterns := COALESCE(NEW.snapshot_json->'fragiliteStructurelle'->'patterns', '{}'::jsonb);

  -- Combinaisons
  v_combinaisons := COALESCE(NEW.snapshot_json->'fragiliteStructurelle'->'combinaisons', '[]'::jsonb);

  -- Insertion atomique dans trajectory_snapshots
  -- ON CONFLICT DO UPDATE pour permettre la re-projection d une
  -- version (cas backfill ou correction de payload).
  INSERT INTO public.trajectory_snapshots (
    analysis_id, version_id, version_num,
    user_id, company_name,
    analyzed_at,
    global_score, verdict,
    dim_team, dim_market, dim_macro, dim_financial, dim_contrarian, dim_vigilance,
    fragilite_score, fragilite_verdict,
    narrative_drift_score, narrative_drift_verdict,
    patterns_json, combinaisons_json
  )
  VALUES (
    NEW.analysis_id, NEW.id, NEW.version_num,
    v_user_id, v_company_name,
    NEW.created_at,
    v_global_score, v_verdict,
    v_team, v_market, v_macro, v_financial, v_contrarian, v_vigilance,
    v_fragilite_score, v_fragilite_verdict,
    v_nd_score, v_nd_verdict,
    v_patterns, v_combinaisons
  )
  ON CONFLICT (version_id) DO UPDATE SET
    version_num = EXCLUDED.version_num,
    analyzed_at = EXCLUDED.analyzed_at,
    global_score = EXCLUDED.global_score,
    verdict = EXCLUDED.verdict,
    dim_team = EXCLUDED.dim_team,
    dim_market = EXCLUDED.dim_market,
    dim_macro = EXCLUDED.dim_macro,
    dim_financial = EXCLUDED.dim_financial,
    dim_contrarian = EXCLUDED.dim_contrarian,
    dim_vigilance = EXCLUDED.dim_vigilance,
    fragilite_score = EXCLUDED.fragilite_score,
    fragilite_verdict = EXCLUDED.fragilite_verdict,
    narrative_drift_score = EXCLUDED.narrative_drift_score,
    narrative_drift_verdict = EXCLUDED.narrative_drift_verdict,
    patterns_json = EXCLUDED.patterns_json,
    combinaisons_json = EXCLUDED.combinaisons_json;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- TRIGGER
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trajectory_snapshot_after_version_insert ON public.analyses_versions;
CREATE TRIGGER trajectory_snapshot_after_version_insert
  AFTER INSERT ON public.analyses_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.write_trajectory_snapshot_from_version();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Comme pour les autres tables Prelude, l acces direct cote client
-- est bloque ; les Route Handlers passent par service_role et
-- filtrent par user_id au niveau applicatif.
-- ------------------------------------------------------------
ALTER TABLE public.trajectory_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_client_access_trajectory_snapshots" ON public.trajectory_snapshots;
CREATE POLICY "no_client_access_trajectory_snapshots"
  ON public.trajectory_snapshots FOR ALL
  USING (false);

-- ------------------------------------------------------------
-- BACKFILL : fonction utilitaire pour re-projeter les versions
-- existantes vers trajectory_snapshots. Utile pour la migration
-- initiale (versions creees avant l existence du trigger) et
-- comme outil de reconciliation si une projection a echoue.
--
-- Appel : SELECT public.backfill_trajectory_snapshots();
-- Ou pour un analysis specifique :
-- SELECT public.backfill_trajectory_snapshots('analysis-uuid'::uuid);
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_trajectory_snapshots(p_analysis_id uuid DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT v.*
    FROM public.analyses_versions v
    WHERE (p_analysis_id IS NULL OR v.analysis_id = p_analysis_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.trajectory_snapshots s
        WHERE s.version_id = v.id
      )
    ORDER BY v.analysis_id, v.version_num
  LOOP
    -- On simule l insertion : on construit un NEW virtuel et on
    -- delegue au trigger en l invoquant explicitement.
    PERFORM public.write_trajectory_snapshot_from_version_manual(
      v_row.id, v_row.analysis_id, v_row.version_num,
      v_row.snapshot_json, v_row.created_at
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Version "manual" : meme logique que le trigger mais callable
-- directement avec les arguments en parametres. Permet le
-- backfill sans simuler de NEW record.
CREATE OR REPLACE FUNCTION public.write_trajectory_snapshot_from_version_manual(
  p_version_id uuid,
  p_analysis_id uuid,
  p_version_num integer,
  p_snapshot_json jsonb,
  p_created_at timestamptz
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_company_name text;
  v_global_score numeric;
  v_verdict text;
  v_team numeric;
  v_market numeric;
  v_macro numeric;
  v_financial numeric;
  v_contrarian numeric;
  v_vigilance numeric;
  v_fragilite_score numeric;
  v_fragilite_verdict text;
  v_nd_score numeric;
  v_nd_verdict text;
  v_patterns jsonb;
  v_combinaisons jsonb;
BEGIN
  SELECT user_id, company_name INTO v_user_id, v_company_name
  FROM public.analyses
  WHERE id = p_analysis_id;

  IF v_user_id IS NULL OR v_company_name IS NULL THEN
    RETURN;
  END IF;

  v_global_score := COALESCE(
    NULLIF(p_snapshot_json->'mechanicalScore'->>'globalScore', '')::numeric,
    NULLIF(p_snapshot_json->'finalRecommendation'->>'globalScore', '')::numeric,
    NULLIF(p_snapshot_json->>'globalScore', '')::numeric
  );

  IF v_global_score IS NULL THEN
    RETURN;
  END IF;

  v_verdict := COALESCE(
    p_snapshot_json->'mechanicalScore'->>'verdict',
    p_snapshot_json->'finalRecommendation'->>'verdict',
    p_snapshot_json->>'verdict',
    'approfondir'
  );

  v_team := COALESCE(NULLIF(p_snapshot_json->'mechanicalScore'->'dimensions'->'team'->>'score', '')::numeric, v_global_score);
  v_market := COALESCE(NULLIF(p_snapshot_json->'mechanicalScore'->'dimensions'->'market'->>'score', '')::numeric, v_global_score);
  v_macro := COALESCE(NULLIF(p_snapshot_json->'mechanicalScore'->'dimensions'->'macro'->>'score', '')::numeric, v_global_score);
  v_financial := COALESCE(NULLIF(p_snapshot_json->'mechanicalScore'->'dimensions'->'financial'->>'score', '')::numeric, v_global_score);
  v_contrarian := COALESCE(NULLIF(p_snapshot_json->'mechanicalScore'->'dimensions'->'contrarian'->>'score', '')::numeric, v_global_score);
  v_vigilance := COALESCE(NULLIF(p_snapshot_json->'mechanicalScore'->'dimensions'->'vigilance'->>'score', '')::numeric, v_global_score);

  v_fragilite_score := NULLIF(p_snapshot_json->'fragiliteStructurelle'->>'globalFragilityScore', '')::numeric;
  v_fragilite_verdict := p_snapshot_json->'fragiliteStructurelle'->>'verdict';
  v_nd_score := NULLIF(p_snapshot_json->'narrativeDrift'->>'globalDriftScore', '')::numeric;
  v_nd_verdict := p_snapshot_json->'narrativeDrift'->>'verdict';
  v_patterns := COALESCE(p_snapshot_json->'fragiliteStructurelle'->'patterns', '{}'::jsonb);
  v_combinaisons := COALESCE(p_snapshot_json->'fragiliteStructurelle'->'combinaisons', '[]'::jsonb);

  INSERT INTO public.trajectory_snapshots (
    analysis_id, version_id, version_num,
    user_id, company_name,
    analyzed_at,
    global_score, verdict,
    dim_team, dim_market, dim_macro, dim_financial, dim_contrarian, dim_vigilance,
    fragilite_score, fragilite_verdict,
    narrative_drift_score, narrative_drift_verdict,
    patterns_json, combinaisons_json
  )
  VALUES (
    p_analysis_id, p_version_id, p_version_num,
    v_user_id, v_company_name,
    p_created_at,
    v_global_score, v_verdict,
    v_team, v_market, v_macro, v_financial, v_contrarian, v_vigilance,
    v_fragilite_score, v_fragilite_verdict,
    v_nd_score, v_nd_verdict,
    v_patterns, v_combinaisons
  )
  ON CONFLICT (version_id) DO UPDATE SET
    version_num = EXCLUDED.version_num,
    analyzed_at = EXCLUDED.analyzed_at,
    global_score = EXCLUDED.global_score,
    verdict = EXCLUDED.verdict,
    dim_team = EXCLUDED.dim_team,
    dim_market = EXCLUDED.dim_market,
    dim_macro = EXCLUDED.dim_macro,
    dim_financial = EXCLUDED.dim_financial,
    dim_contrarian = EXCLUDED.dim_contrarian,
    dim_vigilance = EXCLUDED.dim_vigilance,
    fragilite_score = EXCLUDED.fragilite_score,
    fragilite_verdict = EXCLUDED.fragilite_verdict,
    narrative_drift_score = EXCLUDED.narrative_drift_score,
    narrative_drift_verdict = EXCLUDED.narrative_drift_verdict,
    patterns_json = EXCLUDED.patterns_json,
    combinaisons_json = EXCLUDED.combinaisons_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
