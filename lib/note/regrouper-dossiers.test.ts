// Verrou du regroupement en dossiers.
//
// La liste des cas se derive de ce que la fonction decide : quelle clef
// porte une ligne, quel run passe en tete, combien de reprises se
// replient, et si le verdict a bouge. Chaque axe dans les deux sens,
// parce qu un regroupement qui fond tout et un regroupement qui ne
// groupe rien rendent le meme service.

import { regrouperParDossier, type LectureRun } from './regrouper-dossiers';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

type Run = LectureRun;
const lire = (r: Run) => r;
const run = (o: Partial<Run> & { id: string }): Run => ({
  companyName: null, sourceFilename: null, createdAt: null, verdict: null, ...o,
});

console.log('\n[Suite 1] les executions d une meme societe font un dossier');
{
  const g = regrouperParDossier([
    run({ id: 'a', companyName: 'In Haircare', createdAt: '2026-08-01T10:00:00Z', verdict: 'approfondir' }),
    run({ id: 'b', companyName: 'In Haircare', createdAt: '2026-08-03T10:00:00Z', verdict: 'approfondir' }),
    run({ id: 'c', companyName: 'In Haircare', createdAt: '2026-08-02T10:00:00Z', verdict: 'approfondir' }),
  ], lire);
  check(g.length === 1, 'trois executions d une societe font un seul dossier');
  check(g[0].runs.length === 3, 'qui porte ses trois instructions');
  check(g[0].reprises === 2, 'et compte deux reprises sous sa tete');
  // LE RUN LE PLUS RECENT SE LIT EN TETE. L ordre d arrivee ne le decide
  // pas : ici le plus recent est le deuxieme de la liste d entree.
  check(g[0].tete.id === 'b', 'le run le plus recent passe en tete');
  check(g[0].runs[2].id === 'a', 'et le plus ancien tombe au fond du repli');
}

console.log('\n[Suite 2] aucun rapprochement ne se devine');
{
  // Les deux paires du corpus qui se ressemblent et qui doivent rester
  // separees. Les fondre demanderait de decider qu une parenthese ou une
  // lettre ne comptent pas, ce qu aucune donnee ne fonde.
  const g = regrouperParDossier([
    run({ id: 'a', companyName: 'Bemersive', createdAt: '2026-08-01T10:00:00Z' }),
    run({ id: 'b', companyName: 'Bemersive (EVABOX)', createdAt: '2026-08-02T10:00:00Z' }),
    run({ id: 'c', companyName: 'Compagnie des Alpes - Portefeuille de 6 parcs (Project Chamois)', createdAt: '2026-08-03T10:00:00Z' }),
    run({ id: 'd', companyName: 'Compagnie des Alpes - Portefeuille de 6 parcs (Projet Chamois)', createdAt: '2026-08-04T10:00:00Z' }),
  ], lire);
  check(g.length === 4, 'quatre noms voisins font quatre dossiers et non deux');
  // Le second sens de l axe : ce qui EST le meme nom doit se grouper,
  // sinon la garde serait satisfaite par un regroupement qui ne groupe
  // jamais rien.
  const memes = regrouperParDossier([
    run({ id: 'a', companyName: 'Braincube', createdAt: '2026-08-01T10:00:00Z' }),
    run({ id: 'b', companyName: 'braincube', createdAt: '2026-08-02T10:00:00Z' }),
  ], lire);
  check(memes.length === 1, 'la casse seule ne separe pas deux lignes du meme nom');
  // Le suffixe de forme juridique se retire, donc il ne separe pas non
  // plus : c est la seule normalisation admise, et elle se derive du
  // texte.
  const forme = regrouperParDossier([
    run({ id: 'a', companyName: 'OOGarden SAS', createdAt: '2026-08-01T10:00:00Z' }),
    run({ id: 'b', companyName: 'OOGarden', createdAt: '2026-08-02T10:00:00Z' }),
  ], lire);
  check(forme.length === 1, 'un suffixe de forme juridique ne separe pas deux lignes du meme dossier');
  check(forme[0].nom === 'OOGarden', 'et le groupe porte le nom d usage');
}

