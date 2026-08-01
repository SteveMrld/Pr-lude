// ============================================================
// TESTS - BUDGET D APPEL PAR MOTEUR
// ------------------------------------------------------------
// Six moteurs sont sortis du defaut client 60s / 1 reprise pour une
// fenetre dimensionnee. Le budget d une chaine serielle est le genre
// de chose qui se verifie une fois a la main puis derive au premier
// ajustement, parce que personne ne refait la somme. Ces tests la
// refont a chaque commit.
//
// Ce qui est verrouille :
//   - Les six sites d appel portent la fenetre prevue et zero reprise,
//     lue depuis la table partagee et non depuis un litteral disperse.
//   - Le cablage effectif au site d appel, verifie sur le source, sur
//     le modele du test d orchestrateur fragilite.
//   - La reprise de parse de reference-checks ne se declenche plus sur
//     une sortie tronquee, qui est le cas ou elle ne pouvait rien.
//   - Le pire cas cumule de convergence tient sous le mur Vercel avec
//     de la marge, et le budget de run le borne effectivement.
//
// Execution : npx tsx lib/engines/engine-budget.test.ts
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ENGINE_LLM_BUDGET,
  ENGINE_DEADLINE_SLACK_MS,
  engineDeadlineFor,
  worstCaseConvergenceMs,
  worstCaseConvergenceByWindowMs,
  worstCaseRunByWindowMs,
  nominalRunMs,
  gateWorstCaseByWindowMs,
  referenceChecksGateWorstCaseMs,
  GATE_WORST_CASE_MS,
  ORCHESTRATE_RESERVE_MS,
  ORCHESTRATE_MAX_TOKENS,
  UPSTREAM_WATCHLIST,
  TEMPERATURE_DIALECTIQUE,
  TEMPERATURE_SCORE,
  type BudgetedEngineKey,
} from './engine-budget';
import { looksTruncated } from './reference-checks-engine';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); fail++; }
}

