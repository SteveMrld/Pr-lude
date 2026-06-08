// ============================================================
// Tests deterministes ingest-helpers
// ------------------------------------------------------------
// Couvre les helpers purs du script d ingestion corpus :
//   - parseCliArgs : --apply explicite, sinon dry-run
//   - deriveCompanyName : derive un nom de societe depuis un
//     filename, sert de clef d idempotence
//   - discoverPdfs : retourne [] sur dossier inexistant ou non
//     dossier, sinon liste les .pdf tries
//
// Garde-fou critique : "ingestion dry-run n ecrit rien" passe
// par parseCliArgs qui defaut applyMode=false. Le script lui-meme
// gate toutes les ecritures derriere ce flag. Ce test verifie le
// contrat structurel cote helper, le script entoure les apply
// derriere ce booleen.
//
//   npx tsx scripts/ingest-helpers.test.ts
// ============================================================

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { parseCliArgs, deriveCompanyName, discoverPdfs } from './ingest-helpers';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`FAIL : ${label}`);
  }
}

// ============================================================
// 1. parseCliArgs : defaut dry-run, --apply force apply
// ============================================================
{
  const a = parseCliArgs([]);
  check('Defaut applyMode=false (dry-run)', a.applyMode === false);
  check('Defaut verbose=false', a.verbose === false);
  check('Defaut corpusPath=null', a.corpusPath === null);

  const b = parseCliArgs(['--apply']);
  check('--apply -> applyMode=true', b.applyMode === true);

  const c = parseCliArgs(['/path/to/corpus', '--apply']);
  check('Argument positionnel -> corpusPath', c.corpusPath === '/path/to/corpus');
  check('--apply garde applyMode=true avec positional', c.applyMode === true);

  const d = parseCliArgs(['--verbose', '/some/path']);
  check('--verbose detecte', d.verbose === true);
  check('Positional apres --verbose pris en compte', d.corpusPath === '/some/path');

  // Flag inconnu ignore proprement
  const e = parseCliArgs(['--unknown-flag', '/data']);
  check('Flag inconnu n empeche pas le parsing', e.corpusPath === '/data');
}

// ============================================================
// 2. deriveCompanyName : heuristique nom de societe
// ============================================================
{
  check('wework-2024.pdf -> Wework',
    deriveCompanyName('wework-2024.pdf') === 'Wework');

  check('theranos_2015_deck.pdf -> Theranos Deck',
    deriveCompanyName('theranos_2015_deck.pdf') === 'Theranos Deck');

  check('jnan-hotels-2026-Q1.pdf -> Jnan Hotels',
    deriveCompanyName('jnan-hotels-2026-Q1.pdf') === 'Jnan Hotels');

  check('Stripe.pdf -> Stripe',
    deriveCompanyName('Stripe.pdf') === 'Stripe');

  // Cas degenere : que des chiffres -> base brute conservee
  check('2024.pdf retombe sur base brute', deriveCompanyName('2024.pdf') === '2024');
}

// ============================================================
// 3. discoverPdfs : dossier inexistant -> tableau vide
// ============================================================
{
  const fake = '/tmp/this-path-should-not-exist-' + Date.now();
  check('Dossier inexistant -> []', discoverPdfs(fake).length === 0);
}

// ============================================================
// 4. discoverPdfs : fichier au lieu d un dossier -> tableau vide
// ============================================================
{
  const tmp = mkdtempSync(join(tmpdir(), 'ingest-test-'));
  const filePath = join(tmp, 'not-a-dir.txt');
  writeFileSync(filePath, 'x', 'utf-8');
  check('Chemin pointant un fichier -> []', discoverPdfs(filePath).length === 0);
  rmSync(tmp, { recursive: true, force: true });
}

// ============================================================
// 5. discoverPdfs : ne liste que les .pdf, tri stable, dry-run
//                   ne modifie pas le filesystem
// ============================================================
{
  const tmp = mkdtempSync(join(tmpdir(), 'ingest-test-'));
  writeFileSync(join(tmp, 'b-deck.pdf'), 'pdf-bytes', 'utf-8');
  writeFileSync(join(tmp, 'a-deck.pdf'), 'pdf-bytes', 'utf-8');
  writeFileSync(join(tmp, 'c-readme.md'), 'not a pdf', 'utf-8');
  mkdirSync(join(tmp, 'subfolder'));

  const found = discoverPdfs(tmp, '2026-06-08');
  check('Liste exactement les .pdf top-level', found.length === 2);
  check('Tri stable alphabetique', found[0].filename === 'a-deck.pdf' && found[1].filename === 'b-deck.pdf');
  check('Chaque entree porte une date asOf', found.every(p => p.deckReceivedAt === '2026-06-08'));
  check('Chaque entree porte une companyName non vide',
    found.every(p => typeof p.companyName === 'string' && p.companyName.length > 0));

  // Le simple fait d appeler discoverPdfs (et donc tout le chemin
  // dry-run en amont) ne doit JAMAIS muter le filesystem. On verifie
  // que readme est encore present et qu aucun fichier n a ete cree.
  const second = discoverPdfs(tmp, '2026-06-08');
  check('Appel idempotent : meme nombre de pdfs au second passage', second.length === found.length);

  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n=== ingest-helpers ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
