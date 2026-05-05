// ============================================================
// MOTEUR DD FINANCIER (Module 1 DD financiere - etape 2)
// ------------------------------------------------------------
// Confronte le BP projete au grand livre comptable reel pour
// produire l audit financier d un partner senior. Sept tests
// chiffres avec evidence cote a cote, ecarts en pourcentage,
// severity, et synthese editoriale niveau memo de comite
// d investissement.
//
// Le moteur ne tourne pas si l un des deux inputs est absent
// (BP non fourni ou grand livre non uploade). Sinon une appel
// LLM Sonnet en fin de pipeline pour la synthese editoriale.
//
//   T1 ecart CA declare vs CA reel (deterministe)
//   T2 marge brute projetee vs reelle (deterministe)
//   T3 burn rate declare vs reel (deterministe)
//   T4 headcount declare vs charges salariales reelles (deterministe)
//   T5 concentration client reelle vs narratif pitch (deterministe + LLM)
//   T6 trajectoire recente vs crosse de hockey BP (deterministe)
//   T7 engagements hors bilan vs cash et narratif pitch (deterministe + LLM)
//
// Verdict descriptif sur 4 niveaux :
//   - dd_aligned : BP et realite comptable alignes (<=1 alerte mineure)
//   - dd_partial_alignment : alignement partiel (1 alerte significative
//     ou 2-3 ecarts sectoriels)
//   - dd_significant_gaps : ecarts significatifs sur plusieurs postes
//     (4+ alertes ou ecart structurel sur poste central)
//   - dd_red_flags : signaux red flag majeurs (sous-estimation runway,
//     concentration masquee, ecart CA > 50%, marge negative non
//     documentee)
//   - not_applicable : ledger ou BP absent
// ============================================================

import type { ExtractionOutput, FinancialDataExtraction } from './types';
import type { LedgerExtraction } from '../ledger-parser';
import { callClaude, parseJSON, MODEL } from './anthropic-client';

// ============================================================
// Types
// ============================================================

export interface DDFinancialTest {
  testId: string;
  testName: string;
  // Severity descriptive : aligned, attention, alert, red_flag
  severity: 'aligned' | 'attention' | 'alert' | 'red_flag' | 'not_assessable';
  // Valeurs cote a cote (texte humain)
  bpValue: string;       // ce que le pitch / BP annonce
  realValue: string;     // ce que le grand livre montre
  gapPct: number | null; // ecart en pourcentage si calculable
  evidence: string;      // calcul detaille en clair
  ddQuestion: string;    // question DD a poser au fondateur
}

export interface DDFinancialOutput {
  triggered: boolean;     // true si BP + ledger presents
  // Quand le moteur ne tourne pas, raison explicite a afficher
  reasonNotTriggered?: string;
  // Periode du grand livre
  ledgerPeriod: { start: string | null; end: string | null };
  // 7 tests
  tests: {
    revenueGap: DDFinancialTest;          // T1
    grossMarginGap: DDFinancialTest;      // T2
    burnRateGap: DDFinancialTest;         // T3
    headcountGap: DDFinancialTest;        // T4
    clientConcentration: DDFinancialTest; // T5
    growthTrajectory: DDFinancialTest;    // T6
    offBalanceVsNarrative: DDFinancialTest; // T7
  };
  // Score global 0-100 : 100 = parfait alignement, 0 = red flags partout
  globalScore: number;
  verdict:
    | 'dd_aligned'
    | 'dd_partial_alignment'
    | 'dd_significant_gaps'
    | 'dd_red_flags'
    | 'not_applicable';
  questionsToInstruct: string[]; // 5-8 questions DD prioritaires
  synthesis: string; // memo editorial 5-7 phrases
}

// ============================================================
// Helpers
// ============================================================

function formatEur(amount: number): string {
  if (!Number.isFinite(amount)) return 'n.a.';
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M EUR`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}k EUR`;
  }
  return `${amount.toFixed(0)} EUR`;
}

function formatPct(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return 'n.a.';
  return `${pct.toFixed(1)}%`;
}

function parseNumberFromString(s: string | null | undefined): number | null {
  if (!s) return null;
  // Cherche le premier nombre dans la chaine. Gere "25k", "1.5M", "300 000 EUR"
  const cleaned = s.replace(/\s/g, '').toLowerCase();
  // Pattern : nombre suivi optionnellement de k|m
  const m = cleaned.match(/(-?\d+(?:[.,]\d+)?)\s*([km])?/);
  if (!m) return null;
  let value = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  if (m[2] === 'k') value *= 1_000;
  if (m[2] === 'm') value *= 1_000_000;
  return value;
}

