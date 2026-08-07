// ============================================================
// TESTS - L ASSIETTE DU SCORE DE COHERENCE FINANCIERE
// ------------------------------------------------------------
// Verrouille la reparation du 7 aout 2026 : un test applicable que le
// modele n a pas rendu ne pese pas sur le score.
//
// LE DEFAUT D ORIGINE, MESURE AVANT D ETRE REPARE
//
// `buildFinalTests` ecrivait un placeholder de score 50 pour un test
// que l archetype declarait applicable et que le modele avait omis, et
// laissait ce test dans l assiette. Vingt-six notes sur les quarante du
// corpus en portaient, vingt-trois voyaient leur score bouger de moins
// huit a plus six points une fois le placeholder retire. Une note du
// 8 juin portait les sept tests en placeholder et publiait un score de
// 50 sur 100 qu aucun test ne fondait.
//
// La valeur mediane ne biaise pas, elle comprime l echelle : elle
// releve les mauvais dossiers et abaisse les bons, et elle frappe le
// plus fort la ou le moteur avait le plus a dire. C est pire qu un
// biais, puisqu aucun decalage ne la corrige.
//
// La troisieme forme du meme defaut vivait deux lignes plus haut : un
// test rendu sans score numerique recevait 50 par substitution
// silencieuse, donc sans laisser de trace et sans se laisser mesurer.
// Elle est traitee dans le meme geste, et deux assertions portent
// dessus parce que c est celle qui ne se voit pas.
//
// DISCIPLINE DU JEU D ESSAI
//
// Les fixtures entrent par la porte de production : `buildFinalTests`
// et `computeGlobalCoherenceScore` sont les fonctions que le moteur
// appelle, non des copies. Les scores portent des valeurs
// discriminantes, jamais 50, pour qu une assertion ne puisse pas
// passer par coincidence avec la valeur de repli qu elle traque.
//
// Execution : npx tsx lib/engines/financial-coherence-assiette.test.ts
// ============================================================

import {
  computeGlobalCoherenceScore,
  getEvaluatedTests,
  peseDansAssiette,
  TEST_ID_TO_KEY,
  type TestId,
} from './financial-coherence-archetype';
import { buildFinalTests } from './financial-coherence-engine';
import { computeMechanicalScore } from './score-calculator';
import type { FinancialCoherenceTest, FinancialCoherenceOutput } from './types';

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

/** Un test rendu, avec un score discriminant que rien d autre ne fournit. */
function rendu(id: TestId, score: number): FinancialCoherenceTest {
  return {
    testId: id,
    testName: id,
    passed: score >= 50,
    score,
    evidence: `evidence ${id}`,
    benchmark: 'ref',
    implication: '',
    nonProductionCause: null,
  };
}

