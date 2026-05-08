// ============================================================
// NARRATIVE DRIFT ENGINE - Moteur d analyse de derive narrative
// ------------------------------------------------------------
// Tourne en transversal sur les dossiers Series A tardif et au
// dela ou il y a matiere narrative accumulee a analyser. Mesure
// le glissement progressif du langage depuis le concret vers
// l abstrait, par triple analyse :
//
//   - Axe 1 : Glissement des indicateurs (KPIs cosmetiques,
//             extinction de KPIs, time-to-reality gap)
//   - Axe 2 : Opacite progressive (volatilite narrative,
//             temperature emotionnelle, CEO media-time)
//   - Axe 3 : Narrative Premium Collapse (internal reality
//             leak, strategic desperation)
//
// La taxonomie lexicale calibree (lib/narrative-drift/) calcule
// les metriques objectives en amont. Le LLM ne juge pas la
// derive sur ses impressions, il interprete des chiffres
// reproductibles. Garde-fou central contre l hallucination.
// ============================================================

import { callClaude, parseJSON } from './anthropic-client';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from './source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from './editorial-voice';
import { scoreText, type NarrativeDriftMetrics } from '../narrative-drift/score-text';
import type { ExtractionOutput } from './types';

// ============================================================
// TYPES DE SORTIE
// ============================================================

export type AxisVerdict = 'sain' | 'attention' | 'alerte' | 'drapeau-rouge' | 'non-applicable';

export interface AxisAnalysis {
  score: number; // 0-100, plus haut = plus de derive detectee
  verdict: AxisVerdict;
  rationale: string;
  evidencePro: string[];
  evidenceContra: string[];
  confidence: number; // 0-100, refletant la qualite des sources disponibles
  subModules: Record<string, {
    status: 'detected' | 'not-applicable' | 'unresolved' | 'sain';
    intensity?: number;
    evidence?: string;
  }>;
}

export interface NarrativeDriftAnalysisOutput {
  applicabilite: 'full' | 'partial' | 'weak-signal' | 'not-applicable';
  applicabiliteRationale: string;

  // Metriques objectives calculees mecaniquement (pas par LLM)
  metriquesLexicales: {
    densiteConcrete: number;
    ratioAbstraitConcret: number;
    opaciteScore: number;
    totalWordsAnalyses: number;
    topAbstractWords: Array<{ word: string; count: number }>;
    topConcreteWords: Array<{ word: string; count: number }>;
  };

  // Trois axes d analyse LLM (s appuyant sur les metriques)
  glissementIndicateurs: AxisAnalysis;
  opaciteProgressive: AxisAnalysis;
  narrativePremiumCollapse: AxisAnalysis;

  // Score et verdict global
  globalDriftScore: number; // 0-100
  verdict: 'sain' | 'attention' | 'alerte' | 'drapeau-rouge';

  // Counter-archetype identifie : la boite la plus proche par profil narratif
  counterArchetype: {
    closest: string; // ex 'Stripe', 'WeWork', 'Theranos'
    direction: 'sain' | 'derive-confirmee';
    rationale: string;
  };

  // Trajectory si re-evaluation contre une analyse anterieure
  trajectory?: {
    deltaRatio: number;
    deltaDensite: number;
    interpretation: 'aggravation' | 'stabilisation' | 'amelioration';
    rationale: string;
  };

