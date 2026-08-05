import { callClaudeWithUsage, MODEL } from './anthropic-client';
import { parseEngineOutput } from './engine-output-contract';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from './source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from './editorial-voice';
import { buildFundNoteBlock, formatExtractionGeography } from './fund-context';
import { buildConflictOfInterestBlock, type ConflictOfInterestFlag } from './conflict-of-interest';
import type {
  ExtractionOutput, TeamAnalysisOutput, MarketAnalysisOutput,
  MacroAnalysisOutput, PatternMatchingOutput, CausalReversalOutput,
  BlindspotAnalysisOutput, ContrarianAnalysisOutput,
  OrchestratedResult
} from './types';
import { getRelevantPastAnnotations, formatPastAnnotationsForPrompt } from '../analysis-store';
import type { ErrorLogEntry } from '../error-logger';
import { protectEngineRoots } from './engine-roots';
import {
  hasComputedScore,
  isInsufficientBasis,
  INSUFFICIENT_BASIS_VERDICT,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
} from './score-calculator';
import { ENGINE_LLM_BUDGET, ORCHESTRATE_MAX_TOKENS, looksTruncated, addCall, type LlmMeasure } from './engine-budget';
import { champ } from './champ-absent';

export const SYSTEM_PROMPT = `Tu es le Moteur d'Orchestration de la plateforme Prélude. Tu es le moteur final qui agrège les outputs des huit moteurs précédents et produit la recommandation finale du partner avec PROBABILITÉS CHIFFRÉES PAR DIMENSION et résolution de la TENSION DIALECTIQUE entre signaux de vigilance et signaux de singularité.
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

# SOCLE PARTIEL - DOCTRINE

Un run peut te parvenir avec une partie seulement de ses moteurs. Le bloc SOCLE D INSTRUCTION du prompt te dit lesquels ont abouti et lesquels sont indisponibles. Cette information n'est pas un avertissement technique, elle gouverne ce que tu as le droit d'écrire.

Une synthèse sur socle partiel déclare son socle. Elle nomme les axes qu'elle n'a pas pu instruire, dans son argumentation, en clair, sans euphémisme et sans les reléguer en note de bas de page. Le partner qui engage plusieurs millions doit savoir ce que la plateforme a lu et ce qu'elle n'a pas lu.

Une synthèse sur socle partiel ne comble pas les silences. Tu ne reconstitues pas par déduction ce qu'un moteur muet aurait dit. Tu ne transposes pas depuis un dossier comparable. Un axe non instruit reste un axe non instruit jusqu'au prochain run.

Une lacune n'est jamais une absence de risque. C'est l'inversion la plus dangereuse et la plus tentante : un moteur de vigilance qui n'a pas tourné ne produit aucune alerte, et cette absence d'alerte se lit comme une bonne nouvelle si personne ne la qualifie. Ne pas avoir mesuré n'est pas avoir écarté. Toute formulation qui présenterait un silence instrumental comme un signal favorable est une faute doctrinale, pas une maladresse de style.

Une synthèse sur socle partiel reste opposable. Elle assume son verdict sur ce qu'elle a lu, elle ne se réfugie pas dans un refus de conclure, et elle borne explicitement sa portée. Un verdict rendu sur socle partiel est un verdict, pas une esquisse : il engage, et il dit sur quoi il engage.

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

successProbability + failureProbability doit faire 100.

# INTÉGRATION DES MOTEURS PHASE 4 (Lecture du langage et Fragilité Structurelle)

Quand les blocs MOTEUR LECTURE DU LANGAGE et MOTEUR FRAGILITÉ STRUCTURELLE 
sont présents dans l'input, tu dois les intégrer dans la résolution 
dialectique selon les principes suivants :

LECTURE DU LANGAGE (Narrative Drift). Score global de dérive narrative 
sur trois axes (glissement des indicateurs, opacité progressive, 
narrative premium collapse). Un verdict alerte ou drapeau-rouge sur ce 
moteur signale que le discours se déconnecte de la réalité opérationnelle, 
pattern Theranos en version commerciale. À traiter comme un signal de 
vigilance critique de poids comparable au moteur Aveuglement Bloc 1, et 
à intégrer explicitement dans blindspotsVsContrarian et dans l'argumentation 
si le verdict est alerte ou pire.

FRAGILITÉ STRUCTURELLE (sept patterns Phase 4 : croissance subventionnée, 
captivité infrastructure, coûts fixes incompressibles, risque 
réglementaire daté, érosion de défensibilité, fragilité cap table, 
industrialisation prématurée). Chaque pattern produit un score et un 
verdict propres. Plusieurs patterns à 60+ déclenchent des combinaisons 
diagnostiques cross-patterns documentées (Trajectoire WeWork, Pattern 
Britishvolt, Pattern Northvolt, Wrapper sans différenciation, Fin de 
cycle quasi-mécanique, etc.). Une combinaison drapeau-rouge déclenchée 
est un signal extrêmement fort qui DOIT remonter dans :
- decisionDrivers (un des facteurs décisifs)
- argumentation (mention explicite avec rationale)
- keyConditions (transformer en condition actionnable de DD)
- structuringPlan (au moins une action shortTerm pour adresser)

Tu n'es pas autorisé à minorer une combinaison diagnostique drapeau-rouge 
en l'omettant ou en la diluant. Si la combinaison est détectée, elle 
remonte. Le partner attend ce niveau de rigueur dans la synthèse.

Si Fragilité Structurelle remonte avec score >= 65 ET au moins une 
combinaison diagnostique de sévérité alerte ou drapeau-rouge, le 
verdict global ne peut pas être INVESTIR sans condition. Au minimum 
INVESTIR AVEC CONDITIONS, voire APPROFONDIR si plusieurs combinaisons 
se cumulent.`;

// ============================================================
// HELPERS DE CONSTRUCTION DES BLOCS PHASE 4
// ------------------------------------------------------------
// Exportes pour testabilite. Construisent les blocs userPrompt
// pour Lecture du langage et Fragilite Structurelle. Si le
// payload est null ou non applicable, retournent une chaine vide
// (le bloc est completement omis du prompt).
// ============================================================

