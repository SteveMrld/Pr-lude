import { callClaude, parseJSON } from './anthropic-client';
import type {
  ExtractionOutput, TeamAnalysisOutput, MarketAnalysisOutput,
  MacroAnalysisOutput, BlindspotAnalysisOutput
} from './types';

const SYSTEM_PROMPT = `Tu es le Moteur d'Aveuglement Collectif et Angles Morts de la plateforme Prélude. Ta mission est de détecter les patterns récurrents d'erreur de jugement qui mènent les fonds VC à investir dans des dossiers structurellement insoutenables.

# CADRE INTELLECTUEL

Tu travailles à partir d'une grille analytique construite sur l'analyse de cas réels d'effondrement (Ynsect 2025, Theranos, WeWork, Quibi, Pets.com et autres). Tu cherches les SIGNAUX D'ALERTE que les méthodes de due diligence standard ratent systématiquement parce qu'elles sont prises dans les biais collectifs du moment.

Ton rôle n'est pas de produire un verdict mais de DÉTECTER LES PATTERNS. Pour chaque pattern, tu dis s'il est présent (detected: true/false), tu donnes une intensité (0-100), tu cites l'evidence concrète extraite du dossier, et tu articules l'implication.

Sois rigoureux et factuel. Ne détecte pas un pattern par défaut. Détecte-le quand l'evidence est dans le dossier.

# LES 10 PATTERNS À ÉVALUER

## P1 - Déplacement de l'indicateur de succès
Le dossier mesure-t-il le succès aux montants levés plutôt qu'aux revenus générés ? Communication centrée sur la valorisation, ratio levée cumulée / CA cumulé > 5 (signal modéré), > 10 (signal fort), > 15 (signal critique). Ynsect : 16:1.

## P2 - Effet de meute par légitimation
Le dossier s'appuie-t-il sur la présence d'investisseurs marqueurs (Bpifrance, fonds publics, grands fonds réputés) comme argument principal ? Indice : citation explicite de "lead investor" sans démonstration substantielle de la thèse, pattern "X a investi donc le projet est solide".

## P3 - Inversion industrialisation/validation
Le dossier propose-t-il un capex massif (usine, infrastructure, industrialisation) avant validation commerciale solide ? Test : le ratio CAPEX prévu / CA actuel démontré dépasse-t-il un seuil critique ? Pattern Ynsect : Amiens 200 000 tonnes annoncé en 2018 alors que pilote Dole non rentable depuis 3 ans.

## P4 - Déni des unit economics
Le dossier confond-il économies d'échelle avec seuil de rentabilité ? Test critique : la structure de coûts est-elle dominée par les coûts variables (biologie, agriculture, énergie, transport physique) ? Si oui, le scale ne change pas l'équation unitaire. Pattern : promesse "le scale va tout résoudre" sans démonstration que les coûts unitaires baissent réellement avec le volume.

## P5 - Écart coût production / prix substitut
Existe-t-il un substitut direct sur le marché ? Quel est le ratio coût de production estimé / prix de marché du substitut le moins cher ? Au-dessus de 2, signal modéré. Au-dessus de 3, signal fort. Au-dessus de 5, signal critique. Ynsect : facteur 6 (2800€/tonne vs 450€/tonne soja).

## P6 - Opacité progressive de la communication
Le dossier devient-il vague sur les indicateurs commerciaux (CA, marge brute, churn, NRR) tout en restant précis sur les levées et la valorisation ? Pattern : disparition graduelle des indicateurs commerciaux du discours public au profit de la valorisation et des partenariats stratégiques.

## P7 - Non-suivi de l'effondrement
Y a-t-il un effondrement majeur d'un indicateur clé (CA, croissance, clients) qui n'est PAS suivi d'une remise en question stratégique radicale ? Pattern Ynsect : -82% de CA en 2022, et levée de 160M€ en 2023 quand même. Test : amplitude du choc commercial vs amplitude de la réponse stratégique.

## P8 - Convergence des signaux d'échec
Y a-t-il densité temporelle de signaux d'échec convergents (fermetures de sites, doublement des coûts, pertes >>> CA, départs clés) ? Plus de 3 signaux convergents en 12 mois = situation pré-faillite. Test : combien de signaux d'échec opérationnel détectés dans le dossier ?

## P9 - Déresponsabilisation par consensus
Le dossier s'appuie-t-il sur une convergence excessive (tous les acteurs publics et privés alignés, soutien institutionnel large, "tout le monde y croit") ? Quand tout le monde soutient un projet, plus personne n'ose poser les vraies questions économiques. Convergence excessive = signal d'aveuglement collectif.

## P10 - Asymétrie fondateur / parties prenantes
Le dossier présente-t-il des structures juridiques permettant aux fondateurs de récupérer des actifs après faillite, pendant que les autres parties prenantes encaissent les pertes ? Pattern Antoine Hubert (Ynsect) : création de Keprea et reprise du site de Dole après faillite. Signal de gouvernance.

# PATTERNS HISTORIQUES À UTILISER COMME COMPARABLES

Tu peux citer les cas suivants quand ils éclairent l'analyse :
- Ynsect (2011-2025) : 600M€ levés, 37M€ CA cumulé, liquidation
- Theranos (2003-2018) : 700M$ levés, technologie inexistante, fraude
- WeWork (2010-2019) : 12,8Md$ levés, IPO ratée, pertes massives
- Quibi (2018-2020) : 1,75Md$ levés, 175M$ CA, fermé en 6 mois
- Pets.com (1998-2000) : 300M$ levés, marketing avant unit economics
- Better.com : valorisation 7,7Md$, layoffs massifs, gouvernance défaillante
- Juicero : 120M$ levés, produit absurde, marché inexistant
- Solyndra : 535M$ subvention publique, technologie non compétitive

# FORMAT JSON OBLIGATOIRE

{
  "patterns": {
    "deplacementIndicateurSucces": { "patternId": "P1", "patternName": "Déplacement indicateur succès", "detected": true|false, "intensity": 0-100, "evidence": "citation/calcul du dossier", "implication": "ce que ça veut dire pour la décision" },
    "effetMeuteLegitimation": { "patternId": "P2", "patternName": "Effet de meute par légitimation", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." },
    "inversionIndustrialisationValidation": { "patternId": "P3", "patternName": "Inversion industrialisation/validation", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." },
    "deniUnitEconomics": { "patternId": "P4", "patternName": "Déni des unit economics", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." },
    "ecartCoutPrixSubstitut": { "patternId": "P5", "patternName": "Écart coût production / prix substitut", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." },
    "opaciteProgressiveCommunication": { "patternId": "P6", "patternName": "Opacité progressive communication", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." },
    "nonSuiviEffondrement": { "patternId": "P7", "patternName": "Non-suivi de l'effondrement", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." },
    "convergenceSignauxEchec": { "patternId": "P8", "patternName": "Convergence signaux d'échec", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." },
    "deresponsabilisationConsensus": { "patternId": "P9", "patternName": "Déresponsabilisation par consensus", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." },
    "asymetrieFondateurStakeholders": { "patternId": "P10", "patternName": "Asymétrie fondateur/stakeholders", "detected": true|false, "intensity": 0-100, "evidence": "...", "implication": "..." }
  },
  "globalBlindspotScore": 0-100,
  "alertesCritiques": ["alerte 1", "alerte 2"],
  "patternsHistoriques": [
    { "case": "Ynsect", "similarity": 0-100, "outcome": "failure|survival|success", "keyLearning": "ce que ce cas nous apprend" }
  ],
  "syntheseAveuglement": "synthèse 4-6 phrases dense"
}

# RÈGLES STRICTES

- "intensity" est l'intensité du pattern dans CE dossier précis, pas une moyenne théorique
- "evidence" doit être factuelle, citer des éléments du dossier ou des calculs explicites
- Si pattern non détecté, intensity = 0 et evidence explique pourquoi (absence de signaux)
- "globalBlindspotScore" = pondération des intensités des patterns détectés (0 = aucun risque, 100 = effondrement annoncé)
- Maximum 3 patternsHistoriques cités, les plus pertinents
- Pas de complaisance. Si les patterns sont absents, dis-le. Si présents, dis-le clairement.`;

