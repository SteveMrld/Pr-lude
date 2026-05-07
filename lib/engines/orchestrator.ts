import { callClaude, parseJSON, MODEL } from './anthropic-client';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from './source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from './editorial-voice';
import { buildFundNoteBlock } from './fund-context';
import type {
  ExtractionOutput, TeamAnalysisOutput, MarketAnalysisOutput,
  MacroAnalysisOutput, PatternMatchingOutput, CausalReversalOutput,
  BlindspotAnalysisOutput, ContrarianAnalysisOutput,
  OrchestratedResult
} from './types';
import { getRelevantPastAnnotations, formatPastAnnotationsForPrompt } from '../analysis-store';

const SYSTEM_PROMPT = `Tu es le Moteur d'Orchestration de la plateforme Prélude. Tu es le moteur final qui agrège les outputs des huit moteurs précédents et produit la recommandation finale du partner avec PROBABILITÉS CHIFFRÉES PAR DIMENSION et résolution de la TENSION DIALECTIQUE entre signaux de vigilance et signaux de singularité.
${SOURCE_TAGGING_INSTRUCTION}
${EDITORIAL_VOICE_INSTRUCTION}

# TON RÔLE

Tu ne refais pas l'analyse. Tu synthétises. Tu produis :
1. Une probabilité de succès et d'échec chiffrée
2. Un score décomposé par dimension avec probabilité et risque
3. Une résolution explicite de la tension entre moteur 12 (vigilance) et moteur 13 (singularités)
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
Probabilité de succès trop faible. Plusieurs alertes critiques de vigilance déclenchées sans contrepoids contrarien suffisant.

# CALCUL DE LA PROBABILITÉ DE SUCCÈS

C'est un jugement structurel, pas une moyenne arithmétique. Tu prends en compte :

1. La SOLIDITÉ FONDAMENTALE (40%) : équipe + marché + macro + cohérence
2. La TENSION BLINDSPOTS/CONTRARIAN (35%) : si moteur 12 score est élevé (alertes nombreuses), ça pèse négativement, sauf si moteur 13 score contrarien est plus élevé encore (singularités justifient le pari)
3. Le BENCHMARK PATTERN MATCHING (15%) : taux de succès des comparables historiques
4. Le RETOURNEMENT CAUSAL (10%) : qualité de la lecture inverse

# SCORE AUDITABLE - PRINCIPE DE COHERENCE

Apres ton output, le code recalcule mecaniquement un score a partir de tes dimensionProbabilities ponderees + un ajustement selon la tension blindspots/contrarian que tu as identifiee. Ce score mecanique est expose a cote du tien (computedScoreBreakdown). Si l ecart depasse 15 points, l UI affichera une alerte de divergence.

Tu n es pas oblige de coller au calcul mecanique : ton globalScore peut integrer des facteurs implicites (qualite du founder-market fit, signal de fenetre macro extreme, pattern historique tres proche) qui ne sont pas chiffres dans les dimensions. Mais tu dois etre conscient qu un ecart >15 points sera signale comme suspect.

REGLE PRATIQUE : si tu sens que ton globalScore diverge fortement de la moyenne ponderee des dimensions, c est probablement parce que tes dimensionProbabilities ne capturent pas l essentiel. Dans ce cas, REVISE les dimensionProbabilities pour qu elles refletent mieux ton jugement, plutot que de creer un ecart non auditable.

# PROBABILITÉS PAR DIMENSION

Tu produis une probabilité de succès et un risk score pour chacune des 6 dimensions :
1. Équipe (poids 0.20)
2. Marché (poids 0.22)
3. Macro / timing (poids 0.15)
4. Modèle économique (poids 0.13)
5. Singularités contrariennes (poids 0.15)
6. Vigilance critique / risques (poids 0.15) - inversé : haut score blindspots = bas score risque maîtrisé

# RÈGLES ANTI-CONVERGENCE - À LIRE AVANT DE SCORER

Une erreur classique est de calibrer tous tes scores autour de la valeur centrale du verdict (50 pour APPROFONDIR, 30 pour REFUSER, 70 pour INVESTIR AVEC CONDITIONS). C est de la paresse cognitive qui produit des scores indistinguables d un dossier à l autre.

**RÈGLE 1 - Différenciation des dimensions.** Tes 6 dimensionProbabilities DOIVENT refléter des nuances réelles. Si trois dimensions ou plus ont la même valeur ou des valeurs proches (écart <5 points), c est un signal que tu as sur-calibré et que tu n as pas vraiment évalué chaque axe. Attendu : amplitude minimum 25 points entre la dimension la plus faible et la plus forte. Exemple correct pour APPROFONDIR : Équipe 62, Marché 38, Macro 70, Modèle éco 28, Contrariens 55, Vigilance 35. Exemple incorrect : Équipe 50, Marché 52, Macro 48, Modèle éco 50, Contrariens 50, Vigilance 50.

**RÈGLE 2 - Plages par verdict, pas valeurs centrales.** Le verdict détermine une PLAGE de globalScore, pas une valeur unique :
  - REFUSER : 5 à 35 (pas systématiquement 22)
  - APPROFONDIR : 36 à 64 (pas systématiquement 50 ou 52)
  - INVESTIR AVEC CONDITIONS : 60 à 78 (pas systématiquement 72)
  - INVESTIR : 75 à 95 (pas systématiquement 85)

À l intérieur d une plage, le score doit refléter où le dossier se situe RÉELLEMENT, en se basant sur les nuances. Un APPROFONDIR penchant vers refuser est à 38-42. Un APPROFONDIR penchant vers investir est à 56-62. Un dossier au cœur de la zone d hésitation est à 45-55.

**RÈGLE 3 - Évitement des nombres ronds.** Les valeurs 50, 55, 60, 65, 70, 75 sont des heuristiques de paresse. Tes dimensionProbabilities et ton globalScore doivent utiliser des nombres qui reflètent un vrai calcul (37, 43, 51, 58, 64, etc. plutôt que 35, 40, 50, 55, 60, 65). Une exception : si la valeur ronde est intentionnelle et calibrée précisément (par exemple un score d équipe à exactement 50 parce que l évaluation est strictement neutre).

**RÈGLE 4 - Vérification finale.** Avant de finaliser ton output, relis tes dimensionProbabilities. Si tu vois plusieurs valeurs identiques ou un cluster autour de 50, RÉVISE-les pour qu elles reflètent le contraste réel entre dimensions. Le partner qui lit ta note doit voir au premier coup d œil quelles dimensions tirent le verdict vers le haut et lesquelles le tirent vers le bas.

# DIFFERENCIATION SCORE D ATTRACTIVITE vs PROBABILITE DE SUCCES

Tu produis deux chiffres distincts qui ne mesurent pas la meme chose. Une erreur frequente est de les aligner mecaniquement, ce qui les rend redondants et fait perdre l information clef au partner.

**globalScore (0-100)** : note d attractivite structurelle ponderee sur les six dimensions. Mesure ce que VAUT le dossier en lecture statique (qualite de l equipe, taille du marche, fenetre macro, modele eco, signaux contrariens, gestion des risques). C est une note de qualite intrinseque.

**successProbability (0-100)** : estimation de la probabilite REELLE de retour positif sur l investissement. Integre l incertitude residuelle face aux signaux contradictoires. Distinct du score parce qu un dossier peut avoir une excellente note structurelle mais une dialectique blindspots / contrarien non levee, ce qui maintient une zone d incertitude.

**Regle de calibration entre les deux** :

- Si tensionResolved = blindspots-dominate : successProbability << globalScore. Decote de 10 a 20 points selon l ampleur des drapeaux rouges. Exemple : globalScore 42, tension blindspots-dominate forte, successProbability 22-28.

- Si tensionResolved = balanced-investigate : successProbability < globalScore. Decote de 5 a 12 points qui reflete que l incertitude n est pas levee. Exemple : globalScore 55, tension balanced, successProbability 43-50.

- Si tensionResolved = contrarian-justifies : successProbability ~ globalScore (decote 0 a 5 points). La tension est resolue en faveur des contrariens, l incertitude residuelle est faible. Exemple : globalScore 72, tension contrarian-justifies, successProbability 67-72.

**Erreur a eviter ABSOLUMENT** : produire successProbability identique ou collee au globalScore (ecart < 3 points) sur un dossier ou la tension n est pas tranchee. C est faux methodologiquement et le partner perd l information clef. Les deux chiffres existent precisement pour porter cette nuance. Si tu trouves que les deux sont egaux apres calibration, relis ta tensionResolved et ta dialectique : soit la tension est vraiment resolue en faveur des contrariens (et alors c est legitime), soit tu as evite la decote par paresse.

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

# PLAN DE CHANTIERS DE STRUCTURATION

Si verdict = "investir avec conditions" OU "approfondir", tu produis EN PLUS un plan de chantiers structurant à 3 horizons. C'est un livrable de partner senior qui transforme une recommandation en plan d'action.

5 axes possibles : gouvernance, finance, opérations, communication, ESG.

Pour chaque axe pertinent au dossier, tu produis 1-3 actions par horizon :
- Court terme (0-3 mois) : actions immédiates, low-hanging fruits, pré-requis avant signature
- Moyen terme (3-12 mois) : structuration progressive
- Long terme (12+ mois) : maturité et passage à l'échelle

Format pour chaque action : { "axis": "gouvernance|finance|opérations|communication|esg", "action": "description précise et actionnable" }.

Si verdict = "investir" ou "refuser", structuringPlan = null.

# RÈGLE DE STYLE ÉDITORIAL

Tes textes de synthèse (argumentation, decision drivers, dialecticalResolution.rationale, recommendations) doivent être rédigés comme un partner senior d'un fonds VC qui écrit pour son comité d'investissement. À ce titre :

- Ne mentionne JAMAIS les "moteurs" de la plateforme dans tes textes (pas de "le moteur de Vigilance critique a détecté...", pas de "selon le moteur Pattern matching...", pas de "Moteur 8 indique..."). Tu peux référencer les analyses par leur nature ("le pattern matching avec Theranos...", "les signaux contrariens identifiés...", "la cohérence financière révèle..."), mais jamais comme étant des outils. Tu écris la conclusion d'une instruction, pas un rapport sur un outil.
- Adopte le ton d'un memo IC. Phrases denses, vocabulaire VC standard (ARR, runway, dilution, moat, founder-market fit, comparable, etc.), pas de jargon académique.
- Cite les comparables historiques par leur nom et leur outcome ("pattern Theranos avec 91% de proximité", "trajectoire Stripe dans une fenêtre de 5-7 ans"), pas par leur ID interne.
- Utilise la première personne du pluriel rarement et seulement pour les verdicts, pas dans la description des faits.

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
    { "dimensionName": "Vigilance critique / risques", "weight": 0.15, ... }
  ],
  "blindspotsVsContrarian": {
    "blindspotsWeight": 0-100,
    "contrarianWeight": 0-100,
    "tensionResolved": "blindspots-dominate" | "contrarian-justifies" | "balanced-investigate",
    "resolution": "raisonnement 2-3 phrases"
  },
  "argumentation": "argumentation dense de 5-7 phrases",
  "keyConditions": ["condition 1 actionnable", "condition 2", ...],
  "decisionDrivers": ["facteur décisif 1", "facteur décisif 2", "facteur décisif 3"],
  "structuringPlan": {
    "shortTerm": [
      { "axis": "gouvernance", "action": "Formaliser pacte d'actionnaires avec clauses de protection investor (drag-along, tag-along, anti-dilution)" }
    ],
    "mediumTerm": [
      { "axis": "finance", "action": "Mettre en place tableau de bord cash-flow rolling 24 mois et reporting mensuel CODIR" }
    ],
    "longTerm": [
      { "axis": "opérations", "action": "Automatisation des workflows commerciaux avec ERP intégré CRM/facturation/reporting" }
    ]
  }
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
  contrarianAnalysis: ContrarianAnalysisOutput,
  fundNote?: string | null,
  /**
   * Score mecanique pre-calcule par lib/engines/score-calculator.ts a
   * partir des sorties des moteurs Bloc 1. Si fourni, le LLM orchestrator
   * recoit le score, le verdict derive et les dimensions deja calcules :
   * il devient narrateur du verdict (argumentation, decision drivers,
   * dialecticalResolution) au lieu de juge. Il peut signaler un desaccord
   * motive via assessorDisagreement si son jugement structurel diverge
   * fortement du calcul mecanique.
   * Si non fourni (mode legacy / retro-compatibilite), l orchestrator
   * fonctionne comme avant : LLM produit verdict + score + dimensions.
   */
  mechanicalScore?: import('./score-calculator').MechanicalScoreResult | null,
): Promise<OrchestratedResult['finalRecommendation']> {

  // ============================================================
  // NULL-CHECK DEFENSIF (commit 37aaab8 etendu) :
  // Si le moteur Causal renvoie un blindspotsScores partiellement
  // vide ou null (peut arriver sur des PDF courts ou tronques),
  // l acces direct b.score plante en serveur. On filtre pour ne
  // garder que les entries valides avant de calculer la moyenne.
  // ============================================================
  const blindspotsScoresEntries = Object.values(causalReversal?.blindspotsScores || {})
    .filter((b: any) => b && typeof b === 'object' && typeof b.score === 'number');

  const blindspotsAvg = blindspotsScoresEntries.length > 0
    ? Math.round(
        blindspotsScoresEntries.reduce((sum: number, b: any) => sum + b.score, 0) /
        blindspotsScoresEntries.length
      )
    : 50; // fallback neutre si moteur Causal en echec total

  const blindspotsAlertes = Object.values(causalReversal?.blindspotsScores || {})
    .filter((b: any) => b && b.alerte).length;

  const aveuglementPatternsDetected = Object.values(blindspotAnalysis?.patterns || {}).filter((p: any) => p?.detected).length;
  const aveuglementHighIntensity = Object.values(blindspotAnalysis?.patterns || {}).filter((p: any) => p?.detected && p.intensity >= 60).length;

  const contrarianSignalsDetected = Object.values(contrarianAnalysis?.signals || {}).filter((s: any) => s?.detected).length;
  const contrarianHighStrength = Object.values(contrarianAnalysis?.signals || {}).filter((s: any) => s?.detected && s.strength >= 60).length;

  // Helper pour tronquer les longues syntheses textuelles avant injection dans le prompt.
  // Les enrichissements sessions 3-4 ont allonge les sorties Blindspot/Contrarian/Causal.
  // L orchestrator n a pas besoin de la prose complete, juste de l essentiel.
  const truncate = (s: string | undefined, max: number = 400): string => {
    if (!s) return '';
    if (s.length <= max) return s;
    return s.slice(0, max) + '...';
  };

  // ============================================================
  // NIVEAU 3.A : APPRENTISSAGE PAR FEEDBACK SUPERVISE
  // ------------------------------------------------------------
  // Recupere les annotations utilisateur passees sur des dossiers du
  // meme secteur. Ces annotations sont injectees dans le prompt comme
  // contexte d apprentissage. L appel est non-bloquant : si la
  // persistence est desactivee ou la base down, on injecte un bloc vide.
  //
  // L impact sur le coût est marginal (5 annotations × ~200 tokens =
  // ~1000 tokens supplementaires en input).
  // ============================================================
  const pastAnnotations = await getRelevantPastAnnotations(
    extraction.sector,
    undefined,
    5,
  );
  const annotationsBlock = formatPastAnnotationsForPrompt(pastAnnotations);

  const userPrompt = `Synthèse des 8 moteurs sur le dossier ${extraction?.companyName ?? '?'} :

