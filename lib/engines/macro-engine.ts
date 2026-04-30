import { callClaude, parseJSON } from './anthropic-client';
import { gatherMacroRealData, type MacroSnapshot } from '../data-fetchers/sources';
import type { ExtractionOutput, MacroAnalysisOutput } from './types';

const SYSTEM_PROMPT = `Tu es le Moteur Macro & Géopolitique de la plateforme Prélude. Tu produis la lecture du régime macro applicable au segment du dossier en croisant cinq dimensions structurées et des données économiques réelles récupérées de World Bank API.

# CADRE MACRO

## Position de cycle
Distingue quatre positions :
- pre-bascule : signaux de retournement structurel à 12-24 mois, fenêtre rare d'investissement contracyclique
- bascule : retournement en cours, fenêtre étroite de positionnement
- post-bascule : retournement consommé, valorisations élevées, fenêtre fermée
- mature : segment stable, croissance organique sans bascule attendue

## Régime de taux d'intérêt
Tu reçois le taux d'intérêt réel observé pour le pays. Évalue le régime monétaire pertinent (restrictif, neutre, accommodant). Impact sur valorisations et capital-intensive.

## Géopolitique
Évalue la situation géopolitique pertinente pour le segment. Stable, tensions structurelles, rupture en cours. Identifier les bascules : post-Ukraine 2022 pour défense EU, post-ChatGPT 2022 pour IA, post-COVID pour télétravail, post-PSD2 pour fintech EU.

## Capital VC sur le segment
Évalue l'état du capital VC. Underweight (segment sous-investi, fenêtre contracyclique favorable), balanced, overweight (segment surfinancé, risque de retournement court).

## Cycle de demande
Bas de cycle, montée, plateau, retournement.

## Fenêtre temporelle critique
Identifie si une fenêtre temporelle critique existe pour ce segment. Cas Mistral 2023 sur l'IA générative est un exemple type.

## Opportunité contracyclique
Évalue si le segment offre une opportunité contracyclique (sous-pondéré actuellement, signaux de bascule plausible à 18-36 mois).

## Tendances structurelles
Identifie 3-5 tendances structurelles macro pertinentes pour le segment, en t'appuyant notamment sur les données R&D et FDI quand elles sont disponibles.

## Environnement réglementaire
Décris l'environnement réglementaire pertinent. Régulation peut être barrière protectrice ou contrainte qui affaiblit.

# FORMAT JSON OBLIGATOIRE

{
  "cyclePosition": "pre-bascule" ou "bascule" ou "post-bascule" ou "mature",
  "interestRateRegime": "phrase qui qualifie le régime, en s'appuyant sur les chiffres réels",
  "geopolitics": "phrase qui qualifie la situation géopolitique pertinente",
  "vcCapitalOnSegment": "underweight" ou "balanced" ou "overweight",
  "demandCycle": "phrase qui qualifie le cycle de demande",
  "criticalTimingWindow": {
    "exists": true ou false,
    "horizon": "horizon si exists=true",
    "rationale": "phrase explicative"
  },
  "contraryclicalOpportunity": {
    "score": 0-100,
    "rationale": "phrase"
  },
  "structuralTrends": ["tendances structurelles identifiées"],
  "regulatoryEnvironment": "phrase qui qualifie l'environnement réglementaire"
}

Note : tu disposes de connaissance jusqu'à début 2026. Sois explicite sur les bascules récentes.`;

export async function analyzeMacro(extraction: ExtractionOutput): Promise<MacroAnalysisOutput & { realData?: MacroSnapshot }> {
  // ÉTAPE 1 : Récupération des indicateurs macro réels du pays
  const realData = await gatherMacroRealData(extraction.country || 'France');

  // ÉTAPE 2 : Construire le résumé pour Claude
  let summary = `\n--- DONNÉES MACRO RÉELLES (World Bank API) ---\n`;
  summary += `Pays : ${realData.country}\n`;
  summary += `Sources interrogées : ${realData.sourcesQueried.join(', ')}\n`;
  summary += `Sources avec résultats : ${realData.sourcesFound.join(', ') || 'aucune'}\n\n`;

  if (realData.indicators.gdpGrowth && realData.indicators.gdpGrowth.length > 0) {
    summary += `Croissance PIB (5 dernières années) :\n`;
    realData.indicators.gdpGrowth.slice(0, 5).forEach(d => {
      summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
    });
    if (realData.derivedMetrics.growth_trend) {
      summary += `  → Tendance dérivée : ${realData.derivedMetrics.growth_trend}\n`;
    }
  }

  if (realData.indicators.inflation && realData.indicators.inflation.length > 0) {
    summary += `\nInflation (5 dernières années) :\n`;
    realData.indicators.inflation.slice(0, 5).forEach(d => {
      summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
    });
    if (realData.derivedMetrics.inflation_status) {
      summary += `  → Statut dérivé : ${realData.derivedMetrics.inflation_status}\n`;
    }
  }

  if (realData.indicators.interestRate && realData.indicators.interestRate.length > 0) {
    summary += `\nTaux d'intérêt réel (5 dernières années) :\n`;
    realData.indicators.interestRate.slice(0, 5).forEach(d => {
      summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
    });
    if (realData.derivedMetrics.rate_regime) {
      summary += `  → Régime dérivé : ${realData.derivedMetrics.rate_regime}\n`;
    }
  }

  if (realData.indicators.rdSpending && realData.indicators.rdSpending.length > 0) {
    summary += `\nDépenses R&D (% du PIB, dernière donnée disponible) :\n`;
    summary += `  ${realData.indicators.rdSpending[0].date} : ${Number(realData.indicators.rdSpending[0].value).toFixed(2)}%\n`;
  }

  if (realData.indicators.fdiInflows && realData.indicators.fdiInflows.length > 0) {
    summary += `\nFlux IDE entrants (% du PIB, dernière donnée) :\n`;
    summary += `  ${realData.indicators.fdiInflows[0].date} : ${Number(realData.indicators.fdiInflows[0].value).toFixed(2)}%\n`;
  }

  const userPrompt = `# DOSSIER À ANALYSER (extraction du pitch deck)
Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}
Année fondation : ${extraction.yearFounded}

Produit : ${extraction.productDescription}
Business model : ${extraction.businessModel}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount}

${summary}

Produis la lecture macro complète au format JSON structuré demandé. Croise les données réelles récupérées avec ta connaissance des bascules sectorielles récentes.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 1800);
  const analysis = parseJSON<MacroAnalysisOutput>(rawResponse);

  return { ...analysis, realData };
}
