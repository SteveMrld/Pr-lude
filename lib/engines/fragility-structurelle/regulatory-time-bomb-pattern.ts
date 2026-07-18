// ============================================================
// REGULATORY TIME BOMB - PATTERN PHASE 4
// ------------------------------------------------------------
// Implémentation TypeScript de la doctrine écrite dans
// docs/patterns/regulatory-time-bomb.md.
//
// Pattern : entreprise dont le modèle économique repose sur un
// état réglementaire actuel destiné à changer dans une fenêtre
// temporelle prévisible, sans que l entreprise ait préparé sa
// transformation ou son positionnement post-changement.
//
// Trois sous-types canoniques :
//   - régulation à venir connue (CCD2 BNPL 2026, AI Act GPAI 2025)
//   - régulation existante mal appliquée (Airbnb meublés
//     touristiques, crypto Securities Acts US)
//   - régulation future probabiliste (IA générative horizon
//     2027, Web3 MiCA implémentations)
//
// Trois axes :
//   - Axe 1 : exposition réglementaire structurelle
//   - Axe 2 : visibilité du changement à venir
//   - Axe 3 : préparation documentée du changement
//
// Le pattern ne suit pas la logique standard de stade : une
// régulation à venir frappe la jeune boîte avec la même force
// que la mature.
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
  PATTERN_LLM_OPTIONS,
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

const PATTERN_ID: PatternId = 'regulatory-time-bomb';
const ARCHETYPE_AXIS: ArchetypeAxis = 'regulatory-time-bomb';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior spécialiste de l exposition réglementaire des
entreprises opérant dans des secteurs régulés ou en zone grise. Tu analyses
le pattern Regulatory Time Bomb sur ce dossier : modèle économique reposant
sur un état réglementaire actuel destiné à changer dans une fenêtre
temporelle prévisible, sans préparation opérationnelle adéquate.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas la simple existence d un risque réglementaire, qui est
inhérent à toute activité régulée. C est l absence de scénario chiffré et
exécuté pour absorber le changement. Tu dois nommer chaque régulation
précisément (texte législatif, article si pertinent, juridiction, date
d entrée en vigueur prévue) et citer la source.

Tu ne formules pas d avis sur l opportunité politique d une régulation. Tu
observes le risque, tu ne prends pas position sur la justesse. Strictement
instrumental.

# TROIS SOUS-TYPES CANONIQUES

Identifie d abord lequel s applique au dossier :

- REGULATION_A_VENIR_CONNUE : texte législatif daté dans le pipeline
  parlementaire, contenu public, l entreprise opère comme si elle ne
  s appliquerait pas. Cas BNPL européens face à CCD2 entrée novembre 2026,
  cas IA générative face à AI Act GPAI Article 51 août 2025, cas plateformes
  numériques face à DSA et DMA.

- REGULATION_EXISTANTE_MAL_APPLIQUEE : loi en place mais non activement
  appliquée, l entreprise opère en zone grise. Risque d application
  soudaine déclenchée par un incident médiatique ou un changement
  politique. Cas Airbnb face aux règlements meublés touristiques de Paris,
  Barcelone, New York, cas plateformes crypto US face Securities Acts
  intensifiés par SEC en 2022-2023.

- REGULATION_FUTURE_PROBABILISTE : texte n existe pas encore mais le
  précédent politique annonce sa venue dans 24 à 48 mois. Cas IA générative
  face aux extensions AI Act probables 2026-2027, cas neurotechnologies,
  cas mobilité aérienne urbaine.

# AXE 1 : EXPOSITION RÉGLEMENTAIRE STRUCTURELLE

Mesure de la dépendance du modèle à un état réglementaire qui peut changer.
Trois sous-modules :

- ZONE_GRISE_DEPENDENCE : part significative du revenu repose sur une
  catégorie d activité dont le statut légal est contesté, mal défini ou en
  cours de redéfinition. Plus de 50% du revenu en zone grise = signal fort.

- MULTI_JURISDICTIONS : nombre de juridictions où la zone grise existe pour
  le modèle. Une exposition dans dix juridictions multiplie la complexité.

- ACTIONS_DEJA_ENGAGEES : actions formelles déjà initiées contre
  l entreprise ou des acteurs de sa catégorie (enquêtes, mises en demeure,
  sanctions, audits formels). Une action engagée transforme l exposition
  abstraite en risque matérialisé.

