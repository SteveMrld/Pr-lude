// ============================================================
// GET /api/analyses/[id]/run-status
// ------------------------------------------------------------
// Lecture legere du statut d execution du pipeline pour une
// analyse en cours ou terminee. Distincte de /status (qui suit le
// stade workflow Kanban : depose, in_review, dd_field, ic_review,
// signed, declined) : ici on suit l etat de la machinerie LLM
// (pending, running, completed, failed) plus la progression
// moteur par moteur.
//
// Sert au polling cote client quand la connexion SSE de /api/analyze
// coupe : mobile en arriere-plan, hand-off reseau, fermeture
// involontaire de l onglet. Le client continue a suivre
// l avancement et bascule en mode resultat des que status='completed'.
//
// Ne charge pas result_json (typiquement 500 Ko a 2 Mo) pour rester
// rapide. Quand status='completed', le client appelle ensuite
// GET /api/analyses/[id] pour recuperer le payload complet.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisStatus, isPersistenceEnabled } from '@/lib/analysis-store';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isPersistenceEnabled()) {
    return NextResponse.json(
      { error: 'persistence-disabled' },
      { status: 404 },
    );
  }
  const snapshot = await getAnalysisStatus(params.id);
  if (!snapshot) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
