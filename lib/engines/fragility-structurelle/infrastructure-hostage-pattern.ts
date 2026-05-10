// ============================================================
// INFRASTRUCTURE HOSTAGE - PATTERN PHASE 4
// ------------------------------------------------------------
// Implementation TypeScript de la doctrine ecrite dans
// docs/patterns/infrastructure-hostage.md.
//
// Pattern : entreprise dont la valeur, la marge ou la capacite
// a operer depend d un fournisseur d infrastructure tiers qui
// peut unilateralement modifier les termes (prix, acces, policy)
// sans alternative viable a court terme.
//
// Trois axes :
//   - Axe 1 : intensite de la dependance critique
//             (concentration COGS technique, nombre fournisseurs
//              critiques, switching cost)
//   - Axe 2 : pouvoir de marche du fournisseur
//             (asymetrie taille, cannibalisation directe, track
//              record changements unilateraux, position dominante)
//   - Axe 3 : path to deverrouillage
//             (plan documente reduction dependance, progres
//              mesurable, architecture portable)
//
// Le pattern est universellement applicable a l ere IA generative
// parce que la concentration des fournisseurs critiques (OpenAI,
// Anthropic, Nvidia, AWS, Stripe, App Stores) est devenue
// systemique. Il s active des Series A pour les SaaS et IA.
// ============================================================

import { callClaude, parseJSON } from '../anthropic-client';
import { auditTagging } from '../source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from '../editorial-voice';
import { SOURCE_TAGGING_INSTRUCTION } from '../source-tagging';
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

const PATTERN_ID: PatternId = 'infrastructure-hostage';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior specialiste de la captivite infrastructurelle des
entreprises SaaS, IA et plateformes numeriques. Tu analyses le pattern
Infrastructure Hostage sur ce dossier : dependance critique a un fournisseur
externe qui peut unilateralement modifier les termes de l acces, du prix, de
la disponibilite ou de la policy d usage sans alternative viable a 90 jours.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas la simple existence d une dependance, qui est inevitable.
C est l asymetrie de pouvoir et l absence de chemin de sortie. Tu dois nommer
le fournisseur precis, le service utilise, le pourcentage de dependance ou la
mesure d asymetrie, et citer la source.

Tu ne conclus pas a Infrastructure Hostage sur des impressions du type cette
boite est trop dependante a OpenAI. Tu dois nommer la dependance avec son
chiffre.

# AXE 1 : INTENSITE DE LA DEPENDANCE CRITIQUE

Mesure quantitative de la concentration des fournisseurs sur la stack technique
et economique. Trois sous-modules :

- COGS_CONCENTRATION : part du COGS technique allouee aux trois plus gros
  fournisseurs externes. Si un seul fournisseur represente plus de 40% du
  COGS technique, signal fort. Plus de 60%, drapeau-rouge. Pour un wrapper
  GPT pur, le ratio peut atteindre 90% avec OpenAI.

- CRITICAL_VENDOR_COUNT : nombre de fournisseurs critiques sans alternative
  realiste a 90 jours. Critique signifie que la panne ou la rupture du
  fournisseur arrete l operation. Trois ou plus, applicabilite full.

- SWITCHING_COST_HIGH : switching cost mesure en mois-homme et en euros.
  Au-dela de 6 mois ou 1 million d euros pour une PME-ETI, le switching cost
  rend la menace credible.

# AXE 2 : POUVOIR DE MARCHE DU FOURNISSEUR

Mesure l asymetrie de pouvoir. Quatre sous-modules :

- SIZE_ASYMMETRY : le fournisseur est-il 100x, 1000x plus gros en
  capitalisation, en revenu, en effectifs ? OpenAI face a Jasper, ratio
  capitalisation 200x. Apple face a une app indie, ratio 10000x.

- CANNIBALIZATION_RISK : le fournisseur peut-il sortir un produit qui rend
  l entreprise non pertinente ? Tres haut pour les wrappers d API LLM, ou
  OpenAI a deja remplace une dizaine de categories de produits par des
  features integrees.

- UNILATERAL_HISTORY : le fournisseur a-t-il deja modifie unilateralement
  les termes dans les 24 derniers mois ? Apple ATT 2021, OpenAI policy
  relationship apps 2023, AWS egress fees 2024, Twitter API monetization
  2023.