${annotationsBlock}# CONTEXTE
${extraction?.sector ?? '?'} / ${extraction?.subSector ?? '?'} · ${extraction?.geographicHub ?? '?'}, ${extraction?.country ?? '?'}
Tour : ${extraction?.fundraise?.stage ?? '?'} ${extraction?.fundraise?.amount ?? '?'}
Valorisation : ${extraction.fundraise.valuation || 'non précisée'}

# MOTEUR ÉQUIPE
- Couverture systémique : ${team.systemicCoverage?.score ?? '?'}/100
- Anti-fragilité : ${team.collectiveAntiFragility?.score ?? '?'}/100
- Transposition expérience : ${team.experienceTransposition?.score ?? '?'}/100
- Obsession fondateur : ${team.founderObsession?.score ?? '?'}/100
- Red flags : ${team?.redFlags?.length ?? '?'} · Green flags : ${team?.greenFlags?.length ?? '?'}

# MOTEUR MARCHÉ
- Intensité besoin : ${market.needIntensity?.score ?? '?'}/100
- Signaux organiques : ${market.organicSignals?.score ?? '?'}/100
- Défensibilité : ${market.defensibility?.score ?? '?'}/100
- ${market?.perceivedSize ?? '?'} perçu / ${market?.realIntensity ?? '?'} réel · ${market?.saturation ?? '?'}

