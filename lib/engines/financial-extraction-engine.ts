import { callClaudeWithPDF, callClaude, parseJSON, MODEL } from './anthropic-client';
import type { FinancialDataExtraction, ExtractionOutput } from './types';

export const SYSTEM_PROMPT = `Tu es le Moteur d'Extraction Financière de la plateforme Prélude. Ton rôle est d'extraire les données financières structurées d'un dossier (pitch deck et/ou business plan).

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

Tu n'analyses pas, tu extrais. Si une donnée n'est pas présente, tu la marques avec une chaîne vide "" ou un tableau vide [].

Tu cites systématiquement la SOURCE de chaque donnée extraite : "deck" si elle vient du pitch deck, "bp" si elle vient du business plan, "deck+bp" si présente dans les deux. Cette traçabilité est critique pour le moteur de cohérence en aval.

Tu qualifies aussi la NATURE TEMPORELLE de chaque exercice via un champ "basis" strictement doctrinal :
- "actual" : exercice clos et RÉALISÉ, chiffres audités ou constatés (souvent noté YYYYA dans le document, ou "réalisé", "constaté", "clos").
- "budget" : exercice EN COURS budgété, valeur cible fixée en début d'année (souvent noté YYYYB, ou "budget", "atterrissage").
- "projected" : exercice FUTUR projeté (souvent noté YYYYE / YYYYF / YYYYP, ou "prévision", "estimation", "projection", "cible", "d'ici").
- null : le document ne qualifie PAS l'exercice, aucune inférence n'est autorisée. Un basis null est un fait, jamais un remplissage.

Règle absolue anti divination : si le document ne dit pas explicitement qu'un exercice est actual, budget ou projected, basis reste null. Ne pas deviner à partir de la date, ni du fait que l'année est passée, ni de la position dans le tableau. Un modèle qui devine est pire qu'un champ vide.

Quand le BP est en Excel/CSV, le contenu textuel a été extrait en lignes. Tu reconstruis les projections en lisant les lignes par catégorie.

# FORMAT JSON OBLIGATOIRE

{
  "hasBP": true|false,
  "fileSource": "deck"|"bp"|"both"|"none",
  "revenueProjection": [
    { "year": "2023", "value": 1.5, "source": "bp", "basis": "actual" },
    { "year": "2024", "value": 1.6, "source": "bp", "basis": "budget" },
    { "year": "2025", "value": 2.1, "source": "bp", "basis": "projected" },
    { "year": "2026", "value": 2.8, "source": "bp", "basis": null }
  ],
  "grossMarginProjection": [
    { "year": "2025", "value": 65, "source": "bp", "basis": "projected" }
  ],
  "ebitdaProjection": [
    { "year": "2025", "value": -1.2, "source": "bp", "basis": "projected" }
  ],
  "fcfProjection": [
    { "year": "2025", "value": -1.5, "source": "bp", "basis": "projected" }
  ],
  "unitEconomics": {
    "estimatedCAC": "ex: 250€ ou 'non communiqué'",
    "estimatedLTV": "ex: 1500€ ou 'non communiqué'",
    "estimatedLtvCacRatio": "ex: 6:1 ou 'non communiqué'",
    "averageContractValue": "ex: 50K€/an ou 'non communiqué'",
    "grossMarginPerUnit": "ex: 70% ou 'non communiqué'"
  },
  "headcount": [
    { "year": "2025", "value": 10, "source": "deck", "basis": "budget" }
  ],
  "opexProjection": [
    { "year": "2025", "value": 1.8, "source": "bp", "basis": "projected" }
  ],
  "currentRound": {
    "amount": "ex: 5M€ ou 'non précisé'",
    "runwayMonths": "ex: 24 ou 'non précisé'",
    "monthlyBurn": "ex: 200K€/mois ou 'non précisé'"
  },
  "marketAssumptions": {
    "tamCited": "ex: 50Md$ ou 'non communiqué'",
    "samCited": "ex: 5Md$ ou 'non communiqué'",
    "targetMarketShare": "ex: 2% en 2028 ou 'non communiqué'",
    "targetCustomersByYearN": "ex: 1000 clients en 2027 ou 'non communiqué'"
  },
  "rawNotes": "observations factuelles complémentaires sur les données financières",
  "lastActualYear": 2023,
  "lastActualYearEvidence": "citation courte du document (max 200 caractères) qui prouve que l'exercice 2023 est qualifié actual : ex. \\"P&L 2023A audité par PwC\\" ou \\"clôture au 31/12/2023, chiffres définitifs\\""
}

# RÈGLES STRICTES

- Toutes les valeurs monétaires en millions €. Convertir USD en EUR au taux 1:1 si nécessaire (approximation acceptable).
- Si une donnée est dans le deck ET le BP, mettre "deck+bp" en source.
- Les pourcentages (marge brute) sans le signe %.
- "value" doit être numérique (pas une string).
- yearFounded ou première année si projection démarre en N+1.
- Si aucune donnée financière disponible (deck purement narratif sans chiffres), hasBP = false et toutes les listes vides.
- Pour les ratios déclarés (LTV/CAC, etc.), citer les valeurs telles que présentées même si non recalculées.

# RÈGLES BASIS ET LASTACTUALYEAR

- Renseigne "basis" pour chaque entrée de projection quand le document qualifie explicitement l'exercice. Sinon null. Jamais une valeur devinée.
- lastActualYear = max des années dont basis === "actual" dans revenueProjection. Si aucune année actual, lastActualYear = null.
- lastActualYearEvidence : citation textuelle courte extraite du document qui atteste de la qualification actual pour cette année. Sans citation extractible, lastActualYearEvidence = null et lastActualYear = null également.
- Un chiffre sans qualifier ne devient jamais actual par défaut, même s'il porte une année passée.

Sois rigoureux. Pas d'invention. Si tu n'es pas sûr d'une donnée, mets "non communiqué".`;

