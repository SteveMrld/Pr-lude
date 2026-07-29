// ============================================================
// TESTS - EVALUE CONTRE TOMBE, RENORMALISATION, SOCLE INSUFFISANT
// ------------------------------------------------------------
// Le calculateur ne recevait que six objets nullables et fondait un
// moteur tombe dans la moyenne avec un `?? 50`, valeur strictement
// indistinguable d un vrai verdict median produit par un moteur qui
// avait tourne. Ces tests verrouillent le distinguo et ses trois
// consequences : exclusion de l assiette, declaration de la base,
// et troisieme etat quand le socle ne suffit plus.
//
// Couvre :
//   - Non-regression : six moteurs presents, score strictement
//     identique au comportement historique, base pleine declaree.
//   - Renormalisation : quatre dimensions evaluees, deux tombees,
//     score calcule sur les quatre et divise par leur poids cumule.
//   - Rationale : une dimension non evaluee n affirme jamais qu une
//     valeur a ete "produit par le moteur".
//   - Socle insuffisant : sous la moitie du poids, aucun score,
//     aucun verdict, scoreStatus terminal.
//   - Second etage : racine presente mais sous-champs absents,
//     sortie skippee du parcours growth.
//   - Cas c487a8b2 : un marche qui rend un vrai 50 median compte
//     comme evalue, il n est pas confondu avec un 50 de repli.
//   - Modele economique : moteur tombe contre dossier sans business
//     plan, deux causes distinctes et deux proses distinctes.
//
// Execution : npx tsx lib/engines/score-calculator-basis.test.ts
// ============================================================

import {
  computeMechanicalScore,
  DIMENSION_WEIGHTS,
  MINIMUM_EVALUATED_WEIGHT,
} from './score-calculator';
import {
  buildSkippedTeamOutput,
  buildSkippedBlindspotOutput,
} from './skipped-outputs';
import type {
  TeamAnalysisOutput,
  MarketAnalysisOutput,
  MacroAnalysisOutput,
  FinancialCoherenceOutput,
  ContrarianAnalysisOutput,
  BlindspotAnalysisOutput,
} from './types';

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
// HELPERS
// ============================================================

function makeTeam(score = 70): TeamAnalysisOutput {
  return {
    systemicCoverage: { score, rationale: '', strengths: [], gaps: [] },
    collectiveAntiFragility: { score, rationale: '', strengths: [], gaps: [] },
    experienceTransposition: { score, rationale: '', strengths: [], gaps: [] },
    founderObsession: { score, rationale: '', strengths: [], gaps: [] },
  } as any;
}

function makeMarket(score = 65): MarketAnalysisOutput {
  return {
    perceivedSize: 'large',
    organicSignals: { score, rationale: '', evidence: [] },
    needIntensity: { score, rationale: '', gap: '' },
    defensibility: { score, moats: [], vulnerabilities: [] },
  } as any;
}

function makeMacro(score = 55): MacroAnalysisOutput {
  return {
    cyclePosition: 'mature',
    contraryclicalOpportunity: { score, rationale: '' },
  } as any;
}

function makeFinancial(globalCoherenceScore = 75): FinancialCoherenceOutput {
  return {
    hasFinancialData: true,
    dataSource: 'bp',
    tests: {} as any,
    globalCoherenceScore,
    alertesCritiques: [],
    incoherenceDeckVsBP: [],
    syntheseCoherence: '',
    recalculsEffectues: [],
  } as any;
}

function makeContrarian(score = 60): ContrarianAnalysisOutput {
  return { globalContrarianScore: score, signals: {} as any } as any;
}

function makeBlindspot(score = 40): BlindspotAnalysisOutput {
  return { globalBlindspotScore: score, patterns: {} as any } as any;
}

/** Releve d instrumentation synthetique. */
function statuses(map: Record<string, string>) {
  const out: Record<string, { status: string }> = {};
  for (const [k, v] of Object.entries(map)) out[k] = { status: v };
  return out;
}

const FULL_OK = statuses({
  team: 'ok',
  market: 'ok',
  macro: 'ok',
  financialCoherence: 'ok',
  contrarianAnalysis: 'ok',
  blindspotAnalysis: 'ok',
});

// ============================================================
// SECTION 1. NON-REGRESSION : SIX MOTEURS PRESENTS
// ------------------------------------------------------------
// Le denominateur vaut 1.0, la renormalisation est l identite, le
// score doit etre strictement celui d avant le fix. C est le
// garde-fou principal : la correction ne touche que les runs
// lacunaires.
// ============================================================

