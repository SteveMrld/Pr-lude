// ============================================================
// MOTEUR DD TECHNIQUE (Module 3 - approche dossier fourni)
// ------------------------------------------------------------
// Cartographie de la dimension technique d un dossier d
// investissement a partir des documents que la startup transmet
// au fonds. Le moteur ne fait pas d audit code lui-meme. Il lit
// ce que la startup declare, le confronte aux items des
// sections 4 (Technology/Product), 6 (Intellectual Property),
// 7 (Information Technology) et 8 (Data Protection) de la GCV
// Investor Due Diligence Checklist, et oriente les questions DD
// pour le partner et l expert technique externe.
//
// Architecture : un seul appel LLM multi-documents avec PDF
// natif Claude Sonnet (le LLM lit les PDF directement, vision
// incluse pour les schemas d architecture). Le moteur recoit
// un ou plusieurs PDFs : tech & IP overview, security policy,
// BCP, RGPD register, contrats SaaS critiques. Si plusieurs
// documents, ils sont passes ensemble pour permettre les
// cross-references.
//
// Dix tests structures, alignes sur GCV 4/6/7/8 :
//
//   T1  architecture_system        (cf. GCV 7.1)
//   T2  software_breakdown         (cf. GCV 7.2 et 7.3)
//   T3  code_ownership             (cf. GCV 6.7 et 7.11)
//   T4  intellectual_property      (cf. GCV 6.1 a 6.5)
//   T5  open_source_dependencies   (cf. GCV 7.10 et 7.12)
//   T6  it_security                (cf. GCV 7.7)
//   T7  disaster_recovery          (cf. GCV 7.9)
//   T8  incidents_history          (cf. GCV 7.8)
//   T9  data_protection            (cf. GCV 8.8 a 8.11)
//   T10 third_party_risk           (cf. GCV 7.4 et 7.5)
//
// REGLE ABSOLUE : citation mot pour mot du document. Si un
// element n est pas dans les documents fournis, severity =
// non_documented (zone d ombre, pas red flag). Le moteur ne
// remplace pas un audit technique externe : il oriente les
// questions a poser et identifie ce qui manque.
// ============================================================

import type { ExtractionOutput } from './types';
import { getClient, MODEL, parseJSON } from './anthropic-client';

// ============================================================
// Types
// ============================================================

export type DDTechnicalTestType =
  | 'architecture_system'
  | 'software_breakdown'
  | 'code_ownership'
  | 'intellectual_property'
  | 'open_source_dependencies'
  | 'it_security'
  | 'disaster_recovery'
  | 'incidents_history'
  | 'data_protection'
  | 'third_party_risk';

export type DDTechnicalSeverity =
  | 'aligned'
  | 'attention'
  | 'alert'
  | 'red_flag'
  | 'non_documented';

export interface DDTechnicalTest {
  testId: string; // T1 a T10
  testType: DDTechnicalTestType;
  testLabel: string;
  severity: DDTechnicalSeverity;
  // Citation exacte mot pour mot du document fourni. Null si non_documented.
  citation: string | null;
  // Reference : nom du document source plus section ou page. Null si non_documented.
  source: string | null;
  // Ce que le moteur observe a partir de la citation
  observation: string;
  // Standard attendu pour le stade
  benchmark: string;
  // Implication concrete pour la conduite de l instruction
  implication: string;
  // Question DD ciblee a poser au CTO ou a l expert technique externe
  ddQuestion: string;
}

export interface DDTechnicalOutput {
  triggered: boolean;
  reasonNotTriggered?: string;

  // Documents analyses
  documentsAnalyzed: Array<{ name: string; analyzed: boolean }>;

  // 10 tests structures dans l ordre T1 a T10
  tests: DDTechnicalTest[];

  // Verdict global et metriques
  globalScore: number; // 0-100
  // Pourcentage de tests non_documented (= taux de zones d ombre)
  underDocumentationRate: number;
  verdict:
    | 'tech_strong'
    | 'tech_solid'
    | 'tech_partial'
    | 'tech_concerns'
    | 'tech_red_flags'
    | 'tech_under_documented'
    | 'not_applicable';

  questionsToInstruct: string[]; // 5-8 questions DD prioritaires
  synthesis: string; // memo IC 5-7 phrases

  // Disclaimers obligatoires (rappeles dans l UI)
  disclaimers: string[];
}

// ============================================================
// Catalogue des tests
// ============================================================

