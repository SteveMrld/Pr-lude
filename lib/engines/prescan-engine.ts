import { callClaudeWithPDF, parseJSON, FAST_MODEL } from './anthropic-client';
import type { NonProductionCause, NonProductionCauseOrNull } from './non-production';
import {
  evaluerComparaisons,
  type DossierFact,
  type DossierFacts,
  type FitProfile,
  type PreScanStatus,
} from './prescan-fit';
import {
  SECTOR_VOCABULARY,
  GEOGRAPHY_VOCABULARY,
  STAGES,
} from '../fund-profile/vocabulary';

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
// Repartition des dix tests depuis la grappe pre-scan : ce qui est
// comparable se compare, ce qui se juge se juge.
//
// Rendus par le modele, parce qu ils demandent de lire un document :
//   1. Coherence narrative minimale
//   2. Credibilite fondateur minimale
//   3. Plausibilite financiere
//   5. Marche identifiable
//   6. Pas de drapeau rouge eliminatoire
//
// Calcules par le code dans prescan-fit, a partir de quatre faits que
// le modele extrait avec leur citation :
//   4. Coherence stade vs ticket (contre les fourchettes usuelles)
//   7. Sector fit, 8. Geography fit, 9. Ticket fit, 10. Stage fit
//      (contre le profil du fonds)
//
// Le profil du fonds ne descend plus dans le prompt. Le modele ne
// connait pas la these, donc il ne peut pas la redecider : c est la
// faute qui a ouvert la grappe, sector_fit ayant declare hors these un
// dossier consumer quand le profil portait Consumer parmi ses secteurs
// cibles.
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
  /**
   * pass = pas d alerte, warn = alerte mineure, fail = knockout,
   * not_produced = le test n a pas rendu de verdict. Le quatrieme cas
   * n est ni un succes ni un echec : il se lit avec sa cause.
   */
  status: PreScanStatus;
  /** Phrase courte qui explique le verdict (15-40 mots, francais sans em-dashes) */
  rationale: string;
  /** Citation exacte du pitch qui justifie le verdict, ou empty si absence justifie l alerte */
  evidence: string;
  /**
   * Null quand le test a rendu un verdict. Renseigne sinon, au sens de
   * la grappe 3 : `absence` quand le deck ne porte pas la donnee,
   * `incident` quand le modele devait rendre le test et ne l a pas fait.
   */
  nonProductionCause?: NonProductionCauseOrNull;
  /**
   * Ce que le modele a declare dans le champ de cause, avant que le code
   * ne tranche, ou null s il n a rien declare. Le champ existe pour que
   * la difference entre la declaration et la decision soit mesurable :
   * une declaration de `doctrine` est refusee, et sans cette trace le
   * refus ne se compterait pas. Ce n est pas une entree de calcul, aucun
   * consommateur ne doit la lire pour decider.
   */
  causeDeclaree?: string | null;
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
  /**
   * Faits extraits du deck qui alimentent les comparaisons. Persistes
   * pour qu une elimination puisse etre relue sur pieces : le motif
   * d un fit refuse se verifie contre la citation et contre le profil,
   * sans relancer le modele.
   */
  dossierFacts: DossierFacts;
  /**
   * Tests demandes qui n ont pas rendu de verdict, avec leur cause. Le
   * releve est explicite pour qu une note ne puisse pas presenter dix
   * tests quand huit ont conclu.
   */
  notProducedTests: Array<{ id: string; cause: NonProductionCause }>;
  /**
   * True si au moins une non-production est de cause incident. Dans ce
   * cas l elimination par le score est interdite : une defaillance du
   * dispositif ne se convertit pas en decision doctrinale.
   */
  hasProductionIncident: boolean;
  /**
   * Motif de l incident quand le pre-scan n a pas pu s executer du
   * tout, nommant la limite atteinte. Null en fonctionnement normal.
   */
  nonProductionReason: string | null;
}