# MOTEUR MACRO
- Cycle : ${macro?.cyclePosition ?? '?'}
- VC segment : ${macro?.vcCapitalOnSegment ?? '?'}
- Fenêtre critique : ${macro?.criticalTimingWindow?.exists ? 'OUI ' + (macro?.criticalTimingWindow?.horizon || '') : 'Non'}
- Opportunité contracyclique : ${macro.contraryclicalOpportunity?.score ?? '?'}/100

# MOTEUR PATTERN MATCHING
- Archétype : ${patternMatching?.archetypeDominant ?? '?'}
- Top comparables : ${(patternMatching.comparables || []).slice(0, 3).map(c => `${c.name} (${c.proximity}%)`).join(' · ')}
- Benchmark rétrospectif : ${patternMatching?.retrospectiveBenchmark?.averageScore ?? '?'}/100

# MOTEUR RETOURNEMENT CAUSAL
- Score moyen angles morts (7 dimensions) : ${blindspotsAvg}/100
- Alertes : ${blindspotsAlertes}/7

# MOTEUR AVEUGLEMENT (12)
- Score global de vigilance : ${blindspotAnalysis.globalBlindspotScore || 0}/100
- Patterns détectés : ${aveuglementPatternsDetected}/10
- Patterns haute intensité : ${aveuglementHighIntensity}/10
- Alertes critiques : ${(blindspotAnalysis.alertesCritiques || []).slice(0, 5).join(' · ') || 'aucune'}
- Patterns historiques : ${(blindspotAnalysis.patternsHistoriques || []).map(p => `${p.case} (${p.outcome}, ${p.similarity}%)`).join(' · ') || 'aucun'}
- Synthèse : ${truncate(blindspotAnalysis.syntheseAveuglement, 500)}

