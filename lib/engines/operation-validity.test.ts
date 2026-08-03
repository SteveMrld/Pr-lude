// ============================================================
// Tests deterministes de la validite de l operation
// ------------------------------------------------------------
// Ce que ces tests prouvent : un evenement posterieur a la date du
// document leve une reserve, la regle est asymetrique par type
// d operation, l ancre declare par quel chemin elle a ete obtenue, et
// la formulation reste une question posee au lecteur.
//
// Le defaut ferme, releve sur la note Braincube du 3 aout 2026 : le
// moteur Equipe avait trouve une levee de 83 M EUR en novembre 2023,
// la note la lisait comme un signal de traction favorable, et le
// memorandum instruit proposait un cash-in de 10 a 15 M EUR avec
// sortie de deux investisseurs. La note avait l information et n en
// tirait rien.
// ============================================================

import {
  evaluerValiditeOperation, detecterEvenementsDansLaProse,
  MARGE_MILLESIME_ANNEES, type EvenementDate,
} from './operation-validity';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// La ligne reelle produite par le moteur Equipe le 3 aout.
const LIGNE_BRAINCUBE =
  "Levée de 83 millions d'euros annoncée en novembre 2023 [web : Usine Nouvelle] : validation externe de la traction par des investisseurs institutionnels, non mentionnée dans le pitch";

console.log('\n[Suite 1] le cas qui a ouvert le module');
{
  const ev = detecterEvenementsDansLaProse([LIGNE_BRAINCUBE]);
  check(ev.length === 1, 'un evenement detecte');
  check(ev[0].nature === 'financement', 'de nature financement');
  check(ev[0].annee === 2023 && ev[0].mois === 11, 'date au mois : novembre 2023');
  check(ev[0].source === 'web : Usine Nouvelle', 'source conservee');
  check(ev[0].luDansLaProse === true, 'et marque comme lu dans la prose');

  const r = evaluerValiditeOperation({
    operationType: 'lbo', documentDate: null, millesimeReference: 2021, evenements: ev,
  });
  check(r.verdict === 'a-verifier', 'la reserve est levee sur le LBO');
  check(r.interditLaDiscussionDePrix === true, 'et elle interdit la discussion de prix');
  check(r.reposeSurDeLaProse === true, 'la sortie declare qu elle repose sur de la prose');
  check(r.mention!.startsWith('Le prix n est pas discute sur ce dossier, et c est une decision.'),
    'la mention ouvre sur la decision et non sur la preuve');
  check(r.mention!.includes('Le reste de la note tient'),
    'elle dit ce que la reserve n invalide pas');
  check(r.mention!.includes('Ce qui leverait la reserve'),
    'elle dit ce qu il faut etablir pour lever la reserve');
  check(r.mention!.indexOf('Sur quoi repose cette reserve') > r.mention!.indexOf('Ce qui leverait'),
    'la provenance vient en dernier et non en argument');
  check(!/lbo|cession-totale|cession-partielle|non-etabli/.test(r.mention!),
    'aucun type technique dans la prose adressee au lecteur');
  check(!r.mention!.includes('validation externe de la traction'),
    'la queue editoriale du moteur d origine est coupee');
  check(!/n existe plus|n existe probablement plus|caduque/i.test(r.mention!),
    'et ne conclut jamais');
}

console.log('\n[Suite 2] la regle est asymetrique par type');
{
  const ev = detecterEvenementsDansLaProse([LIGNE_BRAINCUBE]);
  const base = { documentDate: null, millesimeReference: 2021, evenements: ev };
  const levee = evaluerValiditeOperation({ ...base, operationType: 'levee' });
  check(levee.verdict === 'a-verifier', 'sur une levee la reserve est levee aussi');
  check(levee.interditLaDiscussionDePrix === false,
    'mais elle n interdit pas la discussion de prix');
  check(levee.mention!.includes('le tour decrit a deja ete realise'),
    'et la question porte sur le tour deja realise');
  check(levee.mention!.includes('Le reste de la note tient, fourchette comprise'),
    'sur une levee, la fourchette reste explicitement utilisable');

  for (const t of ['cession-partielle', 'cession-totale', 'lbo'] as const) {
    const r = evaluerValiditeOperation({ ...base, operationType: t });
    check(r.interditLaDiscussionDePrix === true, `${t} : le prix se refuse`);
    check(r.mention!.includes('le vendeur a trouve son financement ailleurs'), `${t} : la raison porte sur le vendeur`);
    check(r.mention!.includes('mandat reste ouvert'), `${t} : le geste attendu est nomme`);
  }
}

