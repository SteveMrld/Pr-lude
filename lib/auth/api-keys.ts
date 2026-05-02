// Helpers pour la gestion des cles BYOK d une organisation.
// Encapsulent les acces a org_api_keys avec chiffrement transparent.
// Tous les appels passent par le client service_role (RLS desactive
// en lecture/ecriture, c est ces helpers qui font le filtrage par org).

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/auth/crypto';
import { getSourceById, type SourceDescriptor } from '@/lib/sources';

export interface OrgApiKeyRow {
  source_id: string;
  masked_preview: string;
  updated_at: string;
  last_validated_at: string | null;
  last_validation_ok: boolean | null;
}

/**
 * Liste les cles configurees pour une org (sans dechiffrer).
 * Retourne uniquement les apercus masques pour affichage UI.
 */
export async function listOrgApiKeys(organizationId: string): Promise<OrgApiKeyRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('org_api_keys')
    .select('source_id, masked_preview, updated_at, last_validated_at, last_validation_ok')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Failed to list org api keys:', error);
    return [];
  }
  return data || [];
}

/**
 * Sauvegarde une cle pour une source. Chiffre avant ecriture, calcule
 * l apercu masque, upsert sur la cle composite (org_id, source_id).
 */
export async function setOrgApiKey(params: {
  organizationId: string;
  sourceId: string;
  plaintextKey: string;
  userId: string | null;
}): Promise<void> {
  const { organizationId, sourceId, plaintextKey, userId } = params;
  if (!getSourceById(sourceId)) {
    throw new Error(`Source inconnue : ${sourceId}`);
  }
  if (!plaintextKey.trim()) {
    throw new Error('Cle vide');
  }

  const encrypted = encryptSecret(plaintextKey);
  const masked = maskSecret(plaintextKey);

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from('org_api_keys').upsert(
    {
      organization_id: organizationId,
      source_id: sourceId,
      encrypted_value: encrypted,
      masked_preview: masked,
      created_by: userId,
      // last_validated_at/ok reset : il faudra retester la cle
      last_validated_at: null,
      last_validation_ok: null,
    },
    { onConflict: 'organization_id,source_id' },
  );
  if (error) {
    console.error('Failed to upsert org api key:', error);
    throw new Error('Echec sauvegarde cle');
  }
}

/**
 * Supprime une cle.
 */
export async function deleteOrgApiKey(
  organizationId: string,
  sourceId: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('org_api_keys')
    .delete()
    .eq('organization_id', organizationId)
    .eq('source_id', sourceId);
  if (error) {
    console.error('Failed to delete org api key:', error);
    throw new Error('Echec suppression cle');
  }
}

/**
 * Recupere et dechiffre une cle pour usage par un moteur.
 * Retourne null si la cle n existe pas. Throw si la KMS key est
 * invalide ou si l auth tag echoue (alteration detectee).
 *
 * Attention : a n appeler que cote serveur (Route Handlers, jobs).
 * Jamais exposer le retour au client.
 */
export async function getDecryptedOrgApiKey(
  organizationId: string,
  sourceId: string,
): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('org_api_keys')
    .select('encrypted_value')
    .eq('organization_id', organizationId)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return decryptSecret(data.encrypted_value);
  } catch (e) {
    console.error('Failed to decrypt org api key:', e);
    return null;
  }
}

/**
 * Construit un index { sourceId: SourceDescriptor } pour les sources
 * actives (cle configuree) d une org. Permet a un moteur de savoir
 * d un coup quelles sources Tier 2 sont mobilisables.
 */
export async function getActiveSourcesForOrg(
  organizationId: string,
): Promise<Record<string, SourceDescriptor>> {
  const keys = await listOrgApiKeys(organizationId);
  const out: Record<string, SourceDescriptor> = {};
  for (const k of keys) {
    const desc = getSourceById(k.source_id);
    if (desc) out[k.source_id] = desc;
  }
  return out;
}
