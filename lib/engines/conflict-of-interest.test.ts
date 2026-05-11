// ============================================================
// TESTS DETERMINISTES DU MOTEUR CONFLICT-OF-INTEREST
// ------------------------------------------------------------
// Lance : npx tsx lib/engines/conflict-of-interest.test.ts
// ============================================================

import {
  detectConflictsOfInterest,
  buildConflictOfInterestBlock,
  type ConflictOfInterestFlag,
} from './conflict-of-interest';
import type { ExtractionOutput } from './types';

let passed = 0;
let failed = 0;

function check<T>(name: string, got: T, expected: T): void {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  }
}

function checkTrue(name: string, condition: boolean): void {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}: condition false`);
  }
}

function mockExtraction(overrides: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    companyName: 'TestCo',
    sector: 'Fintech',
    subSector: 'Lending B2B',
    country: 'France',
    geographicHub: 'Paris',
    yearFounded: 2022,
    founders: [],
    marketPitch: 'Lorem ipsum',
    productDescription: 'Plateforme',
    businessModel: 'SaaS B2B',
    traction: { metrics: [], revenue: '500K' },
    fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Sequoia', coInvestors: ['Index', 'Eurazeo'] },
    competitorsCited: [],
    rawSummary: 'Resume',
    ...overrides,
  } as any;
}

console.log('=== Test 1 : aucun fondProfile -> aucun conflit ===');
{
  const flags = detectConflictsOfInterest(mockExtraction(), null);
  check('flags vide quand inputs null', flags, []);
}

console.log('\n=== Test 2 : fundProfile vide -> aucun conflit ===');
{
  const flags = detectConflictsOfInterest(mockExtraction(), {
    fundName: null, portfolioCompanies: [], syndicatePartners: [],
  });
  check('flags vide quand champs vides', flags, []);
}

console.log('\n=== Test 3 : self-deal exact match ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({ fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Eurazeo', coInvestors: [] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: [], syndicatePartners: [] },
  );
  checkTrue('1 flag self-deal detecte', flags.length === 1);
  checkTrue('kind self-deal', flags[0]?.kind === 'self-deal');
  checkTrue('severity high', flags[0]?.severity === 'high');
}

console.log('\n=== Test 4 : self-deal via racine partagee (Eurazeo Smart City) ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({ fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Eurazeo Smart City Fund II', coInvestors: [] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: [], syndicatePartners: [] },
  );
  checkTrue('self-deal match avec suffixe', flags.length === 1 && flags[0].kind === 'self-deal');
}

console.log('\n=== Test 5 : self-deal cote co-investor ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({ fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Sequoia', coInvestors: ['Eurazeo Smart City'] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: [], syndicatePartners: [] },
  );
  checkTrue('self-deal sur co-investor', flags.length === 1 && flags[0].kind === 'self-deal');
}

console.log('\n=== Test 6 : pas de self-deal quand fonds different ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({ fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Sequoia', coInvestors: ['Index'] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: [], syndicatePartners: [] },
  );
  check('zero flags', flags, []);
}

console.log('\n=== Test 7 : follow-on portfolio detecte ===');
{
  // Override fundraise pour eviter le self-deal residuel
  // hérite du default mockExtraction (coInvestors contient Eurazeo).
  const flags = detectConflictsOfInterest(
    mockExtraction({ companyName: 'Qonto', fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Sequoia', coInvestors: ['Index'] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: ['Qonto', 'Spendesk'], syndicatePartners: [] },
  );
  checkTrue('1 flag follow-on', flags.length === 1 && flags[0].kind === 'portfolio-followon');
  checkTrue('severity medium', flags[0]?.severity === 'medium');
}

console.log('\n=== Test 8 : follow-on insensible aux accents et casse ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({ companyName: 'Médecine SAS', fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Sequoia', coInvestors: ['Index'] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: ['Medecine'], syndicatePartners: [] },
  );
  checkTrue('match accent/case', flags.length === 1 && flags[0].kind === 'portfolio-followon');
}

console.log('\n=== Test 9 : syndicate-regular detecte ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({ fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Sequoia Capital', coInvestors: ['Y Combinator'] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: [], syndicatePartners: ['Sequoia', 'a16z'] },
  );
  checkTrue('1 flag syndicate', flags.length === 1 && flags[0].kind === 'syndicate-regular');
  checkTrue('severity low', flags[0]?.severity === 'low');
}

console.log('\n=== Test 10 : combinaison self-deal + follow-on ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({ companyName: 'Qonto', fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Eurazeo', coInvestors: [] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: ['Qonto'], syndicatePartners: [] },
  );
  checkTrue('2 flags', flags.length === 2);
  checkTrue('1 self-deal', flags.filter((f: ConflictOfInterestFlag) => f.kind === 'self-deal').length === 1);
  checkTrue('1 follow-on', flags.filter((f: ConflictOfInterestFlag) => f.kind === 'portfolio-followon').length === 1);
}

console.log('\n=== Test 11a : BOARD_INSIDER detecte sur founders ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({
      companyName: 'Ambulife',
      founders: [{ name: 'Olivier Sofia', role: 'CEO', background: '' }],
      boardMembers: [
        { name: 'Olivier Sofia', role: 'CEO', affiliation: 'Ambulife' },
        { name: 'Steve Moradel', role: 'Directeur de la Strategie - cofondateur', affiliation: 'ESSEC' },
      ],
      fundraise: { stage: 'seed', amount: '250K EUR', leadInvestor: '', coInvestors: [] } as any,
    }),
    { fundName: 'Prelude Capital', portfolioCompanies: [], syndicatePartners: [], userIdentity: 'Olivier Sofia' },
  );
  checkTrue('1 flag board-insider sur founder', flags.length === 1 && flags[0].kind === 'board-insider');
  checkTrue('severity high', flags[0]?.severity === 'high');
  checkTrue('rationale mentionne fondateur', !!flags[0]?.rationale?.toLowerCase().includes('fondateur'));
}

console.log('\n=== Test 11b : BOARD_INSIDER detecte sur boardMembers (Ambulife reel) ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({
      companyName: 'Ambulife',
      founders: [{ name: 'Olivier Sofia', role: 'CEO', background: '' }],
      boardMembers: [
        { name: 'Olivier Sofia', role: 'CEO', affiliation: 'Ambulife' },
        { name: 'Steve Moradel', role: 'Directeur de la Strategie - cofondateur', affiliation: 'ESSEC' },
      ],
      fundraise: { stage: 'seed', amount: '250K EUR', leadInvestor: '', coInvestors: [] } as any,
    }),
    { fundName: 'Prelude Capital', portfolioCompanies: [], syndicatePartners: [], userIdentity: 'Steve Moradel' },
  );
  checkTrue('1 flag board-insider sur board', flags.length === 1 && flags[0].kind === 'board-insider');
  checkTrue('severity high', flags[0]?.severity === 'high');
  checkTrue('matchedEntity contient Steve Moradel', flags[0]?.matchedEntity?.includes('Steve Moradel') === true);
}

console.log('\n=== Test 11c : pas de BOARD_INSIDER quand userIdentity absent ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({
      boardMembers: [{ name: 'Steve Moradel', role: 'cofondateur' }],
    }),
    { fundName: 'Prelude', portfolioCompanies: [], syndicatePartners: [] },
  );
  // userIdentity non renseigne : compat ascendante, aucun flag board-insider
  checkTrue('aucun board-insider quand userIdentity manquant', flags.filter(f => f.kind === 'board-insider').length === 0);
}

console.log('\n=== Test 11d : BOARD_INSIDER insensible a la casse et aux accents ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({
      boardMembers: [{ name: 'STEVE MORADEL', role: 'cofondateur' }],
    }),
    { fundName: 'Prelude', portfolioCompanies: [], syndicatePartners: [], userIdentity: 'steve moradel' },
  );
  checkTrue('match casse differente', flags.filter(f => f.kind === 'board-insider').length === 1);
}

console.log('\n=== Test 11e : pas de faux positif quand le user n est nulle part ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({
      founders: [{ name: 'Olivier Sofia', role: 'CEO', background: '' }],
      boardMembers: [{ name: 'Olivier Sofia', role: 'CEO' }, { name: 'Edgard Palle', role: 'CMO' }],
    }),
    { fundName: 'Prelude', portfolioCompanies: [], syndicatePartners: [], userIdentity: 'Steve Moradel' },
  );
  checkTrue('aucun flag si user absent', flags.length === 0);
}

console.log('\n=== Test 11 : buildBlock vide si pas de flags ===');
{
  const block = buildConflictOfInterestBlock([]);
  check('block vide', block, '');
}

console.log('\n=== Test 12 : buildBlock contient ALERTE GOUVERNANCE ===');
{
  const flags = detectConflictsOfInterest(
    mockExtraction({ fundraise: { stage: 'seed', amount: '2M', leadInvestor: 'Eurazeo', coInvestors: [] } as any }),
    { fundName: 'Eurazeo', portfolioCompanies: [], syndicatePartners: [] },
  );
  const block = buildConflictOfInterestBlock(flags);
  checkTrue('mentionne ALERTE GOUVERNANCE', block.includes('ALERTE GOUVERNANCE'));
  checkTrue('mentionne Self-deal', block.includes('Self-deal'));
  checkTrue('mentionne severite haute', block.toLowerCase().includes('severite haute'));
}

console.log(`\n${passed + failed}/${passed + failed} : ${passed}/${passed + failed} tests passes`);
if (failed > 0) process.exit(1);
