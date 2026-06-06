// ============================================================
// TESTS DETERMINISTES DE LA DESAMBIGUISATION FONDATEURS
// ------------------------------------------------------------
// Lance : npx tsx lib/data-fetchers/disambiguation.test.ts
//
// Couvre le cas Platypus (fondateur ~50 ans avec publications
// 1863 et 1974 attribuees a tort) plus des cas homonyme generiques
// sur les portes temporelle et coherence de domaine.
// ============================================================

import {
  disambiguateGithub,
  disambiguatePublications,
  disambiguateWikipedia,
  domainGate,
  extractYearsFromText,
  plausibleWindow,
  temporalGate,
  type FounderDisambiguationContext,
} from './disambiguation';

let passed = 0;
let failed = 0;

function check<T>(name: string, got: T, expected: T): void {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}:\n    got      ${JSON.stringify(got)}\n    expected ${JSON.stringify(expected)}`);
  }
}

function checkTrue(name: string, condition: boolean, hint?: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${hint ? ' (' + hint + ')' : ''}`);
  }
}

const TODAY = 2026;

console.log('\n=== Fenetre temporelle plausible ===');
{
  const w1 = plausibleWindow({ name: 'X', birthYear: 1976 }, TODAY);
  check('birthYear=1976 -> min=1994', w1.min, 1994);
  check('birthYear=1976 -> source=birth', w1.source, 'birth');

  const w2 = plausibleWindow({ name: 'X', ageHint: 50 }, TODAY);
  check('ageHint=50 -> min=1994', w2.min, 1994);
  check('ageHint=50 -> source=age', w2.source, 'age');

  const w3 = plausibleWindow({ name: 'X' }, TODAY);
  check('aucun signal -> min=today-50', w3.min, 1976);
  check('aucun signal -> source=fallback', w3.source, 'fallback');
}

console.log('\n=== Porte temporelle ===');
{
  const platypus: FounderDisambiguationContext = { name: 'François-Alexandre Bertrand', birthYear: 1976, sector: 'naval' };
  const g1863 = temporalGate(1863, platypus, TODAY);
  checkTrue('Platypus: publi 1863 rejetee', !g1863.passed, g1863.reason);
  checkTrue('Platypus: raison mentionne anteriorite', g1863.reason.includes('anterieure'), g1863.reason);

  const g1974 = temporalGate(1974, platypus, TODAY);
  checkTrue('Platypus: publi 1974 rejetee', !g1974.passed, g1974.reason);

  const g2018 = temporalGate(2018, platypus, TODAY);
  checkTrue('Platypus: publi 2018 acceptee', g2018.passed, g2018.reason);

  const g2027 = temporalGate(2027, platypus, TODAY);
  checkTrue('publi 2027 acceptee a +1 (preprint)', g2027.passed);

  const g2028 = temporalGate(2028, platypus, TODAY);
  checkTrue('publi 2028 rejetee (futur improbable)', !g2028.passed);

  // Fallback conservateur sans birthYear ni ageHint
  const unknown: FounderDisambiguationContext = { name: 'Unknown', sector: 'software' };
  const fallback1863 = temporalGate(1863, unknown, TODAY);
  checkTrue('Fallback 50 ans: 1863 rejetee', !fallback1863.passed);
  const fallback1974 = temporalGate(1974, unknown, TODAY);
  checkTrue('Fallback 50 ans: 1974 rejetee (avant 1976)', !fallback1974.passed);
  const fallback1980 = temporalGate(1980, unknown, TODAY);
  checkTrue('Fallback 50 ans: 1980 acceptee', fallback1980.passed);

  const gInvalid = temporalGate(0, platypus, TODAY);
  checkTrue('annee 0 rejetee', !gInvalid.passed);
  const gNull = temporalGate(null, platypus, TODAY);
  checkTrue('annee null rejetee', !gNull.passed);
}