# AXE 2 : VISIBILITÉ DU CHANGEMENT À VENIR

Mesure de la prévision possible. Trois sous-modules :

- TEXTE_DATE_PIPELINE : texte législatif daté avec contenu connu dans le
  pipeline parlementaire impactant directement le modèle.

- PRECEDENT_POLITIQUE : catégorie voisine déjà réglementée dans les 24
  derniers mois, signe que le législateur étend. Logique d empilage GDPR
  puis ePrivacy puis Data Act, ou DSA puis DMA puis AI Act.

- DURCISSEMENT_REGULATEURS : déclarations publiques récentes des chefs de
  régulateurs pertinents, rapports parlementaires, avis des autorités
  indépendantes. Convergence de signaux dans un même sens, répétée sur
  plusieurs mois, préfigure une réglementation.

# AXE 3 : PRÉPARATION DOCUMENTÉE DU CHANGEMENT

Mesure de la capacité réelle à absorber. Quatre sous-modules :

- COMPLIANCE_FUNCTION_DOTEE : compliance officer, DPO, ou general counsel
  documenté à l organigramme avec budget et périmètre. Pour les boîtes
  Series B+ en secteur régulé, l absence est un signal fort.

- PLAN_TRANSITION_DOCUMENTE : scénario chiffré dans le BP modélisant l état
  post-régulation : revenu attendu, marges, capex mise en conformité,
  calendrier. Plan avec milestones chiffrés = mitigant. Slide marketing
  générique = déclaratif.

- LOBBYING_ACTIF : dépôts auprès registres de transparence (Union
  européenne transparency.europa.eu, États-Unis LDA system), positions
  publiques, associations sectorielles. Proposition 22 californienne
  d Uber 2020 = 200 millions de dollars de lobbying décisif.

- AGREMENTS_OBTENUS : agréments ou licenses déjà obtenus dans les
  juridictions clés. Klarna licence credit institution européenne avant
  CCD2 = mitigant fort. Stripe agrément établissement de paiement dès
  2017 en anticipation PSD2.

__ARCHETYPE_BLOCK__

La distinction structurale n est jamais le simple fait d opérer dans un
secteur régulé. C est l alignement entre la trajectoire réglementaire
prévisible et la préparation opérationnelle. Stripe et Klarna opèrent dans
le même paysage réglementaire que les BNPL aujourd hui en difficulté. La
différence est l anticipation. Airbnb et les plateformes meublés
touristiques opèrent dans le même paysage réglementaire municipal. La
différence est l adaptation locale.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 à 2 phrases qui justifient le niveau d application",
  "axis1": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthèse 2-3 phrases sur l exposition réglementaire structurelle",
    "evidencePro": ["citation 1 datée avec tag"],
    "evidenceContra": ["citation 1 contra"],
    "confidence": 0-100
  },
  "axis2": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthèse sur visibilité du changement",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "axis3": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthèse sur préparation documentée",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases de synthèse éditoriale, mentionne le sous-type identifié",
  "counterArchetype": {
    "closest": "nom de boîte",
    "direction": "trajectoire-saine | derive-confirmee",
    "rationale": "2 phrases"
  },
  "recommandationDD": "1 phrase concrète pour orienter la DD"
}

# CONTRAINTE DE COHÉRENCE

Si exposition documentée à une régulation à venir dans moins de 24 mois ET
pas de plan documenté de préparation, alors globalScore >= 70 forcé.

Si secteur régulé mais agrément principal déjà obtenu ET plan de transition
documenté avec milestones chiffrés, alors globalScore <= 35 sauf evidence
forte d exposition résiduelle non couverte.

Pour les dossiers en zone grise réglementaire avec absence totale de
fonction compliance documentée, remontée directe en drapeau-rouge même à
score modéré parce que la trajectoire est empiriquement connue.

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

L axe 1 (exposition réglementaire structurelle) est l axe identitaire
de Regulatory Time Bomb.

RÈGLE IMPÉRATIVE À LIRE EN PREMIER. Une boîte saine profitable avec
moats établis (Atlassian S-1 octobre 2015, Stripe Series E 2016,
Datadog NRR 130%+, Snowflake net retention 165%) doit être cotée SAIN
sur cet axe, JAMAIS not-applicable, dès qu il existe une opération
commerciale dans au moins une juridiction. Toute entreprise B2B SaaS
internationale opère a minima sous RGPD, DPDPA et CCPA, donc l axe
est applicable et le verdict doit être coté sur l échelle sain à
drapeau-rouge. Une exposition réglementaire faible se traduit par un
verdict SAIN avec score 0-25, jamais par not-applicable. Le caractère
"hors secteur régulé" n est pas un argument pour basculer en
not-applicable : il signifie que le verdict est SAIN avec score bas.

