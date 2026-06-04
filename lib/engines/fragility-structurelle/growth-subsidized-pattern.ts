// ============================================================
// GROWTH SUBSIDIZED MODEL - PATTERN PHASE 4
// ------------------------------------------------------------
// Implementation TypeScript de la doctrine ecrite dans
// docs/patterns/growth-subsidized-model.md.
//
// Pattern : entreprise dont la croissance du revenu masque une
// economie unitaire qui detruit de la valeur a chaque transaction
// marginale. La trajectoire est connue (Casper, MoviePass,
// Quibi, WeWork, Cazoo) : plus l entreprise grandit, plus elle
// perd. Le moteur detecte le signal en triple analyse :
//
//   - Axe 1 : Unit economics negative documentee
//             (gross margin, contribution margin, CAC payback,
//              LTV/CAC ratio)
//   - Axe 2 : Trajectoire de subvention persistante
//             (croissance financee par capital plutot que par
//              revenu, runway rapproche, cash burn vs revenu)
//   - Axe 3 : Absence de plan documente vers la marge
//             (claims promotion-driven sans roadmap chiffree
//              vers le breakeven, deni du probleme)
//
// L analyse s appuie sur l extraction et les donnees financieres.
// Le LLM ne juge pas la subvention sur ses impressions, il
// interprete des chiffres reproductibles que le moteur lui
// fournit en amont.
// ============================================================

import { callClaude, parseJSON } from '../anthropic-client';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from '../source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from '../editorial-voice';
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

const ARCHETYPE_AXIS: ArchetypeAxis = 'growth-subsidized';

const PATTERN_ID: PatternId = 'growth-subsidized-model';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior spécialiste de la fragilité économique structurelle des
entreprises à forte croissance. Tu analyses le pattern Growth Subsidized Model
sur ce dossier : croissance du revenu qui masque une économie unitaire qui détruit
de la valeur à chaque transaction marginale.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Tu ne juges pas la subvention de croissance sur des impressions. Tu interprètes
des chiffres reproductibles qui te sont fournis. Pour chaque axe, tu cherches
au moins deux évidences chiffrées convergentes avant de conclure. Tu cherches
symétriquement les évidences contraires. Une seule citation isolée ne suffit
pas à forcer un score élevé.

# AXE 1 : UNIT ECONOMICS NÉGATIVE DOCUMENTÉE

Mesure si chaque transaction marginale crée ou détruit de la valeur. Quatre
sous-modules à tester :

- GROSS_MARGIN_NEGATIVE : marge brute négative ou structurellement faible (en
  dessous de 30% pour SaaS, en dessous de 15% pour marketplace, en dessous de
  20% pour DTC). Cite le chiffre et la source.

- CONTRIBUTION_MARGIN_NEGATIVE : la contribution margin (marge brute moins
  coûts variables) est négative. Pattern Casper, MoviePass canonique. Cite le
  calcul si possible.

- CAC_PAYBACK_GT_24M : le CAC payback period dépasse 24 mois pour un SaaS
  (signe que les unit economics ne tiennent pas), ou dépasse 12 mois pour un
  consumer, ou n est pas calculable faute de données. Cite le LTV / CAC ratio
  s il est présent.

- DISCOUNT_DEPENDENCY : la croissance dépend structurellement de promotions et
  remises. Si on retire les remises, la conversion s effondre. Pattern Cazoo.

# AXE 2 : TRAJECTOIRE DE SUBVENTION PERSISTANTE

Mesure si la croissance est financée par le capital plutôt que par le revenu.
Quatre sous-modules :

- BURN_TO_REVENUE_RATIO : le burn mensuel représente plus de 100% du revenu
  mensuel sur les 12 derniers mois. Au-delà, l entreprise consomme du capital
  pour fabriquer chaque euro de revenu.

- RUNWAY_RAPPROCHE : le runway courant est inférieur à 18 mois. Combiné avec un
  burn-to-revenue élevé, signe que le modèle ne tiendra pas sans levée.

- GROWTH_DECELERATION : malgré la subvention, la croissance ralentit (décroissance
  du taux de croissance trimestrielle). Pattern dans lequel la subvention ne
  produit même plus la croissance qui la justifiait.

- CAPITAL_INTENSITY_HIGH : ratio capital cumulé levé sur revenu annuel
  supérieur à 3x pour un SaaS, 2x pour un marketplace. Signe d intensité
  capitalistique anormale pour le secteur.

# AXE 3 : ABSENCE DE PLAN DOCUMENTÉ VERS LA MARGE

Mesure la maturité stratégique du management face au problème. Trois
sous-modules :

- NO_PATH_TO_PROFITABILITY : le BP ne contient pas de scénario chiffré vers le
  breakeven, ou le scénario est générique sans milestones.

- DENIAL_INDICATORS : le pitch et la communication minorent ou nient le
  problème d unit economics, plutôt que d articuler une thèse de
  redressement. Distinction importante : le problème est admis et adressé
  (sain) vs. le problème est nié (drapeau-rouge).

