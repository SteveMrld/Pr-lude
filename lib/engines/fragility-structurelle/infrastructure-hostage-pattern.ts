// ============================================================
// INFRASTRUCTURE HOSTAGE - PATTERN PHASE 4
// ------------------------------------------------------------
// Implémentation TypeScript de la doctrine écrite dans
// docs/patterns/infrastructure-hostage.md.
//
// Pattern : entreprise dont la valeur, la marge ou la capacité
// à opérer dépend d un fournisseur d infrastructure tiers qui
// peut unilatéralement modifier les termes (prix, accès, policy)
// sans alternative viable à court terme.
//
// Trois axes :
//   - Axe 1 : intensité de la dépendance critique
//             (concentration COGS technique, nombre fournisseurs
//              critiques, switching cost)
//   - Axe 2 : pouvoir de marché du fournisseur
//             (asymétrie taille, cannibalisation directe, track
//              record changements unilatéraux, position dominante)
//   - Axe 3 : path to déverrouillage
//             (plan documenté réduction dépendance, progrès
//              mesurable, architecture portable)
//
// Le pattern est universellement applicable à l ère IA générative
// parce que la concentration des fournisseurs critiques (OpenAI,
// Anthropic, Nvidia, AWS, Stripe, App Stores) est devenue
// systémique. Il s active dès Series A pour les SaaS et IA.
// ============================================================

import { callClaude, parseJSON } from '../anthropic-client';
import { auditTagging } from '../source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from '../editorial-voice';
import { SOURCE_TAGGING_INSTRUCTION } from '../source-tagging';
import { normalizeFrText } from '../../data/text-normalize';
import type {
  PatternAnalysisOutput,
  PatternInput,
  PatternId,
  PatternVerdict,
  PatternApplicability,
  PatternAxisAnalysis,
} from './types';
import {
  type PatternModule,
  type PatternApplicabilityCheck,
  buildNotApplicableOutput,
  hasMinimalFinancialSignal,
  applyCentralAxisGating,
} from './pattern-interface';
import { registerPattern } from './orchestrator';
import type { ExtractionOutput, FinancialDataExtraction } from '../types';
import { buildSectoralPromptBlock } from '../sectoral-injection';
import {
  buildArchetypePromptBlock,
  decorateCounterArchetype,
  type ArchetypeAxis,
} from '../archetype-selector';

const PATTERN_ID: PatternId = 'infrastructure-hostage';
const ARCHETYPE_AXIS: ArchetypeAxis = 'infrastructure-hostage';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior spécialiste de la captivité infrastructurelle des
entreprises SaaS, IA et plateformes numériques. Tu analyses le pattern
Infrastructure Hostage sur ce dossier : dépendance critique à un fournisseur
externe qui peut unilatéralement modifier les termes de l accès, du prix, de
la disponibilité ou de la policy d usage sans alternative viable à 90 jours.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas la simple existence d une dépendance, qui est inévitable.
C est l asymétrie de pouvoir et l absence de chemin de sortie. Tu dois nommer
le fournisseur précis, le service utilisé, le pourcentage de dépendance ou la
mesure d asymétrie, et citer la source.

Tu ne conclus pas à Infrastructure Hostage sur des impressions du type cette
boîte est trop dépendante à OpenAI. Tu dois nommer la dépendance avec son
chiffre.

# AXE 1 : INTENSITÉ DE LA DÉPENDANCE CRITIQUE

Mesure quantitative de la concentration des fournisseurs sur la stack technique
et économique. Trois sous-modules :

- COGS_CONCENTRATION : part du COGS technique allouée aux trois plus gros
  fournisseurs externes. Si un seul fournisseur représente plus de 40% du
  COGS technique, signal fort. Plus de 60%, drapeau-rouge. Pour un wrapper
  GPT pur, le ratio peut atteindre 90% avec OpenAI.

- CRITICAL_VENDOR_COUNT : nombre de fournisseurs critiques sans alternative
  réaliste à 90 jours. Critique signifie que la panne ou la rupture du
  fournisseur arrête l opération. Trois ou plus, applicabilité full.