function getCurrentYearProjection(
  projection: Array<{ year: string; value: number; source: string }>,
  refDate: Date,
): { year: string; valueEur: number } | null {
  if (!projection || projection.length === 0) return null;
  const refYear = refDate.getFullYear();
  // Cherche la projection pour l annee courante (ou la premiere disponible)
  const exact = projection.find(p => p.year === String(refYear));
  if (exact) return { year: exact.year, valueEur: exact.value * 1_000_000 };
  // Sinon prendre la premiere (souvent l annee 1 du BP)
  const first = projection[0];
  return { year: first.year, valueEur: first.value * 1_000_000 };
}

function getNextYearProjection(
  projection: Array<{ year: string; value: number; source: string }>,
): { year: string; valueEur: number } | null {
  if (!projection || projection.length < 2) return null;
  const second = projection[1];
  return { year: second.year, valueEur: second.value * 1_000_000 };
}

// ============================================================
// Tests deterministes
// ============================================================

function testRevenueGap(
  fd: FinancialDataExtraction,
  ledger: LedgerExtraction,
): DDFinancialTest {
  const refDate = ledger.periodEnd ? new Date(ledger.periodEnd) : new Date();
  const projected = getCurrentYearProjection(fd.revenueProjection, refDate);
  const real = ledger.realRevenue.last12MonthsTotal;

  if (!projected) {
    return {
      testId: 'T1',
      testName: 'Ecart CA declare vs CA reel',
      severity: 'not_assessable',
      bpValue: 'BP : projection CA annee courante non extractible',
      realValue: `Grand livre : ${formatEur(real)} sur 12 derniers mois`,
      gapPct: null,
      evidence: 'Le BP ne contient pas de projection CA exploitable pour l annee courante. Test non realisable.',
      ddQuestion: 'Pouvez-vous fournir la projection CA detaillee mois par mois pour l annee en cours ?',
    };
  }

  const gap = real - projected.valueEur;
  const gapPct = projected.valueEur > 0 ? (gap / projected.valueEur) * 100 : null;
  const absGapPct = gapPct !== null ? Math.abs(gapPct) : 0;

  let severity: DDFinancialTest['severity'] = 'aligned';
  if (absGapPct >= 50) severity = 'red_flag';
  else if (absGapPct >= 30) severity = 'alert';
  else if (absGapPct >= 15) severity = 'attention';

  const direction = gap < 0 ? 'sous-realisation' : 'sur-realisation';

  return {
    testId: 'T1',
    testName: 'Ecart CA declare vs CA reel',
    severity,
    bpValue: `BP ${projected.year} : ${formatEur(projected.valueEur)}`,
    realValue: `Grand livre 12M : ${formatEur(real)}`,
    gapPct,
    evidence: `Le BP projette ${formatEur(projected.valueEur)} sur l annee ${projected.year}. Le CA reel constate sur les 12 derniers mois du grand livre est de ${formatEur(real)}. Ecart : ${formatPct(gapPct)} (${direction}).`,
    ddQuestion: severity === 'aligned'
      ? 'Le CA realise est aligne sur le BP. Confirmer la trajectoire pour les trimestres restants.'
      : `Comment justifier la ${direction} de ${formatPct(gapPct)} entre BP et reel ? Quels sont les facteurs operationnels (deals retardes, contrats signes en avance, saisonnalite) qui expliquent cet ecart ?`,
  };
}

