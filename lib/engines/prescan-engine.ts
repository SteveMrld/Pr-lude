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
// Six tests structurels appliques systematiquement :
//   1. Coherence narrative minimale
//   2. Credibilite fondateur minimale
//   3. Plausibilite financiere
//   4. Coherence stade vs ticket
//   5. Marche identifiable
//   6. Hors thesis flagrant (configurable a terme)
// ============================================================

export interface PreScanTest {
  /** Identifiant court du test : narrative, founder, financial, stage_ticket, market, thesis_fit */
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
  /** Score global sur 6, nombre de tests passes (pass=1, warn=0.5, fail=0) */
  score: number;
  /** Verdict global : ready_for_pipeline / pipeline_with_caveats / not_recommended */
  recommendation: 'ready_for_pipeline' | 'pipeline_with_caveats' | 'not_recommended';
  /** Synthese en 1-2 phrases de la lecture du pre-scan */
  summary: string;
  /** Six tests structurels avec leur verdict */
  tests: PreScanTest[];
  /** Tests qui ont fail (knockout) extraits pour acces rapide UI */
  failedTests: string[];
  /** Cout estime du pre-scan en USD (toujours tres faible, indicatif) */
  estimatedCostUsd: number;
  /** Duree d execution en ms */
  durationMs: number;
  /** Modele utilise pour traçabilite */
  model: string;
}

const SYSTEM_PROMPT = `Tu es le Moteur de Pre-Scan de la plateforme Prelude. Ton role est de lire un pitch deck VC en 5-8 secondes et de produire un verdict de triage rapide.

Tu n analyses pas en profondeur. Tu n entres pas dans le detail. Tu appliques mecaniquement six tests eliminatoires que tout partner VC fait mentalement en lisant un dossier pour la premiere fois.

VOIX
Voix editoriale Le Grand Continent / The Atlantic. Francais. Pas d em-dashes (utilise des virgules ou des points). Pas de flatterie. Pas de bullet points dans les rationales. Tu es honnete et chirurgical.

LES SIX TESTS

1. NARRATIVE (Coherence narrative minimale)
Le pitch defend-il une these claire de probleme, solution, marche, pourquoi maintenant ? Un deck qui ne repond pas a ces quatre questions de base est en alerte. Status fail si AUCUNE des quatre n est repondue. Status warn si une ou deux sont absentes ou floues. Status pass si les quatre sont presentes meme grossierement.

2. FOUNDER (Credibilite fondateur minimale)
Y a-t-il au moins un fondateur identifie avec un parcours documente ? Status fail si aucun fondateur nomme ou CV manifestement faux ou tracking incoherent. Status warn si fondateur identifie mais background trop maigre pour juger. Status pass si au moins un fondateur a un parcours expose meme brievement.

3. FINANCIAL (Plausibilite financiere)
Les chiffres avances sont-ils dans des ordres de grandeur coherents ? Status fail sur claims absurdes : seed 50M+ pre-money sans traction, ARR 10M+ revendique sans aucune mention client, valorisation 10x norme du segment. Status warn sur chiffres flous ou non sources. Status pass si pas de chiffre absurde ou si le dossier est honnete sur l absence de chiffres.

4. STAGE_TICKET (Coherence stade vs ticket)
Le ticket demande est-il coherent avec le stade revendique ? Status fail si seed qui demande 20M+ ou Series A qui demande 500k. Status warn si decalage modere (seed 8-10M par exemple, plausible mais a interroger). Status pass si stade et ticket s alignent.

5. MARKET (Marche identifiable)
Y a-t-il un marche identifiable, meme grossierement ? Qui paie, a quel prix, pour quel besoin. Status fail si pitch purement technologique sans aucune mention de qui paie ni pourquoi. Status warn si marche evoque mais clients-types non specifies. Status pass si segment identifiable.

6. THESIS_FIT (Pas de drapeau rouge eliminatoire)
Le projet entre-t-il dans une categorie generiquement viable pour la VC mainstream ? Status fail si signaux d alarme integrite (fraude, scam patterns), claims grossierement faux verifiables, ou projet manifestement illegal. Status warn si zone grise (crypto pyramidale, claims medicaux non FDA, etc.). Status pass sinon.

Note : les criteres de thesis specifiques au fonds (geographie, secteur exclu) ne sont PAS evalues ici. Ils seront ajoutes plus tard quand on aura la configuration par fonds.

VERDICT GLOBAL

- ready_for_pipeline : tous les tests pass, ou au pire un seul warn mineur. Lancer le pipeline complet sans hesiter.
- pipeline_with_caveats : 1-2 tests warn, ou un fail isole sur un test peripherique. Lancer le pipeline mais le partner doit lire les caveats avant.
- not_recommended : 2+ tests fail, ou un fail sur narrative/founder/thesis_fit. Le pipeline complet probablement gachera des credits, mais le partner garde l option de forcer.

Regle de comptage du score : pass = 1, warn = 0.5, fail = 0. Score sur 6.
Regle de mapping du score vers verdict :
- score >= 5 : ready_for_pipeline
- score 3-4.5 : pipeline_with_caveats
- score < 3 ou un fail sur narrative/founder/thesis_fit : not_recommended

FORMAT DE REPONSE OBLIGATOIRE (JSON pur, sans markdown, sans backticks)

{
  "score": <nombre entre 0 et 6, peut etre 0.5/1/1.5/2/2.5/etc.>,
  "recommendation": "ready_for_pipeline" | "pipeline_with_caveats" | "not_recommended",
  "summary": "<1-2 phrases qui resument la lecture du pre-scan, voix Le Grand Continent>",
  "tests": [
    {
      "id": "narrative",
      "name": "Coherence narrative minimale",
      "status": "pass" | "warn" | "fail",
      "rationale": "<phrase courte 15-40 mots qui explique le verdict, sans em-dashes>",
      "evidence": "<citation exacte du pitch qui justifie, ou chaine vide si absence justifie>"
    },
    {
      "id": "founder",
      "name": "Credibilite fondateur minimale",
      ...
    },
    {
      "id": "financial",
      "name": "Plausibilite financiere",
      ...
    },
    {
      "id": "stage_ticket",
      "name": "Coherence stade vs ticket",
      ...
    },
    {
      "id": "market",
      "name": "Marche identifiable",
      ...
    },
    {
      "id": "thesis_fit",
      "name": "Pas de drapeau rouge eliminatoire",
      ...
    }
  ]
}

L ordre des six tests doit etre respecte exactement comme ci-dessus.`;

