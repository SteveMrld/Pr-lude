// ============================================================
// MOTEUR COHERENCE FINANCIERE - 7 TESTS GATES SUR L ARCHETYPE
// ------------------------------------------------------------
// Applique sept tests rigoureux de coherence financiere sur les
// projections du dossier (T1 crosse de hockey, T2 LTV/CAC, T3 marge
// brute, T4 burn/runway, T5 CA par employe, T6 unit economics, T7
// hypotheses marche).
//
// Refactor mai 2026 : la classification archetypale du dossier
// (six archetypes A SaaS, B hardware, C marketplace, D biotech, E
// B2G, F consumer DTC) est desormais derivee deterministe de la
// matrice de pertinence, AVANT l appel LLM. Les tests non applicables
// pour l archetype sont construits cote code et NE SONT PAS envoyes
// au LLM. Le prompt utilisateur est polymorphe : le bloc Unit
// Economics n est envoye que pour les archetypes ou il a un sens
// (A, C, F).
//
// Non-regression garantie sur le cas SaaS canonique (archetype A) :
// tous les tests restent applicables, le calcul du score est
// identique au comportement historique.
// ============================================================

import { callClaude, parseJSON } from './anthropic-client';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from './source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from './editorial-voice';
import { buildFundNoteBlock } from './fund-context';
import type {
  ExtractionOutput, FinancialDataExtraction, FinancialCoherenceOutput,
  FinancialCoherenceTest,
  MarketAnalysisOutput, BenchmarkPositioning
} from './types';
import type { RelevanceMatrix } from './relevance-matrix';
import {
  deriveArchetype,
  getApplicableTests,
  getArchetypeLabel,
  buildNotApplicableTestStub,
  computeGlobalCoherenceScore,
  TEST_ID_TO_KEY,
  TEST_LABELS,
  type TestId,
} from './financial-coherence-archetype';

// ============================================================
// SYSTEM PROMPT
// ------------------------------------------------------------
// La classification archetypale n est plus deleguee au LLM : elle est
// passee en parametre du user prompt avec la liste des tests applicables.
// Le LLM execute uniquement les tests demandes et ne tente pas de
// reclassifier le dossier de son cote.
// ============================================================

