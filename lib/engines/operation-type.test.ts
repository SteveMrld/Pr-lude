// ============================================================
// Tests deterministes du contrat de type d operation
// ------------------------------------------------------------
// Ce que ces tests prouvent : la garde d extraction reelle ne laisse
// jamais passer une composante sans citation, elle vide les cases
// propres aux operations non-levee quand aucune composante n est
// etablie, elle ignore le type que le modele rendrait de lui-meme, et
// le prompt enonce les marqueurs de cession par leur forme.
//
// Le defaut ferme a l origine : le contrat d extraction ne connaissait
// que la levee. Les quatorze dossiers growth du corpus sont des
// memorandums de cession et de LBO, et le modele rangeait ce qu il
// lisait dans les cases disponibles : le perimetre cede dans amount,
// le conseil vendeur dans leadInvestor.
//
// Deux reecritures depuis, toutes deux le 3 aout 2026, toutes deux
// visibles ici et nulle part ailleurs.
//
// La premiere est bb4e8fb, le passage aux composantes : le type n est
// plus lu du modele, il est derive de composantes citees une a une.
// Ce fichier portait sa propre copie de la garde d avant, sous le
// pretexte que le moteur ne l exposait pas. Le moteur l exposait depuis
// bb4e8fb sous le nom appliquerGardesExtraction, et quatorze assertions
// sont restees vertes en verifiant que cette copie s accordait avec
// elle-meme, sur une logique que le moteur n executait plus. Les suites
// 1 et 2 appellent desormais le moteur.
//
// La seconde est 2177651, le retrait des noms de dossiers reels des
// prompts. Ce fichier exigeait que le prompt nomme « Project Chamois »
// et « Compagnie des Alpes », le nettoyage les a remplaces par la regle
// qui les produisait, et deux assertions sont passees au rouge. La
// contradiction etait reelle et le test avait raison de la signaler :
// deux gardes se disputaient le meme texte. Elle se tranche en faveur
// de la confidentialite, et ce qui se verifie ici est desormais la
// forme du marqueur et non le nom du dossier ou il a ete lu. La liste
// des noms interdits vit dans lib/instrumentation/prompt-confidentialite.
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import { appliquerGardesExtraction } from './extraction-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const SRC = readFileSync(join(__dirname, 'extraction-engine.ts'), 'utf8');

/**
 * Passe un objet fundraise a la garde reelle du moteur et rend le
 * fundraise garde. Aucune logique n est rejouee ici : le sujet du test
 * est ce que le moteur fait, pas ce qu on croit qu il fait.
 */
function garder(fundraise: any): any {
  const r: any = appliquerGardesExtraction({ companyName: 'T', sector: '', fundraise } as any);
  return r.fundraise;
}

// ============================================================
console.log('\n[Suite 1] aucune composante sans citation, aucun type sans composante');
// ============================================================

{
  const sansPreuve = garder({ operationComponents: [{ kind: 'cession', evidence: null }] });
  check(sansPreuve.operationType === 'non-etabli', 'composante sans citation : refusee, type non-etabli');
  check(sansPreuve.operationTypeEvidence === null, 'et la citation derivee reste nulle');
  check(sansPreuve.operationComponents.length === 0, 'la composante ne survit pas');

  const citationVide = garder({ operationComponents: [{ kind: 'dette', evidence: '   ' }] });
  check(citationVide.operationType === 'non-etabli', 'citation blanche : refusee');

  // La citation porte une valeur qu aucune autre source du jeu d essai
  // ne fournit, sans quoi on ne saurait pas d ou vient celle qu on lit.
  const avecPreuve = garder({
    operationComponents: [{ kind: 'cession', evidence: '  mandate pour la cession de six parcs, perimetre XJ-4417  ', perimetre: '100%' }],
  });
  check(avecPreuve.operationType === 'cession-totale', 'composante citee : retenue et derivee');
  check(
    avecPreuve.operationTypeEvidence === 'mandate pour la cession de six parcs, perimetre XJ-4417',
    'la citation est conservee, espaces de bord retires',
  );
}

{
  // Une nature hors enumeration ne passe pas, meme accompagnee d une
  // citation : le contrat est ferme, pas permissif.
  const horsEnum = garder({ operationComponents: [{ kind: 'acquisition', evidence: 'texte du document' }] });
  check(horsEnum.operationType === 'non-etabli', 'nature de composante hors enumeration : refusee');

  // Depuis bb4e8fb le type n est plus une valeur du modele. Il est
  // derive, et ce que le modele en dirait est sans effet. Sans cette
  // assertion, un modele qui recommencerait a le rendre repasserait
  // silencieusement en source de verite.
  const typeSouffle = garder({
    operationType: 'cession-totale',
    operationTypeEvidence: 'ce que le modele aurait voulu dire',
    operationComponents: [],
  });
  check(typeSouffle.operationType === 'non-etabli', 'un type rendu par le modele sans composante est ignore');
  check(typeSouffle.operationTypeEvidence === null, 'et sa citation avec lui');

  // Le type attendu n est ni celui que le modele a souffle, ni celui
  // que la composante rendrait sur un autre perimetre : sans mention de
  // totalite, une cession est partielle. L ecart aux deux cotes est ce
  // qui rend l assertion discriminante.
  const typeContredit = garder({
    operationType: 'levee',
    operationComponents: [{ kind: 'cession', evidence: 'sortie du sponsor, dossier QN-8802' }],
  });
  check(typeContredit.operationType === 'cession-partielle', 'le type derive prime sur le type souffle par le modele');
}

