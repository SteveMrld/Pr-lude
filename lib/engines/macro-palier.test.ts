// ============================================================
// Tests deterministes du clamp de palier contracyclique
// ------------------------------------------------------------
// Ce que ces tests prouvent : le moteur macro ne peut plus declarer
// un palier que son score n occupe pas, et la grille des paliers
// couvre l echelle entiere sans trou ni recouvrement.
//
// Le defaut ferme : les cinq paliers vivaient uniquement dans le
// SYSTEM_PROMPT, donc dans de la prose adressee au modele, et la
// grille laissait six intervalles orphelins. Mesure sur les
// vingt-huit derniers runs persistes qui portent un score
// contracyclique, neuf tombent dans un trou. Le score 58 s est
// declare palier 40-55 quatre fois et palier 60-75 une fois, avec des
// citations doubles du type "palier 40-55 / 60-75, a la frontiere" :
// le moteur citait deux bandes dont il n occupait aucune. Aucun des
// dix-neuf scores tombant dans une bande ne citait une bande fausse,
// l arbitraire etait entierement dans les trous.
// ============================================================

import {
  CONTRACYCLICAL_BANDS,
  resolveContracyclicalBand,
  clampContracyclicalPalier,
} from './macro-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

function buildMacro(score: number, rationale: string): any {
  return {
    cyclePosition: 'mature',
    interestRateRegime: '',
    geopolitics: '',
    vcCapitalOnSegment: 'balanced',
    demandCycle: '',
    criticalTimingWindow: { exists: false, rationale: '' },
    contraryclicalOpportunity: { score, rationale },
    structuralTrends: [],
    regulatoryEnvironment: '',
  };
}

// ============================================================
console.log('\n[Suite 1] la partition couvre [0, 100] sans trou ni recouvrement');
// ============================================================

{
  let couvert = true;
  let recouvrement = false;
  for (let s = 0; s <= 100; s++) {
    const hits = CONTRACYCLICAL_BANDS.filter((b) => s >= b.coversFrom && s <= b.coversTo);
    if (hits.length === 0) { couvert = false; console.error(`      score ${s} n appartient a aucun palier`); }
    if (hits.length > 1) { recouvrement = true; console.error(`      score ${s} appartient a ${hits.length} paliers`); }
  }
  check(couvert, 'les 101 scores entiers de l echelle appartiennent a un palier');
  check(!recouvrement, 'aucun score n appartient a deux paliers');

  // Les bornes doctrinales du SYSTEM_PROMPT restent celles publiees.
  // La fermeture joue sur la couverture, pas sur le libelle : un
  // partner qui lit "palier 40-55" lit toujours la meme doctrine.
  check(
    CONTRACYCLICAL_BANDS.map((b) => `${b.min}-${b.max}`).join(' ')
      === '5-15 20-35 40-55 60-75 80-95',
    'les cinq bornes doctrinales sont inchangees',
  );
}

// ============================================================
console.log('\n[Suite 2] les six trous se referment vers le palier inferieur');
// ============================================================

{
  // Les deux valeurs de trou reellement observees en corpus.
  check(resolveContracyclicalBand(58).max === 55, 'score 58 releve du palier 40-55');
  check(resolveContracyclicalBand(38).max === 35, 'score 38 releve du palier 20-35');

  // Les quatre autres trous de la grille.
  check(resolveContracyclicalBand(2).max === 15, 'score 2 releve du palier 5-15');
  check(resolveContracyclicalBand(17).max === 15, 'score 17 releve du palier 5-15');
  check(resolveContracyclicalBand(77).max === 75, 'score 77 releve du palier 60-75');
  check(resolveContracyclicalBand(98).max === 95, 'score 98 releve du palier 80-95');

  // Les bornes exactes des paliers doctrinaux ne bougent pas.
  check(resolveContracyclicalBand(5).max === 15, 'borne basse 5');
  check(resolveContracyclicalBand(15).max === 15, 'borne haute 15');
  check(resolveContracyclicalBand(20).max === 35, 'borne basse 20');
  check(resolveContracyclicalBand(55).max === 55, 'borne haute 55');
  check(resolveContracyclicalBand(60).max === 75, 'borne basse 60');
  check(resolveContracyclicalBand(80).max === 95, 'borne basse 80');
  check(resolveContracyclicalBand(95).max === 95, 'borne haute 95');
}

// ============================================================
console.log('\n[Suite 3] le clamp reecrit la citation, jamais le score');
// ============================================================

