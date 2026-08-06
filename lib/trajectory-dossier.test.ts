// ============================================================
// TESTS DETERMINISTES DU REGROUPEMENT PAR DOSSIER
// ------------------------------------------------------------
// Le regroupement decide quelles analyses entrent dans une meme
// trajectoire. Une fausse fusion produirait une note qui compare deux
// societes sans rapport, ce qui est inmontrable a un fonds ; un faux
// refus rendrait une trajectoire vide, ce qui se voit. Les deux erreurs
// ne coutent pas la meme chose, donc les tests portent d abord sur les
// fusions que le regroupement doit refuser.
//
// Les cas 4 et 5 ne sont pas inventes : ils rejouent ce que le corpus
// persiste portait au 6 aout 2026, dix lignes sous le libelle pose
// avant extraction couvrant quatre societes sans rapport, dont deux
// knockouts de pre-scan qui ecrivent un resultat sans avoir nomme
// personne. Une propriete se paie une fois si elle porte le defaut
// constate dont elle est nee.
//
// Lance : npx tsx lib/trajectory-dossier.test.ts
// ============================================================

import {
  cleDeDossier,
  cleComplete,
  membresDuDossier,
  assiseDocumentaire,
  type LigneCandidate,
} from './trajectory-dossier';
import { LIBELLE_AVANT_EXTRACTION } from './analysis-store';

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

const U = 'user-un';

function ligne(over: Partial<LigneCandidate> = {}): LigneCandidate {
  return {
    id: 'a1',
    userId: U,
    companyName: 'Made.com',
    createdAt: '2026-06-01T00:00:00Z',
    sourceFilename: 'doc.pdf',
    deckHash: 'deck-1',
    aUnResultat: true,
    ...over,
  };
}

// ------------------------------------------------------------
// Test 1 : la normalisation est close
// ------------------------------------------------------------
console.log('\n# Test 1 : la cle est une egalite de chaines, pas une ressemblance');
{
  assert(cleDeDossier('Made.com') === 'made.com', 'casse repliee');
  assert(cleDeDossier('  Made.com  ') === 'made.com', 'bordures retirees');
  assert(cleDeDossier('Made   com') === 'made com', 'espaces internes reduits');
  assert(cleDeDossier('') === null, 'nom vide : pas de cle');
  assert(cleDeDossier('   ') === null, 'nom blanc : pas de cle');
  assert(cleDeDossier(null) === null, 'nom absent : pas de cle');

  // Ce qui NE doit pas se rejoindre. Chacune de ces paires serait
  // fusionnee par une heuristique de sous-chaine, de prefixe ou de
  // retrait de forme juridique. Le regroupement les separe parce qu il
  // ne fait rien d autre qu une egalite.
  assert(cleDeDossier('Made.com') !== cleDeDossier('Made.com Group PLC'),
    'un nom et le meme suivi d une forme juridique restent deux dossiers');
  assert(cleDeDossier('Made') !== cleDeDossier('Made.com'),
    'un prefixe n est pas une identite');
  assert(cleDeDossier('Alpha SAS') !== cleDeDossier('Alpha SA'),
    'deux formes juridiques voisines restent deux dossiers');
}

// ------------------------------------------------------------
// Test 2 : le regroupement ne sort jamais d un proprietaire
// ------------------------------------------------------------
console.log('\n# Test 2 : deux fonds ne se melangent pas sur une homonymie');
{
  const a = ligne({ id: 'a', userId: 'fonds-un' });
  const b = ligne({ id: 'b', userId: 'fonds-deux', createdAt: '2026-06-02T00:00:00Z' });
  const m = membresDuDossier(a, [a, b]);
  assert(m.length === 1, 'un seul membre');
  assert(m[0].id === 'a', 'la ligne de l autre fonds est ecartee');
  assert(cleComplete(a) !== cleComplete(b), 'les cles completes different');

  const sansUser = ligne({ id: 'c', userId: null });
  assert(cleComplete(sansUser) === null, 'une ligne sans proprietaire n a pas de cle');
}

// ------------------------------------------------------------
// Test 3 : une ligne sans resultat n entre pas
// ------------------------------------------------------------
console.log('\n# Test 3 : le critere porte sur le contenu, pas sur le statut');
{
  const ok = ligne({ id: 'ok' });
  const vide = ligne({ id: 'vide', aUnResultat: false, createdAt: '2026-06-02T00:00:00Z' });
  const m = membresDuDossier(ok, [ok, vide]);
  assert(m.length === 1, 'la ligne sans resultat est ecartee');
  assert(membresDuDossier(vide, [ok, vide]).length === 0,
    'une ancre sans resultat n appelle aucun voisin');
}

// ------------------------------------------------------------
// Test 4 : le libelle pose avant extraction ne fait pas dossier
// ------------------------------------------------------------
console.log('\n# Test 4 : quatre societes sous un meme libelle ne fusionnent pas');
{
  // Le corpus au 6 aout 2026 : dix lignes sous ce libelle, couvrant
  // Project Saturn, un memorandum Weinberg, InHairCare et Woodpecker.
  const saturn = ligne({ id: 's', companyName: LIBELLE_AVANT_EXTRACTION, sourceFilename: 'Saturn.pdf', deckHash: 'd-s' });
  const weinberg = ligne({ id: 'w', companyName: LIBELLE_AVANT_EXTRACTION, sourceFilename: 'Weinberg.pdf', deckHash: 'd-w', createdAt: '2026-06-02T00:00:00Z' });
  const hair = ligne({ id: 'h', companyName: LIBELLE_AVANT_EXTRACTION, sourceFilename: 'InHairCare.pdf', deckHash: 'd-h', createdAt: '2026-06-03T00:00:00Z' });
  const wood = ligne({ id: 'p', companyName: LIBELLE_AVANT_EXTRACTION, sourceFilename: 'Woodpecker.pdf', deckHash: 'd-p', createdAt: '2026-06-04T00:00:00Z' });

  assert(cleDeDossier(LIBELLE_AVANT_EXTRACTION) === null,
    'le libelle pose avant extraction ne donne aucune cle');
  assert(membresDuDossier(saturn, [saturn, weinberg, hair, wood]).length === 0,
    'aucune chaine n est formee sur ce libelle');

  // Et la casse ne suffit pas a le contourner.
  const variante = ligne({ id: 'v', companyName: '  (Analyse En Cours)  ' });
  assert(cleDeDossier(variante.companyName) === null,
    'le refus tient a la casse et aux espaces pres');
}

