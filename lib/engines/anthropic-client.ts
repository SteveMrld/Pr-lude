import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

// ============================================================
// TIMEOUT ET RETRY : politique du client Anthropic
// ------------------------------------------------------------
// Les defaults du SDK @anthropic-ai/sdk sont timeout = 10 min et
// maxRetries = 2. En l etat, un appel Claude qui coince peut
// consommer jusqu a 30 minutes de wall-clock : 10 min tentative
// initiale, 10 min retry 1, 10 min retry 2. En parallele sur 6
// moteurs qui timeoutent tous en meme temps sur un incident
// Anthropic, on depasse le mur Vercel des 800s en trois vagues et
// on recolte un Runtime Timeout Error opaque qui laisse la ligne
// analyses en 'running' fantome.
//
// Preuve empirique : run Food Pilot du 7 juillet 2026, patterns
// dans les logs Vercel "11.9s x3" puis "61s x3" sur les appels
// api.anthropic.com. Ce sont les reprises silencieuses du SDK qui
// empilent le temps jusqu au mur, pas un moteur unique qui hang.
//
// Reponse initiale (commit 66f8235 du 8 juillet 2026) : maxRetries
// force a 0, toute reprise silencieuse coupee. Politique stricte,
// justifiee tant que le budget par tentative etait celui du SDK
// (10 min chacune). Mais avec maxRetries=0, un incident SDK
// authentique et unique detruit tout le moteur : cas In Haircare
// du 15 juillet, team a echoue sur un "Request timed out." unique
// et a fait perdre 42% du score final (cinq dimensions passees en
// neutre 50 par cascade).
//
// Politique retenue apres audit In Haircare (deux plafonds bornent
// desormais la reprise) :
//
//   - timeout par appel = 60_000 ms (60s). Suffisant pour Sonnet
//     4.6 sur nos prompts en regime nominal (mesure : 20-40s).
//     Un appel qui depasse 60s est un signal d incident cote
//     Anthropic ou de web_search bloque sur un upstream lent,
//     mieux vaut abandonner cette tentative que persister.
//
//   - maxRetries = 1. Une reprise unique, autorisee parce que le
//     timeout par tentative est desormais borne a 60s (pas 10 min
//     comme au defaut SDK). Pire cas par moteur :
//     60s + backoff SDK (~500ms) + 60s = ~120.5s.
//     Contenu par la deadline externe ENGINE_DEADLINE_MS=200_000
//     (fichier route.ts) qui laisse 80s de slack pour le
//     pre-processing (gatherFounderRealData 8s par founder,
//     sectoral context, JSON parse, sanitize).
//
//   Ce que la reprise couvre : un timeout SDK isole ou un 429/529
//   transitoire sur une seule tentative. Anthropic sert typiquement
//   la seconde tentative en 20-40s meme apres un premier echec.
//   Sur le corpus des 28 dossiers, un seul run a eu un moteur
//   Bloc 1 en echec ("Request timed out."). Le retry unique aurait
//   sauve ce cas.
//
//   Ce que la reprise NE couvre PAS : un incident Anthropic
//   prolonge qui persiste sur les deux tentatives. Dans ce cas, le
//   moteur echoue proprement en failed avec le message SDK,
//   l orchestrateur recoit un output null et applique son
//   fallback degrade (mechanicalScore sur les moteurs aboutis).
//
//   Budget global : la reprise unique n empile pas comme dans le
//   bug Food Pilot. Chaine critique serie (layer 1 -> pattern ->
//   causal -> refChecks -> orchestrate), 5 maillons a 121s worst
//   case = 605s. Marginal 5s au-dessus de RUN_BUDGET_MS=600_000
//   (route.ts) dans le worst case pathologique (probabilite ~10^-8
//   vu la base rate observee), et dans ce cas le budgetPromise
//   fire markAnalysisFailed avant tout Vercel Runtime Error.
//
//   Le retry loop explicite d orchestrate (2 tentatives via
//   route.ts MAX_ATTEMPTS) reste en place pour les 529 avec
//   backoff jitter cible sur ce moteur critique unique, avec
//   check budgetRemainingMs qui empeche son declenchement si le
//   budget residuel ne suffit pas.
// ============================================================