const TOUS: TestId[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function tousRendus(score: number): Record<string, FinancialCoherenceTest> {
  const t: Record<string, FinancialCoherenceTest> = {};
  for (const id of TOUS) t[TEST_ID_TO_KEY[id]] = rendu(id, score);
  return t;
}

console.log('=== Section 1. peseDansAssiette, les quatre facons de ne pas peser ===');

checkTrue('un test rendu avec un score numerique pese',
  peseDansAssiette(rendu('T1', 82)));
checkTrue('un test absent ne pese pas',
  !peseDansAssiette(undefined));
checkTrue('un test non applicable ne pese pas',
  !peseDansAssiette({ ...rendu('T2', 50), notApplicable: true }));
checkTrue('un test portant une cause de non-production ne pese pas',
  !peseDansAssiette({ ...rendu('T3', 71), nonProductionCause: 'incident' }));
checkTrue('un test sans score numerique ne pese pas, meme sans cause declaree',
  !peseDansAssiette({ ...rendu('T4', 0), score: null }));
checkTrue('un score non fini ne pese pas',
  !peseDansAssiette({ ...rendu('T5', 0), score: Number.NaN }));

console.log('\n=== Section 2. Le score ne compte que ce qui a rendu ===');

// Six tests a 80 et un septieme non rendu. Si le non-rendu pesait a 50,
// la moyenne tomberait sous 80. 80 est donc discriminant : il ne peut
// pas sortir d une assiette qui contient la valeur de repli.
const avecUnNonRendu = tousRendus(80);
avecUnNonRendu[TEST_ID_TO_KEY['T3']] = {
  testId: 'T3', testName: 'T3', passed: false, score: null,
  evidence: 'non rendu', benchmark: 'N/A', implication: '',
  nonProductionCause: 'incident',
};
check('six tests a 80 et un non rendu => 80, le non rendu ne dilue pas',
  computeGlobalCoherenceScore(avecUnNonRendu, TOUS), 80);
check('l assiette nomme les six qui ont pese',
  getEvaluatedTests(avecUnNonRendu, TOUS), ['T1', 'T2', 'T4', 'T5', 'T6', 'T7']);

// Le meme jeu, mais en donnant au test non rendu la valeur de repli
// d avant le correctif. C est la preuve que le test voit la faute quand
// on la lui donne : un verrou qui ne cherche rien est vert pour la
// mauvaise raison.
const commeAvantLeCorrectif = tousRendus(80);
commeAvantLeCorrectif[TEST_ID_TO_KEY['T3']] = {
  testId: 'T3', testName: 'T3', passed: false, score: 50,
  evidence: 'Test attendu non produit par l analyse LLM, valeur neutre par defaut.',
  benchmark: 'N/A', implication: '',
};
const scoreFautif = computeGlobalCoherenceScore(commeAvantLeCorrectif, TOUS);
checkTrue('la faute d origine, si on la reintroduit, deplace bien le score',
  scoreFautif !== null && scoreFautif < 80);

console.log('\n=== Section 3. Assiette vide : pas de score, plutot que zero ===');

const aucunRendu: Record<string, FinancialCoherenceTest> = {};
for (const id of TOUS) {
  aucunRendu[TEST_ID_TO_KEY[id]] = {
    testId: id, testName: id, passed: false, score: null,
    evidence: 'non rendu', benchmark: 'N/A', implication: '',
    nonProductionCause: 'incident',
  };
}
check('aucun test rendu => score null et non zero',
  computeGlobalCoherenceScore(aucunRendu, TOUS), null);
check('aucun test rendu => assiette vide', getEvaluatedTests(aucunRendu, TOUS), []);
checkTrue('null se distingue de zero, qui est un resultat legitime',
  computeGlobalCoherenceScore(tousRendus(0), TOUS) === 0);

console.log('\n=== Section 4. buildFinalTests, par la porte de production ===');

// Le modele rend T1 seulement. T2 est declare applicable et manque.
const partiel = buildFinalTests(
  { crosseHockeySuspecte: rendu('T1', 91) } as Partial<FinancialCoherenceOutput['tests']>,
  ['T1', 'T2'],
  'A-saas-pur',
);
check('le test rendu garde son score discriminant',
  partiel.crosseHockeySuspecte.score, 91);
check('le test rendu porte une cause nulle',
  partiel.crosseHockeySuspecte.nonProductionCause, null);
check('le test applicable omis ne porte plus de score',
  partiel.ratioLtvCacImplicite.score, null);
check('le test applicable omis porte la cause incident',
  partiel.ratioLtvCacImplicite.nonProductionCause, 'incident');
checkTrue('le test applicable omis n est pas marque non applicable',
  partiel.ratioLtvCacImplicite.notApplicable !== true);
check('le score ne retient que le test rendu',
  computeGlobalCoherenceScore(partiel as unknown as Record<string, FinancialCoherenceTest>, ['T1', 'T2']),
  91);

console.log('\n=== Section 5. La substitution silencieuse, celle qui ne se voyait pas ===');

// Le modele rend l objet mais sans score exploitable. Avant le
// correctif, 50 etait substitue sans laisser de trace : le test entrait
// dans la moyenne et rien dans les donnees persistees ne permettait de
// le distinguer d un 50 mesure.
const sansScore = buildFinalTests(
  {
    crosseHockeySuspecte: rendu('T1', 91),
    ratioLtvCacImplicite: { ...rendu('T2', 0), score: undefined as unknown as number },
  } as Partial<FinancialCoherenceOutput['tests']>,
  ['T1', 'T2'],
  'A-saas-pur',
);
check('un test rendu sans score exploitable ne recoit pas 50',
  sansScore.ratioLtvCacImplicite.score, null);
check('il porte la cause incident, donc il devient mesurable',
  sansScore.ratioLtvCacImplicite.nonProductionCause, 'incident');
checkTrue('son evidence dit qu il a ete rendu, ce qui le distingue de l omis',
  /sans score exploitable/.test(sansScore.ratioLtvCacImplicite.evidence));
check('il ne pese pas dans le score',
  computeGlobalCoherenceScore(sansScore as unknown as Record<string, FinancialCoherenceTest>, ['T1', 'T2']),
  91);

console.log('\n=== Section 6. Non applicable et non produit ne se confondent pas ===');

const melange = buildFinalTests(
  { crosseHockeySuspecte: rendu('T1', 64) } as Partial<FinancialCoherenceOutput['tests']>,
  ['T1', 'T2'],
  'B-hardware-deeptech',
);
checkTrue('le test hors archetype est marque non applicable',
  melange.margeBruteCoherente.notApplicable === true);
checkTrue('le test hors archetype ne porte pas de cause de non-production',
  !melange.margeBruteCoherente.nonProductionCause);
checkTrue('le test applicable omis porte une cause et non le drapeau',
  melange.ratioLtvCacImplicite.nonProductionCause === 'incident'
  && melange.ratioLtvCacImplicite.notApplicable !== true);
checkTrue('les deux sortent du denominateur, par deux chemins distincts',
  !peseDansAssiette(melange.margeBruteCoherente)
  && !peseDansAssiette(melange.ratioLtvCacImplicite));

// ============================================================
// SECTION 7. CE QUE LE PASSAGE DE ZERO A NUL FAIT EN AVAL
// ------------------------------------------------------------
// Le score de coherence entre dans `computeMechanicalScore` comme la
// dimension Modele economique, a treize pour cent. Le faire passer de
// zero a nul est exactement le genre de changement qui se voit au run
// et pas au test, donc il se verrouille ici.
//
// Le seul consommateur qui lisait ce zero comme une valeur est le test
// `(financialScore ?? 0) > 0`, qui servait a reconnaitre le dossier
// sans business plan. Un nul y tombe du meme cote qu un zero, donc la
// sortie ne bouge pas ; ce qui bouge est la cause qu on lui attribue,
// et c est la que le defaut se logeait.
//
// NON-RETROACTIVITE. `replay-partial` fait passer ici des sorties
// persistees anterieures au 7 aout, ou zero signifiait « pas de
// donnee ». La branche ancienne doit continuer de les lire ainsi, et
// deux assertions la tiennent.
// ============================================================

console.log('\n=== Section 7. Le contrat aval, par computeMechanicalScore ===');

const AUTRES_MOTEURS = {
  team: { founderMarketFit: { score: 70, rationale: '' }, executionCapacity: { score: 70, rationale: '' } },
  market: { timing: { score: 60, rationale: '' }, organicSignals: { score: 60, rationale: '' } },
  macro: { cyclePosition: 'mature', contraryclicalOpportunity: { score: 55, rationale: '' } },
  contrarian: { globalContrarianScore: 60, signals: {} },
  blindspot: { globalBlindspotScore: 40, patterns: {} },
} as any;

const STATUTS_OK = {
  team: { status: 'ok' }, market: { status: 'ok' }, macro: { status: 'ok' },
  financialCoherence: { status: 'ok' }, contrarianAnalysis: { status: 'ok' },
  blindspotAnalysis: { status: 'ok' },
};

function dimensionFinanciere(financial: any) {
  return computeMechanicalScore({
    ...AUTRES_MOTEURS, financial, engineStatuses: STATUTS_OK,
  }).dimensions.financial;
}

// Le cas neuf, celui que le correctif rend possible : le moteur a
// tourne, le dossier portait des donnees, et aucun test n a rendu.
const sansVerdict = dimensionFinanciere({
  hasFinancialData: true, dataSource: 'bp',
  globalCoherenceScore: null, evaluatedTests: [], applicableTests: ['T1', 'T2'], tests: {},
});
checkTrue('assiette vide : la dimension sort de l assiette',
  sansVerdict.evaluated === false);
checkTrue('assiette vide : la cause est sous-champs-absents, celle des cinq autres dimensions',
  sansVerdict.evaluationCause === 'sous-champs-absents');
checkTrue('assiette vide : le dossier n est pas accuse de n avoir pas fourni de BP',
  !/business plan exploitable n a ete fourni/.test(sansVerdict.rationale)
  && sansVerdict.notEvaluable !== true);
checkTrue('assiette vide : rien ne contribue au score global',
  sansVerdict.contribution === 0);

// Le cas ancien du meme geste : pas de donnee financiere du tout. La
// cause reste celle du dossier, et le nul ne la deplace pas.
const sansDonnee = dimensionFinanciere({
  hasFinancialData: false, dataSource: 'none',
  globalCoherenceScore: null, evaluatedTests: [], applicableTests: ['T1'], tests: {},
});
checkTrue('dossier sans BP : la cause reste donnees-dossier-absentes',
  sansDonnee.evaluationCause === 'donnees-dossier-absentes');
checkTrue('dossier sans BP : le nul n a pas deplace l accusation vers le pipeline',
  sansDonnee.notEvaluable === true);

// Sous le contrat neuf, un zero est une mesure et il s evalue. C est
// ce que l ancienne condition `> 0` ne savait pas distinguer.
const zeroMesure = dimensionFinanciere({
  hasFinancialData: true, dataSource: 'bp',
  globalCoherenceScore: 0, evaluatedTests: ['T1', 'T2'], applicableTests: ['T1', 'T2'], tests: {},
});
checkTrue('contrat neuf : un zero mesure est evalue et non pris pour une absence',
  zeroMesure.evaluated === true);
check('contrat neuf : le zero mesure entre bien a zero', zeroMesure.score, 0);

// NON-RETROACTIVITE. Sans `evaluatedTests`, la regle ancienne
// s applique a l identique, zero compris.
const ancienZero = dimensionFinanciere({
  hasFinancialData: true, dataSource: 'bp', globalCoherenceScore: 0, tests: {},
});
checkTrue('analyse anterieure : un zero reste lu comme une absence de donnee',
  ancienZero.evaluated === false && ancienZero.evaluationCause === 'donnees-dossier-absentes');

const ancienScore = dimensionFinanciere({
  hasFinancialData: true, dataSource: 'bp', globalCoherenceScore: 73, tests: {},
});
checkTrue('analyse anterieure : un score non nul s evalue comme avant',
  ancienScore.evaluated === true);
check('analyse anterieure : la valeur ne bouge pas', ancienScore.score, 73);

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
