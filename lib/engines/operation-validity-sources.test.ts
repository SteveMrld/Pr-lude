// ============================================================
// Tests deterministes de la collecte des sources et du verdict
// non-instruit
// ------------------------------------------------------------
// Ce que ces tests prouvent : la collecte choisit ses moteurs sur une
// propriete des donnees et non sur leur nom, et une recherche qui n a
// pas eu lieu ne conclut pas a l absence.
//
// Le defaut ferme est du 4 aout 2026. La route enumerait Equipe,
// Fragilite structurelle et Narrative Drift, liste ecrite en regardant
// un run early stage. Le premier run growth a neutralise le moteur
// Equipe, qui portait trois des quatre evenements du seul cas connu, et
// la note est sortie avec « aucune reserve » sur un dossier dont le
// moteur Marche portait deux evenements datables qu aucune des trois
// entrees ne pouvait atteindre. Le lecteur y lisait qu aucun evenement
// posterieur n avait ete releve, ce qui est une affirmation sur le
// monde, alors que le pipeline n avait interroge personne.
//
// Execution : npx tsx lib/engines/operation-validity-sources.test.ts
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  collecterProseDesSourcesExternes,
  detecterEvenementsDansLaProse,
  evaluerValiditeOperation,
} from './operation-validity';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const LIGNE_AVEC_SOURCE = 'La societe a annonce une levee de 83 millions d euros en novembre 2023 [web : Usine Nouvelle], ce qui change son financement.';
const LIGNE_SANS_SOURCE = 'Le modele economique repose sur un abonnement annuel par site industriel deploye, facture a l usage.';

console.log('\n[Suite 1] la collecte selectionne sur la citation, pas sur le nom');
{
  const sections = {
    moteurQuiCite: { rationale: LIGNE_AVEC_SOURCE },
    moteurQuiRaisonne: { rationale: LIGNE_SANS_SOURCE },
    moteurVide: null,
  };
  const { lignes, moteursLus } = collecterProseDesSourcesExternes(sections);
  check(moteursLus.join(',') === 'moteurQuiCite', `seul le moteur citant une source est lu (${moteursLus.join(',') || 'aucun'})`);
  check(lignes.some((l) => l.includes('83 millions')), 'et sa prose est bien remontee');
  check(!lignes.some((l) => l.includes('abonnement annuel')), 'celle du moteur sans citation ne l est pas');
}
{
  // Un moteur inconnu du jour ou la regle a ete ecrite entre sans qu on
  // le nomme : c est tout l objet du critere.
  const { moteursLus } = collecterProseDesSourcesExternes({
    moteurInventeDemain: { note: LIGNE_AVEC_SOURCE },
  });
  check(moteursLus.join(',') === 'moteurInventeDemain', 'un moteur ajoute plus tard entre sans modification de regle');
}
{
  // La sortie de ce module ne se relit pas elle-meme, sans quoi la
  // mention qu il vient d ecrire deviendrait un evenement au rejeu.
  const { moteursLus } = collecterProseDesSourcesExternes({
    operationValidity: { mention: LIGNE_AVEC_SOURCE },
  });
  check(moteursLus.length === 0, 'la sortie du module est exclue de sa propre lecture');
}

console.log('\n[Suite 2] aucune source lue ne vaut pas aucun evenement');
{
  const sansSource = evaluerValiditeOperation({
    operationType: 'lbo',
    operationComponents: [{ kind: 'cession', evidence: 'a' }],
    documentDate: null,
    millesimeReference: 2021,
    evenements: [],
    moteursLus: [],
  });
  check(sansSource.verdict === 'non-instruit', `verdict non-instruit et non aucune-reserve (${sansSource.verdict})`);
  check(sansSource.cause === 'absence', 'avec sa cause structuree');
  check(/n a interroge aucune source/.test(sansSource.motif), 'le motif porte sur la lecture');
  check(!/aucun evenement posterieur n existe/i.test(sansSource.motif), 'et ne conclut pas sur le monde');
  check(sansSource.mention !== null, 'une mention est produite : le silence serait lu comme une absence de reserve');
  check(/ne vaut pas absence d evenement/.test(String(sansSource.mention)), 'et elle dit exactement cela au lecteur');

  const avecSource = evaluerValiditeOperation({
    operationType: 'lbo',
    operationComponents: [{ kind: 'cession', evidence: 'a' }],
    documentDate: null,
    millesimeReference: 2021,
    evenements: [],
    moteursLus: ['market', 'fragiliteStructurelle'],
  });
  check(avecSource.verdict === 'aucune-reserve', 'des sources lues et rien de posterieur : aucune-reserve');
  check(avecSource.mention === null, 'et aucune mention, il n y a rien a signaler');
  check(/2 moteurs/.test(avecSource.motif) && /market/.test(avecSource.motif),
    'le motif borne l affirmation en nommant ce qui a ete lu');
}

