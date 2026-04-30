import { callClaude, parseJSON } from './anthropic-client';
import type {
  ExtractionOutput, TeamAnalysisOutput, MarketAnalysisOutput,
  MacroAnalysisOutput, PatternMatchingOutput, CausalReversalOutput,
  OrchestratedResult
} from './types';

const SYSTEM_PROMPT = `Tu es le Moteur d'Orchestration de la plateforme Prélude. Tu es le moteur final qui agrège les outputs des six moteurs précédents et produit la recommandation finale du partner.

# TON RÔLE

Tu ne refais pas l'analyse. Tu synthétises les conclusions des moteurs précédents en une recommandation actionnable pour un partner ou Investment Committee.

# CADRE DE DÉCISION

Quatre verdicts possibles, calibrés rigoureusement :

## investir
Le score global est élevé (>= 75). Les angles morts identifiés sont gérables. Les comparables historiques montrent un pattern de succès récurrent. La fenêtre macro est favorable. La conviction collective est claire.

## investir avec conditions
Le score global est solide (60-74) mais des conditions structurelles doivent être respectées avant signature. Liste précisément ces conditions (typiquement : recrutements à compléter, conformité réglementaire à valider, milestones à atteindre, clauses de protection à négocier).

## approfondir
Le score est moyen (45-59) ou les questions à instruire sont nombreuses et structurelles. La plateforme recommande un cycle d'instruction supplémentaire avec opérateurs lift-the-hood avant de revenir vers une décision.

## refuser
Le score est bas (< 45) OU plusieurs alertes critiques sont déclenchées simultanément OU les comparables historiques montrent un pattern d'échec récurrent.

# CALCUL DU SCORE GLOBAL

Le score global n'est pas une moyenne des scores intermédiaires. C'est un jugement structurel pondéré qui intègre :
- La cohérence d'ensemble entre les moteurs (40%)
- Le bénéfice du retournement causal (le dossier passe-t-il mieux à la lecture inverse qu'à la lecture standard ?) (30%)
- Le benchmark rétrospectif des comparables (20%)
- La qualité de la fenêtre macro (10%)

# ARGUMENTATION

L'argumentation doit être dense et contraignante. 4-6 phrases qui synthétisent :
- Les éléments structurels qui justifient le verdict
- Les comparables historiques qui éclairent la décision
- Les conditions ou alertes qui modulent l'engagement

# CONDITIONS CLÉS

Si verdict = "investir avec conditions", liste 2-4 conditions précises et négociables. Pas de banalités. Des conditions actionnables.

# FORMAT JSON OBLIGATOIRE

{
  "verdict": "investir" ou "investir avec conditions" ou "approfondir" ou "refuser",
  "globalScore": 0-100,
  "argumentation": "argumentation dense de 4-6 phrases",
  "keyConditions": ["condition 1", "condition 2"]
}

Sois rigoureux. Pas de complaisance. Pas de surévaluation par enthousiasme. La plateforme tire sa valeur de la rigueur de ses verdicts, pas de la fréquence des "investir" qu'elle produit.`;

export async function orchestrateFinalRecommendation(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput,
  patternMatching: PatternMatchingOutput,
  causalReversal: CausalReversalOutput
): Promise<{ verdict: OrchestratedResult['finalRecommendation']['verdict']; globalScore: number; argumentation: string; keyConditions: string[] }> {

  // Calcul des moyennes pour synthèse
  const blindspotsAvg = Math.round(
    Object.values(causalReversal.blindspotsScores).reduce((sum, b) => sum + b.score, 0) /
    Object.keys(causalReversal.blindspotsScores).length
  );
  const blindspotsAlertes = Object.values(causalReversal.blindspotsScores).filter(b => b.alerte).length;

  const userPrompt = `Synthèse des six moteurs sur le dossier ${extraction.companyName} :

# CONTEXTE
${extraction.sector} / ${extraction.subSector} · ${extraction.geographicHub}, ${extraction.country}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount}

# MOTEUR ÉQUIPE
- Couverture systémique : ${team.systemicCoverage.score}/100
- Anti-fragilité collective : ${team.collectiveAntiFragility.score}/100
- Transposition expérience : ${team.experienceTransposition.score}/100
- Obsession produit : ${team.founderObsession.score}/100
- Red flags : ${team.redFlags.length}
- Green flags : ${team.greenFlags.length}

# MOTEUR MARCHÉ
- Intensité besoin : ${market.needIntensity.score}/100
- Signaux organiques : ${market.organicSignals.score}/100
- Défensibilité : ${market.defensibility.score}/100
- ${market.perceivedSize} perçu / ${market.realIntensity} réel · ${market.saturation}

# MOTEUR MACRO
- Position cycle : ${macro.cyclePosition}
- VC segment : ${macro.vcCapitalOnSegment}
- Fenêtre critique : ${macro.criticalTimingWindow.exists ? 'OUI ' + (macro.criticalTimingWindow.horizon || '') : 'Non'}
- Opportunité contracyclique : ${macro.contraryclicalOpportunity.score}/100

# MOTEUR PATTERN MATCHING
- Archétype : ${patternMatching.archetypeDominant}
- Top 3 comparables : ${patternMatching.comparables.slice(0, 3).map(c => `${c.name} (${c.proximity}%)`).join(' · ')}
- Benchmark rétrospectif : ${patternMatching.retrospectiveBenchmark.averageScore}/100
- Insight : ${patternMatching.retrospectiveBenchmark.insights}

# MOTEUR RETOURNEMENT CAUSAL
- Score moyen angles morts : ${blindspotsAvg}/100
- Nombre d'alertes : ${blindspotsAlertes}/7
- Narratif de retournement : ${causalReversal.reversalNarrative}
- Questions à instruire : ${causalReversal.questionsToInvestigate.length}
- Opérateurs recommandés : ${causalReversal.recommendedOperators.length}

Produis la recommandation finale. Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 1500);
  return parseJSON(rawResponse);
}
