import { callClaude, parseJSON } from './anthropic-client';
import { CORPUS, type CaseRecord } from '../corpus/database';
import {
  EXTENDED_CORPUS,
  findByStrate,
  type ExtendedCaseRecord,
} from '../corpus/extended-database';
import {
  MIGHTY_50_SAMPLE,
  NOTABLE_EUROPEAN_ROUNDS_2025,
  EUROPEAN_DEEPTECH_2025,
} from '../benchmarks';
import type { ExtractionOutput, TeamAnalysisOutput, MarketAnalysisOutput, MacroAnalysisOutput, PatternMatchingOutput } from './types';

// Calcul algorithmique de proximité structurelle entre dossier et cas du corpus
function computeStructuralProximity(
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput,
  caseRec: CaseRecord
): number {
  let score = 0;
  let maxScore = 0;

  // Match équipe (poids 30%)
  if (team.foundersCount === caseRec.teamProfile.foundersCount) score += 6;
  else if (Math.abs(team.foundersCount - caseRec.teamProfile.foundersCount) === 1) score += 3;
  maxScore += 6;

  if (team.pedigreeCanonical === caseRec.teamProfile.pedigreeCanonical) score += 6;
  maxScore += 6;

  if (team.averageAge === caseRec.teamProfile.averageAge) score += 6;
  maxScore += 6;

  if (team.sectorExperience === caseRec.teamProfile.sectorExperience) score += 6;
  maxScore += 6;

  if (team.riskTaken === caseRec.teamProfile.riskTaken) score += 6;
  maxScore += 6;

  // Match marché (poids 35%)
  if (market.perceivedSize === caseRec.marketProfile.perceivedSize) score += 8;
  maxScore += 8;

  if (market.realIntensity === caseRec.marketProfile.realIntensity) score += 8;
  maxScore += 8;

  if (market.saturation === caseRec.marketProfile.saturation) score += 7;
  maxScore += 7;

  // Match macro (poids 35%)
  if (macro.cyclePosition === caseRec.macroAtRefusal.cyclePosition) score += 12;
  else if (
    (macro.cyclePosition === 'pre-bascule' && caseRec.macroAtRefusal.cyclePosition === 'bascule') ||
    (macro.cyclePosition === 'bascule' && caseRec.macroAtRefusal.cyclePosition === 'pre-bascule')
  ) score += 6;
  maxScore += 12;

  if (macro.vcCapitalOnSegment === caseRec.macroAtRefusal.vcCapital) score += 10;
  maxScore += 10;

  return Math.round((score / maxScore) * 100);
}

