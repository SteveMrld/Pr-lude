// ============================================================
// PIPELINE TOILE - MAPPING engineId vers cle result_json
// ------------------------------------------------------------
// La sortie de chaque moteur est deja figee dans le result_json
// produit par /api/analyze. Le drill-down de la toile lit cette
// matiere existante : aucun nouveau fetch, aucune modification
// serveur. Cette table fait le pont entre l engineId emis par le
// SSE (et utilise comme id de noeud dans la topologie) et la cle
// JSON sous laquelle l output est range dans le result final.
//
// Le naming serveur n a pas suivi une convention unique : team
// reste team, mais pattern devient patternMatching, fragility
// devient fragiliteStructurelle, orchestrate devient
// finalRecommendation, etc. Ce sont des choix historiques. On les
// documente ici plutot que de les disperser dans le rendu.
//
// Pour un run live, on n a pas besoin de cette table : l output
// arrive en payload de engine-done et on l indexe directement par
// engineId. La table sert uniquement pour les analyses archivees
// rechargees depuis result_json, ou pour deriver l output a partir
// du result final en fin de session.
// ============================================================

export const ENGINE_TO_RESULT_KEY: Record<string, string> = {
  // Pre-scan : pre-pipeline, hors toile mais utile au cas ou.
  prescan: 'preScan',
  // Couche extraction et donnees brutes
  extraction: 'extraction',
  'financial-extraction': 'financialData',
  // Couche analyses moteur Bloc 1
  team: 'team',
  market: 'market',
  macro: 'macro',
  'saas-metrics': 'saasMetrics',
  'industrial-metrics': 'industrialMetrics',
  benchmarks: 'benchmarks',
  pattern: 'patternMatching',
  blindspot: 'blindspotAnalysis',
  contrarian: 'contrarianAnalysis',
  'financial-coherence': 'financialCoherence',
  'tech-claim': 'techClaimCoherence',
  'execution-friction': 'executionFriction',
  'narrative-drift': 'narrativeDrift',
  'fragility-structurelle': 'fragiliteStructurelle',
  causal: 'causalReversal',
  'reference-checks': 'referenceChecks',
  orchestrate: 'finalRecommendation',
};

/**
 * Resout l output d un moteur a partir du result_json complet.
 * Tolerant : retourne null si le result est absent ou si la cle
 * n est pas mappee. Le drill-down affiche un etat vide sobre dans
 * ce cas, pas un plantage.
 */
export function pickEngineOutputFromResult(
  result: unknown,
  engineId: string,
): unknown {
  if (!result || typeof result !== 'object') return null;
  const key = ENGINE_TO_RESULT_KEY[engineId];
  if (!key) return null;
  const value = (result as Record<string, unknown>)[key];
  return value === undefined ? null : value;
}

/**
 * Reconstitue un dictionnaire engineOutputs a partir d un
 * result_json complet. Sert au mode archive : analyse rechargee
 * depuis l historique, on derive les outputs par moteur d un
 * coup. Les cles inconnues du result sont ignorees, les valeurs
 * absentes sont omises plutot que mises a null pour distinguer
 * "moteur jamais ressorti" de "moteur ressorti null".
 */
export function buildEngineOutputsFromResult(
  result: unknown,
): Record<string, unknown> {
  if (!result || typeof result !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [engineId, key] of Object.entries(ENGINE_TO_RESULT_KEY)) {
    const value = (result as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) {
      out[engineId] = value;
    }
  }
  return out;
}
