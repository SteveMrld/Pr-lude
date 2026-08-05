// ============================================================
// Etat du lot 1 de collecte, mesure a chaque passage
// ------------------------------------------------------------
// Ce que ce test prouve : ce qui manque encore au lot, champ par champ,
// sans que personne relise treize fiches. Il ne verifie pas que le lot
// est bon, il mesure ce qui lui reste a acquerir.
//
// Il est vert quand il reste des refus, et c est voulu : le lot n est
// pas encore ingerable et le dire n est pas un echec. Ce qui le ferait
// rougir est une regression, une fiche qui perdrait un champ deja
// acquis, ou un refus d une famille qu on croyait fermee.
//
// Execution : npx tsx lib/data/lot1-ecommerce-dtc.test.ts
// ============================================================

import { LOT1_ECOMMERCE_DTC } from './lot1-ecommerce-dtc';
import { verifierFiche, verifierComposition } from './fiche-comparable';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const refus = LOT1_ECOMMERCE_DTC.map((f) => ({ nom: f.name, r: verifierFiche(f) }));
const tous = refus.flatMap((x) => x.r.map((r) => ({ nom: x.nom, ...r })));

const intention = tous.filter((r) => r.motif.includes('annonce une collecte'));
const muettes = tous.filter((r) => r.motif.includes('ne designe rien'));
const autres = tous.filter((r) => !intention.includes(r) && !muettes.includes(r));

console.log('\n[Etat] ce qui reste au lot');
console.log(`  ${LOT1_ECOMMERCE_DTC.length} fiches, ${tous.length} refus`);
console.log(`  famille A, sources a collecter        : ${intention.length}`);
console.log(`  famille B, sources a identifier       : ${muettes.length}`);
console.log(`  autres                                : ${autres.length}`);
for (const r of autres) console.log(`     ${r.nom.padEnd(14)} ${r.champ.padEnd(20)} ${r.motif.slice(0, 80)}`);

console.log('\n[Suite 1] les vingt-deux combles le sont restes');
{
  // La passe du 5 aout a comble six `founded`, trois annees de jalon, un
  // statut, un outcome et sept `pieges`. Une regression sur l un d eux
  // rougirait ici, ce que la seule mesure d etat ne montrerait pas.
  const parChamp = (c: string) => autres.filter((r) => r.champ === c || r.champ.endsWith('.' + c)).length;
  check(parChamp('founded') === 0, `aucune annee de fondation manquante (${parChamp('founded')})`);
  check(parChamp('statut') === 0, `aucun statut manquant (${parChamp('statut')})`);
  check(parChamp('outcome') === 0, `aucune issue manquante (${parChamp('outcome')})`);
  check(parChamp('pieges') === 0, `aucun piege manquant (${parChamp('pieges')})`);
  check(parChamp('annee') === 0, `aucune annee de jalon manquante (${parChamp('annee')})`);
  check(parChamp('devise') === 0, `aucune devise hors vocabulaire (${parChamp('devise')})`);
  check(parChamp('montantVerbatim') === 0, `aucun montant declaratif (${parChamp('montantVerbatim')})`);
}

console.log('\n[Suite 2] les quatre arbitrages sont appliques');
{
  const f = (n: string) => LOT1_ECOMMERCE_DTC.find((x) => x.name === n)!;

  // Poulehouse et Jimmy Fairly restent a un jalon, declares.
  for (const n of ['Poulehouse', 'Jimmy Fairly']) {
    check(f(n).jalons.length === 1, `${n} garde son jalon unique`);
    check((f(n).jalonUniqueMotif ?? '').length >= 40, `${n} dit pourquoi`);
    check(verifierFiche(f(n)).every((r) => r.champ !== 'jalons'), `${n} n est plus refuse sur le compte de jalons`);
  }

  // Tediber : la ligne perd son montant et garde son libelle.
  const t = f('Tediber').jalons.find((j) => j.fiabilite === 'declaratif')!;
  check(t.montantVerbatim === undefined, 'Tediber : le montant attendu est retire');
  check(t.libelle.includes('attendu'), 'et le libelle garde la trace de ce qu il etait');

  // Typology : la ligne reste hors de la base, le conflit est conserve.
  const ty = f('Typology');
  check(ty.jalons.every((j) => j.montantVerbatim === undefined), 'Typology : aucun montant en base');
  check((ty.conflitsConserves ?? []).some((c) => c.includes('10 M$')), 'et le conflit de devise est conserve');

  // About You passe en contested.
  check(f('About You').outcome === 'contested', 'About You est en contested');
}

console.log('\n[Suite 3] les conflits sortent du champ source');
{
  const avecConflit = LOT1_ECOMMERCE_DTC.filter((f) => (f.conflitsConserves ?? []).length > 0);
  check(avecConflit.length === 5, `cinq fiches portent un conflit conserve (${avecConflit.length})`);
  // Le defaut ferme : trois conflits vivaient dans `source`, ou le
  // validateur cherche une preuve. Aucun n y est reste.
  const dansSource = LOT1_ECOMMERCE_DTC.flatMap((f) => f.jalons)
    .filter((j) => /conflit/i.test(j.source));
  check(dansSource.length === 0, `aucun conflit loge dans un champ source (${dansSource.length})`);
}

console.log('\n[Suite 4] la composition tient');
{
  check(verifierComposition(LOT1_ECOMMERCE_DTC).length === 0,
    'quatre echecs et un contested sur douze fiches : le plancher de contre-exemples est tenu');
  check(!LOT1_ECOMMERCE_DTC.some((f) => f.name === 'Cazoo'),
    'Cazoo est sorti du lot : il vit dans EXTENDED_CORPUS comme repere de regime');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