function checkTrue(label: string, cond: boolean) {
  if (cond) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}`); fail++; }
}

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ============================================================
// SECTION 1. LA TABLE DES FENETRES
// ============================================================

console.log('\n=== Section 1. Fenetres et reprises ===');

const EXPECTED: Record<BudgetedEngineKey, number> = {
  team: 180_000,
  finalRecommendation: 150_000,
  patternMatching: 180_000,
  blindspotAnalysis: 240_000,
  contrarianAnalysis: 180_000,
  causalReversal: 180_000,
  referenceChecks: 70_000,
  narrativeDrift: 120_000,
};

for (const [key, timeout] of Object.entries(EXPECTED) as Array<[BudgetedEngineKey, number]>) {
  check(`${key} : fenetre ${timeout / 1000}s`, ENGINE_LLM_BUDGET[key].timeout, timeout);
  check(`${key} : zero reprise`, ENGINE_LLM_BUDGET[key].maxRetries, 0);
}

checkTrue('Aucune fenetre ne reste au defaut client de 60s',
  Object.values(ENGINE_LLM_BUDGET).every(o => o.timeout > 60_000));

checkTrue('Aucun moteur budgete ne garde de reprise',
  Object.values(ENGINE_LLM_BUDGET).every(o => o.maxRetries === 0));

// La deadline externe derive de la fenetre, elle ne peut pas diverger.
for (const key of Object.keys(EXPECTED) as BudgetedEngineKey[]) {
  check(`${key} : deadline = fenetre + slack`,
    engineDeadlineFor(key), ENGINE_LLM_BUDGET[key].timeout + ENGINE_DEADLINE_SLACK_MS);
}

// ============================================================
// SECTION 2. CABLAGE EFFECTIF AUX SITES D APPEL
// ------------------------------------------------------------
// Une table de constantes que personne ne lit ne sert a rien. On
// verifie sur le source que chaque moteur passe bien son entree de
// budget en cinquieme argument de callClaude, et qu aucun des six ne
// laisse trainer un appel sans options.
// ============================================================

console.log('\n=== Section 2. Cablage aux sites d appel ===');

const CALL_SITES: Array<{ file: string; key: BudgetedEngineKey }> = [
  { file: 'lib/engines/team-engine.ts', key: 'team' },
  { file: 'lib/engines/orchestrator.ts', key: 'finalRecommendation' },
  { file: 'lib/engines/pattern-engine.ts', key: 'patternMatching' },
  { file: 'lib/engines/blindspot-engine.ts', key: 'blindspotAnalysis' },
  { file: 'lib/engines/contrarian-engine.ts', key: 'contrarianAnalysis' },
  { file: 'lib/engines/causal-engine.ts', key: 'causalReversal' },
  { file: 'lib/engines/reference-checks-engine.ts', key: 'referenceChecks' },
  { file: 'lib/engines/narrative-drift-engine.ts', key: 'narrativeDrift' },
];

for (const { file, key } of CALL_SITES) {
  const src = read(file);
  checkTrue(`${file} : importe la table de budget`,
    src.includes("from './engine-budget'"));
  checkTrue(`${file} : passe ENGINE_LLM_BUDGET.${key} en options d appel`,
    src.includes(`ENGINE_LLM_BUDGET.${key}`));
}

// Le wrapper deadline accepte bien un override par moteur, et la route
// le cable sur les six.
const routeSrc = read('app/api/analyze/route.ts');
// finalRecommendation n est pas enveloppe par withEngineDeadline : il a
// sa propre boucle de reprise et court contre le budget global.
for (const key of Object.keys(EXPECTED).filter(k => k !== 'finalRecommendation') as BudgetedEngineKey[]) {
  checkTrue(`route.ts : deadline dediee cablee sur ${key}`,
    routeSrc.includes(`engineDeadlineFor('${key}')`));
}
checkTrue('route.ts : l estimation de tentative de synthese suit sa fenetre',
  routeSrc.includes('ORCHESTRATE_ATTEMPT_ESTIMATE_MS = ENGINE_LLM_BUDGET.finalRecommendation.timeout'));
check('route.ts : WAIT_DEADLINE_MS a 620s',
  /const WAIT_DEADLINE_MS = 620_000;/.test(routeSrc), true);
check('route.ts : RUN_BUDGET_MS a 700s',
  /const RUN_BUDGET_MS = 700_000;/.test(routeSrc), true);
check('route.ts : ENGINE_DEADLINE_MS reste le defaut a 200s',
  /const ENGINE_DEADLINE_MS = 200_000;/.test(routeSrc), true);
check('route.ts : maxDuration inchange a 800',
  /export const maxDuration = 800;/.test(routeSrc), true);

const wrapperSrc = read('lib/orchestrator/engine-deadline.ts');
checkTrue('engine-deadline : le wrapper accepte un override de deadline',
  wrapperSrc.includes('llmDeadlineOverrideMs') && wrapperSrc.includes('llmDeadlineOverrideMs ?? defaultLlmDeadlineMs'));

// ============================================================
// SECTION 3. LA REPRISE DE PARSE DE REFERENCE-CHECKS
// ------------------------------------------------------------
// Elle coutait une fenetre pleine en serie sur le dernier maillon du
// chemin critique pour rejouer le meme prompt. Sur une sortie coupee
// par max_tokens, la seconde passe reproduit la coupure : elle paie
// une fenetre pour un echec certain. Elle ne doit plus se declencher
// dans ce cas, et doit rester disponible pour les malformations non
// deterministes qu une seconde passe corrige vraiment.
// ============================================================

console.log('\n=== Section 3. Reprise de parse conditionnelle ===');

checkTrue('Sortie coupee en plein objet : tronquee',
  looksTruncated('{"founderChecks": [{"name": "Marie D", "question": "Comment'));
checkTrue('Sortie coupee en plein tableau : tronquee',
  looksTruncated('{"founderChecks": [{"name": "Marie D"}, {"name": "Paul'));
checkTrue('Accolades non refermees malgre une fin en accolade : tronquee',
  looksTruncated('{"a": {"b": {"c": 1}}'));
checkTrue('Sortie vide : traitee comme tronquee',
  looksTruncated(''));
checkTrue('Sortie sans aucune structure JSON : traitee comme tronquee',
  looksTruncated('Je ne peux pas repondre a cette demande.'));

checkTrue('JSON complet et valide : non tronque',
  !looksTruncated('{"founderChecks": [{"name": "Marie D"}], "customerChecks": []}'));
checkTrue('JSON complet dans un fence markdown : non tronque',
  !looksTruncated('```json\n{"founderChecks": [], "customerChecks": []}\n```'));
checkTrue('JSON complet precede de prose : non tronque',
  !looksTruncated('Voici le plan.\n{"founderChecks": [], "customerChecks": []}'));
// Malformation sans coupure : virgule surnumeraire. La reprise garde
// son sens ici, une seconde passe peut la corriger.
checkTrue('Virgule surnumeraire, structure fermee : non tronque, la reprise reste utile',
  !looksTruncated('{"founderChecks": [],}'));
// Une chaine contenant des accolades ne doit pas fausser le solde.
checkTrue('Accolades a l interieur d une chaine : non comptees',
  !looksTruncated('{"q": "utilise {ceci} et [cela]"}'));

const refSrc = read('lib/engines/reference-checks-engine.ts');
checkTrue('reference-checks : la reprise est gardee sur la troncature',
  /if \((?:hitTokenCeiling\(measure\) \|\| )?looksTruncated\(raw\)\)/.test(refSrc));
checkTrue('reference-checks : la sortie tronquee releve l erreur au lieu de rejouer',
  refSrc.includes('throw firstErr'));

// ============================================================
// SECTION 4. LE PIRE CAS CUMULE
// ------------------------------------------------------------
// Chaine serielle : porte [team, market, macro] -> pattern -> causal
// -> reference-checks. blindspot et contrarian sont paralleles a
// pattern et n entrent pas dans la somme.
//
// DEUX PLAFONDS, ET UN SEUL EST OPPOSABLE. La somme des fenetres est
// une arithmetique : elle suppose que quatre moteurs consecutifs
// brulent leur fenetre entiere puis echouent, scenario ou il n y a de
// toute facon plus rien a synthetiser. Ce qui borne reellement le run,
// c est RUN_BUDGET_MS, qui court la convergence comme la synthese et
// coupe avant que la somme ne soit atteinte. Le mur Vercel est protege
// par le budget, pas par la somme, et les tests le disent dans cet
// ordre.
// ============================================================

console.log('\n=== Section 4. Pire cas de convergence ===');

const MUR_VERCEL_MS = 800_000;
const RUN_BUDGET_MS = 700_000;
const WAIT_DEADLINE_MS = 620_000;
const MARGE_MINIMALE_MS = 60_000;

check('Porte par fenetres = 182s (team 180 + surcout)', gateWorstCaseByWindowMs(), 182_000);
check('Pire cas convergence par fenetres = 612s', worstCaseConvergenceByWindowMs(), 612_000);
check('Reserve de synthese = 180s (fenetre 150 + sortie 30)', ORCHESTRATE_RESERVE_MS, 180_000);
check('Somme arithmetique du run = 792s', worstCaseRunByWindowMs(), 792_000);

// LE PLAFOND OPPOSABLE. Le budget de run borne le run entier, quelles
// que soient les sommes ci-dessus, parce qu il court les deux etapes.
// C est de la que vient la garantie sur le mur.
checkTrue('Le budget de run est le plafond effectif : il coupe avant la somme des fenetres',
  RUN_BUDGET_MS < worstCaseRunByWindowMs());
checkTrue('Marge au mur Vercel superieure a 60s, garantie par le budget de run',
  MUR_VERCEL_MS - RUN_BUDGET_MS >= MARGE_MINIMALE_MS);
check('Marge effective au mur', (MUR_VERCEL_MS - RUN_BUDGET_MS) / 1000, 100);

// LE REGIME ATTENDU. C est lui que le budget doit accueillir
// confortablement, le pire cas devant seulement degrader proprement.
check('Nominal du run = 625s', nominalRunMs(), 625_000);
checkTrue('Le nominal tient sous le budget de run',
  nominalRunMs() < RUN_BUDGET_MS);
checkTrue('Le nominal garde plus de 60s de marge sous le budget',
  RUN_BUDGET_MS - nominalRunMs() >= MARGE_MINIMALE_MS);
checkTrue('Le nominal garde plus de 60s de marge sous le mur',
  MUR_VERCEL_MS - nominalRunMs() >= MARGE_MINIMALE_MS);

// Pire cas par deadlines externes, plafond garanti par le code cote
// convergence seule.
check('Pire cas convergence par deadlines = 690s', worstCaseConvergenceMs(), 690_000);
checkTrue('Par deadlines, la convergence reste sous le mur avec plus de 60s de marge',
  MUR_VERCEL_MS - worstCaseConvergenceMs() >= MARGE_MINIMALE_MS);

// blindspot est sur la branche parallele : sa fenetre ne doit pas
// exceder pattern + causal, sinon elle deviendrait le chemin critique.
checkTrue('La fenetre blindspot reste sous pattern + causal',
  ENGINE_LLM_BUDGET.blindspotAnalysis.timeout
  <= ENGINE_LLM_BUDGET.patternMatching.timeout + ENGINE_LLM_BUDGET.causalReversal.timeout);

// La porte de reference-checks doit s ouvrir avant que sa garde
// d attente ne fire, dans les deux regimes.
const porteRefChecks = gateWorstCaseByWindowMs()
  + ENGINE_LLM_BUDGET.patternMatching.timeout
  + ENGINE_LLM_BUDGET.causalReversal.timeout;
check('Porte de reference-checks par fenetres = 542s', porteRefChecks, 542_000);
checkTrue('Par fenetres, la garde d attente ne coupe pas reference-checks',
  porteRefChecks < WAIT_DEADLINE_MS);

const porteRefChecksDeadlines = referenceChecksGateWorstCaseMs();
check('Porte de reference-checks par deadlines = 600s', porteRefChecksDeadlines, 600_000);
checkTrue('Par deadlines aussi, la garde d attente ne coupe pas reference-checks',
  porteRefChecksDeadlines < WAIT_DEADLINE_MS);
checkTrue('La garde d attente reste sous le budget de run',
  WAIT_DEADLINE_MS < RUN_BUDGET_MS);

check('Terme de porte par deadlines', GATE_WORST_CASE_MS, 200_000);

// ============================================================
// SECTION 5. LA SYNTHESE FINALE ET LA COUCHE AMONT SURVEILLEE
// ============================================================

console.log('\n=== Section 5. Synthese finale et surveillance amont ===');

check('Plafond de tokens de la synthese ramene a 5000', ORCHESTRATE_MAX_TOKENS, 5000);
const orcSrc = read('lib/engines/orchestrator.ts');
checkTrue('orchestrator : le plafond litteral 8000 a disparu du site d appel',
  !orcSrc.includes('userPrompt, 8000, MODEL'));
checkTrue('orchestrator : les deux appels passent par le plafond partage',
  (orcSrc.match(/ORCHESTRATE_MAX_TOKENS, MODEL/g) || []).length === 2);
checkTrue('orchestrator : les deux appels portent la fenetre dediee',
  (orcSrc.match(/ENGINE_LLM_BUDGET\.finalRecommendation/g) || []).length >= 2);
checkTrue('orchestrator : la reprise de parse est gardee sur la troncature',
  orcSrc.includes('if (looksTruncated(rawResponse))'));
checkTrue('orchestrator : la sortie tronquee releve l erreur au lieu de rejouer',
  orcSrc.includes("[orchestrator] JSON parse failed sur une sortie tronquee"));

const teamSrc = read('lib/engines/team-engine.ts');
checkTrue('team : le litteral 150_000 a disparu du site d appel',
  !teamSrc.includes('timeout: 150_000'));
checkTrue('team : la fenetre vient de la table partagee',
  teamSrc.includes('...ENGINE_LLM_BUDGET.team'));
// La borne d une requete vient desormais de la table et non d un
// litteral au site d appel. Voir section 6.
checkTrue('team : la recherche web reste bornee a une requete',
  ENGINE_LLM_BUDGET.team.maxWebSearches === 1);

// La couche amont non elargie reste declaree, avec sa marge mesuree,
// pour que le prochain arbitrage parte de chiffres et non de memoire.
check('Trois moteurs amont sous surveillance', UPSTREAM_WATCHLIST.length, 3);
for (const w of UPSTREAM_WATCHLIST) {
  checkTrue(`${w.engine} : marge mesuree positive (${(w.windowMs - w.worstObservedMs) / 1000}s)`,
    w.worstObservedMs < w.windowMs);
}
checkTrue('market et financialCoherence sont les deux marges les plus faibles',
  UPSTREAM_WATCHLIST.filter(w => w.windowMs - w.worstObservedMs <= 20_000)
    .map(w => w.engine).sort().join(',') === 'financialCoherence,market');

// ============================================================
// SECTION 6. BUDGET DE RECHERCHE WEB EXPLICITE
// ------------------------------------------------------------
// EngineLlmOptions ne portait pas le champ, donc sept moteurs sur onze
// heritaient des trois hops du client sans que personne les ait
// decides. Le run 2517a288 l a rendu visible sur la synthese, qui a
// rendu 5127 tokens pour un plafond de 5000 : le compteur de sortie de
// l API agrege la boucle d outil serveur et ne peut depasser max_tokens
// que si un outil a tourne.
//
// La regle doctrinale : seuls les quatre moteurs du niveau 2.A
// interrogent le web, parce qu ils instruisent une assertion et la
// taggent. Les moteurs dialectiques raisonnent sur les sorties amont,
// et une synthese qui interroge le web produit une assertion que plus
// aucun moteur ne porte, ce qui casse la tracabilite corpus / web /
// inference.
// ============================================================

console.log('\n=== Section 6. Budget de recherche web ===');

const HOPS_ATTENDUS: Record<BudgetedEngineKey, number> = {
  team: 1,
  patternMatching: 0,
  blindspotAnalysis: 0,
  contrarianAnalysis: 0,
  causalReversal: 0,
  referenceChecks: 0,
  narrativeDrift: 0,
  finalRecommendation: 0,
};

for (const key of Object.keys(HOPS_ATTENDUS) as BudgetedEngineKey[]) {
  check(`${key} : budget de recherche declare`,
    ENGINE_LLM_BUDGET[key].maxWebSearches, HOPS_ATTENDUS[key]);
}
checkTrue('Aucun moteur budgete ne laisse le budget de recherche indefini',
  (Object.keys(ENGINE_LLM_BUDGET) as BudgetedEngineKey[])
    .every(k => typeof ENGINE_LLM_BUDGET[k].maxWebSearches === 'number'));
checkTrue('Un seul moteur budgete interroge le web',
  (Object.keys(ENGINE_LLM_BUDGET) as BudgetedEngineKey[])
    .filter(k => ENGINE_LLM_BUDGET[k].maxWebSearches > 0).join(',') === 'team');

// Les trois autres moteurs du niveau 2.A ne passent pas par la table,
// ils portent leurs options en litteral. Ils gardent leur hop unique.
for (const f of ['market-engine', 'macro-engine', 'financial-coherence-engine']) {
  checkTrue(`${f} : garde son hop unique du niveau 2.A`,
    read(`lib/engines/${f}.ts`).includes('maxWebSearches: 1'));
}

// team ne doit plus porter de litteral concurrent a la table : le
// spread ecrasait deja la valeur, mais deux sources pour un meme
// reglage finissent toujours par diverger.
checkTrue('team : le budget de recherche vient de la table seule',
  !teamSrc.includes('maxWebSearches: 1,'));

// Le zero doit eteindre l outil et non l attacher avec un plafond
// inerte, sinon le modele recoit quand meme la capacite de chercher.
const clientSrc = read('lib/engines/anthropic-client.ts');
check('client : le zero hop eteint l outil sur les deux canaux',
  (clientSrc.match(/isWebSearchEnabled\(\)\) && maxWebSearches > 0/g) || []).length, 2);
checkTrue('client : le budget est lu avant la decision d attacher l outil',
  clientSrc.indexOf('const maxWebSearches') < clientSrc.indexOf('const useWebSearch'));

// Corollaire : les sept moteurs a zero hop deviennent insensibles au
// mode frozen, qu ils n honoraient pas puisqu ils ne passent pas par
// applyRunOptions. Le trou se referme par construction.
for (const f of ['pattern-engine', 'blindspot-engine', 'contrarian-engine', 'causal-engine']) {
  checkTrue(`${f} : n appelle pas applyRunOptions, et n en a plus besoin`,
    !read(`lib/engines/${f}.ts`).includes('applyRunOptions'));
}

// ============================================================
// SECTION 7. TEMPERATURE EXPLICITE AU SITE D APPEL
// ------------------------------------------------------------
// Meme trou de contrat que le budget de recherche, une couche plus
// bas. Le champ n existait sur aucun des deux canaux du client, donc
// aucun site d appel ne pouvait en decider : les onze moteurs du
// pipeline tournaient au defaut de l API pendant que la couche
// d extraction passait 0 depuis toujours.
//
// Le mecanisme a ete pose neutre : la table declarait d abord la valeur
// deja appliquee implicitement sur les huit. La repartition reelle
// entre les deux regimes est verrouillee section 8, une fois le
// basculement des moteurs de dimension acquis.
// ============================================================

checkTrue('Aucun moteur budgete ne laisse la temperature indefinie',
  (Object.keys(ENGINE_LLM_BUDGET) as BudgetedEngineKey[])
    .every(k => typeof ENGINE_LLM_BUDGET[k].temperature === 'number'));

// Deux regimes et deux seulement. Une troisieme valeur signalerait un
// reglage pris au site d appel plutot qu au niveau de la doctrine.
checkTrue('Les huit se repartissent sur les deux seuls regimes declares',
  (Object.keys(ENGINE_LLM_BUDGET) as BudgetedEngineKey[])
    .every(k => ENGINE_LLM_BUDGET[k].temperature === TEMPERATURE_DIALECTIQUE
      || ENGINE_LLM_BUDGET[k].temperature === TEMPERATURE_SCORE));
check('Le defaut API est bien la valeur dialectique', TEMPERATURE_DIALECTIQUE, 1);
check('La valeur de score supprime l echantillonnage', TEMPERATURE_SCORE, 0);

// Le client emet le parametre, sur les deux canaux, et seulement si le
// site d appel l a decide. Un defaut fabrique dans le client serait
// exactement le silence qu on retire.
check('client : la temperature est construite sur les deux canaux',
  (clientSrc.match(/requestParams\.temperature = options\.temperature/g) || []).length, 2);
check('client : aucun defaut de temperature n est fabrique',
  (clientSrc.match(/options\.temperature \?\?/g) || []).length, 0);
check('client : le champ est emis sous condition de presence',
  (clientSrc.match(/options\.temperature !== undefined/g) || []).length, 2);

// ============================================================
// SECTION 8. LES SIX MOTEURS DE DIMENSION SONT DETERMINISTES
// ------------------------------------------------------------
// La frontiere du determinisme se lit sur score-calculator : six
// dimensions ponderees, six moteurs qui les alimentent. team, market,
// macro et financialCoherence directement, contrarian sur sa dimension
// propre, blindspot par la vigilance qui inverse globalBlindspotScore
// (score-calculator.ts:741). Ces six-la sortent de l echantillonnage,
// les autres non : ce test verrouille exactement cette ligne, et
// casse aussi bien si un moteur de dimension y rentre a nouveau que si
// un moteur dialectique en sort sans decision.
// ============================================================

const DIMENSION_ENGINES: BudgetedEngineKey[] = ['team', 'blindspotAnalysis', 'contrarianAnalysis'];
for (const key of DIMENSION_ENGINES) {
  check(`${key} : alimente une dimension, donc temperature 0`,
    ENGINE_LLM_BUDGET[key].temperature, TEMPERATURE_SCORE);
}
checkTrue('Les cinq moteurs hors dimension gardent le defaut API',
  (Object.keys(ENGINE_LLM_BUDGET) as BudgetedEngineKey[])
    .filter(k => !DIMENSION_ENGINES.includes(k))
    .every(k => ENGINE_LLM_BUDGET[k].temperature === TEMPERATURE_DIALECTIQUE));

// Les trois autres moteurs de dimension portent leurs options en
// litteral, hors de la table. La contrainte de type ne les atteint pas,
// donc elle est reportee ici sur le source.
for (const f of ['market-engine', 'macro-engine', 'financial-coherence-engine']) {
  checkTrue(`${f} : passe la temperature de score au site d appel`,
    read(`lib/engines/${f}.ts`).includes('temperature: TEMPERATURE_SCORE'));
}

// La branche avec business plan de l extraction financiere omettait la
// temperature que sa jumelle sans BP passait a 0. Meme fonction, meme
// P&L, deux regimes selon la presence d un fichier. Sa sortie alimente
// la dimension Modele economique.
check('financial-extraction : les deux branches lisent le P&L a 0',
  (read('lib/engines/financial-extraction-engine.ts')
    .match(/deckBase64, 8000, MODEL, 0\)/g) || []).length, 2);

// Aucun site d appel ne doit plus heriter du defaut en silence. Le
// balayage porte sur les fichiers qui appellent le client partage.
const SITES_A_DECLARER = [
  'lib/engines/reference-aggregation-engine.ts',
  'lib/engines/tech-claim-coherence-engine.ts',
  'lib/engines/execution-friction-engine.ts',
  'lib/engines/dd-financial-engine.ts',
  'lib/engines/dd-contractual-engine.ts',
  'lib/engines/dd-technical-engine.ts',
  'lib/engines/structuration-entree/index.ts',
  'lib/engines/sectoral-intelligence/regenerator.ts',
  'lib/engines/sectoral-intelligence/inter-sector-aggregator.ts',
  'lib/cron/milestone-detection-runner.ts',
  'lib/engines/fragility-structurelle/pattern-interface.ts',
];
for (const p of SITES_A_DECLARER) {
  checkTrue(`${p} : temperature declaree et non heritee`,
    read(p).includes('TEMPERATURE_DIALECTIQUE'));
}

// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);