// ------------------------------------------------------------
// Test 5 : un knockout ecrit un resultat sans avoir nomme personne
// ------------------------------------------------------------
console.log('\n# Test 5 : porter un resultat ne suffit pas a etre indexable');
{
  // Les deux lignes knockout du corpus portent un result_json ET le
  // libelle de t0. Le seul critere du resultat les aurait admises.
  const ko1 = ligne({ id: 'k1', companyName: LIBELLE_AVANT_EXTRACTION, aUnResultat: true });
  const ko2 = ligne({ id: 'k2', companyName: LIBELLE_AVANT_EXTRACTION, aUnResultat: true, createdAt: '2026-06-02T00:00:00Z' });
  assert(membresDuDossier(ko1, [ko1, ko2]).length === 0,
    'deux knockouts non nommes ne forment pas un dossier');
}

// ------------------------------------------------------------
// Test 6 : le cas nominal, et l ordre
// ------------------------------------------------------------
console.log('\n# Test 6 : deux notes du meme dossier, dans l ordre chronologique');
{
  const notes = ligne({ id: 'n2', createdAt: '2022-05-20T00:00:00Z', sourceFilename: 'comptes-2021.pdf', deckHash: 'deck-comptes' });
  const prospectus = ligne({ id: 'n1', createdAt: '2021-06-30T00:00:00Z', sourceFilename: 'prospectus.pdf', deckHash: 'deck-prospectus' });
  const autre = ligne({ id: 'x', companyName: 'Autre SA', createdAt: '2021-07-01T00:00:00Z' });

  const m = membresDuDossier(prospectus, [notes, prospectus, autre]);
  assert(m.length === 2, 'deux membres');
  assert(m[0].id === 'n1' && m[1].id === 'n2', 'ordre chronologique, prospectus puis comptes');
  assert(!m.some((x) => x.id === 'x'), 'l autre societe reste dehors');

  // L ancre entre meme absente des candidates, et jamais deux fois.
  const m2 = membresDuDossier(prospectus, [notes]);
  assert(m2.length === 2, 'l ancre entre meme absente des candidates');
  assert(m2.filter((x) => x.id === 'n1').length === 1, 'et elle n entre pas deux fois');

  // Deux lignes a la meme date rendent toujours le meme ordre.
  const j1 = ligne({ id: 'bbb', createdAt: '2026-01-01T00:00:00Z' });
  const j2 = ligne({ id: 'aaa', createdAt: '2026-01-01T00:00:00Z' });
  const o1 = membresDuDossier(j1, [j1, j2]).map((x) => x.id).join(',');
  const o2 = membresDuDossier(j1, [j2, j1]).map((x) => x.id).join(',');
  assert(o1 === o2, 'l ordre ne depend pas de l ordre d arrivee des candidates');
}

// ------------------------------------------------------------
// Test 7 : l assise documentaire
// ------------------------------------------------------------
console.log('\n# Test 7 : une chaine sur un seul document n est pas une trajectoire');
{
  // Braincube au 6 aout 2026 : sept runs, un seul deck_hash.
  const memeDoc = [1, 2, 3, 4, 5, 6, 7].map((i) =>
    ligne({ id: `b${i}`, deckHash: 'dbe4deb2ff', createdAt: `2026-08-0${i}T00:00:00Z` }),
  );
  const a1 = assiseDocumentaire(memeDoc);
  assert(a1.documentsDistincts === 1, 'un seul document distinct sur sept runs');
  assert(a1.reposeSurPlusieursDocuments === false,
    'sept tirages d une meme entree ne font pas une trajectoire');

  const deuxDocs = assiseDocumentaire([
    ligne({ id: 'p', deckHash: 'deck-prospectus' }),
    ligne({ id: 'c', deckHash: 'deck-comptes' }),
  ]);
  assert(deuxDocs.documentsDistincts === 2, 'deux documents distincts');
  assert(deuxDocs.reposeSurPlusieursDocuments === true, 'assise etablie');

  // Les lignes anterieures a l empreinte se comptent a part et ne se
  // supposent ni identiques ni distinctes.
  const melange = assiseDocumentaire([
    ligne({ id: 'v', deckHash: null }),
    ligne({ id: 'v2', deckHash: null }),
    ligne({ id: 'n', deckHash: 'deck-un' }),
  ]);
  assert(melange.documentsDistincts === 1, 'une seule empreinte connue');
  assert(melange.sansEmpreinte === 2, 'deux lignes sans empreinte, comptees a part');
  assert(melange.reposeSurPlusieursDocuments === false,
    'une assise indeterminee ne se lit pas comme une assise etablie');

  const vide = assiseDocumentaire([]);
  assert(vide.documentsDistincts === 0 && vide.reposeSurPlusieursDocuments === false,
    'chaine vide : aucune assise');
}

// ------------------------------------------------------------
// Resume
// ------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} tests passes`);
if (failed > 0) {
  process.exit(1);
}
