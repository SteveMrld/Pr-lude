// ============================================================
// REGULATORY TIME BOMB - PATTERN PHASE 4
// ------------------------------------------------------------
// Implementation TypeScript de la doctrine ecrite dans
// docs/patterns/regulatory-time-bomb.md.
//
// Pattern : entreprise dont le modele economique repose sur un
// etat reglementaire actuel destine a changer dans une fenetre
// temporelle previsible, sans que l entreprise ait prepare sa
// transformation ou son positionnement post-changement.
//
// Trois sous-types canoniques :
//   - regulation a venir connue (CCD2 BNPL 2026, AI Act GPAI 2025)
//   - regulation existante mal appliquee (Airbnb meubles
//     touristiques, crypto Securities Acts US)
//   - regulation future probabiliste (IA generative horizon
//     2027, Web3 MiCA implementations)
//
// Trois axes :
//   - Axe 1 : exposition reglementaire structurelle
//   - Axe 2 : visibilite du changement a venir
//   - Axe 3 : preparation documentee du changement
//
// Le pattern ne suit pas la logique standard de stade : une
// regulation a venir frappe la jeune boite avec la meme force
// que la mature.
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

const PATTERN_ID: PatternId = 'regulatory-time-bomb';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior specialiste de l exposition reglementaire des
entreprises operant dans des secteurs regules ou en zone grise. Tu analyses
le pattern Regulatory Time Bomb sur ce dossier : modele economique reposant
sur un etat reglementaire actuel destine a changer dans une fenetre
temporelle previsible, sans preparation operationnelle adequate.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas la simple existence d un risque reglementaire, qui est
inherent a toute activite regulee. C est l absence de scenario chiffre et
execute pour absorber le changement. Tu dois nommer chaque regulation
precisement (texte legislatif, article si pertinent, juridiction, date
d entree en vigueur prevue) et citer la source.

Tu ne formules pas d avis sur l opportunite politique d une regulation. Tu
observes le risque, tu ne prends pas position sur la justesse. Strictement
instrumental.

# TROIS SOUS-TYPES CANONIQUES

Identifie d abord lequel s applique au dossier :

- REGULATION_A_VENIR_CONNUE : texte legislatif date dans le pipeline
  parlementaire, contenu public, l entreprise opere comme si elle ne
  s appliquerait pas. Cas BNPL europeens face a CCD2 entree novembre 2026,
  cas IA generative face a AI Act GPAI Article 51 aout 2025, cas plateformes
  numeriques face a DSA et DMA.

- REGULATION_EXISTANTE_MAL_APPLIQUEE : loi en place mais non activement
  appliquee, l entreprise opere en zone grise. Risque d application
  soudaine declenchee par un incident mediatique ou un changement
  politique. Cas Airbnb face aux reglements meubles touristiques de Paris,
  Barcelone, New York, cas plateformes crypto US face Securities Acts
  intensifies par SEC en 2022-2023.

- REGULATION_FUTURE_PROBABILISTE : texte n existe pas encore mais le
  precedent politique annonce sa venue dans 24 a 48 mois. Cas IA generative
  face aux extensions AI Act probables 2026-2027, cas neurotechnologies,
  cas mobilite aerienne urbaine.

# AXE 1 : EXPOSITION REGLEMENTAIRE STRUCTURELLE

Mesure de la dependance du modele a un etat reglementaire qui peut changer.
Trois sous-modules :

- ZONE_GRISE_DEPENDENCE : part significative du revenu repose sur une
  categorie d activite dont le statut legal est conteste, mal defini ou en
  cours de redefinition. Plus de 50% du revenu en zone grise = signal fort.

- MULTI_JURISDICTIONS : nombre de juridictions ou la zone grise existe pour
  le modele. Une exposition dans dix juridictions multiplie la complexite.

- ACTIONS_DEJA_ENGAGEES : actions formelles deja initiees contre
  l entreprise ou des acteurs de sa categorie (enquetes, mises en demeure,
  sanctions, audits formels). Une action engagee transforme l exposition
  abstraite en risque materialise.

