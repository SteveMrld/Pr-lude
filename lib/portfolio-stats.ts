// ============================================================
// PORTFOLIO STATS STORE
// ------------------------------------------------------------
// Agrege les stats de niveau fonds pour le dashboard portefeuille.
// S appuie sur listAnalyses() existant (qui marche dans /history)
// pour recuperer les dossiers de l user courant. Pas de duplication
// de la logique de filtrage par user_id ou organization_id.
//
// Pour la duree par stade et la conversion entre stades, on attaque
// directement la table analyses_workflow_history en lecture admin.
// Tolerant aux erreurs : si la table n existe pas ou est vide, on
// renvoie just les stats agregees sans ces dimensions.
// ============================================================

import 'server-only';
import { listAnalyses } from './analysis-store';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface PortfolioStats {
  total: number;
  velocity: Array<{ month: string; count: number }>;
  byStage: Record<string, number>;
  byVerdict: Record<string, number>;
  bySector: Array<{ sector: string; count: number }>;
  byCountry: Array<{ country: string; count: number }>;
  stageDurations: Record<string, { avgDays: number | null; samples: number }>;
  conversion: Array<{ from: string; to: string; rate: number; total: number }>;
  lastAnalysisAt: string | null;
  avgGlobalScore: number | null;
  avgBlindspotScore: number | null;
}

const STAGE_ORDER = ['deposited', 'in_review', 'dd_field', 'ic_review', 'signed', 'declined'];

/**
 * Calcule toutes les stats portefeuille pour l user courant.
 * Renvoie null si pas d auth ou pas de persistance.
 * Renvoie un PortfolioStats avec total=0 si l user n a pas encore
 * d analyse en base.
 */
