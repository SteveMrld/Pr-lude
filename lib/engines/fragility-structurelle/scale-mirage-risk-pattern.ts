// ============================================================
// SCALE MIRAGE RISK - PATTERN PHASE 4
// ------------------------------------------------------------
// Implémentation TypeScript de la doctrine écrite dans
// docs/patterns/scale-mirage-risk.md.
//
// Pattern Ynsect canonique : entreprise qui engage des
// investissements industriels lourds (usines, lignes de
// production, capex spécialisés) avant que la demande
// commerciale ait validé la traction du produit ou que les
// coûts unitaires aient atteint la cible économique.
//
// Image miroir de Growth Subsidized Model pour les modèles
// industriels et deeptech avec une particularité opérationnelle :
// les capex industriels sont presque irréversibles. Une usine
// bâtie ne peut pas être coupée comme un budget marketing.
//
// Trois axes :
//   - Axe 1 : disproportion capex / demande validée
//   - Axe 2 : maturité technologique au commitment industriel
//   - Axe 3 : flexibilité du modèle industriel
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

const PATTERN_ID: PatternId = 'scale-mirage-risk';
const ARCHETYPE_AXIS: ArchetypeAxis = 'scale-mirage-risk';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior spécialiste de l industrialisation des entreprises
deeptech, hardware et industrielles. Tu analyses le pattern Scale Mirage
Risk sur ce dossier : engagements industriels lourds (capex, usines, lignes
de production) avant que la demande commerciale ait validé la traction du
produit ou que les coûts unitaires aient atteint la cible économique.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern n est pas la simple présence de capex industriel, qui est
inévitable dans tout modèle asset-heavy. C est la disproportion entre le
capex engagé et la matière commerciale qui doit l absorber, mesurée en
contrats fermes plutôt qu en projections marché.

Le pattern image miroir de Growth Subsidized Model : pour Growth
Subsidized, c est le revenu qui croît sans marge unitaire viable. Pour
Scale Mirage, c est la capacité industrielle qui croît sans demande
commerciale validée. Particularité opérationnelle critique : les capex
industriels sont presque irréversibles, contrairement au burn marketing
qui peut être coupé du jour au lendemain.

Tu dois nommer le capex précis, la capacité prévue, la demande validée
par contrats fermes, et le décalage temporel s il existe.

# AXE 1 : DISPROPORTION CAPEX / DEMANDE VALIDÉE

Mesure de l asymétrie quantitative entre l investissement industriel et
la matière commerciale qui doit l absorber. Trois sous-modules :

- RATIO_CAPEX_REVENU : ratio capex industriel cumulé sur revenu annuel
  courant. Au-delà de 5x signal d exposition. Au-delà de 10x signal
  fort. Au-delà de 20x drapeau-rouge sauf evidence contraire majeure.
  Pour Ynsect au peak capex, ratio > 30x.

- COVERAGE_CONTRATS_FERMES : capacité de production prévue couverte par
  contrats fermes ou LOI qualifiées. Distinction cruciale LOI signée
  datée avec montant vs LOI marketing intention générique. Pour les
  gigafactories EV, absence de contrats fermes OEMs au-delà de 30% de
  la capacité = signal majeur.

- DECALAGE_TEMPOREL : décalage entre mise en service planifiée et besoin
  commercial réel. Usine prévue 2026 mais premiers contrats fermes
  couvrant que 2028 = capital qui dort, économiquement destructeur sauf
  financement public massif compensatoire.

# AXE 2 : MATURITÉ TECHNOLOGIQUE AU COMMITMENT INDUSTRIEL

Mesure de la solidité technique du produit industrialisé. Quatre
sous-modules :

- TRL_AT_COMMITMENT : Technology Readiness Level au moment du commitment
  industriel. TRL 9 = produit en opération commerciale éprouvée, TRL 8 =
  démonstration en environnement opérationnel, TRL 7 = environnement
  représentatif. En dessous de TRL 8 l industrialisation massive est
  généralement prématurée. Beaucoup de Scale Mirage ont engagé capex à
  TRL 6 ou 7.

- COUT_UNITAIRE_VS_CIBLE : coût actuel à la sortie de présérie vs coût
  cible nécessaire pour que le modèle tienne. Si actuel > 50% au-dessus
  cible et BP suppose descente abrupte par économies d échelle non
  documentées, pattern apparaît. Britishvolt : coût cellule présérie
  plus du double cible BYD/CATL au moment faillite.

