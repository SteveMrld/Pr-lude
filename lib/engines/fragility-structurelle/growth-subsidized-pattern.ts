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

const PATTERN_ID: PatternId = 'growth-subsidized-model';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior specialiste de la fragilite economique structurelle des
entreprises a forte croissance. Tu analyses le pattern Growth Subsidized Model
sur ce dossier : croissance du revenu qui masque une economie unitaire qui detruit
de la valeur a chaque transaction marginale.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Tu ne juges pas la subvention de croissance sur des impressions. Tu interpretes
des chiffres reproductibles qui te sont fournis. Pour chaque axe, tu cherches
au moins deux evidences chiffrees convergentes avant de conclure. Tu cherches
symetriquement les evidences contraires. Une seule citation isolee ne suffit
pas a forcer un score eleve.

# AXE 1 : UNIT ECONOMICS NEGATIVE DOCUMENTEE

Mesure si chaque transaction marginale cree ou detruit de la valeur. Quatre
sous-modules a tester :

- GROSS_MARGIN_NEGATIVE : marge brute negative ou structurellement faible (en
  dessous de 30% pour SaaS, en dessous de 15% pour marketplace, en dessous de
  20% pour DTC). Cite le chiffre et la source.

- CONTRIBUTION_MARGIN_NEGATIVE : la contribution margin (marge brute moins
  couts variables) est negative. Pattern Casper, MoviePass canonique. Cite le
  calcul si possible.

- CAC_PAYBACK_GT_24M : le CAC payback period depasse 24 mois pour un SaaS
  (signe que les unit economics ne tiennent pas), ou depasse 12 mois pour un
  consumer, ou n est pas calculable faute de donnees. Cite le LTV / CAC ratio
  s il est present.

- DISCOUNT_DEPENDENCY : la croissance depend structurellement de promotions et
  remises. Si on retire les remises, la conversion s effondre. Pattern Cazoo.

# AXE 2 : TRAJECTOIRE DE SUBVENTION PERSISTANTE

Mesure si la croissance est financee par le capital plutot que par le revenu.
Quatre sous-modules :

- BURN_TO_REVENUE_RATIO : le burn mensuel represente plus de 100% du revenu
  mensuel sur les 12 derniers mois. Au-dela, l entreprise consomme du capital
  pour fabriquer chaque euro de revenu.

- RUNWAY_RAPPROCHE : le runway courant est inferieur a 18 mois. Combine avec un
  burn-to-revenue eleve, signe que le modele ne tiendra pas sans levee.

- GROWTH_DECELERATION : malgre la subvention, la croissance ralentit (decroissance
  du taux de croissance trimestrielle). Pattern dans lequel la subvention ne
  produit meme plus la croissance qui la justifiait.

- CAPITAL_INTENSITY_HIGH : ratio capital cumule leve sur revenu annuel
  superieur a 3x pour un SaaS, 2x pour un marketplace. Signe d intensite
  capitalistique anormale pour le secteur.

# AXE 3 : ABSENCE DE PLAN DOCUMENTE VERS LA MARGE

Mesure la maturite strategique du management face au probleme. Trois
sous-modules :

- NO_PATH_TO_PROFITABILITY : le BP ne contient pas de scenario chiffre vers le
  breakeven, ou le scenario est generique sans milestones.

- DENIAL_INDICATORS : le pitch et la communication minorent ou nient le
  probleme d unit economics, plutot que d articuler une these de
  redressement. Distinction importante : le probleme est admis et adresse
  (sain) vs. le probleme est nie (drapeau-rouge).

- PROMOTION_DRIVEN_GROWTH_AS_FEATURE : la subvention de croissance est
  presentee comme un choix strategique long-terme plutot que comme un
  passage a accelerer vers le breakeven. Indicateur d engagement durable
  dans le modele subventionne.

# COUNTER-ARCHETYPES

Identifie le counter-archetype le plus proche et explique en deux phrases :

Patterns confirmes (effondrement) : Casper (DTC matelas, contribution margin
negative documentee jusqu a la depreciation post-IPO 2020), MoviePass (places
de cinema vendues sous le prix d achat structurel), Quibi (1,75 milliard
d engagements contenus sans business model viable), WeWork sur axe unit
economics (locations sous-pricees vs cout reel), Cazoo (vente vehicules
sub-marge avec retour quasi-nul), Fast (checkout startup brulant 10 millions
par mois sans path), Zume (pizza in van, coute production tres au-dessus du
prix vente).

Counter-archetypes sains : Atlassian (gross margin >= 80%, CAC efficient),
Datadog (unit economics SaaS classique, contribution margin saine), Adyen
(commission paiement avec marge transparente et stable), Booking (commission
only, pas de stock), Stripe (ratio LTV/CAC eleve avec switching costs),
Spotify (streaming avec marges streaming >= 25% et croissantes).