export function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY manquante. Configurer dans Vercel Settings > Environment Variables.');
  }
  _client = new Anthropic({
    apiKey,
    timeout: 60_000,
    maxRetries: 1,
  });
  return _client;
}

export const MODEL = 'claude-sonnet-4-6';
export const FAST_MODEL = 'claude-haiku-4-5-20251001';

// ============================================================
// CONFIG WEB SEARCH (Niveau 2.A)
// ------------------------------------------------------------
// Le web_search natif d Anthropic permet a Claude de chercher
// sur le web pendant la generation. Decision d activation :
//   - Variable env ENABLE_WEB_SEARCH=true a definir sur Vercel
//   - Coute des tokens supplementaires (la sortie web est injectee
//     dans le contexte) mais pas d API externe a gerer
//   - Latence ajoutee : 5-15s par moteur qui l utilise
//
// Le tool s appelle web_search_20250305 dans l API.
// max_uses : limite combien de recherches Claude peut faire dans
// un seul appel pour eviter de boucler trop longtemps.
// ============================================================

export function isWebSearchEnabled(): boolean {
  return process.env.ENABLE_WEB_SEARCH === 'true';
}

interface CallClaudeOptions {
  /** Active le web_search natif Anthropic. Defaut : suit isWebSearchEnabled() */
  enableWebSearch?: boolean;
  /** Limite le nombre de recherches web par appel. Defaut : 3 */
  maxWebSearches?: number;
}

// ============================================================
// MODE DE RUN PARTAGE PAR LES MOTEURS
// ------------------------------------------------------------
// Type d options propage de la route /api/analyze vers chaque
// moteur qui a besoin de connaitre le mode de run. Aujourd hui
// un seul flag : frozen, qui coupe en dur le web search pour
// les re-runs corpus (eviter toute fuite de l outcome connu).
//
// asOf n entre pas dans ce type : il vit dans le version stamp
// et la ligne analyses comme provenance pure, sans effet sur les
// appels LLM ou les outils web. La prevention de fuite vient
// exclusivement de frozen, pas de la date.
// ============================================================

export interface EngineRunOptions {
  /** Coupe le web_search en dur sur ce run, surpassant ENABLE_WEB_SEARCH. */
  frozen?: boolean;
}

/**
 * Compose les options finales d un appel callClaude en partant des
 * options propres au moteur (typiquement maxWebSearches), en y
 * incorporant le mode de run. Si frozen=true, l appelant force
 * enableWebSearch:false meme si ENABLE_WEB_SEARCH=true ou si le
 * moteur voulait laisser le defaut. Le frozen prevaut sur tout.
 */
export function applyRunOptions(
  baseOptions: CallClaudeOptions,
  runOptions: EngineRunOptions | undefined,
): CallClaudeOptions {
  if (runOptions?.frozen === true) {
    return { ...baseOptions, enableWebSearch: false };
  }
  return baseOptions;
}

