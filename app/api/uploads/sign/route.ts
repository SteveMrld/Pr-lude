// ============================================================
// POST /api/uploads/sign
// ------------------------------------------------------------
// Genere des signed upload URLs pour le bucket dossier-uploads.
// Le client appelle cette route AVANT /api/analyze pour pousser
// les octets de chaque fichier directement vers Supabase Storage
// (via PUT signe), de sorte que le body de /api/analyze ne porte
// plus que des references legeres et reste sous le plafond Vercel
// de 4,5 Mo par fonction.
//
// Securite :
//   - En mode auth, on prefixe systematiquement le chemin par
//     auth.uid()/ pour s aligner avec la policy storage.objects
//     (cf supabase-uploads-and-status-schema.sql). Un user
//     authentifie ne peut pousser que dans son propre folder.
//   - En mode solo, le chemin est prefixe par 'solo/'. Le bucket
//     reste prive et seul le service-role peut telecharger ; la
//     signature elle-meme suffit a authoriser le PUT temporaire.
//   - Le client ne choisit jamais librement le chemin : il fournit
//     uniquement le sessionId et les noms de fichiers, le serveur
//     genere le chemin canonique.
//
// Body attendu :
//   { sessionId: string, files: [{ name: string }, ...] }
//
// Reponse :
//   { sessionId, uploads: [{ name, storagePath, signedUrl, token }] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled, getAuthenticatedContext } from '@/lib/auth';
import {
  buildStoragePath,
  createSignedUploadUrl,
} from '@/lib/storage/dossier-uploads';
import { logException } from '@/lib/error-logger';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Limites defensives sur le body : le client ne doit pas demander
// 200 URLs d un coup (un dossier standard a 1 a 10 pieces).
const MAX_FILES_PER_REQUEST = 25;
const MAX_FILENAME_LENGTH = 200;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  if (!sessionId || !/^[a-zA-Z0-9-]{8,64}$/.test(sessionId)) {
    return NextResponse.json({ error: 'invalid-session-id' }, { status: 400 });
  }

  const files: Array<{ name: string }> = Array.isArray(body?.files) ? body.files : [];
  if (files.length === 0) {
    return NextResponse.json({ error: 'no-files' }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json({ error: 'too-many-files' }, { status: 400 });
  }
  for (const f of files) {
    if (!f || typeof f.name !== 'string' || f.name.length === 0 || f.name.length > MAX_FILENAME_LENGTH) {
      return NextResponse.json({ error: 'invalid-filename' }, { status: 400 });
    }
  }

  // Resolution de la cle de proprietaire (auth.uid() ou 'solo').
  // Le folder racine du chemin doit correspondre a la policy
  // storage.objects definie dans la migration. En mode solo, le
  // bucket reste accessible uniquement par service-role : la cle
  // 'solo' sert seulement de namespace logique.
  let ownerKey = 'solo';
  if (isAuthEnabled()) {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    ownerKey = ctx.user.id;
  }

  try {
    const uploads = await Promise.all(
      files.map(async (f) => {
        const storagePath = buildStoragePath(ownerKey, sessionId, f.name);
        const signed = await createSignedUploadUrl(storagePath);
        return {
          name: f.name,
          storagePath: signed.path,
          signedUrl: signed.signedUrl,
          token: signed.token,
        };
      }),
    );

    return NextResponse.json({
      sessionId,
      ownerKey,
      uploads,
    });
  } catch (err: any) {
    await logException('api.uploads.sign', err, {
      severity: 'error',
      context: { sessionId, fileCount: files.length },
    });
    return NextResponse.json(
      { error: err?.message || 'sign-failed' },
      { status: 500 },
    );
  }
}