  recommandationDD: string;
  audit?: ReturnType<typeof auditTagging>;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es le Moteur d'Analyse de Derive Narrative de la plateforme Prelude.

${SOURCE_TAGGING_INSTRUCTION}
${EDITORIAL_VOICE_INSTRUCTION}

# CADRE D ANALYSE

Tu analyses la communication d une entreprise (pitch deck, interviews fondateurs,
communiques de presse, posts LinkedIn) pour detecter le glissement progressif du
langage depuis le concret vers l abstrait. Hypothese fondatrice : plus le reel
devient fragile, plus le langage devient abstrait.

Tu recois en entree DEUX TYPES de donnees :

1. DES METRIQUES LEXICALES OBJECTIVES calculees mecaniquement par une taxonomie
   reproductible (densite concrete, ratio abstrait/concret, score opacite). Ces
   chiffres ne sont PAS hallucinables. Ils sont la base de ton analyse. Tu dois
   les interpreter, pas les contester.

2. LE TEXTE DES COMMUNICATIONS lui-meme, pour analyse qualitative complementaire
   (volatilite narrative, KPIs cosmetiques, fuites de realite interne, etc.).

# REGLE D OR ANTI-HALLUCINATION

Tu ne dois JAMAIS conclure a une derive narrative sur la base d impressions ou
de tonalites percues. Chaque assertion doit s appuyer SOIT sur les metriques
lexicales objectives en input, SOIT sur des CITATIONS textuelles datees du
corpus fourni. Si tu ne peux pas citer un passage precis, tu ne peux pas
conclure. C est ta protection contre l effet horoscope.

Pour chaque axe, tu produis une evidencePro ET une evidenceContra. La symetrie
est obligatoire : l evidence contraire empeche les conclusions trop rapides.
Si l evidence contraire pese autant que l evidence pro, le verdict de l axe
est 'attention' et non 'alerte', et le rationale doit le dire.

# AXE 1 : GLISSEMENT DES INDICATEURS

Mesure si les KPIs presentes par la boite glissent dans le temps depuis le
concret vers l abstrait, ou si certains KPIs disparaissent.

Trois sous-modules :

- COSMETIC_PRECISION : detection des KPIs cosmetiques. Un chiffre precis utilise
  comme alibi de credibilite mais peripherique au business model. Exemple : une
  boite SaaS qui annonce 23 minutes d engagement utilisateur sans communiquer
  son ARR ni son churn. Le chiffre existe mais sert d ecran de fumee. Ne se
  declenche que si tu peux pointer le KPI cosmetique ET nommer le KPI fondamental
  manquant.

- KPI_EXTINCTION : disparition progressive de KPIs anterieurement cites. Necessite
  un baseline historique (deux versions de communication a 12 mois d ecart) pour
  s activer. En son absence, status='not-applicable'.

- TIME_TO_REALITY_GAP : depuis combien de temps un objectif ou une promesse est
  reportee. Profitabilite annoncee dans 18 mois, puis encore 18 mois, puis encore.
  Necessite des dates et des references precises pour s activer.

# AXE 2 : OPACITE PROGRESSIVE

Mesure la densite de jargon abstrait non contextualise et les indices d evitement
du concret dans la communication.

Trois sous-modules :

- NARRATIVE_VOLATILITY : combien de fois la boite a change d identite, de
  categorie marche, de definition. WeWork real estate puis community puis
  consciousness. Trois repositionnements en deux ans = signal fort. Necessite
  des citations datees pour s activer.

- EMOTIONAL_TEMPERATURE : signature emotionnelle des fondateurs. Hyper-optimisme
  soudain, defensivite, hostilite analystes, grandiloquence, moralisation,
  victimisation. CONDITION STRICTE D ACTIVATION : trois passages textuels cites
  explicitement, dates, et contraste avec un baseline anterieur du meme fondateur.
  Sans ces trois passages, status='unresolved' et tu n affirmes rien. Le risque
  d horoscope est maximal sur ce sous-module.

- CEO_MEDIA_TIME : ratio apparitions medias generalistes ou lifestyle vs medias
  techniques metier. CONDITION STRICTE : ne se declenche QUE si combine a au
  moins un autre axe negatif ET si tu peux mesurer un changement dans la
  frequence (pas un absolu). Pris isolement, ce signal est trompeur (Patrick
  Collison parle de progress studies sans que Stripe soit en derive). Sois
  attentif aux biais culturels (en France, des CEOs publient regulierement
  des tribunes au Monde sans que ce soit un signal de fragilite) et aux biais
  de genre (une CEO femme dans Vogue n est pas par defaut suspecte).

# AXE 3 : NARRATIVE PREMIUM COLLAPSE

Mesure le decalage entre la narration et les fondamentaux. Quand le recit
s eloigne mesurablement des chiffres reels, la prime narrative s accumule.

Deux sous-modules :

- INTERNAL_REALITY_LEAK : triangulation entre recit externe et traces internes
  indirectes. La boite revendique de l hypergrowth mais Glassdoor montre du
  turnover senior, GitHub activity baisse, presse specialisee se demande, etc.
  Necessite au moins deux sources externes contradictoires avec le recit pour
  s activer.

- STRATEGIC_DESPERATION : multiplication d annonces, partenariats, verticales,
  features comme signe de desespoir et non de force. CONDITION STRICTE de
  jonction : ne se declenche QUE si tu detectes egalement une derive sur
  l Axe 1 (KPIs qui glissent) OU l Axe 3 (narrative premium). Pris isolement,
  Apple a multiplie les verticales sans desespoir, Amazon idem, Microsoft sous
  Nadella idem. Sans cette jonction obligatoire, status='not-applicable'.

# COUNTER-ARCHETYPES

Tu dois identifier le counter-archetype le plus proche du dossier analyse. Cela
sert de garde-fou contre la projection hative d un cas pedagogique :

Archetypes confirmes (drift documente) : Theranos (refus structure de chiffres,
moralisation extreme), WeWork (passage real estate puis community puis
consciousness), FTX (substitution exchange par infrastructure), Quibi
(substitution video platform par content revolution), Nikola (revendications
techniques non etayees), Cazoo (scale industriel sans validation P&L), Fast
checkout (multiplication features sans rentabilite), MoviePass (modele
subventionne).

Counter-archetypes sains (vraie sobriete) : Stripe (precision systematique meme
en parlant de mission), Datadog (chiffres financiers et techniques denses),
Snowflake (rigueur S-1 reference), Atlassian (sobriete narrative durable),
Adyen (constance financiere), HubSpot (changement de KPIs justifie strategique
ment), Amazon (discours historiquement concret), Nvidia (technique au coeur de
toute communication).

Tu nommes le counter-archetype le plus proche et tu expliques en deux phrases
pourquoi le profil narratif s en rapproche, en citant des elements concrets.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1-2 phrases qui justifient le niveau d application",
  "glissementIndicateurs": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthese en 2-3 phrases",
    "evidencePro": ["citation 1 datee", "citation 2 datee"],
    "evidenceContra": ["citation 1 contra", "citation 2 contra"],
    "confidence": 0-100,
    "subModules": {
      "COSMETIC_PRECISION": { "status": "detected | not-applicable | unresolved | sain", "intensity": 0-100, "evidence": "citation" },
      "KPI_EXTINCTION": { "status": "...", "intensity": 0-100, "evidence": "..." },
      "TIME_TO_REALITY_GAP": { "status": "...", "intensity": 0-100, "evidence": "..." }
    }
  },
  "opaciteProgressive": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "...",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100,
    "subModules": {
      "NARRATIVE_VOLATILITY": { ... },
      "EMOTIONAL_TEMPERATURE": { ... },
      "CEO_MEDIA_TIME": { ... }
    }
  },
  "narrativePremiumCollapse": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "...",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100,
    "subModules": {
      "INTERNAL_REALITY_LEAK": { ... },
      "STRATEGIC_DESPERATION": { ... }
    }
  },
  "globalDriftScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "counterArchetype": {
    "closest": "nom de boite",
    "direction": "sain | derive-confirmee",
    "rationale": "2 phrases"
  },
  "recommandationDD": "1-2 phrases de recommandation pour la due diligence"
}

