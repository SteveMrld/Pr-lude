// ============================================================
// Tests deterministes : un tag ne fonde rien que la capture ne porte
// ------------------------------------------------------------
// Ce que ces tests prouvent : une revendication de lecture exterieure
// cesse de fonder son assertion quand le run n a atteint aucune page,
// elle la fonde a nouveau des qu une page est atteinte, et elle ne
// produit aucune severite hors run, ou l on ignore ce qui a ete lu.
//
// Les textes sont copies du run persiste a5e69c94 et non rediges pour le
// test. Une fixture ecrite dans la meme hypothese que le code mesure
// leur accord, pas la justesse.
//
// L entree se fait par la porte de la production : les tests ouvrent une
// vraie portee de capture et y deposent une vraie reponse, plutot que de
// recopier la regle dans ce fichier. Une copie survivrait a la
// reecriture du module qu elle teste, ce qui est exactement le signe
// qu elle ne le teste pas.
//
// Execution : npx tsx lib/engines/assertion-validator-capture.test.ts
// ============================================================

import { withSourceCapture, recordWebSources } from '../instrumentation/source-capture';
import {
  porteUnTagDeSource,
  tagRevendiqueUneLectureExterne,
  findSourcesNonCapturees,
  findCurrencyMismatch,
  findUnknownNames,
} from './assertion-validator';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Copie du run a5e69c94, financialCoherence.tests.crosseHockeySuspecte.evidence.
const PHRASE_DU_RUN =
  "À titre de comparaison, la médiane de croissance des SaaS publics à scale "
  + "($100M+ ARR) était de 12% en 2023 et projetée à 29% pour 2024 "
  + "[web : benchmarkit.ai, 2024 SaaS Performance Metrics]. "
  + "Braincube projette une croissance 1.5x à 3.5x supérieure à cette médiane.";

/** Une page atteinte, avec un extrait que rien d autre ne fournit. */
const UNE_PAGE = [{
  type: 'web_search_tool_result',
  content: [{
    type: 'web_search_result',
    url: 'https://benchmarkit.test/2024-saas-performance-metrics',
    title: '2024 SaaS Performance Metrics',
  }],
}];

