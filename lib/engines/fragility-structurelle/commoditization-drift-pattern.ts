// ============================================================
// COMMODITIZATION DRIFT - PATTERN PHASE 4
// ------------------------------------------------------------
// Implementation TypeScript de la doctrine ecrite dans
// docs/patterns/commoditization-drift.md.
//
// Pattern de l ere IA generative : entreprise dont la
// defensibilite repose sur des barrieres en train de devenir
// reproductibles ou contournables par des outils IA, des LLMs,
// ou d autres baisses de cout technologique. La position
// concurrentielle s erode mecaniquement, sans que l entreprise
// ait construit de nouveaux moats pour la remplacer.
//
// Discrimination structurelle : la commoditisation attaque les
// monomoats, elle est inoperante contre les cumuls multi-couches
// (Stripe, Salesforce, Bloomberg restent solides).
//
// Trois axes :
//   - Axe 1 : nature et profondeur des moats actuels
//   - Axe 2 : exposition a la dereliction technologique
//   - Axe 3 : capacite a reconstruire ou cumuler de nouveaux moats
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

const PATTERN_ID: PatternId = 'commoditization-drift';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior specialiste de la defensibilite des entreprises a
forte composante cognitive ou software. Tu analyses le pattern Commoditization
Drift sur ce dossier : erosion mecanique des moats existants par les outils
IA generative et autres baisses de cout technologique.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas l absence de moats actuels, qui est le cas de toute
jeune entreprise. C est l erosion d un moat existant qui ne peut pas etre
restaure. Tu dois nommer le moat precis attaque, le mecanisme d erosion,
et idealement le ou les outils ou produits qui materialisent l attaque.

DISTINCTION FONDAMENTALE : la commoditisation attaque les monomoats. Elle
est inoperante contre les cumuls multi-couches. Stripe combine reseau
banques plus donnees fraude plus integrations developpeurs plus agrements
bancaires plus brand. Salesforce combine donnees clients verrouillees plus
ecosysteme partenaires plus switching costs plus distribution enterprise.
Tu dois compter les moats distincts vraiment independants, pas les claims
empiles dans le pitch.

# AXE 1 : NATURE ET PROFONDEUR DES MOATS ACTUELS

Mesure de la solidite des barrieres existantes. Trois sous-modules :

- MOATS_VERIFIES_VS_DECLARES : croisement des claims pitch avec les
  elements observables. Network effect declare = chercher croissance non-
  lineaire de la base utilisateurs vs valeur produite, NRR > 120%, viralite
  organique mesuree. Donnees proprietaires = chercher volume, duree
  d accumulation, proprietarite contractuelle, absence de sources
  alternatives. Brand = aided awareness, premium pricing, NPS. Les moats
  declares mais non verifiables ne contribuent pas.

- CUMUL_MOATS_INDEPENDANTS : nombre de moats distincts vraiment
  independants. Un seul moat = fragile. Quatre ou cinq moats independants
  = resistant a la commoditisation par couche.

- REPLICATION_COST : capital plus temps requis pour repliquer la position.
  SaaS verticalement specialise : 12 mois et 5M de developpement = faible.
  Marketplace network effects matures : 200M et 7 ans = massif.

# AXE 2 : EXPOSITION A LA DERELICTION TECHNOLOGIQUE

Mesure de la part de valeur produite attaquable par les outils existants
ou en developpement. Quatre sous-modules :

- LLM_SUBSTITUTION_RATE : pourcentage de la valeur produite substituable
  par utilisation directe d un LLM general (ChatGPT, Claude, Gemini)
  eventuellement avec prompt engineering. Copywriting basique > 80%,
  traduction generaliste > 90%, helpdesk niveau 1 > 70%.

- AI_NATIVE_CHALLENGERS : presence de challengers IA-native dedies dans
  la categorie avec leur traction. Cursor et Codeium dans le code, Vercel
  v0 dans le frontend, Harvey dans le legal, Hippocratic AI dans le
  medical, Decagon dans le customer support.

- EROSION_MATERIALISEE : marqueurs de pression concurrentielle deja
  visibles : pricing en baisse > 10% sur 12 mois, churn anormalement
  eleve, NRR en degradation, taux de conversion en chute, augmentation
  cycles de vente.

- HORIZON_24M : capabilities probables dans les 24 prochains mois.
  Agents autonomes capables d executer taches multi-etapes sur
  ordinateur en alpha en 2025-2026. Categorie supplementaire de SaaS
  ergonomique va basculer dans la zone d attaque a horizon court.

# AXE 3 : CAPACITE A RECONSTRUIRE OU CUMULER DE NOUVEAUX MOATS

