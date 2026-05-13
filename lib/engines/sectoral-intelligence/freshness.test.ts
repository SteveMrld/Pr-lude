// ============================================================
// Tests deterministes des helpers de fraicheur sectorielle
// ------------------------------------------------------------
// Couvre les trois etats (a_jour, recommandee, perimee), la
// gestion des entrees nulles, des dates invalides, des dates
// dans le futur, et l affichage editorial.
//
// Execution : tsx lib/engines/sectoral-intelligence/freshness.test.ts
// ============================================================

import {
  computeFreshness,
  computeAgeDays,
  freshnessLabel,
  freshnessColorKey,
  FRESHNESS_THRESHOLD_A_JOUR_DAYS,
  FRESHNESS_THRESHOLD_RECOMMANDEE_DAYS,
  type FreshnessState,
} from './freshness';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

const NOW = new Date('2026-05-13T10:00:00Z');
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * MS_PER_DAY).toISOString();
}

// ============================================================
console.log('\n--- computeFreshness ---');
// ============================================================

check(
  'fiche generee il y a 1 jour est a_jour',
  computeFreshness(daysAgo(1), NOW),
  'a_jour' as FreshnessState,
);

check(
  'fiche generee il y a 50 jours est a_jour',
  computeFreshness(daysAgo(50), NOW),
  'a_jour' as FreshnessState,
);

check(
  'fiche generee il y a 99 jours est a_jour (juste sous le seuil)',
  computeFreshness(daysAgo(99), NOW),
  'a_jour' as FreshnessState,
);

check(
  'fiche generee il y a 100 jours bascule en recommandee',
  computeFreshness(daysAgo(100), NOW),
  'recommandee' as FreshnessState,
);

check(
  'fiche generee il y a 150 jours est recommandee',
  computeFreshness(daysAgo(150), NOW),
  'recommandee' as FreshnessState,
);

check(
  'fiche generee il y a 184 jours est encore recommandee',
  computeFreshness(daysAgo(184), NOW),
  'recommandee' as FreshnessState,
);

check(
  'fiche generee il y a 185 jours bascule en perimee',
  computeFreshness(daysAgo(185), NOW),
  'perimee' as FreshnessState,
);

check(
  'fiche generee il y a 365 jours est perimee',
  computeFreshness(daysAgo(365), NOW),
  'perimee' as FreshnessState,
);

check(
  'absence de fiche (null) traitee comme perimee',
  computeFreshness(null, NOW),
  'perimee' as FreshnessState,
);

check(
  'absence de fiche (undefined) traitee comme perimee',
  computeFreshness(undefined, NOW),
  'perimee' as FreshnessState,
);

check(
  'chaine vide traitee comme perimee',
  computeFreshness('', NOW),
  'perimee' as FreshnessState,
);

check(
  'date invalide traitee comme perimee',
  computeFreshness('pas-une-date', NOW),
  'perimee' as FreshnessState,
);

check(
  'date dans le futur traitee comme a_jour (horloge desync)',
  computeFreshness(new Date(NOW.getTime() + 10 * MS_PER_DAY).toISOString(), NOW),
  'a_jour' as FreshnessState,
);

check(
  'accepte un objet Date directement',
  computeFreshness(new Date(NOW.getTime() - 30 * MS_PER_DAY), NOW),
  'a_jour' as FreshnessState,
);

// ============================================================
console.log('\n--- computeAgeDays ---');
// ============================================================

check('age 0 jour si tout juste genere', computeAgeDays(daysAgo(0), NOW), 0);
check('age 1 jour', computeAgeDays(daysAgo(1), NOW), 1);
check('age 99 jours', computeAgeDays(daysAgo(99), NOW), 99);
check('age 365 jours', computeAgeDays(daysAgo(365), NOW), 365);
check('age null si pas de fiche', computeAgeDays(null, NOW), null);
check('age null si date invalide', computeAgeDays('lalala', NOW), null);
check(
  'age 0 si date dans le futur',
  computeAgeDays(new Date(NOW.getTime() + 5 * MS_PER_DAY).toISOString(), NOW),
  0,
);

// ============================================================
console.log('\n--- freshnessLabel ---');
// ============================================================

check('libelle a_jour', freshnessLabel('a_jour'), 'A jour');
check('libelle recommandee', freshnessLabel('recommandee'), 'Regeneration recommandee');
check('libelle perimee', freshnessLabel('perimee'), 'Perimee');

// ============================================================
console.log('\n--- freshnessColorKey ---');
// ============================================================

check('couleur a_jour = green', freshnessColorKey('a_jour'), 'green');
check('couleur recommandee = amber', freshnessColorKey('recommandee'), 'amber');
check('couleur perimee = red', freshnessColorKey('perimee'), 'red');

// ============================================================
console.log('\n--- constantes ---');
// ============================================================

check(
  'seuil a_jour cale sur un trimestre + marge',
  FRESHNESS_THRESHOLD_A_JOUR_DAYS,
  100,
);
check(
  'seuil recommandee cale sur deux trimestres',
  FRESHNESS_THRESHOLD_RECOMMANDEE_DAYS,
  185,
);

// ============================================================
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
