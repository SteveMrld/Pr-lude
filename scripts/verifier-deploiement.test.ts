// Verrou du verdict de deploiement.
//
// Le jeu d essai entre par la porte de la production : il importe les
// deux fonctions que la commande appelle, et ne rejoue leur logique
// nulle part. La liste des cas se derive de ce que le code decide, et
// non de ce qu on avait en tete en l ecrivant : il decide de quel depot
// il parle, quel etat l emporte quand plusieurs environnements
// repondent, et si un silence est un succes. Chaque decision s eprouve
// dans les deux sens, faute de quoi l assertion serait satisfaite par un
// verdict qui rend toujours la meme chose.

import { depotDuRemote, verdictDesEtats } from './verifier-deploiement';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

console.log('\n[Suite 1] le depot se derive du remote, sous ses deux formes');
{
  const ssh = depotDuRemote('git@github.com:SteveMrld/Pr-lude.git');
  check(ssh?.proprietaire === 'SteveMrld' && ssh?.nom === 'Pr-lude', 'forme SSH');
  const https = depotDuRemote('https://github.com/SteveMrld/Pr-lude.git');
  check(https?.proprietaire === 'SteveMrld' && https?.nom === 'Pr-lude', 'forme HTTPS');
  const sansSuffixe = depotDuRemote('https://github.com/SteveMrld/Pr-lude');
  check(sansSuffixe?.nom === 'Pr-lude', 'forme HTTPS sans le suffixe .git');
  // Le second sens : ce qui n est pas un depot GitHub ne doit pas rendre
  // un depot plausible, sans quoi l instrument interrogerait une API qui
  // ne le concerne pas et lirait son 404 comme un silence.
  check(depotDuRemote('git@gitlab.com:x/y.git') === null, 'un remote hors GitHub est refuse');
}

console.log('\n[Suite 2] l etat le plus severe l emporte');
{
  check(verdictDesEtats([{ environnement: 'Production', etat: 'success' }]).issue === 'succes',
    'un succes seul rend vert');
  check(verdictDesEtats([{ environnement: 'Production', etat: 'failure' }]).issue === 'echec',
    'un echec seul rend rouge');
  // Le cas qui decide : deux environnements, un vert un rouge. Prendre
  // le premier rendu par l API laisserait passer un deploiement de
  // production casse sous le vert d une previsualisation.
  const melange = verdictDesEtats([
    { environnement: 'Preview', etat: 'success' },
    { environnement: 'Production', etat: 'failure' },
  ]);
  check(melange.issue === 'echec', 'un echec l emporte sur un succes voisin');
  check(melange.issue === 'echec' && melange.environnement === 'Production',
    'et le verdict nomme l environnement fautif');
  check(verdictDesEtats([
    { environnement: 'Preview', etat: 'success' },
    { environnement: 'Production', etat: 'success' },
  ]).issue === 'succes', 'deux succes restent verts');
  check(verdictDesEtats([{ environnement: 'Production', etat: 'error' }]).issue === 'echec',
    'l etat error compte comme un echec');
}

console.log('\n[Suite 3] un silence n est pas un succes');
{
  const aucun = verdictDesEtats([]);
  check(aucun.issue === 'silence', 'aucun etat rapporte rend un silence et non un vert');
  const enCours = verdictDesEtats([{ environnement: 'Production', etat: 'in_progress' }]);
  check(enCours.issue === 'silence', 'un deploiement en cours rend un silence');
  check(enCours.issue === 'silence' && enCours.raison.includes('in_progress'),
    'et le silence porte la raison qui permet de decider quoi faire');
  check(verdictDesEtats([{ environnement: 'Production', etat: 'queued' }]).issue === 'silence',
    'un deploiement en file rend un silence');
  // Le second sens du meme axe : un etat terminal ne doit jamais se
  // ranger dans le silence, sinon l instrument ne conclurait jamais.
  check(verdictDesEtats([
    { environnement: 'Production', etat: 'queued' },
    { environnement: 'Production', etat: 'success' },
  ]).issue === 'succes', 'un succes parmi des etats en cours conclut');
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
