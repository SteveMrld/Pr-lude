import { callClaude, parseJSON } from './anthropic-client';
import { gatherMarketRealData, type MarketRealData } from '../data-fetchers/sources';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from './source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from './editorial-voice';
import { buildFundNoteBlock, formatExtractionGeography } from './fund-context';
import type { ExtractionOutput, MarketAnalysisOutput } from './types';
import type { RelevanceMatrix } from './relevance-matrix';
import {
  buildSectoralPromptBlock,
  type SectoralContext,
} from './sectoral-injection';

const SYSTEM_PROMPT = `Tu es le Moteur d'Analyse de Marché de la plateforme Prélude. Tu reçois deux types de données :

1. Les données déclarées par le pitch deck (taille de marché annoncée, concurrents cités, traction)
2. Les données vérifiées par interrogation de sources publiques (Hacker News, OpenAlex concepts, Wikipedia, GitHub Topics)
${SOURCE_TAGGING_INSTRUCTION}
${EDITORIAL_VOICE_INSTRUCTION}

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

## Test critique de l'ère IA générative : réplicabilité par solo founder + Cursor
À l'ère où Claude Code, Cursor, v0 et Lovable permettent à un solo founder débrouillard de shipper un produit fonctionnel en quelques semaines, le code n'est plus une moat. Tu dois donc poser la question dérangeante mais essentielle : un solo founder équipé de ces outils pourrait-il répliquer l'essentiel de ce produit en trois mois ?

Si oui, le verdict de défensibilité doit être agressivement sceptique. Le produit n'est alors pas une boîte mais une fonctionnalité qui sera commoditisée. Ce qui doit alors faire la défense, en dehors du code, c'est :
- des données propriétaires (input data, telemetry, fine-tuning data, signaux d'usage)
- des network effects (marketplace, social, two-sided)
- une distribution acquise (relations entreprise, contrats régulés, brand consommateur)
- une profondeur réglementaire (santé, défense, banque, secteurs où la conformité prend des années)
- un AI flywheel (le produit s'améliore avec l'usage, l'asymétrie se creuse)
- un apprentissage métier propriétaire (vertical depth)

Tu dois identifier explicitement les composants techniques qui seraient triviaux à répliquer, et les facteurs qui vraiment ralentissent ou empêchent la réplication. Si tu ne trouves rien dans la deuxième catégorie, c'est un signal critique pour le verdict final.

## Comparables internationaux
Identifie 2-3 comparables internationaux pertinents par structure de défi.

## Recalibrage AI-native (nouveau pilier 2026)
Si le dossier construit son produit autour d'un LLM tiers (OpenAI, Anthropic, Mistral, etc.) ou s'appuie massivement sur l'IA générative comme infrastructure, tu dois remplir le bloc aiBusinessModel pour recalibrer les benchmarks classiques. Si la boîte n'utilise pas l'IA comme couche structurelle (SaaS classique, marketplace traditionnelle, etc.), mets isAiNative à false et classification à 'not_applicable'.

Pour les boîtes AI-native, trois fragilités structurelles cachées que les multiples affichés masquent :

1. La marge brute AI-native tourne à 50-65% au lieu de 80-90% pour le SaaS classique, parce que l'API d'Anthropic ou d'OpenAI mange le COGS. Une boîte qui annonce 80% de marge brute en étant AI-native ment ou n'a pas une fonction LLM significative dans son pipeline. Tu dois challenger les marges annoncées en estimant le poids du coût LLM.

2. La dépendance aux LLM providers crée un risque de concentration rarement modélisé. Pose la question : que se passe-t-il si Anthropic double ses prix d'API ? Si OpenAI bloque le compte ? Quelle est la sensitivity de la marge à un choc tarifaire de 50% ?

3. Le pari implicite est que le compute reste cher. Si DeepSeek ou les modèles open weight commoditisent l'inférence, les wrappers valent zéro. Tu dois évaluer le commoditizationRisk : low si la boîte a des moats au-delà du LLM (RAG propriétaire, fine-tuning custom, vertical depth), high ou extreme si c'est un pur wrapper.

Classification suggérée :
- pure_wrapper : interface chat ou RAG basique sur LLM tiers, sans données propriétaires ni vertical depth. Risque de commoditisation extrême.
- ai_native_with_moats : LLM au cœur du produit mais avec données propriétaires, fine-tuning custom, ou network effects. Risque modéré.
- ai_augmented_classic : SaaS classique avec features IA ajoutées. Marge proche du SaaS classique, risque faible.
- not_applicable : produit sans usage de l'IA générative comme infrastructure.

## Matrice concurrentielle binaire
Tu produis une matrice concurrentielle de référence (modèle factsheet conseil M&A type Idinvest) :
- 8-12 dimensions sectorielles pertinentes (capacités, fonctionnalités, géographies, segments servis, etc.) ADAPTÉES au secteur du dossier. Pas de dimensions génériques fades. Les dimensions doivent être les CRITÈRES DE DÉCISION D'ACHAT des clients du secteur.
- 5-8 players évalués : la startup analysée + ses concurrents directs cités dans le deck + les concurrents réels du marché que tu connais
- Pour chaque combinaison player × dimension, true (capacité présente) ou false (absent)
- Calcul du score de différenciation : combien de dimensions où la startup a un √ alors qu'aucun concurrent ne l'a
- Exemple type IDVIU-VR : dimensions = ['distribution', 'playback multiplatform', 'platform channels', 'interactivity', '3d engine', 'secure video', 'tracking/analysis', 'tag', 'billing', 'synch', 'api/sdk']. Players = ['IDVIU-VR', 'Jaunt', 'NextVR', 'Oculus', 'Google', etc.]

## Cohérence déclaré vs vérifié
NOUVEAU PILIER. Identifie les zones où les sources publiques confirment le pitch (signaux organiques mesurables, écosystème actif), les zones non vérifiables (taille TAM annoncée invérifiable), et les écarts (concurrents cités versus concurrents réels du marché).

# RESPECT DU VERDICT DE PERTINENCE

Tu reçois dans le user prompt un bloc "VERDICT DE PERTINENCE" calcule en amont par la matrice de pertinence Prelude. Le verdict te dit, sur la base de criteres structurels du dossier (chaine de production, presence de dependance LLM), si les sous-blocs aiReplicability et aiBusinessModel sont applicables full / partial / none. Tu dois respecter strictement ce verdict :

- Si aiReplicability = none : le bloc defensibility.aiReplicability doit refleter une non-applicabilite. verdict = 'protected', timeToReplicate = 'non applicable', reasoning court qui acte que le produit est hors software (hardware physique, infrastructure, biotech humide, service regule a barriere humaine). Pas de speculation sur "un solo founder avec Cursor pourrait reproduire" : ce n est pas le cas pour ce type de produit. Les protectingFactors listent les barrieres physiques ou reglementaires concretes du dossier.

- Si aiReplicability = partial : tu evalues la reproductibilite uniquement sur la couche software identifiee dans le scope (interface, dashboard, portail client, modules SaaS). reasoning explicite que cette evaluation porte sur cette couche-la et pas sur le coeur physique. replicableComponents liste les composants software, protectingFactors liste ce qui n est pas exposable a l IA.

- Si aiReplicability = full : evaluation complete habituelle.

- Si aiBusinessModel = none : le champ aiBusinessModel doit avoir isAiNative=false, classification='not_applicable', et les autres champs en valeurs neutres ('non applicable'). Pas d evaluation de marges AI-native, pas de risque de commoditisation, pas de redFlags ou sustainableSignals : la boite n utilise pas de LLM tiers comme infrastructure.

- Si aiBusinessModel = full : evaluation complete sur les marges erodees, dependance LLM, commoditization risk.

Ce verdict prevaut sur la grille generique : le partner ne veut pas un commentaire AI-replicability force sur un dossier deeptech infrastructure marine, ni un commentaire AI-business-model sur un cabinet d avocats.

# CALIBRATION DES TROIS SOUS-SCORES MARKET - CHIFFRES OBLIGATOIRES

Les trois sous-scores organicSignals, needIntensity et defensibility composent
le score Marche global du dossier. Ces trois scores DOIVENT etre chiffres
entre 0 et 100 dans CHAQUE analyse, sans exception. Le silence des sources
publiques (Hacker News, Google Trends, Reddit) ne justifie JAMAIS un score
absent ou null : il appelle un score chiffre base sur ce que tu peux deduire
du pitch et du contexte sectoriel, accompagne d un rationale qui documente
sur quoi le score repose et ce qui reste a verifier en DD.

GRILLE NEED INTENSITY (intensite du besoin client)
- 80-90 : pain point critique avec consequence chiffree (perte revenue,
  risque reglementaire, risque vie). Clients prets a payer cher des
  maintenant. Ex : compliance obligatoire, panne couteuse, douleur
  physique aigue, deadline reglementaire.
- 60-75 : besoin reel et reconnu, budget existant chez les acheteurs
  cibles, mais workarounds en place. Migration prevue mais non urgente.
- 40-55 : nice-to-have utile, ROI demontrable mais pas critique.
  Acheteurs sensibles au prix, cycles de vente longs.
- 20-35 : confort ou productivite marginale. Beneficie d un budget
  innovation plus que d un budget operationnel.
- 5-15 : besoin invente, solution en quete de probleme, aucune
  douleur articulee dans le pitch.

GRILLE DEFENSIBILITY (moats et durabilite de l avantage)
- 80-90 : moats structurels combines (network effect double face +
  donnees proprietaires accumulees + integration profonde + switching
  cost eleve). Replicabilite tres difficile au-dela de 18 mois.
- 60-75 : un ou deux moats clairs (AI flywheel sur donnees, distribution
  acquise, brevets coeur, integration technique deep). Replicabilite
  6-12 mois sans l asset clef.
- 40-55 : differenciation produit reelle mais sans moat structurel.
  Avantage de timing et d execution. Replicabilite 3-6 mois pour un
  acteur capitalise.
- 20-35 : produit fonctionnel sans element defensif, marche commoditisable.
  Wrapper LLM, copie d UI, agregateur sans donnees. Replicabilite
  inferieure a 3 mois avec Cursor + Claude Code.
- 5-15 : aucune barriere identifiable, projet meme replicable au mois.

GRILLE ORGANIC SIGNALS (preuves de traction bottom-up)
- 80-90 : signaux multiples convergents (HN points eleves multi-threads,
  Reddit communaute active, Google Trends en hausse soutenue, GitHub stars
  growth ou waitlist publique substantielle). Preuves verifiables en
  source ouverte.
- 60-75 : un ou deux signaux organiques presents mais isoles. Mentions
  presse niche, debut de communaute. Pas encore de momentum mesurable.
- 40-55 : silence relatif des sources publiques mais coherent avec le
  stade (pre-seed, B2B confidentiel, marche regule). Pas de signal
  contradictoire.
- 20-35 : silence des sources publiques sur un dossier qui aurait du
  laisser des traces vu son stade ou son segment. Signal d alerte
  faible.
- 5-15 : sources publiques contradictoires avec le pitch (tendance
  declinante revendiquee comme croissance, communaute hostile, presse
  negative substantielle).

Documente dans chaque rationale le palier applique ET sur quoi tu te bases.
Exemple :
"organicSignals 45/100 (palier 40-55, silence coherent avec le stade) :
dossier seed B2B sur infrastructure de recharge, pas de presence HN ou
Reddit attendue a ce stade. World Bank et IEA confirment marche en
expansion sectorielle, ce qui valide partiellement. A reverifier en DD
sur les signaux LinkedIn et presse specialisee."

# FORMAT JSON OBLIGATOIRE

Les trois premiers champs (perceivedSize, realIntensity, saturation) sont REQUIS et tu choisis toujours une option meme si le dossier est ambigu ou hybride. Tu ne laisses JAMAIS ces champs vides ou absents. Si tu hesites, tu choisis l option mediane (large, medium, fragmented) et tu motives ton choix dans organicSignals.rationale. C est mieux d avoir un signal calibre meme imparfait qu une note d investissement avec des sections vides.

{
  "perceivedSize": "massive" ou "large" ou "niche",
  "realIntensity": "extreme" ou "high" ou "medium",
  "saturation": "saturated" ou "fragmented" ou "emerging",
  "marketSizing": {
    "tam": {
      "value": "ex. '47Mds$ d ici 2032' ou 'non chiffré'",
      "timeframe": "ex. '2032', '2025', 'horizon 2030'",
      "source": "ex. 'Pitchbook Drone Industry Report 2024', 'Maddyness 2025', 'pitch deck'",
      "confidence": "high | medium | low"
    },
    "sam": {
      "value": "ex. '8.5Mds$ segment cargo BVLOS Europe 2030'",
      "timeframe": "ex. '2030'",
      "source": "ex. 'Frost & Sullivan European UAV Cargo 2024'",
      "methodology": "ex. 'TAM mondial × 18% Europe × 32% segment cargo certifié'"
    },
    "som": {
      "value": "ex. '425M$ horizon 5 ans'",
      "timeframe": "ex. 'horizon 2030, soit 5 ans'",
      "methodology": "ex. '5% du SAM, hypothèse aggressive avec leadership européen'"
    },
    "sizingNarrative": "synthèse 3-5 phrases qui explique le sizing TAM/SAM/SOM en croisant sources web et claims du pitch. Si écart majeur, l expliquer.",
    "pitchAlignment": "aligned | overestimated | underestimated | pitch-not-cited",
    "pitchAlignmentNote": "1-2 phrases si écart entre TAM cité dans pitch et TAM vérifié"
  },
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
    "vulnerabilities": ["vulnérabilités identifiées"],
    "aiReplicability": {
      "verdict": "high_risk | medium_risk | protected",
      "timeToReplicate": "ex. 'moins de 3 mois', '6-12 mois', '18+ mois', 'non répliquable sans accès régulé'",
      "reasoning": "3-5 phrases qui expliquent pourquoi ce produit serait facile ou difficile à répliquer par un solo founder + Cursor + Claude Code, en explicitant ce qui ralentit la réplication au-delà du code lui-même",
      "protectingFactors": ["facteurs concrets qui ralentissent ou empêchent la réplication : données propriétaires, network effects, distribution acquise, régulation, AI flywheel, apprentissage métier"],
      "replicableComponents": ["composants techniques triviaux à répliquer avec des outils IA modernes : interface, API wrapper, intégrations standard, etc."]
    }
  },
  "internationalBenchmarks": [
    { "name": "nom", "geography": "pays", "relevance": "pertinence de l'analogie" }
  ],
  "aiBusinessModel": {
    "isAiNative": true ou false,
    "isLlmWrapper": true ou false,
    "classification": "pure_wrapper | ai_native_with_moats | ai_augmented_classic | not_applicable",
    "grossMarginEstimate": "ex. '50-60%', 'inferieure a 50%', 'inconnu'",
    "grossMarginRationale": "1-2 phrases qui expliquent pourquoi cette marge brute, en pointant explicitement le coût LLM API qui mange le COGS si applicable",
    "llmProviderConcentration": "ex. 'Anthropic 70%, OpenAI 20%, internal models 10%' ou 'pas de dependance LLM' si non-AI",
    "aiTaxSensitivity": "qu'arrive-t-il à la marge si le LLM provider augmente ses prix de 50% ? Estimation chiffrée si possible",
    "commoditizationRisk": "low | medium | high | extreme",
    "commoditizationReasoning": "pourquoi ce niveau de risque face à DeepSeek, modèles open weight, baisse du coût d'inférence",
    "multipleAdjustment": "narration : un multiple AI-native de 90x ARR n'est pas comparable à 30x SaaS classique. Quel multiple appliquer pour comparer équitablement ?",
    "redFlags": ["wrapper sans données propriétaires, dépendance unique fournisseur LLM, marge brute trop optimiste vs réalité AI-native, etc."],
    "sustainableSignals": ["RAG propriétaire, fine-tuning custom, vertical depth, AI flywheel, distribution acquise, etc."]
  },
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
}

# REGLE CRITIQUE SUR marketSizing

Le bloc marketSizing est OBLIGATOIRE. Sans chiffrage TAM/SAM/SOM, une note
d investissement est inacceptable pour un partner d IC. Tu DOIS remplir
les 3 niveaux meme si tu dois faire des estimations. Voici la hierarchie
de qualite des sources :

  1. PRIORITE 1 : chiffre issu d une recherche web verifiable.
     Sources de reference (par ordre de fiabilite) :
       - Rapports analystes : Pitchbook, Gartner, Forrester, IDC,
         Frost & Sullivan, Mordor Intelligence, Markets and Markets,
         Statista (entreprise reports)
       - Analyses VC : Atomico State of European Tech, Crunchbase
         News, CB Insights, Dealroom
       - Presse specialisee : Sifted, TechCrunch, Maddyness, Les Echos
         Capital Finance, La Tribune, Defense News, Aviation Week
       - Banques d affaires : rapports JPM, Goldman, BCG, McKinsey
     Tu DOIS faire 1-2 recherches web specifiques pour le sizing :
       - "[secteur] market size 2024 2025"
       - "[sous-secteur] TAM forecast 2030"

  2. PRIORITE 2 : chiffre cité dans le pitch avec un grain de sel.
     Si le pitch cite un TAM, label-le explicitement source='Pitch deck'
     et ajoute une note dans pitchAlignmentNote sur la credibilite.

  3. PRIORITE 3 : calcul deductif a partir de chiffres verifies.
     Ex. "TAM mondial 47Mds$ × 18% part Europe (Eurostat) = 8.5Mds$ SAM Europe"
     Le calcul doit etre explicite dans methodology.

  4. SI VRAIMENT INTROUVABLE : value='non chiffré' avec source='aucune
     source fiable trouvée après [N] recherches web' et explication
     dans sizingNarrative. Mais c est un dernier recours, pas la norme.

REGLE CRITIQUE SUR pitchAlignment :
  - 'aligned' : TAM/SAM du pitch cohérents avec sources web (écart <30%)
  - 'overestimated' : pitch surestime de 30%+ (red flag classique)
  - 'underestimated' : pitch sous-estime (rare, signal positif)
  - 'pitch-not-cited' : le pitch ne donne pas de TAM (red flag de rigueur)

Le bloc sizingNarrative doit toujours croiser pitch et verite web :
"Le pitch revendique X. Sources web indiquent Y. L écart de Z% s explique par..."


# UTILISATION DU WEB SEARCH (si l outil est disponible)

Si le tool web_search est disponible, utilise-le pour :
  1. Verifier la taille reelle du marche cite (TAM/SAM) via recherches
     comme "[secteur] market size 2024 2025" ou rapports analystes
     (Gartner, Pitchbook, Atomico SoET, BCG, McKinsey).
  2. Identifier les concurrents reels du secteur que le pitch n a pas
     mentionnes (red flag classique : un pitch qui dit "concurrents :
     aucun" alors qu en realite il y en a 5-10).
  3. Verifier les claims commerciaux specifiques (clients, contrats,
     partenariats annonces).
  4. Calibrer la dynamique competitive avec presse recente.

REGLE DE PRUDENCE : 2-3 recherches max. Privilegie les requetes qui
revelent un signal binaire : le marche existe-t-il a la taille
revendiquee ? Les concurrents sont-ils nombreux ou rares ?

INTEGRATION : tout chiffre cite (TAM, market size, croissance) doit
provenir SOIT du dossier, SOIT d une source web verifiable. JAMAIS
d hallucination de chiffre. Cite la source quand pertinent.`;

