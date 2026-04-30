import { callClaude, parseJSON } from './anthropic-client';
import type {
  ExtractionOutput, TeamAnalysisOutput, MarketAnalysisOutput,
  MacroAnalysisOutput, PatternMatchingOutput, CausalReversalOutput
} from './types';

const SYSTEM_PROMPT = `Tu es le Moteur de Retournement Causal de la plateforme Prélude. C'est le moteur final analytique avant l'orchestration. Tu reçois les outputs de tous les moteurs précédents et tu produis :
1. Le scoring détaillé des sept angles morts
2. Les questions précises à instruire avant décision
3. Les opérateurs lift-the-hood à mobiliser
4. Les proxies quantitatifs à calculer
5. Le narratif de retournement causal

# LES SEPT ANGLES MORTS

## 1. Maturité d'exécution
La qualité d'exécution réelle est-elle correctement lue, ou masquée par défaut de pedigree canonique ?
Score haut = exécution forte démontrable indépendamment du pedigree.
Score bas = exécution faible OU exécution forte non lisible par filtres standards.
Alerte si l'écart entre exécution réelle et lecture pedigree-canonique est élevé.

## 2. Intensité du besoin client
L'intensité réelle du besoin est-elle mesurée, ou seulement la taille apparente ?
Score haut = intensité extreme mesurable, pattern niche-vers-massif possible.
Score bas = intensité faible OU intensité forte mais marché perçu trop petit.
Alerte si pattern Doctolib/Shopify/Stripe (intensité sous-évaluée).

## 3. Distribution acquise
L'équipe dispose-t-elle de distribution préalable invisible aux KPIs standards (réseau, communauté, signature institutionnelle) ?
Score haut = distribution latente forte mesurable.
Score bas = pas de distribution préalable identifiable.
Alerte si distribution forte mais non valorisée dans le pitch.

## 4. Anti-fragilité
L'équipe a-t-elle démontré une capacité à fonctionner sous contrainte, à traverser un échec, à prendre des risques de carrière non triviaux ?
Score haut = anti-fragilité collective ou individuelle démontrée.
Score bas = pas de signal d'anti-fragilité.
Alerte si anti-fragilité forte mais perçue comme amateurisme par filtre standard (cas Airbnb, Slack).

## 5. Cohérence narrative
La cohérence entre vision affichée et choix d'exécution observables est-elle forte ou faible ?
Score haut = recrutements alignés, décisions stratégiques cohérentes, communication stable.
Score bas = incohérences observables.
Alerte si cohérence forte mais lue comme inflation rhétorique (cas Helsing avec thèse politique).

## 6. Signaux organiques
Les signaux organiques (viralité, bouche-à-oreille, communautés spontanées) confirment-ils ou contredisent les KPIs présentés ?
Score haut = signaux organiques forts mesurables.
Score bas = pas de signaux organiques OU contradiction avec KPIs.
Alerte si signaux organiques forts mais non instrumentés dans le pitch.

## 7. Timing contracyclique
Le timing macro est-il favorable, et le filtre macro standard ne masque-t-il pas une opportunité contracyclique ?
Score haut = timing favorable ou contracyclique fort.
Score bas = timing défavorable.
Alerte si opportunité contracyclique forte mais non lisible par filtre standard (cas Airbnb 2008, Helsing pré-Ukraine).

# QUESTIONS À INSTRUIRE

Génère 3 à 5 questions précises et actionnables que le partner devrait instruire AVANT décision. Pas des banalités. Des questions calibrées sur les zones d'incertitude réelle du dossier.

# OPÉRATEURS LIFT-THE-HOOD

Recommande 2 à 4 profils d'opérateurs lift-the-hood (experts sectoriels, ex-cadres dirigeants, scientifiques, anciens fondateurs) à mobiliser pour qualifier les zones d'incertitude. Précise leur mission spécifique et la durée estimée.

# PROXIES À CALCULER

Liste les proxies quantitatifs que la plateforme devrait calculer pour ce dossier (cohorte de rétention, signaux organiques mesurables, etc.).

# NARRATIF DE RETOURNEMENT

Synthèse en 3-4 phrases denses : si ce dossier réussit, ce sera grâce à quoi ? Si ce dossier rate, ce sera à cause de quoi ? Cette synthèse doit retourner causalement le pitch standard pour exposer ce que les filtres standards ne voient pas.

# FORMAT JSON OBLIGATOIRE

{
  "blindspotsScores": {
    "maturiteExecution": { "score": 0-100, "lecture": "phrase", "alerte": true ou false },
    "intensiteBesoin": { "score": 0-100, "lecture": "phrase", "alerte": true ou false },
    "distributionAcquise": { "score": 0-100, "lecture": "phrase", "alerte": true ou false },
    "antiFragilite": { "score": 0-100, "lecture": "phrase", "alerte": true ou false },
    "coherenceNarrative": { "score": 0-100, "lecture": "phrase", "alerte": true ou false },
    "signauxOrganiques": { "score": 0-100, "lecture": "phrase", "alerte": true ou false },
    "timingContracyclique": { "score": 0-100, "lecture": "phrase", "alerte": true ou false }
  },
  "questionsToInvestigate": ["question 1", "question 2", "question 3", "question 4", "question 5"],
  "recommendedOperators": [
    { "profile": "type d'opérateur", "mission": "mission précise", "estimatedDuration": "durée estimée" }
  ],
  "proxiesToCalculate": ["proxy 1", "proxy 2"],
  "reversalNarrative": "narratif dense de 3-4 phrases"
}

Sois rigoureux. Le score d'un angle mort n'est pas une moyenne, c'est un jugement structurel. L'alerte se déclenche quand le pattern d'angle mort historique du corpus est susceptible de se rejouer.`;

