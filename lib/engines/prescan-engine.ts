import { callClaudeWithPDF, parseJSON, FAST_MODEL } from './anthropic-client';

// ============================================================
// MOTEUR DE PRE-SCAN (TRIAGE BLOC 0)
// ------------------------------------------------------------
// Tourne en tete du pipeline, avant l extraction lourde et tous
// les autres moteurs Bloc 1. Objectif : detecter en 5-8 secondes
// les dossiers manifestement eliminatoires (knockout criteria
// classiques d un comite VC) pour permettre au partner de
// decider rapidement s il vaut la peine de lancer le pipeline
// complet (qui coute 1.80-2.80$ par dossier).
//
// Modele : Haiku 4.5 (5x moins cher que Sonnet).
// Cout estime par appel : ~0.02$ vs ~2.20$ pour le pipeline
// complet, soit cent fois moins cher.
//
// Architecture conservatrice : le pre-scan NE BLOQUE PAS le
// pipeline. Il produit un verdict consultatif que le partner
// peut utiliser pour decider. Si tous les tests passent, le
// pipeline complet tourne normalement. Si un ou plusieurs
// tests echouent, l UI affiche un encart d alerte au-dessus de
// la note avec la raison precise, et le partner reste libre
// d analyser quand meme (mode souple par defaut).
//
// Tests structurels appliques systematiquement :
//   1. Coherence narrative minimale
//   2. Credibilite fondateur minimale
//   3. Plausibilite financiere
//   4. Coherence stade vs ticket
//   5. Marche identifiable
//   6. Pas de drapeau rouge eliminatoire
//
// Tests appliques UNIQUEMENT si fundProfile fourni :
//   7. Sector fit (these sectorielle)
//   8. Geography fit (these geographique)
//   9. Ticket fit (gamme de tickets)
//  10. Stage fit (stade investi)
// ============================================================

export interface FundProfile {
  /** Liste des secteurs cibles (vide = generaliste) */
  sectorsFocus: string[];
  /** Liste des secteurs exclus */
  sectorsExcluded: string[];
  /** Liste des zones cibles (vide = pas de filtre) */
  geographiesFocus: string[];
  /** Liste des zones exclues */
  geographiesExcluded: string[];
  /** Ticket minimum en euros, ou null si pas de borne basse */
  ticketMinEur: number | null;
  /** Ticket maximum en euros, ou null si pas de borne haute */
  ticketMaxEur: number | null;
  /** Liste des stades cibles (vide = tous stades) */
  stagesFocus: string[];
  /** Notes libres du gestionnaire pour nuances que l IA ne capte pas */
  notes: string | null;
  /**
   * Identite canonique du fonds, telle que le partner se reconnaitrait
   * dans une cap table publique (ex: "Eurazeo", "Tikehau Capital").
   * Sert au moteur conflict-of-interest pour detecter un self-deal :
   * le fonds est lui-meme cite comme leadInvestor ou co-investor du
   * tour analyse. Optionnel, defaut absence de detection self-deal.
   */
  fundName?: string | null;
  /**
   * Liste des societes en portfolio du fonds, ecrites comme elles
   * apparaissent dans les communications publiques. Sert au moteur
   * conflict-of-interest pour detecter un follow-on portfolio.
   * Optionnel.
   */
  portfolioCompanies?: string[];
  /**
   * Liste des co-investisseurs reguliers du fonds, derives soit
   * manuellement par le gestionnaire soit par analyse historique
   * de la syndication. Sert au moteur conflict-of-interest pour
   * detecter une proximite de syndicat. Optionnel.
   */
  syndicatePartners?: string[];
}

export interface PreScanTest {
  /** Identifiant court du test */
  id: string;
  /** Nom lisible du test affiche dans l UI */
  name: string;
  /** Resultat : pass = pas d alerte, warn = alerte mineure, fail = knockout */
  status: 'pass' | 'warn' | 'fail';
  /** Phrase courte qui explique le verdict (15-40 mots, francais sans em-dashes) */
  rationale: string;
  /** Citation exacte du pitch qui justifie le verdict, ou empty si absence justifie l alerte */
  evidence: string;
}