function testGrossMarginGap(
  fd: FinancialDataExtraction,
  ledger: LedgerExtraction,
): DDFinancialTest {
  const refDate = ledger.periodEnd ? new Date(ledger.periodEnd) : new Date();
  const projected = getCurrentYearProjection(fd.grossMarginProjection, refDate);
  const real = ledger.realGrossMargin.pctOfRevenue;

  if (!projected || real === null) {
    return {
      testId: 'T2',
      testName: 'Marge brute projetee vs reelle',
      severity: 'not_assessable',
      bpValue: projected ? `BP : ${formatPct(projected.valueEur / 10000)}` : 'BP : marge brute non extractible',
      realValue: real !== null ? `Grand livre : ${formatPct(real)}` : 'Grand livre : marge brute non calculable',
      gapPct: null,
      evidence: 'Donnees insuffisantes pour confronter la marge brute projetee a la realite comptable.',
      ddQuestion: 'Pouvez-vous fournir la decomposition detaillee de la marge brute projetee (CA - achats - services exterieurs) ?',
    };
  }

  // Note: grossMarginProjection.value est en pct (selon comment) - ici on suppose pct direct
  const projectedPct = projected.valueEur / 1_000_000; // si stocke en value*1M, on retire le multiplicateur
  // Actually selon types.ts: grossMarginProjection est `{value: number}` avec commentaire "pct"
  // Donc value est deja un pourcentage, pas une valeur en millions. On corrige.
  const projPctActual = fd.grossMarginProjection.find(p => p.year === projected.year)?.value
                     ?? fd.grossMarginProjection[0]?.value
                     ?? 0;

  const gapPoints = real - projPctActual;
  const absGapPoints = Math.abs(gapPoints);

  let severity: DDFinancialTest['severity'] = 'aligned';
  if (real < 0) severity = 'red_flag';
  else if (absGapPoints >= 25) severity = 'red_flag';
  else if (absGapPoints >= 15) severity = 'alert';
  else if (absGapPoints >= 8) severity = 'attention';

  const direction = gapPoints < 0 ? 'sous-realisation' : 'sur-realisation';

  return {
    testId: 'T2',
    testName: 'Marge brute projetee vs reelle',
    severity,
    bpValue: `BP ${projected.year} : ${formatPct(projPctActual)}`,
    realValue: `Grand livre 12M : ${formatPct(real)}`,
    gapPct: gapPoints,
    evidence: `Le BP projette ${formatPct(projPctActual)} de marge brute pour ${projected.year}. La marge brute reelle calculee sur le grand livre 12 mois (produits - achats classe 60 - services exterieurs classe 61 et 62) ressort a ${formatPct(real)}. Ecart : ${gapPoints >= 0 ? '+' : ''}${gapPoints.toFixed(1)} points (${direction}).`,
    ddQuestion: real < 0
      ? 'Marge brute reelle negative : les charges directes excedent les produits. Quel est le plan operationnel pour basculer en marge positive et a quel horizon ?'
      : severity === 'aligned'
      ? 'Marge brute en ligne avec le BP. Documenter la stabilite attendue sur les exercices a venir.'
      : `Comment expliquer l ecart de ${gapPoints.toFixed(1)} points entre la marge brute projetee et la marge reelle constatee ? Effet mix produits, evolution prix achats, services exterieurs sous-estimes ?`,
  };
}

function testBurnRateGap(
  fd: FinancialDataExtraction,
  ledger: LedgerExtraction,
): DDFinancialTest {
  const declaredBurn = parseNumberFromString(fd.currentRound?.monthlyBurn);
  const realBurn = ledger.burnAndRunway.avgMonthlyBurn6m;

  if (declaredBurn === null || realBurn === null) {
    return {
      testId: 'T3',
      testName: 'Burn rate declare vs reel',
      severity: 'not_assessable',
      bpValue: declaredBurn !== null ? formatEur(declaredBurn) : 'Burn declare non extractible du pitch',
      realValue: realBurn !== null ? formatEur(realBurn) : 'Burn reel non calculable (cash variation insuffisante sur 6 mois)',
      gapPct: null,
      evidence: 'Donnees insuffisantes pour confronter le burn declare au burn reel.',
      ddQuestion: 'Pouvez-vous fournir le detail du burn mensuel des 6 derniers mois et la decomposition (charges fixes, masse salariale, services) ?',
    };
  }

  const gap = realBurn - declaredBurn;
  const gapPct = declaredBurn > 0 ? (gap / declaredBurn) * 100 : null;
  const absGapPct = gapPct !== null ? Math.abs(gapPct) : 0;

  let severity: DDFinancialTest['severity'] = 'aligned';
  // Sous-estimation du burn = signal critique (le runway annonce ne tient pas)
  if (gap > 0 && absGapPct >= 50) severity = 'red_flag';
  else if (gap > 0 && absGapPct >= 25) severity = 'alert';
  else if (absGapPct >= 25) severity = 'attention'; // sur-estimation = moins grave
  else if (absGapPct >= 15) severity = 'attention';

  const direction = gap > 0 ? 'sous-estimation' : 'sur-estimation';

  return {
    testId: 'T3',
    testName: 'Burn rate declare vs reel',
    severity,
    bpValue: `Pitch / BP : ${formatEur(declaredBurn)}/mois`,
    realValue: `Grand livre 6M : ${formatEur(realBurn)}/mois (variation cash bancaire)`,
    gapPct,
    evidence: `Le pitch annonce un burn mensuel de ${formatEur(declaredBurn)}. Le burn reel calcule comme variation du cash bancaire sur les 6 derniers mois divisee par 6 ressort a ${formatEur(realBurn)}/mois. Ecart : ${formatPct(gapPct)} (${direction}).`,
    ddQuestion: gap > 0 && absGapPct >= 25
      ? `Le burn reel est ${formatPct(gapPct)} superieur au burn declare. Le runway communique aux investisseurs sous-estime la pression cash. Quel est le burn structurel reel et quel est le runway recalcule ?`
      : severity === 'aligned'
      ? 'Burn declare en ligne avec la realite. Confirmer la stabilite attendue.'
      : `Quels sont les postes qui expliquent l ecart entre burn declare et reel ? Charges exceptionnelles ponctuelles, decalages de tresorerie, encaissements non recurrents ?`,
  };
}

