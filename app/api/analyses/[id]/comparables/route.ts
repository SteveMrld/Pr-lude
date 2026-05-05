// ============================================================
// GET /api/analyses/[id]/comparables
// ------------------------------------------------------------
// Retourne les comparables historiques pour une analyse donnee.
// Charge le resultat complet de l analyse, extrait les features
// PULSAR, puis interroge le moteur de comparables.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getAnalysis } from '@/lib/analysis-store';
import { extractFeaturesFromAnalysis, findComparables } from '@/lib/comparables-engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 });
  }

  // Filtre region optionnel : ?region=Europe / US / Asia / NorthAmerica / Israel
  // Sans valeur, on prend le global (toutes regions confondues).
  const url = new URL(req.url);
  const region = url.searchParams.get('region');

  const analysis = await getAnalysis(id);
  if (!analysis) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const features = extractFeaturesFromAnalysis(analysis.resultJson);
  if (!features) {
    return NextResponse.json({
      error: 'features unavailable',
      reason: 'sector or scoring data missing in analysis',
    }, { status: 422 });
  }

  const comparables = await findComparables(features, 5, region || null);
  if (!comparables) {
    return NextResponse.json({ error: 'comparables fetch failed' }, { status: 500 });
  }

  return NextResponse.json({
    features,
    region,
    ...comparables,
  });
}
