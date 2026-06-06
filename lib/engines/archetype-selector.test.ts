// ============================================================
// Tests archetype-selector
// ------------------------------------------------------------
// Couvre l integrite du roster (aucun echec connu en saine), le
// gating asset_class sur les axes critiques de Fragilite
// structurelle, et le cadrage de la clause cross-class quand un
// asset_class n a aucun archetype same-class disponible.
//
// Execution : tsx lib/engines/archetype-selector.test.ts
// ============================================================

import {
  ARCHETYPE_ROSTER,
  selectArchetype,
  buildArchetypePromptBlock,
  buildCrossClassClause,
  buildScaleClause,
  decorateCounterArchetype,
  poleFromOutcome,
  requiresScaleCadrage,
  stageToStade,
  type ArchetypeAxis,
} from './archetype-selector';

let pass = 0, fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, condition: boolean) {
  check(label, condition, true);
}

function checkFalse(label: string, condition: boolean) {
  check(label, condition, false);
}

// ============================================================
// 1. INTEGRITE DU ROSTER : aucun echec connu en pole saine
// ------------------------------------------------------------
// Source de la liste : doctrine c3150d0 (pole risque pour
// industrial-hardware et homologues) plus les cas releves par
// Steve sur Platypus Craft (Hyperloop One, Snap Lens, Peloton,
// Juicero) et la doctrine de Lecture du langage (Theranos,
// Nikola, Wirecard, WeWork) et fintech post-2022 (FTX, Celsius,
// Voyager, BlockFi, Fast, Quibi, Cazoo).
// ============================================================

console.log('\n--- Integrite du roster ---');

const KNOWN_FAILURES = [
  // industrial-hardware en faillite ou redressement
  'Hyperloop One',
  'Virgin Hyperloop',
  'Northvolt',
  'Britishvolt',
  'Lilium',
  'Faraday Future',
  'Magic Leap',
  'Electric Last Mile',
  'Nikola',
  'Ynsect',
  'Quirky',
  'Juicero',
  // mediatech / adtech / ecommerce-dtc
  'Snap Lens',
  'Pinterest',
  'MoviePass',
  'Quibi',
  'Zynga',
  'AOL',
  'Casper',
  'Cazoo',
  'Peloton',
  'Helio',
  // healthtech
  'Theranos',
  // fintech post-2022
  'Fast',
  'FTX',
  'Celsius',
  'Voyager',
  'BlockFi',
  'Wirecard',
  'N26',
  'Klarna',
  // ai-generative wrappers
  'Jasper',
  'Copy.ai',
  'Replika',
  // edtech / saas commoditises
  'Chegg',
  'Stack Overflow',
  // marketplace-b2c
  'Foodora',
  // proptech
  'WeWork',
  'Compass',
];

for (const name of KNOWN_FAILURES) {
  const entries = ARCHETYPE_ROSTER.filter((e) => e.name === name);
  if (entries.length === 0) {
    // entree absente du roster : pas une erreur en soi, on signale
    console.log(`  INFO  ${name} absent du roster (pas teste)`);
    continue;
  }
  const sains = entries.filter((e) => e.pole === 'saine');
  checkFalse(`${name} jamais cote saine`, sains.length > 0);
}

// ============================================================
// 2. GATING ASSET_CLASS : industrial-hardware sur les quatre
//    axes critiques de la regression Platypus Craft.
// ------------------------------------------------------------
// Symptome historique : Snap Lens (mediatech/adtech) sur
// infrastructure-hostage, Peloton (ecommerce-dtc) sur
// fixed-cost-trap, Stripe (fintech/saas-b2b) sur
// capital-structure-fragility, Hyperloop One classee saine sur
// scale-mirage-risk. Les quatre cas sont des contaminations du
// gate, soit par absence d archetype same-class, soit par
// migration manquante du pattern vers le selecteur.
// ============================================================

console.log('\n--- Gating asset_class industrial-hardware ---');

const HARDWARE = 'industrial-hardware';
const AXES_CRITIQUES: ArchetypeAxis[] = [
  'scale-mirage-risk',
  'capital-structure-fragility',
  'fixed-cost-trap',
  'infrastructure-hostage',
  'commoditization-drift',
  'regulatory-time-bomb',
  'growth-subsidized',
];

