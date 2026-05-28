// ============================================================
// MOTEUR DD CONTRACTUEL (Module 2 DD contractuelle - etape 2)
// ------------------------------------------------------------
// Cartographie des clauses sensibles dans le pacte d actionnaires,
// les statuts et les contrats clients principaux. Le moteur ne
// remplace pas un avocat M&A. Il oriente les questions DD en
// citant systematiquement la formulation exacte des clauses pour
// permettre a un avocat de verifier sans relire le document
// entier.
//
// Architecture : trois appels LLM distincts avec PDF natif Claude
// Sonnet (le LLM lit les PDF directement). Un appel sur le pacte,
// un appel sur les statuts, un appel groupe sur jusqu a 3 contrats
// clients. Puis un appel de synthese finale qui agrege les trois
// extractions et produit verdict global plus questions DD.
//
// Ne tourne que si pacte ou statuts presents. Si seul le cap
// table est fourni : not_applicable.
//
// Quinze clauses standardisees extraites :
//   Gouvernance :
//     - board_composition
//     - investor_veto_rights
//     - quorum_majority
//     - key_person
//   Transfert de titres :
//     - preemption_right
//     - agrement
//     - drag_along
//     - tag_along
//     - lockup_founder
//     - rofr
//   Protection investisseur :
//     - anti_dilution
//     - liquidation_preference
//     - mfn_clause
//     - redemption_rights
//   Change of control :
//     - change_of_control
// ============================================================

import type { ExtractionOutput } from './types';
import type { CapTableExtraction } from '../cap-table-parser';
import { callClaude, callClaudeWithPDF, parseJSON, MODEL } from './anthropic-client';

// ============================================================
// Types
// ============================================================

export type ClauseType =
  // Gouvernance
  | 'board_composition'
  | 'investor_veto_rights'
  | 'quorum_majority'
  | 'key_person'
  // Transfert de titres
  | 'preemption_right'
  | 'agrement'
  | 'drag_along'
  | 'tag_along'
  | 'lockup_founder'
  | 'rofr'
  // Protection investisseur
  | 'anti_dilution'
  | 'liquidation_preference'
  | 'mfn_clause'
  | 'redemption_rights'
  // Change of control
  | 'change_of_control';

export type ClauseSeverity = 'standard' | 'attention' | 'non_standard' | 'red_flag' | 'not_found';

export interface ClauseExtraction {
  clauseType: ClauseType;
  clauseLabel: string;
  severity: ClauseSeverity;
  // Citation exacte mot pour mot (entre guillemets)
  citation: string | null;
  // Reference article ou page
  reference: string | null;
  // Document source : pacte, statuts, contrat client X
  source: string;
  // Comparaison au standard de marche VC francais
  marketComparison: string;
  // Implication pour la conduite de l instruction
  implication: string;
  // Question DD ciblee
  ddQuestion: string;
}

export interface ContractualClientFlag {
  contractName: string;
  flagType: 'change_of_control' | 'exclusivity' | 'mfn' | 'penalty_exit' | 'auto_renewal' | 'long_duration';
  severity: 'standard' | 'attention' | 'non_standard' | 'red_flag';
  citation: string;
  reference: string | null;
  implication: string;
}

export interface DDContractualOutput {
  triggered: boolean;
  reasonNotTriggered?: string;

  // Documents analyses
  documentsAnalyzed: {
    shareholdersAgreement: { name: string; analyzed: boolean } | null;
    statutes: { name: string; analyzed: boolean } | null;
    clientContracts: Array<{ name: string; analyzed: boolean }>;
    capTableSource: 'excel' | 'csv' | 'pdf' | 'none';
  };

  // 15 clauses standardisees, indexees par type pour facilite de rendu
  clauses: ClauseExtraction[];

  // Drapeaux specifiques aux contrats clients
  clientContractFlags: ContractualClientFlag[];