// ============================================================
console.log('\n[Suite 2] sans composante etablie, aucune case non-levee remplie');
// ============================================================

{
  // Les trois cases ne peuvent porter qu une inference quand aucune
  // composante n est etablie. On les vide plutot que de les laisser
  // remplies sur une base qu on vient de refuser.
  const r = garder({
    operationComponents: [{ kind: 'cession', evidence: '' }],
    seller: 'le groupe cedant du dossier ZR-1190',
    stakeForSale: '100%',
    sellSideAdvisor: 'la banque mandatee ZR-1190',
  });
  check(r.seller === '', 'seller vide');
  check(r.stakeForSale === '', 'stakeForSale vide');
  check(r.sellSideAdvisor === '', 'sellSideAdvisor vide');
}

{
  // A l inverse, une composante etablie conserve les trois cases.
  const r = garder({
    operationComponents: [{ kind: 'cession', evidence: 'cession a 100% des deux marques, dossier ZR-1190' }],
    seller: 'le groupe cedant du dossier ZR-1190',
    stakeForSale: '100%',
    sellSideAdvisor: 'la banque mandatee ZR-1190',
  });
  check(r.seller === 'le groupe cedant du dossier ZR-1190', 'seller conserve');
  check(r.stakeForSale === '100%', 'stakeForSale conserve');
  check(r.sellSideAdvisor === 'la banque mandatee ZR-1190', 'sellSideAdvisor conserve');
}

// ============================================================
console.log('\n[Suite 3] le prompt porte la regle et la forme des marqueurs');
// ============================================================

{
  check(SRC.includes('"operationType"'), 'le format JSON demande operationType');
  check(SRC.includes('"operationTypeEvidence"'), 'et sa citation');
  check(SRC.includes('"operationComponents"'), 'et les composantes');
  check(/RÈGLES TYPE D'OPÉRATION/.test(SRC), 'la section de regles existe');
  check(/ANTI-DIVINATION/.test(SRC), 'la regle anti-divination est enoncee');
  check(
    /dérivé des composantes, ne le renseigne pas toi-même/.test(SRC),
    'le prompt dit au modele de ne pas renseigner le type',
  );

  // Les cinq valeurs restent decrites, parce que le type derive garde
  // ses consommateurs non migres.
  for (const v of ['levee', 'cession-partielle', 'cession-totale', 'lbo', 'non-etabli']) {
    check(SRC.includes(`"${v}"`), `la valeur ${v} est proposee`);
  }
  for (const k of ['cash-in', 'cession', 'dette']) {
    check(SRC.includes(`'${k}'`), `la composante ${k} est proposee`);
  }

  // Les marqueurs sont ceux lus dans le corpus, enonces par leur forme
  // et non par le nom du dossier ou ils ont ete lus. Ce qui se verifie
  // est donc la forme, qui couvre les cas observes et les suivants.
  const MARQUEURS: Array<[string, RegExp]> = [
    ['le type de document', /mémorandum d'information|information memorandum/],
    ['le nom de code de projet, par sa regle de formation', /"Project" ou "Projet" suivi d'un nom d'animal/],
    ['la banque mandatee cote vendeur', /une banque d'affaires est mandatée côté vendeur/],
    ['le vendeur distinct de la societe', /le vendeur est nommé et distinct de la société/],
    ['le vocabulaire de sortie', /carve-out/],
    ['le pourcentage cede plutot que le montant recherche', /pourcentage de capital cédé plutôt qu'un montant recherché/],
  ];
  for (const [libelle, forme] of MARQUEURS) {
    check(forme.test(SRC), `le marqueur mesure porte ${libelle}`);
  }
}

{
  // Les libelles des champs existants ne presupposent plus la levee.
  check(
    !/"amount": "montant levé ou recherché"/.test(SRC),
    'amount ne se decrit plus comme un montant leve ou recherche seul',
  );
  check(
    /"amount": "montant de l'opération, dont la nature dépend du type/.test(SRC),
    'amount se decrit par le type d operation',
  );
  check(
    /"valuation": "valorisation telle que le document la présente, dont la nature dépend du type/.test(SRC),
    'valuation aussi',
  );
  // Le stade garde son enumeration : un stade reste un stade sur une
  // cession, ce que la mesure du brief 24 a etabli.
  check(SRC.includes("'series-A-early'") && SRC.includes("'growth'"), 'le stade garde son enumeration');
  check(
    /Un stade reste un stade quelle que soit l'opération/.test(SRC),
    'et le prompt le dit explicitement',
  );
}

{
  // La garde vit dans le moteur et non dans ce fichier. L assertion
  // porte sur la forme actuelle, celle qui derive le type des
  // composantes : sans elle, le contrat serait declaratif.
  check(
    /const derive = deriverTypeDepuisComposantes\(fr\.operationComponents\);/.test(SRC),
    'la garde derive le type des composantes dans le moteur',
  );
  check(
    /fr\.seller = '';/.test(SRC),
    'et elle vide les cases non-levee quand aucune composante n est etablie',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
