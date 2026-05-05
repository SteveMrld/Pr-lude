import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Bloc E3 - Reconciliation prediction vs reality
 * --------------------------------------------------
 * Lit et ecrit les outcomes realises (decision finale du fonds) et les
 * milestones (evenements dates post-decision) pour permettre la
 * reconciliation entre ce que Prelude predisait et ce qui s est
 * reellement passe sur chaque dossier instruit.
 *
 * Les operations passent toutes par le service-role pour bypasser RLS,
 * mais filtrent toujours par user_id explicitement pour garantir l
 * isolation des donnees entre comptes.
 */

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// Types
// ============================================================

export type Decision = 'invested' | 'passed' | 'declined' | 'waitlisted';

export interface RealizedOutcome {
  id: string;
  analysisId: string;
  userId: string;
  decision: Decision;
  decisionDate: string;             // ISO date
  decisionNotes: string | null;
  entryRoundType: string | null;
  entryRoundSizeEur: number | null;
  entryValuationEur: number | null;
  entryValuationBasis: 'pre_money' | 'post_money' | null;
  entryTicketSizeEur: number | null;
  entryOwnershipPct: number | null;
  entryLead: boolean | null;
  entryCoInvestors: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export type MilestoneType =
  | 'fundraise' | 'pivot' | 'team_change' | 'revenue_update'
  | 'metric_update' | 'churn' | 'partnership' | 'product_launch'
  | 'regulatory' | 'legal' | 'macro_shock' | 'exit' | 'fail' | 'other';

export type MilestoneImpact = 'positive' | 'negative' | 'neutral' | 'mixed';

export type ThesisAlignment =
  | 'confirms_driver' | 'confirms_risk'
  | 'contradicts_driver' | 'contradicts_risk'
  | 'unforeseen_positive' | 'unforeseen_negative';

export interface Milestone {
  id: string;
  analysisId: string;
  userId: string;
  milestoneDate: string;            // ISO date
  milestoneType: MilestoneType;
  title: string;
  description: string | null;
  impact: MilestoneImpact | null;
  numericalValue: number | null;
  numericalUnit: string | null;
  thesisAlignment: ThesisAlignment | null;
  sourceUrl: string | null;
  sourceType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RealizedOutcomeInput {
  analysisId: string;
  userId: string;
  decision: Decision;
  decisionDate?: string;
  decisionNotes?: string | null;
  entryRoundType?: string | null;
  entryRoundSizeEur?: number | null;
  entryValuationEur?: number | null;
  entryValuationBasis?: 'pre_money' | 'post_money' | null;
  entryTicketSizeEur?: number | null;
  entryOwnershipPct?: number | null;
  entryLead?: boolean | null;
  entryCoInvestors?: string[] | null;
}

export interface MilestoneInput {
  analysisId: string;
  userId: string;
  milestoneDate: string;
  milestoneType: MilestoneType;
  title: string;
  description?: string | null;
  impact?: MilestoneImpact | null;
  numericalValue?: number | null;
  numericalUnit?: string | null;
  thesisAlignment?: ThesisAlignment | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
}

// ============================================================
// Mapping ligne brute -> objet TypeScript
// ============================================================

function mapOutcome(row: any): RealizedOutcome {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    userId: row.user_id,
    decision: row.decision,
    decisionDate: row.decision_date,
    decisionNotes: row.decision_notes,
    entryRoundType: row.entry_round_type,
    entryRoundSizeEur: row.entry_round_size_eur,
    entryValuationEur: row.entry_valuation_eur,
    entryValuationBasis: row.entry_valuation_basis,
    entryTicketSizeEur: row.entry_ticket_size_eur,
    entryOwnershipPct: row.entry_ownership_pct,
    entryLead: row.entry_lead,
    entryCoInvestors: row.entry_co_investors,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMilestone(row: any): Milestone {
  return {
    id: row.id,
    analysisId: row.analysis_id,
    userId: row.user_id,
    milestoneDate: row.milestone_date,
    milestoneType: row.milestone_type,
    title: row.title,
    description: row.description,
    impact: row.impact,
    numericalValue: row.numerical_value,
    numericalUnit: row.numerical_unit,
    thesisAlignment: row.thesis_alignment,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// CRUD realized_outcomes
// ============================================================

export async function getOutcomeForAnalysis(
  analysisId: string,
  userId: string,
): Promise<RealizedOutcome | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from('realized_outcomes')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[reconciliation] getOutcome error', error);
    return null;
  }
  return data ? mapOutcome(data) : null;
}

export async function upsertOutcome(input: RealizedOutcomeInput): Promise<RealizedOutcome | null> {
  const admin = getAdmin();
  if (!admin) return null;

  // Upsert sur (analysis_id) parce que UNIQUE(analysis_id) dans le schema
  const payload: any = {
    analysis_id: input.analysisId,
    user_id: input.userId,
    decision: input.decision,
    decision_date: input.decisionDate || new Date().toISOString().slice(0, 10),
    decision_notes: input.decisionNotes ?? null,
    entry_round_type: input.entryRoundType ?? null,
    entry_round_size_eur: input.entryRoundSizeEur ?? null,
    entry_valuation_eur: input.entryValuationEur ?? null,
    entry_valuation_basis: input.entryValuationBasis ?? null,
    entry_ticket_size_eur: input.entryTicketSizeEur ?? null,
    entry_ownership_pct: input.entryOwnershipPct ?? null,
    entry_lead: input.entryLead ?? null,
    entry_co_investors: input.entryCoInvestors ?? null,
  };

  const { data, error } = await admin
    .from('realized_outcomes')
    .upsert(payload, { onConflict: 'analysis_id' })
    .select('*')
    .single();

  if (error) {
    console.error('[reconciliation] upsertOutcome error', error);
    return null;
  }
  return mapOutcome(data);
}

export async function deleteOutcome(analysisId: string, userId: string): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;
  const { error } = await admin
    .from('realized_outcomes')
    .delete()
    .eq('analysis_id', analysisId)
    .eq('user_id', userId);
  if (error) {
    console.error('[reconciliation] deleteOutcome error', error);
    return false;
  }
  return true;
}

// ============================================================
// CRUD outcome_milestones
// ============================================================

export async function listMilestones(
  analysisId: string,
  userId: string,
): Promise<Milestone[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from('outcome_milestones')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('user_id', userId)
    .order('milestone_date', { ascending: false });
  if (error || !data) {
    console.error('[reconciliation] listMilestones error', error);
    return [];
  }
  return data.map(mapMilestone);
}

export async function addMilestone(input: MilestoneInput): Promise<Milestone | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const payload = {
    analysis_id: input.analysisId,
    user_id: input.userId,
    milestone_date: input.milestoneDate,
    milestone_type: input.milestoneType,
    title: input.title,
    description: input.description ?? null,
    impact: input.impact ?? null,
    numerical_value: input.numericalValue ?? null,
    numerical_unit: input.numericalUnit ?? null,
    thesis_alignment: input.thesisAlignment ?? null,
    source_url: input.sourceUrl ?? null,
    source_type: input.sourceType ?? null,
  };
  const { data, error } = await admin
    .from('outcome_milestones')
    .insert(payload)
    .select('*')
    .single();
  if (error) {
    console.error('[reconciliation] addMilestone error', error);
    return null;
  }
  return mapMilestone(data);
}

export async function deleteMilestone(milestoneId: string, userId: string): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;
  const { error } = await admin
    .from('outcome_milestones')
    .delete()
    .eq('id', milestoneId)
    .eq('user_id', userId);
  if (error) {
    console.error('[reconciliation] deleteMilestone error', error);
    return false;
  }
  return true;
}