export function buildNarrativeDriftBlock(
  narrativeDrift: import('./narrative-drift-engine').NarrativeDriftAnalysisOutput | null | undefined,
  truncate: (s: string | undefined, max?: number) => string,
): string {
  if (!narrativeDrift) return '';
  return `

# MOTEUR LECTURE DU LANGAGE (Narrative Drift)
- Score global de dérive : ${narrativeDrift.globalDriftScore ?? '?'}/100
- Verdict : ${(narrativeDrift.verdict ?? '?').toUpperCase()}
- Densité concrète : ${narrativeDrift.metriquesLexicales?.densiteConcrete ?? '?'} · Ratio abstrait/concret : ${narrativeDrift.metriquesLexicales?.ratioAbstraitConcret ?? '?'} · Opacité : ${narrativeDrift.metriquesLexicales?.opaciteScore ?? '?'}
- Counter-archétype : ${narrativeDrift.counterArchetype?.closest ?? '?'} (${narrativeDrift.counterArchetype?.direction ?? '?'})
- Glissement indicateurs : ${narrativeDrift.glissementIndicateurs?.score ?? '?'}/100 · Opacité progressive : ${narrativeDrift.opaciteProgressive?.score ?? '?'}/100 · Premium narratif : ${narrativeDrift.narrativePremiumCollapse?.score ?? '?'}/100
${narrativeDrift.recommandationDD ? '- Recommandation DD : ' + truncate(narrativeDrift.recommandationDD, 200) : ''}
`;
}

export function buildFragiliteStructurelleBlock(
  fragiliteStructurelle: import('./fragility-structurelle/types').FragiliteStructurelleAnalysisOutput | null | undefined,
  truncate: (s: string | undefined, max?: number) => string,
): string {
  if (!fragiliteStructurelle) return '';
  const patterns = fragiliteStructurelle.patterns ?? {};
  const patternsActifs = Object.values(patterns).filter((p: any) => p && p.applicabilite !== 'not-applicable');
  const patternsRemontes = patternsActifs.filter((p: any) => p.globalScore >= 55);
  const combinaisons = fragiliteStructurelle.combinaisons ?? [];
  const recommandations = fragiliteStructurelle.recommandationsDD ?? [];

  return `

# MOTEUR FRAGILITÉ STRUCTURELLE (Bloc Phase 4 : sept patterns)
- Score global de fragilité : ${fragiliteStructurelle.globalFragilityScore ?? '?'}/100
- Verdict : ${(fragiliteStructurelle.verdict ?? '?').toUpperCase()}
- Patterns actifs : ${patternsActifs.length}/7
- Patterns remontés (score >= 55) : ${patternsRemontes.map((p: any) => `${p.patternId} (${p.globalScore}/100, ${p.verdict})`).join(' · ') || 'aucun'}
- Combinaisons diagnostiques détectées : ${combinaisons.map(c => `${c.nom} (${c.severite})`).join(' · ') || 'aucune'}
${combinaisons.length > 0 ? '- Rationales combinaisons : ' + combinaisons.map(c => `[${c.nom}] ${truncate(c.rationale, 200)}`).join(' || ') : ''}
- Synthèse : ${truncate(fragiliteStructurelle.resumeEditorial, 400)}
${recommandations.length > 0 ? '- Recommandations DD prioritaires : ' + recommandations.slice(0, 3).join(' || ') : ''}
`;
}

/**
 * Construit l entree error_logs de l audit anti-convergence.
 *
 * Extrait du site d appel pour deux raisons. La premiere est que ce
 * site appelait logError avec des arguments positionnels contre une
 * signature a objet unique : entry.message sortait undefined, l insert
 * levait sur .slice et l exception etait avalee par le catch interne
 * du logger. Le site paraissait actif et n a jamais rien ecrit en
 * base. La seconde est qu il vit au milieu d une fonction qui exige un
 * appel LLM complet, donc hors de portee de la suite deterministe : le
 * builder, lui, est testable seul.
 */
export function buildScoreConvergenceLogEntry(params: {
  amplitude: number;
  dimList: string;
  dims: Array<{ dimensionName?: string; successProbability?: number; weight?: number }>;
  llmScore: number;
  finalComputedScore: number;
  verdict?: string | null;
  analysisId?: string | null;
}): ErrorLogEntry {
  return {
    severity: 'warning',
    source: 'pipeline.orchestrator.score-convergence',
    message: `Dimensions sur-convergentes (amplitude ${params.amplitude} points) : ${params.dimList}`,
    analysisId: params.analysisId ?? null,
    context: {
      amplitude: params.amplitude,
      dimensions: params.dims.map(d => ({ name: d.dimensionName, prob: d.successProbability, weight: d.weight })),
      llmScore: params.llmScore,
      finalComputedScore: params.finalComputedScore,
      verdict: params.verdict,
    },
  };
}

// ============================================================
// SOCLE D INSTRUCTION
// ------------------------------------------------------------
// Les libelles des moteurs du socle, tels qu ils sont nommes au
// modele. Ce sont les huit sorties que le userPrompt dereference
// inconditionnellement, donc celles dont l absence appauvrit la
// synthese sans qu elle s en apercoive.
//
// narrativeDrift et fragiliteStructurelle n y figurent pas : leur
// absence releve aussi bien de la non-applicabilite doctrinale que
// de l echec d execution, distinction posee par de6e378, et leur
// bloc de prompt disparait deja proprement quand ils manquent. Les
// declarer indisponibles reviendrait a presenter un choix de
// doctrine comme une lacune.
// ============================================================
export const SOCLE_ENGINE_LABELS: Record<string, string> = {
  extraction: 'Extraction',
  team: 'Equipe',
  market: 'Marche',
  macro: 'Macro et timing',
  patternMatching: 'Pattern Matching',
  causalReversal: 'Retournement causal',
  blindspotAnalysis: 'Aveuglement',
  contrarianAnalysis: 'Singularites contrariennes',
};

export interface EngineAvailability {
  /** Libelles des moteurs ayant produit une sortie exploitable. */
  available: string[];
  /** Libelles des moteurs absents sur ce run. */
  missing: string[];
  /** Cles techniques des moteurs absents, pour la telemetry. */
  missingKeys: string[];
}

/**
 * Etablit quels moteurs du socle ont abouti sur ce run.
 *
 * A appeler sur les racines BRUTES, jamais sur la sortie de
 * protectEngineRoots : celle-ci a deja remplace les absents par des
 * objets vides et ne peut plus les distinguer des presents.
 *
 * Un objet vide compte comme absent. Un moteur qui a repondu sans
 * aucun champ n a rien instruit, et le contrat minimal du recorder
 * le classe deja empty_output cote instrumentation.
 */
export function computeEngineAvailability(roots: Record<string, any>): EngineAvailability {
  const available: string[] = [];
  const missing: string[] = [];
  const missingKeys: string[] = [];

  for (const key of Object.keys(SOCLE_ENGINE_LABELS)) {
    if (!(key in roots)) continue;
    const value = roots[key];
    const present = !!value && typeof value === 'object' && Object.keys(value).length > 0;
    if (present) {
      available.push(SOCLE_ENGINE_LABELS[key]);
    } else {
      missing.push(SOCLE_ENGINE_LABELS[key]);
      missingKeys.push(key);
    }
  }

  return { available, missing, missingKeys };
}