- PROMOTION_DRIVEN_GROWTH_AS_FEATURE : la subvention de croissance est
  présentée comme un choix stratégique long-terme plutôt que comme un
  passage à accélérer vers le breakeven. Indicateur d engagement durable
  dans le modèle subventionné.

__ARCHETYPE_BLOCK__

La distinction n est pas le simple fait de brûler du capital pour grandir.
C est de brûler du capital ET de créer de la valeur sub-zéro à chaque
transaction. Une entreprise saine peut avoir brûlé du capital en early days
mais avec marges unitaires positives. Un dérapage Growth Subsidized brûle du
capital ET vend sous contribution margin, ce qui rend la rentabilité
inaccessible par le scale.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 à 2 phrases qui justifient le niveau d application",
  "axis1": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthèse 2-3 phrases sur l unit economics observée",
    "evidencePro": ["citation 1 datée avec tag", "citation 2 datée avec tag"],
    "evidenceContra": ["citation 1 contra", "citation 2 contra"],
    "confidence": 0-100
  },
  "axis2": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthèse sur trajectoire de subvention",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "axis3": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthèse sur plan vers la marge",
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

Si plus de 60% du COGS technique sur un seul fournisseur est documenté comme
contribution margin négative ET aucun plan vers le breakeven n est articulé,
alors globalScore >= 70 forcé.

Si gross margin documentée supérieure à 60% ET CAC payback < 18 mois ET plan
vers breakeven articulé avec milestones, alors globalScore <= 30 sauf
évidence contraire majeure.

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

L axe 1 (unit economics) est l axe identitaire de Growth Subsidized Model.

DÉFINITION DE L APPLICABILITÉ : l axe 1 est applicable à tout dossier
qui présente des unit economics mesurables, même positives. Cela
signifie un revenu mesurable par transaction ou par client, et un coût
direct associé (COGS, CAC, gross margin, contribution margin). Si
l axe est applicable tu DOIS produire un verdict parmi sain, attention,
alerte ou drapeau-rouge. En absence de signaux de fragilité (gross
margin saine, payback rapide, plan de profitability articulé), le
verdict correct est SAIN avec score 0-25, pas not-applicable. Une
entreprise rentable avec unit economics positives (Atlassian gross
margin 84% déjà rentable au S-1, Stripe LTV/CAC 12x avec switching cost
API intégrée, Datadog NRR 130%+, Snowflake net retention 165%) est
SAIN sur cet axe, pas not-applicable. Sain est le cas par défaut quand
il n y a pas de fragilité à signaler.

NOT_APPLICABLE EST RÉSERVÉ AUX CAS OÙ L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : pas de transactions mesurables documentées
(Theranos 2014 sans revenu communiqué ni BP partagé), R&D pure pré-
commerciale sans modèle économique articulé (laboratoire deeptech
seed sans projection unit economics), produit non encore commercialisé
sans aucune métrique de marché pilote. Hors ces trois cas, l axe est
applicable et le verdict doit être coté sur l échelle sain à drapeau-
rouge.

Si l axe 1 est légitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce
cas, applicabilite = 'not-applicable' au niveau pattern et globalScore
= 0 (le moteur le forcera à null en aval).

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable. Les signaux de capital massif sans validation, de
déni structurel ou de gouvernance non alignée relèvent d autres patterns
(Capital Structure Fragility, Aveuglement aux Coûts Cachés du moteur 8,
Tech Claim Verification du moteur 9). Mentionne-les en evidenceContra ou
dans le rationale d applicabilité, mais ne les agrège pas dans
globalScore Growth Subsidized.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface FinancialSnapshot {
  revenue?: number;
  grossMargin?: number;
  contributionMargin?: number;
  burnMonthly?: number;
  runwayMonths?: number;
  capitalRaised?: number;
  cacPayback?: number;
  ltvCacRatio?: number;
  growthRateQoq?: number;
}

function extractFinancialSnapshot(financialData: FinancialDataExtraction | null | undefined): FinancialSnapshot {
  if (!financialData) return {};
  // FinancialDataExtraction est un type avec des champs heterogenes selon
  // l implementation actuelle. On extrait par best-effort, sans planter en
  // cas d absence de champ. Le LLM aura le rationale de la donnee disponible
  // ou non.
  const f: any = financialData;
  return {
    revenue: f?.revenue ?? f?.arr ?? f?.annualRevenue,
    grossMargin: f?.grossMargin ?? f?.grossMarginPercent,
    contributionMargin: f?.contributionMargin ?? f?.unitMargin,
    burnMonthly: f?.monthlyBurn ?? f?.burnRate,
    runwayMonths: f?.runwayMonths ?? f?.runway,
    capitalRaised: f?.totalCapitalRaised ?? f?.cumulativeFunding,
    cacPayback: f?.cacPayback ?? f?.cacPaybackMonths,
    ltvCacRatio: f?.ltvCacRatio,
    growthRateQoq: f?.qoqGrowthRate ?? f?.growthRate,
  };
}

