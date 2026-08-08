// Verrou du resume de reserves du magasin d analyses.
//
// Le nom du fichier designe ce qu il importe, et non son voisin : la
// fonction vit dans `analysis-store`, le test aussi.
//
// La liste des cas se derive de ce que la fonction decide : si un
// bulletin existe, s il porte une liste de reserves, combien elle en
// compte, et combien sont majeures. Le premier axe est celui qui
// compte, parce que son erreur ne casse rien et se lit comme une bonne
// nouvelle : rendre zero quand on ne sait pas ferait lire « aucune
// reserve » sur un dossier dont personne n a releve les reserves.

import { resumerReserves } from './analysis-store';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

console.log('\n[Suite 1] l absence de bulletin ne se lit pas comme une absence de reserve');
{
  // LE CAS QUI DECIDE. Au 8 aout 2026 le bulletin figure sur quatre
  // lignes sur soixante-six : la branche majoritaire est celle-ci, et
  // c est elle qui doit rendre null plutot que zero.
  check(resumerReserves(null) === null, 'un bulletin absent rend null');
  check(resumerReserves(undefined) === null, 'un bulletin indefini rend null');
  check(resumerReserves('') === null, 'une chaine vide rend null');
  check(resumerReserves(0) === null, 'un zero rend null');
  // Un bulletin present mais sans liste de reserves n a rien releve non
  // plus : la clef absente n est pas une liste vide.
  check(resumerReserves({ ancrage: {} }) === null, 'un bulletin sans liste de reserves rend null');
  // Le second sens : un releve qui a trouve zero doit rendre zero et
  // non null, sinon un dossier verifie et propre serait indiscernable
  // d un dossier jamais verifie.
  const vide = resumerReserves({ reserves: [] });
  check(vide !== null && vide.total === 0, 'un releve sans reserve rend zero et non null');
  check(vide !== null && vide.majeures === 0, 'et zero majeure');
}

console.log('\n[Suite 2] le compte, et la gravite qui change ce qu il faut faire');
{
  const b = {
    reserves: [
      { titre: 'a', gravite: 'majeure' },
      { titre: 'b', gravite: 'mineure' },
      { titre: 'c', gravite: 'majeure' },
      { titre: 'd', gravite: 'notable' },
    ],
  };
  const r = resumerReserves(b);
  check(r !== null && r.total === 4, 'le total compte toutes les reserves');
  check(r !== null && r.majeures === 2, 'et les majeures se comptent a part');
  // Le second sens : une gravite inconnue entre dans le total et non
  // dans les majeures, faute de quoi une gravite ajoutee demain serait
  // soit ignoree, soit promue sans qu on l ait decide.
  const inconnue = resumerReserves({ reserves: [{ titre: 'x', gravite: 'critique-nouvelle' }] });
  check(inconnue !== null && inconnue.total === 1, 'une gravite inconnue compte dans le total');
  check(inconnue !== null && inconnue.majeures === 0, 'et pas dans les majeures');
  const sansGravite = resumerReserves({ reserves: [{ titre: 'y' }] });
  check(sansGravite !== null && sansGravite.total === 1, 'une reserve sans gravite compte dans le total');
  // Une entree qui n est pas un objet ne doit pas faire lever, parce
  // qu un bulletin ancien peut porter n importe quoi.
  const bruit = resumerReserves({ reserves: [null, 'texte', { gravite: 'majeure' }] });
  check(bruit !== null && bruit.total === 3, 'les entrees etrangeres comptent sans faire lever');
  check(bruit !== null && bruit.majeures === 1, 'et seule la majeure lisible est comptee');
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
