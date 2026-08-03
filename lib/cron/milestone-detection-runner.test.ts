// ============================================================
// Tests deterministes du runner de detection de jalons
// ------------------------------------------------------------
// Ce fichier portait ce nom et n exercait que les helpers purs, qui ont
// desormais le leur. Le runner, deux cent cinquante lignes et le seul
// endroit ou la detection automatique decide quoi que ce soit, n etait
// couvert par rien.
//
// Ce qu il faut y tenir tient en trois points, et aucun n est une
// valeur rendue.
//
// Les deux gardes d abord, cle absente et recherche web desactivee. Ce
// sont elles qui distinguent une detection qui ne trouve rien d une
// detection qui n a pas eu lieu, et la seconde ne doit jamais se lire
// comme la premiere.
//
// L invariant doctrinal ensuite : tout evenement insere l est en
// 'proposed', jamais en confirme. Le commentaire d en-tete du module
// explique pourquoi, une hallucination ou une homonymie ne doit pas
// entrer dans l agregation de calibration du fonds. Une regle ecrite
// dans un commentaire ne vaut que pour la ligne qui la porte tant qu un
// test ne la verrouille pas.
//
// Le dedup enfin, qui est ce qui separe un scan repete d une
// accumulation de doublons chez le partner.
//
// Aucun appel au modele : le client est double.
//
//   npx tsx lib/cron/milestone-detection-runner.test.ts
// ============================================================

import { neutraliserServerOnly } from '../test-support/supabase-double';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

neutraliserServerOnly();

// ============================================================
// Doubles
// ============================================================

function poserDouble(chemin: string, exports: Record<string, unknown>) {
  const p = require.resolve(chemin);
  let reel: Record<string, unknown> = {};
  try { reel = require(p); } catch { /* module a effets de bord : on repart de rien */ }
  require.cache[p] = { id: p, filename: p, loaded: true, exports: { ...reel, ...exports } } as any;
}

const appelsLlm: Array<{ systeme: string; utilisateur: string; options: any }> = [];
let reponseLlm: string | (() => never) = '[]';
poserDouble('@/lib/engines/anthropic-client', {
  callClaude: async (systeme: string, utilisateur: string, _max: number, _modele: unknown, options: any) => {
    appelsLlm.push({ systeme, utilisateur, options });
    if (typeof reponseLlm === 'function') reponseLlm();
    return reponseLlm;
  },
});

let analyseRendue: any = { id: 'ana-XJ4417', resultJson: {} };
const analysesDemandees: string[] = [];
poserDouble('@/lib/analysis-store', {
  getAnalysis: async (id: string) => { analysesDemandees.push(id); return analyseRendue; },
});

let dedupRendu: any[] = [];
const dedupDemande: string[] = [];
const inserts: any[] = [];
let insertRend: (m: any) => any = (m) => ({ id: `mil-${inserts.length}`, ...m });
poserDouble('@/lib/reconciliation-store', {
  listMilestonesForDedup: async (id: string) => { dedupDemande.push(id); return dedupRendu; },
  addMilestone: async (m: any) => { inserts.push(m); return insertRend(m); },
});

const CTX = {
  analysisId: 'ana-XJ4417',
  userId: 'usr-ZR1190',
  companyName: 'Societe temoin QN8802',
  decision: 'invest' as any,
  decisionDate: '2026-02-09',
};

/** Deux evenements distincts par tous leurs champs discriminants. */
const DEUX_EVENEMENTS = JSON.stringify([
  {
    date: '2026-04-15', type: 'funding_round', title: 'Tour de serie B annonce XJ4417',
    description: 'description temoin XJ4417', impact: 'positive',
    thesisAlignment: 'driver_confirmed', sourceUrl: 'https://exemple.test/xj4417',
  },
  {
    date: '2026-05-20', type: 'other', title: 'Depart du directeur technique QN8802',
    description: 'description temoin QN8802', impact: 'negative',
    thesisAlignment: 'risk_confirmed', sourceUrl: 'https://exemple.test/qn8802',
  },
]);