console.log('\n[Suite 3] l ancre declare par quel chemin elle vient');
{
  const ev = detecterEvenementsDansLaProse([LIGNE_BRAINCUBE]);
  const lu = evaluerValiditeOperation({
    operationType: 'lbo', documentDate: '2023-06', millesimeReference: 2021, evenements: ev,
  });
  check(lu.ancre?.origine === 'date-du-document', 'la date lue prime sur le repli');
  check(lu.verdict === 'a-verifier', 'juin 2023 precede novembre 2023');

  const apres = evaluerValiditeOperation({
    operationType: 'lbo', documentDate: '2024-06', millesimeReference: 2021, evenements: ev,
  });
  check(apres.verdict === 'aucune-reserve', 'un document de 2024 est posterieur a l evenement');

  const repli = evaluerValiditeOperation({
    operationType: 'lbo', documentDate: null, millesimeReference: 2021, evenements: ev,
  });
  check(repli.ancre?.origine === 'millesime-plus-deux', 'sans date lue, le repli sert');
  check(repli.ancre?.annee === 2021 + MARGE_MILLESIME_ANNEES, 'et vaut le millesime plus deux ans');
  check(repli.ancre!.declaration.includes('prudente et non exacte'),
    'la declaration dit que l ancre reconstituee est prudente');

  // Une annee seule pose l ancre en fin d annee : une precision non
  // donnee ne doit pas produire une severite qu elle ne fonde pas.
  const anneeSeule = evaluerValiditeOperation({
    operationType: 'lbo', documentDate: '2023', millesimeReference: null, evenements: ev,
  });
  check(anneeSeule.ancre?.mois === 12, 'document date a l annee : ancre en decembre');
  check(anneeSeule.verdict === 'aucune-reserve',
    'novembre 2023 ne depasse pas un document date de 2023 sans plus de precision');
}

console.log('\n[Suite 4] ce qui ne produit pas de verdict le declare');
{
  const ev = detecterEvenementsDansLaProse([LIGNE_BRAINCUBE]);
  const sansType = evaluerValiditeOperation({
    operationType: 'non-etabli', documentDate: null, millesimeReference: 2021, evenements: ev,
  });
  check(sansType.verdict === 'non-applicable', 'sans type etabli : pas de verdict');
  check(sansType.cause === 'absence', 'de cause absence');
  check(sansType.mention === null, 'et aucune mention');

  const sansAncre = evaluerValiditeOperation({
    operationType: 'lbo', documentDate: null, millesimeReference: null, evenements: ev,
  });
  check(sansAncre.verdict === 'non-applicable', 'sans ancre : pas de verdict');
  check(sansAncre.cause === 'absence', 'de cause absence');
}

console.log('\n[Suite 5] la detection provisoire, portee et limites');
{
  const detecte = detecterEvenementsDansLaProse([
    'Fondation en 2007 par trois ingenieurs francais confirmee [web : site]',
    'Rachat de la filiale allemande en 2024 [web : presse]',
    'Redressement judiciaire prononce en mars 2025',
    'Nomination de Marie Dupont au poste de CEO en 2024 [web : presse]',
    'Une levee sans annee mentionnee',
    '',
  ]);
  const natures = detecte.map((e) => e.nature).sort();
  check(natures.join(',') === 'changement-de-controle,dirigeant,procedure-collective',
    `trois natures reconnues, la fondation et la levee sans annee sont ecartees (${natures.join(',')})`);
  // La precision exigee depuis le run de gel : un mot de financement ne
  // suffit plus, il faut un evenement. « une levee sans annee » et « la
  // structure de financement est legere » ne sont pas des evenements.
  const bruit = detecterEvenementsDansLaProse([
    'La structure de financement cumulee est legere pour un SaaS fonde en 2007',
    'Braincube est un editeur SaaS en production commerciale eprouvee depuis 2023',
  ]);
  check(bruit.length === 0, `les phrases descriptives ne produisent pas d evenement (obtenu ${bruit.length})`);
  // Et le cas reel du run de gel doit sortir, avec son mois.
  const reel = detecterEvenementsDansLaProse([
    'La levee de 83m€ finalement conclue en novembre 2023 avec Scottish Equity Partners et Bpifrance [web : ladn.eu]',
  ]);
  check(reel.length === 1 && reel[0].annee === 2023 && reel[0].mois === 11,
    `l evenement reel du run de gel est detecte au mois (${JSON.stringify(reel[0] && [reel[0].annee, reel[0].mois])})`);
  check(detecte.every((e) => e.luDansLaProse), 'tout ce qu elle rend est marque comme lu dans la prose');

  // Le faux positif connu et accepte : une donnee de traction prise
  // pour un evenement. Il est attendu a ce niveau de formulation, une
  // question inutile coutant moins qu une operation morte instruite en
  // silence.
  const fauxPositif = detecterEvenementsDansLaProse([
    'Croissance documentee et verifiable : 20M EUR de CA en cinq ans, 54M EUR en 2016 [web : LSA]',
  ]);
  check(fauxPositif.length === 0,
    'une croissance documentee sans marqueur d evenement n est pas retenue');
}

console.log('\n[Suite 6] determinisme');
{
  const ev = detecterEvenementsDansLaProse([LIGNE_BRAINCUBE]);
  const entree = { operationType: 'lbo' as const, documentDate: null, millesimeReference: 2021, evenements: ev };
  check(JSON.stringify(evaluerValiditeOperation(entree)) === JSON.stringify(evaluerValiditeOperation(entree)),
    'deux evaluations rendent exactement la meme sortie');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
