// ============================================================
// SCALE MIRAGE RISK - PATTERN PHASE 4
// ------------------------------------------------------------
// Implementation TypeScript de la doctrine ecrite dans
// docs/patterns/scale-mirage-risk.md.
//
// Pattern Ynsect canonique : entreprise qui engage des
// investissements industriels lourds (usines, lignes de
// production, capex specialises) avant que la demande
// commerciale ait valide la traction du produit ou que les
// couts unitaires aient atteint la cible economique.
//
// Image miroir de Growth Subsidized Model pour les modeles
// industriels et deeptech avec une particularite operationnelle :
// les capex industriels sont presque irreversibles. Une usine
// batie ne peut pas etre coupee comme un budget marketing.
//
// Trois axes :
//   - Axe 1 : disproportion capex / demande validee
//   - Axe 2 : maturite technologique au commitment industriel
//   - Axe 3 : flexibilite du modele industriel
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

const PATTERN_ID: PatternId = 'scale-mirage-risk';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior specialiste de l industrialisation des entreprises
deeptech, hardware et industrielles. Tu analyses le pattern Scale Mirage
Risk sur ce dossier : engagements industriels lourds (capex, usines, lignes
de production) avant que la demande commerciale ait valide la traction du
produit ou que les couts unitaires aient atteint la cible economique.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas la simple presence de capex industriel, qui est
inevitable dans tout modele asset-heavy. C est la disproportion entre le
capex engage et la matiere commerciale qui doit l absorber, mesuree en
contrats fermes plutot qu en projections marche.

Le pattern image miroir de Growth Subsidized Model : pour Growth
Subsidized, c est le revenu qui croit sans marge unitaire viable. Pour
Scale Mirage, c est la capacite industrielle qui croit sans demande
commerciale validee. Particularite operationnelle critique : les capex
industriels sont presque irreversibles, contrairement au burn marketing
qui peut etre coupe du jour au lendemain.

Tu dois nommer le capex precis, la capacite prevue, la demande validee
par contrats fermes, et le decalage temporel s il existe.

# AXE 1 : DISPROPORTION CAPEX / DEMANDE VALIDEE

Mesure de l asymetrie quantitative entre l investissement industriel et
la matiere commerciale qui doit l absorber. Trois sous-modules :

- RATIO_CAPEX_REVENU : ratio capex industriel cumule sur revenu annuel
  courant. Au-dela de 5x signal d exposition. Au-dela de 10x signal
  fort. Au-dela de 20x drapeau-rouge sauf evidence contraire majeure.
  Pour Ynsect au peak capex, ratio > 30x.

- COVERAGE_CONTRATS_FERMES : capacite de production prevue couverte par
  contrats fermes ou LOI qualifiees. Distinction cruciale LOI signee
  datee avec montant vs LOI marketing intention generique. Pour les
  gigafactories EV, absence de contrats fermes OEMs au-dela de 30% de
  la capacite = signal majeur.

- DECALAGE_TEMPOREL : decalage entre mise en service planifiee et besoin
  commercial reel. Usine prevue 2026 mais premiers contrats fermes
  couvrant que 2028 = capital qui dort, economiquement destructeur sauf
  financement public massif compensatoire.

# AXE 2 : MATURITE TECHNOLOGIQUE AU COMMITMENT INDUSTRIEL

Mesure de la solidite technique du produit industrialise. Quatre
sous-modules :

- TRL_AT_COMMITMENT : Technology Readiness Level au moment du commitment
  industriel. TRL 9 = produit en operation commerciale eprouvee, TRL 8 =
  demonstration en environnement operationnel, TRL 7 = environnement
  representatif. En dessous de TRL 8 l industrialisation massive est
  generalement prematuree. Beaucoup de Scale Mirage ont engage capex a
  TRL 6 ou 7.

- COUT_UNITAIRE_VS_CIBLE : cout actuel a la sortie de preserie vs cout
  cible necessaire pour que le modele tienne. Si actuel > 50% au-dessus
  cible et BP suppose descente abrupte par economies d echelle non
  documentees, pattern apparait. Britishvolt : cout cellule preserie
  plus du double cible BYD/CATL au moment faillite.

- FIABILITE_DEMONSTREE : taux de yield production, taux de defaut, MTBF,
  duree de vie demontree. Rarement dans le pitch, necessite DD technique.
  Absence sur dossier pretendant industrialisation imminente = signe
  d immaturite.