export interface PreScanOutput {
  /** Score global, nombre de tests passes (pass=1, warn=0.5, fail=0) sur le total des tests appliques */
  score: number;
  /** Total de tests appliques (6 sans profil, jusqu a 10 avec profil) */
  totalTests: number;
  /** Verdict global */
  recommendation: 'ready_for_pipeline' | 'pipeline_with_caveats' | 'not_recommended';
  /** Synthese en 1-2 phrases */
  summary: string;
  /** Tous les tests avec leur verdict */
  tests: PreScanTest[];
  /** Tests qui ont fail (knockout) extraits pour acces rapide UI */
  failedTests: string[];
  /** Cout estime du pre-scan en USD (toujours tres faible, indicatif) */
  estimatedCostUsd: number;
  /** Duree d execution en ms */
  durationMs: number;
  /** Modele utilise */
  model: string;
  /** True si un fundProfile a ete utilise (les 4 tests these ont tourne) */
  usedFundProfile: boolean;
}

const BASE_SYSTEM_PROMPT = `Tu es le Moteur de Pré-Scan de la plateforme Prélude. Ton rôle est de lire un pitch deck VC en 5-8 secondes et de produire un verdict de triage rapide.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

Tu n'analyses pas en profondeur. Tu n'entres pas dans le détail. Tu appliques mécaniquement des tests éliminatoires que tout partner VC fait mentalement en lisant un dossier pour la première fois.

VOIX
Voix éditoriale Le Grand Continent / The Atlantic. Français. Pas d'em-dashes (utilise des virgules ou des points). Pas de flatterie. Pas de bullet points dans les rationales. Tu es honnête et chirurgical.

LES SIX TESTS UNIVERSELS

1. NARRATIVE (Cohérence narrative minimale)
Le pitch défend-il une thèse claire de problème, solution, marché, pourquoi maintenant ? Status fail si AUCUNE des quatre n'est répondue. Status warn si une ou deux sont absentes. Status pass si les quatre sont présentes même grossièrement.

2. FOUNDER (Crédibilité fondateur minimale)
Y a-t-il au moins un fondateur identifié avec un parcours documenté ? Status fail si aucun fondateur nommé ou CV manifestement faux. Status warn si fondateur identifié mais background trop maigre. Status pass si au moins un parcours exposé.

3. FINANCIAL (Plausibilité financière)
Les chiffres avancés sont-ils dans des ordres de grandeur cohérents ? Status fail sur claims absurdes. Status warn sur chiffres flous ou non sourcés. Status pass sinon.

4. STAGE_TICKET (Cohérence stade vs ticket)
Le ticket demandé est-il cohérent avec le stade revendiqué ? Status fail si seed qui demande 20M+ ou Series A qui demande 500k. Status warn si décalage modéré. Status pass si stade et ticket s'alignent.

5. MARKET (Marché identifiable)
Y a-t-il un marché identifiable, même grossièrement ? Status fail si purement technologique sans qui paie ni pourquoi. Status warn si marché évoqué mais clients-types non spécifiés. Status pass si segment identifiable.

6. THESIS_FIT (Pas de drapeau rouge éliminatoire)
Y a-t-il des signaux d'alarme intégrité, des claims grossièrement faux, ou un projet manifestement illégal ? Status fail si oui. Status warn en zone grise. Status pass sinon. Ce test est UNIVERSEL et concerne uniquement les drapeaux rouges génériques, pas la thèse spécifique du fonds (si une thèse est fournie, elle est évaluée séparément).`;

