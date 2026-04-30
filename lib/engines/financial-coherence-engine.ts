import { callClaude, parseJSON } from './anthropic-client';
import type {
  ExtractionOutput, FinancialDataExtraction, FinancialCoherenceOutput,
  MarketAnalysisOutput
} from './types';

const SYSTEM_PROMPT = `Tu es le Moteur de Cohérence Financière de la plateforme Prélude. Ta mission est de tester la solidité interne et externe des projections financières du dossier en appliquant 7 tests rigoureux que les meilleurs partners VC font à la main sur Excel.

# CADRE INTELLECTUEL

Un business plan peut être manipulé pour raconter à peu près n'importe quoi. Tu ne cherches pas à savoir si les chiffres sont "vrais" (impossible sans audit), mais si ILS SONT COHÉRENTS entre eux et avec les benchmarks sectoriels.

Tu es CALCULATOIRE, pas narratif. Pour chaque test, tu fais des recalculs explicites à partir des données fournies, tu compares aux standards, et tu lèves un drapeau si l'écart est trop fort.

# LES 7 TESTS DE COHÉRENCE

## T1 - Crosse de hockey suspecte
La projection de revenue suit-elle un pattern de croissance hyperbolique ? Calcul : ratios CA(N+1)/CA(N) sur la trajectoire. Crosse type x3 → x4 → x5 = signal classique de BP fantasmé. Comparer aux trajectoires réalisées de comparables (Stripe, Notion, Datadog ne dépassent pas x2.5-x3 sustained). Si trois années consécutives à x3+, signal critique.

## T2 - Ratio LTV/CAC implicite
Recalcul du LTV implicite : (ARR moyen par client × durée moyenne en années × marge brute pct/100). Recalcul du CAC implicite : (budget marketing / nouveaux clients acquis). Ratio LTV/CAC. Standards : <3 = non rentable, 3-5 = sain, 5-10 = très bon, >10 = probablement irréaliste. Drapeau si <3 ou >10.

## T3 - Marge brute cohérente
Marge brute = (CA - coûts directs) / CA. Recalcul à partir des données BP. Comparer à la marge brute déclarée. Standards par modèle : SaaS pur 75-85%, Marketplace 15-25%, E-commerce 30-50%, Hardware 20-40%, Software services 40-60%. Drapeau si marge déclarée hors fourchette du modèle économique annoncé.

## T4 - Burn rate vs runway
Burn mensuel projeté = pertes annuelles / 12. Runway = trésorerie disponible (tour actuel) / burn mensuel. Standards : 18-24 mois minimum. <12 mois = signal critique. >36 mois = peut-être surcapitalisation ou hypothèses de croissance trop conservatrices.

## T5 - Incohérence headcount/CA
Ratio CA / employé en année N. Standards : SaaS pur tend vers 150-200K€/employé, Tech profonde 100-150K€, Services tech 80-120K€, Hardware 200-300K€. Drapeau si <50K€/employé en année 3+ (sous-productivité structurelle) ou >500K€/employé (hypothèse irréaliste).

## T6 - Unit economics viables (test Ynsect)
Coût de production unitaire vs prix de vente unitaire. Si perte par unité vendue qui ne se résout pas avec le scale, c'est le pattern Ynsect (2800€ coût vs 2500€ vente, écart x6 avec substitut). Tester : la marge brute par unité est-elle positive ? L'évolution est-elle monotone croissante ? Drapeau critique si marge unitaire négative pendant >3 ans.

## T7 - Cohérence des hypothèses de marché
À partir du CA projeté en année N et du marché total adressable cité, calculer la part de marché implicite. Comparer aux trajectoires réelles : Stripe a atteint 1% du marché paiements en 5 ans, Slack 2% du marché collaboration en 4 ans. Drapeau si part de marché implicite > 5% en moins de 5 ans (probablement irréaliste sauf cas exceptionnel).

# DÉTECTION DES INCOHÉRENCES DECK vs BP

En plus des 7 tests, identifie systématiquement les divergences entre les chiffres du pitch deck et ceux du BP. Un chiffre qui diverge entre les deux sources est un signal de gouvernance défaillante (équipe qui n'a pas un alignement interne sur ses propres projections).

# FORMAT JSON OBLIGATOIRE

{
  "hasFinancialData": true|false,
  "dataSource": "deck"|"bp"|"both"|"none",
  "tests": {
    "crosseHockeySuspecte": { "testId": "T1", "testName": "Crosse de hockey suspecte", "passed": true|false, "score": 0-100, "evidence": "calcul explicite : CA 2025=0.5M, 2026=2.1M (x4.2), 2027=8.5M (x4), 2028=25M (x2.9). Trajectoire hyperbolique sur 3 ans.", "benchmark": "Stripe 2014-2017 a fait x2.3 → x2.1 → x1.8 sustained", "implication": "drapeau modéré : croissance projetée 50% au-dessus des comparables réussies" },
    "ratioLtvCacImplicite": { "testId": "T2", "testName": "Ratio LTV/CAC implicite", "passed": true|false, "score": 0-100, "evidence": "...", "benchmark": "...", "implication": "..." },
    "margeBruteCoherente": { "testId": "T3", "testName": "Marge brute cohérente", "passed": true|false, "score": 0-100, "evidence": "...", "benchmark": "...", "implication": "..." },
    "burnRateRunway": { "testId": "T4", "testName": "Burn rate vs runway", "passed": true|false, "score": 0-100, "evidence": "...", "benchmark": "...", "implication": "..." },
    "incoherenceHeadcountCa": { "testId": "T5", "testName": "Incohérence headcount/CA", "passed": true|false, "score": 0-100, "evidence": "...", "benchmark": "...", "implication": "..." },
    "unitEconomicsViables": { "testId": "T6", "testName": "Unit economics viables", "passed": true|false, "score": 0-100, "evidence": "...", "benchmark": "...", "implication": "..." },
    "coherenceHypothesesMarche": { "testId": "T7", "testName": "Cohérence hypothèses marché", "passed": true|false, "score": 0-100, "evidence": "...", "benchmark": "...", "implication": "..." }
  },
  "globalCoherenceScore": 0-100,
  "alertesCritiques": ["alerte 1", "alerte 2"],
  "incoherenceDeckVsBP": ["chiffre X dans deck = 5M, dans BP = 8M, écart non expliqué"],
  "syntheseCoherence": "synthèse 4-6 phrases dense",
  "recalculsEffectues": [
    { "metric": "Marge brute 2026", "declaredValue": "70%", "recalculatedValue": "58%", "discrepancy": "écart 12 points, BP affiche marge SaaS sur structure de coûts mixte" }
  ]
}

# RÈGLES STRICTES

- "score" : 100 = test passé brillamment, 70 = passé avec réserve, 40 = échec partiel, 0 = échec critique
- "passed" : true si score >= 60
- "evidence" doit contenir des CALCULS EXPLICITES, pas des observations vagues
- Si données insuffisantes pour un test, score = 50 et evidence = "données insuffisantes pour recalcul rigoureux : [détail manquant]"
- Si AUCUNE donnée financière (hasFinancialData = false), tous les tests à score 0 avec evidence "aucune donnée financière disponible"
- "globalCoherenceScore" = moyenne pondérée des 7 tests, avec pondération forte sur T1, T6, T7 (les plus prédictifs)
- Maximum 5 incoherenceDeckVsBP citées, les plus significatives
- Pas de complaisance : si le BP est cohérent, dis-le clairement. Si pas, dis-le aussi.`;

