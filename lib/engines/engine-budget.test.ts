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
  referenceChecksGateWorstCaseMs,
  GATE_WORST_CASE_MS,
  ORCHESTRATE_RESERVE_MS,
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
for (const key of Object.keys(EXPECTED) as BudgetedEngineKey[]) {
  checkTrue(`route.ts : deadline dediee cablee sur ${key}`,
    routeSrc.includes(`engineDeadlineFor('${key}')`));
}
check('route.ts : WAIT_DEADLINE_MS a 560s',
  /const WAIT_DEADLINE_MS = 560_000;/.test(routeSrc), true);
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
checkTrue('reference-checks : la reprise est gardee par looksTruncated',
  refSrc.includes('if (looksTruncated(raw))'));
checkTrue('reference-checks : la sortie tronquee releve l erreur au lieu de rejouer',
  refSrc.includes('throw firstErr'));

// ============================================================
// SECTION 4. LE PIRE CAS CUMULE
// ------------------------------------------------------------
// Chaine serielle : porte [team, market, macro] -> pattern -> causal
// -> reference-checks. blindspot et contrarian sont paralleles a
// pattern et n entrent pas dans la somme.
// ============================================================

console.log('\n=== Section 4. Pire cas de convergence ===');

const MUR_VERCEL_MS = 800_000;
const RUN_BUDGET_MS = 700_000;
const WAIT_DEADLINE_MS = 560_000;
const MARGE_MINIMALE_MS = 80_000;

// Pire cas par fenetres : le SDK tranche, regime attendu d un echec.
const parFenetres = worstCaseConvergenceByWindowMs();
check('Pire cas convergence par fenetres = 582s', parFenetres, 582_000);
checkTrue('Par fenetres, convergence plus synthese tiennent sous le budget de run',
  parFenetres + ORCHESTRATE_RESERVE_MS <= RUN_BUDGET_MS);
checkTrue('Par fenetres, marge au mur Vercel superieure a 80s',
  MUR_VERCEL_MS - (parFenetres + ORCHESTRATE_RESERVE_MS) >= MARGE_MINIMALE_MS);

// Pire cas par deadlines externes : plafond garanti par le code.
const parDeadlines = worstCaseConvergenceMs();
check('Pire cas convergence par deadlines = 690s', parDeadlines, 690_000);
checkTrue('Par deadlines, la convergence reste sous le mur avec plus de 80s de marge',
  MUR_VERCEL_MS - parDeadlines >= MARGE_MINIMALE_MS);
checkTrue('Par deadlines, la convergence reste sous le budget de run',
  parDeadlines <= RUN_BUDGET_MS);

// Le budget de run borne le run entier, convergence et synthese sont
// toutes deux coursees contre lui. C est ce qui garantit le mur.
checkTrue('Le budget de run laisse au moins 100s avant le mur Vercel',
  MUR_VERCEL_MS - RUN_BUDGET_MS >= 100_000);

// blindspot est sur la branche parallele : sa fenetre ne doit pas
// exceder pattern + causal, sinon elle deviendrait le chemin critique.
checkTrue('La fenetre blindspot reste sous pattern + causal',
  ENGINE_LLM_BUDGET.blindspotAnalysis.timeout
  <= ENGINE_LLM_BUDGET.patternMatching.timeout + ENGINE_LLM_BUDGET.causalReversal.timeout);
checkTrue('La deadline blindspot reste sous pattern + causal',
  engineDeadlineFor('blindspotAnalysis')
  <= engineDeadlineFor('patternMatching') + engineDeadlineFor('causalReversal'));

// La porte de reference-checks doit s ouvrir avant que sa garde
// d attente ne fire, sinon la fenetre ne sert a rien.
const porteRefChecks = 152_000
  + ENGINE_LLM_BUDGET.patternMatching.timeout
  + ENGINE_LLM_BUDGET.causalReversal.timeout;
check('Porte de reference-checks par fenetres = 512s', porteRefChecks, 512_000);
checkTrue('Par fenetres, la garde d attente ne coupe pas reference-checks',
  porteRefChecks < WAIT_DEADLINE_MS);

// LIMITE CONNUE, documentee plutot que masquee : en pire cas par
// deadlines externes la porte passe au-dela de la garde d attente et
// reference-checks est sacrifie. C est le bon ordre de sacrifice, mais
// ce n est pas un cas couvert. Le test fige l ecart pour qu il ne
// s aggrave pas en silence.
const porteRefChecksDeadlines = referenceChecksGateWorstCaseMs();
check('Porte de reference-checks par deadlines = 600s', porteRefChecksDeadlines, 600_000);
checkTrue('Ecart connu : par deadlines la garde d attente coupe reference-checks',
  porteRefChecksDeadlines > WAIT_DEADLINE_MS);
checkTrue('Cet ecart reste borne a 40s, le porter plus haut demanderait de relever la garde',
  porteRefChecksDeadlines - WAIT_DEADLINE_MS <= 40_000);

check('Terme de porte retenu pour le pire cas par deadlines', GATE_WORST_CASE_MS, 200_000);

// ============================================================
console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);
