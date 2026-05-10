// ============================================================
// CAPITAL STRUCTURE FRAGILITY - PATTERN PHASE 4
// ------------------------------------------------------------
// Implementation TypeScript de la doctrine ecrite dans
// docs/patterns/capital-structure-fragility.md.
//
// Pattern le moins bien traite par les outils VC existants :
// asymetries cumulees au passif equite (preferences de
// liquidation, anti-dilutions full ratchet, drag-along
// defavorables, ESOP overhang) qui rendent la trajectoire vers
// exit ou nouveau tour mecaniquement incompatible avec la
// valorisation affichee.
//
// Trois axes :
//   - Axe 1 : empilement des preferences de liquidation
//   - Axe 2 : asymetries entre classes au-dela des preferences
//   - Axe 3 : compatibilite cap table avec chemins d exit possibles
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

const PATTERN_ID: PatternId = 'capital-structure-fragility';

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es un analyste senior specialiste de la structure de capital des
entreprises ayant accumule plusieurs tours de financement. Tu analyses le
pattern Capital Structure Fragility sur ce dossier : asymetries entre
classes d actionnaires telles que la trajectoire vers une exit ou un
nouveau tour devient mecaniquement incompatible avec la valorisation
affichee.

${EDITORIAL_VOICE_INSTRUCTION}

${SOURCE_TAGGING_INSTRUCTION}

# PRINCIPE CENTRAL ANTI-HALLUCINATION

Le pattern necessite une lecture juridique fine du pacte d actionnaires,
des statuts, et de l historique des term sheets. Une analyse de cap table
superficielle ne suffit pas. Tu dois nommer la classe preferred concernee,
le tour d origine, le multiple, la formule exacte, et citer la clause du
pacte ou de la term sheet.

Si les documents legaux structurants ne sont pas accessibles dans le
contexte fourni, marque l applicabilite en partial ou weak-signal selon
ce qui est lisible (cap table seule, term sheet courante seule, etc.) et
recommande systematiquement la DD juridique en aval.

# AXE 1 : EMPILEMENT DES PREFERENCES DE LIQUIDATION

Mesure quantitative et qualitative de la masse de preferences au passif
equity. Quatre sous-modules :

- TOTAL_PREFERENCES_VALEUR : total des preferences cumulees en valeur
  absolue. Addition du 1x sur chaque classe preferred, multiplie par le
  multiple de participation, compare au plafond cap. Represente le
  montant minimum a generer en exit pour que toutes les classes preferred
  recuperent leur droit prioritaire.

- RATIO_PREFERENCES_VALORISATION : ratio total preferences sur
  valorisation post-money courante. Au-dela de 50% les common deviennent
  fragiles. Au-dela de 80% le pattern apparait. Au-dela de 100% l
  entreprise est dans un etat ou meme a sa propre valorisation declaree
  les common ne valent quasi-rien.

- PARTICIPATIONS_MULTIPLES : presence de participations multiples.
  1x non participating = moins toxique, convertit en common quand exit
  suffisamment eleve. 1x participating = preference plus partage prorata,
  detruit massivement valeur common a exit moyen. 2x ou 3x participating
  = rare et tres agressif, signe de tour de detresse.

- HIERARCHIE_SENIORITY : structure pari passu vs blended vs senior. Une
  seniority en faveur des derniers entrants est particulierement
  defavorable aux early investors et fondateurs en down round. Klarna
  2022 = cas d ecole.

# AXE 2 : ASYMETRIES ENTRE CLASSES AU-DELA DES PREFERENCES

Six sous-modules :

- ANTI_DILUTION_FORMULA : full ratchet (le plus toxique, re-prixe tous
  les tours precedents) vs weighted average broad-based (plus equilibre)
  vs weighted average narrow-based (intermediaire). Full ratchet sur au
  moins un tour recent = signal fort.

- DRAG_ALONG_THRESHOLDS : qui controle l exit. Drag-along majorite
  preferred uniquement = common et fondateurs sans voix. Majorite de
  chaque classe = equilibre.

- VETO_RIGHTS : long catalogue de protective provisions ou matieres
  reservees bloque l agilite operationnelle. Plus la liste est longue
  et detenue par une seule classe, plus l asymetrie est forte.