# CALIBRATION DU globalDriftScore

Le score global est pondere comme suit :
- Glissement indicateurs : 0.40 (pilier le plus discriminant historiquement)
- Opacite progressive : 0.35
- Narrative premium collapse : 0.25

Et CONTRAINTE : si les metriques lexicales objectives (en input) montrent un
ratio abstrait/concret > 2.0 ou une densite concrete < 15 mots/1000, le
globalDriftScore ne peut pas etre inferieur a 70. Inversement, si le ratio est
< 0.3 et la densite > 80, le score ne peut pas depasser 30 sans evidence
qualitative tres forte.

Cette contrainte garantit que le score LLM reste coherent avec les metriques
objectives. Si tu veux contredire les metriques, tu dois le justifier
explicitement dans le rationale en citant des elements qualitatifs decisifs.`;

// ============================================================
// FONCTION PRINCIPALE
// ============================================================

export interface NarrativeDriftInput {
  extraction: ExtractionOutput;
  pitchText: string; // texte extrait du pitch deck
  additionalCommunications?: string[]; // interviews, communiques, posts LinkedIn
  previousAnalysisMetrics?: {
    densiteConcrete: number;
    ratioAbstraitConcret: number;
    timestamp: string;
  } | null;
  fundNote?: string | null;
}

export async function analyzeNarrativeDrift(
  input: NarrativeDriftInput,
): Promise<NarrativeDriftAnalysisOutput> {
  // ETAPE 1 : Calcul des metriques lexicales objectives
  // On agrege tous les corpus disponibles en un seul texte pour obtenir
  // une mesure consolidee. Le LLM verra le detail par source plus loin.
  const allText = [
    input.pitchText || '',
    ...(input.additionalCommunications || []),
  ].join('\n\n');

  const metrics: NarrativeDriftMetrics = scoreText(allText);

  // ETAPE 2 : Determiner l applicabilite
  // Critere : il faut au moins 200 mots de communication pour produire une
  // analyse statistiquement defendable. En dessous, status='weak-signal'.
  // Si pas de pitch text du tout, 'not-applicable'.
  let applicabilite: NarrativeDriftAnalysisOutput['applicabilite'];
  let applicabiliteRationale: string;

  if (metrics.totalWords === 0) {
    applicabilite = 'not-applicable';
    applicabiliteRationale = 'Aucun corpus textuel exploitable.';
  } else if (metrics.totalWords < 200) {
    applicabilite = 'weak-signal';
    applicabiliteRationale = `Corpus trop court (${metrics.totalWords} mots). Analyse en confiance reduite.`;
  } else if ((input.additionalCommunications || []).length === 0) {
    applicabilite = 'partial';
    applicabiliteRationale = 'Pitch deck disponible mais pas de baseline narratif externe (interviews, communiques). Analyse partielle.';
  } else {
    applicabilite = 'full';
    applicabiliteRationale = `Corpus suffisant (${metrics.totalWords} mots, ${(input.additionalCommunications || []).length} sources externes).`;
  }

  // Si non-applicable, on retourne directement sans appel LLM
  if (applicabilite === 'not-applicable') {
    return buildEmptyOutput(metrics, applicabilite, applicabiliteRationale);
  }

  // ETAPE 3 : Construction du user prompt
  const userPrompt = buildUserPrompt(input, metrics);

  // ETAPE 4 : Appel LLM
  // callClaude(systemPrompt, userPrompt, maxTokens, model, options)
  const rawResponse = await callClaude(
    SYSTEM_PROMPT,
    userPrompt,
    4000,
  );

  const parsed = parseJSON<NarrativeDriftAnalysisOutput>(rawResponse);

  // ETAPE 5 : Injection des metriques objectives (le LLM ne peut pas les
  // alterer, elles sont calculees mecaniquement en amont).
  parsed.metriquesLexicales = {
    densiteConcrete: metrics.densiteConcrete,
    ratioAbstraitConcret: metrics.ratioAbstraitConcret,
    opaciteScore: metrics.opaciteScore,
    totalWordsAnalyses: metrics.totalWords,
    topAbstractWords: metrics.topAbstractWords,
    topConcreteWords: metrics.topConcreteWords,
  };
  parsed.applicabilite = applicabilite;
  parsed.applicabiliteRationale = applicabiliteRationale;

  // ETAPE 6 : Calcul de la trajectory si baseline anterieur fourni
  if (input.previousAnalysisMetrics) {
    const deltaRatio = metrics.ratioAbstraitConcret - input.previousAnalysisMetrics.ratioAbstraitConcret;
    const deltaDensite = metrics.densiteConcrete - input.previousAnalysisMetrics.densiteConcrete;
    let interpretation: 'aggravation' | 'stabilisation' | 'amelioration';
    if (deltaRatio > 0.3 || deltaDensite < -20) interpretation = 'aggravation';
    else if (deltaRatio < -0.3 || deltaDensite > 20) interpretation = 'amelioration';
    else interpretation = 'stabilisation';
    parsed.trajectory = {
      deltaRatio,
      deltaDensite,
      interpretation,
      rationale: `Variation depuis ${input.previousAnalysisMetrics.timestamp} : ratio ${deltaRatio >= 0 ? '+' : ''}${deltaRatio.toFixed(2)}, densite ${deltaDensite >= 0 ? '+' : ''}${deltaDensite.toFixed(0)} mots/1000.`,
    };
  }

  // ETAPE 7 : Audit de tagging (anti-hallucination)
  parsed.audit = auditTagging(parsed, 'narrative-drift');

  return parsed;
}

// ============================================================
// HELPERS
// ============================================================

function buildUserPrompt(input: NarrativeDriftInput, metrics: NarrativeDriftMetrics): string {
  const company = input.extraction.companyName || 'la societe analysee';
  const sector = input.extraction.sector || 'non precise';
  const stage = input.extraction.fundraise?.stage || 'non precise';

  const metricsBlock = `# METRIQUES LEXICALES OBJECTIVES (input externe, non hallucinable)

