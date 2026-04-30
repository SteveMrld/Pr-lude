import { callClaude, parseJSON } from './anthropic-client';
import { CORPUS, type CaseRecord } from '../corpus/database';
import type { ExtractionOutput, TeamAnalysisOutput, MarketAnalysisOutput, MacroAnalysisOutput, PatternMatchingOutput } from './types';

// Calcul algorithmique de proximité structurelle entre dossier et cas du corpus
function computeStructuralProximity(
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput,
  caseRec: CaseRecord
): number {
  let score = 0;
  let maxScore = 0;

  // Match équipe (poids 30%)
  if (team.foundersCount === caseRec.teamProfile.foundersCount) score += 6;
  else if (Math.abs(team.foundersCount - caseRec.teamProfile.foundersCount) === 1) score += 3;
  maxScore += 6;

  if (team.pedigreeCanonical === caseRec.teamProfile.pedigreeCanonical) score += 6;
  maxScore += 6;

  if (team.averageAge === caseRec.teamProfile.averageAge) score += 6;
  maxScore += 6;

  if (team.sectorExperience === caseRec.teamProfile.sectorExperience) score += 6;
  maxScore += 6;

  if (team.riskTaken === caseRec.teamProfile.riskTaken) score += 6;
  maxScore += 6;

  // Match marché (poids 35%)
  if (market.perceivedSize === caseRec.marketProfile.perceivedSize) score += 8;
  maxScore += 8;

  if (market.realIntensity === caseRec.marketProfile.realIntensity) score += 8;
  maxScore += 8;

  if (market.saturation === caseRec.marketProfile.saturation) score += 7;
  maxScore += 7;

  // Match macro (poids 35%)
  if (macro.cyclePosition === caseRec.macroAtRefusal.cyclePosition) score += 12;
  else if (
    (macro.cyclePosition === 'pre-bascule' && caseRec.macroAtRefusal.cyclePosition === 'bascule') ||
    (macro.cyclePosition === 'bascule' && caseRec.macroAtRefusal.cyclePosition === 'pre-bascule')
  ) score += 6;
  maxScore += 12;

  if (macro.vcCapitalOnSegment === caseRec.macroAtRefusal.vcCapital) score += 10;
  maxScore += 10;

  return Math.round((score / maxScore) * 100);
}

