// ============================================================
// CAPITAL STRUCTURE FRAGILITY - PATTERN PHASE 4
// ------------------------------------------------------------
// Implémentation TypeScript de la doctrine écrite dans
// docs/patterns/capital-structure-fragility.md.
//
// Pattern le moins bien traité par les outils VC existants :
// asymétries cumulées au passif équité (préférences de
// liquidation, anti-dilutions full ratchet, drag-along
// défavorables, ESOP overhang) qui rendent la trajectoire vers
// exit ou nouveau tour mécaniquement incompatible avec la
// valorisation affichée.
//
// Trois axes :
//   - Axe 1 : empilement des préférences de liquidation
//   - Axe 2 : asymétries entre classes au-delà des préférences
//   - Axe 3 : compatibilité cap table avec chemins d exit possibles
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
import { buildSectoralPromptBlock } from '../sectoral-injection';
import type { ExtractionOutput, FinancialDataExtraction } from '../types';

const PATTERN_ID: PatternId = 'capital-structure-fragility';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior spécialiste de la structure de capital des
entreprises ayant accumulé plusieurs tours de financement. Tu analyses le
pattern Capital Structure Fragility sur ce dossier : asymétries entre
classes d actionnaires telles que la trajectoire vers une exit ou un
nouveau tour devient mécaniquement incompatible avec la valorisation
affichée.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern nécessite une lecture juridique fine du pacte d actionnaires,
des statuts, et de l historique des term sheets. Une analyse de cap table
superficielle ne suffit pas. Tu dois nommer la classe preferred concernée,
le tour d origine, le multiple, la formule exacte, et citer la clause du
pacte ou de la term sheet.

Si les documents légaux structurants ne sont pas accessibles dans le
contexte fourni, marque l applicabilité en partial ou weak-signal selon
ce qui est lisible (cap table seule, term sheet courante seule, etc.) et
recommande systématiquement la DD juridique en aval.

# AXE 1 : EMPILEMENT DES PRÉFÉRENCES DE LIQUIDATION

Mesure quantitative et qualitative de la masse de préférences au passif
equity. Quatre sous-modules :

- TOTAL_PREFERENCES_VALEUR : total des préférences cumulées en valeur
  absolue. Addition du 1x sur chaque classe preferred, multiplié par le
  multiple de participation, comparé au plafond cap. Représente le
  montant minimum à générer en exit pour que toutes les classes preferred
  récupèrent leur droit prioritaire.

- RATIO_PREFERENCES_VALORISATION : ratio total préférences sur
  valorisation post-money courante. Au-delà de 50% les common deviennent
  fragiles. Au-delà de 80% le pattern apparaît. Au-delà de 100% l
  entreprise est dans un état où même à sa propre valorisation déclarée
  les common ne valent quasi-rien.

- PARTICIPATIONS_MULTIPLES : présence de participations multiples.
  1x non participating = moins toxique, convertit en common quand exit
  suffisamment élevé. 1x participating = préférence plus partage prorata,
  détruit massivement valeur common à exit moyen. 2x ou 3x participating
  = rare et très agressif, signe de tour de détresse.

- HIERARCHIE_SENIORITY : structure pari passu vs blended vs senior. Une
  seniority en faveur des derniers entrants est particulièrement
  défavorable aux early investors et fondateurs en down round. Klarna
  2022 = cas d école.

# AXE 2 : ASYMÉTRIES ENTRE CLASSES AU-DELÀ DES PRÉFÉRENCES

Six sous-modules :

- ANTI_DILUTION_FORMULA : full ratchet (le plus toxique, re-prixe tous
  les tours précédents) vs weighted average broad-based (plus équilibré)
  vs weighted average narrow-based (intermédiaire). Full ratchet sur au
  moins un tour récent = signal fort.

- DRAG_ALONG_THRESHOLDS : qui contrôle l exit. Drag-along majorité
  preferred uniquement = common et fondateurs sans voix. Majorité de
  chaque classe = équilibre.

- VETO_RIGHTS : long catalogue de protective provisions ou matières
  réservées bloque l agilité opérationnelle. Plus la liste est longue
  et détenue par une seule classe, plus l asymétrie est forte.

- PAY_TO_PLAY : clauses obligeant les anciens preferreds à participer
  aux tours suivants pour maintenir leur protection anti-dilution.

- FOUNDER_PROTECTION : super voting rights (5 pour 1 modéré vs 20 pour 1
  excessif), double trigger acceleration, anti-dilution personnelles.
  Founder equity inférieur à 10% après plusieurs tours sans mécanisme
  compensatoire = signal fort.

- ESOP_OVERHANG : pool plein à 95% avec refresh attendu prochain tour =
  dilution future garantie. Pool à 5% sur 200 employés = sous-
  provisionnement forçant refresh massif. Les deux extrêmes problématiques.

