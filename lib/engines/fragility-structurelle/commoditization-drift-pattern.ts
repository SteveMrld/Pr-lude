// ============================================================
// COMMODITIZATION DRIFT - PATTERN PHASE 4
// ------------------------------------------------------------
// Implémentation TypeScript de la doctrine écrite dans
// docs/patterns/commoditization-drift.md.
//
// Pattern de l ère IA générative : entreprise dont la
// défensibilité repose sur des barrières en train de devenir
// reproductibles ou contournables par des outils IA, des LLMs,
// ou d autres baisses de coût technologique. La position
// concurrentielle s érode mécaniquement, sans que l entreprise
// ait construit de nouveaux moats pour la remplacer.
//
// Discrimination structurelle : la commoditisation attaque les
// monomoats, elle est inopérante contre les cumuls multi-couches
// (Stripe, Salesforce, Bloomberg restent solides).
//
// Trois axes :
//   - Axe 1 : nature et profondeur des moats actuels
//   - Axe 2 : exposition à la dérèliction technologique
//   - Axe 3 : capacité à reconstruire ou cumuler de nouveaux moats
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
  stageToStade,
  type ArchetypeAxis,
  type DossierStade,
} from '../archetype-selector';

const PATTERN_ID: PatternId = 'commoditization-drift';
const ARCHETYPE_AXIS: ArchetypeAxis = 'commoditization-drift';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior spécialiste de la défensibilité des entreprises à
forte composante cognitive ou software. Tu analyses le pattern Commoditization
Drift sur ce dossier : érosion mécanique des moats existants par les outils
IA générative et autres baisses de coût technologique.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas l absence de moats actuels, qui est le cas de toute
jeune entreprise. C est l érosion d un moat existant qui ne peut pas être
restauré. Tu dois nommer le moat précis attaqué, le mécanisme d érosion,
et idéalement le ou les outils ou produits qui matérialisent l attaque.

DISTINCTION FONDAMENTALE : la commoditisation attaque les monomoats. Elle
est inopérante contre les cumuls multi-couches. Stripe combine réseau
banques plus données fraude plus intégrations développeurs plus agréments
bancaires plus brand. Salesforce combine données clients verrouillées plus
écosystème partenaires plus switching costs plus distribution enterprise.
Tu dois compter les moats distincts vraiment indépendants, pas les claims
empilés dans le pitch.

# AXE 1 : NATURE ET PROFONDEUR DES MOATS ACTUELS

Mesure de la solidité des barrières existantes. Trois sous-modules :

- MOATS_VERIFIES_VS_DECLARES : croisement des claims pitch avec les
  éléments observables. Network effect déclaré = chercher croissance non-
  linéaire de la base utilisateurs vs valeur produite, NRR > 120%, viralité
  organique mesurée. Données propriétaires = chercher volume, durée
  d accumulation, propriétarité contractuelle, absence de sources
  alternatives. Brand = aided awareness, premium pricing, NPS. Les moats
  déclarés mais non vérifiables ne contribuent pas.

- CUMUL_MOATS_INDEPENDANTS : nombre de moats distincts vraiment
  indépendants. Un seul moat = fragile. Quatre ou cinq moats indépendants
  = résistant à la commoditisation par couche.

- REPLICATION_COST : capital plus temps requis pour répliquer la position.
  SaaS verticalement spécialisé : 12 mois et 5M de développement = faible.
  Marketplace network effects matures : 200M et 7 ans = massif.

# AXE 2 : EXPOSITION À LA DÉRÉLICTION TECHNOLOGIQUE

Mesure de la part de valeur produite attaquable par les outils existants
ou en développement. Quatre sous-modules :

- LLM_SUBSTITUTION_RATE : pourcentage de la valeur produite substituable
  par utilisation directe d un LLM général (ChatGPT, Claude, Gemini)
  éventuellement avec prompt engineering. Copywriting basique > 80%,
  traduction généraliste > 90%, helpdesk niveau 1 > 70%.

- AI_NATIVE_CHALLENGERS : présence de challengers IA-native dédiés dans
  la catégorie avec leur traction. Cursor et Codeium dans le code, Vercel
  v0 dans le frontend, Harvey dans le legal, Hippocratic AI dans le
  médical, Decagon dans le customer support.

- EROSION_MATERIALISEE : marqueurs de pression concurrentielle déjà
  visibles : pricing en baisse > 10% sur 12 mois, churn anormalement
  élevé, NRR en dégradation, taux de conversion en chute, augmentation
  cycles de vente.

- HORIZON_24M : capabilities probables dans les 24 prochains mois.
  Agents autonomes capables d exécuter tâches multi-étapes sur
  ordinateur en alpha en 2025-2026. Catégorie supplémentaire de SaaS
  ergonomique va basculer dans la zone d attaque à horizon court.

# AXE 3 : CAPACITÉ À RECONSTRUIRE OU CUMULER DE NOUVEAUX MOATS

Mesure du plan défensif documenté. C est le mitigant majeur.