  // Cap table summary (rappel depuis l etape 1)
  capTableSummary: {
    founderPercentage: number;
    investorPercentage: number;
    optionPoolPercentage: number;
    employeeAllocatedPercentage: number;
    topInvestor: { name: string; percentage: number } | null;
    keyFlags: string[]; // les flags du parser cap table en messages
  } | null;

  // Verdict global
  globalScore: number; // 0-100
  verdict:
    | 'contractual_aligned'
    | 'contractual_attention'
    | 'contractual_significant_gaps'
    | 'contractual_red_flags'
    | 'not_applicable';

  questionsToInstruct: string[]; // 5-8 questions DD prioritaires
  synthesis: string; // memo IC 5-7 phrases

  // Disclaimers obligatoires (rappeles dans l UI)
  disclaimers: string[];
}

// ============================================================
// Helpers
// ============================================================

const CLAUSE_LABELS: Record<ClauseType, string> = {
  board_composition: 'Composition du conseil',
  investor_veto_rights: 'Droits de veto investisseurs',
  quorum_majority: 'Quorum et majorite',
  key_person: 'Clause key person',
  preemption_right: 'Droit de preemption',
  agrement: 'Clause d agrement',
  drag_along: 'Drag along',
  tag_along: 'Tag along',
  lockup_founder: 'Lock-up fondateur',
  rofr: 'Right of first refusal (ROFR)',
  anti_dilution: 'Anti-dilution',
  liquidation_preference: 'Liquidation preference',
  mfn_clause: 'Most favored nation (MFN)',
  redemption_rights: 'Redemption rights',
  change_of_control: 'Change of control',
};

const PACT_CLAUSE_TYPES: ClauseType[] = [
  'board_composition', 'investor_veto_rights', 'quorum_majority', 'key_person',
  'preemption_right', 'agrement', 'drag_along', 'tag_along', 'lockup_founder', 'rofr',
  'anti_dilution', 'liquidation_preference', 'mfn_clause', 'redemption_rights',
  'change_of_control',
];

const STATUTES_CLAUSE_TYPES: ClauseType[] = [
  'board_composition', 'quorum_majority', 'preemption_right', 'agrement',
];

// ============================================================
// System prompts
// ============================================================