for (const axis of AXES_CRITIQUES) {
  // Saine same-class : doit retourner uniquement des entrees
  // dont assetClasses contient 'industrial-hardware', ou bien
  // crossClass=true avec la clause obligatoire.
  const saine = selectArchetype(HARDWARE, 'saine', axis);
  if (!saine.crossClass) {
    for (const c of saine.candidates) {
      checkTrue(
        `saine ${axis} : ${c.name} same-class industrial-hardware`,
        c.assetClasses.includes(HARDWARE),
      );
    }
  }
  // Risque idem.
  const risque = selectArchetype(HARDWARE, 'risque', axis);
  if (!risque.crossClass) {
    for (const c of risque.candidates) {
      checkTrue(
        `risque ${axis} : ${c.name} same-class industrial-hardware`,
        c.assetClasses.includes(HARDWARE),
      );
    }
  }
}

// ============================================================
// 3. ARCHETYPES HORS-CLASSE ABSENTS DES CANDIDATS SAME-CLASS
// ------------------------------------------------------------
// Test ciblé sur les cas signalés par Steve sur Platypus Craft.
// Si l axe a au moins un same-class, le selecteur ne doit pas
// proposer les noms hors-classe identifies.
// ============================================================

console.log('\n--- Absence archetypes hors-classe sur Platypus ---');

const HORS_CLASSE_INTERDITS: Array<{
  pole: 'saine' | 'risque';
  axis: ArchetypeAxis;
  name: string;
  hint: string;
}> = [
  { pole: 'saine', axis: 'capital-structure-fragility', name: 'Stripe', hint: 'Stripe fintech/saas-b2b' },
  { pole: 'saine', axis: 'capital-structure-fragility', name: 'Adyen', hint: 'Adyen fintech/saas-b2b' },
  { pole: 'saine', axis: 'capital-structure-fragility', name: 'Atlassian', hint: 'Atlassian saas-b2b' },
  { pole: 'risque', axis: 'infrastructure-hostage', name: 'Snap Lens', hint: 'Snap Lens mediatech/adtech' },
  { pole: 'risque', axis: 'fixed-cost-trap', name: 'Peloton', hint: 'Peloton ecommerce-dtc' },
];

for (const c of HORS_CLASSE_INTERDITS) {
  const sel = selectArchetype(HARDWARE, c.pole, c.axis);
  if (sel.crossClass) {
    // Pas de same-class : la clause cross-class doit etre activee.
    // L absence du nom hors-classe ne peut pas etre garantie dans
    // ce mode, c est l affaire de la clause obligatoire et de
    // decorateCounterArchetype. On verifie au moins que la clause
    // est presente dans le prompt block.
    const block = buildArchetypePromptBlock(c.axis, HARDWARE);
    checkTrue(
      `cross-class ${c.pole} ${c.axis} : clause obligatoire injectee dans le prompt`,
      block.includes('CONTRAINTE CROSS-CLASS'),
    );
  } else {
    // Same-class disponible : le nom hors-classe ne doit jamais
    // apparaitre dans les candidats. C est le bug Platypus Craft.
    const found = sel.candidates.some((e) => e.name === c.name);
    checkFalse(`${c.hint} absent des candidats ${c.pole}/${c.axis} sur industrial-hardware`, found);
  }
}

// ============================================================
// 4. ROSTER CIBLE INDUSTRIAL-HARDWARE POLE SAINE
// ------------------------------------------------------------
// Apres chantier outcome verifie (chantier 1), la couverture pole
// saine industrial-hardware se cantonne aux leaders matures dont
// l outcome est triangule en success. Rivian retire (cours public
// effondre, outcome=contested) et Innovafeed retire (rampe non
// prouvee, outcome=ongoing). Les six restants couvrent les axes
// scale-mirage-risk, fixed-cost-trap, capital-structure-fragility
// et narrative-drift.
// ============================================================

console.log('\n--- Couverture saine industrial-hardware ---');

const SAINE_HARDWARE_CIBLE = [
  'ASML',
  'BYD',
  'Apple supply chain',
  'Orsted',
  'Iberdrola',
  'Enphase Energy',
];

for (const name of SAINE_HARDWARE_CIBLE) {
  const entries = ARCHETYPE_ROSTER.filter(
    (e) => e.name === name
      && e.pole === 'saine'
      && e.assetClasses.includes(HARDWARE),
  );
  checkTrue(`${name} present en saine pour industrial-hardware`, entries.length > 0);
}

