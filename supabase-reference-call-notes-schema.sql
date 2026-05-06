-- ============================================================
-- BLOC REFERENCE CALL NOTES : notes des appels de reference
-- ------------------------------------------------------------
-- Le moteur reference-checks-engine produit deja un PLAN d appels
-- (qui appeler, quelles questions). Cette table stocke les NOTES
-- DE RETOUR D APPEL : ce que le VC a appris une fois l appel
-- effectivement passe.
--
-- Ces notes sont ensuite agregees par un moteur LLM dedie
-- (reference-aggregation-engine) qui detecte :
--   - les signaux convergents entre plusieurs interlocuteurs
--   - les divergences (un dit blanc, un autre dit noir)
--   - les alertes critiques (red flag confirme par 2+ sources)
--   - l intensite de la conviction emergente
--
-- Le dossier passe ainsi du PLAN DE DD a la SYNTHESE DD au fil
-- des appels saisis. La synthese est rejouable a chaque ajout
-- de note.
--
-- A executer une fois dans le SQL Editor de Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS analyses_reference_call_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Categorisation de l appel : qui a ete appele
  call_category text NOT NULL CHECK (call_category IN (
    'founder_superior',
    'founder_peer',
    'founder_subordinate',
    'customer',
    'board_advisor',
    'weak_signal',
    'other'
  )),

  -- Contexte de l interlocuteur
  contact_name text NOT NULL,
  contact_role text,
  contact_company text,
  -- Quel fondateur ou quel client est concerne par cet appel
  -- (utile pour l agregation par fondateur).
  related_subject text,

  -- Le contenu du retour d appel
  call_date date,
  duration_minutes integer,
  raw_notes text NOT NULL,

  -- Tonalite globale ressentie par le VC pendant l appel
  -- (input rapide, le moteur LLM affine ensuite).
  overall_tone text CHECK (overall_tone IN (
    'tres_positif',
    'positif',
    'mitige',
    'negatif',
    'tres_negatif',
    'non_concluant'
  )),

  -- Evaluations rapides (1-5) sur des dimensions cles
  -- (les questions detaillees restent dans raw_notes).
  rating_competence smallint CHECK (rating_competence BETWEEN 1 AND 5),
  rating_integrity smallint CHECK (rating_integrity BETWEEN 1 AND 5),
  rating_leadership smallint CHECK (rating_leadership BETWEEN 1 AND 5),
  rating_would_work_again smallint CHECK (rating_would_work_again BETWEEN 1 AND 5),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ref_calls_analysis ON analyses_reference_call_notes(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ref_calls_author ON analyses_reference_call_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_ref_calls_category ON analyses_reference_call_notes(call_category);

-- RLS : tous les membres authentifies peuvent voir les notes,
-- l auteur peut modifier ou supprimer ses propres notes.
ALTER TABLE analyses_reference_call_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_view_ref_calls" ON analyses_reference_call_notes;
CREATE POLICY "authenticated_view_ref_calls" ON analyses_reference_call_notes FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_insert_ref_calls" ON analyses_reference_call_notes;
CREATE POLICY "authenticated_insert_ref_calls" ON analyses_reference_call_notes FOR INSERT
WITH CHECK (auth.role() = 'authenticated' AND author_id = auth.uid());

DROP POLICY IF EXISTS "authors_update_own_ref_calls" ON analyses_reference_call_notes;
CREATE POLICY "authors_update_own_ref_calls" ON analyses_reference_call_notes FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "authors_delete_own_ref_calls" ON analyses_reference_call_notes;
CREATE POLICY "authors_delete_own_ref_calls" ON analyses_reference_call_notes FOR DELETE
USING (author_id = auth.uid());


-- ============================================================
-- BLOC AGGREGATION CACHE : cache de la synthese LLM
-- ------------------------------------------------------------
-- L agregation des notes de call est une operation LLM couteuse
-- (~10s, plusieurs centaines de tokens). On la cache pour eviter
-- de la rejouer a chaque ouverture de la page. Le cache est
-- invalide a chaque ajout / modification / suppression de note.
-- ============================================================

CREATE TABLE IF NOT EXISTS analyses_reference_aggregations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  notes_count integer NOT NULL,
  notes_signature text NOT NULL,
  aggregation jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_agg_analysis ON analyses_reference_aggregations(analysis_id);

ALTER TABLE analyses_reference_aggregations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_view_ref_agg" ON analyses_reference_aggregations;
CREATE POLICY "authenticated_view_ref_agg" ON analyses_reference_aggregations FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated_manage_ref_agg" ON analyses_reference_aggregations;
CREATE POLICY "authenticated_manage_ref_agg" ON analyses_reference_aggregations FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