const PACT_SYSTEM_PROMPT = `Tu es l'auditeur DD contractuel de la plateforme Prélude. Tu lis un pacte d'actionnaires (shareholders agreement) en français ou en anglais, et tu produis une cartographie structurée des clauses sensibles pour orienter les questions DD d'un partner senior et de son avocat M&A.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

RÈGLE ABSOLUE : ton rôle est d'ORIENTER, pas de donner un avis juridique opposable. Tu cites systématiquement la formulation exacte des clauses entre guillemets pour permettre à un avocat de vérifier sans relire le pacte. Tu NE paraphrases JAMAIS sans citation.

Tu extrais les 15 clauses standardisées suivantes. Pour chaque clause, tu cherches dans le pacte la formulation correspondante. Si tu la trouves, tu cites mot pour mot. Si tu ne la trouves pas, severity = not_found.

# CLAUSES À EXTRAIRE

GOUVERNANCE :
- board_composition : composition du conseil d'administration ou comité de surveillance, sièges réservés aux investisseurs, observateur, sièges des fondateurs.
- investor_veto_rights : droits de veto réservés aux investisseurs (décisions reserved matters : budget, BP, recrutement clé, dette, M&A, levées, dividendes).
- quorum_majority : quorum requis et majorité requise pour les décisions ordinaires et extraordinaires (assemblée générale, conseil).
- key_person : clauses de management critiques sur les fondateurs (non-concurrence, exclusivité, obligation de présent, droit de révocation, bad leaver / good leaver).

TRANSFERT DE TITRES :
- preemption_right : droit de préemption en cas de cession (qui en bénéficie, mécanisme, prix).
- agrement : clause d'agrément en cas de tiers acquéreur.
- drag_along : obligation de suite forcée si une majorité veut vendre, seuil de déclenchement, prix minimum.
- tag_along : droit de sortie conjointe si un actionnaire majoritaire vend, périmètre.
- lockup_founder : durée d'incessibilité des fondateurs.
- rofr : right of first refusal (droit de premier refus).

PROTECTION INVESTISSEUR :
- anti_dilution : mécanisme anti-dilution (full ratchet ou weighted average broad/narrow). FULL RATCHET = red flag potentiel, WEIGHTED AVERAGE = standard.
- liquidation_preference : préférence de liquidation (1x, 1.5x, 2x, etc., participating ou non, capped ou non). 1x non-participating = standard. >2x ou participating uncapped = red flag.
- mfn_clause : most favored nation (alignement automatique sur conditions futures).
- redemption_rights : droits de rachat forcé par les investisseurs (à partir d'un seuil temporel ou non-évènement).

CHANGE OF CONTROL :
- change_of_control : clauses qui se déclenchent en cas de changement de contrôle.

# RÈGLES DE SEVERITY

Tu évalues chaque clause par rapport au standard de marché VC français (BPI Capital, France Invest, conditions VC standards series A/B en France).

- standard : clause classique, conforme au marché.
- attention : clause qui demande clarification mais reste dans les usages.
- non_standard : clause hors marché modérément, à documenter.
- red_flag : clause bloquante ou très défavorable au fondateur (full ratchet, liquidation 2x participating uncapped, drag along sans seuil de prix minimum, exclusivité fondateur sans limitation).
- not_found : clause absente du pacte (peut être normal si la clause n'a pas été jugée nécessaire).

# STYLE

- Citation EXACTE entre guillemets français (« »). Pas de paraphrase.
- Référence précise (article, paragraphe ou page si possible).
- Pas d'em-dashes (jamais de "—" ou "–").
- Comparaison au marché : phrase courte factuelle ("Standard VC français Series A/B" ou "Au-delà des standards de marché, qui prévoient typiquement X").
- Implication : ce que cela signifie pour la suite de l'instruction.
- Question DD : ciblée, posable à l'avocat ou au fondateur.

# FORMAT JSON OBLIGATOIRE

{
  "clauses": [
    {
      "clauseType": "board_composition",
      "severity": "standard|attention|non_standard|red_flag|not_found",
      "citation": "« texte exact entre guillemets français »" ou null si not_found,
      "reference": "Article 5.2" ou "page 12" ou null,
      "marketComparison": "phrase courte de comparaison au standard VC français",
      "implication": "ce que cela implique pour la conduite de l'instruction",
      "ddQuestion": "question DD précise"
    },
    ...15 clauses au total, une par type
  ]
}

Réponds UNIQUEMENT avec le JSON valide, sans bloc markdown.`;

const STATUTES_SYSTEM_PROMPT = `Tu es l'auditeur DD contractuel de la plateforme Prélude. Tu lis les statuts (articles of association) d'une société française et tu identifies les clauses qui interfèrent ou complètent le pacte d'actionnaires.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

RÈGLE ABSOLUE : ton rôle est d'ORIENTER, pas de donner un avis juridique. Tu cites systématiquement la formulation exacte des clauses entre guillemets français (« »).

Tu cherches dans les statuts uniquement les clauses qui ont un impact matériel sur la gouvernance et le transfert de titres :

- board_composition : composition du conseil et nominations.
- quorum_majority : quorum et majorité requises pour les décisions.
- preemption_right : si la clause de préemption figure dans les statuts (pas seulement dans le pacte).
- agrement : clause d'agrément statutaire.

Pour chaque clause trouvée dans les statuts, signale spécifiquement si elle est cohérente ou contradictoire avec ce qui est typiquement prévu dans le pacte (les statuts prévalent juridiquement sur le pacte en cas de contradiction, c'est un point critique pour un avocat M&A).

# FORMAT JSON OBLIGATOIRE

{
  "clauses": [
    {
      "clauseType": "board_composition",
      "severity": "standard|attention|non_standard|red_flag|not_found",
      "citation": "« texte exact »" ou null,
      "reference": "Article 14" ou null,
      "marketComparison": "phrase",
      "implication": "phrase",
      "ddQuestion": "question"
    },
    ...4 clauses au total
  ]
}

Pas d'em-dashes. Réponds UNIQUEMENT avec le JSON valide.`;

