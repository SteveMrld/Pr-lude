// ============================================================
// Tests deterministes analysis-outcomes-taxonomy.ts
// ------------------------------------------------------------
// Module pur : on teste directement le mapping vers observed
// et la classification resolu/non-resolu, y compris pour les
// deux nouveaux etats alive_thriving (positif) et alive_flat
// (neutre) et le comportement retrocompatible des etats legacy
// alive et flat.
// ============================================================

import {
  type MarketOutcome,
  MARKET_OUTCOME_VALUES,
  marketOutcomeToBinary,
  isResolvedOutcome,
  RESOLVED_POSITIVE_OUTCOMES,
  RESOLVED_NEGATIVE_OUTCOMES,
  UNRESOLVED_OUTCOMES,
} from './analysis-outcomes-taxonomy';

let pass = 0;
let fail = 0;

function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// SUITE 1 - Liste des valeurs autorisees
// ============================================================
console.log('\n[Suite 1] Valeurs autorisees');
{
  check(MARKET_OUTCOME_VALUES.length === 6, 'MARKET_OUTCOME_VALUES contient 6 valeurs');
  const expected: MarketOutcome[] = ['exit', 'alive_thriving', 'fail', 'alive_flat', 'alive', 'flat'];
  for (const v of expected) {
    check(MARKET_OUTCOME_VALUES.includes(v), `MARKET_OUTCOME_VALUES contient "${v}"`);
  }
}

// ============================================================
// SUITE 2 - Mapping vers binaire observed
// ============================================================
console.log('\n[Suite 2] marketOutcomeToBinary');
{
  check(marketOutcomeToBinary('exit') === 1, 'exit -> 1 (positif resolu)');
  check(marketOutcomeToBinary('alive_thriving') === 1, 'alive_thriving -> 1 (positif resolu nouveau)');
  check(marketOutcomeToBinary('fail') === 0, 'fail -> 0 (negatif resolu)');
  check(marketOutcomeToBinary('alive_flat') === null, 'alive_flat -> null (neutre non-resolu nouveau)');
  check(marketOutcomeToBinary('alive') === null, 'alive legacy -> null (traite comme alive_flat par prudence)');
  check(marketOutcomeToBinary('flat') === null, 'flat legacy -> null (equivalent alive_flat)');
}

// ============================================================
// SUITE 3 - Classification resolu / non-resolu
// ============================================================
console.log('\n[Suite 3] isResolvedOutcome');
{
  check(isResolvedOutcome('exit') === true, 'exit est resolu');
  check(isResolvedOutcome('alive_thriving') === true, 'alive_thriving est resolu (nouveau)');
  check(isResolvedOutcome('fail') === true, 'fail est resolu');
  check(isResolvedOutcome('alive_flat') === false, 'alive_flat n est pas resolu (neutre, tracable mais exclu du discriminant)');
  check(isResolvedOutcome('alive') === false, 'alive legacy n est pas resolu');
  check(isResolvedOutcome('flat') === false, 'flat legacy n est pas resolu');
}

// ============================================================
// SUITE 4 - Sous-ensembles semantiques
// ============================================================
console.log('\n[Suite 4] Sous-ensembles');
{
  check(RESOLVED_POSITIVE_OUTCOMES.includes('exit'), 'RESOLVED_POSITIVE inclut exit');
  check(RESOLVED_POSITIVE_OUTCOMES.includes('alive_thriving'), 'RESOLVED_POSITIVE inclut alive_thriving');
  check(!RESOLVED_POSITIVE_OUTCOMES.includes('fail' as MarketOutcome), 'RESOLVED_POSITIVE n inclut pas fail');
  check(RESOLVED_NEGATIVE_OUTCOMES.length === 1 && RESOLVED_NEGATIVE_OUTCOMES[0] === 'fail', 'RESOLVED_NEGATIVE = [fail]');
  check(UNRESOLVED_OUTCOMES.includes('alive_flat'), 'UNRESOLVED inclut alive_flat');
  check(UNRESOLVED_OUTCOMES.includes('alive'), 'UNRESOLVED inclut alive legacy');
  check(UNRESOLVED_OUTCOMES.includes('flat'), 'UNRESOLVED inclut flat legacy');
  // Partition stricte : tout etat est soit dans un sous-ensemble, soit ailleurs
  for (const v of MARKET_OUTCOME_VALUES) {
    const inPos = RESOLVED_POSITIVE_OUTCOMES.includes(v);
    const inNeg = RESOLVED_NEGATIVE_OUTCOMES.includes(v);
    const inUnr = UNRESOLVED_OUTCOMES.includes(v);
    const sum = (inPos ? 1 : 0) + (inNeg ? 1 : 0) + (inUnr ? 1 : 0);
    check(sum === 1, `${v} appartient a exactement un sous-ensemble (partition stricte)`);
  }
}

// ============================================================
// SUITE 5 - Coherence avec la propriete de calibration
// ------------------------------------------------------------
// Un etat resolu doit toujours mapper vers 0 ou 1 (jamais null).
// Un etat non-resolu doit toujours mapper vers null.
// ============================================================
console.log('\n[Suite 5] Coherence mapping / resolution');
{
  for (const v of MARKET_OUTCOME_VALUES) {
    const bin = marketOutcomeToBinary(v);
    const resolved = isResolvedOutcome(v);
    if (resolved) {
      check(bin === 0 || bin === 1, `${v} resolu -> bin est 0 ou 1 (${bin})`);
    } else {
      check(bin === null, `${v} non-resolu -> bin est null`);
    }
  }
}

// ============================================================
console.log(`\nResultats : ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