La distinction n est pas le simple fait de bruler du capital pour grandir.
C est de bruler du capital ET de creer de la valeur sub-zero a chaque
transaction. Atlassian a brule du capital en early days mais avec marges
unitaires saines. Casper a brule du capital ET vendait des matelas sous
contribution margin, ce qui rendait l entreprise incapable d atteindre la
rentabilite par le scale.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 a 2 phrases qui justifient le niveau d application",
  "axis1": {
    "score": 0-100,
    "verdict": "sain | attention | alerte | drapeau-rouge | non-applicable",
    "rationale": "synthese 2-3 phrases sur l unit economics observee",
    "evidencePro": ["citation 1 datee avec tag", "citation 2 datee avec tag"],
    "evidenceContra": ["citation 1 contra", "citation 2 contra"],
    "confidence": 0-100
  },
  "axis2": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthese sur trajectoire de subvention",
    "evidencePro": [...],
    "evidenceContra": [...],
    "confidence": 0-100
  },
  "axis3": {
    "score": 0-100,
    "verdict": "...",
    "rationale": "synthese sur plan vers la marge",
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

Si plus de 60% du COGS technique sur un seul fournisseur est documente comme
contribution margin negative ET aucun plan vers le breakeven n est articule,
alors globalScore >= 70 force.

Si gross margin documentee superieure a 60% ET CAC payback < 18 mois ET plan
vers breakeven articule avec milestones, alors globalScore <= 30 sauf
evidence contraire majeure.

# REGLE DE GATING AXE CENTRAL (AXE 1)

L axe 1 (unit economics) est l axe identitaire de Growth Subsidized Model.

DEFINITION DE L APPLICABILITE : l axe 1 est applicable a tout dossier
qui presente des unit economics mesurables, meme positives. Cela
signifie un revenu mesurable par transaction ou par client, et un cout
direct associe (COGS, CAC, gross margin, contribution margin). Si
l axe est applicable tu DOIS produire un verdict parmi sain, attention,
alerte ou drapeau-rouge. En absence de signaux de fragilite (gross
margin saine, payback rapide, plan de profitability articule), le
verdict correct est SAIN avec score 0-25, pas not-applicable. Une
entreprise rentable avec unit economics positives (Atlassian gross
margin 84% deja rentable au S-1, Stripe LTV/CAC 12x avec switching cost
API integree, Datadog NRR 130%+, Snowflake net retention 165%) est
SAIN sur cet axe, pas not-applicable. Sain est le cas par defaut quand
il n y a pas de fragilite a signaler.

NOT_APPLICABLE EST RESERVE AUX CAS OU L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : pas de transactions mesurables documentees
(Theranos 2014 sans revenu communique ni BP partage), R&D pure pre-
commerciale sans modele economique articule (laboratoire deeptech
seed sans projection unit economics), produit non encore commercialise
sans aucune metrique de marche pilote. Hors ces trois cas, l axe est
applicable et le verdict doit etre cote sur l echelle sain a drapeau-
rouge.

Si l axe 1 est legitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce
cas, applicabilite = 'not-applicable' au niveau pattern et globalScore
= 0 (le moteur le forcera a null en aval).

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable. Les signaux de capital massif sans validation, de
deni structurel ou de gouvernance non alignee relevent d autres patterns
(Capital Structure Fragility, Aveuglement aux Couts Caches du moteur 8,
Tech Claim Verification du moteur 9). Mentionne-les en evidenceContra ou
dans le rationale d applicabilite, mais ne les agrege pas dans
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

  return `# DOSSIER A ANALYSER

Entreprise : ${e.companyName ?? 'non communique'}
Secteur : ${sector}
Stade : ${stage}
Pays : ${e.country ?? 'non communique'}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# PRODUIT

${e.productDescription ?? '(non fourni)'}

# MODELE ECONOMIQUE

${e.businessModel ?? '(non fourni)'}

# DONNEES FINANCIERES DISPONIBLES

${lignesFinanciales || '(aucune donnee financiere structuree disponible, analyse sur la base des elements qualitatifs)'}

# RESUME GENERAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TACHE

Analyse ce dossier sur le pattern Growth Subsidized Model selon les trois axes
detailles dans tes instructions. Retourne uniquement le JSON conforme au
format obligatoire, sans preambule.`;
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
      rationale: 'Pattern Growth Subsidized non evaluable : aucun revenu ni burn chiffre dans le dossier. La doctrine reserve ce pattern aux dossiers avec transactions mesurables (Series A+ avec BP).',
      shouldRun: false,
    };
  }

  // Sans business model lisible, le pattern ne peut pas s exprimer
  // correctement.
  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modele economique lisible dans l extraction. Pattern Growth Subsidized non evaluable.',
      shouldRun: false,
    };
  }

  // Avec donnees financieres et business model, full.
  return {
    level: 'full',
    rationale: 'Modele economique et donnees financieres disponibles, analyse complete possible.',
    shouldRun: true,
  };
}

// ============================================================
// ANALYZE
// ============================================================

async function analyze(input: PatternInput): Promise<PatternAnalysisOutput> {
  // Pre-evaluation
  const check = isApplicable(input.extraction, input.financialData);
  if (!check.shouldRun) {
    return buildNotApplicableOutput(PATTERN_ID, check.rationale);
  }

  // Appel LLM
  const userPrompt = buildUserPrompt(input);
  const response = await callClaude(SYSTEM_PROMPT, userPrompt, 4000);

  const raw = parseJSON<RawLLMOutput>(response);
  if (!raw) {
    throw new Error('Growth Subsidized: failed to parse LLM JSON response');
  }

  // Application du niveau d applicabilite calcule en pre-eval (override
  // possible par le LLM s il detecte un cas specifique de matiere
  // insuffisante)
  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (unit economics) est l axe identitaire
  // de Growth Subsidized Model. S il est neutralise par le LLM,
  // verdict global force a non-applicable, score null. Empeche les
  // axes peripheriques (subvention, denial) de tirer un score sur
  // un pattern doctrinalement hors-scope.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Growth Subsidized non applicable : l axe identitaire (unit economics) est neutralise par absence de transactions mesurables. Les signaux peripheriques observables sur ce dossier (capital, denial, gouvernance) relevent d autres patterns.',
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
};
