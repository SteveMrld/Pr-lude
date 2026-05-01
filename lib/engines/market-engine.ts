import { callClaude, parseJSON } from './anthropic-client';
import { gatherMarketRealData, type MarketRealData } from '../data-fetchers/sources';
import type { ExtractionOutput, MarketAnalysisOutput } from './types';

const SYSTEM_PROMPT = `Tu es le Moteur d'Analyse de Marché de la plateforme Prélude. Tu reçois deux types de données :

1. Les données déclarées par le pitch deck (taille de marché annoncée, concurrents cités, traction)
2. Les données vérifiées par interrogation de sources publiques (Hacker News, OpenAlex concepts, Wikipedia, GitHub Topics)

Ton travail consiste à croiser ces deux types pour produire une lecture rigoureuse du marché qui distingue ce qui est confirmé par les sources publiques de ce qui est purement déclaratif.

# CADRE D'ANALYSE DE MARCHÉ

## Distinction critique : Taille perçue versus Intensité réelle
La plupart des fonds VC raisonnent sur la taille apparente. La plateforme raisonne sur l'intensité du besoin. Un marché niche avec intensité extrême peut produire une scaleup. Un marché massif avec intensité diluée non.

Évalue la taille perçue (massive, large, niche) en croisant le déclaré et les signaux vérifiés.
Évalue l'intensité réelle (extreme, high, medium) à partir des signaux organiques mesurés (HN, recherche académique, écosystème open source).

## Saturation
- Saturated : plusieurs acteurs établis dominent
- Fragmented : beaucoup d'acteurs sans dominant
- Emerging : catégorie en construction

Critique : un marché saturé en acteurs n'est pas nécessairement bien servi. Pattern Zoom-Stripe-Dropbox.

## Signaux organiques mesurés
À partir des données HN (volume de mentions, tendance sur 24 mois, scores), évalue les signaux organiques de la demande. À partir d'OpenAlex (volume publications académiques, tendance), évalue l'émergence scientifique. À partir de GitHub Topics, évalue la vitalité de l'écosystème technique open source.

## Défensibilité
Identifie les moats potentiels (effet de réseau, intégration verticale, données propriétaires, régulation comme barrière) et les vulnérabilités (réplicabilité, hyperscalers, dépendance plateforme).

## Comparables internationaux
Identifie 2-3 comparables internationaux pertinents par structure de défi.

## Matrice concurrentielle binaire
Tu produis une matrice concurrentielle de référence (modèle factsheet conseil M&A type Idinvest) :
- 8-12 dimensions sectorielles pertinentes (capacités, fonctionnalités, géographies, segments servis, etc.) ADAPTÉES au secteur du dossier. Pas de dimensions génériques fades. Les dimensions doivent être les CRITÈRES DE DÉCISION D'ACHAT des clients du secteur.
- 5-8 players évalués : la startup analysée + ses concurrents directs cités dans le deck + les concurrents réels du marché que tu connais
- Pour chaque combinaison player × dimension, true (capacité présente) ou false (absent)
- Calcul du score de différenciation : combien de dimensions où la startup a un √ alors qu'aucun concurrent ne l'a
- Exemple type IDVIU-VR : dimensions = ['distribution', 'playback multiplatform', 'platform channels', 'interactivity', '3d engine', 'secure video', 'tracking/analysis', 'tag', 'billing', 'synch', 'api/sdk']. Players = ['IDVIU-VR', 'Jaunt', 'NextVR', 'Oculus', 'Google', etc.]

## Cohérence déclaré vs vérifié
NOUVEAU PILIER. Identifie les zones où les sources publiques confirment le pitch (signaux organiques mesurables, écosystème actif), les zones non vérifiables (taille TAM annoncée invérifiable), et les écarts (concurrents cités versus concurrents réels du marché).

# FORMAT JSON OBLIGATOIRE

{
  "perceivedSize": "massive" ou "large" ou "niche",
  "realIntensity": "extreme" ou "high" ou "medium",
  "saturation": "saturated" ou "fragmented" ou "emerging",
  "organicSignals": {
    "score": 0-100,
    "rationale": "phrase qui s'appuie sur les chiffres HN et trend",
    "evidence": ["preuves observables des sources publiques"]
  },
  "needIntensity": {
    "score": 0-100,
    "rationale": "phrase",
    "gap": "le gap entre solutions existantes et besoin réel"
  },
  "defensibility": {
    "score": 0-100,
    "moats": ["moats identifiés"],
    "vulnerabilities": ["vulnérabilités identifiées"]
  },
  "internationalBenchmarks": [
    { "name": "nom", "geography": "pays", "relevance": "pertinence de l'analogie" }
  ],
  "competitiveDynamic": "phrase qui décrit la dynamique compétitive actuelle",
  "competitiveMatrix": {
    "dimensions": ["distribution", "playback multiplatform", "platform channels", "interactivity", "3d engine", "secure video", "tracking/analysis", "tag", "billing", "synch", "api/sdk"],
    "players": [
      { "name": "[Société analysée]", "isTargetCompany": true, "coverage": [true, true, true, true, true, true, true, true, true, true, true] },
      { "name": "Concurrent A", "isTargetCompany": false, "coverage": [true, true, false, false, false, false, false, false, false, false, false] }
    ],
    "differentiationScore": 0-100,
    "differentiationRationale": "phrase qui explique en quoi la startup se différencie selon la matrice"
  }
}`;

