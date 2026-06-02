// Tests deterministes du registry de renderers du drill-down.
// On ne rend rien en JSX (pas de JSDOM) : on verifie la fonction
// de selection pickRenderer et le flag hasTypedRenderer. C est le
// contrat critique : moteurs types -> composant dedie, autres ->
// generique, jamais undefined.

import {
  pickRenderer,
  hasTypedRenderer,
  TYPED_RENDERERS,
  GenericRenderer,
  OrchestratorRenderer,
  FragilityRenderer,
  MarketRenderer,
} from './index';
import { TOILE_TRACED_IDS } from '../../../lib/pipeline-toile/mapping';

let pass = 0;
let fail = 0;

function check<T>(actual: T, expected: T, label: string) {
  const ok = actual === expected;
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
    console.log(`        expected: ${String(expected)}`);
    console.log(`        actual:   ${String(actual)}`);
  }
}

function checkTrue(condition: boolean, label: string) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
  }
}

console.log('\n=== Renderers types selectionnes par id ===');
check(pickRenderer('orchestrate'), OrchestratorRenderer, 'orchestrate -> OrchestratorRenderer');
check(
  pickRenderer('fragility-structurelle'),
  FragilityRenderer,
  'fragility-structurelle -> FragilityRenderer',
);
check(pickRenderer('market'), MarketRenderer, 'market -> MarketRenderer');

console.log('\n=== Fallback generique ===');
// Tous les autres moteurs de la toile retombent sur le generique
// (pas null, pas undefined). C est le filet de securite : aucun
// noeud cliquable ne peut planter le drill-down faute de
// renderer.
for (const id of TOILE_TRACED_IDS) {
  const r = pickRenderer(id);
  if (id in TYPED_RENDERERS) {
    checkTrue(r !== GenericRenderer, `${id} (type) ne tombe pas sur le generique`);
  } else {
    check(r, GenericRenderer, `${id} -> GenericRenderer`);
  }
}

console.log('\n=== Ids inconnus ===');
check(pickRenderer('inconnu'), GenericRenderer, 'id inconnu -> GenericRenderer');
check(pickRenderer(''), GenericRenderer, 'id vide -> GenericRenderer');

console.log('\n=== hasTypedRenderer ===');
checkTrue(hasTypedRenderer('orchestrate'), 'orchestrate est type');
checkTrue(hasTypedRenderer('fragility-structurelle'), 'fragility-structurelle est type');
checkTrue(hasTypedRenderer('market'), 'market est type');
checkTrue(!hasTypedRenderer('team'), 'team n est pas type (fallback)');
checkTrue(!hasTypedRenderer('inconnu'), 'inconnu n est pas type');

console.log('\n=== Determinisme ===');
// Deux appels successifs renvoient strictement la meme reference :
// la table TYPED_RENDERERS est stable, le fallback aussi.
check(
  pickRenderer('orchestrate'),
  pickRenderer('orchestrate'),
  'orchestrate stable entre deux appels',
);
check(
  pickRenderer('team'),
  pickRenderer('team'),
  'team stable entre deux appels',
);

console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