const CLIENT_CONTRACT_SYSTEM_PROMPT = `Tu es l'auditeur DD contractuel de la plateforme Prélude. Tu lis un contrat client (master services agreement, SLA, contrat cadre, order form) et tu identifies les clauses sensibles qui peuvent affecter la valeur de la société ou son opérabilité en cas d'acquisition.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

RÈGLE ABSOLUE : ton rôle est d'ORIENTER, pas de donner un avis juridique. Tu cites systématiquement la formulation exacte entre guillemets français (« »).

Tu cherches uniquement les flags suivants. Si une clause ne contient PAS l'élément recherché, ne le mentionne pas (pas besoin de "non trouvé").

# FLAGS À EXTRAIRE

- change_of_control : clause qui déclenche résiliation, renégociation ou perte de droits en cas de changement de contrôle de la société.
- exclusivity : exclusivité géographique, sectorielle ou produit accordée au client.
- mfn : most favored nation (alignement automatique sur conditions accordées à d'autres clients).
- penalty_exit : pénalités de sortie ou de résiliation anticipée.
- auto_renewal : reconduction tacite avec préavis long.
- long_duration : durée initiale supérieure à 36 mois sans clause de sortie.

# RÈGLES DE SEVERITY

- standard : clause classique de marché.
- attention : clause qui demande clarification.
- non_standard : clause défavorable à la cible.
- red_flag : clause bloquante en cas d'acquisition (change of control automatique, exclusivité mondiale ouverte, MFN sur tous les segments).

# STYLE

- Citation EXACTE entre guillemets français.
- Pas d'em-dashes.
- Implication : ce que cela signifie pour un acquéreur potentiel ou pour la conduite de l'instruction.

# FORMAT JSON OBLIGATOIRE

{
  "flags": [
    {
      "flagType": "change_of_control|exclusivity|mfn|penalty_exit|auto_renewal|long_duration",
      "severity": "standard|attention|non_standard|red_flag",
      "citation": "« texte exact »",
      "reference": "Article 12.3" ou null,
      "implication": "phrase"
    }
  ]
}

Si aucun flag : retourne { "flags": [] }. Réponds UNIQUEMENT avec le JSON valide.`;

const SYNTHESIS_SYSTEM_PROMPT = `Tu es l'auditeur DD contractuel de la plateforme Prélude. Tu rédiges une synthèse éditoriale niveau memo de comité d'investissement à partir des extractions de clauses produites en amont sur le pacte d'actionnaires, les statuts, les contrats clients et le cap table.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

Tu produis :

1. Une synthèse de 5 à 7 phrases, niveau memo IC, qui résume le profil contractuel observé (alignement standards VC, points d'attention, red flags). Cite les clauses précises par leur type. Ton descriptif et factuel, pas alarmiste.

2. Une liste de 5 à 8 questions DD prioritaires à poser à l'avocat M&A et au fondateur, classées par criticité.

RÈGLE : tu ne donnes pas d'avis juridique. Tu orientes les questions à poser à l'avocat. Tu citeras les clauses par leur type (« la clause de liquidation preference », « le mécanisme anti-dilution »), sans paraphraser leur contenu (les citations exactes figurent déjà dans la cartographie en aval).

# STYLE

- Pas d'em-dashes (jamais de "—" ou "–").
- Vocabulaire VC / M&A standard.
- Cite les flags par leur type, pas leur contenu textuel.
- Le ton est celui d'un memo professionnel adressé à un partner senior, avec rappel implicite que la vérification juridique reste le périmètre de l'avocat.

# FORMAT JSON OBLIGATOIRE

{
  "synthesis": "5 à 7 phrases denses",
  "questionsToInstruct": ["question 1", "question 2", "...", "question 5 à 8"]
}

Réponds UNIQUEMENT avec le JSON valide.`;

