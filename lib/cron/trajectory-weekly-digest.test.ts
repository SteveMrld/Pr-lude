// ============================================================
// Tests collectCran3Alerts (digest hebdomadaire)
// ------------------------------------------------------------
// Couvre le regroupement des alertes cran 3 par user et par dossier,
// le filtrage sur les snapshots recents (fenetre temporelle), la
// deduplication implicite (un snapshot ancien hors fenetre n est
// pas re-evalue), et le cas degenere d un seul snapshot par dossier.
//
// Lancement : npx tsx lib/cron/trajectory-weekly-digest.test.ts
// ============================================================

import { collectCran3Alerts } from './trajectory-weekly-digest';
import type { TrajectorySnapshotRow } from '../trajectory-store';

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

// Helpers de construction de snapshots typiques.
function mkRow(opts: Partial<TrajectorySnapshotRow> = {}): TrajectorySnapshotRow {
  return {
    id: opts.id || 'row-default',
    analysisId: opts.analysisId || 'analysis-1',
    versionId: opts.id || 'version-default',
    versionNum: opts.versionNum ?? 1,
    userId: opts.userId || 'user-1',
    companyName: opts.companyName || 'Acme',
    analyzedAt: opts.analyzedAt || '2026-05-01T00:00:00Z',
    globalScore: opts.globalScore ?? 60,
    verdict: opts.verdict || 'investir avec conditions',
    dimensions: opts.dimensions || {
      team: 60,
      market: 60,
      macro: 60,
      financial: 60,
      contrarian: 60,
      vigilance: 60,
    },
    fragiliteScore: opts.fragiliteScore ?? 40,
    fragiliteVerdict: opts.fragiliteVerdict ?? 'sain',
    narrativeDriftScore: opts.narrativeDriftScore ?? 30,
    narrativeDriftVerdict: opts.narrativeDriftVerdict ?? 'sain',
    patterns: opts.patterns || {
      'growth-subsidized-model': { score: 30, verdict: 'sain', applicabilite: 'full' },
    },
    combinaisons: opts.combinaisons || [],
    createdAt: opts.createdAt || '2026-05-01T00:00:00Z',
  };
}

// ============================================================
// Test 1 : un dossier avec une transition cran 3 dans la fenetre
// ============================================================
console.log('\n=== Test 1 : une transition cran 3 dans la fenetre ===');
{
  const before = mkRow({
    id: 'v1',
    versionNum: 1,
    analyzedAt: '2026-04-01T00:00:00Z',
    patterns: {
      'growth-subsidized-model': { score: 30, verdict: 'sain', applicabilite: 'full' },
    },
  });
  const after = mkRow({
    id: 'v2',
    versionNum: 2,
    analyzedAt: '2026-05-08T00:00:00Z',
    patterns: {
      'growth-subsidized-model': { score: 55, verdict: 'attention', applicabilite: 'full' },
    },
  });
  const map = new Map<string, TrajectorySnapshotRow[]>([['analysis-1', [before, after]]]);
  const recent = new Set(['v2']);
  const out = collectCran3Alerts(map, recent);
  check('un seul groupe', out.length, 1);
  check('dossier identifie', out[0].analysisId, 'analysis-1');
  checkTrue(
    'alerte sain vers attention presente',
    out[0].alerts.some((a) => a.tag === 'pattern-sain-vers-non-sain'),
  );
}

// ============================================================
// Test 2 : snapshot recent sans transition cran 3 -> rien
// ============================================================
console.log('\n=== Test 2 : pas de transition cran 3 -> rien ===');
{
  const before = mkRow({ id: 'v1', versionNum: 1, globalScore: 60 });
  const after = mkRow({ id: 'v2', versionNum: 2, globalScore: 62, analyzedAt: '2026-05-08T00:00:00Z' });
  const map = new Map<string, TrajectorySnapshotRow[]>([['analysis-1', [before, after]]]);
  const recent = new Set(['v2']);
  const out = collectCran3Alerts(map, recent);
  check('zero groupe', out.length, 0);
}

// ============================================================
// Test 3 : transition cran 3 mais snapshot hors fenetre -> rien
// ============================================================
console.log('\n=== Test 3 : transition hors fenetre ignoree ===');
{
  const before = mkRow({ id: 'v1', versionNum: 1, globalScore: 60 });
  const after = mkRow({
    id: 'v2',
    versionNum: 2,
    globalScore: 45, // chute 15 = cran 3
    analyzedAt: '2026-03-01T00:00:00Z',
  });
  const map = new Map<string, TrajectorySnapshotRow[]>([['analysis-1', [before, after]]]);
  // v2 n est pas dans recent => skip
  const recent = new Set(['v1']);
  const out = collectCran3Alerts(map, recent);
  check('zero groupe (v2 hors fenetre)', out.length, 0);
}