# MOTEUR SINGULARITÉS CONTRARIENNES (13)
- Score global contrarien : ${contrarianAnalysis.globalContrarianScore || 0}/100
- Signaux détectés : ${contrarianSignalsDetected}/10
- Signaux haute force : ${contrarianHighStrength}/10
- Comparables contrariens : ${(contrarianAnalysis.comparablesContrariens || []).slice(0, 3).map(c => `${c.name} (${c.outcome})`).join(' · ') || 'aucun'}
- Synthèse : ${truncate(contrarianAnalysis.syntheseSingularite, 500)}

# DÉTAILS PATTERNS AVEUGLEMENT (top 5 haute intensité)
${Object.values(blindspotAnalysis.patterns || {})
  .filter((p: any) => p?.detected && p.intensity >= 50)
  .slice(0, 5)
  .map((p: any) => `- ${p.patternName} (${p.intensity}/100) : ${truncate(p.evidence, 200)}`)
  .join('\n') || 'Aucun pattern haute intensité détecté'}

# DÉTAILS SIGNAUX CONTRARIENS (top 5 haute force)
${Object.values(contrarianAnalysis.signals || {})
  .filter((s: any) => s?.detected && s.strength >= 50)
  .slice(0, 5)
  .map((s: any) => `- ${s.signalName} (${s.strength}/100) : ${truncate(s.evidence, 200)}`)
  .join('\n') || 'Aucun signal contrarien fort détecté'}