- FIABILITE_DEMONSTREE : taux de yield production, taux de défaut, MTBF,
  durée de vie démontrée. Rarement dans le pitch, nécessite DD technique.
  Absence sur dossier prétendant industrialisation imminente = signe
  d immaturité.

- VARIANCE_R&D_INDUSTRIEL : écart entre claims R&D et performance
  présérie. Scale Mirage typiquement caractérisés par promesse R&D plus
  brillante que préséries effectives.

# AXE 3 : FLEXIBILITÉ DU MODÈLE INDUSTRIEL

Mesure de la réversibilité et de la capacité d adaptation. Mitigant
majeur. Trois sous-modules :

- REVERSIBILITE_CAPEX : part du capex revendable, sous-louable, ou
  redirigeable vers autre usage en cas de pivot. Usine généraliste
  métallique = certaine réversibilité. Bioréacteurs insectes spécialisés
  = quasi-aucune. Actifs ultra-spécialisés = signature des Scale Mirage
  les plus dangereux.

- CAPACITE_PIVOT_MARCHE : si demande primaire ne se matérialise pas,
  l entreprise peut-elle servir un marché secondaire avec les mêmes
  actifs. Northvolt EV plus stationary storage théoriquement, mais
  maturité des deux marchés insuffisante pour absorber capacité. Cas
  contraire Innovafeed avec offtake ADM diversifié réduit exposition.

- PROFIL_AMORTISSEMENT_BURN : burn industriel mensuel attendu une fois
  usine opérationnelle = amortissement capex plus coûts opération à
  capacité sous-utilisée. Si > 50% du burn total, déviation par rapport
  au plan tire le runway de manière disproportionnée. Calculer runway
  spécifique post mise en service en supposant montée en cadence
  retardée de 12 ou 24 mois.

__ARCHETYPE_BLOCK__

La distinction n est jamais le simple fait de bâtir une usine. C est
l alignement entre le capex engagé et la matière commerciale qui doit
l absorber. Ynsect et Innovafeed opèrent même catégorie deeptech avec
produits comparables protéine insectes. Différence structurelle :
sécurisation contractuelle de la demande en amont du capex.

# FORMAT JSON OBLIGATOIRE

{
  "applicabilite": "full | partial | weak-signal | not-applicable",
  "applicabiliteRationale": "1 à 2 phrases",
  "axis1": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "axis2": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "axis3": { "score": 0-100, "verdict": "...", "rationale": "...", "evidencePro": [...], "evidenceContra": [...], "confidence": 0-100 },
  "globalScore": 0-100,
  "verdict": "sain | attention | alerte | drapeau-rouge",
  "resumeEditorial": "3-4 phrases",
  "counterArchetype": { "closest": "nom", "direction": "...", "rationale": "..." },
  "recommandationDD": "1 phrase concrète"
}

# CONTRAINTE DE COHÉRENCE

Si capex cumulé > 10x revenu annuel ET TRL < 8 ET couverture
contractuelle < 30% capacité, alors globalScore >= 75 forcé.

Si capex proportionné (ratio < 3x) ET contrats long terme couvrant > 60%
capacité ET TRL >= 8, alors globalScore <= 30 sauf evidence forte de
retard opérationnel déjà matérialisé.

Le seuil score >= 65 est légèrement plus élevé que sur les autres
patterns parce que les modèles deeptech déclenchent régulièrement des
scores intermédiaires légitimes correspondant à une avance industrielle
calibrée non disqualifiante.

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

L axe 1 (disproportion capex / demande validée) est l axe identitaire
de Scale Mirage Risk.

