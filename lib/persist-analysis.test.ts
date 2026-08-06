// ============================================================
// TESTS DETERMINISTES DE persist-analysis
// ------------------------------------------------------------
// Le module persist-analysis est le rempart contre la perte
// d analyses observee dans le bug Jabrilia (SSE qui coupe avant
// que le client persiste). Sa fiabilite est critique : si la
// logique casse silencieusement, on perd le travail LLM deja
// effectue. Ces tests couvrent les six chemins fonctionnels :
//
//   1. Persistence desactivee -> 'unsaved' avec reason explicite
//   2. Pas de collision, save reussi -> 'new-record'
//   3. Pas de collision, save echec -> 'unsaved' / save-failed
//   4. Collision, version creee -> 'new-version' avec versionNum
//   5. Collision, version echoue -> 'unsaved' / version-create-failed
//   6. Exception thrown -> 'unsaved' avec message d erreur
//
// Tests bonus :
//   7. companyName fallback 'Sans nom' si metadata vide
//   8. verdict fallback 'approfondir' si manquant
//   9. saveInput propage tous les champs optionnels
//  10. updateLive echoue apres version creee -> succes quand meme
//
// Comblement du trou de versionnement (6 aout 2026), tests 11 a 14 :
//  11. Premiere collision sur un dossier sans version -> le run initial
//      est archive AVANT le run courant, et il porte son propre contenu
//  12. Dossier deja versionne -> aucun archivage, un seul createVersion
//  13. Etat vivant illisible ou sans resultat -> pas d archivage, pas de
//      blocage du run courant
//  14. Archivage qui echoue -> le run courant est persiste quand meme
//
// Les fixtures des tests 11 a 14 font diverger l etat vivant de l entree
// sur les trois champs archives. Un jeu d essai qui porterait le meme
// resultat des deux cotes passerait aussi bien si le code archivait
// l entree au lieu de l etat lu, ce qui est precisement le defaut que ces
// tests existent pour interdire.
//
// Lance : tsx lib/persist-analysis.test.ts
// ============================================================

import {
  persistAnalysisWithDeps,
  type PersistDeps,
  type PersistInput,
} from './persist-analysis';

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

// ------------------------------------------------------------
// Helper : construit un set de deps mockees avec defaults
// ------------------------------------------------------------
function makeDeps(overrides: Partial<PersistDeps> = {}): PersistDeps {
  return {
    isPersistenceEnabled: () => true,
    extractAnalysisMetadata: () => ({ companyName: 'Acme Corp', verdict: 'investir' }),
    findExistingByCompany: async () => null,
    // Par defaut le dossier est deja versionne : c est le cas courant, et
    // il laisse les tests anterieurs a ce correctif exactement dans leur
    // etat d origine. Le cas du trou se demande explicitement.
    lireEtatVivantPourArchivage: async () => ({
      aDesVersions: true,
      resultJson: null,
      sourceFilename: null,
      pipelineDurationMs: null,
    }),
    saveAnalysis: async () => 'mock-id-123',
    updateAnalysisLive: async () => true,
    createVersion: async () => ({ versionNum: 2 }),
    ...overrides,
  };
}

const baseInput: PersistInput = {
  result: { mock: 'analysis' },
  sourceFilename: 'pitch.pdf',
  sourceText: null,
  sourcePages: 24,
  pipelineDurationMs: 240000,
};

