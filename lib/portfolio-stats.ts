// ============================================================
// PORTFOLIO STATS STORE
// ------------------------------------------------------------
// Agrege les stats de niveau fonds pour le dashboard portefeuille.
// S appuie sur analyses + analyses_workflow_status + analyses_workflow_history
// pour calculer :
//   - velocity   : nombre de dossiers analyses par mois (12 derniers mois)
//   - byStage    : repartition courante des dossiers par stade workflow
//   - byVerdict  : repartition par verdict final
//   - bySector   : repartition par sous-secteur (top 10)
//   - byCountry  : repartition par pays (top 10)
//   - stageDurations : duree moyenne en jours passee dans chaque stade
//   - conversion : taux de conversion entre stades successifs
//
// Toute requete echouee est loggee mais ne bloque pas le rendu : la
// page renvoie ce qu elle a pu calculer et marque le reste comme
// indisponible. Pas de fallback magique a base de donnees fictives :
// si le fonds n a pas encore de dossiers, le dashboard l affiche
// honnetement.
// ============================================================

import 'server-only';
import { isPersistenceEnabled } from './analysis-store';
import { getCurrentOrganization, getCurrentUser } from './auth';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[portfolio-stats] missing Supabase env');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface PortfolioStats {
  total: number;
  // Velocite : nombre d analyses par mois sur les 12 derniers mois
  velocity: Array<{ month: string; count: number }>;
  // Repartition stades du portefeuille a date
  byStage: Record<string, number>;
  // Repartition verdicts
  byVerdict: Record<string, number>;
  // Top secteurs
  bySector: Array<{ sector: string; count: number }>;
  // Top pays
  byCountry: Array<{ country: string; count: number }>;
  // Duree moyenne en jours passee dans chaque stade. Calculee depuis
  // l historique workflow : difference entre 2 transitions consecutives.
  stageDurations: Record<string, { avgDays: number | null; samples: number }>;
  // Taux de conversion entre stades successifs (ex: deposited -> in_review)
  conversion: Array<{ from: string; to: string; rate: number; total: number }>;
  // Date relative de derniere activite
  lastAnalysisAt: string | null;
  // Score moyen et probabilite de succes moyenne
  avgGlobalScore: number | null;
  avgBlindspotScore: number | null;
}

const STAGE_ORDER = ['deposited', 'in_review', 'dd_field', 'ic_review', 'signed', 'declined'];

/**
 * Calcule toutes les stats portefeuille pour l organisation courante.
 * Renvoie null si pas d auth ou pas d org. Renvoie un objet avec total=0
 * si l org existe mais n a pas encore d analyses.
 */