Total mots analyses : ${metrics.totalWords}
Densite concrete : ${metrics.densiteConcrete.toFixed(1)} mots/1000 (sain >= 30, alerte < 15)
Ratio abstrait/concret : ${metrics.ratioAbstraitConcret.toFixed(2)} (sain < 0.3, alerte > 1.0, drapeau rouge > 2.0)
Score opacite : ${metrics.opaciteScore.toFixed(1)}% (semi-abstraits non contextualises par chiffres adjacents)

Verdict mecanique de la taxonomie : ${metrics.verdict.toUpperCase()}
Rationale : ${metrics.rationale}

Top 5 mots abstraits dans le corpus : ${metrics.topAbstractWords.slice(0, 5).map(w => `${w.word} (${w.count}x)`).join(', ') || 'aucun'}
Top 5 mots concrets dans le corpus : ${metrics.topConcreteWords.slice(0, 5).map(w => `${w.word} (${w.count}x)`).join(', ') || 'aucun'}`;

  const corpusBlock = `# CORPUS A ANALYSER

## Pitch deck (texte extrait)

${input.pitchText.slice(0, 8000)}${input.pitchText.length > 8000 ? '\n\n[texte tronque]' : ''}

${(input.additionalCommunications || []).map((c, i) => `## Communication externe ${i + 1}\n\n${c.slice(0, 3000)}`).join('\n\n')}`;

  const trajectoryBlock = input.previousAnalysisMetrics
    ? `# BASELINE ANTERIEUR DISPONIBLE

