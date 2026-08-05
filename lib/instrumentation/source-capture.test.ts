// ============================================================
// Tests deterministes de la capture des sources web
// ------------------------------------------------------------
// Ce que ces tests prouvent : une reponse portant des pages atteintes
// rend une capture avec adresse, titre, date de consultation et extrait
// cite ; une URL ecrite dans la prose n en rend aucune ; la portee est
// le run ; et le controle voit la faute quand on la lui donne.
//
// CE QU ILS NE PROUVENT PAS, ET IL FAUT LE DIRE
//
// Les jeux d essai portent la forme de reponse que la plateforme est
// censee rendre, lue dans sa documentation. Ils n etablissent pas que
// la reponse reelle a cette forme : ce point ne se tranche que sur un
// run avec recherche active, en lisant meta.sourceCapture. La lecture
// est structurelle plutot que nominale precisement pour que l ecart, si
// ecart il y a, porte sur des noms de champs et non sur des noms de
// blocs : `url`, `title` et `cited_text` sont les trois seuls noms dont
// la capture depend.
//
// Execution : npx tsx lib/instrumentation/source-capture.test.ts
// ============================================================

import {
  withSourceCapture,
  recordWebSources,
  readSourceCapture,
  captureEstOuverte,
  aucunePageAtteinte,
} from './source-capture';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const PROMPT = 'Tu es un analyste. Instruis le dossier.';