- VENDOR_DOMINANCE : position dominante du fournisseur sur son marche.
  Nvidia sur GPU IA training environ 95%. AWS plus Azure plus GCP cumules
  environ 65% du cloud public.

# AXE 3 : PATH TO DEVERROUILLAGE

Mesure de la capacite reelle de l entreprise a reduire sa dependance. C est
le mitigant majeur. Trois sous-modules :

- EXIT_PLAN_DOCUMENTED : existence d un plan documente avec milestones
  chiffres, calendrier, et budget. Multi-cloud, fine-tuning local, build
  interne, contrats long-terme, diversification processeurs paiement.

- MEASURABLE_PROGRESS_12M : progres mesurable depuis 12 mois sur l execution
  du plan. Pourcentage de charge migree, contrats signes second fournisseur,
  recrutements explicitement portability-focused. Un plan qui dort sans
  execution n est pas un mitigant.

- PORTABLE_ARCHITECTURE : architecture portable par construction. Kubernetes
  vanilla, Postgres open-source, modeles open-weight self-hosted sont
  portables. DynamoDB, Lambda, Vertex AI, Azure OpenAI Service sont
  captifs. La portabilite architecturale est un mitigant majeur meme en
  l absence de plan explicite.

# COUNTER-ARCHETYPES

Identifie le counter-archetype le plus proche et explique en deux phrases :

Patterns confirmes (squeeze marque ou effondrement) : Jasper et Copy.ai en
2023 squeezes par OpenAI baisse prix 80% plus integration ChatGPT, Replika
2023 policy changes OpenAI sur apps relations, premiere generation wrappers
GPT pure-play sans value-add metier disparue, Zynga avant 2014 captive de
Facebook viralite, MoviePass dependance prix cinemas, apps mobiles avant ATT
iOS divisees ROAS par 3, Snap Lens 2017 hardware dependance, Pinterest
trafic divise par 2 algo Google 2023.

Counter-archetypes sains : Salesforce qui a construit ses propres infras et
abstractions sur plusieurs decennies multi-cloud capable, Snowflake
architecturee multi-cloud par construction des le jour un peut basculer AWS
Azure GCP au niveau du compte client, Stripe qui depend des banques mais
avec redondance massive et plus de cinq processeurs en parallele, Anthropic
et OpenAI qui dependent de Nvidia mais avec contrats long-terme et plans
documentes TPU AMD silicon proprietaire, GitLab portable par construction
deployable on-premises chez le client, Datadog qui agrege plus de 500
integrations avec un coeur produit qui ne depend d aucune specifique, Adyen
detenteur de licences bancaires europeennes propres operant ses propres rails.

La distinction n est jamais le simple fait de dependre d un fournisseur. C est
l asymetrie, l absence de plan de sortie et l absence de differenciation
au-dessus du fournisseur. Snowflake depend d AWS plus qu une PME francaise
typique mais Snowflake n est pas Infrastructure Hostage parce que la
dependance est diversifiee, contractualisee, et la valeur produite est
specifiquement au-dessus de l infrastructure.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 a 2 phrases qui justifient le niveau d application",
  "axis1": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthese 2-3 phrases sur l intensite de dependance",
    "evidencePro": ["citation 1 datee avec tag", "citation 2 datee avec tag"],
    "evidenceContra": ["citation 1 contra", "citation 2 contra"],
    "confidence": 0-100
  },
  "axis2": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthese sur pouvoir de marche du fournisseur",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "axis3": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthese sur path to deverrouillage",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases de synthese editoriale du pattern sur ce dossier",
  "counterArchetype": {
    "closest": "nom de boite",
    "direction": "trajectoire-saine | derive-confirmee",
    "rationale": "2 phrases"
  },
  "recommandationDD": "1 phrase concrete pour orienter la DD"
}

# CONTRAINTE DE COHERENCE

Si plus de 60% du COGS technique sur un seul fournisseur ET aucun plan de
bascule documente, alors globalScore >= 70 force.

Si moins de 25% de COGS sur le fournisseur le plus gros ET architecture
portable documentee, alors globalScore <= 30 sauf evidence forte de
cannibalisation directe.

# SPECIFICITE WRAPPERS LLM