console.log('\n=== Porte coherence de domaine ===');
{
  const naval: FounderDisambiguationContext = { name: 'X', sector: 'ingenierie navale', subSector: 'naval' };
  const mesmer = domainGate({ title: 'Du magnetisme animal et de ses effets' }, naval);
  checkTrue('marqueur hors-champ flagrant rejete', !mesmer.passed, mesmer.reason);

  const phlogiston = domainGate({ title: 'Considerations sur le phlogiston' }, naval);
  checkTrue('phlogiston rejete', !phlogiston.passed);

  const navalPub = domainGate({ title: 'Hull design for cargo vessels', concepts: ['naval architecture', 'marine'] }, naval);
  checkTrue('publi naval acceptee', navalPub.passed, navalPub.reason);

  const noSectorCtx: FounderDisambiguationContext = { name: 'X' };
  const ambient = domainGate({ title: 'A study of animal magnetism foobar' }, noSectorCtx);
  checkTrue('sans secteur, marqueur flagrant toujours rejete', !ambient.passed);
  const ambient2 = domainGate({ title: 'A neutral paper' }, noSectorCtx);
  checkTrue('sans secteur, non flagrant -> accept', ambient2.passed);

  const softwareCtx: FounderDisambiguationContext = { name: 'X', sector: 'software' };
  const softwarePub = domainGate({ title: 'A new programming language', concepts: ['computer science'] }, softwareCtx);
  checkTrue('software vs computer science -> match', softwarePub.passed);

  const offDomain = domainGate({ title: 'Anthropologie medievale', concepts: ['medieval studies'] }, softwareCtx);
  checkTrue('medieval studies vs software -> rejet flagrant', !offDomain.passed);
}

console.log('\n=== Disambiguate publications: cas Platypus ===');
{
  const platypus: FounderDisambiguationContext = {
    name: 'François-Alexandre Bertrand',
    birthYear: 1976,
    sector: 'ingenierie navale',
    subSector: 'naval',
  };
  const pubs = [
    { title: 'Du magnetisme animal', year: 1863, venue: 'Memoires de l Academie' },
    { title: 'Sur les revolutions du globe', year: 1974, venue: 'Geophysique' },
    { title: 'Some random analysis', year: 1968 },
  ];
  const result = disambiguatePublications(pubs, platypus, {}, );
  check('Platypus: decision insufficient', result.decision, 'insufficient_disambiguation');
  check('Platypus: 0 kept', result.kept.length, 0);
  check('Platypus: 3 rejected', result.rejected.length, 3);
  const reasons = result.rejected.map((r) => r.reason).join(' ');
  checkTrue('Platypus: au moins une porte temporelle', reasons.includes('porte temporelle'));
  checkTrue('Platypus: rationale documente le rejet', result.rationale.length > 20);
}

console.log('\n=== Disambiguate publications: homonyme generique ===');
{
  const youngFounder: FounderDisambiguationContext = {
    name: 'Jean Martin',
    birthYear: 1990,
    sector: 'software',
  };
  // L homonyme historique mort en 1880 + le vrai fondateur 2024
  const mixed = [
    { title: 'Traite de theologie morale', year: 1840 },
    { title: 'Memoires sur la philosophie naturelle', year: 1870 },
    { title: 'A modern software stack', year: 2024, concepts: ['software', 'computer science'] },
  ];
  const result = disambiguatePublications(mixed, youngFounder);
  // 1 sur 3 passe les portes : ratio 0.33 < 0.5 -> insuffisant
  check('Homonyme melange: decision insufficient (ratio<0.5)', result.decision, 'insufficient_disambiguation');
  checkTrue('1 publi gardee minimum', result.kept.length === 1);

  const cleanFounder: FounderDisambiguationContext = {
    name: 'Clean Match',
    birthYear: 1985,
    sector: 'software',
  };
  const cleanPubs = [
    { title: 'A modern software stack', year: 2020, concepts: ['software'] },
    { title: 'Distributed systems at scale', year: 2022, concepts: ['computer science'] },
    { title: 'Machine learning for ops', year: 2024, concepts: ['machine learning'] },
  ];
  const cleanResult = disambiguatePublications(cleanPubs, cleanFounder);
  check('Clean match: decision evaluable', cleanResult.decision, 'evaluable');
  check('Clean match: 3 keeps', cleanResult.kept.length, 3);

  const emptyResult = disambiguatePublications([], cleanFounder);
  check('Empty: decision evaluable', emptyResult.decision, 'evaluable');
}

