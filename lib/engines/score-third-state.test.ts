// ============================================================
// TESTS - LE TROISIEME ETAT NE RESSUSCITE PAS LE VERDICT FANTOME
// ------------------------------------------------------------
// Le score mecanique peut desormais ne pas exister. Trois couches
// devaient jusqu ici un chiffre a leur aval et le fabriquaient a
// defaut : le prompt de synthese rebasculait sur la branche qui
// redemande le score au modele, la persistence retombait sur un
// 'approfondir' par defaut, et le comparateur de trajectoire
// mesurait des deltas contre des dimensions jamais instruites.
//
// Ce que ces tests verrouillent :
//   - Le prompt de synthese connait trois etats, pas deux. Sur socle
//     insuffisant il ne redemande jamais le score au modele.
//     C est le point critique de la brique : le biais de convergence
//     documente en tete de score-calculator ne doit pas se reveiller
//     par la porte de derriere.
//   - La normalisation de persistence propage l etat plutot que de
//     le traduire en position d instruction.
//   - Une dimension non evaluee n entre pas dans la trajectoire
//     comme un point, et ne produit ni delta ni alerte.
//
// Execution : npx tsx lib/engines/score-third-state.test.ts
// ============================================================

import { buildOrchestratorUserPrompt } from './orchestrator';
import { computeMechanicalScore, INSUFFICIENT_BASIS_VERDICT } from './score-calculator';
import { extractAnalysisMetadata } from '../analysis-store';
import { compareAnalyses } from './trajectory/comparator';
import type { TrajectorySnapshot } from './trajectory/types';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); fail++; }
}