console.log('\n=== Section 1. Six moteurs presents, score inchange ===');

const full = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
  engineStatuses: FULL_OK,
});

// 0.20*70 + 0.22*65 + 0.15*55 + 0.13*75 + 0.15*60 + 0.15*60 = 64.3 -> 64
check('Six moteurs : score 64 (identique au comportement historique)', full.globalScore, 64);
check('Six moteurs : verdict investir avec conditions', full.verdict, 'investir avec conditions');
check('Six moteurs : scoreStatus computed', full.scoreStatus, 'computed');
check('Six moteurs : six dimensions evaluees', full.basis.evaluatedCount, 6);
check('Six moteurs : poids evalue cumule 1', full.basis.evaluatedWeight, 1);
check('Six moteurs : aucune dimension exclue', full.basis.notEvaluated.length, 0);
check('Six moteurs : socle suffisant', full.basis.sufficient, true);
checkTrue('Six moteurs : base declaree dans le label',
  full.basis.label.includes('6 dimensions'));
checkTrue('Six moteurs : formule declare le poids cumule 100 %',
  full.formula.includes('poids cumule 100 %'));
checkTrue('Six moteurs : toutes les dimensions portent evaluated true',
  (['team', 'market', 'macro', 'financial', 'contrarian', 'vigilance'] as const)
    .every(k => full.dimensions[k].evaluated === true));

// Le calcul sans releve d instrumentation doit donner le meme resultat :
// la disponibilite est alors recalculee sur les racines, comme le fait
// computeEngineAvailability. Couvre les dossiers persistes avant le
// recorder.
const fullNoStatuses = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
});
check('Sans releve (legacy) : score identique 64', fullNoStatuses.globalScore, 64);
check('Sans releve (legacy) : six dimensions evaluees', fullNoStatuses.basis.evaluatedCount, 6);

// ============================================================
// SECTION 2. RENORMALISATION SUR QUATRE DIMENSIONS
// ------------------------------------------------------------
// Equipe en timeout, Macro en failed. Les quatre restantes pesent
// 0.22 + 0.13 + 0.15 + 0.15 = 0.65. Le score est leur moyenne
// ponderee divisee par 0.65, pas par 1.
// ============================================================

console.log('\n=== Section 2. Quatre dimensions evaluees, deux tombees ===');

const partial = computeMechanicalScore({
  team: null,
  market: makeMarket(65),
  macro: null,
  financial: makeFinancial(75),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
  engineStatuses: statuses({
    team: 'timeout',
    market: 'ok',
    macro: 'failed',
    financialCoherence: 'ok',
    contrarianAnalysis: 'ok',
    blindspotAnalysis: 'ok',
  }),
});

// 0.22*65 + 0.13*75 + 0.15*60 + 0.15*60 = 42.05 ; 42.05 / 0.65 = 64.69 -> 65
check('Quatre evaluees : score renormalise 65', partial.globalScore, 65);
check('Quatre evaluees : scoreStatus computed', partial.scoreStatus, 'computed');
check('Quatre evaluees : evaluatedCount 4', partial.basis.evaluatedCount, 4);
check('Quatre evaluees : poids evalue cumule 0.65', partial.basis.evaluatedWeight, 0.65);
check('Quatre evaluees : deux dimensions exclues', partial.basis.notEvaluated.length, 2);
check('Equipe : cause moteur-timeout', partial.dimensions.team.evaluationCause, 'moteur-timeout');
check('Equipe : statut releve conserve', partial.dimensions.team.engineStatus, 'timeout');
check('Macro : cause moteur-failed', partial.dimensions.macro.evaluationCause, 'moteur-failed');
check('Equipe : contribution nulle', partial.dimensions.team.contribution, 0);
check('Macro : contribution nulle', partial.dimensions.macro.contribution, 0);

// La base est declaree et nomme les exclues.
checkTrue('Base declaree : "4 dimensions sur 6"',
  partial.basis.label.includes('4 dimensions sur 6'));
checkTrue('Base declaree : poids evalue cumule 65 %',
  partial.basis.label.includes('65 %'));
checkTrue('Base declaree : nomme Equipe parmi les exclues',
  partial.basis.label.includes('Equipe'));
checkTrue('Formule : enonce la division par 0.65',
  partial.formula.includes('/ 0.65'));
checkTrue('Formule : declare la base 4 sur 6',
  partial.formula.includes('4 dimensions sur 6'));

