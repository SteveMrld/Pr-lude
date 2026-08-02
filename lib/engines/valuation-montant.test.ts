// ============================================================
// Tests deterministes de la lecture d un montant
// ------------------------------------------------------------
// Ce que ces tests prouvent : un pourcentage n est jamais un montant,
// un nombre sans unite ni devise n est pas converti par defaut, et
// l unite d une fourchette porte sur ses deux bornes.
//
// Le defaut ferme : « Cession de 100% du capital » rendait 100 M EUR.
// La forme prenait le premier nombre du libelle et multipliait par un
// million tout nombre sous mille. Mesure du 3 aout 2026 : six dossiers
// sur trente-trois portant un candidat de ticket rendaient un montant
// fabrique, dont quatre cessions totales.
// ============================================================

import { __testables } from './valuation-engine';

const { lireMontant, parseTicket } = __testables;

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
console.log('\n[Suite 1] un pourcentage n est pas un montant');
// ============================================================
{
  // Les cinq libelles du corpus, tels qu ils sont ecrits en base.
  const cessions = [
    'Cession de 100% du capital (transaction M&A, non levée de fonds)',
    'Cession de 100% des titres (processus de vente initié par les actionnaires)',
    "Cession envisagée jusqu'à 100% de Tratel Affrètement SASU par Ciments Calcia",
    'Non précisé (opération de cession à 100% par PPR/Redcats)',
  ];
  for (const l of cessions) {
    const m = lireMontant(l);
    check(m.value === null, `aucun montant lu dans « ${l.slice(0, 34)}… »`);
    check(m.cause === 'absence', '  et la cause est absence, le document n annonce pas de somme');
  }
  check(lireMontant('100% du capital').motif?.includes('part') === true,
    'le motif nomme la part plutot que le nombre');
}

// ============================================================
console.log('\n[Suite 2] le pourcentage n emporte pas le libelle entier');
// ============================================================
{
  // Crowdaa : un pourcentage de discount suit le montant recherche.
  // Rejeter le libelle entier perdrait un ticket legitime.
  const m = lireMontant('€500 000 recherchés (Obligations Convertibles, plafond $7M avec 20% de discount)');
  check(m.value === 500_000, `500 000 euros lus malgre le pourcentage qui suit (obtenu ${m.value})`);

  const apres = lireMontant('cession de 100% du capital pour 12 M€');
  check(apres.value === 12_000_000, `le montant qui suit le pourcentage est lu (obtenu ${apres.value})`);
}

// ============================================================
console.log('\n[Suite 3] aucune conversion par defaut');
// ============================================================
{
  const m = lireMontant('Non précisé (cession de 6 parcs par Compagnie des Alpes)');
  check(m.value === null, 'six parcs ne font pas six millions d euros');
  check(m.motif?.includes('sans unite ni devise') === true, 'le motif dit pourquoi');

  check(lireMontant('42').value === null, 'un nombre nu n est pas un montant');
  check(lireMontant("Cession d'une participation majoritaire").value === null,
    'un libelle sans nombre ne rend rien');
}

// ============================================================
console.log('\n[Suite 4] ce qui doit continuer de passer');
// ============================================================
{
  const cas: Array<[string | number, number]> = [
    ['800 k€', 800_000],
    ['800k€ (mix Equity/bancaire)', 800_000],
    ['2,1 m€', 2_100_000],
    ['2,1 m€ (CA 2024 réel)', 2_100_000],
    ['42,7 M€ (CA agrégé 2014f)', 42_700_000],
    ['$193 000 de revenus en 2021', 193_000],
    ['1,2 Md€', 1_200_000_000],
    [800_000, 800_000],
  ];
  for (const [entree, attendu] of cas) {
    const m = lireMontant(entree);
    check(m.value === attendu, `« ${String(entree).slice(0, 30)} » vaut ${attendu} (obtenu ${m.value})`);
  }
  // L unite d une fourchette porte sur ses deux bornes.
  const b = lireMontant('€10-15m de cash-in injecté dans la société');
  check(b.value === 10_000_000, `la borne basse d une fourchette prend l unite trouvee plus loin (obtenu ${b.value})`);
}

// ============================================================
console.log('\n[Suite 5] le ticket porte sa cause');
// ============================================================
{
  const cession = parseTicket({ fundraise: { amount: 'Cession de 100% du capital' } } as any);
  check(cession.total === null, 'ticket non etabli sur une cession totale');
  check(cession.cause === 'absence', 'la cause remonte au ticket');
  check(cession.causeMotif !== null, 'avec son motif');
  check(cession.raw === 'Cession de 100% du capital', 'le libelle brut est conserve pour citation');

  const levee = parseTicket({ fundraise: { amount: '800 k€' } } as any);
  check(levee.total === 800_000 && levee.cause === null, 'une levee chiffree n a pas de cause');
  check(levee.equity === 800_000, 'et sa part capital vaut le total sans mention d autre instrument');

  const mixte = parseTicket({ fundraise: { amount: '800 k€ (mix equity/bancaire)' } } as any);
  check(mixte.total === 800_000 && mixte.equity === null,
    'un ticket mixte garde son total et refuse une part capital devinee');

  const vide = parseTicket({} as any);
  check(vide.total === null && vide.cause === 'absence', 'aucun candidat : absence');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