- VARIANCE_R&D_INDUSTRIEL : ecart entre claims R&D et performance
  preserie. Scale Mirage typiquement caracterises par promesse R&D plus
  brillante que preseries effectives.

# AXE 3 : FLEXIBILITE DU MODELE INDUSTRIEL

Mesure de la reversibilite et de la capacite d adaptation. Mitigant
majeur. Trois sous-modules :

- REVERSIBILITE_CAPEX : part du capex revendable, sous-louable, ou
  redirigeable vers autre usage en cas de pivot. Usine generaliste
  metallique = certaine reversibilite. Bioreacteurs insectes specialises
  = quasi-aucune. Actifs ultra-specialises = signature des Scale Mirage
  les plus dangereux.

- CAPACITE_PIVOT_MARCHE : si demande primaire ne se materialise pas,
  l entreprise peut-elle servir un marche secondaire avec les memes
  actifs. Northvolt EV plus stationary storage theoriquement, mais
  maturite des deux marches insuffisante pour absorber capacite. Cas
  contraire Innovafeed avec offtake ADM diversifie reduit exposition.

- PROFIL_AMORTISSEMENT_BURN : burn industriel mensuel attendu une fois
  usine operationnelle = amortissement capex plus couts operation a
  capacite sous-utilisee. Si > 50% du burn total, deviation par rapport
  au plan tire le runway de maniere disproportionnee. Calculer runway
  specifique post mise en service en supposant montee en cadence
  retardee de 12 ou 24 mois.

# COUNTER-ARCHETYPES

Patterns confirmes (faillite, redressement ou capex devalue) : Ynsect
2024 600M leves usine Amiens 372M demande B2B feed insuffisante
redressement judiciaire, Northvolt novembre 2024 gigafactories
europeennes Chapter 11 malgre 15Md leves cumule, Britishvolt janvier 2023
plans gigafactory UK 3,8Md livres faillite sans avoir produit cellule,
Faraday Future 9Md promis usine automobile retards multi-anniversaires
defaillance, Magic Leap 3,5Md leves hardware AR ventes en dessous de 1%
projections, Lilium 2024 eVTOL allemand industrialise avant certification
faillite, Hyperloop One et Virgin Hyperloop tubes test sans business
model commercialise fermeture 2023, Electric Last Mile Solutions usines
vehicules demande non validee Chapter 11 2022, Quirky industrialisait
produits crowdsourced sans validation faillite 2015, Theranos hardware
Edison machines deployees pharmacie sans validation FDA, WeWork axe
physique 2017-2019 ouverture sites avant validation locale.

Counter-archetypes sains : Tesla 2008-2012 capex Roadster mesure premier
vehicule produit avec Lotus en partenariat reduisant capex specifique
montee en cadence Model S a partir 2012 usine Fremont rachetee Toyota
NUMMI plutot que construite ex nihilo chaque etape industrielle validee
par precedente, ASML capex industriel mesure systematiquement lie a
contrats long terme avec foundries TSMC Samsung Intel demande precede
capacite ratio capex sur backlog dans fourchettes prudentes meme en
expansion, BYD extension industrielle Chine au rythme demande validee
montee progressive financement par cash flow operationnel sur quinze ans,
Rivian cas mixte capex usine Normal Illinois mais contrat ancrage Amazon
100000 vehicules en filet plus production R1T R1S valide environnement
reel evite trajectoire Britishvolt, Beyond Meat avant 2022 extension
industrielle progressive validee contrats retail successifs Whole Foods
Walmart McDonald s, Apple supply chain capex Foxconn calibre demande
mesuree iPhone ajustement trimestriel modele asset-light evite Scale
Mirage, Innovafeed contraste explicite avec Ynsect contrats ADM offtake
securise capacite ancree dans demande contractee.

La distinction n est jamais le simple fait de batir une usine. C est
l alignement entre le capex engage et la matiere commerciale qui doit
l absorber. Ynsect et Innovafeed operent meme categorie deeptech avec
produits comparables protein insectes. Difference structurelle :
securisation contractuelle de la demande en amont du capex.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 a 2 phrases",
  "axis1": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "axis2": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "axis3": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases",
  "counterArchetype": { "closest": "nom", "direction": "...", "rationale": "..." },
  "recommandationDD": "1 phrase concrete"
}

# CONTRAINTE DE COHERENCE