export async function analyzeFinancialCoherence(
  extraction: ExtractionOutput,
  financialData: FinancialDataExtraction,
  market: MarketAnalysisOutput
): Promise<FinancialCoherenceOutput> {

  // Si aucune donnée financière, retour court-circuit
  if (!financialData.hasBP && financialData.revenueProjection.length === 0) {
    return {
      hasFinancialData: false,
      dataSource: 'none',
      tests: {
        crosseHockeySuspecte: { testId: 'T1', testName: 'Crosse de hockey suspecte', passed: false, score: 0, evidence: 'aucune donnée financière disponible', benchmark: 'N/A', implication: 'analyse impossible sans BP' },
        ratioLtvCacImplicite: { testId: 'T2', testName: 'Ratio LTV/CAC implicite', passed: false, score: 0, evidence: 'aucune donnée financière disponible', benchmark: 'N/A', implication: 'analyse impossible sans BP' },
        margeBruteCoherente: { testId: 'T3', testName: 'Marge brute cohérente', passed: false, score: 0, evidence: 'aucune donnée financière disponible', benchmark: 'N/A', implication: 'analyse impossible sans BP' },
        burnRateRunway: { testId: 'T4', testName: 'Burn rate vs runway', passed: false, score: 0, evidence: 'aucune donnée financière disponible', benchmark: 'N/A', implication: 'analyse impossible sans BP' },
        incoherenceHeadcountCa: { testId: 'T5', testName: 'Incohérence headcount/CA', passed: false, score: 0, evidence: 'aucune donnée financière disponible', benchmark: 'N/A', implication: 'analyse impossible sans BP' },
        unitEconomicsViables: { testId: 'T6', testName: 'Unit economics viables', passed: false, score: 0, evidence: 'aucune donnée financière disponible', benchmark: 'N/A', implication: 'analyse impossible sans BP' },
        coherenceHypothesesMarche: { testId: 'T7', testName: 'Cohérence hypothèses marché', passed: false, score: 0, evidence: 'aucune donnée financière disponible', benchmark: 'N/A', implication: 'analyse impossible sans BP' },
      },
      globalCoherenceScore: 0,
      alertesCritiques: ['Aucune donnée financière exploitable. Demander BP au fondateur avant de poursuivre l\'instruction.'],
      incoherenceDeckVsBP: [],
      syntheseCoherence: 'Aucune donnée financière exploitable dans les documents fournis. La plateforme ne peut pas tester la cohérence des projections. Étape obligatoire avant de poursuivre l\'instruction : récupérer un business plan structuré du fondateur.',
      recalculsEffectues: [],
    };
  }

  const userPrompt = `Tests de cohérence financière sur le dossier ${extraction.companyName} :

# CONTEXTE
Société : ${extraction.companyName}
Secteur : ${extraction.sector} / ${extraction.subSector}
Modèle économique : ${extraction.businessModel}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount}

# DONNÉES FINANCIÈRES EXTRAITES
Source : ${financialData.fileSource}
BP disponible : ${financialData.hasBP}

## Projection revenue (M€)
${financialData.revenueProjection.map(r => `${r.year}: ${r.value}M€ (source: ${r.source})`).join('\n') || 'aucune'}

## Marge brute projetée (%)
${financialData.grossMarginProjection.map(r => `${r.year}: ${r.value}% (source: ${r.source})`).join('\n') || 'aucune'}

## EBITDA projeté (M€)
${financialData.ebitdaProjection.map(r => `${r.year}: ${r.value}M€ (source: ${r.source})`).join('\n') || 'aucune'}

## Free Cash Flow projeté (M€)
${financialData.fcfProjection.map(r => `${r.year}: ${r.value}M€ (source: ${r.source})`).join('\n') || 'aucune'}

## OPEX projeté (M€)
${financialData.opexProjection.map(r => `${r.year}: ${r.value}M€ (source: ${r.source})`).join('\n') || 'aucune'}

## Headcount projeté
${financialData.headcount.map(r => `${r.year}: ${r.value} employés (source: ${r.source})`).join('\n') || 'aucune'}

## Unit Economics
- CAC estimé : ${financialData.unitEconomics.estimatedCAC}
- LTV estimé : ${financialData.unitEconomics.estimatedLTV}
- Ratio LTV/CAC : ${financialData.unitEconomics.estimatedLtvCacRatio}
- ACV : ${financialData.unitEconomics.averageContractValue}
- Marge brute / unité : ${financialData.unitEconomics.grossMarginPerUnit}

## Tour actuel et runway
- Montant : ${financialData.currentRound.amount}
- Runway : ${financialData.currentRound.runwayMonths} mois
- Burn mensuel : ${financialData.currentRound.monthlyBurn}

## Hypothèses marché
- TAM : ${financialData.marketAssumptions.tamCited}
- SAM : ${financialData.marketAssumptions.samCited}
- Part de marché cible : ${financialData.marketAssumptions.targetMarketShare}
- Clients en année N : ${financialData.marketAssumptions.targetCustomersByYearN}

## Notes complémentaires
${financialData.rawNotes || '(aucune)'}

# CONTEXTE MARCHÉ (moteur Marché)
- Taille perçue : ${market.perceivedSize}
- Saturation : ${market.saturation}
- Intensité besoin : ${market.needIntensity.score}/100

Applique les 7 tests de cohérence avec recalculs explicites. Identifie les incohérences deck vs BP si applicable. Calcule le score global. Synthétise.

Retourne uniquement le JSON structuré.`;

  const rawResponse = await callClaude(SYSTEM_PROMPT, userPrompt, 3500);
  return parseJSON<FinancialCoherenceOutput>(rawResponse);
}