const FUND_PROFILE_TESTS_PROMPT = `

LES TESTS DE FIT THÈSE FONDS (s'appliquent uniquement si une thèse fonds est fournie ci-dessous)

7. SECTOR_FIT (Thèse sectorielle)
Le secteur du dossier correspond-il à la thèse sectorielle du fonds ?
- Si le secteur du dossier figure dans sectors_excluded : fail systématique.
- Si sectors_focus est défini et le dossier ne s'y rattache PAS du tout : fail.
- Si sectors_focus est défini et le dossier s'y rattache partiellement (zone connexe, lecture extensive possible) : warn.
- Si sectors_focus est défini et le dossier s'y rattache clairement : pass.
- Si sectors_focus est vide (fonds généraliste) ET sectors_excluded ne match pas : pass automatique.

8. GEOGRAPHY_FIT (Thèse géographique)
La géographie du dossier correspond-elle à la thèse géographique du fonds ?
Mêmes règles que sector_fit avec geographies_focus / geographies_excluded.

9. TICKET_FIT (Gamme de tickets)
Le ticket demandé est-il dans la gamme du fonds ?
- Si ticket_min_eur défini et ticket demandé < 50% du min : fail (trop petit).
- Si ticket_max_eur défini et ticket demandé > 200% du max : fail (trop gros).
- Si ticket_min_eur ou ticket_max_eur défini et ticket demandé est dans les 50-200% des bornes mais hors plage stricte : warn.
- Si ticket dans la plage : pass.
- Si pas de bornes définies : pass automatique.

10. STAGE_FIT (Stade investi)
Le stade revendiqué correspond-il au stade investi par le fonds ?
- Si stages_focus défini et stade pas dedans : fail.
- Si stages_focus défini et stade adjacent : warn (par ex. fonds seed/series-a et dossier pre-seed).
- Si stages_focus vide : pass automatique.`;

function buildSystemPrompt(fundProfile?: FundProfile): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (fundProfile) {
    prompt += FUND_PROFILE_TESTS_PROMPT;
  }

  prompt += `

VERDICT GLOBAL

Score : pass = 1, warn = 0.5, fail = 0. Score sur le total des tests appliqués.

Mapping vers verdict :
- ready_for_pipeline : score >= 80% du total ET aucun fail sur narrative/founder/thesis_fit/sector_fit/geography_fit
- pipeline_with_caveats : score 50-80% du total
- not_recommended : score < 50% du total OU un fail sur narrative/founder/thesis_fit/sector_fit/geography_fit

FORMAT DE RÉPONSE OBLIGATOIRE (JSON pur, sans markdown, sans backticks)

{
  "score": <nombre, peut être demi-points>,
  "totalTests": <nombre total de tests appliqués>,
  "recommendation": "ready_for_pipeline" | "pipeline_with_caveats" | "not_recommended",
  "summary": "<1-2 phrases qui résument la lecture du pré-scan, voix Le Grand Continent>",
  "tests": [
    { "id": "narrative", "name": "Cohérence narrative minimale", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "founder", "name": "Crédibilité fondateur minimale", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "financial", "name": "Plausibilité financière", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "stage_ticket", "name": "Cohérence stade vs ticket", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "market", "name": "Marché identifiable", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "thesis_fit", "name": "Pas de drapeau rouge éliminatoire", "status": "...", "rationale": "...", "evidence": "..." }${fundProfile ? `,
    { "id": "sector_fit", "name": "Thèse sectorielle", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "geography_fit", "name": "Thèse géographique", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "ticket_fit", "name": "Gamme de tickets", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "stage_fit", "name": "Stade investi", "status": "...", "rationale": "...", "evidence": "..." }` : ''}
  ]
}

L'ordre des tests doit être respecté exactement comme ci-dessus.`;

  return prompt;
}

function buildUserPrompt(fundProfile?: FundProfile): string {
  let prompt = `Voici le pitch deck à pré-scanner. Applique les tests structurels et retourne le JSON exact spécifié.`;

  if (fundProfile) {
    prompt += `

THÈSE D'INVESTISSEMENT DU FONDS À APPLIQUER

Secteurs cibles : ${fundProfile.sectorsFocus.length > 0 ? fundProfile.sectorsFocus.join(', ') : 'généraliste, pas de filtre sectoriel'}
Secteurs exclus : ${fundProfile.sectorsExcluded.length > 0 ? fundProfile.sectorsExcluded.join(', ') : 'aucun'}
Zones cibles : ${fundProfile.geographiesFocus.length > 0 ? fundProfile.geographiesFocus.join(', ') : 'pas de filtre géographique'}
Zones exclues : ${fundProfile.geographiesExcluded.length > 0 ? fundProfile.geographiesExcluded.join(', ') : 'aucune'}
Ticket minimum : ${fundProfile.ticketMinEur ? formatEuros(fundProfile.ticketMinEur) : 'pas de borne basse'}
Ticket maximum : ${fundProfile.ticketMaxEur ? formatEuros(fundProfile.ticketMaxEur) : 'pas de borne haute'}
Stades investis : ${fundProfile.stagesFocus.length > 0 ? fundProfile.stagesFocus.join(', ') : 'tous stades'}${fundProfile.notes ? `

Notes du gestionnaire : ${fundProfile.notes}` : ''}`;
  }

  return prompt;
}

