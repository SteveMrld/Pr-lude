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

export type OutcomeSource = 'manual' | 'kanban_auto';

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
  source: OutcomeSource;
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

export type MilestoneSourceKind = 'manual' | 'auto_detected';

export type MilestoneDetectionStatus = 'confirmed' | 'proposed' | 'rejected';

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
  sourceKind: MilestoneSourceKind;
  detectionStatus: MilestoneDetectionStatus;
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
  /** 'manual' par defaut. 'kanban_auto' quand la decision est deduite
   *  d une transition Kanban (signed/declined) plutot que saisie. */
  source?: OutcomeSource;
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
  /** 'manual' par defaut (saisie partner). 'auto_detected' quand
   *  le cron de detection web propose le milestone. */
  sourceKind?: MilestoneSourceKind;
  /** 'confirmed' par defaut (entre dans l agregation). 'proposed'
   *  quand le cron propose le milestone (n entre pas dans l agregation
   *  tant que le partner ne l a pas confirme). */
  detectionStatus?: MilestoneDetectionStatus;
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
    source: (row.source as OutcomeSource) || 'manual',
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
    sourceKind: (row.source_kind as MilestoneSourceKind) || 'manual',
    detectionStatus: (row.detection_status as MilestoneDetectionStatus) || 'confirmed',
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
    source: input.source ?? 'manual',
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
    source_kind: input.sourceKind ?? 'manual',
    detection_status: input.detectionStatus ?? 'confirmed',
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

/**
 * Met a jour le detection_status d un milestone propose : 'confirmed'
 * pour valider, 'rejected' pour ignorer. Permet au partner de trier
 * les milestones proposes par le cron de detection web. Aucun effet
 * sur les milestones manuels (deja en 'confirmed').
 */
export async function updateMilestoneDetectionStatus(
  milestoneId: string,
  userId: string,
  status: MilestoneDetectionStatus,
): Promise<Milestone | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from('outcome_milestones')
    .update({ detection_status: status })
    .eq('id', milestoneId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) {
    console.error('[reconciliation] updateMilestoneDetectionStatus error', error);
    return null;
  }
  return mapMilestone(data);
}

/**
 * Met a jour selectivement les champs editables d un milestone
 * (typiquement utilise apres confirmation d un milestone propose
 * que le partner veut ajuster avant validation). Aucun champ
 * n est obligatoire : seuls les champs fournis sont ecrits.
 */
