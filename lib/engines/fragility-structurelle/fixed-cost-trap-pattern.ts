// ============================================================
// FIXED COST TRAP - PATTERN PHASE 4
// ------------------------------------------------------------
// Implémentation TypeScript de la doctrine écrite dans
// docs/patterns/fixed-cost-trap.md.
//
// Pattern WeWork canonique : entreprise dont la base de coûts
// incompressibles, contractée à long terme et ne pouvant pas
// être réduite à proportion d une baisse de revenu, atteint une
// masse telle qu une stagnation ou un ralentissement de la
// croissance suffit à précipiter l effondrement.
//
// Trois axes :
//   - Axe 1 : ratio coûts fixes contre revenu
//             (part du burn fixée à 12+ mois, run-rate au point
//              d arrêt commercial, ratio sectoriel)
//   - Axe 2 : engagements long terme non résiliables
//             (total off-balance sheet, durée moyenne pondérée,
//              pénalités de sortie)
//   - Axe 3 : élasticité réelle des coûts en cas de stress
//             (capacité documentée de réduction du burn,
//              track record variabilisation, asset-lightness
//              délibérée)
//
// Le pattern combiné avec Growth Subsidized Model déclenche la
// trajectoire WeWork, l une des combinaisons diagnostiques
// drapeau-rouge du moteur Phase 4.
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
import { buildSectoralPromptBlock } from '../sectoral-injection';
import {
  buildArchetypePromptBlock,
  decorateCounterArchetype,
  stageToStade,
  type ArchetypeAxis,
  type DossierStade,
} from '../archetype-selector';

const ARCHETYPE_AXIS: ArchetypeAxis = 'fixed-cost-trap';

const PATTERN_ID: PatternId = 'fixed-cost-trap';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior spécialiste de la fragilité structurelle des modèles
asset-heavy. Tu analyses le pattern Fixed Cost Trap sur ce dossier : coûts
fixes incompressibles à long terme qui ne peuvent pas être réduits à
proportion d une baisse de revenu, basant le modèle sur l hypothèse implicite
d une croissance ininterrompue.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas la présence de coûts fixes, qui est inévitable dans tout
modèle asset-heavy. Il apparaît quand le ratio coûts fixes contre revenu sort
des marges sectorielles soutenables, quand les engagements long terme sont
signés sur l hypothèse d une croissance ininterrompue, et quand l entreprise
n a pas la capacité documentée de réduire son burn de 30% en moins de 90
jours.

Tu dois nommer chaque engagement avec son montant, sa durée, sa pénalité de
sortie. Pas de généralité type beaucoup de loyers sans le chiffre.

# AXE 1 : RATIO COÛTS FIXES CONTRE REVENU

Mesure quantitative de la dépendance à une croissance soutenue pour absorber
le run-rate de coûts fixes. Trois sous-modules :

- BURN_LOCKED_12M : part du burn mensuel fixée contractuellement à 12 mois
  ou plus. Si plus de 60% du burn est verrouillé, signal fort. Plus de 75%,
  drapeau-rouge. Calcul inclut loyers signés, contrats fournisseurs avec
  minimum, salaires senior avec clauses de départage.

- RUN_RATE_AT_ZERO_REVENUE : burn minimum si le revenu tombe à zéro du jour
  au lendemain. Si ce run-rate représente plus de 12 mois de cash en banque,
  trajectoire de fragilité extrême. Pour WeWork au pic, 3 milliards de
  dollars par an de loyers et personnel core à payer même avec zéro membre.

- SECTORIAL_DEVIATION : ratio coûts fixes contre revenu comparé au benchmark
  sectoriel. Real estate opérationnel typiquement 35-45%, content streaming
  50-65%, manufacturing hardware 30-40%. Sortie de plus de 15 points
  au-dessus = signal à investiguer.

# AXE 2 : ENGAGEMENTS LONG TERME NON RÉSILIABLES

Mesure la dimension contractuelle des coûts fixes. Trois sous-modules :

- OFF_BALANCE_RATIO : total des engagements off-balance sheet rapporté au
  revenu annuel courant. WeWork preIPO 47 milliards d engagements pour 1,8
  milliard de revenu, ratio 26x. Au-delà de 5x, ratio menaçant. Au-delà de
  15x, point de retour normal dépassé sans restructuration significative.

- WEIGHTED_AVG_DURATION : durée moyenne pondérée des engagements. Au-delà de
  5 ans pondéré, exposition cycle significative. Au-delà de 8 ans,
  exposition massive et position implicite sur le cycle.