(async () => {
// ------------------------------------------------------------
// Test 1 : Persistence desactivee
// ------------------------------------------------------------
console.log('\n# Test 1 : Persistence desactivee');
{
  const deps = makeDeps({ isPersistenceEnabled: () => false });
  const result = await persistAnalysisWithDeps(baseInput, deps);
  assert(result.saved === false, 'saved = false');
  assert(result.id === null, 'id = null');
  assert(result.mode === 'unsaved', 'mode = unsaved');
  assert(result.reason === 'persistence-disabled', 'reason = persistence-disabled');
}

// ------------------------------------------------------------
// Test 2 : Pas de collision, save reussi -> new-record
// ------------------------------------------------------------
console.log('\n# Test 2 : Pas de collision, save reussi');
{
  let saveCalled: boolean = false;
  let createVersionCalled: boolean = false;
  const deps = makeDeps({
    findExistingByCompany: async () => null,
    saveAnalysis: async () => {
      saveCalled = true;
      return 'new-id-789';
    },
    createVersion: async () => {
      createVersionCalled = true;
      return { versionNum: 1 };
    },
  });
  const result = await persistAnalysisWithDeps(baseInput, deps);
  assert(result.saved === true, 'saved = true');
  assert(result.id === 'new-id-789', 'id renvoye par saveAnalysis');
  assert(result.mode === 'new-record', 'mode = new-record');
  assert(saveCalled, 'saveAnalysis a ete appele');
  assert(!createVersionCalled, 'createVersion non appele si pas de collision');
  assert(result.collisionDetected === undefined, 'pas de collision flag');
}

// ------------------------------------------------------------
// Test 3 : Pas de collision, save echec -> unsaved / save-failed
// ------------------------------------------------------------
console.log('\n# Test 3 : Pas de collision, save echec');
{
  const deps = makeDeps({
    findExistingByCompany: async () => null,
    saveAnalysis: async () => null,
  });
  const result = await persistAnalysisWithDeps(baseInput, deps);
  assert(result.saved === false, 'saved = false quand save retourne null');
  assert(result.id === null, 'id = null');
  assert(result.mode === 'unsaved', 'mode = unsaved');
  assert(result.reason === 'save-failed', 'reason = save-failed');
}

// ------------------------------------------------------------
// Test 4 : Collision, version creee -> new-version
// ------------------------------------------------------------
console.log('\n# Test 4 : Collision avec auto-versioning');
{
  let saveCalled: boolean = false;
  let createVersionCalled: boolean = false;
  let updateLiveCalled: boolean = false;
  const deps = makeDeps({
    findExistingByCompany: async () => ({ id: 'existing-456', companyName: 'Acme Corp' }),
    saveAnalysis: async () => {
      saveCalled = true;
      return 'should-not-call';
    },
    createVersion: async () => {
      createVersionCalled = true;
      return { versionNum: 3 };
    },
    updateAnalysisLive: async () => {
      updateLiveCalled = true;
      return true;
    },
  });
  const result = await persistAnalysisWithDeps(baseInput, deps);
  assert(result.saved === true, 'saved = true');
  assert(result.id === 'existing-456', 'id = id du dossier existant');
  assert(result.mode === 'new-version', 'mode = new-version');
  assert(result.versionNum === 3, 'versionNum remonte de createVersion');
  assert(result.collisionDetected === true, 'collisionDetected = true');
  assert(result.existingCompanyName === 'Acme Corp', 'existingCompanyName remonte');
  assert(!saveCalled, 'saveAnalysis NON appele en cas de collision');
  assert(createVersionCalled, 'createVersion appele');
  assert(updateLiveCalled, 'updateAnalysisLive appele apres createVersion');
}

// ------------------------------------------------------------
// Test 5 : Collision, version echoue
// ------------------------------------------------------------
console.log('\n# Test 5 : Collision mais createVersion echoue');
{
  const deps = makeDeps({
    findExistingByCompany: async () => ({ id: 'existing-789', companyName: 'Acme Corp' }),
    createVersion: async () => null,
  });
  const result = await persistAnalysisWithDeps(baseInput, deps);
  assert(result.saved === false, 'saved = false');
  assert(result.id === null, 'id = null');
  assert(result.mode === 'unsaved', 'mode = unsaved');
  assert(result.reason === 'version-create-failed', 'reason = version-create-failed');
  assert(result.collisionDetected === true, 'collisionDetected = true meme en echec');
  assert(result.existingCompanyName === 'Acme Corp', 'existingCompanyName remonte');
}

// ------------------------------------------------------------
// Test 6 : Exception thrown
// ------------------------------------------------------------
console.log('\n# Test 6 : Exception thrown');
{
  const deps = makeDeps({
    extractAnalysisMetadata: () => {
      throw new Error('metadata extraction failed');
    },
  });
  // On capture les console.error pour eviter le bruit en sortie
  const origError = console.error;
  console.error = () => {};
  const result = await persistAnalysisWithDeps(baseInput, deps);
  console.error = origError;
  assert(result.saved === false, 'saved = false sur exception');
  assert(result.id === null, 'id = null');
  assert(result.mode === 'unsaved', 'mode = unsaved');
  assert(result.reason === 'metadata extraction failed', 'reason = message d erreur');
}

// ------------------------------------------------------------
// Test 7 : companyName fallback 'Sans nom'
// ------------------------------------------------------------
console.log('\n# Test 7 : Fallbacks sur metadata');
{
  let capturedCompanyName: string | null = null;
  const deps = makeDeps({
    extractAnalysisMetadata: () => ({ companyName: '', verdict: undefined }),
    findExistingByCompany: async (name: string) => {
      capturedCompanyName = name;
      return null;
    },
  });
  await persistAnalysisWithDeps(baseInput, deps);
  assert(capturedCompanyName === 'Sans nom', 'companyName fallback = Sans nom');
}

// ------------------------------------------------------------
// Test 8 : verdict fallback 'approfondir'
// ------------------------------------------------------------
{
  let capturedVerdict: string | null = null;
  const deps = makeDeps({
    extractAnalysisMetadata: () => ({ companyName: 'Beta Inc' }),
    saveAnalysis: async (input: any) => {
      capturedVerdict = input.verdict;
      return 'beta-id';
    },
  });
  await persistAnalysisWithDeps(baseInput, deps);
  assert(capturedVerdict === 'approfondir', 'verdict fallback = approfondir');
}

// ------------------------------------------------------------
// Test 9 : saveInput propage tous les champs
// ------------------------------------------------------------
console.log('\n# Test 9 : Propagation des champs au saveInput');
{
  let capturedInput: any = null;
  const deps = makeDeps({
    saveAnalysis: async (input: any) => {
      capturedInput = input;
      return 'gamma-id';
    },
  });
  const fullInput: PersistInput = {
    result: { mock: 'data' },
    sourceFilename: 'gamma.pdf',
    sourceText: 'extracted text',
    sourcePages: 42,
    pipelineDurationMs: 600000,
    pipelineEnginesStatus: { team: 'completed', market: 'completed' },
  };
  await persistAnalysisWithDeps(fullInput, deps);
  assert(capturedInput !== null, 'saveAnalysis a recu un input');
  assert(capturedInput.sourceFilename === 'gamma.pdf', 'sourceFilename propage');
  assert(capturedInput.sourceText === 'extracted text', 'sourceText propage');
  assert(capturedInput.sourcePages === 42, 'sourcePages propage');
  assert(capturedInput.pipelineDurationMs === 600000, 'pipelineDurationMs propage');
  assert(
    capturedInput.pipelineEnginesStatus?.team === 'completed',
    'pipelineEnginesStatus propage',
  );
  assert(capturedInput.resultJson?.mock === 'data', 'resultJson contient le result');
}

// ------------------------------------------------------------
// Test 10 : updateLive echoue mais version creee = succes quand meme
// ------------------------------------------------------------
console.log('\n# Test 10 : updateLive echoue apres version creee');
{
  // Cas degrade documente : si createVersion reussit mais updateLive
  // echoue, on doit quand meme retourner saved=true. La version est
  // en base, le live n est juste pas a jour - c est recuperable.
  const origWarn = console.warn;
  console.warn = () => {};
  const deps = makeDeps({
    findExistingByCompany: async () => ({ id: 'existing-aa', companyName: 'Acme Corp' }),
    createVersion: async () => ({ versionNum: 5 }),
    updateAnalysisLive: async () => false,
  });
  const result = await persistAnalysisWithDeps(baseInput, deps);
  console.warn = origWarn;
  assert(result.saved === true, 'saved = true meme si updateLive echoue');
  assert(result.mode === 'new-version', 'mode = new-version');
  assert(result.versionNum === 5, 'versionNum correct');
}

// ------------------------------------------------------------
// Test 11 : Premiere collision sur un dossier jamais versionne
// ------------------------------------------------------------
console.log('\n# Test 11 : Le run initial est archive a la premiere collision');
{
  // L etat vivant porte un contenu que rien d autre dans le test ne peut
  // fournir. Si le code archivait input.result au lieu de l etat lu, les
  // assertions sur snapshotJson, sourceFilename et pipelineDurationMs
  // tomberaient toutes les trois.
  const etatVivant = {
    aDesVersions: false,
    resultJson: { mock: 'run-initial-du-6-juin' },
    sourceFilename: 'prospectus-2021.pdf',
    pipelineDurationMs: 191919,
  };

  const appels: Array<{ snapshot: any; fichier: string | null; duree: number | null; note: string }> = [];
  let idLu: string | null = null;

  const deps = makeDeps({
    findExistingByCompany: async () => ({ id: 'existing-made', companyName: 'Made.com' }),
    lireEtatVivantPourArchivage: async (id: string) => {
      idLu = id;
      return etatVivant;
    },
    createVersion: async (args: any) => {
      appels.push({
        snapshot: args.snapshotJson,
        fichier: args.sourceFilename,
        duree: args.pipelineDurationMs,
        note: args.note,
      });
      return { versionNum: appels.length };
    },
  });

  const result = await persistAnalysisWithDeps(baseInput, deps);

  assert(idLu === 'existing-made', 'l etat vivant est lu sur le dossier en collision');
  assert(appels.length === 2, 'deux versions creees : le run initial puis le run courant');
  assert(
    appels[0]?.snapshot?.mock === 'run-initial-du-6-juin',
    'la PREMIERE version archive le resultat lu en base, pas l entree',
  );
  assert(
    appels[0]?.fichier === 'prospectus-2021.pdf',
    'la premiere version porte le fichier source du run initial',
  );
  assert(
    appels[0]?.duree === 191919,
    'la premiere version porte la duree du run initial',
  );
  assert(
    appels[1]?.snapshot?.mock === 'analysis',
    'la SECONDE version porte le resultat du run courant',
  );
  assert(
    appels[1]?.fichier === 'pitch.pdf',
    'la seconde version porte le fichier source du run courant',
  );
  assert(result.saved === true, 'saved = true');
  assert(result.mode === 'new-version', 'mode = new-version');
  assert(
    result.versionNum === 2,
    'le versionNum remonte est celui du run courant, jamais celui de l archive',
  );
}

// ------------------------------------------------------------
// Test 12 : Dossier deja versionne, rien a combler
// ------------------------------------------------------------
console.log('\n# Test 12 : Un dossier deja versionne ne se comble pas deux fois');
{
  const appels: any[] = [];
  const deps = makeDeps({
    findExistingByCompany: async () => ({ id: 'existing-bb', companyName: 'Acme Corp' }),
    lireEtatVivantPourArchivage: async () => ({
      // Un resultat est present, mais des versions existent deja : le
      // trou est ferme, et le contenu ne doit pas etre archive une
      // seconde fois. C est ce couple qui distingue la garde sur
      // aDesVersions d une garde sur la seule presence du resultat.
      aDesVersions: true,
      resultJson: { mock: 'ne-doit-pas-etre-archive' },
      sourceFilename: 'vieux.pdf',
      pipelineDurationMs: 111,
    }),
    createVersion: async (args: any) => {
      appels.push(args);
      return { versionNum: 7 };
    },
  });

  const result = await persistAnalysisWithDeps(baseInput, deps);

  assert(appels.length === 1, 'une seule version creee');
  assert(
    appels[0]?.snapshotJson?.mock === 'analysis',
    'la version creee est celle du run courant',
  );
  assert(result.versionNum === 7, 'versionNum = celui du run courant');
}

// ------------------------------------------------------------
// Test 13 : Etat vivant illisible ou sans resultat
// ------------------------------------------------------------
console.log('\n# Test 13 : Un etat vivant illisible ne bloque pas le run courant');
{
  for (const [libelle, etat] of [
    ['lecture en echec (null)', null],
    [
      'ligne sans result_json',
      { aDesVersions: false, resultJson: null, sourceFilename: null, pipelineDurationMs: null },
    ],
  ] as Array<[string, any]>) {
    const appels: any[] = [];
    const deps = makeDeps({
      findExistingByCompany: async () => ({ id: 'existing-cc', companyName: 'Acme Corp' }),
      lireEtatVivantPourArchivage: async () => etat,
      createVersion: async (args: any) => {
        appels.push(args);
        return { versionNum: 2 };
      },
    });

    const result = await persistAnalysisWithDeps(baseInput, deps);

    assert(appels.length === 1, `${libelle} : aucun archivage tente`);
    assert(
      appels[0]?.snapshotJson?.mock === 'analysis',
      `${libelle} : le run courant est versionne normalement`,
    );
    assert(result.saved === true, `${libelle} : saved = true`);
  }
}

// ------------------------------------------------------------
// Test 14 : L archivage echoue, le run courant passe quand meme
// ------------------------------------------------------------
console.log('\n# Test 14 : Un archivage en echec ne sacrifie pas le run courant');
{
  // Perdre le nouveau resultat pour sauver l ancien serait le meme
  // defaut dans l autre sens. L echec se trace et la chaine continue.
  const origWarn = console.warn;
  let avertissement = '';
  console.warn = (...args: any[]) => {
    avertissement = args.join(' ');
  };

  let appel = 0;
  const deps = makeDeps({
    findExistingByCompany: async () => ({ id: 'existing-dd', companyName: 'Acme Corp' }),
    lireEtatVivantPourArchivage: async () => ({
      aDesVersions: false,
      resultJson: { mock: 'run-initial' },
      sourceFilename: 'initial.pdf',
      pipelineDurationMs: 1000,
    }),
    createVersion: async () => {
      appel++;
      // Le premier appel est l archivage : il echoue. Le second est le
      // run courant : il reussit.
      return appel === 1 ? null : { versionNum: 1 };
    },
  });

  const result = await persistAnalysisWithDeps(baseInput, deps);
  console.warn = origWarn;

  assert(appel === 2, 'le run courant est tente malgre l echec de l archivage');
  assert(result.saved === true, 'saved = true');
  assert(result.mode === 'new-version', 'mode = new-version');
  assert(
    avertissement.includes('existing-dd'),
    'l echec de l archivage laisse une trace nommant le dossier',
  );
}

// ------------------------------------------------------------
// Resume
// ------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} tests passes`);
if (failed > 0) {
  process.exit(1);
}
})();
