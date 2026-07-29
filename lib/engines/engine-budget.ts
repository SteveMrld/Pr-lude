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
  | 'team'
  | 'patternMatching'
  | 'blindspotAnalysis'
  | 'contrarianAnalysis'
  | 'causalReversal'
  | 'referenceChecks'
  | 'narrativeDrift'
  | 'finalRecommendation';

/**
 * Fenetre d appel LLM par moteur, en une tentative. Source unique :
 * les sites d appel des moteurs la lisent ici, route.ts en derive les
 * deadlines externes, et les tests assertent sur cette table plutot que
 * sur des litteraux disperses.
 */
export const ENGINE_LLM_BUDGET: Record<BudgetedEngineKey, EngineLlmOptions> = Object.freeze({
  // 8000 tokens, Sonnet, plus une recherche web dont le commentaire de
  // team-engine.ts:581-583 rappelle qu elle consomme le meme budget que
  // la generation dans le meme roundtrip HTTP. C est LA porte : les cinq
  // moteurs aval attendent team, market et macro, et teamPromise
  // (route.ts:871-874) ne porte aucun catch, donc son rejet condamne la
  // chaine entiere. Le run 0142901d l a montre : cinq failed-upstream
  // avec exec 0,0s derriere un team tombe a 151,6s.
  //
  // 150s -> 180s. Sur les six runs post-override, quatre succes a 113,
  // 138, 144 et 146s et deux echecs a 152s : la distribution etait
  // centree sur son propre plafond. 180s couvre le pire succes observe
  // avec 34s de marge. Ce que ces 180s ne disent pas : la duree reelle
  // des deux echecs est inconnue, ils ont ete coupes exactement au
  // plafond. C est un pari calibre, pas une deduction, et c est
  // precisement ce que l instrumentation du commit suivant leve.
  team: Object.freeze({ timeout: 180_000, maxRetries: 0 }),
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
  // 5000 tokens, Sonnet. La synthese finale etait restee sur le defaut
  // client 60s / 1 reprise (orchestrator.ts:920, appel sans options) et
  // sortait a 121s sur le run 0142901d, laissant Facteurs decisifs vide.
  // Son plafond passe de 8000 a 5000 tokens, ce que le commentaire de
  // orchestrator.ts:917-919 annoncait deja sans que le code l applique :
  // la sortie est un JSON de synthese compact. Le plafond reduit est ce
  // qui finance sa fenetre sans pousser le chemin critique au mur.
  //
  // Elle n est pas enveloppee par withEngineDeadline, elle a sa propre
  // boucle de reprise et court contre le budget global.
  finalRecommendation: Object.freeze({ timeout: 150_000, maxRetries: 0 }),
}) as Record<BudgetedEngineKey, EngineLlmOptions>;

/** Plafond de tokens de la synthese finale. Expose pour que le site
 *  d appel et les tests lisent la meme valeur. */
export const ORCHESTRATE_MAX_TOKENS = 5000;

/**
 * Moteurs de la couche amont laisses a 150s dans ce commit, sous
 * surveillance. Leurs marges mesurees sur le corpus :
 *   market             130s au pire pour 150   -> 20s
 *   financialCoherence 131s au pire pour 150   -> 19s
 *   macro               77s au pire pour 150   -> 73s
 * Les deux premiers sont les prochains candidats a l elargissement. On
 * ne les touche pas maintenant pour ne pas rogner un budget deja tendu
 * par le passage de team a 180 : market et macro sont dans la porte,
 * donc chaque seconde ajoutee glisse tout le chemin critique. A
 * reexaminer des qu un run les fait tomber.
 */
export const UPSTREAM_WATCHLIST: ReadonlyArray<{ engine: string; windowMs: number; worstObservedMs: number }> = Object.freeze([
  Object.freeze({ engine: 'market', windowMs: 150_000, worstObservedMs: 130_000 }),
  Object.freeze({ engine: 'financialCoherence', windowMs: 150_000, worstObservedMs: 131_000 }),
  Object.freeze({ engine: 'macro', windowMs: 150_000, worstObservedMs: 77_000 }),
]);

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
 * Surcout wall-clock observe entre la fenetre LLM d un moteur et sa
 * duree totale : construction du prompt, parseJSON, sanitize, audit.
 * Mesure : team a rendu 151,6s pour une fenetre de 150s sur 0142901d,
 * et 152s sur 7dd40680.
 */