- EXIT_PENALTY_HIGH : pénalités de sortie en cas de breakage volontaire.
  Baux immobiliers commerciaux US typiquement 60-80%, baux UE 50-70%.
  Pénalités cumulées supérieures à 50% des engagements long terme = signal
  fort.

# AXE 3 : ÉLASTICITÉ RÉELLE DES COÛTS EN CAS DE STRESS

Mesure de la capacité documentée à variabiliser. C est le mitigant majeur.
Trois sous-modules :

- DOWNSIDE_PLAN_DOCUMENTED : capacité documentée de réduction du burn de 30%
  en moins de 90 jours. Downside scenario chiffré dans le BP, layoffs déjà
  conduits dans l histoire récente, identification explicite de ce qui peut
  être coupé.

- TRACK_RECORD_VARIABILIZATION : layoff, fermeture de site, ou breakage
  contractuel réussi dans les 36 derniers mois sans dégradation
  opérationnelle majeure. Démonstration empirique de la capacité.

- ASSET_LIGHT_DELIBERATE : choix stratégique d éviter les coûts fixes
  structurels. Airbnb sur le real estate, Booking sur les chambres d hôtel,
  Uber sur les véhicules. Discipline de modèle articulée explicitement dans
  le pitch et alignée sur l exécution.

__ARCHETYPE_BLOCK__

La distinction fondamentale n est jamais le simple fait d avoir des coûts
fixes. C est l alignement entre la nature long terme des engagements et la
prévisibilité long terme du revenu, plus la capacité documentée à réduire
le burn quand cet alignement déraille. Une même structure de coûts peut
être saine ou trap selon ce que le revenu sous-jacent permet de soutenir
et selon que les engagements sont adossés à des contrats clients longs ou
à des occupations courtes au choix de l usager.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 à 2 phrases qui justifient le niveau d application",
  "axis1": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthèse 2-3 phrases sur le ratio coûts fixes / revenu",
    "evidencePro": ["citation 1 datée avec tag", "citation 2 datée avec tag"],
    "evidenceContra": ["citation 1 contra", "citation 2 contra"],
    "confidence": 0-100
  },
  "axis2": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthèse sur engagements long terme",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "axis3": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthèse sur élasticité des coûts en stress",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases de synthèse éditoriale",
  "counterArchetype": {
    "closest": "nom de boîte",
    "direction": "trajectoire-saine | derive-confirmee",
    "rationale": "2 phrases"
  },
  "recommandationDD": "1 phrase concrète pour orienter la DD"
}

# CONTRAINTE DE COHÉRENCE

Si plus de 70% du burn verrouillé contractuellement ET aucun downside
scenario chiffré dans le BP, alors globalScore >= 70 forcé.

Si moins de 35% de coûts fixes ET track record de variabilisation réussie
documenté, alors globalScore <= 30 sauf evidence forte de durcissement
récent du modèle.

Le seuil score >= 60 est plus exigeant que sur les autres patterns parce
que le diagnostic se confond facilement avec les structures de coûts
normales des modèles asset-heavy. Tu dois être rigoureux sur la symétrie
evidence pro contra.

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

# RÈGLE DE GATING AXE CENTRAL (AXE 2)

L axe 2 (engagements long terme non résiliables) est l axe identitaire de
Fixed Cost Trap. La signature pathologique du pattern (WeWork canonique)
est le ratio engagements off-balance contre revenu, pas la rigidité courante
de la structure de coûts qui peut être sectoriellement normale dans tout
asset-heavy.

DÉFINITION DE L APPLICABILITÉ : l axe 2 est applicable à tout dossier
qui a une structure de coûts identifiable, qu elle soit asset-light ou
asset-heavy. Une SaaS sans bail commercial significatif a quand même
des engagements salariaux et infra cloud qu il faut lire. Si l axe est
applicable tu DOIS produire un verdict parmi sain, attention, alerte ou
drapeau-rouge. En absence de signaux de fragilité (peu d engagements
long terme, ratio off-balance / revenu inférieur à 1x, capacité
documentée de variabilisation, track record layoffs ou breakage
contractuel), le verdict correct est SAIN avec score 0-25, pas
not-applicable. Une entreprise asset-light avec engagements alignés
sur revenu (Atlassian SaaS sans capex industriel, Airbnb sans
propriété immobilière, Booking sans stock hôtelier, Salesforce data
centers alignés sur contrats client long terme) est SAIN sur cet axe,
pas not-applicable. Sain est le cas par défaut quand il n y a pas de
trap structural à signaler.

