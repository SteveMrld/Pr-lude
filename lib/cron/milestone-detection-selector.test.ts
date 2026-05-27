// ============================================================
// Test deterministe : selectEligibleForDetection
// ------------------------------------------------------------
// Exerce les regles d eligibilite avec une horloge figee. Aucun
// appel LLM ni base de donnees : le selecteur est pur. A lancer
// avec :
//   npx tsx lib/cron/milestone-detection-selector.test.ts
// ============================================================

import {
  selectEligibleForDetection,
  type DetectionCandidate,
  DETECTION_FIRST_SCAN_DAYS,
  DETECTION_RESCAN_INTERVAL_DAYS,
  MAX_PENDING_PROPOSED,
} from './milestone-detection-selector';

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

const NOW = new Date('2026-05-27T00:00:00Z');
const NOW_MS = NOW.getTime();

function isoMinusDays(days: number): string {
  return new Date(NOW_MS - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}
function isoTsMinusDays(days: number): string {
  return new Date(NOW_MS - days * 24 * 3600 * 1000).toISOString();
}

// ============================================================
// Cas 1 : decision trop recente (< 180 jours), inelegible
// ============================================================
{
  const c: DetectionCandidate = {
    analysisId: 'a1', userId: 'u1', companyName: 'Demo',
    decision: 'invested',
    decisionDate: isoMinusDays(100),
    lastAutoDetectionAt: null,
    pendingProposedCount: 0,
  };
  const out = selectEligibleForDetection([c], NOW);
  check('Cas 1 : decision a 100 jours non eligible', out.length === 0);
}

// ============================================================
// Cas 2 : decision >= 180 jours, jamais scannee, eligible
// ============================================================
{
  const c: DetectionCandidate = {
    analysisId: 'a2', userId: 'u1', companyName: 'Demo2',
    decision: 'invested',
    decisionDate: isoMinusDays(190),
    lastAutoDetectionAt: null,
    pendingProposedCount: 0,
  };
  const out = selectEligibleForDetection([c], NOW);
  check('Cas 2 : decision a 190 jours non scannee, eligible', out.length === 1);
  check('Cas 2 : daysSinceDecision proche de 190', out[0]?.daysSinceDecision === 190);
  check('Cas 2 : daysSinceLastDetection null', out[0]?.daysSinceLastDetection === null);
}

// ============================================================
// Cas 3 : scannee il y a 60 jours (< rescan 90), inelegible
// ============================================================
{
  const c: DetectionCandidate = {
    analysisId: 'a3', userId: 'u1', companyName: 'Demo3',
    decision: 'invested',
    decisionDate: isoMinusDays(250),
    lastAutoDetectionAt: isoTsMinusDays(60),
    pendingProposedCount: 0,
  };
  const out = selectEligibleForDetection([c], NOW);
  check('Cas 3 : rescan a 60 jours non eligible (< 90)', out.length === 0);
}

// ============================================================
// Cas 4 : scannee il y a 100 jours, eligible pour rescan
// ============================================================
{
  const c: DetectionCandidate = {
    analysisId: 'a4', userId: 'u1', companyName: 'Demo4',
    decision: 'invested',
    decisionDate: isoMinusDays(300),
    lastAutoDetectionAt: isoTsMinusDays(100),
    pendingProposedCount: 0,
  };
  const out = selectEligibleForDetection([c], NOW);
  check('Cas 4 : rescan a 100 jours eligible', out.length === 1);
}

// ============================================================
// Cas 5 : 3 proposed pendings, on saute (eviter empilement)
// ============================================================
{
  const c: DetectionCandidate = {
    analysisId: 'a5', userId: 'u1', companyName: 'Demo5',
    decision: 'invested',
    decisionDate: isoMinusDays(300),
    lastAutoDetectionAt: null,
    pendingProposedCount: MAX_PENDING_PROPOSED,
  };
  const out = selectEligibleForDetection([c], NOW);
  check('Cas 5 : trop de proposed pendings, on skip', out.length === 0);
}

// ============================================================
// Cas 6 : ordre de priorite, jamais scannee passe devant
// ============================================================
{
  const cs: DetectionCandidate[] = [
    {
      analysisId: 'old-scan', userId: 'u1', companyName: 'A',
      decision: 'invested', decisionDate: isoMinusDays(400),
      lastAutoDetectionAt: isoTsMinusDays(200), pendingProposedCount: 0,
    },
    {
      analysisId: 'never-scanned', userId: 'u1', companyName: 'B',
      decision: 'invested', decisionDate: isoMinusDays(190),
      lastAutoDetectionAt: null, pendingProposedCount: 0,
    },
    {
      analysisId: 'recent-scan-no-fit', userId: 'u1', companyName: 'C',
      decision: 'invested', decisionDate: isoMinusDays(300),
      lastAutoDetectionAt: isoTsMinusDays(120), pendingProposedCount: 0,
    },
  ];
  const out = selectEligibleForDetection(cs, NOW);
  check('Cas 6 : trois eligibles', out.length === 3);
  check('Cas 6 : never-scanned passe en premier', out[0].analysisId === 'never-scanned');
  check('Cas 6 : old-scan (200j) passe avant recent-scan (120j)',
    out[1].analysisId === 'old-scan' && out[2].analysisId === 'recent-scan-no-fit');
}

// ============================================================
// Cas 7 : plafond MAX_DOSSIERS_PER_RUN respecte
// ============================================================
{
  const cs: DetectionCandidate[] = Array.from({ length: 20 }, (_, i) => ({
    analysisId: `a${i}`, userId: 'u1', companyName: `S${i}`,
    decision: 'invested' as const,
    decisionDate: isoMinusDays(200 + i),
    lastAutoDetectionAt: null,
    pendingProposedCount: 0,
  }));
  const out = selectEligibleForDetection(cs, NOW);
  check('Cas 7 : plafond 8 dossiers par run', out.length === 8);
}

// ============================================================
// Cas 8 : decisionDate corrompu, ignore proprement
// ============================================================
{
  const c: DetectionCandidate = {
    analysisId: 'corrupt', userId: 'u1', companyName: 'X',
    decision: 'invested',
    decisionDate: 'not-a-date',
    lastAutoDetectionAt: null, pendingProposedCount: 0,
  };
  const out = selectEligibleForDetection([c], NOW);
  check('Cas 8 : decisionDate corrompu ignore', out.length === 0);
}

// ============================================================
// Constantes coherentes avec la doctrine
// ============================================================
check('Constante FIRST_SCAN 180j', DETECTION_FIRST_SCAN_DAYS === 180);
check('Constante RESCAN 90j', DETECTION_RESCAN_INTERVAL_DAYS === 90);
check('Constante MAX_PENDING 3', MAX_PENDING_PROPOSED === 3);

console.log(`\n=== milestone-detection-selector ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