export const ENGINE_OVERHEAD_MS = 2_000;

/**
 * Duree d ouverture de la porte [team, market, macro] en pire cas par
 * deadlines externes. team porte desormais une fenetre de 180s et donc
 * une deadline de 200s ; market et macro restent a 150s de fenetre sous
 * la deadline par defaut de 200s. La porte vaut le maximum des trois.
 */
export const GATE_WORST_CASE_MS = 200_000;

/** Porte en pire cas par fenetres, borne par team qui est le plus lent
 *  des trois et le seul dont le rejet condamne la chaine. */
export function gateWorstCaseByWindowMs(): number {
  return ENGINE_LLM_BUDGET.team.timeout + ENGINE_OVERHEAD_MS;
}

/**
 * Marge de sortie propre reservee apres la synthese : ecriture de
 * markAnalysisCompleted, event de fin, close du stream
 * (route.ts:1378, EXIT_MARGIN_MS).
 */
export const EXIT_MARGIN_MS = 30_000;

/**
 * Reserve laissee a la synthese finale apres convergence : sa fenetre
 * plus la marge de sortie propre. Orchestrate est course contre le
 * budget global (Promise.race en fin de pipeline), il ne peut donc pas
 * deborder le mur a lui seul, mais sans cette reserve il n aurait
 * aucune chance d aboutir.
 */
export const ORCHESTRATE_RESERVE_MS = ENGINE_LLM_BUDGET.finalRecommendation.timeout + EXIT_MARGIN_MS;

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
  return gateWorstCaseByWindowMs()
    + ENGINE_LLM_BUDGET.patternMatching.timeout
    + ENGINE_LLM_BUDGET.causalReversal.timeout
    + ENGINE_LLM_BUDGET.referenceChecks.timeout;
}

/**
 * Total du run en pire cas par fenetres, synthese et sortie comprises.
 *
 * A LIRE AVEC SA LIMITE. Cette somme suppose que quatre moteurs
 * consecutifs consomment leur fenetre entiere puis echouent, scenario
 * ou il n y a de toute facon plus rien a synthetiser. Surtout, elle
 * n est pas atteignable : le budget de run court la convergence comme
 * la synthese et coupe avant. Le plafond opposable du run est
 * RUN_BUDGET_MS, pas cette somme.
 */
export function worstCaseRunByWindowMs(): number {
  return worstCaseConvergenceByWindowMs() + ORCHESTRATE_RESERVE_MS;
}

/**
 * Total nominal attendu, sur les durees mesurees quand elles existent
 * et estimees sinon. C est le regime que le budget doit accueillir
 * confortablement, par opposition au pire cas qui doit seulement
 * degrader proprement.
 *
 * Porte 160s : team n a jamais ete mesure au-dela de 146s en succes,
 * on prend une marge au-dessus du plafond qu il a heurte deux fois.
 * pattern et causal 160s chacun : jamais mesures, estimation sur
 * l ancrage fragilite a 8000 tokens. reference-checks 35s : jamais
 * mesure, Haiku a 4000 tokens. Synthese 110s : jamais mesuree, Sonnet
 * a 5000 tokens.
 */
export const NOMINAL_MS = Object.freeze({
  gate: 160_000,
  pattern: 160_000,
  causal: 160_000,
  referenceChecks: 35_000,
  orchestrate: 110_000,
});