const SYSTEM_PROMPT = `Tu es le Moteur de Pattern Matching de la plateforme Prélude. Tu reçois les outputs des moteurs précédents (extraction, équipe, marché, macro) ainsi qu'une présélection de cas du corpus calculée algorithmiquement par proximité structurelle. Tu produis l'identification de l'archétype dominant du dossier et tu raffines les comparables historiques en explicitant les analogies structurelles précises et les divergences.

# CADRE DES CINQ ARCHÉTYPES

1. INTERPRÉTATIF · le filtre dominant est qu'un secteur ou segment est classé hors thèse par défaut de cadre macro. Pas de mauvais jugement individuel, un cadre interprétatif manquant. Cas type : Helsing 2021 (défense EU), Airbnb 2008 (économie du partage non nommée), Uber 2009 (mobilité régulée), Spotify 2006 (industrie en transition), Facebook 2004 (réseau social pro).

2. PROFONDEUR D'INSTRUCTION · l'intensité de besoin est mesurable mais non mesurée par DD rapide. Le screening rapide rate ce que la lecture longue révèle. Cas type : Doctolib (intensité patient), Zoom (saturation vs mal servi), Dropbox (fluidité), Shopify (longue traîne).

3. CAPACITÉ OPÉRATIONNELLE · vélocité, ticket ou cadre interprétatif insuffisants pour leader. Pas un mauvais jugement, une incompatibilité structurelle. Cas type : Mistral, Stripe, Hugging Face, Datadog.

4. CUMULÉ MOYEN TERME · plusieurs filtres défavorables cumulés sur 5-10 ans. Cas type : Quantum Systems, Slack, Alan, PayFit, Adyen, LinkedIn.

5. CUMULÉ LONG TERME · construction patiente sur plus d'une décennie hors radar VC. Cas type : Tekever, OVHcloud, Believe, UiPath.

# PATTERNS TRANSVERSAUX

Liste de patterns récurrents que tu peux invoquer :
- defense-eu-pre-ukraine
- saturation-vs-mal-servi
- niche-vers-massif
- mafia-paypal
- migration-fr-vers-us
- fondateurs-tres-jeunes
- patience-longitudinale
- geographie-marges-eu
- barriere-reglementaire-protectrice
- categorie-emergente-non-reconnue
- transposition-experience-secteurs-analogues
- crise-comme-fenetre
- defaut-leadership-eu
- pivot-success
- cadre-dirigeant-leader

# TON TRAVAIL

À partir des inputs fournis et des cas présélectionnés algorithmiquement :
1. Identifie l'archétype dominant du dossier (peut être un mélange, choisis le dominant)
2. Sélectionne les 3 meilleurs comparables parmi les cas présélectionnés (et ajoute des cas du corpus complet si nécessaire)
3. Pour chaque comparable, explicite l'analogie structurelle précise et les divergences
4. Identifie les patterns transversaux qui s'appliquent au dossier
5. Calcule un benchmark rétrospectif basé sur les cas du corpus avec patterns similaires

# COMPARABLES INTERNATIONAUX ÉTAYÉS

EN PLUS des comparables du corpus, tu produis 3 COMPARABLES INTERNATIONAUX ÉTAYÉS qui éclairent le dossier de l'extérieur. Au moins UN comparable hors Europe (US ou Asie). Pour chaque comparable international, tu fournis une fiche structurée avec :
- Pays/géographie
- Secteur
- Année fondation
- Pari stratégique initial pris
- Trajectoire chiffrée (3-5 jalons clés avec dates et chiffres : revenue, funding, customers, exit)
- Outcome final (success-public IPO, success-acquired M&A, survival-private, failed, pivot, ongoing)
- Valuation finale chiffrée
- Multiple à l'exit (ex: 1000x pour Series A investors)
- Si succès : facteurs clés de succès (3-4 points)
- Si échec : facteurs clés d'échec (3-4 points)
- Pertinence pour le dossier en cours : ce que ce cas nous apprend concrètement

Ces comparables doivent être RÉELS et VÉRIFIABLES. Tu peux citer : Stripe, Datadog, Snowflake, Notion, Figma, Airtable, Toast, Klaviyo, Wiz, Anthropic, OpenAI, Stability AI, Hugging Face, MongoDB, Twilio, Zoom, Slack, Atlassian (US/Asia/Europe), Sea Limited, Grab, Coupang, Nio, BYD, Sea AI, Nubank (Asia/LatAm), Paystack, Flutterwave, Andela (Africa), Klarna, Spotify, Adyen, UiPath (Europe), Toast, Shopify (US/Canada). Aussi des échecs documentés : Quibi, Jawbone, Theranos, Better.com, Solyndra, Ynsect.

Tu choisis les comparables LES PLUS PERTINENTS pour le dossier en cours, en cherchant des analogies structurelles fortes (modèle économique, marché, timing, équipe).

# FORMAT JSON OBLIGATOIRE

{
  "archetypeDominant": "interpretive" | "depth" | "capacity" | "cumulative-mid" | "cumulative-long",
  "archetypeRationale": "phrase qui justifie le choix d'archétype",
  "comparables": [
    {
      "caseId": "id du cas (helsing, doctolib, etc.)",
      "name": "nom",
      "year": année,
      "proximity": 0-100,
      "structuralAnalogy": "phrase précise sur l'analogie structurelle",
      "sharedPatterns": ["patterns partagés"],
      "divergences": ["points où le dossier diverge du cas"]
    }
  ],
  "matchingPatterns": ["patterns transversaux qui s'appliquent au dossier"],
  "retrospectiveBenchmark": {
    "averageScore": moyenne des retrospectiveScore des 3 comparables,
    "successRate": "phrase qui qualifie le taux de succès des cas comparables",
    "insights": "phrase qui synthétise ce que les comparables nous apprennent sur ce dossier"
  },
  "internationalBenchmarks": [
    {
      "name": "Stripe",
      "geography": "US",
      "sector": "Online payments infrastructure",
      "foundedYear": 2010,
      "initialBet": "API-first developer experience pour paiements en ligne, contre PayPal qui dominait le marché en B2C",
      "trajectory": [
        { "year": "2010", "milestone": "Fondation par Patrick et John Collison", "revenueOrFunding": "Seed 2M$ a16z" },
        { "year": "2012", "milestone": "Series A", "revenueOrFunding": "20M$ valuation 100M$" },
        { "year": "2016", "milestone": "Series D Atlas (incorporation API)", "revenueOrFunding": "150M$ valuation 9Md$" },
        { "year": "2021", "milestone": "Series H peak valuation", "revenueOrFunding": "600M$ valuation 95Md$" }
      ],
      "outcome": "ongoing",
      "finalValuation": "65Md$ (valuation 2024 après ajustements)",
      "multipleAtExit": "~3000x pour Series Seed investors (paper)",
      "keySuccessFactors": ["Founder-market fit exceptionnel (Collison brothers ex-fondateurs Auctomatic)", "Obsession DX pendant 5 ans avant scaling", "Recrutements early de top-tier engineering"],
      "keyFailureFactors": [],
      "relevanceToCurrentDeal": "Si le dossier en cours présente le même pattern API-first sur un marché dominé par un acteur grand public, Stripe montre que la fenêtre B2B/dev existe sur 5-7 ans",
      "currentStatus": "confirmed",
      "cautionLevel": "reference-positive"
    }
  ]
}

# REGLE D OR SUR LES NOUVEAUX CHAMPS currentStatus / cautionLevel

Pour CHAQUE comparable cite, tu DOIS remplir currentStatus et cautionLevel
selon ces regles strictes :

  - Si le comparable provient du CORPUS ETENDU (Strate D : Ynsect, Cazoo,
    Northvolt, WeWork, Klarna ; Strate B : Sorare, Ledger, Swile,
    ManoMano, Vestiaire, BackMarket, PayFit, Believe, OVHcloud, Spendesk ;
    Strate C : Verkor, Photoroom, Electra, Wandercraft, H Company,
    Jimmy, Aledia, Prophesee), tu DOIS reproduire le statut indique
    dans le bloc CORPUS ETENDU.

  - Si le comparable est un succes confirme (Mistral, Doctolib, Qonto,
    Alan, Contentsquare, Dataiku, Mirakl, Exotec, Pennylane, EcoVadis,
    Stripe, Wiz, Snowflake) -> currentStatus 'confirmed',
    cautionLevel 'reference-positive'.

  - Si le comparable est cite comme avertissement (cas Strate D ou
    in-difficulty), cautionLevel DOIT etre 'cautionary-tale'. Le
    relevanceToCurrentDeal DOIT etre formule comme un avertissement
    ('attention au pattern X qui a coule Y'), pas comme un parallele
    neutre.

  - Si tu cites un comparable dont tu n es pas sur du statut actuel,
    omet currentStatus et cautionLevel plutot que de les inventer.`;

