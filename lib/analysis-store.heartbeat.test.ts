// ============================================================
// Verrou du heartbeat des analyses
// ------------------------------------------------------------
// La colonne analyses.heartbeat_at ne vaut que par une propriete
// negative : personne ne l ecrit sauf le pipeline. C est la seule
// chose qui la distingue de updated_at, que le trigger
// analyses_updated_at_trigger repose a now() a chaque UPDATE, quelle
// qu en soit l origine, et qui ne mesure donc pas l immobilite.
//
// Une propriete negative ne se defend pas par un commentaire. La
// discipline des regles ecrites recense trois cas de la meme semaine
// ou la conception etait juste et ou la discipline a cede : le
// parametre opts?.emit cable sur six evenements sans emetteur, le
// parametre measure passe onze fois sur quarante-quatre sites, et une
// regle generale ecrite au bon endroit mais appliquee a une seule
// ligne. Ce fichier est la troisieme forme de portage decrite : le
// test qui compare le declare au reel et echoue le jour ou les deux
// divergent.
//
// Ce qu il verrouille tient en deux points. Un seul site du depot
// ecrit heartbeat_at, et c est updateAnalysisProgress. Et les deux
// balayages jugent l immobilite sur heartbeat_at, jamais sur
// updated_at.
//
// Execution :
//   tsx lib/analysis-store.heartbeat.test.ts
// ============================================================

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;

function check<T>(label: string, actual: T, expected: T) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true);
}

const ROOT = process.cwd();
const SCANNED_DIRS = ['app', 'lib', 'scripts'];
const IGNORED = new Set(['node_modules', '.next', '.git']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORED.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = SCANNED_DIRS.flatMap((d) => {
  try { return walk(join(ROOT, d)); } catch { return []; }
});

checkTrue('le balayage de fichiers a bien trouve des sources', files.length > 100);

// ------------------------------------------------------------
// 1. Un seul site d ecriture.
//
// On cherche les affectations a la colonne, patch.heartbeat_at = ou
// heartbeat_at: dans un objet, et non les simples mentions : le nom
// de la colonne apparait legitimement dans les select, les types et
// les commentaires, et les compter tous ferait de ce test une alarme
// permanente que plus personne ne lirait.
// ------------------------------------------------------------
const WRITE_PATTERN = /(?:^|[^\w])(?:\w+\.)?heartbeat_at\s*[:=][^:=]/;

const writeSites: string[] = [];
for (const f of files) {
  if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue;
  const lines = readFileSync(f, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (WRITE_PATTERN.test(code)) {
      writeSites.push(`${f.slice(ROOT.length + 1)}:${i + 1}`);
    }
  });
}

console.log(`\nSites d ecriture de heartbeat_at : ${writeSites.length}`);
for (const s of writeSites) console.log(`  ${s}`);

check('un seul site du depot ecrit heartbeat_at', writeSites.length, 1);
checkTrue(
  'ce site est dans lib/analysis-store.ts',
  writeSites.length === 1 && writeSites[0].startsWith('lib/analysis-store.ts:'),
);

// Le site unique doit bien etre dans updateAnalysisProgress, et non
// dans une autre fonction du meme fichier. On lit la structure du
// fichier plutot que sa seule ligne : on repere la fonction qui
// contient la ligne d ecriture.
const storeSource = readFileSync(join(ROOT, 'lib/analysis-store.ts'), 'utf-8');
const storeLines = storeSource.split('\n');
const writeLineIndex = storeLines.findIndex((l) =>
  WRITE_PATTERN.test(l.replace(/\/\/.*$/, '')),
);
checkTrue('la ligne d ecriture est retrouvee dans le store', writeLineIndex >= 0);

let enclosingFunction = '(introuvable)';
for (let i = writeLineIndex; i >= 0; i--) {
  const m = storeLines[i].match(/^export (?:async )?function (\w+)/);
  if (m) { enclosingFunction = m[1]; break; }
}
check('l ecriture vit dans updateAnalysisProgress', enclosingFunction, 'updateAnalysisProgress');

// ------------------------------------------------------------
// 2. Les balayages jugent sur heartbeat_at.
//
// On interroge la structure du fichier : on isole le corps de chaque
// fonction et on regarde sur quelle colonne porte son filtre .lt(),
// plutot que de compter des occurrences a l echelle du fichier, ou
// updated_at figure legitimement ailleurs.
// ------------------------------------------------------------
function bodyOf(name: string): string {
  const start = storeSource.indexOf(`export async function ${name}`);
  if (start < 0) return '';
  const next = storeSource.indexOf('\nexport ', start + 1);
  return storeSource.slice(start, next < 0 ? undefined : next);
}

for (const fn of ['listStaleRunningAnalyses', 'markStaleRunningAsFailed', 'sweepDeadBornAnalyses']) {
  const body = bodyOf(fn);
  checkTrue(`${fn} est bien exportee`, body.length > 0);
  const ltCalls: string[] = [];
  const ltPattern = /\.lt\(\s*'([a-z_]+)'/g;
  let ltMatch: RegExpExecArray | null;
  while ((ltMatch = ltPattern.exec(body)) !== null) ltCalls.push(ltMatch[1]);
  checkTrue(`${fn} pose au moins un filtre de fraicheur`, ltCalls.length > 0);
  check(
    `${fn} juge l immobilite sur heartbeat_at`,
    ltCalls.every((c) => c === 'heartbeat_at'),
    true,
  );
  checkTrue(
    `${fn} ne juge pas l immobilite sur updated_at`,
    !ltCalls.includes('updated_at'),
  );
}

// ------------------------------------------------------------
// Ce que ce fichier n exerce pas.
//
// Il ne prouve pas qu une UPDATE arbitraire laisse heartbeat_at
// intact : cette garantie vient du schema, ou la colonne porte un
// DEFAULT qui ne s applique qu a l insertion, et se verifierait
// contre une base reelle. Elle a ete constatee une fois, le 3 aout,
// juste apres la migration : le backfill des cinquante-sept lignes
// n a laisse que deux updated_at du jour, ceux des lignes creees le
// jour meme. Ce constat n est pas rejouable ici sans Supabase.
//
// Il ne prouve pas non plus que le pipeline appelle bien
// updateAnalysisProgress a une cadence utile. Un heartbeat ecrit une
// fois par run serait conforme a tout ce qui est teste ici et ne
// vaudrait rien. C est la limite de ce verrou : il tient la propriete
// negative, l exclusivite de l ecriture, pas la propriete positive,
// la frequence.
// ------------------------------------------------------------

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
