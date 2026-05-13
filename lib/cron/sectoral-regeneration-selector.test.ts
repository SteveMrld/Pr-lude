// ============================================================
// Tests deterministes du selecteur cron sectoriel
// ------------------------------------------------------------
// Couvre l eligibilite (90 jours), le plafond quotidien (4 par
// defaut), l ordre stable (anciennete decroissante puis slug
// alphabetique en tie-break), la priorite absolue des fiches
// jamais generees, et le scenario d integration sur 13 fiches a
// anciennetes variees.
//
// Aucun acces reseau, aucune dependance Supabase.
//
// Execution :
//   tsx lib/cron/sectoral-regeneration-selector.test.ts
// ============================================================

import {
  selectEligibleSectorsForRegeneration,
  DEFAULT_SECTOR_REGEN_THRESHOLD_DAYS,
  DEFAULT_DAILY_REGEN_BUDGET,
  type SectorRegenCandidate,
} from './sectoral-regeneration-selector';
import { SECTORS } from '../engines/sectoral-intelligence';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  const eq = actual === expected || JSON.stringify(actual) === JSON.stringify(expected);
  if (eq) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

const NOW = new Date('2026-05-13T07:00:00Z');
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysAgoIso(n: number): string {
  return new Date(NOW.getTime() - n * MS_PER_DAY).toISOString();
}

// ============================================================
console.log('\n--- constantes ---');
// ============================================================

check('seuil par defaut 90 jours', DEFAULT_SECTOR_REGEN_THRESHOLD_DAYS, 90);
check('budget quotidien par defaut 4', DEFAULT_DAILY_REGEN_BUDGET, 4);

// ============================================================
console.log('\n--- eligibilite stricte au seuil 90 jours ---');
// ============================================================

const justUnder = selectEligibleSectorsForRegeneration(
  [{ sectorSlug: 'fintech', latestGeneratedAt: daysAgoIso(89) }],
  NOW,
);
check('fiche de 89 jours non eligible', justUnder.length, 0);

const exactly90 = selectEligibleSectorsForRegeneration(
  [{ sectorSlug: 'fintech', latestGeneratedAt: daysAgoIso(90) }],
  NOW,
);
check('fiche de 90 jours pile eligible', exactly90.length, 1);

const wayOld = selectEligibleSectorsForRegeneration(
  [{ sectorSlug: 'fintech', latestGeneratedAt: daysAgoIso(365) }],
  NOW,
);
check('fiche de 365 jours eligible', wayOld.length, 1);
check('fiche de 365 jours : ageDays 365', wayOld[0]?.ageDays, 365);

// ============================================================
console.log('\n--- fiches jamais generees ---');
// ============================================================

const neverGen = selectEligibleSectorsForRegeneration(
  [
    { sectorSlug: 'fintech', latestGeneratedAt: daysAgoIso(50) },
    { sectorSlug: 'ia-appliquee', latestGeneratedAt: null },
    { sectorSlug: 'climat-energie', latestGeneratedAt: daysAgoIso(120) },
  ],
  NOW,
);
check('jamais generee passe en priorite absolue', neverGen[0]?.sectorSlug, 'ia-appliquee');
check('jamais generee : ageDays = +Infinity', neverGen[0]?.ageDays, Number.POSITIVE_INFINITY);
check(
  'jamais generee + 120j : 2 eligibles',
  neverGen.length,
  2,
);
check('120j en seconde position', neverGen[1]?.sectorSlug, 'climat-energie');

// ============================================================
console.log('\n--- date invalide traitee comme jamais generee ---');
// ============================================================

const badDate = selectEligibleSectorsForRegeneration(
  [{ sectorSlug: 'fintech', latestGeneratedAt: 'pas-une-date' }],
  NOW,
);
check('date invalide est eligible', badDate.length, 1);
check('date invalide : ageDays = +Infinity', badDate[0]?.ageDays, Number.POSITIVE_INFINITY);

// ============================================================
console.log('\n--- plafond quotidien (max 4) ---');
// ============================================================

const allOld = SECTORS.map((s, i) => ({
  sectorSlug: s.slug,
  latestGeneratedAt: daysAgoIso(100 + i * 10),
}));
const truncated = selectEligibleSectorsForRegeneration(allOld, NOW);
check('treize fiches > 90j tronquees a 4', truncated.length, 4);