function reinit() {
  appelsLlm.length = 0; analysesDemandees.length = 0;
  dedupDemande.length = 0; inserts.length = 0;
  dedupRendu = []; reponseLlm = '[]';
  analyseRendue = { id: 'ana-XJ4417', resultJson: {} };
  insertRend = (m) => ({ id: `mil-${inserts.length}`, ...m });
  process.env.ANTHROPIC_API_KEY = 'cle-de-test-XR7742';
  process.env.ENABLE_WEB_SEARCH = 'true';
}

(async () => {
  const { runMilestoneDetection } = await import('./milestone-detection-runner');
  const utils = await import('./milestone-detection-utils');

  // ============================================================
  console.log('\n[Suite 1] les deux gardes se nomment et ne se confondent pas');
  // ============================================================
  {
    reinit();
    delete process.env.ANTHROPIC_API_KEY;
    const r = await runMilestoneDetection(CTX);
    check(r.status === 'skipped', 'sans cle : le scan est declare saute, pas reussi');
    check(r.reason === 'anthropic-key-missing', 'et le motif nomme la cle absente');
    check(r.detected === 0 && r.inserted === 0, 'aucun evenement compte');
    check(appelsLlm.length === 0, 'aucun appel au modele');
    check(analysesDemandees.length === 0, 'et l analyse n a meme pas ete chargee');
  }

  {
    reinit();
    process.env.ENABLE_WEB_SEARCH = 'false';
    const r = await runMilestoneDetection(CTX);
    check(r.status === 'skipped', 'recherche web desactivee : saute');
    check(r.reason === 'web-search-disabled', 'et le motif la nomme, distinct du motif de cle');
    check(appelsLlm.length === 0, 'toujours aucun appel au modele');
  }

  {
    reinit();
    analyseRendue = null;
    const r = await runMilestoneDetection(CTX);
    // Un dossier introuvable n est pas un saut : c est un echec, parce
    // qu on a demande a scanner quelque chose qui devait exister.
    check(r.status === 'failed', 'analyse introuvable : echec et non saut');
    check(r.reason === 'analysis-not-found', 'le motif nomme le dossier introuvable');
    check(analysesDemandees[0] === 'ana-XJ4417', 'le dossier demande est bien celui du contexte');
    check(appelsLlm.length === 0, 'et rien n a ete demande au modele');
  }

  // ============================================================
  console.log('\n[Suite 2] l appel au modele porte la recherche web');
  // ============================================================
  {
    reinit();
    reponseLlm = '[]';
    await runMilestoneDetection(CTX);
    check(appelsLlm.length === 1, 'un appel et un seul');
    const o = appelsLlm[0].options;
    check(o?.enableWebSearch === true, 'la recherche web est activee sur l appel');
    check(typeof o?.maxWebSearches === 'number' && o.maxWebSearches > 0,
      'un plafond de recherches est pose, il n est pas laisse au defaut');
    check(typeof o?.temperature === 'number', 'la temperature est explicite');
    // Le prompt doit porter le dossier scanne et sa date de decision,
    // sans quoi le modele chercherait des evenements sans borne basse.
    check(appelsLlm[0].utilisateur.includes('Societe temoin QN8802'), 'le prompt nomme la societe scannee');
    check(appelsLlm[0].utilisateur.includes('2026-02-09'), 'et porte la date de decision, borne du scan');
  }

  {
    reinit();
    reponseLlm = () => { throw new Error('panne modele ZR1190'); };
    const r = await runMilestoneDetection(CTX);
    check(r.status === 'failed', 'appel modele en echec : statut failed');
    check(typeof r.reason === 'string' && r.reason.startsWith('llm-error:'), 'le motif est prefixe llm-error');
    check(r.reason?.includes('panne modele ZR1190') === true, 'et il transporte le message reel');
    check(inserts.length === 0, 'rien n est insere sur un echec');
  }

  // ============================================================
  console.log('\n[Suite 3] rien de detecte n est pas une erreur, et ne lit pas le dedup');
  // ============================================================
  {
    reinit();
    reponseLlm = 'aucun evenement trouve, je ne rends rien de structure';
    const r = await runMilestoneDetection(CTX);
    check(r.status === 'ok', 'une sortie sans evenement reste un scan reussi');
    check(r.detected === 0 && r.inserted === 0, 'zero detecte, zero insere');
    check(dedupDemande.length === 0, 'et le dedup n est pas interroge pour rien');
  }

  // ============================================================
  console.log('\n[Suite 4] tout evenement insere l est en proposed');
  // ============================================================
  {
    reinit();
    reponseLlm = DEUX_EVENEMENTS;
    const r = await runMilestoneDetection(CTX);

    // Le compte attendu est demande au parseur reel et non recopie ici :
    // ecrire deux a la main mesurerait mon accord avec moi-meme.
    const attendus = utils.parseDetectedEvents(DEUX_EVENEMENTS);
    check(r.detected === attendus.length, `detected suit le parseur (${attendus.length})`);
    check(r.inserted === attendus.length, 'et tout ce qui est detecte est insere quand rien ne preexiste');
    check(dedupDemande[0] === 'ana-XJ4417', 'le dedup a ete lu sur le bon dossier');

    check(inserts.length > 0, 'des insertions ont eu lieu');
    check(inserts.every((m) => m.detectionStatus === 'proposed'),
      'chaque insertion est en proposed : le partner valide, la detection ne decide pas');
    check(inserts.every((m) => m.sourceKind === 'auto_detected'), 'chacune est marquee auto_detected');
    check(inserts.every((m) => m.sourceType === 'auto_web'), 'et de source auto_web');
    check(inserts.every((m) => m.analysisId === 'ana-XJ4417' && m.userId === 'usr-ZR1190'),
      'chacune porte le dossier et le porteur du contexte');

    // Les deux evenements ne se confondent pas : titres, dates et URL
    // sont distincts, donc un melange de champs tombe ici.
    const titres = inserts.map((m) => m.title);
    check(titres.some((t: string) => t.includes('XJ4417')) && titres.some((t: string) => t.includes('QN8802')),
      'les deux evenements distincts sont inseres, pas deux fois le meme');
    const parTitre = Object.fromEntries(inserts.map((m) => [m.title, m]));
    const premier = Object.values(parTitre).find((m: any) => m.title.includes('XJ4417')) as any;
    check(premier?.milestoneDate === '2026-04-15', 'la date de chaque jalon suit son propre evenement');
    check(premier?.sourceUrl === 'https://exemple.test/xj4417', 'et son URL aussi');
  }

  // ============================================================
  console.log('\n[Suite 5] le dedup empeche le scan repete de dupliquer');
  // ============================================================
  {
    reinit();
    reponseLlm = DEUX_EVENEMENTS;
    // On presente comme deja connu le premier des deux, par son URL.
    dedupRendu = [{ sourceUrl: 'https://exemple.test/xj4417', title: 'Tour de serie B annonce XJ4417' }];

    const r = await runMilestoneDetection(CTX);
    const attendus = utils.parseDetectedEvents(DEUX_EVENEMENTS);
    const restants = utils.dedupAgainstExisting(attendus, dedupRendu as any);

    // Sans cette assertion, la suite passerait aussi bien si le dedup
    // ne retirait rien : les deux comptes seraient egaux et les
    // egalites suivantes seraient vraies sans rien prouver.
    check(restants.length < attendus.length, 'le jeu d essai fait bien retirer une candidate par le dedup');
    check(r.detected === attendus.length, 'detected compte ce que le modele a rendu, avant dedup');
    check(r.inserted === restants.length, 'inserted compte ce qui reste apres dedup, et les deux different');
    check(inserts.length === restants.length, 'le nombre d insertions suit le dedup');
    check(inserts.every((m) => !m.title.includes('XJ4417')),
      'l evenement deja connu n est pas reinsere');
  }

  // ============================================================
  console.log('\n[Suite 6] une insertion refusee ne se compte pas comme faite');
  // ============================================================
  {
    reinit();
    reponseLlm = DEUX_EVENEMENTS;
    // La base refuse la seconde : le compte rendu doit le refleter,
    // sans quoi le journal du cron affirmerait un travail non fait.
    let n = 0;
    insertRend = (m) => { n++; return n === 1 ? { id: 'mil-1', ...m } : null; };

    const r = await runMilestoneDetection(CTX);
    check(inserts.length === 2, 'les deux insertions ont ete tentees');
    check(r.inserted === 1, 'une seule est comptee, celle qui a abouti');
    check(r.status === 'ok', 'et le scan reste reussi : un refus unitaire n est pas une panne de scan');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
