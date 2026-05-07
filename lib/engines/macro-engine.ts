import { callClaude, parseJSON } from './anthropic-client';
import { gatherMacroRealData, gatherImfWeoSnapshot, type MacroSnapshot, type ImfWeoSnapshot } from '../data-fetchers/sources';
import { SOURCE_TAGGING_INSTRUCTION, auditTagging } from './source-tagging';
import { EDITORIAL_VOICE_INSTRUCTION } from './editorial-voice';
import { buildFundNoteBlock } from './fund-context';
import type { ExtractionOutput, MacroAnalysisOutput } from './types';
import type { RelevanceMatrix } from './relevance-matrix';
import {
  LP_LIQUIDITY_PRESSURE,
  MARKET_CONCENTRATION_2026_Q1,
  DRY_POWDER_2024_2025,
  FUNDRAISING_BIFURCATION_2026,
  EUROPEAN_MACRO_2025,
  US_MARKET_SENTIMENT_2026_Q1,
  EUROPEAN_REGULATORY_PIPELINE_2026,
  MARKET_DEPTH_2025_2026,
  PENSION_FUND_VC_ALLOCATION_2024,
  EUROPEAN_TECH_SENTIMENT_2025,
  EXIT_CHANNELS_2026,
} from '../benchmarks';

const SYSTEM_PROMPT = `Tu es le Moteur Macro & Géopolitique de la plateforme Prélude. Tu produis la lecture du régime macro applicable au segment du dossier en croisant cinq dimensions structurées et des données économiques réelles récupérées de World Bank API ET les bornes consolidées du marché VC/PE 2026 (PitchBook-NVCA Q1 2026, Atomico SoET 2025, Bain PE 2025).
${SOURCE_TAGGING_INSTRUCTION}
${EDITORIAL_VOICE_INSTRUCTION}

# CADRE MACRO

## Position de cycle
Distingue quatre positions :
- pre-bascule : signaux de retournement structurel à 12-24 mois, fenêtre rare d'investissement contracyclique
- bascule : retournement en cours, fenêtre étroite de positionnement
- post-bascule : retournement consommé, valorisations élevées, fenêtre fermée
- mature : segment stable, croissance organique sans bascule attendue

## Régime de taux d'intérêt
Tu reçois le taux d'intérêt réel observé pour le pays. Évalue le régime monétaire pertinent (restrictif, neutre, accommodant). Impact sur valorisations et capital-intensive.

## Géopolitique
Évalue la situation géopolitique pertinente pour le segment. Stable, tensions structurelles, rupture en cours. Identifier les bascules : post-Ukraine 2022 pour défense EU, post-ChatGPT 2022 pour IA, post-COVID pour télétravail, post-PSD2 pour fintech EU.

## Capital VC sur le segment
Évalue l'état du capital VC. Underweight (segment sous-investi, fenêtre contracyclique favorable), balanced, overweight (segment surfinancé, risque de retournement court).

## Cycle de demande
Bas de cycle, montée, plateau, retournement.

## Fenêtre temporelle critique
Identifie si une fenêtre temporelle critique existe pour ce segment. Cas Mistral 2023 sur l'IA générative est un exemple type.

## Opportunité contracyclique
Évalue si le segment offre une opportunité contracyclique (sous-pondéré actuellement, signaux de bascule plausible à 18-36 mois).

## Tendances structurelles
Identifie 3-5 tendances structurelles macro pertinentes pour le segment, en t'appuyant notamment sur les données R&D et FDI quand elles sont disponibles.

## Régulation
Décris l'environnement réglementaire pertinent. Régulation peut être barrière protectrice ou contrainte qui affaiblit.

# RESPECT DU VERDICT DE PERTINENCE

Tu reçois dans le user prompt un bloc "VERDICT DE PERTINENCE" calcule en amont par la matrice de pertinence Prelude. Ce verdict te dit, sur la base de criteres structurels du dossier, si le sous-bloc geopolitique et la lecture cyclique sont applicables full / partial / none. Tu dois respecter strictement ce verdict :

- Si geopolitical = none : le champ "geopolitics" doit dire que l exposition geopolitique n est pas significative pour ce dossier (pas de chaine de composants critiques, pas de presence en zone a risque, pas d intensite energetique). Une phrase courte qui acte la non-applicabilite. Ne fabrique pas un commentaire post-Ukraine ou tensions Moyen-Orient generique. Le partner verra un message clair.

- Si geopolitical = partial : le champ "geopolitics" se concentre uniquement sur les facteurs listes dans le scope du verdict. Tu n elargis pas a un cadre geopolitique global.

- Si geopolitical = full : lecture geopolitique complete sur les facteurs identifies, en differenciant les bascules pertinentes pour le secteur.

- Si cyclical = none : la lecture cyclique se fait avec prudence (cyclePosition = mature par defaut), demandCycle = phrase courte qui acte que la conjoncture n est pas un signal pour ce dossier. structuralTrends evite les references conjoncturelles.

- Si cyclical = partial : lecture cyclique ciblee sur les facteurs du scope.

- Si cyclical = full : lecture cyclique complete avec projections et signaux forward. Si les projections FMI WEO sont presentes dans le summary (PIB projete, inflation projetee, chomage projete), tu les integres explicitement dans demandCycle et structuralTrends en citant FMI WEO comme source.

Ce verdict prevaut sur le cadrage 2026 generique : le partner ne veut pas d un commentaire macro qui s applique a tous les dossiers, il veut un commentaire qui s applique a celui-ci.

# CADRAGE STRUCTUREL 2026 (à intégrer dans toutes tes analyses)

Tu reçois dans le user prompt un bloc "CADRAGE PRELUDE 2026" qui consolide les bornes du marché VC/PE actuel. Tu DOIS l'intégrer dans ton raisonnement, en différenciant explicitement US versus Europe selon la région du dossier :

## Pour un dossier US
- Concentration extrême : top 5 deals = 73,2% du capital Q1 2026, top 5 fonds = 73,1% du fundraising
- 88,8% du capital Q1 2026 va à l'IA
- Bay Area + NY + LA + Boston = 90,9% du capital
- Sentiment marché public à cran post-volatilité février 2026
- Fed tient les taux dans la fourchette 3,50%-3,75%

## Pour un dossier européen
- Marché européen ~6x plus petit annuellement que US (Atomico)
- Pension funds européens sous-allouent au VC (0,009% AUM vs 0,028% US, gap de 3x)
- Sentiment communautaire en hausse (50% optimiste, niveau le plus haut depuis une décennie)
- 28e régime EU-INC attendu Q1 2026, peut être Regulation ou Directive
- Pipeline réglementaire européen 2026 dense (Innovation Act, Savings & Investment Union, AI Development Act, Quantum Act)
- Diversification deeptech (36% du capital VC en deeptech, vs concentration AI labs aux US)

## Voies de sortie 2026 (à mentionner systématiquement dans la lecture macro)
- IPO : fenêtre rouverte mais sélective, réservée aux plus grandes entreprises et secteurs alignés avec priorités politiques (IA, défense, crypto, aerospace)
- M&A par strategique : volume 2025 stable
- Sponsor-to-sponsor : reprise structurelle (+141% vs 2023, base basse)
- Acquisitions par startups VC-backed : nouvelle voie en croissance (38,4% des acquisitions 2025)
- Secondaires (direct + GP-led + continuation funds) : croissance forte, devenu 3e jambe crédible

## Liquidité LP (à mentionner si pertinent pour le contexte du fonds qui instruira le dossier)
- Distributions to NAV à 11% en 2024, plus bas niveau en 10+ ans (Bain)
- Cash flows aux LPs négatifs sur 5 des 6 dernières années
- Fonds bottom quartile peinent à lever leur prochain véhicule (gap 53 points avec top quartile)

# FORMAT JSON OBLIGATOIRE

{
  "cyclePosition": "pre-bascule" ou "bascule" ou "post-bascule" ou "mature",
  "interestRateRegime": "phrase qui qualifie le régime, en s'appuyant sur les chiffres réels",
  "geopolitics": "phrase qui qualifie la situation géopolitique pertinente",
  "vcCapitalOnSegment": "underweight" ou "balanced" ou "overweight",
  "demandCycle": "phrase qui qualifie le cycle de demande",
  "criticalTimingWindow": {
    "exists": true ou false,
    "horizon": "horizon si exists=true",
    "rationale": "phrase explicative"
  },
  "contraryclicalOpportunity": {
    "score": 0-100,
    "rationale": "phrase"
  },
  "structuralTrends": ["tendances structurelles identifiées"],
  "regulatoryEnvironment": "phrase qui qualifie l'environnement réglementaire"
}

# RÈGLES STRICTES POUR L'INTÉGRATION DU CADRAGE 2026

1. structuralTrends doit inclure au moins une tendance issue du cadrage 2026 (concentration, bifurcation marché, voies de sortie alternatives, réglementaire EU si applicable).
2. regulatoryEnvironment doit mentionner explicitement le pipeline EU 2026 si dossier européen, ou les enjeux Section 301 / IEEPA / AI Executive Order si dossier US.
3. geopolitics doit intégrer le sentiment marché applicable (cran US vs optimisme EU).
4. vcCapitalOnSegment doit prendre en compte la concentration : un segment IA aux US est techniquement overweight pour les cinq licornes top mais peut être underweight pour les challengers hors top 5.
5. Citations : tu peux référencer "PitchBook Q1 2026" ou "Atomico SoET 2025" ou "Bain PE 2025" dans tes phrases sans les détailler.

Note : tu disposes de connaissance jusqu'à début 2026. Sois explicite sur les bascules récentes.`;

