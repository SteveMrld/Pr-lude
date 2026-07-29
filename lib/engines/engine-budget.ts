// ============================================================
// BUDGET D APPEL PAR MOTEUR
// ------------------------------------------------------------
// Six moteurs heritaient du client partage (anthropic-client.ts:85-86,
// timeout 60s / maxRetries 1) sans jamais l avoir choisi. Aucun des six
// n a abouti une seule fois sur les sept runs instrumentes du corpus :
// pattern, blindspot et contrarian sortent en "Request timed out." avec
// un executionDurationMs de 120,4s, soit exactement deux tentatives de
// 60s ; causal et reference-checks n ont jamais atteint leur appel LLM,
// ils cascadent ; narrative-drift meurt a 120s a chaque run et avale
// son exception, ce qui le fait classer empty_output plutot que failed.
//
// La fenetre de 60s est sous le plancher observe, pas a la marge. Le
// seul ancrage mesure du depot le dit : les sept patterns de Fragilite
// appellent Sonnet a 4000 maxTokens avec une fenetre de 180s en une
// tentative (fragility-structurelle/pattern-interface.ts:66-68) et
// prennent 63,7 a 93,9s, mediane 81s, sous sept appels concurrents.
// Un appel Sonnet a 4000 tokens coute 65 a 95s ici. Les six moteurs
// ci-dessous demandent de 4000 a 14000 tokens.
//
// DIMENSIONNEMENT
//
// Extrapolation lineaire sur cet ancrage, conservatrice puisque la
// sortie reelle est toujours inferieure au plafond demande :
//   4000 tokens  -> 65-95s   (mesure)
//   8000 tokens  -> 130-190s (estimation)
//   14000 tokens -> 225-330s (estimation, plafond defensif : le prompt
//                   blindspot impose lui-meme une contrainte de
//                   concision, blindspot-engine.ts:261-272, donc la
//                   sortie reelle est vraisemblablement bien en deca)
//
// Haiku 4.5 pour reference-checks : aucune mesure dans le depot, 25-45s
// estimes sur son ecart de debit usuel avec Sonnet. Fenetre a 70s.
//
// ZERO REPRISE
//
// maxRetries 0 sur les six, pour la meme raison que fragilite en
// 77f6c53 : la reprise du client coute une seconde fenetre pleine et
// n a sauve aucun de ces moteurs, jamais, sur aucun des sept runs. A
// fenetre egale elle double le cout de l echec sans rien acheter. Le
// budget de la chaine ne devient finançable qu a cette condition.
//
// CHEMIN CRITIQUE
//
// pattern, blindspot et contrarian sont trois IIFE independantes qui
// attendent la meme porte [team, market, macro] (route.ts:983-1016).
// Mesure a l appui : 3 ms d ecart entre leurs waitDurationMs sur le run
// c487a8b2. Elles sont strictement paralleles, leurs fenetres ne
// s additionnent pas. La seule chaine serielle est
//   porte -> pattern -> causal -> reference-checks
// puisque causal attend pattern (route.ts:1149-1151) et que
// reference-checks attend causal (route.ts:1174-1176), dont la fin est
// posterieure a celle de blindspot.
//
// Consequence de dimensionnement : blindspot, le plus gros generateur
// des six, est le seul dont la fenetre ne coute rien sur le chemin
// critique tant qu elle reste sous pattern + causal. Il ne faut pas la
// rogner, il faut la lui donner.
// ============================================================

/** Options callClaude appliquees a un moteur. Meme forme que
 *  PATTERN_LLM_OPTIONS de fragilite, dont ce module generalise le
 *  principe aux six moteurs restes sur le defaut client. */
export interface EngineLlmOptions {
  timeout: number;
  maxRetries: number;
}

/**
 * Cles moteur du releve d instrumentation (EngineStatusRecorder). Ce
 * sont celles du result_json, pas les libelles courts du wrapper
 * deadline. Les memes cles servent a indexer les deadlines externes
 * dans route.ts, pour qu une fenetre et sa deadline ne puissent pas
 * diverger silencieusement.
 */
export type BudgetedEngineKey =
  | 'patternMatching'
  | 'blindspotAnalysis'
  | 'contrarianAnalysis'
  | 'causalReversal'
  | 'referenceChecks'
  | 'narrativeDrift';

/**
 * Fenetre d appel LLM par moteur, en une tentative. Source unique :
 * les sites d appel des moteurs la lisent ici, route.ts en derive les
 * deadlines externes, et les tests assertent sur cette table plutot que
 * sur des litteraux disperses.
 */