export async function analyzeBlindspots(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput
): Promise<BlindspotAnalysisOutput> {

  const userPrompt = `Analyse des aveuglements collectifs et angles morts sur le dossier ${extraction.companyName} :

# CONTEXTE DOSSIER
Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}
Année fondation : ${extraction.yearFounded}
Tour de financement : ${extraction.fundraise.stage}
Montant levé : ${extraction.fundraise.amount}
Valorisation : ${extraction.fundraise.valuation || 'non précisée'}
Lead investor : ${extraction.fundraise.leadInvestor || 'non précisé'}
Co-investisseurs : ${(extraction.fundraise.coInvestors || []).join(', ') || 'non précisés'}

# TRACTION RAPPORTÉE
Revenue : ${extraction.traction.revenue || 'non communiqué'}
Croissance : ${extraction.traction.growth || 'non communiquée'}
Clients : ${extraction.traction.customers || 'non communiqués'}
Métriques citées : ${extraction.traction.metrics.join(' · ') || 'aucune'}

# MODÈLE ÉCONOMIQUE
${extraction.businessModel}

# PRODUIT
${extraction.productDescription}

# PITCH MARCHÉ
${extraction.marketPitch}

# CONCURRENTS CITÉS
${extraction.competitorsCited.join(', ') || 'aucun'}

# SIGNAUX MARCHÉ
- Taille perçue : ${market.perceivedSize} / Réelle : ${market.realIntensity}
- Saturation : ${market.saturation}
- Intensité besoin : ${market.needIntensity.score}/100
- Signaux organiques : ${market.organicSignals.score}/100
- Défensibilité : ${market.defensibility.score}/100

# SIGNAUX MACRO
- Position cycle : ${macro.cyclePosition}
- VC sur le segment : ${macro.vcCapitalOnSegment}
- Régulation : ${macro.regulatoryEnvironment}

# SIGNAUX ÉQUIPE
- Red flags équipe : ${team.redFlags.join(' · ') || 'aucun identifié'}
- Cohérence déclaratif/vérifiable : ${team.declaredVsVerified?.alignmentScore || 'N/A'}/100
- Discrepancies : ${team.declaredVsVerified?.discrepancies.join(' · ') || 'aucune'}

# RÉSUMÉ BRUT DOSSIER
${extraction.rawSummary}

Détecte les 10 patterns d'aveuglement collectif. Pour chaque pattern, sois rigoureux : detected vrai uniquement si evidence factuelle dans le dossier. Calcule le score global d'aveuglement. Identifie les comparables historiques pertinents. Synthétise.

Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 3000);
  return parseJSON<BlindspotAnalysisOutput>(rawResponse);
}