const SYSTEM_PROMPT = `Tu es le Moteur de Cohérence Financière de la plateforme Prélude. Ta mission est de tester la solidité interne et externe des projections financières du dossier en appliquant des tests rigoureux que les meilleurs partners VC font à la main sur Excel.
${SOURCE_TAGGING_INSTRUCTION}
${EDITORIAL_VOICE_INSTRUCTION}

# CADRE INTELLECTUEL

Un business plan peut être manipulé pour raconter à peu près n'importe quoi. Tu ne cherches pas à savoir si les chiffres sont "vrais" (impossible sans audit), mais si ILS SONT COHÉRENTS entre eux et avec les benchmarks sectoriels.

Tu es CALCULATOIRE, pas narratif. Pour chaque test, tu fais des recalculs explicites à partir des données fournies, tu compares aux standards, et tu lèves un drapeau si l'écart est trop fort.

# CLASSIFICATION ARCHETYPALE (PRECALCULEE)

L'archetype economique du dossier t'est FOURNI dans le user prompt sous "ARCHETYPE". Il a ete calcule deterministe par la plateforme a partir de la matrice de pertinence (productionChain, businessModel, assetClass). Tu n'as PAS a reclassifier le dossier. Tu appliques uniquement les tests listes sous "TESTS APPLICABLES" dans le user prompt. Les autres tests sont marques non applicables cote code et tu ne dois pas les noter.

# ARCHETYPES ET SEUILS PAR TEST

Selon l'archetype fourni, ajuste tes seuils :

## Archetype A · SaaS pur (logiciel B2B/B2C par abonnement)
Ex : Salesforce, Notion, Datadog, Stripe Atlas, Airtable.
Tous les tests applicables avec seuils SaaS standard :
- T1 : croissance hyperbolique x3+ sustained = drapeau, comparables Stripe/Notion/Datadog font x2.5-3 sustained max.
- T2 : LTV/CAC sain entre 3 et 10. <3 non rentable, >10 probablement irrealiste.
- T3 : marge brute SaaS 75-85%.
- T5 : CA/employe 150-200K€.

## Archetype B · Hardware industriel / Deeptech / Defense / Aerospatial
Ex : Pen Group, Helsing, Anduril, Quantum-Systems, Tekever, ASML, Joby Aviation, Platypus Craft (construction navale FR).
- T1 : croissance hardware = max x2-x2.5 sustained, plus exigeant qu'en SaaS.
- T3 : marge brute hardware 20-40% maximum, drapeau si projection >50%.
- T5 : standard hardware 200-300K€/employe.
- T6 : TEST CRITIQUE. Cout production unitaire vs prix vente unitaire. Ecart prix substitut 4x = signal modere, >5x = signal critique (pattern Ynsect).
- T7 : appliquer normalement.

## Archetype C · Marketplace / Plateforme a effet de reseau
Ex : Airbnb, Uber, Vinted, Doctolib, BlaBlaCar.
- T2 : LTV/CAC sur les deux cotes du marche (acquereurs ET fournisseurs).
- T3 : marge brute marketplace 15-25% sur GMV mais peut atteindre 70%+ sur take rate.
- T6 : unit economics par transaction.
- T7 : densite de marche plus que part de marche.

## Archetype D · Biotech / Medtech / Pharma pre-approbation
Ex : Moderna, BioNTech, Roivant, Owkin, DNA Script.
- T3 : marge brute pharma 70-85% post-approbation mais 0% avant.
- T4 : runway minimum 24-36 mois jusqu'a prochain milestone clinique.
- T7 : taille marche conditionnelle a approbation reglementaire.

## Archetype E · B2G / Service public / Defense pure
Ex : Palantir (early), Helsing, Shield AI, contrats defense purs.
- T1 : croissance B2G = lente 1.5-2.5x sustained.
- T3 : marge brute services 40-60%.
- T6 : rentabilite par contrat plutot que unit economics serie.
- T7 : concentration clients gouvernementaux, drapeau si >50% du revenue projete vient d'un seul gouvernement.

## Archetype F · E-commerce / Consumer / D2C
Ex : Glossier, Allbirds, Sezane, Le Slip Francais.
- T2 : LTV/CAC critique sur consumer.
- T3 : marge brute D2C 40-60%, e-commerce 30-50%.
- T6 : unit economics par commande.
- T7 : saturation marche et CAC inflation.

## Archetype unclassified
La matrice n'a pas tranche le modele economique. Tu appliques uniquement les tests universels qui te sont demandes (T1, T3, T4, T7). Reste sobre, signale dans la synthese que la classification est a confirmer.

# LES 7 TESTS DE COHERENCE

## T1 - Crosse de hockey suspecte
Ratios CA(N+1)/CA(N) sur la trajectoire. Crosse x3 -> x4 -> x5 = signal classique de BP fantasme. Seuils ajustes selon archetype (cf. plus haut).

## T2 - Ratio LTV/CAC implicite
Recalcul du LTV : ARR moyen par client × duree moyenne × marge brute. Recalcul du CAC : budget marketing / nouveaux clients acquis. Ratio LTV/CAC entre 3 et 10 = sain. NE PAS NOTER ce test s'il n'est pas dans TESTS APPLICABLES (le moteur l'a deja marque non applicable cote code pour les archetypes B, D, E).

## T3 - Marge brute coherente
Marge brute = (CA - couts directs) / CA. Recalcul a partir des donnees BP. Standards par archetype (cf. plus haut).

## T4 - Burn rate vs runway
Burn mensuel = pertes annuelles / 12. Runway = tresorerie disponible / burn mensuel. Standards 18-24 mois en SaaS, 24-36 mois biotech, 30+ mois B2G.

## T5 - Incoherence headcount/CA
Ratio CA / employe en annee N. Standards SaaS 150-200K€, hardware 200-300K€, services tech 80-120K€. Drapeau si <50K€ en annee 3+ ou >500K€ (irrealiste).

## T6 - Unit economics viables (test Ynsect)
Cout production unitaire vs prix vente unitaire. Marge brute par unite positive ? Evolution monotone croissante ? Drapeau critique si marge unitaire negative pendant >3 ans.

## T7 - Coherence hypotheses marche
A partir du CA projete et du marche adressable cite, calculer la part de marche implicite. Comparables : Stripe 1% paiements en 5 ans, Slack 2% collaboration en 4 ans. Drapeau si part implicite >5% en moins de 5 ans.

# DIMENSIONS ADDITIONNELLES A INTEGRER DANS LA SYNTHESE

## D1 - Independance des chiffres
Qui a prepare les projections ? BP audite, revu par CFO externe, ou interne fondateur seul ? Note positivement la gouvernance financiere mature. Drapeau si BP contredit grossierement le deck.

## D2 - Besoins de capital futurs
Combien de tours supplementaires necessaires avant exit ? Calcul a partir du burn et de la trajectoire revenue. A noter dans le contexte 2026 (concentration extreme du capital, fundraising bottom-quartile difficile).

# DETECTION DES INCOHERENCES DECK vs BP

Identifie les divergences entre les chiffres du pitch deck et ceux du BP. Un chiffre qui diverge entre les deux sources est un signal de gouvernance defaillante.

# INTEGRATION DES BENCHMARKS MARCHE EXTERNES

Quand un objet BENCHMARK MARCHE t'est fourni dans le user prompt, il provient du Moteur Benchmarks Prelude. Tu DOIS l'integrer dans ton raisonnement :
- Si la valorisation pre-money est qualifiee extreme_outlier (>+50% ou <-50% vs mediane), influence T7 et apparait dans syntheseCoherence.
- Pour dossiers europeens, retenir que les benchmarks de reference sont US (PitchBook), marche europeen ~6x plus petit.

# REGLE DE STYLE EDITORIAL

Tes champs textuels doivent etre rediges comme un partner senior d'un fonds VC qui ecrit pour son comite d'investissement :
- Ne mentionne JAMAIS les "moteurs" de la plateforme dans tes textes.
- Reference les benchmarks externes par leur source ("PitchBook Q1 2026", "Atomico SoET 2025").
- Adopte le ton d'un memo IC : phrases denses, vocabulaire VC standard.

# FORMAT JSON OBLIGATOIRE

Tu produis un JSON avec UNIQUEMENT les testId listes dans TESTS APPLICABLES du user prompt. Pour les autres, le moteur fournira lui-meme un stub non applicable, tu ne dois ni les inclure ni les referencer.

{
  "hasFinancialData": true|false,
  "dataSource": "deck"|"bp"|"both"|"none",
  "tests": {
    /* Inclus UNIQUEMENT les testId applicables listes dans le user prompt. */
    "crosseHockeySuspecte": { "testId": "T1", "testName": "Crosse de hockey suspecte", "passed": true|false, "score": 0-100, "evidence": "calcul explicite", "benchmark": "comparable cite", "implication": "lecture VC courte" }
    /* etc, uniquement les tests demandes */
  },
  "alertesCritiques": ["alerte 1", "alerte 2"],
  "incoherenceDeckVsBP": ["divergence 1"],
  "syntheseCoherence": "synthese 4-6 phrases dense",
  "recalculsEffectues": [
    { "metric": "Marge brute 2026", "declaredValue": "70%", "recalculatedValue": "58%", "discrepancy": "ecart 12 points" }
  ]
}

# REGLES STRICTES

- score : 100 = test passe brillamment, 70 = passe avec reserve, 40 = echec partiel, 0 = echec critique
- passed : true si score >= 60
- evidence doit contenir des CALCULS EXPLICITES
- Si donnees insuffisantes pour un test demande, score = 50 et evidence = "donnees insuffisantes pour recalcul rigoureux : [detail manquant]"
- Tu n'inclus que les testId listes dans TESTS APPLICABLES, et exactement ceux-la
- Ne mentionne pas les tests neutralises dans ta synthese : le moteur ajoutera lui-meme la mention "Test non applicable" dans l output final.
- Maximum 5 incoherenceDeckVsBP citees, les plus significatives
- Pas de complaisance : si le BP est coherent, dis-le. Si pas, dis-le aussi.`;