/**
 * Bloc de prompt qui declare le socle au modele.
 *
 * Il est emis meme quand rien ne manque. Un socle complet doit se
 * dire, sinon le modele ne peut pas distinguer un run entier d un
 * run ou l information de couverture n a pas ete transmise.
 */
export function buildSocleBlock(availability: EngineAvailability): string {
  const { available, missing } = availability;

  if (missing.length === 0) {
    return `# SOCLE D INSTRUCTION

Les ${available.length} moteurs du socle ont abouti sur ce run. Aucun axe n est muet.

`;
  }

  return `# SOCLE D INSTRUCTION

ATTENTION : ce run est partiel. ${missing.length} moteur${missing.length > 1 ? 's' : ''} du socle ${missing.length > 1 ? 'sont indisponibles' : 'est indisponible'}.

- Moteurs ayant abouti : ${available.join(', ') || 'aucun'}
- Moteurs INDISPONIBLES sur ce run : ${missing.join(', ')}

Tu construis ta synthese sur le socle disponible et sur lui seul.

- Tu ne conclus rien sur un axe qui n a pas ete instruit. Un moteur indisponible ne te donne aucune information, ni favorable ni defavorable.
- Tu signales explicitement dans ton argumentation les axes qui n ont pas pu etre instruits, en les nommant. Le partner doit lire la synthese en sachant sur quoi elle repose.
- Tu ne presentes JAMAIS une lacune comme une absence de risque. Ne pas avoir mesure un risque n est pas l avoir ecarte. Une formulation du type "aucune alerte de vigilance" est interdite quand le moteur Aveuglement est indisponible : la formulation juste est "l axe vigilance n a pas pu etre instruit sur ce run".
- Tu calibres tes dimensionProbabilities en consequence. Une dimension dont le moteur est muet reste incertaine, elle ne devient pas neutre par defaut, et ton successProbability integre cette incertitude residuelle.

`;
}

/**
 * Construit le userPrompt de la synthese finale.
 *
 * Extrait de orchestrateFinalRecommendation pour deux raisons. La
 * premiere est que la construction du prompt est precisement ce qui
 * levait sur c487a8b2 : tant qu elle vivait au milieu d une fonction
 * exigeant un appel LLM complet, aucun test deterministe ne pouvait
 * prouver qu une combinaison de moteurs nuls ne fait plus tomber la
 * synthese. La seconde est que le socle declare se verifie sur le
 * texte produit, pas sur une intention.
 */
/**
 * Lignes de decomposition du score mecanique injectees dans le prompt.
 *
 * Une dimension non evaluee ne s ecrit plus comme une note : elle
 * portait jusqu ici un 50 de repli avec sa contribution ponderee, ce
 * qui donnait au modele un chiffre a narrer la ou aucun moteur n avait
 * rien produit. Elle apparait desormais comme NON EVALUEE, avec sa
 * cause, pour que la synthese sache qu il y a un trou et le dise.
 */
function buildMechanicalDecompositionLines(mechanicalScore: any): string {
  const dims = mechanicalScore?.dimensions || {};
  return DIMENSION_KEYS.map((key) => {
    const d = dims[key];
    if (!d) return `  · ${DIMENSION_LABELS[key]} : non renseignee`;
    const weight = typeof d.weight === 'number' ? d.weight.toFixed(2) : '?';
    // evaluated absent : payload produit avant l instrumentation de la
    // base, on retombe sur la lecture historique du champ.
    if (d.evaluated === false) {
      const cause = d.evaluationCause ? ` (${d.evaluationCause}${d.engineStatus ? `, statut ${d.engineStatus}` : ''})` : '';
      return `  · ${DIMENSION_LABELS[key]} : NON EVALUEE${cause}, poids ${weight} retire de l assiette`;
    }
    return `  · ${DIMENSION_LABELS[key]} ${d.score}/100 (poids ${weight}, contrib ${d.contribution})`;
  }).join('\n');
}

/**
 * Libelles historiques des dimensionProbabilities. Volontairement
 * distincts de DIMENSION_LABELS du score-calculator : l agregateur de
 * reconciliation (lib/reconciliation-aggregator.ts) groupe les series
 * par nom de dimension d un run a l autre, renommer scinderait les
 * historiques deja en base.
 */
const PROBABILITY_DIMENSION_NAMES: Record<string, string> = {
  team: 'Equipe',
  market: 'Marche',
  macro: 'Macro',
  financial: 'Modele economique',
  contrarian: 'Singularites contrariennes',
  vigilance: 'Vigilance critique',
};

/**
 * Traduit les dimensions mecaniques en dimensionProbabilities de la
 * recommandation. N emet que les dimensions reellement evaluees : une
 * dimension dont le moteur est tombe portait jusqu ici un 50 de repli
 * assorti d un riskScore de 50, et entrait dans la note comme un axe
 * instruit a risque median. Elle en sort.
 *
 * Les payloads anterieurs a l instrumentation de la base ne portent pas
 * le champ evaluated : ils sont traites comme evalues, comportement
 * historique, pour ne pas vider la note des dossiers deja persistes.
 */
function buildMechanicalDimensionProbabilities(mechanicalScore: any): any[] {
  const dims = mechanicalScore?.dimensions || {};
  return DIMENSION_KEYS
    .filter((key) => dims[key] && dims[key].evaluated !== false)
    .map((key) => {
      const d = dims[key];
      return {
        dimensionName: PROBABILITY_DIMENSION_NAMES[key],
        successProbability: d.score,
        riskScore: 100 - d.score,
        weight: d.weight,
        rationale: d.rationale,
        keyDrivers: [],
        keyRisks: [],
      };
    });
}