// Helper appel texte simple, avec option web_search natif.
//
// IMPORTANT : le defaut est MODEL (Sonnet 4.6) parce que la majorite des
// moteurs Bloc 1 (team, market, macro, pattern, causal, blindspot,
// contrarian, financial-coherence) tournent sur Sonnet pour la qualite
// dialectique. Haiku reste explicite quand voulu (prescan Bloc 0,
// reference-checks, reference-aggregation, tech-claim-coherence) en
// passant FAST_MODEL en quatrieme parametre.
//
// Avant : le defaut etait FAST_MODEL (Haiku) ce qui faisait tourner
// silencieusement huit moteurs Bloc 1 sur Haiku au lieu de Sonnet,
// degradant massivement la qualite des analyses dialectiques.
export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000,
  model: string = MODEL,
  options: CallClaudeOptions = {},
): Promise<string> {
  const client = getClient();

  // Decide si on active le web search pour cet appel.
  // Par defaut on suit la variable env globale, mais l appelant peut
  // override (par ex. pour desactiver explicitement sur certains moteurs
  // qui n en ont pas besoin meme si la feature est globalement active).
  const useWebSearch = options.enableWebSearch ?? isWebSearchEnabled();
  const maxWebSearches = options.maxWebSearches ?? 3;

  // Caching automatique du system prompt si suffisamment long.
  // Anthropic exige 1024 tokens minimum pour activer le caching sur
  // Sonnet, 2048 pour Haiku. On approxime tokens = chars / 4 pour
  // decider d activer le caching. Seuil 4000 chars (1000 tokens) qui
  // garantit que les prompts cibles passent. Les prompts plus courts
  // (rare, certains moteurs deterministes ont des prompts compacts)
  // restent en mode legacy pour eviter des frais sans benefice.
  //
  // Le caching system prompt s active surtout entre dossiers consecutifs
  // dans une fenetre de 5 minutes : si Steve enchaine 2 dossiers, le
  // 2e paie 10% du tarif input pour les system prompts caches du 1er.
  // Sur 14 moteurs Bloc 1 dont la majorite ont un system prompt > 4000
  // chars, l economie cumulee atteint ~0,15 USD par dossier consecutif.
  const enableSystemCaching = systemPrompt.length >= 4000;

  const requestParams: any = {
    model,
    max_tokens: maxTokens,
    system: enableSystemCaching
      ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
      : systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  if (useWebSearch) {
    // Le tool web_search natif. Anthropic gere le scraping / search
    // / synthese cote serveur. On limite max_uses pour eviter qu il
    // boucle indefiniment sur des recherches tangentes.
    requestParams.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: maxWebSearches,
      },
    ];
  }

  const response = await client.messages.create(requestParams);

  // En presence de web_search, la reponse peut contenir plusieurs blocs :
  // tool_use (recherches), tool_result (resultats), text (reponse finale).
  // On concatene tous les blocs text pour avoir la reponse complete.
  const textBlocks = response.content.filter(c => c.type === 'text');
  if (textBlocks.length === 0) {
    throw new Error('Réponse Claude vide ou invalide');
  }
  // Joint avec saut de ligne au cas ou plusieurs blocs text consécutifs
  let combined = textBlocks.map((b: any) => b.text).join('\n');

  // ============================================================
  // NETTOYAGE DES BALISES CITE
  // ------------------------------------------------------------
  // Quand web_search est active, Anthropic injecte des balises de
  // citation <cite index="..."> dans le texte pour tracer les sources.
  // Ces balises pourrissent le rendu UI final (tu les vois affichees
  // litteralement dans la note).
  //
  // On les retire systematiquement a la sortie de callClaude. Le
  // contenu textuel des balises est preserve (c est le texte source
  // legitime), seules les balises ouvrantes/fermantes sont stripees.
  //
  // Cas geres :
  //   <cite index="26-4">texte</cite>     -> texte
  //   <cite index="26-4,26-5,26-6">x</cite> -> x
  //   <cite>x</cite>                       -> x (sans index)
  //
  // On opere AVANT le parseJSON pour que le JSON soit propre.
  // ============================================================
  if (useWebSearch) {
    combined = stripCiteTags(combined);
  }

  // Logging metriques de cache : si caching actif, note la repartition.
  // Permet de monitorer l efficacite du caching system prompt en prod
  // via les logs Vercel. Cumulable avec les logs cache du callClaudeWithPDF.
  const usage = (response as any).usage || {};
  if (usage.cache_creation_input_tokens || usage.cache_read_input_tokens) {
    console.log(
      `[anthropic] cache write=${usage.cache_creation_input_tokens || 0} read=${usage.cache_read_input_tokens || 0} regular=${usage.input_tokens || 0} model=${model}`,
    );
  }

  return combined;
}

