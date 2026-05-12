// ============================================================
// Tests selecteur de dossiers eligibles a la re-analyse auto
// ------------------------------------------------------------
// Couvre la doctrine d eligibilite : seuil six mois (180 jours),
// filtrage in-portfolio, snapshot null, ordre de priorite par
// anciennete, edge cases (timestamp invalide, seuil exact).
//
// Lancement : npx tsx lib/cron/portfolio-reanalysis-selector.test.ts
// ============================================================

import {
  selectEligibleForReanalysis,
  DEFAULT_REANALYSIS_THRESHOLD_DAYS,
  type ReanalysisCandidate,
} from './portfolio-reanalysis-selector';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, cond: boolean): void {
  check(label, cond, true);
}

// Helper : produit un ISO date a N jours en arriere par rapport a now
function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

const NOW = new Date('2026-05-12T08:00:00Z');

// ============================================================
// Test 1 : seuil par defaut (180 jours)
// ============================================================
console.log('\n=== Test 1 : seuil par defaut 180 jours ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'a', lastSnapshotAt: daysAgo(NOW, 200), inPortfolio: true },
    { analysisId: 'b', lastSnapshotAt: daysAgo(NOW, 100), inPortfolio: true },
    { analysisId: 'c', lastSnapshotAt: daysAgo(NOW, 181), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('deux candidats au-dessus du seuil', out.length, 2);
  checkTrue('a est present', out.some(s => s.analysisId === 'a'));
  checkTrue('c est present', out.some(s => s.analysisId === 'c'));
  checkTrue('b est absent (100 jours, sous seuil)', !out.some(s => s.analysisId === 'b'));
}

// ============================================================
// Test 2 : seuil exact 180 jours franchit
// ============================================================
console.log('\n=== Test 2 : seuil exact 180 jours franchit ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'a', lastSnapshotAt: daysAgo(NOW, 180), inPortfolio: true },
    { analysisId: 'b', lastSnapshotAt: daysAgo(NOW, 179), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('a (180 jours pile) declenche', out.find(s => s.analysisId === 'a')?.analysisId, 'a');
  check('b (179 jours) ne declenche pas', out.find(s => s.analysisId === 'b'), undefined);
}

// ============================================================
// Test 3 : filtrage in_portfolio
// ============================================================
console.log('\n=== Test 3 : filtrage in_portfolio ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'a', lastSnapshotAt: daysAgo(NOW, 200), inPortfolio: false },
    { analysisId: 'b', lastSnapshotAt: daysAgo(NOW, 200), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('un seul resultat', out.length, 1);
  check('b est present', out[0].analysisId, 'b');
}

// ============================================================
// Test 4 : snapshot null exclu
// ============================================================
console.log('\n=== Test 4 : snapshot null exclu ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'a', lastSnapshotAt: null, inPortfolio: true },
    { analysisId: 'b', lastSnapshotAt: daysAgo(NOW, 200), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('un seul resultat', out.length, 1);
  check('b est present', out[0].analysisId, 'b');
}

// ============================================================
// Test 5 : timestamp invalide ignore
// ============================================================
console.log('\n=== Test 5 : timestamp invalide ignore ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'a', lastSnapshotAt: 'pas-une-date', inPortfolio: true },
    { analysisId: 'b', lastSnapshotAt: daysAgo(NOW, 200), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('un seul resultat', out.length, 1);
  check('b est present', out[0].analysisId, 'b');
}

// ============================================================
// Test 6 : ordre par anciennete decroissante
// ============================================================
console.log('\n=== Test 6 : ordre par anciennete decroissante ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'recent-eligible', lastSnapshotAt: daysAgo(NOW, 185), inPortfolio: true },
    { analysisId: 'ancien', lastSnapshotAt: daysAgo(NOW, 400), inPortfolio: true },
    { analysisId: 'moyen', lastSnapshotAt: daysAgo(NOW, 250), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('trois resultats', out.length, 3);
  check('ancien en tete', out[0].analysisId, 'ancien');
  check('moyen au milieu', out[1].analysisId, 'moyen');
  check('recent-eligible en queue', out[2].analysisId, 'recent-eligible');
}

// ============================================================
// Test 7 : liste vide
// ============================================================
console.log('\n=== Test 7 : liste vide ===');
{
  const out = selectEligibleForReanalysis([], NOW);
  check('aucun resultat', out.length, 0);
}

// ============================================================
// Test 8 : tous sous seuil
// ============================================================
console.log('\n=== Test 8 : tous sous seuil ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'a', lastSnapshotAt: daysAgo(NOW, 30), inPortfolio: true },
    { analysisId: 'b', lastSnapshotAt: daysAgo(NOW, 90), inPortfolio: true },
    { analysisId: 'c', lastSnapshotAt: daysAgo(NOW, 179), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('aucun resultat', out.length, 0);
}

// ============================================================
// Test 9 : seuil custom
// ============================================================
console.log('\n=== Test 9 : seuil custom 90 jours ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'a', lastSnapshotAt: daysAgo(NOW, 100), inPortfolio: true },
    { analysisId: 'b', lastSnapshotAt: daysAgo(NOW, 80), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW, 90);
  check('un seul resultat', out.length, 1);
  check('a present', out[0].analysisId, 'a');
}

// ============================================================
// Test 10 : daysSinceLastSnapshot calcule
// ============================================================
console.log('\n=== Test 10 : daysSinceLastSnapshot calcule ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'a', lastSnapshotAt: daysAgo(NOW, 200), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('200 jours calcules', out[0].daysSinceLastSnapshot, 200);
}

// ============================================================
// Test 11 : melange complet (cas realiste)
// ============================================================
console.log('\n=== Test 11 : melange complet realiste ===');
{
  const candidates: ReanalysisCandidate[] = [
    { analysisId: 'pas-portfolio', lastSnapshotAt: daysAgo(NOW, 300), inPortfolio: false },
    { analysisId: 'ancien-portfolio', lastSnapshotAt: daysAgo(NOW, 365), inPortfolio: true },
    { analysisId: 'no-snapshot', lastSnapshotAt: null, inPortfolio: true },
    { analysisId: 'frais', lastSnapshotAt: daysAgo(NOW, 30), inPortfolio: true },
    { analysisId: 'pile-au-seuil', lastSnapshotAt: daysAgo(NOW, 181), inPortfolio: true },
  ];
  const out = selectEligibleForReanalysis(candidates, NOW);
  check('deux resultats', out.length, 2);
  check('ancien-portfolio en tete', out[0].analysisId, 'ancien-portfolio');
  check('pile-au-seuil en queue', out[1].analysisId, 'pile-au-seuil');
}

// ============================================================
// Test 12 : default threshold constant exporte
// ============================================================
console.log('\n=== Test 12 : DEFAULT_REANALYSIS_THRESHOLD_DAYS ===');
{
  check('constante = 180', DEFAULT_REANALYSIS_THRESHOLD_DAYS, 180);
}

// ============================================================
// FIN
// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
