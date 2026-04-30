import { callClaudeWithPDF, parseJSON } from './anthropic-client';
import type { ExtractionOutput } from './types';

const SYSTEM_PROMPT = `Tu es le Moteur d'Extraction de la plateforme Prélude. Ton seul rôle est de lire un pitch deck PDF et d'extraire les informations factuelles présentes, structurées en JSON.

Tu n'analyses pas. Tu n'interprètes pas. Tu n'évalues pas. Tu extrais ce qui est dans le deck.

Si une information n'est pas présente dans le deck, retourne une chaîne vide "" ou un tableau vide [], pas une invention.

Format de réponse OBLIGATOIRE (JSON pur, sans markdown, sans backticks, sans texte additionnel) :

{
  "companyName": "nom exact de la société",
  "sector": "secteur principal (Défense, Santé, IA, Fintech, SaaS, E-commerce, Mobilité, Media, Cloud, Insurtech, Hospitalité, etc.)",
  "subSector": "sous-secteur précis tel que présenté dans le deck",
  "geographicHub": "ville principale du siège",
  "country": "pays du siège",
  "yearFounded": année de fondation en nombre,
  "founders": [
    { "name": "nom complet", "role": "rôle (CEO, CTO, COO, etc.)", "background": "background résumé en une phrase" }
  ],
  "marketPitch": "la promesse de marché en 2-3 phrases",
  "productDescription": "description du produit ou service en 2-3 phrases",
  "businessModel": "modèle économique en 1-2 phrases",
  "traction": {
    "metrics": ["liste des métriques chiffrées présentées"],
    "revenue": "ARR ou CA si présenté",
    "growth": "taux de croissance si présenté",
    "customers": "nombre de clients si présenté"
  },
  "fundraise": {
    "stage": "stade du tour (seed, Series A, B, C, etc.)",
    "amount": "montant levé ou recherché",
    "valuation": "valorisation pré-money ou post-money si présenté",
    "leadInvestor": "investisseur lead si annoncé",
    "coInvestors": ["liste des co-investisseurs si annoncés"]
  },
  "competitorsCited": ["liste des concurrents cités explicitement dans le deck"],
  "rawSummary": "résumé global du deck en 4-5 phrases denses, factuel, sans interprétation"
}`;

export async function extractFromDeck(pdfBase64: string): Promise<ExtractionOutput> {
  const userPrompt = 'Extrais les informations factuelles de ce pitch deck. Retourne uniquement le JSON structuré demandé.';
  const rawResponse = await callClaudeWithPDF(SYSTEM_PROMPT, userPrompt, pdfBase64, 3000);
  return parseJSON<ExtractionOutput>(rawResponse);
}
