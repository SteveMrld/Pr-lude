import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY manquante. Configurer dans Vercel Settings > Environment Variables.');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export const MODEL = 'claude-sonnet-4-5';
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

// Helper appel texte simple, avec option web_search natif.
//
// IMPORTANT : le defaut est MODEL (Sonnet 4.5) parce que la majorite des
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

  const requestParams: any = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
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

  return combined;
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
export async function callClaudeWithPDF(systemPrompt: string, userPrompt: string, pdfBase64: string, maxTokens = 3000, model: string = MODEL): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } } as any,
        { type: 'text', text: userPrompt },
      ],
    }],
  });
  const textBlock = response.content.find(c => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Réponse Claude vide ou invalide');
  }
  return textBlock.text;
}
import { jsonrepair } from 'jsonrepair';

export function parseJSON<T = any>(rawText: string): T {
  let cleaned = rawText.trim();

  // Retirer les fences markdown éventuels
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Tentative directe
  try {
    return JSON.parse(cleaned) as T;
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
      if (attempt.ok) return attempt.value as T;
      lastError = attempt.error;
    }

    // Aucun candidat n a marche : on tente jsonrepair sur tout le brut
    // en dernier recours.
    try {
      return JSON.parse(jsonrepair(cleaned)) as T;
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
