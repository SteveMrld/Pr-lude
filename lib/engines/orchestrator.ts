import { callClaude, parseJSON } from './anthropic-client';
import type {
  ExtractionOutput, TeamAnalysisOutput, MarketAnalysisOutput,
  MacroAnalysisOutput, PatternMatchingOutput, CausalReversalOutput,
  BlindspotAnalysisOutput, ContrarianAnalysisOutput,
  OrchestratedResult
} from './types';

const SYSTEM_PROMPT = `Tu es le Moteur d'Orchestration de la plateforme Prélude. Tu es le moteur final qui agrège les outputs des huit moteurs précédents et produit la recommandation finale du partner avec PROBABILITÉS CHIFFRÉES PAR DIMENSION et résolution de la TENSION DIALECTIQUE entre signaux d'aveuglement et signaux de singularité.

# TON RÔLE

Tu ne refais pas l'analyse. Tu synthétises. Tu produis :
1. Une probabilité de succès et d'échec chiffrée
2. Un score décomposé par dimension avec probabilité et risque
3. Une résolution explicite de la tension entre moteur 12 (aveuglement) et moteur 13 (singularités)
4. Un verdict argumenté avec les facteurs décisifs

# CADRE DE DÉCISION AVEC SEUILS EXPLICITES

Quatre verdicts possibles, calibrés rigoureusement avec des SEUILS CHIFFRÉS :

## investir (score >= 75)
La probabilité de succès estimée est élevée. Les angles morts identifiés sont gérables ou contrebalancés par des signaux de singularité forts. Les comparables historiques montrent un pattern de succès récurrent. La fenêtre macro est favorable.

## investir avec conditions (60 <= score < 75)
La probabilité de succès est solide mais des conditions structurelles doivent être respectées avant signature. Liste précisément ces conditions.

## approfondir (45 <= score < 60)
Le score est moyen ou la tension blindspots/contrarian n'est pas résolue. La plateforme recommande un cycle d'instruction supplémentaire.

## refuser (score < 45)
Probabilité de succès trop faible. Plusieurs alertes critiques d'aveuglement déclenchées sans contrepoids contrarien suffisant.

# CALCUL DE LA PROBABILITÉ DE SUCCÈS

C'est un jugement structurel, pas une moyenne arithmétique. Tu prends en compte :

1. La SOLIDITÉ FONDAMENTALE (40%) : équipe + marché + macro + cohérence
2. La TENSION BLINDSPOTS/CONTRARIAN (35%) : si moteur 12 score est élevé (alertes nombreuses), ça pèse négativement, sauf si moteur 13 score contrarien est plus élevé encore (singularités justifient le pari)
3. Le BENCHMARK PATTERN MATCHING (15%) : taux de succès des comparables historiques
4. Le RETOURNEMENT CAUSAL (10%) : qualité de la lecture inverse

# PROBABILITÉS PAR DIMENSION

Tu produis une probabilité de succès et un risk score pour chacune des 6 dimensions :
1. Équipe (poids 0.20)
2. Marché (poids 0.22)
3. Macro / timing (poids 0.15)
4. Modèle économique (poids 0.13)
5. Singularités contrariennes (poids 0.15)
6. Aveuglement / risques (poids 0.15) - inversé : haut score blindspots = bas score risque maîtrisé

# RÉSOLUTION DE LA TENSION DIALECTIQUE

Trois résolutions possibles :

## blindspots-dominate
Les drapeaux rouges sont massifs et structurels. Aucun signal contrarien n'est suffisamment puissant pour les renverser. Ynsect en 2020 : unit economics cassés, écart prix x6 avec substitut. Signaux contrariens insuffisants. Décision : refuser ou approfondir.

## contrarian-justifies
Drapeaux rouges présents MAIS signaux contrariens singuliers et forts. Founder-market fit exceptionnel + thèse non-consensuelle articulée précisément + pattern historique contrarien analogue. Airbnb 2009 : pas de marché statistique, mais expertise design + early traction + conviction articulée. Décision : investir ou investir avec conditions.

## balanced-investigate
Tension non résolue. Les signaux des deux côtés s'équilibrent. Décision : approfondir.

# ARGUMENTATION

Dense, contraignante, 5-7 phrases qui synthétisent :
- Les éléments structurels qui justifient le verdict
- La résolution de la tension dialectique avec son raisonnement
- Les comparables historiques qui éclairent (mix de comparables standards et contrariens)
- Les conditions ou alertes qui modulent l'engagement
- Les facteurs décisifs (ce qui fait basculer la décision)

# CONDITIONS CLÉS ET DECISION DRIVERS

Si verdict = "investir avec conditions", liste 3-5 conditions précises et négociables, actionnables.
Pour TOUS les verdicts, identifie 3-5 decision drivers : les facteurs qui font basculer la décision dans un sens ou l'autre.

# FORMAT JSON OBLIGATOIRE

{
  "verdict": "investir" | "investir avec conditions" | "approfondir" | "refuser",
  "globalScore": 0-100,
  "successProbability": 0-100,
  "failureProbability": 0-100,
  "investmentThreshold": {
    "currentLevel": 0-100,
    "thresholdToInvest": 75,
    "thresholdToCondition": 60,
    "thresholdToInvestigate": 45
  },
  "dimensionProbabilities": [
    {
      "dimensionName": "Équipe",
      "successProbability": 0-100,
      "riskScore": 0-100,
      "weight": 0.20,
      "rationale": "1-2 phrases",
      "keyDrivers": ["driver 1", "driver 2"],
      "keyRisks": ["risque 1", "risque 2"]
    },
    { "dimensionName": "Marché", "weight": 0.22, ... },
    { "dimensionName": "Macro / timing", "weight": 0.15, ... },
    { "dimensionName": "Modèle économique", "weight": 0.13, ... },
    { "dimensionName": "Singularités contrariennes", "weight": 0.15, ... },
    { "dimensionName": "Aveuglement / risques", "weight": 0.15, ... }
  ],
  "blindspotsVsContrarian": {
    "blindspotsWeight": 0-100,
    "contrarianWeight": 0-100,
    "tensionResolved": "blindspots-dominate" | "contrarian-justifies" | "balanced-investigate",
    "resolution": "raisonnement 2-3 phrases"
  },
  "argumentation": "argumentation dense de 5-7 phrases",
  "keyConditions": ["condition 1 actionnable", "condition 2", ...],
  "decisionDrivers": ["facteur décisif 1", "facteur décisif 2", "facteur décisif 3"]
}

Sois rigoureux. Pas de complaisance. Pas de surévaluation par enthousiasme. La plateforme tire sa valeur de la rigueur de ses verdicts ET de la précision de ses probabilités chiffrées.

successProbability + failureProbability doit faire 100.`;