const SAINE_HARDWARE_EXCLUS = ['Rivian', 'Innovafeed'];
for (const name of SAINE_HARDWARE_EXCLUS) {
  const entries = ARCHETYPE_ROSTER.filter((e) => e.name === name && e.pole === 'saine');
  checkFalse(`${name} retire du pole saine (outcome non verifie en success)`, entries.length > 0);
}

// ============================================================
// 5. CLAUSE CROSS-CLASS : presente quand fallback active, absente
//    quand same-class disponible.
// ============================================================

console.log('\n--- Clause cross-class ---');

{
  // industrial-hardware sur scale-mirage-risk a un pool saine
  // riche (ASML, BYD, Rivian, etc.). Doit etre same-class.
  const block = buildArchetypePromptBlock('scale-mirage-risk', HARDWARE);
  checkFalse(
    'scale-mirage-risk industrial-hardware : pas de clause cross-class',
    block.includes('CONTRAINTE CROSS-CLASS'),
  );
}

{
  // unclassified force un fallback cross-class systematique.
  const block = buildArchetypePromptBlock('scale-mirage-risk', 'unclassified');
  checkTrue(
    'unclassified : clause cross-class obligatoire',
    block.includes('CONTRAINTE CROSS-CLASS'),
  );
}

// ============================================================
// 6. DECORATEUR : prefixe la clause sur un counterArchetype
//    cross-class et n y touche pas quand same-class.
// ============================================================

console.log('\n--- decorateCounterArchetype ---');

{
  // Stripe n est pas industrial-hardware : decoration force la
  // clause meme si le LLM l a oubliee. On fixe dossierStade=mature
  // pour isoler le test cross-class de la clause cross-echelle.
  const decorated = decorateCounterArchetype(
    {
      closest: 'Stripe',
      direction: 'trajectoire-saine',
      rationale: 'Structure preferred simple.',
    },
    'capital-structure-fragility',
    HARDWARE,
    'mature',
  );
  checkTrue(
    'Stripe sur industrial-hardware mature : crossClass=true',
    decorated.crossClass === true,
  );
  checkTrue(
    'Stripe sur industrial-hardware mature : clause prefixee dans rationale',
    decorated.rationale.startsWith('Archetype cross-class'),
  );
}

{
  // ASML est same-class et mature face a un dossier mature :
  // ni cross-class ni cross-echelle, rationale inchangee.
  const decorated = decorateCounterArchetype(
    {
      closest: 'ASML',
      direction: 'trajectoire-saine',
      rationale: 'Capex industriel lie a contrats long terme.',
    },
    'scale-mirage-risk',
    HARDWARE,
    'mature',
  );
  checkTrue(
    'ASML sur industrial-hardware mature : crossClass=false',
    decorated.crossClass === false,
  );
  checkTrue(
    'ASML sur industrial-hardware mature : crossScale=false',
    decorated.crossScale === false,
  );
  checkTrue(
    'ASML sur industrial-hardware mature : rationale inchangee',
    decorated.rationale === 'Capex industriel lie a contrats long terme.',
  );
}

{
  // Idempotence : si la clause est deja presente, pas de double
  // prefixe.
  const clause = buildCrossClassClause('capital-structure-fragility');
  const decorated = decorateCounterArchetype(
    {
      closest: 'Stripe',
      direction: 'trajectoire-saine',
      rationale: `${clause} Structure preferred simple.`,
    },
    'capital-structure-fragility',
    HARDWARE,
  );
  const occurrences = decorated.rationale.split('Archetype cross-class').length - 1;
  check('Stripe : clause non doublee si deja prefixee', occurrences, 1);
}

// ============================================================
// 7. OUTCOME SOURCE UNIQUE
// ------------------------------------------------------------
// Chaque entree du roster porte un outcome verifie. Pole derive
// deterministiquement : success -> saine, autres -> risque. Le
// guard runtime au chargement levera une exception en cas de
// drift, mais on verifie aussi explicitement dans le test pour
// remonter un message clair.
// ============================================================

console.log('\n--- Outcome source unique ---');

for (const entry of ARCHETYPE_ROSTER) {
  const expectedPole = poleFromOutcome(entry.outcome);
  checkTrue(
    `${entry.name} pole=${entry.pole} coherent avec outcome=${entry.outcome}`,
    entry.pole === expectedPole,
  );
}