export async function analyzeMarket(
  extraction: ExtractionOutput,
  fundNote?: string | null,
  relevanceMatrix?: RelevanceMatrix | null,
  sectoralContext?: SectoralContext | null,
): Promise<MarketAnalysisOutput & { realData?: MarketRealData }> {
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
  realDataSummary += `Sources interrogées : ${(realData.sourcesQueried || []).join(', ') || 'aucune'}\n`;
  realDataSummary += `Sources avec résultats : ${(realData.sourcesFound || []).join(', ') || 'AUCUNE'}\n\n`;

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

  // Construction du bloc clients/pipeline avec distinction explicite des
  // statuts. Critique pour eviter que le LLM amalgame discussions, LOI,
  // POC gratuits et clients payants en une masse indifferenciee de
  // 'traction'. Bug constate sur le rapport UP&CHARGE : 6 POCs annonces
  // (pour beaucoup en LOI ou en discussion) presentes comme equivalents
  // a des clients payants.
  const clientsBlock = (() => {
    const clients = extraction.clientsNamed || [];
    if (clients.length === 0) return 'Aucun client nomme dans le pitch.';

    const buckets: Record<string, typeof clients> = {
      client_paye: [],
      pilot_paye: [],
      contrat_signe: [],
      pilot_gratuit: [],
      devis_signature: [],
      loi_signee: [],
      discussion_avancee: [],
      discussion_initiee: [],
      mentionne: [],
      autre: [],
    };
    for (const c of clients) {
      const r = (c.relationship || 'mentionne').toLowerCase().replace(/\s+/g, '_');
      if (r in buckets) buckets[r].push(c);
      else buckets.autre.push(c);
    }
    const order: Array<[string, string]> = [
      ['client_paye', 'CLIENTS PAYANTS (revenue effectif et recurrent)'],
      ['pilot_paye', 'POC PAYES (contractuels)'],
      ['contrat_signe', 'CONTRATS SIGNES (sans revenue encore)'],
      ['pilot_gratuit', 'POC GRATUITS / SUBVENTIONNES (NE PAS ASSIMILER A DES CLIENTS PAYANTS)'],
      ['devis_signature', 'DEVIS EN COURS DE SIGNATURE'],
      ['loi_signee', 'LOI SIGNEES (lettres d intention non engageantes)'],
      ['discussion_avancee', 'DISCUSSIONS AVANCEES'],
      ['discussion_initiee', 'DISCUSSIONS INITIEES (simple contact)'],
      ['mentionne', 'MENTIONNES SANS PRECISION DE LIEN'],
      ['autre', 'AUTRES'],
    ];
    let block = '';
    for (const [key, label] of order) {
      const list = buckets[key];
      if (list.length === 0) continue;
      block += `\n${label} (${list.length}) :\n`;
      for (const c of list) {
        block += `  - ${c.name}${c.company ? ' (' + c.company + ')' : ''}\n`;
      }
    }
    return block.trim();
  })();

  // Bloc verdict de pertinence : indique au LLM si aiReplicability et
  // aiBusinessModel sont applicables au dossier. Le moteur s adapte
  // en consequence. Si pas de matrice fournie, comportement legacy.
  const relevanceBlock = relevanceMatrix
    ? `
--- VERDICT DE PERTINENCE (matrice Prelude) ---

Sous-bloc aiReplicability : ${relevanceMatrix.verdicts.marketAiReplicability.applicable.toUpperCase()}
${relevanceMatrix.verdicts.marketAiReplicability.scope.length > 0 ? `Scope : ${relevanceMatrix.verdicts.marketAiReplicability.scope.join(', ')}` : ''}
Rationale : ${relevanceMatrix.verdicts.marketAiReplicability.rationale}

Sous-bloc aiBusinessModel : ${relevanceMatrix.verdicts.marketAiBusinessModel.applicable.toUpperCase()}
${relevanceMatrix.verdicts.marketAiBusinessModel.scope.length > 0 ? `Scope : ${relevanceMatrix.verdicts.marketAiBusinessModel.scope.join(', ')}` : ''}
Rationale : ${relevanceMatrix.verdicts.marketAiBusinessModel.rationale}

Criteres structurels detectes :
- Asset class : ${relevanceMatrix.assetClass}
- Modele business : ${relevanceMatrix.businessModel}
- Chaine de production : ${relevanceMatrix.productionChain}
- Reproductibilite numerique : ${relevanceMatrix.digitalReproducibility}${relevanceMatrix.digitalReproducibilityFactors.length > 0 ? ` (${relevanceMatrix.digitalReproducibilityFactors.join(', ')})` : ''}

Tu adaptes ta reponse au verdict ci-dessus. Si applicable=none sur un sous-bloc, tu remplis le champ JSON avec les valeurs neutres specifiees dans la section RESPECT DU VERDICT, sans inventer une evaluation generique.
`
    : '';

  const sectoralBlock = buildSectoralPromptBlock(sectoralContext, 'market');

  const userPrompt = `${sectoralBlock}# DONNÉES DÉCLARÉES (extraction du pitch deck)
Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${formatExtractionGeography(extraction)}

Pitch marché : ${extraction.marketPitch}
Produit : ${extraction.productDescription}
Business model : ${extraction.businessModel}

Traction : ${JSON.stringify(extraction.traction)}
Concurrents cités dans le pitch : ${(extraction.competitorsCited || []).join(', ') || 'Aucun'}

# PIPELINE COMMERCIAL DECLARE PAR STATUT
${clientsBlock}

REGLE STRICTE D INTERPRETATION DU PIPELINE :
- Un POC gratuit / subventionne N EST PAS un client paye. Il valide la
  faisabilite technique, pas la disposition a payer ni la capacite du
  modele economique a degager une marge.
- Une LOI signee N EST PAS un contrat. C est une intention non engageante
  qui se convertit historiquement entre 20% et 50% selon le secteur.
- Une discussion avancee N EST PAS une signature. Ne pas extrapoler de
  pipeline en MEur a partir de discussions.
- Un client paye recurrent est le seul indicateur de traction commerciale
  validee. Compter les clients payants reels avant tout.
- Si le pitch presente du 'pipeline potentiel' en MEur calcule sur des
  POCs ou LOI, signaler dans defensibility.weaknesses ou dans
  organicSignals.gaps que cette extrapolation est non auditee.

${realDataSummary}
${relevanceBlock}

Croise déclaré et vérifié pour produire l'analyse au format JSON structuré demandé.${buildFundNoteBlock(fundNote, 'marché')}`;

  // Niveau 2.A v2 : web search active sur 4 recherches max (1-2 dediees
  // au sizing TAM/SAM/SOM + 2-3 pour concurrents/dynamique)
  const rawResponse = await callClaude(
    SYSTEM_PROMPT,
    userPrompt,
    9000,
    undefined,
    { maxWebSearches: 4 },
  );
  const analysis = parseJSON<MarketAnalysisOutput>(rawResponse);

  // Audit du tagging des sources (Niveau 2.B)
  const audit = auditTagging(analysis, 'market-engine');
  if (audit.level !== 'ok') {
    console.warn('[market-engine] tagging audit:', audit.message);
  }

  // Normalisation defensive : le LLM peut omettre certains champs
  // typees strict (perceivedSize, realIntensity, saturation) quand le
  // dossier est ambigu (cas Hello Planet : secteur ESG/RSE formation
  // hybride, le LLM n a pas tranche entre niche/large/massive et a
  // omis le champ). On assigne des defauts neutres pour eviter que la
  // note d investissement tombe sur des sections vides, et on log un
  // warning pour que le probleme remonte au monitoring.
  const normalized: MarketAnalysisOutput = {
    perceivedSize: (analysis.perceivedSize || 'large') as 'massive' | 'large' | 'niche',
    realIntensity: (analysis.realIntensity || 'medium') as 'extreme' | 'high' | 'medium',
    saturation: (analysis.saturation || 'fragmented') as 'saturated' | 'fragmented' | 'emerging',
    marketSizing: analysis.marketSizing,
    organicSignals: analysis.organicSignals || { score: 50, rationale: 'Signaux organiques non instruits.', evidence: [] },
    needIntensity: analysis.needIntensity || { score: 50, rationale: 'Intensite du besoin non instruite.', gap: '' },
    defensibility: analysis.defensibility || { score: 50, moats: [], vulnerabilities: [] } as any,
    internationalBenchmarks: analysis.internationalBenchmarks || [],
    aiBusinessModel: analysis.aiBusinessModel,
    competitiveMatrix: analysis.competitiveMatrix,
    competitiveDynamic: analysis.competitiveDynamic || '',
  } as MarketAnalysisOutput;

  // Preserver les autres champs du analysis original qui ne sont pas
  // explicitement listes ci-dessus (futurs ajouts, champs optionnels).
  const merged = { ...analysis, ...normalized };

  // Post-processing deterministe selon la matrice de pertinence.
  // Extrait en fonction pure pour permettre des tests unitaires
  // independants du LLM et du fetcher reseau.
  applyMarketVerdictPostProcessing(merged, relevanceMatrix);

  // Log si on a du normaliser, pour suivre la frequence du probleme
  // sans casser la pipeline.
  const wasIncomplete = !analysis.perceivedSize || !analysis.realIntensity || !analysis.saturation
    || !analysis.organicSignals || !analysis.needIntensity || !analysis.defensibility;
  if (wasIncomplete) {
    console.warn('[market-engine] output partiel detecte, normalisation appliquee. Champs manquants:', {
      perceivedSize: !analysis.perceivedSize,
      realIntensity: !analysis.realIntensity,
      saturation: !analysis.saturation,
      organicSignals: !analysis.organicSignals,
      needIntensity: !analysis.needIntensity,
      defensibility: !analysis.defensibility,
    });
  }

  return { ...merged, realData };
}