export const BASE_SYSTEM_PROMPT = `Tu es le Moteur de Pré-Scan de la plateforme Prélude. Ton rôle est de lire un pitch deck VC en 5-8 secondes et de produire un verdict de triage rapide.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

Tu n'analyses pas en profondeur. Tu n'entres pas dans le détail. Tu appliques mécaniquement des tests éliminatoires que tout partner VC fait mentalement en lisant un dossier pour la première fois.

VOIX
Voix éditoriale Le Grand Continent / The Atlantic. Français. Pas d'em-dashes (utilise des virgules ou des points). Pas de flatterie. Pas de bullet points dans les rationales. Tu es honnête et chirurgical.

LES CINQ TESTS DE JUGEMENT

Ces cinq tests sont les seuls que tu rends. Les tests de cohérence stade contre ticket et de fit avec la thèse du fonds ne te sont pas demandés : ils sont calculés par comparaison à partir des faits que tu extrais plus bas. Tu ne connais pas la thèse du fonds et tu n'as pas à la deviner.

1. NARRATIVE (Cohérence narrative minimale)
Le pitch défend-il une thèse claire de problème, solution, marché, pourquoi maintenant ? Status fail si AUCUNE des quatre n'est répondue. Status warn si une ou deux sont absentes. Status pass si les quatre sont présentes même grossièrement.

2. FOUNDER (Crédibilité fondateur minimale)
Y a-t-il au moins un fondateur identifié avec un parcours documenté ? Status fail si aucun fondateur nommé ou CV manifestement faux. Status warn si fondateur identifié mais background trop maigre. Status pass si au moins un parcours exposé.

3. FINANCIAL (Plausibilité financière)
Les chiffres avancés sont-ils dans des ordres de grandeur cohérents ? Status fail sur claims absurdes. Status warn sur chiffres flous ou non sourcés. Status pass sinon.

4. MARKET (Marché identifiable)
Y a-t-il un marché identifiable, même grossièrement ? Status fail si purement technologique sans qui paie ni pourquoi. Status warn si marché évoqué mais clients-types non spécifiés. Status pass si segment identifiable.

5. THESIS_FIT (Pas de drapeau rouge éliminatoire)
Y a-t-il des signaux d'alarme intégrité, des claims grossièrement faux, ou un projet manifestement illégal ? Status fail si oui. Status warn en zone grise. Status pass sinon. Ce test concerne uniquement les drapeaux rouges génériques, jamais la thèse d'un fonds.`;

// ------------------------------------------------------------
// Extraction des faits comparables
// ------------------------------------------------------------
// Le modele n evalue plus le fit : il extrait quatre faits du deck, que
// le code compare ensuite au profil du fonds. La liste de vocabulaire
// remise ici est la taxonomie de la plateforme, pas la these d un
// fonds : elle ne dit pas ce que le fonds cible, elle dit quels
// libelles existent. Sans elle, le modele rendrait du texte libre et la
// comparaison redeviendrait approximative.
//
// La regle de citation est la regle anti-divination de la grappe 4. Une
// valeur sans citation est refusee en aval, donc l inventer ne sert a
// rien, et le dire coute moins cher que le taire.
const FACTS_PROMPT = `

LES CINQ FAITS À EXTRAIRE

En plus des cinq tests, tu extrais cinq faits du deck. Chacun porte une valeur prise dans le vocabulaire imposé ci-dessous, et une citation courte du deck qui la justifie.

Règle absolue : si le deck ne permet pas d'établir un fait, tu rends value null et evidence null. Tu n'inventes jamais, tu ne déduis jamais d'un secteur voisin ou d'un ordre de grandeur plausible. Une valeur sans citation est rejetée par la suite du traitement, donc la produire ne sert à rien.

1. companyName : le nom de la société analysée, tel que le deck l'écrit, sans forme juridique ni slogan. Aucun vocabulaire imposé. Si le deck ne nomme aucune société, value null.

2. sector : le secteur principal du dossier, choisi EXACTEMENT dans cette liste, libellé identique au caractère près :
${SECTOR_VOCABULARY.join(' | ')}

3. geography : le marché principal ou le siège de la société, choisi EXACTEMENT dans cette liste :
${GEOGRAPHY_VOCABULARY.join(' | ')}

4. stage : le stade revendiqué par le dossier, choisi EXACTEMENT dans cette liste :
${STAGES.join(' | ')}
Le stade doit être revendiqué ou clairement déductible d'une mention de tour. Un chiffre d'affaires ou un effectif ne suffisent pas à le déduire : dans ce cas, value null.

5. ticketEur : le montant recherché, en euros, en nombre entier sans séparateur ni unité. Si le deck exprime un besoin de financement sans le qualifier de levée, retiens-le quand même et cite le passage. Si aucun montant n'est demandé, value null.`;

/**
 * Exporte pour le harnais de mesure de la grappe pre-scan, qui rejoue
 * le pre-scan en faisant varier un seul element du prompt. Reconstruire
 * le prompt dans le harnais l aurait fait diverger du prompt reel, et
 * une mesure sur un prompt approche ne mesure rien.
 */
