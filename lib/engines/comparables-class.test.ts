// ============================================================
// Tests deterministes du choix de seau de comparables
// ------------------------------------------------------------
// Ce que ces tests prouvent : la classe arbitree prime sur le balayage
// lexical, la correspondance couvre les vingt et une classes, un seau
// emprunte se declare, et une classe non tranchee rend une
// non-production declaree au lieu de la base entiere.
//
// Le defaut ferme est du 5 aout 2026. Sur les cinquante et une
// extractions persistees, quarante et un pour cent des dossiers
// ressortaient biotech_medtech, dont quatorze e-commerce, parce que la
// liste de mots-clefs biotech porte « sante » et « clinique ».
//
// CE QUE CES TESTS NE PROUVENT PAS
//
// Ils ne mesurent pas le taux de bon classement sur le corpus : cela se
// mesure sur les extractions persistees et non sur des fixtures, et le
// releve vit dans le registre. Ils verrouillent la regle, pas sa
// justesse sectorielle.
//
// Execution : npx tsx lib/engines/comparables-class.test.ts
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import { choisirSeauComparables, CORRESPONDANCE, CORRESPONDANCE_ARBITREE_LE } from './comparables-class';
import { SECTOR_BENCHMARKS } from '../data/sector-benchmarks';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const ROOT = join(__dirname, '..', '..');
const lire = (p: string) => readFileSync(join(ROOT, p), 'utf8');

console.log('\n[Suite 1] la correspondance couvre les vingt et une classes et se date');
{
  const classes = Object.keys(SECTOR_BENCHMARKS);
  const manquantes = classes.filter((c) => !CORRESPONDANCE[c]);
  check(manquantes.length === 0, `aucune classe sans seau (${manquantes.join(', ') || 'aucune'})`);
  check(Object.keys(CORRESPONDANCE).length === classes.length,
    `et aucun seau sans classe (${Object.keys(CORRESPONDANCE).length} contre ${classes.length})`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(CORRESPONDANCE_ARBITREE_LE), 'la table porte sa date d arbitrage');
  // Une liste qui tranche doit dire pourquoi, sinon elle ne se conteste
  // pas. C est la seule difference entre un arbitrage et un decret.
  const sansRaison = Object.entries(CORRESPONDANCE).filter(([, c]) => c.raison.trim().length < 40);
  check(sansRaison.length === 0, `chaque ligne porte sa raison (${sansRaison.map(([k]) => k).join(', ') || 'toutes'})`);
}

console.log('\n[Suite 2] la classe arbitree prime sur le balayage lexical');
{
  // Le cas reel : un teaser de soins capillaires, e-commerce, dont la
  // prose porte « sante » et « clinique ». Le balayage seul rendait
  // biotech_medtech sur quatorze dossiers de cette forme.
  const ecommerce: any = {
    sector: 'Beaute', subSector: 'Soins capillaires',
    productDescription: 'Produits de sante capillaire vendus en ligne, cliniquement testes',
    businessModel: 'Vente directe au consommateur par abonnement',
  };
  const choix = choisirSeauComparables(ecommerce, 'ecommerce-dtc');
  check(choix.seau === 'consumer', `la classe arbitree l emporte (${choix.seau})`);
  check(choix.origine === 'classe-arbitree', 'et l origine le declare');

  // Symetrie : sans classe arbitree, le balayage reprend la main. Sans
  // cette moitie, le test passerait aussi si le balayage etait mort.
  const sansClasse = choisirSeauComparables(ecommerce, null);
  check(sansClasse.origine === 'balayage', 'sans classe tranchee, le balayage decide encore');
  check(sansClasse.seau === 'biotech_medtech',
    `et il rend bien le mauvais seau, ce qui etait le defaut (${sansClasse.seau})`);
}

console.log('\n[Suite 3] un seau emprunte se declare');
{
  const propre = choisirSeauComparables(null, 'saas-b2b');
  check(propre.seau === 'saas' && propre.emprunte === false, 'saas-b2b a son seau propre');

  const emprunte = choisirSeauComparables(null, 'climate-tech');
  check(emprunte.seau === 'deeptech_hardware', 'climate-tech emprunte deeptech_hardware');
  check(emprunte.emprunte === true, 'et l emprunt est declare');
  check((emprunte.raison ?? '').includes('capex'), 'avec la raison de l arbitrage et non la seule cible');

  const empruntees = Object.entries(CORRESPONDANCE).filter(([, c]) => !c.propre).map(([k]) => k);
  // Treize, et non douze : les douze du releve d inventaire sont les
  // classes vides ou tenues par une ou deux fiches, ce qui est un autre
  // decompte. Une classe peut avoir des fiches propres et emprunter
  // quand meme, comme cybersecurity, qui en a cinq et va chez saas.
  check(empruntees.length === 13, `treize classes empruntent (${empruntees.length})`);
}

console.log('\n[Suite 4] une classe non tranchee rend une non-production declaree');
{
  const rien = choisirSeauComparables({ sector: '', subSector: '' } as any, 'unclassified');
  check(rien.seau === null, 'aucun seau');
  check(rien.cause === 'absence', 'cause absence : ni la matrice ni le balayage ne tranchent');
  check(rien.motif.includes('plutot qu une base entiere'),
    'et le motif dit que le remplissage par defaut est ce qu on retire');

  const horsCatalogue = choisirSeauComparables(null, 'classe-inventee');
  check(horsCatalogue.seau === null && horsCatalogue.cause === 'doctrine',
    'une classe hors catalogue est une decision doctrinale et non une panne');
}

console.log('\n[Suite 5] les trois moteurs passent par le point d entree unique');
{
  // CE QUE CE BALAYAGE VERIFIE, ET CE QU IL NE VERIFIE PAS
  //
  // Il verifie un seul axe : qu aucun des trois moteurs n appelle plus
  // la classification lexicale directement. Il ne verifie ni le stade
  // passe, ni l ordre des arguments, ni que le bloc soit effectivement
  // insere dans le prompt. Une garde qui balaie un axe donne l air de
  // fermer les autres, et c est la raison de cette note.
  const moteurs = [
    'lib/engines/pattern-engine.ts',
    'lib/engines/blindspot-engine.ts',
    'lib/engines/contrarian-engine.ts',
  ];
  for (const m of moteurs) {
    const src = lire(m);
    check(!/detectAssetClass\s*\(/.test(src), `${m} n appelle plus la classification lexicale`);
    check(src.includes('blocComparables('), `${m} passe par le point d entree unique`);
  }
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
