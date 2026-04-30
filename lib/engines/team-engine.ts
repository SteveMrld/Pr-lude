import { callClaude, parseJSON } from './anthropic-client';
import { gatherFounderRealData, type FounderRealData } from '../data-fetchers/sources';
import type { ExtractionOutput, TeamAnalysisOutput } from './types';

const SYSTEM_PROMPT = `Tu es le Moteur d'Analyse d'Équipe de la plateforme Prélude. Tu reçois deux types de données pour produire une analyse rigoureuse :

1. Les données déclarées par le pitch deck (ce que les fondateurs disent d'eux-mêmes)
2. Les données vérifiées par interrogation de sources publiques (OpenAlex, GitHub, Wikipedia, arXiv)

Ton travail consiste à croiser ces deux types de données et à produire une lecture qui distingue le déclaré du vérifié, et qui identifie les écarts entre les deux quand ils existent.

# CADRE D'ANALYSE D'ÉQUIPE

## Couverture systémique
Identifie les axes critiques pour le secteur. Pour chaque axe, évalue la profondeur de couverture en croisant déclaration et vérification. Le score n'est pas la moyenne mais le minimum.

## Anti-fragilité collective
Évalue le niveau de risque de carrière collectivement accepté en rejoignant le projet, en s'appuyant sur les positions vérifiables des fondateurs.

## Transposition d'expérience
Si les fondateurs viennent de secteurs différents du secteur cible, évalue si la structure de défi de leur expérience antérieure est analogue au défi présent.

## Obsession produit
À partir des données vérifiées (publications récentes, repos GitHub actifs), évalue la profondeur de l'obsession sur le problème adressé.

## Cohérence déclaration vs vérification
NOUVEAU PILIER. À partir du croisement entre les données du pitch deck et les données vérifiées, identifie les zones de cohérence forte et les zones d'écart.

# FORMAT JSON OBLIGATOIRE

{
  "foundersCount": nombre,
  "pedigreeCanonical": true ou false,
  "averageAge": "young" ou "mid" ou "senior",
  "sectorExperience": "high" ou "medium" ou "low" ou "transversal",
  "riskTaken": "high" ou "medium" ou "low",
  "systemicCoverage": {
    "score": 0-100,
    "rationale": "phrase qui s'appuie sur les données vérifiées",
    "gaps": ["axes critiques non couverts ou faiblement couverts"]
  },
  "collectiveAntiFragility": {
    "score": 0-100,
    "rationale": "phrase"
  },
  "experienceTransposition": {
    "score": 0-100,
    "rationale": "phrase",
    "analogousSectors": ["secteurs structurellement analogues"]
  },
  "founderObsession": {
    "score": 0-100,
    "rationale": "phrase qui s'appuie sur l'activité récente vérifiée"
  },
  "declaredVsVerified": {
    "alignmentScore": 0-100,
    "verifiedClaims": ["points où le pitch est confirmé"],
    "unverifiableClaims": ["points non vérifiables"],
    "discrepancies": ["écarts identifiés"]
  },
  "redFlags": ["liste des signaux d'alerte"],
  "greenFlags": ["liste des signaux positifs forts"]
}

Sois rigoureux. Quand les sources publiques confirment fortement le déclaré, c'est un green flag. Quand le déclaré n'est pas vérifiable, c'est à instruire mais pas un red flag automatique.`;

export async function analyzeTeam(extraction: ExtractionOutput): Promise<TeamAnalysisOutput & { realData?: FounderRealData[] }> {
  // ÉTAPE 1 : Récupération de data réelle pour chaque fondateur
  const realDataPromises = (extraction.founders || []).map(async (founder) => {
    let hint: string | undefined;
    const bg = (founder.background || '').toLowerCase();
    const knownAffs = ['google', 'meta', 'facebook', 'deepmind', 'openai', 'anthropic', 'mistral', 'stripe', 'apple', 'microsoft', 'inria', 'inserm', 'cnrs', 'mit', 'stanford', 'harvard', 'berkeley', 'cambridge', 'oxford', 'eth', 'epfl'];
    for (const aff of knownAffs) {
      if (bg.includes(aff)) { hint = aff; break; }
    }
    return await gatherFounderRealData(founder.name, hint);
  });

  const realData: FounderRealData[] = await Promise.all(realDataPromises);

  // ÉTAPE 2 : Construire le résumé des données vérifiées
  const realDataSummary = realData.map(rd => {
    const v = rd.verifiableFacts;
    let s = `\n--- ${rd.name} ---\n`;
    s += `Sources interrogées : ${rd.sourcesQueried.join(', ')}\n`;
    s += `Sources avec résultats : ${rd.sourcesFound.join(', ') || 'AUCUNE'}\n`;

    if (rd.openalex) {
      s += `OpenAlex : ${v.openalex_pubs} publications, h-index ${v.openalex_h_index}, ${v.openalex_citations} citations\n`;
      s += `Institutions : ${v.openalex_institutions.join(' / ') || 'non renseigné'}\n`;
      if (rd.recentPublications && rd.recentPublications.length > 0) {
        s += `Publications récentes :\n`;
        rd.recentPublications.forEach(p => {
          s += `  - ${p.title} (${p.year}, ${p.cited_by} cit.)\n`;
        });
      }
    }
    if (rd.github) {
      s += `GitHub : @${v.github_login}, ${v.github_followers} followers, ${v.github_repos} repos\n`;
      if (rd.topRepos && rd.topRepos.length > 0) {
        s += `Top repos :\n`;
        rd.topRepos.forEach(r => {
          s += `  - ${r.name} (${r.stars}★, ${r.language || '?'})\n`;
        });
      }
    }
    if (rd.wikipedia) {
      s += `Wikipedia (${rd.wikipedia.lang}) : ${rd.wikipedia.title}\n`;
      s += `Extrait : ${rd.wikipedia.extract.slice(0, 250)}\n`;
    }
    if (rd.arxivRecent && rd.arxivRecent.length > 0) {
      s += `arXiv récents : ${rd.arxivRecent.length}\n`;
      rd.arxivRecent.forEach(p => {
        s += `  - ${p.title.slice(0, 80)} (${p.published})\n`;
      });
    }
    s += `Scores objectifs : Sci ${rd.objectiveScores.scientific_signature}/100, Tech ${rd.objectiveScores.technical_signature}/100, Public ${rd.objectiveScores.public_presence}/100, Activité ${rd.objectiveScores.recent_activity}/100\n`;
    return s;
  }).join('\n');

  const userPrompt = `# DONNÉES DÉCLARÉES (extraction du pitch deck)
Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}
Année fondation : ${extraction.yearFounded}

Fondateurs déclarés :
${extraction.founders.map(f => `- ${f.name} (${f.role}) : ${f.background}`).join('\n')}

Pitch : ${extraction.marketPitch}
Produit : ${extraction.productDescription}

# DONNÉES VÉRIFIÉES (interrogation de sources publiques en temps réel)
${realDataSummary}

Croise déclaré et vérifié pour produire l'analyse au format JSON structuré demandé.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 3500);
  const analysis = parseJSON<TeamAnalysisOutput>(rawResponse);

  return { ...analysis, realData };
}