function testHeadcountGap(
  fd: FinancialDataExtraction,
  ledger: LedgerExtraction,
): DDFinancialTest {
  const declaredHc = fd.headcount?.[0]?.value || null;
  const realPersonnelCharges = ledger.realCharges.breakdownByClass.class64; // 64x = personnel
  // Estimation : un cout employeur charge moyen FR = 55k EUR/an (mid-point 45-65k)
  const COST_PER_EMPLOYEE = 55_000;
  const impliedHc = realPersonnelCharges > 0 ? Math.round(realPersonnelCharges / COST_PER_EMPLOYEE) : null;

  if (declaredHc === null || impliedHc === null) {
    return {
      testId: 'T4',
      testName: 'Headcount declare vs charges salariales reelles',
      severity: 'not_assessable',
      bpValue: declaredHc !== null ? `${declaredHc} ETP` : 'Headcount declare non extractible',
      realValue: impliedHc !== null ? `~${impliedHc} ETP implicite (${formatEur(realPersonnelCharges)} de charges 64x)` : 'Charges 64x non disponibles',
      gapPct: null,
      evidence: 'Donnees insuffisantes pour confronter le headcount declare aux charges salariales reelles.',
      ddQuestion: 'Pouvez-vous fournir le headcount detaille au dernier bulletin de paie avec ventilation par fonction et le total annuel des charges salariales chargees ?',
    };
  }

  const gap = declaredHc - impliedHc;
  const gapPct = impliedHc > 0 ? (gap / impliedHc) * 100 : null;
  const absGapPct = gapPct !== null ? Math.abs(gapPct) : 0;

  let severity: DDFinancialTest['severity'] = 'aligned';
  if (absGapPct >= 50) severity = 'alert';
  else if (absGapPct >= 30) severity = 'attention';

  return {
    testId: 'T4',
    testName: 'Headcount declare vs charges salariales reelles',
    severity,
    bpValue: `Pitch / BP : ${declaredHc} ETP`,
    realValue: `Implicite ~${impliedHc} ETP (${formatEur(realPersonnelCharges)} de charges 64x sur 12 mois, base 55k EUR/an chargee)`,
    gapPct,
    evidence: `Le pitch annonce ${declaredHc} ETP. Les charges classe 64 sur les 12 derniers mois s elevent a ${formatEur(realPersonnelCharges)}, ce qui implique environ ${impliedHc} ETP equivalents sur la base d un cout employeur charge moyen de 55k EUR/an. Ecart : ${formatPct(gapPct)}.`,
    ddQuestion: severity === 'aligned'
      ? 'Headcount declare coherent avec les charges salariales constatees. Confirmer la photo a date avec un dernier registre du personnel.'
      : gap > 0
      ? `Le pitch annonce ${declaredHc} ETP mais les charges 64x suggerent ~${impliedHc} ETP. L ecart peut s expliquer par recrutement recent (ramp-up post-mois M-12), prestations externes en classe 62, ou seniors bas de fourchette. A documenter par registre du personnel et bulletin recent.`
      : `Le pitch annonce ${declaredHc} ETP mais les charges suggerent ~${impliedHc} ETP. Sur-estimation possible : prestataires comptes en classe 62 plutot qu en 64, alternants ou stagiaires comptes hors ETP, ou departs recents. A documenter.`,
  };
}

