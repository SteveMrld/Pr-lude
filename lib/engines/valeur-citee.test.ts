// ============================================================
// Tests deterministes de la valeur citee
// ------------------------------------------------------------
// Ce que ces tests prouvent : les quatre valeurs de Project Hello sont
// retenues, la valeur juste passe, une valeur sans verbatim bascule
// comme une revendication web sans capture, et rien n est corrige en
// silence.
//
// Les fixtures sont les cellules reelles du classeur Hello Planet,
// relevees le 5 aout 2026, et les valeurs reelles rendues par
// l extraction du run b8d0e9ac. Aucune n est construite : c est la
// difference entre mesurer une regle et mesurer son accord avec
// l hypothese qui l a produite.
//
// Execution : npx tsx lib/engines/valeur-citee.test.ts
// ============================================================

import {
  evaluerValeurCitee,
  evaluerSerie,
  toleranceDArrondi,
  decimalesDe,
  alignerEchelle,
} from './valeur-citee';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] la tolerance descend de la precision declaree');
{
  check(decimalesDe(0.963) === 3, 'trois decimales');
  check(decimalesDe(153) === 0, 'aucune decimale');
  check(decimalesDe(1.5) === 1, 'une decimale');
  check(toleranceDArrondi(0.963) === 0.0005, 'a trois decimales, un demi-millieme');
  check(toleranceDArrondi(153) === 0.5, 'a l entier, un demi');
  // Le point qui rend la regle non arbitraire : elle ne demande aucun
  // chiffre, elle lit celui que la valeur porte deja.
  check(toleranceDArrondi(0.1) === 0.05 && toleranceDArrondi(0.100) === 0.05,
    'la tolerance suit l ecriture et non la magnitude');
}

console.log('\n[Suite 2] les quatre valeurs de Project Hello sont retenues');
{
  // Le classeur, feuille Management BP, colonnes G a J pour 2025 a 2028.
  const cas: Array<[string, string, number, string]> = [
    ['2025', '100,150', 0.101, 'EBITDA 2026, pris pour un chiffre d affaires 2025'],
    ['2026', '907,250', 0.897, 'bonne ligne et bonne annee, valeur approximee'],
    ['2027', '963,750', 0.963, 'ligne B2B prise pour le total'],
    ['2028', '963,750', 0.963, 'ligne B2B prise pour le total'],
  ];
  for (const [annee, verbatim, valeur, quoi] of cas) {
    const r = evaluerValeurCitee({ verbatim, valeur });
    check(r.fondee === false, `${annee} : ${valeur} ne descend pas de « ${verbatim} » (${quoi})`);
    check(r.cause === 'incident', `${annee} : la cause est un incident et non une absence`);
  }
}

console.log('\n[Suite 3] la valeur juste passe, et c est ce qui fait la discrimination');
{
  // 1 059 750 rendu 1,060 : arrondi legitime, ecart 0,00025 pour une
  // tolerance de 0,0005. Sans cette moitie, le test passerait aussi si
  // la regle refusait tout.
  const r = evaluerValeurCitee({ verbatim: '1,059,750', valeur: 1.060 });
  check(r.fondee === true, 'le chiffre d affaires 2027 correctement arrondi est fonde');

  // La meme valeur ecrite avec la precision que le verbatim autorise.
  check(evaluerValeurCitee({ verbatim: '963,750', valeur: 0.964 }).fondee === true,
    'et 963 750 rendu 0,964 passe, la ou 0,963 est retenu');

  // L ecart entre les deux est de deux dixiemes de millieme : la regle
  // discrimine a cette finesse-la sans qu aucun seuil ait ete choisi.
  const juste = evaluerValeurCitee({ verbatim: '963,750', valeur: 0.964 });
  const faux = evaluerValeurCitee({ verbatim: '963,750', valeur: 0.963 });
  check((juste.ecart ?? 1) < (faux.ecart ?? 0), 'et l ecart les separe dans le bon sens');
}

console.log('\n[Suite 4] une valeur sans verbatim bascule, comme une revendication sans capture');
{
  const r = evaluerValeurCitee({ valeur: 0.963 });
  check(r.fondee === false, 'sans verbatim, non fondee');
  check(r.cause === 'absence', 'la cause est une absence et non un incident');
  check(r.verbatim === null, 'et rien n est fabrique pour combler');
  check(r.valeur === 0.963, 'la valeur declaree reste lisible, elle n est pas effacee');

  const vide = evaluerValeurCitee({ verbatim: '   ', valeur: 1 });
  check(vide.fondee === false && vide.verbatim === null,
    'un verbatim blanc vaut un verbatim absent : la garde ne se contourne pas par un espace');
}

console.log('\n[Suite 5] rien n est corrige en silence');
{
  const r = evaluerValeurCitee({ verbatim: '907,250', valeur: 0.897 });
  check(r.valeur === 0.897, 'la valeur declaree est conservee telle quelle');
  check(r.valeurDuVerbatim !== null && Math.abs(r.valeurDuVerbatim - 0.90725) < 1e-9,
    'celle du verbatim est rendue a cote, alignee sur l echelle declaree');
  check((r.motif ?? '').includes('907,250') && (r.motif ?? '').includes('0.897'),
    'et le motif porte les deux nombres, pour que la divergence se lise sans rouvrir le document');
}