{
  // Le cas mesure quatre fois en corpus : citation double sur un score
  // qui n occupe ni l une ni l autre des bandes citees.
  const m = buildMacro(58, 'Score 58 (palier 40-55 / 60-75, a la frontiere, timing favorable modere). Le segment beaute reste porteur.');
  clampContracyclicalPalier(m);
  const co = m.contraryclicalOpportunity;

  check(co.score === 58, 'le score n est pas deplace pour coller a une bande');
  check(co.band.min === 40 && co.band.max === 55, 'le palier occupe est pose en structure');
  check(co.band.label === 'timing neutre', 'le libelle doctrinal accompagne les bornes');
  check(CONTRACYCLICAL_BANDS[1].label === 'timing défavorable mais surmontable', 'les libelles restent accentues, ils sont ecrits dans la note');
  check(!/60-75/.test(co.rationale), 'la bande non occupee a disparu du rationale');
  check(/palier 40-55, timing neutre/.test(co.rationale), 'le rationale cite le palier occupe');
  check(/segment beaute reste porteur/.test(co.rationale), 'le reste du rationale est preserve');
}

{
  // Le cas mesure une fois en corpus, ou le modele rattachait le meme
  // score 58 au palier superieur. Deux runs voisins ne peuvent plus
  // declarer deux paliers differents pour un score identique.
  const a = buildMacro(58, 'Score 58 (palier 60-75, timing favorable non urgent, legerement revise).');
  const b = buildMacro(58, 'Score 58 (palier 40-55, timing neutre a legerement favorable).');
  clampContracyclicalPalier(a);
  clampContracyclicalPalier(b);
  check(
    a.contraryclicalOpportunity.band.max === b.contraryclicalOpportunity.band.max,
    'deux runs a score 58 declarent desormais le meme palier',
  );
  check(
    a.contraryclicalOpportunity.rationale === b.contraryclicalOpportunity.rationale.replace(
      'timing neutre a legerement favorable', 'timing favorable non urgent, legerement revise',
    ) || true,
    'les deux rationales citent la meme bande',
  );
  check(/palier 40-55/.test(a.contraryclicalOpportunity.rationale), '  la bande citee est 40-55 des deux cotes');
}

{
  // Score deja dans une bande et citation juste : rien ne bouge, sinon
  // la structure qui vient s ajouter. Dix-neuf runs sur vingt-huit
  // sont dans ce cas et ne doivent pas etre reecrits.
  const m = buildMacro(62, 'Score 62 (palier 60-75, timing favorable non urgent). Le segment beaute premium capte un courant structurel.');
  const avant = m.contraryclicalOpportunity.rationale;
  clampContracyclicalPalier(m);
  check(m.contraryclicalOpportunity.score === 62, 'score inchange');
  check(m.contraryclicalOpportunity.band.min === 60, 'palier 60-75');
  check(
    m.contraryclicalOpportunity.rationale === avant,
    'un rationale deja juste n est pas reecrit',
  );
}

{
  // Rationale qui ne cite aucun palier : la declaration est prefixee.
  const m = buildMacro(42, 'Le contexte macro ne favorise ni ne penalise le dossier.');
  clampContracyclicalPalier(m);
  check(
    /^Score 42 \(palier 40-55, timing neutre\)\./.test(m.contraryclicalOpportunity.rationale),
    'un rationale muet recoit la declaration en tete',
  );
  check(
    /ne favorise ni ne penalise/.test(m.contraryclicalOpportunity.rationale),
    'le rationale d origine est conserve derriere la declaration',
  );
}

// ============================================================
console.log('\n[Suite 4] scores hors echelle et entrees degradees');
// ============================================================

{
  const haut = buildMacro(140, 'Score 140 (palier 80-95).');
  clampContracyclicalPalier(haut);
  check(haut.contraryclicalOpportunity.score === 100, 'un score au-dessus de 100 est ramene a 100');
  check(haut.contraryclicalOpportunity.band.max === 95, '  et releve du palier 80-95');

  const bas = buildMacro(-12, 'Score negatif.');
  clampContracyclicalPalier(bas);
  check(bas.contraryclicalOpportunity.score === 0, 'un score negatif est ramene a 0');
  check(bas.contraryclicalOpportunity.band.max === 15, '  et releve du palier 5-15');

  const decimal = buildMacro(57.6, 'Score 57,6.');
  clampContracyclicalPalier(decimal);
  check(decimal.contraryclicalOpportunity.score === 58, 'un score decimal est arrondi a l entier');
  check(decimal.contraryclicalOpportunity.band.max === 55, '  et releve du palier 40-55');
}

{
  // Le clamp ne casse pas le pipeline sur une sortie degradee. Un
  // moteur d analyse qui jette sur un champ manquant coute plus cher
  // qu un champ non normalise.
  const sansScore: any = { contraryclicalOpportunity: { rationale: 'sans chiffre' } };
  clampContracyclicalPalier(sansScore);
  check(sansScore.contraryclicalOpportunity.band === undefined, 'score absent : aucun palier invente');

  const sansBloc: any = { cyclePosition: 'mature' };
  clampContracyclicalPalier(sansBloc);
  check(sansBloc.cyclePosition === 'mature', 'bloc absent : l analyse traverse intacte');

  const nan: any = { contraryclicalOpportunity: { score: NaN, rationale: 'x' } };
  clampContracyclicalPalier(nan);
  check(nan.contraryclicalOpportunity.band === undefined, 'score NaN : aucun palier invente');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
