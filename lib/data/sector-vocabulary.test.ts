// ============================================================
// Tests deterministes du vocabulaire du normaliseur
// ------------------------------------------------------------
// Ce que ces tests prouvent : tout libelle que la plateforme propose
// elle-meme est lisible par son propre normaliseur, et les
// classements existants ne bougent pas.
//
// Le defaut ferme : les deux dossiers Compagnie des Alpes du corpus,
// parcs de loisirs, ressortaient en `unclassified` avec un secteur
// extrait valant « Hospitalite ». La classe `hospitality` existe dans
// la table et deux autres dossiers l obtiennent. Le normaliseur ne
// connaissait que le mot anglais, alors que le prompt d extraction
// propose lui-meme le mot francais dans sa liste de onze secteurs.
//
// L hypothese de la grappe 4, une matrice cadree par la presupposition
// de levee, est refutee par cette lecture : rien dans le mecanisme ne
// suppose un produit ni un modele de revenus, c est un ecart de
// vocabulaire entre deux listes que personne ne comparait.
//
// La mesure suit la discipline : elle interroge la fonction sur chaque
// valeur des catalogues plutot que de compter des occurrences.
// ============================================================

import { normalizeAssetClass, SECTOR_BENCHMARKS } from './sector-benchmarks';
import { SECTORS, SECTORS_EXCLUDED } from '../fund-profile/vocabulary';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Les onze libelles que le prompt d extraction propose au modele.
// Recopies depuis extraction-engine.ts, et le test qui suit est
// precisement la garde contre leur divergence.
const LIBELLES_DU_PROMPT = [
  'Défense', 'Santé', 'IA', 'Fintech', 'SaaS', 'E-commerce',
  'Mobilité', 'Media', 'Cloud', 'Insurtech', 'Hospitalité',
];

// Libelles d exclusion sans classe d actif correspondante : il n existe
// pas de table de multiples pour le tabac. `unclassified` y est la
// bonne reponse et non un trou.
const SANS_CLASSE = new Set(['Tabac', 'Alcool', 'Jeu', 'Adult', 'Fossile']);

// ============================================================
console.log('\n[Suite 1] la plateforme lit ses propres libelles');
// ============================================================
{
  for (const l of LIBELLES_DU_PROMPT) {
    const n = normalizeAssetClass(l);
    check(n !== 'unclassified' && n in SECTOR_BENCHMARKS,
      `le prompt propose « ${l} », le normaliseur rend ${n}`);
  }
}
{
  const manquants = [...SECTORS, ...SECTORS_EXCLUDED]
    .filter(l => !SANS_CLASSE.has(l))
    .filter(l => normalizeAssetClass(l) === 'unclassified');
  check(manquants.length === 0,
    `vocabulaire du profil de fonds entierement lisible (restants : ${manquants.join(', ') || 'aucun'})`);
  for (const l of Array.from(SANS_CLASSE)) {
    check(normalizeAssetClass(l) === 'unclassified',
      `« ${l} » reste non classe, il n existe pas de table de multiples pour lui`);
  }
}

// ============================================================
console.log('\n[Suite 2] le cas qui a ouvert la dette');
// ============================================================
{
  check(normalizeAssetClass('Hospitalité') === 'hospitality', 'Hospitalite se lit hospitality');
  check(normalizeAssetClass('Parcs de loisirs régionaux') === 'hospitality',
    'un parc de loisirs regional aussi');
  check(normalizeAssetClass('hospitality') === 'hospitality', 'et le mot anglais n a pas bouge');
  // Consequence en aval : la classe rend une plage de multiples, donc
  // les quatre methodes de valorisation redeviennent atteignables.
  check('hospitality' in SECTOR_BENCHMARKS, 'la classe existe bien dans la table');
}

// ============================================================
console.log('\n[Suite 3] rien de ce qui marchait ne bouge');
// ============================================================
{
  const invariants: Array<[string, string]> = [
    ['transport sanitaire', 'healthtech'],
    ['taxi cpam', 'healthtech'],
    ['consumer marketplace', 'marketplace-b2c'],
    ['marketplace B2C', 'marketplace-b2c'],
    ['gaming', 'mediatech'],
    ['entertainment', 'mediatech'],
    ['media', 'mediatech'],
    ['financial services', 'services-b2b'],
    ['industrie agroalimentaire', 'foodtech'],
    ['cybersecurity', 'cybersecurity'],
    ['energies marines', 'industrial-hardware'],
  ];
  for (const [entree, attendu] of invariants) {
    check(normalizeAssetClass(entree) === attendu,
      `« ${entree} » reste ${attendu} (obtenu ${normalizeAssetClass(entree)})`);
  }
  // La bordure de mot du sigle IA doit tenir, sinon elle emporterait
  // tout mot contenant les deux lettres.
  check(normalizeAssetClass('IA') === 'ai-generative', 'le sigle IA se lit');
  check(normalizeAssetClass('Industrie agroalimentaire') !== 'ai-generative',
    'mais il n emporte pas un mot qui contient ces lettres');
}

// ============================================================
console.log('\n[Suite 4] le contrat d idempotence tient sur les nouveaux libelles');
// ============================================================
{
  for (const l of [...LIBELLES_DU_PROMPT, ...SECTORS]) {
    const une = normalizeAssetClass(l);
    check(normalizeAssetClass(une) === une, `normalize(normalize(« ${l} »)) est stable`);
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
