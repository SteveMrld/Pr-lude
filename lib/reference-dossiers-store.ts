import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Brique 3 ingestion corpus Jabrilia.
 * --------------------------------------------------
 * Stocke la couche humaine associee a chaque dossier corpus : verdict
 * partner ex-post, raisonnement, motifs taxonomies, deviations
 * observees apres investissement. Lie a la ligne analyses produite
 * par le re-run frozen (un dossier corpus = une analyse + une ligne
 * reference_dossiers).
 *
 * L outcome de marche (alive/exit/fail/flat plus multiple/IRR) n est
 * PAS dans cette table : il vit dans analysis_outcomes et se lit par
 * jointure sur analysis_id. Cette separation tient parce que l outcome
 * peut etre enrichi automatiquement plus tard (pilier cycle de vie)
 * alors que la couche humaine est, par construction, manuelle.
 *
 * Idempotence : UNIQUE(analysis_id) et UNIQUE(source_pdf_filename) en
 * base. Le store expose une recherche par filename ou company_name
 * pour permettre au script d ingestion de skip sans deviner.
 */

// Vocabulaire controle extrait dans un sous-module sans server-only
// pour pouvoir le tester et le partager avec les scripts CLI.
import {
  DECISION_MOTIFS,
  INGESTION_STATUS_VALUES,
  isValidDecisionMotif,
  validateDecisionMotifs,
  type DecisionMotif,
  type IngestionStatus,
} from './reference-dossiers-vocabulary';

export {
  DECISION_MOTIFS,
  INGESTION_STATUS_VALUES,
  isValidDecisionMotif,
  validateDecisionMotifs,
};
export type { DecisionMotif, IngestionStatus };

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// Types
// ============================================================

export interface ReferenceDossier {
  id: string;
  analysisId: string;
  sourcePdfFilename: string;
  companyName: string;
  deckReceivedAt: string; // ISO date
  partnerVerdict: string | null;
  partnerReasoning: string | null;
  decisionMotifs: DecisionMotif[];
  postInvestmentDeviations: string | null;
  ingestionStatus: IngestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReferenceDossierInput {
  analysisId: string;
  sourcePdfFilename: string;
  companyName: string;
  deckReceivedAt: string;
  ingestionStatus?: IngestionStatus;
}

export interface UpdateHumanLayerInput {
  partnerVerdict?: string | null;
  partnerReasoning?: string | null;
  decisionMotifs?: DecisionMotif[] | null;
  postInvestmentDeviations?: string | null;
  /** Bascule explicite. Le caller le pose typiquement a 'complete' apres
   *  saisie du verdict. Si absent, le statut existant est conserve. */
  ingestionStatus?: IngestionStatus;
}

// ============================================================
// Mapping ligne brute -> objet TS
// ============================================================

function mapDossier(row: any): ReferenceDossier {
  const rawMotifs: string[] = Array.isArray(row.decision_motifs) ? row.decision_motifs : [];
  // Filtrage defensif : si la base contient un motif aujourd hui
  // retire du vocabulaire, on garde l historique tel quel (les
  // dossiers passes restent interpretables) mais on signale.
  const accepted: DecisionMotif[] = [];
  for (const v of rawMotifs) {
    if (isValidDecisionMotif(v)) {
      if (!accepted.includes(v)) accepted.push(v);
    } else {
      console.warn(`[reference-dossiers] motif inconnu ignore en lecture : ${v} (dossier ${row.id})`);
    }
  }
  return {
    id: row.id,
    analysisId: row.analysis_id,
    sourcePdfFilename: row.source_pdf_filename,
    companyName: row.company_name,
    deckReceivedAt: row.deck_received_at,
    partnerVerdict: row.partner_verdict,
    partnerReasoning: row.partner_reasoning,
    decisionMotifs: accepted,
    postInvestmentDeviations: row.post_investment_deviations,
    ingestionStatus: row.ingestion_status as IngestionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// CRUD
// ============================================================

/**
 * Cree un reference_dossier. Echoue si UNIQUE(analysis_id) ou
 * UNIQUE(source_pdf_filename) est viole (renvoie null avec un log).
 * Utiliser findBySourceFilename ou findByCompany pour l idempotence
 * avant insertion.
 */
export async function createReferenceDossier(
  input: CreateReferenceDossierInput,
): Promise<ReferenceDossier | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const payload = {
    analysis_id: input.analysisId,
    source_pdf_filename: input.sourcePdfFilename,
    company_name: input.companyName,
    deck_received_at: input.deckReceivedAt,
    ingestion_status: input.ingestionStatus || 'human_layer_pending',
  };
  const { data, error } = await admin
    .from('reference_dossiers')
    .insert(payload)
    .select('*')
    .single();
  if (error) {
    console.error('[reference-dossiers] insert error', error);
    return null;
  }
  return mapDossier(data);
}

export async function findReferenceDossierBySourceFilename(
  sourcePdfFilename: string,
): Promise<ReferenceDossier | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from('reference_dossiers')
    .select('*')
    .eq('source_pdf_filename', sourcePdfFilename)
    .maybeSingle();
  if (error) {
    console.error('[reference-dossiers] findBySourceFilename error', error);
    return null;
  }
  return data ? mapDossier(data) : null;
}

export async function findReferenceDossierByCompany(
  companyName: string,
): Promise<ReferenceDossier | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from('reference_dossiers')
    .select('*')
    .eq('company_name', companyName)
    .maybeSingle();
  if (error) {
    console.error('[reference-dossiers] findByCompany error', error);
    return null;
  }
  return data ? mapDossier(data) : null;
}