# AXE 3 : COMPATIBILITÉ CAP TABLE AVEC CHEMINS D EXIT

L axe le plus diagnostique parce qu il traduit la structure abstraite en
implications opérationnelles. Quatre sous-modules :

- SEUIL_BREAKEVEN_PREFERRED : valorisation d exit minimum à laquelle
  toutes les classes preferred récupèrent leur préférence de liquidation.
  En dessous, les common ne touchent rien. Pour WeWork pre-2019, environ
  8 milliards de dollars.

- SEUIL_NEUTRALITE : valorisation au-dessus de laquelle la cap table
  devient effectivement neutre. Quand ce seuil est très élevé par
  rapport à la valorisation actuelle, les common sont effectivement
  bloqués entre les deux.

- PLAGE_EXIT_FAVORABLE_COMMON : fourchette de valorisations d exit dans
  laquelle les common récupèrent une fraction significative. Cap table
  saine : commence dès la valorisation actuelle. Cap table fragile :
  étroite, éloignée, ou inexistante.

- CLEANUP_ROUND_HISTORIQUE : présence d un recap, washout volontaire ou
  simplification dans l historique = mitigant fort.

# COUNTER-ARCHETYPES

Patterns confirmés (washout, recap forcé ou IPO impossible) : WeWork
avant 2019 SoftBank avec préférences cumulées plus seniority plus super
voting fondateur incompatible IPO sous 47Md, Quibi 2020 1,75Md préférences
senior si fortes que common ne pouvaient récupérer rien sauf exit > 5Md,
Cazoo 2021-2023 tours successifs preferred préférences cumulées
supérieures à capitalisation finale, Klarna 2022 down round 46Md à 6Md
active anti-dilution derniers entrants ramène fondateurs et early à
résiduel, Compass 2021-2023 recaps successifs wash-down common, Magic
Leap préférences cumulées massives sur faible traction restructurations
successives, Theranos tours successifs préférences senior participation
multiple sur valorisations éloignées fondamentaux.

Counter-archetypes sains : Stripe structure preferred simple sur
ensemble des tours peu de classes différenciées pas participation
multiple pas ratchet agressif lisible une page, Adyen IPO 2018 structure
très propre sans complexité résiduelle, Mistral tours rapides
valorisation très élevée structure préservée fondateurs préférences
classiques 1x non participating, Atlassian IPO 2015 common dominant peu
de tours privés, Snowflake structure relativement propre malgré tours
pre-IPO management évite préférences agressives, Datadog peu de
complexité cap table fondateurs protégés sans super voting excessif.

La distinction n est jamais le simple fait d avoir des préférences. C est
l accumulation de plusieurs couches d asymétries qui se renforcent
mutuellement. Une préférence 1x non participating sur tous les tours
sans seniority sans full ratchet sans veto massif est compatible avec
exit à une large gamme de valorisations.

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

Si total préférences cumulées > 90% valorisation ET au moins une
participation multiple ET full ratchet présent, alors globalScore >= 75
forcé.

Si structure 1x non participating uniformément ET pari passu ET aucun
ratchet agressif, alors globalScore <= 30 sauf evidence forte d autres
asymétries non-preference.

Pour les dossiers où plage exit favorable common est inexistante à la
valorisation actuelle (axe 3 score > 80), remontée directe en
drapeau-rouge même si autres axes modérés : incompatibilité mécanique
entre cap table et toute trajectoire d exit alignée.

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

L axe 1 (empilement des préférences de liquidation) est l axe
identitaire de Capital Structure Fragility.

RÈGLE IMPÉRATIVE À LIRE EN PREMIER. Une boîte saine profitable avec
moats établis (Atlassian S-1 octobre 2015, Stripe Series E 2016,
Datadog NRR 130%+, Snowflake net retention 165%) doit être cotée SAIN
sur cet axe, JAMAIS not-applicable, dès qu il y a une opération
equity extérieure documentée (tour primary, secondary, ESOP refresh,
entrée stratégique). La doctrine veut que ces références canoniques
sortent SAIN avec score 0-25, parce qu une cap table SIMPLE et LISIBLE
est précisément le signal positif que le pattern doit reconnaître. Le
caractère "bootstrappé" n est pas un argument pour basculer en
not-applicable dès qu un tour secondary minoritaire ou un ESOP refresh
significatif est documenté : c est au contraire la marque d une cap
table doctrinalement saine.