DÉFINITION DE L APPLICABILITÉ (large par construction). L axe 1 est
applicable à tout dossier qui opère dans une ou plusieurs juridictions
avec des utilisateurs réels, ce qui couvre la quasi-totalité des
entreprises commerciales modernes (logiciel, SaaS, IA, plateforme,
fintech, hardware grand public, DTC, marketplace, services pros). Une
SaaS B2B internationale opère dans le périmètre RGPD + DPDPA + CCPA
donc l axe est applicable même si l exposition est faible. Une
entreprise mono-juridiction opère dans le périmètre réglementaire de
sa juridiction (RGPD si EU, FTC si US, etc.) donc l axe est applicable.

Si l axe est applicable tu DOIS produire un verdict parmi sain,
attention, alerte ou drapeau-rouge. En absence de signaux de
fragilité (périmètre réglementaire stable, agréments obtenus en
amont, fonction compliance documentée, lobbying actif aligné avec
trajectoire réglementaire prévisible, OU absence pure de zone grise
identifiable parce que le secteur n est pas régulé au moment du
dossier), le verdict correct est SAIN avec score 0-25, pas
not-applicable. Une entreprise dans un secteur peu régulé ou avec
compliance mature (Atlassian SaaS B2B sans exposition particulière
au S-1 2015, Datadog observabilité B2B, Stripe avec agrément
établissement paiement obtenu dès 2017 avant PSD2, Klarna après 2022
avec licence credit institution européenne en place) est SAIN sur
cet axe, pas not-applicable. Si tu hésites entre not-applicable et
sain, choisis SAIN.

NOT_APPLICABLE EST RÉSERVÉ AUX CAS RARES OÙ L AXE N A AUCUN SENS
STRUCTUREL POUR LE BUSINESS MODEL : pre-revenu sans utilisateurs ni
périmètre juridictionnel articulé (lab deeptech sans déploiement
commercial), R&D pure pre-commerciale avec produit non encore exposé
au public ni clients pilote, holding pure de participations sans
opération propre. Hors ces trois cas, l axe est applicable et le
verdict DOIT être coté sur l échelle sain à drapeau-rouge.

Si l axe 1 est légitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface RegulatorySnapshot {
  /** Mots-clés secteur régulé détectés */
  reguleKeywords: string[];
  /** Mots-clés compliance détectés */
  complianceSignals: string[];
  /** Stage et secteur */
  stage: string;
  sector: string;
  country: string;
}