export function buildSystemPrompt(): string {
  return BASE_SYSTEM_PROMPT + FACTS_PROMPT + `

FORMAT DE RÉPONSE OBLIGATOIRE (JSON pur, sans markdown, sans backticks)

{
  "summary": "<1-2 phrases qui résument la lecture du pré-scan, voix Le Grand Continent>",
  "tests": [
    { "id": "narrative", "name": "Cohérence narrative minimale", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "founder", "name": "Crédibilité fondateur minimale", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "financial", "name": "Plausibilité financière", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "market", "name": "Marché identifiable", "status": "...", "rationale": "...", "evidence": "..." },
    { "id": "thesis_fit", "name": "Pas de drapeau rouge éliminatoire", "status": "...", "rationale": "...", "evidence": "..." }
  ],
  "dossierFacts": {
    "companyName": { "value": "<nom de la société ou null>", "evidence": "<citation ou null>" },
    "sector": { "value": "<libellé du vocabulaire ou null>", "evidence": "<citation ou null>" },
    "geography": { "value": "<libellé du vocabulaire ou null>", "evidence": "<citation ou null>" },
    "stage": { "value": "<libellé du vocabulaire ou null>", "evidence": "<citation ou null>" },
    "ticketEur": { "value": <nombre ou null>, "evidence": "<citation ou null>" }
  }
}

Tu ne rends ni score ni recommendation : le verdict est calculé en aval. L'ordre des cinq tests doit être respecté exactement comme ci-dessus, et les cinq doivent être présents.`;
}

export function buildUserPrompt(): string {
  return `Voici le pitch deck à pré-scanner. Rends les cinq tests de jugement et les quatre faits, dans le JSON exact spécifié.`;
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
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt();

  // Haiku 4.5 : 5x moins cher que Sonnet, suffisamment intelligent pour
  // un triage de surface. max_tokens 2500 pour avoir la marge avec les
  // 4 tests these en plus si profil fourni.
  // temperature=0 : triage deterministe sur six tests eliminatoires.
  // Un dossier borderline doit tomber toujours du meme cote entre deux
  // runs, sinon l economie du gating knockout devient stochastique.
  let rawResponse: string;
  try {
    rawResponse = await callClaudeWithPDF(
    systemPrompt,
    userPrompt,
    pitchDeckBase64,
    fundProfile ? 2500 : 2000,
      FAST_MODEL,
      0,
    );
  } catch (err: any) {
    // Le pre-scan qui ne peut pas s executer se declare au lieu de
    // lever. La route attrapait et poursuivait avec un pre-scan nul :
    // le repli etait bon, un incident d API ne doit pas empecher une
    // analyse, mais il etait muet.
    //
    // MESURE DU 6 AOUT 2026, ET POURQUOI ELLE REMPLACE LA PRECEDENTE
    //
    // Le releve porte ici « quatre decks sur vingt-six, donc quinze pour
    // cent des dossiers jamais tries ». Refait sur les cinquante-six
    // analyses a resultat : six sorties dont tous les tests sont non
    // produits de cause incident, soit dix virgule sept pour cent. Mais
    // ces six sont un seul dossier, le meme memorandum rejoue six fois,
    // et il refuse pour la meme raison a chaque fois, la limite de cent
    // pages du modele rapide.
    //
    // Un dossier sur trente-trois et dix virgule sept pour cent des runs
    // sont deux chiffres du meme fait, et seul le premier repond a la
    // question « combien de societes n ont pas ete triees ». Rapporter le
    // second revient a laisser un document lourd rejoue souvent gonfler
    // un taux : c est le denominateur qui decide de ce qu on a le droit
    // d affirmer, exactement comme pour le compte des trajectoires.
    return {
      ...preScanNonProduit(fundProfile, motifIncident(err)),
      durationMs: Date.now() - startTime,
      model: FAST_MODEL,
    };
  }

  const parsed = parseJSON<PreScanRawResponse>(rawResponse);

  return {
    ...assemblerPreScan(parsed, fundProfile),
    durationMs: Date.now() - startTime,
    model: FAST_MODEL,
  };
}

/**
 * Nomme la limite atteinte. Les deux motifs rencontres sur le corpus
 * sont les seuls que l API distingue explicitement ; tout le reste
 * reste un incident sans qualification plutot qu un motif invente.
 */
