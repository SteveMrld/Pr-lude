// ============================================================
// Tests deterministes de la lecture d un montant
// ------------------------------------------------------------
// Ce que ces tests prouvent : un jeton pris dans un fragment de date
// n est pas un montant, il est retire et non refuse, et les quatre
// implementations qui lisaient la meme chaine rendent maintenant le
// meme chiffre.
//
// Le defaut : « Dec-22a », en-tete de colonne d une serie de revenus au
// millesime, valait vingt-deux millions dans deux moteurs sur trois,
// puisqu ils convertissaient par defaut vers les millions tout nombre
// sans unite. Le troisieme le refusait mais echouait a l autre bout :
// il retenait le premier jeton du libelle, si bien que « Dec-22a :
// 1,2 M€ » lui rendait vingt-deux, donc rien.
//
// Le defaut commun ne tient pas a l unite, il tient au rang. Le premier
// nombre d un libelle n est pas le montant du libelle, et une ligne de
// tableau commence par sa periode.
//
// La derniere suite est celle qui compte pour la consolidation : elle
// verifie que les trois moteurs consommateurs rendent bien la meme
// lecture sur la meme chaine, ce qui est la seule chose qu une
// implementation unique est censee garantir et qu aucune relecture ne
// montre.
//
// Execution : npx tsx lib/engines/lecture-montant.test.ts
// ============================================================

import { lireMontant } from './lecture-montant';
import { __testables } from './valuation-engine';
import { parseEurAmount } from '../reconciliation-prefill';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] un fragment de date n est pas un montant');
{
  const cas = [
    'Dec-22a', 'Dec-24e', 'déc-22', 'dec 2022', 'Jan-23',
    'FY22', 'FY 2024', 'Q3 2024', 'T1-23', '31/12/2023', '2023-12',
  ];
  for (const c of cas) {
    const lu = lireMontant(c);
    check(lu.value === null, `« ${c} » ne rend aucun montant`);
  }
  check(
    /date/.test(lireMontant('Dec-22a').motif || ''),
    'et le motif nomme la date plutot que de parler d unite',
  );
}

console.log('\n[Suite 2] la date est retiree, pas refusee');
{
  // C est la difference qui compte. Un libelle qui porte une periode
  // puis un montant doit rendre le montant : le refuser reviendrait a
  // remplacer un faux positif par un faux negatif.
  check(lireMontant('Dec-22a : 1,2 M€').value === 1_200_000, 'periode puis montant : le montant');
  check(lireMontant('FY24 : levée de 4 M€').value === 4_000_000, 'exercice puis montant');
  check(lireMontant('Q3 2024 - 800k€').value === 800_000, 'trimestre puis montant');
  check(lireMontant('CA mars 2024 de 2,5 M€').value === 2_500_000, 'mois en toutes lettres puis montant');
}

console.log('\n[Suite 3] ce qui ressemble a un mois sans en etre un');
{
  // La limite de mot en fin de nom de mois n est pas cosmetique :
  // « mai » mordait sur « maintenance », et un poste budgetaire
  // devenait une date.
  check(lireMontant('12 M€ de maintenance').value === 12_000_000, 'maintenance n est pas mai');
  check(lireMontant('15 M€ de marketing').value === 15_000_000, 'marketing n est pas mars');
  check(lireMontant('500 k€ de juridique').value === 500_000, 'juridique n est pas juin');
}

console.log('\n[Suite 4] les regles anterieures tiennent');
{
  check(lireMontant('Cession de 100% du capital').value === null, 'une part de capital n est pas un montant');
  check(lireMontant('cession de 100% du capital pour 12 M EUR').value === 12_000_000, 'sauf quand un montant suit');
  check(lireMontant('10-15m').value === 10_000_000, 'l unite d une fourchette porte sur ses deux bornes');
  check(lireMontant('500 000 recherches, plafond 7M').value === null, 'mais elle ne se cherche pas n importe ou');
  check(lireMontant('42').value === null, 'un nombre sans unite ni devise n est pas un montant');
  check(lireMontant('15m de cash-in').value === 15_000_000, 'le suffixe ne mord pas sur le mot suivant');
}

console.log('\n[Suite 5] les unites en toutes lettres, reprises du prefill');
{
  check(lireMontant('12 millions EUR').value === 12_000_000, 'millions');
  check(lireMontant('1.5 milliard').value === 1_500_000_000, 'milliard');
  check(lireMontant('1,5 millions').value === 1_500_000, 'virgule francaise');
  check(lireMontant('500k').value === 500_000, 'k colle au nombre');
}

console.log('\n[Suite 6] la devise est lue et jamais convertie');
{
  check(lireMontant('4 M€').devise === 'EUR', 'euro');
  check(lireMontant('$10M').devise === 'USD', 'dollar');
  check(lireMontant('10M GBP').devise === 'GBP', 'livre');
  check(lireMontant('10M').devise === null, 'aucune devise, aucune supposition');
  check(lireMontant('$10M').value === 10_000_000, 'la valeur reste dans sa devise');
}

console.log('\n[Suite 7] les consommateurs rendent la meme lecture');
{
  // Le seul verrou qui prouve la consolidation. Chaque moteur applique
  // ensuite sa parite, qui lui appartient, mais aucun ne lit plus
  // autrement.
  const cas = ['Dec-22a', 'Dec-22a : 1,2 M€', 'Cession de 100% du capital', '42', '4 M€'];
  for (const c of cas) {
    const direct = lireMontant(c).value;
    const parTicket = __testables.parseTicket({
      fundraise: { amount: c },
    } as any).total;
    const parPrefill = parseEurAmount(c);
    check(
      direct === parTicket && direct === parPrefill,
      `« ${c} » : meme lecture par les trois portes (${direct})`,
    );
  }
}

console.log(`\n${pass} OK, ${fail} KO\n`);
process.exit(fail > 0 ? 1 : 0);