function testClientConcentration(
  fd: FinancialDataExtraction,
  ledger: LedgerExtraction,
  extraction: ExtractionOutput,
): DDFinancialTest {
  const top = ledger.topClients;
  if (top.length === 0) {
    return {
      testId: 'T5',
      testName: 'Concentration client reelle',
      severity: 'not_assessable',
      bpValue: 'Pitch : narratif client a evaluer',
      realValue: 'Grand livre : aucun compte 411x significatif identifie',
      gapPct: null,
      evidence: 'Les comptes 411x du grand livre ne contiennent pas de soldes significatifs sur les 12 derniers mois.',
      ddQuestion: 'Comment se decompose le portefeuille client en chiffre d affaires ? Top 1, top 3 et top 10 en pourcentage du CA total ?',
    };
  }

  const top1 = top[0];
  const top3Sum = top.slice(0, 3).reduce((s, c) => s + c.revenueLast12Months, 0);
  const totalCA = ledger.realRevenue.last12MonthsTotal;
  const top1Pct = totalCA > 0 ? (top1.revenueLast12Months / totalCA) * 100 : 0;
  const top3Pct = totalCA > 0 ? (top3Sum / totalCA) * 100 : 0;

  let severity: DDFinancialTest['severity'] = 'aligned';
  if (top1Pct >= 40) severity = 'red_flag';
  else if (top1Pct >= 25 || top3Pct >= 70) severity = 'alert';
  else if (top1Pct >= 15 || top3Pct >= 50) severity = 'attention';

  // Heuristique narratif : le pitch mentionne-t-il "diversifie", "non concentre" ?
  const pitchText = `${extraction.marketPitch || ''} ${extraction.businessModel || ''} ${extraction.rawSummary || ''}`.toLowerCase();
  const claimsDiversification = /(portefeuille diversifi|clients diversifi|non concentr|aucun client|repartition equilibr)/.test(pitchText);
  const masking = claimsDiversification && severity !== 'aligned';

  return {
    testId: 'T5',
    testName: 'Concentration client reelle',
    severity: masking ? 'red_flag' : severity,
    bpValue: claimsDiversification ? 'Pitch : portefeuille presente comme diversifie' : 'Pitch : pas de claim de diversification explicite',
    realValue: `Top 1 : ${formatPct(top1Pct)} (${top1.label}). Top 3 : ${formatPct(top3Pct)}.`,
    gapPct: null,
    evidence: `Sur les 12 derniers mois, le premier client (${top1.label}, compte ${top1.accountNumber}) represente ${formatPct(top1Pct)} du CA total. Les trois premiers clients pesent ${formatPct(top3Pct)}. ${masking ? 'Le pitch decrit pourtant un portefeuille diversifie, ce qui contredit la realite comptable.' : ''}`,
    ddQuestion: masking
      ? `Le pitch decrit un portefeuille diversifie mais le top 1 client (${top1.label}) pese ${formatPct(top1Pct)} du CA reel. Comment justifier ce decalage narratif ?`
      : severity === 'red_flag' || severity === 'alert'
      ? `Le top 1 client (${top1.label}) represente ${formatPct(top1Pct)} du CA. Quel est le contrat (duree, MFN, change of control), quelle est la profondeur de la relation, et quel est le plan de diversification a 12-24 mois ?`
      : severity === 'attention'
      ? `Concentration moderee a documenter : top 1 ${formatPct(top1Pct)}, top 3 ${formatPct(top3Pct)}. Confirmer la solidite contractuelle des relations principales.`
      : 'Portefeuille client effectivement diversifie. Confirmer la rotation client annuelle.',
  };
}

function testGrowthTrajectory(
  fd: FinancialDataExtraction,
  ledger: LedgerExtraction,
): DDFinancialTest {
  const refDate = ledger.periodEnd ? new Date(ledger.periodEnd) : new Date();
  const observedGrowthYoY = ledger.realRevenue.growthRate; // % YoY sur le grand livre

  const proj0 = getCurrentYearProjection(fd.revenueProjection, refDate);
  const proj1 = getNextYearProjection(fd.revenueProjection);

  if (!proj0 || !proj1) {
    return {
      testId: 'T6',
      testName: 'Trajectoire recente vs crosse de hockey BP',
      severity: 'not_assessable',
      bpValue: 'BP : moins de 2 annees de projection disponibles',
      realValue: observedGrowthYoY !== null ? `Croissance YoY observee : ${formatPct(observedGrowthYoY)}` : 'Pas de comparaison YoY possible',
      gapPct: null,
      evidence: 'Le BP doit fournir au moins 2 annees de projection pour calculer la pente attendue.',
      ddQuestion: 'Pouvez-vous fournir le BP complet sur 3 ans avec les hypotheses de croissance par segment ?',
    };
  }

  const projectedGrowthY1 = proj0.valueEur > 0 ? ((proj1.valueEur - proj0.valueEur) / proj0.valueEur) * 100 : null;

  if (projectedGrowthY1 === null || observedGrowthYoY === null) {
    return {
      testId: 'T6',
      testName: 'Trajectoire recente vs crosse de hockey BP',
      severity: 'not_assessable',
      bpValue: projectedGrowthY1 !== null ? `BP croissance Y+1 : ${formatPct(projectedGrowthY1)}` : 'BP : croissance Y+1 non calculable',
      realValue: observedGrowthYoY !== null ? `Reel YoY : ${formatPct(observedGrowthYoY)}` : 'Reel : moins de 24 mois de donnees',
      gapPct: null,
      evidence: 'Donnees insuffisantes pour confronter la pente projetee a la pente recente.',
      ddQuestion: 'Pouvez-vous fournir le grand livre etendu a 24+ mois ou le rapport de gestion N-1 pour valider la pente recente ?',
    };
  }

  const factor = observedGrowthYoY !== 0 ? projectedGrowthY1 / observedGrowthYoY : null;
  const absFactor = factor !== null ? Math.abs(factor) : 0;

  let severity: DDFinancialTest['severity'] = 'aligned';
  if (projectedGrowthY1 > 0 && observedGrowthYoY <= 0) severity = 'red_flag'; // hockey stick alors que la pente recente est plate ou negative
  else if (factor !== null && absFactor >= 3) severity = 'alert';
  else if (factor !== null && absFactor >= 2) severity = 'attention';

  return {
    testId: 'T6',
    testName: 'Trajectoire recente vs crosse de hockey BP',
    severity,
    bpValue: `BP croissance Y+1 : ${formatPct(projectedGrowthY1)}`,
    realValue: `Reel YoY : ${formatPct(observedGrowthYoY)}`,
    gapPct: factor !== null && Number.isFinite(factor) ? (absFactor - 1) * 100 : null,
    evidence: `Le BP projette une croissance de ${formatPct(projectedGrowthY1)} entre ${proj0.year} et ${proj1.year}. La croissance reelle observee sur les 24 derniers mois du grand livre est de ${formatPct(observedGrowthYoY)}. ${factor !== null ? `Facteur d acceleration implicite : x${absFactor.toFixed(2)}.` : ''}`,
    ddQuestion: severity === 'red_flag'
      ? `Le BP projette ${formatPct(projectedGrowthY1)} de croissance alors que la pente recente est plate ou negative. Quels sont les leviers operationnels concrets (deals signes mais non factures, lancement produit, expansion geographique) qui justifient ce changement de regime ?`
      : severity === 'alert'
      ? `La pente projetee est ${absFactor.toFixed(1)}x superieure a la pente recente. Cas typique de hockey stick : quels sont les milestones commerciaux deja securises pour soutenir cette acceleration ?`
      : severity === 'attention'
      ? `La pente projetee accelere ${absFactor.toFixed(1)}x la pente recente. Documenter les leviers d acceleration et les milestones associes.`
      : 'Pente projetee coherente avec la trajectoire recente.',
  };
}

