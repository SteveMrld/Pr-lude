-- ============================================================
-- PRELUDE : FERMETURE DE LA LECTURE ANONYME SUR historical_companies
-- A appliquer par : npx tsx scripts/apply-migration.ts <ce fichier>
-- Idempotent : peut etre rejoue sans casse.
--
-- CE QUI EST FERME, ET CE QUI NE L EST PAS
--
-- La mesure du 7 aout 2026, faite en interrogeant la base avec la
-- cle publique comme le ferait un navigateur et non en relisant les
-- politiques, a rendu un seul resultat sur vingt et une tables :
-- historical_companies repondait 206 avec deux cents lignes de
-- contenu reel. Toutes les autres, y compris analyses,
-- prediction_records, analysis_outcomes et realized_outcomes,
-- rendaient zero ligne. Il n y avait donc pas trois tables ouvertes,
-- il y en avait une.
--
-- La politique fautive portait `using (true)` pour le role `public`,
-- lequel couvre `anon`. La cle anonyme partant au navigateur, elle
-- n a rien de secret : `public` sur une table de reference revient a
-- publier la table.
--
-- POURQUOI LA FERMER MALGRE UN CONTENU NON CONFIDENTIEL
--
-- Les deux cents lignes sont des societes publiques et aucune donnee
-- client n y figure. Ce n est pas une fuite de donnees, c est une
-- fuite de matiere premiere : le corpus de comparables est ce qui
-- distingue le produit, et il sortait sans compte.
--
-- CE QUE LA FERMETURE NE CASSE PAS, VERIFIE AVANT
--
-- Un seul chemin lit cette table, `findComparables` dans
-- lib/comparables-engine.ts, et il construit son client avec
-- SUPABASE_SERVICE_ROLE_KEY, lequel contourne RLS. Aucun appel cote
-- navigateur n existe, ni par le client Supabase ni par l endpoint
-- REST. La lecture reste donc entiere pour le pipeline.
--
-- La politique est remplacee plutot que supprimee : une table de
-- reference doit rester lisible par un compte authentifie, sans quoi
-- un futur ecran de consultation du corpus devrait passer par une
-- route serveur pour rien.
-- ============================================================

-- La politique ouverte, nommee telle qu elle existe en base.
drop policy if exists "Anyone can read historical companies" on public.historical_companies;
drop policy if exists historical_companies_select_public on public.historical_companies;
drop policy if exists historical_companies_read_all on public.historical_companies;

-- Remplacement : lecture reservee aux comptes authentifies.
-- Le service-role n est pas concerne, il contourne RLS par nature.
drop policy if exists historical_companies_select_authenticated on public.historical_companies;
create policy historical_companies_select_authenticated
  on public.historical_companies
  for select
  to authenticated
  using (true);

-- Ceinture : RLS reste active. Un `alter table ... enable` est
-- idempotent et protege contre un etat ou elle aurait ete levee.
alter table public.historical_companies enable row level security;
