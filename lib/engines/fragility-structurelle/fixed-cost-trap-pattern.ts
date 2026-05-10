// ============================================================
// FIXED COST TRAP - PATTERN PHASE 4
// ------------------------------------------------------------
// Implementation TypeScript de la doctrine ecrite dans
// docs/patterns/fixed-cost-trap.md.
//
// Pattern WeWork canonique : entreprise dont la base de couts
// incompressibles, contractee a long terme et ne pouvant pas
// etre reduite a proportion d une baisse de revenu, atteint une
// masse telle qu une stagnation ou un ralentissement de la
// croissance suffit a precipiter l effondrement.
//
// Trois axes :
//   - Axe 1 : ratio couts fixes contre revenu
//             (part du burn fixee a 12+ mois, run-rate au point
//              d arret commercial, ratio sectoriel)
//   - Axe 2 : engagements long terme non resiliables
//             (total off-balance sheet, duree moyenne ponderee,
//              penalites de sortie)
//   - Axe 3 : elasticite reelle des couts en cas de stress
//             (capacite documentee de reduction du burn,
//              track record variabilisation, asset-lightness
//              deliberee)
//
// Le pattern combine avec Growth Subsidized Model declenche la
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

const PATTERN_ID: PatternId = 'fixed-cost-trap';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior specialiste de la fragilite structurelle des modeles
asset-heavy. Tu analyses le pattern Fixed Cost Trap sur ce dossier : couts
fixes incompressibles a long terme qui ne peuvent pas etre reduits a
proportion d une baisse de revenu, basant le modele sur l hypothese implicite
d une croissance ininterrompue.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas la presence de couts fixes, qui est inevitable dans tout
modele asset-heavy. Il apparait quand le ratio couts fixes contre revenu sort
des marges sectorielles soutenables, quand les engagements long terme sont
signes sur l hypothese d une croissance ininterrompue, et quand l entreprise
n a pas la capacite documentee de reduire son burn de 30% en moins de 90
jours.

Tu dois nommer chaque engagement avec son montant, sa duree, sa penalite de
sortie. Pas de generalite type beaucoup de loyers sans le chiffre.

# AXE 1 : RATIO COUTS FIXES CONTRE REVENU

Mesure quantitative de la dependance a une croissance soutenue pour absorber
le run-rate de couts fixes. Trois sous-modules :

- BURN_LOCKED_12M : part du burn mensuel fixee contractuellement a 12 mois
  ou plus. Si plus de 60% du burn est verrouille, signal fort. Plus de 75%,
  drapeau-rouge. Calcul inclut loyers signes, contrats fournisseurs avec
  minimum, salaires senior avec clauses de departage.

- RUN_RATE_AT_ZERO_REVENUE : burn minimum si le revenu tombe a zero du jour
  au lendemain. Si ce run-rate represente plus de 12 mois de cash en banque,
  trajectoire de fragilite extreme. Pour WeWork au pic, 3 milliards de
  dollars par an de loyers et personnel core a payer meme avec zero membre.

- SECTORIAL_DEVIATION : ratio couts fixes contre revenu compare au benchmark
  sectoriel. Real estate operationnel typiquement 35-45%, content streaming
  50-65%, manufacturing hardware 30-40%. Sortie de plus de 15 points
  au-dessus = signal a investiguer.

# AXE 2 : ENGAGEMENTS LONG TERME NON RESILIABLES

Mesure la dimension contractuelle des couts fixes. Trois sous-modules :

- OFF_BALANCE_RATIO : total des engagements off-balance sheet rapporte au
  revenu annuel courant. WeWork preIPO 47 milliards d engagements pour 1,8
  milliard de revenu, ratio 26x. Au-dela de 5x, ratio menacant. Au-dela de
  15x, point de retour normal depasse sans restructuration significative.

- WEIGHTED_AVG_DURATION : duree moyenne ponderee des engagements. Au-dela de
  5 ans pondere, exposition cycle significative. Au-dela de 8 ans,
  exposition massive et position implicite sur le cycle.

- EXIT_PENALTY_HIGH : penalites de sortie en cas de breakage volontaire.
  Baux immobiliers commerciaux US typiquement 60-80%, baux UE 50-70%.
  Penalites cumulees superieures a 50% des engagements long terme = signal
  fort.

# AXE 3 : ELASTICITE REELLE DES COUTS EN CAS DE STRESS

Mesure de la capacite documentee a variabiliser. C est le mitigant majeur.
Trois sous-modules :

- DOWNSIDE_PLAN_DOCUMENTED : capacite documentee de reduction du burn de 30%
  en moins de 90 jours. Downside scenario chiffre dans le BP, layoffs deja
  conduits dans l histoire recente, identification explicite de ce qui peut
  etre coupe.

- TRACK_RECORD_VARIABILIZATION : layoff, fermeture de site, ou breakage
  contractuel reussi dans les 36 derniers mois sans degradation
  operationnelle majeure. Demonstration empirique de la capacite.

- ASSET_LIGHT_DELIBERATE : choix strategique d eviter les couts fixes
  structurels. Airbnb sur le real estate, Booking sur les chambres d hotel,
  Uber sur les vehicules. Discipline de modele articulee explicitement dans
  le pitch et alignee sur l execution.

