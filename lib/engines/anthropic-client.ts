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

// Helper appel texte simple
export async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 2000, model: string = FAST_MODEL): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const textBlock = response.content.find(c => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Réponse Claude vide ou invalide');
  }
  return textBlock.text;
}

// Helper appel avec PDF (toujours Sonnet pour la qualité d'extraction)
export async function callClaudeWithPDF(systemPrompt: string, userPrompt: string, pdfBase64: string, maxTokens = 3000, model: string = FAST_MODEL): Promise<string> {
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
    // Si le JSON direct échoue, essayer d'extraire le premier objet/tableau JSON valide
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let start = -1;
    let openChar = '';
    let closeChar = '';

    if (firstBrace === -1 && firstBracket === -1) {
      throw new Error('Aucun JSON trouvé dans la réponse Claude. Réponse brute : ' + cleaned.slice(0, 200));
    }

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      start = firstBracket;
      openChar = '[';
      closeChar = ']';
    } else {
      start = firstBrace;
      openChar = '{';
      closeChar = '}';
    }

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
      // Compter les guillemets non échappés
      let quoteCount = 0;
      let escape2 = false;
      for (let i = 0; i < recovered.length; i++) {
        const c = recovered[i];
        if (escape2) { escape2 = false; continue; }
        if (c === '\\') { escape2 = true; continue; }
        if (c === '"') quoteCount++;
      }
      // Si nombre impair de guillemets, fermer la chaîne
      if (quoteCount % 2 === 1) recovered += '"';

      // Compter les accolades/crochets ouverts non fermés et les fermer
      let curDepth = 0;
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
      // Retirer la dernière virgule éventuelle qui suivrait une valeur incomplète
      recovered = recovered.replace(/,\s*$/, '');
      // Fermer toutes les structures
      while (stack.length) recovered += stack.pop();

      try {
        return JSON.parse(recovered) as T;
      } catch (e3: any) {
        // Dernier recours : jsonrepair sur le contenu recupere
        try {
          return JSON.parse(jsonrepair(recovered)) as T;
        } catch {
          throw new Error('JSON tronqué et non récupérable. Début : ' + cleaned.slice(start, start + 300));
        }
      }
    }

    const extracted = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(extracted) as T;
    } catch (e2: any) {
      // FILET DE SECURITE : la lib jsonrepair sait reparer les JSON
      // syntaxiquement invalides genere par les LLMs (virgule en trop,
      // guillemet manquant, accolade orpheline, etc.). C est le cas
      // typique d Anthropic sur les reponses tres longues : 99% du
      // JSON est valide, un seul caractere est defectueux.
      try {
        const repaired = jsonrepair(extracted);
        return JSON.parse(repaired) as T;
      } catch (e3: any) {
        // Si meme jsonrepair n y arrive pas, on tente sur le brut entier
        // (peut etre que le truncate sur depth a casse quelque chose).
        try {
          const repairedFull = jsonrepair(cleaned);
          return JSON.parse(repairedFull) as T;
        } catch {
          throw new Error('Impossible de parser le JSON extrait : ' + e2.message + '. Début : ' + extracted.slice(0, 200));
        }
      }
    }
  }
}