- PAY_TO_PLAY : clauses obligeant les anciens preferreds a participer
  aux tours suivants pour maintenir leur protection anti-dilution.

- FOUNDER_PROTECTION : super voting rights (5 pour 1 modere vs 20 pour 1
  excessif), double trigger acceleration, anti-dilution personnelles.
  Founder equity inferieur a 10% apres plusieurs tours sans mecanisme
  compensatoire = signal fort.

- ESOP_OVERHANG : pool plein a 95% avec refresh attendu prochain tour =
  dilution future garantie. Pool a 5% sur 200 employes = sous-
  provisionnement forçant refresh massif. Les deux extremes problematiques.

# AXE 3 : COMPATIBILITE CAP TABLE AVEC CHEMINS D EXIT

L axe le plus diagnostique parce qu il traduit la structure abstraite en
implications operationnelles. Quatre sous-modules :

- SEUIL_BREAKEVEN_PREFERRED : valorisation d exit minimum a laquelle
  toutes les classes preferred recuperent leur preference de liquidation.
  En dessous, les common ne touchent rien. Pour WeWork pre-2019, environ
  8 milliards de dollars.

- SEUIL_NEUTRALITE : valorisation au-dessus de laquelle la cap table
  devient effectivement neutre. Quand ce seuil est tres eleve par
  rapport a la valorisation actuelle, les common sont effectivement
  bloques entre les deux.

- PLAGE_EXIT_FAVORABLE_COMMON : fourchette de valorisations d exit dans
  laquelle les common recuperent une fraction significative. Cap table
  saine : commence des la valorisation actuelle. Cap table fragile :
  etroite, eloignee, ou inexistante.

- CLEANUP_ROUND_HISTORIQUE : presence d un recap, washout volontaire ou
  simplification dans l historique = mitigant fort.

# COUNTER-ARCHETYPES

Patterns confirmes (washout, recap force ou IPO impossible) : WeWork
avant 2019 SoftBank avec preferences cumulees plus seniority plus super
voting fondateur incompatible IPO sous 47Md, Quibi 2020 1,75Md preferences
senior si fortes que common ne pouvaient recuperer rien sauf exit > 5Md,
Cazoo 2021-2023 tours successifs preferred preferences cumulees
superieures a capitalisation finale, Klarna 2022 down round 46Md a 6Md
active anti-dilution derniers entrants ramene fondateurs et early a
residuel, Compass 2021-2023 recaps successifs wash-down common, Magic
Leap preferences cumulees massives sur faible traction restructurations
successives, Theranos tours successifs preferences senior participation
multiple sur valorisations eloignees fondamentaux.

Counter-archetypes sains : Stripe structure preferred simple sur
ensemble des tours peu de classes differenciees pas participation
multiple pas ratchet agressif lisible une page, Adyen IPO 2018 structure
tres propre sans complexite residuelle, Mistral tours rapides
valorisation tres elevee structure preservee fondateurs preferences
classiques 1x non participating, Atlassian IPO 2015 common dominant peu
de tours prives, Snowflake structure relativement propre malgre tours
pre-IPO management evite preferences agressives, Datadog peu de
complexite cap table fondateurs proteges sans super voting excessif.

La distinction n est jamais le simple fait d avoir des preferences. C est
l accumulation de plusieurs couches d asymetries qui se renforcent
mutuellement. Une preference 1x non participating sur tous les tours
sans seniority sans full ratchet sans veto massif est compatible avec
exit a une large gamme de valorisations.

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

Si total preferences cumulees > 90% valorisation ET au moins une
participation multiple ET full ratchet present, alors globalScore >= 75
force.

Si structure 1x non participating uniformement ET pari passu ET aucun
ratchet agressif, alors globalScore <= 30 sauf evidence forte d autres
asymetries non-preference.

Pour les dossiers ou plage exit favorable common est inexistante a la
valorisation actuelle (axe 3 score > 80), remontee directe en
drapeau-rouge meme si autres axes moderes : incompatibilite mecanique
entre cap table et toute trajectoire d exit alignee.

