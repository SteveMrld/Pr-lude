-- ============================================================
-- PRELUDE - Tag in-portfolio sur les analyses
-- ------------------------------------------------------------
-- Marque les dossiers que le fonds detient en portefeuille. Sert
-- de selecteur d eligibilite pour le cron de re-analyse automatique
-- du Score de Trajectoire : seuls les dossiers in-portfolio sont
-- re-instruits tous les six mois sans intervention partner.
--
-- Le tag est un booleen porte sur la table analyses parce que la
-- decision de classer un dossier en portefeuille est une propriete
-- du dossier lui-meme (pas de la version). Une nouvelle version d un
-- dossier herite donc automatiquement du tag. Si le fonds sort une
-- ligne, le partner decoche : la re-instruction automatique cesse.
--
-- Choix de schema : booleen plutot qu enum ou tableau de tags.
-- Steve a hesite (string array ou enum) dans le brief, mais le besoin
-- exprime est binaire (declenche la re-analyse auto, oui ou non). Un
-- enum ouvrirait la porte a "watchlist", "co-investit", "exited",
-- chacun avec sa propre semantique de monitoring, ce qui complique
-- le selecteur cron sans benefice immediat. Si le besoin emerge plus
-- tard, on remplace par un enum ou une table dediee dossier_tags.
--
-- A executer dans le SQL Editor de Supabase apres
-- supabase-persistence-schema.sql.
-- ============================================================

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS in_portfolio BOOLEAN NOT NULL DEFAULT false;

-- Index partiel : on indexe uniquement les true. Sur 1000 dossiers
-- analyses, typiquement 30-80 sont en portefeuille (ratio screening
-- vers investissement effectif). L index partiel garde la lecture
-- du cron rapide sans gonfler les ecritures sur tous les autres
-- dossiers analyses.
CREATE INDEX IF NOT EXISTS analyses_in_portfolio_idx
  ON public.analyses (user_id, in_portfolio)
  WHERE in_portfolio = true;

-- ============================================================
-- COMMENTAIRE doctrinal sur la colonne
-- ------------------------------------------------------------
-- Le commentaire est lu par les outils d introspection Supabase et
-- documente la doctrine attachee a la colonne. Aide tout integrateur
-- ulterieur (ETL, BI, audit) a comprendre la semantique sans relire
-- la doc.
-- ============================================================
COMMENT ON COLUMN public.analyses.in_portfolio IS
  'True si le fonds detient le dossier en portefeuille actif. Active la re-analyse automatique tous les six mois et la production de notifications de trajectoire crans 1 a 3. Defaut false : un dossier instruit en pre-deal reste hors monitoring continu tant que le partner ne coche pas explicitement.';
