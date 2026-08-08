// Verrou de la garde d export.
//
// Le jeu d essai entre par la porte de la production : il importe le
// diagnostic que la commande appelle et la fonction de demande
// elle-meme, a laquelle il passe un `fetch` de substitution. Rien n est
// rejoue ici.
//
// La liste des cas se derive des axes que le code decide, et non des
// trois formes qu on avait en tete : il decide si le refus est un refus
// d acces, si la reponse est une redirection, si le statut est bon, et
// si les octets sont ceux d un PDF. Quatre decisions, donc quatre
// mutations, et chacune dans les deux sens. Le premier sens prouve qu il
// voit, le second qu il discrimine : une garde qui refuse tout rend le
// meme service qu une garde qui ne refuse rien.

import {
  diagnostiquerReponse,
  demanderExportPdf,
  SIGNATURE_PDF,
  CHEMIN_EXPORT_PDF,
} from './demander-export';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

const PDF = '%PDF';
const HTML = '<!DO';

console.log('\n[Suite 1] le cas qui a mordu : 200, en HTML, apres une redirection');
{
  // LE RELEVE DU 8 AOUT 2026 SUR LA PRODUCTION, tel quel. Sans cette
  // assertion, la garde entiere n a pas de raison d exister.
  const v = diagnostiquerReponse(200, false, 'text/html; charset=utf-8', HTML);
  check(!v.ok, 'une reponse 200 en HTML est refusee');
  check(!!v.raison && v.raison.includes('sans etre un PDF'), 'et la raison nomme ce qui cloche');
  // Le second sens du meme axe : un vrai PDF en 200 doit passer, sinon
  // la garde refuserait tout et personne n exporterait plus rien.
  check(diagnostiquerReponse(200, false, 'application/pdf', PDF).ok, 'un vrai PDF en 200 passe');
}

console.log('\n[Suite 2] la redirection ne se lit pas comme un document');
{
  check(!diagnostiquerReponse(307, false, null, '').ok, 'un 307 est refuse');
  check(!diagnostiquerReponse(302, false, null, '').ok, 'un 302 est refuse');
  // Le navigateur ne rend pas le statut : sous `redirect: manual` il
  // rend un type opaque de statut 0, et les deux formes doivent se
  // traiter ensemble sous peine de ne fermer que le cas hors navigateur.
  const opaque = diagnostiquerReponse(0, true, null, '');
  check(!opaque.ok, 'une redirection opaque de statut 0 est refusee');
  check(!!opaque.raison && opaque.raison.includes('redirection'), 'et elle se nomme comme une redirection');
  // Le second sens : un 200 non redirige portant un PDF ne doit pas
  // tomber dans cette branche.
  check(diagnostiquerReponse(200, false, 'application/pdf', PDF).ok, 'un document non redirige passe');
}

console.log('\n[Suite 3] le refus d acces se distingue de la panne');
{
  const v401 = diagnostiquerReponse(401, false, 'application/json', '{"e"');
  check(!v401.ok, 'un 401 est refuse');
  check(!!v401.raison && v401.raison.includes('session'), 'et la raison parle de session, pas de panne');
  const v403 = diagnostiquerReponse(403, false, 'application/json', '{"e"');
  check(!!v403.raison && v403.raison.includes('session'), 'un 403 dit la meme chose');
  // Le second sens : une panne de la route ne doit pas se lire comme un
  // probleme de session, sinon on ferait reconnecter le partner pour un
  // Chromium tombe.
  const v500 = diagnostiquerReponse(500, false, 'application/json', '{"e"');
  check(!v500.ok && !!v500.raison && !v500.raison.includes('session'), 'un 500 ne parle pas de session');
}

console.log('\n[Suite 4] la signature se lit sur les octets et non sur l entete');
{
  check(SIGNATURE_PDF === '%PDF', 'la signature est celle de tout PDF');
  // Un intermediaire peut poser l entete qu il veut. Ce qui tranche est
  // le debut du document, et les deux sens le prouvent : un entete
  // menteur ne sauve pas des octets HTML, et des octets de PDF passent
  // meme sans entete.
  check(
    !diagnostiquerReponse(200, false, 'application/pdf', HTML).ok,
    'un entete application/pdf ne sauve pas des octets HTML',
  );
  check(
    diagnostiquerReponse(200, false, null, PDF).ok,
    'des octets de PDF passent sans entete de type',
  );
}

console.log('\n[Suite 5] la demande complete, par la porte de la production');
{
  const fauxFetch = (statut: number, type: string, corps: string, typeReponse?: string) =>
    (async () => {
      const blob = new Blob([corps], { type });
      return {
        status: statut,
        type: typeReponse || 'basic',
        headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? type : null) },
        blob: async () => blob,
      } as any;
    }) as unknown as typeof fetch;

  (async () => {
    const bon = await demanderExportPdf(
      { html: '<p>x</p>', title: 't', fileName: 't.pdf' },
      fauxFetch(200, 'application/pdf', '%PDF-1.4 ...'),
    );
    check(bon.ok && bon.blob !== null, 'un PDF rend un blob');
    check(bon.raison === null, 'et aucune raison');

    const page = await demanderExportPdf(
      { html: '<p>x</p>', title: 't', fileName: 't.pdf' },
      fauxFetch(200, 'text/html; charset=utf-8', '<!DOCTYPE html><html>...'),
    );
    check(!page.ok, 'la page de connexion en 200 ne rend pas de blob');
    check(page.blob === null, 'et le blob est nul plutot que la page');

    const coupe = await demanderExportPdf(
      { html: '<p>x</p>', title: 't', fileName: 't.pdf' },
      (async () => { throw new Error('reseau coupe'); }) as unknown as typeof fetch,
    );
    check(!coupe.ok && coupe.statut === null, 'une coupure reseau rend un echec sans statut');
    check(coupe.raison === 'reseau coupe', 'et conserve la cause');

    check(CHEMIN_EXPORT_PDF === '/api/export-pdf', 'le chemin vit a un seul endroit');

    console.log(`\n${pass} pass, ${fail} fail`);
    if (fail > 0) process.exit(1);
  })();
}
