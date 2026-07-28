// ============================================================
// Tests deterministes du contrat de sortie de matchPatterns
// ------------------------------------------------------------
// Ce que ces tests prouvent : quand le parse rend une valeur
// inexploitable, le moteur Pattern Matching rend malgre tout un
// objet conforme a la forme de son type de sortie, et cet objet est
// classe empty_output par l instrumentation plutot que de passer
// pour une analyse reussie.
//
// Le defaut ferme : matchPatterns retournait directement le resultat
// de parseJSON. Un modele emettant le litteral null produisait un
// null qui traversait sanitizeStringsRecursive sans lever, sortait
// du moteur, et arrivait chez ses consommateurs. causal-engine.ts le
// dereference racine nue sur comparables et matchingPatterns : le
// throw se serait produit la, a deux moteurs de sa cause.
//
// La correction est posee a la source. Ces tests verifient donc le
// contrat du producteur, pas la garde du consommateur.
// ============================================================

import {
  buildDegradedPatternMatchingOutput,
  isUsablePatternMatchingOutput,
} from './pattern-engine';
import { passesMinimalContract } from '../orchestrator/engine-status-recorder';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] detection des sorties de parse inexploitables');

{
  // Le cas reel : JSON.parse('null') rend null, la sanitization le
  // laisse passer intact.
  check(isUsablePatternMatchingOutput(null) === false, 'null est inexploitable');
  check(isUsablePatternMatchingOutput(undefined) === false, 'undefined est inexploitable');
  check(isUsablePatternMatchingOutput('archetype interpretive') === false, 'une chaine est inexploitable');
  check(isUsablePatternMatchingOutput(42) === false, 'un nombre est inexploitable');
  check(isUsablePatternMatchingOutput([]) === false, 'un tableau est inexploitable comme sortie moteur');
  check(isUsablePatternMatchingOutput({ comparables: [] }) === true, 'un objet est exploitable');
}

console.log('\n[Suite 2] la sortie degradee est un objet conforme');

{
  const out: any = buildDegradedPatternMatchingOutput('raison de test');

  check(out !== null && typeof out === 'object', 'la sortie degradee est un objet, jamais null');
  check(Array.isArray(out.comparables) && out.comparables.length === 0, 'comparables est un tableau vide');
  check(Array.isArray(out.matchingPatterns) && out.matchingPatterns.length === 0, 'matchingPatterns est un tableau vide');
  check(Array.isArray(out.internationalBenchmarks), 'internationalBenchmarks est un tableau');
  check(out.retrospectiveBenchmark && typeof out.retrospectiveBenchmark === 'object', 'retrospectiveBenchmark est present');
  check('archetypeDominant' in out, 'archetypeDominant est declare');
  check(out.degraded === true, 'le marqueur de degradation est pose');
  check(out.degradedReason === 'raison de test', 'la raison est portee');
}

console.log('\n[Suite 3] les lectures qui levaient ne levent plus');

{
  const out: any = buildDegradedPatternMatchingOutput('raison');

  let threw = false;
  let comparables = 'non evalue';
  let patterns = 'non evalue';
  try {
    // Reproduction des deux lignes de causal-engine.ts qui
    // dereferencent la racine nue.
    comparables = (out.comparables || []).map((c: any) => `- ${c.name}`).join('\n');
    patterns = (out.matchingPatterns || []).join(' | ');
  } catch {
    threw = true;
  }
  check(!threw, 'les deux lectures racine nue de causal ne levent plus');
  check(comparables === '' && patterns === '', 'elles produisent la chaine vide');

  let threw2 = false;
  try {
    // Et la ligne du prompt de synthese, qui a leve sur c487a8b2.
    void `${(out.comparables || []).slice(0, 3).map((c: any) => `${c.name} (${c.proximity}%)`).join(' · ')}`;
    void `${out.archetypeDominant ?? '?'}`;
    void `${out.retrospectiveBenchmark?.averageScore ?? '?'}`;
  } catch { threw2 = true; }
  check(!threw2, 'les lectures du prompt de synthese ne levent plus');
}

console.log('\n[Suite 4] l instrumentation reste honnete');

{
  const degradee = buildDegradedPatternMatchingOutput('raison');

  check(passesMinimalContract('patternMatching', degradee) === false,
    'la sortie degradee echoue le contrat minimal, donc classee empty_output');

  // Contre-epreuve : une sortie reelle satisfait le contrat.
  const reelle = {
    archetypeDominant: 'depth',
    comparables: [{ name: 'Stripe', proximity: 71 }],
    matchingPatterns: ['infrastructure'],
    retrospectiveBenchmark: { averageScore: 58, insights: 'lecture' },
  };
  check(passesMinimalContract('patternMatching', reelle) === true,
    'une sortie reelle satisfait le contrat, donc classee ok');

  // Le piege evite : mettre la raison dans insights aurait suffi a
  // satisfaire le contrat et fait passer pour ok un moteur muet.
  const piege = { ...degradee, retrospectiveBenchmark: { averageScore: null, successRate: '', insights: 'raison', comparableScopeWarning: null } };
  check(passesMinimalContract('patternMatching', piege) === true,
    'temoin : loger la raison dans insights aurait bien satisfait le contrat');
  check((degradee as any).retrospectiveBenchmark.insights === '',
    'la sortie livree ne tombe pas dans ce piege');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