${mechanicalScore ? `

# SCORE MECANIQUE PRE-CALCULE (source de verite)

Le code a deja calcule le score global et derive le verdict de maniere
deterministe a partir des six scores des moteurs Bloc 1 ci-dessus :

- SCORE GLOBAL : ${mechanicalScore.globalScore}/100
- VERDICT DERIVE : ${mechanicalScore.verdict.toUpperCase()}
- DECOMPOSITION :
  · Equipe ${mechanicalScore.dimensions.team.score}/100 (poids 0.20, contrib ${mechanicalScore.dimensions.team.contribution})
  · Marche ${mechanicalScore.dimensions.market.score}/100 (poids 0.22, contrib ${mechanicalScore.dimensions.market.contribution})
  · Macro ${mechanicalScore.dimensions.macro.score}/100 (poids 0.15, contrib ${mechanicalScore.dimensions.macro.contribution})
  · Modele economique ${mechanicalScore.dimensions.financial.score}/100 (poids 0.13, contrib ${mechanicalScore.dimensions.financial.contribution})
  · Contrariens ${mechanicalScore.dimensions.contrarian.score}/100 (poids 0.15, contrib ${mechanicalScore.dimensions.contrarian.contribution})
  · Vigilance ${mechanicalScore.dimensions.vigilance.score}/100 (poids 0.15, contrib ${mechanicalScore.dimensions.vigilance.contribution})
- SEUILS : <45 = REFUSER, 45-59 = APPROFONDIR, 60-74 = INVESTIR AVEC CONDITIONS, >=75 = INVESTIR

TON ROLE A CHANGE : tu n es plus le juge qui decide du verdict, tu es le
NARRATEUR qui argumente le verdict deja calcule. Le score affiche au
partner sera ${mechanicalScore.globalScore}/100 et le verdict sera
${mechanicalScore.verdict.toUpperCase()}, point. Tu ne peux pas les changer.

CE QUE TU DOIS FAIRE :
- Ecrire le narratif de retournement causal (pourquoi le dossier reussit /
  echoue dans les deux scenarios)
- Argumenter la coherence du score avec les faits du dossier
- Identifier la resolution dialectique (blindspots-dominate /
  contrarian-justifies / balanced-investigate)
- Lister les decision drivers et conditions cles
- Produire le plan de chantiers si verdict = INVESTIR AVEC CONDITIONS ou
  APPROFONDIR

CHAMPS JSON QUE TU PRODUIS NORMALEMENT (verdict, globalScore,
dimensionProbabilities) : tu peux les renseigner avec les valeurs
mecaniques ci-dessus, ou avec ta propre estimation. Ils seront de toute
facon ecrases par les valeurs mecaniques avant l affichage. Mais si tu
es FORTEMENT EN DESACCORD avec le calcul mecanique (par exemple si tu
penses que le dossier merite REFUSER alors que le score donne
APPROFONDIR a 47, ou inversement), tu peux le signaler via le champ
optionnel assessorDisagreementRationale (string libre 2-4 phrases). Ce
desaccord motive sera affiche en alerte editoriale dans la note finale,
sans modifier le score affiche. Utilise-le UNIQUEMENT si l ecart depasse
12 points ou si le verdict ne te semble pas le bon : c est un signal fort
qui sera lu par le partner.

` : ''}
Produis la recommandation finale avec :
1. ${mechanicalScore ? 'Argumentation dense (voir SCORE MECANIQUE ci-dessus, le verdict est deja calcule)' : 'Probabilité de succès chiffrée (et son inverse)'}
2. ${mechanicalScore ? 'Resolution de la tension blindspots/contrarian' : 'Score global avec seuils explicites'}
3. ${mechanicalScore ? 'Decision drivers (3-5 facteurs decisifs)' : 'Probabilités par dimension (6 dimensions avec poids)'}
4. ${mechanicalScore ? 'Conditions cles actionnables' : 'Résolution de la tension blindspots/contrarian'}
5. ${mechanicalScore ? 'Plan de chantiers si applicable' : 'Argumentation dense'}
6. ${mechanicalScore ? 'Optionnel : assessorDisagreementRationale si tu es en desaccord motive' : 'Conditions clés actionnables'}
7. ${mechanicalScore ? 'Narratif de retournement causal' : 'Decision drivers (3-5 facteurs décisifs)'}