export async function getPortfolioStats(): Promise<PortfolioStats | null> {
  // listAnalyses gere l auth + l isPersistenceEnabled :
  //  - si auth pas active : utilise PRELUDE_SOLO_USER_ID
  //  - si auth active mais pas de session : retourne []
  //  - si persistance pas active : retourne []
  const analyses = await listAnalyses({ limit: 500 });

  if (analyses.length === 0) {
    return emptyStats();
  }

  const total = analyses.length;
  const analysisIds = analyses.map((a) => a.id);

  // Historique workflow (best effort) pour durees et conversion.
  let history: Array<{ analysis_id: string; from_stage: string | null; to_stage: string; changed_at: string }> = [];
  const admin = getAdmin();
  if (admin) {
    try {
      const { data } = await admin
        .from('analyses_workflow_history')
        .select('analysis_id, from_stage, to_stage, changed_at')
        .in('analysis_id', analysisIds)
        .order('changed_at', { ascending: true });
      history = data || [];
    } catch {
      history = [];
    }
  }

  // ---------------------- VELOCITY (12 derniers mois)
  const velocity: Array<{ month: string; count: number }> = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    velocity.push({ month: key, count: 0 });
  }
  analyses.forEach((a) => {
    const at = a.createdAt;
    if (!at) return;
    const d = new Date(at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = velocity.find((v) => v.month === key);
    if (bucket) bucket.count++;
  });

  // ---------------------- BY STAGE (le workflowStage est joint par listAnalyses)
  const byStage: Record<string, number> = {};
  STAGE_ORDER.forEach((s) => { byStage[s] = 0; });
  analyses.forEach((a) => {
    const stage = a.workflowStage || 'deposited';
    byStage[stage] = (byStage[stage] || 0) + 1;
  });

  // ---------------------- BY VERDICT
  const byVerdict: Record<string, number> = {};
  analyses.forEach((a) => {
    const v = (a.verdict || '').toLowerCase();
    let key = 'autre';
    if (v.includes('investir') && v.includes('condition')) key = 'investir-conditions';
    else if (v.includes('investir') || v.includes('passer') || v.includes('go')) key = 'investir';
    else if (v.includes('approfondir') || v.includes('hold') || v.includes('reporter')) key = 'approfondir';
    else if (v.includes('refuser') || v.includes('reject') || v.includes('no-go') || v.includes('refuse')) key = 'refuser';
    byVerdict[key] = (byVerdict[key] || 0) + 1;
  });

  // ---------------------- BY SECTOR
  const sectorMap: Record<string, number> = {};
  analyses.forEach((a) => {
    const s = (a.sector || '').trim();
    if (!s) return;
    sectorMap[s] = (sectorMap[s] || 0) + 1;
  });
  const bySector = Object.entries(sectorMap)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ---------------------- BY COUNTRY
  const countryMap: Record<string, number> = {};
  analyses.forEach((a) => {
    const c = (a.country || '').trim();
    if (!c) return;
    countryMap[c] = (countryMap[c] || 0) + 1;
  });
  const byCountry = Object.entries(countryMap)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ---------------------- DUREES PAR STAGE
  const stageDurations: Record<string, { avgDays: number | null; samples: number }> = {};
  STAGE_ORDER.forEach((s) => { stageDurations[s] = { avgDays: null, samples: 0 }; });

  const historyByAnalysis: Record<string, Array<typeof history[0]>> = {};
  history.forEach((h) => {
    if (!historyByAnalysis[h.analysis_id]) historyByAnalysis[h.analysis_id] = [];
    historyByAnalysis[h.analysis_id].push(h);
  });

  const durationsByStage: Record<string, number[]> = {};
  Object.values(historyByAnalysis).forEach((rows) => {
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      const fromStage = prev.to_stage;
      const dt = (new Date(curr.changed_at).getTime() - new Date(prev.changed_at).getTime()) / (1000 * 60 * 60 * 24);
      if (dt < 0 || dt > 365) continue;
      if (!durationsByStage[fromStage]) durationsByStage[fromStage] = [];
      durationsByStage[fromStage].push(dt);
    }
  });

  Object.entries(durationsByStage).forEach(([stage, days]) => {
    if (days.length === 0) return;
    const avg = days.reduce((a, b) => a + b, 0) / days.length;
    stageDurations[stage] = { avgDays: Math.round(avg * 10) / 10, samples: days.length };
  });

  // ---------------------- CONVERSION ENTRE STAGES
  const reachedStage: Record<string, Set<string>> = {};
  STAGE_ORDER.forEach((s) => { reachedStage[s] = new Set(); });
  analysisIds.forEach((id) => reachedStage['deposited'].add(id));

  Object.entries(historyByAnalysis).forEach(([analysisId, rows]) => {
    rows.forEach((row) => {
      if (reachedStage[row.to_stage]) {
        reachedStage[row.to_stage].add(analysisId);
      }
    });
  });
  analyses.forEach((a) => {
    const currentStage = a.workflowStage;
    if (currentStage && reachedStage[currentStage]) {
      reachedStage[currentStage].add(a.id);
    }
  });

  const conversionPairs: Array<[string, string]> = [
    ['deposited', 'in_review'],
    ['in_review', 'dd_field'],
    ['dd_field', 'ic_review'],
    ['ic_review', 'signed'],
  ];
  const conversion = conversionPairs.map(([from, to]) => {
    const fromCount = reachedStage[from].size;
    const toCount = reachedStage[to].size;
    const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
    return { from, to, rate, total: fromCount };
  });

  // ---------------------- AVG SCORES
  const validScores = analyses.map((a) => a.globalScore).filter((v): v is number => typeof v === 'number');
  const avgGlobalScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null;

  const validBlindspots = analyses.map((a) => a.blindspotScore).filter((v): v is number => typeof v === 'number');
  const avgBlindspotScore = validBlindspots.length > 0
    ? Math.round(validBlindspots.reduce((a, b) => a + b, 0) / validBlindspots.length)
    : null;

  const lastAnalysisAt = analyses[0]?.createdAt || null;

  return {
    total,
    velocity,
    byStage,
    byVerdict,
    bySector,
    byCountry,
    stageDurations,
    conversion,
    lastAnalysisAt,
    avgGlobalScore,
    avgBlindspotScore,
  };
}

function emptyStats(): PortfolioStats {
  const empty: PortfolioStats = {
    total: 0,
    velocity: [],
    byStage: {},
    byVerdict: {},
    bySector: [],
    byCountry: [],
    stageDurations: {},
    conversion: [],
    lastAnalysisAt: null,
    avgGlobalScore: null,
    avgBlindspotScore: null,
  };
  STAGE_ORDER.forEach((s) => {
    empty.byStage[s] = 0;
    empty.stageDurations[s] = { avgDays: null, samples: 0 };
  });
  return empty;
}