# AXE 2 : VISIBILITE DU CHANGEMENT A VENIR

Mesure de la prevision possible. Trois sous-modules :

- TEXTE_DATE_PIPELINE : texte legislatif date avec contenu connu dans le
  pipeline parlementaire impactant directement le modele.

- PRECEDENT_POLITIQUE : categorie voisine deja reglementee dans les 24
  derniers mois, signe que le legislateur etend. Logique d empilage GDPR
  puis ePrivacy puis Data Act, ou DSA puis DMA puis AI Act.

- DURCISSEMENT_REGULATEURS : declarations publiques recentes des chefs de
  regulateurs pertinents, rapports parlementaires, avis des autorites
  independantes. Convergence de signaux dans un meme sens, repetee sur
  plusieurs mois, prefigure une reglementation.

# AXE 3 : PREPARATION DOCUMENTEE DU CHANGEMENT

Mesure de la capacite reelle a absorber. Quatre sous-modules :

- COMPLIANCE_FUNCTION_DOTEE : compliance officer, DPO, ou general counsel
  documente a l organigramme avec budget et perimetre. Pour les boites
  Series B+ en secteur regule, l absence est un signal fort.

- PLAN_TRANSITION_DOCUMENTE : scenario chiffre dans le BP modelisant l etat
  post-regulation : revenu attendu, marges, capex mise en conformite,
  calendrier. Plan avec milestones chiffres = mitigant. Slide marketing
  generique = declaratif.

- LOBBYING_ACTIF : depots aupres registres de transparence (Union
  europeenne transparency.europa.eu, Etats-Unis LDA system), positions
  publiques, associations sectorielles. Proposition 22 californienne
  d Uber 2020 = 200 millions de dollars de lobbying decisif.

- AGREMENTS_OBTENUS : agrements ou licenses deja obtenus dans les
  juridictions cles. Klarna licence credit institution europeenne avant
  CCD2 = mitigant fort. Stripe agrement etablissement de paiement des
  2017 en anticipation PSD2.

# COUNTER-ARCHETYPES

Patterns confirmes (sanction, faillite ou pivot impose) : Theranos
2015-2018 claims marketing depassant approbations FDA enquetes serie SEC
DOJ FDA CMS faillite et proces penal, FTX et chaine Celsius Voyager BlockFi
2022-2023 operation crypto US sans qualification Securities Acts
intensification SEC effondrements domino, Uber periode AB5 californienne
2019-2020 classification contractor contestee 200 millions Proposition 22
accords pays par pays, Foodora et plateformes livraison europeennes
2018-2022 requalification livreurs en employes restructurations en chaine,
Wirecard 2020 fraude comptable plus defaillances regulatoires BaFin, N26
sanctionne BaFin 2021 plafond impose acquisition clients pendant deux ans,
Direct-to-consumer genetics annees 2010 face FDA contraintes de retirer
produits.

Counter-archetypes sains : Stripe anticipation PSD2 des 2017 agrement
etablissement paiement obtenu en avance de phase evitement complet de la
fenetre de risque que d autres ont subi, Plaid anticipation Open Banking
US et Europe partenariats banques avant l obligation reglementaire,
Anthropic anticipation AI Act europeen frontier model commitments
unilaterales 2023 lab safety policy publique dialogues continus avec AI
Office europeen, Airbnb post-2018 transition compliance ville par ville
equipes juridiques locales accords avec municipalites integration des
declarations dans le produit, Klarna apres 2022 obtention licence credit
institution europeenne avant CCD2 transition operationnelle reussie,
Adyen agrement etablissement paiement obtenu en propre des 2010
positionnant au-dessus du regime PSP simple.

