// ============================================================
// TESTS DETERMINISTES : le registre LLM contre le reel
// ------------------------------------------------------------
// Execution : npx tsx lib/instrumentation/llm-registry-coverage.test.ts
//
// LLM_ENGINES existe pour produire enginesHash, l empreinte qui
// segmente les runs de calibration : deux runs qui n ont pas tourne
// sur les memes prompts ne doivent pas se comparer. Le registre est
// tenu a la main, et un registre tenu a la main rediverge. Celui-ci
// avait rediverge dans les deux mois qui ont suivi sa correction
// precedente, en laissant dehors les deux moteurs de sectoral-
// intelligence, dont les fiches sont injectees en tete du prompt de
// la plupart des moteurs.
//
// Le test de couverture existant, version-stamp.test.ts section 7,
// verifiait que sept moteurs nommes figuraient au registre. Il
// comparait donc le registre a une liste ecrite dans le test :
// deux declarations l une contre l autre, jamais le declare contre le
// reel. Un moteur absent des deux passait sans bruit, et c est
// exactement ce qui s est produit.
//
// Ce fichier fait la confrontation manquante. Il parcourt l arbre
// syntaxique du depot, releve tout fichier qui appelle effectivement
// le client Anthropic, et exige que chacun figure soit dans
// LLM_ENGINES, soit dans la table d exclusions motivees. Il echoue le
// jour ou un nouveau moteur appelle le modele sans que personne ait
// tranche s il entre dans l empreinte.
//
// La lecture se fait par AST et non par expression reguliere : on
// veut des appels, pas des mentions. Un import sans appel ne compte
// pas, un nom dans un commentaire non plus. C est la meme discipline
// que celle qui impose d interroger l objet plutot que son texte.
// ============================================================

import * as ts from 'typescript';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { LLM_ENGINES_PATHS, LLM_CALLERS_HORS_STAMP } from './version-stamp';

let pass = 0;
let fail = 0;

function check<T>(label: string, got: T, expected: T): void {
  if (got === expected) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
}

function checkTrue(label: string, got: boolean): void {
  check(label, got, true);
}

// ============================================================
// Releve des appelants reels
// ============================================================

const ROOT = process.cwd();

/**
 * Repertoires hors perimetre. `scripts` et `.tmp-run` portent des
 * outils de diagnostic qui appellent le modele hors de tout run
 * d analyse ; les exclure est un choix declare et non un oubli.
 */
const HORS_PERIMETRE = new Set([
  'node_modules', '.next', '.git', 'reports', 'scripts', '.tmp-run',
]);

/**
 * Portes d entree vers le modele. `getClient` en fait partie : c est
 * par elle que dd-technical-engine construit son propre appel
 * multi-documents, en court-circuitant callClaudeWithPDF. Un releve
 * qui ne chercherait que les trois wrappers manquerait ce moteur-la.
 */
const PORTES = new Set([
  'callClaude',
  'callClaudeWithUsage',
  'callClaudeWithPDF',
  'getClient',
]);

