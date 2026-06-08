// ============================================================
// Vocabulaire controle du store reference-dossiers
// ------------------------------------------------------------
// Extrait du store dans un module sans 'server-only' pour permettre
// son import depuis les tests deterministes et les scripts CLI. Le
// store complet (CRUD Supabase) reste server-only.
//
// Les motifs et statuts vivent ici comme source de verite unique :
// le store, le script set-corpus-verdict et les tests partagent
// strictement la meme liste. Toute evolution se fait ici en premier,
// les autres modules suivent.
// ============================================================

export type DecisionMotif =
  | 'equipe'
  | 'timing_marche'
  | 'unit_economics'
  | 'defensibilite'
  | 'signal_contrarien'
  | 'conviction_partner';

export const DECISION_MOTIFS: DecisionMotif[] = [
  'equipe',
  'timing_marche',
  'unit_economics',
  'defensibilite',
  'signal_contrarien',
  'conviction_partner',
];

export function isValidDecisionMotif(value: string): value is DecisionMotif {
  return (DECISION_MOTIFS as string[]).includes(value);
}

/**
 * Valide une liste de motifs, retourne la liste filtree (trim,
 * dedup, accept-list) et la liste des motifs rejetes. Le caller
 * decide quoi faire des rejets (echec d ecriture, warning, ignore).
 */
export function validateDecisionMotifs(
  raw: string[],
): { accepted: DecisionMotif[]; rejected: string[] } {
  const accepted: DecisionMotif[] = [];
  const rejected: string[] = [];
  for (const v of raw) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (isValidDecisionMotif(trimmed)) {
      if (!accepted.includes(trimmed)) accepted.push(trimmed);
    } else {
      rejected.push(trimmed);
    }
  }
  return { accepted, rejected };
}

export type IngestionStatus =
  | 'pending_run'
  | 'run_complete'
  | 'human_layer_pending'
  | 'complete';

export const INGESTION_STATUS_VALUES: IngestionStatus[] = [
  'pending_run',
  'run_complete',
  'human_layer_pending',
  'complete',
];
