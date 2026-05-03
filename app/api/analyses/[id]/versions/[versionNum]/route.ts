// ============================================================
// GET /api/analyses/[id]/versions/[versionNum]
// ------------------------------------------------------------
// Retourne le snapshot complet d une version donnee. Utilise par
// l UI de comparaison pour afficher le rapport en version v1, v2 etc.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getVersion } from '@/lib/collaboration-store';
import { isPersistenceEnabled } from '@/lib/analysis-store';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; versionNum: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json({ error: 'persistence-disabled' }, { status: 404 });
  }
  const versionNum = parseInt(params.versionNum, 10);
  if (!Number.isFinite(versionNum) || versionNum < 1) {
    return NextResponse.json({ error: 'invalid-version' }, { status: 400 });
  }
  const version = await getVersion(params.id, versionNum);
  if (!version) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  return NextResponse.json({ version });
}