console.log('\n[Suite 3] le cas du run growth, de bout en bout');
{
  // Le run du 4 aout : Equipe neutralise, et un moteur Marche qui cite
  // ses sources. L ancienne liste ne lisait pas Marche.
  const runGrowth = {
    team: { __skipped: true, rationale: 'Moteur neutralise sur le parcours growth.' },
    market: { signaux: [LIGNE_AVEC_SOURCE] },
    narrativeDrift: { synthese: LIGNE_SANS_SOURCE },
  };
  const { lignes, moteursLus } = collecterProseDesSourcesExternes(runGrowth);
  check(moteursLus.includes('market'), 'le moteur Marche est lu sur le parcours growth');
  const ev = detecterEvenementsDansLaProse(lignes);
  check(ev.length > 0, `et l evenement qu il porte est detecte (${ev.length})`);
  const out = evaluerValiditeOperation({
    operationType: 'lbo',
    operationComponents: [{ kind: 'cession', evidence: 'a' }, { kind: 'cash-in', evidence: 'b' }],
    documentDate: null,
    millesimeReference: 2021,
    evenements: ev,
    moteursLus,
  });
  check(out.verdict === 'a-verifier', `la reserve est levee sur growth (${out.verdict})`);
}

console.log('\n[Suite 4] le declare et le reel, sur la route');
{
  // Verrou de composition. L objet passe a la collecte dans la route est
  // une enumeration, faute d un agregat disponible a ce point du
  // pipeline ; ce test echoue le jour ou un moteur entre dans le
  // `result` final sans entrer dans cet objet. C est la troisieme forme
  // de portage de la discipline des regles ecrites : a defaut d un point
  // de passage unique, un test qui compare le declare au reel.
  const src = readFileSync(join(__dirname, '..', '..', 'app', 'api', 'analyze', 'route.ts'), 'utf-8');

  const blocCollecte = src.match(/const sectionsProduites = \{([\s\S]*?)\};/);
  check(!!blocCollecte, 'l objet des sections produites est trouve dans la route');
  const declarees = new Set(
    (blocCollecte?.[1] ?? '').split(/[,\n]/).map((s) => s.trim()).filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
  );

  const blocResult = src.match(/\n {10}const result = \{([\s\S]*?)\n {10}\};/);
  check(!!blocResult, 'la composition du result final est trouvee');
  // Indentation exacte des membres de premier niveau du litteral. Sans
  // cette borne, les clefs imbriquees de `meta` et des blocs de
  // metadonnees remontent comme des moteurs, et le verrou echoue sur du
  // bruit qu il a lui-meme fabrique.
  const reelles = new Set(
    (blocResult?.[1] ?? '')
      .split('\n')
      .map((l) => l.match(/^ {12}([a-zA-Z][a-zA-Z0-9]*)[,:]/)?.[1])
      .filter((s): s is string => !!s),
  );

  // Ce qui est produit apres le calcul de validite ne peut pas y
  // figurer, ces moteurs consommant la validite ou venant plus tard.
  const POSTERIEURS = new Set([
    'meta', 'valuation', 'operationValidity', 'indicators', 'finalRecommendation',
    'assertionAudit', 'ledgerExtraction', 'ddFinancial', 'capTableExtraction',
    'ddContractual', 'ddTechnical', 'technicalDocsMeta', 'legalDocumentsMeta',
  ]);
  const manquantes = Array.from(reelles).filter((s) => !POSTERIEURS.has(s) && !declarees.has(s));
  check(manquantes.length === 0,
    `aucun moteur du result n echappe a la collecte (manquants : ${manquantes.join(', ') || 'aucun'})`);

  // Le verrou doit voir la faute quand on la lui donne, sinon il est
  // vert pour la mauvaise raison.
  const temoin = Array.from(reelles).filter((s) => !POSTERIEURS.has(s) && !new Set(Array.from(declarees).filter((d) => d !== 'market')).has(s));
  check(temoin.includes('market'), 'et il verrait un moteur retire de la collecte');
}

console.log(`\n${pass} pass, ${fail} fail\n`);
process.exit(fail > 0 ? 1 : 0);