// Cas concrets cites dans chantier 1.
const OUTCOME_CIBLES: Array<{ name: string; expected: 'success' | 'failure' | 'ongoing' | 'contested' }> = [
  { name: 'Hyperloop One', expected: 'failure' },
  { name: 'Virgin Hyperloop', expected: 'failure' },
  { name: 'Juicero', expected: 'failure' },
  { name: 'Magic Leap', expected: 'contested' },
  { name: 'Nikola', expected: 'contested' },
  { name: 'Snap Lens', expected: 'failure' },
  { name: 'Peloton', expected: 'contested' },
  { name: 'ASML', expected: 'success' },
  { name: 'BYD', expected: 'success' },
  { name: 'Stripe', expected: 'success' },
];

for (const c of OUTCOME_CIBLES) {
  const entry = ARCHETYPE_ROSTER.find((e) => e.name === c.name);
  if (!entry) {
    check(`${c.name} present dans le roster`, false, true);
    continue;
  }
  check(`${c.name} outcome=${c.expected}`, entry.outcome, c.expected);
}

// ============================================================
// 8. PAS D OUTCOME != SUCCESS EN SLOT POSITIF
// ------------------------------------------------------------
// selectArchetype('saine', ...) ne doit JAMAIS retourner une entree
// dont l outcome n est pas success. Le filtre est defensif : meme
// si un drift de donnee passait le guard runtime, le selecteur
// ecarte l entree.
// ============================================================

console.log('\n--- Slot positif uniquement outcome=success ---');

const ALL_AXES: ArchetypeAxis[] = [
  'growth-subsidized',
  'infrastructure-hostage',
  'fixed-cost-trap',
  'commoditization-drift',
  'capital-structure-fragility',
  'regulatory-time-bomb',
  'scale-mirage-risk',
  'narrative-drift',
];

const ALL_CLASSES = [
  'saas-b2b', 'fintech', 'industrial-hardware', 'climate-tech', 'mediatech',
  'marketplace-b2c', 'healthtech', 'proptech', 'ai-generative', 'edtech',
  'foodtech', 'ecommerce-dtc', 'adtech', 'deeptech', 'hospitality', 'unclassified',
];

let saineSlotViolations = 0;
for (const axis of ALL_AXES) {
  for (const klass of ALL_CLASSES) {
    const sel = selectArchetype(klass, 'saine', axis);
    for (const c of sel.candidates) {
      if (c.outcome !== 'success') saineSlotViolations++;
    }
  }
}
check('aucun candidat outcome!=success en slot saine sur toutes paires axe/classe', saineSlotViolations, 0);

// ============================================================
// 9. CADRAGE CROSS-ECHELLE
// ------------------------------------------------------------
// Quand le dossier est startup et que l archetype est mature (ASML,
// BYD, Stripe, Adyen sur Platypus Craft), la clause de cadrage est
// obligatoire. Sans cadrage, le comparable est retire, pas affiche
// nu.
// ============================================================

console.log('\n--- Cadrage cross-echelle ---');

{
  // Bloc prompt sur industrial-hardware seed (Platypus type) sur
  // scale-mirage-risk : ASML, BYD, Apple supply chain, Orsted,
  // Iberdrola, Enphase sont matures. Le bloc DOIT contenir la
  // contrainte cross-echelle et le tag [cross-echelle].
  const block = buildArchetypePromptBlock('scale-mirage-risk', HARDWARE, 'startup');
  checkTrue(
    'industrial-hardware seed sur scale-mirage : contrainte cross-echelle injectee',
    block.includes('CONTRAINTE CROSS-ECHELLE'),
  );
  checkTrue(
    'industrial-hardware seed sur scale-mirage : tag [cross-echelle] sur ASML',
    block.includes('ASML [cross-echelle]'),
  );
}

{
  // Dossier mature (series-D / growth) sur industrial-hardware : la
  // clause cross-echelle n est pas declenchee.
  const block = buildArchetypePromptBlock('scale-mirage-risk', HARDWARE, 'mature');
  checkFalse(
    'industrial-hardware mature sur scale-mirage : pas de contrainte cross-echelle',
    block.includes('CONTRAINTE CROSS-ECHELLE'),
  );
}