- CONSTRUCTION_ACTIVE_HORS_PERIMETRE : marqueurs concrets de
  construction de nouveaux moats hors zone attaquable : accumulation
  données propriétaires non réplicables, network effects mesurés,
  acquisition agréments, partenariats distribution captive,
  intégrations OS ou plateforme exclusives.

- PLAN_TRANSITION_DOCUMENTE : analyse explicite de la commoditisation
  potentielle dans le pitch et le BP, plan de réaction. La présence
  d une telle analyse est en elle-même un signal positif sur la
  maturité stratégique du management.

- EXECUTION_DEJA_COMMENCEE : preuves d exécution. Acquisitions
  stratégiques récentes orientées moats, recrutements explicitement
  data engineering, BD enterprise, distribution. Pas plan, exécution.

__ARCHETYPE_BLOCK__

La distinction structurale n est jamais le simple fait d opérer dans une
catégorie cognitive. C est la nature et le cumul des moats. Une agence de
copywriting basique avec un seul moat (la qualité de prestation) est
exposée. Bloomberg avec quatre moats indépendants ne l est pas, même dans
une catégorie cognitive. La commoditisation attaque les monomoats.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 à 2 phrases qui justifient le niveau d application",
  "axis1": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "axis2": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "axis3": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases",
  "counterArchetype": { "closest": "nom", "direction": "trajectoire-saine | derive-confirmee", "rationale": "2 phrases" },
  "recommandationDD": "1 phrase concrète"
}

# CONTRAINTE DE COHÉRENCE

Si valeur principale en knowledge work ET pas de network effects ET pricing
en baisse documentée, alors globalScore >= 70 forcé.

Si cumul démontré de trois moats indépendants ET absence de signaux
d érosion matérialisés, alors globalScore <= 30 sauf evidence forte de
basculement imminent.

Pour les catégories déjà effondrées ou en effondrement actif (knowledge
Q&A, copywriting basique, traduction généraliste, helpdesk niveau 1),
remontée directe en drapeau-rouge même à score modéré parce que la
trajectoire est connue.

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

L axe 1 (nature et profondeur des moats actuels) est l axe identitaire
de Commoditization Drift.

DÉFINITION DE L APPLICABILITÉ : l axe 1 est applicable à tout dossier
qui a une proposition de valeur sur un marché concurrentiel, peu
importe le secteur (logiciel, IA, knowledge work, DTC consumer,
marketplace, hardware grand public, plateforme). Le pattern n est pas
restreint au knowledge work ou au SaaS pur. Un produit physique
commoditisé (Casper matelas DTC face à Purple, Tuft, Saatva, Leesa
et dizaines d acteurs interchangeables) est dans le périmètre du
pattern : l érosion de défensibilité y est doctrinalement la même
que sur un wrapper LLM. Si l axe est applicable tu DOIS produire un
verdict parmi sain, attention, alerte ou drapeau-rouge. En absence
de signaux de fragilité (cumul de moats indépendants vérifiés,
switching cost démontré, network effect mesuré, données propriétaires
non réplicables), le verdict correct est SAIN avec score 0-25, pas
not-applicable. Une entreprise avec moats multi-couches (Stripe
réseau banques plus données fraude plus intégrations développeurs
plus agréments bancaires plus brand, Salesforce données clients
plus écosystème plus switching costs plus distribution, Bloomberg
quatre moats indépendants, Adyen licences bancaires propres) est
SAIN sur cet axe, pas not-applicable.

NOT_APPLICABLE EST RÉSERVÉ AUX CAS OÙ L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : phase R&D pre-product sans proposition de
valeur commerciale articulée (lab deeptech seed sans pilote client),
recherche académique pre-commerciale, monopole légal absolu rare
(concession publique exclusive de très long terme). Hors ces cas,
l axe est applicable et le verdict doit être coté sur l échelle sain
à drapeau-rouge.

Si l axe 1 est légitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface MoatSnapshot {
  /** Mots-clés défensibilité détectés */
  moatClaims: string[];
  /** Mots-clés attaque IA détectés */
  aiAttackSignals: string[];
  stage: string;
  sector: string;
}

const MOAT_KEYWORDS = [
  'network effect', 'effets de reseau', 'effet de reseau', 'data moat',
  'donnees proprietaires', 'proprietary data', 'switching cost',
  'switching costs', 'brand', 'marque', 'license', 'licence', 'agrement',
  'patent', 'brevet', 'integration', 'integrations', 'ecosysteme',
  'ecosystem', 'distribution', 'NRR', 'net revenue retention',
];

const AI_ATTACK_KEYWORDS = [
  'GPT', 'ChatGPT', 'Claude', 'Gemini', 'LLM', 'foundation model',
  'AI native', 'AI-native', 'IA generative', 'generative AI',
  'Copilot', 'Cursor', 'v0', 'Midjourney', 'DALL-E',
];

function extractMoatSnapshot(extraction: ExtractionOutput): MoatSnapshot {
  const text = [
    extraction.marketPitch,
    extraction.productDescription,
    extraction.businessModel,
    (extraction as any).rawSummary,
  ].filter(Boolean).join(' ');

  const moatClaims = MOAT_KEYWORDS.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
  const aiAttackSignals = AI_ATTACK_KEYWORDS.filter((k) => text.toLowerCase().includes(k.toLowerCase()));

  return {
    moatClaims,
    aiAttackSignals,
    stage: extraction.fundraise?.stage ?? 'inconnu',
    sector: extraction.sector ?? 'inconnu',
  };
}

