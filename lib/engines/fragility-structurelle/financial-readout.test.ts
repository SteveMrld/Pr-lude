// ============================================================
// TESTS DETERMINISTES : lecture financiere des patterns
// ------------------------------------------------------------
// Execution : npx tsx lib/engines/fragility-structurelle/financial-readout.test.ts
//
// Ce fichier est le verrou de la correction du 3 aout 2026. Deux
// patterns lisaient `FinancialDataExtraction` a travers un
// `const f: any`, sur trente et une clefs dont aucune n existe au
// contrat, et rendaient donc un snapshot vide sur tous les dossiers.
// Les tests de ces patterns etaient verts : leurs fixtures portaient
// les memes clefs inventees, derriere un `as any`, et mesuraient donc
// la compatibilite des mocks avec eux-memes.
//
// Le premier verrou est le compilateur : plus aucun `any` dans le
// lecteur, fixtures typees `FinancialDataExtraction` sans cast, donc
// toute clef inventee tombe a la compilation.
//
// Le second verrou est ici : le test 3 echoue le jour ou un champ
// declare par `FinancialReadout` cesse d etre atteignable depuis un
// dossier complet. C est exactement ce que la panne d origine faisait
// et que rien ne disait, et c est la forme que la discipline des
// regles ecrites appelle « le test qui compare le declare au reel ».
// ============================================================

import {
  buildFinancialReadout,
  renderFinancialReadout,
  readoutEstVide,
  AVERTISSEMENT_ENGAGEMENTS_NON_EXTRAITS,
  type FinancialReadout,
} from './financial-readout';
import {
  FIXTURE_FINANCIERE_COMPLETE,
  FIXTURE_FINANCIERE_MINIMALE,
  FIXTURE_FINANCIERE_VIDE,
} from './financial-fixture';

let pass = 0;
let fail = 0;

function check(label: string, got: unknown, expected: unknown): void {
  if (got === expected) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
}

function checkTrue(label: string, got: boolean): void {
  check(label, got, true);
}

// ============================================================
// Test 1 : les trois etats d absence sont distincts
// ============================================================

console.log('\n=== Test 1 : trois etats, trois phrases ===');
{
  const absent = buildFinancialReadout(null);
  const vide = buildFinancialReadout(FIXTURE_FINANCIERE_VIDE);
  const plein = buildFinancialReadout(FIXTURE_FINANCIERE_COMPLETE);

  check('bloc absent : present=false', absent.present, false);
  check('bloc vide : present=true', vide.present, true);
  check('bloc vide reconnu vide', readoutEstVide(vide), true);
  check('bloc plein non vide', readoutEstVide(plein), false);

  const rAbsent = renderFinancialReadout(absent);
  const rVide = renderFinancialReadout(vide);

  checkTrue('absence de bloc nommee', rAbsent.includes("aucun bloc de donnees financieres"));
  checkTrue('bloc vide nomme', rVide.includes('existe mais ne porte aucune valeur'));
  checkTrue('les deux phrases different', rAbsent !== rVide);

  // C est le coeur du defaut d origine : une phrase unique couvrait
  // les deux etats, elle disait vrai, et elle le disait pour la
  // mauvaise raison. Un lecteur du prompt genere concluait a un
  // dossier pauvre la ou il fallait conclure a un lecteur qui
  // regardait au mauvais endroit.
}

// ============================================================
// Test 2 : les marqueurs d absence du producteur sont lus
// ============================================================

console.log('\n=== Test 2 : marqueurs d absence declares par le producteur ===');
{
  const vide = buildFinancialReadout(FIXTURE_FINANCIERE_VIDE);
  check('non précisé lu comme absence', vide.tour.montant, null);
  check('non précisé lu comme absence sur le burn', vide.tour.burnMensuel, null);
  check('non communiqué lu comme absence sur le CAC', vide.unitEconomics.cac, null);

  // La liste est fermee et lue chez le producteur : le squelette JSON
  // de financial-extraction-engine demande ces chaines explicitement.
  // Toute autre chaine est une valeur et passe telle quelle.
  const plein = buildFinancialReadout(FIXTURE_FINANCIERE_COMPLETE);
  check('une vraie valeur passe telle quelle', plein.tour.burnMensuel, '218K€/mois');
}

// ============================================================
// Test 3 : VERROU. Tout champ declare est atteignable
// ============================================================