function testOffBalanceVsNarrative(
  ledger: LedgerExtraction,
  extraction: ExtractionOutput,
): DDFinancialTest {
  const eng = ledger.offBalanceCommitments;
  const totalCommitments = eng.longTermDebt + eng.salariesDue + eng.socialContributions + eng.taxesDue;
  const cash = ledger.cash.total;

  if (cash <= 0 && totalCommitments <= 0) {
    return {
      testId: 'T7',
      testName: 'Engagements hors bilan vs cash et narratif pitch',
      severity: 'not_assessable',
      bpValue: 'Pitch : engagements non explicitement detailles',
      realValue: 'Grand livre : aucun engagement ni cash significatif',
      gapPct: null,
      evidence: 'Aucune donnee comptable significative sur le cash ou les engagements.',
      ddQuestion: 'Pouvez-vous fournir le detail des engagements hors bilan : dette LT, dettes fournisseurs, dette sociale et fiscale, cautions et garanties donnees ?',
    };
  }

  const ratio = cash > 0 ? totalCommitments / cash : null;

  let severity: DDFinancialTest['severity'] = 'aligned';
  if (ratio !== null && ratio >= 1) severity = 'alert';
  else if (ratio !== null && ratio >= 0.5) severity = 'attention';

  // Heuristique narratif : le pitch mentionne-t-il les engagements ?
  const pitchText = `${extraction.businessModel || ''} ${extraction.rawSummary || ''}`.toLowerCase();
  const mentionsCommitments = /(engagement|dette|emprunt|cautionnement|hors bilan|bonding|leasing|credit-bail)/.test(pitchText);

  if (severity !== 'aligned' && !mentionsCommitments) {
    severity = severity === 'attention' ? 'alert' : 'red_flag';
  }

  const breakdown = [
    eng.longTermDebt > 0 ? `dette LT 16x : ${formatEur(eng.longTermDebt)}` : null,
    eng.relatedPartyDebts > 0 ? `dettes liees 17x : ${formatEur(eng.relatedPartyDebts)}` : null,
    eng.associateAccounts !== 0 ? `comptes courants associes 455x : ${formatEur(eng.associateAccounts)}` : null,
    eng.payablesNet > 0 ? `dette fournisseurs 401x : ${formatEur(eng.payablesNet)}` : null,
    eng.salariesDue > 0 ? `salaires dus 421x : ${formatEur(eng.salariesDue)}` : null,
    eng.socialContributions > 0 ? `charges sociales 43x : ${formatEur(eng.socialContributions)}` : null,
    eng.taxesDue > 0 ? `dette fiscale 44x : ${formatEur(eng.taxesDue)}` : null,
  ].filter(Boolean).join(', ');

  return {
    testId: 'T7',
    testName: 'Engagements hors bilan vs cash et narratif pitch',
    severity,
    bpValue: mentionsCommitments ? 'Pitch : engagements mentionnes' : 'Pitch : engagements non documentes',
    realValue: `Cash ${formatEur(cash)} vs engagements ${formatEur(totalCommitments)} ${ratio !== null ? `(ratio ${ratio.toFixed(2)})` : ''}`,
    gapPct: null,
    evidence: `Cash total disponible (banques + caisse) : ${formatEur(cash)}. Engagements identifies : ${breakdown || 'neant'}. Engagements totaux retenus pour ratio : dette LT + salaires + charges sociales + dette fiscale = ${formatEur(totalCommitments)}.${ratio !== null ? ` Ratio engagements / cash : ${ratio.toFixed(2)}.` : ''}${!mentionsCommitments && totalCommitments > 0 ? ' Le pitch ne mentionne pas explicitement ces engagements.' : ''}`,
    ddQuestion: severity === 'red_flag'
      ? `Engagements significatifs (${formatEur(totalCommitments)}) non documentes dans le pitch. Detail complet exige : echeances, contreparties, declencheurs (covenants, change of control), cautions et garanties donnees au-dela des comptes 16x et 401x.`
      : severity === 'alert'
      ? `Le ratio engagements/cash est de ${ratio?.toFixed(2)}. Quels sont les echeanciers et les conditions de chaque engagement ?`
      : severity === 'attention'
      ? `Engagements presents mais ratio engagements/cash mesure (${ratio?.toFixed(2)}). Confirmer le calendrier d echeance et l absence de covenants restrictifs.`
      : 'Engagements documentes et ratio mesure. Confirmer en DD via les contrats source.',
  };
}