Si capex cumule > 10x revenu annuel ET TRL < 8 ET couverture
contractuelle < 30% capacite, alors globalScore >= 75 force.

Si capex proportionne (ratio < 3x) ET contrats long terme couvrant > 60%
capacite ET TRL >= 8, alors globalScore <= 30 sauf evidence forte de
retard operationnel deja materialise.

Le seuil score >= 65 est legerement plus eleve que sur les autres
patterns parce que les modeles deeptech declenchent regulierement des
scores intermediaires legitimes correspondant a une avance industrielle
calibree non disqualifiante.

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

L axe 1 (disproportion capex / demande validee) est l axe identitaire
de Scale Mirage Risk.

DEFINITION DE L APPLICABILITE : l axe 1 est applicable a tout dossier
avec capex industriel ou infrastructure significatifs (usine,
gigafactory, data center proprietaire, fleet de vehicules, capex
amenagement retail dependant de la demande locale, lignes de
production specialisees). Le pattern n est pas restreint au pure
deeptech : un DTC avec 60 stores retail proprietaires (Casper) ou un
operateur cloud avec data centers proprietaires (CoreWeave avant
les contrats clients) est dans le perimetre du pattern, parce que
le capex amenagement est engage avant validation de la demande
unitaire. Si l axe est applicable tu DOIS produire un verdict parmi
sain, attention, alerte ou drapeau-rouge. En absence de signaux de
fragilite (capex calibre sur demande validee par contrats fermes,
TRL eleve au commitment, reversibilite documentee), le verdict
correct est SAIN avec score 0-25, pas not-applicable. Une entreprise
industrielle saine (Tesla 2008-2012 capex Roadster mesure puis NUMMI
plutot que ex nihilo, ASML capex lie a contrats long terme TSMC
Samsung Intel, BYD extension progressive validee par cash flow,
Innovafeed offtake ADM securise) est SAIN sur cet axe, pas
not-applicable.

NOT_APPLICABLE EST RESERVE AUX CAS OU L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : pure software API sans aucun capex industriel
ni amenagement physique (Stripe modele asset-light, Atlassian SaaS
distribuee sans infra proprietaire, Datadog observabilite sans data
center proprietaire significatif), services consulting ou freelancing
sans actifs physiques propres, marketplace asset-light pure ou les
actifs sont chez les hosts ou marchands (Airbnb, Booking, Uber post-
2019). Hors ces cas, l axe est applicable et le verdict doit etre
cote.

Si l axe 1 est legitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface IndustrialSnapshot {
  /** Mots-cles capex industriel detectes */
  capexSignals: string[];
  /** Mots-cles demande validee detectes */
  demandValidationSignals: string[];
  stage: string;
  sector: string;
}

const CAPEX_KEYWORDS = [
  'capex', 'investissement industriel', 'usine', 'factory', 'gigafactory',
  'ligne de production', 'production line', 'industrialisation',
  'industrialization', 'site de production', 'production site',
  'manufacturing', 'fabrication', 'assemblage', 'assembly',
];

const DEMAND_VALIDATION_KEYWORDS = [
  'contrat', 'contract', 'offtake', 'LOI', 'letter of intent',
  'partenariat', 'partnership', 'commande ferme', 'firm order',
  'pre-commande', 'pre-order', 'backlog', 'pipeline commercial',
];

function extractIndustrialSnapshot(extraction: ExtractionOutput): IndustrialSnapshot {
  const text = [
    extraction.marketPitch,
    extraction.productDescription,
    extraction.businessModel,
    (extraction as any).rawSummary,
  ].filter(Boolean).join(' ');

  const capexSignals = CAPEX_KEYWORDS.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
  const demandValidationSignals = DEMAND_VALIDATION_KEYWORDS.filter((k) => text.toLowerCase().includes(k.toLowerCase()));

  return {
    capexSignals,
    demandValidationSignals,
    stage: extraction.fundraise?.stage ?? 'inconnu',
    sector: extraction.sector ?? 'inconnu',
  };
}