/**
 * Post-processing deterministe du resultat market selon la matrice
 * de pertinence. Si la matrice dit qu un sous-bloc IA n est pas
 * applicable, on construit un bloc deterministe qui reflete la
 * non-applicabilite structurelle au lieu d une speculation
 * generique. Le LLM est invite a respecter le verdict via le
 * system prompt, mais ce post-processing ferme la porte des
 * derives.
 *
 * Mute merged sur place et le retourne. Si relevanceMatrix est
 * null ou undefined, retourne merged inchange.
 */
export function applyMarketVerdictPostProcessing(
  merged: MarketAnalysisOutput,
  relevanceMatrix?: RelevanceMatrix | null,
): MarketAnalysisOutput {
  if (!relevanceMatrix) return merged;

  if (relevanceMatrix.verdicts.marketAiReplicability.applicable === 'none' && merged.defensibility) {
    const factors = relevanceMatrix.digitalReproducibilityFactors;
    (merged.defensibility as any).aiReplicability = {
      verdict: 'protected',
      timeToReplicate: 'non applicable',
      reasoning: `Produit hors software pur : la reproduction par IA n est pas une menace pertinente pour ce dossier. ${factors.join('. ')}.`,
      protectingFactors: factors.length > 0 ? factors : ['chaine de production physique ou regulee non duplicable par logiciel'],
      replicableComponents: [],
    };
  }

  if (relevanceMatrix.verdicts.marketAiBusinessModel.applicable === 'none') {
    merged.aiBusinessModel = {
      isAiNative: false,
      isLlmWrapper: false,
      classification: 'not_applicable',
      grossMarginEstimate: 'non applicable',
      grossMarginRationale: 'Modele economique sans dependance structurelle a un LLM tiers : la grille AI-native ne s applique pas.',
      llmProviderConcentration: 'non applicable',
      aiTaxSensitivity: 'non applicable',
      commoditizationRisk: 'low',
      commoditizationReasoning: 'Pas d exposition au compute LLM puisque pas de dependance LLM tiers detectee.',
      multipleAdjustment: 'non applicable',
      redFlags: [],
      sustainableSignals: [],
    };
  }

  return merged;
}