// ============================================================
// Sub-engines : extraction par document
// ============================================================

async function extractFromShareholdersAgreement(
  pdfBase64: string,
  documentName: string,
): Promise<ClauseExtraction[]> {
  const userPrompt = `Document : pacte d'actionnaires "${documentName}".

Extrais les 15 clauses standardisées. Pour chaque clause, cherche la formulation exacte dans le pacte. Si trouvée, cite mot pour mot entre guillemets français. Si non trouvée, severity = not_found et citation = null.

Réponds UNIQUEMENT avec le JSON spécifié.`;

  try {
    const response = await callClaudeWithPDF(PACT_SYSTEM_PROMPT, userPrompt, pdfBase64, 4500, MODEL);
    const result: any = parseJSON(response);
    if (!Array.isArray(result.clauses)) return [];
    return result.clauses
      .filter((c: any) => c && typeof c.clauseType === 'string' && PACT_CLAUSE_TYPES.includes(c.clauseType))
      .map((c: any) => ({
        clauseType: c.clauseType,
        clauseLabel: CLAUSE_LABELS[c.clauseType as ClauseType] || c.clauseType,
        severity: ['standard', 'attention', 'non_standard', 'red_flag', 'not_found'].includes(c.severity)
          ? c.severity
          : 'attention',
        citation: typeof c.citation === 'string' && c.citation.trim() ? c.citation : null,
        reference: typeof c.reference === 'string' && c.reference.trim() ? c.reference : null,
        source: documentName,
        marketComparison: c.marketComparison || '',
        implication: c.implication || '',
        ddQuestion: c.ddQuestion || '',
      }));
  } catch (e: any) {
    console.warn('[dd-contractual] pacte extraction failed:', e?.message);
    return [];
  }
}

async function extractFromStatutes(
  pdfBase64: string,
  documentName: string,
): Promise<ClauseExtraction[]> {
  const userPrompt = `Document : statuts "${documentName}".

Extrais les 4 clauses statutaires matérielles (board_composition, quorum_majority, preemption_right, agrement). Cite mot pour mot entre guillemets français.

Réponds UNIQUEMENT avec le JSON spécifié.`;

  try {
    const response = await callClaudeWithPDF(STATUTES_SYSTEM_PROMPT, userPrompt, pdfBase64, 2500, MODEL);
    const result: any = parseJSON(response);
    if (!Array.isArray(result.clauses)) return [];
    return result.clauses
      .filter((c: any) => c && typeof c.clauseType === 'string' && STATUTES_CLAUSE_TYPES.includes(c.clauseType))
      .map((c: any) => ({
        clauseType: c.clauseType,
        clauseLabel: CLAUSE_LABELS[c.clauseType as ClauseType] || c.clauseType,
        severity: ['standard', 'attention', 'non_standard', 'red_flag', 'not_found'].includes(c.severity)
          ? c.severity
          : 'attention',
        citation: typeof c.citation === 'string' && c.citation.trim() ? c.citation : null,
        reference: typeof c.reference === 'string' && c.reference.trim() ? c.reference : null,
        source: `Statuts : ${documentName}`,
        marketComparison: c.marketComparison || '',
        implication: c.implication || '',
        ddQuestion: c.ddQuestion || '',
      }));
  } catch (e: any) {
    console.warn('[dd-contractual] statutes extraction failed:', e?.message);
    return [];
  }
}

