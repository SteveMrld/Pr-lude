// ============================================================
// MOTEUR TECH CLAIM COHERENCE
// ------------------------------------------------------------
// Audite les revendications technologiques d un dossier qui n est
// pas necessairement IA. Se declenche si le pitch flèche un budget
// significatif sur "tech / produit / R&D / optimisation" (>= 15% de
// la levee) OU si il revendique un moat technologique via un
// vocabulaire flottant ("brique technologique innovante", "plateforme
// proprietaire", "infrastructure scalable", etc.).
//
// Sortie : trois tests calibres pour distinguer une vraie tech-driven
// company d une revendication d habillage.
//
//   T1 budget vs equipe (deterministe). On calcule combien d ingenieurs
//      le budget tech peut payer sur 36 mois et on compare a l equipe
//      tech effectivement annoncee. Si le budget paye 4 ETP mais le
//      pitch n affiche qu un "responsable technique" sans CTO ni stack,
//      le test echoue.
//
//   T2 tracabilite de l actif (LLM). Le claim decrit-il un actif
//      precis (algo, brevet, dataset, infra mesurable, KPI) ou
//      reste-t-il abstrait ? Le LLM lit le pitch et juge.
//
//   T3 contre-factuel (LLM). Si on retire toute la revendication tech,
//      le pari commercial tient-il debout ? Permet de distinguer
//      "tech = moat" de "tech = habillage".
//
// Le moteur ne tourne pas si aucun trigger n est detecte (verdict
// not_applicable, pas d appel LLM). Couts ~ 1 appel LLM si triggered,
// 0 sinon.
// ============================================================

import type { ExtractionOutput, FinancialDataExtraction, TechClaimCoherenceOutput } from './types';
import { callClaude, parseJSON, FAST_MODEL } from './anthropic-client';
import { normalizeFrText } from '../data/text-normalize';

// ============================================================
// Detection des triggers (deterministe)
// ============================================================

// Mots-cles qui suggerent une allocation budgetaire vers la tech.
// Volontairement larges pour capturer les phrasings habituels des
// pitchs francais.
const TECH_BUDGET_KEYWORDS = [
  'tech', 'technologique', 'technologie',
  'produit', 'product', 'r&d', 'rd ', 'recherche',
  'developpement', 'développement', 'engineering', 'ingenieur', 'ingénieur',
  'plateforme', 'platform', 'infrastructure',
  'optimisation de la performance', 'optimisation technologique',
  'algorithme', 'machine learning', 'data',
];

// Mots-cles qui suggerent une revendication de moat technologique.
const TECH_MOAT_KEYWORDS = [
  'brique technologique', 'brique tech',
  'plateforme proprietaire', 'plateforme propriétaire',
  'algorithme proprietaire', 'algorithme propriétaire',
  'infrastructure scalable', 'infrastructure proprietaire',
  'tech proprietaire', 'tech propriétaire',
  'moat technologique', 'moat tech',
  'differenciateur technologique', 'différenciateur technologique',
  'avantage technologique', 'tech-driven',
  'stack proprietaire', 'stack propriétaire',
  'data proprietaire', 'donnees proprietaires', 'données propriétaires',
];

interface BudgetSignal {
  detected: boolean;
  percentage: number | null;
  amountEur: number | null;
  evidence: string;
}

interface MoatSignal {
  detected: boolean;
  keywords: string[];
  evidence: string;
}

/**
 * Cherche dans le texte du pitch une allocation budgetaire vers la
 * tech. Retourne le pourcentage et le montant si on arrive a les
 * extraire, sinon false. Heuristique : on cherche des patterns du type
 * "25%" ou "X% pour" suivi des mots-cles tech.
 */