DÉFINITION DE L APPLICABILITÉ (large par construction). L axe 1 est
applicable à tout dossier en phase pre-IPO, post-fundraising ou en
levée active dès qu il existe un actionnariat extérieur structurant,
quel que soit l instrument utilisé. Cela inclut : tour preferred
classique (Series Seed, A, B, C, D et au-delà), secondary minoritaire
ou majoritaire (cas Atlassian Accel 2010), ESOP refresh significatif
(>5% diluted), entrée de stratégique au capital, conversion convertible
ou SAFE, cap table de pre-IPO avec class structure documentée même
simple, IPO secondary offering. Une entreprise qui a LEVÉ ou STRUCTURÉ
son capital extérieurement, même une seule fois, même via secondary
minoritaire, même sans émission primary preferred, est dans le périmètre
du pattern.

Si l axe est applicable tu DOIS produire un verdict parmi sain,
attention, alerte ou drapeau-rouge. En absence de signaux de fragilité
(préférences uniformément 1x non participating, pari passu sans
seniority défavorable, pas de full ratchet, pas de super voting
excessif, ESOP refresh mature, OU cap table simple bootstrappée avec
au plus un tour secondary minoritaire et IPO directe), le verdict
correct est SAIN avec score 0-25, pas not-applicable. Une entreprise
avec cap table simple (Stripe structure preferred lisible une page
sans participation multiple ni ratchet agressif, Adyen IPO 2018
structure très propre, Atlassian un seul tour Accel secondaire 2010
plus IPO secondary 2015 sans levée primary intermédiaire, Datadog peu
de complexité cap table) est SAIN sur cet axe, pas not-applicable. Le
caractère SECONDARY MINORITAIRE NE FAIT PAS basculer en not-applicable :
il signe au contraire une cap table doctrinalement saine et lisible
qu il faut coter SAIN avec score bas.

NOT_APPLICABLE EST RÉSERVÉ AUX CAS RARES OÙ L AXE N A AUCUN SENS
STRUCTUREL POUR LE BUSINESS MODEL : pre-product seed sans aucun tour
conduit ni ESOP structuré ni convertible signé, single founder à 100%
sans aucune partie tierce au capital ni véhicule d incitation
collaborateur, holding pure de participations sans opération propre.
Hors ces trois cas, l axe est applicable et le verdict DOIT être
coté sur l échelle sain à drapeau-rouge. Si tu hésites entre
not-applicable et sain, choisis SAIN.

Si l axe 1 est légitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface CapTableSnapshot {
  /** Mots-clés cap table détectés */
  capTableSignals: string[];
  /** Mots-clés préférences détectés */
  preferenceSignals: string[];
  /** Mots-clés cleanup détectés */
  cleanupSignals: string[];
  stage: string;
  numberOfRounds: number;
}

const CAPTABLE_KEYWORDS = [
  'preferred', 'preference', 'liquidation preference', 'pref de liquidation',
  'anti-dilution', 'anti dilution', 'full ratchet', 'weighted average',
  'drag-along', 'drag along', 'tag-along', 'tag along', 'pay-to-play',
  'pay to play', 'super voting', 'voting rights', 'ESOP', 'BSPCE', 'BSA',
  'cap table', 'pacte', 'pacte actionnaires', 'shareholders agreement',
];

const PREFERENCE_SIGNALS = [
  'participation', '1x', '2x', '3x', 'participating', 'non participating',
  'senior preferred', 'pari passu', 'cap', 'plafond', 'down round',
  'recap', 'washout', 'cleanup', 'restructuration capital',
];

function extractCapTableSnapshot(extraction: ExtractionOutput): CapTableSnapshot {
  const text = [
    extraction.marketPitch,
    extraction.productDescription,
    extraction.businessModel,
    (extraction as any).rawSummary,
    extraction.fundraise?.stage,
  ].filter(Boolean).join(' ');

  const capTableSignals = CAPTABLE_KEYWORDS.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
  const preferenceSignals = PREFERENCE_SIGNALS.filter((k) => text.toLowerCase().includes(k.toLowerCase()));
  const cleanupSignals = ['recap', 'washout', 'cleanup', 'restructuration capital']
    .filter((k) => text.toLowerCase().includes(k));

  // Estimation du nombre de tours via le stade
  const stage = (extraction.fundraise?.stage ?? '').toLowerCase();
  let numberOfRounds = 1;
  if (/series\s*[a-d]|serie\s*[a-d]/.test(stage)) {
    const match = stage.match(/series\s*([a-d])|serie\s*([a-d])/);
    const letter = (match?.[1] ?? match?.[2] ?? 'a').toLowerCase();
    numberOfRounds = letter.charCodeAt(0) - 'a'.charCodeAt(0) + 2; // seed=1, A=2, B=3...
  } else if (/seed/.test(stage)) {
    numberOfRounds = 1;
  } else if (/growth|late.stage/.test(stage)) {
    numberOfRounds = 5;
  }

  return {
    capTableSignals,
    preferenceSignals,
    cleanupSignals,
    stage: extraction.fundraise?.stage ?? 'inconnu',
    numberOfRounds,
  };
}

