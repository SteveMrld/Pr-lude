-- ============================================================
-- PRELUDE BYOK SCHEMA (commit 2b)
-- A executer dans le SQL Editor de Supabase, apres supabase-auth-schema.sql.
-- Idempotent : peut etre rejoue sans casse.
--
-- Cree la table org_api_keys ou chaque organisation stocke ses cles
-- API tierces (Pitchbook, Sayari, Bloomberg, Crunchbase Pro...).
-- Les valeurs sont chiffrees applicativement (AES-256-GCM) avec
-- PRELUDE_KMS_KEY avant ecriture, donc inutilisables sans la KMS key
-- meme en cas d acces direct a la base.
-- ============================================================

create table if not exists public.org_api_keys (
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  -- source_id : matche SourceDescriptor.id du registry
  -- (pappers, pitchbook, sayari, bloomberg, etc.)
  source_id        text not null,
  -- Valeur chiffree (format v1:iv:authtag:ciphertext, cf lib/auth/crypto.ts)
  encrypted_value  text not null,
  -- Apercu masque de la cle ('••••••••xY9z') pour affichage UI sans
  -- decryption (evite de hit la KMS key sur chaque render).
  masked_preview   text not null,
  -- Trace operationnelle : qui a saisi/maj la cle, et quand.
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Statut de derniere verification (optionnel, mis a jour par un test
  -- de connectivite a la source). Permet d afficher 'Cle valide' ou
  -- 'Cle invalide' dans l UI Settings.
  last_validated_at  timestamptz,
  last_validation_ok boolean,

  primary key (organization_id, source_id)
);

create index if not exists idx_org_api_keys_organization
  on public.org_api_keys (organization_id);

-- ------------------------------------------------------------
-- RLS : pas d acces direct cote client browser. Toutes les operations
-- (lecture, ecriture, decryption) passent par les Route Handlers qui
-- valident l identite et l appartenance a l org via service_role.
-- ------------------------------------------------------------
alter table public.org_api_keys enable row level security;

drop policy if exists "no_client_access_org_api_keys" on public.org_api_keys;
create policy "no_client_access_org_api_keys"
  on public.org_api_keys for all
  using (false);

-- ------------------------------------------------------------
-- Trigger updated_at automatique.
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_org_api_keys_updated_at on public.org_api_keys;
create trigger trg_org_api_keys_updated_at
  before update on public.org_api_keys
  for each row execute function public.set_updated_at();