export async function analyzeMacro(
  extraction: ExtractionOutput,
  fundNote?: string | null,
  relevanceMatrix?: RelevanceMatrix | null,
): Promise<MacroAnalysisOutput & { realData?: MacroSnapshot; weoData?: ImfWeoSnapshot }> {
  // ÉTAPE 1 : Récupération des indicateurs macro réels du pays (timeout 8s pour éviter de bloquer le pipeline)
  const realData = await Promise.race([
    gatherMacroRealData(extraction.country || 'France'),
    new Promise<MacroSnapshot>((resolve) => setTimeout(() => resolve({
      country: extraction.country || 'France',
      sourcesQueried: ['timeout'],
      sourcesFound: [],
      indicators: {},
    } as any), 8000)),
  ]);

  // ÉTAPE 1b : Récupération des projections FMI WEO conditionnée par
  // la sensibilite macro du dossier. Sur les dossiers ou macroSensitivity
  // est medium ou high (DTC consumer milieu de gamme, retail, hospitality,
  // marketplace B2C, fintech taux-sensitive), la trajectoire de croissance
  // et d inflation a 24-36 mois est un signal critique. Sur les autres
  // dossiers (B2B SaaS verticalise, infra publique, services regules),
  // on saute le fetch pour epargner un appel reseau et garder la note
  // focalisee.
  const macroSensitivity = relevanceMatrix?.macroSensitivity ?? 'low';
  const fetchWeo = macroSensitivity === 'medium' || macroSensitivity === 'high';
  const weoData = fetchWeo
    ? await Promise.race([
        gatherImfWeoSnapshot(extraction.country || 'France'),
        new Promise<ImfWeoSnapshot>((resolve) => setTimeout(() => resolve({
          country: extraction.country || 'France',
          sourcesQueried: ['timeout'],
          sourcesFound: [],
          indicators: {},
          derivedMetrics: {},
        } as ImfWeoSnapshot), 8000)),
      ])
    : null;

  // ÉTAPE 2 : Construire le résumé pour Claude
  let summary = `\n--- DONNÉES MACRO RÉELLES (World Bank API) ---\n`;
  summary += `Pays : ${realData.country}\n`;
  summary += `Sources interrogées : ${(realData.sourcesQueried || []).join(', ') || 'aucune'}\n`;
  summary += `Sources avec résultats : ${(realData.sourcesFound || []).join(', ') || 'aucune'}\n\n`;

  const indicators = realData.indicators || {};
  const derivedMetrics = realData.derivedMetrics || {};

  if (indicators.gdpGrowth && indicators.gdpGrowth.length > 0) {
    summary += `Croissance PIB (5 dernières années) :\n`;
    indicators.gdpGrowth.slice(0, 5).forEach(d => {
      summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
    });
    if (derivedMetrics.growth_trend) {
      summary += `  → Tendance dérivée : ${derivedMetrics.growth_trend}\n`;
    }
  }

  if (indicators.inflation && indicators.inflation.length > 0) {
    summary += `\nInflation (5 dernières années) :\n`;
    indicators.inflation.slice(0, 5).forEach(d => {
      summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
    });
    if (derivedMetrics.inflation_status) {
      summary += `  → Statut dérivé : ${derivedMetrics.inflation_status}\n`;
    }
  }

  if (indicators.interestRate && indicators.interestRate.length > 0) {
    summary += `\nTaux d'intérêt réel (5 dernières années) :\n`;
    indicators.interestRate.slice(0, 5).forEach(d => {
      summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
    });
    if (derivedMetrics.rate_regime) {
      summary += `  → Régime dérivé : ${derivedMetrics.rate_regime}\n`;
    }
  }

  if (indicators.rdSpending && indicators.rdSpending.length > 0) {
    summary += `\nDépenses R&D (% du PIB, dernière donnée disponible) :\n`;
    summary += `  ${indicators.rdSpending[0].date} : ${Number(indicators.rdSpending[0].value).toFixed(2)}%\n`;
  }

  if (indicators.fdiInflows && indicators.fdiInflows.length > 0) {
    summary += `\nFlux IDE entrants (% du PIB, dernière donnée) :\n`;
    summary += `  ${indicators.fdiInflows[0].date} : ${Number(indicators.fdiInflows[0].value).toFixed(2)}%\n`;
  }

  // Projections FMI WEO conditionnees par la sensibilite macro du
  // dossier. Pertinentes uniquement quand la matrice indique medium
  // ou high : l API renvoie historique + projections forward (jusqu a
  // 5 ans), publiees dans le World Economic Outlook (avril, octobre).
  if (weoData && weoData.sourcesFound.length > 0) {
    summary += `\n--- PROJECTIONS FMI WEO (World Economic Outlook) ---\n`;
    summary += `Pays : ${weoData.country}\n`;
    summary += `Activation : sensibilite macro detectee comme ${macroSensitivity} sur ce dossier.\n\n`;

    if (weoData.indicators.gdpGrowthHistorical && weoData.indicators.gdpGrowthHistorical.length > 0) {
      summary += `Croissance PIB historique :\n`;
      weoData.indicators.gdpGrowthHistorical.slice(0, 3).forEach((d) => {
        summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
      });
    }
    if (weoData.indicators.gdpGrowthProjected && weoData.indicators.gdpGrowthProjected.length > 0) {
      summary += `Croissance PIB projetee (FMI WEO) :\n`;
      weoData.indicators.gdpGrowthProjected.forEach((d) => {
        summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
      });
      if (weoData.derivedMetrics.gdp_outlook) {
        summary += `  Outlook derive : ${weoData.derivedMetrics.gdp_outlook}\n`;
      }
    }
    if (weoData.indicators.inflationProjected && weoData.indicators.inflationProjected.length > 0) {
      summary += `\nInflation projetee (FMI WEO) :\n`;
      weoData.indicators.inflationProjected.forEach((d) => {
        summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
      });
      if (weoData.derivedMetrics.inflation_outlook) {
        summary += `  Outlook derive : ${weoData.derivedMetrics.inflation_outlook}\n`;
      }
    }
    if (weoData.indicators.unemploymentProjected && weoData.indicators.unemploymentProjected.length > 0) {
      summary += `\nChomage projete (FMI WEO) :\n`;
      weoData.indicators.unemploymentProjected.slice(0, 3).forEach((d) => {
        summary += `  ${d.date} : ${Number(d.value).toFixed(2)}%\n`;
      });
    }
    summary += `\n`;
  }

  // Detection rapide de la region a partir du pays (logique simplifiee, le moteur
  // benchmarks fait la detection complete mais il s execute en aval).
  const countryLower = (extraction.country || '').toLowerCase();
  const isUs = countryLower.includes('united states') || countryLower === 'us' || countryLower === 'usa' || countryLower.includes('états-unis');
  const europeKeywords = ['france', 'germany', 'allemagne', 'united kingdom', 'uk', 'spain', 'espagne', 'italy', 'italie', 'netherlands', 'pays-bas', 'belgium', 'belgique', 'sweden', 'suède', 'denmark', 'danemark', 'finland', 'finlande', 'ireland', 'irlande', 'portugal', 'austria', 'autriche', 'switzerland', 'suisse', 'poland', 'pologne', 'estonia'];
  const isEurope = europeKeywords.some(kw => countryLower.includes(kw));
  const region: 'US' | 'Europe' | 'Other' = isUs ? 'US' : (isEurope ? 'Europe' : 'Other');

  // Construction du bloc cadrage 2026 differencie selon region
  const cadrageBlock = `
--- CADRAGE PRELUDE 2026 (sources: PitchBook-NVCA Q1 2026, Atomico SoET 2025, Bain PE 2025) ---

## Concentration extreme du marche US Q1 2026
- Top 5 deals = ${MARKET_CONCENTRATION_2026_Q1.topFiveDealsShareOfDealValuePercent}% du capital deploye
  (${MARKET_CONCENTRATION_2026_Q1.topFiveCompaniesNamed.join(', ')})
- Top 5 fonds = ${MARKET_CONCENTRATION_2026_Q1.topFiveFundsShareOfFundraisingPercent}% du fundraising
  (${MARKET_CONCENTRATION_2026_Q1.topFundsNamed.slice(0, 5).join(', ')})
- Experienced firms = ${MARKET_CONCENTRATION_2026_Q1.experiencedFirmsShareOfCapitalRaisedPercent}% du capital leve (record historique)

## Profondeur de marche US vs Europe
- US deploiement Q1 2026 = ${MARKET_DEPTH_2025_2026.us.q1_2026_investmentBillionsUsd} milliards
- Europe deploiement annuel 2025 ~${MARKET_DEPTH_2025_2026.europe.annualInvestmentBillionsUsd2025} milliards
- Ratio : le marche US deploie en 1 trimestre ~${MARKET_DEPTH_2025_2026.ratio.usQ1OverEuropeAnnual.toFixed(1)}x ce que l Europe deploie en 1 an

## Liquidite LP (toutes geos)
- Distributions to NAV 2024 = ${LP_LIQUIDITY_PRESSURE.distributionsToNavPercent2024}% (plus bas niveau en 10+ ans)
- Cash flows aux LPs negatifs sur ${LP_LIQUIDITY_PRESSURE.cashFlowsNegativeYearsOutOfLast6} des 6 dernieres annees
- Top quartile fonds: +53% sur fund successeur ; bottom quartile: 0%

## Fundraising bifurque 2026
- Median fund size US Q1 2026: ${FUNDRAISING_BIFURCATION_2026.medianFundSizeMillionsUsdQ1_2026}M$ (vs ${FUNDRAISING_BIFURCATION_2026.medianFundSizeMillionsUsd2025}M$ en 2025)
- Average fund size US Q1 2026: ${FUNDRAISING_BIFURCATION_2026.averageFundSizeMillionsUsdQ1_2026}M$ (la moyenne explose, la mediane chute = bifurcation extreme)
- First-time funds Q1 2026: ${FUNDRAISING_BIFURCATION_2026.firstTimeFundsCountQ1_2026} seulement

## Voies de sortie 2026
- IPO: fenetre rouverte mais selective (15 IPOs Q1 2026, pace ~60/an)
- M&A par strategique: stable
- Sponsor-to-sponsor: reprise (+141% vs 2023, base basse)
- Acquisitions par startups VC-backed: nouvelle voie en croissance
- Secondaires: 94,9 milliards TTM Q3 2025, devenu 3eme jambe credible

## Pension funds VC allocation (% AUM)
- US: ${PENSION_FUND_VC_ALLOCATION_2024.usPercentOfAum}% | Europe: ${PENSION_FUND_VC_ALLOCATION_2024.europePercentOfAum}% (gap 3x)
- France-Benelux: ${PENSION_FUND_VC_ALLOCATION_2024.byEuropeanRegion.franceBenelux}% | UK-Ireland: ${PENSION_FUND_VC_ALLOCATION_2024.byEuropeanRegion.ukAndIreland}%

${region === 'US' ? `
## Specifique US (dossier ${extraction.country})
- Sentiment: ${US_MARKET_SENTIMENT_2026_Q1.publicSoftwareEquityMultiples} sur les multiples software publics
- Narratif IA en mutation: ${US_MARKET_SENTIMENT_2026_Q1.aiNarrative}
- Job cuts attribuees a l IA Q1 2026: ${US_MARKET_SENTIMENT_2026_Q1.techJobCutsAttributedToAi2026Q1Percent}%
- Fed: taux maintenus dans la fourchette ${US_MARKET_SENTIMENT_2026_Q1.fedRateRangeExpected2026}
` : ''}

${region === 'Europe' ? `
## Specifique Europe (dossier ${extraction.country})
- Investissement total 2025: ${EUROPEAN_MACRO_2025.totalInvestmentBillionsUsd} milliards
- Sentiment ecosysteme: ${EUROPEAN_TECH_SENTIMENT_2025.optimisticPercent}% optimistes (vs ${EUROPEAN_TECH_SENTIMENT_2025.optimisticPercentPriorYear}% en 2024) - niveau le plus haut depuis une decennie
- Ecosysteme valorise a ${EUROPEAN_TECH_SENTIMENT_2025.ecosystemValueTrillionsUsd}T$ = ${EUROPEAN_TECH_SENTIMENT_2025.ecosystemValueShareOfGdpPercent}% du PIB europeen
- Nouveaux fondateurs 2025: ${EUROPEAN_MACRO_2025.newFoundersCount} (+${EUROPEAN_MACRO_2025.newFoundersGrowthVs2023Percent}% vs 2023)

Pipeline reglementaire EU 2026:
${EUROPEAN_REGULATORY_PIPELINE_2026.initiatives.map(i => `- ${i.name} (${i.timeline})`).join('\n')}

Attention: ${EUROPEAN_REGULATORY_PIPELINE_2026.founderSurveyRestrictivePercent}% des fondateurs jugent l environnement EU restrictif.
` : ''}
`;

  // Bloc verdict de pertinence : indique au LLM si geopolitique et
  // conjoncture sont applicables au dossier. Le moteur s adapte en
  // consequence. Si pas de matrice fournie, comportement legacy
  // (always-on sur tous les sous-blocs).
  const relevanceBlock = relevanceMatrix
    ? `
--- VERDICT DE PERTINENCE (matrice Prelude) ---

Sous-bloc GEOPOLITIQUE : ${relevanceMatrix.verdicts.macroGeopolitical.applicable.toUpperCase()}
${relevanceMatrix.verdicts.macroGeopolitical.scope.length > 0 ? `Facteurs identifies : ${relevanceMatrix.verdicts.macroGeopolitical.scope.join(', ')}` : ''}
Rationale : ${relevanceMatrix.verdicts.macroGeopolitical.rationale}

Sous-bloc CYCLIQUE et CONJONCTURE : ${relevanceMatrix.verdicts.macroCyclical.applicable.toUpperCase()}
${relevanceMatrix.verdicts.macroCyclical.scope.length > 0 ? `Facteurs identifies : ${relevanceMatrix.verdicts.macroCyclical.scope.join(', ')}` : ''}
Rationale : ${relevanceMatrix.verdicts.macroCyclical.rationale}

Criteres structurels detectes :
- Asset class : ${relevanceMatrix.assetClass}
- Modele business : ${relevanceMatrix.businessModel}
- Chaine de production : ${relevanceMatrix.productionChain}
- Exposition supply chain : ${relevanceMatrix.supplyChainExposure}${relevanceMatrix.supplyChainExposureFactors.length > 0 ? ` (${relevanceMatrix.supplyChainExposureFactors.join(', ')})` : ''}
- Exposition geopolitique : ${relevanceMatrix.geopoliticalExposure}${relevanceMatrix.geopoliticalExposureFactors.length > 0 ? ` (${relevanceMatrix.geopoliticalExposureFactors.join(', ')})` : ''}
- Sensibilite macro : ${relevanceMatrix.macroSensitivity}${relevanceMatrix.macroSensitivityFactors.length > 0 ? ` (${relevanceMatrix.macroSensitivityFactors.join(', ')})` : ''}

Tu adaptes ta reponse au verdict ci-dessus. Si applicable=none sur un sous-bloc, tu remplis le champ JSON avec une phrase courte qui acte la non-applicabilite, sans inventer un commentaire generique.
`
    : '';

  const userPrompt = `# DOSSIER À ANALYSER (extraction du pitch deck)
Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Géographie : ${extraction.geographicHub}, ${extraction.country}
Année fondation : ${extraction.yearFounded && extraction.yearFounded > 0 ? extraction.yearFounded : "non renseignée"}

Produit : ${extraction.productDescription}
Business model : ${extraction.businessModel}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount}

${summary}

${cadrageBlock}
${relevanceBlock}

Produis la lecture macro complète au format JSON structuré demandé. Croise :
1. Les données réelles World Bank récupérées
2. Le cadrage Prélude 2026 ci-dessus (concentration, liquidité LP, voies de sortie, spécificités régionales)
3. Ta connaissance des bascules sectorielles récentes
${relevanceMatrix ? '4. Le VERDICT DE PERTINENCE qui scope ta reponse sur les sous-blocs applicables au dossier.' : ''}

Region detectee du dossier: ${region}.
Le cadrage doit etre differencie selon cette region. Pour un dossier europeen, mentionne explicitement les benchmarks Atomico et le pipeline reglementaire EU 2026. Pour un dossier US, mentionne la concentration extreme et le sentiment public.

# WEB SEARCH (si disponible)
Si le tool web_search est disponible, utilise-le PARCIMONIEUSEMENT pour
verifier des donnees macro tres recentes qui peuvent affecter le dossier :
  - Annonces reglementaires recentes du secteur (lois EU/US passees)
  - Mouvements geopolitiques majeurs affectant le secteur
  - Tendances de financement VC du secteur sur les 6 derniers mois
2 recherches max. Privilegier les donnees pre-2026 deja dans le contexte.${buildFundNoteBlock(fundNote, 'macro')}`;

  // Niveau 2.A : web search active sur 2 recherches max (le moteur Macro
  // a deja beaucoup de donnees structurees, on cherche juste a verifier
  // les nouveautes)
  const rawResponse = await callClaude(
    SYSTEM_PROMPT,
    userPrompt,
    9000,
    undefined,
    { maxWebSearches: 2 },
  );
  const analysis = parseJSON<MacroAnalysisOutput>(rawResponse);

  // Audit du tagging des sources (Niveau 2.B)
  const audit = auditTagging(analysis, 'macro-engine');
  if (audit.level !== 'ok') {
    console.warn('[macro-engine] tagging audit:', audit.message);
  }

  // Post-processing deterministe selon la matrice de pertinence.
  // Extrait en fonction pure pour permettre des tests unitaires
  // independants du LLM et du fetcher reseau.
  applyMacroVerdictPostProcessing(analysis, relevanceMatrix);

  return { ...analysis, realData, weoData: weoData ?? undefined };
}