// Liste testée via regex \\b{keyword}\\b sur le texte normalisé
// (normalizeFrText : lowercase + diacritiques aplatis). On garde
// donc des keywords sans accents. Le périmètre FR est tissé fin :
// secteurs verticaux régulés, autorités de régulation (ACPR, AMF,
// ARS, ANSM, ANJ, CNIL, ARCOM, DGCCRF), codes structurants (code
// monétaire et financier, code de la santé publique, loi Hoguet),
// statuts d agrément (PSAN, IOBSP, EAJE, ESMS, ICPE, CFA, qualiopi),
// et régulations européennes et US qui frappent en transverse
// (GDPR, AI Act, DSA, DMA, PSD2, PSD3, MiCA, DORA, NIS2, Securities
// Act, KYC, AML).
const REGULE_KEYWORDS = [
  // Secteurs verticaux régulés
  'finance', 'fintech', 'banque', 'bank', 'credit', 'paiement', 'payment',
  'assurance', 'insurance', 'mutuelle', 'prevoyance',
  'sante', 'health', 'biotech', 'pharma', 'medicament',
  'dispositif medical', 'medtech', 'biologie medicale',
  'defense', 'defence', 'aerospatial', 'aeronautique',
  'telecom', 'crypto', 'blockchain', 'crypto-actif', 'psan',
  'gambling', 'jeu', 'pari', 'casino en ligne', 'paris sportifs',
  'drone', 'autonomous', 'vehicule autonome',
  'gig', 'livreur', 'chauffeur', 'driver',
  'food delivery', 'rideshare', 'vtc',
  'short-term rental', 'airbnb', 'meuble touristique',
  'energie', 'electricite', 'gaz naturel', 'reseau de chaleur',
  'transport sanitaire', 'ambulance', 'taxi cpam', 'vsl',
  // Education et accueil réglementés
  'eaje', 'creche', 'assistante maternelle',
  'cfa', 'qualiopi', 'organisme de formation',
  'etablissement sous contrat',
  // Établissements et services médico-sociaux
  'ehpad', 'esms', 'saad', 'had',
  // Professions réglementées (proxy fort de présence réglementaire)
  'avocat', 'notaire', 'huissier', 'commissaire de justice',
  'expert-comptable', 'commissaire aux comptes',
  'medecin', 'pharmacien', 'infirmier', 'sage-femme',
  'kinesitherapeute', 'chirurgien-dentiste', 'veterinaire',
  'agent immobilier', 'architecte', 'geometre-expert',
  // Autorités de régulation et codes FR
  'acpr', 'amf', 'arcom', 'arjel', 'anj',
  'cnil', 'ars', 'ansm', 'has ', 'dgccrf', 'dreal',
  'code monetaire et financier', 'code de la sante publique',
  'loi hoguet', 'loi badinter', 'loi lemoine', 'loi pacte',
  'icpe', 'iobsp', 'agrement',
  // Régulations transverses européennes et US. Conserve la casse
  // canonique des acronymes : la regex de match utilise le flag
  // case-insensitive donc le routage marche, mais la liste sert
  // aussi de contrat lisible (test 11 du fichier de tests).
  'GDPR', 'RGPD', 'AI Act', 'DSA', 'DMA',
  'PSD2', 'PSD3', 'CCD2', 'MiCA', 'DORA', 'NIS2',
  'Securities Act', 'KYC', 'AML', 'LCB-FT', 'lutte blanchiment',
];

// Signaux compliance attendus dans un dossier vraiment régulé.
// La détection se fait via includes(k.toLowerCase()) donc on peut
// mélanger les casses ici, mais on garde la forme canonique pour
// faciliter la lecture et conserver le contrat de tests (DPO,
// agrement).
const COMPLIANCE_SIGNALS = [
  'compliance officer', 'DPO', 'data protection officer', 'general counsel',
  'directeur juridique', 'compliance team', 'lobbying', 'transparency register',
  'agrement', 'agrement acpr', 'agrement amf', 'agrement ars', 'agrement anj',
  'license bancaire', 'banking license', 'license credit',
  'autorisation d exercer', 'autorisation prefectorale',
  'marquage ce', 'classe iia', 'classe iib', 'classe iii',
  'amm', 'autorisation de mise sur le marche',
  'KYC', 'AML', 'LCB-FT', 'lutte blanchiment',
];