console.log('\n[Suite 6] l alignement d echelle ne masque rien');
{
  check(Math.abs(alignerEchelle(963750, 0.963) - 0.96375) < 1e-9,
    'une cellule en euros se compare a une valeur en millions');
  check(Math.abs(alignerEchelle(1.5, 1.5) - 1.5) < 1e-9, 'meme echelle, rien ne bouge');
  // Une erreur de facteur dix du modele n est pas corrigee : la valeur
  // declaree sort inchangee, donc elle reste fausse et se voit ailleurs.
  const dix = evaluerValeurCitee({ verbatim: '963,750', valeur: 9.64 });
  check(dix.valeur === 9.64, 'un facteur dix errone n est pas rattrape par l alignement');
}

console.log('\n[Suite 6 bis] un verbatim est une cellule, jamais une operation');
{
  // Trois des huit verbatims reels du run 0c3e0caf du 6 aout 2026, deux
  // de chiffre d affaires et un d opex. Aucun n est un chiffre : ce sont
  // des sommes de colonnes mensuelles, faites par le modele, logees dans
  // le champ prevu pour la transcription.
  const reels = [
    '16,875 + 26,250 + 35,625 + 42,500 (Sep-Déc 2025, B2B Total) + 8,000 × 4 (B2C)',
    '49,375 + 53,750 + 58,125 (B2B Total 2026) + 8,000 × 12 (B2C)',
    '10,000 (Marketing Spend mensuel × 12 mois 2026)',
  ];
  for (const v of reels) {
    const r = evaluerValeurCitee({ verbatim: v, valeur: 0.963 });
    check(r.fondee === false, `refuse : « ${v.slice(0, 44)}... »`);
    check(r.natureDEcart === 'expression', 'et la nature de l ecart est nommee expression');
  }
  // Le point qui porte la doctrine : evaluer l expression aurait donne
  // la bonne somme sur deux des quatre lignes reelles, et l aurait
  // acceptee sur les deux autres ou le modele avait oublie une
  // composante. Le refus ne porte pas sur la justesse du calcul.
  check(evaluerValeurCitee({ verbatim: '153,250', valeur: 0.153 }).fondee === true,
    'une cellule passe, et c est la seule forme qui passe');
  check(evaluerValeurCitee({ verbatim: '1 059 750', valeur: 1.060 }).fondee === true,
    'y compris avec des espaces de milliers');
  // Un tiret entre deux chiffres est une soustraction, un tiret de date
  // n en est pas une.
  check(evaluerValeurCitee({ verbatim: 'Dec-22 : 963,750', valeur: 0.964 }).natureDEcart !== 'expression',
    'un tiret de periode ne fait pas d un verbatim une operation');
}

console.log('\n[Suite 6 ter] un ecart de periode n est pas une erreur de valeur');
{
  // Le cas reel : verbatim mensuel, valeur annuelle. La valeur est
  // probablement juste et le verbatim aussi ; ils ne se comparent pas.
  const m = evaluerValeurCitee({ verbatim: '10,000', valeur: 0.12, periode: 'mensuel' });
  check(m.fondee === false, 'la ligne reste non fondee : les deux nombres ne se comparent pas');
  check(m.natureDEcart === 'periode', 'mais la nature de l ecart est la periode et non la valeur');
  check((m.motif ?? '').includes('s explique par la periode'),
    'et le motif le dit, au lieu d accuser la lecture');

  // Sans la declaration, le meme couple se lisait comme une erreur.
  const sans = evaluerValeurCitee({ verbatim: '10,000', valeur: 0.12 });
  check(sans.natureDEcart === 'valeur', 'sans periode declaree, le meme couple accuse la valeur');

  // Une periode declaree qui n explique pas l ecart n excuse rien.
  const faux = evaluerValeurCitee({ verbatim: '10,000', valeur: 0.5, periode: 'mensuel' });
  check(faux.natureDEcart === 'valeur', 'une periode declaree n excuse pas un ecart qu elle n explique pas');

  // Un cumul ne s annualise pas : le rapporter a une annee serait une
  // divination, donc l ecart reste de valeur.
  const cum = evaluerValeurCitee({ verbatim: '35,000', valeur: 0.42, periode: 'cumul' });
  check(cum.natureDEcart === 'valeur', 'un cumul ne s annualise pas');
}

console.log('\n[Suite 7] la serie rend le compte que le consommateur declare');
{
  const s = evaluerSerie([
    { verbatim: '1,059,750', value: 1.060 },
    { verbatim: '963,750', value: 0.963 },
    { value: 0.5 },
  ]);
  check(s.evaluees.length === 3, 'trois valeurs evaluees');
  check(s.nonFondees === 2, 'deux non fondees');
  check(s.sansVerbatim === 1, 'dont une sans verbatim');
}

console.log('\n[Suite 8] aucune entree ne fait lever');
{
  let leves = 0;
  const degenerees: any[] = [
    {}, { verbatim: null, valeur: null }, { verbatim: 12, valeur: 'x' },
    { verbatim: '', valeur: 0 }, { verbatim: 'Dec-22a', valeur: 22 },
    { verbatim: 'aucun chiffre ici', valeur: 3 }, { valeur: NaN }, { valeur: Infinity },
  ];
  for (const d of degenerees) {
    try { evaluerValeurCitee(d); } catch { leves++; }
  }
  try { evaluerSerie(null); evaluerSerie(undefined); evaluerSerie([] as any); } catch { leves++; }
  check(leves === 0, `aucune levee sur ${degenerees.length} entrees degenerees`);

  // « Dec-22a » est le cas que le lecteur unique ferme : un fragment de
  // date n est pas un montant. Le verbatim reste illisible et la valeur
  // non fondee, ce qui est la bonne reponse.
  const date = evaluerValeurCitee({ verbatim: 'Dec-22a', valeur: 22 });
  check(date.fondee === false, 'un fragment de date ne fonde pas une valeur');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