export async function orchestrateFinalRecommendation(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput,
  patternMatching: PatternMatchingOutput,
  causalReversal: CausalReversalOutput,
  blindspotAnalysis: BlindspotAnalysisOutput,
  contrarianAnalysis: ContrarianAnalysisOutput
): Promise<OrchestratedResult['finalRecommendation']> {

  const blindspotsAvg = Math.round(
    Object.values(causalReversal.blindspotsScores).reduce((sum, b) => sum + b.score, 0) /
    Object.keys(causalReversal.blindspotsScores).length
  );
  const blindspotsAlertes = Object.values(causalReversal.blindspotsScores).filter(b => b.alerte).length;

  const aveuglementPatternsDetected = Object.values(blindspotAnalysis.patterns).filter(p => p.detected).length;
  const aveuglementHighIntensity = Object.values(blindspotAnalysis.patterns).filter(p => p.detected && p.intensity >= 60).length;

  const contrarianSignalsDetected = Object.values(contrarianAnalysis.signals).filter(s => s.detected).length;
  const contrarianHighStrength = Object.values(contrarianAnalysis.signals).filter(s => s.detected && s.strength >= 60).length;

  const userPrompt = `Synthèse des 8 moteurs sur le dossier ${extraction.companyName} :

# CONTEXTE
${extraction.sector} / ${extraction.subSector} · ${extraction.geographicHub}, ${extraction.country}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount}
Valorisation : ${extraction.fundraise.valuation || 'non précisée'}

# MOTEUR ÉQUIPE
- Couverture systémique : ${team.systemicCoverage.score}/100
- Anti-fragilité : ${team.collectiveAntiFragility.score}/100
- Transposition expérience : ${team.experienceTransposition.score}/100
- Obsession fondateur : ${team.founderObsession.score}/100
- Red flags : ${team.redFlags.length} · Green flags : ${team.greenFlags.length}

# MOTEUR MARCHÉ
- Intensité besoin : ${market.needIntensity.score}/100
- Signaux organiques : ${market.organicSignals.score}/100
- Défensibilité : ${market.defensibility.score}/100
- ${market.perceivedSize} perçu / ${market.realIntensity} réel · ${market.saturation}

# MOTEUR MACRO
- Cycle : ${macro.cyclePosition}
- VC segment : ${macro.vcCapitalOnSegment}
- Fenêtre critique : ${macro.criticalTimingWindow.exists ? 'OUI ' + (macro.criticalTimingWindow.horizon || '') : 'Non'}
- Opportunité contracyclique : ${macro.contraryclicalOpportunity.score}/100

# MOTEUR PATTERN MATCHING
- Archétype : ${patternMatching.archetypeDominant}
- Top comparables : ${patternMatching.comparables.slice(0, 3).map(c => `${c.name} (${c.proximity}%)`).join(' · ')}
- Benchmark rétrospectif : ${patternMatching.retrospectiveBenchmark.averageScore}/100
- Insight : ${patternMatching.retrospectiveBenchmark.insights}

# MOTEUR RETOURNEMENT CAUSAL
- Score moyen angles morts (7 dimensions) : ${blindspotsAvg}/100
- Alertes : ${blindspotsAlertes}/7
- Narratif : ${causalReversal.reversalNarrative}

# MOTEUR AVEUGLEMENT (12)
- Score global aveuglement : ${blindspotAnalysis.globalBlindspotScore}/100
- Patterns détectés : ${aveuglementPatternsDetected}/10
- Patterns haute intensité : ${aveuglementHighIntensity}/10
- Alertes critiques : ${blindspotAnalysis.alertesCritiques.join(' · ') || 'aucune'}
- Patterns historiques : ${blindspotAnalysis.patternsHistoriques.map(p => `${p.case} (${p.outcome}, ${p.similarity}%)`).join(' · ')}
- Synthèse : ${blindspotAnalysis.syntheseAveuglement}

# MOTEUR SINGULARITÉS CONTRARIENNES (13)
- Score global contrarien : ${contrarianAnalysis.globalContrarianScore}/100
- Signaux détectés : ${contrarianSignalsDetected}/10
- Signaux haute force : ${contrarianHighStrength}/10
- Comparables contrariens : ${contrarianAnalysis.comparablesContrariens.map(c => `${c.name} (${c.outcome})`).join(' · ')}
- Synthèse : ${contrarianAnalysis.syntheseSingularite}
- Recommandation contrarienne : ${contrarianAnalysis.recommandationContrarienne}

# DÉTAILS PATTERNS AVEUGLEMENT (haute intensité uniquement)
${Object.values(blindspotAnalysis.patterns)
  .filter(p => p.detected && p.intensity >= 50)
  .map(p => `- ${p.patternName} (intensité ${p.intensity}/100) : ${p.evidence}`)
  .join('\n') || 'Aucun pattern haute intensité détecté'}

# DÉTAILS SIGNAUX CONTRARIENS (haute force uniquement)
${Object.values(contrarianAnalysis.signals)
  .filter(s => s.detected && s.strength >= 50)
  .map(s => `- ${s.signalName} (force ${s.strength}/100) : ${s.evidence}`)
  .join('\n') || 'Aucun signal contrarien fort détecté'}

Produis la recommandation finale avec :
1. Probabilité de succès chiffrée (et son inverse)
2. Score global avec seuils explicites
3. Probabilités par dimension (6 dimensions avec poids)
4. Résolution de la tension blindspots/contrarian
5. Argumentation dense
6. Conditions clés actionnables
7. Decision drivers (3-5 facteurs décisifs)

Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 5000);
  return parseJSON<OrchestratedResult['finalRecommendation']>(rawResponse);
}