const TEST_LABELS: Record<DDTechnicalTestType, string> = {
  architecture_system: 'Architecture systeme et stack technique',
  software_breakdown: 'Software off-the-shelf versus developpement interne',
  code_ownership: 'Propriete du code (ownership et IP vesting)',
  intellectual_property: 'Propriete intellectuelle (marques, brevets, noms de domaine)',
  open_source_dependencies: 'Dependances open source et licences',
  it_security: 'Securite IT (acces, secrets, MFA, politiques)',
  disaster_recovery: 'Disaster recovery et continuite d activite',
  incidents_history: 'Incidents materiels et defaillances passees',
  data_protection: 'Protection des donnees personnelles (RGPD)',
  third_party_risk: 'Risque tiers (SaaS critiques, licences accordees)',
};

const TEST_BENCHMARKS: Record<DDTechnicalTestType, string> = {
  architecture_system:
    'Schema d architecture systeme documente, stack technique declaree avec choix justifies, separation back/front/data, scalabilite anticipee.',
  software_breakdown:
    'Distinction claire entre software off-the-shelf sous licence et developpement interne, avec liste des dependances SaaS critiques.',
  code_ownership:
    'Confirmation que tout le code de production a ete developpe par des employes ou contractors sous contrat avec clause de cession d IP. Aucune zone grise sur la propriete.',
  intellectual_property:
    'Marques, brevets, noms de domaine enregistres. Ownership claire. Pas de litige IP en cours.',
  open_source_dependencies:
    'Liste des dependances open source utilisees, distinction entre code fondamental et periphique, licences declarees et compatibles avec un usage commercial proprietaire.',
  it_security:
    'Politiques de securite IT formalisees : gestion des acces (MFA, SSO, role-based), gestion des secrets (rotation, vault), politique mots de passe, restrictions reseau.',
  disaster_recovery:
    'Plan de continuite d activite documente, RTO et RPO definis, sauvegardes automatisees et testees, procedure de bascule.',
  incidents_history:
    'Aucun incident materiel non resolu. Incidents passes documentes avec analyse cause racine et mesures correctives.',
  data_protection:
    'Status data controller declare, registre RGPD tenu, DPO designe si requis, politiques d information aux personnes concernees, procedure breach notification, contrats DPA avec sous-traitants.',
  third_party_risk:
    'Liste des SaaS et services tiers critiques avec contrats de support, alternatives identifiees pour les vendor lock-in critiques. Licences accordees a des tiers documentees.',
};

const TEST_ORDER: DDTechnicalTestType[] = [
  'architecture_system',
  'software_breakdown',
  'code_ownership',
  'intellectual_property',
  'open_source_dependencies',
  'it_security',
  'disaster_recovery',
  'incidents_history',
  'data_protection',
  'third_party_risk',
];

// ============================================================
// System prompt
// ============================================================