La distinction structurale n est jamais le simple fait d operer dans un
secteur regule. C est l alignement entre la trajectoire reglementaire
previsible et la preparation operationnelle. Stripe et Klarna operent dans
le meme paysage reglementaire que les BNPL aujourd hui en difficulte. La
difference est l anticipation. Airbnb et les plateformes meubles
touristiques operent dans le meme paysage reglementaire municipal. La
difference est l adaptation locale.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 a 2 phrases qui justifient le niveau d application",
  "axis1": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthese 2-3 phrases sur l exposition reglementaire structurelle",
    "evidencePro": ["citation 1 datee avec tag"],
    "evidenceContra": ["citation 1 contra"],
    "confidence": 0-100
  },
  "axis2": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthese sur visibilite du changement",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "axis3": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthese sur preparation documentee",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases de synthese editoriale, mentionne le sous-type identifie",
  "counterArchetype": {
    "closest": "nom de boite",
    "direction": "trajectoire-saine | derive-confirmee",
    "rationale": "2 phrases"
  },
  "recommandationDD": "1 phrase concrete pour orienter la DD"
}

# CONTRAINTE DE COHERENCE

Si exposition documentee a une regulation a venir dans moins de 24 mois ET
pas de plan documente de preparation, alors globalScore >= 70 force.

Si secteur regule mais agrement principal deja obtenu ET plan de transition
documente avec milestones chiffres, alors globalScore <= 35 sauf evidence
forte d exposition residuelle non couverte.

Pour les dossiers en zone grise reglementaire avec absence totale de
fonction compliance documentee, remontee directe en drapeau-rouge meme a
score modere parce que la trajectoire est empiriquement connue.

# REGLE DE GATING AXE CENTRAL (AXE 1)

L axe 1 (exposition reglementaire structurelle) est l axe identitaire
de Regulatory Time Bomb.

DEFINITION DE L APPLICABILITE : l axe 1 est applicable a tout dossier
qui opere dans une ou plusieurs juridictions avec des utilisateurs
reels, ce qui couvre la quasi-totalite des entreprises commerciales.
Une SaaS B2B internationale opere dans le perimetre RGPD plus DPDPA
plus CCPA donc l axe est applicable meme si l exposition est faible.
Si l axe est applicable tu DOIS produire un verdict parmi sain,
attention, alerte ou drapeau-rouge. En absence de signaux de
fragilite (perimetre reglementaire stable, agrements obtenus en
amont, fonction compliance documentee, lobbying actif aligne avec
trajectoire reglementaire previsible), le verdict correct est SAIN
avec score 0-25, pas not-applicable. Une entreprise dans un secteur
peu regule ou avec compliance mature (Atlassian SaaS B2B sans
exposition particuliere au S-1 2015, Datadog observabilite B2B,
Stripe avec agrement etablissement paiement obtenu des 2017 avant
PSD2, Klarna apres 2022 avec licence credit institution europeenne
en place) est SAIN sur cet axe, pas not-applicable.

NOT_APPLICABLE EST RESERVE AUX CAS OU L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : pre-revenu sans utilisateurs ni perimetre
juridictionnel articule (lab deeptech sans deploiement commercial),
R&D pure pre-commerciale avec produit non encore expose au public,
holding pure de participations sans operation propre. Hors ces cas,
l axe est applicable et le verdict doit etre cote.

Si l axe 1 est legitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface RegulatorySnapshot {
  /** Mots-cles secteur regule detectes */
  reguleKeywords: string[];
  /** Mots-cles compliance detectes */
  complianceSignals: string[];
  /** Stage et secteur */
  stage: string;
  sector: string;
  country: string;
}

const REGULE_KEYWORDS = [
  'finance', 'fintech', 'banque', 'bank', 'credit', 'paiement', 'payment',
  'assurance', 'insurance', 'sante', 'health', 'biotech', 'pharma',
  'defense', 'defence', 'telecom', 'crypto', 'blockchain', 'gambling',
  'jeu', 'pari', 'drone', 'autonomous', 'gig', 'livreur', 'chauffeur',
  'driver', 'food delivery', 'rideshare', 'short-term rental', 'airbnb',
  'meuble touristique', 'GDPR', 'AI Act', 'DSA', 'DMA', 'PSD2', 'PSD3',
  'CCD2', 'MiCA', 'Securities Act', 'KYC', 'AML', 'lutte blanchiment',
];

