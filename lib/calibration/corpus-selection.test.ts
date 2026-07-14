// ============================================================
// Tests deterministes corpus-selection.ts
// ------------------------------------------------------------
// Meme pattern que le reste du repo : check / checkTrue,
// compteurs pass / fail, process.exit final. Aucun framework.
//
// Trois blocs :
//   Suite 1 : la regle applique correctement les criteres, un cas
//             par branche du diagramme de decision.
//   Suite 2 : proprietes invariantes de la regle (ordre stable,
//             comptes coherents, motifs exclusifs).
//   Suite 3 : garde anti biais du selectionneur, verifie que la
//             signature de la regle ne permet pas d ecarter un
//             dossier nommement.
// ============================================================

import {
  applyCorpusSelectionRule,
  parseReliabilityFromNotes,
  DISCRIMINANT_RELIABILITY_SET,
  RELIABILITY_VALUES,
  isReliability,
  renderAuditPlain,
  type SelectionCandidate,
  type Reliability,
} from './corpus-selection';
import type { MarketOutcome } from '../analysis-outcomes-taxonomy';

let pass = 0;
let fail = 0;

function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

function candidate(
  id: string,
  outcome: MarketOutcome,
  reliability: Reliability | null,
  name: string | null = 'Test',
): SelectionCandidate {
  return { analysisId: id, companyName: name, marketOutcome: outcome, reliability };
}

// ============================================================
// SUITE 1 - Chaque branche du diagramme de decision
// ============================================================

console.log('\n[Suite 1] Cas de decision par branche');

{
  const c = candidate('id1', 'exit', 'haute');
  const a = applyCorpusSelectionRule([c]);
  check(a.decisions[0].included === true, 'haute + exit resolu positif => inclus');
  check(a.decisions[0].exclusionReason === null, '  motif nul');
}

{
  const c = candidate('id2', 'alive_thriving', 'haute');
  const a = applyCorpusSelectionRule([c]);
  check(a.decisions[0].included === true, 'haute + alive_thriving resolu positif => inclus');
}

{
  const c = candidate('id3', 'fail', 'bonne');
  const a = applyCorpusSelectionRule([c]);
  check(a.decisions[0].included === true, 'bonne + fail resolu negatif => inclus');
  check(a.decisions[0].exclusionReason === null, '  motif nul');
}

{
  const c = candidate('id4', 'alive_thriving', 'moyenne');
  const a = applyCorpusSelectionRule([c]);
  check(a.decisions[0].included === false, 'moyenne + alive_thriving => exclus');
  check(a.decisions[0].exclusionReason === 'reliability-below-threshold', '  motif reliability-below-threshold');
}

{
  const c = candidate('id5', 'exit', null);
  const a = applyCorpusSelectionRule([c]);
  check(a.decisions[0].included === false, 'fiabilite null + resolu => exclus');
  check(a.decisions[0].exclusionReason === 'reliability-missing', '  motif reliability-missing');
}

{
  const c = candidate('id6', 'alive_flat', 'haute');
  const a = applyCorpusSelectionRule([c]);
  check(a.decisions[0].included === false, 'alive_flat non resolu => exclus meme si haute');
  check(a.decisions[0].exclusionReason === 'unresolved-outcome', '  motif unresolved-outcome prioritaire');
}

{
  const c = candidate('id7', 'alive', 'bonne');
  const a = applyCorpusSelectionRule([c]);
  check(a.decisions[0].included === false, 'legacy alive non resolu => exclus');
  check(a.decisions[0].exclusionReason === 'unresolved-outcome', '  motif unresolved-outcome');
}

{
  const c = candidate('id8', 'flat', 'haute');
  const a = applyCorpusSelectionRule([c]);
  check(a.decisions[0].included === false, 'legacy flat non resolu => exclus');
}

// ============================================================
// SUITE 2 - Proprietes invariantes
// ============================================================

console.log('\n[Suite 2] Proprietes invariantes');

