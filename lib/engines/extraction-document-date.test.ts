// ============================================================
// Tests deterministes de la date du document
// ------------------------------------------------------------
// Ce que ces tests prouvent : une date sans citation n est pas une
// date, une precision non donnee n est pas inventee, et la date du
// document ne se confond pas avec l annee du dernier exercice.
//
// Pourquoi ce champ existe : la relecture de la note Braincube du
// 3 aout a etabli que le pipeline ne pouvait pas rapprocher un
// evenement externe de la date du document, faute de connaitre cette
// date. Il savait dater la reception du dossier et le dernier exercice
// realise, jamais la redaction. Un memorandum qui qualifie 2021 de
// realise peut avoir ete ecrit en 2023, et c est precisement l ecart
// qui decide si une levee de novembre 2023 lui est posterieure.
// ============================================================

import { appliquerGardesExtraction } from './extraction-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

function sortie(sur: Record<string, any> = {}): any {
  return { companyName: 'S', sector: '', fundraise: {}, ...sur };
}

console.log('\n[Suite 1] une date sans citation n est pas une date');
{
  const r = appliquerGardesExtraction(sortie({ documentDate: '2023-11', documentDateEvidence: null }));
  check((r as any).documentDate === null, 'date avancee sans citation : refusee');
  check((r as any).documentDateEvidence === null, 'et la citation reste nulle');

  const vide = appliquerGardesExtraction(sortie({ documentDate: '2023-11', documentDateEvidence: '   ' }));
  check((vide as any).documentDate === null, 'citation vide : meme refus');
}

console.log('\n[Suite 2] les trois precisions du document sont acceptees telles quelles');
{
  for (const [d, libelle] of [['2023', 'annee seule'], ['2023-11', 'mois et annee'], ['2023-11-14', 'jour complet']] as const) {
    const r = appliquerGardesExtraction(sortie({ documentDate: d, documentDateEvidence: 'pied de page' }));
    check((r as any).documentDate === d, `${libelle} conservee a l identique (${d})`);
  }
}

console.log('\n[Suite 3] ce qui n est pas une date est refuse');
{
  const cas: Array<[any, string]> = [
    ['mars 2025', 'un libelle en toutes lettres, non normalise'],
    ['2023-11-14T00:00:00Z', 'un horodatage complet'],
    ['1789', 'une annee hors du domaine plausible'],
    ['FY22e', 'un libelle d exercice'],
    ['', 'une chaine vide'],
    [2023, 'un nombre plutot qu une chaine'],
    [null, 'null'],
    [undefined, 'absent'],
  ];
  for (const [v, libelle] of cas) {
    const r = appliquerGardesExtraction(sortie({ documentDate: v, documentDateEvidence: 'citation' }));
    check((r as any).documentDate === null, `${libelle} : refuse`);
  }
}

console.log('\n[Suite 4] la garde du type d operation n a pas bouge');
{
  const lbo = appliquerGardesExtraction(sortie({
    fundraise: { operationType: 'lbo', operationTypeEvidence: 'Provide liquidity to the sponsors' },
  }));
  check(lbo.fundraise!.operationType === 'lbo', 'un type cite reste retenu');
  const sans = appliquerGardesExtraction(sortie({
    fundraise: { operationType: 'lbo', operationTypeEvidence: null, seller: 'X', stakeForSale: '100%' },
  }));
  check(sans.fundraise!.operationType === 'non-etabli', 'un type sans citation retombe a non-etabli');
  check((sans.fundraise as any).seller === '' && (sans.fundraise as any).stakeForSale === '',
    'et les cases propres aux operations non-levee sont videes');
}

console.log('\n[Suite 5] les deux gardes sont independantes');
{
  const r = appliquerGardesExtraction(sortie({
    documentDate: '2023-11', documentDateEvidence: 'March 2023, strictly confidential',
    fundraise: { operationType: 'lbo', operationTypeEvidence: null },
  }));
  check((r as any).documentDate === '2023-11', 'une date citee survit a un type refuse');
  check(r.fundraise!.operationType === 'non-etabli', 'et le type refuse reste refuse');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
