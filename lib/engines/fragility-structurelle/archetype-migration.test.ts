// ============================================================
// Tests migration archetype-selector pour les sept patterns
// Fragilite structurelle
// ------------------------------------------------------------
// Verifie statiquement que chaque pattern qui assigne un
// counterArchetype reutilise le selecteur central (gate
// asset_class). Empeche la regression Platypus Craft : un pattern
// qui retomberait sur un roster hardcode injecterait des
// archetypes hors-classe nu dans le SYSTEM_PROMPT, le LLM les
// choisirait, et la sortie Fragilite structurelle citerait Snap
// Lens, Peloton, Stripe ou Hyperloop One mal labellise.
//
// Execution : tsx lib/engines/fragility-structurelle/archetype-migration.test.ts
// ============================================================

import { _internal as growthSubsidized } from './growth-subsidized-pattern';
import { _internal as infraHostage } from './infrastructure-hostage-pattern';
import { _internal as fixedCost } from './fixed-cost-trap-pattern';
import { _internal as capStruct } from './capital-structure-fragility-pattern';
import { _internal as commoditization } from './commoditization-drift-pattern';
import { _internal as regulatory } from './regulatory-time-bomb-pattern';
import { _internal as scaleMirage } from './scale-mirage-risk-pattern';

let pass = 0, fail = 0;

function checkTrue(label: string, condition: boolean) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}`);
    fail++;
  }
}

const PATTERNS = [
  { id: 'growth-subsidized', prompt: growthSubsidized.SYSTEM_PROMPT },
  { id: 'infrastructure-hostage', prompt: infraHostage.SYSTEM_PROMPT },
  { id: 'fixed-cost-trap', prompt: fixedCost.SYSTEM_PROMPT },
  { id: 'capital-structure-fragility', prompt: capStruct.SYSTEM_PROMPT },
  { id: 'commoditization-drift', prompt: commoditization.SYSTEM_PROMPT },
  { id: 'regulatory-time-bomb', prompt: regulatory.SYSTEM_PROMPT },
  { id: 'scale-mirage-risk', prompt: scaleMirage.SYSTEM_PROMPT },
];

console.log('\n--- Placeholder __ARCHETYPE_BLOCK__ dans chaque SYSTEM_PROMPT ---');

for (const p of PATTERNS) {
  checkTrue(
    `${p.id} : SYSTEM_PROMPT contient __ARCHETYPE_BLOCK__`,
    p.prompt.includes('__ARCHETYPE_BLOCK__'),
  );
}

console.log('\n--- Absence de roster hardcode dans la section COUNTER-ARCHETYPES ---');

// Apres migration, la prose "Counter-archetypes sains : Stripe ..."
// ou "Patterns confirmes : Theranos ..." ne doit plus exister
// directement dans le SYSTEM_PROMPT. Le bloc est genere a chaud
// depuis le roster gate.
for (const p of PATTERNS) {
  checkTrue(
    `${p.id} : pas de prose "Counter-archetypes sains :" hardcodee`,
    !p.prompt.includes('Counter-archetypes sains :'),
  );
  checkTrue(
    `${p.id} : pas de prose "Patterns confirmes (" hardcodee`,
    !p.prompt.includes('Patterns confirmes ('),
  );
  checkTrue(
    `${p.id} : pas de prose "Patterns confirmés (" hardcodee`,
    !p.prompt.includes('Patterns confirmés ('),
  );
}

// ============================================================
// Chantier 2 : pas d archetype hors-classe nu sur industrial-hardware seed
// ------------------------------------------------------------
// Pour chaque pattern Fragilite, on construit le bloc avec asset_class=
// industrial-hardware et stade=startup (cas Platypus Craft). Si Snap Lens,
// Peloton ou Stripe apparaissent dans le bloc, ils doivent etre marques
// cross-class avec la CONTRAINTE CROSS-CLASS injectee. Jamais nu.
// ============================================================

import { buildArchetypePromptBlock, type ArchetypeAxis } from '../archetype-selector';

console.log('\n--- Chantier 2 : pas de Snap Lens / Peloton / Stripe nu sur industrial-hardware seed ---');

const HARDWARE = 'industrial-hardware';
const NAMES_HORS_CLASSE = ['Snap Lens', 'Peloton', 'Stripe'];
const PATTERN_AXES: ArchetypeAxis[] = [
  'growth-subsidized',
  'infrastructure-hostage',
  'fixed-cost-trap',
  'commoditization-drift',
  'capital-structure-fragility',
  'regulatory-time-bomb',
  'scale-mirage-risk',
];

for (const axis of PATTERN_AXES) {
  const block = buildArchetypePromptBlock(axis, HARDWARE, 'startup');
  for (const name of NAMES_HORS_CLASSE) {
    if (block.includes(name)) {
      // Le nom apparait. Il doit etre cross-class et le bloc doit
      // contenir la contrainte cross-class injectee.
      checkTrue(
        `${axis} : ${name} present mais avec CONTRAINTE CROSS-CLASS injectee`,
        block.includes('CONTRAINTE CROSS-CLASS'),
      );
    } else {
      // Le nom est absent : le gate same-class l a filtre, parfait.
      checkTrue(
        `${axis} : ${name} absent du bloc industrial-hardware seed`,
        true,
      );
    }
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
