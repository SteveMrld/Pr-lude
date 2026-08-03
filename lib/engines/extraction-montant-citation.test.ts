// ============================================================
// Tests deterministes du montant et de la valorisation cites
// ------------------------------------------------------------
// Ce que ces tests prouvent : un montant sans citation n est pas un
// montant, une valorisation sans citation n est pas une valorisation,
// et le pipeline sait desormais dire ce qu il a manque sans affirmer
// ce que le document contient.
//
// Pourquoi ces champs existent : amount et valuation sont les deux
// seuls du bloc fundraise dont un nombre est extrait pour entrer dans
// un calcul. Le ticket et la dilution du moteur de valorisation, le
// multiple d entree des benchmarks, le budget tech, le vecteur
// structurel en descendent tous. Ils etaient les deux seuls sans
// citation ni garde, la ou documentDate et operationComponents, dont
// la portee est moindre, en portent une. Une dilution calculee sur un
// montant plausible mais non lu est presentee au partner comme un
// fait negociable.
//
// La cause de lecture repond a l autre moitie du probleme. Un
// document muet et un montant manque par le modele rendaient tous deux
// une chaine vide, et rien en aval ne pouvait les distinguer : d ou le
// motif « aucun montant annonce », qui affirme sur le document ce que
// le pipeline ne peut pas savoir.
//
// Execution : npx tsx lib/engines/extraction-montant-citation.test.ts
// ============================================================

import { appliquerGardesExtraction, SYSTEM_PROMPT } from './extraction-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

function sortie(fundraise: Record<string, any> = {}): any {
  return appliquerGardesExtraction({ companyName: 'S', sector: '', fundraise } as any);
}

console.log('\n[Suite 1] une valeur sans citation est refusee');
{
  const r = sortie({ amount: '4 M€', amountEvidence: null });
  check(r.fundraise.amount === '', 'montant avance sans citation : refuse');
  check(r.fundraise.amountEvidence === null, 'et la citation reste nulle');
  check(r.fundraise.amountCause === 'non-cite', 'la cause dit que le modele a rendu une valeur non citee');

  const espaces = sortie({ amount: '4 M€', amountEvidence: '   ' });
  check(espaces.fundraise.amount === '', 'citation blanche : meme refus');

  const val = sortie({ valuation: '18 M€ pre-money', valuationEvidence: null });
  check(val.fundraise.valuation === '', 'valorisation avancee sans citation : refusee');
  check(val.fundraise.valuationCause === 'non-cite', 'et sa cause est la meme');
}

console.log('\n[Suite 2] une valeur citee passe, et sa citation voyage avec elle');
{
  const r = sortie({
    amount: '4 M€',
    amountEvidence: 'Nous levons 4 M€ en Series A',
    valuation: '18 M€ pre-money',
    valuationEvidence: 'valorisation pre-money de 18 M€',
  });
  check(r.fundraise.amount === '4 M€', 'le montant cite est retenu');
  check(r.fundraise.amountEvidence === 'Nous levons 4 M€ en Series A', 'la citation est conservee');
  check(r.fundraise.amountCause === null, 'aucune cause sur une valeur lue');
  check(r.fundraise.valuation === '18 M€ pre-money', 'la valorisation citee est retenue');
  check(r.fundraise.valuationCause === null, 'aucune cause sur une valorisation lue');
}

console.log('\n[Suite 3] les deux champs sont independants');
{
  // Le cas courant du corpus : le document annonce un montant recherche
  // et tait la valorisation. Refuser l un ne doit pas emporter l autre.
  const r = sortie({
    amount: '4 M€',
    amountEvidence: 'Nous levons 4 M€ en Series A',
    valuation: '',
    valuationEvidence: null,
  });
  check(r.fundraise.amount === '4 M€', 'le montant survit a une valorisation absente');
  check(r.fundraise.valuation === '', 'la valorisation reste vide');
  check(r.fundraise.valuationCause === 'non-rendu', 'et sa cause dit que le modele n a rien rendu');
}

console.log('\n[Suite 4] la cause separe ce que le modele n a pas rendu de ce qu il n a pas cite');
{
  // C est tout l objet du champ. Ni l une ni l autre des deux valeurs
  // ne dit que le document est muet, ce que le pipeline n a aucun moyen
  // de savoir. Elles disent ce qui s est passe a la lecture.
  const rien = sortie({});
  check(rien.fundraise.amountCause === 'non-rendu', 'aucune valeur rendue : non-rendu');

  const nonCite = sortie({ amount: '4 M€' });
  check(nonCite.fundraise.amountCause === 'non-cite', 'valeur rendue sans citation : non-cite');

  check(
    rien.fundraise.amountCause !== nonCite.fundraise.amountCause,
    'les deux situations ne sortent plus par le meme canal',
  );

  // Un montant fait de blancs n est pas un montant rendu.
  const blanc = sortie({ amount: '   ', amountEvidence: 'une citation' });
  check(blanc.fundraise.amount === '', 'montant blanc : refuse');
  check(blanc.fundraise.amountCause === 'non-rendu', 'et compte comme non rendu');
}

console.log('\n[Suite 5] la citation est bornee comme les autres');
{
  const longue = 'x'.repeat(400);
  const r = sortie({ amount: '4 M€', amountEvidence: longue });
  check(r.fundraise.amountEvidence?.length === 200, 'citation tronquee a 200 caracteres');
  check(r.fundraise.amount === '4 M€', 'et le montant reste retenu');
}

console.log('\n[Suite 6] le prompt demande la citation et interdit la deduction');
{
  check(SYSTEM_PROMPT.includes('"amountEvidence"'), 'amountEvidence figure au format de sortie');
  check(SYSTEM_PROMPT.includes('"valuationEvidence"'), 'valuationEvidence aussi');
  check(
    /valorisation d'un montant et d'un pourcentage/i.test(SYSTEM_PROMPT),
    'le prompt interdit de deduire la valorisation du montant et du pourcentage',
  );
  check(
    /citation est une reprise du document/i.test(SYSTEM_PROMPT),
    'et il dit ce qu est une citation, pour que la garde ne soit pas la seule a le savoir',
  );
}

console.log(`\n${pass} OK, ${fail} KO\n`);
process.exit(fail > 0 ? 1 : 0);