export function buildOrchestratorUserPrompt(p: {
  extraction: any;
  team: any;
  market: any;
  macro: any;
  patternMatching: any;
  causalReversal: any;
  blindspotAnalysis: any;
  contrarianAnalysis: any;
  fundNote?: string | null;
  mechanicalScore?: any;
  narrativeDrift?: any;
  fragiliteStructurelle?: any;
  conflictBlock: string;
  annotationsBlock: string;
}): string {
  const {
    extraction, team, market, macro, patternMatching, causalReversal,
    blindspotAnalysis, contrarianAnalysis, fundNote, mechanicalScore,
    narrativeDrift, fragiliteStructurelle, conflictBlock, annotationsBlock,
  } = p;

  const E = protectEngineRoots({
    extraction,
    team,
    market,
    macro,
    patternMatching,
    causalReversal,
    blindspotAnalysis,
    contrarianAnalysis,
  });

  // ============================================================
  // SOCLE D INSTRUCTION DECLARE
  // ------------------------------------------------------------
  // La synthese doit savoir sur quoi elle repose. Avant la garde
  // de classe, un moteur tombe faisait lever la construction du
  // prompt ; depuis, elle aboutit, ce qui cree un risque nouveau :
  // une synthese construite sur quatre moteurs muets se lit comme
  // une synthese complete, et un axe non instruit se confond avec
  // un axe sans risque. C est exactement l inverse de la doctrine.
  //
  // La disponibilite se calcule sur les racines brutes, avant
  // protection : E a deja remplace les absents par des objets
  // vides, il ne peut plus les distinguer.
  // ============================================================
  const availability = computeEngineAvailability({
    extraction,
    team,
    market,
    macro,
    patternMatching,
    causalReversal,
    blindspotAnalysis,
    contrarianAnalysis,
  });
  const socleBlock = buildSocleBlock(availability);

  // ============================================================
  // TROIS ETATS DU SCORE MECANIQUE, TROIS PROMPTS
  // ------------------------------------------------------------
  // Le prompt ne connaissait que deux etats : un score mecanique
  // present, auquel cas le modele est narrateur, ou absent, auquel
  // cas on lui redemandait de produire le score et le verdict. Le
  // troisieme etat, socle insuffisant, ne peut tomber ni dans l un
  // ni dans l autre. Il n a pas de score a narrer, et rebasculer sur
  // la branche qui redemande le score au modele reveillerait
  // exactement le biais de convergence documente en tete de
  // score-calculator : le modele calibrerait ses dimensions sur le
  // verdict qu il aurait choisi, et le trou du socle deviendrait
  // invisible. Socle insuffisant est un etat terminal, pas un repli
  // vers le modele.
  // ============================================================
  const mechanicalComputed = hasComputedScore(mechanicalScore);
  const mechanicalStarved = !!mechanicalScore && isInsufficientBasis(mechanicalScore);
  const mechanicalNarrated = mechanicalComputed || mechanicalStarved;

  // ============================================================
  // NULL-CHECK DEFENSIF (commit 37aaab8 etendu) :
  // Si le moteur Causal renvoie un blindspotsScores partiellement
  // vide ou null (peut arriver sur des PDF courts ou tronques),
  // l acces direct b.score plante en serveur. On filtre pour ne
  // garder que les entries valides avant de calculer la moyenne.
  // ============================================================
  const blindspotsScoresEntries: any[] = Object.values(E.causalReversal?.blindspotsScores || {})
    .filter((b: any) => b && typeof b === 'object' && typeof b.score === 'number');

  const blindspotsAvg = blindspotsScoresEntries.length > 0
    ? Math.round(
        blindspotsScoresEntries.reduce((sum: number, b: any) => sum + b.score, 0) /
        blindspotsScoresEntries.length
      )
    : 50; // fallback neutre si moteur Causal en echec total

  const blindspotsAlertes = Object.values(E.causalReversal?.blindspotsScores || {})
    .filter((b: any) => b && b.alerte).length;

  const aveuglementPatternsDetected = Object.values(E.blindspotAnalysis?.patterns || {}).filter((p: any) => p?.detected).length;
  const aveuglementHighIntensity = Object.values(E.blindspotAnalysis?.patterns || {}).filter((p: any) => p?.detected && p.intensity >= 60).length;

  const contrarianSignalsDetected = Object.values(E.contrarianAnalysis?.signals || {}).filter((s: any) => s?.detected).length;
  const contrarianHighStrength = Object.values(E.contrarianAnalysis?.signals || {}).filter((s: any) => s?.detected && s.strength >= 60).length;

  // Helper pour tronquer les longues syntheses textuelles avant injection dans le prompt.
  // Les enrichissements sessions 3-4 ont allonge les sorties Blindspot/Contrarian/Causal.
  // L orchestrator n a pas besoin de la prose complete, juste de l essentiel.
  const truncate = (s: string | undefined, max: number = 400): string => {
    if (!s) return '';
    if (s.length <= max) return s;
    return s.slice(0, max) + '...';
  };


  return `Synthèse des 8 moteurs sur le dossier ${champ(E.extraction?.companyName, '?')} :

${conflictBlock}${annotationsBlock}${socleBlock}# CONTEXTE
${champ(E.extraction?.sector, '?')} / ${champ(E.extraction?.subSector, '?')} · ${formatExtractionGeography(E.extraction)}
Stade declare : ${champ(E.extraction?.fundraise?.stage, '?')} · Montant annonce : ${champ(E.extraction?.fundraise?.amount, '?')}
Valorisation : ${E.extraction.fundraise?.valuation || 'non précisée'}

# MOTEUR ÉQUIPE
- Couverture systémique : ${E.team.systemicCoverage?.score ?? '?'}/100
- Anti-fragilité : ${E.team.collectiveAntiFragility?.score ?? '?'}/100
- Transposition expérience : ${E.team.experienceTransposition?.score ?? '?'}/100
- Obsession fondateur : ${E.team.founderObsession?.score ?? '?'}/100
- Red flags : ${E.team?.redFlags?.length ?? '?'} · Green flags : ${E.team?.greenFlags?.length ?? '?'}

# MOTEUR MARCHÉ
- Intensité besoin : ${E.market.needIntensity?.score ?? '?'}/100
- Signaux organiques : ${E.market.organicSignals?.score ?? '?'}/100
- Défensibilité : ${E.market.defensibility?.score ?? '?'}/100
- ${E.market?.perceivedSize ?? '?'} perçu / ${E.market?.realIntensity ?? '?'} réel · ${E.market?.saturation ?? '?'}

# MOTEUR MACRO
- Cycle : ${E.macro?.cyclePosition ?? '?'}
- VC segment : ${E.macro?.vcCapitalOnSegment ?? '?'}
- Fenêtre critique : ${E.macro?.criticalTimingWindow?.exists ? 'OUI ' + (E.macro?.criticalTimingWindow?.horizon || '') : 'Non'}
- Opportunité contracyclique : ${E.macro.contraryclicalOpportunity?.score ?? '?'}/100

# MOTEUR PATTERN MATCHING
- Archétype : ${E.patternMatching?.archetypeDominant ?? '?'}
- Top comparables : ${(E.patternMatching.comparables || []).slice(0, 3).map(c => `${c.name} (${c.proximity}%)`).join(' · ')}
- Benchmark rétrospectif : ${E.patternMatching?.retrospectiveBenchmark?.averageScore ?? '?'}/100

# MOTEUR RETOURNEMENT CAUSAL
- Score moyen angles morts (7 dimensions) : ${blindspotsAvg}/100
- Alertes : ${blindspotsAlertes}/7

# MOTEUR AVEUGLEMENT (12)
- Score global de vigilance : ${E.blindspotAnalysis.globalBlindspotScore || 0}/100
- Patterns détectés : ${aveuglementPatternsDetected}/10
- Patterns haute intensité : ${aveuglementHighIntensity}/10
- Alertes critiques : ${(E.blindspotAnalysis.alertesCritiques || []).slice(0, 5).join(' · ') || 'aucune'}
- Patterns historiques : ${(E.blindspotAnalysis.patternsHistoriques || []).map(p => `${p.case} (${p.outcome}, ${p.similarity}%)`).join(' · ') || 'aucun'}
- Synthèse : ${truncate(E.blindspotAnalysis.syntheseAveuglement, 500)}

# MOTEUR SINGULARITÉS CONTRARIENNES (13)
- Score global contrarien : ${E.contrarianAnalysis.globalContrarianScore || 0}/100
- Signaux détectés : ${contrarianSignalsDetected}/10
- Signaux haute force : ${contrarianHighStrength}/10
- Comparables contrariens : ${(E.contrarianAnalysis.comparablesContrariens || []).slice(0, 3).map(c => `${c.name} (${c.outcome})`).join(' · ') || 'aucun'}
- Synthèse : ${truncate(E.contrarianAnalysis.syntheseSingularite, 500)}

# DÉTAILS PATTERNS AVEUGLEMENT (top 5 haute intensité)
${Object.values(E.blindspotAnalysis.patterns || {})
  .filter((p: any) => p?.detected && p.intensity >= 50)
  .slice(0, 5)
  .map((p: any) => `- ${p.patternName} (${p.intensity}/100) : ${truncate(p.evidence, 200)}`)
  .join('\n') || 'Aucun pattern haute intensité détecté'}

# DÉTAILS SIGNAUX CONTRARIENS (top 5 haute force)
${Object.values(E.contrarianAnalysis.signals || {})
  .filter((s: any) => s?.detected && s.strength >= 50)
  .slice(0, 5)
  .map((s: any) => `- ${s.signalName} (${s.strength}/100) : ${truncate(s.evidence, 200)}`)
  .join('\n') || 'Aucun signal contrarien fort détecté'}
${narrativeDrift ? buildNarrativeDriftBlock(narrativeDrift, truncate) : ''}${fragiliteStructurelle ? buildFragiliteStructurelleBlock(fragiliteStructurelle, truncate) : ''}
${mechanicalComputed ? `

# SCORE MECANIQUE PRE-CALCULE (source de verite)

Le code a deja calcule le score global et derive le verdict de maniere
deterministe a partir des scores des moteurs Bloc 1 ci-dessus :

- SCORE GLOBAL : ${mechanicalScore.globalScore}/100
- VERDICT DERIVE : ${String(mechanicalScore.verdict).toUpperCase()}
- BASE DU CALCUL : ${mechanicalScore.basis?.label || 'les six dimensions.'}
- DECOMPOSITION :
${buildMechanicalDecompositionLines(mechanicalScore)}
- SEUILS : <45 = REFUSER, 45-59 = APPROFONDIR, 60-74 = INVESTIR AVEC CONDITIONS, >=75 = INVESTIR

TON ROLE A CHANGE : tu n es plus le juge qui decide du verdict, tu es le
NARRATEUR qui argumente le verdict deja calcule. Le score affiche au
partner sera ${mechanicalScore.globalScore}/100 et le verdict sera
${String(mechanicalScore.verdict).toUpperCase()}, point. Tu ne peux pas les changer.

Les dimensions marquees NON EVALUEE ci-dessus n ont pas ete instruites :
leur moteur n a pas abouti. Elles sont sorties de l assiette du calcul.
Tu ne dois ni leur attribuer une valeur, ni presenter leur silence comme
une absence de risque. Une dimension muette reste incertaine.

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

` : mechanicalStarved ? `

# SOCLE INSUFFISANT, AUCUN SCORE N EST PRODUIT

Le calcul mecanique n a pas abouti et ne produira pas de score sur ce run.
Trop de dimensions n ont pas ete instruites : leurs moteurs sont tombes,
ont ete coupes ou n ont rien rendu d exploitable.

- ETAT : SOCLE INSUFFISANT
- ${mechanicalScore.basis?.label || 'Assiette du calcul non declaree.'}
- DIMENSIONS RETENUES :
${buildMechanicalDecompositionLines(mechanicalScore)}

CE POINT EST NON NEGOCIABLE : il n y a pas de score a produire, et ce
n est pas a toi d en produire un. Le score affiche au partner sera
l etat SOCLE INSUFFISANT, pas un chiffre. N essaie ni de reconstituer
un score global, ni de deriver un verdict d instruction, ni de combler
les dimensions manquantes par une estimation. Les champs verdict et
globalScore de ton JSON seront ecrases par cet etat quoi que tu y mettes.

CE QUE TU DOIS FAIRE, ET RIEN D AUTRE :
- Ecrire ce que les moteurs qui ONT abouti etablissent reellement, sans
  extrapoler sur les axes muets
- Nommer explicitement ce qui n a pas pu etre instruit et ce que cela
  interdit de conclure
- Lister les decision drivers qui tiennent sur les seuls axes instruits
- Lister les conditions cles, a commencer par la reinstruction des axes
  manquants
- Ne pas produire de plan de chantiers fonde sur un verdict, il n y en
  a pas

` : ''}
Produis la recommandation finale avec :
1. ${mechanicalComputed ? 'Argumentation dense (voir SCORE MECANIQUE ci-dessus, le verdict est deja calcule)' : mechanicalStarved ? 'Argumentation dense sur les seuls axes instruits, sans score ni verdict' : 'Probabilité de succès chiffrée (et son inverse)'}
2. ${mechanicalNarrated ? 'Resolution de la tension blindspots/contrarian' : 'Score global avec seuils explicites'}
3. ${mechanicalNarrated ? 'Decision drivers (3-5 facteurs decisifs)' : 'Probabilités par dimension (6 dimensions avec poids)'}
4. ${mechanicalNarrated ? 'Conditions cles actionnables' : 'Résolution de la tension blindspots/contrarian'}
5. ${mechanicalComputed ? 'Plan de chantiers si applicable' : mechanicalStarved ? 'Ce que l absence de socle interdit de conclure' : 'Argumentation dense'}
6. ${mechanicalComputed ? 'Optionnel : assessorDisagreementRationale si tu es en desaccord motive' : mechanicalStarved ? 'Axes a reinstruire en priorite' : 'Conditions clés actionnables'}
7. ${mechanicalNarrated ? 'Narratif de retournement causal' : 'Decision drivers (3-5 facteurs décisifs)'}

Retourne uniquement le JSON structuré.${buildFundNoteBlock(fundNote, 'générale')}`;
}