export function nominalRunMs(): number {
  return NOMINAL_MS.gate + NOMINAL_MS.pattern + NOMINAL_MS.causal
    + NOMINAL_MS.referenceChecks + NOMINAL_MS.orchestrate;
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
  /**
   * Franchissement du plafond de tokens, calcule au moment de l appel
   * et non deduit apres coup d une egalite rendu / plafond.
   *
   * hitTokenCeiling() repond a la meme question mais depuis le puits
   * cumule : sur un moteur qui reprend, un premier appel coupe suivi
   * d une reprise courte donne une somme sous le plafond et le
   * franchissement disparait. Ce drapeau, lui, retient qu au moins un
   * appel a ete coupe.
   */
  hitCeiling?: boolean;
  /**
   * Voie par laquelle la sortie a ete parsee. jsonrepair recoud une
   * sortie coupee sans lever ni logger, et le moteur ressort en ok :
   * rien dans les donnees persistees ne permettait de savoir qu une
   * sortie avait ete rafistolee. reference-checks a rendu exactement
   * 4000 tokens sur 4000 au run 2517a288 et son parse a reussi, sans
   * qu on puisse trancher entre une sortie complete et une reparation.
   */
  parseMode?: ParseMode;
}

/**
 * Voie de parse effective d une sortie de modele.
 *   direct    JSON.parse sur la sortie nettoyee des fences
 *   extracted un candidat JSON valide extrait d une sortie enrobee de
 *             prose, structure intacte, rien n a ete modifie
 *   recovered le candidat etait coupe et le parseur a du le completer,
 *             ou le reparer : signal fort d une sortie tronquee
 *   repaired  jsonrepair a du refermer toute la sortie en dernier
 *             recours : signal fort d une sortie tronquee
 *
 * Les deux dernieres voies modifient la structure rendue par le modele
 * et etaient toutes deux muettes. La distinction entre elles est celle
 * du recours employe, pas celle de la gravite.
 */
export type ParseMode = 'direct' | 'extracted' | 'recovered' | 'repaired';

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
  // Franchissement evalue sur CET appel, pas sur le cumul. Un moteur
  // qui reprend apres une coupure noierait le signal dans la somme.
  const rendus = usage?.output_tokens ?? 0;
  if (maxTokens !== undefined && rendus >= Math.floor(maxTokens * 0.98)) {
    sink.hitCeiling = true;
  }
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

/**
 * Detecte qu une reponse a ete coupee par max_tokens plutot que mal
 * formee. Deux signaux, l un suffit :
 *   - la sortie ne se termine pas par une accolade ou un crochet
 *     fermant, une reponse JSON complete finit toujours par l un des
 *     deux une fois les fences markdown retires ;
 *   - les accolades ou les crochets ne sont pas equilibres, il en
 *     manque a la fermeture.
 *
 * Volontairement conservateur : en cas de doute la fonction repond
 * false et la reprise a lieu, on ne veut pas supprimer une reprise
 * utile pour economiser une fenetre. Exporte pour etre testable sans
 * appel reseau.
 */
export function looksTruncated(raw: string): boolean {
  if (!raw) return true;
  // Retire les fences markdown et la prose de tete eventuelle pour ne
  // juger que la charge JSON.
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const firstBrace = s.search(/[[{]/);
  if (firstBrace === -1) return true;
  s = s.slice(firstBrace).trim();
  if (!s) return true;

  const last = s[s.length - 1];
  if (last !== '}' && last !== ']') return true;

  let curly = 0;
  let square = 0;
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') curly++;
    else if (ch === '}') curly--;
    else if (ch === '[') square++;
    else if (ch === ']') square--;
  }
  // Un solde positif signale des ouvertures jamais refermees, donc une
  // coupure. Un solde negatif est une malformation, pas une troncature.
  return curly > 0 || square > 0;
}

/** Instant le plus tardif ou la porte de reference-checks peut s ouvrir,
 *  en pire cas de deadlines. Doit rester sous WAIT_DEADLINE_MS, sinon le
 *  moteur meurt sur sa garde d attente sans jamais appeler son LLM. */
export function referenceChecksGateWorstCaseMs(): number {
  return GATE_WORST_CASE_MS
    + engineDeadlineFor('patternMatching')
    + engineDeadlineFor('causalReversal');
}