export async function findReferenceDossierByAnalysisId(
  analysisId: string,
): Promise<ReferenceDossier | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from('reference_dossiers')
    .select('*')
    .eq('analysis_id', analysisId)
    .maybeSingle();
  if (error) {
    console.error('[reference-dossiers] findByAnalysisId error', error);
    return null;
  }
  return data ? mapDossier(data) : null;
}

export async function listReferenceDossiers(opts: {
  status?: IngestionStatus;
  limit?: number;
} = {}): Promise<ReferenceDossier[]> {
  const admin = getAdmin();
  if (!admin) return [];
  let query = admin.from('reference_dossiers').select('*');
  if (opts.status) query = query.eq('ingestion_status', opts.status);
  query = query.order('deck_received_at', { ascending: false }).limit(opts.limit ?? 500);
  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error('[reference-dossiers] list error', error);
    return [];
  }
  return data.map(mapDossier);
}

/**
 * Idempotence d ingestion : retourne le dossier existant si filename
 * OU company_name correspond a une ligne presente. Sinon null. Le
 * script d ingestion utilise cette fonction comme garde avant insert.
 */
export async function findReferenceDossierForIngestion(opts: {
  sourcePdfFilename: string;
  companyName: string;
}): Promise<ReferenceDossier | null> {
  const byFile = await findReferenceDossierBySourceFilename(opts.sourcePdfFilename);
  if (byFile) return byFile;
  return findReferenceDossierByCompany(opts.companyName);
}

/**
 * Patch la couche humaine. Tous les champs sont optionnels, seuls
 * les champs presents sont ecrits. Si decisionMotifs est fourni,
 * sa validation est responsable du caller (utiliser
 * validateDecisionMotifs en amont). Si null, le champ est nullifie.
 */
export async function updateHumanLayer(
  analysisId: string,
  input: UpdateHumanLayerInput,
): Promise<ReferenceDossier | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (input.partnerVerdict !== undefined) patch.partner_verdict = input.partnerVerdict;
  if (input.partnerReasoning !== undefined) patch.partner_reasoning = input.partnerReasoning;
  if (input.decisionMotifs !== undefined) patch.decision_motifs = input.decisionMotifs;
  if (input.postInvestmentDeviations !== undefined) patch.post_investment_deviations = input.postInvestmentDeviations;
  if (input.ingestionStatus !== undefined) patch.ingestion_status = input.ingestionStatus;
  const { data, error } = await admin
    .from('reference_dossiers')
    .update(patch)
    .eq('analysis_id', analysisId)
    .select('*')
    .single();
  if (error) {
    console.error('[reference-dossiers] updateHumanLayer error', error);
    return null;
  }
  return mapDossier(data);
}

/**
 * Suppression. Reservee aux scripts d annulation manuelle ou de
 * cleanup de tests. L UI n appelle jamais ce chemin.
 */
export async function deleteReferenceDossier(
  analysisId: string,
): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;
  const { error } = await admin
    .from('reference_dossiers')
    .delete()
    .eq('analysis_id', analysisId);
  if (error) {
    console.error('[reference-dossiers] delete error', error);
    return false;
  }
  return true;
}
