// ============================================================
// COLLABORATION STORE
// ------------------------------------------------------------
// Lectures et ecritures sur les tables collaboratives Prelude :
//   - analyses_workflow_status / analyses_workflow_history
//   - analyses_versions
//   - analyses_annotations
//
// Toutes les fonctions sont safe-by-default :
//   - Si la persistence n est pas activee, retournent un objet vide
//   - Si l auth est activee mais qu il n y a pas de session, retournent vide
//
// L acces a la base passe par service_role : on filtre par
// organization_id au niveau applicatif. Les Route Handlers qui
// consomment ce store doivent toujours verifier que l analyse
// demandee appartient bien a l org de l utilisateur courant.
// ============================================================

import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { isPersistenceEnabled } from '@/lib/analysis-store';

// ============================================================
// TYPES
// ============================================================

export type WorkflowStage =
  | 'deposited'
  | 'in_review'
  | 'dd_field'
  | 'ic_review'
  | 'signed'
  | 'declined';

export const WORKFLOW_STAGES: WorkflowStage[] = [
  'deposited',
  'in_review',
  'dd_field',
  'ic_review',
  'signed',
  'declined',
];

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
  deposited: 'Depose',
  in_review: 'En instruction',
  dd_field: 'DD terrain',
  ic_review: 'Pret pour IC',
  signed: 'Signe',
  declined: 'Refuse',
};

export interface WorkflowStatus {
  analysisId: string;
  stage: WorkflowStage;
  updatedAt: string;
  updatedBy: string | null;
}

export interface WorkflowHistoryEntry {
  id: string;
  analysisId: string;
  fromStage: string | null;
  toStage: string;
  changedAt: string;
  changedBy: string | null;
  comment: string | null;
}

export interface AnalysisVersionMeta {
  id: string;
  analysisId: string;
  versionNum: number;
  sourceFilename: string | null;
  pipelineDurationMs: number | null;
  createdAt: string;
  createdBy: string | null;
  note: string | null;
}

export interface AnalysisVersionFull extends AnalysisVersionMeta {
  snapshotJson: any;
}

export interface Annotation {
  id: string;
  analysisId: string;
  sectionId: string;
  paragraphAnchor: string | null;
  body: string;
  createdAt: string;
  createdBy: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

// ============================================================
// WORKFLOW STATUS
// ============================================================

export async function getWorkflowStatus(analysisId: string): Promise<WorkflowStatus | null> {
  if (!isPersistenceEnabled()) return null;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('analyses_workflow_status')
    .select('analysis_id, stage, updated_at, updated_by')
    .eq('analysis_id', analysisId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    analysisId: data.analysis_id,
    stage: data.stage as WorkflowStage,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

export async function setWorkflowStage(
  analysisId: string,
  toStage: WorkflowStage,
  changedBy: string | null,
  comment?: string,
): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  const admin = getSupabaseAdminClient();

  // Lire stage actuel pour le tracker dans l historique
  const current = await getWorkflowStatus(analysisId);
  const fromStage = current?.stage ?? null;

  // Upsert stage
  const { error: upsertErr } = await admin
    .from('analyses_workflow_status')
    .upsert({
      analysis_id: analysisId,
      stage: toStage,
      updated_by: changedBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'analysis_id' });

  if (upsertErr) {
    console.error('[collaboration-store] setWorkflowStage upsert error:', upsertErr);
    return false;
  }

  // Log la transition si elle change le stage
  if (fromStage !== toStage) {
    const { error: histErr } = await admin
      .from('analyses_workflow_history')
      .insert({
        analysis_id: analysisId,
        from_stage: fromStage,
        to_stage: toStage,
        changed_by: changedBy,
        comment: comment ?? null,
      });
    if (histErr) {
      console.warn('[collaboration-store] history insert failed:', histErr);
    }
  }
  return true;
}

export async function getWorkflowHistory(analysisId: string): Promise<WorkflowHistoryEntry[]> {
  if (!isPersistenceEnabled()) return [];
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('analyses_workflow_history')
    .select('id, analysis_id, from_stage, to_stage, changed_at, changed_by, comment')
    .eq('analysis_id', analysisId)
    .order('changed_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    analysisId: row.analysis_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    changedAt: row.changed_at,
    changedBy: row.changed_by,
    comment: row.comment,
  }));
}

// ============================================================
// VERSIONS
// ============================================================

export async function listVersions(analysisId: string): Promise<AnalysisVersionMeta[]> {
  if (!isPersistenceEnabled()) return [];
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('analyses_versions')
    .select('id, analysis_id, version_num, source_filename, pipeline_duration_ms, created_at, created_by, note')
    .eq('analysis_id', analysisId)
    .order('version_num', { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    analysisId: row.analysis_id,
    versionNum: row.version_num,
    sourceFilename: row.source_filename,
    pipelineDurationMs: row.pipeline_duration_ms,
    createdAt: row.created_at,
    createdBy: row.created_by,
    note: row.note,
  }));
}