function detectBudgetAllocation(
  rawText: string,
  totalRoundEur: number | null,
): BudgetSignal {
  const text = normalizeFrText(rawText);

  // Pattern : un nombre suivi de % puis d un mot-cle tech dans une fenetre proche
  // Exemples : "25% pour la tech", "30% optimisation produit", "45% production",
  // "Optimisation technologique 25%"
  const percentRegex = /(\d{1,2})\s*(?:%|pour\s*cent)\s*([^.]{0,80})/g;
  const reverseRegex = /([^.]{0,80})\s*(\d{1,2})\s*(?:%|pour\s*cent)/g;

  const matches: Array<{ pct: number; context: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = percentRegex.exec(text)) !== null) {
    matches.push({ pct: parseInt(m[1], 10), context: m[2] });
  }
  while ((m = reverseRegex.exec(text)) !== null) {
    matches.push({ pct: parseInt(m[2], 10), context: m[1] });
  }

  // Cherche un match dont le contexte contient au moins un mot-cle tech
  let bestPct = 0;
  let bestEvidence = '';
  for (const match of matches) {
    if (match.pct > 60) continue; // ignore "75% des consommateurs", etc.
    const hit = TECH_BUDGET_KEYWORDS.some((kw) => match.context.includes(kw));
    if (hit && match.pct > bestPct) {
      bestPct = match.pct;
      bestEvidence = match.context.trim().slice(0, 200);
    }
  }

  if (bestPct < 15) {
    return { detected: false, percentage: bestPct || null, amountEur: null, evidence: bestEvidence };
  }

  const amountEur = totalRoundEur !== null
    ? Math.round((bestPct / 100) * totalRoundEur)
    : null;

  return {
    detected: true,
    percentage: bestPct,
    amountEur,
    evidence: bestEvidence,
  };
}

/**
 * Cherche les revendications de moat technologique dans le texte.
 * Retourne les mots-cles trouves et un extrait contextualise.
 */
function detectMoatClaim(rawText: string): MoatSignal {
  const text = normalizeFrText(rawText);
  const found: string[] = [];
  let firstEvidence = '';

  for (const kw of TECH_MOAT_KEYWORDS) {
    if (text.includes(kw)) {
      found.push(kw);
      if (!firstEvidence) {
        const idx = text.indexOf(kw);
        const start = Math.max(0, idx - 80);
        const end = Math.min(text.length, idx + kw.length + 80);
        firstEvidence = '...' + text.slice(start, end).trim() + '...';
      }
    }
  }

  return {
    detected: found.length > 0,
    keywords: Array.from(new Set(found)),
    evidence: firstEvidence,
  };
}

/**
 * Parse un montant texte (ex "1,5M€", "1.5M EUR", "1500k€") en
 * nombre absolu en EUR. Retourne null si parse impossible.
 */
function parseAmountEur(amountStr: string | null | undefined): number | null {
  if (!amountStr) return null;
  const s = amountStr.toLowerCase().replace(/[\s,]/g, '.');
  const match = s.match(/([\d.]+)\s*(k|m|md|bn|b)?\s*(€|eur|\$|usd)?/);
  if (!match) return null;
  let value = parseFloat(match[1]);
  if (isNaN(value)) return null;
  const unit = (match[2] || '').toLowerCase();
  const currency = (match[3] || '').toLowerCase();
  if (unit === 'k') value = value * 1_000;
  else if (unit === 'md' || unit === 'bn' || unit === 'b') value = value * 1_000_000_000;
  else value = value * 1_000_000; // M par defaut
  // Conversion approximative USD -> EUR si necessaire (heuristique 0.92)
  if (currency === '$' || currency === 'usd') value = value * 0.92;
  return Math.round(value);
}

// ============================================================
// Test 1 : budget vs equipe (deterministe)
// ------------------------------------------------------------
// Calcul : combien d ingenieurs ETP le budget tech paye-t-il sur 36
// mois ? On suppose un cout charge moyen de 8000 EUR/mois (salaire +
// charges + outils, fourchette francaise senior). Compare a l equipe
// tech annoncee dans le pitch (CTO, lead, ingenieurs nommes ou cites).
// ============================================================

interface TeamTechSignals {
  hasCTO: boolean;
  hasTechLead: boolean;
  techProfilesCount: number;
  techProfilesNamed: string[];
}