NOT_APPLICABLE EST RÉSERVÉ AUX CAS OÙ L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : pre-revenu seed sans aucun engagement
contractuel structuré (incubation pre-product), modèle revenue-share
ou marketplace pur sans coûts propres au-delà de la tech (les coûts
sont chez les hosts ou marchands), holding pure de participations
sans opération propre. Hors ces cas, l axe est applicable et le
verdict doit être coté sur l échelle sain à drapeau-rouge.

Si l axe 2 est légitimement non-applicable au sens ci-dessus, tu DOIS
coter axis2.verdict = 'non-applicable' et axis2.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

# RÈGLE DE PLAFOND AXE 2

Si le ratio engagements off-balance / revenu annuel courant est inférieur
à 1x, tu DOIS coter axis2.score <= 40 et globalScore <= 50 (verdict
attention max), quels que soient les autres axes. La doctrine considère 5x
comme seuil menaçant. En dessous de 1x, le pattern n est pas dans son
périmètre. Cite explicitement le ratio dans le rationale.

# RÈGLE ANTI-CONTAMINATION GROWTH SUBSIDIZED MODEL

Le score Fixed Cost Trap mesure exclusivement la rigidité contractuelle
long-terme face à un choc demande. La marge unitaire négative, l absence
de path to profitability, le ratio LTV/CAC défavorable, le repeat rate
insuffisant relèvent du pattern Growth Subsidized Model et NE DOIVENT EN
AUCUN CAS gonfler le score Fixed Cost Trap. Si tu identifies ces signaux,
mentionne-les en evidenceContra ou dans le rationale, mais ne les agrège
pas dans le scoring des trois axes FCT. Le moteur orchestrateur lance
GSM en parallèle, le signal y sera capté.

# RÈGLE DE DÉTECTION D INVERSION

Si tu identifies que le mécanisme structurel observé est une *inversion*
ou une *transposition* du pattern (par exemple coût variable rigide par
transaction au lieu de coût fixe contractuel long-terme, ou engagement
client unilatéral au lieu d engagement vendor), tu DOIS retourner
applicabilite='not-applicable' avec axis2.verdict='non-applicable' et
documenter dans applicabiliteRationale le pattern alternatif qui
correspond réellement (typiquement Growth Subsidized si UE négative,
ou Capital Structure Fragility si dépendance financement). Cas canonique :
MoviePass, dont le mécanisme (engagement client unlimited contre coût
ticket variable) est l inversion du Fixed Cost Trap WeWork (engagement
vendor bail rigide contre revenu variable).`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface FinancialBurnSnapshot {
  monthlyBurn?: number;
  fixedBurnEstimated?: number;
  runwayMonths?: number;
  totalCommitments?: number;
  offBalanceRatio?: number;
  capexCumulated?: number;
  payroll?: number;
  rentAnnual?: number;
  contractualMinimums?: number;
}

function extractBurnSnapshot(financialData: FinancialDataExtraction | null | undefined): FinancialBurnSnapshot {
  if (!financialData) return {};
  const f: any = financialData;
  return {
    monthlyBurn: f?.monthlyBurn ?? f?.burnRate,
    fixedBurnEstimated: f?.fixedBurn ?? f?.fixedCosts,
    runwayMonths: f?.runwayMonths ?? f?.runway,
    totalCommitments: f?.totalCommitments ?? f?.offBalanceCommitments,
    capexCumulated: f?.capex ?? f?.cumulativeCapex,
    payroll: f?.payroll ?? f?.salaryExpense,
    rentAnnual: f?.rentAnnual ?? f?.annualRent,
    contractualMinimums: f?.contractualMinimums,
  };
}

function buildUserPrompt(input: PatternInput): string {
  const e = input.extraction;
  const burn = extractBurnSnapshot(input.financialData);

  const lignesBurn = Object.entries(burn)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `- ${k} : ${v}`)
    .join('\n');

  const sectoralBlock = buildSectoralPromptBlock(input.sectoralContext, 'fragility-structurelle');

  return `${sectoralBlock}# DOSSIER À ANALYSER

Entreprise : ${e.companyName ?? 'non communiqué'}
Secteur : ${e.sector ?? 'inconnu'}
Stade : ${e.fundraise?.stage ?? 'inconnu'}
Pays : ${e.country ?? 'non communiqué'}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# PRODUIT

${e.productDescription ?? '(non fourni)'}

# MODÈLE ÉCONOMIQUE

${e.businessModel ?? '(non fourni)'}

# DONNÉES BURN ET ENGAGEMENTS DISPONIBLES

${lignesBurn || '(aucune donnée structurelle de burn ni d engagement long terme disponible, analyse sur la base des éléments qualitatifs du pitch et du résumé)'}