function checkTrue(label: string, cond: boolean) {
  if (cond) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}`); fail++; }
}

// ============================================================
// FIXTURES
// ============================================================

const team = {
  systemicCoverage: { score: 70, rationale: '' },
  collectiveAntiFragility: { score: 70, rationale: '' },
  experienceTransposition: { score: 70, rationale: '' },
  founderObsession: { score: 70, rationale: '' },
} as any;

const market = {
  perceivedSize: 'large',
  needIntensity: { score: 65, rationale: '' },
  defensibility: { score: 65, moats: [] },
  organicSignals: { score: 65, rationale: '' },
} as any;

const macro = { cyclePosition: 'mature', contraryclicalOpportunity: { score: 55, rationale: '' } } as any;
const financial = { hasFinancialData: true, dataSource: 'bp', globalCoherenceScore: 75, tests: {} } as any;
const contrarian = { globalContrarianScore: 60, signals: {} } as any;
const blindspot = { globalBlindspotScore: 40, patterns: {} } as any;

const statusesFull = {
  team: { status: 'ok' }, market: { status: 'ok' }, macro: { status: 'ok' },
  financialCoherence: { status: 'ok' }, contrarianAnalysis: { status: 'ok' },
  blindspotAnalysis: { status: 'ok' },
};

const computed = computeMechanicalScore({
  team, market, macro, financial, contrarian, blindspot,
  engineStatuses: statusesFull,
});

const starved = computeMechanicalScore({
  team, market, macro: null, financial: null, contrarian: null, blindspot: null,
  engineStatuses: {
    team: { status: 'ok' }, market: { status: 'ok' }, macro: { status: 'timeout' },
    financialCoherence: { status: 'failed-upstream' }, contrarianAnalysis: { status: 'failed' },
    blindspotAnalysis: { status: 'timeout' },
  },
});

function buildPrompt(mechanicalScore: any): string {
  return buildOrchestratorUserPrompt({
    extraction: { companyName: 'Fixture', sector: 'saas' },
    team, market, macro,
    patternMatching: { comparables: [] },
    causalReversal: { blindspotsScores: {} },
    blindspotAnalysis: blindspot,
    contrarianAnalysis: contrarian,
    mechanicalScore,
    conflictBlock: '',
    annotationsBlock: '',
  });
}

// ============================================================
// SECTION 1. LE PROMPT DE SYNTHESE CONNAIT TROIS ETATS
// ============================================================

console.log('\n=== Section 1. Prompt de synthese, trois etats ===');

const promptComputed = buildPrompt(computed);
checkTrue('Score calcule : le bloc de score pre-calcule est emis',
  promptComputed.includes('SCORE MECANIQUE PRE-CALCULE'));
checkTrue('Score calcule : le modele est narrateur, pas juge',
  promptComputed.includes('TON ROLE A CHANGE'));
checkTrue('Score calcule : la base du calcul est declaree au modele',
  promptComputed.includes('BASE DU CALCUL'));
checkTrue('Score calcule : la branche qui redemande le score au modele reste fermee',
  !promptComputed.includes('Score global avec seuils explicites'));

const promptStarved = buildPrompt(starved);
checkTrue('Socle insuffisant : le bloc de socle insuffisant est emis',
  promptStarved.includes('SOCLE INSUFFISANT, AUCUN SCORE N EST PRODUIT'));
checkTrue('Socle insuffisant : le bloc de score pre-calcule n est pas emis',
  !promptStarved.includes('SCORE MECANIQUE PRE-CALCULE'));
// LE POINT CRITIQUE. Redemander le score au modele quand le socle est
// troue reveillerait le biais de convergence que score-calculator a ete
// ecrit pour eteindre.
checkTrue('Socle insuffisant : le prompt ne redemande PAS le score global au modele',
  !promptStarved.includes('Score global avec seuils explicites'));
checkTrue('Socle insuffisant : le prompt ne redemande PAS les probabilites par dimension',
  !promptStarved.includes('Probabilités par dimension'));
checkTrue('Socle insuffisant : le prompt interdit de reconstituer un score',
  promptStarved.includes('N essaie ni de reconstituer'));
checkTrue('Socle insuffisant : les dimensions tombees sont nommees NON EVALUEE',
  promptStarved.includes('NON EVALUEE'));

const promptLegacy = buildPrompt(undefined);
checkTrue('Aucun score mecanique (legacy) : la branche historique reste ouverte',
  promptLegacy.includes('Score global avec seuils explicites'));
checkTrue('Aucun score mecanique (legacy) : aucun bloc de socle insuffisant',
  !promptLegacy.includes('SOCLE INSUFFISANT'));

// ============================================================
// SECTION 2. PERSISTENCE : L ETAT SE PROPAGE, IL NE SE TRADUIT PAS
// ============================================================

console.log('\n=== Section 2. Normalisation de persistence ===');

const metaStarved = extractAnalysisMetadata({
  extraction: { companyName: 'Fixture' },
  mechanicalScore: starved,
  finalRecommendation: {},
});
check('Socle insuffisant : verdict propage, pas approfondir',
  metaStarved.verdict, INSUFFICIENT_BASIS_VERDICT);
check('Socle insuffisant : globalScore null', metaStarved.globalScore, null);

// Le verdict narratif du modele ne peut pas ressusciter le score. Un
// run dont l orchestrateur aurait quand meme rempli ses champs reste
// en socle insuffisant.
const metaStarvedWithLlm = extractAnalysisMetadata({
  extraction: { companyName: 'Fixture' },
  mechanicalScore: starved,
  finalRecommendation: { verdict: 'approfondir', globalScore: 52 },
});
check('Socle insuffisant : le verdict du modele ne ressuscite pas le verdict',
  metaStarvedWithLlm.verdict, INSUFFICIENT_BASIS_VERDICT);
check('Socle insuffisant : le score du modele ne ressuscite pas le score',
  metaStarvedWithLlm.globalScore, null);

const metaComputed = extractAnalysisMetadata({
  extraction: { companyName: 'Fixture' },
  mechanicalScore: computed,
  finalRecommendation: { verdict: computed.verdict, globalScore: computed.globalScore },
});
check('Score calcule : verdict inchange', metaComputed.verdict, computed.verdict);
check('Score calcule : score inchange', metaComputed.globalScore, computed.globalScore);

// Non-regression du chemin historique : sans mechanicalScore, la
// valeur par defaut reste celle d avant.
const metaLegacy = extractAnalysisMetadata({
  extraction: { companyName: 'Fixture' },
  finalRecommendation: {},
});
check('Legacy sans score mecanique : defaut approfondir conserve', metaLegacy.verdict, 'approfondir');

// ============================================================
// SECTION 3. LA TRAJECTOIRE N ACCUEILLE PAS LE FANTOME
// ------------------------------------------------------------
// Un fantome a 50 remplace au run suivant par un vrai 63 se lisait
// comme une amelioration de 13 points. C etait le retour en ligne
// d un moteur, pas une progression du dossier.
// ============================================================

console.log('\n=== Section 3. Deltas de trajectoire ===');

function snap(id: string, at: string, teamDim: number | null): TrajectorySnapshot {
  return {
    analysisId: id,
    analyzedAt: at,
    globalScore: 60,
    verdict: 'investir avec conditions',
    dimensions: {
      team: teamDim,
      market: 65,
      macro: 55,
      financial: 60,
      contrarian: 60,
      vigilance: 60,
    },
    fragiliteScore: null,
    fragiliteVerdict: null,
    narrativeDriftScore: null,
    narrativeDriftVerdict: null,
    patterns: {},
    combinaisons: [],
  };
}

const withGhost = compareAnalyses(snap('a', '2026-01-01T00:00:00Z', null), snap('b', '2026-02-01T00:00:00Z', 63));
check('Dimension non evaluee au premier run : aucun delta calcule',
  withGhost.dimensionsDeltas.team, null);
check('Dimensions evaluees des deux cotes : delta calcule',
  withGhost.dimensionsDeltas.market?.delta, 0);
checkTrue('Aucune alerte de chute sur une dimension non mesuree',
  !withGhost.topAlertesTrajectoire.some(a => a.includes('team')));

// Une vraie chute reste detectee : la garde ne masque pas les deltas
// reels, elle ne supprime que les deltas fabriques.
const realDrop = compareAnalyses(snap('a', '2026-01-01T00:00:00Z', 80), snap('b', '2026-02-01T00:00:00Z', 55));
check('Chute reelle mesuree : delta -25', realDrop.dimensionsDeltas.team?.delta, -25);
checkTrue('Chute reelle remontee en alerte',
  realDrop.topAlertesTrajectoire.some(a => a.includes('team')));

// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);