{
  const corpus: SelectionCandidate[] = [
    candidate('a', 'exit', 'haute', 'Braincube'),
    candidate('b', 'fail', 'haute', 'Bemersive'),
    candidate('c', 'alive_thriving', 'moyenne', 'Odalys'),
    candidate('d', 'alive_flat', 'haute', 'Humanava'),
    candidate('e', 'exit', null, 'JNAN Hotels'),
    candidate('f', 'fail', 'bonne', 'Crowdaa'),
  ];
  const a = applyCorpusSelectionRule(corpus);
  check(a.decisions.length === corpus.length, 'une decision par candidat');
  check(a.includedCount + a.excludedCount === corpus.length, 'inclus + exclus == total');
  check(a.includedCount === 3, `3 inclus attendus (a, b, f), obtenu ${a.includedCount}`);
  check(a.countsByExclusion['reliability-below-threshold'] === 1, '1 exclusion moyenne');
  check(a.countsByExclusion['reliability-missing'] === 1, '1 exclusion missing');
  check(a.countsByExclusion['unresolved-outcome'] === 1, '1 exclusion unresolved');
}

{
  // Deux ordres differents produisent le meme ensemble de decisions
  const corpus1: SelectionCandidate[] = [
    candidate('a', 'exit', 'haute'),
    candidate('b', 'fail', 'bonne'),
    candidate('c', 'alive_thriving', 'moyenne'),
  ];
  const corpus2 = [corpus1[2], corpus1[0], corpus1[1]];
  const a1 = applyCorpusSelectionRule(corpus1);
  const a2 = applyCorpusSelectionRule(corpus2);
  check(a1.includedCount === a2.includedCount, 'ordre indifferent, meme inclusCount');
  const set1 = new Set(a1.decisions.filter(d => d.included).map(d => d.analysisId));
  const set2 = new Set(a2.decisions.filter(d => d.included).map(d => d.analysisId));
  check(set1.size === set2.size && Array.from(set1).every(id => set2.has(id)), '  meme ensemble d inclus');
}

{
  // Idempotence : appliquer la regle deux fois donne le meme resultat
  const corpus: SelectionCandidate[] = [
    candidate('a', 'exit', 'haute'),
    candidate('b', 'fail', 'moyenne'),
  ];
  const a1 = applyCorpusSelectionRule(corpus);
  const a2 = applyCorpusSelectionRule(corpus);
  check(JSON.stringify(a1) === JSON.stringify(a2), 'idempotence sur meme entree');
}

{
  // Corpus vide, resultat coherent
  const a = applyCorpusSelectionRule([]);
  check(a.decisions.length === 0, 'corpus vide, aucune decision');
  check(a.includedCount === 0, '  0 inclus');
  check(a.excludedCount === 0, '  0 exclus');
}

{
  // Motifs mutuellement exclusifs : un candidat inclus n a pas de motif
  const corpus: SelectionCandidate[] = [
    candidate('a', 'exit', 'haute'),
    candidate('b', 'exit', 'moyenne'),
    candidate('c', 'alive_flat', null),
  ];
  const a = applyCorpusSelectionRule(corpus);
  for (const d of a.decisions) {
    if (d.included) check(d.exclusionReason === null, `inclus ${d.analysisId} sans motif`);
    else check(d.exclusionReason !== null, `exclus ${d.analysisId} avec motif`);
  }
}

// ============================================================
// SUITE 3 - Garde anti biais du selectionneur
// ------------------------------------------------------------
// Si un jour un contributeur ajoutait un deuxieme parametre au type
// excludeIds, whitelist, forceInclude, overrideMap, ces tests
// tomberaient et interdiraient le merge. La signature de la regle
// est un contrat de rigueur, pas un detail d implementation.
// ============================================================

console.log('\n[Suite 3] Garde anti biais du selectionneur');

{
  check(applyCorpusSelectionRule.length === 1, 'la regle prend un seul parametre positionnel');
}