- SWITCHING_COST_HIGH : switching cost mesuré en mois-homme et en euros.
  Au-delà de 6 mois ou 1 million d euros pour une PME-ETI, le switching cost
  rend la menace crédible.

# AXE 2 : POUVOIR DE MARCHÉ DU FOURNISSEUR

Mesure l asymétrie de pouvoir. Quatre sous-modules :

- SIZE_ASYMMETRY : le fournisseur est-il 100x, 1000x plus gros en
  capitalisation, en revenu, en effectifs ? OpenAI face à Jasper, ratio
  capitalisation 200x. Apple face à une app indie, ratio 10000x.

- CANNIBALIZATION_RISK : le fournisseur peut-il sortir un produit qui rend
  l entreprise non pertinente ? Très haut pour les wrappers d API LLM, où
  OpenAI a déjà remplacé une dizaine de catégories de produits par des
  features intégrées.

- UNILATERAL_HISTORY : le fournisseur a-t-il déjà modifié unilatéralement
  les termes dans les 24 derniers mois ? Apple ATT 2021, OpenAI policy
  relationship apps 2023, AWS egress fees 2024, Twitter API monetization
  2023.

- VENDOR_DOMINANCE : position dominante du fournisseur sur son marché.
  Nvidia sur GPU IA training environ 95%. AWS plus Azure plus GCP cumulés
  environ 65% du cloud public.

# AXE 3 : PATH TO DÉVERROUILLAGE

Mesure de la capacité réelle de l entreprise à réduire sa dépendance. C est
le mitigant majeur. Trois sous-modules :

- EXIT_PLAN_DOCUMENTED : existence d un plan documenté avec milestones
  chiffrés, calendrier, et budget. Multi-cloud, fine-tuning local, build
  interne, contrats long-terme, diversification processeurs paiement.

- MEASURABLE_PROGRESS_12M : progrès mesurable depuis 12 mois sur l exécution
  du plan. Pourcentage de charge migrée, contrats signés second fournisseur,
  recrutements explicitement portability-focused. Un plan qui dort sans
  exécution n est pas un mitigant.

- PORTABLE_ARCHITECTURE : architecture portable par construction. Kubernetes
  vanilla, Postgres open-source, modèles open-weight self-hosted sont
  portables. DynamoDB, Lambda, Vertex AI, Azure OpenAI Service sont
  captifs. La portabilité architecturale est un mitigant majeur même en
  l absence de plan explicite.

__ARCHETYPE_BLOCK__

La distinction n est jamais le simple fait de dépendre d un fournisseur. C est
l asymétrie, l absence de plan de sortie et l absence de différenciation
au-dessus du fournisseur. Une dépendance diversifiée, contractualisée et
adossée à une valeur produite spécifiquement au-dessus de l infrastructure
n est pas Infrastructure Hostage, même si la concentration nominale paraît
élevée.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 à 2 phrases qui justifient le niveau d application",
  "axis1": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthèse 2-3 phrases sur l intensité de dépendance",
    "evidencePro": ["citation 1 datée avec tag", "citation 2 datée avec tag"],
    "evidenceContra": ["citation 1 contra", "citation 2 contra"],
    "confidence": 0-100
  },
  "axis2": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthèse sur pouvoir de marché du fournisseur",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "axis3": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthèse sur path to déverrouillage",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases de synthèse éditoriale du pattern sur ce dossier",
  "counterArchetype": {
    "closest": "nom de boîte",
    "direction": "trajectoire-saine | derive-confirmee",
    "rationale": "2 phrases"
  },
  "recommandationDD": "1 phrase concrète pour orienter la DD"
}

# CONTRAINTE DE COHÉRENCE

Si plus de 60% du COGS technique sur un seul fournisseur ET aucun plan de
bascule documenté, alors globalScore >= 70 forcé.

Si moins de 25% de COGS sur le fournisseur le plus gros ET architecture
portable documentée, alors globalScore <= 30 sauf evidence forte de
cannibalisation directe.

# SPÉCIFICITÉ WRAPPERS LLM

Pour les wrappers d API LLM pure-play en seed sans plan de différenciation
articulé, score >= 75 forcé avec direction derive-confirmee, parce que la
trajectoire est connue (Jasper, Copy.ai, première génération wrappers GPT
disparue en 2023).