export async function analyzeMarket(extraction: ExtractionOutput): Promise<MarketAnalysisOutput & { realData?: MarketRealData }> {
  // ÉTAPE 1 : Récupération de data réelle
  // Mots-clés à utiliser pour interroger les sources
  const sectorKeyword = extraction.subSector || extraction.sector || 'technology';
  const productKeyword = extraction.productDescription?.split('.')[0]?.slice(0, 50);

  const realData = await Promise.race([
    gatherMarketRealData(
      extraction.companyName || '',
      sectorKeyword,
      productKeyword
    ),
    new Promise<MarketRealData>((resolve) => setTimeout(() => resolve({
      sourcesQueried: ['timeout'],
      sourcesFound: [],
    } as any), 10000)),
  ]);

  // ÉTAPE 2 : Construire le résumé pour Claude
  let realDataSummary = `\n--- DONNÉES VÉRIFIÉES PAR SOURCES PUBLIQUES ---\n`;
  realDataSummary += `Sources interrogées : ${realData.sourcesQueried.join(', ')}\n`;
  realDataSummary += `Sources avec résultats : ${realData.sourcesFound.join(', ') || 'AUCUNE'}\n\n`;

  if (realData.hackerNews) {
    realDataSummary += `Hacker News (mentions de "${extraction.companyName}") :\n`;
    realDataSummary += `  - ${realData.hackerNews.totalMentions} mentions au total\n`;
    realDataSummary += `  - Top score : ${realData.hackerNews.topPoints} points\n`;
    realDataSummary += `  - Mention la plus récente : ${realData.hackerNews.recentDate}\n`;
    if (realData.hackerNews.sample.length > 0) {
      realDataSummary += `  - Exemples :\n`;
      realData.hackerNews.sample.slice(0, 3).forEach(s => {
        realDataSummary += `    · "${s.title}" (${s.points}pts, ${s.date})\n`;
      });
    }
  }

  if (realData.hackerNewsTrend) {
    realDataSummary += `\nHN Trend sur le segment "${productKeyword || sectorKeyword}" :\n`;
    realDataSummary += `  - ${realData.hackerNewsTrend.recent} mentions sur 12 derniers mois\n`;
    realDataSummary += `  - ${realData.hackerNewsTrend.older} mentions sur 12-24 mois précédents\n`;
    realDataSummary += `  - Tendance : ${realData.hackerNewsTrend.trend}\n`;
  }

  if (realData.openalexConcept) {
    realDataSummary += `\nOpenAlex émergence académique (concept "${sectorKeyword}") :\n`;
    realDataSummary += `  - ${realData.openalexConcept.totalWorks} publications totales sur ce concept\n`;
    realDataSummary += `  - ${realData.openalexConcept.recentWorks} publications sur les 24 derniers mois\n`;
    realDataSummary += `  - Tendance : ${realData.openalexConcept.trend}\n`;
    if (realData.openalexConcept.relatedConcepts.length > 0) {
      realDataSummary += `  - Concepts liés : ${realData.openalexConcept.relatedConcepts.join(', ')}\n`;
    }
  }

  if (realData.wikipediaSector) {
    realDataSummary += `\nWikipedia secteur "${sectorKeyword}" :\n`;
    realDataSummary += `  - ${realData.wikipediaSector.summary.slice(0, 250)}...\n`;
  }

  if (realData.wikipediaRelated && realData.wikipediaRelated.length > 0) {
    realDataSummary += `\nWikipedia entités liées : ${realData.wikipediaRelated.join(', ')}\n`;
  }

  if (realData.githubEcosystem) {
    realDataSummary += `\nGitHub écosystème open source :\n`;
    realDataSummary += `  - ${realData.githubEcosystem.topRepos.length} repos populaires sur le sujet\n`;
    realDataSummary += `  - ${realData.githubEcosystem.cumulativeStars.toLocaleString()} étoiles cumulées\n`;
    realData.githubEcosystem.topRepos.slice(0, 3).forEach((r: any) => {
      realDataSummary += `    · ${r.name} (${r.stars.toLocaleString()}★, ${r.language || '?'}) : ${r.description?.slice(0, 80) || ''}\n`;
    });
  }

  realDataSummary += `\n--- SCORES OBJECTIFS BASÉS SUR LES FAITS ---\n`;
  if (realData.objectiveScores) {
    realDataSummary += `Signaux organiques (HN) : ${realData.objectiveScores.organic_signals}/100\n`;
    realDataSummary += `Émergence académique (OpenAlex) : ${realData.objectiveScores.academic_emergence}/100\n`;
    realDataSummary += `Écosystème technique (GitHub) : ${realData.objectiveScores.technical_ecosystem}/100\n`;
    realDataSummary += `Visibilité publique (Wikipedia) : ${realData.objectiveScores.public_visibility}/100\n`;
  } else {
    realDataSummary += `Sources externes désactivées : analyse uniquement basée sur le pitch deck.\n`;
  }

  const userPrompt = `# DONNÉES DÉCLARÉES (extraction du pitch deck)
Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}

Pitch marché : ${extraction.marketPitch}
Produit : ${extraction.productDescription}
Business model : ${extraction.businessModel}

Traction : ${JSON.stringify(extraction.traction)}
Concurrents cités dans le pitch : ${extraction.competitorsCited.join(', ') || 'Aucun'}

${realDataSummary}

Croise déclaré et vérifié pour produire l'analyse au format JSON structuré demandé.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 3000);
  const analysis = parseJSON<MarketAnalysisOutput>(rawResponse);

  return { ...analysis, realData };
}
