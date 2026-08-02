// ============================================================
// Garde de confidentialite des prompts
// ------------------------------------------------------------
// Ce que ce test empeche : qu un nom de dossier traite par la
// plateforme se retrouve ecrit en dur dans un prompt envoye au modele
// ou dans un message persiste dans la note d un autre dossier.
//
// Le defaut ferme, releve sur la note Braincube du 3 aout 2026 :
// assertion-validator ecrivait « Le pitch UP&CHARGE est en EUR » dans
// un avertissement persiste dans result_json, sur tous les dossiers.
// La recherche qui a suivi en a trouve quatre autres, toutes dans des
// prompts : trois exemples de vendeurs reels dans le prompt
// d extraction, six noms de code de projets reels dans le meme prompt,
// et un cas nomme dans le prompt du moteur Equipe.
//
// La reparation n est pas la correction des occurrences, c est cette
// garde. Elle relit les trente-trois prompts a chaque execution de la
// suite, donc un nom ajoute demain dans un prompt fait echouer la
// suite le jour meme.
//
// Sur la liste ci-dessous, un arbitrage assume : ces noms vivent
// desormais dans ce fichier de test plutot que dans les prompts
// envoyes au modele et dans les notes persistees. Un fichier de test
// n est ni transmis a un tiers ni imprime dans un livrable, ce qui
// n etait le cas d aucun des cinq sites corriges.
// ============================================================

import { collectPromptTexts } from './prompt-registry';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Noms rencontres dans les dossiers traites, et noms de code de
// processus. Aucun ne doit apparaitre dans un prompt.
const NOMS_INTERDITS = [
  'UP&CHARGE', 'Platypus', 'Braincube', 'In Haircare', 'InHairCare', 'OOGarden',
  'Bemersive', 'Crowdaa', 'Ambulife', 'TOLSON', 'Annajah', 'Technicis', 'BlueAi',
  'Humanava', 'EVABOX', 'Pen Group', 'Ytterbium', 'Compagnie des Alpes', 'JNAN',
  'Tratel', 'Redcats', 'Odalys', 'Jabrilia', 'Alliance Marine', 'Bruneau',
  'Project Chamois', 'Project Tagora', 'Projet Babel', 'Project Saturn',
  'Project Triton', 'Project Woodpecker', 'Ciments Calcia',
];

const prompts = collectPromptTexts();

console.log(`\n[Suite 1] aucun nom de dossier dans les ${prompts.length} prompts systeme`);
{
  const fuites: string[] = [];
  for (const p of prompts) {
    for (const nom of NOMS_INTERDITS) {
      if (p.text.includes(nom)) fuites.push(`${p.module}.${p.name} contient « ${nom} »`);
    }
  }
  check(fuites.length === 0, `aucune fuite (trouve : ${fuites.join(' | ') || 'aucune'})`);
}

console.log('\n[Suite 2] la garde discrimine');
{
  // Sans ce controle, une garde qui ne trouve jamais rien serait
  // indiscernable d une garde qui ne cherche pas. C est le corollaire
  // de la discipline de mesure : une mesure sans trou merite la meme
  // verification qu une mesure qui en trouve.
  const faux = { module: 'temoin', name: 'SYSTEM_PROMPT', text: 'Exemple : le pitch UP&CHARGE est en EUR.' };
  const detecte = NOMS_INTERDITS.some((n) => faux.text.includes(n));
  check(detecte, 'un prompt temoin portant un nom interdit est bien detecte');
  check(prompts.length >= 30, `le registre rend bien tous les prompts (${prompts.length})`);
  check(prompts.every((p) => p.text.length > 0), 'aucun prompt vide, la lecture porte sur du texte reel');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