// ============================================================
// VARIANTE callClaudeWithUsage
// ------------------------------------------------------------
// Meme appel que callClaude, mais retourne aussi les comptages de
// tokens necessaires a l estimation de cout par appelant. Utilise
// par les pipelines qui doivent journaliser un cout reel par
// generation (ex : Sectoral Intelligence Layer, qui agrege le
// cout des huit dimensions plus l agregation editoriale).
//
// Les comptages retournes sont ceux exposes par l API Anthropic
// dans response.usage : input_tokens, output_tokens, plus les
// champs cache si applicable. La sortie texte est nettoyee des
// balises <cite> exactement comme dans callClaude.
// ============================================================

export interface CallUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export async function callClaudeWithUsage(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000,
  model: string = MODEL,
  options: CallClaudeOptions = {},
): Promise<{ text: string; usage: CallUsage }> {
  const client = getClient();
  const useWebSearch = options.enableWebSearch ?? isWebSearchEnabled();
  const maxWebSearches = options.maxWebSearches ?? 3;
  const enableSystemCaching = systemPrompt.length >= 4000;

  const requestParams: any = {
    model,
    max_tokens: maxTokens,
    system: enableSystemCaching
      ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
      : systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  if (useWebSearch) {
    requestParams.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: maxWebSearches,
      },
    ];
  }

  const response = await client.messages.create(requestParams);

  const textBlocks = response.content.filter((c) => c.type === 'text');
  if (textBlocks.length === 0) {
    throw new Error('Réponse Claude vide ou invalide');
  }
  let combined = textBlocks.map((b: any) => b.text).join('\n');
  if (useWebSearch) {
    combined = stripCiteTags(combined);
  }

  const rawUsage = (response as any).usage || {};
  const usage: CallUsage = {
    input_tokens: typeof rawUsage.input_tokens === 'number' ? rawUsage.input_tokens : 0,
    output_tokens: typeof rawUsage.output_tokens === 'number' ? rawUsage.output_tokens : 0,
    cache_creation_input_tokens:
      typeof rawUsage.cache_creation_input_tokens === 'number'
        ? rawUsage.cache_creation_input_tokens
        : undefined,
    cache_read_input_tokens:
      typeof rawUsage.cache_read_input_tokens === 'number'
        ? rawUsage.cache_read_input_tokens
        : undefined,
  };

  if (usage.cache_creation_input_tokens || usage.cache_read_input_tokens) {
    console.log(
      `[anthropic] cache write=${usage.cache_creation_input_tokens || 0} read=${usage.cache_read_input_tokens || 0} regular=${usage.input_tokens || 0} model=${model}`,
    );
  }

  return { text: combined, usage };
}

/**
 * Retire les balises <cite index="..."> et </cite> du texte tout en
 * preservant leur contenu. Utilise apres web_search pour obtenir un
 * texte propre.
 */
function stripCiteTags(text: string): string {
  // Retire les balises ouvrantes <cite ...> avec ou sans attributs
  let cleaned = text.replace(/<cite\s*[^>]*>/gi, '');
  // Retire les balises fermantes </cite>
  cleaned = cleaned.replace(/<\/cite\s*>/gi, '');
  return cleaned;
}