{
  // La sortie ne contient aucun champ permettant de reidentifier le
  // dossier autrement que par son id d analyse et son nom (deja dans
  // l entree). Absence de champ override, whitelist, etc.
  const a = applyCorpusSelectionRule([candidate('a', 'exit', 'haute')]);
  const d = a.decisions[0];
  const keys = Object.keys(d).sort();
  const expected = ['analysisId', 'companyName', 'exclusionReason', 'included', 'marketOutcome', 'reliability'].sort();
  check(JSON.stringify(keys) === JSON.stringify(expected), 'shape de SelectionDecision figee, aucun champ extension');
}

{
  // Un dossier nommement cible ne peut pas etre exclu differemment
  // d un autre a criteres identiques. On construit deux candidats
  // strictement equivalents sur les criteres et on verifie qu ils
  // recoivent la meme decision. Toute divergence prouverait qu un
  // levier caché existe.
  const c1 = candidate('id-suspect', 'exit', 'haute', 'DossierSuspect');
  const c2 = candidate('id-neutre', 'exit', 'haute', 'DossierNeutre');
  const a = applyCorpusSelectionRule([c1, c2]);
  check(a.decisions[0].included === a.decisions[1].included, 'candidats a criteres identiques => meme decision');
  check(a.decisions[0].exclusionReason === a.decisions[1].exclusionReason, '  meme motif');
}

// ============================================================
// SUITE 4 - helpers annexes
// ============================================================

console.log('\n[Suite 4] Helpers');

{
  check(isReliability('haute'), 'isReliability haute');
  check(isReliability('bonne'), 'isReliability bonne');
  check(isReliability('moyenne'), 'isReliability moyenne');
  check(!isReliability('basse'), 'isReliability basse rejete');
  check(!isReliability(''), 'isReliability chaine vide rejete');
  check(!isReliability(null), 'isReliability null rejete');
}

{
  check(parseReliabilityFromNotes('Fiabilite haute. Source primaire.') === 'haute', 'parse haute');
  check(parseReliabilityFromNotes('fiabilité BONNE, presse.') === 'bonne', 'parse bonne casse mixte accent');
  check(parseReliabilityFromNotes('Fiabilite MOYENNE, PROXY') === 'moyenne', 'parse moyenne maj');
  check(parseReliabilityFromNotes('note sans mention') === null, 'aucune mention => null');
  check(parseReliabilityFromNotes(null) === null, 'notes null => null');
  check(parseReliabilityFromNotes('') === null, 'notes vide => null');
}

{
  check(DISCRIMINANT_RELIABILITY_SET.length === 2, 'set discriminant = 2 elements');
  check(DISCRIMINANT_RELIABILITY_SET.includes('haute'), '  haute dans set');
  check(DISCRIMINANT_RELIABILITY_SET.includes('bonne'), '  bonne dans set');
  check(!(DISCRIMINANT_RELIABILITY_SET as readonly string[]).includes('moyenne'), '  moyenne PAS dans set');
  check(RELIABILITY_VALUES.length === 3, 'RELIABILITY_VALUES = 3 elements');
}

{
  // Rendu d audit contient les motifs et les comptes agreges
  const corpus: SelectionCandidate[] = [
    candidate('a', 'exit', 'haute', 'Alpha'),
    candidate('b', 'alive_thriving', 'moyenne', 'Beta'),
  ];
  const audit = applyCorpusSelectionRule(corpus);
  const text = renderAuditPlain(audit);
  check(text.includes('Alpha'), 'audit mentionne Alpha');
  check(text.includes('Beta'), 'audit mentionne Beta');
  check(text.includes('reliability-below-threshold'), 'audit mentionne motif Beta');
  check(text.includes('1 inclus'), 'audit annonce 1 inclus');
  check(text.includes('1 exclus'), 'audit annonce 1 exclus');
}

// ============================================================
// SORTIE
// ============================================================

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
