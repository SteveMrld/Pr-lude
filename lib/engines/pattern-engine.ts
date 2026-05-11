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
import { buildVerifiedComparablesBlock, detectAssetClass } from '../data/verified-comparables';
import { normalizeFrText } from '../data/text-normalize';
import { formatExtractionGeography } from './fund-context';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from './source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from './editorial-voice';
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
${SOURCE_TAGGING_INSTRUCTION}
${EDITORIAL_VOICE_INSTRUCTION}

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

EN PLUS des comparables d'archétype, tu produis 3 COMPARABLES INTERNATIONAUX ÉTAYÉS qui éclairent le dossier de l'extérieur. Au moins UN comparable hors Europe (US ou Asie). Pour chaque comparable international, tu fournis une fiche structurée avec :
- Pays/géographie
- Secteur (avec asset class explicite)
- Année fondation
- Pari stratégique initial pris
- Trajectoire chiffrée (3-5 jalons clés avec dates et chiffres : revenue, funding, customers, exit)
- Outcome final (success-public IPO, success-acquired M&A, survival-private, failed, pivot, ongoing)
- Valuation finale chiffrée
- Multiple à l'exit (ex: 1000x pour Series A investors)
- Si succès : facteurs clés de succès (3-4 points)
- Si échec : facteurs clés d'échec (3-4 points)
- Pertinence pour le dossier en cours : ce que ce cas nous apprend concrètement

# REGLE D'OR SUR LA PERTINENCE SECTORIELLE DES COMPARABLES INTERNATIONAUX

C'est la règle la plus importante pour ce bloc. Le partner senior va s'effondrer si tu cites Stripe ou Notion comme comparable international d'un dossier hardware deeptech maritime. Pour CHAQUE comparable international, tu DOIS valider qu'il partage l'ASSET CLASS du dossier sur au moins DEUX des trois dimensions :

1. NATURE BUSINESS : hardware physique / software pur / services / marketplace / biotech-pharma / deeptech infrastructure / contenu-média
2. MODELE ECONOMIQUE : B2B SaaS récurrent / B2C transactionnel / B2C marketplace / B2B vente unitaire haute valeur / hardware vente / licence IP
3. INTENSITE CAPITALISTIQUE : capex lourd / capital efficient / cycle long R&D / scale rapide possible

CORPUS DE COMPARABLES SECTORIELS À UTILISER (par asset class)

Hardware deeptech industriel / cycle long R&D / capex lourd :
  SpaceX, Tesla (early), Rivian, Lucid Motors, QuantumScape, Form Energy, Helion Energy, Commonwealth Fusion, Joby Aviation, Boom Supersonic, Saildrone, Anduril, Shield AI, Skydio, Heart Aerospace.

Biotech / medtech / pharma :
  Moderna, BioNTech, Recursion, Insitro, Owkin, Schrödinger, Tempus AI, Verily, 23andMe.

Hardware grand public :
  DJI, GoPro, Nest, Ring, Peloton, Whoop, Oura.

Maritime / mobilité spécialisée / ocean tech :
  Saildrone (drones marins), OceanX, Boom Supersonic, Ampaire (eVTOL), Joby Aviation, Beta Technologies.

Energie / climat / hardware infrastructure :
  Climeworks, Carbon Engineering, Form Energy, Northvolt (référence en cautionary-tale), Verkor, Sila Nanotechnologies, Redwood Materials.

SaaS B2B classique :
  Stripe, Datadog, Snowflake, Wiz, MongoDB, Twilio, HashiCorp, Confluent, Notion, Figma, Airtable, Toast, Klaviyo, Atlassian, Zoom, Slack.

Marketplace B2C :
  Airbnb, Uber, DoorDash, Vinted, Etsy, Lyft, Sea Limited, Grab, Coupang, Doctolib (vertical médical).

Fintech consumer :
  Nubank, Klarna, Adyen, Revolut, Chime, Robinhood, Affirm, Coinbase.

IA / fondation models / deeptech IA :
  Anthropic, OpenAI, Stability AI, Hugging Face, Cohere, Mistral, Stable Diffusion derivatives.

Echec deeptech industriel (cautionary tales) :
  Theranos (biotech), Solyndra (solar), Better.com (proptech), Quibi (streaming), Jawbone (hardware grand public), Ynsect (food deeptech), Cazoo (auto marketplace).

