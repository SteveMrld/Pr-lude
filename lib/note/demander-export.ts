// ============================================================
// DEMANDER L EXPORT PDF, ET REFUSER CE QUI N EN EST PAS UN
// ------------------------------------------------------------
// Les deux sites d appel de la route d export, la note et le pack IC,
// testaient `res.ok` puis prenaient le corps en `blob`. Les deux
// gestes sont justes separement et faux ensemble des lors qu une
// couche transverse peut repondre a la place de la route.
//
// LE RELEVE QUI L ETABLIT, du 8 aout 2026, sur la production. Un POST
// sans session sur `/api/export-pdf` rendait 200, `text/html`, treize
// mille octets commencant par `<!DO`, apres une redirection vers
// `/login`. `fetch` suit les redirections par defaut et `/login` est un
// chemin public : `res.ok` valait donc vrai, et le client ecrivait la
// page de connexion sur le disque sous le nom `prelude-<societe>.pdf`.
// Un `blob` accepte n importe quels octets, la ou les seize autres
// sites d appel du client lisent du JSON et levent bruyamment sur la
// meme page.
//
// POURQUOI DEUX GARDES ET NON UNE. Le middleware rend desormais 401 sur
// tout chemin d API, ce qui ferme la cause connue pour les quarante-six
// routes d un coup. Cette garde-ci ferme l effet, et elle attrape ce que
// la premiere ne voit pas : un proxy, une protection de deploiement, un
// portail reseau ou une page d erreur d hebergeur peuvent repondre a la
// place de la route sans passer par le middleware. La premiere se
// prononce sur la cause et ne peut rien dire d une interception posee
// hors de l application ; la seconde se prononce sur l objet et ne dit
// pas pourquoi.
//
// CE QU ELLE NE COUVRE PAS. Elle etablit que la reponse est un PDF, pas
// qu il est le bon : un document vide, tronque ou sans les fontes
// attendues la passe. C est le role de la sonde des familles imprimees
// et des captures, qui lisent le document et non son entete.
// ============================================================

export const CHEMIN_EXPORT_PDF = '/api/export-pdf';

/** Les octets par lesquels tout PDF commence, quelle que soit sa version. */
export const SIGNATURE_PDF = '%PDF';

export type EntreeExport = {
  html: string;
  css?: string;
  title: string;
  fileName: string;
};

/**
 * L issue porte tous ses champs plutot que de se decliner en deux formes.
 *
 * La premiere ecriture etait une union discriminee, `{ok: true, blob}` ou
 * `{ok: false, statut, raison}`, qui est la forme juste dans l absolu et
 * ne compile pas ici : le depot est en `strict: false`, donc
 * `strictNullChecks` est absent, et le retrecissement par un discriminant
 * booleen n a pas lieu. Les consommateurs auraient du caster a chaque
 * lecture, c est-a-dire desarmer le compilateur a l endroit meme ou cette
 * garde est censee le faire parler. Une forme unique dont tous les champs
 * existent dit donc la meme chose sans rien desarmer, au prix d un `null`
 * que l appelant lit apres avoir teste `ok`.
 */
export type IssueExport = {
  ok: boolean;
  blob: Blob | null;
  statut: number | null;
  raison: string | null;
};

/**
 * Le verdict sur une reponse, hors de tout appel reseau.
 *
 * Il est separe de la demande pour pouvoir etre eprouve sur les formes
 * qui nous ont mordus, notamment celle qui rend 200 sans etre un
 * document. Les trois cas ne se confondent pas : un refus d acces
 * demande de se reconnecter, une interception demande de regarder ce qui
 * repond a la place de la route, une panne de la route demande de lire
 * son detail.
 */
export function diagnostiquerReponse(
  statut: number,
  redirige: boolean,
  typeContenu: string | null,
  debut: string,
): { ok: boolean; raison?: string } {
  if (statut === 401 || statut === 403) {
    return { ok: false, raison: 'session absente ou expiree' };
  }
  // Une redirection n est jamais une reponse a une demande d export. Elle
  // se refuse ici plutot que de se suivre, parce que sa destination
  // repond d ordinaire 200 et rendrait l interception indiscernable d un
  // succes.
  if (redirige || (statut >= 300 && statut < 400)) {
    return { ok: false, raison: `redirection (${statut}) au lieu du document` };
  }
  if (statut < 200 || statut >= 300) {
    return { ok: false, raison: `HTTP ${statut}` };
  }
  // LE CAS QUI DECIDE, ET IL EST DANS LES 200. Le statut ne suffit pas :
  // ce qui distingue un export d une page servie a sa place est la nature
  // des octets, et elle se lit sur le document plutot que sur l entete,
  // qu un intermediaire peut poser a sa guise.
  if (!debut.startsWith(SIGNATURE_PDF)) {
    const nature = typeContenu ? ` (${typeContenu})` : '';
    return {
      ok: false,
      raison: `la reponse rend 200 sans etre un PDF${nature}, quelque chose repond a la place de la route`,
    };
  }
  return { ok: true };
}

/**
 * Demande le PDF a la route d export et ne rend un blob que si c en est
 * un. Ne leve pas : l appelant decide quoi faire d un echec, et les deux
 * appelants n en font pas la meme chose.
 */
export async function demanderExportPdf(
  entree: EntreeExport,
  fetchImpl: typeof fetch = fetch,
): Promise<IssueExport> {
  let res: Response;
  try {
    res = await fetchImpl(CHEMIN_EXPORT_PDF, {
      method: 'POST',
      // La redirection ne se suit pas : c est ce qui rendait une
      // interception indiscernable d un succes.
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entree),
    });
  } catch (e: any) {
    return { ok: false, blob: null, statut: null, raison: e?.message || 'reseau indisponible' };
  }

  // `redirect: 'manual'` rend un type `opaqueredirect` de statut 0 dans
  // le navigateur, et la reponse 3xx elle-meme ailleurs. Les deux disent
  // la meme chose et se traitent ensemble.
  const redirige = res.type === 'opaqueredirect' || res.status === 0;

  const blob = redirige ? null : await res.blob().catch(() => null);
  const debut = blob ? await blob.slice(0, 4).text().catch(() => '') : '';

  const verdict = diagnostiquerReponse(
    res.status,
    redirige,
    res.headers.get('content-type'),
    debut,
  );
  if (!verdict.ok || !blob) {
    return {
      ok: false,
      blob: null,
      statut: redirige ? null : res.status,
      raison: verdict.raison || 'reponse illisible',
    };
  }
  return { ok: true, blob, statut: res.status, raison: null };
}