function parcourir(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (HORS_PERIMETRE.has(e.name)) continue;
      parcourir(join(dir, e.name), out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/**
 * Vrai si le fichier importe `getClient` depuis autre chose que le
 * client Anthropic. `lib/analysis-store.ts` porte une fonction locale
 * du meme nom qui rend un client Supabase : un releve par nom d appel
 * ne les distingue pas, et cette collision produisait un faux positif
 * dans le scan qui a mene a ce test.
 */
function getClientEstLeClientAnthropic(src: ts.SourceFile): boolean {
  let importe = false;
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      if (!n.moduleSpecifier.text.includes('anthropic-client')) return;
      const clause = n.importClause?.namedBindings;
      if (clause && ts.isNamedImports(clause)) {
        for (const spec of clause.elements) {
          if (spec.name.text === 'getClient') importe = true;
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return importe;
}

function relevrAppelants(): Map<string, Set<string>> {
  const appelants = new Map<string, Set<string>>();
  for (const fichier of parcourir(ROOT)) {
    const rel = relative(ROOT, fichier);
    if (rel === 'lib/engines/anthropic-client.ts') continue; // le client lui-meme
    const texte = readFileSync(fichier, 'utf8');
    const src = ts.createSourceFile(fichier, texte, ts.ScriptTarget.Latest, true);
    const getClientLocal = !getClientEstLeClientAnthropic(src);

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        let nom: string | null = null;
        if (ts.isIdentifier(n.expression)) nom = n.expression.text;
        else if (ts.isPropertyAccessExpression(n.expression)) nom = n.expression.name.text;
        if (nom && PORTES.has(nom)) {
          if (nom === 'getClient' && getClientLocal) {
            // Homonyme local, pas une porte vers le modele.
          } else {
            if (!appelants.has(rel)) appelants.set(rel, new Set());
            appelants.get(rel)!.add(nom);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(src);
  }
  return appelants;
}

const appelants = relevrAppelants();
const declares = new Set(LLM_ENGINES_PATHS);
const exclus = new Map(LLM_CALLERS_HORS_STAMP.map((e) => [e.path, e.motif]));

// ============================================================
// Test 1 : le releve trouve quelque chose
// ============================================================

console.log('\n=== Test 1 : le releve est exploitable ===');
{
  // Une garde sur l instrument lui-meme. Un releve qui rendrait zero
  // appelant ferait passer tous les tests suivants au vert en ne
  // mesurant rien, ce qui est le mode de defaillance le plus
  // dangereux d un test de couverture.
  checkTrue('des appelants sont releves', appelants.size >= 25);
  checkTrue('le registre est peuple', declares.size >= 25);
  checkTrue(
    'un moteur connu est bien releve',
    appelants.has('lib/engines/orchestrator.ts'),
  );
  checkTrue(
    'la porte getClient est bien vue',
    appelants.get('lib/engines/dd-technical-engine.ts')?.has('getClient') === true,
  );
  check(
    'l homonyme Supabase n est pas compte',
    appelants.has('lib/analysis-store.ts'),
    false,
  );
}

// ============================================================
// Test 2 : tout appelant reel est tranche
// ============================================================

console.log('\n=== Test 2 : aucun appelant hors du registre et hors des exclusions ===');
{
  const orphelins: string[] = [];
  Array.from(appelants.entries()).forEach(([chemin, portes]) => {
    if (declares.has(chemin)) return;
    if (exclus.has(chemin)) return;
    orphelins.push(`${chemin} [${Array.from(portes).join(', ')}]`);
  });
  if (orphelins.length > 0) {
    console.log('    appelants non tranches :');
    for (const o of orphelins) console.log(`      ${o}`);
  }
  check('aucun appelant orphelin', orphelins.length, 0);
}

// ============================================================
// Test 3 : le registre ne declare pas de fantomes
// ============================================================

console.log('\n=== Test 3 : tout chemin declare existe et appelle le modele ===');
{
  const inexistants: string[] = [];
  const muets: string[] = [];
  Array.from(declares).forEach((chemin) => {
    if (!existsSync(join(ROOT, chemin))) {
      inexistants.push(chemin);
      return;
    }
    if (!appelants.has(chemin)) muets.push(chemin);
  });
  if (inexistants.length > 0) console.log(`    fichiers absents : ${inexistants.join(', ')}`);
  if (muets.length > 0) console.log(`    declares sans appel : ${muets.join(', ')}`);
  check('aucun chemin declare inexistant', inexistants.length, 0);
  check('aucun chemin declare sans appel au modele', muets.length, 0);
}

// ============================================================
// Test 4 : les exclusions sont motivees et vivantes
// ============================================================

console.log('\n=== Test 4 : les exclusions restent justifiees ===');
{
  // Une exclusion qui ne correspond plus a un appelant reel est une
  // exclusion perimee, et elle masque le fait que la question ne se
  // pose plus. On la fait tomber plutot que de la laisser dormir.
  const perimees: string[] = [];
  Array.from(exclus.keys()).forEach((chemin) => {
    if (!appelants.has(chemin)) perimees.push(chemin);
  });
  if (perimees.length > 0) console.log(`    exclusions perimees : ${perimees.join(', ')}`);
  check('aucune exclusion perimee', perimees.length, 0);

  for (const e of LLM_CALLERS_HORS_STAMP) {
    checkTrue(`exclusion motivee : ${e.path}`, e.motif.trim().length > 40);
  }
}

// ============================================================
// Test 5 : les deux moteurs sectoriels sont au registre
// ============================================================

console.log('\n=== Test 5 : les generateurs de fiches entrent dans l empreinte ===');
{
  // Regression nommee. Une regeneration de fiche change ce que lisent
  // la plupart des moteurs via buildSectoralPromptBlock, sans toucher
  // a leurs prompts. Tant que ces deux fichiers etaient hors registre,
  // enginesHash restait identique entre deux runs qui n avaient pas lu
  // la meme chose.
  checkTrue(
    'regenerator de fiches sectorielles au registre',
    declares.has('lib/engines/sectoral-intelligence/regenerator.ts'),
  );
  checkTrue(
    'agregateur inter-sectoriel au registre',
    declares.has('lib/engines/sectoral-intelligence/inter-sector-aggregator.ts'),
  );
}

console.log(`\n${pass}/${pass + fail} tests passes`);
if (fail > 0) process.exit(1);