// ============================================================
// SELECTION INTELLIGENTE DU CORPUS ETENDU
// ------------------------------------------------------------
// Le corpus etendu (39 cas en 4 strates) est consomme differemment
// du corpus historique : on ne fait pas de matching structurel
// algorithmique (les attributs ne sont pas indexes pareil), mais
// une selection heuristique par pertinence semantique.
//
// On selectionne :
//   - Tous les cas Strate D (echecs pedagogiques) du meme secteur
//     ou de secteurs adjacents : Pen Group deeptech defense doit
//     voir Ynsect (deeptech industriel), WeWork (real estate
//     maquille en tech), Northvolt (gigafactory).
//   - Les cas Strate B/C les plus proches en wagerType
//   - Si le dossier est quantique, le sous-corpus quantique entier
//
// Ces cas sont injectes dans le prompt en BLOC SEPARE pour que
// Claude les utilise comme references explicites des risques (pas
// comme des comparables structurels).
// ============================================================

function selectRelevantExtendedCases(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
): { failures: ExtendedCaseRecord[]; risky: ExtendedCaseRecord[]; quantum: ExtendedCaseRecord[]; references: ExtendedCaseRecord[] } {
  const sectorLower = (extraction.sector + ' ' + extraction.subSector).toLowerCase();
  const isQuantum = sectorLower.includes('quantum') || sectorLower.includes('quantique');
  const isIndustrial = sectorLower.match(/industri|hardware|deeptech|battery|gigafactory|energy|nuclear|robot/i);
  const isFintech = sectorLower.match(/fintech|bank|insurance|assurance|paiement|payment|credit/i);
  const isMarketplace = sectorLower.match(/marketplace|e-?commerce|consumer/i);
  const isAI = sectorLower.match(/genai|ia g[eé]n[eé]rative|llm|agent|ai\b/i);
  const isDefense = sectorLower.match(/d[eé]fense|defense|drone|military|uas|surveillance/i);
  const isSaaS = sectorLower.match(/saas|cloud|software|monitoring|cybersecur/i);

  // Strate D : echecs pedagogiques - on selectionne ceux qui matchent
  // au moins un signal du dossier
  const allFailures = findByStrate('D-failure');
  const failures = allFailures.filter((c) => {
    if (isIndustrial && (c.wagerType === 'industrial' || c.wagerType === 'hardware')) return true;
    if (isFintech && c.wagerType === 'fintech-regulated') return true;
    if (isMarketplace && c.wagerType === 'marketplace') return true;
    // WeWork et Cazoo sont des references universelles d aveuglement,
    // toujours injectees si capex marketplace ou consumer
    if (c.id === 'wework-eu' || c.id === 'cazoo') {
      return Boolean(isMarketplace) || Boolean(isIndustrial);
    }
    return false;
  });
  // Si rien ne matche, on injecte WeWork comme reference universelle minimale
  if (failures.length === 0) {
    const wework = allFailures.find((c) => c.id === 'wework-eu');
    if (wework) failures.push(wework);
  }

  // Strate B/C : paris ouverts ou risques structurels du meme type
  const risky = EXTENDED_CORPUS.filter((c) => {
    if (c.strate !== 'B-open' && c.strate !== 'C-risky') return false;
    if (isIndustrial && (c.wagerType === 'industrial' || c.wagerType === 'hardware' || c.wagerType === 'deeptech')) return true;
    if (isFintech && c.wagerType === 'fintech-regulated') return true;
    if (isMarketplace && c.wagerType === 'marketplace') return true;
    if (isAI && c.wagerType === 'genai') return true;
    return false;
  }).slice(0, 5); // limite a 5 pour ne pas saturer le prompt

  // Quantum : sous-corpus complet si applicable
  const quantum = isQuantum ? findByStrate('quantum') : [];

  // REFERENCES : benchmarks internationaux chiffres pertinents pour le dossier.
  // On selectionne par alignement sectoriel pour eviter au moteur d halluciner
  // les chiffres (Helsing 660M$ Series D, Anduril revenue x2 sustained, etc.).
  const allReferences = findByStrate('reference');
  const references = allReferences.filter((c) => {
    if (isDefense && (c.id === 'helsing' || c.id === 'anduril')) return true;
    if (isFintech && c.id === 'stripe') return true;
    if (isSaaS && (c.id === 'datadog' || c.id === 'wiz' || c.id === 'uipath')) return true;
    if (isAI && c.id === 'wiz') return true;
    if (isIndustrial && c.id === 'anduril') return true; // Anduril hardware industriel
    return false;
  });
  // Si pas de match sectoriel, on injecte au minimum Stripe + Datadog comme
  // references universelles de successes contrariens.
  if (references.length === 0) {
    const stripe = allReferences.find((c) => c.id === 'stripe');
    const datadog = allReferences.find((c) => c.id === 'datadog');
    if (stripe) references.push(stripe);
    if (datadog) references.push(datadog);
  }

  return { failures, risky, quantum, references };
}

