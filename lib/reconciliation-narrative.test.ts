// ============================================================
// Test deterministe : prose de calibration
// ------------------------------------------------------------
// Verifie que detectSystemicPatterns respecte le seuil, que les
// branches de pattern declenchent quand elles doivent, et que
// buildProgressNarrative produit une prose lisible dans chaque
// regime (vide / sous-seuil / au-seuil).
//
//   npx tsx lib/reconciliation-narrative.test.ts
// ============================================================

import {
  detectSystemicPatterns,
  buildProgressNarrative,
  type DimensionPortfolioPerformanceLite,
  type GlobalAlignmentLite,
} from './reconciliation-narrative';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL : ${label}`);
  }
}

const THRESHOLD = 30;

function emptyGA(): GlobalAlignmentLite {
  return {
    confirmsDriver: 0, confirmsRisk: 0,
    contradictsDriver: 0, contradictsRisk: 0,
    unforeseenPositive: 0, unforeseenNegative: 0,
    total: 0,
  };
}

const emptyByDecision = { invested: 0, passed: 0, declined: 0, waitlisted: 0 };

// ============================================================
// Seuil : zero pattern sous le seuil
// ============================================================
{
  const out = detectSystemicPatterns([], emptyGA(), 29, emptyByDecision, THRESHOLD);
  check('seuil : 29 dossiers, zero pattern', out.length === 0);
}

{
  const out = detectSystemicPatterns([], emptyGA(), 30, emptyByDecision, THRESHOLD);
  check('seuil : 30 dossiers, zero pattern si aucun signal', out.length === 0);
}

// ============================================================
// Pattern 1 : low accuracy dimension
// ============================================================
{
  const dims: DimensionPortfolioPerformanceLite[] = [
    {
      dimensionName: 'Marche',
      averagePredictedSuccess: 60,
      confirmedDrivers: 1, confirmedRisks: 1,
      contradictedDrivers: 4, contradictedRisks: 3,
      predictionAccuracy: 'low',
    },
  ];
  const out = detectSystemicPatterns(dims, emptyGA(), 30, emptyByDecision, THRESHOLD);
  check('pattern 1 : low accuracy declenche', out.length >= 1);
  check('pattern 1 : mentionne dimension', out[0].includes('Marche'));
  check('pattern 1 : mentionne pourcentage', /\d+ pour cent/.test(out[0]));
}

// ============================================================
// Pattern 2 : drivers sur-evalues
// ============================================================
{
  const dims: DimensionPortfolioPerformanceLite[] = [
    {
      dimensionName: 'Equipe',
      averagePredictedSuccess: 70,
      confirmedDrivers: 2, confirmedRisks: 3,
      contradictedDrivers: 6, contradictedRisks: 1,
      predictionAccuracy: 'medium',
    },
  ];
  const out = detectSystemicPatterns(dims, emptyGA(), 30, emptyByDecision, THRESHOLD);
  check('pattern 2 : drivers sur-evalues declenche', out.length >= 1);
  check('pattern 2 : prose dense (3+ phrases)',
    (out.find((p) => p.includes('Equipe')) || '').split('.').length >= 4);
}

// ============================================================
// Pattern 3 : sur-cautionneux (risques rarement confirmes)
// ============================================================
{
  const dims: DimensionPortfolioPerformanceLite[] = [
    {
      dimensionName: 'Tech',
      averagePredictedSuccess: 55,
      confirmedDrivers: 4, confirmedRisks: 1,
      contradictedDrivers: 2, contradictedRisks: 5,
      predictionAccuracy: 'medium',
    },
  ];
  const out = detectSystemicPatterns(dims, emptyGA(), 30, emptyByDecision, THRESHOLD);
  const p3 = out.find((p) => p.includes('Tech'));
  check('pattern 3 : sur-cautionneux declenche', !!p3);
  check('pattern 3 : mentionne prudence',
    !!p3 && (p3.includes('prudent') || p3.includes('defiance')));
}

// ============================================================
// Pattern 4 : high accuracy (signal positif)
// ============================================================
{
  const dims: DimensionPortfolioPerformanceLite[] = [
    {
      dimensionName: 'Financier',
      averagePredictedSuccess: 65,
      confirmedDrivers: 7, confirmedRisks: 4,
      contradictedDrivers: 1, contradictedRisks: 2,
      predictionAccuracy: 'high',
    },
  ];
  const out = detectSystemicPatterns(dims, emptyGA(), 30, emptyByDecision, THRESHOLD);
  const p4 = out.find((p) => p.includes('Financier'));
  check('pattern 4 : high accuracy declenche', !!p4);
  check('pattern 4 : mentionne calibration tient',
    !!p4 && p4.includes('calibration du fonds tient'));
}

// ============================================================
// Pattern 5 : imprevus negatifs structurels
// ============================================================
{
  const ga: GlobalAlignmentLite = {
    confirmsDriver: 5, confirmsRisk: 2,
    contradictsDriver: 1, contradictsRisk: 1,
    unforeseenPositive: 1, unforeseenNegative: 7,
    total: 17,
  };
  const out = detectSystemicPatterns([], ga, 30, emptyByDecision, THRESHOLD);
  check('pattern 5 : imprevus negatifs declenche', out.length >= 1);
  check('pattern 5 : mentionne angles morts',
    out.some((p) => p.includes('angles morts')));
}

// Pattern 5 ne declenche pas si seulement 4 unforeseen negative
{
  const ga: GlobalAlignmentLite = {
    confirmsDriver: 5, confirmsRisk: 2,
    contradictsDriver: 1, contradictsRisk: 1,
    unforeseenPositive: 1, unforeseenNegative: 4,
    total: 14,
  };
  const out = detectSystemicPatterns([], ga, 30, emptyByDecision, THRESHOLD);
  check('pattern 5 : 4 imprevus negatifs, pas de declenchement',
    out.length === 0);
}

// ============================================================
// Pattern 6 : biais distribution decisions
// ============================================================
{
  const byDec = { invested: 10, passed: 8, declined: 4, waitlisted: 2 };
  const out = detectSystemicPatterns([], emptyGA(), 30, byDec, THRESHOLD);
  const p6 = out.find((p) => p.includes('investis'));
  check('pattern 6 : taux invested >= 40% declenche', !!p6);
  check('pattern 6 : mention conviction vs appetence',
    !!p6 && p6.includes('conviction'));
}

{
  const byDec = { invested: 1, passed: 12, declined: 10, waitlisted: 2 };
  const out = detectSystemicPatterns([], emptyGA(), 30, byDec, THRESHOLD);
  const p6 = out.find((p) => p.includes('seulement'));
  check('pattern 6 : taux invested <= 10% declenche', !!p6);
  check('pattern 6 : mention defiance',
    !!p6 && p6.includes('defiance'));
}

{
  // Decisions equilibrees : pas de pattern 6
  const byDec = { invested: 6, passed: 10, declined: 4, waitlisted: 1 };
  const out = detectSystemicPatterns([], emptyGA(), 30, byDec, THRESHOLD);
  check('pattern 6 : 28% invested, pas de pattern declenche',
    !out.some((p) => p.includes('investis') || p.includes('seulement')));
}

// ============================================================
// buildProgressNarrative : trois regimes
// ============================================================
{
  const out = buildProgressNarrative(0, 0, 0, THRESHOLD);
  check('progress : zero analyse, mention accumulation',
    out.includes('Aucun dossier') && out.includes('accumulation'));
}

{
  const out = buildProgressNarrative(15, 8, 5, THRESHOLD);
  check('progress : sous seuil, mention restant',
    out.includes('5 dossiers reconciliables') && out.includes('25 dossiers pour'));
}

{
  const out = buildProgressNarrative(15, 8, 5, THRESHOLD);
  check('progress : sous seuil, evite faux signal',
    out.includes('faux signal') || out.includes('statistiquement defendable'));
}

{
  const out = buildProgressNarrative(50, 35, 32, THRESHOLD);
  check('progress : au-dessus seuil, mention franchi',
    out.includes('franchi le seuil') && out.includes('32 dossiers'));
}

{
  const out = buildProgressNarrative(50, 35, 32, THRESHOLD);
  check('progress : au-dessus seuil, ton descriptif pas prescriptif',
    out.includes('pas prescriptif') || out.includes('decrivent'));
}

// Cas sous seuil avec decision en attente
{
  const out = buildProgressNarrative(20, 10, 5, THRESHOLD);
  check('progress : 10 sans decision, mention Kanban',
    out.includes('Kanban'));
}

// Cas sous seuil avec milestone en attente
{
  const out = buildProgressNarrative(20, 15, 5, THRESHOLD);
  check('progress : 10 avec decision sans milestone, mention detection',
    out.includes('detection web') || out.includes('automatique'));
}

console.log(`\n=== reconciliation-narrative ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