DÉFINITION DE L APPLICABILITÉ : l axe 1 est applicable à tout dossier
avec capex industriel ou infrastructure significatifs (usine,
gigafactory, data center propriétaire, fleet de véhicules, capex
aménagement retail dépendant de la demande locale, lignes de
production spécialisées). Le pattern n est pas restreint au pure
deeptech : un DTC avec 60 stores retail propriétaires (Casper) ou un
opérateur cloud avec data centers propriétaires (CoreWeave avant
les contrats clients) est dans le périmètre du pattern, parce que
le capex aménagement est engagé avant validation de la demande
unitaire. Si l axe est applicable tu DOIS produire un verdict parmi
sain, attention, alerte ou drapeau-rouge. En absence de signaux de
fragilité (capex calibré sur demande validée par contrats fermes,
TRL élevé au commitment, réversibilité documentée), le verdict
correct est SAIN avec score 0-25, pas not-applicable. Une entreprise
industrielle saine (Tesla 2008-2012 capex Roadster mesuré puis NUMMI
plutôt que ex nihilo, ASML capex lié à contrats long terme TSMC
Samsung Intel, BYD extension progressive validée par cash flow,
Innovafeed offtake ADM sécurisé) est SAIN sur cet axe, pas
not-applicable.

NOT_APPLICABLE EST RÉSERVÉ AUX CAS OÙ L AXE N A AUCUN SENS STRUCTUREL
POUR LE BUSINESS MODEL : pure software API sans aucun capex industriel
ni aménagement physique (Stripe modèle asset-light, Atlassian SaaS
distribuée sans infra propriétaire, Datadog observabilité sans data
center propriétaire significatif), services consulting ou freelancing
sans actifs physiques propres, marketplace asset-light pure où les
actifs sont chez les hosts ou marchands (Airbnb, Booking, Uber post-
2019). Hors ces cas, l axe est applicable et le verdict doit être
coté.

Si l axe 1 est légitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface IndustrialSnapshot {
  /** Mots-clés capex industriel détectés */
  capexSignals: string[];
  /** Mots-clés demande validée détectés */
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

# SIGNAUX INDUSTRIELS DÉTECTÉS AU PRE-SCREEN

Mots-clés capex industriel : ${snap.capexSignals.length > 0 ? snap.capexSignals.join(', ') : 'aucun mot-clé capex détecté explicitement'}
Mots-clés validation demande : ${snap.demandValidationSignals.length > 0 ? snap.demandValidationSignals.join(', ') : 'aucun signal de contrats fermes ou validation commerciale'}

# RÉSUMÉ GÉNÉRAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TÂCHE

Analyse ce dossier sur le pattern Scale Mirage Risk selon les trois axes
détaillés. Cherche le ratio capex / revenu, la couverture par contrats
fermes, le TRL au moment du commitment, et la réversibilité des actifs.
Identifie le counter-archetype le plus proche en pensant à la sécurisation
contractuelle (Ynsect vs Innovafeed est la distinction de référence).
Retourne uniquement le JSON conforme, sans préambule.`;
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
  // la disproportion entre capex engagé et demande validée. Court-
  // circuit avant LLM call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Scale Mirage Risk non évaluable : aucun revenu ni burn chiffré. La doctrine nécessite la matière économique pour mesurer le mirage de scale.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modèle économique lisible. Pattern Scale Mirage Risk non évaluable.',
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
      rationale: 'Modèle pure software sans capex industriel. Pattern hors-scope sauf data centers propriétaires significatifs.',
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
        rationale: 'Stade growth pour modèle industriel : moment où s engage typiquement l industrialisation. Pattern Ynsect canonique.',
        shouldRun: true,
      };
    }
    if (isSeriesA) {
      return {
        level: 'full',
        rationale: 'Series A pour deeptech ou hardware : la thèse de mise à l échelle industrielle est souvent au cœur de la levée.',
        shouldRun: true,
      };
    }
    if (isSeed) {
      return {
        level: 'partial',
        rationale: 'Stade seed deeptech : capex pas encore engagés mais le plan d industrialisation est lisible et évaluable.',
        shouldRun: true,
      };
    }
  }

  return {
    level: 'partial',
    rationale: 'Modèle non clairement deeptech ou stade non identifiable : lecture du plan industrialisation déclaré en mode indicatif.',
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
    throw new Error('Scale Mirage Risk: failed to parse LLM JSON response');
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

  // Gating axe central : axe 1 (disproportion entre capex engagé et
  // demande validée) est l axe identitaire de Scale Mirage Risk.
  // Sans capex industriel et sans demande mesurable, pas de mirage.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Scale Mirage Risk non applicable : l axe identitaire (disproportion capex / demande validée) est neutralisé. Sans capex industriel chiffré ou sans demande commerciale évaluable, pas de mirage mesurable.',
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