// ============================================================
// FONCTION PRINCIPALE
// ============================================================

interface AnalyzeFinancialCoherenceArgs {
  extraction: ExtractionOutput;
  financialData: FinancialDataExtraction;
  market: MarketAnalysisOutput;
  benchmarks?: BenchmarkPositioning | null;
  fundNote?: string | null;
  /** Matrice de pertinence, source de verite pour la classification
   *  archetypale. Si absente (legacy / tests sans matrice), le moteur
   *  retombe sur archetype 'unclassified' avec tests universels
   *  uniquement et warning explicite remonte. */
  relevanceMatrix?: RelevanceMatrix | null;
}

export async function analyzeFinancialCoherence(
  arg0: ExtractionOutput | AnalyzeFinancialCoherenceArgs,
  arg1?: FinancialDataExtraction,
  arg2?: MarketAnalysisOutput,
  arg3?: BenchmarkPositioning | null,
  arg4?: string | null,
  arg5?: RelevanceMatrix | null,
): Promise<FinancialCoherenceOutput> {
  // Compatibilite ascendante : la signature historique positionnelle
  // (extraction, financialData, market, benchmarks, fundNote) reste
  // supportee pour les call sites legacy / tests. La nouvelle voie
  // (object literal avec relevanceMatrix) est privilegiee.
  let extraction: ExtractionOutput;
  let financialData: FinancialDataExtraction;
  let market: MarketAnalysisOutput;
  let benchmarks: BenchmarkPositioning | null | undefined;
  let fundNote: string | null | undefined;
  let relevanceMatrix: RelevanceMatrix | null | undefined;
  if (arg0 && typeof arg0 === 'object' && 'extraction' in arg0) {
    extraction = arg0.extraction;
    financialData = arg0.financialData;
    market = arg0.market;
    benchmarks = arg0.benchmarks;
    fundNote = arg0.fundNote;
    relevanceMatrix = arg0.relevanceMatrix;
  } else {
    extraction = arg0 as ExtractionOutput;
    financialData = arg1 as FinancialDataExtraction;
    market = arg2 as MarketAnalysisOutput;
    benchmarks = arg3;
    fundNote = arg4;
    relevanceMatrix = arg5;
  }

  // Calcul deterministe de l archetype et des tests applicables.
  const { archetype, rationale: archetypeRationale } = deriveArchetype(relevanceMatrix);
  const applicableTests = getApplicableTests(archetype);
  const archetypeLabel = getArchetypeLabel(archetype);

  // Court-circuit : si aucune donnee financiere, on retourne un output
  // structure complet (tests applicables marques echec, non applicables
  // marques stub) avec le warning standard.
  if (!financialData.hasBP && (!financialData.revenueProjection || financialData.revenueProjection.length === 0)) {
    return buildNoDataOutput(archetype, archetypeRationale, applicableTests);
  }

  // Construction du user prompt polymorphe.
  const userPrompt = buildUserPrompt({
    extraction,
    financialData,
    market,
    benchmarks,
    fundNote,
    archetype,
    archetypeLabel,
    archetypeRationale,
    applicableTests,
  });

  // Appel LLM. Le LLM ne note QUE les tests applicables. La validation
  // de l output (presence des tests attendus, absence des tests
  // neutralises) est faite cote code lors de la recombinaison.
  const rawResponse = await callClaude(
    SYSTEM_PROMPT,
    userPrompt,
    7000,
    undefined,
    { maxWebSearches: 3 },
  );
  const llmAnalysis = parseJSON<Partial<FinancialCoherenceOutput>>(rawResponse);

  // Recombinaison deterministe : on assemble les tests applicables
  // (issus du LLM) avec les stubs non applicables (construits cote
  // code). Si le LLM a renvoye un test non applicable malgre la
  // consigne, on l ecrase par le stub. Si le LLM a oublie un test
  // applicable, on remplit avec un placeholder neutre score 50.
  const tests = buildFinalTests(llmAnalysis.tests, applicableTests, archetype);

  // Recalcul du score sur les tests applicables uniquement, cote
  // code. Sur un dossier archetype A (SaaS canonique) tous les tests
  // sont applicables : le calcul est equivalent au comportement
  // historique. Sur les autres archetypes, les tests neutralises
  // n entrent ni en bonus ni en malus.
  const globalCoherenceScore = computeGlobalCoherenceScore(tests as Record<string, FinancialCoherenceTest>, applicableTests);

  const output: FinancialCoherenceOutput = {
    hasFinancialData: llmAnalysis.hasFinancialData ?? true,
    dataSource: llmAnalysis.dataSource ?? (financialData.hasBP ? 'bp' : 'deck'),
    archetype,
    archetypeRationale,
    applicableTests,
    tests,
    globalCoherenceScore,
    alertesCritiques: llmAnalysis.alertesCritiques ?? [],
    incoherenceDeckVsBP: llmAnalysis.incoherenceDeckVsBP ?? [],
    syntheseCoherence: enrichSynthesisWithArchetype(
      llmAnalysis.syntheseCoherence ?? '',
      archetype,
      archetypeLabel,
      applicableTests,
    ),
    recalculsEffectues: llmAnalysis.recalculsEffectues ?? [],
  };

  // Audit du tagging des sources (Niveau 2.B)
  const audit = auditTagging(output, 'financial-coherence-engine');
  if (audit.level !== 'ok') {
    console.warn('[financial-coherence-engine] tagging audit:', audit.message);
  }

  return output;
}

