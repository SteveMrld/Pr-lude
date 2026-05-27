// ============================================================
// PRELUDE - Storage helper pour les depots de dossiers
// ------------------------------------------------------------
// Centralise tout ce qui touche au bucket 'dossier-uploads' :
//   - generation de signed upload URLs (cote /api/uploads/sign)
//   - download serveur des fichiers a partir d une reference
//     (cote /api/analyze et /api/analyses/[id]/dd-deepen)
//   - validation des references envoyees par le client
//
// Pourquoi un module dedie : le pipeline d analyse a besoin de
// recuperer les octets bruts pour les passer aux moteurs LLM en
// vision (base64), mais le navigateur ne doit plus jamais poster
// les octets dans le body de la fonction Vercel (limite 4,5 Mo).
// Le flux devient :
//
//   client                       serveur                Storage
//   ------                       -------                -------
//   POST /api/uploads/sign  -->  signe un URL pour le
//                                chemin <session>/<file>
//                                   |
//                                   v
//   PUT <signed-url>                                    [octets stockes]
//   POST /api/analyze       -->  recoit les refs
//                                download <bucket>/<path>
//                                process + base64
//                                pipeline LLM
//
// Le bucket est prive : la lecture est gardee par service-role.
// Aucune URL publique n est jamais emise vers le navigateur.
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export const DOSSIER_BUCKET = 'dossier-uploads';

/**
 * Reference d un fichier upload dans le bucket. Contient le
 * minimum necessaire au serveur pour le retrouver et au pipeline
 * pour le classifier (file-processor utilise name et mimeType).
 */
export interface DossierFileRef {
  storagePath: string;
  name: string;
  mimeType: string;
  size: number;
}

/**
 * Validation legere d une reference recue du client. On ne fait
 * pas confiance au client sur le chemin : il doit etre relatif au
 * bucket et commencer par le prefixe de session attendu. Cela
 * empeche un client malveillant de tenter de telecharger un
 * fichier d un autre dossier (path traversal protection).
 */
export function isValidStoragePath(path: string, sessionPrefix: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (path.includes('..')) return false;
  if (path.startsWith('/')) return false;
  if (!path.startsWith(sessionPrefix + '/')) return false;
  // Borne raisonnable pour ne pas accepter de chemins delirants.
  if (path.length > 512) return false;
  return true;
}

/**
 * Genere un chemin de stockage canonique pour un fichier upload.
 * Forme : <ownerKey>/<sessionId>/<uniqueId>-<sanitizedName>
 *
 * - ownerKey : auth.uid() en mode auth, 'solo' en mode solo.
 *   La policy storage.objects RLS verifie que le folder racine
 *   correspond bien a l auth.uid() de l utilisateur connecte.
 * - sessionId : un UUID genere cote serveur a chaque ouverture
 *   d une session d upload. Le client le reutilise pour tous les
 *   fichiers du meme dossier.
 * - uniqueId-name : evite les collisions si l utilisateur uploade
 *   deux fichiers du meme nom dans la meme session.
 */
export function buildStoragePath(
  ownerKey: string,
  sessionId: string,
  filename: string,
): string {
  const sanitized = sanitizeFilename(filename);
  const uid = randomUUID().slice(0, 8);
  return `${ownerKey}/${sessionId}/${uid}-${sanitized}`;
}

function sanitizeFilename(name: string): string {
  // Garde les caracteres safe : alphanumeriques, point, tiret,
  // underscore, espace converti en tiret. Limite a 120 caracteres
  // pour ne pas exploser la longueur des chemins Storage.
  const cleaned = name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleaned) return 'file';
  return cleaned.slice(0, 120);
}

/**
 * Cree un signed upload URL pour permettre au client de PUT
 * directement les octets sans transit par notre fonction.
 *
 * Le signed URL est utilisable une seule fois et expire (defaut
 * Supabase : 2 heures). Suffisant pour qu un partner termine
 * son upload meme sur connexion mobile lente.
 */
export async function createSignedUploadUrl(storagePath: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
}> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .storage
    .from(DOSSIER_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw new Error(`signed-upload-url-failed: ${error?.message || 'unknown'}`);
  }
  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

/**
 * Telecharge le fichier depuis Storage en Buffer cote serveur.
 * Utilise le service-role (bypass RLS) parce que les fonctions
 * /api/analyze et /api/analyses/[id]/dd-deepen tournent cote
 * Node et ont legitimement besoin d acceder a tous les depots
 * d un dossier en cours d analyse.
 */
export async function downloadDossierFile(storagePath: string): Promise<Buffer> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .storage
    .from(DOSSIER_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(`storage-download-failed: ${storagePath} (${error?.message || 'no-data'})`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Supprime un ou plusieurs fichiers du bucket. Utile pour nettoyer
 * les uploads en cas d echec d analyse ou de suppression d un
 * dossier. Non-bloquant : retourne true si l API Supabase n a
 * pas remonte d erreur, sans throw.
 */
export async function deleteDossierFiles(storagePaths: string[]): Promise<boolean> {
  if (!storagePaths || storagePaths.length === 0) return true;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .storage
      .from(DOSSIER_BUCKET)
      .remove(storagePaths);
    if (error) {
      console.warn('[dossier-uploads] delete failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[dossier-uploads] delete exception:', err?.message || err);
    return false;
  }
}