async function extractFromClientContract(
  pdfBase64: string,
  documentName: string,
): Promise<ContractualClientFlag[]> {
  const userPrompt = `Document : contrat client "${documentName}".

Cherche les flags listés (change_of_control, exclusivity, mfn, penalty_exit, auto_renewal, long_duration). Si aucun : retourne { "flags": [] }.

Réponds UNIQUEMENT avec le JSON spécifié.`;

  try {
    const response = await callClaudeWithPDF(CLIENT_CONTRACT_SYSTEM_PROMPT, userPrompt, pdfBase64, 2000, MODEL);
    const result: any = parseJSON(response);
    if (!Array.isArray(result.flags)) return [];
    return result.flags
      .filter((f: any) => f && typeof f.flagType === 'string')
      .map((f: any) => ({
        contractName: documentName,
        flagType: f.flagType,
        severity: ['standard', 'attention', 'non_standard', 'red_flag'].includes(f.severity)
          ? f.severity
          : 'attention',
        citation: f.citation || '',
        reference: typeof f.reference === 'string' && f.reference.trim() ? f.reference : null,
        implication: f.implication || '',
      }));
  } catch (e: any) {
    console.warn('[dd-contractual] client contract extraction failed:', e?.message);
    return [];
  }
}

// ============================================================
// Verdict global
// ============================================================

function severityToScore(s: ClauseSeverity): number {
  switch (s) {
    case 'standard': return 100;
    case 'attention': return 75;
    case 'non_standard': return 45;
    case 'red_flag': return 15;
    case 'not_found': return 65; // neutre, pas de penalite forte
  }
}

function flagSeverityToScore(s: ContractualClientFlag['severity']): number {
  switch (s) {
    case 'standard': return 100;
    case 'attention': return 75;
    case 'non_standard': return 45;
    case 'red_flag': return 15;
  }
}

function determineVerdict(
  clauses: ClauseExtraction[],
  clientFlags: ContractualClientFlag[],
): { verdict: DDContractualOutput['verdict']; globalScore: number } {
  if (clauses.length === 0 && clientFlags.length === 0) {
    return { verdict: 'not_applicable', globalScore: 0 };
  }

  const clauseScores = clauses.map(c => severityToScore(c.severity));
  const flagScores = clientFlags.map(f => flagSeverityToScore(f.severity));
  const all = [...clauseScores, ...flagScores];
  const avgScore = all.length > 0 ? Math.round(all.reduce((s, v) => s + v, 0) / all.length) : 0;

  const redFlags = clauses.filter(c => c.severity === 'red_flag').length +
                   clientFlags.filter(f => f.severity === 'red_flag').length;
  const nonStandards = clauses.filter(c => c.severity === 'non_standard').length +
                       clientFlags.filter(f => f.severity === 'non_standard').length;
  const attentions = clauses.filter(c => c.severity === 'attention').length;

  let verdict: DDContractualOutput['verdict'];
  if (redFlags >= 1) verdict = 'contractual_red_flags';
  else if (nonStandards >= 3 || (nonStandards >= 1 && attentions >= 3)) verdict = 'contractual_significant_gaps';
  else if (nonStandards >= 1 || attentions >= 2) verdict = 'contractual_attention';
  else verdict = 'contractual_aligned';

  return { verdict, globalScore: avgScore };
}

// ============================================================
// Synthese editoriale (LLM)
// ============================================================