const COMPLIANCE_SIGNALS = [
  'compliance officer', 'DPO', 'data protection officer', 'general counsel',
  'directeur juridique', 'compliance team', 'lobbying', 'transparency register',
  'agrement', 'license bancaire', 'banking license', 'license credit',
  'KYC', 'AML',
];

function extractRegulatorySnapshot(extraction: ExtractionOutput): RegulatorySnapshot {
  const text = [
    extraction.marketPitch,
    extraction.productDescription,
    extraction.businessModel,
    extraction.sector,
    (extraction as any).rawSummary,
  ].filter(Boolean).join(' ');

  const reguleKeywords = REGULE_KEYWORDS.filter((k) =>
    new RegExp(`\\b${k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(text),
  );

  const complianceSignals = COMPLIANCE_SIGNALS.filter((k) =>
    text.toLowerCase().includes(k.toLowerCase()),
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

  return `# DOSSIER A ANALYSER

Entreprise : ${e.companyName ?? 'non communique'}
Secteur : ${snap.sector}
Stade : ${snap.stage}
Pays : ${snap.country}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# PRODUIT

${e.productDescription ?? '(non fourni)'}

# MODELE ECONOMIQUE

${e.businessModel ?? '(non fourni)'}

# SIGNAUX REGLEMENTAIRES DETECTES AU PRE-SCREEN

Mots-cles secteur regule : ${snap.reguleKeywords.length > 0 ? snap.reguleKeywords.join(', ') : 'aucun mot-cle reglementaire detecte explicitement'}
Signaux compliance : ${snap.complianceSignals.length > 0 ? snap.complianceSignals.join(', ') : 'aucun signal de fonction compliance detecte'}

# RESUME GENERAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TACHE

Analyse ce dossier sur le pattern Regulatory Time Bomb selon les trois axes
detailles. Identifie d abord lequel des trois sous-types s applique
(regulation a venir connue, regulation existante mal appliquee, regulation
future probabiliste). Mentionne le sous-type identifie dans le
resumeEditorial. Si aucun sous-type ne s applique, marque l applicabilite
en not-applicable. Retourne uniquement le JSON conforme au format
obligatoire, sans preambule.`;
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
  // sur l exposition reglementaire structurelle ni sur la preparation
  // documentee. Court-circuit avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Regulatory Time Bomb non evaluable : aucun revenu ni burn chiffre dans le dossier. La doctrine necessite une matiere economique pour mesurer l exposition reglementaire.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modele economique lisible. Pattern Regulatory Time Bomb non evaluable.',
      shouldRun: false,
    };
  }

  const snap = extractRegulatorySnapshot(extraction);

  // Aucun mot-cle reglementaire detecte ET pas de business model en
  // contact direct avec le regulateur (marketplace, contract-b2g)
  const businessModelText = (extraction.businessModel ?? '').toLowerCase();
  const isPublicOrMarketplace = /marketplace|contract|b2g|public sector|gouvernement|government/i.test(businessModelText);

  if (snap.reguleKeywords.length === 0 && !isPublicOrMarketplace) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun signal reglementaire detecte au pre-screen et modele economique sans contact direct avec le regulateur. Pattern non applicable.',
      shouldRun: false,
    };
  }

  return {
    level: 'full',
    rationale: snap.reguleKeywords.length > 0
      ? `Secteur regule detecte (${snap.reguleKeywords.slice(0, 3).join(', ')}${snap.reguleKeywords.length > 3 ? '...' : ''}), analyse complete des trois axes pertinente.`
      : 'Modele economique avec contact regulatoire (marketplace ou public), analyse complete pertinente.',
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
    throw new Error('Regulatory Time Bomb: failed to parse LLM JSON response');
  }

  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (exposition reglementaire structurelle)
  // est l axe identitaire de Regulatory Time Bomb. Sans exposition
  // reglementaire mesurable, le pattern n a pas d objet.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Regulatory Time Bomb non applicable : l axe identitaire (exposition reglementaire structurelle) est neutralise. Le secteur n est pas en bascule reglementaire identifiable.',
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