/**
 * Post-processing deterministe du resultat macro selon la matrice
 * de pertinence. Si la matrice dit qu un sous-bloc n est pas
 * applicable, on ecrase le champ correspondant pour garantir que
 * le rendu final ne contient pas un commentaire generique. Le LLM
 * est invite a respecter le verdict via le system prompt, mais ce
 * post-processing ferme la porte des derives.
 *
 * Mute analysis sur place et le retourne. Si relevanceMatrix est
 * null ou undefined, retourne analysis inchange.
 */
export function applyMacroVerdictPostProcessing(
  analysis: MacroAnalysisOutput,
  relevanceMatrix?: RelevanceMatrix | null,
): MacroAnalysisOutput {
  if (!relevanceMatrix) return analysis;
  if (relevanceMatrix.verdicts.macroGeopolitical.applicable === 'none') {
    analysis.geopolitics = 'Exposition geopolitique non significative pour ce dossier : aucune chaine de composants critiques, aucune presence en zone a risque pays, aucune intensite energetique fossile detectee. La dimension geopolitique n est pas un signal d instruction pour ce dossier.';
  }
  if (relevanceMatrix.verdicts.macroCyclical.applicable === 'none') {
    // On ne force pas cyclePosition a "mature" : le LLM peut
    // legitimement avoir lu un signal de cycle technologique
    // independant de la conjoncture macro consumer. Mais on
    // remplace demandCycle pour eviter le commentaire conjoncturel
    // generique. structuralTrends reste a la main du LLM.
    analysis.demandCycle = 'Modele economique peu sensible a la conjoncture consumer : la dynamique de demande depend d autres facteurs structurels (cycle technologique, regulation, structuration de marche) traites dans structuralTrends.';
  }
  return analysis;
}