const customBudget = selectEligibleSectorsForRegeneration(allOld, NOW, { dailyBudget: 7 });
check('budget custom 7 = 7 fiches', customBudget.length, 7);

const zeroBudget = selectEligibleSectorsForRegeneration(allOld, NOW, { dailyBudget: 0 });
check('budget 0 = aucune fiche', zeroBudget.length, 0);

const negativeBudget = selectEligibleSectorsForRegeneration(allOld, NOW, { dailyBudget: -3 });
check('budget negatif protege en 0', negativeBudget.length, 0);

// ============================================================
console.log('\n--- ordre stable : anciennete decroissante puis slug ---');
// ============================================================

const mixed = selectEligibleSectorsForRegeneration(
  [
    { sectorSlug: 'fintech', latestGeneratedAt: daysAgoIso(120) },
    { sectorSlug: 'ia-appliquee', latestGeneratedAt: daysAgoIso(200) },
    { sectorSlug: 'sante-biotech', latestGeneratedAt: daysAgoIso(95) },
    { sectorSlug: 'climat-energie', latestGeneratedAt: daysAgoIso(150) },
  ],
  NOW,
  { dailyBudget: 10 },
);
check(
  'ordre = ia (200), climat (150), fintech (120), sante (95)',
  mixed.map((m) => m.sectorSlug).join(','),
  'ia-appliquee,climat-energie,fintech,sante-biotech',
);

// Tie-break sur le slug en cas d age egal
const tied = selectEligibleSectorsForRegeneration(
  [
    { sectorSlug: 'fintech', latestGeneratedAt: daysAgoIso(120) },
    { sectorSlug: 'climat-energie', latestGeneratedAt: daysAgoIso(120) },
    { sectorSlug: 'agritech-foodtech', latestGeneratedAt: daysAgoIso(120) },
  ],
  NOW,
  { dailyBudget: 10 },
);
check(
  'tie-break alphabetique sur slug',
  tied.map((m) => m.sectorSlug).join(','),
  'agritech-foodtech,climat-energie,fintech',
);

// Tie-break entre deux fiches jamais generees
const tiedInf = selectEligibleSectorsForRegeneration(
  [
    { sectorSlug: 'fintech', latestGeneratedAt: null },
    { sectorSlug: 'ia-appliquee', latestGeneratedAt: null },
    { sectorSlug: 'climat-energie', latestGeneratedAt: daysAgoIso(150) },
  ],
  NOW,
  { dailyBudget: 10 },
);
check(
  'tie-break alphabetique entre jamais generees',
  tiedInf.map((m) => m.sectorSlug).join(','),
  'fintech,ia-appliquee,climat-energie',
);

// ============================================================
console.log('\n--- exclusion des fiches recentes ---');
// ============================================================

const onlyRecent = selectEligibleSectorsForRegeneration(
  SECTORS.map((s) => ({ sectorSlug: s.slug, latestGeneratedAt: daysAgoIso(20) })),
  NOW,
);
check('toutes recentes : 0 eligible', onlyRecent.length, 0);

// ============================================================
console.log('\n--- determinisme : appel repete = meme resultat ---');
// ============================================================

const candidates: SectorRegenCandidate[] = [
  { sectorSlug: 'fintech', latestGeneratedAt: daysAgoIso(100) },
  { sectorSlug: 'ia-appliquee', latestGeneratedAt: daysAgoIso(95) },
  { sectorSlug: 'climat-energie', latestGeneratedAt: daysAgoIso(95) },
  { sectorSlug: 'sante-biotech', latestGeneratedAt: daysAgoIso(120) },
];
const r1 = selectEligibleSectorsForRegeneration(candidates, NOW);
const r2 = selectEligibleSectorsForRegeneration(candidates, NOW);
check(
  'meme resultat sur appel repete',
  JSON.stringify(r1),
  JSON.stringify(r2),
);

// ============================================================
console.log('\n--- INTEGRATION : 13 fiches a anciennetes variees ---');
// ============================================================