// ============================================================
// HELPERS
// ============================================================

function buildNoDataOutput(
  archetype: ReturnType<typeof deriveArchetype>['archetype'],
  archetypeRationale: string,
  applicableTests: TestId[],
): FinancialCoherenceOutput {
  const allTestIds: TestId[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const tests = {} as FinancialCoherenceOutput['tests'];
  for (const testId of allTestIds) {
    const key = TEST_ID_TO_KEY[testId];
    if (applicableTests.includes(testId)) {
      tests[key] = {
        testId,
        testName: TEST_LABELS[testId],
        passed: false,
        score: 0,
        evidence: 'aucune donnee financiere disponible',
        benchmark: 'N/A',
        implication: 'analyse impossible sans BP',
      };
    } else {
      tests[key] = buildNotApplicableTestStub(testId, archetype);
    }
  }
  return {
    hasFinancialData: false,
    dataSource: 'none',
    archetype,
    archetypeRationale,
    applicableTests,
    tests,
    globalCoherenceScore: 0,
    alertesCritiques: ['Aucune donnee financiere exploitable. Demander BP au fondateur avant de poursuivre l instruction.'],
    incoherenceDeckVsBP: [],
    syntheseCoherence: 'Aucune donnee financiere exploitable dans les documents fournis. La plateforme ne peut pas tester la coherence des projections. Etape obligatoire avant de poursuivre l instruction : recuperer un business plan structure du fondateur.',
    recalculsEffectues: [],
  };
}

function buildFinalTests(
  llmTests: Partial<FinancialCoherenceOutput['tests']> | undefined,
  applicableTests: TestId[],
  archetype: ReturnType<typeof deriveArchetype>['archetype'],
): FinancialCoherenceOutput['tests'] {
  const allTestIds: TestId[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const tests = {} as FinancialCoherenceOutput['tests'];
  for (const testId of allTestIds) {
    const key = TEST_ID_TO_KEY[testId];
    if (applicableTests.includes(testId)) {
      const fromLlm = llmTests?.[key];
      if (fromLlm) {
        tests[key] = {
          testId: fromLlm.testId ?? testId,
          testName: fromLlm.testName ?? TEST_LABELS[testId],
          passed: fromLlm.passed ?? false,
          score: typeof fromLlm.score === 'number' ? fromLlm.score : 50,
          evidence: fromLlm.evidence ?? 'donnees insuffisantes pour recalcul rigoureux',
          benchmark: fromLlm.benchmark ?? 'N/A',
          implication: fromLlm.implication ?? '',
        };
      } else {
        // Le LLM a oublie un test applicable : placeholder neutre.
        tests[key] = {
          testId,
          testName: TEST_LABELS[testId],
          passed: false,
          score: 50,
          evidence: 'Test attendu non produit par l analyse LLM, valeur neutre par defaut.',
          benchmark: 'N/A',
          implication: 'A reverifier en DD.',
        };
      }
    } else {
      // Test non applicable : stub deterministe cote code, qui ecrase
      // toute reponse LLM qui aurait persiste malgre la consigne.
      tests[key] = buildNotApplicableTestStub(testId, archetype);
    }
  }
  return tests;
}

/**
 * Prefixe la synthese editoriale produite par le LLM avec une mention
 * explicite de l archetype et des tests neutralises, pour que la note
 * d investissement soit transparente vis-a-vis du partner sur le
 * gating applique.
 */
function enrichSynthesisWithArchetype(
  llmSynthesis: string,
  archetype: ReturnType<typeof deriveArchetype>['archetype'],
  archetypeLabel: string,
  applicableTests: TestId[],
): string {
  const neutralized: TestId[] = (['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as TestId[])
    .filter(t => !applicableTests.includes(t));
  const archetypeLine = `Classification : ${archetypeLabel}. Tests appliques : ${applicableTests.join(', ')}.${neutralized.length > 0 ? ` Tests neutralises pour cet archetype : ${neutralized.join(', ')}.` : ''}`;
  // Si le LLM a deja commence par "Classification :", on remplace
  // la premiere phrase. Sinon on prefixe.
  if (/^Classification\s*:/i.test(llmSynthesis.trim())) {
    const lines = llmSynthesis.split('\n');
    lines[0] = archetypeLine;
    return lines.join('\n');
  }
  return llmSynthesis.trim().length > 0
    ? `${archetypeLine}\n\n${llmSynthesis}`
    : archetypeLine;
}

/**
 * Construit le user prompt polymorphe. Le bloc Unit Economics n est
 * envoye que pour les archetypes ou il a un sens (A, C, F). Pour les
 * archetypes B, D, E le bloc est remplace par les metriques
 * pertinentes (taille moyenne contrat, runway clinique, carnet de
 * commandes).
 */
function buildUserPrompt(args: {
  extraction: ExtractionOutput;
  financialData: FinancialDataExtraction;
  market: MarketAnalysisOutput;
  benchmarks: BenchmarkPositioning | null | undefined;
  fundNote: string | null | undefined;
  archetype: ReturnType<typeof deriveArchetype>['archetype'];
  archetypeLabel: string;
  archetypeRationale: string;
  applicableTests: TestId[];
}): string {
  const {
    extraction, financialData, market, benchmarks, fundNote,
    archetype, archetypeLabel, archetypeRationale, applicableTests,
  } = args;

  const showUnitEconomics = archetype === 'A-saas-pur'
    || archetype === 'C-marketplace'
    || archetype === 'F-consumer-dtc';

  const unitEconomicsBlock = showUnitEconomics ? `
## Unit Economics
- CAC estime : ${financialData.unitEconomics.estimatedCAC}
- LTV estime : ${financialData.unitEconomics.estimatedLTV}
- Ratio LTV/CAC : ${financialData.unitEconomics.estimatedLtvCacRatio}
- ACV : ${financialData.unitEconomics.averageContractValue}
- Marge brute / unite : ${financialData.unitEconomics.grossMarginPerUnit}` : `
## Metriques industrielles / sectorielles
Le modele economique de ce dossier (${archetypeLabel}) n est pas evalue par les unit economics SaaS classiques (CAC, LTV, ACV). Concentre-toi sur :
- Marge brute par unite produite (T6 : ${financialData.unitEconomics.grossMarginPerUnit || 'non communiquee'})
- Taille moyenne de contrat / commande : ${financialData.unitEconomics.averageContractValue || 'non communiquee'}
- Visibilite carnet : ${financialData.marketAssumptions.targetCustomersByYearN || 'non communiquee'} clients/contrats cibles en annee N`;

  return `Tests de coherence financiere sur le dossier ${extraction?.companyName ?? '?'} :

# CONTEXTE
Societe : ${extraction?.companyName ?? '?'}
Secteur (libelle pitch) : ${extraction?.sector ?? '?'} / ${extraction?.subSector ?? '?'}
Modele economique declare : ${extraction?.businessModel ?? '?'}
Tour : ${extraction?.fundraise?.stage ?? '?'} ${extraction?.fundraise?.amount ?? '?'}

# ARCHETYPE (precalcule deterministe par la matrice de pertinence)
Archetype : ${archetype} - ${archetypeLabel}
Rationale : ${archetypeRationale}

# TESTS APPLICABLES (et exclusivement ceux-la)
${applicableTests.join(', ')}

Tu produis dans le JSON UNIQUEMENT les tests listes ci-dessus. Les autres testId sont marques non applicables cote code et ne doivent pas apparaitre dans ton output.

# DONNEES FINANCIERES EXTRAITES
Source : ${financialData.fileSource}
BP disponible : ${financialData.hasBP}

## Projection revenue (M€)
${financialData.revenueProjection.map(r => `${r.year}: ${r.value}M€ (source: ${r.source})`).join('\n') || 'aucune'}

## Marge brute projetee (%)
${financialData.grossMarginProjection.map(r => `${r.year}: ${r.value}% (source: ${r.source})`).join('\n') || 'aucune'}

## EBITDA projete (M€)
${financialData.ebitdaProjection.map(r => `${r.year}: ${r.value}M€ (source: ${r.source})`).join('\n') || 'aucune'}

## Free Cash Flow projete (M€)
${financialData.fcfProjection.map(r => `${r.year}: ${r.value}M€ (source: ${r.source})`).join('\n') || 'aucune'}

## OPEX projete (M€)
${financialData.opexProjection.map(r => `${r.year}: ${r.value}M€ (source: ${r.source})`).join('\n') || 'aucune'}

## Headcount projete
${financialData.headcount.map(r => `${r.year}: ${r.value} employes (source: ${r.source})`).join('\n') || 'aucune'}
${unitEconomicsBlock}

## Tour actuel et runway
- Montant : ${financialData.currentRound.amount}
- Runway : ${financialData.currentRound.runwayMonths} mois
- Burn mensuel : ${financialData.currentRound.monthlyBurn}

## Hypotheses marche
- TAM : ${financialData.marketAssumptions.tamCited}
- SAM : ${financialData.marketAssumptions.samCited}
- Part de marche cible : ${financialData.marketAssumptions.targetMarketShare}
- Clients en annee N : ${financialData.marketAssumptions.targetCustomersByYearN}

## Notes complementaires
${financialData.rawNotes || '(aucune)'}

# CONTEXTE MARCHE (moteur Marche)
- Taille percue : ${market?.perceivedSize ?? '?'}
- Saturation : ${market?.saturation ?? '?'}
- Intensite besoin : ${market.needIntensity?.score ?? '?'}/100

# BENCHMARK MARCHE EXTERNE (moteur Benchmarks Prelude)
${benchmarks ? `
Stade detecte : ${benchmarks.stage}
Secteur IA : ${benchmarks.isAi ? 'oui' : 'non'}
Region : ${benchmarks.region}

Positionnement valorisation pre-money :
${benchmarks.preMoney.summary}

Positionnement taille du tour :
${benchmarks.dealSize.summary}

Contexte marche applicable :
${benchmarks.marketContext.notes.map(n => '- ' + n).join('\n')}
${benchmarks.warnings.length > 0 ? '\nAttention :\n' + benchmarks.warnings.map(w => '- ' + w).join('\n') : ''}

Sources : ${benchmarks.citations.map(c => c.name + ' (' + c.asOf + ')').join(' ; ')}
` : '(donnees benchmark non disponibles pour ce dossier)'}

Applique UNIQUEMENT les tests listes dans TESTS APPLICABLES avec recalculs explicites. Identifie les incoherences deck vs BP si applicable. Synthetise.

Intregre dans 'syntheseCoherence' :
1. Tes observations sur l independance des chiffres (D1) si tu as des indices
2. Tes observations sur les besoins de capital futurs (D2)
3. Le positionnement vs benchmarks marche ci-dessus si pertinent

# WEB SEARCH (si disponible)
Si le tool web_search est disponible, utilise-le pour verifier les
benchmarks de marges et de croissance de l industrie quand le dossier
fait des projections agressives. Recherches type :
  - "[secteur] EBITDA margin benchmark"
  - "[secteur] hardware revenue growth typical"
  - "[concurrent reel cite] revenue 2024"
2-3 recherches max. Privilegier les chiffres precis qui peuvent
contredire ou valider les projections du dossier.

Retourne uniquement le JSON structure.${buildFundNoteBlock(fundNote, 'financiere')}`;
}