function extractRegulatorySnapshot(extraction: ExtractionOutput): RegulatorySnapshot {
  const text = [
    extraction.marketPitch,
    extraction.productDescription,
    extraction.businessModel,
    extraction.sector,
    (extraction as any).rawSummary,
  ].filter(Boolean).join(' ');

  // text normalisé (lowercase + diacritiques aplatis) avant
  // match : sante/santé, defense/défense, energie/énergie sont
  // traités comme équivalents.
  const normalized = normalizeFrText(text);
  const reguleKeywords = REGULE_KEYWORDS.filter((k) =>
    new RegExp(`\\b${k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(normalized),
  );

  const complianceSignals = COMPLIANCE_SIGNALS.filter((k) =>
    normalized.includes(k.toLowerCase()),
  );

  return {
    reguleKeywords,
    complianceSignals,
    stage: extraction.fundraise?.stage ?? 'inconnu',
    sector: extraction.sector ?? 'inconnu',
    country: extraction.country ?? 'inconnu',
  };
}

function buildUserPrompt(input: PatternInput): string {
  const e = input.extraction;
  const snap = extractRegulatorySnapshot(e);
  const sectoralBlock = buildSectoralPromptBlock(input.sectoralContext, 'fragility-structurelle');

  return `${sectoralBlock}# DOSSIER À ANALYSER

Entreprise : ${e.companyName ?? 'non communiqué'}
Secteur : ${snap.sector}
Stade : ${snap.stage}
Pays : ${snap.country}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# PRODUIT

${e.productDescription ?? '(non fourni)'}

# MODÈLE ÉCONOMIQUE

${e.businessModel ?? '(non fourni)'}

# SIGNAUX RÉGLEMENTAIRES DÉTECTÉS AU PRE-SCREEN

Mots-clés secteur régulé : ${snap.reguleKeywords.length > 0 ? snap.reguleKeywords.join(', ') : 'aucun mot-clé réglementaire détecté explicitement'}
Signaux compliance : ${snap.complianceSignals.length > 0 ? snap.complianceSignals.join(', ') : 'aucun signal de fonction compliance détecté'}

# RÉSUMÉ GÉNÉRAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TÂCHE

Analyse ce dossier sur le pattern Regulatory Time Bomb selon les trois axes
détaillés. Identifie d abord lequel des trois sous-types s applique
(régulation à venir connue, régulation existante mal appliquée, régulation
future probabiliste). Mentionne le sous-type identifié dans le
resumeEditorial. Si aucun sous-type ne s applique, marque l applicabilité
en not-applicable. Retourne uniquement le JSON conforme au format
obligatoire, sans préambule.`;
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
  const auditResult = auditTagging(allEvidence.join(' '), 'regulatory-time-bomb-pattern');

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
  // sur l exposition réglementaire structurelle ni sur la préparation
  // documentée. Court-circuit avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Regulatory Time Bomb non évaluable : aucun revenu ni burn chiffré dans le dossier. La doctrine nécessite une matière économique pour mesurer l exposition réglementaire.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modèle économique lisible. Pattern Regulatory Time Bomb non évaluable.',
      shouldRun: false,
    };
  }

  const snap = extractRegulatorySnapshot(extraction);

  // Aucun mot-clé réglementaire détecté ET pas de business model en
  // contact direct avec le régulateur (marketplace, contract-b2g)
  const businessModelText = normalizeFrText(extraction.businessModel);
  const isPublicOrMarketplace = /marketplace|contract|b2g|public sector|gouvernement|government/i.test(businessModelText);

  if (snap.reguleKeywords.length === 0 && !isPublicOrMarketplace) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun signal réglementaire détecté au pre-screen et modèle économique sans contact direct avec le régulateur. Pattern non applicable.',
      shouldRun: false,
    };
  }

  return {
    level: 'full',
    rationale: snap.reguleKeywords.length > 0
      ? `Secteur régulé détecté (${snap.reguleKeywords.slice(0, 3).join(', ')}${snap.reguleKeywords.length > 3 ? '...' : ''}), analyse complète des trois axes pertinente.`
      : 'Modèle économique avec contact regulatoire (marketplace ou public), analyse complète pertinente.',
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
    return buildNotApplicableOutput(PATTERN_ID, check.rationale, 'pattern-scope');
  }

  const assetClass = input.assetClass ?? 'unclassified';
  const dossierStade = stageToStade(input.extraction.fundraise?.stage);
  const userPrompt = buildUserPrompt(input);
  // Options fragility : 180s en une seule tentative. Cf. arithmetique
  // et rationale dans pattern-interface.ts PATTERN_LLM_OPTIONS.
  const response = await callClaude(buildSystemPrompt(assetClass, dossierStade), userPrompt, 4000, undefined, PATTERN_LLM_OPTIONS);

  const raw = parseJSON<RawLLMOutput>(response);
  if (!raw) {
    throw new Error('Regulatory Time Bomb: failed to parse LLM JSON response');
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

  // Gating axe central : axe 1 (exposition réglementaire structurelle)
  // est l axe identitaire de Regulatory Time Bomb. Sans exposition
  // réglementaire mesurable, le pattern n a pas d objet.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Regulatory Time Bomb non applicable : l axe identitaire (exposition réglementaire structurelle) est neutralisé. Le secteur n est pas en bascule réglementaire identifiable.',
  );
}

// ============================================================
// MODULE EXPORT ET AUTO-REGISTRATION
// ============================================================

export const regulatoryTimeBombPattern: PatternModule = {
  patternId: PATTERN_ID,
  isApplicable,
  analyze,
};

registerPattern(regulatoryTimeBombPattern);

// ============================================================
// EXPOSITION POUR TESTS
// ============================================================

export const _internal = {
  buildUserPrompt,
  llmOutputToPatternOutput,
  isApplicable,
  extractRegulatorySnapshot,
  SYSTEM_PROMPT,
  REGULE_KEYWORDS,
  COMPLIANCE_SIGNALS,
};
