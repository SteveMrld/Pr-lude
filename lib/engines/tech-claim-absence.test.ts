// ============================================================
// TESTS - UNE ENTREE ABSENTE NE DEPLACE PAS LE VERDICT DU COTE
// QUI PASSE
// ------------------------------------------------------------
// Le test budget contre equipe convertit un pourcentage flechee sur
// la tech en montant, et compare le nombre d ingenieurs que ce
// montant paye a l equipe tech annoncee. Quand le montant du tour
// n etait pas extrait, la branche d entree confondait deux
// situations : le pitch qui ne fleche aucun budget, qui est une
// observation sur le document, et le pitch qui en fleche un sans que
// le montant soit connu, qui est une lacune du pipeline. La seconde
// tombait dans la premiere et rendait 60 avec passed vrai, la ou le
// meme dossier avec son montant pouvait rendre 25 ou 50 en echec.
// Une donnee manquante ameliorait donc la note.
//
// Ce que ces tests verrouillent :
//   - Le montant absent rend un test non produit, jamais un score.
//   - Le meme dossier avec son montant rend un echec, ce qui etablit
//     que la valeur manquante deplacait bien le verdict, et dans le
//     sens qui passe.
//   - Un test non produit sort de la ponderation au lieu d y entrer
//     a zero : ni bonus ni malus, le score vaut ce que valent les
//     tests qui ont eu lieu.
//   - Aucun test produit ne rend pas un verdict de storytelling, qui
//     accuserait le dossier d une lacune du pipeline.
//   - Le motif de non-production dit ce que le pipeline sait, et
//     n affirme rien sur le contenu du document.
//
// Les jeux d essai entrent par la porte de la production : ils
// appellent les fonctions exportees du moteur, et ils sont typees
// sans cast, pour que le compilateur tombe des deux cotes.
//
// Execution : npx tsx lib/engines/tech-claim-absence.test.ts
// ============================================================

import {
  runBudgetVsTeamTest,
  moyennePonderee,
  testProduit,
  type BudgetSignal,
  type TeamTechSignals,
} from './tech-claim-coherence-engine';
import type { TechClaimTest } from './types';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); fail++; }
}

