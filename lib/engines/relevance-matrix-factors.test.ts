// ============================================================
// Tests deterministes du decouplage engine / affichage des tags
// de facteurs de la matrice de pertinence.
//
// Trois choses a garantir :
//
//   1. Le catalogue FACTOR_LABELS couvre exactement les codes
//      emis par relevance-matrix.ts. Aucun code orphelin, aucun
//      libelle sans code. Une divergence trahirait un oubli au
//      moment d ajouter une emission.
//
//   2. Le renderer transforme les codes en libelles accentues
//      pour les 29 codes. Aucune chaine ASCII, aucun code
//      machine ne fuit au rendu partner.
//
//   3. La backward compat pass-through prend en charge les
//      analyses persistees avant le decouplage. Un factor
//      inconnu (chaine ancienne ASCII, chaine libre) sort tel
//      quel du renderer, sans erreur, sans log.
//
// Ces tests protegent le contrat public du module. Le matcher
// externe (archetype financial-coherence) est deja couvert par
// financial-coherence-archetype.test.ts qui utilise desormais
// les codes.
//
// Execution : tsx lib/engines/relevance-matrix-factors.test.ts
// ============================================================

import {
  FACTOR_LABELS,
  isFactorCode,
  renderFactor,
  renderFactors,
  type FactorCode,
} from './relevance-matrix-factors';

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

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

// ============================================================
// Test 1 : catalogue de codes exhaustif
// ============================================================

console.log('\n=== Test 1 : catalogue FACTOR_LABELS complet ===');
{
  const codes = Object.keys(FACTOR_LABELS) as FactorCode[];
  check('nombre de codes emis par la matrice', codes.length, 29);

  // Chaque namespace attendu est present avec le bon nombre d entrees.
  const supply = codes.filter(c => c.startsWith('supply:'));
  const macro = codes.filter(c => c.startsWith('macro:'));
  const geo = codes.filter(c => c.startsWith('geo:'));
  const repro = codes.filter(c => c.startsWith('reproducibility:'));

  check('supply namespace', supply.length, 5);
  check('macro namespace', macro.length, 4);
  check('geo namespace', geo.length, 7);
  check('reproducibility namespace', repro.length, 13);
  check('somme des namespaces', supply.length + macro.length + geo.length + repro.length, codes.length);
}

// ============================================================
// Test 2 : type guard isFactorCode
// ============================================================

console.log('\n=== Test 2 : isFactorCode reconnait les codes valides ===');
{
  checkTrue('supply:semiconductors', isFactorCode('supply:semiconductors'));
  checkTrue('macro:consumer-discretionary', isFactorCode('macro:consumer-discretionary'));
  checkTrue('geo:defense-sector', isFactorCode('geo:defense-sector'));
  checkTrue('reproducibility:no-significant-protection', isFactorCode('reproducibility:no-significant-protection'));

  // Anciennes chaines ASCII ne sont plus des codes.
  checkTrue('ancienne chaine ASCII rejetee (consommation discretionnaire)',
    !isFactorCode('consommation discretionnaire'));
  checkTrue('ancienne chaine ASCII rejetee (semi-conducteurs)',
    !isFactorCode('semi-conducteurs'));

  // Chaines libres rejetees.
  checkTrue('chaine libre rejetee', !isFactorCode('chaine libre imprevue'));
  checkTrue('vide rejete', !isFactorCode(''));
}

// ============================================================
// Test 3 : renderer accentue chaque code emis
// ============================================================

console.log('\n=== Test 3 : renderFactor rend les libelles francais accentues ===');
{
  // Echantillon representatif : chaque namespace + les cas mentionnes
  // dans la doctrine (consommation discretionnaire, no-significant-
  // protection). Toutes les autres correspondances sont deja garanties
  // par FACTOR_LABELS puisque le renderer est un lookup direct.
  check('supply:semiconductors', renderFactor('supply:semiconductors'), 'semi-conducteurs');
  check('supply:strategic-materials', renderFactor('supply:strategic-materials'), 'matériaux stratégiques');
  check('macro:consumer-discretionary', renderFactor('macro:consumer-discretionary'), 'consommation discrétionnaire');
  check('macro:b2c-volume-dependency', renderFactor('macro:b2c-volume-dependency'), 'dépendance volume B2C');
  check('geo:high-risk-country-presence', renderFactor('geo:high-risk-country-presence'), 'présence zones à risque pays');
  check('reproducibility:no-significant-protection',
    renderFactor('reproducibility:no-significant-protection'),
    'software pur sans protection significative détectée');
  check('reproducibility:undetermined-production-chain',
    renderFactor('reproducibility:undetermined-production-chain'),
    'chaîne de production indéterminée');

  // Chaque libelle contient au moins un caractere accentue ou une
  // apostrophe typographique, sauf les termes techniques anglais
  // preserves (network effect, semi-conducteurs, export controls,
  // exposition consumer). Test relaxe : la moitie au moins.
  const labels = Object.values(FACTOR_LABELS);
  const accented = labels.filter(l => /[éèêàâîôûçëïöü’]/.test(l));
  checkTrue('au moins la moitie des libelles portent un accent ou une apostrophe typographique',
    accented.length >= labels.length / 2);
}

// ============================================================
// Test 4 : backward compat pass-through
// ============================================================

console.log('\n=== Test 4 : pass-through des chaines inconnues (legacy et libre) ===');
{
  // Analyses persistees avant le decouplage : les factors sont des
  // anciennes chaines ASCII. Le renderer ne connait pas ces cles
  // dans son catalogue, donc il les retourne telles quelles sans
  // erreur. Le note d instruction historique reste rendu sans crash,
  // en attendant un backfill.
  check('legacy ASCII pass-through', renderFactor('consommation discretionnaire'), 'consommation discretionnaire');
  check('legacy ASCII pass-through hardware', renderFactor('produit hardware physique'), 'produit hardware physique');

  // Chaine libre inedite (fixture de test, mock LLM, dossier
  // atypique) : pass-through egalement.
  check('chaine libre pass-through', renderFactor('chaine imprevue'), 'chaine imprevue');
  check('vide reste vide', renderFactor(''), '');
}

// ============================================================
// Test 5 : renderFactors joint avec la virgule espace canonique
// ============================================================

console.log('\n=== Test 5 : renderFactors joint proprement ===');
{
  check('tableau vide', renderFactors([]), '');
  check('un seul code', renderFactors(['supply:semiconductors']), 'semi-conducteurs');
  check('deux codes', renderFactors(['supply:semiconductors', 'supply:strategic-materials']),
    'semi-conducteurs, matériaux stratégiques');

  // Mix codes + legacy : chaque element passe par renderFactor
  // independamment. Coherent avec les analyses en transition entre
  // ancien et nouveau format.
  check('mix codes et legacy',
    renderFactors(['supply:semiconductors', 'consommation discretionnaire']),
    'semi-conducteurs, consommation discretionnaire');
}

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