export async function patchMilestone(
  milestoneId: string,
  userId: string,
  patch: Partial<Pick<MilestoneInput,
    'milestoneDate' | 'milestoneType' | 'title' | 'description'
    | 'impact' | 'numericalValue' | 'numericalUnit'
    | 'thesisAlignment' | 'sourceUrl' | 'sourceType' | 'detectionStatus'
  >>,
): Promise<Milestone | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const dbPatch: any = {};
  if (patch.milestoneDate !== undefined) dbPatch.milestone_date = patch.milestoneDate;
  if (patch.milestoneType !== undefined) dbPatch.milestone_type = patch.milestoneType;
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.impact !== undefined) dbPatch.impact = patch.impact;
  if (patch.numericalValue !== undefined) dbPatch.numerical_value = patch.numericalValue;
  if (patch.numericalUnit !== undefined) dbPatch.numerical_unit = patch.numericalUnit;
  if (patch.thesisAlignment !== undefined) dbPatch.thesis_alignment = patch.thesisAlignment;
  if (patch.sourceUrl !== undefined) dbPatch.source_url = patch.sourceUrl;
  if (patch.sourceType !== undefined) dbPatch.source_type = patch.sourceType;
  if (patch.detectionStatus !== undefined) dbPatch.detection_status = patch.detectionStatus;
  if (Object.keys(dbPatch).length === 0) return null;

  const { data, error } = await admin
    .from('outcome_milestones')
    .update(dbPatch)
    .eq('id', milestoneId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) {
    console.error('[reconciliation] patchMilestone error', error);
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

// ============================================================
// CRON detection auto - listing cross-user en service-role
// ============================================================

/**
 * Snapshot leger d un outcome plus contexte analyse, pour le cron
 * de detection web. Le cron itere sur tout le bassin d outcomes
 * (cross-user) pour identifier les dossiers a scanner. L isolation
 * se fait au moment de l ecriture des milestones via user_id.
 */
export interface OutcomeForDetection {
  analysisId: string;
  userId: string;
  companyName: string;
  decision: Decision;
  decisionDate: string;
  analyzedAt: string;
  /** ISO de la derniere detection auto qui a tourne sur ce dossier,
   *  ou null si aucune n a jamais tourne. */
  lastAutoDetectionAt: string | null;
  /** Nombre de milestones proposed deja en attente pour ce dossier.
   *  Permet au cron de skipper les dossiers qui ont deja une file
   *  non triee pour eviter d empiler. */
  pendingProposedCount: number;
}

/**
 * Liste tous les outcomes du systeme, joints au companyName et
 * decisionDate, plus le timestamp de la derniere detection auto.
 * Utilise par le cron de detection en service-role.
 *
 * @param decisions Liste optionnelle de decisions a inclure. Defaut :
 *                  invested, passed (ce sont les dossiers ou la
 *                  realite post-decision est utile a verifier).
 */
export async function listOutcomesForDetection(
  decisions: Decision[] = ['invested', 'passed'],
): Promise<OutcomeForDetection[]> {
  const admin = getAdmin();
  if (!admin) return [];

  // Outcomes filtrer par decision. On charge dans le meme select le
  // company_name et created_at de l analyse via la jointure
  // implicite Supabase (foreign-key relations).
  const { data: outcomes, error } = await admin
    .from('realized_outcomes')
    .select('analysis_id, user_id, decision, decision_date, analyses(company_name, created_at)')
    .in('decision', decisions);

  if (error || !outcomes) {
    console.error('[reconciliation] listOutcomesForDetection error', error);
    return [];
  }

  const analysisIds = outcomes.map((o: any) => o.analysis_id);
  if (analysisIds.length === 0) return [];

  // Pour chaque analyse, on cherche le timestamp max d un milestone
  // auto_detected et le compte de milestones proposed. Une seule query
  // pour eviter N+1.
  const { data: autoMilestones } = await admin
    .from('outcome_milestones')
    .select('analysis_id, created_at, detection_status')
    .eq('source_kind', 'auto_detected')
    .in('analysis_id', analysisIds);

  const lastByAnalysis = new Map<string, string>();
  const pendingByAnalysis = new Map<string, number>();
  for (const m of autoMilestones || []) {
    const cur = lastByAnalysis.get((m as any).analysis_id);
    if (!cur || (m as any).created_at > cur) {
      lastByAnalysis.set((m as any).analysis_id, (m as any).created_at);
    }
    if ((m as any).detection_status === 'proposed') {
      pendingByAnalysis.set(
        (m as any).analysis_id,
        (pendingByAnalysis.get((m as any).analysis_id) || 0) + 1,
      );
    }
  }

  return outcomes.map((o: any) => {
    const analysisJoined = Array.isArray(o.analyses) ? o.analyses[0] : o.analyses;
    return {
      analysisId: o.analysis_id,
      userId: o.user_id,
      companyName: analysisJoined?.company_name || 'Sans nom',
      decision: o.decision as Decision,
      decisionDate: o.decision_date,
      analyzedAt: analysisJoined?.created_at || o.decision_date,
      lastAutoDetectionAt: lastByAnalysis.get(o.analysis_id) || null,
      pendingProposedCount: pendingByAnalysis.get(o.analysis_id) || 0,
    };
  });
}

/**
 * Liste les milestones existants d un dossier, en mode admin
 * (cross-user, utilise par le cron pour deduplication avant
 * d inserer un nouveau milestone propose).
 *
 * Retourne les milestones confirmed et proposed (pas les rejected,
 * qui sont des signaux que le partner ne veut pas re-voir).
 */
export async function listMilestonesForDedup(
  analysisId: string,
): Promise<Pick<Milestone, 'id' | 'milestoneDate' | 'title' | 'sourceUrl' | 'detectionStatus'>[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from('outcome_milestones')
    .select('id, milestone_date, title, source_url, detection_status')
    .eq('analysis_id', analysisId)
    .neq('detection_status', 'rejected');
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    milestoneDate: row.milestone_date,
    title: row.title,
    sourceUrl: row.source_url,
    detectionStatus: row.detection_status as MilestoneDetectionStatus,
  }));
}