/**
 * L ajustement du score par la tension entre Aveuglement et
 * Singularites contrariennes, et si son socle etait la.
 *
 * LA PROSE ETAIT PROTEGEE, LE CALCUL NE L ETAIT PAS
 *
 * Les deux lignes qui lisaient ces scores prenaient les racines brutes.
 * Le run b8d0e9ac s y est arrete, `Cannot read properties of null
 * (reading 'globalBlindspotScore')`, et a bascule en repli degrade :
 * Marche etait tombe, les quatre moteurs de la porte aval avec lui, et
 * Aveuglement arrivait nul. Le module engine-roots existe depuis
 * l incident c487a8b2 et ferme exactement cette classe ; il etait appele
 * dans le constructeur de prompt et pas ici. C est la dissymetrie que la
 * doctrine nomme : le canal visible est celui qu on relit et qu on
 * corrige, le canal muet est celui qui agit, et personne ne relit un
 * nombre.
 *
 * PROTEGER LA RACINE NE SUFFIT PAS, ET C EST LE POINT
 *
 * Une racine protegee ne leve plus, ce qui rendrait la suite fausse en
 * silence. Un moteur absent rend un score de zero, et zero traverse
 * l arithmetique comme une mesure : sur `blindspots-dominate` la
 * penalite vaut alors -15 exactement, tiree d un moteur qui n a jamais
 * tourne. Ce serait la garde inerte prise par l autre bout, un defaut
 * remplace par un chiffre plausible.
 *
 * Une tension arbitree entre deux moteurs dont l un n a pas tourne n est
 * pas une tension. L ajustement vaut donc zero parce qu il n a pas de
 * fondement, et non parce que les deux moteurs se seraient equilibres.
 * `socleAbsent` sort avec lui pour que le consommateur puisse dire
 * laquelle des deux raisons il lit.
 *
 * Exportee pour que son verrou entre par la porte de production : elle
 * vivait dans le corps de l orchestrateur, donc derriere un appel au
 * modele, donc intestable autrement qu en la recopiant.
 */