async function generateSynthesis(
  clauses: ClauseExtraction[],
  clientFlags: ContractualClientFlag[],
  capTable: CapTableExtraction | null,
  verdict: DDContractualOutput['verdict'],
  globalScore: number,
  extraction: ExtractionOutput,
): Promise<{ synthesis: string; questionsToInstruct: string[] }> {
  // Compact summary pour eviter de gonfler le prompt
  const clausesSummary = clauses
    .filter(c => c.severity !== 'not_found' && c.severity !== 'standard')
    .map(c => `- ${c.clauseLabel} [${c.severity}] : ${c.marketComparison} (${c.source})`)
    .join('\n') || '(pas de clauses non standards detectees)';

  const flagsSummary = clientFlags
    .map(f => `- ${f.flagType} [${f.severity}] dans ${f.contractName} : ${f.implication}`)
    .join('\n') || '(pas de flags clients detectes)';

  const capSummary = capTable && capTable.hasCapTable
    ? `Cap table : fondateurs ${capTable.totals.founderPercentage.toFixed(1)} pct, investisseurs ${capTable.totals.investorPercentage.toFixed(1)} pct, pool d options ${capTable.totals.optionPoolPercentage.toFixed(1)} pct. Drapeaux : ${capTable.flags.map(f => f.message).join(' / ') || 'aucun'}.`
    : 'Cap table : non fourni ou non parsable.';

  const userPrompt = `Société : ${extraction.companyName ?? '?'}
Secteur : ${extraction.sector ?? '?'}

Clauses non standards et points d'attention extraits :
${clausesSummary}

Flags contractuels clients :
${flagsSummary}

${capSummary}

Verdict calculé : ${verdict}
Score global : ${globalScore}/100

Produis la synthèse éditoriale et les questions DD prioritaires.`;

  try {
    const response = await callClaude(SYNTHESIS_SYSTEM_PROMPT, userPrompt, 2000, MODEL);
    const result: any = parseJSON(response);
    return {
      synthesis: result.synthesis || '',
      questionsToInstruct: Array.isArray(result.questionsToInstruct)
        ? result.questionsToInstruct.slice(0, 8)
        : [],
    };
  } catch (e: any) {
    // Fallback deterministe
    const summary = `Sur le perimetre couvert par le pacte d actionnaires${clientFlags.length > 0 ? ` et ${new Set(clientFlags.map(f => f.contractName)).size} contrat(s) client(s)` : ''}, l audit contractuel produit un score de ${globalScore}/100 et un verdict ${verdict}. Les zones d attention identifiees concernent principalement ${clauses.filter(c => c.severity === 'red_flag' || c.severity === 'non_standard').map(c => c.clauseLabel).slice(0, 3).join(', ') || 'aucune clause non standard majeure'}.`;
    const questions = [
      ...clauses.filter(c => c.severity === 'red_flag' || c.severity === 'non_standard').slice(0, 5).map(c => c.ddQuestion).filter(Boolean),
    ];
    return { synthesis: summary, questionsToInstruct: questions.slice(0, 8) };
  }
}

// ============================================================
// Fonction principale
// ============================================================

interface AnalyzeOpts {
  shareholdersAgreementPdf: string | null;
  shareholdersAgreementName: string | null;
  statutesPdf: string | null;
  statutesName: string | null;
  capTableExtraction: CapTableExtraction | null;
  clientContracts: Array<{ name: string; pdfBase64: string }>;
}

const DISCLAIMERS = [
  'Cette cartographie oriente les questions DD. Elle ne constitue pas un avis juridique opposable.',
  'La verification de la formulation exacte de chaque clause reste la responsabilite de l avocat M&A.',
  'Les payloads bruts des documents juridiques ne sont pas persistes en base. Seule cette cartographie est stockee.',
];