export function motifIncident(err: unknown): string {
  const m = String((err as any)?.message ?? err);
  if (/maximum of \d+ PDF pages/i.test(m)) {
    return 'Document au-dela de la limite de cent pages acceptee par le modele.';
  }
  if (/base64\.data|too large|request_too_large|exceed/i.test(m)) {
    return 'Document au-dela de la taille maximale acceptee par le modele.';
  }
  return `Appel au modele en echec : ${m.slice(0, 160)}`;
}

/**
 * Sortie d un pre-scan qui n a pas pu s executer. Tous les tests
 * demandes sont non produits de cause incident, au sens de la grappe 3,
 * et le verdict ne peut pas etre eliminatoire : une defaillance du
 * dispositif ne se convertit pas en decision. C est la meme forme que
 * la non-production du bloc 2, appliquee au cas ou rien n a tourne.
 */
export function preScanNonProduit(
  fundProfile: FundProfile | undefined,
  motif: string,
): Omit<PreScanOutput, 'durationMs' | 'model'> {
  const attendus = ORDRE_AFFICHAGE.filter(
    id => fundProfile || !TESTS_DE_THESE.includes(id),
  );
  const tests: PreScanTest[] = attendus.map(id => ({
    id,
    name: NOMS_ATTENDUS[id] ?? id,
    status: 'not_produced',
    rationale: `Pre-scan non execute. ${motif}`,
    evidence: '',
    nonProductionCause: 'incident',
  }));
  return {
    score: 0,
    totalTests: attendus.length,
    recommendation: 'pipeline_with_caveats',
    summary: `Ce dossier n a pas ete pre-scanne. ${motif} Le pipeline complet tourne sans triage prealable, et aucun des ${attendus.length} tests n a rendu de verdict.`,
    tests,
    failedTests: [],
    estimatedCostUsd: 0,
    usedFundProfile: !!fundProfile,
    dossierFacts: normaliserFacts(null),
    notProducedTests: tests.map(t => ({ id: t.id, cause: 'incident' as const })),
    hasProductionIncident: true,
    nonProductionReason: motif,
  };
}

/** Ce que le modele rend, avant assemblage. */
export interface PreScanRawResponse {
  summary: string;
  tests: PreScanTest[];
  dossierFacts: DossierFacts;
}

/**
 * Assemble la sortie du pre-scan a partir de la reponse brute du modele
 * et du profil du fonds. Pure et exportee pour etre verifiable sans
 * appel au modele : c est la seule facon de tester que le denominateur
 * est fixe et qu un incident n elimine pas.
 */
