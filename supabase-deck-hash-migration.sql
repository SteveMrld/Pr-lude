-- ============================================================
-- PRELUDE - Empreinte du deck sur la ligne d analyse (deck_hash)
-- ------------------------------------------------------------
-- deckHash n etait calcule que par buildVersionStamp, en fin de
-- pipeline. Un run echoue ne portait donc aucune empreinte de son
-- entree, et aucun echec n etait rattachable au document qui
-- l avait provoque. La colonne recoit l empreinte des la creation
-- de la ligne, soit avant le premier appel au modele.
--
-- Meme fonction que le version stamp, sha256 tronque a seize
-- caracteres, pour que les deux empreintes soient comparables sans
-- conversion.
--
-- A executer via scripts/apply-migration.ts, jamais par le SQL
-- Editor. Idempotent.
-- ============================================================

alter table public.analyses
  add column if not exists deck_hash text;

create index if not exists analyses_deck_hash_idx
  on public.analyses (deck_hash)
  where deck_hash is not null;

comment on column public.analyses.deck_hash is
  'Empreinte sha256 tronquee a 16 caracteres du deck, posee a la creation de la ligne. Permet de rattacher un run echoue a son document d entree, ce que le version stamp ne peut pas faire puisqu il n existe qu en fin de pipeline.';