const SYSTEM_PROMPT = `Tu es l'auditeur DD technique de la plateforme Prélude. Tu lis les documents techniques transmis par une startup au fonds VC dans le cadre d'un dossier d'instruction (architecture overview, security policy, BCP, RGPD register, contrats SaaS critiques, fiche IP), et tu produis une cartographie structurée pour orienter les questions DD du partner et de son expert technique externe.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

RÈGLE ABSOLUE : ton rôle est d'ORIENTER, pas de remplacer un audit technique externe ni un avocat IP. Tu cites systématiquement la formulation exacte du document entre guillemets pour permettre à l'expert de vérifier sans relire. Tu NE paraphrases JAMAIS sans citation. Si une dimension n'est pas couverte par les documents fournis, severity = non_documented avec citation = null.

Tu extrais les 10 tests structurés suivants, alignés sur les sections 4 (Technology/Product), 6 (Intellectual Property), 7 (Information Technology) et 8 (Data Protection) de la GCV Investor DD Checklist.

# TESTS À EXTRAIRE

T1 architecture_system (cf. GCV 7.1) : schéma d'architecture système, stack technique déclarée, séparation des couches, choix d'hébergement, scalabilité.

T2 software_breakdown (cf. GCV 7.2 et 7.3) : distinction entre software off-the-shelf sous licence et développement bespoke. Cite les SaaS et briques sous licence mentionnés, et les modules développés en interne.

T3 code_ownership (cf. GCV 6.7 et 7.11) : confirmation que tout le code a été développé par des employés sous contrat avec clause de cession d'IP. Cherche les mentions de NDA, contrats employés, IP assignment, contractors externes, code prestataire.

T4 intellectual_property (cf. GCV 6.1 à 6.5) : marques déposées, brevets en cours ou octroyés, noms de domaine, IP non enregistrée (know-how, secrets de fabrique). Ownership à la société.

T5 open_source_dependencies (cf. GCV 7.10 et 7.12) : dépendances open source utilisées, distinction entre code fondamental et code périphérique, licences déclarées (MIT, Apache, BSD versus GPL ou AGPL). Compatibilité avec un usage commercial propriétaire.

T6 it_security (cf. GCV 7.7) : politiques de sécurité IT (gestion des accès, MFA, SSO, role-based access control, gestion des secrets, rotation, vault, mots de passe, restrictions réseau, certifications type SOC2 ISO 27001).

T7 disaster_recovery (cf. GCV 7.9) : plan de continuité d'activité, RTO et RPO définis, sauvegardes automatisées et testées, procédure de bascule, redondance géographique.

T8 incidents_history (cf. GCV 7.8) : incidents matériels passés, défaillances ayant causé une interruption business, analyse cause racine et mesures correctives. Inclut les data breaches éventuelles.

T9 data_protection (cf. GCV 8.8 à 8.11) : conformité RGPD, status data controller, registre des traitements, DPO, information des personnes concernées, breach notifications à la CNIL, contrats DPA avec les sous-traitants.

T10 third_party_risk (cf. GCV 7.4 et 7.5) : liste des SaaS et services tiers critiques avec contrats de support et maintenance, vendor lock-in identifiés, alternatives. Licences accordées par la société à des tiers (white label, API publique sous licence).

# SEVERITY

Cinq niveaux pour chaque test :
- aligned : la dimension est documentée et conforme aux standards attendus à ce stade
- attention : documentée mais succincte ou avec zones d'ombre mineures
- alert : documentée avec déficit notable, ou pratique non standard requérant clarification
- red_flag : documentée avec pratique problématique (perte de PI, breach non notifié, vendor lock-in critique non géré, code prestataire sans cession)
- non_documented : la dimension n'est pas adressée par les documents fournis. Important : non_documented n'est PAS un red flag. C'est une zone d'ombre, qui devient une question DD prioritaire pour expert externe.

# FORMAT DE SORTIE

Tu produis UNIQUEMENT un objet JSON valide, sans texte avant ni après, sans fences markdown. Structure :

{
  "tests": [
    {
      "testType": "architecture_system",
      "severity": "aligned" | "attention" | "alert" | "red_flag" | "non_documented",
      "citation": "phrase exacte mot pour mot entre guillemets" | null,
      "source": "nom du doc + page ou section" | null,
      "observation": "ce que tu observes à partir de la citation, en 1-2 phrases",
      "implication": "implication pour l'instruction VC, en 1 phrase",
      "ddQuestion": "question précise à poser au CTO ou expert externe"
    },
    ... 10 tests dans l'ordre T1 à T10
  ],
  "synthesis": "memo IC en 5-7 phrases. Pas de tirets longs. Pas de em-dashes. Voix Le Grand Continent / The Atlantic.",
  "questionsToInstruct": ["question 1", "question 2", ... 5-8 questions prioritaires]
}

CONTRAINTES SUR LA SYNTHÈSE :
- 5 à 7 phrases en français
- Pas de em-dashes ni tirets longs
- Voix éditoriale neutre, ni promotionnelle ni alarmiste
- Mentionne explicitement les zones d'ombre majeures (tests non_documented)
- Termine par une recommandation opérationnelle pour le partner

CONTRAINTES SUR LES CITATIONS :
- Citation exacte mot pour mot, jamais paraphrasée
- Si plusieurs phrases pertinentes pour un même test, choisis la plus structurante et cite-la intégralement
- Si rien dans les documents : citation = null, source = null, severity = non_documented
- Garde les citations dans la langue du document (français ou anglais)`;

// ============================================================
// Helper appel LLM avec plusieurs PDF en input
// ============================================================

async function callClaudeMultiDocs(
  systemPrompt: string,
  userPrompt: string,
  pdfs: Array<{ name: string; pdfBase64: string }>,
  maxTokens: number = 4500,
): Promise<string> {
  const client = getClient();
  const content: any[] = [];
  for (const pdf of pdfs) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf.pdfBase64 },
      title: pdf.name,
    });
  }
  content.push({ type: 'text', text: userPrompt });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  });
  const textBlock = response.content.find((c) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Reponse Claude vide ou invalide pour DD technique');
  }
  return textBlock.text;
}

// ============================================================
// Scoring et verdict
// ============================================================

function severityScore(s: DDTechnicalSeverity): number {
  switch (s) {
    case 'aligned':
      return 10;
    case 'attention':
      return 7;
    case 'alert':
      return 4;
    case 'red_flag':
      return 0;
    case 'non_documented':
      return 5; // neutre : zone d ombre, pas red flag
  }
}