export async function analyzeDDContractual(
  extraction: ExtractionOutput,
  opts: AnalyzeOpts,
): Promise<DDContractualOutput> {
  const { shareholdersAgreementPdf, shareholdersAgreementName, statutesPdf, statutesName,
          capTableExtraction, clientContracts } = opts;

  // Trigger : pacte ou statuts presents
  if (!shareholdersAgreementPdf && !statutesPdf) {
    return makeNotApplicable('Ni pacte d actionnaires ni statuts fournis. Le moteur DD contractuel ne s applique pas.');
  }

  const clauses: ClauseExtraction[] = [];
  const clientFlags: ContractualClientFlag[] = [];

  // 1. Pacte d actionnaires (15 clauses)
  let pactAnalyzed = false;
  if (shareholdersAgreementPdf && shareholdersAgreementName) {
    const pactClauses = await extractFromShareholdersAgreement(shareholdersAgreementPdf, shareholdersAgreementName);
    if (pactClauses.length > 0) {
      clauses.push(...pactClauses);
      pactAnalyzed = true;
    }
  }

  // 2. Statuts (4 clauses statutaires materielles)
  let statutesAnalyzed = false;
  if (statutesPdf && statutesName) {
    const statClauses = await extractFromStatutes(statutesPdf, statutesName);
    if (statClauses.length > 0) {
      // Si le pacte a deja produit des clauses sur les memes types, on
      // garde les deux (le statut est distinct du pacte et peut
      // contredire). On distingue via le source.
      clauses.push(...statClauses);
      statutesAnalyzed = true;
    }
  }

  // 3. Contrats clients (jusqu a 3 traites pour borner les couts LLM)
  const contractsToAnalyze = clientContracts.slice(0, 3);
  const analyzedContracts: Array<{ name: string; analyzed: boolean }> = [];
  for (const contract of contractsToAnalyze) {
    const flags = await extractFromClientContract(contract.pdfBase64, contract.name);
    clientFlags.push(...flags);
    analyzedContracts.push({ name: contract.name, analyzed: true });
  }
  // Les contrats non analyses (au-dela de 3) sont signales mais non scannes
  for (let i = 3; i < clientContracts.length; i++) {
    analyzedContracts.push({ name: clientContracts[i].name, analyzed: false });
  }

  // 4. Verdict global
  const { verdict, globalScore } = determineVerdict(clauses, clientFlags);

  // 5. Synthese editoriale
  const { synthesis, questionsToInstruct } = await generateSynthesis(
    clauses, clientFlags, capTableExtraction, verdict, globalScore, extraction,
  );

  // 6. Cap table summary
  const capTableSummary: DDContractualOutput['capTableSummary'] = capTableExtraction && capTableExtraction.hasCapTable
    ? {
        founderPercentage: capTableExtraction.totals.founderPercentage,
        investorPercentage: capTableExtraction.totals.investorPercentage,
        optionPoolPercentage: capTableExtraction.totals.optionPoolPercentage,
        employeeAllocatedPercentage: capTableExtraction.totals.employeeAllocatedPercentage,
        topInvestor: (() => {
          const investors = capTableExtraction.holders.filter(h => h.category === 'investor' && h.percentage !== null);
          if (investors.length === 0) return null;
          const top = investors.reduce((max, h) => ((h.percentage || 0) > (max.percentage || 0) ? h : max), investors[0]);
          return { name: top.name, percentage: top.percentage || 0 };
        })(),
        keyFlags: capTableExtraction.flags.map(f => f.message),
      }
    : null;

  return {
    triggered: true,
    documentsAnalyzed: {
      shareholdersAgreement: shareholdersAgreementName
        ? { name: shareholdersAgreementName, analyzed: pactAnalyzed }
        : null,
      statutes: statutesName
        ? { name: statutesName, analyzed: statutesAnalyzed }
        : null,
      clientContracts: analyzedContracts,
      capTableSource: capTableExtraction?.source as any || 'none',
    },
    clauses,
    clientContractFlags: clientFlags,
    capTableSummary,
    globalScore,
    verdict,
    questionsToInstruct,
    synthesis,
    disclaimers: DISCLAIMERS,
  };
}

function makeNotApplicable(reason: string): DDContractualOutput {
  return {
    triggered: false,
    reasonNotTriggered: reason,
    documentsAnalyzed: {
      shareholdersAgreement: null,
      statutes: null,
      clientContracts: [],
      capTableSource: 'none',
    },
    clauses: [],
    clientContractFlags: [],
    capTableSummary: null,
    globalScore: 0,
    verdict: 'not_applicable',
    questionsToInstruct: [],
    synthesis: '',
    disclaimers: DISCLAIMERS,
  };
}