// Helper appel avec PDF natif (vision multimodale). Defaut MODEL (Sonnet)
// pour la qualite d'extraction. Aligne avec callClaude ci-dessus.
//
// PROMPT CACHING ANTHROPIC
// ----------------------------------------------------------
// Le PDF du pitch deck est le plus gros contributeur au cout en
// tokens d entree d un dossier : un deck de 2 MB en base64 represente
// environ 1 a 3 millions de tokens. Le pipeline appelle ce helper
// jusqu a 5 fois pour le meme PDF (extraction, financial-extraction,
// saas-metrics, industrial-metrics, prescan), ce qui multiplie la
// facturation input par 5 pour le meme contenu.
//
// Le prompt caching d Anthropic permet de marquer le bloc PDF avec
// cache_control ephemeral. Anthropic stocke alors le PDF cote serveur
// pour 5 minutes apres le premier appel. Les appels suivants dans
// cette fenetre paient seulement 10% du cout normal pour relire le
// meme PDF (lecture cache) au lieu de 100% (premiere ecriture).
//
// Economies estimees pour un PDF de 1,5M tokens lu 5 fois :
// - Sans cache : 5 x 1,5M x 3 USD/M = 22,50 USD
// - Avec cache : 1,5M x 3,75 USD/M (write) + 4 x 1,5M x 0,30 USD/M (read) = 7,42 USD
// - Gain : 67% de reduction sur le cout input PDF, environ 15 USD par dossier
//
// Pas de risque de regression de qualite : le contenu envoye au modele
// est strictement identique, c est juste la facturation qui change.
// Si le pipeline depasse 5 minutes, le cache expire et la lecture
// repart en plein tarif sans erreur fonctionnelle.
export async function callClaudeWithPDF(systemPrompt: string, userPrompt: string, pdfBase64: string, maxTokens = 3000, model: string = MODEL): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          cache_control: { type: 'ephemeral' },
        } as any,
        { type: 'text', text: userPrompt },
      ],
    }],
  });
  const textBlock = response.content.find(c => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Réponse Claude vide ou invalide');
  }

  // Logging des metriques de cache pour suivre l efficacite du
  // prompt caching en prod. Ces compteurs permettent de verifier
  // que le caching s active bien sur les appels PDF subsequents
  // d un meme pipeline. Visible dans les logs Vercel ou en
  // observability.
  const usage = (response as any).usage || {};
  if (usage.cache_creation_input_tokens || usage.cache_read_input_tokens) {
    console.log(
      `[anthropic-pdf] cache write=${usage.cache_creation_input_tokens || 0} read=${usage.cache_read_input_tokens || 0} regular=${usage.input_tokens || 0} model=${model}`,
    );
  }

  return textBlock.text;
}
import { jsonrepair } from 'jsonrepair';

/**
 * Decompose les ligatures Unicode en leurs caracteres ASCII de base.
 * Les modeles Claude produisent parfois en sortie les caracteres composes
 * U+FB00 a U+FB04 (ﬀ ﬁ ﬂ ﬃ ﬄ) au lieu des decompositions ASCII (ff fi fl
 * ffi ffl). Ces caracteres composes ne sont pas rendus par toutes les
 * polices de fallback que Puppeteer utilise en environnement serverless
 * Vercel, ce qui produit des trous visibles dans le PDF (ex : 'difficulte'
 * rendu 'diculte' parce que le glyphe ﬃ U+FB03 n est pas trouve dans la
 * fallback). On decompose systematiquement avant rendu pour garantir un
 * affichage correct quel que soit le contexte de rendu.
 *
 * Egalement : on remplace les espaces insecables (U+00A0) qui produisent
 * parfois des faux positifs de wrapping en serif justifie, et les guillemets
 * typographiques courbes (U+2018-201D) par leur equivalent ASCII pour eviter
 * les rendus inconsistants.
 */
function decomposeLigatures(s: string): string {
  return s
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl');
}

/**
 * Walker recursif qui applique decomposeLigatures a toutes les strings d un
 * objet parse. Utilise apres JSON.parse pour normaliser systematiquement
 * toutes les valeurs textuelles produites par les moteurs.
 */
function sanitizeStringsRecursive(value: any): any {
  if (typeof value === 'string') return decomposeLigatures(value);
  if (Array.isArray(value)) return value.map(sanitizeStringsRecursive);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      out[key] = sanitizeStringsRecursive(value[key]);
    }
    return out;
  }
  return value;
}