export async function getVersion(
  analysisId: string,
  versionNum: number,
): Promise<AnalysisVersionFull | null> {
  if (!isPersistenceEnabled()) return null;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('analyses_versions')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('version_num', versionNum)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    analysisId: data.analysis_id,
    versionNum: data.version_num,
    sourceFilename: data.source_filename,
    pipelineDurationMs: data.pipeline_duration_ms,
    createdAt: data.created_at,
    createdBy: data.created_by,
    note: data.note,
    snapshotJson: data.snapshot_json,
  };
}

/**
 * Cree une nouvelle version pour une analyse. Determine automatiquement
 * le numero de version (max + 1). Appele apres chaque re-run du pipeline
 * sur un dossier deja existant.
 */
export async function createVersion(params: {
  analysisId: string;
  snapshotJson: any;
  sourceFilename?: string | null;
  pipelineDurationMs?: number | null;
  createdBy?: string | null;
  note?: string | null;
}): Promise<AnalysisVersionMeta | null> {
  if (!isPersistenceEnabled()) return null;
  const admin = getSupabaseAdminClient();

  // Determiner le prochain numero de version
  const { data: existing } = await admin
    .from('analyses_versions')
    .select('version_num')
    .eq('analysis_id', params.analysisId)
    .order('version_num', { ascending: false })
    .limit(1);

  const nextVersion = (existing && existing[0]?.version_num) ? existing[0].version_num + 1 : 1;

  const { data, error } = await admin
    .from('analyses_versions')
    .insert({
      analysis_id: params.analysisId,
      version_num: nextVersion,
      snapshot_json: params.snapshotJson,
      source_filename: params.sourceFilename ?? null,
      pipeline_duration_ms: params.pipelineDurationMs ?? null,
      created_by: params.createdBy ?? null,
      note: params.note ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[collaboration-store] createVersion error:', error);
    return null;
  }

  return {
    id: data.id,
    analysisId: data.analysis_id,
    versionNum: data.version_num,
    sourceFilename: data.source_filename,
    pipelineDurationMs: data.pipeline_duration_ms,
    createdAt: data.created_at,
    createdBy: data.created_by,
    note: data.note,
  };
}

// ============================================================
// ANNOTATIONS
// ============================================================

export async function listAnnotations(
  analysisId: string,
  options: { sectionId?: string; includeResolved?: boolean } = {},
): Promise<Annotation[]> {
  if (!isPersistenceEnabled()) return [];
  const admin = getSupabaseAdminClient();
  let query = admin
    .from('analyses_annotations')
    .select('*')
    .eq('analysis_id', analysisId);
  if (options.sectionId) {
    query = query.eq('section_id', options.sectionId);
  }
  if (!options.includeResolved) {
    query = query.is('resolved_at', null);
  }
  query = query.order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    analysisId: row.analysis_id,
    sectionId: row.section_id,
    paragraphAnchor: row.paragraph_anchor,
    body: row.body,
    createdAt: row.created_at,
    createdBy: row.created_by,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  }));
}

export async function createAnnotation(params: {
  analysisId: string;
  sectionId: string;
  body: string;
  createdBy: string;
  paragraphAnchor?: string | null;
}): Promise<Annotation | null> {
  if (!isPersistenceEnabled()) return null;
  if (!params.body?.trim()) return null;
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('analyses_annotations')
    .insert({
      analysis_id: params.analysisId,
      section_id: params.sectionId,
      body: params.body.trim(),
      created_by: params.createdBy,
      paragraph_anchor: params.paragraphAnchor ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[collaboration-store] createAnnotation error:', error);
    return null;
  }

  return {
    id: data.id,
    analysisId: data.analysis_id,
    sectionId: data.section_id,
    paragraphAnchor: data.paragraph_anchor,
    body: data.body,
    createdAt: data.created_at,
    createdBy: data.created_by,
    resolvedAt: data.resolved_at,
    resolvedBy: data.resolved_by,
  };
}

export async function resolveAnnotation(
  annotationId: string,
  resolvedBy: string,
): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('analyses_annotations')
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq('id', annotationId);
  if (error) {
    console.error('[collaboration-store] resolveAnnotation error:', error);
    return false;
  }
  return true;
}

export async function deleteAnnotation(annotationId: string): Promise<boolean> {
  if (!isPersistenceEnabled()) return false;
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from('analyses_annotations')
    .delete()
    .eq('id', annotationId);
  if (error) {
    console.error('[collaboration-store] deleteAnnotation error:', error);
    return false;
  }
  return true;
}