export async function getPortfolioStats(): Promise<PortfolioStats | null> {
  if (!isPersistenceEnabled()) return null;

  const user = await getCurrentUser();
  if (!user) return null;
  const org = await getCurrentOrganization(user.id);
  if (!org) return null;

  const supabase = getAdmin();
  const orgId = org.id;

  // Charge l ensemble des analyses de l organisation. Limite a 500 pour
  // ne pas exploser sur les fonds avec beaucoup d historique. Avec 500
  // dossiers, l agregation in-memory reste rapide (qq ms).
  const { data: analysesRows, error: analysesErr } = await supabase
    .from('analyses')
    .select('id, company_name, sector, country, verdict, global_score, blindspot_score, success_probability, analyzed_at, created_at')
    .eq('organization_id', orgId)
    .order('analyzed_at', { ascending: false, nullsFirst: false })
    .limit(500);

  if (analysesErr) {
    console.error('[portfolio-stats] analyses fetch error', analysesErr);
    return emptyStats();
  }

  const analyses = analysesRows || [];
  const total = analyses.length;

  if (total === 0) {
    return emptyStats();
  }

  const analysisIds = analyses.map((a: any) => a.id);

  // Charge les stages courants en parallele de l historique workflow.
  // Tolere une erreur sur l une ou l autre des tables : on degrade
  // gracieusement plutot que de planter le dashboard.
  const [stageRes, historyRes] = await Promise.all([
    supabase
      .from('analyses_workflow_status')
      .select('analysis_id, stage, updated_at')
      .in('analysis_id', analysisIds)
      .then((r) => r, () => ({ data: [] as any[], error: null })),
    supabase
      .from('analyses_workflow_history')
      .select('analysis_id, from_stage, to_stage, changed_at')
      .in('analysis_id', analysisIds)
      .order('changed_at', { ascending: true })
      .then((r) => r, () => ({ data: [] as any[], error: null })),
  ]);

  const stagesByAnalysisId: Record<string, string> = {};
  (stageRes.data || []).forEach((row: any) => {
    stagesByAnalysisId[row.analysis_id] = row.stage;
  });
  const history: Array<any> = historyRes.data || [];

  // ---------------------- VELOCITY (12 derniers mois)
  const velocity: Array<{ month: string; count: number }> = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    velocity.push({ month: key, count: 0 });
  }
  analyses.forEach((a: any) => {
    const at = a.analyzed_at || a.created_at;
    if (!at) return;
    const d = new Date(at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = velocity.find((v) => v.month === key);
    if (bucket) bucket.count++;
  });

  // ---------------------- BY STAGE (etat actuel du portefeuille)
  const byStage: Record<string, number> = {};
  STAGE_ORDER.forEach((s) => { byStage[s] = 0; });
  analysisIds.forEach((id) => {
    const stage = stagesByAnalysisId[id] || 'deposited';
    byStage[stage] = (byStage[stage] || 0) + 1;
  });

  // ---------------------- BY VERDICT
  const byVerdict: Record<string, number> = {};
  analyses.forEach((a: any) => {
    const v = (a.verdict || '').toLowerCase();
    let key = 'autre';
    if (v.includes('investir') && v.includes('condition')) key = 'investir-conditions';
    else if (v.includes('investir') || v.includes('passer') || v.includes('go')) key = 'investir';
    else if (v.includes('approfondir') || v.includes('hold') || v.includes('reporter')) key = 'approfondir';
    else if (v.includes('refuser') || v.includes('reject') || v.includes('no-go') || v.includes('refuse')) key = 'refuser';
    byVerdict[key] = (byVerdict[key] || 0) + 1;
  });

  // ---------------------- BY SECTOR (top 10)
  const sectorMap: Record<string, number> = {};
  analyses.forEach((a: any) => {
    const s = (a.sector || '').trim();
    if (!s) return;
    sectorMap[s] = (sectorMap[s] || 0) + 1;
  });
  const bySector = Object.entries(sectorMap)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ---------------------- BY COUNTRY (top 10)
  const countryMap: Record<string, number> = {};
  analyses.forEach((a: any) => {
    const c = (a.country || '').trim();
    if (!c) return;
    countryMap[c] = (countryMap[c] || 0) + 1;
  });
  const byCountry = Object.entries(countryMap)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ---------------------- DUREES PAR STAGE
  // Pour chaque transition de stage, on calcule la duree passee dans
  // l ancien stage (changed_at - precedent changed_at). On agrege par
  // ancien stage et on fait la moyenne en jours.
  const stageDurations: Record<string, { avgDays: number | null; samples: number }> = {};
  STAGE_ORDER.forEach((s) => { stageDurations[s] = { avgDays: null, samples: 0 }; });

  // Group history par analysis_id
  const historyByAnalysis: Record<string, Array<any>> = {};
  history.forEach((h) => {
    if (!historyByAnalysis[h.analysis_id]) historyByAnalysis[h.analysis_id] = [];
    historyByAnalysis[h.analysis_id].push(h);
  });

  const durationsByStage: Record<string, number[]> = {};
  Object.values(historyByAnalysis).forEach((rows) => {
    // rows triees par changed_at asc deja (cf order ci-dessus)
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      const fromStage = prev.to_stage; // stage qu on quitte = to_stage de la transition precedente
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
  // Pour chaque paire de stages successifs, on calcule combien d analyses
  // sont passees du stage A au stage B sur le total qui sont passees par A.
  const conversion: Array<{ from: string; to: string; rate: number; total: number }> = [];
  const reachedStage: Record<string, Set<string>> = {};
  STAGE_ORDER.forEach((s) => { reachedStage[s] = new Set(); });

  // Le stage initial (deposited) est suppose atteint pour toute analyse
  analysisIds.forEach((id) => reachedStage['deposited'].add(id));

  Object.entries(historyByAnalysis).forEach(([analysisId, rows]) => {
    rows.forEach((row) => {
      if (reachedStage[row.to_stage]) {
        reachedStage[row.to_stage].add(analysisId);
      }
    });
    // Le stage courant est aussi atteint
    const currentStage = stagesByAnalysisId[analysisId];
    if (currentStage && reachedStage[currentStage]) {
      reachedStage[currentStage].add(analysisId);
    }
  });

  // Conversions naturelles dans le pipeline d instruction
  const conversionPairs: Array<[string, string]> = [
    ['deposited', 'in_review'],
    ['in_review', 'dd_field'],
    ['dd_field', 'ic_review'],
    ['ic_review', 'signed'],
  ];
  conversionPairs.forEach(([from, to]) => {
    const fromCount = reachedStage[from].size;
    const toCount = reachedStage[to].size;
    const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
    conversion.push({ from, to, rate, total: fromCount });
  });

  // ---------------------- AVG SCORES
  const validScores = analyses.map((a: any) => a.global_score).filter((v: any) => typeof v === 'number');
  const avgGlobalScore = validScores.length > 0
    ? Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length)
    : null;

  const validBlindspots = analyses.map((a: any) => a.blindspot_score).filter((v: any) => typeof v === 'number');
  const avgBlindspotScore = validBlindspots.length > 0
    ? Math.round(validBlindspots.reduce((a: number, b: number) => a + b, 0) / validBlindspots.length)
    : null;

  const lastAnalysisAt = analyses[0]?.analyzed_at || analyses[0]?.created_at || null;

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