console.log('\n=== Wikipedia disambiguation ===');
{
  const platypus: FounderDisambiguationContext = {
    name: 'François-Alexandre Bertrand',
    birthYear: 1976,
    sector: 'naval',
  };
  // Page historique d un homonyme ne en 1812 mort en 1880
  const histExtract = 'Francois-Alexandre Bertrand (1812-1880) etait un magistrat francais, membre de l Academie des sciences morales et politiques. Il fut surtout connu pour ses travaux sur le magnetisme animal et son opposition au phlogiston.';
  const histResult = disambiguateWikipedia(histExtract, 'Francois-Alexandre Bertrand', platypus);
  check('Wikipedia historique: insufficient', histResult.decision, 'insufficient_disambiguation');

  // Page contemporaine plausible
  const modernExtract = 'Francois-Alexandre Bertrand, ne en 1976, est un entrepreneur francais fondateur de la societe Platypus en 2024, active dans l ingenierie navale.';
  const modernResult = disambiguateWikipedia(modernExtract, 'Francois-Alexandre Bertrand', platypus);
  check('Wikipedia moderne: evaluable', modernResult.decision, 'evaluable');

  // Extract sans annees plausibles + marqueur flagrant
  const flagrantExtract = 'Etude classique de l alchimie medievale au 16e siecle.';
  const flagrantResult = disambiguateWikipedia(flagrantExtract, 'Test', platypus);
  check('Wikipedia marqueur flagrant: insufficient', flagrantResult.decision, 'insufficient_disambiguation');

  const yearsFromText = extractYearsFromText('Born in 1976, died in 2024. Footnote refers to 1812.');
  checkTrue('extractYears: 1976 present', yearsFromText.includes(1976));
  checkTrue('extractYears: 1812 present', yearsFromText.includes(1812));
  checkTrue('extractYears: 2024 present', yearsFromText.includes(2024));
}

console.log('\n=== GitHub disambiguation ===');
{
  const aiFounder: FounderDisambiguationContext = {
    name: 'AI Founder',
    sector: 'artificial intelligence',
    subSector: 'machine learning',
  };
  // Bio compatible
  const ok = disambiguateGithub({
    bio: 'Founder of an AI startup, working on LLMs and computer vision.',
    company: 'AI Co',
    topRepoNames: ['llm-eval'],
    topRepoDescriptions: ['Library for evaluating LLMs'],
  }, aiFounder);
  check('GitHub AI founder: evaluable', ok.decision, 'evaluable');

  // Bio hors-champ flagrant
  const off = disambiguateGithub({
    bio: 'Researcher in medieval theology and natural philosophy',
    topRepoNames: ['historical-archives'],
    topRepoDescriptions: ['Catalog of medieval studies texts'],
  }, aiFounder);
  check('GitHub hors-champ: insufficient', off.decision, 'insufficient_disambiguation');

  // Bio vide : pas de rejet
  const empty = disambiguateGithub({}, aiFounder);
  check('GitHub vide: evaluable', empty.decision, 'evaluable');
}

console.log('\n=== Resume ===');
console.log(`  Total : ${passed + failed}`);
console.log(`  PASS  : ${passed}`);
console.log(`  FAIL  : ${failed}`);
process.exit(failed > 0 ? 1 : 0);