function buildUserPrompt(input: PatternInput): string {
  const e = input.extraction;
  const snap = extractCapTableSnapshot(e);
  const sectoralBlock = buildSectoralPromptBlock(input.sectoralContext, 'fragility-structurelle');

  return `${sectoralBlock}# DOSSIER À ANALYSER

Entreprise : ${e.companyName ?? 'non communiqué'}
Secteur : ${e.sector ?? 'inconnu'}
Stade : ${snap.stage}
Nombre estimé de tours cumulés : ${snap.numberOfRounds}
Pays : ${e.country ?? 'non communiqué'}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# MODÈLE ÉCONOMIQUE

${e.businessModel ?? '(non fourni)'}

# SIGNAUX CAP TABLE DÉTECTÉS AU PRE-SCREEN

Mots-clés cap table : ${snap.capTableSignals.length > 0 ? snap.capTableSignals.join(', ') : 'aucun mot-clé cap table dans le contexte fourni'}
Signaux préférences : ${snap.preferenceSignals.length > 0 ? snap.preferenceSignals.join(', ') : 'aucun signal préférence dans le contexte fourni'}
Signaux cleanup : ${snap.cleanupSignals.length > 0 ? snap.cleanupSignals.join(', ') : 'aucun signal de recap ou cleanup'}

# RÉSUMÉ GÉNÉRAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TÂCHE

Analyse ce dossier sur le pattern Capital Structure Fragility selon les
trois axes détaillés. Si le pacte d actionnaires, les statuts ou la cap
table détaillée ne sont pas accessibles dans le contexte fourni, marque
l applicabilité en partial ou weak-signal et recommande systématiquement
la DD juridique en aval. Calcul du waterfall à trois niveaux d exit (50%,
100%, 200% de la valorisation actuelle) si possible. Retourne uniquement
le JSON conforme, sans préambule.`;
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
  const auditResult = auditTagging(allEvidence.join(' '), 'capital-structure-fragility-pattern');

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
  // Pre-check universel : sans revenu ni burn, on n a pas la matière
  // financière pour mesurer l empilement des préférences ni la
  // compatibilité avec les exits possibles. Court-circuit avant LLM
  // call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Capital Structure Fragility non évaluable : aucun revenu ni burn chiffré dans le dossier. La doctrine nécessite la matière économique pour mesurer la fragilité cap table.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modèle économique lisible. Pattern Capital Structure Fragility non évaluable.',
      shouldRun: false,
    };
  }

  const stage = (extraction.fundraise?.stage ?? '').toLowerCase();
  const isLateStage = /\bseries\s+[b-z]\b|\bserie\s+[b-z]\b|\bgrowth\b|\blate.stage\b/i.test(stage);
  const isSeriesA = /\bseries\s+a\b|\bserie\s+a\b/i.test(stage);

  if (isLateStage) {
    return {
      level: 'full',
      rationale: 'Stade Series B ou ultérieur : la complexité cap table s accumule de manière combinatoire de tour en tour, analyse complète pertinente.',
      shouldRun: true,
    };
  }

  if (isSeriesA) {
    return {
      level: 'partial',
      rationale: 'Stade Series A : pattern actif si premières préférences créatives au seed, sinon en lecture préventive sur la term sheet courante.',
      shouldRun: true,
    };
  }

  // Stade précoce : lecture préventive sur term sheet en cours
  return {
    level: 'weak-signal',
    rationale: 'Stade précoce : peu de complexité typiquement, pattern actif en lecture préventive sur la term sheet en cours de négociation.',
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
    throw new Error('Capital Structure Fragility: failed to parse LLM JSON response');
  }

  if (!raw.applicabilite) raw.applicabilite = check.level;
  if (!raw.applicabiliteRationale) raw.applicabiliteRationale = check.rationale;

  const output = llmOutputToPatternOutput(raw);

  // Gating axe central : axe 1 (empilement des préférences de
  // liquidation) est l axe identitaire de Capital Structure Fragility.
  // Sans pacte d actionnaires ni cap table accessibles, la lecture
  // juridique pure n est pas possible.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Capital Structure Fragility non applicable : l axe identitaire (empilement des préférences de liquidation) est neutralisé par absence de documents légaux structurants accessibles.',
  );
}

// ============================================================
// EXPORT ET AUTO-REGISTRATION
// ============================================================

export const capitalStructureFragilityPattern: PatternModule = {
  patternId: PATTERN_ID,
  isApplicable,
  analyze,
};

registerPattern(capitalStructureFragilityPattern);

export const _internal = {
  buildUserPrompt,
  llmOutputToPatternOutput,
  isApplicable,
  extractCapTableSnapshot,
  SYSTEM_PROMPT,
  CAPTABLE_KEYWORDS,
  PREFERENCE_SIGNALS,
};
