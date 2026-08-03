// ============================================================
// Tests deterministes de la garde de perimetre du dimensionnement
// ------------------------------------------------------------
// Ce que ces tests prouvent : un montant sans perimetre declare ne
// remonte pas comme chiffre, et le montant brut reste lisible sans
// etre presente comme une mesure.
//
// Le defaut ferme, etabli hors ligne le 3 aout 2026 par trois passes
// du moteur Marche sur le meme dossier : le TAM rendait tantot onze
// milliards, le segment logiciel analytique manufacturier, tantot cinq
// cents milliards, la depense IIoT mondiale toutes couches confondues.
// Les trois chiffres etaient defendables et aucun n etait comparable
// aux autres, parce que le perimetre vivait dans la prose. Le TAM
// n etait pas instable, il etait non defini.
// ============================================================

import { appliquerGardePerimetre } from './market-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] un montant sans perimetre ne remonte pas comme chiffre');
{
  const r = appliquerGardePerimetre({
    tam: { value: '483 Mds$', perimeter: 'depense IIoT mondiale toutes couches, 2024' },
    sam: { value: '15 Mds$' },
    som: { value: '400 M$', perimeter: null },
  });
  check(r.tam.value === '483 Mds$', 'un niveau avec perimetre garde sa valeur');
  check(r.tam.perimeterMissing === undefined, 'et ne porte aucun marqueur de manque');
  check(r.sam.value.startsWith('Non chiffre'), 'un niveau sans perimetre ne rend plus de montant');
  check(r.sam.perimeterMissing === true, 'le manque est declare');
  check(r.sam.rawValue === '15 Mds$', 'le montant brut reste lisible pour le code');
  check(r.som.perimeterMissing === true, 'un perimetre null est traite comme absent');
}

console.log('\n[Suite 2] les perimetres de complaisance sont ecartes');
{
  const r = appliquerGardePerimetre({
    tam: { value: '1 Md$', perimeter: 'monde' },
    sam: { value: '1 Md$', perimeter: '2024' },
    som: { value: '1 Md$', perimeter: '   ' },
  });
  for (const n of ['tam', 'sam', 'som']) {
    check(r[n].perimeterMissing === true, `« ${JSON.stringify(r[n].rawValue)} » : perimetre trop court, ecarte (${n})`);
  }
}

console.log('\n[Suite 3] la garde ne casse rien de ce qui ne la concerne pas');
{
  check(appliquerGardePerimetre(null) === null, 'une entree nulle passe');
  check(appliquerGardePerimetre(undefined) === undefined, 'une entree absente passe');
  const partiel = appliquerGardePerimetre({ tam: { value: 'x', perimeter: 'segment logiciel manufacturier, Europe, 2024' }, sizingNarrative: 'texte' });
  check(partiel.sizingNarrative === 'texte', 'les champs voisins sont conserves');
  check(partiel.sam === undefined, 'un niveau absent n est pas fabrique');
}

console.log('\n[Suite 4] les trois passes reelles du 3 aout');
{
  // Les trois valeurs de TAM rendues par le moteur sur le meme dossier.
  // Aucune ne portait de perimetre en champ : les trois seraient
  // desormais refusees, ce qui est le comportement voulu, un chiffre
  // sans perimetre n etant pas un chiffre.
  const passes = [
    '11 milliards de dollars (marche IIoT pour la fabrication intelligente, 2022)',
    '500 milliards de dollars d ici 2025 (depense IIoT mondiale)',
    '11 milliards de dollars pour le segment IIoT manufacturing analytics en 2022',
  ];
  for (const v of passes) {
    const r = appliquerGardePerimetre({ tam: { value: v } });
    check(r.tam.perimeterMissing === true, `« ${v.slice(0, 46)}… » refusee faute de perimetre en champ`);
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
