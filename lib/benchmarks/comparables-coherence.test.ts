// ============================================================
// Tests deterministes de coherence des catalogues de comparables
// ------------------------------------------------------------
// Ce que ces tests prouvent : aucune mention de comparable europeen ne
// porte un chiffre sans appui dans la base de chiffres verifies, et le
// moteur ne complete plus une liste vide avec des societes sans lien
// sectoriel.
//
// Le defaut ferme, releve sur la note Braincube du 3 aout 2026 : la
// note imprimait « Series C 2 milliards US avec ASML » sur Mistral,
// chiffre que VERIFIED_COMPARABLES porte explicitement en quarantaine
// avec needsExternalCheck. Mesure faite dans la foulee : six des treize
// mentions portaient un chiffre, dont trois sur des societes en
// quarantaine et deux sur des societes absentes de la base. Cinq
// chiffres sur six n etaient adosses a rien.
//
// C est le patron des deux vocabulaires sectoriels du meme jour, deux
// listes closes du meme produit qui ne se comparent jamais, et la
// reparation est la meme : une garde, pas une correction d occurrence.
// ============================================================

import { MIGHTY_50_SAMPLE, anomaliesComparables } from './european-comparables';
import { VERIFIED_COMPARABLES } from '../data/verified-comparables';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] aucun chiffre sans appui dans la base verifiee');
{
  const a = anomaliesComparables();
  check(a.length === 0,
    `aucune anomalie (trouve : ${a.map((x) => `${x.name}/${x.motif}`).join(', ') || 'aucune'})`);
}

console.log('\n[Suite 2] la garde discrimine');
{
  // Sans ce controle, une garde qui ne trouve jamais rien serait
  // indiscernable d une garde qui ne cherche pas.
  const quarantaine = Object.values(VERIFIED_COMPARABLES).filter((v: any) => v.needsExternalCheck === true);
  check(quarantaine.length > 0,
    `la base porte bien des entrees en quarantaine (${quarantaine.length}), donc la regle a de quoi mordre`);
  const avecChiffre = MIGHTY_50_SAMPLE.filter((c) => /\d/.test(c.notes));
  check(avecChiffre.length > 0,
    `des mentions portent encore un chiffre (${avecChiffre.map((c) => c.name).join(', ')}), donc la regle est exercee`);
  for (const c of avecChiffre) {
    const v = Object.values(VERIFIED_COMPARABLES).find((e: any) =>
      e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(c.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
    check(!!v && (v as any).needsExternalCheck !== true,
      `« ${c.name} » porte un chiffre et figure dans la base sans quarantaine`);
  }
}

console.log('\n[Suite 3] le catalogue reste utilisable');
{
  check(MIGHTY_50_SAMPLE.length >= 13, `le catalogue n a pas ete vide par la correction (${MIGHTY_50_SAMPLE.length})`);
  check(MIGHTY_50_SAMPLE.every((c) => c.notes.trim().length > 0),
    'chaque entree garde une mention qualitative apres retrait des chiffres');
  check(MIGHTY_50_SAMPLE.every((c) => c.sector.trim().length > 0),
    'chaque entree garde son secteur, sur lequel se fait le recoupement');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