# RÈGLE ANTI-HINDSIGHT

Tu évalues le dossier au moment du stage indiqué, pas avec des
événements TERMINAUX survenus après ce stage. Le hindsight strictement
interdit concerne : faillite confirmée, IPO ratée ou ultérieure,
scandale révélé a posteriori, pivot effectué plus tard, exit ultérieur,
ralentissement sectoriel documenté plus tard. Tu ne dois PAS citer ces
événements dans tes évidences ni les utiliser pour scorer.

EN REVANCHE, les pipelines en cours d élaboration publique AU STAGE
DU DOSSIER restent utilisables et doivent même être exploités :
propositions de directives publiées, lois adoptées mais en période de
transposition, enquêtes ouvertes par autorités de régulation,
jurisprudences en cours, deadlines déjà annoncées, signaux de
ralentissement déjà visibles dans la presse sectorielle au stage.
Confondre hindsight avec ignorance volontaire des signaux publics
disponibles au stage est une faute aussi grave qu utiliser le
hindsight lui-même.

Tu rendras un diagnostic comme un partner senior qui aurait dû
trancher au moment du stage avec les informations effectivement
disponibles à cette date, y compris les signaux faibles publics.

# RÈGLE DE GATING AXE CENTRAL (AXE 1)

L axe 1 (intensité de la dépendance critique) est l axe identitaire
d Infrastructure Hostage.

DÉFINITION DE L APPLICABILITÉ : l axe 1 est applicable à tout dossier
qui a une stack technique ou économique identifiable, ce qui couvre la
quasi-totalité des entreprises commerciales modernes (logiciel, SaaS,
IA, plateforme, fintech, hardware avec composants critiques tiers,
DTC avec fournisseurs clés). Si l axe est applicable tu DOIS produire
un verdict parmi sain, attention, alerte ou drapeau-rouge. En absence
de signaux de fragilité (architecture diversifiée, multi-cloud,
contrats long terme négociés, switching cost faible documenté), le
verdict correct est SAIN avec score 0-25, pas not-applicable. Une
entreprise avec dépendances diversifiées ou propres infrastructures
(Salesforce sur ses propres infras, Snowflake multi-cloud par
construction, Adyen avec licences bancaires propres, Stripe avec plus
de cinq processeurs en parallèle, GitLab portable on-premise) est
SAIN sur cet axe, pas not-applicable. Sain est le cas par défaut quand
la dépendance est gérable et alignée sur la valeur produite.

NOT_APPLICABLE EST RÉSERVÉ AUX CAS OÙ L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : modèle physique pur sans couche logicielle
ni dépendance critique tiers (manufacture textile traditionnelle avec
fournisseurs interchangeables, services entièrement humains type
cabinet conseil pur sans SaaS propriétaire, exploitation agricole),
holding pure de participations sans opération propre. Hors ces cas,
l axe est applicable et le verdict doit être coté.

Si l axe 1 est légitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern et globalScore = 0
(le moteur le forcera à null en aval).

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface StackSnapshot {
  /** Mots-clés infrastructure détectés dans le pitch ou le BP */
  vendorMentions: string[];
  /** Mots-clés d auto-portabilité ou de multi-cloud */
  portabilitySignals: string[];
  /** Stage et asset class qui contextualisent l attaque */
  stage: string;
  sector: string;
}

const KNOWN_VENDORS = [
  'OpenAI', 'Anthropic', 'Google', 'Gemini', 'AWS', 'Azure', 'GCP',
  'Stripe', 'Adyen', 'Apple', 'App Store', 'Google Play', 'Nvidia',
  'TSMC', 'Cloudflare', 'Vercel', 'Supabase', 'Firebase', 'Twilio',
  'SendGrid', 'Salesforce', 'HubSpot', 'Shopify', 'Meta', 'Facebook',
];

const PORTABILITY_KEYWORDS = [
  'multi-cloud', 'multi cloud', 'kubernetes', 'on-premise', 'on premise',
  'open-source', 'open source', 'self-hosted', 'open weight', 'open-weight',
  'fine-tuning local', 'fine tuning local', 'portable', 'portability',
];