export const ENGINE_LLM_BUDGET: Record<BudgetedEngineKey, EngineLlmOptions> = Object.freeze({
  // 8000 tokens, Sonnet. Prompt systeme le plus lourd des six
  // (35 565 caracteres) mais sortie plafonnee a 8000.
  patternMatching: Object.freeze({ timeout: 180_000, maxRetries: 0 }),
  // 14000 tokens, Sonnet. Branche parallele, sa fenetre ne pese pas sur
  // le chemin critique tant qu elle reste sous pattern + causal (360s).
  blindspotAnalysis: Object.freeze({ timeout: 240_000, maxRetries: 0 }),
  // 8000 tokens, Sonnet. Branche parallele.
  contrarianAnalysis: Object.freeze({ timeout: 180_000, maxRetries: 0 }),
  // 8000 tokens, Sonnet. Sur le chemin critique, apres pattern.
  causalReversal: Object.freeze({ timeout: 180_000, maxRetries: 0 }),
  // 4000 tokens, Haiku 4.5. Dernier maillon du chemin critique, et le
  // moins critique fonctionnellement : c est lui qu on sacrifie en
  // premier si la chaine deborde.
  referenceChecks: Object.freeze({ timeout: 70_000, maxRetries: 0 }),
  // 4000 tokens, Sonnet. Sans dependance, demarre a t=0 en parallele de
  // la couche 1 (route.ts:1075-1077) : sa fenetre ne coute rien.
  narrativeDrift: Object.freeze({ timeout: 120_000, maxRetries: 0 }),
}) as Record<BudgetedEngineKey, EngineLlmOptions>;

/**
 * Slack entre la fenetre LLM d un moteur et sa deadline externe. Couvre
 * le pre et post-processing en JS : construction du prompt, parseJSON,
 * jsonrepair, sanitize, audit de tagging. Valeur reprise du precedent
 * fragilite, qui aligne une fenetre de 180s sur une deadline de 200s.
 *
 * La deadline externe n est PAS la garde nominale. En regime normal
 * c est le timeout du SDK qui tranche, la deadline ne rattrape qu un
 * blocage cote JS apres le retour du modele, cas jamais observe sur le
 * corpus. Elle reste le seul plafond garanti par le code, donc le seul
 * chiffre opposable dans un calcul de pire cas.
 */
export const ENGINE_DEADLINE_SLACK_MS = 20_000;

/** Deadline externe d un moteur budgete : sa fenetre plus le slack. */
export function engineDeadlineFor(key: BudgetedEngineKey): number {
  return ENGINE_LLM_BUDGET[key].timeout + ENGINE_DEADLINE_SLACK_MS;
}

// ============================================================
// PIRE CAS DE CONVERGENCE
// ------------------------------------------------------------
// Expose le calcul plutot que de le laisser en commentaire, pour qu un
// test le refasse a chaque commit et casse si une fenetre bouge sans
// que le budget global suive. Un budget qui n est verifie qu a la main
// derive au premier ajustement.
// ============================================================

/**
 * Duree d ouverture de la porte [team, market, macro], en pire cas.
 * Ces trois moteurs portent une fenetre de 150s (team-engine.ts:591,
 * market-engine.ts:527, macro-engine.ts:461) et gardent la deadline
 * externe par defaut. Mesures du corpus : 138, 144, 146s quand ils
 * aboutissent, un echec observe a 152s. Non budgetes ici, hors
 * perimetre, mais c est le plus gros terme de la chaine.
 */
export const GATE_WORST_CASE_MS = 200_000;

/**
 * Reserve laissee a la synthese finale apres convergence : une
 * tentative estimee plus la marge de sortie propre
 * (route.ts:1377-1378). Orchestrate est lui-meme course contre le
 * budget global (route.ts:1529-1531), il ne peut donc pas deborder le
 * mur a lui seul, mais sans cette reserve il n aurait aucune chance
 * d aboutir.
 */
export const ORCHESTRATE_RESERVE_MS = 90_000;

/**
 * Pire cas de convergence, deadlines externes toutes declenchees.
 * C est le plafond garanti par le code, pas le regime attendu.
 *
 * Chaine : porte -> pattern -> causal -> reference-checks. blindspot et
 * contrarian sont paralleles a pattern et n entrent pas dans la somme.
 */
export function worstCaseConvergenceMs(): number {
  return GATE_WORST_CASE_MS
    + engineDeadlineFor('patternMatching')
    + engineDeadlineFor('causalReversal')
    + engineDeadlineFor('referenceChecks');
}