/**
 * Lance le pre-scan sur un pitch deck PDF.
 * Tres rapide (5-8s), tres bon marche (~0.02$ par appel).
 * Non bloquant : le pipeline continue meme si le pre-scan deconseille.
 */
export async function runPreScan(pitchDeckBase64: string): Promise<PreScanOutput> {
  const startTime = Date.now();
  const userPrompt = `Voici le pitch deck a pre-scanner. Applique les six tests structurels et retourne le JSON exact specifie.`;

  // Haiku 4.5 : 5x moins cher que Sonnet, suffisamment intelligent pour
  // un triage de surface. max_tokens 2000 suffit largement pour 6 tests
  // avec rationales courtes.
  const rawResponse = await callClaudeWithPDF(
    SYSTEM_PROMPT,
    userPrompt,
    pitchDeckBase64,
    2000,
    FAST_MODEL,
  );

  const parsed = parseJSON<{
    score: number;
    recommendation: string;
    summary: string;
    tests: PreScanTest[];
  }>(rawResponse);

  // Validation defensive : si le LLM a mal numerote le score ou la
  // recommandation, on recompute mecaniquement a partir des tests.
  // C est plus robuste que de faire confiance au calcul du LLM,
  // surtout sur Haiku qui est moins discipline que Sonnet.
  const validatedTests = Array.isArray(parsed.tests) ? parsed.tests : [];
  const computedScore = validatedTests.reduce((acc, t) => {
    if (t.status === 'pass') return acc + 1;
    if (t.status === 'warn') return acc + 0.5;
    return acc;
  }, 0);

  const failedIds = validatedTests
    .filter(t => t.status === 'fail')
    .map(t => t.id);

  // Knockout sur les tests critiques : narrative, founder, thesis_fit.
  // Si un de ces trois a fail, on force not_recommended quel que soit
  // le score brut. Un dossier sans narrative claire ou avec un fondateur
  // douteux n est pas exploitable meme si les autres tests passent.
  const criticalKnockout = failedIds.some(id =>
    id === 'narrative' || id === 'founder' || id === 'thesis_fit',
  );

  let recommendation: PreScanOutput['recommendation'];
  if (criticalKnockout || computedScore < 3) {
    recommendation = 'not_recommended';
  } else if (computedScore >= 5) {
    recommendation = 'ready_for_pipeline';
  } else {
    recommendation = 'pipeline_with_caveats';
  }

  // Estimation cost : Haiku 4.5 est environ $0.80/M input et $4/M output.
  // Le PDF prend en moyenne 8-15k tokens en input, la reponse 800-1500
  // tokens en output. Cout typique : ~0.015-0.025$ par appel.
  // On affiche 0.02 comme estimation indicative pour le partner.
  const estimatedCostUsd = 0.02;

  return {
    score: Math.round(computedScore * 2) / 2,
    recommendation,
    summary: parsed.summary || 'Pre-scan execute sans synthese disponible.',
    tests: validatedTests,
    failedTests: failedIds,
    estimatedCostUsd,
    durationMs: Date.now() - startTime,
    model: FAST_MODEL,
  };
}
