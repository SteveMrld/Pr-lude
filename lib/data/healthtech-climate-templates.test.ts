// ============================================================
// TEST DE NON-REGRESSION G3
// ------------------------------------------------------------
// Verifie que la calibration des templates healthtech et climate-tech
// (correction G3 de l audit corpus mai 2026) sort effectivement ces
// deux asset classes du mapping fintech historique, et que le SaaS B2B
// canonique reste sur ses seuils Sacks/Bessemer/OpenView 2024.
//
// Le bug historique : pour un dossier healthcare ou climate-tech, les
// indicateurs etaient juges contre des seuils calibres pour le fintech
// (ndr 95/105/115, paybackCac 18/24/30, grossMargin 40/55/70) alors que
// la sante a un cycle de vente different (paybackCac assoupli) et le
// climate-tech un profil capital-intensif (burnMultiple tolerant).
// ============================================================

import {
  INDICATOR_BENCHMARKS,
  getIndicatorBenchmarks,
} from './indicator-benchmarks';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label} -> got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, cond: boolean): void {
  if (cond) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}`);
    fail++;
  }
}

console.log('=== Section 1. healthtech ne consomme plus le template fintech ===');

const healthSeed = getIndicatorBenchmarks('healthtech', 'seed');
const fintechSeed = getIndicatorBenchmarks('fintech', 'seed');
const healthA = getIndicatorBenchmarks('healthtech', 'series-a');
const fintechA = getIndicatorBenchmarks('fintech', 'series-a');

checkTrue('healthtech seed defini', healthSeed !== null);
checkTrue('healthtech seed n est pas l objet fintech seed', healthSeed !== fintechSeed);
checkTrue('healthtech series-a n est pas l objet fintech series-a', healthA !== fintechA);

// Discrimination par seuil : la sante a un paybackCac assoupli vs fintech.
check('healthtech paybackCac.sain = 20 (sources Bessemer)', healthSeed?.paybackCac?.sain, 20);
check('fintech paybackCac.sain = 24 (cible plus rapide)', fintechSeed?.paybackCac?.sain, 24);
checkTrue(
  'healthtech paybackCac.sain != fintech paybackCac.sain',
  healthSeed?.paybackCac?.sain !== fintechSeed?.paybackCac?.sain,
);

// Discrimination par grossMargin : la sante tolere une composante services.
check('healthtech grossMargin.sain = 60 (tolerance services)', healthSeed?.grossMargin?.sain, 60);
check('fintech grossMargin.sain = 50', fintechSeed?.grossMargin?.sain, 50);
checkTrue(
  'healthtech grossMargin.sain != fintech grossMargin.sain',
  healthSeed?.grossMargin?.sain !== fintechSeed?.grossMargin?.sain,
);

// La fintech porte un NDR sur Series A (et au-dela) qui n a pas de sens
// par defaut sur la sante : on omet plutot que de fabriquer un seuil.
checkTrue(
  'healthtech ne fabrique pas de NDR par defaut (omis faute de source publiee par stade)',
  healthA?.ndr === undefined,
);
checkTrue(
  'fintech porte un NDR series-a explicitement',
  fintechA?.ndr !== undefined,
);

// Metadonnees G3.
check('healthtech asOf = 2023', healthSeed?.asOf, '2023');
check('healthtech confidence = medium', healthSeed?.confidence, 'medium');
checkTrue('healthtech porte une note de doctrine', !!healthSeed?.notes && healthSeed.notes.length > 100);

console.log('');
console.log('=== Section 2. climate-tech ne consomme plus le template fintech ===');

const climateSeed = getIndicatorBenchmarks('climate-tech', 'seed');
const climateA = getIndicatorBenchmarks('climate-tech', 'series-a');

checkTrue('climate-tech seed defini', climateSeed !== null);
checkTrue('climate-tech seed n est pas l objet fintech seed', climateSeed !== fintechSeed);
checkTrue('climate-tech series-a n est pas l objet fintech series-a', climateA !== fintechA);

// Discrimination par burnMultiple : le climat brule plus longtemps.
check('climate-tech burnMultiple.surveille = 8 (tolerant CAPEX)', climateSeed?.burnMultiple?.surveille, 8);
check('fintech burnMultiple.surveille = 4 (asset-light)', fintechSeed?.burnMultiple?.surveille, 4);
checkTrue(
  'climate-tech burnMultiple.surveille > fintech burnMultiple.surveille',
  (climateSeed?.burnMultiple?.surveille ?? 0) > (fintechSeed?.burnMultiple?.surveille ?? 0),
);

// Pas de paybackCac SaaS par defaut sur climate (template explicite).
checkTrue(
  'climate-tech omet paybackCac (pas de cycle SaaS pertinent par defaut)',
  climateSeed?.paybackCac === undefined,
);
checkTrue(
  'fintech porte paybackCac explicitement',
  fintechSeed?.paybackCac !== undefined,
);

// ruleOf40 plus modere : profitabilite tardive sur le climat.
check('climate-tech ruleOf40.best = 25 (profitabilite tardive)', climateSeed?.ruleOf40?.best, 25);
check('fintech ruleOf40.best = 50', fintechSeed?.ruleOf40?.best, 50);
checkTrue(
  'climate-tech ruleOf40.best < fintech ruleOf40.best',
  (climateSeed?.ruleOf40?.best ?? 999) < (fintechSeed?.ruleOf40?.best ?? -999),
);

// Metadonnees G3.
check('climate-tech asOf = 2025', climateSeed?.asOf, '2025');
check('climate-tech confidence = low', climateSeed?.confidence, 'low');
checkTrue('climate-tech porte une note de doctrine etendue', !!climateSeed?.notes && climateSeed.notes.length > 200);

console.log('');
console.log('=== Section 3. healthtech et climate-tech utilisent le meme template aux 4 stades ===');

const healthB = getIndicatorBenchmarks('healthtech', 'series-b');
const healthC = getIndicatorBenchmarks('healthtech', 'series-c-plus');
checkTrue('healthtech seed == series-a (template unique)', healthSeed === healthA);
checkTrue('healthtech series-a == series-b', healthA === healthB);
checkTrue('healthtech series-b == series-c-plus', healthB === healthC);

const climateB = getIndicatorBenchmarks('climate-tech', 'series-b');
const climateC = getIndicatorBenchmarks('climate-tech', 'series-c-plus');
checkTrue('climate-tech seed == series-a (template unique)', climateSeed === climateA);
checkTrue('climate-tech series-a == series-b', climateA === climateB);
checkTrue('climate-tech series-b == series-c-plus', climateB === climateC);

console.log('');
console.log('=== Section 4. SaaS B2B canonique inchange (non-regression) ===');

const saasSeed = getIndicatorBenchmarks('saas-b2b', 'seed');
const saasA = getIndicatorBenchmarks('saas-b2b', 'series-a');
const saasB = getIndicatorBenchmarks('saas-b2b', 'series-b');
const saasC = getIndicatorBenchmarks('saas-b2b', 'series-c-plus');

// Les seuils canoniques Sacks/Bessemer/OpenView 2024 doivent rester exactement
// tels qu ils sont. Le test detectera une derive accidentelle si quelqu un
// touche au template TPL_SAAS_*.
check('saas seed burnMultiple.best = 2', saasSeed?.burnMultiple?.best, 2);
check('saas series-a ndr.best = 120', saasA?.ndr?.best, 120);
check('saas series-b ndr.best = 130', saasB?.ndr?.best, 130);
check('saas series-c+ burnMultiple.best = 0.5', saasC?.burnMultiple?.best, 0.5);
check('saas series-c+ grossMargin.best = 80', saasC?.grossMargin?.best, 80);

// Les SaaS doivent rester sur leurs templates par stade (differencies)
// alors que healthtech / climate-tech sont sur un template unique.
checkTrue('saas seed != saas series-a (differenciation par stade)', saasSeed !== saasA);
checkTrue('saas series-b != saas series-c+', saasB !== saasC);

console.log('');
console.log('=== Section 5. Le mapping pour proptech reste sur fintech (intentionnel, hors scope G3) ===');

const proptechSeed = getIndicatorBenchmarks('proptech', 'seed');
checkTrue(
  'proptech reste sur le template fintech (decision explicite, sourcing separe)',
  proptechSeed === fintechSeed,
);

console.log('');
console.log(`${pass}/${pass + fail} tests passes`);
process.exit(fail === 0 ? 0 : 1);