function computeGlobalScore(tests: DDTechnicalTest[]): number {
  if (tests.length === 0) return 0;
  const sum = tests.reduce((s, t) => s + severityScore(t.severity), 0);
  return Math.round((sum / (tests.length * 10)) * 100);
}

function computeUnderDocumentationRate(tests: DDTechnicalTest[]): number {
  if (tests.length === 0) return 0;
  const undocCount = tests.filter((t) => t.severity === 'non_documented').length;
  return Math.round((undocCount / tests.length) * 100);
}

function computeVerdict(
  score: number,
  underDocRate: number,
  tests: DDTechnicalTest[],
): DDTechnicalOutput['verdict'] {
  // Si plus de la moitie des tests sont non_documented, le dossier
  // technique fourni est trop leger pour conclure quoi que ce soit
  if (underDocRate >= 50) return 'tech_under_documented';

  // Red flags structurels : ownership du code, RGPD breach, securite
  // critique. Si ces tests sont en red_flag, on remonte directement
  // au verdict tech_red_flags peu importe le score.
  const criticalReds = tests.filter(
    (t) =>
      t.severity === 'red_flag' &&
      (t.testType === 'code_ownership' ||
        t.testType === 'data_protection' ||
        t.testType === 'it_security' ||
        t.testType === 'intellectual_property'),
  );
  if (criticalReds.length > 0) return 'tech_red_flags';

  if (score >= 80) return 'tech_strong';
  if (score >= 65) return 'tech_solid';
  if (score >= 50) return 'tech_partial';
  if (score >= 30) return 'tech_concerns';
  return 'tech_red_flags';
}

// ============================================================
// Validation de la sortie LLM et fallback
// ============================================================

function buildEmptyTest(testType: DDTechnicalTestType, index: number): DDTechnicalTest {
  return {
    testId: `T${index + 1}`,
    testType,
    testLabel: TEST_LABELS[testType],
    severity: 'non_documented',
    citation: null,
    source: null,
    observation: 'Cette dimension n est pas adressee par les documents fournis.',
    benchmark: TEST_BENCHMARKS[testType],
    implication:
      'A documenter aupres du CTO ou par audit technique externe avant decision d investissement.',
    ddQuestion: 'Pouvez-vous nous transmettre la documentation correspondant a cette dimension ?',
  };
}

function normalizeTests(rawTests: any[]): DDTechnicalTest[] {
  // On veut exactement 10 tests dans l ordre TEST_ORDER. Si le LLM
  // a oublie un test ou rendu un type inconnu, on comble avec un
  // test vide non_documented.
  const byType = new Map<DDTechnicalTestType, any>();
  if (Array.isArray(rawTests)) {
    for (const t of rawTests) {
      const tt = t?.testType;
      if (typeof tt === 'string' && TEST_ORDER.includes(tt as DDTechnicalTestType)) {
        byType.set(tt as DDTechnicalTestType, t);
      }
    }
  }

  return TEST_ORDER.map((type, i) => {
    const raw = byType.get(type);
    if (!raw) return buildEmptyTest(type, i);
    const sev = (['aligned', 'attention', 'alert', 'red_flag', 'non_documented'] as const).includes(
      raw.severity,
    )
      ? (raw.severity as DDTechnicalSeverity)
      : 'non_documented';
    return {
      testId: `T${i + 1}`,
      testType: type,
      testLabel: TEST_LABELS[type],
      severity: sev,
      citation: typeof raw.citation === 'string' && raw.citation.trim().length > 0 ? raw.citation : null,
      source: typeof raw.source === 'string' && raw.source.trim().length > 0 ? raw.source : null,
      observation:
        typeof raw.observation === 'string' && raw.observation.trim().length > 0
          ? raw.observation
          : 'Observation non fournie par le moteur.',
      benchmark: TEST_BENCHMARKS[type],
      implication:
        typeof raw.implication === 'string' && raw.implication.trim().length > 0
          ? raw.implication
          : 'A clarifier en DD technique externe.',
      ddQuestion:
        typeof raw.ddQuestion === 'string' && raw.ddQuestion.trim().length > 0
          ? raw.ddQuestion
          : `Pouvez-vous documenter ${TEST_LABELS[type].toLowerCase()} ?`,
    };
  });
}

// ============================================================
// Point d entree principal
// ============================================================