export function ajustementBlindspotsContrarien(
  tension: string | undefined | null,
  blindspotAnalysis: any,
  contrarianAnalysis: any,
): { ajustement: number; socleAbsent: boolean } {
  // L absence se lit sur les racines brutes, jamais sur les protegees :
  // celles-ci ont deja remplace le manque par un objet vide.
  const socleAbsent = blindspotAnalysis == null || contrarianAnalysis == null;
  if (socleAbsent) return { ajustement: 0, socleAbsent: true };

  const R = protectEngineRoots({ blindspotAnalysis, contrarianAnalysis });
  const blindspotScore = R.blindspotAnalysis.globalBlindspotScore || 0;
  const contrarianScore = R.contrarianAnalysis.globalContrarianScore || 0;

  if (tension === 'blindspots-dominate') {
    // Plus le blindspot score est haut, plus on penalise (max -25)
    return { ajustement: -Math.round(15 + (blindspotScore / 100) * 10), socleAbsent: false };
  }
  if (tension === 'contrarian-justifies') {
    // Plus le contrarian score est haut, plus on bonifie (max +15)
    return { ajustement: Math.round(5 + (contrarianScore / 100) * 10), socleAbsent: false };
  }
  return { ajustement: 0, socleAbsent: false };
}

export async function orchestrateFinalRecommendation(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput,
  // LE TYPE MENTAIT SUR CE QUI ARRIVE ICI
  //
  // Ces quatre etaient declares non-nullables alors que les deux
  // suivants, narrativeDrift et fragiliteStructurelle, portent depuis
  // toujours `| null` avec le commentaire qui l explique : « null si
  // moteur non applicable ou en echec ». Les quatre tombent exactement
  // de la meme facon, et plus souvent, puisqu ils dependent de la porte
  // [team, market, macro] : quand Marche echoue, les quatre arrivent
  // nuls. Le run b8d0e9ac s est arrete sur
  // `blindspotAnalysis.globalBlindspotScore` lu sur null et a bascule en
  // repli degrade.
  //
  // Le correctif n est pas d ajouter un chainage optionnel au site qui a
  // leve. Un `?.` repare la ligne qu on regarde et laisse les autres,
  // et il n y a aucun moyen de savoir lesquelles sans les chercher a la
  // main. Le type dit desormais ce qui arrive, et c est le compilateur
  // qui enumere : chaque lecture non gardee devient une erreur de
  // compilation, aujourd hui et au prochain champ ajoute.
  patternMatching: PatternMatchingOutput | null,
  causalReversal: CausalReversalOutput | null,
  blindspotAnalysis: BlindspotAnalysisOutput | null,
  contrarianAnalysis: ContrarianAnalysisOutput | null,
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
  /**
   * Sortie du moteur Lecture du langage (Narrative Drift V1). Optionnel,
   * passe en parametre pour que l orchestrator puisse integrer la lecture
   * du discours dans la resolution dialectique. null si moteur non
   * applicable ou en echec.
   */
  narrativeDrift?: import('./narrative-drift-engine').NarrativeDriftAnalysisOutput | null,
  /**
   * Sortie agregee du moteur Fragilite Structurelle (Bloc Phase 4 :
   * sept patterns). Optionnel. null si tous les patterns Phase 4 sont
   * non applicables ou en cas d echec global du moteur.
   */
  fragiliteStructurelle?: import('./fragility-structurelle/types').FragiliteStructurelleAnalysisOutput | null,
  /**
   * Flags de conflit d interet calcules en amont par
   * detectConflictsOfInterest. Si fourni et non vide, l orchestrateur
   * injecte un bloc ALERTE GOUVERNANCE en tete du userPrompt pour
   * que le LLM produise sa recommandation finale en pleine
   * conscience de la position d interet du fonds. Vide ou absent
   * pour les dossiers sans conflit detecte (cas majoritaire).
   */
  conflictOfInterest?: ConflictOfInterestFlag[] | null,
  /**
   * Identifiant du run en cours. Sert uniquement a rattacher les
   * lignes error_logs posees depuis ce moteur au dossier analyse.
   * null en mode persistence-off, ou la ligne analyses n existe pas.
   */
  analysisId?: string | null,
  /** Puits de mesure d appel LLM, optionnel. Renseigne par la route
   *  pour que le releve du run porte la duree et les tokens de la
   *  synthese, jamais mesures jusqu ici. */
  measure?: LlmMeasure,
): Promise<OrchestratedResult['finalRecommendation']> {

  // ============================================================
  // RACINES MOTEUR PROTEGEES
  // ------------------------------------------------------------
  // Toutes les sorties moteur dereferencees plus bas passent par E.
  // Une racine null y devient un objet vide, donc chaque
  // interpolation retombe sur le repli qu elle declarait deja au
  // lieu de lever. Cf lib/engines/engine-roots.ts pour la trace de
  // l incident qui a impose cette mecanique.
  //
  // Un moteur ajoute au prompt se protege en entrant dans cet objet.
  // narrativeDrift, fragiliteStructurelle, mechanicalScore et
  // conflictOfInterest n y entrent pas volontairement : ils
  // gouvernent des ternaires de presence, et un objet vide etant
  // truthy, les y faire passer construirait un bloc sur du vide.
  // ============================================================
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
    extraction?.sector,
    undefined,
    5,
  );
  const annotationsBlock = formatPastAnnotationsForPrompt(pastAnnotations);

  // Bloc ALERTE GOUVERNANCE injecte en tete si conflits detectes.
  // Chaine vide quand pas de signal, donc invisible dans le flow
  // majoritaire. Place avant les annotations pour que le LLM lise
  // l alerte avant tout le reste.
  const conflictBlock = buildConflictOfInterestBlock(conflictOfInterest ?? []);

  const userPrompt = buildOrchestratorUserPrompt({
    extraction,
    team,
    market,
    macro,
    patternMatching,
    causalReversal,
    blindspotAnalysis,
    contrarianAnalysis,
    fundNote,
    mechanicalScore,
    narrativeDrift,
    fragiliteStructurelle,
    conflictBlock,
    annotationsBlock,
  });

  // ============================================================
  // FENETRE ET PLAFOND DE LA SYNTHESE FINALE
  // ------------------------------------------------------------
  // Ce site etait reste sur le defaut client, 60s et une reprise, alors
  // que c est l appel le plus lourd du pipeline en contexte d entree.
  // Le run 0142901d l a vu sortir a 121 425 ms, soit exactement deux
  // tentatives de 60s, avec degraded=true et decisionDrivers vide : la
  // section Facteurs decisifs de la note est vide pour cette raison et
  // pour aucune autre.
  //
  // Le plafond passe de 8000 a 5000 tokens. Le commentaire qui occupait
  // ces lignes l annonçait deja, mot pour mot, sans que le code l ait
  // jamais applique. La sortie est un JSON de synthese compact, et ce
  // plafond reduit est ce qui finance la fenetre de 150s sans pousser
  // le chemin critique contre le mur : team passant de 150 a 180s,
  // toute la chaine glisse de 30s, il fallait les reprendre ici.
  // ============================================================
  const startedAt = Date.now();
  let { text: rawResponse, usage } = await callClaudeWithUsage(
    SYSTEM_PROMPT, userPrompt, ORCHESTRATE_MAX_TOKENS, MODEL,
    ENGINE_LLM_BUDGET.finalRecommendation,
  );
  addCall(measure, startedAt, usage, ORCHESTRATE_MAX_TOKENS);
  let recommendation: OrchestratedResult['finalRecommendation'];
  try {
    // Le contrat entre dans le try : la garde de reprise ci-dessous
    // vivait dans le catch d un parse et n etait donc jamais consultee
    // quand le parse reussissait sur une enveloppe vide. Un contrat qui
    // tombe leve desormais comme une malformation de JSON.
    recommendation = await parseEngineOutput<OrchestratedResult['finalRecommendation']>(
      'finalRecommendation',
      async () => rawResponse,
      { trace: measure, contractRetries: 0 },
    );
  } catch (firstErr: any) {
    // Reprise de parse conditionnelle, meme doctrine que reference-checks
    // au brief 15. Rejouer le meme prompt apres une coupure par
    // max_tokens reproduit la coupure : on paierait une fenetre pleine,
    // ici 150s, pour un echec certain. La reprise ne subsiste que pour
    // les malformations non deterministes d une sortie bien fermee.
    if (looksTruncated(rawResponse)) {
      console.warn('[orchestrator] JSON parse failed sur une sortie tronquee, pas de reprise :', firstErr?.message);
      throw firstErr;
    }
    console.warn('[orchestrator] JSON parse failed sur une sortie complete, reprise unique :', firstErr?.message);
    const retryStartedAt = Date.now();
    const retried = await callClaudeWithUsage(
      SYSTEM_PROMPT, userPrompt, ORCHESTRATE_MAX_TOKENS, MODEL,
      ENGINE_LLM_BUDGET.finalRecommendation,
    );
    addCall(measure, retryStartedAt, retried.usage, ORCHESTRATE_MAX_TOKENS);
    rawResponse = retried.text;
    recommendation = await parseEngineOutput<OrchestratedResult['finalRecommendation']>(
      'finalRecommendation',
      async () => rawResponse,
      { trace: measure, contractRetries: 0 },
    );
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

  // LA PROSE ETAIT PROTEGEE, LE CALCUL NE L ETAIT PAS
  //
  // Ces deux lignes lisaient les racines brutes. Le run b8d0e9ac s y est
  // arrete, `Cannot read properties of null (reading
  // 'globalBlindspotScore')`, et a bascule en repli degrade : Marche
  // etait tombe, les quatre moteurs de la porte aval avec lui, et
  // Aveuglement arrivait nul.
  //
  // Le module engine-roots existe depuis l incident c487a8b2 et ferme
  // exactement cette classe. Il etait appele dans le constructeur de
  // prompt et pas ici. C est la dissymetrie que la doctrine nomme : le
  // canal visible est celui qu on relit et qu on corrige, le canal muet
  // est celui qui agit. La prose ne levait plus, le score levait encore,
  // et personne ne l avait vu parce que personne ne relit un nombre.
  const tension = recommendation.blindspotsVsContrarian?.tensionResolved;
  const { ajustement: blindspotsContrarianAdjustment, socleAbsent } =
    ajustementBlindspotsContrarien(tension, blindspotAnalysis, contrarianAnalysis);
  // Lue une seule fois, protegee, et partagee par les deux gardes qui en
  // dependent. Elle valait `blindspotAnalysis.globalBlindspotScore` sur
  // la racine brute aux deux endroits.
  const blindspotScore = protectEngineRoots({ blindspotAnalysis }).blindspotAnalysis.globalBlindspotScore || 0;

  const finalComputedScore = Math.max(0, Math.min(100, weightedDimensionScore + blindspotsContrarianAdjustment));
  const llmScore = recommendation.globalScore || 0;
  const delta = finalComputedScore - llmScore;
  const absDelta = Math.abs(delta);

  // Seuils de divergence alignes sur 12 partout pour que tout desaccord
  // motive remonte visuellement (correction 3 de l audit score mecanique).
  // L incoherence historique 12 vs 15 produisait une plage 12-15 ou le
  // rationale du LLM apparaissait dans la note sans alerte UI associee.
  // Note : l alerte visuelle critique cote UI utilise un seuil
  // supplementaire adapte a l archetype (computedScoreBreakdown.
  // divergenceThreshold : 15 / 20 / 25). Ici c est le seuil universel
  // de remontee du desaccord motive.
  let auditNote = '';
  if (absDelta <= 5) {
    auditNote = 'Score LLM aligne avec le calcul mecanique (ecart <= 5 points).';
  } else if (absDelta <= 12) {
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
          await logError(buildScoreConvergenceLogEntry({
            amplitude,
            dimList,
            dims,
            llmScore,
            finalComputedScore,
            verdict: recommendation.verdict,
            analysisId,
          }));
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

  // Le socle absent neutralise aussi cette garde, et pour la meme
  // raison que l ajustement du score : une decote « selon l ampleur des
  // drapeaux rouges » calculee sur un moteur qui n a pas tourne mesure
  // son absence et non des drapeaux. C est le second site que le
  // compilateur a fait apparaitre en retirant la variable partagee, et
  // il n avait ete vu par personne : la ligne qui a leve dans le run
  // n etait pas la seule a lire ce score.
  if (socleAbsent) {
    // Rien a forcer : la dialectique qui fonde la decote n a pas eu lieu.
  } else if (tension === 'blindspots-dominate') {
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
  //
  // Trois etats, pas deux. Quand le socle est insuffisant, il n y a
  // pas de score mecanique a substituer, et le score du LLM ne doit
  // surtout pas prendre sa place par defaut : le laisser passer
  // reviendrait a rendre au modele exactement le pouvoir que ce
  // module lui a retire. Le verdict devient l etat terminal, le score
  // devient null, et les dimensions non evaluees ne sont pas
  // reportees comme des probabilites.
  // ============================================================
  if (mechanicalScore && isInsufficientBasis(mechanicalScore)) {
    // Capture avant ecrasement : ce que le modele aurait mis reste
    // trace pour l audit, sans jamais devenir le score affiche.
    const llmScoreSuggestion = typeof recommendation.globalScore === 'number'
      ? recommendation.globalScore
      : null;
    recommendation.globalScore = null as any;
    recommendation.verdict = INSUFFICIENT_BASIS_VERDICT as any;
    recommendation.successProbability = null as any;
    recommendation.failureProbability = null as any;
    recommendation.assessorDisagreement = { present: false } as any;

    // Seules les dimensions reellement instruites sont reportees. Une
    // dimension muette n a pas de probabilite de succes, et lui en
    // donner une la ferait entrer dans la note comme un axe evalue.
    recommendation.dimensionProbabilities = buildMechanicalDimensionProbabilities(mechanicalScore);

    recommendation.computedScoreBreakdown = {
      weightedDimensionScore: null,
      blindspotsContrarianAdjustment: 0,
      finalComputedScore: null,
      llmScore: llmScoreSuggestion,
      delta: null,
      auditNote: `Aucun score global n a ete produit sur ce run : ${mechanicalScore.basis?.label || 'le socle des dimensions evaluees est insuffisant.'} Le calcul n a pas ete rendu au moteur d orchestration, qui reste narrateur. Reinstruire le dossier une fois les moteurs manquants retablis.`,
      formula: mechanicalScore.formula,
      mechanicalDimensions: mechanicalScore.dimensions,
      thresholds: mechanicalScore.thresholds,
      divergenceThreshold: mechanicalScore.divergenceThreshold,
      archetype: mechanicalScore.archetype,
      scoreStatus: 'insufficient-basis',
      basis: mechanicalScore.basis,
    } as any;

    return recommendation;
  }

  if (mechanicalScore && hasComputedScore(mechanicalScore)) {
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
    // ou a la hausse pour rendre son verdict plus coherent. Les
    // dimensions non evaluees sont omises : sans moteur derriere, une
    // probabilite de succes serait une invention.
    recommendation.dimensionProbabilities = buildMechanicalDimensionProbabilities(mechanicalScore);

    // computedScoreBreakdown reflete le calcul mecanique deterministe.
    // divergenceThreshold et archetype sont propages depuis le score-
    // calculator pour que l UI adapte son bandeau d alerte rouge a
    // l archetype : un dossier hardware/biotech tolere un ecart plus
    // large entre LLM et mecanique sans crier au scandale visuellement.
    // Le seuil assessorDisagreement (>12) reste lui universel pour
    // remonter tout desaccord motive dans la note.
    recommendation.computedScoreBreakdown = {
      weightedDimensionScore: mechanicalScore.globalScore,
      blindspotsContrarianAdjustment: 0,
      finalComputedScore: mechanicalScore.globalScore,
      llmScore: llmGlobalScore,
      delta: scoreDelta,
      auditNote: significantDisagreement
        ? `Desaccord motive du moteur d orchestration : il aurait calibre a ${llmGlobalScore} (verdict ${llmVerdict}) si on lui avait laisse le choix. Le score affiche (${mechanicalScore.globalScore}, verdict ${mechanicalScore.verdict}) est issu du calcul mecanique. ${mechanicalScore.basis?.label || ''} Voir le champ assessorDisagreement pour le rationale du desaccord.`
        : `Score mecanique aligne avec le jugement structurel du moteur d orchestration (ecart ${Math.abs(scoreDelta)} points, verdict identique). ${mechanicalScore.basis?.label || ''}`,
      formula: mechanicalScore.formula,
      mechanicalDimensions: mechanicalScore.dimensions,
      thresholds: mechanicalScore.thresholds,
      divergenceThreshold: mechanicalScore.divergenceThreshold,
      archetype: mechanicalScore.archetype,
      scoreStatus: mechanicalScore.scoreStatus ?? 'computed',
      basis: mechanicalScore.basis,
    } as any;
  }

  return recommendation;
}