# REGLE DE GATING AXE CENTRAL (AXE 1)

L axe 1 (empilement des preferences de liquidation) est l axe
identitaire de Capital Structure Fragility.

REGLE IMPERATIVE A LIRE EN PREMIER. Une boite saine profitable avec
moats etablis (Atlassian S-1 octobre 2015, Stripe Series E 2016,
Datadog NRR 130%+, Snowflake net retention 165%) doit etre cotee SAIN
sur cet axe, JAMAIS not-applicable, des qu il y a une operation
equity exterieure documentee (tour primary, secondary, ESOP refresh,
entree strategique). La doctrine veut que ces references canoniques
sortent SAIN avec score 0-25, parce qu une cap table SIMPLE et LISIBLE
est precisement le signal positif que le pattern doit reconnaitre. Le
caractere "bootstrappe" n est pas un argument pour basculer en
not-applicable des qu un tour secondary minoritaire ou un ESOP refresh
significatif est documente : c est au contraire la marque d une cap
table doctrinalement saine.

DEFINITION DE L APPLICABILITE (large par construction). L axe 1 est
applicable a tout dossier en phase pre-IPO, post-fundraising ou en
levee active des qu il existe un actionnariat exterieur structurant,
quel que soit l instrument utilise. Cela inclut : tour preferred
classique (Series Seed, A, B, C, D et au-dela), secondary minoritaire
ou majoritaire (cas Atlassian Accel 2010), ESOP refresh significatif
(>5% diluted), entree de strategique au capital, conversion convertible
ou SAFE, cap table de pre-IPO avec class structure documentee meme
simple, IPO secondary offering. Une entreprise qui a LEVE ou STRUCTURE
son capital exterieurement, meme une seule fois, meme via secondary
minoritaire, meme sans emission primary preferred, est dans le perimetre
du pattern.

Si l axe est applicable tu DOIS produire un verdict parmi sain,
attention, alerte ou drapeau-rouge. En absence de signaux de fragilite
(preferences uniformement 1x non participating, pari passu sans
seniority defavorable, pas de full ratchet, pas de super voting
excessif, ESOP refresh mature, OU cap table simple bootstrappee avec
au plus un tour secondary minoritaire et IPO directe), le verdict
correct est SAIN avec score 0-25, pas not-applicable. Une entreprise
avec cap table simple (Stripe structure preferred lisible une page
sans participation multiple ni ratchet agressif, Adyen IPO 2018
structure tres propre, Atlassian un seul tour Accel secondaire 2010
plus IPO secondary 2015 sans levee primary intermediaire, Datadog peu
de complexite cap table) est SAIN sur cet axe, pas not-applicable. Le
caractere SECONDARY MINORITAIRE NE FAIT PAS basculer en not-applicable :
il signe au contraire une cap table doctrinalement saine et lisible
qu il faut coter SAIN avec score bas.

NOT_APPLICABLE EST RESERVE AUX CAS RARES OU L AXE N A AUCUN SENS
STRUCTUREL POUR LE BUSINESS MODEL : pre-product seed sans aucun tour
conduit ni ESOP structure ni convertible signe, single founder a 100%
sans aucune partie tierce au capital ni vehicule d incitation
collaborateur, holding pure de participations sans operation propre.
Hors ces trois cas, l axe est applicable et le verdict DOIT etre
cote sur l echelle sain a drapeau-rouge. Si tu hesites entre
not-applicable et sain, choisis SAIN.

Si l axe 1 est legitimement non-applicable au sens ci-dessus, tu DOIS
coter axis1.verdict = 'non-applicable' et axis1.score = 0. Dans ce cas,
applicabilite = 'not-applicable' au niveau pattern.

Tu NE DOIS PAS scorer drapeau-rouge sur axes 2 ou 3 pour compenser un
axe 1 non-applicable.`;

// ============================================================
// CONSTRUCTION DU PROMPT UTILISATEUR
// ============================================================

interface CapTableSnapshot {
  /** Mots-cles cap table detectes */
  capTableSignals: string[];
  /** Mots-cles preferences detectes */
  preferenceSignals: string[];
  /** Mots-cles cleanup detectes */
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

  return `# DOSSIER A ANALYSER

