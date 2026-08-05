// ============================================================
// Tests deterministes du contrat de fiche de comparable
// ------------------------------------------------------------
// Ce que ces tests prouvent : le vocabulaire de classe est ferme, la
// marque de fiabilite vit sur le jalon, une base agregee ne peut pas
// alimenter une fourchette, et un seau qui ne porte que des reussites
// est refuse.
//
// Le defaut ferme est du 5 aout 2026 : les 124 fiches existantes
// portent leur classe en texte libre, et normaliser ces libelles range
// Moderna et BioNTech en industrial-hardware.
//
// Execution : npx tsx lib/data/fiche-comparable.test.ts
// ============================================================

import {
  verifierFiche,
  verifierComposition,
  classesAdmises,
  AUTORISE_PAR_FIABILITE,
  type FicheComparable,
} from './fiche-comparable';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const VALIDE: FicheComparable = {
  name: 'Made.com',
  founded: 2010,
  assetClass: 'ecommerce-dtc',
  stade: 'mature',
  outcome: 'failure',
  pays: 'Royaume-Uni',
  statut: 'Liquide en 2022. Marque et propriete intellectuelle reprises par Next.',
  pieges: 'Ne pas presenter la reprise de la marque comme une valorisation d entreprise.',
  jalons: [
    { annee: 2021, libelle: 'IPO au LSE', montantVerbatim: '775 M£', devise: 'GBP', fiabilite: 'officiel', source: 'prospectus LSE 2021' },
    { annee: 2022, libelle: 'Reprise de la marque et de la PI par Next apres liquidation', montantVerbatim: '3,4 M£', devise: 'GBP', fiabilite: 'presse', source: 'Financial Times, novembre 2022' },
  ],
};

console.log('\n[Suite 1] le vocabulaire de classe est ferme');
{
  check(verifierFiche(VALIDE).length === 0, 'une fiche complete passe');
  const libre = verifierFiche({ ...VALIDE, assetClass: 'e-commerce mode asset-light' });
  check(libre.some((r) => r.champ === 'assetClass'),
    'un libelle libre est refuse, ce qui est le defaut des 124 fiches existantes');
  check(classesAdmises().length === 21, `vingt et une classes admises (${classesAdmises().length})`);
  check(classesAdmises().includes('ecommerce-dtc'), 'et elles sont lues sur le catalogue, non recopiees');
}

console.log('\n[Suite 2] la marque de fiabilite vit sur le jalon');
{
  const sansMarque = verifierFiche({
    ...VALIDE,
    jalons: [{ annee: 2021, libelle: 'IPO', fiabilite: undefined as any, source: 'prospectus' }, VALIDE.jalons[1]],
  });
  check(sansMarque.some((r) => r.champ === 'jalons[0].fiabilite'), 'un jalon sans marque est refuse');

  const sansSource = verifierFiche({
    ...VALIDE,
    jalons: [{ annee: 2021, libelle: 'IPO', fiabilite: 'officiel', source: '  ' }, VALIDE.jalons[1]],
  });
  check(sansSource.some((r) => r.champ === 'jalons[0].source'), 'un jalon sans source est refuse');

  // La marque est sur le jalon et non sur la fiche, donc deux jalons de
  // la meme fiche peuvent porter deux forces differentes. C est le cas
  // reel de Made.com, prospectus d un cote, presse de l autre.
  check(VALIDE.jalons[0].fiabilite !== VALIDE.jalons[1].fiabilite,
    'deux jalons d une meme fiche portent deux forces differentes');
}

console.log('\n[Suite 3] une base agregee ne peut pas alimenter une fourchette');
{
  check(AUTORISE_PAR_FIABILITE.officiel.alimenteUneFourchette === true, 'officiel alimente une fourchette');
  check(AUTORISE_PAR_FIABILITE.presse.alimenteUneFourchette === true, 'presse aussi');
  check(AUTORISE_PAR_FIABILITE['base-agregee'].alimenteUneFourchette === false,
    'base agregee, non : fiable sur l existence du tour, incertaine sur son montant');
  check(AUTORISE_PAR_FIABILITE.declaratif.alimenteUneFourchette === false, 'declaratif, non');
  // La distinction n est pas de degre : une base agregee reste citable.
  check(AUTORISE_PAR_FIABILITE['base-agregee'].chiffreCitable === true,
    'et elle reste citable dans la prose, la distinction est de nature et non de degre');
  check(AUTORISE_PAR_FIABILITE.declaratif.chiffreCitable === false,
    'le declaratif seul n est pas citable avec un chiffre');
}

console.log('\n[Suite 4] un montant declaratif n entre pas dans la base');
{
  const declaratifChiffre = verifierFiche({
    ...VALIDE,
    jalons: [
      { annee: 2019, libelle: 'ARR annonce en interview', montantVerbatim: '40 M€', devise: 'EUR', fiabilite: 'declaratif', source: 'interview du fondateur' },
      VALIDE.jalons[1],
    ],
  });
  check(declaratifChiffre.some((r) => r.champ === 'jalons[0].montantVerbatim'),
    'un montant porte par un jalon declaratif est refuse a l entree');

  const sansDevise = verifierFiche({
    ...VALIDE,
    jalons: [{ ...VALIDE.jalons[0], devise: undefined }, VALIDE.jalons[1]],
  });
  check(sansDevise.some((r) => r.champ === 'jalons[0].devise'), 'un montant sans devise n est pas un montant');
}

console.log('\n[Suite 5] un seau qui ne porte que des reussites est refuse');
{
  const succes = Array.from({ length: 8 }, (_, i) => ({ ...VALIDE, name: `S${i}`, outcome: 'success' as const }));
  check(verifierComposition(succes).length > 0, 'huit reussites et zero contre-exemple : refuse');
  const melange = [...succes.slice(0, 6), { ...VALIDE, name: 'E1' }, { ...VALIDE, name: 'E2', outcome: 'contested' as const }];
  check(verifierComposition(melange).length === 0, 'huit fiches dont deux contre-exemples : accepte');
  check(verifierComposition([]).length === 0, 'un seau vide ne declenche rien');
}

console.log('\n[Suite 6] aucune entree ne fait lever');
{
  let leves = 0;
  for (const d of [null, undefined, {}, { jalons: null }, { jalons: [null] }, 42, 'x'] as any[]) {
    try { verifierFiche(d); } catch { leves++; }
  }
  try { verifierComposition(null as any); } catch { leves++; }
  check(leves === 0, 'aucune levee sur huit entrees degenerees');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