const SYSTEM_PROMPT = `Tu es le Moteur de Pattern Matching de la plateforme Prélude. Tu reçois les outputs des moteurs précédents (extraction, équipe, marché, macro) ainsi qu'une présélection de cas du corpus calculée algorithmiquement par proximité structurelle. Tu produis l'identification de l'archétype dominant du dossier et tu raffines les comparables historiques en explicitant les analogies structurelles précises et les divergences.

# CADRE DES CINQ ARCHÉTYPES

1. INTERPRÉTATIF · le filtre dominant est qu'un secteur ou segment est classé hors thèse par défaut de cadre macro. Pas de mauvais jugement individuel, un cadre interprétatif manquant. Cas type : Helsing 2021 (défense EU), Airbnb 2008 (économie du partage non nommée), Uber 2009 (mobilité régulée), Spotify 2006 (industrie en transition), Facebook 2004 (réseau social pro).

2. PROFONDEUR D'INSTRUCTION · l'intensité de besoin est mesurable mais non mesurée par DD rapide. Le screening rapide rate ce que la lecture longue révèle. Cas type : Doctolib (intensité patient), Zoom (saturation vs mal servi), Dropbox (fluidité), Shopify (longue traîne).

3. CAPACITÉ OPÉRATIONNELLE · vélocité, ticket ou cadre interprétatif insuffisants pour leader. Pas un mauvais jugement, une incompatibilité structurelle. Cas type : Mistral, Stripe, Hugging Face, Datadog.

4. CUMULÉ MOYEN TERME · plusieurs filtres défavorables cumulés sur 5-10 ans. Cas type : Quantum Systems, Slack, Alan, PayFit, Adyen, LinkedIn.

5. CUMULÉ LONG TERME · construction patiente sur plus d'une décennie hors radar VC. Cas type : Tekever, OVHcloud, Believe, UiPath.

# PATTERNS TRANSVERSAUX

Liste de patterns récurrents que tu peux invoquer :
- defense-eu-pre-ukraine
- saturation-vs-mal-servi
- niche-vers-massif
- mafia-paypal
- migration-fr-vers-us
- fondateurs-tres-jeunes
- patience-longitudinale
- geographie-marges-eu
- barriere-reglementaire-protectrice
- categorie-emergente-non-reconnue
- transposition-experience-secteurs-analogues
- crise-comme-fenetre
- defaut-leadership-eu
- pivot-success
- cadre-dirigeant-leader

# TON TRAVAIL

À partir des inputs fournis et des cas présélectionnés algorithmiquement :
1. Identifie l'archétype dominant du dossier (peut être un mélange, choisis le dominant)
2. Sélectionne les 3 meilleurs comparables parmi les cas présélectionnés (et ajoute des cas du corpus complet si nécessaire)
3. Pour chaque comparable, explicite l'analogie structurelle précise et les divergences
4. Identifie les patterns transversaux qui s'appliquent au dossier
5. Calcule un benchmark rétrospectif basé sur les cas du corpus avec patterns similaires

# FORMAT JSON OBLIGATOIRE

{
  "archetypeDominant": "interpretive" ou "depth" ou "capacity" ou "cumulative-mid" ou "cumulative-long",
  "archetypeRationale": "phrase qui justifie le choix d'archétype",
  "comparables": [
    {
      "caseId": "id du cas (helsing, doctolib, etc.)",
      "name": "nom",
      "year": année,
      "proximity": 0-100 (raffine la proximité algorithmique avec ton jugement structurel),
      "structuralAnalogy": "phrase précise sur l'analogie structurelle",
      "sharedPatterns": ["patterns partagés"],
      "divergences": ["points où le dossier diverge du cas"]
    }
  ],
  "matchingPatterns": ["patterns transversaux qui s'appliquent au dossier"],
  "retrospectiveBenchmark": {
    "averageScore": moyenne des retrospectiveScore des 3 comparables,
    "successRate": "phrase qui qualifie le taux de succès des cas comparables",
    "insights": "phrase qui synthétise ce que les comparables nous apprennent sur ce dossier"
  }
}`;

export async function matchPatterns(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput
): Promise<PatternMatchingOutput> {

  // Pré-sélection algorithmique : top 8 cas par proximité structurelle
  const scored = CORPUS.map(c => ({
    case: c,
    proximity: computeStructuralProximity(team, market, macro, c),
  }));
  scored.sort((a, b) => b.proximity - a.proximity);
  const top8 = scored.slice(0, 8);

  const userPrompt = `Données d'extraction du dossier :

Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}
Année fondation : ${extraction.yearFounded}

Output Moteur Équipe :
${JSON.stringify({
  foundersCount: team.foundersCount,
  pedigreeCanonical: team.pedigreeCanonical,
  averageAge: team.averageAge,
  sectorExperience: team.sectorExperience,
  riskTaken: team.riskTaken,
  systemicCoverageScore: team.systemicCoverage.score,
  greenFlags: team.greenFlags,
  redFlags: team.redFlags,
}, null, 2)}

Output Moteur Marché :
${JSON.stringify({
  perceivedSize: market.perceivedSize,
  realIntensity: market.realIntensity,
  saturation: market.saturation,
  needIntensityScore: market.needIntensity.score,
  defensibilityScore: market.defensibility.score,
}, null, 2)}

Output Moteur Macro :
${JSON.stringify({
  cyclePosition: macro.cyclePosition,
  vcCapitalOnSegment: macro.vcCapitalOnSegment,
  contraryclicalOpportunityScore: macro.contraryclicalOpportunity.score,
  criticalTimingWindow: macro.criticalTimingWindow,
}, null, 2)}

# Cas du corpus présélectionnés algorithmiquement (top 8 par proximité structurelle) :

${top8.map(s => `- ${s.case.id} (${s.case.name}, ${s.case.yearOfRefusal}, ${s.case.country}) · proximité algorithmique ${s.proximity}% · archétype ${s.case.archetype} · patterns ${s.case.comparablePatterns.join(', ')} · score rétrospectif ${s.case.retrospectiveScore}`).join('\n')}

Identifie l'archétype dominant et raffine les 3 meilleurs comparables. Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 2000);
  return parseJSON<PatternMatchingOutput>(rawResponse);
}
