-- ============================================================
-- PRELUDE - Migration : transit Storage + statut pipeline
-- ------------------------------------------------------------
-- A executer dans le SQL Editor de Supabase. Idempotente (IF NOT
-- EXISTS partout). Reversible : voir bloc DOWN en fin de fichier.
--
-- Objectif :
--   1. Bucket prive 'dossier-uploads' pour les decks, BP et autres
--      pieces deposees. Le navigateur uploade directement les
--      octets via un signed URL, /api/analyze ne recoit plus que
--      les references (chemin, nom, type, taille). Resout le
--      FUNCTION_PAYLOAD_TOO_LARGE des fonctions Vercel (4,5 Mo).
--
--   2. Colonnes status, progress, started_at, completed_at,
--      error_message sur la table analyses. Permet de creer la
--      ligne en debut de requete (avant que le pipeline n ait
--      tourne), de poser un statut terminal a la fin, et au
--      client de poller l etat plutot que de tenir une reponse
--      synchrone de plusieurs minutes. Resout le "Analyse
--      introuvable" qui venait d une ligne jamais ecrite (mort
--      de la fonction avant la persistance finale).
--
--   3. Relachement du NOT NULL sur result_json et verdict :
--      au moment du INSERT a t0, ces deux champs ne sont pas
--      encore connus. Ils sont remplis a la fin du pipeline par
--      UPDATE.
-- ============================================================

-- ============================================================
-- 1. Bucket Storage dedie aux depots
-- ------------------------------------------------------------
-- Cree via INSERT dans storage.buckets parce que le SQL Editor
-- Supabase n a pas d API dediee. Le bucket est prive (public=false)
-- pour interdire toute lecture anonyme : les fichiers ne sont
-- accessibles que par signed URL (cote client a l upload) ou par
-- le service-role (cote serveur pour le download).
--
-- Limite par fichier : 50 Mo (file_size_limit en octets). Couvre
-- les decks lourds (slides image-heavy + integrations) sans
-- ouvrir la porte aux uploads abusifs.
--
-- MIME types : on accepte tout. Le file-processor cote serveur
-- discrimine entre PDF, Excel, CSV et Word ; un mauvais MIME
-- est filtre la-bas et n entraine pas un blocage premature ici.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dossier-uploads', 'dossier-uploads', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit;

-- ============================================================
-- Policies sur storage.objects pour le bucket dossier-uploads.
-- ------------------------------------------------------------
-- En mode solo (ENABLE_AUTH=false), c est le service-role qui
-- signe les uploads et qui telecharge cote serveur : le
-- service-role bypasse toutes les policies, donc aucune regle
-- n est requise pour le mode solo.
--
-- En mode multi-user (ENABLE_AUTH=true), on autorise
-- l utilisateur authentifie a uploader sur son propre chemin
-- prefixe par son auth.uid(). Le serveur lit toujours via
-- service-role.
--
-- DROP IF EXISTS pour rendre les policies idempotentes en cas
-- de re-execution de la migration sur une base deja partiellement
-- migree.
-- ============================================================
DROP POLICY IF EXISTS "dossier_uploads_insert_authenticated"
  ON storage.objects;
CREATE POLICY "dossier_uploads_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dossier-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "dossier_uploads_select_authenticated"
  ON storage.objects;
CREATE POLICY "dossier_uploads_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dossier-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 2. Colonnes de suivi du pipeline sur la table analyses
-- ------------------------------------------------------------
-- status : etat du pipeline pour cette analyse.
--   'pending'   -> ligne creee mais pipeline pas encore demarre
--                  (rare, intermediaire technique)
--   'running'   -> pipeline en cours, progress est rempli
--   'completed' -> pipeline termine avec succes, result_json present
--   'failed'    -> pipeline termine en erreur, error_message present
--
-- Le defaut 'completed' garantit que les lignes deja en base avant
-- la migration restent affichees comme terminees dans Historique
-- sans modification additionnelle.
--
-- progress : snapshot leger pour le polling cote client. Contient
-- la liste des moteurs avec leur statut (idle/running/done/error)
-- et la duree mesuree cote serveur. Permet a l UI de reconstruire
-- la timeline meme apres une coupure SSE.
-- ============================================================
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS progress JSONB;

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Source files persistes en Storage : on garde les references
-- (chemins) pour audit, re-download eventuel par Bloc 2, et
-- nettoyage ulterieur. La forme est un array d objets
--   [{ storagePath, name, mimeType, size, nature }]
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS uploaded_files JSONB;

-- Index sur status pour permettre le filtrage rapide des analyses
-- en cours (admin, dashboard, cleanup des jobs orphelins).
CREATE INDEX IF NOT EXISTS analyses_status_idx
  ON public.analyses (user_id, status);

-- ============================================================
-- 3. Relachement des NOT NULL sur les colonnes remplies en fin
-- ------------------------------------------------------------
-- result_json et verdict ne sont connus qu apres le pipeline.
-- A la creation t0, ils sont NULL ; ils sont mis a jour par
-- UPDATE quand le pipeline progresse puis se termine.
--
-- L extracion de metadonnees (extractAnalysisMetadata) tolere
-- deja le NULL : sector, sub_sector, etc. sont nullables, et
-- companyName retombe sur 'Sans nom' par defaut.
-- ============================================================
ALTER TABLE public.analyses
  ALTER COLUMN result_json DROP NOT NULL;

ALTER TABLE public.analyses
  ALTER COLUMN verdict DROP NOT NULL;

-- ============================================================
-- DOWN (rollback manuel, non execute automatiquement)
-- ------------------------------------------------------------
-- Pour annuler cette migration :
--
--   ALTER TABLE public.analyses DROP COLUMN status;
--   ALTER TABLE public.analyses DROP COLUMN progress;
--   ALTER TABLE public.analyses DROP COLUMN error_message;
--   ALTER TABLE public.analyses DROP COLUMN started_at;
--   ALTER TABLE public.analyses DROP COLUMN completed_at;
--   ALTER TABLE public.analyses DROP COLUMN uploaded_files;
--   DROP INDEX IF EXISTS analyses_status_idx;
--   ALTER TABLE public.analyses ALTER COLUMN result_json SET NOT NULL;
--   ALTER TABLE public.analyses ALTER COLUMN verdict SET NOT NULL;
--   DROP POLICY IF EXISTS "dossier_uploads_insert_authenticated"
--     ON storage.objects;
--   DROP POLICY IF EXISTS "dossier_uploads_select_authenticated"
--     ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'dossier-uploads';
--
-- Attention : restaurer le NOT NULL sur verdict ou result_json
-- echouera s il existe des lignes status='running' ou 'failed'
-- creees apres cette migration. Vider ou completer ces lignes
-- avant de re-imposer les contraintes.
-- ============================================================