async function main() {

console.log('\n[Suite 1] ce qu un tag revendique');
{
  check(tagRevendiqueUneLectureExterne('[web : benchmarkit.ai]') === true,
    'un tag web revendique une lecture exterieure');
  check(tagRevendiqueUneLectureExterne('[FMI WEO]') === true,
    'un tag qui nomme une institution revendique une lecture exterieure');
  check(tagRevendiqueUneLectureExterne('[pitch p.4]') === false,
    'le document instruit est porte par la requete');
  check(tagRevendiqueUneLectureExterne('[inference]') === false,
    'le raisonnement du modele est porte par la requete');
  check(tagRevendiqueUneLectureExterne('[inférence : ratio levee sur CA]') === false,
    'la variante accentuee est reconnue');
  check(tagRevendiqueUneLectureExterne('[corpus]') === false,
    'le corpus doctrinal est inscrit dans les prompts, donc porte par la requete');
  check(tagRevendiqueUneLectureExterne('[pitch + web : Viadeo]') === true,
    'une seule clause exterieure suffit');
  // Releve du 5 aout 2026 sur quarante analyses persistees : environ
  // mille sept cents groupes de crochets sont purement numeriques. Les
  // compter aurait fait signaler une annee entre crochets comme une
  // source exterieure non capturee.
  check(tagRevendiqueUneLectureExterne('[2029]') === false,
    'une annee entre crochets ne nomme aucune source');
  check(tagRevendiqueUneLectureExterne('[0]') === false,
    'un crochet de prose purement numerique ne revendique rien');
  check(tagRevendiqueUneLectureExterne('[worldbank-gdp]') === true,
    'un identifiant de source exterieure porte une lettre, donc il revendique');
}

console.log('\n[Suite 2] capture vide : le tag ne fonde plus rien');
{
  const idx = PHRASE_DU_RUN.indexOf('$');
  const r = await withSourceCapture(async () => ({
    fonde: porteUnTagDeSource(PHRASE_DU_RUN, idx, true),
    devise: findCurrencyMismatch(PHRASE_DU_RUN, 'EUR', 'evidence'),
    revendications: findSourcesNonCapturees(PHRASE_DU_RUN, 'evidence'),
  }));
  check(r.fonde === false, 'le montant n est plus tenu pour source');
  check(r.devise.length === 1,
    `la devise etrangere ressort signalee (${r.devise.length})`);
  check(r.revendications.length === 1,
    `la revendication de lecture est signalee pour elle-meme (${r.revendications.length})`);
  check(r.revendications[0]?.severity === 'critical',
    'le signalement est critique : la note affirme avoir lu ce qu elle n a pas lu');
  check((r.revendications[0]?.excerpt ?? '').includes('benchmarkit.ai'),
    'l extrait rendu montre le tag en cause');
}

console.log('\n[Suite 3] une page atteinte, et la meme phrase redevient sourcee');
{
  const idx = PHRASE_DU_RUN.indexOf('$');
  const r = await withSourceCapture(async () => {
    recordWebSources({ content: UNE_PAGE, systemPrompt: 'prompt', model: 'm' });
    return {
      fonde: porteUnTagDeSource(PHRASE_DU_RUN, idx, true),
      devise: findCurrencyMismatch(PHRASE_DU_RUN, 'EUR', 'evidence'),
      revendications: findSourcesNonCapturees(PHRASE_DU_RUN, 'evidence'),
    };
  });
  check(r.fonde === true, 'le montant est de nouveau tenu pour source');
  check(r.devise.length === 0, `aucun signalement de devise (${r.devise.length})`);
  check(r.revendications.length === 0,
    `aucune revendication signalee (${r.revendications.length})`);
}

console.log('\n[Suite 4] hors run, aucune severite inventee');
{
  const idx = PHRASE_DU_RUN.indexOf('$');
  check(porteUnTagDeSource(PHRASE_DU_RUN, idx, true) === true,
    'hors run, le tag continue de fonder : on ignore ce qui a ete lu');
  check(findSourcesNonCapturees(PHRASE_DU_RUN, 'evidence').length === 0,
    'hors run, aucun signalement');
}

console.log('\n[Suite 5] les provenances internes ne sont jamais atteintes par la regle');
{
  const textePitch = "Le ratio levee cumulee sur CA atteint 20:1 [inference : "
    + "1.5M EUR seed plus 15M EUR Series A annoncee sur 0.8M EUR CA prevu 2024 [pitch p.21]], "
    + "superieur au seuil critique de 16:1 observe sur le pattern Ynsect 2020 [corpus].";
  const r = await withSourceCapture(async () =>
    findSourcesNonCapturees(textePitch, 'evidence'));
  check(r.length === 0,
    `capture vide, mais aucune revendication exterieure a signaler (${r.length})`);
}

console.log('\n[Suite 6] un nom propre lave par un tag web redevient non source');
{
  // Le defaut d origine du validateur : un nom absent du pitch passait
  // des lors qu il portait un tag web. Sous capture vide, le tag ne lave
  // plus rien, et le nom doit ressortir.
  const texte = "Le fonds Refactory accompagne la societe depuis 2021 "
    + "[web : registres entreprises], ce qui n apparait pas dans le dossier.";
  const permis = new Set<string>();
  const sousCaptureVide = await withSourceCapture(async () =>
    findUnknownNames(texte, permis, 'redFlags[0]'));
  const sousCapturePleine = await withSourceCapture(async () => {
    recordWebSources({ content: UNE_PAGE, systemPrompt: 'prompt', model: 'm' });
    return findUnknownNames(texte, permis, 'redFlags[0]');
  });
  check(sousCaptureVide.length > sousCapturePleine.length,
    `le controle voit la faute quand on la lui donne (${sousCaptureVide.length} contre ${sousCapturePleine.length})`);
  check(sousCaptureVide.some((w) => w.excerpt.includes('Refactory')),
    'le nom non porte par la capture est nomme dans le signalement');
}

console.log(`\n${pass} OK, ${fail} KO`);
}

main().then(() => process.exit(fail > 0 ? 1 : 0));