// ============================================================
// Test 4 : plusieurs cran 3 sur le meme dossier dans la fenetre
// ============================================================
console.log('\n=== Test 4 : plusieurs cran 3 sur le meme dossier ===');
{
  const v1 = mkRow({ id: 'v1', versionNum: 1, globalScore: 70 });
  const v2 = mkRow({
    id: 'v2',
    versionNum: 2,
    globalScore: 55,
    analyzedAt: '2026-05-05T00:00:00Z',
  });
  const v3 = mkRow({
    id: 'v3',
    versionNum: 3,
    globalScore: 40,
    analyzedAt: '2026-05-08T00:00:00Z',
  });
  // Note : v2 vs v1 chute de 15 -> cran 3 chute-10
  //        v3 vs v2 chute de 15 -> cran 3 chute-10
  const map = new Map<string, TrajectorySnapshotRow[]>([['analysis-1', [v1, v2, v3]]]);
  const recent = new Set(['v2', 'v3']);
  const out = collectCran3Alerts(map, recent);
  check('un seul groupe (meme dossier)', out.length, 1);
  // Deux transitions cran 3, donc deux alertes agregees
  check('deux alertes accumulees', out[0].alerts.length, 2);
}

// ============================================================
// Test 5 : deux dossiers, transitions independantes
// ============================================================
console.log('\n=== Test 5 : deux dossiers transitions independantes ===');
{
  const a1v1 = mkRow({ id: 'a1v1', analysisId: 'a1', companyName: 'Alpha', globalScore: 70 });
  const a1v2 = mkRow({
    id: 'a1v2',
    analysisId: 'a1',
    companyName: 'Alpha',
    globalScore: 55,
    analyzedAt: '2026-05-08T00:00:00Z',
  });
  const b1v1 = mkRow({ id: 'b1v1', analysisId: 'b1', companyName: 'Beta', globalScore: 70 });
  const b1v2 = mkRow({
    id: 'b1v2',
    analysisId: 'b1',
    companyName: 'Beta',
    globalScore: 55,
    analyzedAt: '2026-05-09T00:00:00Z',
  });
  const map = new Map<string, TrajectorySnapshotRow[]>([
    ['a1', [a1v1, a1v2]],
    ['b1', [b1v1, b1v2]],
  ]);
  const recent = new Set(['a1v2', 'b1v2']);
  const out = collectCran3Alerts(map, recent);
  check('deux groupes', out.length, 2);
  checkTrue('Alpha present', out.some((g) => g.companyName === 'Alpha'));
  checkTrue('Beta present', out.some((g) => g.companyName === 'Beta'));
}

// ============================================================
// Test 6 : un seul snapshot -> rien (besoin de paire)
// ============================================================
console.log('\n=== Test 6 : un seul snapshot dans la fenetre ===');
{
  const v1 = mkRow({ id: 'v1', versionNum: 1 });
  const map = new Map<string, TrajectorySnapshotRow[]>([['analysis-1', [v1]]]);
  const recent = new Set(['v1']);
  const out = collectCran3Alerts(map, recent);
  check('zero groupe', out.length, 0);
}

// ============================================================
// Test 7 : map vide
// ============================================================
console.log('\n=== Test 7 : map vide ===');
{
  const out = collectCran3Alerts(new Map(), new Set());
  check('zero groupe', out.length, 0);
}

// ============================================================
// Test 8 : transition cran 1 ne contamine pas le digest cran 3
// ------------------------------------------------------------
// Un dossier qui fire cran 1 (drapeau-rouge combinaison) ne doit pas
// faire monter de cran 3 indu : evaluateTrajectoryAlerts produit
// uniquement le cran 1 dans ce cas, et le digest doit l ignorer.
// ============================================================
console.log('\n=== Test 8 : cran 1 ne contamine pas digest cran 3 ===');
{
  const v1 = mkRow({ id: 'v1', versionNum: 1 });
  const v2 = mkRow({
    id: 'v2',
    versionNum: 2,
    analyzedAt: '2026-05-08T00:00:00Z',
    combinaisons: [{ nom: 'Trajectoire WeWork', severite: 'drapeau-rouge' }],
  });
  const map = new Map<string, TrajectorySnapshotRow[]>([['analysis-1', [v1, v2]]]);
  const recent = new Set(['v2']);
  const out = collectCran3Alerts(map, recent);
  // Le cran 1 ne se range pas en cran 3, donc filtre vide pour
  // ce dossier.
  check('zero entree digest', out.length, 0);
}

// ============================================================
// Test 9 : ne re-evalue pas une paire qui n implique pas de
//          snapshot recent (anciennete pure)
// ------------------------------------------------------------
// Verifie que la fenetre temporelle se borne au snapshot apres : si
// la paire (prev, cur) a un cur hors fenetre, on saute.
// ============================================================
console.log('\n=== Test 9 : fenetre temporelle bornee sur cur ===');
{
  const v1 = mkRow({ id: 'v1', versionNum: 1, globalScore: 70 });
  const v2 = mkRow({
    id: 'v2',
    versionNum: 2,
    globalScore: 55,
    analyzedAt: '2026-04-01T00:00:00Z',
  });
  const v3 = mkRow({
    id: 'v3',
    versionNum: 3,
    globalScore: 50,
    analyzedAt: '2026-05-08T00:00:00Z',
  });
  const map = new Map<string, TrajectorySnapshotRow[]>([['analysis-1', [v1, v2, v3]]]);
  // Seul v3 est dans la fenetre. La paire (v2, v3) est chute de 5
  // points = sub-significative, ne declenche pas de cran 3.
  const recent = new Set(['v3']);
  const out = collectCran3Alerts(map, recent);
  check('zero entree (v2 vs v3 = stable)', out.length, 0);
}

// ============================================================
// FIN
// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