function detectTeamTechSignals(extraction: ExtractionOutput): TeamTechSignals {
  const founders = extraction.founders || [];
  let hasCTO = false;
  let hasTechLead = false;
  const techProfilesNamed: string[] = [];

  const TECH_ROLES = /\bcto\b|chief technology|head of (engineering|tech|product)|lead (tech|developer|engineer|engineering)|tech lead|engineering manager|ingenieur en chef|directeur (technique|tech|produit)/i;
  const TECH_BACKGROUND = /\b(developer|developpeur|engineer|ingenieur|software|fullstack|backend|frontend|devops|data scientist|ml engineer|machine learning|computer science)\b/i;

  for (const f of founders) {
    const role = f.role || '';
    const bg = f.background || '';
    if (/cto|chief technology/i.test(role)) hasCTO = true;
    if (TECH_ROLES.test(role)) hasTechLead = true;
    if (TECH_ROLES.test(bg) || TECH_BACKGROUND.test(bg)) {
      techProfilesNamed.push(f.name);
    }
  }

  // Cherche aussi dans le rawSummary pour les profils tech non-fondateurs
  const summary = (extraction.rawSummary || '').toLowerCase();
  const techMentions = [
    /responsable technique/, /lead developer/, /lead engineer/,
    /\bcto\b/, /\bvp engineering\b/, /\bvp tech\b/,
    /head of engineering/, /head of product/,
  ];
  let teamMentionsCount = 0;
  for (const re of techMentions) {
    if (re.test(summary)) teamMentionsCount++;
  }

  return {
    hasCTO,
    hasTechLead: hasTechLead || teamMentionsCount > 0,
    techProfilesCount: techProfilesNamed.length + teamMentionsCount,
    techProfilesNamed,
  };
}

function runBudgetVsTeamTest(
  budgetSignal: BudgetSignal,
  teamSignals: TeamTechSignals,
): TechClaimCoherenceOutput['tests']['budgetVsTeam'] {
  // Cout charge d un ingenieur senior FR : 8000 EUR/mois (estimation
  // mediane Paris 2024-2025, salaire brut 60-80k + charges + outils).
  const COST_PER_ENGINEER_PER_MONTH = 8000;
  const RUNWAY_MONTHS = 36;

  if (!budgetSignal.detected || budgetSignal.amountEur === null) {
    // Pas de budget detecte mais le moteur peut quand meme avoir ete declenche
    // par la revendication de moat (sans budget chiffre). On evalue alors sur
    // l equipe seule.
    if (teamSignals.hasCTO || teamSignals.techProfilesCount >= 2) {
      return {
        score: 60,
        passed: true,
        observation: `Equipe tech presente (${teamSignals.techProfilesCount} profil(s) identifie(s), CTO ${teamSignals.hasCTO ? 'present' : 'absent'}) sans allocation budgetaire chiffree dans le pitch.`,
        implication: 'L equipe semble en place mais le pitch ne quantifie pas l investissement tech. A verifier en DD : fiche de poste, plan de recrutement, runway technique.',
      };
    }
    return {
      score: 30,
      passed: false,
      observation: 'Aucune allocation budgetaire tech detectable dans le pitch et equipe tech minimale.',
      implication: 'La revendication de moat tech repose sur un substrat humain non documente. A requalifier en post-production / habillage editorial si l equipe tech n existe pas.',
    };
  }

  const sustainableEngineers = budgetSignal.amountEur / (COST_PER_ENGINEER_PER_MONTH * RUNWAY_MONTHS);
  const declaredTech = teamSignals.techProfilesCount;

  // Cas 1 : budget paye plus d ingenieurs que l equipe ne l annonce
  // = signal de soit equipe a recruter (OK si plan visible), soit
  // budget sur-dimensionne par rapport a l equipe (red flag)
  if (declaredTech === 0 && sustainableEngineers >= 1) {
    return {
      score: 25,
      passed: false,
      observation: `Budget de ${Math.round(budgetSignal.amountEur / 1000)}k EUR theoriquement suffisant pour ${sustainableEngineers.toFixed(1)} ETP sur 36 mois, mais aucun profil tech identifie dans l equipe annoncee.`,
      implication: 'L allocation tech finance des recrutements futurs non visibles dans le pitch. Demander le plan de recrutement detaille (roles, niveau, calendrier) avant de valider la coherence.',
    };
  }

  if (sustainableEngineers > declaredTech * 1.5 && declaredTech > 0) {
    return {
      score: 50,
      passed: false,
      observation: `Budget de ${Math.round(budgetSignal.amountEur / 1000)}k EUR finance ${sustainableEngineers.toFixed(1)} ETP sur 36 mois. Equipe tech annoncee : ${declaredTech} profil(s). Decalage de ${Math.round(sustainableEngineers - declaredTech)} ETP a justifier.`,
      implication: 'Soit l equipe va etre etoffee (montrer le plan), soit une partie du budget tech va a autre chose (outils, infra, prestations). Clarifier la decomposition.',
    };
  }

  if (sustainableEngineers < declaredTech * 0.6) {
    return {
      score: 65,
      passed: true,
      observation: `Equipe tech declaree (${declaredTech} profils) plus large que ce que le budget tech finance (${sustainableEngineers.toFixed(1)} ETP). Equipe deja en place ou auto-financement partiel.`,
      implication: 'L equipe tech est sur-dimensionnee par rapport au budget alloue dans la levee, ce qui suggere une assise pre-existante. Plutot positif sur la coherence.',
    };
  }

  return {
    score: 75,
    passed: true,
    observation: `Budget tech (${Math.round(budgetSignal.amountEur / 1000)}k EUR sur 36 mois) coherent avec l equipe tech annoncee (${declaredTech} profil(s), CTO ${teamSignals.hasCTO ? 'present' : 'absent'}).`,
    implication: 'Le budget tech soutient une equipe identifiable. La coherence numerique est OK, reste a valider la qualite des profils et de la stack.',
  };
}