console.log('\n=== Test 3 : verrou, aucun champ declare sans producteur ===');
{
  const r = buildFinancialReadout(FIXTURE_FINANCIERE_COMPLETE);

  // Le dossier complet renseigne tout ce que le contrat sait porter.
  // Chaque champ declare par FinancialReadout doit donc en ressortir
  // non nul. Un champ qui reste nul ici est un champ qu aucun
  // producteur n alimente, c est-a-dire la panne d origine.
  const champs: Array<[string, unknown]> = [
    ['tour.montant', r.tour.montant],
    ['tour.runwayMois', r.tour.runwayMois],
    ['tour.burnMensuel', r.tour.burnMensuel],
    ['unitEconomics.cac', r.unitEconomics.cac],
    ['unitEconomics.ltv', r.unitEconomics.ltv],
    ['unitEconomics.ratioLtvCac', r.unitEconomics.ratioLtvCac],
    ['unitEconomics.contratMoyen', r.unitEconomics.contratMoyen],
    ['unitEconomics.margeUnitaire', r.unitEconomics.margeUnitaire],
    ['series.revenu', r.series.revenu],
    ['series.margeBrute', r.series.margeBrute],
    ['series.ebitda', r.series.ebitda],
    ['series.fcf', r.series.fcf],
    ['series.opex', r.series.opex],
    ['series.effectifs', r.series.effectifs],
    ['notes', r.notes],
  ];

  for (const [nom, valeur] of champs) {
    checkTrue(`${nom} atteignable depuis un dossier complet`, valeur !== null && valeur !== undefined);
  }

  // Le compte est verrouille lui aussi : ajouter un champ a
  // FinancialReadout sans l ajouter ici ferait passer le verrou a
  // cote de lui, ce qui est precisement la faute qu il surveille.
  const nbDeclares =
    Object.keys(r.tour).length
    + Object.keys(r.unitEconomics).length
    + Object.keys(r.series).length
    + 1; // notes
  check('tous les champs porteurs de donnee sont couverts', champs.length, nbDeclares);
}

// ============================================================
// Test 4 : aucune unite inventee
// ============================================================

console.log('\n=== Test 4 : aucune unite inventee ===');
{
  const r = buildFinancialReadout(FIXTURE_FINANCIERE_COMPLETE);

  // La discipline de precision interdit de preter a une donnee une
  // finesse qu elle ne porte pas. « 218K€/mois » est une chaine dans
  // le document, elle reste une chaine : la convertir en 218000
  // supposerait une unite que rien ne garantit.
  checkTrue('le burn reste une chaine', typeof r.tour.burnMensuel === 'string');
  checkTrue('le runway reste une chaine', typeof r.tour.runwayMois === 'string');
  checkTrue('le CAC reste une chaine', typeof r.unitEconomics.cac === 'string');

  // Les series, elles, sont numeriques au contrat, et leur unite est
  // documentee par le contrat. Elle est portee explicitement pour que
  // le modele ne la devine pas.
  check('unite du revenu declaree', r.series.revenu?.unite, 'M€');
  check('unite de la marge brute declaree', r.series.margeBrute?.unite, '% de marge brute');
  check('valeur de serie numerique', typeof r.series.revenu?.points[0]?.valeur, 'number');
}

// ============================================================
// Test 5 : le rendu porte ce qu il a lu
// ============================================================

console.log('\n=== Test 5 : rendu du bloc ===');
{
  const rendu = renderFinancialReadout(buildFinancialReadout(FIXTURE_FINANCIERE_COMPLETE));

  // Valeurs discriminantes : uniques dans le depot, donc leur presence
  // prouve le chemin et pas une identite entre source et repli.
  checkTrue('rendu porte le burn', rendu.includes('218K€/mois'));
  checkTrue('rendu porte le runway', rendu.includes('23 mois'));
  checkTrue('rendu porte la serie de revenu', rendu.includes('2024: 3.17'));
  checkTrue('rendu porte les charges operationnelles', rendu.includes('7.41'));
  checkTrue('rendu porte les effectifs', rendu.includes('43'));
  checkTrue('rendu porte les notes d extraction', rendu.includes('Baux commerciaux 9 ans'));

  // La provenance suit ce qu elle fonde et ne le precede pas.
  const posCorps = rendu.indexOf('218K€/mois');
  const posProvenance = rendu.indexOf('source :');
  checkTrue('provenance placee apres ce qu elle fonde', posProvenance > posCorps);
}

// ============================================================
// Test 6 : dossier minimal, garde franchie sans faux positif
// ============================================================

console.log('\n=== Test 6 : dossier minimal ===');
{
  const r = buildFinancialReadout(FIXTURE_FINANCIERE_MINIMALE);
  check('dossier minimal non vide', readoutEstVide(r), false);
  check('montant du tour lu', r.tour.montant, '5,11M€');
  check('unit economics absentes restent nulles', r.unitEconomics.cac, null);
  check('series non fournies restent nulles', r.series.ebitda, null);
}

// ============================================================
// Test 7 : l avertissement sur les engagements est explicite
// ============================================================

console.log('\n=== Test 7 : ce que le contrat ne porte pas est declare ===');
{
  // L axe identitaire de Fixed Cost Trap porte sur les engagements
  // contractuels long terme. Aucun champ du contrat ne les porte. Le
  // modele doit le savoir, sans quoi il conclut de leur absence dans
  // les donnees qu ils n existent pas dans le dossier, ce qui est la
  // meme conflation sous une autre forme.
  checkTrue(
    'avertissement nomme les engagements manquants',
    AVERTISSEMENT_ENGAGEMENTS_NON_EXTRAITS.includes('baux'),
  );
  checkTrue(
    'avertissement dit que l absence n est pas une information',
    AVERTISSEMENT_ENGAGEMENTS_NON_EXTRAITS.includes("n est donc pas une information"),
  );
}

// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);

// Reference au type pour que le fichier documente ce qu il verrouille.
export type _Verrouille = FinancialReadout;
