// ============================================================
// Tests deterministes de la comparabilite du verdict
// ------------------------------------------------------------
// Ce que ces tests prouvent : un verdict rendu sur une assiette
// partielle est declare non comparable quand l assiette pouvait
// changer le mot, et il ne l est pas quand elle ne le pouvait pas.
//
// Le defaut ferme est du 4 aout 2026. Le meme document analyse sur les
// deux parcours rendait « investir avec conditions » en early et
// « approfondir » en growth. La difference ne venait pas d un
// desaccord d analyse mais de l exclusion de deux dimensions que le
// parcours growth neutralise, faute de moteur calibre pour lui. Le
// score renormalise valait 59 pour un seuil a 60 : la bascule tenait a
// un point, et rien dans le mot « approfondir » ne disait que
// l assiette avait pu le produire.
//
// Execution : npx tsx lib/engines/score-comparabilite.test.ts
// ============================================================

import {
  evaluerComparabilite,
  deplacementPossible,
  DISPERSION_MAX_OBSERVEE,
  VERDICT_THRESHOLDS,
} from './score-calculator';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] une assiette pleine ne borne rien');
{
  check(deplacementPossible(1) === 0, 'aucun deplacement possible a poids evalue plein');
  const c = evaluerComparabilite(59, 1);
  check(c.comparable, 'un score a un point du seuil reste comparable si rien ne manque');
  check(c.marge === 1 && c.seuilLePlusProche === VERDICT_THRESHOLDS.conditions,
    'et la marge au seuil est rendue telle quelle');
}

console.log('\n[Suite 2] le cas qui a ouvert la garde');
{
  // Run growth du 4 aout : quatre dimensions sur six, 65 % du poids,
  // score renormalise 59, seuil de conditions a 60.
  const c = evaluerComparabilite(59, 0.65);
  check(!c.comparable, 'le verdict du run growth est declare non comparable');
  check(c.marge < c.deplacement, `la marge au seuil (${c.marge}) est sous le deplacement possible (${c.deplacement.toFixed(2)})`);
  check(c.seuilLePlusProche === 60, 'et le seuil en cause est nomme');
}

console.log('\n[Suite 3] la garde ne se declenche pas partout');
{
  // Une assiette a peine entamee ne suffit pas a tout invalider.
  const presque = evaluerComparabilite(52, 0.95);
  check(presque.comparable, 'une assiette a 95 % laisse le verdict comparable');
  const large = evaluerComparabilite(52, 0.90);
  check(large.comparable, 'a 90 % aussi, si le score est a mi-bande');
}

console.log('\n[Suite 4] la consequence pour le parcours growth, ecrite plutot que subie');
{
  // Ces trois assertions ont d abord ete ecrites a l envers, sur
  // l intuition qu un score a mi-bande resterait comparable a 65 % de
  // poids. La mesure dit le contraire et c est le test qui avait tort :
  // les bandes de verdict font quinze points, donc la demi-bande vaut
  // 7,5, et une assiette a 65 % autorise un deplacement de 8,75. Aucun
  // score des bandes centrales ne peut donc y tenir. On l ecrit plutot
  // que d ajuster la constante pour obtenir la reponse voulue.
  const bande = VERDICT_THRESHOLDS.conditions - VERDICT_THRESHOLDS.investigate;
  check(bande === 15, `les bandes de verdict font quinze points (${bande})`);
  check(deplacementPossible(0.65) > bande / 2,
    `a 65 % de poids le deplacement possible (${deplacementPossible(0.65).toFixed(2)}) depasse la demi-bande (${bande / 2})`);
  for (const s of [46, 52, 59, 62, 70, 74]) {
    check(!evaluerComparabilite(s, 0.65).comparable, `  score ${s} non comparable a 65 % de poids`);
  }
  // Le parcours growth exclut Equipe (0,20) et Vigilance (0,15), donc
  // il tourne toujours a 65 %. La consequence est donc generale et non
  // propre a ce dossier : aucun verdict growth ne se compare a un
  // verdict early tant que les moteurs ne sont pas recalibres. C est
  // le constat qui fonde le chantier de recalibration, et le declarer
  // sur chaque note growth est le seul moyen de ne pas laisser un
  // manque de calibration deplacer un verdict en silence.
  check(Math.abs((1 - 0.20 - 0.15) - 0.65) < 1e-9,
    'le poids evalue du parcours growth vaut bien 65 % par construction');
}

console.log('\n[Suite 5] le critere n est pas un plancher de poids');
{
  // La mesure du 4 aout a trouve des bascules de verdict a w = 0,85
  // comme a w = 0,63 : un plancher de poids place entre les deux aurait
  // laisse passer les premieres. Le critere retenu attrape les deux,
  // parce qu il regarde la distance au seuil et non le poids seul, et
  // il laisse passer un score eloigne a poids egal.
  const presDuSeuil = evaluerComparabilite(62, 0.85);
  const loinDuSeuil = evaluerComparabilite(52, 0.85);
  check(!presDuSeuil.comparable, 'a 85 % de poids, un score pres du seuil est declare non comparable');
  check(loinDuSeuil.comparable, 'a 85 % de poids, un score loin du seuil reste comparable');
  check(!presDuSeuil.comparable && loinDuSeuil.comparable,
    'a poids egal, le verdict depend donc de la distance au seuil et non du poids');
}

console.log('\n[Suite 6] la constante domine les deplacements mesures');
{
  // Les deplacements maximaux releves le 4 aout sur les 231 cas
  // simules, par poids evalue restant. La borne doit tous les couvrir,
  // faute de quoi elle laisserait passer une bascule qu on a vue.
  const MAXIMA_MESURES: Array<[number, number]> = [
    [0.58, 4.3], [0.63, 4.8], [0.65, 5.2], [0.67, 2.7], [0.70, 4.6],
    [0.72, 4.4], [0.78, 2.1], [0.80, 2.7], [0.85, 3.7], [0.87, 1.2],
  ];
  let couverts = 0;
  for (const [w, max] of MAXIMA_MESURES) {
    if (deplacementPossible(w) >= max) couverts++;
    else console.error(`      w=${w} : borne ${deplacementPossible(w).toFixed(2)} < mesure ${max}`);
  }
  check(couverts === MAXIMA_MESURES.length,
    `la borne couvre les dix maxima mesures (${couverts}/${MAXIMA_MESURES.length})`);

  // Et elle n est pas absurdement large : une borne qui couvrirait tout
  // declarerait tout incomparable, ce qui ne renseigne personne.
  const plusPetite = Math.max(...MAXIMA_MESURES.map(([w, max]) => max / (1 - w)));
  check(DISPERSION_MAX_OBSERVEE < plusPetite * 1.2,
    `et elle reste proche du plus petit multiplicateur suffisant (${plusPetite.toFixed(1)})`);
}

console.log(`\n${pass} pass, ${fail} fail\n`);
process.exit(fail > 0 ? 1 : 0);