export function assemblerPreScan(
  parsed: PreScanRawResponse,
  fundProfile?: FundProfile,
): Omit<PreScanOutput, 'durationMs' | 'model'> {
  // Les tests de jugement viennent du modele, les comparaisons du code.
  // L ordre d affichage est reconstitue ici et ne depend plus de la
  // discipline du modele a respecter une liste.
  const testsDeJugement = (Array.isArray(parsed.tests) ? parsed.tests : [])
    .filter(t => t && typeof t.id === 'string' && TESTS_DE_JUGEMENT.includes(t.id))
    .map(normaliserCauseDeclaree);

  const facts = normaliserFacts(parsed.dossierFacts);
  const comparaisons = evaluerComparaisons(
    facts,
    fundProfile ? profilPourComparaison(fundProfile) : null,
  );

  const parId = new Map<string, PreScanTest>();
  for (const t of testsDeJugement) parId.set(t.id, t as PreScanTest);
  for (const t of comparaisons) parId.set(t.id, t as PreScanTest);

  // Le denominateur est le nombre de tests DEMANDES. Un test que le
  // modele n a pas rendu ne disparait plus : il entre dans la liste en
  // non-production de cause incident, il pese zero au numerateur, et il
  // se voit. La forme precedente, `validatedTests.length`, faisait
  // exactement l inverse : elle transformait une defaillance en
  // avantage, puisqu un test omis ne pouvait pas echouer tout en
  // retirant une unite au denominateur.
  const attendus = ORDRE_AFFICHAGE.filter(
    id => fundProfile || !TESTS_DE_THESE.includes(id),
  );
  const validatedTests: PreScanTest[] = attendus.map(id =>
    parId.get(id) ?? testOmis(id),
  );

  const totalTests = attendus.length;

  const computedScore = validatedTests.reduce((acc, t) => {
    if (t.status === 'pass') return acc + 1;
    if (t.status === 'warn') return acc + 0.5;
    return acc;
  }, 0);

  const failedIds = validatedTests
    .filter(t => t.status === 'fail')
    .map(t => t.id);

  const nonProduits = validatedTests.filter(t => t.status === 'not_produced');
  const incidents = nonProduits.filter(t => t.nonProductionCause === 'incident');

  // Knockout sur les tests critiques :
  // - narrative, founder, thesis_fit (universels)
  // - sector_fit, geography_fit (these specifique)
  // Si un de ces cinq a fail, on force not_recommended quel que soit
  // le score brut.
  const criticalTests = ['narrative', 'founder', 'thesis_fit', 'sector_fit', 'geography_fit'];
  const criticalKnockout = failedIds.some(id => criticalTests.includes(id));

  const ratio = totalTests > 0 ? computedScore / totalTests : 0;

  // Le denominateur fixe rend le score penalisant quand un test manque,
  // ce qui est voulu. Mais une defaillance du modele ne doit pas se
  // convertir en decision doctrinale : c est la conflation que la
  // grappe 3 a fermee partout ailleurs. Un incident interdit donc
  // l elimination par le score. Le couperet critique reste, mais il ne
  // se declenche que sur un `fail` reel, jamais sur une non-production,
  // quelle que soit sa cause.
  const eliminationParScore = ratio < 0.5 && incidents.length === 0;

  let recommendation: PreScanOutput['recommendation'];
  if (criticalKnockout || eliminationParScore) {
    recommendation = 'not_recommended';
  } else if (ratio >= 0.8 && nonProduits.length === 0) {
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
    usedFundProfile: !!fundProfile,
    dossierFacts: facts,
    // Le repli tombait sur `absence`, du cote qui ne demande aucune
    // reparation : une panne dont la cause n avait pas ete posee sortait
    // en donnee manquante et ne remontait pas. Il tombe desormais du
    // cote qui accuse le pipeline plutot que le dossier, et il est
    // inerte depuis que la normalisation pose la cause a l entree. Un
    // repli qu on ne peut se permettre de laisser faux ne se choisit pas
    // par ce qui arrange, il se choisit par ce qu il coute quand il se
    // trompe.
    notProducedTests: nonProduits.map(t => ({
      id: t.id,
      cause: t.nonProductionCause ?? 'incident',
    })),
    hasProductionIncident: incidents.length > 0,
    nonProductionReason: null,
  };
}

/** Les quatre tests de fit qui n existent qu avec un profil de fonds. */
const TESTS_DE_THESE: readonly string[] = [
  'sector_fit', 'geography_fit', 'ticket_fit', 'stage_fit',
];

/** Libelles des tests attendus, pour nommer ceux que le modele a omis. */
const NOMS_ATTENDUS: Record<string, string> = {
  narrative: 'Cohérence narrative minimale',
  founder: 'Crédibilité fondateur minimale',
  financial: 'Plausibilité financière',
  stage_ticket: 'Cohérence stade vs ticket',
  market: 'Marché identifiable',
  thesis_fit: 'Pas de drapeau rouge éliminatoire',
  sector_fit: 'Thèse sectorielle',
  geography_fit: 'Thèse géographique',
  ticket_fit: 'Gamme de tickets',
  stage_fit: 'Stade investi',
};

/**
 * Range la cause de non-production d un test rendu par le modele.
 *
 * PREMIER TEMPS, CESSER D ECRASER. La forme precedente posait `null`
 * sur tous les tests du modele, ce qui cloue le canal : un test rendu
 * `not_produced` perdait sa cause avant que quiconque puisse la lire,
 * et le repli de sortie la rattrapait en `absence`, c est-a-dire du
 * cote qui ne demande aucune reparation. Une panne se presentait au
 * lecteur comme une donnee manquante, ce qui est exactement le patron
 * que le vocabulaire de non-production a ete ecrit pour fermer. La
 * valeur est desormais lue, contrainte aux trois causes, et repliee sur
 * `incident` : quand on ne sait pas, la chose reste due a quelqu un.
 *
 * SECOND TEMPS, DOCTRINE NE S ACCORDE PAS SUR DECLARATION. `incident`
 * et `absence` declarent un manque et coutent quelque chose a qui les
 * declare, puisque le fait remonte et que le test reste du. `doctrine`
 * declare que la question ne se posait pas, retire le test du
 * denominateur, et ne coute rien. Un etat gratuit qui libere d une
 * obligation est atteint par le chemin le moins couteux, et le chemin
 * le moins couteux est de le declarer. Ce n est pas une hypothese sur
 * la loyaute du modele, c est une propriete du dispositif : rien dans
 * sa sortie ne distinguerait la dispense legitime de la dispense de
 * confort. La doctrine se derive cote code, comme l archetype du moteur
 * de coherence financiere se derive de la matrice de pertinence, et
 * aucune regle du pre-scan n en derive aujourd hui. Une declaration de
 * `doctrine` est donc refusee et retombe sur `incident`.
 *
 * La declaration brute est conservee a cote de la decision plutot que
 * jetee. C est ce qui rendra mesurable, au premier run, la frequence a
 * laquelle le modele demande a etre dispense, alors qu aucun prompt ne
 * lui offre ce champ. Jeter la declaration rendrait la question
 * inposable, et une garde dont on ne peut pas mesurer le declenchement
 * ne se distingue pas d une garde inerte.
 */