/**
 * Pire cas de convergence borne par les seules fenetres LLM, sans les
 * slacks de deadline. Regime attendu quand un moteur echoue : c est le
 * SDK qui tranche a la fenetre, la deadline externe ne sert pas.
 */
export function worstCaseConvergenceByWindowMs(): number {
  return 152_000
    + ENGINE_LLM_BUDGET.patternMatching.timeout
    + ENGINE_LLM_BUDGET.causalReversal.timeout
    + ENGINE_LLM_BUDGET.referenceChecks.timeout;
}

// ============================================================
// MESURE D APPEL
// ------------------------------------------------------------
// Les fenetres ci-dessus sont extrapolees a partir d un seul point
// mesure, les 4000 tokens de fragilite. Le volume de sortie reel des
// six moteurs est inconnu : aucun n a jamais abouti, et callClaude ne
// remonte pas l usage. On dimensionne donc a l estime des moteurs dont
// on ignore ce qu ils produisent, ce qui est tenable une fois et pas
// deux.
//
// Le collecteur ci-dessous ferme cette boucle. Chaque moteur budgete
// recoit un puits optionnel que la route lui passe, y depose la duree
// de son appel et les tokens rendus, et la route reverse le tout dans
// le releve per-moteur du run. Au premier run reel, les fenetres se
// recalculent sur mesure au lieu de s extrapoler.
//
// Le puits est passe en parametre plutot que loge dans un module a
// etat : deux analyses concurrentes dans la meme instance ecriraient
// dans le meme registre global et melangeraient leurs mesures.
//
// Modele repris de analyzeMs sur les patterns de fragilite
// (fragility-structurelle/orchestrator.ts:195-200), etendu aux tokens.
// ============================================================

export interface LlmMeasure {
  /** Somme des durees d appel LLM du moteur, en ms. Mesuree autour du
   *  seul appel reseau, hors construction de prompt et parseJSON. */
  llmDurationMs: number;
  /** Somme des tokens rendus par le modele sur ce moteur. */
  outputTokens: number;
  /** Somme des tokens d entree factures, cache exclu. */
  inputTokens: number;
  /** Nombre d appels LLM effectifs. Vaut plus de 1 quand un moteur
   *  reprend, comme reference-checks sur une malformation de parse. */
  calls: number;
  /** Plafond max_tokens demande au dernier appel. Sert a lire un
   *  outputTokens au plafond comme une troncature plutot que comme un
   *  besoin reel de fenetre. */
  maxTokens?: number;
}

/** Puits de mesure vierge. */
export function newMeasure(): LlmMeasure {
  return { llmDurationMs: 0, outputTokens: 0, inputTokens: 0, calls: 0 };
}

/**
 * Accumule un appel dans le puits. Tolerant au puits absent : les
 * moteurs restent appelables sans instrumentation, notamment depuis
 * leurs tests deterministes et depuis les scripts de calibration.
 */
export function addCall(
  sink: LlmMeasure | undefined | null,
  startedAt: number,
  usage: { input_tokens?: number; output_tokens?: number } | undefined | null,
  maxTokens?: number,
): void {
  if (!sink) return;
  sink.llmDurationMs += Math.max(0, Date.now() - startedAt);
  sink.outputTokens += usage?.output_tokens ?? 0;
  sink.inputTokens += usage?.input_tokens ?? 0;
  sink.calls += 1;
  if (maxTokens !== undefined) sink.maxTokens = maxTokens;
}

/**
 * True si le dernier appel a vraisemblablement ete coupe par son
 * plafond de tokens. Seuil a 98 % du plafond : le modele s arrete
 * rarement pile a la limite pour des raisons naturelles. Signal
 * definitif de troncature, la ou l heuristique textuelle de
 * reference-checks n est qu une approximation.
 */
export function hitTokenCeiling(measure: LlmMeasure | undefined | null): boolean {
  if (!measure || !measure.maxTokens || measure.calls === 0) return false;
  return measure.outputTokens >= Math.floor(measure.maxTokens * 0.98);
}

/** Instant le plus tardif ou la porte de reference-checks peut s ouvrir,
 *  en pire cas de deadlines. Doit rester sous WAIT_DEADLINE_MS, sinon le
 *  moteur meurt sur sa garde d attente sans jamais appeler son LLM. */
export function referenceChecksGateWorstCaseMs(): number {
  return GATE_WORST_CASE_MS
    + engineDeadlineFor('patternMatching')
    + engineDeadlineFor('causalReversal');
}
