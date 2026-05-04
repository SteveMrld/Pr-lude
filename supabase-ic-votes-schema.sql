-- ============================================================
-- BLOC IC VOTES : votes du comite d investissement par membre
-- ------------------------------------------------------------
-- Permet a chaque membre du comite de voter en ligne sur les
-- 4 options du Pack IC (investir, investir-conditions,
-- approfondir, refuser). Une seule entree par couple (dossier,
-- user) : un user peut changer son vote, mais ne peut pas voter
-- plusieurs fois sur le meme dossier.
--
-- A executer une fois dans le SQL Editor de Supabase pour activer
-- la fonctionnalite. Sans ca, les votes restent en mode statique
-- (radio buttons non interactifs).
-- ============================================================

CREATE TABLE IF NOT EXISTS analyses_ic_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_option text NOT NULL CHECK (vote_option IN (
    'investir',
    'investir-conditions',
    'approfondir',
    'refuser'
  )),
  comment text,
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(analysis_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_votes_analysis ON analyses_ic_votes(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ic_votes_user ON analyses_ic_votes(user_id);

-- RLS : tous les membres authentifies peuvent voir les votes,
-- chaque user gere son propre vote.
ALTER TABLE analyses_ic_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_view_votes" ON analyses_ic_votes;
CREATE POLICY "authenticated_view_votes" ON analyses_ic_votes FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "users_manage_own_vote" ON analyses_ic_votes;
CREATE POLICY "users_manage_own_vote" ON analyses_ic_votes FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