EXEMPLES DE MATCHES INVALIDES (à ne PAS faire) :
- Dossier hardware maritime exploration : ne JAMAIS citer Stripe, Figma, Notion, Discord, Slack, Airtable comme comparable international principal. Ces sociétés sont SaaS pur, marges infinies, asset-light, distribution digitale. Pour ce type de dossier, citer plutôt Saildrone, Joby Aviation, Saildrone (drones marins), DJI (hardware), QuantumScape (deeptech).
- Dossier biotech : ne pas citer Stripe ni Datadog. Citer Moderna, BioNTech, Recursion.
- Dossier marketplace B2C : ne pas citer SpaceX. Citer Airbnb, Uber, Coupang.

SI TU NE TROUVES PAS DE COMPARABLE SECTORIEL PERTINENT DANS LE CORPUS :
Tu peux citer un comparable de pattern (ex: trajectoire de patience longitudinale comme OVHcloud) MAIS tu dois explicitement noter dans le champ relevanceToCurrentDeal "Comparable de PATTERN, pas de SECTEUR" et expliquer ce que le pattern apporte. Mieux vaut deux comparables sectoriels et un de pattern, que trois comparables forcés.

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
      "divergences": ["points où le dossier diverge du cas"],
      "comparableType": "pattern" | "sectoral" | "mixed",
      "comparableTypeRationale": "1 phrase qui justifie pourquoi le comparable est pattern (proximité d archetype d instruction) ou sectoral (meme asset class) ou mixed"
    }
  ],
  "matchingPatterns": ["patterns transversaux qui s'appliquent au dossier"],
  "retrospectiveBenchmark": {
    "averageScore": moyenne des retrospectiveScore des comparables (à n inclure que si majorité des comparables sont sectoral ou mixed),
    "successRate": "phrase qui qualifie le taux de succès des cas comparables",
    "insights": "phrase qui synthétise ce que les comparables nous apprennent sur ce dossier",
    "comparableScopeWarning": "si majorité des comparables sont de type pattern (pas sectoral), AJOUTER ICI une mise en garde explicite : 'Note moyenne calculée sur des comparables retenus pour proximité de pattern d instruction, pas pour similarité sectorielle. Cette moyenne ne projette pas le potentiel du dossier en cours qui opère dans un secteur sans précédent direct dans le corpus historique.' Si majorité sont sectoral, ce champ peut etre omis ou null."
  },
  "internationalBenchmarks": [
    {
      "name": "nom comparable",
      "geography": "US | Europe | Asia | LatAm | Africa",
      "sector": "secteur précis avec asset class",
      "assetClassMatch": {
        "businessNature": "comment la nature business correspond au dossier en cours",
        "marketModel": "comment le modele economique correspond",
        "capexLevel": "comment l intensite capitalistique correspond",
        "alignment": "high" | "medium" | "low",
        "rationale": "1 phrase qui justifie l alignment"
      },
      "foundedYear": année,
      "initialBet": "pari initial pris",
      "trajectory": [
        { "year": "année", "milestone": "jalon", "revenueOrFunding": "données chiffrées" }
      ],
      "outcome": "success-public | success-acquired | survival-private | failed | pivot | ongoing",
      "finalValuation": "valuation finale chiffrée",
      "multipleAtExit": "multiple",
      "keySuccessFactors": ["facteur 1", "facteur 2"],
      "keyFailureFactors": ["facteur 1 si echec"],
      "relevanceToCurrentDeal": "pertinence concrète pour ce dossier",
      "currentStatus": "confirmed" | "in-difficulty" | "uncertain",
      "cautionLevel": "reference-positive" | "cautionary-tale" | "neutral"
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
    omet currentStatus et cautionLevel plutot que de les inventer.

# RÈGLE SUR LES CHIFFRES HISTORIQUES (DISCIPLINE ABSOLUE)

Si tu cites un comparable avec des chiffres précis (seed amount, valuation, multiple, IPO date, nom d'investisseur, montant de tour, date de tour, premier chèque, Series A/B/C, ARR, market cap, exit multiple), ce chiffre DOIT venir de la base de chiffres vérifiés injectée plus bas dans le user prompt (section "BASE DE CHIFFRES VERIFIES DES COMPARABLES"). Pour tout chiffre absent de cette base, tu OMETS plutôt que d'inventer.

CETTE RÈGLE COUVRE TOUS LES CHIFFRES, MÊME SECONDAIRES :
- Pas seulement les valuations principales mais aussi : nom des fonds qui ont mené chaque tour, montants exacts, dates précises, premiers chèques, secondary sales, tenders.
- Exemple : si la base mentionne "Saildrone Series C 2021 100M$ BOND lead" sans préciser la Series A, tu NE peux PAS écrire "Series A 2016 14M$ Social Capital". Tu écris juste "Saildrone, fondée en 2012, valorisation ~1Md$ en 2024".

Mieux vaut imprécis que faux. Les chiffres faux dans une note d'instruction détruisent la crédibilité de l'analyse plus vite qu'une absence de chiffre, surtout si la note arrive sur le bureau d'un fonds qui a co-investi dans le comparable cité (Sequoia pour Airbnb, a16z pour Stripe, Index/Greylock pour Figma : ces partners savent les vrais chiffres parce qu'ils étaient dans le deal).

Pour les comparables ABSENTS de la base, tu peux mentionner le nom et le contexte qualitatif (année fondation si certaine, secteur), mais AUCUN chiffre précis (ni seed, ni Series, ni valuation, ni multiple). Tu peux dire "early stage seed", "scale-up", "succès IPO", "rachat", sans chiffrer.

NE JAMAIS inventer un seed, une Series A/B/C, une valuation, un nom d'investisseur, ou un multiple. Toute violation = faute critique à corriger.`;

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
  // Texte normalise (lowercase + diacritiques aplatis) : un libelle
  // "Énergie" ou "Défense" matche les regex non accentuees ci-dessous.
  const sectorLower = normalizeFrText(extraction.sector + ' ' + extraction.subSector);
  const isQuantum = sectorLower.includes('quantum') || sectorLower.includes('quantique');
  const isIndustrial = sectorLower.match(/industri|hardware|deeptech|battery|gigafactory|energy|energie|energetique|nuclear|nucleaire|robot/);
  const isFintech = sectorLower.match(/fintech|bank|banque|insurance|assurance|paiement|payment|credit/);
  const isMarketplace = sectorLower.match(/marketplace|e-?commerce|consumer|marche public/);
  const isAI = sectorLower.match(/genai|ia generative|llm|agent|ai\b/);
  const isDefense = sectorLower.match(/defense|drone|military|militaire|uas|surveillance|aerospatial|aeronautique/);
  const isSaaS = sectorLower.match(/saas|cloud|software|logiciel|monitoring|cybersecur/);

  // Strate D : echecs pedagogiques - on selectionne ceux qui matchent
  // au moins un signal du dossier
  const allFailures = findByStrate('D-failure');
  const failures = allFailures.filter((c) => {
    if (isIndustrial && (c.wagerType === 'industrial' || c.wagerType === 'hardware')) return true;
    if (isFintech && c.wagerType === 'fintech-regulated') return true;
    if (isMarketplace && c.wagerType === 'marketplace') return true;
    // WeWork et Cazoo : invocation calibree sur asset_class structurellement
    // proche (capex/marketplace ou industriel), JAMAIS comme reference universelle.
    // Conformement a la garde-fou narrative_specificity du moteur Comparables V5,
    // un pattern Strate D ne doit pas etre injecte hors contexte d asset class.
    if (c.id === 'wework-eu' || c.id === 'cazoo') {
      return Boolean(isMarketplace) || Boolean(isIndustrial);
    }
    return false;
  });
  // Si rien ne matche : on retourne un tableau vide. Pas d injection forcee.
  // Mieux vaut zero pattern que des patterns hors contexte qui pollueraient
  // la sortie sur des dossiers media, software pur, services, etc.

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
${MIGHTY_50_SAMPLE.map(c => `- ${c.name} (${c.country}) · ${c.sector}${c.notes ? ' · ' + c.notes : ''}`).join('\n')}

## Levees notables 2025
${(NOTABLE_EUROPEAN_ROUNDS_2025 as readonly any[]).map((r) => {
  const amount = r.amountMillionsUsd ? `${r.amountMillionsUsd}M$` : `${r.amountMillionsEur}M€`;
  const notesPart = r.notes ? ` · ${r.notes}` : '';
  return `- ${r.company} (${r.country}) · ${r.sector} · ${r.round} ${amount}${notesPart}`;
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
- Les cas Strate D (Ynsect, Cazoo, Northvolt, WeWork, Klarna) ne doivent etre
  cites dans matchedPatterns QUE si le dossier en cours partage explicitement
  leur asset class ET leur ordre de grandeur de funding. Concretement :
  * Ynsect (deeptech industriel, 600M EUR cumules) : reservé aux dossiers
    industriels ou hardware avec capex significatif et levée >50M EUR.
  * WeWork (real estate deguise tech, 12,8Md USD) : reserve aux dossiers
    marketplace lourds avec baux longs ou modele asset-heavy similaire.
  * Cazoo (e-commerce capex, IPO ratee) : reserve aux dossiers e-commerce
    avec stock physique et capex marketing massif.
  * Northvolt (battery cell manufacturing) : reserve aux dossiers
    industriels capex >100M EUR.
  * Klarna (BNPL fintech) : reserve aux dossiers fintech credit conso.
  Pour un dossier media, software pur, services, education, sante non capex :
  ces patterns Strate D N ONT PAS leur place. Mieux vaut un matchedPatterns vide
  qu un pattern hors contexte qui pollue le verdict.
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

Société : ${extraction?.companyName ?? '?'}
Secteur : ${extraction?.sector ?? '?'} / ${extraction?.subSector ?? '?'}
Géographie : ${formatExtractionGeography(extraction)}
Année fondation : ${extraction.yearFounded && extraction.yearFounded > 0 ? extraction.yearFounded : "non renseignée"}

Output Moteur Équipe :
${JSON.stringify({
  foundersCount: team.foundersCount,
  pedigreeCanonical: team.pedigreeCanonical,
  averageAge: team.averageAge,
  sectorExperience: team.sectorExperience,
  riskTaken: team.riskTaken,
  systemicCoverageScore: team.systemicCoverage?.score ?? null,
  greenFlags: team.greenFlags,
  redFlags: team.redFlags,
}, null, 2)}

Output Moteur Marché :
${JSON.stringify({
  perceivedSize: market.perceivedSize,
  realIntensity: market.realIntensity,
  saturation: market.saturation,
  needIntensityScore: market.needIntensity?.score ?? null,
  defensibilityScore: market.defensibility?.score ?? null,
}, null, 2)}

Output Moteur Macro :
${JSON.stringify({
  cyclePosition: macro.cyclePosition,
  vcCapitalOnSegment: macro.vcCapitalOnSegment,
  contraryclicalOpportunityScore: macro.contraryclicalOpportunity?.score ?? null,
  criticalTimingWindow: macro.criticalTimingWindow,
}, null, 2)}

# Cas du corpus présélectionnés algorithmiquement (top 8 par proximité structurelle) :

${top8.map(s => `- ${s.case.id} (${s.case.name}, ${s.case.yearOfRefusal}, ${s.case.country}) · proximité algorithmique ${s.proximity}% · archétype ${s.case.archetype} · patterns ${s.case.comparablePatterns.join(', ')} · score rétrospectif ${s.case.retrospectiveScore}`).join('\n')}
${europeanComparablesBlock}
${extendedCorpusBlock}

${buildVerifiedComparablesBlock(detectAssetClass(extraction))}

Identifie l'archétype dominant et raffine les 3 meilleurs comparables. Pour chaque comparable cité avec des chiffres précis, ces chiffres doivent venir de la base de chiffres vérifiés ci-dessus. Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 8000);
  const analysis = parseJSON<PatternMatchingOutput>(rawResponse);
  const audit = auditTagging(analysis, 'pattern-engine');
  if (audit.level !== 'ok') {
    console.warn('[pattern-engine] tagging audit:', audit.message);
  }
  // Sanitization post-parsing : il arrive que le LLM concatene les champs
  // comparableType et comparableTypeRationale a la fin du dernier element
  // du tableau divergences au lieu de les mettre dans leurs champs propres.
  // Pattern observe : "...divergence reelle. · comparableType · : · sectoral
  // · comparableTypeRationale · : · Comparable sectoriel direct..."
  // On detecte ce pattern et on redistribue dans les champs corrects.
  if (analysis?.comparables && Array.isArray(analysis.comparables)) {
    for (const comp of analysis.comparables as any[]) {
      if (!Array.isArray(comp.divergences) || comp.divergences.length === 0) continue;
      const lastIdx = comp.divergences.length - 1;
      const last = comp.divergences[lastIdx];
      if (typeof last !== 'string') continue;
      // Detecte le marker de leak
      const typeMatch = last.match(/[·]\s*comparableType\s*[·]\s*[:.]?\s*[·]?\s*(sectoral|pattern|mixed)\s*[·]/i);
      const rationaleMatch = last.match(/[·]\s*comparableTypeRationale\s*[·]\s*[:.]?\s*[·]?\s*(.+?)(?:\s*[·]\s*$|\s*$)/i);
      if (typeMatch || rationaleMatch) {
        // Retire la portion polluee de la divergence
        const cleanedLast = last
          .replace(/\s*[·]\s*comparableType\s*[·][\s\S]*$/i, '')
          .trim();
        comp.divergences[lastIdx] = cleanedLast;
        // Si la divergence devient vide, on la supprime
        if (!cleanedLast || cleanedLast === '·') {
          comp.divergences.pop();
        }
        if (typeMatch && !comp.comparableType) {
          comp.comparableType = typeMatch[1].toLowerCase();
        }
        if (rationaleMatch && !comp.comparableTypeRationale) {
          comp.comparableTypeRationale = rationaleMatch[1].trim();
        }
      }
    }
  }
  return analysis;
}