function formatEuros(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M EUR`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k EUR`;
  return `${amount} EUR`;
}

/**
 * Lance le pre-scan sur un pitch deck PDF.
 * Tres rapide (5-8s), tres bon marche (~0.02$ par appel).
 * Non bloquant : le pipeline continue meme si le pre-scan deconseille.
 *
 * Si fundProfile fourni, le pre-scan ajoute 4 tests de fit these
 * (sector, geography, ticket, stage). Si non fourni, il s en tient
 * aux 6 tests universels.
 */
export async function runPreScan(
  pitchDeckBase64: string,
  fundProfile?: FundProfile,
): Promise<PreScanOutput> {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt(fundProfile);
  const userPrompt = buildUserPrompt(fundProfile);

  // Haiku 4.5 : 5x moins cher que Sonnet, suffisamment intelligent pour
  // un triage de surface. max_tokens 2500 pour avoir la marge avec les
  // 4 tests these en plus si profil fourni.
  const rawResponse = await callClaudeWithPDF(
    systemPrompt,
    userPrompt,
    pitchDeckBase64,
    fundProfile ? 2500 : 2000,
    FAST_MODEL,
  );

  const parsed = parseJSON<{
    score: number;
    totalTests: number;
    recommendation: string;
    summary: string;
    tests: PreScanTest[];
  }>(rawResponse);

  // Validation defensive : on recompute le score et la recommandation
  // mecaniquement a partir des tests, pour ne pas dependre du calcul
  // du LLM (Haiku est moins discipline que Sonnet sur l arithmetique).
  const validatedTests = Array.isArray(parsed.tests) ? parsed.tests : [];
  const totalTests = validatedTests.length || (fundProfile ? 10 : 6);

  const computedScore = validatedTests.reduce((acc, t) => {
    if (t.status === 'pass') return acc + 1;
    if (t.status === 'warn') return acc + 0.5;
    return acc;
  }, 0);

  const failedIds = validatedTests
    .filter(t => t.status === 'fail')
    .map(t => t.id);

  // Knockout sur les tests critiques :
  // - narrative, founder, thesis_fit (universels)
  // - sector_fit, geography_fit (these specifique)
  // Si un de ces cinq a fail, on force not_recommended quel que soit
  // le score brut.
  const criticalTests = ['narrative', 'founder', 'thesis_fit', 'sector_fit', 'geography_fit'];
  const criticalKnockout = failedIds.some(id => criticalTests.includes(id));

  const ratio = totalTests > 0 ? computedScore / totalTests : 0;

  let recommendation: PreScanOutput['recommendation'];
  if (criticalKnockout || ratio < 0.5) {
    recommendation = 'not_recommended';
  } else if (ratio >= 0.8) {
    recommendation = 'ready_for_pipeline';
  } else {
    recommendation = 'pipeline_with_caveats';
  }

  // Estimation cost : Haiku 4.5 ~$0.80/M input et $4/M output.
  // PDF ~8-15k tokens input, reponse ~800-1500 tokens output.
  // Cout typique : ~0.015-0.025$ par appel.
  const estimatedCostUsd = fundProfile ? 0.025 : 0.02;

  return {
    score: Math.round(computedScore * 2) / 2,
    totalTests,
    recommendation,
    summary: parsed.summary || 'Pre-scan execute sans synthese disponible.',
    tests: validatedTests,
    failedTests: failedIds,
    estimatedCostUsd,
    durationMs: Date.now() - startTime,
    model: FAST_MODEL,
    usedFundProfile: !!fundProfile,
  };
}
