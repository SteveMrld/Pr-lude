// ============================================================
// TESTS DETERMINISTES DU MANIFESTE DE DEMONSTRATION
// ------------------------------------------------------------
// Ce que ce fichier verrouille est la partie du script qui refuse avant
// de depenser. Un manifeste mal forme decouvert apres le premier run
// coute trois a quatre dollars et demi et dix minutes, et surtout il
// laisse une note orpheline en base ; decouvert avant, il ne coute rien.
//
// Le validateur est appele par sa porte de production, `lireManifeste`
// exportee du script, et non recopie ici. Une reimplementation
// verifierait qu une logique s accorde avec elle-meme et resterait verte
// le jour ou le script change.
//
// Ce que ces tests NE couvrent pas, et qui doit se lire ici plutot que
// se deduire d un silence : rien de ce qui suit le manifeste. Le
// televersement, l appel au pipeline, la relecture du version stamp et
// les trois verdicts demandent un serveur et une base, donc ils ne sont
// pas dans la suite deterministe. La garde qui justifie le script, celle
// qui arrete quand une note demandee gelee ne sort pas gelee, n est donc
// pas exercee ici.
//
// Lance : npx tsx scripts/run-demonstration.test.ts
// ============================================================

import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { lireManifeste } from './run-demonstration';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS  ${message}`);
  } else {
    failed++;
    console.log(`  FAIL  ${message}`);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'demo-manifeste-'));
const pdfUn = join(dir, 'un.pdf');
const pdfDeux = join(dir, 'deux.pdf');
writeFileSync(pdfUn, '%PDF-1.4 factice');
writeFileSync(pdfDeux, '%PDF-1.4 factice');

function ecrire(nom: string, contenu: any): string {
  const p = join(dir, nom);
  writeFileSync(p, JSON.stringify(contenu, null, 2));
  return p;
}

function refuse(chemin: string): string | null {
  try {
    lireManifeste(chemin);
    return null;
  } catch (err: any) {
    return err?.message ?? 'erreur sans message';
  }
}

const valide = {
  dossier: 'Made.com',
  track: 'growth',
  notes: [
    { fichier: pdfUn, asOf: '2021-06-30', libelle: "Prospectus d admission, juin 2021" },
    { fichier: pdfDeux, asOf: '2022-05-31', libelle: 'Comptes 2021, deposes mai 2022' },
  ],
};

// ------------------------------------------------------------
console.log('\n# Test 1 : un manifeste bien forme passe');
{
  const m = lireManifeste(ecrire('ok.json', valide));
  assert(m.dossier === 'Made.com', 'le dossier remonte');
  assert(m.track === 'growth', 'le parcours remonte');
  assert(m.notes.length === 2, 'deux notes');
  assert(m.notes[0].asOf === '2021-06-30', 'ancre de la premiere note');
  assert(m.notes[1].asOf === '2022-05-31', 'ancre de la seconde note');
}

// ------------------------------------------------------------
console.log('\n# Test 2 : l ordre chronologique est une contrainte, pas une convention');
{
  const inverse = {
    ...valide,
    notes: [
      { fichier: pdfUn, asOf: '2022-05-31', libelle: 'Comptes 2021' },
      { fichier: pdfDeux, asOf: '2021-06-30', libelle: 'Prospectus' },
    ],
  };
  const m1 = refuse(ecrire('inverse.json', inverse));
  assert(m1 !== null && /ordre/.test(m1), 'des ancres decroissantes sont refusees');

  const egales = {
    ...valide,
    notes: [
      { fichier: pdfUn, asOf: '2021-06-30', libelle: 'A' },
      { fichier: pdfDeux, asOf: '2021-06-30', libelle: 'B' },
    ],
  };
  const m2 = refuse(ecrire('egales.json', egales));
  assert(m2 !== null && /ordre/.test(m2),
    'deux ancres egales sont refusees : sans anteriorite il n y a pas de trajectoire');
}

// ------------------------------------------------------------
console.log('\n# Test 3 : ce qui manque est refuse avant toute depense');
{
  assert(refuse(ecrire('sans-dossier.json', { ...valide, dossier: '  ' })) !== null,
    'dossier vide refuse');
  assert(refuse(ecrire('sans-track.json', { ...valide, track: 'autre' })) !== null,
    'parcours inconnu refuse');
  assert(refuse(ecrire('une-note.json', { ...valide, notes: [valide.notes[0]] })) !== null,
    'une seule note refusee : il n y a rien a comparer');
  assert(refuse(ecrire('sans-notes.json', { ...valide, notes: 'deux' })) !== null,
    'notes non tableau refuse');
}

// ------------------------------------------------------------
console.log('\n# Test 4 : chaque note est refusee sur ce qui la rend inexploitable');
{
  const avec = (over: any) => ({ ...valide, notes: [{ ...valide.notes[0], ...over }, valide.notes[1]] });

  assert(refuse(ecrire('fichier-absent.json', avec({ fichier: join(dir, 'nexiste-pas.pdf') }))) !== null,
    'fichier introuvable refuse avant le run et non pendant');
  assert(refuse(ecrire('asof-mal-forme.json', avec({ asOf: '2021-06' }))) !== null,
    'ancre sans jour refusee : la precision se declare, elle ne se devine pas');
  assert(refuse(ecrire('asof-absent.json', avec({ asOf: undefined }))) !== null,
    'ancre absente refusee');
  assert(refuse(ecrire('libelle-vide.json', avec({ libelle: '   ' }))) !== null,
    'libelle vide refuse');
}

// ------------------------------------------------------------
console.log('\n# Test 5 : le manifeste absent se distingue du manifeste fautif');
{
  const m = refuse(join(dir, 'aucun.json'));
  assert(m !== null && /introuvable/.test(m),
    'un manifeste absent le dit, plutot que de rendre une erreur de parse');
}

// ------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} tests passes`);
if (failed > 0) {
  process.exit(1);
}