// Le point doctrinal : une dimension non evaluee n attribue rien au moteur.
checkTrue('Equipe tombee : le rationale n affirme pas "produit par le moteur"',
  !partial.dimensions.team.rationale.includes('produit par le moteur'));
checkTrue('Macro tombee : le rationale n affirme pas "produit par le moteur"',
  !partial.dimensions.macro.rationale.includes('produit par le moteur'));
checkTrue('Equipe tombee : le rationale dit que le moteur n a pas abouti',
  partial.dimensions.team.rationale.includes('non evaluee'));
checkTrue('Equipe tombee : le rationale cite le statut releve',
  partial.dimensions.team.rationale.includes('timeout'));
checkTrue('Macro tombee : le rationale cite le statut releve',
  partial.dimensions.macro.rationale.includes('failed'));

// Les dimensions evaluees, elles, continuent d attribuer au moteur.
checkTrue('Contrarien evalue : le rationale attribue bien au moteur',
  partial.dimensions.contrarian.rationale.includes('produit par le moteur'));

// ============================================================
// SECTION 3. SOCLE INSUFFISANT, TROISIEME ETAT
// ------------------------------------------------------------
// Equipe et Marche seules, 0.42 de poids cumule, sous le seuil de
// 0.50. Aucun score, aucun verdict, un etat terminal qui ne doit
// jamais rebasculer le calcul vers le modele.
// ============================================================

console.log('\n=== Section 3. Socle insuffisant ===');

const starved = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: null,
  financial: null,
  contrarian: null,
  blindspot: null,
  engineStatuses: statuses({
    team: 'ok',
    market: 'ok',
    macro: 'timeout',
    financialCoherence: 'failed-upstream',
    contrarianAnalysis: 'failed',
    blindspotAnalysis: 'timeout',
  }),
});

check('Socle insuffisant : globalScore null', starved.globalScore, null);
check('Socle insuffisant : verdict null', starved.verdict, null);
check('Socle insuffisant : scoreStatus insufficient-basis', starved.scoreStatus, 'insufficient-basis');
check('Socle insuffisant : basis.sufficient false', starved.basis.sufficient, false);
check('Socle insuffisant : poids evalue 0.42', starved.basis.evaluatedWeight, 0.42);
check('Socle insuffisant : seuil expose', starved.basis.minimumWeight, MINIMUM_EVALUATED_WEIGHT);
checkTrue('Socle insuffisant : le label le dit en toutes lettres',
  starved.basis.label.startsWith('Socle insuffisant'));
checkTrue('Socle insuffisant : la formule dit qu aucun score n est produit',
  starved.formula.startsWith('Aucun score produit'));
check('Socle insuffisant : cause failed-upstream tracee',
  starved.dimensions.financial.evaluationCause, 'moteur-failed-upstream');

// Le seuil est un plancher inclusif : exactement la moitie du poids
// suffit. Equipe 0.20 + Macro 0.15 + Contrariens 0.15 = 0.50.
const atThreshold = computeMechanicalScore({
  team: makeTeam(70),
  market: null,
  macro: makeMacro(55),
  financial: null,
  contrarian: makeContrarian(60),
  blindspot: null,
  engineStatuses: statuses({
    team: 'ok',
    market: 'timeout',
    macro: 'ok',
    financialCoherence: 'timeout',
    contrarianAnalysis: 'ok',
    blindspotAnalysis: 'timeout',
  }),
});
check('Pile au seuil 0.50 : socle suffisant', atThreshold.basis.sufficient, true);
check('Pile au seuil 0.50 : poids evalue 0.5', atThreshold.basis.evaluatedWeight, 0.5);
// 0.20*70 + 0.15*55 + 0.15*60 = 14 + 8.25 + 9 = 31.25 ; / 0.5 = 62.5 -> 63
check('Pile au seuil 0.50 : score renormalise 63', atThreshold.globalScore, 63);
check('Pile au seuil 0.50 : verdict derive', atThreshold.verdict, 'investir avec conditions');

// Verification du poids total du modele, garde-fou du seuil.
const totalWeight = Object.values(DIMENSION_WEIGHTS).reduce((s, w) => s + w, 0);
checkTrue('Poids total du modele = 1.0', Math.abs(totalWeight - 1) < 1e-9);
checkTrue('Seuil = la moitie du poids total', Math.abs(MINIMUM_EVALUATED_WEIGHT - totalWeight / 2) < 1e-9);

// ============================================================
// SECTION 4. SECOND ETAGE : RACINE PRESENTE, VALEUR ABSENTE
// ------------------------------------------------------------
// Le distinguo ne s arrete pas a la racine nulle. Une enveloppe
// presente sans aucun sous-score exploitable ne porte aucune valeur
// de moteur et ne doit pas entrer dans l assiette.
// ============================================================