// Scenario realiste : 13 secteurs catalogues, repartis comme suit :
//   - 5 fiches recentes (< 90j) : non eligibles
//   - 6 fiches en cycle (90 a 150j) : eligibles
//   - 1 fiche perimee (200j) : eligible, prioritaire
//   - 1 fiche jamais generee : eligible, priorite absolue
const integration: SectorRegenCandidate[] = [
  { sectorSlug: 'logiciel-entreprise-horizontal', latestGeneratedAt: daysAgoIso(30) },
  { sectorSlug: 'ia-appliquee', latestGeneratedAt: daysAgoIso(200) }, // perimee
  { sectorSlug: 'fintech', latestGeneratedAt: daysAgoIso(100) },
  { sectorSlug: 'sante-biotech', latestGeneratedAt: daysAgoIso(45) },
  { sectorSlug: 'climat-energie', latestGeneratedAt: daysAgoIso(140) },
  { sectorSlug: 'mobilite-logistique', latestGeneratedAt: daysAgoIso(60) },
  { sectorSlug: 'industrie-hardware', latestGeneratedAt: daysAgoIso(120) },
  { sectorSlug: 'agritech-foodtech', latestGeneratedAt: null }, // jamais
  { sectorSlug: 'commerce-marketplaces', latestGeneratedAt: daysAgoIso(95) },
  { sectorSlug: 'cybersecurite-defense', latestGeneratedAt: daysAgoIso(150) },
  { sectorSlug: 'crypto-blockchain', latestGeneratedAt: daysAgoIso(20) },
  { sectorSlug: 'proptech-construction', latestGeneratedAt: daysAgoIso(75) },
  { sectorSlug: 'education-future-of-work', latestGeneratedAt: daysAgoIso(85) },
];

const day1 = selectEligibleSectorsForRegeneration(integration, NOW);
check('jour 1 : 4 secteurs traites (budget plein)', day1.length, 4);
check(
  'jour 1 : agritech (jamais) en tete',
  day1[0]?.sectorSlug,
  'agritech-foodtech',
);
check('jour 1 : ia-appliquee (200j) en seconde', day1[1]?.sectorSlug, 'ia-appliquee');
check('jour 1 : cybersecurite (150j) en troisieme', day1[2]?.sectorSlug, 'cybersecurite-defense');
check('jour 1 : climat (140j) en quatrieme', day1[3]?.sectorSlug, 'climat-energie');

// Apres jour 1, on simule le passage du temps (les fiches du
// jour 1 viennent d etre regenerees, leur generated_at = NOW).
// Les autres fiches ont 1 jour de plus. Mais comme on est en
// JOUR+1, on recalcule a partir du nouveau state.
const NOW_DAY2 = new Date(NOW.getTime() + 1 * MS_PER_DAY);
const integrationDay2: SectorRegenCandidate[] = integration.map((c) => {
  if (day1.find((d) => d.sectorSlug === c.sectorSlug)) {
    // Vient d etre regeneree, latest = NOW
    return { sectorSlug: c.sectorSlug, latestGeneratedAt: NOW.toISOString() };
  }
  return c;
});
const day2 = selectEligibleSectorsForRegeneration(integrationDay2, NOW_DAY2);
checkTrue(
  'jour 2 : ne re-selectionne pas les fiches du jour 1',
  day2.every((d) => !day1.find((d1) => d1.sectorSlug === d.sectorSlug)),
);
// Le jour 2, seules les 3 fiches encore au-dessus du seuil
// passent : industrie (121j), fintech (101j), commerce (96j).
// Education (86j) reste sous le seuil de 90, ce qui montre que
// le cron ne pousse pas systematiquement quatre regenerations
// par jour : il s arrete a la file d eligibles disponibles.
check('jour 2 : 3 secteurs traites, pas 4 (education sous seuil)', day2.length, 3);
check('jour 2 : industrie (121j) en tete', day2[0]?.sectorSlug, 'industrie-hardware');
check('jour 2 : fintech (101j) en seconde', day2[1]?.sectorSlug, 'fintech');
check('jour 2 : commerce (96j) en troisieme', day2[2]?.sectorSlug, 'commerce-marketplaces');

// Apres jour 2, il devrait rester education-future-of-work (86j+2 = 88j non eligible)
// et proptech (75j+2=77j non eligible). Donc en jour 3, file vide.
const NOW_DAY3 = new Date(NOW.getTime() + 2 * MS_PER_DAY);
const integrationDay3: SectorRegenCandidate[] = integrationDay2.map((c) => {
  if (day2.find((d) => d.sectorSlug === c.sectorSlug)) {
    return { sectorSlug: c.sectorSlug, latestGeneratedAt: NOW_DAY2.toISOString() };
  }
  return c;
});
const day3 = selectEligibleSectorsForRegeneration(integrationDay3, NOW_DAY3);
check('jour 3 : file vide (le reste est sous seuil)', day3.length, 0);

// ============================================================
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