# RÉSUMÉ GÉNÉRAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TÂCHE

Analyse ce dossier sur le pattern Fixed Cost Trap selon les trois axes
détaillés dans tes instructions. Si les données structurelles de burn et
d engagement sont absentes, base ton analyse sur les indices qualitatifs
(présence de bureaux, capex industriel mentionné, structure salariée
déclarée, contrats long terme évoqués) et marque l applicabilité en partial
ou weak-signal selon le niveau de matière disponible. Retourne uniquement
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
  const auditResult = auditTagging(allEvidence.join(' '), 'fixed-cost-trap-pattern');

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
  // Pre-check universel : sans revenu ni burn dans financialData, on ne
  // peut pas raisonner sur le ratio coûts fixes / revenu ni sur le
  // run-rate au point d arrêt commercial. La doctrine FCT exige un BP
  // détaillé avec breakdown coûts fixes vs variables. Court-circuit
  // avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Fixed Cost Trap non évaluable : aucun revenu ni burn chiffré dans le dossier. La doctrine exige un BP détaillé avec breakdown coûts fixes contre variables.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  const text = [extraction.marketPitch, extraction.productDescription, extraction.businessModel, (extraction as any).rawSummary]
    .filter(Boolean).join(' ').toLowerCase();

  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modèle économique lisible. Pattern Fixed Cost Trap non évaluable.',
      shouldRun: false,
    };
  }

  // SaaS pure cloud sans capex industriel : variabilisation rapide possible,
  // pattern en lecture limitée (axe 3 reste actif sur les engagements long
  // terme contractuels éventuels).
  const isPurelyCloudSaas = /\b(saas)\b/i.test(text)
    && !/\b(usine|factory|warehouse|entrepot|production|capex|industriel|industrial|hardware|biotech)\b/i.test(text);

  if (isPurelyCloudSaas) {
    return {
      level: 'partial',
      rationale: 'SaaS pure cloud : coûts fixes typiquement variabilisables (cloud downscaling, layoff). Pattern en lecture limitée sur les engagements long-terme contractuels éventuels.',
      shouldRun: true,
    };
  }

  // Modèle asset-heavy : full
  const isAssetHeavy = /\b(real estate|immobilier|usine|factory|warehouse|entrepot|production|capex|industriel|industrial|hardware|biotech|fleet|flotte|content production|content studio)\b/i.test(text);

  if (isAssetHeavy) {
    return {
      level: 'full',
      rationale: 'Modèle asset-heavy : analyse complète des trois axes Fixed Cost Trap pertinente.',
      shouldRun: true,
    };
  }

  // Stage avancé avec engagements probables : full même sans signal explicite
  const isLateStage = /series\s*[b-z]|growth|late.stage/i.test(extraction.fundraise?.stage ?? '');
  if (isLateStage) {
    return {
      level: 'full',
      rationale: 'Stade growth : engagements long terme typiquement matérialisés, analyse complète pertinente.',
      shouldRun: true,
    };
  }

  // Stade précoce sans signal asset-heavy : partial
  return {
    level: 'partial',
    rationale: 'Stade précoce sans signal asset-heavy explicite : pattern en lecture indicative sur les engagements long-terme éventuels.',
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
    throw new Error('Fixed Cost Trap: failed to parse LLM JSON response');
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

  // Gating axe central : axe 2 (engagements long terme non résiliables)
  // est l axe identitaire de Fixed Cost Trap. Sans engagements
  // contractuels long-terme identifiables, le pattern n a pas d objet.
  // La rigidité courante des coûts (axe 1) seule ne suffit pas à
  // déclencher le pattern, qui se confond sinon avec tout asset-heavy
  // sectoriellement normal.
  return applyCentralAxisGating(
    output,
    'axis2',
    'Pattern Fixed Cost Trap non applicable : l axe identitaire (engagements long terme contractuels) est neutralisé. Le mécanisme observé ne correspond pas à la signature WeWork (off-balance > 5x revenu, durée > 5 ans). Si rigidité économique observée, voir Growth Subsidized Model ou Capital Structure Fragility.',
  );
}

// ============================================================
// MODULE EXPORT ET AUTO-REGISTRATION
// ============================================================

export const fixedCostTrapPattern: PatternModule = {
  patternId: PATTERN_ID,
  isApplicable,
  analyze,
};

registerPattern(fixedCostTrapPattern);

// ============================================================
// EXPOSITION POUR TESTS UNITAIRES
// ============================================================

export const _internal = {
  buildUserPrompt,
  llmOutputToPatternOutput,
  isApplicable,
  extractBurnSnapshot,
  SYSTEM_PROMPT,
};
