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

// Parser JSON avec nettoyage des markdown éventuels
export function parseJSON<T = any>(rawText: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  return JSON.parse(cleaned) as T;
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