function normaliserCauseDeclaree(t: PreScanTest): PreScanTest {
  const brute = (t as { nonProductionCause?: unknown }).nonProductionCause;
  const declaree = typeof brute === 'string' ? brute : null;

  // Un test qui a rendu un verdict n a pas de cause, quoi qu il en
  // dise. La cause repond a la question de savoir pourquoi rien n a ete
  // produit, et il a produit.
  if (t.status !== 'not_produced') {
    return { ...t, nonProductionCause: null, causeDeclaree: declaree };
  }

  const cause: NonProductionCauseOrNull = declaree === 'absence' || declaree === 'incident'
    ? declaree
    : 'incident';
  return { ...t, nonProductionCause: cause, causeDeclaree: declaree };
}

/**
 * Un test attendu que rien n a produit. En pratique un test de jugement
 * que le modele n a pas rendu, les comparaisons etant calculees et donc
 * toujours presentes. La cause est `incident` et non `absence` : le
 * modele devait le rendre, il ne l a pas fait, il y a a reparer.
 */
function testOmis(id: string): PreScanTest {
  return {
    id,
    name: NOMS_ATTENDUS[id] ?? id,
    status: 'not_produced',
    rationale: 'Le modele n a pas rendu ce test. Il compte dans le total demande et pese zero, sans pouvoir eliminer le dossier.',
    evidence: '',
    nonProductionCause: 'incident',
  };
}

/** Les cinq tests que le modele rend encore. */
const TESTS_DE_JUGEMENT: readonly string[] = [
  'narrative', 'founder', 'financial', 'market', 'thesis_fit',
];

/**
 * Ordre d affichage, inchange par rapport a l existant pour que la note
 * et l interface ne bougent pas : les comparaisons se glissent a la
 * place qu occupaient les tests du meme nom.
 */
const ORDRE_AFFICHAGE: readonly string[] = [
  'narrative', 'founder', 'financial', 'stage_ticket', 'market', 'thesis_fit',
  'sector_fit', 'geography_fit', 'ticket_fit', 'stage_fit',
];

/**
 * Un fait absent, mal type ou sans citation devient un fait vide. La
 * normalisation est faite ici plutot que dans les comparaisons pour que
 * celles-ci restent lisibles comme des regles et non comme des gardes.
 */
function normaliserFacts(brut: any): DossierFacts {
  const lire = <T,>(cle: string, type: 'string' | 'number'): DossierFact<T> => {
    const f = brut && typeof brut === 'object' ? brut[cle] : null;
    if (!f || typeof f !== 'object') return { value: null, evidence: null };
    const v = f.value;
    const ok = type === 'number'
      ? typeof v === 'number' && Number.isFinite(v)
      : typeof v === 'string' && v.trim().length > 0;
    const e = typeof f.evidence === 'string' && f.evidence.trim().length > 0
      ? f.evidence.trim() : null;
    return { value: ok ? (v as T) : null, evidence: e };
  };
  return {
    companyName: lire<string>('companyName', 'string'),
    sector: lire<string>('sector', 'string'),
    geography: lire<string>('geography', 'string'),
    stage: lire<string>('stage', 'string'),
    ticketEur: lire<number>('ticketEur', 'number'),
  };
}

function profilPourComparaison(p: FundProfile): FitProfile {
  return {
    sectorsFocus: p.sectorsFocus ?? [],
    sectorsExcluded: p.sectorsExcluded ?? [],
    geographiesFocus: p.geographiesFocus ?? [],
    geographiesExcluded: p.geographiesExcluded ?? [],
    ticketMinEur: p.ticketMinEur ?? null,
    ticketMaxEur: p.ticketMaxEur ?? null,
    stagesFocus: p.stagesFocus ?? [],
  };
}
