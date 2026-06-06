// ============================================================
// COMPARABLES ENGINE - BINDING SUPABASE
// ------------------------------------------------------------
// Mince couche server-only qui charge le corpus historique depuis
// Supabase puis delegue le scoring au module pur scorer.ts. Toute
// la logique de matching est dans lib/comparables/structural-vector.ts
// et lib/comparables/scorer.ts, qui sont testables sans 'server-only'.
// ============================================================

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import {
  findComparablesFromCorpus,
  type ComparableFeatures,
  type ComparablesResult,
} from './comparables/scorer';

export {
  buildFeaturesFromVector,
  extractFeaturesFromAnalysis,
  findComparablesFromCorpus,
  scoreSingleCandidate,
  simulateTrajectory,
  type Comparable,
  type ComparableFeatures,
  type ComparablesResult,
  type NarrativeSpecificity,
  type TrajectoryScenario,
} from './comparables/scorer';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Trouve les comparables historiques les plus proches du dossier
 * en interrogeant la table historical_companies, puis en deleguant
 * le scoring au moteur structurel pur.
 */
export async function findComparables(
  features: ComparableFeatures,
  topN: number = 5,
  regionFilter: string | null = null,
): Promise<ComparablesResult | null> {
  const supabase = getAdmin();
  if (!supabase) return null;

  let query = supabase.from('historical_companies').select('*');
  if (regionFilter) query = query.eq('region', regionFilter);
  const { data: rows, error } = await query;
  if (error || !rows) {
    console.error('[comparables] fetch error', error);
    return null;
  }

  return findComparablesFromCorpus(features, rows, topN);
}