Mesure du plan defensif documente. C est le mitigant majeur.

- CONSTRUCTION_ACTIVE_HORS_PERIMETRE : marqueurs concrets de
  construction de nouveaux moats hors zone attaquable : accumulation
  donnees proprietaires non repliquables, network effects mesures,
  acquisition agrements, partenariats distribution captive,
  integrations OS ou plateforme exclusives.

- PLAN_TRANSITION_DOCUMENTE : analyse explicite de la commoditisation
  potentielle dans le pitch et le BP, plan de reaction. La presence
  d une telle analyse est en elle-meme un signal positif sur la
  maturite strategique du management.

- EXECUTION_DEJA_COMMENCEE : preuves d execution. Acquisitions
  strategiques recentes orientees moats, recrutements explicitement
  data engineering, BD enterprise, distribution. Pas plan, execution.

# COUNTER-ARCHETYPES

Patterns confirmes (erosion materialisee) : Chegg 2022-2024 valorisation
effondree de 10 milliards a moins d un milliard apres ChatGPT, Stack
Overflow 2023-2025 trafic divise par deux apres GitHub Copilot et
ChatGPT, services traduction generaliste grand public cannibalises par
DeepL puis LLMs, sites Q&A generalistes type Quora fonction acquisition
connaissance basculee vers les modeles, plateformes freelance copywriting
basique et traduction marges en compression, helpdesk niveau 1 attaques
par bots conversationnels et solutions integrees CRM, generation logo
et stock photo basique attaques par Midjourney et DALL-E, plateformes
tutoring generaliste segment academic standard.

Counter-archetypes sains : Stripe defensibilite multi-moats independants
(reseau banques + donnees fraude + integrations developpeurs + agrements
bancaires + brand), Salesforce (donnees clients verrouillees + ecosysteme
partenaires + switching costs + distribution enterprise), Bloomberg
(donnees proprietaires + community + workflows trading + hardware
terminal), Adyen (licences bancaires propres + donnees flux + contrats
enterprise), verticales avec donnees proprietaires Clio dans le legal
Toast dans la restauration Procore dans la construction, marketplaces
matures Booking Airbnb Doctolib Schibsted classifieds.

La distinction structurale n est jamais le simple fait d operer dans une
categorie cognitive. C est la nature et le cumul des moats. Une agence de
copywriting basique avec un seul moat (la qualite de prestation) est
exposee. Bloomberg avec quatre moats independants ne l est pas, meme dans
une categorie cognitive. La commoditisation attaque les monomoats.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 a 2 phrases qui justifient le niveau d application",
  "axis1": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "axis2": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "axis3": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases",
  "counterArchetype": { "closest": "nom", "direction": "trajectoire-saine | derive-confirmee", "rationale": "2 phrases" },
  "recommandationDD": "1 phrase concrete"
}

# CONTRAINTE DE COHERENCE

Si valeur principale en knowledge work ET pas de network effects ET pricing
en baisse documentee, alors globalScore >= 70 force.

Si cumul demontre de trois moats independants ET absence de signaux
d erosion materialises, alors globalScore <= 30 sauf evidence forte de
basculement imminent.

Pour les categories deja effondrees ou en effondrement actif (knowledge
Q&A, copywriting basique, traduction generaliste, helpdesk niveau 1),
remontee directe en drapeau-rouge meme a score modere parce que la
trajectoire est connue.

# REGLE ANTI-HINDSIGHT

Tu evalues le dossier au moment du stage indique, pas avec des
evenements TERMINAUX survenus apres ce stage. Le hindsight strictement
interdit concerne : faillite confirmee, IPO ratee ou ulterieure,
scandale revele a posteriori, pivot effectue plus tard, exit ulterieur,
ralentissement sectoriel documente plus tard. Tu ne dois PAS citer ces
evenements dans tes evidences ni les utiliser pour scorer.

EN REVANCHE, les pipelines en cours d elaboration publique AU STAGE
DU DOSSIER restent utilisables et doivent meme etre exploites :
propositions de directives publiees, lois adoptees mais en periode de
transposition, enquetes ouvertes par autorites de regulation,
jurisprudences en cours, deadlines deja annoncees, signaux de
ralentissement deja visibles dans la presse sectorielle au stage.
Confondre hindsight avec ignorance volontaire des signaux publics
disponibles au stage est une faute aussi grave qu utiliser le
hindsight lui-meme.

Tu rendras un diagnostic comme un partner senior qui aurait du
trancher au moment du stage avec les informations effectivement
disponibles a cette date, y compris les signaux faibles publics.

