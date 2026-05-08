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
// Resume
// ------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} tests passes`);
if (failed > 0) {
  process.exit(1);
}
})();