function buildUserPrompt(input: PatternInput): string {
  const e = input.extraction;
  const snap = extractIndustrialSnapshot(e);

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

# SIGNAUX INDUSTRIELS DETECTES AU PRE-SCREEN

Mots-cles capex industriel : ${snap.capexSignals.length > 0 ? snap.capexSignals.join(', ') : 'aucun mot-cle capex detecte explicitement'}
Mots-cles validation demande : ${snap.demandValidationSignals.length > 0 ? snap.demandValidationSignals.join(', ') : 'aucun signal de contrats fermes ou validation commerciale'}

# RESUME GENERAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TACHE

Analyse ce dossier sur le pattern Scale Mirage Risk selon les trois axes
detailles. Cherche le ratio capex / revenu, la couverture par contrats
fermes, le TRL au moment du commitment, et la reversibilite des actifs.
Identifie le counter-archetype le plus proche en pensant a la securisation
contractuelle (Ynsect vs Innovafeed est la distinction de reference).
Retourne uniquement le JSON conforme, sans preambule.`;
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
  const auditResult = auditTagging(allEvidence.join(' '), 'scale-mirage-risk-pattern');

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
  // la disproportion entre capex engage et demande validee. Court-
  // circuit avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Scale Mirage Risk non evaluable : aucun revenu ni burn chiffre. La doctrine necessite la matiere economique pour mesurer le mirage de scale.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modele economique lisible. Pattern Scale Mirage Risk non evaluable.',
      shouldRun: false,
    };
  }

  const text = normalizeFrText(
    [extraction.marketPitch, extraction.productDescription, extraction.businessModel, (extraction as any).rawSummary]
      .filter(Boolean).join(' '),
  );
  const sector = normalizeFrText(extraction.sector);

  // SaaS pure cloud sans capex industriel : hors-scope
  const isPureSoftware = /\b(saas|software|api|platform|cloud)\b/i.test(text)
    && !/\b(usine|factory|gigafactory|production|capex|industriel|industrial|hardware|deeptech|biotech|wet[ -]?lab|manufacturing|data center)\b/i.test(text);

  if (isPureSoftware) {
    return {
      level: 'not-applicable',
      rationale: 'Modele pure software sans capex industriel. Pattern hors-scope sauf data centers proprietaires significatifs.',
      shouldRun: false,
    };
  }

  // Stade et secteur deeptech / hardware / industriel
  const stage = (extraction.fundraise?.stage ?? '').toLowerCase();
  const isLateStage = /\bseries\s+[b-z]\b|\bserie\s+[b-z]\b|\bgrowth\b|\blate.stage\b/i.test(stage);
  const isSeriesA = /\bseries\s+a\b|\bserie\s+a\b/i.test(stage);
  const isSeed = /\bseed\b/i.test(stage);

  const isDeeptechHardware = /\b(deeptech|hardware|biotech|industriel|industrial|manufacturing|capex)\b/i.test(text + ' ' + sector);

  if (isDeeptechHardware) {
    if (isLateStage) {
      return {
        level: 'full',
        rationale: 'Stade growth pour modele industriel : moment ou s engage typiquement l industrialisation. Pattern Ynsect canonique.',
        shouldRun: true,
      };
    }
    if (isSeriesA) {
      return {
        level: 'full',
        rationale: 'Series A pour deeptech ou hardware : la these de mise a l echelle industrielle est souvent au coeur de la levee.',
        shouldRun: true,
      };
    }
    if (isSeed) {
      return {
        level: 'partial',
        rationale: 'Stade seed deeptech : capex pas encore engages mais le plan d industrialisation est lisible et evaluable.',
        shouldRun: true,
      };
    }
  }

  return {
    level: 'partial',
    rationale: 'Modele non clairement deeptech ou stade non identifiable : lecture du plan industrialisation declare en mode indicatif.',
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
    throw new Error('Scale Mirage Risk: failed to parse LLM JSON response');
  }

  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (disproportion entre capex engage et
  // demande validee) est l axe identitaire de Scale Mirage Risk.
  // Sans capex industriel et sans demande mesurable, pas de mirage.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Scale Mirage Risk non applicable : l axe identitaire (disproportion capex / demande validee) est neutralise. Sans capex industriel chiffre ou sans demande commerciale evaluable, pas de mirage mesurable.',
  );
}

// ============================================================
// EXPORT ET AUTO-REGISTRATION
// ============================================================

export const scaleMirageRiskPattern: PatternModule = {
  patternId: PATTERN_ID,
  isApplicable,
  analyze,
};

registerPattern(scaleMirageRiskPattern);

export const _internal = {
  buildUserPrompt,
  llmOutputToPatternOutput,
  isApplicable,
  extractIndustrialSnapshot,
  SYSTEM_PROMPT,
  CAPEX_KEYWORDS,
  DEMAND_VALIDATION_KEYWORDS,
};
