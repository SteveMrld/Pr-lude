// ============================================================
// PRELUDE - Storage upload, helper client-side
// ------------------------------------------------------------
// Routine commune aux deux points d entree de la chaine
// d analyse (Bloc 1 et Bloc 2). Sortie : une liste de refs
// envoyables au pipeline serveur en JSON leger (path, name,
// mimeType, size). Plus aucun octet de fichier ne transite
// par le body des fonctions Vercel.
//
// Sequence :
//   1. Genere un sessionId (UUID v4) cote navigateur
//   2. POST /api/uploads/sign avec la liste des noms de
//      fichiers. Le serveur signe un PUT URL par fichier dans
//      le bucket dossier-uploads. En mode auth, le serveur
//      verifie la session et prefixe le chemin par auth.uid().
//      En mode solo, le prefixe est 'solo'.
//   3. Pour chaque fichier, PUT direct vers Supabase Storage.
//      Le navigateur streame les octets, pas notre fonction
//      Vercel : on contourne la limite 4,5 Mo.
//   4. Retourne refs + sessionId + ownerKey, exploitables tels
//      quels par /api/analyze et /api/analyses/[id]/dd-deepen.
//
// Le bucket est prive, les signed URLs sont single-use et
// expirent (defaut 2h). Aucun risque de fuite par scan.
// ============================================================

export interface UploadProgress {
  fileIndex: number;
  fileName: string;
  bytesUploaded: number;
  totalBytes: number;
}

export interface UploadedRef {
  storagePath: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface UploadResult {
  sessionId: string;
  ownerKey: string;
  refs: UploadedRef[];
}

interface SignResponse {
  sessionId: string;
  ownerKey: string;
  uploads: Array<{
    name: string;
    storagePath: string;
    signedUrl: string;
    token: string;
  }>;
}

/**
 * Genere un sessionId UUID v4 utilisable comme prefixe Storage.
 * Pas de dependance crypto cote client : on combine Math.random
 * et Date.now, c est suffisant pour un namespace de session, pas
 * un secret de securite. Le bucket est prive et les chemins sont
 * valides cote serveur.
 */
export function generateUploadSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback compatible vieux navigateurs.
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return seed.slice(0, 64);
}

/**
 * Uploade une liste de fichiers vers Supabase Storage et retourne
 * les references a passer aux routes /api/analyze ou /dd-deepen.
 *
 * onProgress : callback optionnel appele apres chaque fichier
 * uploade. Permet a l UI d afficher un compteur (3 / 7 fichiers).
 * Pas de progression intra-fichier (PUT signe ne supporte pas
 * d emission ProgressEvent fiable cross-browser).
 *
 * En cas d echec sur un fichier, throw immediatement. Les
 * fichiers deja uploades restent dans Storage : ils seront
 * recoltes par le cleanup TTL ou ignores au prochain upload (clef
 * unique par fichier dans le chemin).
 */
export async function uploadDossierFiles(
  files: File[],
  options?: { onProgress?: (p: UploadProgress) => void },
): Promise<UploadResult> {
  if (!files || files.length === 0) {
    throw new Error('Aucun fichier a uploader');
  }

  const sessionId = generateUploadSessionId();

  // Etape 1 : demande de signed URLs
  const signResponse = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      files: files.map((f) => ({ name: f.name })),
    }),
  });
  if (!signResponse.ok) {
    const errText = await signResponse.text();
    throw new Error(`Signature upload echouee : ${errText || signResponse.status}`);
  }
  const signData: SignResponse = await signResponse.json();
  if (!signData.uploads || signData.uploads.length !== files.length) {
    throw new Error('Reponse signature incoherente : nombre de slots different du nombre de fichiers');
  }

  // Etape 2 : PUT direct des octets vers Supabase Storage. Sequentiel
  // pour eviter de saturer la bande passante client sur des decks
  // multiples lourds (un partner sur 4G prefere un upload sur un
  // canal a pleine vitesse que cinq canaux a 200 ko/s).
  const refs: UploadedRef[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const slot = signData.uploads[i];
    const putResponse = await fetch(slot.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!putResponse.ok) {
      const errText = await putResponse.text().catch(() => '');
      throw new Error(`Upload ${file.name} echoue : ${errText || putResponse.status}`);
    }
    refs.push({
      storagePath: slot.storagePath,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    });
    if (options?.onProgress) {
      options.onProgress({
        fileIndex: i,
        fileName: file.name,
        bytesUploaded: file.size,
        totalBytes: file.size,
      });
    }
  }

  return {
    sessionId: signData.sessionId,
    ownerKey: signData.ownerKey,
    refs,
  };
}

/**
 * Poll /api/analyses/[id]/run-status jusqu a un statut terminal
 * (completed ou failed) puis charge le payload complet via
 * /api/analyses/[id]. Utilise en fallback quand la connexion SSE
 * de /api/analyze coupe : le pipeline cote serveur continue
 * independamment du client, le polling permet de recuperer le
 * resultat sans devoir relancer toute l analyse.
 *
 * Retourne le result_json complet en cas de succes, null en cas
 * d echec serveur (status='failed') ou de timeout (TTL atteint).
 *
 * TTL et cadence : 5 minutes maximum, polling toutes les 4 secondes.
 * Couvre la duree d un pipeline typique (90 a 300 secondes) avec
 * une marge confortable, sans saturer la base avec des polls a
 * 500 ms.
 */
export async function pollAnalysisUntilTerminal(
  analysisId: string,
  options?: { intervalMs?: number; maxAttempts?: number },
): Promise<any | null> {
  const intervalMs = options?.intervalMs ?? 4000;
  const maxAttempts = options?.maxAttempts ?? 80; // 80 x 4s = 5 min 20s
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let snapshot: any = null;
    try {
      const res = await fetch(`/api/analyses/${analysisId}/run-status`, {
        cache: 'no-store',
      });
      if (!res.ok) continue;
      snapshot = await res.json();
    } catch {
      continue;
    }
    if (!snapshot) continue;
    if (snapshot.status === 'completed') {
      // Charge le result_json complet une seule fois en fin de course.
      try {
        const fullRes = await fetch(`/api/analyses/${analysisId}`, {
          cache: 'no-store',
        });
        if (!fullRes.ok) return null;
        const fullData = await fullRes.json();
        return fullData?.analysis?.resultJson || null;
      } catch {
        return null;
      }
    }
    if (snapshot.status === 'failed') {
      return null;
    }
  }
  return null;
}
