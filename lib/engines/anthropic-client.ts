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

// Parser JSON robuste qui extrait le JSON même si Claude ajoute du texte autour
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
      throw new Error('JSON malformé dans la réponse Claude. Début : ' + cleaned.slice(start, start + 200));
    }

    const extracted = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(extracted) as T;
    } catch (e2: any) {
      throw new Error('Impossible de parser le JSON extrait : ' + e2.message + '. Début : ' + extracted.slice(0, 200));
    }
  }
}

// Helper appel texte simple
export async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
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

// Helper appel avec PDF
export async function callClaudeWithPDF(systemPrompt: string, userPrompt: string, pdfBase64: string, maxTokens = 3000): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
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