function buildUserPrompt(input: PatternInput): string {
  const e = input.extraction;
  const fs = extractFinancialSnapshot(input.financialData);

  const lignesFinanciales = Object.entries(fs)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `- ${k} : ${v}`)
    .join('\n');

  const stage = e.fundraise?.stage ?? 'inconnu';
  const sector = e.sector ?? 'inconnu';

  const sectoralBlock = buildSectoralPromptBlock(input.sectoralContext, 'fragility-structurelle');

  return `${sectoralBlock}# DOSSIER À ANALYSER

Entreprise : ${e.companyName ?? 'non communiqué'}
Secteur : ${sector}
Stade : ${stage}
Pays : ${e.country ?? 'non communiqué'}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# PRODUIT

${e.productDescription ?? '(non fourni)'}

# MODÈLE ÉCONOMIQUE

${e.businessModel ?? '(non fourni)'}

# DONNÉES FINANCIÈRES DISPONIBLES

${lignesFinanciales || '(aucune donnée financière structurée disponible, analyse sur la base des éléments qualitatifs)'}

# RÉSUMÉ GÉNÉRAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TÂCHE

Analyse ce dossier sur le pattern Growth Subsidized Model selon les trois axes
détaillés dans tes instructions. Retourne uniquement le JSON conforme au
format obligatoire, sans préambule.`;
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
  // Audit tagging : compte les sources citees dans les evidences
  const allEvidence = [
    ...raw.axis1.evidencePro, ...raw.axis1.evidenceContra,
    ...raw.axis2.evidencePro, ...raw.axis2.evidenceContra,
    ...raw.axis3.evidencePro, ...raw.axis3.evidenceContra,
  ];
  const auditResult = auditTagging(allEvidence.join(' '), 'growth-subsidized-pattern');

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
      // Approximation : on utilise les compteurs de tags de l audit comme
      // proxy des sources presentes (les vrais tags listes ne sont pas
      // exposes par l API actuelle).
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
  // peut pas raisonner sur l unit economics. La doctrine GSM exige
  // explicitement un BP triennal ou des projections financieres
  // chiffrees. Court-circuit avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Growth Subsidized non évaluable : aucun revenu ni burn chiffré dans le dossier. La doctrine réserve ce pattern aux dossiers avec transactions mesurables (Series A+ avec BP).',
      shouldRun: false,
    };
  }

  // Sans business model lisible, le pattern ne peut pas s exprimer
  // correctement.
  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modèle économique lisible dans l extraction. Pattern Growth Subsidized non évaluable.',
      shouldRun: false,
    };
  }

  // Avec donnees financieres et business model, full.
  return {
    level: 'full',
    rationale: 'Modèle économique et données financières disponibles, analyse complète possible.',
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
  // Pre-evaluation
  const check = isApplicable(input.extraction, input.financialData);
  if (!check.shouldRun) {
    return buildNotApplicableOutput(PATTERN_ID, check.rationale);
  }

  // Appel LLM avec selecteur d archetype gate par asset_class
  const assetClass = input.assetClass ?? 'unclassified';
  const userPrompt = buildUserPrompt(input);
  const response = await callClaude(buildSystemPrompt(assetClass), userPrompt, 4000);

  const raw = parseJSON<RawLLMOutput>(response);
  if (!raw) {
    throw new Error('Growth Subsidized: failed to parse LLM JSON response');
  }

  // Application du niveau d applicabilite calcule en pre-eval (override
  // possible par le LLM s il detecte un cas specifique de matiere
  // insuffisante)
  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  // Decoration cross-class : prefixe la clause obligatoire si le LLM a
  // choisi un archetype hors meme asset_class.
  if (raw.counterArchetype) {
    raw.counterArchetype = decorateCounterArchetype(
      raw.counterArchetype as any,
      ARCHETYPE_AXIS,
      assetClass,
    );
  }

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (unit economics) est l axe identitaire
  // de Growth Subsidized Model. S il est neutralise par le LLM,
  // verdict global force a non-applicable, score null. Empeche les
  // axes peripheriques (subvention, denial) de tirer un score sur
  // un pattern doctrinalement hors-scope.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Croissance subventionnée non applicable sur ce dossier : aucune transaction mesurable ne permet d évaluer l unit economics. Les signaux capital ou gouvernance qui pourraient apparaître relèvent d autres patterns instruits ci-dessous.',
  );
}

// ============================================================
// MODULE EXPORT ET AUTO-REGISTRATION
// ============================================================

export const growthSubsidizedModelPattern: PatternModule = {
  patternId: PATTERN_ID,
  isApplicable,
  analyze,
};

// Side-effect : auto-enregistrement dans le registry de l orchestrateur
// au premier import du module.
registerPattern(growthSubsidizedModelPattern);

// ============================================================
// EXPOSITION POUR TESTS UNITAIRES
// ============================================================

export const _internal = {
  buildUserPrompt,
  llmOutputToPatternOutput,
  isApplicable,
  SYSTEM_PROMPT,
  buildSystemPrompt,
  ARCHETYPE_AXIS,
};