// ============================================================
// Tests 2 et 3 : LLM (un seul appel)
// ============================================================

const LLM_SYSTEM_PROMPT = `Tu es un investisseur technique senior qui audite la revendication technologique d un pitch deck. Tu produis un jugement structure sur deux questions precises.

REGLES STRICTES.
- Pas de complaisance. Pas de surevaluation par enthousiasme.
- Distingue ce qui est decrit precisement (algo nomme, brevet cite, dataset chiffre, KPI mesurable) de ce qui est abstrait (brique technologique, plateforme scalable, infrastructure innovante).
- Si la revendication est uniquement abstraite, dis-le. Si elle est precise, identifie l actif.
- Pour le contre-factuel : imagine le pitch sans aucune mention de tech. Le pari commercial reste-t-il defendable sur ses propres bases editoriales / commerciales / operationnelles ?
- Pas d em-dashes dans tes textes. Utilise des virgules, des points, des nouvelles phrases.

Retourne uniquement le JSON structure suivant :

{
  "claimSummary": "Resume neutre en 1-2 phrases du claim tech tel qu il apparait dans le pitch",
  "assetTraceability": {
    "score": <0-100, 0 = aucun actif identifiable, 100 = actif precis et auditable>,
    "passed": <true si score >= 60, false sinon>,
    "observation": "1-2 phrases factuelles sur ce qui est ou n est pas decrit",
    "implication": "1 phrase sur ce que ca implique pour l investisseur"
  },
  "counterFactual": {
    "score": <0-100, 0 = sans la tech le pari ne tient pas du tout, 100 = sans la tech le pari tient parfaitement (donc tech = habillage)>,
    "passed": <true si score >= 60, ie le pari tient sans la tech, ce qui est en realite un signal NEGATIF pour la revendication tech>,
    "observation": "1-2 phrases sur ce qui reste si on retire la revendication tech",
    "implication": "1 phrase sur la nature reelle du moat (tech vs editorial vs operationnel vs commercial)"
  },
  "questionsToInstruct": [
    "3 a 5 questions precises a poser au fondateur en DD pour clarifier le claim tech"
  ],
  "synthesis": "Paragraphe editorial de 3-4 phrases qui synthetise le claim, sa credibilite, et ce que l investisseur doit retenir. Voix neutre, factuelle, pas de complaisance."
}`;