function formatExtendedCaseForPrompt(c: ExtendedCaseRecord): string {
  return `- ${c.name} (${c.country}, fonde ${c.yearFounded}) · ${c.sector}/${c.subSector || ''} · statut: ${c.status}
  These initiale: ${c.thesis}
  Risque principal: ${c.primaryRisk}
  Pattern reutilisable: ${c.reusablePattern}`;
}

export async function matchPatterns(
  extraction: ExtractionOutput,
  team: TeamAnalysisOutput,
  market: MarketAnalysisOutput,
  macro: MacroAnalysisOutput
): Promise<PatternMatchingOutput> {

  // Pré-sélection algorithmique : top 8 cas par proximité structurelle
  const scored = CORPUS.map(c => ({
    case: c,
    proximity: computeStructuralProximity(team, market, macro, c),
  }));
  scored.sort((a, b) => b.proximity - a.proximity);
  const top8 = scored.slice(0, 8);

  // Detection rapide de la region pour piloter les international benchmarks
  const countryLower = (extraction.country || '').toLowerCase();
  const europeKeywords = ['france', 'germany', 'allemagne', 'united kingdom', 'uk', 'spain', 'espagne', 'italy', 'italie', 'netherlands', 'pays-bas', 'belgium', 'belgique', 'sweden', 'suède', 'denmark', 'danemark', 'finland', 'finlande', 'ireland', 'irlande', 'portugal', 'austria', 'autriche', 'switzerland', 'suisse', 'poland', 'pologne', 'estonia'];
  const isEurope = europeKeywords.some(kw => countryLower.includes(kw));

  // Si dossier europeen, on injecte les comparables europeens 2024-2026 pour
  // que le moteur les privilegie dans internationalBenchmarks plutot que de
  // proposer Wiz/Stripe/Dassault par defaut.
  const europeanComparablesBlock = isEurope ? `

# COMPARABLES EUROPEENS 2024-2026 (a privilegier pour les internationalBenchmarks)

Le dossier est europeen. Pour les internationalBenchmarks, privilegie les references europeennes recentes ci-dessous plutot que des references US obsoletes (ex: Stripe 2010, Dassault 1977). Ces comparables sont issus du Mighty 50 Atomico 2025 et des levees notables Q3-Q4 2025.

## Mighty 50 (selection)
${MIGHTY_50_SAMPLE.map(c => `- ${c.name} (${c.country}) — ${c.sector}${c.notes ? ' · ' + c.notes : ''}`).join('\n')}

## Levees notables 2025
${(NOTABLE_EUROPEAN_ROUNDS_2025 as readonly any[]).map((r) => {
  const amount = r.amountMillionsUsd ? `${r.amountMillionsUsd}M$` : `${r.amountMillionsEur}M€`;
  const notesPart = r.notes ? ` · ${r.notes}` : '';
  return `- ${r.company} (${r.country}) — ${r.sector} — ${r.round} ${amount}${notesPart}`;
}).join('\n')}

## Contexte deeptech europeen 2025
- ${EUROPEAN_DEEPTECH_2025.shareOfEuropeanVcDollarsPercent}% du capital VC europeen va au deeptech (vs ${EUROPEAN_DEEPTECH_2025.shareOfEuropeanVcDollarsPercent2021}% en 2021)
- ${EUROPEAN_DEEPTECH_2025.totalDeployedBillionsUsd} milliards USD deployes en 2025
- Source: Atomico State of European Tech 2025

REGLE STRICTE: si le dossier est en defense, AI, deeptech, ou fintech, l'un des 3 internationalBenchmarks DOIT etre un comparable europeen recent (post-2022). Pour Wiz/Stripe/Dassault, ne les utiliser qu en complement, pas en reference principale.
` : '';

  // Selection du corpus etendu : echecs pedagogiques + paris risques
  // + sous-corpus quantique si applicable + references chiffrees pertinentes.
  // Ces cas sont injectes en bloc separe pour que Claude les utilise comme
  // references explicites des risques structurels et SURTOUT pour qu il ne
  // hallucine pas les chiffres sur Helsing/Anduril/Stripe/Datadog/Wiz/UiPath.
  const extendedSelection = selectRelevantExtendedCases(extraction, team, market);
  const hasExtendedCases =
    extendedSelection.failures.length > 0 ||
    extendedSelection.risky.length > 0 ||
    extendedSelection.quantum.length > 0 ||
    extendedSelection.references.length > 0;

  const extendedCorpusBlock = hasExtendedCases ? `

# CORPUS ETENDU - REFERENCES CRITIQUES (a citer si le dossier matche un pattern)

Le corpus etendu pose une regle : grosse levee != succes. Ces cas sont
fournis comme references explicites pour pattern-matcher contre les
echecs documentes et les paris encore ouverts. Si le dossier en cours
ressemble a l un de ces cas, tu DOIS le citer dans matchedPatterns avec
le statut explicite (confirmed/promising/fragile/in-difficulty/too-early).

${extendedSelection.failures.length > 0 ? `## ECHECS / QUASI-ECHECS PEDAGOGIQUES
Ces cas sont des references universelles. Tout dossier qui ressemble
structurellement a l un de ces patterns doit etre flague.

${extendedSelection.failures.map(formatExtendedCaseForPrompt).join('\n\n')}
` : ''}
${extendedSelection.risky.length > 0 ? `## PARIS OUVERTS OU RISQUES STRUCTURELS
Cas de meme type de pari (industrial, fintech regule, marketplace, AI).
Permet de calibrer les risques typiques du segment.

${extendedSelection.risky.map(formatExtendedCaseForPrompt).join('\n\n')}
` : ''}
${extendedSelection.quantum.length > 0 ? `## SOUS-CORPUS QUANTIQUE
Le dossier est quantique. Le sous-corpus complet est fourni pour benchmark
(architecture, capital leve, statut PROQCIMA).

${extendedSelection.quantum.map(formatExtendedCaseForPrompt).join('\n\n')}
` : ''}
${extendedSelection.references.length > 0 ? `## REFERENCES CHIFFREES AUTORISEES (chiffres pre-verifies, a privilegier)

CES CHIFFRES SONT VERIFIES ET PRE-AUTORISES. Quand tu cites Helsing /
Anduril / Stripe / Datadog / UiPath / Wiz dans la note, utilise STRICTEMENT
les chiffres ci-dessous, ne les invente pas. Si tu as besoin de chiffres
sur d autres comparables non listes ici, prefere une formulation
qualitative (~"environ", "estimé") plutot que d halluciner des montants
precis.

${extendedSelection.references.map(formatExtendedCaseForPrompt).join('\n\n')}

REGLE STRICTE : ne cite jamais de chiffre precis (ex. "Helsing 660M$ Series D")
sans qu il provienne de cette liste ou des donnees declarees du dossier.
Sinon utilise des fourchettes prudentes ("plusieurs centaines de M$").
` : ''}

REGLES D USAGE GENERALES
- Si le dossier matche structurellement un cas Strate D (Ynsect, Cazoo,
  Northvolt, WeWork, Klarna), tu DOIS l ajouter dans matchedPatterns
  avec un proximityScore eleve et le pattern critique associe.
- Pour chaque cas Strate D cite, mentionne explicitement le statut
  ('in-difficulty', 'fragile') dans le keyInsight.
- Pour les cas Strate B/C, calibre la confiance du comparable selon
  leur statut (un 'fragile' cite avec prudence vaut mieux qu un
  'confirmed' pris comme garantie de succes).
- Pour les references (Helsing/Anduril/Stripe/Datadog/UiPath/Wiz), tu peux
  les citer comme benchmarks chiffres mais SEULEMENT en utilisant les
  chiffres pre-verifies ci-dessus.
` : '';

  const userPrompt = `Données d'extraction du dossier :

Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}
Année fondation : ${extraction.yearFounded}

Output Moteur Équipe :
${JSON.stringify({
  foundersCount: team.foundersCount,
  pedigreeCanonical: team.pedigreeCanonical,
  averageAge: team.averageAge,
  sectorExperience: team.sectorExperience,
  riskTaken: team.riskTaken,
  systemicCoverageScore: team.systemicCoverage.score,
  greenFlags: team.greenFlags,
  redFlags: team.redFlags,
}, null, 2)}

Output Moteur Marché :
${JSON.stringify({
  perceivedSize: market.perceivedSize,
  realIntensity: market.realIntensity,
  saturation: market.saturation,
  needIntensityScore: market.needIntensity.score,
  defensibilityScore: market.defensibility.score,
}, null, 2)}

Output Moteur Macro :
${JSON.stringify({
  cyclePosition: macro.cyclePosition,
  vcCapitalOnSegment: macro.vcCapitalOnSegment,
  contraryclicalOpportunityScore: macro.contraryclicalOpportunity.score,
  criticalTimingWindow: macro.criticalTimingWindow,
}, null, 2)}

# Cas du corpus présélectionnés algorithmiquement (top 8 par proximité structurelle) :

${top8.map(s => `- ${s.case.id} (${s.case.name}, ${s.case.yearOfRefusal}, ${s.case.country}) · proximité algorithmique ${s.proximity}% · archétype ${s.case.archetype} · patterns ${s.case.comparablePatterns.join(', ')} · score rétrospectif ${s.case.retrospectiveScore}`).join('\n')}
${europeanComparablesBlock}
${extendedCorpusBlock}
Identifie l'archétype dominant et raffine les 3 meilleurs comparables. Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 8000);
  return parseJSON<PatternMatchingOutput>(rawResponse);
}