console.log('\n=== Section 4. Racine presente, sous-champs absents ===');

const hollow = computeMechanicalScore({
  team: { syntheseGlobale: 'texte sans aucun sous-score', redFlags: [] } as any,
  market: { perceivedSize: 'large', syntheseGlobale: 'texte' } as any,
  macro: makeMacro(55),
  financial: makeFinancial(75),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
  engineStatuses: statuses({
    team: 'ok',
    market: 'ok',
    macro: 'ok',
    financialCoherence: 'ok',
    contrarianAnalysis: 'ok',
    blindspotAnalysis: 'ok',
  }),
});

check('Equipe creuse : non evaluee', hollow.dimensions.team.evaluated, false);
check('Equipe creuse : cause sous-champs-absents', hollow.dimensions.team.evaluationCause, 'sous-champs-absents');
check('Marche creux : non evalue', hollow.dimensions.market.evaluated, false);
check('Marche creux : cause sous-champs-absents', hollow.dimensions.market.evaluationCause, 'sous-champs-absents');
check('Enveloppes creuses : quatre dimensions evaluees', hollow.basis.evaluatedCount, 4);
checkTrue('Equipe creuse : le rationale n affirme pas "produit par le moteur"',
  !hollow.dimensions.team.rationale.includes('produit par le moteur'));

// Composite partiel : deux sous-scores sur quatre pour l equipe. Le
// composite renormalise sur les poids couverts au lieu de combler par 50.
const partialComposite = computeMechanicalScore({
  team: {
    systemicCoverage: { score: 80, rationale: '' },
    collectiveAntiFragility: { score: 60, rationale: '' },
  } as any,
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
  engineStatuses: FULL_OK,
});
// 0.30*80 + 0.25*60 = 24 + 15 = 39 ; poids couvert 0.55 ; 39/0.55 = 70.9 -> 71
check('Composite partiel Equipe : score 71 renormalise sur 0.55', partialComposite.dimensions.team.score, 71);
check('Composite partiel Equipe : dimension evaluee', partialComposite.dimensions.team.evaluated, true);
check('Composite partiel Equipe : deux sous-scores exposes', partialComposite.dimensions.team.subScores?.length, 2);
checkTrue('Composite partiel Equipe : le rationale nomme les sous-scores absents',
  partialComposite.dimensions.team.rationale.includes('Sous-scores absents'));

// Parcours growth : les sorties skippees posent des sous-scores a 50
// sans qu aucun moteur n ait tourne. Elles ne comptent pas comme
// evaluees, sinon le score growth serait a 42 % du vide.
const growth = computeMechanicalScore({
  team: buildSkippedTeamOutput(),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: makeFinancial(75),
  contrarian: makeContrarian(60),
  blindspot: buildSkippedBlindspotOutput(),
  engineStatuses: statuses({
    market: 'ok',
    macro: 'ok',
    financialCoherence: 'ok',
    contrarianAnalysis: 'ok',
  }),
});
check('Growth : Equipe skippee non evaluee', growth.dimensions.team.evaluated, false);
check('Growth : Equipe cause moteur-skipped', growth.dimensions.team.evaluationCause, 'moteur-skipped');
check('Growth : Vigilance skippee non evaluee', growth.dimensions.vigilance.evaluated, false);
check('Growth : quatre dimensions evaluees', growth.basis.evaluatedCount, 4);
// 0.22*65 + 0.15*55 + 0.13*75 + 0.15*60 = 14.3 + 8.25 + 9.75 + 9 = 41.3 ; / 0.65 = 63.5 -> 64
check('Growth : score renormalise sur les quatre moteurs reels', growth.globalScore, 64);

// ============================================================
// SECTION 5. LE 50 REEL CONTRE LE 50 DE REPLI (cas c487a8b2)
// ------------------------------------------------------------
// Un moteur Marche qui rend un vrai 50 median est un verdict, pas
// une absence. Il doit compter comme evalue et contribuer au score.
// Le 50 pose par le repli d un moteur tombe, lui, ne contribue a rien.
// ============================================================

console.log('\n=== Section 5. Le 50 median reel contre le 50 de repli ===');

