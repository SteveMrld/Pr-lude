// ============================================================
// PIPELINE TOILE - MAPPING IDS SSE vs TOPOLOGIE
// ------------------------------------------------------------
// Resout l alignement entre :
//   - les engineId emis par /api/analyze (sendStart / sendDone),
//   - les id de noeuds de DEP_DRIVEN_TOPOLOGY consommes par le
//     layout de la toile.
//
// Constat etabli a la cartographie session 2 : aucun renommage,
// donc pas de table de substitution. Deux ecarts seulement, qui
// se documentent comme deux ensembles :
//
//   1. SSE_ONLY  : engineId emis par le flux mais qui n existent
//      pas dans la toile (etape knockout pre-pipeline, moteurs
//      Bloc 2 data room). Le flux continue de les emettre pour le
//      bandeau PipelineProgress, mais la toile les ignore.
//
//   2. TOILE_UNTRACED : noeuds presents dans la topologie mais
//      qui ne recoivent jamais d evenement engine-start /
//      engine-done parce qu ils sont deterministes et silencieux
//      cote serveur (cf commentaire app/api/analyze/route.ts:685).
//      Ils restent visuellement en idle pendant un run live, ce
//      qui est honnete : leur etat n est pas communique.
//
// Toute introduction d un nouveau moteur dans le pipeline doit
// passer par cette table pour decider explicitement s il rejoint
// la toile et/ou s il emet un evenement SSE. La cartographie est
// ainsi rendue auditable, pas implicite.
// ============================================================

import { DEP_DRIVEN_TOPOLOGY } from '../engines/pipeline-topology';

/**
 * Ids emis par sendStart / sendDone dans /api/analyze. Source de
 * verite : grep dans app/api/analyze/route.ts. A maintenir si un
 * nouveau sendStart est introduit. Le test de coherence verifie
 * qu un id present ici et present dans la topologie correspond
 * exactement, sans typo silencieuse.
 */
export const SSE_EMITTED_ENGINE_IDS = [
  'prescan',
  'extraction',
  'team',
  'market',
  'macro',
  'financial-extraction',
  'pattern',
  'blindspot',
  'contrarian',
  'financial-coherence',
  'tech-claim',
  'execution-friction',
  'narrative-drift',
  'fragility-structurelle',
  'causal',
  'reference-checks',
  'orchestrate',
] as const;

/**
 * Ids de noeuds presents dans DEP_DRIVEN_TOPOLOGY. Derive
 * dynamiquement pour eviter toute desynchronisation.
 */
export const TOILE_NODE_IDS: readonly string[] = DEP_DRIVEN_TOPOLOGY.map(
  (n) => n.id,
);

/**
 * Ids emis par le SSE mais hors de la toile. Ces ids resteront
 * dans engineStates cote HomeClient (PipelineProgress les
 * exploite), la toile les filtre simplement.
 */
export const SSE_ONLY_IDS: readonly string[] = SSE_EMITTED_ENGINE_IDS.filter(
  (id) => !TOILE_NODE_IDS.includes(id),
);

/**
 * Ids presents dans la toile mais jamais emis par le SSE.
 * Moteurs deterministes silencieux. Affiches en idle pendant
 * un run live, ce qui reflete fidelement l absence de signal.
 */
export const TOILE_UNTRACED_IDS: readonly string[] = TOILE_NODE_IDS.filter(
  (id) => !(SSE_EMITTED_ENGINE_IDS as readonly string[]).includes(id),
);

/**
 * Ids presents des deux cotes. Coeur de l affichage live de la
 * toile : ce sont les seuls noeuds dont l etat evolue au fil du
 * SSE.
 */
export const TOILE_TRACED_IDS: readonly string[] = TOILE_NODE_IDS.filter(
  (id) => (SSE_EMITTED_ENGINE_IDS as readonly string[]).includes(id),
);

/**
 * Verifie qu un engineId SSE correspond a un noeud de la toile.
 * Retourne l id meme si trace, null sinon. Sert d hygiene a
 * l adaptateur d etats : tout ce qui passe par ici a deja ete
 * filtre des ids hors topologie.
 */
export function toToileNodeId(sseEngineId: string): string | null {
  if (!TOILE_TRACED_IDS.includes(sseEngineId)) return null;
  return sseEngineId;
}