# COUNTER-ARCHETYPES

Identifie le counter-archetype le plus proche et explique en deux phrases :

Patterns confirmes (effondrement ou near-death) : WeWork avant 2019 47
milliards d engagements pour 1,8 milliard de revenu run-rate 3 milliards
loyers permanents, Compass entre 2019 et 2022 4500 agents en salarie direct
face cycle immobilier residentiel valorisation 23Md a 800M, Quibi 2020 1,75
milliard contenus annules apres 6 mois, MoviePass 2017-2019 places sous prix
d achat structurel, Peloton 2021-2023 capex usine plus stocks plus payroll
ingenierie face a demande divisee par 3, Cazoo 2019-2023 stocks voitures
plus entrepots delisting et restructuration, AOL post-2002 data centers et
personnel infrastructure dial-up obsolete, Helio 2008 infrastructure telecom
fixe MVNO en perte.

Counter-archetypes sains : Airbnb asset-light explicitement sans propriete
immobiliere sans stock, Booking commission only sans stock hotelier,
Spotify engagements minimum garantis labels qui scalent avec revenu,
Netflix engagements production massifs avec ROI mesure et flexibilite
cancellation et internationalisation amortissant cout fixe par marche,
Uber post-2019 reduction massive couts fixes via automation et fermeture
marches non rentables, Salesforce engagements data center importants alignes
sur contrats clients long terme et garantis ratio off-balance dans le decile
bas SaaS sectoriel.

La distinction fondamentale n est jamais le simple fait d avoir des couts
fixes. C est l alignement entre la nature long terme des engagements et la
previsibilite long terme du revenu, plus la capacite documentee a reduire
le burn quand cet alignement deraille. Salesforce a des engagements long
terme alignes sur des contrats client long terme. WeWork avait des
engagements long terme alignes sur des occupations courtes au choix du
membre. La meme structure peut etre saine ou trap selon ce que le revenu
sous-jacent permet de soutenir.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 a 2 phrases qui justifient le niveau d application",
  "axis1": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthese 2-3 phrases sur le ratio couts fixes / revenu",
    "evidencePro": ["citation 1 datee avec tag", "citation 2 datee avec tag"],
    "evidenceContra": ["citation 1 contra", "citation 2 contra"],
    "confidence": 0-100
  },
  "axis2": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthese sur engagements long terme",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "axis3": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthese sur elasticite des couts en stress",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases de synthese editoriale",
  "counterArchetype": {
    "closest": "nom de boite",
    "direction": "trajectoire-saine | derive-confirmee",
    "rationale": "2 phrases"
  },
  "recommandationDD": "1 phrase concrete pour orienter la DD"
}

# CONTRAINTE DE COHERENCE

Si plus de 70% du burn verrouille contractuellement ET aucun downside
scenario chiffre dans le BP, alors globalScore >= 70 force.

Si moins de 35% de couts fixes ET track record de variabilisation reussie
documente, alors globalScore <= 30 sauf evidence forte de durcissement
recent du modele.

Le seuil score >= 60 est plus exigeant que sur les autres patterns parce
que le diagnostic se confond facilement avec les structures de couts
normales des modeles asset-heavy. Tu dois etre rigoureux sur la symetrie
evidence pro contra.

# REGLE DE GATING AXE CENTRAL (AXE 2)

L axe 2 (engagements long terme non resiliables) est l axe identitaire de
Fixed Cost Trap. La signature pathologique du pattern (WeWork canonique)
est le ratio engagements off-balance contre revenu, pas la rigidite courante
de la structure de couts qui peut etre sectoriellement normale dans tout
asset-heavy. Si tu ne peux pas identifier d engagements long-terme
contractuels chiffres (baux, contrats fournisseurs avec minimum, capex
non transferable, purchase commitments), tu DOIS coter axis2.verdict =
'non-applicable' et axis2.score = 0. Dans ce cas, applicabilite =
'not-applicable' au niveau pattern.

# REGLE DE PLAFOND AXE 2

Si le ratio engagements off-balance / revenu annuel courant est inferieur
a 1x, tu DOIS coter axis2.score <= 40 et globalScore <= 50 (verdict
attention max), quels que soient les autres axes. La doctrine considere 5x
comme seuil menacant. En dessous de 1x, le pattern n est pas dans son
perimetre. Cite explicitement le ratio dans le rationale.

# REGLE ANTI-CONTAMINATION GROWTH SUBSIDIZED MODEL

Le score Fixed Cost Trap mesure exclusivement la rigidite contractuelle
long-terme face a un choc demande. La marge unitaire negative, l absence
de path to profitability, le ratio LTV/CAC defavorable, le repeat rate
insuffisant relevent du pattern Growth Subsidized Model et NE DOIVENT EN
AUCUN CAS gonfler le score Fixed Cost Trap. Si tu identifies ces signaux,
mentionne-les en evidenceContra ou dans le rationale, mais ne les agrege
pas dans le scoring des trois axes FCT. Le moteur orchestrateur lance
GSM en parallele, le signal y sera capte.