console.log('\n[Suite 3] une ligne sans nom reste seule');
{
  const g = regrouperParDossier([
    run({ id: 'a', companyName: '(analyse en cours)', sourceFilename: 'memo.pdf', createdAt: '2026-08-01T10:00:00Z' }),
    run({ id: 'b', companyName: '(analyse en cours)', sourceFilename: 'memo.pdf', createdAt: '2026-08-02T10:00:00Z' }),
  ], lire);
  // LE CAS QUI DECIDE. Deux lignes sans nom portant le meme fichier ne
  // sont pas le meme dossier : rien ne le dit, et les fondre affirmerait
  // une identite que personne n a etablie.
  check(g.length === 2, 'deux lignes sans nom restent deux dossiers, meme fichier identique');
  check(g.every(x => !x.nomEtabli), 'et chacune declare que son nom n est pas etabli');
  check(g.every(x => x.reprises === 0), 'aucune ne porte de reprise');
  // Le second sens : une ligne nommee ne doit pas se declarer sans nom,
  // sinon la mention serait partout et ne dirait rien.
  const nommee = regrouperParDossier([run({ id: 'z', companyName: 'Liik', createdAt: '2026-08-01T10:00:00Z' })], lire);
  check(nommee[0].nomEtabli, 'une ligne nommee ne se declare pas sans nom');
}

console.log('\n[Suite 4] le verdict qui bouge se signale sans deplier');
{
  const bouge = regrouperParDossier([
    run({ id: 'a', companyName: 'Hello Planet', createdAt: '2026-08-01T10:00:00Z', verdict: 'approfondir' }),
    run({ id: 'b', companyName: 'Hello Planet', createdAt: '2026-08-02T10:00:00Z', verdict: 'refuser' }),
  ], lire);
  check(bouge[0].verdictABouge, 'deux verdicts differents se signalent');
  // Le second sens : un dossier rejoue sans changer d avis ne doit rien
  // signaler, faute de quoi la mention serait sur tous les dossiers
  // rejoues et ne distinguerait plus rien.
  const stable = regrouperParDossier([
    run({ id: 'a', companyName: 'Hello Planet', createdAt: '2026-08-01T10:00:00Z', verdict: 'refuser' }),
    run({ id: 'b', companyName: 'Hello Planet', createdAt: '2026-08-02T10:00:00Z', verdict: 'refuser' }),
  ], lire);
  check(!stable[0].verdictABouge, 'deux verdicts identiques ne signalent rien');
  // Un verdict absent ne compte pas comme une variation : sinon un run
  // tombe, qui n a pas de verdict, ferait croire que l avis a change.
  const avecAbsent = regrouperParDossier([
    run({ id: 'a', companyName: 'Hello Planet', createdAt: '2026-08-01T10:00:00Z', verdict: 'refuser' }),
    run({ id: 'b', companyName: 'Hello Planet', createdAt: '2026-08-02T10:00:00Z', verdict: null }),
  ], lire);
  check(!avecAbsent[0].verdictABouge, 'un verdict absent ne se lit pas comme un changement d avis');
}

console.log('\n[Suite 5] l ordre des dossiers suit celui de leur tete');
{
  const g = regrouperParDossier([
    run({ id: 'vieux', companyName: 'Ancien', createdAt: '2026-07-01T10:00:00Z' }),
    run({ id: 'neuf', companyName: 'Recent', createdAt: '2026-08-05T10:00:00Z' }),
    run({ id: 'vieux2', companyName: 'Ancien', createdAt: '2026-07-02T10:00:00Z' }),
  ], lire);
  check(g[0].nom === 'Recent', 'le dossier le plus recemment instruit vient en premier');
  check(g[1].nom === 'Ancien', 'et l autre suit');
  // Une date illisible ne doit pas remonter en tete par accident.
  const sansDate = regrouperParDossier([
    run({ id: 'a', companyName: 'X', createdAt: 'pas une date' }),
    run({ id: 'b', companyName: 'X', createdAt: '2026-08-01T10:00:00Z' }),
  ], lire);
  check(sansDate[0].tete.id === 'b', 'une date illisible ne prend pas la tete');
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