Pour les wrappers d API LLM pure-play en seed sans plan de differenciation
articule, score >= 75 force avec direction derive-confirmee, parce que la
trajectoire est connue (Jasper, Copy.ai, premiere generation wrappers GPT
disparue en 2023).`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface StackSnapshot {
  /** Mots-cles infrastructure detectes dans le pitch ou le BP */
  vendorMentions: string[];
  /** Mots-cles d auto-portabilite ou de multi-cloud */
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
    text.toLowerCase().includes(k),
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

  return `# DOSSIER A ANALYSER

Entreprise : ${e.companyName ?? 'non communique'}
Secteur : ${snap.sector}
Stade : ${snap.stage}
Pays : ${e.country ?? 'non communique'}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# PRODUIT

${e.productDescription ?? '(non fourni)'}

# MODELE ECONOMIQUE

${e.businessModel ?? '(non fourni)'}

# SIGNAUX INFRASTRUCTURE DETECTES AU PRE-SCREEN

Fournisseurs cites : ${snap.vendorMentions.length > 0 ? snap.vendorMentions.join(', ') : 'aucun fournisseur connu cite explicitement'}
Signaux de portabilite : ${snap.portabilitySignals.length > 0 ? snap.portabilitySignals.join(', ') : 'aucun signal de portabilite detecte'}

# RESUME GENERAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TACHE

Analyse ce dossier sur le pattern Infrastructure Hostage selon les trois axes
detailles dans tes instructions. Si les fournisseurs cites au pre-screen ne
correspondent pas a la realite (par exemple le pitch parle d AWS mais ne le
cite pas explicitement), corrige sur la base du contenu. Retourne uniquement
le JSON conforme au format obligatoire, sans preambule.`;
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
  // l intensite economique de la dependance infrastructure ni la
  // capacite financiere a deverouiller. Court-circuit avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Infrastructure Hostage non evaluable : aucun revenu ni burn chiffre dans le dossier. La captivite infrastructure ne peut pas etre mesuree sans matiere economique.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  const hasProductDescription = !!extraction.productDescription && extraction.productDescription.length > 30;
  const sector = (extraction.sector ?? '').toLowerCase();

  if (!hasBusinessModel && !hasProductDescription) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modele economique ni description produit lisibles. Pattern Infrastructure Hostage non evaluable.',
      shouldRun: false,
    };
  }

  // Hardware-physical pur sans couche logicielle : moteur en lecture
  // limitee. Le verdict matrice est generalement deja partial dans ce cas,
  // on confirme. Word boundaries pour eviter faux positifs (ai dans plain).
  const isPurelyPhysical = /^(hardware|industriel|industrial|deeptech|biotech|wet[ -]?lab)$/i.test(sector)
    && !/\b(saas|software|api|platform|cloud|ai|llm)\b/i.test([
      extraction.marketPitch ?? '',
      extraction.productDescription ?? '',
      extraction.businessModel ?? '',
    ].join(' '));

  if (isPurelyPhysical) {
    return {
      level: 'partial',
      rationale: 'Modele a forte composante physique : pattern actif uniquement sur la couche logicielle ou cloud non triviale si elle existe. Lecture limitee.',
      shouldRun: true,
    };
  }

  return {
    level: 'full',
    rationale: 'Modele economique et produit lisibles, analyse complete des trois axes Infrastructure Hostage possible.',
    shouldRun: true,
  };
}

// ============================================================
// ANALYZE
// ============================================================

async function analyze(input: PatternInput): Promise<PatternAnalysisOutput> {
  const check = isApplicable(input.extraction, input.financialData);
  if (!check.shouldRun) {
    return buildNotApplicableOutput(PATTERN_ID, check.rationale);
  }

  const userPrompt = buildUserPrompt(input);
  const response = await callClaude(SYSTEM_PROMPT, userPrompt, 4000);

  const raw = parseJSON<RawLLMOutput>(response);
  if (!raw) {
    throw new Error('Infrastructure Hostage: failed to parse LLM JSON response');
  }

  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (intensite de la dependance critique)
  // est l axe identitaire d Infrastructure Hostage. Sans dependance
  // critique identifiee, le pattern n a pas de matiere.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Infrastructure Hostage non applicable : l axe identitaire (intensite de la dependance critique) est neutralise par absence de stack technique identifiable ou de fournisseur critique mesurable.',
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
  KNOWN_VENDORS,
  PORTABILITY_KEYWORDS,
};