function buildUserPrompt(input: PatternInput): string {
  const e = input.extraction;
  const snap = extractMoatSnapshot(e);
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

# SIGNAUX DÉFENSIBILITÉ ET ATTAQUE IA AU PRE-SCREEN

Claims de moats identifiés : ${snap.moatClaims.length > 0 ? snap.moatClaims.join(', ') : 'aucun claim de moat identifié explicitement'}
Signaux d écosystème IA : ${snap.aiAttackSignals.length > 0 ? snap.aiAttackSignals.join(', ') : 'aucun signal IA explicite'}

# RÉSUMÉ GÉNÉRAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TÂCHE

Analyse ce dossier sur le pattern Commoditization Drift selon les trois axes
détaillés. Compte les moats distincts vraiment indépendants. Identifie le
counter-archetype le plus proche. Retourne uniquement le JSON conforme,
sans préambule.`;
}

// ============================================================
// PARSE ET CONVERSION
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
  const auditResult = auditTagging(allEvidence.join(' '), 'commoditization-drift-pattern');

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
  // Pre-check universel : sans revenu ni burn, on ne peut pas raisonner
  // sur l érosion d une défensibilité économique. Court-circuit avant
  // LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Commoditization Drift non évaluable : aucun revenu ni burn chiffré. La défensibilité économique ne peut pas être mesurée sans matière financière.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modèle économique lisible. Pattern Commoditization Drift non évaluable.',
      shouldRun: false,
    };
  }

  const text = normalizeFrText(
    [extraction.marketPitch, extraction.productDescription, extraction.businessModel, (extraction as any).rawSummary]
      .filter(Boolean).join(' '),
  );
  const sector = normalizeFrText(extraction.sector);

  // Hardware physique pur, services à forte composante physique :
  // pattern hors-scope (présence opérationnelle terrain non
  // automatisable à court terme).
  const isPurelyPhysical = /^(hardware|industriel|industrial|deeptech|biotech|wet[ -]?lab|construction|manufacturing)$/i.test(sector)
    && !/\b(saas|software|api|platform|cloud|knowledge|content|design|copy)\b/i.test(text);

  if (isPurelyPhysical) {
    return {
      level: 'not-applicable',
      rationale: 'Modèle à forte composante physique, valeur produite nécessite présence opérationnelle terrain non automatisable à court terme. Pattern hors-scope.',
      shouldRun: false,
    };
  }

  // Knowledge work / SaaS / IA / content : full
  return {
    level: 'full',
    rationale: 'Modèle à composante cognitive ou software : analyse complète des trois axes Commoditization Drift pertinente.',
    shouldRun: true,
  };
}

// ============================================================
// ANALYZE
// ============================================================

function buildSystemPrompt(assetClass: string, dossierStade: DossierStade): string {
  const block = buildArchetypePromptBlock(ARCHETYPE_AXIS, assetClass, dossierStade);
  return SYSTEM_PROMPT.replace('__ARCHETYPE_BLOCK__', block);
}

async function analyze(input: PatternInput): Promise<PatternAnalysisOutput> {
  const check = isApplicable(input.extraction, input.financialData);
  if (!check.shouldRun) {
    return buildNotApplicableOutput(PATTERN_ID, check.rationale);
  }

  const assetClass = input.assetClass ?? 'unclassified';
  const dossierStade = stageToStade(input.extraction.fundraise?.stage);
  const userPrompt = buildUserPrompt(input);
  const response = await callClaude(buildSystemPrompt(assetClass, dossierStade), userPrompt, 4000);

  const raw = parseJSON<RawLLMOutput>(response);
  if (!raw) {
    throw new Error('Commoditization Drift: failed to parse LLM JSON response');
  }

  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  if (raw.counterArchetype) {
    raw.counterArchetype = decorateCounterArchetype(
      raw.counterArchetype as any,
      ARCHETYPE_AXIS,
      assetClass,
      dossierStade,
    );
  }

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (nature et profondeur des moats actuels)
  // est l axe identitaire de Commoditization Drift. Sans moats actuels
  // identifiables, il n y a rien à éroder.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Commoditization Drift non applicable : l axe identitaire (moats actuels) est neutralisé. Sans défensibilité identifiable, aucune érosion mesurable.',
  );
}

// ============================================================
// EXPORT ET AUTO-REGISTRATION
// ============================================================

export const commoditizationDriftPattern: PatternModule = {
  patternId: PATTERN_ID,
  isApplicable,
  analyze,
};

registerPattern(commoditizationDriftPattern);

export const _internal = {
  buildUserPrompt,
  llmOutputToPatternOutput,
  isApplicable,
  extractMoatSnapshot,
  SYSTEM_PROMPT,
  MOAT_KEYWORDS,
  AI_ATTACK_KEYWORDS,
};