/**
 * Extrait les données financières d'un dossier multi-documents
 * @param deckBase64 PDF du pitch deck (toujours requis)
 * @param bpContent contenu textuel du BP (Excel converti en texte, ou null si pas de BP)
 * @param extraction extraction du deck déjà faite (pour contexte)
 */
export async function extractFinancialData(
  deckBase64: string,
  bpContent: string | null,
  extraction: ExtractionOutput
): Promise<FinancialDataExtraction> {

  // Cas 1 : pas de BP, on extrait depuis le deck uniquement
  if (!bpContent) {
    const userPrompt = `Extrais les données financières présentes dans ce pitch deck.

# CONTEXTE
Société : ${extraction.companyName}
Secteur : ${extraction.sector}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount}

Le pitch deck est joint. Aucun business plan séparé n'est disponible.

Pour chaque donnée extraite, source = "deck". Si une donnée typique du BP (projections détaillées, unit economics) n'est pas dans le deck, mets une chaîne vide ou marque "non communiqué".

Retourne uniquement le JSON.`;

    // temperature=0 : lecture chiffree d un tableau P&L, aucun jugement.
    const rawResponse = await callClaudeWithPDF(SYSTEM_PROMPT, userPrompt, deckBase64, 8000, MODEL, 0);
    const result = parseJSON<FinancialDataExtraction>(rawResponse);
    // Garantir que tous les champs requis existent (Claude peut omettre un champ)
    result.hasBP = false;
    result.revenueProjection = result.revenueProjection || [];
    result.grossMarginProjection = result.grossMarginProjection || [];
    result.ebitdaProjection = result.ebitdaProjection || [];
    result.fcfProjection = result.fcfProjection || [];
    result.opexProjection = result.opexProjection || [];
    result.headcount = result.headcount || [];
    result.unitEconomics = result.unitEconomics || { estimatedCAC: '', estimatedLTV: '', estimatedLtvCacRatio: '', averageContractValue: '', grossMarginPerUnit: '' };
    result.currentRound = result.currentRound || { amount: '', runwayMonths: '', monthlyBurn: '' };
    result.marketAssumptions = result.marketAssumptions || { tamCited: '', samCited: '', targetMarketShare: '', targetCustomersByYearN: '' };
    result.rawNotes = result.rawNotes || '';
    result.fileSource = result.revenueProjection.length > 0 || result.unitEconomics.averageContractValue !== '' ? 'deck' : 'none';
    // lastActualYear + evidence : defaut null si absent du sortant.
    // Contrat anti divination : le pipeline ne fabrique jamais cette
    // valeur, il l accepte telle quelle du LLM ou reste silencieux.
    if (result.lastActualYear === undefined) result.lastActualYear = null;
    if (result.lastActualYearEvidence === undefined) result.lastActualYearEvidence = null;
    return result;
  }

  // Cas 2 : BP disponible, on combine deck + BP
  const userPrompt = `Extrais les données financières en combinant le pitch deck (joint) et le business plan ci-dessous.

# CONTEXTE
Société : ${extraction.companyName}
Secteur : ${extraction.sector}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount}

# BUSINESS PLAN (contenu textuel extrait du fichier Excel, CSV ou Word)

${bpContent.slice(0, 8000)}

# INSTRUCTIONS

1. Pour chaque donnée, identifie sa source : deck, bp, ou les deux
2. Si une même donnée apparaît différemment dans deck vs bp, prends la version BP (plus fiable) mais note la divergence dans rawNotes
3. Reconstruis les projections de revenue, marge, EBITDA, FCF, opex, headcount à partir du BP
4. Extrais les unit economics si présents
5. Identifie les hypothèses de marché (TAM, SAM, market share cible)

Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaudeWithPDF(SYSTEM_PROMPT, userPrompt, deckBase64, 8000, MODEL);
  const result = parseJSON<FinancialDataExtraction>(rawResponse);
  // Garantir que tous les champs requis existent
  result.hasBP = true;
  result.fileSource = 'both';
  result.revenueProjection = result.revenueProjection || [];
  result.grossMarginProjection = result.grossMarginProjection || [];
  result.ebitdaProjection = result.ebitdaProjection || [];
  result.fcfProjection = result.fcfProjection || [];
  result.opexProjection = result.opexProjection || [];
  result.headcount = result.headcount || [];
  result.unitEconomics = result.unitEconomics || { estimatedCAC: '', estimatedLTV: '', estimatedLtvCacRatio: '', averageContractValue: '', grossMarginPerUnit: '' };
  result.currentRound = result.currentRound || { amount: '', runwayMonths: '', monthlyBurn: '' };
  result.marketAssumptions = result.marketAssumptions || { tamCited: '', samCited: '', targetMarketShare: '', targetCustomersByYearN: '' };
  result.rawNotes = result.rawNotes || '';
  if (result.lastActualYear === undefined) result.lastActualYear = null;
  if (result.lastActualYearEvidence === undefined) result.lastActualYearEvidence = null;
  return result;
}