export function parseJSON<T = any>(rawText: string): T {
  let cleaned = rawText.trim();

  // Retirer les fences markdown éventuels
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Tentative directe
  try {
    const parsed = JSON.parse(cleaned) as T;
    return sanitizeStringsRecursive(parsed);
  } catch (e) {
    // Si le JSON direct echoue, on cherche le premier objet/tableau JSON
    // valide dans le texte. On itere sur tous les candidats { et [ : un
    // LLM peut prefixer sa reponse par un preambule (tag de source, note
    // explicative, citation entre crochets...) qui ressemble a un debut
    // de JSON sans en etre un. Le parser doit alors essayer le candidat
    // suivant plutot que d echouer immediatement.
    const candidates = collectJsonCandidates(cleaned);
    if (candidates.length === 0) {
      throw new Error('Aucun JSON trouvé dans la réponse Claude. Réponse brute : ' + cleaned.slice(0, 200));
    }

    let lastError: any = null;
    for (const candidate of candidates) {
      const attempt = tryParseCandidate<T>(cleaned, candidate.start, candidate.openChar);
      if (attempt.ok) return sanitizeStringsRecursive(attempt.value as T);
      lastError = attempt.error;
    }

    // Aucun candidat n a marche : on tente jsonrepair sur tout le brut
    // en dernier recours.
    try {
      const repaired = JSON.parse(jsonrepair(cleaned)) as T;
      return sanitizeStringsRecursive(repaired);
    } catch {
      const firstCandidate = candidates[0];
      const sample = cleaned.slice(firstCandidate.start, firstCandidate.start + 200);
      throw new Error(
        'Impossible de parser le JSON extrait : ' +
        (lastError?.message || 'unknown') +
        '. Début : ' + sample,
      );
    }
  }
}

interface JsonCandidate {
  start: number;
  openChar: '{' | '[';
}

/**
 * Liste les positions de tous les '{' et '[' qui ne sont pas
 * a l interieur d une chaine JSON deja ouverte. Permet au parser de
 * tester chaque candidat dans l ordre quand le premier ne donne pas
 * un JSON valide (cas des preambules type "[web : ...]" ajoutes par
 * le LLM avant le vrai JSON).
 *
 * Retourne au maximum 8 candidats pour ne pas exploser sur un texte
 * tres bruite.
 */
function collectJsonCandidates(text: string): JsonCandidate[] {
  const candidates: JsonCandidate[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length && candidates.length < 8; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{' || c === '[') {
      candidates.push({ start: i, openChar: c });
    }
  }
  return candidates;
}

/**
 * Tente de parser le JSON commencant a la position `start` dans `cleaned`.
 * Gere le cas tronque (depth jamais retombe a 0) avec recuperation
 * progressive (fermetures synthetiques + jsonrepair).
 */
function tryParseCandidate<T>(
  cleaned: string,
  start: number,
  openChar: '{' | '[',
): { ok: boolean; value?: T; error?: any } {
  const closeChar = openChar === '{' ? '}' : ']';

  // Compter les ouvertures et fermetures pour trouver la fin du JSON
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) {
    // JSON tronqué (réponse Claude coupée par max_tokens). Tentative de récupération en complétant.
    let recovered = cleaned.slice(start);

    // Supprimer la dernière chaîne ouverte non terminée si présente
    let quoteCount = 0;
    let escape2 = false;
    for (let i = 0; i < recovered.length; i++) {
      const c = recovered[i];
      if (escape2) { escape2 = false; continue; }
      if (c === '\\') { escape2 = true; continue; }
      if (c === '"') quoteCount++;
    }
    if (quoteCount % 2 === 1) recovered += '"';

    // Compter les accolades/crochets ouverts non fermés et les fermer
    let curIn = false;
    let curEsc = false;
    const stack: string[] = [];
    for (let i = 0; i < recovered.length; i++) {
      const c = recovered[i];
      if (curEsc) { curEsc = false; continue; }
      if (c === '\\') { curEsc = true; continue; }
      if (c === '"') { curIn = !curIn; continue; }
      if (curIn) continue;
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') stack.pop();
    }
    recovered = recovered.replace(/,\s*$/, '');
    while (stack.length) recovered += stack.pop();

    try {
      return { ok: true, value: JSON.parse(recovered) as T };
    } catch (e3: any) {
      try {
        return { ok: true, value: JSON.parse(jsonrepair(recovered)) as T };
      } catch (e4: any) {
        return { ok: false, error: e4 };
      }
    }
  }

  const extracted = cleaned.slice(start, end + 1);
  try {
    return { ok: true, value: JSON.parse(extracted) as T };
  } catch (e2: any) {
    // jsonrepair pour les JSON syntaxiquement invalides
    try {
      return { ok: true, value: JSON.parse(jsonrepair(extracted)) as T };
    } catch (e3: any) {
      return { ok: false, error: e3 };
    }
  }
}