{
  // decorateCounterArchetype prefixe la clause cross-echelle si
  // l entree choisie est mature face a un dossier startup. ASML est
  // mature.
  const decorated = decorateCounterArchetype(
    {
      closest: 'ASML',
      direction: 'trajectoire-saine',
      rationale: 'Capex industriel lie a contrats long terme.',
    },
    'scale-mirage-risk',
    HARDWARE,
    'startup',
  );
  checkTrue(
    'ASML face a startup : crossScale=true',
    decorated.crossScale === true,
  );
  checkTrue(
    'ASML face a startup : clause cross-echelle prefixee',
    decorated.rationale.startsWith('Comparable cross-echelle'),
  );
}

{
  // Stripe face a un dossier startup industrial-hardware : cross-
  // class ET cross-echelle. Les deux clauses doivent etre prefixees,
  // dans l ordre cross-echelle puis cross-class.
  const decorated = decorateCounterArchetype(
    {
      closest: 'Stripe',
      direction: 'trajectoire-saine',
      rationale: 'Structure preferred 1x simple.',
    },
    'capital-structure-fragility',
    HARDWARE,
    'startup',
  );
  checkTrue('Stripe startup hardware : crossClass=true', decorated.crossClass === true);
  checkTrue('Stripe startup hardware : crossScale=true', decorated.crossScale === true);
  checkTrue(
    'Stripe startup hardware : rationale commence par clause cross-echelle',
    decorated.rationale.startsWith('Comparable cross-echelle'),
  );
  checkTrue(
    'Stripe startup hardware : rationale contient aussi clause cross-class',
    decorated.rationale.includes('Archetype cross-class'),
  );
}

// ============================================================
// 10. OUTCOME MISMATCH : DIRECTION RECLASSEE
// ------------------------------------------------------------
// Si un LLM propose Klarna en trajectoire-saine, decorateCounterArchetype
// doit forcer direction='derive-confirmee' (Klarna outcome=contested,
// jamais en counter-exemple sain).
// ============================================================

console.log('\n--- Outcome mismatch : direction reclassee ---');

{
  const decorated = decorateCounterArchetype(
    {
      closest: 'Klarna',
      direction: 'trajectoire-saine',
      rationale: 'Down round controle.',
    },
    'capital-structure-fragility',
    'fintech',
    'startup',
  );
  checkTrue('Klarna : outcomeMismatch=true', decorated.outcomeMismatch === true);
  check('Klarna : direction reclassee en derive-confirmee', decorated.direction, 'derive-confirmee');
}

{
  // Cas inverse : ASML en derive-confirmee (success force trajectoire-
  // saine).
  const decorated = decorateCounterArchetype(
    {
      closest: 'ASML',
      direction: 'derive-confirmee',
      rationale: 'Capex industriel.',
    },
    'scale-mirage-risk',
    HARDWARE,
    'startup',
  );
  checkTrue('ASML inverse : outcomeMismatch=true', decorated.outcomeMismatch === true);
  check('ASML inverse : direction reclassee en trajectoire-saine', decorated.direction, 'trajectoire-saine');
}

// ============================================================
// 11. STAGE TO STADE
// ============================================================

console.log('\n--- stageToStade ---');

check('pre-seed -> startup', stageToStade('pre-seed'), 'startup');
check('seed -> startup', stageToStade('seed'), 'startup');
check('series-A-early -> startup', stageToStade('series-A-early'), 'startup');
check('series-A-late -> startup', stageToStade('series-A-late'), 'startup');
check('series-B -> scaleup', stageToStade('series-B'), 'scaleup');
check('series-C -> scaleup', stageToStade('series-C'), 'scaleup');
check('series-D -> mature', stageToStade('series-D'), 'mature');
check('growth -> mature', stageToStade('growth'), 'mature');
check('pre-IPO -> mature', stageToStade('pre-IPO'), 'mature');
check('vide -> startup (default prudent)', stageToStade(undefined), 'startup');

checkTrue(
  'requiresScaleCadrage : mature vs startup',
  requiresScaleCadrage('mature', 'startup'),
);
checkFalse(
  'requiresScaleCadrage : mature vs mature',
  requiresScaleCadrage('mature', 'mature'),
);
checkFalse(
  'requiresScaleCadrage : scaleup vs startup (non cadre)',
  requiresScaleCadrage('scaleup', 'startup'),
);

// ============================================================
// BILAN
// ============================================================

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