async function runLLMTests(
  extraction: ExtractionOutput,
  budgetSignal: BudgetSignal,
  moatSignal: MoatSignal,
): Promise<{
  claimSummary: string;
  assetTraceability: TechClaimCoherenceOutput['tests']['assetTraceability'];
  counterFactual: TechClaimCoherenceOutput['tests']['counterFactual'];
  questionsToInstruct: string[];
  synthesis: string;
}> {
  const userPrompt = `Audit de la revendication technologique du dossier ${extraction.companyName || '?'}.

# CONTEXTE
Secteur : ${extraction.sector || '?'} / ${extraction.subSector || '?'}
Tour : ${extraction.fundraise?.stage || '?'} ${extraction.fundraise?.amount || '?'}

# REVENDICATION TECH DETECTEE
Budget tech : ${budgetSignal.detected ? `${budgetSignal.percentage}% de la levee, soit ~${budgetSignal.amountEur ? Math.round(budgetSignal.amountEur / 1000) + 'k EUR' : 'montant non chiffre'}` : 'non chiffre dans le pitch'}
${budgetSignal.evidence ? `Extrait pitch : "${budgetSignal.evidence}"` : ''}
Mots-cles moat : ${moatSignal.detected ? moatSignal.keywords.join(', ') : 'aucun'}
${moatSignal.evidence ? `Extrait pitch : "${moatSignal.evidence}"` : ''}

# PRODUIT
${extraction.productDescription || 'non renseigne'}

# MODELE ECONOMIQUE
${extraction.businessModel || 'non renseigne'}

# FONDATEURS
${(extraction.founders || []).map((f) => `- ${f.name} (${f.role}) : ${f.background}`).join('\n') || 'non renseigne'}

# RESUME BRUT DOSSIER
${extraction.rawSummary || 'non renseigne'}

Audite la tracabilite de l actif tech revendique et le contre-factuel (le pari tient-il sans la tech ?). Retourne uniquement le JSON structure demande.`;

  const rawResponse = await callClaude(LLM_SYSTEM_PROMPT, userPrompt, 2000, FAST_MODEL);
  return parseJSON(rawResponse);
}

// ============================================================
// Verdict global
// ============================================================

function computeVerdict(
  triggered: boolean,
  budgetVsTeamScore: number,
  assetTraceabilityScore: number,
  counterFactualScore: number,
): TechClaimCoherenceOutput['verdict'] {
  if (!triggered) return 'not_applicable';

  // Note : counterFactualScore eleve = pari tient SANS la tech = signal
  // negatif pour la revendication tech. On l inverse dans le calcul.
  const techIsRealMoat = 100 - counterFactualScore;
  const compositeScore = (budgetVsTeamScore + assetTraceabilityScore + techIsRealMoat) / 3;

  if (compositeScore >= 65) return 'tech_credible';
  if (compositeScore >= 40) return 'tech_partially_substantiated';
  return 'tech_storytelling';
}

// ============================================================
// Public : analyzeTechClaimCoherence
// ============================================================