// ============================================================
// Verdict global
// ============================================================

function severityToScore(s: DDFinancialTest['severity']): number {
  switch (s) {
    case 'aligned': return 100;
    case 'attention': return 75;
    case 'alert': return 45;
    case 'red_flag': return 15;
    case 'not_assessable': return 50; // neutre, ne penalise pas
  }
}

function computeGlobalScore(tests: DDFinancialOutput['tests']): number {
  const all = [
    tests.revenueGap,
    tests.grossMarginGap,
    tests.burnRateGap,
    tests.headcountGap,
    tests.clientConcentration,
    tests.growthTrajectory,
    tests.offBalanceVsNarrative,
  ];
  const sum = all.reduce((s, t) => s + severityToScore(t.severity), 0);
  return Math.round(sum / all.length);
}

function determineVerdict(tests: DDFinancialOutput['tests']): DDFinancialOutput['verdict'] {
  const all = [
    tests.revenueGap,
    tests.grossMarginGap,
    tests.burnRateGap,
    tests.headcountGap,
    tests.clientConcentration,
    tests.growthTrajectory,
    tests.offBalanceVsNarrative,
  ];
  const redFlags = all.filter(t => t.severity === 'red_flag').length;
  const alerts = all.filter(t => t.severity === 'alert').length;
  const attentions = all.filter(t => t.severity === 'attention').length;

  if (redFlags >= 1) return 'dd_red_flags';
  if (alerts >= 4 || (alerts >= 2 && attentions >= 2)) return 'dd_significant_gaps';
  if (alerts >= 1 || attentions >= 2) return 'dd_partial_alignment';
  return 'dd_aligned';
}

// ============================================================
// Synthese editoriale (LLM)
// ============================================================

const SYSTEM_PROMPT = `Tu es l auditeur DD financier de la plateforme Prelude. Tu ecris pour un partner senior d un fonds VC ou un membre de comite d investissement qui va lire ta synthese en 90 secondes avant de poser des questions.

Tu produis :
1. Une synthese editoriale de 5 a 7 phrases, niveau memo IC, qui resume le profil de friction observe entre BP projete et realite comptable. Citation des chiffres exacts cote a cote. Ton descriptif et factuel, pas alarmiste, pas complaisant.
2. Une liste de 5 a 8 questions DD prioritaires a poser au fondateur, classees par criticite.

Regles :
- Pas d em-dashes (jamais de "—" ou "–"), uniquement points et points-virgules.
- Pas de jargon non standard. Vocabulaire VC / CFO classique.
- Cite les chiffres precis (CA reel vs CA projete, marge reelle vs marge BP, etc.).
- Si la realite confirme le pitch, dis-le clairement et explicite les points a confirmer en DD.
- Si la realite contredit le pitch, dis-le aussi clairement, sans pirouette mais sans dramatiser.
- Le ton est celui d un memo professionnel adresse a un partner senior, pas d un rapport pedagogique.

Format JSON obligatoire :
{
  "synthesis": "5 a 7 phrases denses, citations chiffrees cote a cote",
  "questionsToInstruct": ["question 1", "question 2", "...", "question 5 a 8"]
}

Reponds UNIQUEMENT avec le JSON valide, sans bloc markdown.`;

// ============================================================
// Fonction principale
// ============================================================