// ============================================================
// Stats agregees - utiles pour la vue reconciliation E3.3
// ============================================================

export interface ReconciliationStats {
  totalAnalyses: number;
  withDecision: number;
  byDecision: Record<Decision, number>;
  withMilestones: number;
  totalMilestones: number;
  thesisAlignmentBreakdown: Record<string, number>;
}

export async function getReconciliationStats(userId: string): Promise<ReconciliationStats> {
  const admin = getAdmin();
  const empty: ReconciliationStats = {
    totalAnalyses: 0,
    withDecision: 0,
    byDecision: { invested: 0, passed: 0, declined: 0, waitlisted: 0 },
    withMilestones: 0,
    totalMilestones: 0,
    thesisAlignmentBreakdown: {},
  };
  if (!admin) return empty;

  // Count analyses (toutes du user)
  const { count: totalAnalyses } = await admin
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Count outcomes par decision
  const { data: outcomes } = await admin
    .from('realized_outcomes')
    .select('decision, analysis_id')
    .eq('user_id', userId);

  const byDecision: Record<Decision, number> = {
    invested: 0, passed: 0, declined: 0, waitlisted: 0,
  };
  (outcomes || []).forEach((o: any) => {
    if (o.decision in byDecision) byDecision[o.decision as Decision]++;
  });

  // Count milestones et leur thesis_alignment
  const { data: milestones } = await admin
    .from('outcome_milestones')
    .select('analysis_id, thesis_alignment')
    .eq('user_id', userId);

  const milestoneAnalysisIds = new Set((milestones || []).map((m: any) => m.analysis_id));
  const thesisAlignmentBreakdown: Record<string, number> = {};
  (milestones || []).forEach((m: any) => {
    if (m.thesis_alignment) {
      thesisAlignmentBreakdown[m.thesis_alignment] =
        (thesisAlignmentBreakdown[m.thesis_alignment] || 0) + 1;
    }
  });

  return {
    totalAnalyses: totalAnalyses || 0,
    withDecision: outcomes?.length || 0,
    byDecision,
    withMilestones: milestoneAnalysisIds.size,
    totalMilestones: milestones?.length || 0,
    thesisAlignmentBreakdown,
  };
}