export async function analyzeTechClaimCoherence(
  extraction: ExtractionOutput,
  financialData: FinancialDataExtraction | null,
): Promise<TechClaimCoherenceOutput> {
  // 1. Detection des triggers (deterministe, pas d appel LLM)
  const rawText = [
    extraction.companyName,
    extraction.productDescription,
    extraction.businessModel,
    extraction.marketPitch,
    extraction.rawSummary,
  ].filter(Boolean).join(' ');

  const totalRoundEur = parseAmountEur(extraction.fundraise?.amount);
  const budgetSignal = detectBudgetAllocation(rawText, totalRoundEur);
  const moatSignal = detectMoatClaim(rawText);

  const triggered = budgetSignal.detected || moatSignal.detected;

  // 2. Si pas triggered : retourne not_applicable sans appel LLM
  if (!triggered) {
    return {
      triggered: false,
      triggers: {
        budgetAllocationDetected: budgetSignal,
        moatClaimDetected: moatSignal,
      },
      claimSummary: 'Le dossier ne revendique pas de moat technologique significatif et ne flèche pas de budget tech notable. Le moteur de coherence tech ne s applique pas.',
      tests: {
        budgetVsTeam: { score: 0, passed: true, observation: 'Test non applicable.', implication: '' },
        assetTraceability: { score: 0, passed: true, observation: 'Test non applicable.', implication: '' },
        counterFactual: { score: 0, passed: true, observation: 'Test non applicable.', implication: '' },
      },
      globalScore: 0,
      verdict: 'not_applicable',
      questionsToInstruct: [],
      synthesis: 'Le dossier ne revendique pas de differenciateur technologique. Le moteur de coherence tech ne s applique pas et n a pas de question a remonter.',
    };
  }

  // 3. Test 1 deterministe
  const teamSignals = detectTeamTechSignals(extraction);
  const budgetVsTeam = runBudgetVsTeamTest(budgetSignal, teamSignals);

  // 4. Tests 2 et 3 via LLM
  let llmResult;
  try {
    llmResult = await runLLMTests(extraction, budgetSignal, moatSignal);
  } catch (err: any) {
    // Si l appel LLM echoue, on degrade : on retourne juste le test 1
    // avec un verdict prudent.
    console.warn('[tech-claim] LLM call failed:', err?.message);
    return {
      triggered: true,
      triggers: {
        budgetAllocationDetected: budgetSignal,
        moatClaimDetected: moatSignal,
      },
      claimSummary: 'Revendication tech detectee dans le pitch (mots-cles ou budget) mais audit LLM en echec, jugement partiel.',
      tests: {
        budgetVsTeam,
        assetTraceability: {
          score: 50, passed: false,
          observation: 'Audit non disponible (LLM en echec).',
          implication: 'A reanalyser apres relance du moteur.',
        },
        counterFactual: {
          score: 50, passed: false,
          observation: 'Audit non disponible (LLM en echec).',
          implication: 'A reanalyser apres relance du moteur.',
        },
      },
      globalScore: budgetVsTeam.score,
      verdict: 'tech_partially_substantiated',
      questionsToInstruct: [
        'Quels sont les actifs technologiques precis qui justifient la revendication de moat tech ?',
        'Quel est le plan de recrutement tech detaille sur le runway de 36 mois ?',
        'Comment le claim tech se traduit-il en avantage prix mesurable cote client ?',
      ],
      synthesis: 'Le dossier revendique un differenciateur technologique mais l audit LLM n a pas pu etre execute. Le test budget vs equipe seul donne un signal partiel. A reanalyser pour avoir le verdict complet.',
    };
  }

  // 5. Synthese
  const assetTraceability = llmResult.assetTraceability;
  const counterFactual = llmResult.counterFactual;
  const verdict = computeVerdict(
    true,
    budgetVsTeam.score,
    assetTraceability.score,
    counterFactual.score,
  );

  // Score global = moyenne ponderee des trois tests, en inversant counterFactual
  // (un score eleve sur counterFactual = pari tient sans la tech = signal
  // negatif pour la revendication tech).
  const techIsRealMoat = 100 - counterFactual.score;
  const globalScore = Math.round(
    (budgetVsTeam.score * 0.30) +
    (assetTraceability.score * 0.40) +
    (techIsRealMoat * 0.30),
  );

  return {
    triggered: true,
    triggers: {
      budgetAllocationDetected: budgetSignal,
      moatClaimDetected: moatSignal,
    },
    claimSummary: llmResult.claimSummary,
    tests: {
      budgetVsTeam,
      assetTraceability,
      counterFactual,
    },
    globalScore,
    verdict,
    questionsToInstruct: Array.isArray(llmResult.questionsToInstruct)
      ? llmResult.questionsToInstruct.slice(0, 5)
      : [],
    synthesis: llmResult.synthesis,
  };
}