async function main() {

/**
 * Forme de reponse avec recherche : un bloc de resultats d outil, puis
 * un bloc de texte dont une portion est rattachee a une page.
 *
 * Les valeurs sont discriminantes : le titre du resultat d outil et le
 * titre de la citation different, l extrait n existe que du cote
 * citation, et la troisieme page n est portee que par la citation. Un
 * jeu ou les deux cotes porteraient la meme chose mesurerait leur
 * identite et non la lecture.
 */
const REPONSE_AVEC_RECHERCHE = [
  {
    type: 'server_tool_use',
    id: 'srvtoolu_01',
    name: 'web_search',
    input: { query: 'benchmarks croissance saas 2024' },
  },
  {
    type: 'web_search_tool_result',
    tool_use_id: 'srvtoolu_01',
    content: [
      {
        type: 'web_search_result',
        url: 'https://exemple-outil.test/rapport-2024',
        title: 'Titre vu par l outil',
        encrypted_content: 'opaque',
        page_age: 'March 2, 2024',
      },
      {
        type: 'web_search_result',
        url: 'https://page-atteinte-non-citee.test/annexe',
        title: 'Annexe consultee sans etre citee',
        encrypted_content: 'opaque',
      },
    ],
  },
  {
    type: 'text',
    text: 'La mediane de croissance etait de douze pour cent en 2023.',
    citations: [
      {
        type: 'web_search_result_location',
        url: 'https://page-citee-uniquement.test/etude',
        title: 'Titre vu par la citation',
        encrypted_index: 'opaque',
        cited_text: 'median growth for public SaaS at scale was 12% in 2023',
      },
    ],
  },
];

console.log('\n[Suite 1] une reponse avec recherche rend ses pages');
{
  const lu = await withSourceCapture(async () => {
    recordWebSources({ content: REPONSE_AVEC_RECHERCHE, systemPrompt: PROMPT, model: 'modele-test' });
    return readSourceCapture();
  });

  check(lu.pages === 3, `trois pages distinctes atteintes (${lu.pages})`);
  check(lu.appelsAvecPage === 1, `un appel a rendu au moins une page (${lu.appelsAvecPage})`);
  check(lu.citees === 1, `une seule page porte un extrait cite (${lu.citees})`);

  const citee = lu.sources.find((s) => s.url.includes('page-citee-uniquement'));
  check(citee !== undefined, 'la page portee par la seule citation est capturee');
  check(citee?.extrait === 'median growth for public SaaS at scale was 12% in 2023',
    'l extrait cite est rendu mot pour mot');
  check(citee?.titre === 'Titre vu par la citation', 'le titre de la citation est rendu');

  const parOutil = lu.sources.find((s) => s.url.includes('exemple-outil'));
  check(parOutil?.titre === 'Titre vu par l outil',
    'le titre du resultat d outil est rendu, et il differe de celui de la citation');
  check(parOutil?.ageDePage === 'March 2, 2024', 'l anciennete declaree par la plateforme est rendue');
  check(parOutil?.extrait === '', 'une page atteinte sans citation porte un extrait vide, ce qui est une information');

  const uneSource = lu.sources[0];
  check(!Number.isNaN(Date.parse(uneSource.consulteLe)),
    `la date de consultation est une date lisible (${uneSource.consulteLe})`);
  check(uneSource.modele === 'modele-test', 'le modele de l appel est rendu');
  check(/^[0-9a-f]{16}$/.test(uneSource.empreintePrompt),
    `l empreinte du prompt systeme est rendue (${uneSource.empreintePrompt})`);
}

console.log('\n[Suite 2] la lecture est structurelle, pas nominale');
{
  // Un type de bloc que ce fichier n a jamais nomme. La capture doit le
  // voir, faute de quoi elle serait un inventaire deguise et vieillirait
  // au premier outil ajoute par la plateforme.
  const blocInconnu = [
    {
      type: 'bloc_que_personne_n_a_prevu',
      resultat: { imbrique: [{ url: 'https://outil-futur.test/page', title: 'Page', cited_text: 'extrait' }] },
    },
  ];
  const lu = await withSourceCapture(async () => {
    recordWebSources({ content: blocInconnu, systemPrompt: PROMPT, model: 'm' });
    return readSourceCapture();
  });
  check(lu.pages === 1, `un bloc de type inconnu portant une URL est capture (${lu.pages})`);
}

console.log('\n[Suite 3] une URL ecrite dans la prose n est pas une page atteinte');
{
  const proseAvecUrl = [
    {
      type: 'text',
      text: 'Selon https://source-inventee.test/rapport, la marge atteint 40% [web : source-inventee].',
    },
  ];
  const lu = await withSourceCapture(async () => {
    recordWebSources({ content: proseAvecUrl, systemPrompt: PROMPT, model: 'm' });
    return readSourceCapture();
  });
  check(lu.pages === 0, `aucune page capturee depuis la prose (${lu.pages})`);
  check(aucunePageAtteinte() === false, 'hors run, aucune conclusion sur ce qui a ete atteint');
}

console.log('\n[Suite 4] un echec d outil ne fabrique aucune source');
{
  const echec = [
    {
      type: 'web_search_tool_result',
      tool_use_id: 'srvtoolu_02',
      content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' },
    },
  ];
  const lu = await withSourceCapture(async () => {
    recordWebSources({ content: echec, systemPrompt: PROMPT, model: 'm' });
    return readSourceCapture();
  });
  check(lu.pages === 0, `un bloc d erreur ne rend aucune page (${lu.pages})`);
}

console.log('\n[Suite 5] la portee est le run');
{
  const [a, b] = await Promise.all([
    withSourceCapture(async () => {
      recordWebSources({ content: REPONSE_AVEC_RECHERCHE, systemPrompt: PROMPT, model: 'm' });
      await new Promise((r) => setTimeout(r, 5));
      return readSourceCapture();
    }),
    withSourceCapture(async () => {
      await new Promise((r) => setTimeout(r, 2));
      return readSourceCapture();
    }),
  ]);
  check(a.pages === 3 && b.pages === 0, `deux runs concurrents ne partagent rien (${a.pages} / ${b.pages})`);

  check(captureEstOuverte() === false, 'hors run, aucune portee ouverte');
  recordWebSources({ content: REPONSE_AVEC_RECHERCHE, systemPrompt: PROMPT, model: 'm' });
  check(readSourceCapture().pages === 0, 'hors run, ecriture sans effet et sans erreur');

  await withSourceCapture(async () => {
    check(captureEstOuverte() === true, 'dans un run, la portee est ouverte');
    check(aucunePageAtteinte() === true, 'run ouvert sans page atteinte : le cas se voit');
    recordWebSources({ content: REPONSE_AVEC_RECHERCHE, systemPrompt: PROMPT, model: 'm' });
    check(aucunePageAtteinte() === false, 'des la premiere page, le cas cesse');
  });
}

console.log('\n[Suite 6] deduplication et plafond');
{
  const lu = await withSourceCapture(async () => {
    recordWebSources({ content: REPONSE_AVEC_RECHERCHE, systemPrompt: PROMPT, model: 'm' });
    recordWebSources({ content: REPONSE_AVEC_RECHERCHE, systemPrompt: PROMPT, model: 'm' });
    return readSourceCapture();
  });
  check(lu.sources.length === 3, `la meme page citee deux fois ne compte qu une (${lu.sources.length})`);
  check(lu.appelsAvecPage === 1, `le second appel n ajoute rien, donc ne compte pas (${lu.appelsAvecPage})`);

  const masse = Array.from({ length: 600 }, (_, i) => ({
    type: 'web_search_result',
    url: `https://page-${i}.test/`,
    title: `Page ${i}`,
  }));
  const luMasse = await withSourceCapture(async () => {
    recordWebSources({ content: masse, systemPrompt: PROMPT, model: 'm' });
    return readSourceCapture();
  });
  check(luMasse.sources.length === 500, `le plafond retient cinq cents sources (${luMasse.sources.length})`);
  check(luMasse.ecartees === 100, `les cent ecartees sont comptees et non tues (${luMasse.ecartees})`);
}

console.log(`\n${pass} OK, ${fail} KO`);
}

main().then(() => process.exit(fail > 0 ? 1 : 0));