export async function analyzeDDTechnical(
  extraction: ExtractionOutput | null,
  opts: {
    techDocs: Array<{ name: string; pdfBase64: string }>;
  },
): Promise<DDTechnicalOutput> {
  const disclaimers = [
    "Le moteur DD technique n est pas un audit code et ne remplace pas un expert technique externe. Il oriente les questions a poser et identifie les zones non documentees.",
    "Les severities non_documented signalent une zone d ombre, pas un red flag : la dimension n est simplement pas couverte par les documents fournis.",
    "Toutes les citations sont reproduites mot pour mot du document source pour permettre verification ulterieure.",
  ];

  // Cas not_applicable : aucun document technique fourni
  if (!opts.techDocs || opts.techDocs.length === 0) {
    return {
      triggered: false,
      reasonNotTriggered:
        "Aucun document technique fourni. Pour declencher l audit DD technique, le partner doit deposer dans la data room le ou les documents transmis par la startup (architecture overview, security policy, BCP, RGPD register, etc.).",
      documentsAnalyzed: [],
      tests: [],
      globalScore: 0,
      underDocumentationRate: 0,
      verdict: 'not_applicable',
      questionsToInstruct: [],
      synthesis: '',
      disclaimers,
    };
  }

  // Limite de securite : maximum 5 documents en un seul appel pour
  // ne pas saturer le contexte LLM. Les 5 premiers sont retenus.
  const docs = opts.techDocs.slice(0, 5);

  const userPrompt = `Voici le ou les documents techniques transmis par la startup. Document(s) fourni(s) : ${docs
    .map((d) => `"${d.name}"`)
    .join(', ')}.

${
  extraction
    ? `Contexte du dossier (extrait du pitch deck) : société ${
        extraction.companyName || 'n.a.'
      }, secteur ${extraction.sector || 'n.a.'}, stade ${
        extraction.fundraise?.stage || 'n.a.'
      }.`
    : ''
}

Produis le JSON structuré avec les 10 tests T1 à T10, la synthèse et les questions DD prioritaires. Cite mot pour mot. Si une dimension n'est pas adressée par les documents : severity = non_documented, citation = null, source = null. Aucun em-dash dans la synthèse ni dans les implications.`;

  let raw: string;
  try {
    raw = await callClaudeMultiDocs(SYSTEM_PROMPT, userPrompt, docs, 5500);
  } catch (err: any) {
    console.warn('[dd-technical] LLM call failed:', err?.message);
    return {
      triggered: false,
      reasonNotTriggered: `Erreur lors de l appel LLM pour l audit DD technique : ${
        err?.message || 'unknown'
      }`,
      documentsAnalyzed: docs.map((d) => ({ name: d.name, analyzed: false })),
      tests: [],
      globalScore: 0,
      underDocumentationRate: 0,
      verdict: 'not_applicable',
      questionsToInstruct: [],
      synthesis: '',
      disclaimers,
    };
  }

  let parsed: any;
  try {
    parsed = parseJSON(raw);
  } catch (err: any) {
    console.warn('[dd-technical] JSON parse failed:', err?.message);
    parsed = {};
  }

  const tests = normalizeTests(Array.isArray(parsed?.tests) ? parsed.tests : []);
  const globalScore = computeGlobalScore(tests);
  const underDocumentationRate = computeUnderDocumentationRate(tests);
  const verdict = computeVerdict(globalScore, underDocumentationRate, tests);

  const synthesis =
    typeof parsed?.synthesis === 'string' && parsed.synthesis.trim().length > 0
      ? parsed.synthesis.trim()
      : "Synthese non produite par le moteur. Se referer aux dix tests individuels.";

  const questionsToInstruct = Array.isArray(parsed?.questionsToInstruct)
    ? parsed.questionsToInstruct
        .filter((q: any) => typeof q === 'string' && q.trim().length > 0)
        .slice(0, 8)
    : [];

  // Si trop peu de questions explicites, on enrichit avec les
  // questions des tests non_documented et red_flag pour atteindre
  // au moins 5 items, dans l ordre de priorite.
  if (questionsToInstruct.length < 5) {
    const ordered: DDTechnicalSeverity[] = ['red_flag', 'alert', 'non_documented', 'attention', 'aligned'];
    for (const sev of ordered) {
      for (const t of tests) {
        if (t.severity === sev && t.ddQuestion && !questionsToInstruct.includes(t.ddQuestion)) {
          questionsToInstruct.push(t.ddQuestion);
          if (questionsToInstruct.length >= 6) break;
        }
      }
      if (questionsToInstruct.length >= 6) break;
    }
  }

  return {
    triggered: true,
    documentsAnalyzed: docs.map((d) => ({ name: d.name, analyzed: true })),
    tests,
    globalScore,
    underDocumentationRate,
    verdict,
    questionsToInstruct,
    synthesis,
    disclaimers,
  };
}