const realFifty = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(50),
  macro: makeMacro(55),
  financial: makeFinancial(75),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
  engineStatuses: FULL_OK,
});
check('Marche a 50 reel : dimension evaluee', realFifty.dimensions.market.evaluated, true);
check('Marche a 50 reel : score 50', realFifty.dimensions.market.score, 50);
check('Marche a 50 reel : contribution 11 (0.22 * 50)', realFifty.dimensions.market.contribution, 11);
check('Marche a 50 reel : six dimensions evaluees', realFifty.basis.evaluatedCount, 6);
checkTrue('Marche a 50 reel : le rationale attribue au moteur',
  realFifty.dimensions.market.rationale.includes('Composite des sous-scores du marche'));

const fallbackFifty = computeMechanicalScore({
  team: makeTeam(70),
  market: null,
  macro: makeMacro(55),
  financial: makeFinancial(75),
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
  engineStatuses: statuses({
    team: 'ok',
    market: 'timeout',
    macro: 'ok',
    financialCoherence: 'ok',
    contrarianAnalysis: 'ok',
    blindspotAnalysis: 'ok',
  }),
});
check('Marche tombe : dimension non evaluee', fallbackFifty.dimensions.market.evaluated, false);
check('Marche tombe : contribution nulle', fallbackFifty.dimensions.market.contribution, 0);
check('Marche tombe : cinq dimensions evaluees', fallbackFifty.basis.evaluatedCount, 5);
checkTrue('Les deux cas produisent des scores globaux distincts',
  realFifty.globalScore !== fallbackFifty.globalScore);

// ============================================================
// SECTION 6. MODELE ECONOMIQUE : MOTEUR TOMBE CONTRE DOSSIER SANS BP
// ------------------------------------------------------------
// Le faux motif corrige. Quand le moteur Coherence financiere est
// tombe, la lacune est celle du pipeline et la note ne doit plus
// accuser le dossier de n avoir pas fourni de business plan.
// ============================================================

console.log('\n=== Section 6. Modele economique, deux lacunes distinctes ===');

const engineDown = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: null,
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
  engineStatuses: statuses({
    team: 'ok',
    market: 'ok',
    macro: 'ok',
    financialCoherence: 'failed',
    contrarianAnalysis: 'ok',
    blindspotAnalysis: 'ok',
  }),
});
check('Moteur financier tombe : non evalue', engineDown.dimensions.financial.evaluated, false);
check('Moteur financier tombe : cause moteur-failed', engineDown.dimensions.financial.evaluationCause, 'moteur-failed');
check('Moteur financier tombe : notEvaluable non pose', engineDown.dimensions.financial.notEvaluable, undefined);
checkTrue('Moteur financier tombe : le rationale n accuse pas le dossier',
  !engineDown.dimensions.financial.rationale.toLowerCase().includes('business plan'));
checkTrue('Moteur financier tombe : le rationale nomme le defaut de moteur',
  engineDown.dimensions.financial.rationale.includes('failed'));

const noBusinessPlan = computeMechanicalScore({
  team: makeTeam(70),
  market: makeMarket(65),
  macro: makeMacro(55),
  financial: {
    hasFinancialData: false,
    dataSource: 'none',
    tests: {} as any,
    globalCoherenceScore: 0,
    alertesCritiques: [],
    incoherenceDeckVsBP: [],
    syntheseCoherence: '',
    recalculsEffectues: [],
  } as any,
  contrarian: makeContrarian(60),
  blindspot: makeBlindspot(40),
  engineStatuses: FULL_OK,
});
check('Dossier sans BP : non evalue', noBusinessPlan.dimensions.financial.evaluated, false);
check('Dossier sans BP : cause donnees-dossier-absentes',
  noBusinessPlan.dimensions.financial.evaluationCause, 'donnees-dossier-absentes');
check('Dossier sans BP : notEvaluable conserve son sens', noBusinessPlan.dimensions.financial.notEvaluable, true);
checkTrue('Dossier sans BP : le rationale nomme bien le business plan manquant',
  noBusinessPlan.dimensions.financial.rationale.toLowerCase().includes('business plan'));
checkTrue('Dossier sans BP : le rationale dit que le moteur a tourne',
  noBusinessPlan.dimensions.financial.rationale.includes('a tourne'));
check('Dossier sans BP : cinq dimensions evaluees', noBusinessPlan.basis.evaluatedCount, 5);
// 0.20*70 + 0.22*65 + 0.15*55 + 0.15*60 + 0.15*60 = 14 + 14.3 + 8.25 + 9 + 9 = 54.55 ; / 0.87 = 62.7 -> 63
check('Dossier sans BP : score renormalise sur 0.87', noBusinessPlan.globalScore, 63);

// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);