# REGLE DE GATING AXE CENTRAL (AXE 1)

L axe 1 (nature et profondeur des moats actuels) est l axe identitaire
de Commoditization Drift.

DEFINITION DE L APPLICABILITE : l axe 1 est applicable a tout dossier
qui a une proposition de valeur sur un marche concurrentiel, peu
importe le secteur (logiciel, IA, knowledge work, DTC consumer,
marketplace, hardware grand public, plateforme). Le pattern n est pas
restreint au knowledge work ou au SaaS pur. Un produit physique
commoditise (Casper matelas DTC face a Purple, Tuft, Saatva, Leesa
et dizaines d acteurs interchangeables) est dans le perimetre du
pattern : l erosion de defensibilite y est doctrinalement la meme
que sur un wrapper LLM. Si l axe est applicable tu DOIS produire un
verdict parmi sain, attention, alerte ou drapeau-rouge. En absence
de signaux de fragilite (cumul de moats independants verifies,
switching cost demontre, network effect mesure, donnees proprietaires
non repliquables), le verdict correct est SAIN avec score 0-25, pas
not-applicable. Une entreprise avec moats multi-couches (Stripe
reseau banques plus donnees fraude plus integrations developpeurs
plus agrements bancaires plus brand, Salesforce donnees clients
plus ecosysteme plus switching costs plus distribution, Bloomberg
quatre moats independants, Adyen licences bancaires propres) est
SAIN sur cet axe, pas not-applicable.

NOT_APPLICABLE EST RESERVE AUX CAS OU L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : phase R&D pre-product sans proposition de
valeur commerciale articulee (lab deeptech seed sans pilote client),
recherche academique pre-commerciale, monopole legal absolu rare
(concession publique exclusive de tres long terme). Hors ces cas,
l axe est applicable et le verdict doit etre cote sur l echelle sain
a drapeau-rouge.

Si l axe 1 est legitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface MoatSnapshot {
  /** Mots-cles defensibilite detectes */
  moatClaims: string[];
  /** Mots-cles attaque IA detectes */
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

# SIGNAUX DEFENSIBILITE ET ATTAQUE IA AU PRE-SCREEN

Claims de moats identifies : ${snap.moatClaims.length > 0 ? snap.moatClaims.join(', ') : 'aucun claim de moat identifie explicitement'}
Signaux d ecosysteme IA : ${snap.aiAttackSignals.length > 0 ? snap.aiAttackSignals.join(', ') : 'aucun signal IA explicite'}

# RESUME GENERAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TACHE

Analyse ce dossier sur le pattern Commoditization Drift selon les trois axes
detailles. Compte les moats distincts vraiment independants. Identifie le
counter-archetype le plus proche. Retourne uniquement le JSON conforme,
sans preambule.`;
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
  // sur l erosion d une defensibilite economique. Court-circuit avant
  // LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Commoditization Drift non evaluable : aucun revenu ni burn chiffre. La defensibilite economique ne peut pas etre mesuree sans matiere financiere.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modele economique lisible. Pattern Commoditization Drift non evaluable.',
      shouldRun: false,
    };
  }

  const text = normalizeFrText(
    [extraction.marketPitch, extraction.productDescription, extraction.businessModel, (extraction as any).rawSummary]
      .filter(Boolean).join(' '),
  );
  const sector = normalizeFrText(extraction.sector);

  // Hardware physique pur, services a forte composante physique :
  // pattern hors-scope (presence operationnelle terrain non
  // automatisable a court terme).
  const isPurelyPhysical = /^(hardware|industriel|industrial|deeptech|biotech|wet[ -]?lab|construction|manufacturing)$/i.test(sector)
    && !/\b(saas|software|api|platform|cloud|knowledge|content|design|copy)\b/i.test(text);

  if (isPurelyPhysical) {
    return {
      level: 'not-applicable',
      rationale: 'Modele a forte composante physique, valeur produite necessite presence operationnelle terrain non automatisable a court terme. Pattern hors-scope.',
      shouldRun: false,
    };
  }

  // Knowledge work / SaaS / IA / content : full
  return {
    level: 'full',
    rationale: 'Modele a composante cognitive ou software : analyse complete des trois axes Commoditization Drift pertinente.',
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
    throw new Error('Commoditization Drift: failed to parse LLM JSON response');
  }

  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (nature et profondeur des moats actuels)
  // est l axe identitaire de Commoditization Drift. Sans moats actuels
  // identifiables, il n y a rien a eroder.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Commoditization Drift non applicable : l axe identitaire (moats actuels) est neutralise. Sans defensibilite identifiable, aucune erosion mesurable.',
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