Une analyse precedente du ${input.previousAnalysisMetrics.timestamp} avait mesure :
- Densite concrete : ${input.previousAnalysisMetrics.densiteConcrete.toFixed(1)} mots/1000
- Ratio abstrait/concret : ${input.previousAnalysisMetrics.ratioAbstraitConcret.toFixed(2)}

Tu peux activer le sous-module KPI_EXTINCTION et la lecture trajectory.`
    : `# PAS DE BASELINE ANTERIEUR

Pas d analyse precedente disponible. Le sous-module KPI_EXTINCTION ne peut pas
s activer faute de comparaison temporelle. Mets son status='not-applicable'.`;

  return `Dossier : ${company} (secteur ${sector}, stade ${stage}).

${metricsBlock}

${corpusBlock}

${trajectoryBlock}

Produis l analyse au format JSON specifie dans les instructions systeme. Sois
rigoureux : chaque assertion doit s appuyer sur les metriques objectives
ci-dessus OU sur des citations textuelles datees du corpus. Pas d impression,
pas de tonalite percue, pas de generalite.`;
}

function buildEmptyOutput(
  metrics: NarrativeDriftMetrics,
  applicabilite: NarrativeDriftAnalysisOutput['applicabilite'],
  rationale: string,
): NarrativeDriftAnalysisOutput {
  const emptyAxis: AxisAnalysis = {
    score: 0,
    verdict: 'non-applicable',
    rationale: 'Non applicable : corpus textuel insuffisant.',
    evidencePro: [],
    evidenceContra: [],
    confidence: 0,
    subModules: {},
  };

  return {
    applicabilite,
    applicabiliteRationale: rationale,
    metriquesLexicales: {
      densiteConcrete: metrics.densiteConcrete,
      ratioAbstraitConcret: metrics.ratioAbstraitConcret,
      opaciteScore: metrics.opaciteScore,
      totalWordsAnalyses: metrics.totalWords,
      topAbstractWords: metrics.topAbstractWords,
      topConcreteWords: metrics.topConcreteWords,
    },
    glissementIndicateurs: emptyAxis,
    opaciteProgressive: emptyAxis,
    narrativePremiumCollapse: emptyAxis,
    globalDriftScore: 0,
    verdict: 'sain',
    counterArchetype: {
      closest: 'non determine',
      direction: 'sain',
      rationale: 'Corpus insuffisant pour identifier un archetype proche.',
    },
    recommandationDD: 'Recolter au moins une communication externe (pitch deck, interview, communique) avant de relancer l analyse.',
  };
}