function checkTrue(label: string, cond: boolean) {
  if (cond) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}`); fail++; }
}

// ============================================================
// FIXTURES
// ------------------------------------------------------------
// Le montant est la seule chose qui varie entre les deux dossiers,
// et il porte une valeur qu aucune autre entree du test ne peut
// fournir : 30% de 4 000 000 EUR paie 1 200 000 EUR, soit cinq ETP
// sur trente-six mois a huit mille euros par mois. Face a une equipe
// d un seul profil tech, le calcul tombe dans la branche du decalage
// et rend un echec. C est ce qui rend la comparaison lisible : si
// les deux dossiers rendaient le meme score, le jeu d essai
// mesurerait l identite de deux branches et pas la dependance de la
// sortie au montant.
// ============================================================

/** Un pitch qui fleche 30% sur la tech, montant du tour connu. */
const BUDGET_AVEC_MONTANT: BudgetSignal = {
  detected: true,
  percentage: 30,
  amountEur: 1_200_000,
  evidence: '30% de la levee sur la plateforme et le recrutement tech',
};

/** Le meme pitch, montant du tour non extrait. */
const BUDGET_SANS_MONTANT: BudgetSignal = {
  detected: true,
  percentage: 30,
  amountEur: null,
  evidence: '30% de la levee sur la plateforme et le recrutement tech',
};

/** Un pitch qui ne fleche aucun budget tech. Cas distinct du precedent. */
const BUDGET_NON_FLECHE: BudgetSignal = {
  detected: false,
  percentage: null,
  amountEur: null,
  evidence: '',
};

/** Une equipe d un seul profil tech, sans CTO. */
const EQUIPE_MINCE: TeamTechSignals = {
  hasCTO: false,
  hasTechLead: true,
  techProfilesCount: 1,
  techProfilesNamed: ['R. Vasseur'],
};

/** Une equipe avec CTO et deux profils tech. */
const EQUIPE_FOURNIE: TeamTechSignals = {
  hasCTO: true,
  hasTechLead: true,
  techProfilesCount: 2,
  techProfilesNamed: ['R. Vasseur', 'L. Kerbaol'],
};

console.log('\n=== T1 : le montant absent ne rend pas un score ===\n');

const sansMontant = runBudgetVsTeamTest(BUDGET_SANS_MONTANT, EQUIPE_MINCE);

check('score null quand le montant manque', sansMontant.score, null);
check('passed null quand le montant manque', sansMontant.passed, null);
check('cause declaree absence', sansMontant.cause, 'absence');
checkTrue(
  'le test se declare non produit',
  !testProduit(sansMontant),
);

console.log('\n=== T2 : le meme dossier avec son montant echoue ===\n');

const avecMontant = runBudgetVsTeamTest(BUDGET_AVEC_MONTANT, EQUIPE_MINCE);

check('le test est produit', testProduit(avecMontant), true);
check('il echoue', avecMontant.passed, false);
check('il rend 50 sur le decalage d ETP', avecMontant.score, 50);
checkTrue(
  'le montant absent aurait donc ameliore la note, ce qui est le defaut corrige',
  avecMontant.score !== null && avecMontant.score < 60,
);

console.log('\n=== T3 : le budget non fleche reste un jugement, pas une absence ===\n');

const nonFleche = runBudgetVsTeamTest(BUDGET_NON_FLECHE, EQUIPE_FOURNIE);

check('le test est produit', testProduit(nonFleche), true);
check('il rend 60 sur l equipe seule', nonFleche.score, 60);
checkTrue(
  'la branche du budget non fleche est distincte de celle du montant absent',
  nonFleche.cause === undefined && sansMontant.cause === 'absence',
);

const nonFlecheEquipeMince = runBudgetVsTeamTest(BUDGET_NON_FLECHE, EQUIPE_MINCE);
check('equipe mince sans budget fleche : 30 en echec', nonFlecheEquipeMince.score, 30);

console.log('\n=== T4 : le motif n affirme rien sur le document ===\n');

// « aucun montant annonce » serait faux d un document qui en porte un
// que l extraction a manque. Le motif dit ce que le pipeline sait.
checkTrue(
  'le motif porte sur l extraction, pas sur le contenu du dossier',
  (sansMontant.causeMotif || '').includes('non extrait'),
);
checkTrue(
  'le motif n affirme pas une absence dans le document',
  !/aucun montant (annonce|dans le)/i.test(sansMontant.causeMotif || ''),
);
checkTrue(
  'l observation nomme la consequence, le test non produit',
  sansMontant.observation.includes('n a pas ete produite'),
);

console.log('\n=== T5 : un test non produit sort de la ponderation ===\n');

// Le point critique. Sortir un test et laisser les poids inchanges
// reviendrait a lui donner zero, ce qui est la meme faute prise par
// l autre bout. La moyenne doit valoir celle des tests restants.
check(
  'deux tests a 80 et un absent rendent 80, pas 53',
  moyennePonderee([
    { valeur: null, poids: 0.30 },
    { valeur: 80, poids: 0.40 },
    { valeur: 80, poids: 0.30 },
  ]),
  80,
);

check(
  'les poids restants sont renormalises et non simplement additionnes',
  moyennePonderee([
    { valeur: null, poids: 0.30 },
    { valeur: 100, poids: 0.40 },
    { valeur: 0, poids: 0.30 },
  ]),
  57, // 100 * 0.40 / 0.70 = 57.1
);

check(
  'aucun test produit rend null, et non un chiffre invente',
  moyennePonderee([
    { valeur: null, poids: 0.30 },
    { valeur: null, poids: 0.40 },
    { valeur: null, poids: 0.30 },
  ]),
  null,
);

check(
  'tous les tests produits : la ponderation d origine est inchangee',
  moyennePonderee([
    { valeur: 30, poids: 0.30 },
    { valeur: 60, poids: 0.40 },
    { valeur: 90, poids: 0.30 },
  ]),
  60, // 9 + 24 + 27 = 60
);

console.log('\n=== T6 : ce qui compte comme test produit ===\n');

const produit: TechClaimTest = {
  score: 70, passed: true, observation: '', implication: '',
};
const nonProduitPanne: TechClaimTest = {
  score: null, passed: null, cause: 'panne', causeMotif: 'appel au modele en echec',
  observation: '', implication: '',
};
// Une analyse persistee sous le contrat anterieur porte un score et
// aucune cause. Elle vaut produit : le champ n existait pas, et son
// absence n est pas une reponse. C est la non-retroactivite des
// contrats appliquee au sens de la lecture.
const heritage: TechClaimTest = {
  score: 45, passed: false, observation: '', implication: '',
};

check('un test avec score et sans cause est produit', testProduit(produit), true);
check('un test en panne n est pas produit', testProduit(nonProduitPanne), false);
check('un test du contrat anterieur est produit', testProduit(heritage), true);
check('null n est pas produit', testProduit(null), false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