function extractStackSnapshot(extraction: ExtractionOutput): StackSnapshot {
  const text = [
    extraction.marketPitch,
    extraction.productDescription,
    extraction.businessModel,
    (extraction as any).rawSummary,
  ].filter(Boolean).join(' ');

  const vendorMentions = KNOWN_VENDORS.filter((v) =>
    new RegExp(`\\b${v.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(text),
  );

  const portabilitySignals = PORTABILITY_KEYWORDS.filter((k) =>
    normalizeFrText(text).includes(k),
  );

  return {
    vendorMentions,
    portabilitySignals,
    stage: extraction.fundraise?.stage ?? 'inconnu',
    sector: extraction.sector ?? 'inconnu',
  };
}

function buildUserPrompt(input: PatternInput): string {
  const e = input.extraction;
  const snap = extractStackSnapshot(e);
  const sectoralBlock = buildSectoralPromptBlock(input.sectoralContext, 'fragility-structurelle');

  return `${sectoralBlock}# DOSSIER À ANALYSER

Entreprise : ${e.companyName ?? 'non communiqué'}
Secteur : ${snap.sector}
Stade : ${snap.stage}
Pays : ${e.country ?? 'non communiqué'}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# PRODUIT

${e.productDescription ?? '(non fourni)'}

# MODÈLE ÉCONOMIQUE

${e.businessModel ?? '(non fourni)'}

# SIGNAUX INFRASTRUCTURE DÉTECTÉS AU PRE-SCREEN

Fournisseurs cités : ${snap.vendorMentions.length > 0 ? snap.vendorMentions.join(', ') : 'aucun fournisseur connu cité explicitement'}
Signaux de portabilité : ${snap.portabilitySignals.length > 0 ? snap.portabilitySignals.join(', ') : 'aucun signal de portabilité détecté'}

# RÉSUMÉ GÉNÉRAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TÂCHE

Analyse ce dossier sur le pattern Infrastructure Hostage selon les trois axes
détaillés dans tes instructions. Si les fournisseurs cités au pre-screen ne
correspondent pas à la réalité (par exemple le pitch parle d AWS mais ne le
cite pas explicitement), corrige sur la base du contenu. Retourne uniquement
le JSON conforme au format obligatoire, sans préambule.`;
}

// ============================================================
// PARSE ET CONVERSION VERS PatternAnalysisOutput
// ============================================================

interface RawLLMOutput {
  applicabilite: PatternApplicability;
  applicabiliteRationale: string;
  axis1: PatternAxisAnalysis;
  axis2: PatternAxisAnalysis;
  axis3: PatternAxisAnalysis;
  globalScore: number;
  verdict: PatternVerdict;
  resumeEditorial: string;
  counterArchetype: PatternAnalysisOutput['counterArchetype'];
  recommandationDD: string;
}

function llmOutputToPatternOutput(raw: RawLLMOutput): PatternAnalysisOutput {
  const allEvidence = [
    ...raw.axis1.evidencePro, ...raw.axis1.evidenceContra,
    ...raw.axis2.evidencePro, ...raw.axis2.evidenceContra,
    ...raw.axis3.evidencePro, ...raw.axis3.evidenceContra,
  ];
  const auditResult = auditTagging(allEvidence.join(' '), 'infrastructure-hostage-pattern');

  return {
    patternId: PATTERN_ID,
    applicabilite: raw.applicabilite,
    applicabiliteRationale: raw.applicabiliteRationale,
    globalScore: raw.globalScore,
    verdict: raw.verdict,
    resumeEditorial: raw.resumeEditorial,
    axis1: raw.axis1,
    axis2: raw.axis2,
    axis3: raw.axis3,
    counterArchetype: raw.counterArchetype,
    recommandationDD: raw.recommandationDD,
    auditTrail: {
      sourceTags: [
        auditResult.stats.pitchTagged > 0 ? 'pitch' : '',
        auditResult.stats.webTagged > 0 ? 'web' : '',
        auditResult.stats.inferenceTagged > 0 ? 'inference' : '',
        auditResult.stats.corpusTagged > 0 ? 'corpus' : '',
      ].filter(Boolean),
      claimsChiffres: allEvidence.filter((e) => /\d/.test(e)),
    },
  };
}

// ============================================================
// PRE-EVALUATION D APPLICABILITE
// ============================================================

function isApplicable(
  extraction: ExtractionOutput,
  financialData?: FinancialDataExtraction | null,
): PatternApplicabilityCheck {
  // Pre-check universel : sans revenu ni burn, on ne peut pas mesurer
  // l intensité économique de la dépendance infrastructure ni la
  // capacité financière à déverouiller. Court-circuit avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Infrastructure Hostage non évaluable : aucun revenu ni burn chiffré dans le dossier. La captivité infrastructure ne peut pas être mesurée sans matière économique.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  const hasProductDescription = !!extraction.productDescription && extraction.productDescription.length > 30;
  const sector = normalizeFrText(extraction.sector);

  if (!hasBusinessModel && !hasProductDescription) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modèle économique ni description produit lisibles. Pattern Infrastructure Hostage non évaluable.',
      shouldRun: false,
    };
  }

  // Hardware-physical pur sans couche logicielle : moteur en lecture
  // limitée. Le verdict matrice est généralement déjà partial dans ce cas,
  // on confirme. Word boundaries pour éviter faux positifs (ai dans plain).
  const isPurelyPhysical = /^(hardware|industriel|industrial|deeptech|biotech|wet[ -]?lab)$/i.test(sector)
    && !/\b(saas|software|api|platform|cloud|ai|llm)\b/i.test([
      extraction.marketPitch ?? '',
      extraction.productDescription ?? '',
      extraction.businessModel ?? '',
    ].join(' '));

  if (isPurelyPhysical) {
    return {
      level: 'partial',
      rationale: 'Modèle à forte composante physique : pattern actif uniquement sur la couche logicielle ou cloud non triviale si elle existe. Lecture limitée.',
      shouldRun: true,
    };
  }

  return {
    level: 'full',
    rationale: 'Modèle économique et produit lisibles, analyse complète des trois axes Infrastructure Hostage possible.',
    shouldRun: true,
  };
}

// ============================================================
// ANALYZE
// ============================================================

function buildSystemPrompt(assetClass: string): string {
  const block = buildArchetypePromptBlock(ARCHETYPE_AXIS, assetClass);
  return SYSTEM_PROMPT.replace('__ARCHETYPE_BLOCK__', block);
}

async function analyze(input: PatternInput): Promise<PatternAnalysisOutput> {
  const check = isApplicable(input.extraction, input.financialData);
  if (!check.shouldRun) {
    return buildNotApplicableOutput(PATTERN_ID, check.rationale);
  }

  const assetClass = input.assetClass ?? 'unclassified';
  const userPrompt = buildUserPrompt(input);
  const response = await callClaude(buildSystemPrompt(assetClass), userPrompt, 4000);

  const raw = parseJSON<RawLLMOutput>(response);
  if (!raw) {
    throw new Error('Infrastructure Hostage: failed to parse LLM JSON response');
  }

  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  if (raw.counterArchetype) {
    raw.counterArchetype = decorateCounterArchetype(
      raw.counterArchetype as any,
      ARCHETYPE_AXIS,
      assetClass,
    );
  }

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (intensité de la dépendance critique)
  // est l axe identitaire d Infrastructure Hostage. Sans dépendance
  // critique identifiée, le pattern n a pas de matière.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Infrastructure Hostage non applicable : l axe identitaire (intensité de la dépendance critique) est neutralisé par absence de stack technique identifiable ou de fournisseur critique mesurable.',
  );
}

// ============================================================
// MODULE EXPORT ET AUTO-REGISTRATION
// ============================================================

export const infrastructureHostagePattern: PatternModule = {
  patternId: PATTERN_ID,
  isApplicable,
  analyze,
};

registerPattern(infrastructureHostagePattern);

// ============================================================
// EXPOSITION POUR TESTS UNITAIRES
// ============================================================

export const _internal = {
  buildUserPrompt,
  llmOutputToPatternOutput,
  isApplicable,
  extractStackSnapshot,
  SYSTEM_PROMPT,
  buildSystemPrompt,
  ARCHETYPE_AXIS,
  KNOWN_VENDORS,
  PORTABILITY_KEYWORDS,
};