# REGLE DE DETECTION D INVERSION

Si tu identifies que le mecanisme structurel observe est une *inversion*
ou une *transposition* du pattern (par exemple cout variable rigide par
transaction au lieu de cout fixe contractuel long-terme, ou engagement
client unilateral au lieu d engagement vendor), tu DOIS retourner
applicabilite='not-applicable' avec axis2.verdict='non-applicable' et
documenter dans applicabiliteRationale le pattern alternatif qui
correspond reellement (typiquement Growth Subsidized si UE negative,
ou Capital Structure Fragility si dependance financement). Cas canonique :
MoviePass, dont le mecanisme (engagement client unlimited contre cout
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

  return `# DOSSIER A ANALYSER

Entreprise : ${e.companyName ?? 'non communique'}
Secteur : ${e.sector ?? 'inconnu'}
Stade : ${e.fundraise?.stage ?? 'inconnu'}
Pays : ${e.country ?? 'non communique'}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# PRODUIT

${e.productDescription ?? '(non fourni)'}

# MODELE ECONOMIQUE

${e.businessModel ?? '(non fourni)'}

# DONNEES BURN ET ENGAGEMENTS DISPONIBLES

${lignesBurn || '(aucune donnee structurelle de burn ni d engagement long terme disponible, analyse sur la base des elements qualitatifs du pitch et du resume)'}

# RESUME GENERAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TACHE

Analyse ce dossier sur le pattern Fixed Cost Trap selon les trois axes
detailles dans tes instructions. Si les donnees structurelles de burn et
d engagement sont absentes, base ton analyse sur les indices qualitatifs
(presence de bureaux, capex industriel mentionne, structure salariee
declaree, contrats long terme evoques) et marque l applicabilite en partial
ou weak-signal selon le niveau de matiere disponible. Retourne uniquement
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
  // peut pas raisonner sur le ratio couts fixes / revenu ni sur le
  // run-rate au point d arret commercial. La doctrine FCT exige un BP
  // detaille avec breakdown couts fixes vs variables. Court-circuit
  // avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Fixed Cost Trap non evaluable : aucun revenu ni burn chiffre dans le dossier. La doctrine exige un BP detaille avec breakdown couts fixes contre variables.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  const text = [extraction.marketPitch, extraction.productDescription, extraction.businessModel, (extraction as any).rawSummary]
    .filter(Boolean).join(' ').toLowerCase();

  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modele economique lisible. Pattern Fixed Cost Trap non evaluable.',
      shouldRun: false,
    };
  }

  // SaaS pure cloud sans capex industriel : variabilisation rapide possible,
  // pattern en lecture limitee (axe 3 reste actif sur les engagements long
  // terme contractuels eventuels).
  const isPurelyCloudSaas = /\b(saas)\b/i.test(text)
    && !/\b(usine|factory|warehouse|entrepot|production|capex|industriel|industrial|hardware|biotech)\b/i.test(text);

  if (isPurelyCloudSaas) {
    return {
      level: 'partial',
      rationale: 'SaaS pure cloud : couts fixes typiquement variabilisables (cloud downscaling, layoff). Pattern en lecture limitee sur les engagements long-terme contractuels eventuels.',
      shouldRun: true,
    };
  }

  // Modele asset-heavy : full
  const isAssetHeavy = /\b(real estate|immobilier|usine|factory|warehouse|entrepot|production|capex|industriel|industrial|hardware|biotech|fleet|flotte|content production|content studio)\b/i.test(text);

  if (isAssetHeavy) {
    return {
      level: 'full',
      rationale: 'Modele asset-heavy : analyse complete des trois axes Fixed Cost Trap pertinente.',
      shouldRun: true,
    };
  }

  // Stage avance avec engagements probables : full meme sans signal explicite
  const isLateStage = /series\s*[b-z]|growth|late.stage/i.test(extraction.fundraise?.stage ?? '');
  if (isLateStage) {
    return {
      level: 'full',
      rationale: 'Stade growth : engagements long terme typiquement materializes, analyse complete pertinente.',
      shouldRun: true,
    };
  }

  // Stade precoce sans signal asset-heavy : partial
  return {
    level: 'partial',
    rationale: 'Stade precoce sans signal asset-heavy explicite : pattern en lecture indicative sur les engagements long-terme eventuels.',
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
    throw new Error('Fixed Cost Trap: failed to parse LLM JSON response');
  }

  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 2 (engagements long terme non resiliables)
  // est l axe identitaire de Fixed Cost Trap. Sans engagements
  // contractuels long-terme identifiables, le pattern n a pas d objet.
  // La rigidite courante des couts (axe 1) seule ne suffit pas a
  // declencher le pattern, qui se confond sinon avec tout asset-heavy
  // sectoriellement normal.
  return applyCentralAxisGating(
    output,
    'axis2',
    'Pattern Fixed Cost Trap non applicable : l axe identitaire (engagements long terme contractuels) est neutralise. Le mecanisme observe ne correspond pas a la signature WeWork (off-balance > 5x revenu, duree > 5 ans). Si rigidite economique observee, voir Growth Subsidized Model ou Capital Structure Fragility.',
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