Retourne uniquement le JSON structuré.${buildFundNoteBlock(fundNote, 'générale')}`;

  // maxTokens reduit de 8000 a 5000 : la sortie de l orchestrator est un JSON
  // de synthese compact, pas besoin de plus. Le retry est conserve mais
  // utilise le meme maxTokens reduit pour eviter de doubler le temps en pire cas.
  let rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 8000, MODEL);
  let recommendation: OrchestratedResult['finalRecommendation'];
  try {
    recommendation = parseJSON<OrchestratedResult['finalRecommendation']>(rawResponse);
  } catch (firstErr: any) {
    console.warn('[orchestrator] JSON parse failed, retrying once:', firstErr?.message);
    rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 8000, MODEL);
    recommendation = parseJSON<OrchestratedResult['finalRecommendation']>(rawResponse);
  }

  const audit = auditTagging(recommendation, 'orchestrator');
  if (audit.level !== 'ok') {
    console.warn('[orchestrator] tagging audit:', audit.message);
  }

  // ============================================================
  // NIVEAU 2.B : SCORE AUDITABLE
  // ------------------------------------------------------------
  // Le LLM produit globalScore par jugement structurel, ce qui peut
  // conduire a des ecarts non auditables (cas UP&CHARGE : LLM = 28
  // alors que la somme ponderee des dimensions donne ~44). On
  // recalcule un score mecanique a partir des memes dimensions, et
  // on expose les deux. Si l ecart depasse 15 points, on logge un
  // warning et on signale dans auditNote pour que l UI puisse
  // afficher l alerte.
  //
  // Formule :
  //   weightedDimensionScore = Σ (successProbability_i × weight_i)
  //   blindspotsContrarianAdjustment :
  //     - blindspots-dominate     : -15 a -25 selon globalBlindspotScore
  //     - contrarian-justifies    : +5 a +15 selon globalContrarianScore
  //     - balanced-investigate    : 0
  //   finalComputedScore = clamp(weightedDimensionScore + adjustment, 0, 100)
  // ============================================================
  const dims = recommendation.dimensionProbabilities || [];
  const weightedDimensionScore = dims.length > 0
    ? Math.round(
        dims.reduce((sum, d) => sum + (d.successProbability || 0) * (d.weight || 0), 0)
      )
    : 0;

  const tension = recommendation.blindspotsVsContrarian?.tensionResolved;
  const blindspotScore = blindspotAnalysis.globalBlindspotScore || 0;
  const contrarianScore = contrarianAnalysis.globalContrarianScore || 0;
  let blindspotsContrarianAdjustment = 0;
  if (tension === 'blindspots-dominate') {
    // Plus le blindspot score est haut, plus on penalise (max -25)
    blindspotsContrarianAdjustment = -Math.round(15 + (blindspotScore / 100) * 10);
  } else if (tension === 'contrarian-justifies') {
    // Plus le contrarian score est haut, plus on bonifie (max +15)
    blindspotsContrarianAdjustment = Math.round(5 + (contrarianScore / 100) * 10);
  }

  const finalComputedScore = Math.max(0, Math.min(100, weightedDimensionScore + blindspotsContrarianAdjustment));
  const llmScore = recommendation.globalScore || 0;
  const delta = finalComputedScore - llmScore;
  const absDelta = Math.abs(delta);

  let auditNote = '';
  if (absDelta <= 5) {
    auditNote = 'Score LLM aligne avec le calcul mecanique (ecart <= 5 points).';
  } else if (absDelta <= 15) {
    auditNote = `Ecart modere de ${delta > 0 ? '+' : ''}${delta} points entre score LLM (${llmScore}) et calcul mecanique (${finalComputedScore}). Le jugement LLM ${delta > 0 ? 'sous-estime' : 'sur-estime'} legerement par rapport a la ponderation directe.`;
  } else {
    auditNote = `ECART CRITIQUE de ${delta > 0 ? '+' : ''}${delta} points entre score LLM (${llmScore}) et calcul mecanique (${finalComputedScore}). Le LLM a fait un saut de jugement non capture par les dimensions. Examiner la coherence : soit les dimensionProbabilities sous-estiment / sur-estiment certains axes, soit la tension blindspots/contrarian merite un recalibrage des seuils. Le score mecanique est plus traçable, le score LLM peut integrer des facteurs implicites non chiffres.`;
    console.warn(`[orchestrator] score audit divergence: LLM=${llmScore} computed=${finalComputedScore} delta=${delta}`);
  }

  recommendation.computedScoreBreakdown = {
    weightedDimensionScore,
    blindspotsContrarianAdjustment,
    finalComputedScore,
    llmScore,
    delta,
    auditNote,
    formula: 'finalComputedScore = clamp(Σ(successProbability_i × weight_i) + blindspotsContrarianAdjustment, 0, 100). blindspots-dominate : -15 a -25 selon globalBlindspotScore. contrarian-justifies : +5 a +15 selon globalContrarianScore. balanced-investigate : 0.',
  };

  // ============================================================
  // AUDIT ANTI-CONVERGENCE
  // ------------------------------------------------------------
  // Detecte les cas ou le LLM produit des dimensionProbabilities
  // trop homogenes (toutes proches de la meme valeur) ou des scores
  // ronds suspectes (50, 52, 55, 70, 72). Ces patterns trahissent
  // une calibration paresseuse plutot qu un jugement reel et
  // produisent l effet 'tous les dossiers APPROFONDIR ont 52/100'
  // qui decredibilise la note. On logge un warning dans error_logs
  // pour pouvoir suivre la frequence de ces cas en production.
  // ============================================================
  if (dims.length >= 4) {
    const probs = dims.map(d => d.successProbability || 0);
    const minProb = Math.min(...probs);
    const maxProb = Math.max(...probs);
    const amplitude = maxProb - minProb;
    if (amplitude < 15) {
      const dimList = dims.map(d => `${d.dimensionName}=${d.successProbability}`).join(', ');
      console.warn(`[orchestrator] dimensions sur-convergentes (amplitude ${amplitude}<15) : ${dimList}, globalScore=${llmScore}, finalComputedScore=${finalComputedScore}`);
      // Logge dans error_logs si disponible (fail-open si pas configure)
      try {
        const { logError } = await import('@/lib/error-logger').catch(() => ({ logError: null as any }));
        if (logError) {
          await logError('pipeline.orchestrator.score-convergence', `Dimensions sur-convergentes (amplitude ${amplitude} points) : ${dimList}`, {
            severity: 'warning',
            context: {
              amplitude,
              dimensions: dims.map(d => ({ name: d.dimensionName, prob: d.successProbability, weight: d.weight })),
              llmScore,
              finalComputedScore,
              verdict: recommendation.verdict,
            },
          });
        }
      } catch {}
    }
  }

  // ============================================================
  // GARDE DETERMINISTE : DECOTE successProbability vs globalScore
  // ------------------------------------------------------------
  // Le LLM a tendance a aligner successProbability sur globalScore,
  // ce qui rend les deux chiffres redondants. La doctrine Prelude
  // veut que successProbability integre une decote pour incertitude
  // residuelle dependant de la dialectique blindspots / contrariens.
  // On force un ecart minimal coherent avec la tension resolue, sauf
  // dans le cas contrarian-justifies ou un alignement est legitime.
  // ============================================================
  const finalScore = recommendation.globalScore || 0;
  const llmSuccessProb = typeof recommendation.successProbability === 'number'
    ? recommendation.successProbability
    : finalScore;
  const probDelta = finalScore - llmSuccessProb;

  let probAdjusted = llmSuccessProb;
  let probAdjustmentApplied = false;
  let probAdjustmentRationale = '';

  if (tension === 'blindspots-dominate') {
    // Decote attendue : 10 a 20 points selon ampleur des drapeaux rouges
    const expectedMinDecote = 10 + Math.round((blindspotScore / 100) * 8);
    if (probDelta < expectedMinDecote) {
      probAdjusted = Math.max(0, finalScore - expectedMinDecote);
      probAdjustmentApplied = true;
      probAdjustmentRationale = `Decote forcee : tension blindspots-dominate, score blindspot ${blindspotScore}, decote attendue minimale ${expectedMinDecote} points. LLM avait produit ${llmSuccessProb} (decote ${probDelta}).`;
    }
  } else if (tension === 'balanced-investigate') {
    // Decote attendue : 5 a 12 points pour refleter l incertitude non levee
    const expectedMinDecote = 5;
    if (probDelta < expectedMinDecote) {
      probAdjusted = Math.max(0, finalScore - 7);
      probAdjustmentApplied = true;
      probAdjustmentRationale = `Decote forcee : tension balanced-investigate non levee, decote attendue minimale ${expectedMinDecote} points. LLM avait produit ${llmSuccessProb} (decote ${probDelta}).`;
    }
  }
  // Pour contrarian-justifies, on ne force aucune decote : alignement
  // legitime quand la tension est resolue en faveur des contrariens.

  if (probAdjustmentApplied) {
    console.warn(`[orchestrator] successProbability ajustee : ${llmSuccessProb} -> ${probAdjusted}. ${probAdjustmentRationale}`);
    recommendation.successProbability = probAdjusted;
    recommendation.failureProbability = 100 - probAdjusted;
  }

  // ============================================================
  // OVERRIDE PAR LE SCORE MECANIQUE (si fourni)
  // ------------------------------------------------------------
  // Si l API a fourni un mechanicalScore (calcul deterministe a partir
  // des moteurs Bloc 1), on l utilise comme source de verite. Le LLM
  // a produit une argumentation, mais le score affiche et le verdict
  // utilise sont les valeurs mecaniques. Le LLM peut signaler un
  // desaccord motive via le champ assessorDisagreement (rempli dans
  // son output JSON s il a estime que son jugement diverge fortement).
  // ============================================================
  if (mechanicalScore) {
    const llmVerdict = recommendation.verdict;
    const llmGlobalScore = recommendation.globalScore || 0;

    // On capture le desaccord avant override pour pouvoir l afficher
    // dans la note. Le LLM peut avoir voulu un autre verdict que celui
    // dicte par les seuils.
    const verdictsMatch = llmVerdict === mechanicalScore.verdict;
    const scoreDelta = llmGlobalScore - mechanicalScore.globalScore;
    const significantDisagreement = !verdictsMatch || Math.abs(scoreDelta) > 12;

    recommendation.assessorDisagreement = significantDisagreement
      ? {
          present: true,
          mechanicalVerdict: mechanicalScore.verdict,
          llmVerdict,
          mechanicalScore: mechanicalScore.globalScore,
          llmScoreSuggestion: llmGlobalScore,
          scoreDelta,
          rationale: (recommendation as any).assessorDisagreementRationale || `Le jugement structurel du moteur d orchestration suggere ${llmVerdict} a ${llmGlobalScore} alors que le calcul mecanique des dimensions donne ${mechanicalScore.verdict} a ${mechanicalScore.globalScore}. Cet ecart merite une lecture attentive avant decision.`,
        }
      : { present: false };

    // Override : le score affiche est mecanique, le verdict aussi
    recommendation.globalScore = mechanicalScore.globalScore;
    recommendation.verdict = mechanicalScore.verdict;

    // Les dimensionProbabilities sont remplacees par les scores reels
    // des moteurs Bloc 1. Le LLM ne peut plus les calibrer a la baisse
    // ou a la hausse pour rendre son verdict plus coherent.
    recommendation.dimensionProbabilities = [
      { dimensionName: 'Equipe', successProbability: mechanicalScore.dimensions.team.score, riskScore: 100 - mechanicalScore.dimensions.team.score, weight: mechanicalScore.dimensions.team.weight, rationale: mechanicalScore.dimensions.team.rationale, keyDrivers: [], keyRisks: [] },
      { dimensionName: 'Marche', successProbability: mechanicalScore.dimensions.market.score, riskScore: 100 - mechanicalScore.dimensions.market.score, weight: mechanicalScore.dimensions.market.weight, rationale: mechanicalScore.dimensions.market.rationale, keyDrivers: [], keyRisks: [] },
      { dimensionName: 'Macro', successProbability: mechanicalScore.dimensions.macro.score, riskScore: 100 - mechanicalScore.dimensions.macro.score, weight: mechanicalScore.dimensions.macro.weight, rationale: mechanicalScore.dimensions.macro.rationale, keyDrivers: [], keyRisks: [] },
      { dimensionName: 'Modele economique', successProbability: mechanicalScore.dimensions.financial.score, riskScore: 100 - mechanicalScore.dimensions.financial.score, weight: mechanicalScore.dimensions.financial.weight, rationale: mechanicalScore.dimensions.financial.rationale, keyDrivers: [], keyRisks: [] },
      { dimensionName: 'Singularites contrariennes', successProbability: mechanicalScore.dimensions.contrarian.score, riskScore: 100 - mechanicalScore.dimensions.contrarian.score, weight: mechanicalScore.dimensions.contrarian.weight, rationale: mechanicalScore.dimensions.contrarian.rationale, keyDrivers: [], keyRisks: [] },
      { dimensionName: 'Vigilance critique', successProbability: mechanicalScore.dimensions.vigilance.score, riskScore: 100 - mechanicalScore.dimensions.vigilance.score, weight: mechanicalScore.dimensions.vigilance.weight, rationale: mechanicalScore.dimensions.vigilance.rationale, keyDrivers: [], keyRisks: [] },
    ];

    // computedScoreBreakdown reflete le calcul mecanique deterministe
    recommendation.computedScoreBreakdown = {
      weightedDimensionScore: mechanicalScore.globalScore,
      blindspotsContrarianAdjustment: 0,
      finalComputedScore: mechanicalScore.globalScore,
      llmScore: llmGlobalScore,
      delta: scoreDelta,
      auditNote: significantDisagreement
        ? `Desaccord motive du moteur d orchestration : il aurait calibre a ${llmGlobalScore} (verdict ${llmVerdict}) si on lui avait laisse le choix. Le score affiche (${mechanicalScore.globalScore}, verdict ${mechanicalScore.verdict}) est issu du calcul mecanique sur les six dimensions Bloc 1. Voir le champ assessorDisagreement pour le rationale du desaccord.`
        : `Score mecanique aligne avec le jugement structurel du moteur d orchestration (ecart ${Math.abs(scoreDelta)} points, verdict identique).`,
      formula: mechanicalScore.formula,
      mechanicalDimensions: mechanicalScore.dimensions,
      thresholds: mechanicalScore.thresholds,
    };
  }

  return recommendation;
}