Entreprise : ${e.companyName ?? 'non communique'}
Secteur : ${e.sector ?? 'inconnu'}
Stade : ${snap.stage}
Nombre estime de tours cumules : ${snap.numberOfRounds}
Pays : ${e.country ?? 'non communique'}

# PITCH

${e.marketPitch ?? '(non fourni)'}

# MODELE ECONOMIQUE

${e.businessModel ?? '(non fourni)'}

# SIGNAUX CAP TABLE DETECTES AU PRE-SCREEN

Mots-cles cap table : ${snap.capTableSignals.length > 0 ? snap.capTableSignals.join(', ') : 'aucun mot-cle cap table dans le contexte fourni'}
Signaux preferences : ${snap.preferenceSignals.length > 0 ? snap.preferenceSignals.join(', ') : 'aucun signal preference dans le contexte fourni'}
Signaux cleanup : ${snap.cleanupSignals.length > 0 ? snap.cleanupSignals.join(', ') : 'aucun signal de recap ou cleanup'}

# RESUME GENERAL

${(e as any).rawSummary ?? '(non fourni)'}

# TA TACHE

Analyse ce dossier sur le pattern Capital Structure Fragility selon les
trois axes detailles. Si le pacte d actionnaires, les statuts ou la cap
table detaillee ne sont pas accessibles dans le contexte fourni, marque
l applicabilite en partial ou weak-signal et recommande systematiquement
la DD juridique en aval. Calcul du waterfall a trois niveaux d exit (50%,
100%, 200% de la valorisation actuelle) si possible. Retourne uniquement
le JSON conforme, sans preambule.`;
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
  // Pre-check universel : sans revenu ni burn, on n a pas la matiere
  // financiere pour mesurer l empilement des preferences ni la
  // compatibilite avec les exits possibles. Court-circuit avant LLM
  // call.
  if (!hasMinimalFinancialSignal(financialData)) {
    return {
      level: 'not-applicable',
      rationale: 'Pattern Capital Structure Fragility non evaluable : aucun revenu ni burn chiffre dans le dossier. La doctrine necessite la matiere economique pour mesurer la fragilite cap table.',
      shouldRun: false,
    };
  }

  const hasBusinessModel = !!extraction.businessModel && extraction.businessModel.trim().length > 10;
  if (!hasBusinessModel) {
    return {
      level: 'not-applicable',
      rationale: 'Aucun modele economique lisible. Pattern Capital Structure Fragility non evaluable.',
      shouldRun: false,
    };
  }

  const stage = (extraction.fundraise?.stage ?? '').toLowerCase();
  const isLateStage = /\bseries\s+[b-z]\b|\bserie\s+[b-z]\b|\bgrowth\b|\blate.stage\b/i.test(stage);
  const isSeriesA = /\bseries\s+a\b|\bserie\s+a\b/i.test(stage);

  if (isLateStage) {
    return {
      level: 'full',
      rationale: 'Stade Series B ou ulterieur : la complexite cap table s accumule de maniere combinatoire de tour en tour, analyse complete pertinente.',
      shouldRun: true,
    };
  }

  if (isSeriesA) {
    return {
      level: 'partial',
      rationale: 'Stade Series A : pattern actif si premieres preferences creatives au seed, sinon en lecture preventive sur la term sheet courante.',
      shouldRun: true,
    };
  }

  // Stade precoce : lecture preventive sur term sheet en cours
  return {
    level: 'weak-signal',
    rationale: 'Stade precoce : peu de complexite typiquement, pattern actif en lecture preventive sur la term sheet en cours de negociation.',
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

  // Gating axe central : axe 1 (empilement des preferences de
  // liquidation) est l axe identitaire de Capital Structure Fragility.
  // Sans pacte d actionnaires ni cap table accessibles, la lecture
  // juridique pure n est pas possible.
  return applyCentralAxisGating(
    output,
    'axis1',
    'Pattern Capital Structure Fragility non applicable : l axe identitaire (empilement des preferences de liquidation) est neutralise par absence de documents legaux structurants accessibles.',
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