export async function analyzeDDFinancial(
  extraction: ExtractionOutput,
  financialData: FinancialDataExtraction | null,
  ledgerExtraction: LedgerExtraction | null,
): Promise<DDFinancialOutput> {
  // Verifie que les deux inputs sont presents
  if (!ledgerExtraction || !ledgerExtraction.hasLedger) {
    return makeNotApplicable('Pas de grand livre comptable uploade');
  }
  if (!financialData || !financialData.hasBP) {
    return makeNotApplicable('Pas de business plan exploitable fourni');
  }

  // Calcul des 7 tests deterministes
  const tests = {
    revenueGap: testRevenueGap(financialData, ledgerExtraction),
    grossMarginGap: testGrossMarginGap(financialData, ledgerExtraction),
    burnRateGap: testBurnRateGap(financialData, ledgerExtraction),
    headcountGap: testHeadcountGap(financialData, ledgerExtraction),
    clientConcentration: testClientConcentration(financialData, ledgerExtraction, extraction),
    growthTrajectory: testGrowthTrajectory(financialData, ledgerExtraction),
    offBalanceVsNarrative: testOffBalanceVsNarrative(ledgerExtraction, extraction),
  };

  const globalScore = computeGlobalScore(tests);
  const verdict = determineVerdict(tests);

  // Synthese editoriale via LLM
  const userPrompt = `Donnees du dossier :

Societe : ${extraction.companyName ?? '?'}
Secteur : ${extraction.sector ?? '?'} / ${extraction.subSector ?? '?'}

Resultats des 7 tests :

T1 - Ecart CA declare vs CA reel
${JSON.stringify(tests.revenueGap, null, 2)}

T2 - Marge brute projetee vs reelle
${JSON.stringify(tests.grossMarginGap, null, 2)}

T3 - Burn rate declare vs reel
${JSON.stringify(tests.burnRateGap, null, 2)}

T4 - Headcount declare vs charges salariales reelles
${JSON.stringify(tests.headcountGap, null, 2)}

T5 - Concentration client reelle
${JSON.stringify(tests.clientConcentration, null, 2)}

T6 - Trajectoire recente vs crosse de hockey BP
${JSON.stringify(tests.growthTrajectory, null, 2)}

T7 - Engagements hors bilan vs cash et narratif pitch
${JSON.stringify(tests.offBalanceVsNarrative, null, 2)}

Verdict global calcule : ${verdict}
Score global : ${globalScore}/100

Drapeaux deterministes du grand livre :
${(ledgerExtraction.flags || []).map(f => `- [${f.severity}] ${f.message}`).join('\n') || 'aucun'}

Produis la synthese editoriale et les questions DD prioritaires. Reponds UNIQUEMENT avec le JSON specifie.`;

  let synthesis = '';
  let questionsToInstruct: string[] = [];
  try {
    const response = await callClaude(SYSTEM_PROMPT, userPrompt, 2500, MODEL);
    const llmResult: any = parseJSON(response);
    synthesis = llmResult.synthesis || '';
    questionsToInstruct = Array.isArray(llmResult.questionsToInstruct)
      ? llmResult.questionsToInstruct.slice(0, 8)
      : [];
  } catch (e) {
    // Fallback si le LLM echoue : on construit une synthese basique
    // a partir des tests et du verdict.
    synthesis = `Sur le perimetre couvert par le grand livre comptable (${ledgerExtraction.periodStart} a ${ledgerExtraction.periodEnd}, ${ledgerExtraction.totalEntries} ecritures), la confrontation BP projete versus realite comptable produit un score de ${globalScore}/100 et un verdict ${verdict}. Le moteur a detecte les tests suivants comme prioritaires : ${[tests.revenueGap, tests.grossMarginGap, tests.burnRateGap, tests.clientConcentration].filter(t => t.severity === 'red_flag' || t.severity === 'alert').map(t => t.testName).join(', ') || 'aucun ecart majeur'}.`;
    questionsToInstruct = [
      tests.revenueGap.ddQuestion,
      tests.grossMarginGap.ddQuestion,
      tests.burnRateGap.ddQuestion,
      tests.clientConcentration.ddQuestion,
      tests.offBalanceVsNarrative.ddQuestion,
    ].filter(Boolean);
  }

  return {
    triggered: true,
    ledgerPeriod: { start: ledgerExtraction.periodStart, end: ledgerExtraction.periodEnd },
    tests,
    globalScore,
    verdict,
    questionsToInstruct,
    synthesis,
  };
}

function makeNotApplicable(reason: string): DDFinancialOutput {
  const emptyTest: DDFinancialTest = {
    testId: '-',
    testName: '-',
    severity: 'not_assessable',
    bpValue: '',
    realValue: '',
    gapPct: null,
    evidence: '',
    ddQuestion: '',
  };
  return {
    triggered: false,
    reasonNotTriggered: reason,
    ledgerPeriod: { start: null, end: null },
    tests: {
      revenueGap: emptyTest,
      grossMarginGap: emptyTest,
      burnRateGap: emptyTest,
      headcountGap: emptyTest,
      clientConcentration: emptyTest,
      growthTrajectory: emptyTest,
      offBalanceVsNarrative: emptyTest,
    },
    globalScore: 0,
    verdict: 'not_applicable',
    questionsToInstruct: [],
    synthesis: '',
  };
}