export async function performCausalReversal(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput,
  patternMatching: PatternMatchingOutput
): Promise<CausalReversalOutput> {

  const userPrompt = `Données consolidées du dossier ${extraction.companyName} :

# Extraction
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount}

# Équipe
Couverture systémique : ${team.systemicCoverage.score}/100 - ${team.systemicCoverage.rationale}
Anti-fragilité collective : ${team.collectiveAntiFragility.score}/100 - ${team.collectiveAntiFragility.rationale}
Transposition d'expérience : ${team.experienceTransposition.score}/100
Obsession produit : ${team.founderObsession.score}/100
Pedigree canonique : ${team.pedigreeCanonical}
Green flags : ${team.greenFlags.join(' | ')}
Red flags : ${team.redFlags.join(' | ')}

# Marché
Taille perçue / Intensité réelle : ${market.perceivedSize} / ${market.realIntensity}
Saturation : ${market.saturation}
Score signaux organiques : ${market.organicSignals.score}/100
Score intensité besoin : ${market.needIntensity.score}/100
Score défensibilité : ${market.defensibility.score}/100
Moats : ${market.defensibility.moats.join(', ')}
Vulnérabilités : ${market.defensibility.vulnerabilities.join(', ')}

# Macro
Position cycle : ${macro.cyclePosition}
Capital VC segment : ${macro.vcCapitalOnSegment}
Fenêtre critique : ${macro.criticalTimingWindow.exists ? 'OUI - ' + (macro.criticalTimingWindow.horizon || '') : 'Non'}
Score opportunité contracyclique : ${macro.contraryclicalOpportunity.score}/100

# Pattern Matching
Archétype dominant : ${patternMatching.archetypeDominant}
Comparables identifiés :
${(patternMatching.comparables || []).map(c => `- ${c.name} (${c.year}) · proximité ${c.proximity}% · ${c.structuralAnalogy}`).join('\n')}
Patterns transversaux : ${(patternMatching.matchingPatterns || []).join(' | ')}
Benchmark rétrospectif : ${patternMatching.retrospectiveBenchmark.averageScore}/100 · ${patternMatching.retrospectiveBenchmark.insights}

Produis le retournement causal complet. Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 3500);
  return parseJSON<CausalReversalOutput>(rawResponse);
}
